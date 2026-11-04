import { useId } from "react";

// The rub el hizb: the eight-pointed star the Mushaf prints at every quarter of a hizb, the
// unit a memoriser counts progress in. Drawn as one outline (two squares, one turned 45°).
const STAR = "5.5,5.5 9.31,5.5 12,2.81 14.69,5.5 18.5,5.5 18.5,9.31 21.19,12 18.5,14.69 18.5,18.5 14.69,18.5 12,21.19 9.31,18.5 5.5,18.5 5.5,14.69 2.81,12 5.5,9.31";

/** The mark: a lapis star with a paper ring at its centre. */
export function Seal({ className = "h-9 w-9", inverted = false }) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
      <polygon points={STAR} fill={inverted ? "hsl(var(--primary-foreground))" : "hsl(var(--primary))"} />
      <circle cx="12" cy="12" r="3.4" fill="none" strokeWidth="1.3"
        stroke={inverted ? "hsl(var(--primary))" : "hsl(var(--primary-foreground))"} />
    </svg>
  );
}

/** The star alone, in the current text colour — the mark of something completed. */
export function StarMark({ size = 14, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`shrink-0 ${className}`} aria-hidden="true">
      <polygon points={STAR} fill="currentColor" />
    </svg>
  );
}

/** The same star as a lattice, linked tip to tip — the ground of the sign-in pages. */
export function StarLattice({ className = "", size = 88 }) {
  // useId's punctuation is not safe inside url(#…), so keep only the word characters.
  const id = `lattice${useId().replace(/\W/g, "")}`;
  const k = size / 32, o = (size - 24 * k) / 2;
  const pts = STAR.split(" ").map((p) => p.split(",").map((n) => (Number(n) * k + o).toFixed(2)).join(",")).join(" ");
  const c = size / 2, tip = 2.81 * k + o;
  return (
    <svg className={className} aria-hidden="true" width="100%" height="100%">
      <defs>
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1">
            <polygon points={pts} />
            <circle cx={c} cy={c} r={3.4 * k} />
            <path d={`M${c} 0V${tip}M${c} ${size - tip}V${size}M0 ${c}H${tip}M${size - tip} ${c}H${size}`} />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
