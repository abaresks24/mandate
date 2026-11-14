// Shared NEAR testnet helpers for the live Launch flow (near-api-js v5, classic API).
const nearAPI = require("near-api-js");
const { connect, keyStores, KeyPair, utils } = nearAPI;
const RPC = process.env.NEAR_RPC || "https://test.rpc.fastnear.com";

async function conn(accountId, secretKey) {
  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey("testnet", accountId, KeyPair.fromString(secretKey));
  const near = await connect({ networkId: "testnet", nodeUrl: RPC, keyStore });
  return near.account(accountId);
}
const toYocto = (n) => utils.format.parseNearAmount(String(n));
const fromYocto = (y) => utils.format.formatNearAmount(y, 4);
module.exports = { conn, toYocto, fromYocto, nearAPI, RPC };

// Fresh ed25519 keypair as {pk, sk} strings.
function genKey() {
  const kp = KeyPair.fromRandom("ed25519");
  return { pk: kp.getPublicKey().toString(), sk: kp.toString() };
}
module.exports.genKey = genKey;
