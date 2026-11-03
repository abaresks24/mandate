import { GuardianInfo } from "@/lib/types";

// Registered bonded TEE guardians (OutLayer WASM). Bonds in NEAR.
export const GUARDIANS: GuardianInfo[] = [
  {
    id: "g-01",
    account: "atlas.guardians.mandate.testnet",
    bond_near: "4200",
    wasm_sha256: "0x9f1c...a44e",
    reputation: 97,
    status: "active",
  },
  {
    id: "g-02",
    account: "borealis.guardians.mandate.testnet",
    bond_near: "3800",
    wasm_sha256: "0x9f1c...a44e",
    reputation: 95,
    status: "active",
  },
  {
    id: "g-03",
    account: "cygnus.guardians.mandate.testnet",
    bond_near: "5100",
    wasm_sha256: "0x9f1c...a44e",
    reputation: 99,
    status: "active",
  },
  {
    id: "g-04",
    account: "draco.guardians.mandate.testnet",
    bond_near: "2600",
    wasm_sha256: "0x9f1c...a44e",
    reputation: 88,
    status: "active",
  },
  {
    id: "g-05",
    account: "eridanus.guardians.mandate.testnet",
    bond_near: "3300",
    wasm_sha256: "0x9f1c...a44e",
    reputation: 91,
    status: "active",
  },
];

export const byId = (id: string) =>
  GUARDIANS.find((g) => g.id === id) ?? GUARDIANS[0];
