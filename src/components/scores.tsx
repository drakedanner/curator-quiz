"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import type { RoundResult } from "@/types";

export function Scores() {
  const { token, isAuthenticated } = useAuth();
  const [history, setHistory] = useState<RoundResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    fetch("/api/scores", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(({ rounds }) => {
        const mapped: RoundResult[] = rounds.map((r: Record<string, unknown>) => ({
          score: r.score as number,
          total: r.total as number,
          category: r.category as string,
          answers: (r.answers ?? []) as RoundResult["answers"],
          timestamp: new Date(r.created_at as string).getTime(),
        }));
        setHistory(mapped);
      })
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [token]);

  if (!isAuthenticated) {
    return (
      <div className="rounded-xl p-10 text-center">
        <p className="mb-2 font-bold">Connect wallet to view scores</p>
        <p className="text-sm opacity-40 font-bold">Your quiz scores are tied to your wallet. Connect to track your progress.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl p-10 text-center opacity-40">
        <p className="font-bold">Loading scores...</p>
      </div>
    );
  }

  const totalRounds = history.length;
  const totalCorrect = history.reduce((sum, r) => sum + r.score, 0);
  const totalQuestions = history.reduce((sum, r) => sum + r.total, 0);
  const avgPct = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const bestPct =
    history.length > 0
      ? Math.round(
          Math.max(...history.map((r) => (r.score / r.total) * 100))
        )
      : 0;

  // Weakest coins
  const coinStats: Record<string, { correct: number; total: number }> = {};
  for (const round of history) {
    for (const a of round.answers) {
      if (!coinStats[a.coin]) coinStats[a.coin] = { correct: 0, total: 0 };
      coinStats[a.coin].total++;
      if (a.correct) coinStats[a.coin].correct++;
    }
  }
  const weakest = Object.entries(coinStats)
    .map(([coin, s]) => ({ coin, accuracy: s.total > 0 ? s.correct / s.total : 0, total: s.total }))
    .filter((s) => s.total >= 2)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 8);

  if (totalRounds === 0) {
    return (
      <div className="rounded-xl p-10 text-center">
        <p className="mb-2 font-bold">No rounds played yet.</p>
        <p className="text-sm opacity-40 font-bold">Complete a quiz to see your stats here.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard value={totalRounds} label="Rounds" color="text-primary" />
        <StatCard value={`${avgPct}%`} label="Avg Score" color="text-green" />
        <StatCard value={`${bestPct}%`} label="Best" color="text-primary" />
      </div>

      {/* History table */}
      <div className="mb-4">
        <h3 className="font-bold mb-3">Session History</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide opacity-40">
              <th className="text-left py-2 px-3 border-b-[1px] border-foreground/10 font-bold">Round</th>
              <th className="text-left py-2 px-3 border-b-[1px] border-foreground/10 font-bold">Score</th>
              <th className="text-left py-2 px-3 border-b-[1px] border-foreground/10 font-bold">Category</th>
            </tr>
          </thead>
          <tbody>
            {history.slice(0, 20).map((r, i) => {
              const pct = Math.round((r.score / r.total) * 100);
              const badgeClass =
                pct >= 80
                  ? "bg-green/15 text-green"
                  : pct >= 60
                    ? "bg-orange/15 text-orange"
                    : "bg-red/[0.12] text-red";
              return (
                <tr key={i} className="hover:bg-foreground/5 transition-colors duration-200">
                  <td className="py-2 px-3 border-b-[1px] border-foreground/5">#{totalRounds - i}</td>
                  <td className="py-2 px-3 border-b-[1px] border-foreground/5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${badgeClass}`}>
                      {r.score}/{r.total} ({pct}%)
                    </span>
                  </td>
                  <td className="py-2 px-3 border-b-[1px] border-foreground/5 opacity-40">{r.category}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Weakest assets */}
      {weakest.length > 0 && (
        <div>
          <h3 className="font-bold mb-1">Weakest Assets</h3>
          <p className="text-xs opacity-40 mb-4 font-bold">Assets you get wrong most often</p>
          <ul>
            {weakest.map((w) => (
              <li
                key={w.coin}
                className="flex justify-between items-center py-2 px-3 border-b-[1px] border-foreground/5 text-sm"
              >
                <span className="font-bold">{w.coin}</span>
                <span className="opacity-40 text-xs font-bold">
                  {Math.round(w.accuracy * 100)}% ({w.total} questions)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div className="w-full rounded-[16px] bg-gradient-to-tr from-foreground/10 to-foreground/5 p-4 text-center">
      <div className={`text-3xl font-black leading-none mb-1 ${color}`}>{value}</div>
      <div className="text-[0.7rem] opacity-40 uppercase tracking-wide font-bold">{label}</div>
    </div>
  );
}
