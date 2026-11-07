import type { Config } from "tailwindcss";

const config: Config = {
  // Light theme only — no dark mode. The "dark" class is never set on <html>.
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- CLEAR INSTITUTIONAL light palette ---
        // Flat, editorial, black-on-white. One accent.
        paper: "#FFFFFF", // base background
        mist: "#FAFAFA", // alternating section fill
        ink: "#0A0A0A", // near-black primary text
        muted: "#6B7280", // secondary gray (zinc-500)
        hairline: "#EAEAEA", // 1px borders (zinc-200)
        edge: "#EAEAEA", // legacy alias -> light hairline
        surface: "#FFFFFF", // legacy alias (preserved components)

        // ONE confident accent — NEAR green — used sparingly.
        near: "#00EC97",
        "near-dim": "#00b876",
        // Secondary accent for the EVM / cross-chain side (restrained indigo).
        evm: "#4f46e5",
        // Danger — slashing / blocked only.
        danger: "#E11D48",
        warn: "#D97706",
        ok: "#00b876",

        // Legacy dark tokens kept so preserved (reused-later) components still
        // compile. They are not used by the new shell.
        panel: "#F5F5F5",
        elevated: "#F0F0F0",
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
      letterSpacing: {
        tightest: "-0.04em",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
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
