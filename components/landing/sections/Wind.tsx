export function Wind() {
  return (
    <>
      <h2
        className="font-display mt-4 max-w-[18ch]"
        style={{ fontSize: "var(--text-display-2)", lineHeight: 1.15 }}
      >
        Your keys wind it. Nothing else does.
      </h2>
      <p
        className="font-text mt-6 max-w-[62ch]"
        style={{ fontSize: "var(--text-body)", lineHeight: 1.7 }}
      >
        Connecting a wallet is the only account Clockwork has. There is no
        sign-up, no custodian, and no balance held anywhere but the address
        you connect. The mechanism only turns because you turn it.
      </p>
    </>
  );
}
