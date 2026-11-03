import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0e17",
        panel: "#121826",
        edge: "#1f2a3d",
        near: "#22d3a6",
        evm: "#7c87ff",
        warn: "#f59e0b",
        danger: "#ef4444",
        ok: "#22c55e",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
