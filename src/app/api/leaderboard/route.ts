import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/leaderboard — public leaderboard stats
export async function GET() {
  const supabase = createServiceClient();

  // Get all rounds joined with user wallet addresses
  const { data: rounds, error } = await supabase
    .from("quiz_rounds")
    .select("user_id, score, total, users!inner(wallet_address, ens_name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Leaderboard fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }

  // Aggregate per user
  const stats: Record<
    string,
    {
      wallet: string;
      ens: string | null;
      rounds: number;
      totalCorrect: number;
      totalQuestions: number;
      bestPct: number;
    }
  > = {};

  for (const r of rounds ?? []) {
    const userId = r.user_id;
    const user = r.users as unknown as { wallet_address: string; ens_name: string | null };
    if (!stats[userId]) {
      stats[userId] = {
        wallet: user.wallet_address,
        ens: user.ens_name,
        rounds: 0,
        totalCorrect: 0,
        totalQuestions: 0,
        bestPct: 0,
      };
    }
    stats[userId].rounds++;
    stats[userId].totalCorrect += r.score;
    stats[userId].totalQuestions += r.total;
    const pct = r.total > 0 ? (r.score / r.total) * 100 : 0;
    if (pct > stats[userId].bestPct) stats[userId].bestPct = pct;
  }

  // Sort by total correct answers descending
  const leaderboard = Object.values(stats)
    .map((s) => ({
      wallet: s.wallet,
      ens: s.ens,
      rounds: s.rounds,
      totalCorrect: s.totalCorrect,
      totalQuestions: s.totalQuestions,
      avgPct: s.totalQuestions > 0 ? Math.round((s.totalCorrect / s.totalQuestions) * 100) : 0,
      bestPct: Math.round(s.bestPct),
    }))
    .sort((a, b) => b.totalCorrect - a.totalCorrect);

  return NextResponse.json({ leaderboard });
}
