"use client";

import { useEffect, useState } from "react";

interface LeaderboardEntry {
  wallet: string;
  ens: string | null;
  rounds: number;
  totalCorrect: number;
  totalQuestions: number;
  avgPct: number;
  bestPct: number;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/leaderboard?t=${Date.now()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(({ leaderboard }) => setEntries(leaderboard))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl p-10 text-center opacity-40">
        <p className="font-bold">Loading leaderboard...</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl p-10 text-center">
        <p className="mb-2 font-bold">No one has played yet.</p>
        <p className="text-sm opacity-40 font-bold">Be the first to complete a quiz!</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-bold mb-4">Leaderboard</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide opacity-40">
            <th className="text-left py-2 px-3 border-b-[1px] border-foreground/10 font-bold">#</th>
            <th className="text-left py-2 px-3 border-b-[1px] border-foreground/10 font-bold">Player</th>
            <th className="text-right py-2 px-3 border-b-[1px] border-foreground/10 font-bold">Rounds</th>
            <th className="text-right py-2 px-3 border-b-[1px] border-foreground/10 font-bold">Correct</th>
            <th className="text-right py-2 px-3 border-b-[1px] border-foreground/10 font-bold">Avg</th>
            <th className="text-right py-2 px-3 border-b-[1px] border-foreground/10 font-bold">Best</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => {
            const rankClass =
              i === 0
                ? "text-yellow-400"
                : i === 1
                  ? "text-gray-300"
                  : i === 2
                    ? "text-amber-600"
                    : "opacity-40";
            return (
              <tr key={e.wallet} className="hover:bg-foreground/5 transition-colors duration-200">
                <td className={`py-2.5 px-3 border-b-[1px] border-foreground/5 font-black ${rankClass}`}>
                  {i + 1}
                </td>
                <td className="py-2.5 px-3 border-b-[1px] border-foreground/5 font-bold">
                  {e.ens || shortAddr(e.wallet)}
                </td>
                <td className="py-2.5 px-3 border-b-[1px] border-foreground/5 text-right opacity-40">
                  {e.rounds}
                </td>
                <td className="py-2.5 px-3 border-b-[1px] border-foreground/5 text-right">
                  <span className="text-primary font-bold">{e.totalCorrect}</span>
                  <span className="opacity-40">/{e.totalQuestions}</span>
                </td>
                <td className="py-2.5 px-3 border-b-[1px] border-foreground/5 text-right">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                      e.avgPct >= 80
                        ? "bg-green/15 text-green"
                        : e.avgPct >= 60
                          ? "bg-orange/15 text-orange"
                          : "bg-red/[0.12] text-red"
                    }`}
                  >
                    {e.avgPct}%
                  </span>
                </td>
                <td className="py-2.5 px-3 border-b-[1px] border-foreground/5 text-right font-bold text-green">
                  {e.bestPct}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
