import { Web3Provider } from "@/hooks/provider";

/**
 * wagmi + react-query are mounted here, not in the root layout — every
 * hook in hooks/** depends on this, but the landing route must not carry
 * a wallet connector into its bundle. See the build plan's bundle
 * isolation section: the root layout stays fonts-and-tokens only.
 */
export default function TradeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Web3Provider>{children}</Web3Provider>;
}
