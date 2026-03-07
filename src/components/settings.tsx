"use client";

import { useLocalSettings } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";

export function Settings() {
  const { settings, update } = useLocalSettings();
  const { token, isAuthenticated } = useAuth();

  const resetScores = async () => {
    if (!confirm("Reset all scores and history?")) return;
    if (token) {
      await fetch("/api/scores", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    window.location.reload();
  };

  return (
    <div>
      <h3 className="font-bold mb-4">Quiz Settings</h3>

      <SettingRow label="Questions per round" desc="How many questions in each quiz session">
        <select
          value={settings.count}
          onChange={(e) => update("count", Number(e.target.value))}
          className="bg-foreground/5 text-foreground border-[1px] border-foreground/10 rounded-sm px-2 py-1 text-sm font-sans"
        >
          <option value={10}>10</option>
          <option value={15}>15</option>
          <option value={25}>25</option>
          <option value={40}>40</option>
          <option value={50}>50 (all-in)</option>
        </select>
      </SettingRow>

      <SettingRow label="Focus mode" desc="Weight questions toward your weakest coins">
        <select
          value={settings.focus}
          onChange={(e) => update("focus", e.target.value)}
          className="bg-foreground/5 text-foreground border-[1px] border-foreground/10 rounded-sm px-2 py-1 text-sm font-sans"
        >
          <option value="balanced">Balanced</option>
          <option value="weakest">Weakest first</option>
        </select>
      </SettingRow>

      <SettingRow label="Categories" desc="Which asset types to include">
        <select
          value={settings.categories}
          onChange={(e) => update("categories", e.target.value)}
          className="bg-foreground/5 text-foreground border-[1px] border-foreground/10 rounded-sm px-2 py-1 text-sm font-sans"
        >
          <option value="all">All</option>
          <option value="stablecoin">Stablecoins only</option>
          <option value="lst">LSTs only</option>
          <option value="lrt">LRTs only</option>
          <option value="btc">BTC collateral only</option>
          <option value="eth-collateral">ETH collateral (LSTs + LRTs)</option>
          <option value="non-stable">Non-stablecoins</option>
        </select>
      </SettingRow>

      <SettingRow label="Include collapsed assets" desc="xUSD, deUSD — the cautionary tales">
        <select
          value={settings.collapsed ? "yes" : "no"}
          onChange={(e) => update("collapsed", e.target.value === "yes")}
          className="bg-foreground/5 text-foreground border-[1px] border-foreground/10 rounded-sm px-2 py-1 text-sm font-sans"
        >
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </SettingRow>

      <SettingRow label="Include curator questions" desc="Questions about Re7, Gauntlet, Steakhouse, etc.">
        <select
          value={settings.curators ? "yes" : "no"}
          onChange={(e) => update("curators", e.target.value === "yes")}
          className="bg-foreground/5 text-foreground border-[1px] border-foreground/10 rounded-sm px-2 py-1 text-sm font-sans"
        >
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </SettingRow>

      <div className="flex justify-between items-center pt-3">
        <div>
          <div className="text-sm font-bold text-red">Reset all scores</div>
          <div className="text-xs opacity-40 mt-0.5 font-bold">Clear history and start fresh</div>
        </div>
        <button
          onClick={resetScores}
          className="px-6 py-2 rounded-sm font-black border-[1px] border-red text-red text-xs hover:bg-red/10 transition-all duration-200"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  desc,
  children,
}: {
  label: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center py-3 border-b-[1px] border-foreground/5">
      <div>
        <div className="text-sm font-bold">{label}</div>
        <div className="text-xs opacity-40 mt-0.5 font-bold">{desc}</div>
      </div>
      {children}
    </div>
  );
}
