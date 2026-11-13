import type { Config } from "tailwindcss";

const config: Config = {
  // SAGITTAIRE reskin — a textured red-paper field with parchment surfaces,
  // classical serif display + Inter UI, an antique-gold hero accent and crimson
  // interactive accent. Light color-scheme (no dark mode).
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- SURFACES (parchment, sampled from the Sagittaire system) ---
        paper: "#F3E9DD", // primary parchment surface (cards, sheets, bars)
        mist: "#EFE4D6", // secondary / hover parchment
        ink: "#0E0605", // near-black text on parchment
        muted: "#6B5F63", // muted / captions on parchment
        hairline: "#D9C9B6", // hairline on parchment
        edge: "#C3AE97", // stronger parchment line
        surface: "#F3E9DD", // legacy alias

        // --- THE RED PAPER FIELD (body background) ---
        red: "#D6212A", // field mid (center of the glow)
        "red-edge": "#B8171C", // vignette / edges

        // --- ACCENTS ---
        // Crimson = the interactive accent (active states, links, primary btn).
        near: "#C41C24",
        "near-dim": "#B8171C",
        // Antique gold = the RARE accent, hero numbers only.
        gold: "#B08D57",
        // Muted plum = "confidential / special" state (ex-evm).
        evm: "#5A3E57",
        plum: "#5A3E57",
        "plum-weak": "#EBDFE6",

        // --- TEXT ON RED (cream tints) ---
        cream: "#F3E9DD",
        "cream-mut": "#E4C9B9",

        // --- SEMANTIC STATES (brand-tuned, legible on parchment) ---
        danger: "#C41C24",
        warn: "#8A6A2F",
        ok: "#3E6B4F",
        good: "#3E6B4F",

        // Legacy tokens kept so preserved components still compile.
        panel: "#EFE4D6",
        elevated: "#E6D8C6",
      },
      fontFamily: {
        // Inter for UI/body, classical serif for display, mono for data.
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        serif: ['"Cormorant Garamond"', '"Spectral"', "Georgia", '"Times New Roman"', "serif"],
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
        // Letterpress / emboss for parchment surfaces.
        emboss:
          "0 1px 0 rgba(255,255,255,0.55) inset, 0 -1px 0 rgba(184,23,28,0.06) inset, 0 1px 2px rgba(13,10,13,0.10), 0 10px 30px rgba(13,10,13,0.22)",
        "emboss-inset":
          "0 1px 2px rgba(13,10,13,0.18) inset, 0 1px 0 rgba(255,255,255,0.4)",
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
