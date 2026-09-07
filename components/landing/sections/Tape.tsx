import { Stat } from "../Stat";

export function Tape() {
  return (
    <>
      <h2
        className="font-display mt-4 max-w-[22ch]"
        style={{ fontSize: "var(--text-display-2)", lineHeight: 1.15 }}
      >
        Ninety-odd companies, printed the same way.
      </h2>
      <p
        className="font-text mt-6 max-w-[62ch]"
        style={{ fontSize: "var(--text-body)", lineHeight: 1.7 }}
      >
        NVDA, AAPL, SPY, and roughly ninety others — every one a token
        backed by the underlying share, tradeable the moment the tape can
        print its symbol. The list grows as more are listed; nothing here
        requires an application or a waiting room.
      </p>
      <Stat value="~90" label="tokenized equities, and growing" />
    </>
  );
}
