"use client";

import { useCallback, useEffect, useState } from "react";
import type { QuizSettings } from "@/types";

const DEFAULT_SETTINGS: QuizSettings = {
  count: 25,
  focus: "balanced",
  categories: "all",
  collapsed: true,
  curators: true,
};

export function useLocalSettings() {
  const [settings, setSettings] = useState<QuizSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const stored = localStorage.getItem("quiz-settings");
    if (stored) {
      setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
    }
  }, []);

  const update = useCallback(
    (key: keyof QuizSettings, value: QuizSettings[keyof QuizSettings]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        localStorage.setItem("quiz-settings", JSON.stringify(next));
        return next;
      });
    },
    []
  );

  return { settings, update };
}
