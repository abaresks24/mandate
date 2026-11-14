const fs = require("fs");
const { conn, toYocto, fromYocto } = require("./lib.cjs");
const dir = process.argv[2];
const load = (n) => JSON.parse(fs.readFileSync(`${dir}/${n}.key`, "utf8"));
(async () => {
  const dep = load("yieldai-dep-7k3q.testnet");
  for (const i of [1, 2, 3, 4]) {
    const g = load(`yieldai-g${i}-7k3q.testnet`);
    const acc = await conn(g.account, g.sk);
    const r = await acc.sendMoney(dep.account, BigInt(toYocto(5)));
    console.log(g.account, "->", dep.account, "5 NEAR", r.transaction.hash);
  }
  const a = await conn(dep.account, dep.sk);
  console.log("dep balance", fromYocto((await a.getAccountBalance()).total));
})().catch((e) => { console.error(e.message); process.exit(1); });
