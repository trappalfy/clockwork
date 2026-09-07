const items = [
  { href: "#wind", label: "Wind" },
  { href: "#escapement", label: "Escapement" },
  { href: "#gears", label: "Gears" },
  { href: "#press", label: "Press" },
  { href: "#tape", label: "Tape" },
  { href: "#enter", label: "Enter" },
];

/**
 * The section index, in the position Nostalgique keeps its left-hand
 * contents column. Deliberately hardcoded to paper colours rather than
 * the semantic --fg/--bg tokens: on large screens it's fixed for the
 * whole scroll, so it must stay legible while the sections passing
 * beside it flip between paper and plate. The spine of the page stays
 * one colour; the pages beside it are what turn dark and light.
 */
export function Nav() {
  return (
    <nav
      aria-label="Sections"
      className="font-mono flex flex-wrap gap-x-6 gap-y-2 border-b border-[#1c1815]/15 bg-[#efe9dc] px-6 py-4 text-[0.8125rem] tracking-wide text-[#1c1815] sm:px-10 lg:fixed lg:inset-y-0 lg:left-0 lg:w-32 lg:flex-col lg:justify-center lg:gap-4 lg:border-b-0 lg:border-r lg:px-8 lg:py-0"
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
