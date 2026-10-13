// v6.27: the phone Home's TODAY list (design A "Calm") — what is due, from People & plans and Money's bills, by code.
import { loadJsx } from "./jsxload.mjs";
const H = await loadJsx("web-src/home.js");
const L = await loadJsx("web-src/life.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const now = new Date("2026-10-13T12:00:00").getTime();
let life = L.addCommitment({ v: 1, items: [] }, { ...L.parseLife("Ahmed owes me 12,000, 1,000 a month starting October", { now }), start: "2026-10-01" }, now);
life = L.addCommitment(life, L.parseLife("فاتورة الكهربا ٦٤٠ يوم الخميس", { now }), now);
life = L.addCommitment(life, L.parseLife("Netflix 200 every month", { now }), now);
const ledger = { currency: "EGP", accounts: [{ id: "c", currency: "EGP", start: 0 }], txns: [],
  recurring: [{ id: "r", type: "expense", amount: 450, account: "c", freq: "monthly", nextDate: "2026-10-14", note: "Internet", active: true }] };
const t = H.todayList({ life, ledger, now, max: 4 });
ok(t[0].late && /Ahmed · installment 1 of 12/.test(t[0].title) && t[0].dir === "in", "the late one first: Ahmed's October installment — " + t[0].title);
ok(t.map((x) => x.title).join("|").includes("Internet") && t.some((x) => /الكهربا|كهربا/i.test(x.title)), "Money's bill and People & plans' bill both listed: " + t.map((x) => x.title).join(" | "));
ok(t.length <= 4, "at most 4 lines on Home");
ok(H.todayList({ life: { items: [] }, ledger: null, now }).length === 0, "nothing due → an empty list (Home shows a hint instead)");
console.log(fail ? fail + " FAILED" : "v727home ok");
process.exit(fail ? 1 : 0);
