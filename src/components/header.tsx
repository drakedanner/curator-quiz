"use client";

import { ConnectKitButton } from "connectkit";

export function Header() {
  return (
    <header className="text-center mb-8">
      <div className="flex items-center justify-between mb-4">
        <div />
        <ConnectKitButton />
      </div>
      <h1 className="text-2xl font-black text-primary mb-1">Curator Quiz</h1>
      <p className="opacity-40 text-sm font-bold">
        Stablecoins, LSTs, LRTs, BTC collateral & curator strategy
      </p>
    </header>
  );
}
