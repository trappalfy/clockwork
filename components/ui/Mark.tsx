/**
 * The Clockwork mark: a gear, its teeth cut the same way as the 3D
 * mechanism's (see components/landing/mechanism/gear.ts), with a
 * bidirectional arrow through the bore — the swap, not just the
 * machine.
 *
 * Two materials, split along what each part means. The gear body is
 * --accent (brass): it's the machine, and brass is the only metal this
 * brand has. Everything that carries meaning rather than mass — the
 * arrow, the hub ring, the centre — is --fg (ink): the engraved
 * marking on the instrument. That split is also what keeps the mark
 * legible; raw brass sits at 2.8:1 on paper, fine for a large fill but
 * not for the fine detail, so the detail is ink at 14.6:1.
 *
 * Every colour is a semantic token, so the mark inverts by itself
 * inside .plate (brass → brass-light, ink → paper, and the hub punches
 * out to plate instead of paper) without branching on where it sits.
 *
 * Decorative by default (aria-hidden): everywhere it's used, the
 * "Clockwork" wordmark sits next to it, so a second announcement would
 * be redundant. Pass ariaLabel to use it standalone (an avatar or
 * favicon-sized instance with no accompanying text).
 */
export function Mark({
  className = "",
  ariaLabel,
}: {
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      aria-hidden={ariaLabel ? undefined : true}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
    >
      {/* The machine: two gear crescents, brass. */}
      <path
        fill="var(--accent)"
        d="M 30.46 74.69 L 20.49 53.72 L 33.60 36.32 L 56.50 40.13 L 59.96 17.17 L 80.56 10.08 L 97.42 26.05 L 113.12 8.94 L 134.17 14.58 L 139.21 37.24 L 161.80 31.85 L 176.09 48.29 L 167.60 69.90 L 189.34 78.05 L 192.00 99.68 L 172.88 112.85 L 186.34 131.77 L 176.45 151.18 L 153.23 151.40 L 131.65 130.56 A 44 44 0 1 0 58.65 84.95 Z"
      />
      <path
        fill="var(--accent)"
        d="M 169.54 125.31 L 179.51 146.28 L 166.40 163.68 L 143.50 159.87 L 140.04 182.83 L 119.44 189.92 L 102.58 173.95 L 86.88 191.06 L 65.83 185.42 L 60.79 162.76 L 38.20 168.15 L 23.91 151.71 L 32.40 130.10 L 10.66 121.95 L 8.00 100.32 L 27.12 87.15 L 13.66 68.23 L 23.55 48.82 L 46.77 48.60 L 68.35 69.44 A 44 44 0 1 0 141.35 115.05 Z"
      />

      {/* The marking: hub and swap arrow, ink. The punch-out is --bg so
          the bore reads as a hole in whatever ground the mark sits on. */}
      <circle cx="100" cy="100" r="20" fill="var(--bg)" />
      <circle
        cx="100"
        cy="100"
        r="20"
        fill="none"
        stroke="var(--fg)"
        strokeWidth="4"
      />
      <circle cx="100" cy="100" r="6" fill="var(--fg)" />
      <path
        d="M 87.39 109.85 L 185.11 33.51"
        stroke="var(--fg)"
        strokeWidth="3.5"
        fill="none"
      />
      <path fill="var(--fg)" d="M 200.87 21.20 L 190.03 39.81 L 180.18 27.20 Z" />
      <path
        d="M 112.61 90.15 L 14.89 166.49"
        stroke="var(--fg)"
        strokeWidth="3.5"
        fill="none"
      />
      <path fill="var(--fg)" d="M -0.87 178.80 L 9.97 160.19 L 19.82 172.80 Z" />
    </svg>
  );
}
