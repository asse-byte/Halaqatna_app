/** @type {import('tailwindcss').Config} */
const token = (name) => `hsl(var(--${name}) / <alpha-value>)`;

module.exports = {
  blocklist: ["overline"],
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "serif"],
        quran: ["Amiri", "Scheherazade New", "serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 3px)" },
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        card: { DEFAULT: token("card"), foreground: token("card-foreground") },
        popover: { DEFAULT: token("popover"), foreground: token("popover-foreground") },
        primary: { DEFAULT: token("primary"), foreground: token("primary-foreground") },
        secondary: { DEFAULT: token("secondary"), foreground: token("secondary-foreground") },
        muted: { DEFAULT: token("muted"), foreground: token("muted-foreground") },
        accent: { DEFAULT: token("accent"), foreground: token("accent-foreground") },
        destructive: { DEFAULT: token("destructive"), foreground: token("destructive-foreground") },
        sidebar: token("sidebar"),
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
        success: token("success"),
        warning: token("warning"),
        danger: token("destructive"),
        gold: { DEFAULT: token("gold"), ink: token("gold-ink") },
        // The Mastery bands as chart fills. Checked with the dataviz palette validator against
        // the card surface in each mode (lightness band, chroma, colour-blind separation).
        band: {
          EXCELLENT: "var(--band-excellent)",
          STRONG: "var(--band-strong)",
          DEVELOPING: "var(--band-developing)",
          NEEDS_WORK: "var(--band-needs-work)",
          NO_DATA: "var(--band-no-data)",
        },
      },
    },
  },
  plugins: [],
};
