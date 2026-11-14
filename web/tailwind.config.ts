import type { Config } from "tailwindcss";

const config: Config = {
  // SAGITTAIRE reskin — a textured red-paper field with parchment surfaces,
  // classical serif display + Inter UI, an antique-gold hero accent and crimson
  // interactive accent. Light color-scheme (no dark mode).
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- COOL-BLUE DARK surfaces (the "blue parchment") + near-white text ---
        paper: "#15314C", // card / sheet / bar base
        mist: "#1B3A59", // lighter / nested / hover
        ink: "#EAF1F8", // near-white text
        muted: "#9FB4CB", // cool gray-blue captions
        hairline: "#2C4C6B", // subtle border on dark blue
        edge: "#3A5F84", // stronger border
        surface: "#15314C", // legacy alias

        // --- THE NAVY FIELD (body background) — token name kept as `red` ---
        red: "#0E2238", // field mid (deep navy)
        "red-edge": "#081626", // field edge

        // --- THE BLUES ---
        // Bright blue = interactive accent (active states, links, primary btn).
        near: "#5B9BD5",
        "near-dim": "#4E8BC2",
        // Bright cold blue = the headline / hero-number accent.
        gold: "#8FC2EE",
        // Light steel = third blue (secondary / special state).
        evm: "#7FA6CC",
        plum: "#7FA6CC",
        "plum-weak": "#24415E",
        steel: "#7FA6CC", // light blue for charts / soft accents

        // --- TEXT ON THE NAVY FIELD (cool near-white) ---
        cream: "#EAF1F8",
        "cream-mut": "#AEC2D6",

        // --- SEMANTIC STATES (brightened so they read on dark blue) ---
        danger: "#E8897E",
        warn: "#E0B56A",
        ok: "#5BC0A8",
        good: "#5BC0A8",

        // Legacy tokens kept so preserved components still compile.
        panel: "#1B3A59",
        elevated: "#24415E",
      },
      fontFamily: {
        // Inter for UI/body, Space Grotesk for display (Morpho-ish grotesque), mono for data.
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        serif: ['"Space Grotesk"', "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", '"Cascadia Code"', "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      borderRadius: {
        sm: "10px",
        lg: "12px",
        xl: "14px",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        // Elevation for dark-blue surfaces.
        emboss:
          "0 1px 0 rgba(255,255,255,0.06) inset, 0 1px 2px rgba(3,10,18,0.4), 0 12px 30px rgba(3,10,18,0.42)",
        "emboss-inset":
          "0 1px 2px rgba(3,10,18,0.5) inset, 0 1px 0 rgba(255,255,255,0.05)",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
