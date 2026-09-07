/**
 * The one ornament in the system: a dial rosette, not a generic
 * Victorian printer's flower — it reads as a clock face reduced to its
 * marks. It appears only where a Rule marks a section boundary, never
 * inside the swap flow. Budget is the point: its rarity is what makes it
 * read as a threshold.
 */
export function Fleuron({
  size = 22,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const ticks = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
    >
      <g stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
        {ticks.map((angle) => (
          <line
            key={angle}
            x1="12"
            y1={angle % 90 === 0 ? "2" : "3.5"}
            x2="12"
            y2={angle % 90 === 0 ? "5.5" : "6.5"}
            transform={`rotate(${angle} 12 12)`}
          />
        ))}
      </g>
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}
