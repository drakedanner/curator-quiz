"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generateRound } from "@/lib/quiz-engine";
import type { QuizQuestion, QuizSettings, RoundResult, AnswerResult } from "@/types";
import { useLocalSettings } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import { useModal } from "connectkit";
import { useAccount } from "wagmi";

type Phase = "start" | "active" | "result";

function saveRound(token: string, data: { score: number; total: number; category: string; answers: AnswerResult[] }) {
  return fetch("/api/scores", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export function Quiz({ onShowScores }: { onShowScores: () => void }) {
  const [phase, setPhase] = useState<Phase>("start");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<AnswerResult[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const { settings } = useLocalSettings();
  const { token, isAuthenticated, signIn } = useAuth();
  const { setOpen, open: modalOpen } = useModal();
  const { isConnected } = useAccount();
  // Track token in a ref so the sign-in-then-save flow uses the latest value
  const tokenRef = useRef(token);
  tokenRef.current = token;
  // Flag to save score after wallet connects and signs in
  const pendingSaveRef = useRef(false);

  const startQuiz = useCallback(() => {
    const round = generateRound(settings);
    setQuestions(round);
    setCurrent(0);
    setScore(0);
    setAnswers([]);
    setSelected(null);
    setStreak(0);
    setSaved(false);
    setSaving(false);
    setPhase("active");
  }, [settings]);

  const handleChoice = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    const q = questions[current];
    const isCorrect = idx === q.correctIndex;
    const isSkip = idx === -1;

    if (isCorrect) {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }

    setAnswers((prev) => [
      ...prev,
      {
        questionText: q.text,
        coin: q.coin,
        correct: isCorrect,
        skipped: isSkip,
      },
    ]);
  };

  const nextQuestion = () => {
    if (current + 1 >= questions.length) {
      // Auto-save if already authenticated
      if (token) {
        saveRound(token, {
          score,
          total: questions.length,
          category: settings.categories,
          answers,
        }).catch(() => {});
        setSaved(true);
      }
      setPhase("result");
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
    }
  };

  // When token becomes available after a pending connect, save the score
  useEffect(() => {
    if (pendingSaveRef.current && token && phase === "result" && !saved) {
      pendingSaveRef.current = false;
      setSaving(true);
      saveRound(token, {
        score,
        total: questions.length,
        category: settings.categories,
        answers,
      })
        .then(() => setSaved(true))
        .catch(() => {})
        .finally(() => setSaving(false));
    }
  }, [token, phase, saved, score, questions.length, settings.categories, answers]);

  // Reset saving state if user closes modal without connecting
  useEffect(() => {
    if (!modalOpen && saving && !isConnected && pendingSaveRef.current) {
      pendingSaveRef.current = false;
      setSaving(false);
    }
  }, [modalOpen, saving, isConnected]);

  const handleSignInAndSave = () => {
    pendingSaveRef.current = true;
    setSaving(true);
    // Open the ConnectKit modal so the user can connect their wallet
    setOpen(true);
  };

  if (phase === "start") {
    return (
      <div className="rounded-xl p-10 text-center">
        <h2 className="text-xl font-bold mb-2">Ready to test your knowledge?</h2>
        <p className="opacity-40 mb-6 text-sm font-bold">
          Questions about stablecoins, LSTs, LRTs, BTC collateral, risk layers,
          depegs, and curator strategy.
        </p>
        <button
          onClick={startQuiz}
          className="px-10 py-3 rounded-lg font-black bg-plug-green text-primary border-[1px] border-plug-green hover:brightness-105 transition-all duration-200"
        >
          Start Round
        </button>
        {!isAuthenticated && (
          <p className="opacity-40 text-xs mt-4 font-bold">
            Connect your wallet to save scores and appear on the leaderboard.
          </p>
        )}
      </div>
    );
  }

  if (phase === "result") {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="rounded-xl p-10 text-center">
        <div className="text-5xl font-black mb-1">
          {score}/{questions.length}
        </div>
        <div className="opacity-40 mb-6 font-bold">
          {pct}% — {pct >= 80 ? "Excellent!" : pct >= 60 ? "Solid work." : "Keep studying."}
        </div>

        {/* Sign in to save prompt */}
        {!isAuthenticated && !saved && (
          <div className="bg-gradient-to-tr from-foreground/10 to-foreground/5 rounded-[16px] p-4 mb-6 mx-auto max-w-sm">
            <p className="text-sm font-bold mb-1">Want to save your score?</p>
            <p className="text-xs opacity-40 mb-3 font-bold">
              Connect your wallet to save this result and track your progress.
            </p>
            <button
              onClick={handleSignInAndSave}
              disabled={saving}
              className="px-8 py-2.5 rounded-md text-sm font-black bg-plug-green text-primary border-[1px] border-plug-green hover:brightness-105 transition-all duration-200 disabled:opacity-50"
            >
              {saving ? "Connecting..." : "Connect & Save"}
            </button>
          </div>
        )}

        {saved && (
          <p className="text-green text-xs font-bold mb-4">Score saved!</p>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={startQuiz}
            className="px-10 py-3 rounded-lg font-black bg-plug-green text-primary border-[1px] border-plug-green hover:brightness-105 transition-all duration-200"
          >
            Play Again
          </button>
          <button
            onClick={onShowScores}
            className="px-10 py-3 rounded-lg font-black border-[1px] border-foreground/10 bg-surface text-foreground hover:bg-foreground/5 transition-all duration-200"
          >
            View History
          </button>
        </div>
      </div>
    );
  }

  // Active quiz
  const q = questions[current];
  const progress = ((current + 1) / questions.length) * 100;

  return (
    <div>
      <div className="rounded-xl p-6">
        {/* Progress */}
        <div className="flex items-center gap-3 mb-5 text-xs opacity-40 font-bold">
          <span>
            {current + 1} / {questions.length}
          </span>
          <div className="flex-1 h-1 bg-foreground/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span>{score} correct</span>
        </div>

        {/* Question type badge */}
        <span className="inline-block text-[0.7rem] uppercase tracking-wide text-purple bg-purple/10 px-2 py-0.5 rounded font-bold mb-3">
          {q.type}
        </span>

        {/* Question text */}
        <div
          className="text-lg font-medium leading-relaxed mb-5"
          dangerouslySetInnerHTML={{ __html: q.text }}
        />

        {/* Choices */}
        <div className="flex flex-col gap-2">
          {q.choices.map((choice, idx) => {
            const keys = ["A", "B", "C", "D"];
            let stateClass = "";
            if (selected !== null) {
              if (idx === q.correctIndex) stateClass = "border-green bg-green/10";
              else if (idx === selected) stateClass = "border-red bg-red/[0.08]";
              else stateClass = "opacity-60";
            }

            return (
              <button
                key={idx}
                onClick={() => handleChoice(idx)}
                disabled={selected !== null}
                className={`flex items-start gap-3 w-full text-left px-4 py-3 rounded-md border-[1px] transition-all duration-200 ${
                  selected !== null
                    ? stateClass
                    : "border-foreground/10 bg-foreground/5 hover:border-primary hover:bg-primary/[0.06]"
                } ${selected !== null ? "cursor-default" : "cursor-pointer"}`}
              >
                <span
                  className={`shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                    selected !== null && idx === q.correctIndex
                      ? "bg-green text-surface"
                      : selected !== null && idx === selected
                        ? "bg-red text-surface"
                        : "bg-foreground/10 opacity-60"
                  }`}
                >
                  {keys[idx]}
                </span>
                <span className="text-[0.95rem]">{choice}</span>
              </button>
            );
          })}

          {/* IDK button */}
          <button
            onClick={() => handleChoice(-1)}
            disabled={selected !== null}
            className={`flex items-center justify-center w-full text-left px-4 py-3 rounded-md border-[1px] border-dashed transition-all duration-200 opacity-40 ${
              selected !== null
                ? "opacity-20 cursor-default"
                : "border-foreground/10 hover:border-orange hover:bg-orange/[0.06] hover:opacity-100 cursor-pointer"
            }`}
          >
            I don&apos;t know (skip)
          </button>
        </div>

        {/* Explanation */}
        {selected !== null && (
          <div className="mt-4 p-4 bg-foreground/5 rounded-sm border-l-[3px] border-primary text-sm opacity-60 leading-relaxed">
            {q.explanation}
          </div>
        )}
      </div>

      {/* Next button + streak */}
      {selected !== null && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs opacity-40 font-bold">
            {streak > 1 ? `${streak} streak` : ""}
          </span>
          <button
            onClick={nextQuestion}
            className="px-10 py-3 rounded-lg font-black bg-plug-green text-primary border-[1px] border-plug-green hover:brightness-105 transition-all duration-200"
          >
            {current + 1 >= questions.length ? "Finish" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}
