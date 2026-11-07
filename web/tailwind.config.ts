import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- Refined premium-fintech dark palette (zinc-950 base) ---
        // `ink` is the layered near-black background; `panel`/`edge` give
        // subtle elevation steps. Legacy aliases kept so existing markup
        // keeps rendering while we restyle.
        ink: "#09090b", // zinc-950 base
        surface: "#0c0c0f", // one step up
        panel: "#111114", // card fill
        elevated: "#17171b", // hovered / raised card
        edge: "#26262b", // 1px borders (approx white/8 on ink)
        hairline: "#1c1c21", // fainter divider

        // ONE confident accent — NEAR green — used sparingly.
        near: "#00EC97",
        "near-dim": "#00b876",
        // Secondary accent for the EVM / cross-chain side (restrained indigo).
        evm: "#818cf8",
        // Danger — slashing / blocked only.
        danger: "#F43F5E",
        warn: "#f59e0b",
        ok: "#00EC97",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: [
          "var(--font-geist-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 1px 2px 0 rgba(0,0,0,0.5), 0 8px 24px -12px rgba(0,0,0,0.6)",
        "card-hover":
          "0 1px 0 0 rgba(255,255,255,0.05) inset, 0 2px 4px 0 rgba(0,0,0,0.5), 0 16px 40px -16px rgba(0,0,0,0.7)",
        glow: "0 0 0 1px rgba(0,236,151,0.2), 0 0 40px -8px rgba(0,236,151,0.35)",
        "glow-danger":
          "0 0 0 1px rgba(244,63,94,0.25), 0 0 40px -8px rgba(244,63,94,0.4)",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        "pulse-dot": "pulse-dot 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
