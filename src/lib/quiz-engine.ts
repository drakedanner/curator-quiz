import type { Asset, Curator, ExtraQuestion, QuizQuestion, QuizSettings } from "@/types";
import assetData from "../../data.json";
import extraQuestions from "../../extra-questions.json";

type DataShape = {
  stablecoins: Asset[];
  curators: Curator[];
  questionBank: ExtraQuestion[];
  [key: string]: unknown;
};

const data = assetData as unknown as DataShape;
const extras = extraQuestions as ExtraQuestion[];

// Build flat asset list from all top-level arrays (they use .category internally)
const ALL_ASSETS: Asset[] = [];
for (const [key, val] of Object.entries(data)) {
  if (key === "curators" || key === "questionBank") continue;
  if (Array.isArray(val)) ALL_ASSETS.push(...(val as Asset[]));
}

const ALL_CURATORS: Curator[] = data.curators ?? [];

// Deduplicate extras (questionBank and extra-questions.json may overlap)
const EXTRA_QUESTIONS: ExtraQuestion[] = (() => {
  const seen = new Set<string>();
  const result: ExtraQuestion[] = [];
  for (const eq of [...extras, ...(data.questionBank ?? [])]) {
    const key = eq.text;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(eq);
    }
  }
  return result;
})();

// ── Helpers ────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickDistractors(correct: string, pool: string[], count = 3): string[] {
  const unique = [...new Set(pool.filter((v) => v !== correct))];
  shuffle(unique);
  return unique.slice(0, count);
}

/** Strip all parenthetical hints from answer choices so they don't give away the answer. */
function stripHints(choice: string): string {
  return choice.replace(/\s*\([^)]*\)/g, "").trim();
}

function toQuizQuestion(
  type: string,
  text: string,
  correct: string,
  wrongs: string[],
  explanation: string,
  coin: string
): QuizQuestion | null {
  if (wrongs.length < 3) return null;
  const strippedCorrect = stripHints(correct);
  const strippedWrongs = wrongs.slice(0, 3).map(stripHints);
  // Drop question if stripping created duplicate or identical choices
  const uniqueChoices = new Set([strippedCorrect, ...strippedWrongs]);
  if (uniqueChoices.size < 4) return null;
  const choices = shuffle([strippedCorrect, ...strippedWrongs]);
  return {
    type,
    text,
    choices,
    correctIndex: choices.indexOf(strippedCorrect),
    explanation,
    coin,
  };
}

// ── Asset Templates ────────────────────────

type TemplateGen = (asset: Asset, peers: Asset[]) => QuizQuestion | null;

const ASSET_TEMPLATES: { type: string; applicable: (a: Asset) => boolean; generate: TemplateGen }[] = [
  {
    type: "Issuer",
    applicable: (a) => !!a.issuer,
    generate: (a, peers) =>
      toQuizQuestion(
        "Issuer",
        `Who is the issuer of <strong>${a.name}</strong>?`,
        a.issuer,
        pickDistractors(a.issuer, peers.map((p) => p.issuer)),
        `${a.name} is issued by ${a.issuer}. ${a.type} asset${a.marketCap ? ` with ${a.marketCap} market cap` : ""}. ${a.keyFact}`,
        a.name
      ),
  },
  {
    type: "Issuer",
    applicable: (a) => !!a.issuer,
    generate: (a, peers) =>
      toQuizQuestion(
        "Issuer",
        `Which asset is issued by <strong>${a.issuer}</strong>?`,
        a.name,
        pickDistractors(a.name, peers.map((p) => p.name)),
        `${a.issuer} issues ${a.name}, a ${a.type} asset backed by ${a.backingShort}. ${a.keyFact}`,
        a.name
      ),
  },
  {
    type: "Backing",
    applicable: (a) => !!a.backingShort,
    generate: (a, peers) =>
      toQuizQuestion(
        "Backing",
        `What backs <strong>${a.name}</strong>?`,
        a.backingShort,
        pickDistractors(a.backingShort, peers.filter((p) => p.backingShort !== a.backingShort).map((p) => p.backingShort)),
        `${a.name} (${a.issuer}) is backed by ${a.backingShort}. This makes it a ${a.type} asset. ${a.keyFact}`,
        a.name
      ),
  },
  {
    type: "Type",
    applicable: (a) => !!a.type,
    generate: (a, peers) =>
      toQuizQuestion(
        "Type",
        `What type of asset is <strong>${a.name}</strong>?`,
        a.type,
        pickDistractors(a.type, peers.filter((p) => p.type !== a.type).map((p) => p.type)),
        `${a.name} is a ${a.type} asset issued by ${a.issuer}, backed by ${a.backingShort}. ${a.keyFact}`,
        a.name
      ),
  },
  {
    type: "Yield",
    applicable: (a) => !!a.yieldSource && a.hasYield,
    generate: (a, peers) =>
      toQuizQuestion(
        "Yield",
        `Where does <strong>${a.name}</strong>'s yield come from?`,
        a.yieldSource!,
        pickDistractors(a.yieldSource!, peers.filter((p) => p.yieldSource && p.yieldSource !== a.yieldSource).map((p) => p.yieldSource!)),
        `${a.name}'s yield comes from ${a.yieldSource}. ${a.yield ? `Current yield: ${a.yield}.` : ""} This is important because the yield source determines what risks holders are exposed to — ${a.name} holders are ultimately dependent on ${a.yieldSource} continuing to generate returns.`,
        a.name
      ),
  },
  {
    type: "Key Fact",
    applicable: (a) => !!a.keyFact && a.keyFact.length > 20,
    generate: (a, peers) => {
      let fact = a.keyFact;
      if (fact.length > 120) fact = fact.split(".")[0] + ".";
      return toQuizQuestion(
        "Key Fact",
        `Which asset does this describe? <em>"${fact}"</em>`,
        a.name,
        pickDistractors(a.name, peers.map((p) => p.name)),
        `This describes ${a.name} (${a.type}, issued by ${a.issuer}). Full context: ${a.keyFact}${a.curatorUsage ? ` Curator usage: ${a.curatorUsage}` : ""}`,
        a.name
      );
    },
  },
  {
    type: "Peg",
    applicable: (a) => !!a.peg,
    generate: (a, peers) => {
      const pegs = [...new Set(peers.map((p) => p.peg).filter(Boolean))];
      const distractors = pickDistractors(a.peg, pegs);
      const padExtras = ["USD", "EUR", "ETH", "BTC", "ETH (appreciating)", "BTC (appreciating)", "USD (appreciating)"];
      for (const e of padExtras) {
        if (distractors.length >= 3) break;
        if (e !== a.peg && !distractors.includes(e)) distractors.push(e);
      }
      const pegContext = a.peg.includes("appreciating")
        ? `${a.name} is pegged to ${a.peg} — meaning the token's value increases over time relative to the base asset as yield accrues. Unlike a rebasing token, the token count stays the same but each token is worth more.`
        : `${a.name} is pegged to ${a.peg}. It's a ${a.type} asset issued by ${a.issuer}, backed by ${a.backingShort}.`;
      return toQuizQuestion(
        "Peg",
        `What is <strong>${a.name}</strong> pegged to?`,
        a.peg,
        distractors,
        pegContext,
        a.name
      );
    },
  },
  {
    type: "Curator Usage",
    applicable: (a) => !!a.curatorUsage && a.curatorUsage.length > 10,
    generate: (a, peers) => {
      let usage = a.curatorUsage;
      if (usage.length > 100) usage = usage.split(".")[0] + ".";
      return toQuizQuestion(
        "Curator Usage",
        `Which asset has this curator usage? <em>"${usage}"</em>`,
        a.name,
        pickDistractors(a.name, peers.map((p) => p.name)),
        `This describes ${a.name} (${a.type}, issued by ${a.issuer}). Full curator usage: ${a.curatorUsage}. ${a.keyFact}`,
        a.name
      );
    },
  },
  {
    type: "Regulation",
    applicable: (a) => !!a.regulation && a.regulation.length > 5,
    generate: (a, peers) =>
      toQuizQuestion(
        "Regulation",
        `What is <strong>${a.name}</strong>'s regulatory status?`,
        a.regulation,
        pickDistractors(a.regulation, peers.filter((p) => p.regulation !== a.regulation).map((p) => p.regulation)),
        `${a.name} (${a.issuer}): ${a.regulation}. This matters for curator risk assessment — regulated assets with audited reserves (like USDC with Deloitte monthly attestations) carry different counterparty risk than unregulated or decentralized alternatives.`,
        a.name
      ),
  },
  {
    type: "Withdrawal",
    applicable: (a) => !!a.withdrawalTime,
    generate: (a, peers) => {
      const pool = peers.filter((p) => p.withdrawalTime && p.withdrawalTime !== a.withdrawalTime).map((p) => p.withdrawalTime!);
      const distractors = pickDistractors(a.withdrawalTime!, pool);
      const padExtras = ["Instant", "1-5 days", "7+ days", "7+ days (EigenLayer cooldown + ETH unstaking)", "14+ days standard, instant with 1% fee"];
      for (const e of padExtras) {
        if (distractors.length >= 3) break;
        if (e !== a.withdrawalTime && !distractors.includes(e)) distractors.push(e);
      }
      return toQuizQuestion(
        "Withdrawal",
        `What is the withdrawal time for <strong>${a.name}</strong>?`,
        a.withdrawalTime!,
        distractors,
        `${a.name} (${a.issuer}) has a withdrawal time of ${a.withdrawalTime}. Withdrawal time matters for liquidation risk — longer withdrawal periods mean the asset can trade at a discount to NAV during market stress, since arbitrageurs can't quickly redeem to close the gap.${a.depegHistory && !a.depegHistory.startsWith("No ") ? ` History: ${a.depegHistory}` : ""}`,
        a.name
      );
    },
  },
  {
    type: "Depeg",
    applicable: (a) => !!a.depegHistory && a.depegHistory.length > 30 && !a.depegHistory.startsWith("No "),
    generate: (a, peers) => {
      let hint = a.depegHistory!;
      if (hint.length > 120) hint = hint.split(".")[0] + ".";
      return toQuizQuestion(
        "Depeg",
        `Which asset had this depeg event? <em>"${hint}"</em>`,
        a.name,
        pickDistractors(a.name, peers.map((p) => p.name)),
        `This was ${a.name} (${a.type}, issued by ${a.issuer}). Full depeg history: ${a.depegHistory}${a.withdrawalTime ? ` Withdrawal time: ${a.withdrawalTime} — longer withdrawal windows contributed to the depeg as holders couldn't quickly redeem.` : ""}`,
        a.name
      );
    },
  },
  {
    type: "Risk Layers",
    applicable: (a) => !!a.riskLayers,
    generate: (a) => {
      const layerExplanations: Record<string, Record<number, string>> = {
        lst: {
          2: `${a.name} has 2 risk layers: (1) Ethereum base layer and (2) the staking protocol (${a.issuer}). If the staking protocol has a bug or slashing event, stakers are exposed — but there's no restaking or AVS risk.`,
        },
        lrt: {
          4: `${a.name} has 4 risk layers: (1) Ethereum base layer, (2) the staking protocol, (3) the restaking protocol (${a.restakingProtocol ?? "EigenLayer"}), and (4) the AVS (Actively Validated Service) that the stake secures. Each layer adds smart contract and slashing risk on top of the last.`,
        },
        btc: {
          1: `${a.name} has 1 risk layer: custody/bridging. The BTC sits in ${a.issuer}'s custody — the only risk is the custodian or bridge, not any staking or restaking protocol.`,
          3: `${a.name} has 3 risk layers: (1) Bitcoin base layer, (2) the staking protocol (${a.restakingProtocol ?? "Babylon"}), and (3) ${a.issuer} as custodial intermediary. More layers than a simple wrapped BTC, but fewer than an Ethereum LRT.`,
        },
      };
      const explanation =
        layerExplanations[a.category]?.[a.riskLayers!] ??
        `${a.name} has ${a.riskLayers} risk layer(s). Each layer (base chain, staking, restaking, AVS) adds smart contract and slashing risk.`;
      return toQuizQuestion(
        "Risk Layers",
        `How many risk layers does <strong>${a.name}</strong> have?`,
        String(a.riskLayers),
        pickDistractors(String(a.riskLayers), ["1", "2", "3", "4", "5"]),
        explanation,
        a.name
      );
    },
  },
];

// ── Curator Templates ──────────────────────

type CuratorGen = (c: Curator, peers: Curator[]) => QuizQuestion | null;

const CURATOR_TEMPLATES: { type: string; applicable: (c: Curator) => boolean; generate: CuratorGen }[] = [
  {
    type: "Curator",
    applicable: (c) => !!c.tvl,
    generate: (c, peers) =>
      toQuizQuestion("Curator", `What is <strong>${c.name}</strong>'s approximate TVL?`, c.tvl, pickDistractors(c.tvl, peers.filter((p) => p.tvl !== c.tvl).map((p) => p.tvl)), `${c.name} manages ${c.tvl} in TVL. They are a ${c.type} curator operating on ${c.venues.join(", ")}. ${c.keyFact}`, c.name),
  },
  {
    type: "Curator",
    applicable: (c) => !!c.type,
    generate: (c, peers) =>
      toQuizQuestion("Curator", `What is <strong>${c.name}</strong>'s specialization?`, c.type, pickDistractors(c.type, peers.filter((p) => p.type !== c.type).map((p) => p.type)), `${c.name} specializes in ${c.type}. They manage ${c.tvl} across ${c.venues.join(", ")} with key vaults including ${c.keyVaults.join(", ")}. Their collateral preference: ${c.collateralPreference}.`, c.name),
  },
  {
    type: "Curator",
    applicable: (c) => c.venues?.length > 0,
    generate: (c, peers) => {
      const correct = c.venues.join(", ");
      return toQuizQuestion("Curator", `Which venues does <strong>${c.name}</strong> operate on?`, correct, pickDistractors(correct, peers.filter((p) => p.venues.join(", ") !== correct).map((p) => p.venues.join(", "))), `${c.name} operates on ${correct}. They are a ${c.type} curator with ${c.tvl} TVL. Key vaults: ${c.keyVaults.join(", ")}. ${c.keyFact}`, c.name);
    },
  },
  {
    type: "Curator",
    applicable: (c) => !!c.streamExposure && c.streamExposure.length > 5,
    generate: (c, peers) =>
      toQuizQuestion("Curator", `Which curator had this Stream Finance exposure? <em>"${c.streamExposure}"</em>`, c.name, pickDistractors(c.name, peers.map((p) => p.name)), `This was ${c.name} (${c.type}, ${c.tvl} TVL). Their Stream Finance exposure: ${c.streamExposure}. The Stream Finance collapse in Nov 2025 was a major test of curator risk management — how each curator responded revealed their real operational maturity.`, c.name),
  },
  {
    type: "Curator",
    applicable: (c) => !!c.feeModel,
    generate: (c, peers) =>
      toQuizQuestion("Curator", `What is <strong>${c.name}</strong>'s fee model?`, c.feeModel, pickDistractors(c.feeModel, peers.filter((p) => p.feeModel !== c.feeModel).map((p) => p.feeModel)), `${c.name} charges ${c.feeModel}. Fee models matter because they create different incentive structures — performance fees align curator incentives with depositor returns, while flat fees or per-TVL fees incentivize AUM growth. ${c.name} is a ${c.type} curator with ${c.tvl} TVL.`, c.name),
  },
  {
    type: "Curator",
    applicable: (c) => !!c.keyFact && c.keyFact.length > 20,
    generate: (c, peers) => {
      let fact = c.keyFact;
      if (fact.length > 120) fact = fact.split(".")[0] + ".";
      return toQuizQuestion("Curator", `Which curator does this describe? <em>"${fact}"</em>`, c.name, pickDistractors(c.name, peers.map((p) => p.name)), `This describes ${c.name} (${c.type}, ${c.tvl} TVL, operating on ${c.venues.join(", ")}). Full context: ${c.keyFact}`, c.name);
    },
  },
  {
    type: "Curator",
    applicable: (c) => !!c.collateralPreference,
    generate: (c, peers) =>
      toQuizQuestion("Curator", `What is <strong>${c.name}</strong>'s collateral preference?`, c.collateralPreference, pickDistractors(c.collateralPreference, peers.filter((p) => p.collateralPreference !== c.collateralPreference).map((p) => p.collateralPreference)), `${c.name}'s collateral preference is: ${c.collateralPreference}. This reflects their ${c.type} approach. Collateral preference is one of the most important differentiators between curators — it determines what assets can be used as loan collateral in their vaults and directly impacts the risk profile depositors are exposed to.`, c.name),
  },
];

// ── Pool Builder ───────────────────────────

function getFilteredAssets(settings: QuizSettings): Asset[] {
  let assets = [...ALL_ASSETS];
  const cat = settings.categories;

  if (cat !== "all") {
    if (cat === "eth-collateral") {
      assets = assets.filter((a) => a.category === "lst" || a.category === "lrt");
    } else if (cat === "non-stable") {
      assets = assets.filter((a) => a.category !== "stablecoin");
    } else {
      assets = assets.filter((a) => a.category === cat);
    }
  }

  if (!settings.collapsed) {
    assets = assets.filter((a) => !a.collapsed);
  }

  return assets;
}

function buildPool(settings: QuizSettings): QuizQuestion[] {
  const pool: QuizQuestion[] = [];
  const assets = getFilteredAssets(settings);

  // Generate from asset templates
  for (const tmpl of ASSET_TEMPLATES) {
    for (const asset of assets) {
      if (!tmpl.applicable(asset)) continue;
      const peers = assets.filter((a) => a.category === asset.category && a.name !== asset.name);
      const peerPool = peers.length >= 3 ? peers : assets.filter((a) => a.name !== asset.name);
      const q = tmpl.generate(asset, peerPool);
      if (q) pool.push(q);
    }
  }

  // Curator questions
  if (settings.curators && (settings.categories === "all" || settings.categories === "stablecoin")) {
    for (const tmpl of CURATOR_TEMPLATES) {
      for (const curator of ALL_CURATORS) {
        if (!tmpl.applicable(curator)) continue;
        const peers = ALL_CURATORS.filter((c) => c.name !== curator.name);
        if (peers.length < 3) continue;
        const q = tmpl.generate(curator, peers);
        if (q) pool.push(q);
      }
    }
  }

  // Hand-crafted extra questions
  for (const eq of EXTRA_QUESTIONS) {
    if (!settings.curators && eq.type === "Curator") continue;
    if (eq.type === "Risk") continue;
    if (eq.coin) {
      const match = assets.find((a) => a.name === eq.coin);
      const curatorMatch = ALL_CURATORS.find((c) => c.name === eq.coin);
      if (!match && !curatorMatch) continue;
      if (match?.collapsed && !settings.collapsed) continue;
    }
    const strippedCorrect = stripHints(eq.correct);
    const strippedWrongs = eq.wrongs.map(stripHints);
    const uniqueChoices = new Set([strippedCorrect, ...strippedWrongs]);
    if (uniqueChoices.size < 4) continue;
    const choices = shuffle([strippedCorrect, ...strippedWrongs]);
    pool.push({
      type: eq.type,
      text: eq.text,
      choices,
      correctIndex: choices.indexOf(strippedCorrect),
      explanation: eq.explanation,
      coin: eq.coin,
    });
  }

  return pool;
}

// ── Public API ─────────────────────────────

export function generateRound(settings: QuizSettings): QuizQuestion[] {
  const pool = buildPool(settings);
  const count = Math.min(settings.count, pool.length);

  // TODO: weakness-weighted selection can be added here
  shuffle(pool);
  return pool.slice(0, count);
}
