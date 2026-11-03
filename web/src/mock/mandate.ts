import { Mandate, Position } from "@/lib/types";

export const MANDATE: Mandate = {
  owner: "alice.testnet",
  target_apy_bps: 800,
  max_risk_score: 60,
  allowed_protocols: ["rhea", "morpho-sepolia"],
  allowed_chains: ["near", "ethereum-sepolia"],
  max_share_per_protocol_bps: 5000,
  max_loss_bps: 300,
  daily_cap_usdc: "5000000000",
  committee_threshold_usdc: "0",
};

export const POSITIONS: Position[] = [
  {
    protocol: "rhea",
    chain: "near",
    token: "usdc",
    amount_usdc: "3000000000",
    apy_bps: 740,
    risk_score: 28,
  },
  {
    protocol: "morpho",
    chain: "ethereum-sepolia",
    token: "usdc",
    amount_usdc: "2000000000",
    apy_bps: 910,
    risk_score: 44,
  },
];
