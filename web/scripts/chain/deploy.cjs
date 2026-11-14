// Deploy the YieldAI live stack to NEAR testnet from the deployer account:
//   coordinator.<dep>  +  live.<dep> (vault)  +  agent FC key  +  6 bonded guardians.
// Secrets: reads helper-created keys from argv[2] dir, writes web/.secrets/testnet-keys.json.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { conn, toYocto, fromYocto, genKey, nearAPI } = require("./lib.cjs");
const { KeyPair } = nearAPI;

const SCRATCH = process.argv[2];
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.resolve(__dirname, "../../.secrets/testnet-keys.json");
const WASM = (n) => fs.readFileSync(`${ROOT}/target/wasm32-unknown-unknown/release/${n}.wasm`);
const load = (n) => JSON.parse(fs.readFileSync(`${SCRATCH}/${n}.key`, "utf8"));
const T = (n) => BigInt(n) * 10n ** 12n; // Tgas
const log = (...a) => console.log(...a);

(async () => {
  const dep = load("yieldai-dep-7k3q.testnet");
  const depAcc = await conn(dep.account, dep.sk);
  const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { accounts: {} };
  out.deployer = { account: dep.account, sk: dep.sk };
  const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 2), { mode: 0o600 });

  const exists = async (id) => {
    try { await depAcc.connection.provider.query({ request_type: "view_account", finality: "final", account_id: id }); return true; }
    catch { return false; }
  };

  // ---- sub-accounts: coordinator + vault ----
  const COORD = `coordinator.${dep.account}`;
  const VAULT = `live.${dep.account}`;
  for (const [id, fund] of [[COORD, 6.6], [VAULT, 6.6]]) {
    if (!(await exists(id))) {
      const k = genKey();
      await depAcc.createAccount(id, k.pk, BigInt(toYocto(fund)));
      out.accounts[id] = k; save();
      log("created", id, fund, "NEAR");
    }
  }

  // ---- agent function-call key: restricted to the vault, no deposit allowed ----
  if (!out.agent) {
    out.agent = genKey(); save();
    await depAcc.addKey(out.agent.pk, VAULT, [
      "propose_action", "request_committee", "execute_action", "emergency_exit", "set_evm_params",
    ], BigInt(toYocto(1)));
    log("agent FC key added", out.agent.pk);
  }

  // ---- deploy coordinator ----
  const coordAcc = await conn(COORD, out.accounts[COORD].sk);
  const coordState = await coordAcc.state();
  if (coordState.code_hash === "11111111111111111111111111111111") {
    await coordAcc.deployContract(WASM("coordinator"));
    await coordAcc.functionCall({ contractId: COORD, methodName: "new", args: { owner: dep.account }, gas: T(50) });
    log("coordinator deployed + initialised");
  }

  // ---- deploy vault ----
  const vaultAcc = await conn(VAULT, out.accounts[VAULT].sk);
  const vaultState = await vaultAcc.state();
  if (vaultState.code_hash === "11111111111111111111111111111111") {
    await vaultAcc.deployContract(WASM("vault"));
    const mandate = {
      owner: dep.account, target_apy_bps: 800, max_risk_score: 60,
      allowed_protocols: ["rhea", "morpho-sepolia"], allowed_chains: ["near", "ethereum-sepolia"],
      max_share_per_protocol_bps: 7000, max_loss_bps: 300,
      daily_cap_usdc: "5000000000", committee_threshold_usdc: "0",
    };
    await vaultAcc.functionCall({
      contractId: VAULT, methodName: "new",
      args: { owner: dep.account, mandate, coordinator: COORD, agent_fc_key: out.agent.pk }, gas: T(50),
    });
    log("vault deployed + initialised");
  }

  // ---- guardians: g1..g4 (helper-funded) + two more created by the deployer ----
  const GUARDS = [1, 2, 3, 4].map((i) => `yieldai-g${i}-7k3q.testnet`);
  for (const id of GUARDS) out.accounts[id] = { sk: load(id).sk, pk: load(id).pk };
  for (const i of [5, 6]) {
    const id = `yieldai-g${i}-7k3q.testnet`;
    if (!(await exists(id))) {
      const k = genKey();
      // top-level testnet names can only be created via the helper; sub-account instead
      const sub = `g${i}.${dep.account}`;
      if (!(await exists(sub))) { await depAcc.createAccount(sub, k.pk, BigInt(toYocto(3.5))); out.accounts[sub] = k; save(); log("created", sub); }
      GUARDS.push(sub);
    } else GUARDS.push(id);
  }
  save();

  const WASM_URL = "https://raw.githubusercontent.com/abaresks24/yieldai/main/res/guardian.wasm";
  const WASM_SHA = "1cae595d0eb333dde74740d4ddadf72074d2f3e6ac73211b17d61dc884c72109";
  const registered = {};
  for (let g = 1; g <= 10; g++) {
    const r = await depAcc.viewFunction({ contractId: COORD, methodName: "view_guardian", args: { guardian_id: `g${g}` } }).catch(() => null);
    if (!r) break;
    registered[r.account] = r.id;
  }
  for (const id of GUARDS) {
    if (registered[id]) { log("guardian already registered", id, registered[id]); continue; }
    const acc = await conn(id, out.accounts[id].sk);
    const res = await acc.functionCall({
      contractId: COORD, methodName: "register_guardian",
      args: { wasm_url: WASM_URL, wasm_sha256: WASM_SHA }, gas: T(30), attachedDeposit: BigInt(toYocto(2)),
    });
    log("registered", id, "bond 2 NEAR", res.transaction.hash);
  }
  out.coordinator = COORD; out.vault = VAULT; out.guardianAccounts = GUARDS; save();
  log("deployer balance", fromYocto((await depAcc.getAccountBalance()).total));
})().catch((e) => { console.error("FAIL:", e.message || e); process.exit(1); });
