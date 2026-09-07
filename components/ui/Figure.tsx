import type { ReactNode } from "react";

/**
 * A captioned illustration, in the convention of 19th-century technical
 * engravings: image, then a small italic caption below, optionally
 * numbered. Use figureNumber only when the page actually numbers its
 * illustrations in sequence — not as a decorative counter.
 */
export function Figure({
  children,
  caption,
  figureNumber,
  className = "",
}: {
  children: ReactNode;
  caption: string;
  figureNumber?: number;
  className?: string;
}) {
  return (
    <figure className={`m-0 ${className}`}>
      <div className="border border-[var(--rule)] bg-[var(--surface)] p-2">
        {children}
      </div>
      <figcaption className="mt-3 font-text text-[var(--text-caption)] italic text-[var(--muted)]">
        {figureNumber != null ? `Fig. ${figureNumber}. ` : null}
        {caption}
      </figcaption>
    </figure>
  );
}
