// Server-side NEAR plumbing for the live Launch flow. Keys come from the
// LAUNCH_KEYS_JSON env var (Vercel) or web/.secrets/testnet-keys.json (local),
// NEVER from the client and never committed.

import "server-only";
import fs from "node:fs";
import path from "node:path";
import { connect, keyStores, KeyPair, providers } from "near-api-js";
import type { Account } from "near-api-js";

export interface LaunchKeys {
  deployer: { account: string; sk: string };
  agent: { pk: string; sk: string };
  accounts: Record<string, { pk: string; sk: string }>;
  coordinator: string;
  vault: string;
  guardianAccounts: string[];
}

let cached: LaunchKeys | null = null;
export function keys(): LaunchKeys {
  if (cached) return cached;
  const env = process.env.LAUNCH_KEYS_JSON;
  if (env) return (cached = JSON.parse(env) as LaunchKeys);
  const file = path.join(process.cwd(), ".secrets", "testnet-keys.json");
  if (!fs.existsSync(file))
    throw new Error("Launch keys not configured (set LAUNCH_KEYS_JSON or web/.secrets/testnet-keys.json)");
  return (cached = JSON.parse(fs.readFileSync(file, "utf8")) as LaunchKeys);
}

export const NEAR_RPC = process.env.NEXT_PUBLIC_NEAR_RPC || "https://test.rpc.fastnear.com";

async function account(accountId: string, sk: string): Promise<Account> {
  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey("testnet", accountId, KeyPair.fromString(sk as never));
  const near = await connect({ networkId: "testnet", nodeUrl: NEAR_RPC, keyStore });
  return near.account(accountId);
}

/** The vault owner (full-access key): update_mandate, deposit_usdc, admin. */
export const asOwner = () => account(keys().deployer.account, keys().deployer.sk);
/** The agent: same account id but its RESTRICTED function-call key (vault methods only, 0 deposit). */
export const asAgent = () => account(keys().deployer.account, keys().agent.sk);
/** A guardian operator, signing with the guardian's own account. */
export async function asGuardian(accountId: string) {
  const k = keys().accounts[accountId];
  if (!k) throw new Error(`no key for guardian account ${accountId}`);
  return account(accountId, k.sk);
}

const provider = () => new providers.JsonRpcProvider({ url: NEAR_RPC });

export async function view<T>(contractId: string, methodName: string, args: object = {}): Promise<T> {
  const res = (await provider().query({
    request_type: "call_function",
    account_id: contractId,
    method_name: methodName,
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
    finality: "optimistic",
  })) as unknown as { result: number[] };
  return JSON.parse(Buffer.from(res.result).toString("utf8")) as T;
}

export const TGAS = (n: number) => BigInt(n) * 10n ** 12n;

export interface TxResult {
  hash: string;
  failure?: string;
}

/** Call a contract method; never throws on a contract panic, returns it so the UI can show it. */
export async function call(
  from: Account,
  contractId: string,
  methodName: string,
  args: object,
  opts: { gas?: bigint; deposit?: bigint } = {},
): Promise<TxResult> {
  try {
    const out = await from.functionCall({
      contractId,
      methodName,
      args,
      gas: opts.gas ?? TGAS(30),
      attachedDeposit: opts.deposit ?? 0n,
    } as never);
    // A receipt can fail even if the tx was accepted (cross-contract panics).
    const failed = (out.receipts_outcome as Array<{ outcome: { status: unknown } }>).find(
      (r) => typeof r.outcome.status === "object" && r.outcome.status !== null && "Failure" in (r.outcome.status as object),
    );
    return {
      hash: out.transaction.hash as string,
      failure: failed ? JSON.stringify((failed.outcome.status as { Failure: unknown }).Failure) : undefined,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hash = (e as { transaction_outcome?: { id?: string } })?.transaction_outcome?.id ?? "";
    return { hash, failure: msg };
  }
}

export const nearblocksTx = (h: string) => `https://testnet.nearblocks.io/txns/${h}`;
