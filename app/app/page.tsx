import type { Metadata } from "next";
import Link from "next/link";
import { SwapCard } from "@/components/trade/SwapCard";

export const metadata: Metadata = {
  title: "Trade — Clockwork",
  description:
    "Swap ETH for tokenized equities on Robinhood Chain, settled straight to your wallet. No account, no custody.",
};

export default function TradePage() {
  return (
    <div className="flex flex-1 flex-col bg-[var(--bg)] text-[var(--fg)]">
      <header className="border-b border-[var(--rule)] px-6 py-4 sm:px-10">
        <Link href="/" className="font-display" style={{ fontSize: "var(--text-heading)" }}>
          Clockwork
        </Link>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-12 sm:px-0">
        <SwapCard />
      </main>
    </div>
  );
}
