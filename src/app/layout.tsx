import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Curator Quiz — DeFi Collateral Knowledge",
  description:
    "Test your knowledge of stablecoins, LSTs, LRTs, BTC derivatives, and DeFi curator strategy.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-surface text-foreground min-h-screen flex flex-col items-center px-4 py-8 font-sans">
        <Providers>
          <div className="w-full max-w-[680px]">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
