// Proposer: emits ActionTemplate(s) to the vault's propose_action.
//
// This module ONLY ever emits templates (SPEC "ActionTemplate"). It never
// builds raw transactions or arbitrary calldata — the vault builds the EVM tx
// from the template and signs via Chain Signatures. The agent holds only a
// function-call key SCOPED to the vault's propose_action method (AGENT_FC_KEY).

import type { ActionTemplate, Mandate } from "./types.js";

/**
 * Minimal signer interface modelling the near-api-js function-call key path.
 * Real impl signs a FunctionCall to `propose_action` on the vault with the FC
 * key; a documented stub satisfies this interface for offline runs/tests.
 */
export interface VaultSigner {
  /**
   * Call `propose_action({ template })` on `vaultAccount` using the agent's
   * function-call key. Returns the on-chain ActionId.
   */
  proposeAction(vaultAccount: string, template: ActionTemplate): Promise<string>;
}

/** Validate a template is structurally allowed by the mandate BEFORE sending. */
export function templateAllowedByMandate(
  template: ActionTemplate,
  mandate: Mandate,
): { ok: true } | { ok: false; reason: string } {
  switch (template.kind) {
    case "SupplyRhea": {
      if (!mandate.allowed_protocols.includes("rhea")) {
        return { ok: false, reason: "protocol 'rhea' not in allowed_protocols" };
      }
      if (!mandate.allowed_chains.includes("near")) {
        return { ok: false, reason: "chain 'near' not in allowed_chains" };
      }
      if (!/^\d+$/.test(template.amount)) {
        return { ok: false, reason: "amount must be a u128 decimal string" };
      }
      return { ok: true };
    }
    case "AllocateCrossChain": {
      if (!mandate.allowed_protocols.some((p) => template.protocol.startsWith(p) || p.startsWith(template.protocol))) {
        return {
          ok: false,
          reason: `protocol '${template.protocol}' not in allowed_protocols`,
        };
      }
      if (!mandate.allowed_chains.includes(template.chain)) {
        return {
          ok: false,
          reason: `chain '${template.chain}' not in allowed_chains`,
        };
      }
      if (!/^\d+$/.test(template.amount)) {
        return { ok: false, reason: "amount must be a u128 decimal string" };
      }
      if (template.max_slippage_bps < 0 || template.max_slippage_bps > 10_000) {
        return { ok: false, reason: "max_slippage_bps out of range" };
      }
      return { ok: true };
    }
    case "WithdrawToUsdc":
    case "EmergencyExit":
      // Always structurally permitted — these only ever move toward USDC/home.
      return { ok: true };
  }
}

export interface ProposeResult {
  template: ActionTemplate;
  action_id: string;
}

/**
 * Emit each template to the vault via propose_action. Rejects any template that
 * is not allowed by the mandate (defense in depth; the vault re-checks on-chain).
 */
export async function proposeTemplates(
  templates: ActionTemplate[],
  mandate: Mandate,
  vaultAccount: string,
  signer: VaultSigner,
): Promise<ProposeResult[]> {
  const results: ProposeResult[] = [];
  for (const template of templates) {
    const check = templateAllowedByMandate(template, mandate);
    if (!check.ok) {
      throw new Error(`refusing to propose out-of-mandate template: ${check.reason}`);
    }
    const action_id = await signer.proposeAction(vaultAccount, template);
    results.push({ template, action_id });
  }
  return results;
}

/**
 * Documented stub signer. Models the near-api-js function-call key flow without
 * touching the network. Replace with NearApiVaultSigner for real testnet runs.
 *
 * Real implementation sketch (requires AGENT_FC_KEY + AGENT_ACCOUNT + RPC):
 *
 *   import { connect, keyStores, KeyPair } from "near-api-js";
 *   const keyStore = new keyStores.InMemoryKeyStore();
 *   await keyStore.setKey("testnet", AGENT_ACCOUNT, KeyPair.fromString(AGENT_FC_KEY));
 *   const near = await connect({ networkId: "testnet", nodeUrl: NEAR_RPC_URL, keyStore });
 *   const account = await near.account(AGENT_ACCOUNT);
 *   const outcome = await account.functionCall({
 *     contractId: vaultAccount,
 *     methodName: "propose_action",
 *     args: { template },
 *     gas: 30_000_000_000_000n,
 *   });
 *   return parseActionId(outcome);  // the returned ActionId
 *
 * The FC key is scoped to `propose_action` only; it cannot sign anything else.
 */
export class StubVaultSigner implements VaultSigner {
  private counter = 0;
  constructor(private readonly vaultId = "v1") {}
  async proposeAction(
    _vaultAccount: string,
    _template: ActionTemplate,
  ): Promise<string> {
    this.counter += 1;
    return `${this.vaultId}-a${this.counter}`;
  }
}
