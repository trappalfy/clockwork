"use client";

import { useState } from "react";
import { formatUnits, type Address } from "viem";
import { useWallet } from "@/hooks/useWallet";
import { useMarket } from "@/hooks/useMarket";
import { useQuote } from "@/hooks/useQuote";
import { useSwap } from "@/hooks/useSwap";
import { usePortfolio } from "@/hooks/usePortfolio";
import type { SwapStatus } from "@/hooks/useSwap";
import { Address as AddressDisplay } from "@/components/ui/Address";
import { Rule } from "@/components/ui/Rule";
import { AssetSelect } from "./AssetSelect";
import { NetworkBanner } from "./NetworkBanner";
import { ApprovalSteps } from "./ApprovalSteps";
import { StatusMessage } from "./StatusMessage";
import { walletErrorCopy } from "./walletErrorCopy";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

const SLIPPAGE_PRESETS = [
  { bps: 10, label: "0.1%" },
  { bps: 50, label: "0.5%" },
  { bps: 100, label: "1%" },
];

/**
 * expectedOut and minOut arrive as raw base-unit integers (a bigint's
 * .toString(), matching what the tx itself encodes) — not decimal
 * amounts. Formatting them is display-only; the quote object handed to
 * useSwap().execute() is untouched, so this can't drift from what's
 * actually signed.
 */
function formatAmount(raw: string, decimals: number, maxFractionDigits = 6) {
  try {
    const [whole, frac = ""] = formatUnits(BigInt(raw), decimals).split(".");
    const truncated = frac.slice(0, maxFractionDigits).replace(/0+$/, "");
    return truncated ? `${whole}.${truncated}` : whole;
  } catch {
    return raw;
  }
}

/** Same truncation as formatAmount, for a value the API already formatted (ethBalance). */
function trimDecimalString(value: string, maxFractionDigits = 6) {
  const [whole, frac = ""] = value.split(".");
  const truncated = frac.slice(0, maxFractionDigits).replace(/0+$/, "");
  return truncated ? `${whole}.${truncated}` : whole;
}

function buttonLabel(
  side: "buy" | "sell",
  status: SwapStatus,
  hasQuote: boolean,
  hasAmount: boolean,
) {
  if (status === "approving") return "Approving…";
  if (status === "signing") return "Confirm in wallet…";
  if (status === "pending") return "Transaction pending…";
  if (status === "success") return "New swap";
  if (status === "error") return "Try again";
  if (!hasQuote) return hasAmount ? "No price available" : "Enter an amount";
  return side === "buy" ? "Review and sign" : "Review and sign to sell";
}

export function SwapCard() {
  const wallet = useWallet();
  const market = useMarket();
  const swap = useSwap();
  const portfolio = usePortfolio();

  const [side, setSide] = useState<"buy" | "sell">("buy");
  // An explicit pick overrides the default; until the user makes one,
  // the first tradable asset is used. Derived at render time rather
  // than synced through an effect, so there's no extra render cycle
  // and no state that can drift from what the market actually has.
  const [symbolOverride, setSymbolOverride] = useState<string | null>(null);
  const symbol =
    symbolOverride ?? market.assets.find((a) => a.tradable)?.symbol ?? "";
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(50);

  const selectedAsset = market.assets.find((a) => a.symbol === symbol);
  // A buy pays ETH (18 decimals) and receives the token; a sell is the
  // reverse. Either way the amount shown here needs the RECEIVED side's
  // decimals, not always the token's.
  const outDecimals = side === "buy" ? (selectedAsset?.decimals ?? 18) : 18;

  // What's spent, not what's received: ETH on a buy, the held token on a
  // sell. usePortfolio() already defaults ethBalance to "0" and
  // positions to [] before a wallet connects, so this needs no extra
  // connected-guard of its own.
  const sellPosition =
    side === "sell" ? portfolio.positions.find((p) => p.symbol === symbol) : null;
  const balanceLine =
    side === "buy"
      ? `Balance: ${trimDecimalString(portfolio.ethBalance)} ETH`
      : !symbol
        ? null
        : portfolio.isLoading
          ? "Checking balance…"
          : `Balance: ${sellPosition ? formatAmount(sellPosition.balance, sellPosition.decimals) : "0"} ${symbol}`;

  const recipient = wallet.address ?? ZERO_ADDRESS;
  const quote = useQuote({ side, symbol, amount, recipient, slippageBps });

  function changeSide(next: "buy" | "sell") {
    setSide(next);
    setAmount("");
    swap.reset();
  }

  function handleButtonClick() {
    if (swap.status === "success" || swap.status === "error") {
      swap.reset();
      setAmount("");
      return;
    }
    if (quote.quote) void swap.execute(quote.quote);
  }

  if (!wallet.isConnected) {
    return (
      <div className="border border-[var(--rule)] px-6 py-8 text-center">
        <p className="font-text" style={{ fontSize: "var(--text-body)" }}>
          Connect a wallet to trade. There is no account beyond it.
        </p>
        <button
          type="button"
          onClick={wallet.connect}
          className="font-text mt-6 border border-[var(--rule)] px-6 py-3 hover:border-[var(--accent-text)] hover:text-[var(--accent-text)]"
          style={{ fontSize: "var(--text-body)" }}
        >
          Connect a wallet
        </button>
        {wallet.error ? (
          <p
            className="font-text mx-auto mt-4 max-w-[52ch] text-[var(--negative)]"
            style={{ fontSize: "var(--text-caption)" }}
            role="alert"
          >
            {walletErrorCopy(wallet.error)}
          </p>
        ) : null}
      </div>
    );
  }

  const isBusy =
    swap.status === "approving" ||
    swap.status === "signing" ||
    swap.status === "pending";

  return (
    <div className="flex flex-col gap-6">
      {!wallet.chainOk ? (
        <NetworkBanner
          onSwitch={wallet.switchChain}
          isSwitching={wallet.isSwitching}
        />
      ) : null}

      <div className="flex border border-[var(--rule)]">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => changeSide(s)}
            disabled={!wallet.chainOk}
            className="font-text flex-1 py-3 capitalize disabled:opacity-50"
            style={{
              fontSize: "var(--text-body-sm)",
              background: side === s ? "var(--ink)" : "transparent",
              color: side === s ? "var(--paper)" : "var(--fg)",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div>
        <label
          className="font-text block text-[var(--muted)]"
          style={{ fontSize: "var(--text-caption)" }}
        >
          {side === "buy" ? "Asset to buy" : "Asset to sell"}
        </label>
        <div className="mt-1">
          <AssetSelect
            assets={market.assets}
            value={symbol}
            onChange={setSymbolOverride}
            disabled={!wallet.chainOk || market.isLoading}
          />
        </div>
        {market.error ? (
          <p
            className="font-text mt-1 text-[var(--negative)]"
            style={{ fontSize: "var(--text-caption)" }}
            role="alert"
          >
            Couldn&rsquo;t load the asset list: {market.error}
          </p>
        ) : null}
      </div>

      <div>
        <label
          className="font-text block text-[var(--muted)]"
          style={{ fontSize: "var(--text-caption)" }}
        >
          {side === "buy" ? "Amount in ETH" : `Amount in ${symbol || "token"}`}
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={!wallet.chainOk}
          placeholder="0.0"
          className="font-mono tabular mt-1 w-full border border-[var(--rule)] bg-[var(--bg)] px-3 py-2 text-[var(--fg)] disabled:opacity-50"
          style={{ fontSize: "var(--text-body)" }}
        />
        {balanceLine ? (
          <p
            className="font-mono tabular mt-1 text-[var(--muted)]"
            style={{ fontSize: "var(--text-caption)" }}
          >
            {balanceLine}
          </p>
        ) : null}
      </div>

      <div>
        <p
          className="font-text text-[var(--muted)]"
          style={{ fontSize: "var(--text-caption)" }}
        >
          Slippage
        </p>
        <div className="mt-1 flex gap-2">
          {SLIPPAGE_PRESETS.map((p) => (
            <button
              key={p.bps}
              type="button"
              onClick={() => setSlippageBps(p.bps)}
              className="font-mono border px-3 py-1"
              style={{
                fontSize: "var(--text-caption)",
                borderColor:
                  slippageBps === p.bps ? "var(--accent-text)" : "var(--rule)",
                color:
                  slippageBps === p.bps ? "var(--accent-text)" : "var(--fg)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <Rule />

      <AddressDisplay value={recipient} label="Funds arrive at" size="large" />

      <div className="min-h-[4.5rem]">
        {!amount ? (
          <p
            className="font-text text-[var(--muted)]"
            style={{ fontSize: "var(--text-body-sm)" }}
          >
            Enter an amount to see a price.
          </p>
        ) : quote.isLoading ? (
          <p
            className="font-text text-[var(--muted)]"
            style={{ fontSize: "var(--text-body-sm)" }}
          >
            Cutting a price…
          </p>
        ) : quote.error ? (
          <p
            className="font-text text-[var(--negative)]"
            style={{ fontSize: "var(--text-body-sm)" }}
          >
            {quote.error}
          </p>
        ) : quote.quote ? (
          <div className="flex flex-col gap-1">
            <p className="font-mono tabular" style={{ fontSize: "var(--text-body)" }}>
              {formatAmount(quote.quote.expectedOut, outDecimals)}{" "}
              {side === "buy" ? symbol : "ETH"}
            </p>
            <p
              className="font-text text-[var(--muted)]"
              style={{ fontSize: "var(--text-caption)" }}
            >
              Minimum received: {formatAmount(quote.quote.minOut, outDecimals)}{" "}
              · Route:{" "}
              {quote.quote.route.venue} · Price impact:{" "}
              <span
                style={{
                  color:
                    quote.quote.priceImpactBps > 100
                      ? "var(--negative)"
                      : "var(--muted)",
                }}
              >
                {(quote.quote.priceImpactBps / 100).toFixed(2)}%
              </span>
            </p>
          </div>
        ) : null}
      </div>

      {side === "sell" && quote.quote?.approvals?.length ? (
        <ApprovalSteps
          total={quote.quote.approvals.length}
          current={swap.approvalStep?.current ?? null}
        />
      ) : null}

      <StatusMessage status={swap.status} txHash={swap.txHash} error={swap.error} />

      <button
        type="button"
        onClick={handleButtonClick}
        disabled={
          !wallet.chainOk ||
          isBusy ||
          (swap.status === "idle" && !quote.quote)
        }
        className="font-text border border-[var(--ink)] bg-[var(--ink)] py-3 text-[var(--paper)] disabled:opacity-50"
        style={{ fontSize: "var(--text-body)" }}
      >
        {buttonLabel(side, swap.status, quote.quote != null, amount !== "")}
      </button>
    </div>
  );
}
