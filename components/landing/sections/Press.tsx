import { Stat } from "../Stat";

export function Press() {
  return (
    <>
      <h2
        className="font-display mt-4 max-w-[22ch]"
        style={{ fontSize: "var(--text-display-2)", lineHeight: 1.15 }}
      >
        Two strikes for a sale, one for a purchase.
      </h2>
      <p
        className="font-text mt-6 max-w-[62ch]"
        style={{ fontSize: "var(--text-body)", lineHeight: 1.7 }}
      >
        Buying only asks for a signature. Selling asks for two: first a
        permit that lets the router spend the token, then the swap itself.
        They stay two separate approvals because the token and the trade
        are two separate promises — Permit2 keeps them that way instead of
        asking for a blank check up front.
      </p>
      <Stat value="2" label="signatures to sell, not one" />
    </>
  );
}
