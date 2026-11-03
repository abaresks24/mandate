// near-api-js client stub for the MANDATE Coordinator + Vault contracts.
//
// Defaults to MOCK MODE via NEXT_PUBLIC_MOCK=1 so the UI renders with no live
// chain. Method signatures mirror SPEC.md "Coordinator contract" and "Vault
// contract" external interfaces exactly — swapping to live is a data-source
// change, not a UI change.
//
// When NEXT_PUBLIC_MOCK=0 the view methods route through near-api-js
// JsonRpcProvider.query(call_function); change/payable methods require a wallet
// signer (wired in Phase 2 integration).

import type {
  ActionState,
  ActionTemplate,
  GuardianInfo,
  Mandate,
  Position,
  Tally,
} from "./types";
import { GUARDIANS } from "@/mock/guardians";
import { MANDATE, POSITIONS } from "@/mock/mandate";
import { MORPHO_ACTION, RHEA_ACTION } from "@/mock/actions";
import { SLASHING_ACTION } from "@/mock/slashing";

export const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK !== "0";

export const NEAR_CONFIG = {
  network: process.env.NEXT_PUBLIC_NEAR_NETWORK ?? "testnet",
  nodeUrl:
    process.env.NEXT_PUBLIC_NEAR_NETWORK === "mainnet"
      ? "https://rpc.mainnet.near.org"
      : "https://rpc.testnet.near.org",
  coordinatorId:
    process.env.NEXT_PUBLIC_COORDINATOR_ID ?? "coordinator.mandate.testnet",
  vaultId: process.env.NEXT_PUBLIC_VAULT_ID ?? "demo.vaults.mandate.testnet",
};

const ALL_ACTIONS: ActionState[] = [RHEA_ACTION, MORPHO_ACTION, SLASHING_ACTION];

// Lazy near-api-js provider; only constructed in live mode.
async function provider() {
  const { providers } = await import("near-api-js");
  return new providers.JsonRpcProvider({ url: NEAR_CONFIG.nodeUrl });
}

async function viewCall<T>(
  contractId: string,
  method: string,
  args: Record<string, unknown>
): Promise<T> {
  const p = await provider();
  const res = (await p.query({
    request_type: "call_function",
    account_id: contractId,
    method_name: method,
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
    finality: "optimistic",
  })) as unknown as { result: number[] };
  return JSON.parse(Buffer.from(res.result).toString()) as T;
}

// --------------------------------------------------------------------------
// Coordinator contract — external interface (SPEC.md)
// --------------------------------------------------------------------------
export const coordinator = {
  async view_guardian(guardian_id: string): Promise<GuardianInfo> {
    if (MOCK_MODE)
      return GUARDIANS.find((g) => g.id === guardian_id) ?? GUARDIANS[0];
    return viewCall(NEAR_CONFIG.coordinatorId, "view_guardian", { guardian_id });
  },

  async list_guardians(): Promise<GuardianInfo[]> {
    if (MOCK_MODE) return GUARDIANS;
    return viewCall(NEAR_CONFIG.coordinatorId, "list_guardians", {});
  },

  // committee draw — bond-weighted, rotation, invariant sum(bond) >= value.
  async draw_committee(
    vault_id: string,
    action_id: string,
    action_value_usdc: string
  ): Promise<string[]> {
    if (MOCK_MODE)
      return (
        ALL_ACTIONS.find((a) => a.action_id === action_id)?.committee ?? []
      ).map((m) => m.guardian.id);
    return viewCall(NEAR_CONFIG.coordinatorId, "draw_committee", {
      vault_id,
      action_id,
      action_value_usdc,
    });
  },

  async tally(action_id: string): Promise<Tally> {
    if (MOCK_MODE)
      return (
        ALL_ACTIONS.find((a) => a.action_id === action_id)?.tally ?? {
          approvals: 0,
          threshold_met: false,
        }
      );
    return viewCall(NEAR_CONFIG.coordinatorId, "tally", { action_id });
  },

  // --- payable / change methods (require signer, wired in Phase 2) ---
  async submit_commit(
    _action_id: string,
    _guardian_id: string,
    _commit_hash: string,
    _outlayer_proof: Uint8Array
  ): Promise<void> {
    if (MOCK_MODE) return;
    throw new Error("submit_commit requires a signer (Phase 2 integration)");
  },
  async reveal_report(
    _action_id: string,
    _guardian_id: string,
    _report_json: string
  ): Promise<void> {
    if (MOCK_MODE) return;
    throw new Error("reveal_report requires a signer (Phase 2 integration)");
  },
  async open_challenge(
    _action_id: string,
    _guardian_id: string,
    _fault: string,
    _proof_json: string
  ): Promise<string> {
    if (MOCK_MODE) return "ch-17";
    throw new Error("open_challenge requires a challenger deposit (Phase 2)");
  },
  async resolve_challenge(_challenge_id: string): Promise<void> {
    if (MOCK_MODE) return;
    throw new Error("resolve_challenge requires a signer (Phase 2)");
  },
};

// --------------------------------------------------------------------------
// Vault contract — external interface (SPEC.md)
// --------------------------------------------------------------------------
export const vault = {
  async view_positions(): Promise<Position[]> {
    if (MOCK_MODE) return POSITIONS;
    return viewCall(NEAR_CONFIG.vaultId, "view_positions", {});
  },
  async view_mandate(): Promise<Mandate> {
    if (MOCK_MODE) return MANDATE;
    return viewCall(NEAR_CONFIG.vaultId, "view_mandate", {});
  },
  async view_action(action_id: string): Promise<ActionState | null> {
    if (MOCK_MODE)
      return ALL_ACTIONS.find((a) => a.action_id === action_id) ?? null;
    return viewCall(NEAR_CONFIG.vaultId, "view_action", { action_id });
  },
  async list_actions(): Promise<ActionState[]> {
    if (MOCK_MODE) return ALL_ACTIONS;
    return viewCall(NEAR_CONFIG.vaultId, "list_actions", {});
  },

  // --- change methods (require signer, wired in Phase 2) ---
  async propose_action(_template: ActionTemplate): Promise<string> {
    if (MOCK_MODE) return "v12-a7";
    throw new Error("propose_action requires the agent FC key (Phase 2)");
  },
  async execute_action(_action_id: string): Promise<void> {
    if (MOCK_MODE) return;
    throw new Error("execute_action requires a signer (Phase 2)");
  },
  async emergency_exit(): Promise<void> {
    if (MOCK_MODE) return;
    throw new Error("emergency_exit requires the agent FC key (Phase 2)");
  },
  async kill_switch(): Promise<void> {
    if (MOCK_MODE) return;
    throw new Error("kill_switch requires the owner key (Phase 2)");
  },
};
