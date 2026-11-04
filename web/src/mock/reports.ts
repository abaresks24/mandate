import { GuardianReport } from "@/lib/types";

// Guardian reports for the two LIVE on-chain actions.
//
// The coordinator exposes committee membership + the tally on-chain, but the
// signed report *payloads* (facts, reason codes, sources) live inside each
// guardian's TEE and are surfaced here so the demo can render the commit ->
// reveal lifecycle. The commit hash shown in the UI is computed at runtime as
// sha256(canonicalJson(report)) — so "sha256(report) == commit" is proven in
// the browser, not asserted.

// ---- a1: the clean cross-chain path. Committee [g5,g1,g2], tally 3/3. ----
const CLEAN_FACTS = {
  price_usdc: "1000020",
  price_block: 7421883,
  observed_slippage_bps: 11,
  protocol_paused: false,
};

function cleanReport(slip: number): GuardianReport {
  return {
    action_id: "a1",
    approve: true,
    reason_codes: ["PRICE_OK", "SLIPPAGE_OK", "PROTOCOL_LIVE", "CROSSCHAIN_STATE_OK"],
    facts: { ...CLEAN_FACTS, observed_slippage_bps: slip },
    sources: [
      { name: "pyth", verifiable: true, payload_ref: "0x5b2e…signed-update" },
      { name: "rpc-sepolia", verifiable: false, endpoint: "https://rpc.sepolia.org" },
    ],
  };
}

export const A1_REPORTS: Record<string, GuardianReport> = {
  g5: cleanReport(11),
  g1: cleanReport(12),
  g2: cleanReport(10),
};

// ---- a2: the attack. Committee [g7,g4,g3], tally 1/3 -> BLOCKED. ----
// g7 (corrupt) approves ALONE off a fabricated depeg from a non-verifiable
// feed. g4 + g3 read the same block via a verifiable Pyth update and REFUSE.
// 1 approval < 2-of-3 threshold => action blocked. g7 is then slashed.
const A2_HONEST = (slip: number): GuardianReport => ({
  action_id: "a2",
  approve: false,
  reason_codes: ["PRICE_OK", "CROSSCHAIN_STATE_OK"],
  facts: {
    price_usdc: "1000015",
    price_block: 7421990,
    observed_slippage_bps: slip,
    protocol_paused: false,
  },
  sources: [
    { name: "pyth", verifiable: true, payload_ref: "0x9ad0…signed-update" },
    { name: "rpc-sepolia", verifiable: false, endpoint: "https://rpc.sepolia.org" },
  ],
});

export const A2_REPORTS: Record<string, GuardianReport> = {
  g7: {
    action_id: "a2",
    approve: true, // the lie: approves the bad action alone
    reason_codes: ["DEPEG", "PRICE_DEVIATION"],
    facts: {
      price_usdc: "915000", // fabricated $0.915 depeg
      price_block: 7421990,
      observed_slippage_bps: 480,
      protocol_paused: false,
    },
    sources: [
      { name: "custom-feed", verifiable: false, endpoint: "https://attacker-feed.example" },
    ],
  },
  g4: A2_HONEST(9),
  g3: A2_HONEST(10),
};

export const REPORTS_BY_ACTION: Record<string, Record<string, GuardianReport>> =
  {
    a1: A1_REPORTS,
    a2: A2_REPORTS,
  };
