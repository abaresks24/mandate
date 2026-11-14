// EVM side of the live Launch flow: derive the vault's Chain-Signatures address,
// reassemble the EIP-1559 tx the vault built, attach the MPC signature, broadcast
// to Ethereum Sepolia. Pure functions + a tiny JSON-RPC client; server-only.

import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256, sha3_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";

export const SEPOLIA_CHAIN_ID = 11155111;
export const MPC_SIGNER = "v1.signer-prod.testnet";
export const VAULT_PATH = "mandate-vault,eth";

// ---- base58 (bitcoin alphabet), only what the MPC public key needs ----
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58decode(s: string): Uint8Array {
  let n = 0n;
  for (const c of s) {
    const i = B58.indexOf(c);
    if (i < 0) throw new Error("bad base58");
    n = n * 58n + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  const body = hexToBytes(hex);
  let zeros = 0;
  for (const c of s) {
    if (c === "1") zeros++;
    else break;
  }
  const out = new Uint8Array(zeros + body.length);
  out.set(body, zeros);
  return out;
}

/** `secp256k1:<base58 of x||y>` (MPC root key) -> 64 raw bytes. */
export function parseMpcPublicKey(s: string): Uint8Array {
  const raw = b58decode(s.replace(/^secp256k1:/, ""));
  if (raw.length !== 64) throw new Error(`unexpected MPC key length ${raw.length}`);
  return raw;
}

/** Address + public key the MPC contract derives for (account, path). */
export function deriveEvmAddress(
  mpcRootKey: string,
  accountId: string,
  path: string,
): { address: string; publicKey: Uint8Array } {
  const root = parseMpcPublicKey(mpcRootKey);
  const epsilonBytes = sha3_256(
    utf8ToBytes(`near-mpc-recovery v0.1.0 epsilon derivation:${accountId},${path}`),
  );
  const epsilon = BigInt("0x" + bytesToHex(epsilonBytes)) % secp256k1.CURVE.n;
  const rootPoint = secp256k1.ProjectivePoint.fromHex("04" + bytesToHex(root));
  const derived = rootPoint.add(secp256k1.ProjectivePoint.BASE.multiply(epsilon));
  const uncompressed = derived.toRawBytes(false); // 65 bytes, 0x04 || x || y
  const addr = keccak_256(uncompressed.slice(1)).slice(12);
  return { address: "0x" + bytesToHex(addr), publicKey: uncompressed };
}

// ---- RLP ----
function rlpBytes(b: Uint8Array): Uint8Array {
  if (b.length === 1 && b[0]! < 0x80) return b;
  return concat(prefix(b.length, 0x80, 0xb7), b);
}
function rlpUint(v: bigint): Uint8Array {
  if (v === 0n) return rlpBytes(new Uint8Array());
  let h = v.toString(16);
  if (h.length % 2) h = "0" + h;
  return rlpBytes(hexToBytes(h));
}
function rlpList(items: Uint8Array[]): Uint8Array {
  const body = concat(...items);
  return concat(prefix(body.length, 0xc0, 0xf7), body);
}
function prefix(len: number, short: number, long: number): Uint8Array {
  if (len < 56) return Uint8Array.of(short + len);
  let h = len.toString(16);
  if (h.length % 2) h = "0" + h;
  const lb = hexToBytes(h);
  return concat(Uint8Array.of(long + lb.length), lb);
}
function concat(...a: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of a) {
    out.set(x, o);
    o += x.length;
  }
  return out;
}

/** Shape of `Vault::view_evm_tx` (the exact tx the vault hashed and had signed). */
export interface VaultEvmTx {
  to: string;
  chain_id: number;
  nonce: number;
  max_priority_fee_per_gas: string | number;
  max_fee_per_gas: string | number;
  gas_limit: number;
  data: string;
  value: string;
}

function txFields(tx: VaultEvmTx): Uint8Array[] {
  return [
    rlpUint(BigInt(tx.chain_id)),
    rlpUint(BigInt(tx.nonce)),
    rlpUint(BigInt(tx.max_priority_fee_per_gas)),
    rlpUint(BigInt(tx.max_fee_per_gas)),
    rlpUint(BigInt(tx.gas_limit)),
    rlpBytes(hexToBytes(tx.to.replace(/^0x/, "").toLowerCase())),
    rlpUint(BigInt(tx.value)),
    rlpBytes(hexToBytes(tx.data.replace(/^0x/, ""))),
    rlpList([]), // access list
  ];
}

/** keccak256(0x02 || rlp(unsigned fields)): must equal the payload the vault signed. */
export function unsignedPayload(tx: VaultEvmTx): string {
  const unsigned = concat(Uint8Array.of(0x02), rlpList(txFields(tx)));
  return bytesToHex(keccak_256(unsigned));
}

/** MPC `SignatureResponse` in any of the shapes the signer has used. */
export interface MpcSignature {
  r: Uint8Array; // 32 bytes
  s: Uint8Array; // 32 bytes
  recoveryId: number;
}
export function parseMpcSignature(raw: string): MpcSignature {
  let v: any = JSON.parse(raw);
  if (Array.isArray(v)) v = v[v.length - 1]; // legacy ["Ok", {...}]
  if (v?.Ok) v = v.Ok;
  const bigR: string = v.big_r?.affine_point ?? v.big_r;
  const scalar: string = v.s?.scalar ?? v.s;
  if (typeof bigR !== "string" || typeof scalar !== "string")
    throw new Error("unrecognised MPC signature shape");
  const r = hexToBytes(bigR).slice(1); // drop the 02/03 compression prefix
  const s = hexToBytes(scalar.padStart(64, "0"));
  return { r, s, recoveryId: Number(v.recovery_id) };
}

/** Attach the signature and serialise to the raw tx for eth_sendRawTransaction. */
export function assembleSignedTx(tx: VaultEvmTx, sig: MpcSignature): string {
  // Low-s normalisation (EIP-2): flip s and the recovery bit if s is in the upper half.
  let s = BigInt("0x" + bytesToHex(sig.s));
  let rec = sig.recoveryId;
  if (s > secp256k1.CURVE.n / 2n) {
    s = secp256k1.CURVE.n - s;
    rec ^= 1;
  }
  const sBytes = hexToBytes(s.toString(16).padStart(64, "0"));
  const trim = (b: Uint8Array) => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    return b.slice(i);
  };
  const signed = concat(
    Uint8Array.of(0x02),
    rlpList([
      ...txFields(tx),
      rlpUint(BigInt(rec)),
      rlpBytes(trim(sig.r)),
      rlpBytes(trim(sBytes)),
    ]),
  );
  return "0x" + bytesToHex(signed);
}

/** Recover the signer address from payload + signature: the proof the MPC key == derived. */
export function recoverAddress(payloadHex: string, sig: MpcSignature): string {
  let s = BigInt("0x" + bytesToHex(sig.s));
  let rec = sig.recoveryId;
  if (s > secp256k1.CURVE.n / 2n) {
    s = secp256k1.CURVE.n - s;
    rec ^= 1;
  }
  const r = BigInt("0x" + bytesToHex(sig.r));
  const pk = new secp256k1.Signature(r, s).addRecoveryBit(rec).recoverPublicKey(payloadHex);
  const raw = pk.toRawBytes(false);
  return "0x" + bytesToHex(keccak_256(raw.slice(1)).slice(12));
}

// ---- Sepolia JSON-RPC ----
const rpcUrl = () => process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  const j = (await res.json()) as { result?: T; error?: { message: string } };
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result as T;
}

export const sepolia = {
  balanceWei: async (addr: string) => BigInt(await rpc<string>("eth_getBalance", [addr, "latest"])),
  nonce: async (addr: string) => Number(BigInt(await rpc<string>("eth_getTransactionCount", [addr, "pending"]))),
  gasPriceWei: async () => BigInt(await rpc<string>("eth_gasPrice", [])),
  sendRaw: (raw: string) => rpc<string>("eth_sendRawTransaction", [raw]),
  receipt: (hash: string) =>
    rpc<{ status: string; blockNumber: string; gasUsed: string } | null>("eth_getTransactionReceipt", [hash]),
};
