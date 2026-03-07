#!/usr/bin/env node
/**
 * Weekly data updater for curator-quiz.
 * Pulls live market caps + yields from DefiLlama (free, no API key needed)
 * and patches data.json and extra-questions.json with current figures.
 *
 * Usage:
 *   node scripts/update-data.mjs            # dry-run (prints changes)
 *   node scripts/update-data.mjs --apply    # writes updated files
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data.json");
const EXTRA_PATH = path.join(ROOT, "extra-questions.json");

const APPLY = process.argv.includes("--apply");

// ─── Helpers ──────────────────────────────────────────────────────

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

function formatMcap(value) {
  if (value >= 1e9) return `~$${(value / 1e9).toFixed(0)}B`;
  if (value >= 1e6) return `~$${(value / 1e6).toFixed(0)}M`;
  return `~$${(value / 1e3).toFixed(0)}K`;
}

function formatMcapPrecise(value) {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `~$${(value / 1e6).toFixed(0)}M`;
  return `~$${value.toFixed(0)}`;
}

// ─── DefiLlama: stablecoin market caps ───────────────────────────

async function fetchMarketCaps() {
  console.log("  Stablecoin market caps...");
  const data = await fetchJSON(
    "https://stablecoins.llama.fi/stablecoins?includePrices=true"
  );
  const result = {};

  for (const peg of data.peggedAssets || []) {
    const geckoId = peg.gecko_id;
    const symbol = peg.symbol;
    const totalCirculating = peg.circulating;

    let mcap = 0;
    if (totalCirculating) {
      mcap =
        totalCirculating.peggedUSD ||
        Object.values(totalCirculating).reduce((sum, v) => {
          if (typeof v === "number") return sum + v;
          if (v && typeof v.peggedUSD === "number") return sum + v.peggedUSD;
          return sum;
        }, 0);
    }

    if (mcap > 0) {
      // USDS has multiple entries — only use "Sky Dollar" (gecko_id: "usds")
      if (symbol === "USDS") {
        if (geckoId === "usds" || peg.name === "Sky Dollar") {
          result[symbol] = { mcap, name: peg.name };
        }
        continue;
      }
      if (!result[symbol] || mcap > result[symbol].mcap) {
        result[symbol] = { mcap, name: peg.name };
      }
    }
  }

  return result;
}

// ─── DefiLlama: yield rates ──────────────────────────────────────

async function fetchYields() {
  console.log("  Yield pools...");
  const data = await fetchJSON("https://yields.llama.fi/pools");
  const result = {};

  const targets = {
    sUSDe: { project: "ethena-usde", symbol: "SUSDE" },
    sUSDS: { project: "sky-lending", symbol: "SUSDS" },
    USDY: { project: "ondo-yield-assets", symbol: "USDY" },
    stkGHO: { project: "aave-v3", symbol: "SGHO" },
    sDAI: { project: "sky-lending", symbol: "SDAI" },
  };

  for (const pool of data.data || []) {
    for (const [key, target] of Object.entries(targets)) {
      if (
        pool.project === target.project &&
        pool.symbol?.toUpperCase().includes(target.symbol)
      ) {
        // Keep the pool with highest TVL (most representative)
        if (!result[key] || pool.tvlUsd > (result[key].tvl || 0)) {
          result[key] = { apy: pool.apy, tvl: pool.tvlUsd };
        }
      }
    }
  }

  return result;
}

// ─── Patch data.json ─────────────────────────────────────────────

function patchDataJson(data, mcaps) {
  const changes = [];

  for (const category of Object.values(data)) {
    if (!Array.isArray(category)) continue;
    for (const coin of category) {
      const name = coin.name;
      if (!mcaps[name]) continue;

      const newMcap = formatMcap(mcaps[name].mcap);

      if (coin.marketCap && coin.marketCap !== newMcap) {
        changes.push({ coin: name, field: "marketCap", old: coin.marketCap, new: newMcap });
        coin.marketCap = newMcap;
      }

      if (coin.keyFact) {
        const updated = coin.keyFact.replace(/\(~?\$[\d.]+[BMK]\)/g, `(${newMcap})`);
        if (updated !== coin.keyFact) {
          changes.push({ coin: name, field: "keyFact", old: coin.keyFact, new: updated });
          coin.keyFact = updated;
        }
      }
    }
  }

  return changes;
}

// ─── Patch extra-questions.json ──────────────────────────────────

function patchExtraQuestions(questions, mcaps, yields) {
  const changes = [];

  for (const q of questions) {
    // ── Supply questions ──
    if (q.type === "Supply" && q.coin && mcaps[q.coin]) {
      const formatted = formatMcap(mcaps[q.coin].mcap);

      // Simple answers like "~$500M"
      if (q.correct.match(/^~?\$[\d.]+[BMK]\+?$/) && q.correct !== formatted) {
        changes.push({ question: q.text.substring(0, 60), field: "correct", old: q.correct, new: formatted });
        q.correct = formatted;
      }

      // Answers like "USDC (~$33B)"
      const parenUpdated = q.correct.replace(/\(~?\$[\d.]+[BMK]\+?\)/g, `(${formatted})`);
      if (parenUpdated !== q.correct) {
        changes.push({ question: q.text.substring(0, 60), field: "correct", old: q.correct, new: parenUpdated });
        q.correct = parenUpdated;
      }

      // Explanation — amounts following this coin's name
      if (q.explanation) {
        const oldExp = q.explanation;
        const esc = q.coin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const newExp = oldExp.replace(
          new RegExp(`(${esc}\\s*(?:at|has|is|\\()\\s*)~?\\$[\\d.]+[BMK]\\+?`, "g"),
          (_, prefix) => prefix + formatted
        );
        if (newExp !== oldExp) {
          changes.push({ question: q.text.substring(0, 60), field: "explanation", old: oldExp, new: newExp });
          q.explanation = newExp;
        }
      }
    }

    // ── Yield questions ──
    if (q.type === "Yield") {
      const yieldMap = { sUSDe: "sUSDe", USDY: "USDY", sUSDS: "sUSDS", GHO: "stkGHO" };
      const yieldKey = yieldMap[q.coin];
      if (yieldKey && yields[yieldKey]?.apy != null && q.explanation) {
        const apyStr = `~${yields[yieldKey].apy.toFixed(1)}%`;
        const oldExp = q.explanation;
        const newExp = oldExp.replace(/~?(\d+\.\d+)%\s*APY/g, `${apyStr} APY`);
        if (newExp !== oldExp) {
          changes.push({ question: q.text.substring(0, 60), field: "explanation (yield)", old: oldExp, new: newExp });
          q.explanation = newExp;
        }
      }
    }

    // ── Comparison questions ──
    if (q.type === "Comparison" && q.text.includes("circulating supply")) {
      const m = q.text.match(/(?:larger|smaller).*?:\s*(\w+)\s+or\s+(\w+)/i);
      if (m && mcaps[m[1]] && mcaps[m[2]]) {
        const bigger = mcaps[m[1]].mcap >= mcaps[m[2]].mcap ? m[1] : m[2];
        const smaller = mcaps[m[1]].mcap >= mcaps[m[2]].mcap ? m[2] : m[1];
        const newCorrect = `${bigger} (${formatMcap(mcaps[bigger].mcap)} vs ${formatMcap(mcaps[smaller].mcap)})`;
        if (q.correct !== newCorrect) {
          changes.push({ question: q.text.substring(0, 60), field: "correct", old: q.correct, new: newCorrect });
          q.correct = newCorrect;
        }
      }
    }

    // ── "X times larger" questions ──
    if (q.type === "Supply" && q.text.includes("times larger") && q.text.includes("USDT") && q.text.includes("USDC")) {
      if (mcaps.USDT && mcaps.USDC) {
        const ratio = Math.round(mcaps.USDT.mcap / mcaps.USDC.mcap);
        const usdtStr = formatMcap(mcaps.USDT.mcap);
        const usdcStr = formatMcap(mcaps.USDC.mcap);
        const newCorrect = `~${ratio}x (${usdtStr} vs ${usdcStr})`;
        if (q.correct !== newCorrect) {
          changes.push({ question: q.text.substring(0, 60), field: "correct", old: q.correct, new: newCorrect });
          q.correct = newCorrect;
          q.explanation = `USDT (${usdtStr}) is roughly ${ratio}x larger than USDC (${usdcStr}).`;
        }
      }
    }
  }

  return changes;
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  console.log("=== Curator Quiz Data Updater ===\n");
  console.log("Fetching from DefiLlama (free, no API key)...");

  const [mcaps, yields] = await Promise.all([fetchMarketCaps(), fetchYields()]);

  console.log(`\nGot ${Object.keys(mcaps).length} market caps, ${Object.keys(yields).length} yield pools\n`);

  console.log("--- Live Market Caps ---");
  for (const coin of [
    "USDC", "USDT", "DAI", "USDS", "USDe", "GHO", "FRAX",
    "PYUSD", "FDUSD", "USD0", "USDY", "USDM", "USD1",
    "LUSD", "crvUSD", "USR", "USDf", "EURCV",
  ]) {
    console.log(`  ${coin.padEnd(8)} ${mcaps[coin] ? formatMcapPrecise(mcaps[coin].mcap) : "— not found"}`);
  }

  console.log("\n--- Live Yields ---");
  for (const [key, val] of Object.entries(yields)) {
    console.log(`  ${key.padEnd(8)} ${val.apy?.toFixed(2)}% APY  (TVL: ${formatMcapPrecise(val.tvl)})`);
  }

  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const extra = JSON.parse(fs.readFileSync(EXTRA_PATH, "utf8"));

  const allChanges = [
    ...patchDataJson(data, mcaps),
    ...patchExtraQuestions(extra, mcaps, yields),
  ];

  console.log(`\n--- ${allChanges.length} Changes Detected ---`);
  for (const c of allChanges) {
    console.log(`  ${c.coin || c.question}`);
    console.log(`    ${c.field}: "${c.old}" -> "${c.new}"`);
  }

  if (allChanges.length === 0) {
    console.log("  Data is up to date!");
    return;
  }

  if (APPLY) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + "\n");
    fs.writeFileSync(EXTRA_PATH, JSON.stringify(extra, null, 2) + "\n");

    const tsPath = path.join(ROOT, "scripts", "last-update.txt");
    fs.writeFileSync(tsPath, `Last updated: ${new Date().toISOString()}\nChanges: ${allChanges.length}\n`);

    console.log("\nFiles updated. Timestamp written to scripts/last-update.txt");
  } else {
    console.log("\nDry run — no files changed. Run with --apply to write updates.");
  }
}

main().catch((err) => {
  console.error("Update failed:", err);
  process.exit(1);
});
