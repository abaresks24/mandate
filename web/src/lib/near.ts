// near-api-js client for the YieldAI Coordinator + Vault + Registry contracts.
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
  ActionLive,
  ActionState,
  ActionTemplate,
  CommitteeLive,
  GuardianHistory,
  GuardianInfo,
  GuardianLive,
  GuardianRow,
  Mandate,
  PositionsLive,
  Position,
  Tally,
} from "./types";
import { GUARDIANS } from "@/mock/guardians";
import { MANDATE, POSITIONS } from "@/mock/mandate";
import { MORPHO_ACTION, RHEA_ACTION } from "@/mock/actions";
import { SLASHING_ACTION } from "@/mock/slashing";

export const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK === "1";

export const NEAR_CONFIG = {
  network: process.env.NEXT_PUBLIC_NEAR_NETWORK ?? "testnet",
  nodeUrl:
    process.env.NEXT_PUBLIC_NEAR_NETWORK === "mainnet"
      ? "https://rpc.mainnet.near.org"
      : "https://rpc.testnet.near.org",
  coordinatorId:
    process.env.NEXT_PUBLIC_COORDINATOR_ID ??
    "coordinator.mandate-arthur.testnet",
  vaultId:
    process.env.NEXT_PUBLIC_VAULT_ID ?? "demo.vaults.mandate-arthur.testnet",
  registryId:
    process.env.NEXT_PUBLIC_REGISTRY_ID ?? "registry.mandate-arthur.testnet",
};

// The deployed mandate registry. Users register their own mandate under their
// account with a wallet-signed, payable call (see lib/registry.ts).
export const REGISTRY_ID = NEAR_CONFIG.registryId;

// Exact on-chain shape returned by view_my_mandate (or null when absent).
export interface MandateRecord {
  owner: string;
  mandate_json: string;
  label: string;
  registered_at_ns: number;
}

// Cross-chain landing proof — real MPC-derived EVM address + mined Sepolia tx.
export const CROSSCHAIN = {
  mpcAddress: "0x3919100A2079A5447F2514BaF6ABc81e15D179D7",
  sepoliaTx:
    "0x363165ff6c712577cd408a658e9e9f4b137ba8d39e03d773af5c71e9ffec4b0a",
  sepoliaStatus: "0x1",
  chainId: 11155111,
  etherscan:
    "https://sepolia.etherscan.io/tx/0x363165ff6c712577cd408a658e9e9f4b137ba8d39e03d773af5c71e9ffec4b0a",
};

// The seven registered guardian ids on the live coordinator.
export const GUARDIAN_IDS = ["g1", "g2", "g3", "g4", "g5", "g6", "g7"];

const ALL_ACTIONS: ActionState[] = [RHEA_ACTION, MORPHO_ACTION, SLASHING_ACTION];

// Lazy near-api-js provider; only constructed in live mode.
async function provider() {
  const { providers } = await import("near-api-js");
  return new providers.JsonRpcProvider({ url: NEAR_CONFIG.nodeUrl });
}

// Browser-safe base64 of a UTF-8 string (no Node Buffer dependency).
function toBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  if (typeof btoa !== "undefined") return btoa(bin);
  // Node fallback (SSR / build-time); harmless if Buffer exists.
  return Buffer.from(s, "utf-8").toString("base64");
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
    args_base64: toBase64(JSON.stringify(args)),
    finality: "optimistic",
  })) as unknown as { result: number[] };
  // res.result is a byte array; decode as UTF-8 without Buffer.
  const json = new TextDecoder().decode(Uint8Array.from(res.result));
  return JSON.parse(json) as T;
}

// --------------------------------------------------------------------------
// LIVE read-only data layer (no wallet). Each fn hits the deployed testnet
// contracts and returns the EXACT on-chain shape. Callers decide fallback.
// --------------------------------------------------------------------------

export const live = {
  async guardian(id: string): Promise<GuardianLive> {
    return viewCall<GuardianLive>(NEAR_CONFIG.coordinatorId, "view_guardian", {
      guardian_id: id,
    });
  },

  async bondUsdc(id: string): Promise<string> {
    return viewCall<string>(NEAR_CONFIG.coordinatorId, "view_bond_usdc", {
      guardian_id: id,
    });
  },

  async guardianRow(id: string): Promise<GuardianRow> {
    const [g, bond_usdc] = await Promise.all([
      this.guardian(id),
      this.bondUsdc(id).catch(() => "0"),
    ]);
    return { ...g, bond_usdc };
  },

  async guardianHistory(id: string): Promise<GuardianHistory> {
    return viewCall<GuardianHistory>(
      NEAR_CONFIG.coordinatorId,
      "view_guardian_history",
      { guardian_id: id }
    );
  },

  async committee(action_id: string): Promise<string[]> {
    return viewCall<string[]>(NEAR_CONFIG.coordinatorId, "view_committee", {
      action_id,
    });
  },

  async tally(action_id: string): Promise<Tally> {
    return viewCall<Tally>(NEAR_CONFIG.coordinatorId, "tally", { action_id });
  },

  async mandate(): Promise<Mandate> {
    return viewCall<Mandate>(NEAR_CONFIG.vaultId, "view_mandate", {});
  },

  async positions(): Promise<PositionsLive> {
    return viewCall<PositionsLive>(NEAR_CONFIG.vaultId, "view_positions", {});
  },

  async action(action_id: string): Promise<ActionLive> {
    return viewCall<ActionLive>(NEAR_CONFIG.vaultId, "view_action", {
      action_id,
    });
  },

  // Guardian's revealed report payload (plaintext JSON string) for an action.
  // view_report returns Option<String>; near-api-js decodes it as a JSON string
  // (or null when not revealed). We return the EXACT inner string so callers can
  // hash the raw bytes the on-chain commit was computed over.
  async report(action_id: string, guardian_id: string): Promise<string | null> {
    return viewCall<string | null>(NEAR_CONFIG.coordinatorId, "view_report", {
      action_id,
      guardian_id,
    });
  },

  // The stored commit hash (lowercase hex sha256 of the exact report string).
  async commit(action_id: string, guardian_id: string): Promise<string | null> {
    return viewCall<string | null>(NEAR_CONFIG.coordinatorId, "view_commit", {
      action_id,
      guardian_id,
    });
  },

  // Resolve a full committee: ids -> guardian rows + tally, all in parallel.
  async committeeLive(action_id: string): Promise<CommitteeLive> {
    const member_ids = await this.committee(action_id);
    const [members, tally] = await Promise.all([
      Promise.all(member_ids.map((id) => this.guardianRow(id))),
      this.tally(action_id),
    ]);
    return { action_id, member_ids, members, tally };
  },

  // All seven registered guardians with their USDC bonds, in parallel.
  async allGuardians(): Promise<GuardianRow[]> {
    return Promise.all(GUARDIAN_IDS.map((id) => this.guardianRow(id)));
  },

  // --- mandate registry (registry.mandate-arthur.testnet) ---

  // The caller's own on-chain mandate record, or null if they never registered.
  async myMandate(account: string): Promise<MandateRecord | null> {
    return viewCall<MandateRecord | null>(REGISTRY_ID, "view_my_mandate", {
      account,
    });
  },

  // Distinct accounts that have registered a mandate.
  async registeredCount(): Promise<number> {
    return viewCall<number>(REGISTRY_ID, "view_count", {});
  },
};

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
