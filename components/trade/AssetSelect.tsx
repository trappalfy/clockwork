"use client";

import type { Asset } from "@/lib/types";

export function AssetSelect({
  assets,
  value,
  onChange,
  disabled,
}: {
  assets: Asset[];
  value: string;
  onChange: (symbol: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="font-mono w-full border border-[var(--rule)] bg-[var(--bg)] px-3 py-2 text-[var(--fg)] disabled:opacity-50"
      style={{ fontSize: "var(--text-body-sm)" }}
    >
      {assets
        .filter((a) => a.tradable)
        .map((a) => (
          <option key={a.symbol} value={a.symbol}>
            {a.symbol} — {a.name}
          </option>
        ))}
    </select>
  );
}
