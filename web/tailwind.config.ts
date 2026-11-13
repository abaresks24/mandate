import type { Config } from "tailwindcss";

const config: Config = {
  // SAGITTAIRE reskin — a textured red-paper field with parchment surfaces,
  // classical serif display + Inter UI, an antique-gold hero accent and crimson
  // interactive accent. Light color-scheme (no dark mode).
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- SURFACES (cool off-white — three sober blues palette) ---
        paper: "#F1F5F9", // primary cool surface (cards, sheets, bars)
        mist: "#E3EAF2", // secondary / hover
        ink: "#0C1826", // deep-navy text
        muted: "#5A6B7D", // cool gray-blue captions
        hairline: "#D5DEE8", // cool hairline
        edge: "#C2CEDC", // stronger cool line
        surface: "#F1F5F9", // legacy alias

        // --- THE NAVY FIELD (body background) — token name kept as `red` ---
        red: "#0E2238", // field mid (deep navy)
        "red-edge": "#0A1A2C", // field edge

        // --- THE THREE BLUES ---
        // Mid blue = interactive accent (active states, links, primary btn).
        near: "#2E6FA8",
        "near-dim": "#245A89",
        // Deep blue = the headline / hero-number accent.
        gold: "#1E3A5F",
        // Light steel = third blue (secondary / special state).
        evm: "#3E5C7E",
        plum: "#3E5C7E",
        "plum-weak": "#E1E8F0",
        steel: "#7FA6CC", // light blue for charts / soft accents

        // --- TEXT ON THE NAVY FIELD (cool near-white) ---
        cream: "#EAF1F8",
        "cream-mut": "#AEC2D6",

        // --- SEMANTIC STATES (non-blue so they stay legible) ---
        danger: "#C0392B",
        warn: "#B7791F",
        ok: "#2E7D6B",
        good: "#2E7D6B",

        // Legacy tokens kept so preserved components still compile.
        panel: "#E3EAF2",
        elevated: "#D8E1EB",
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
        // Soft lift for the cool surfaces.
        emboss:
          "0 1px 0 rgba(255,255,255,0.7) inset, 0 1px 2px rgba(10,26,44,0.08), 0 10px 30px rgba(10,26,44,0.14)",
        "emboss-inset":
          "0 1px 2px rgba(10,26,44,0.12) inset, 0 1px 0 rgba(255,255,255,0.6)",
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
