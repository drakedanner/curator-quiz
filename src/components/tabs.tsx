"use client";

const TABS = [
  { key: "quiz", label: "Quiz" },
  { key: "scores", label: "Scores" },
  { key: "leaderboard", label: "Leaderboard" },
  { key: "settings", label: "Settings" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function Tabs({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  return (
    <div className="flex border-b-[1px] border-foreground/10 mb-6">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-all duration-200 ease-in-out ${
            active === t.key
              ? "text-primary border-primary opacity-100"
              : "border-transparent opacity-40 hover:opacity-80"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
