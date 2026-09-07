/**
 * The one illustration in this phase of the build: a rough sketch of the
 * escapement, standing in for the scene that will eventually run behind
 * these sections (see the build plan, phase 3). It is deliberately not
 * finished art — real illustration work happens once the scene exists,
 * so this sketch doesn't get redrawn twice.
 */
export function EscapementSketch({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 140" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="70" cy="70" r="42" />
        {Array.from({ length: 16 }, (_, i) => i * 22.5).map((a) => (
          <line
            key={a}
            x1="70"
            y1="24"
            x2="70"
            y2="32"
            transform={`rotate(${a} 70 70)`}
          />
        ))}
        <path d="M120 40 L150 70 L120 100" />
        <circle cx="70" cy="70" r="3" fill="currentColor" />
      </g>
    </svg>
  );
}
