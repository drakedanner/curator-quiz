"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { Tabs } from "@/components/tabs";
import { Quiz } from "@/components/quiz";
import { Scores } from "@/components/scores";
import { Leaderboard } from "@/components/leaderboard";
import { Settings } from "@/components/settings";

export default function Home() {
  const [tab, setTab] = useState<"quiz" | "scores" | "leaderboard" | "settings">("quiz");

  return (
    <>
      <Header />
      <Tabs active={tab} onChange={setTab} />
      {tab === "quiz" && <Quiz onShowScores={() => setTab("scores")} />}
      {tab === "scores" && <Scores />}
      {tab === "leaderboard" && <Leaderboard />}
      {tab === "settings" && <Settings />}
    </>
  );
}
