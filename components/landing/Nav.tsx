const items = [
  { href: "#wind", label: "Wind" },
  { href: "#escapement", label: "Escapement" },
  { href: "#gears", label: "Gears" },
  { href: "#press", label: "Press" },
  { href: "#tape", label: "Tape" },
  { href: "#enter", label: "Enter" },
];

/**
 * The section index, a plain masthead-strip header across the top of
 * the page. Deliberately hardcoded to paper colours rather than the
 * semantic --fg/--bg tokens: it sits above every section, including
 * the dark plate ones, and must stay legible regardless of what's
 * scrolling past beneath it — the strip itself never changes colour.
 */
export function Nav() {
  return (
    <nav
      aria-label="Sections"
      className="font-mono flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-b border-[#1c1815]/15 bg-[#efe9dc] px-6 py-4 text-[0.8125rem] tracking-wide text-[#1c1815] sm:px-10"
    >
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="hover:text-[#8a5a22] focus-visible:text-[#8a5a22]"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
