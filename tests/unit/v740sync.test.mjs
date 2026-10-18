// v6.37 Sync: the code, the deep merge (nothing lost, newer copy wins), and a full exchange between two devices.
import { makeCode, showCode, cleanCode, codeOk, mergeValue, syncMerge, packFor, takeIn, passphraseProblem } from "../../web-src/sync.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
class Store { constructor(o = {}) { this.m = new Map(Object.entries(o)); } get length() { return this.m.size; } key(i) { return [...this.m.keys()][i] ?? null; } getItem(k) { return this.m.has(k) ? this.m.get(k) : null; } setItem(k, v) { this.m.set(k, String(v)); } removeItem(k) { this.m.delete(k); } }
const c = makeCode();
ok(c.length === 8 && codeOk(c) && showCode(c).length === 9, "an 8-character code, shown in two groups (" + showCode(c) + ")");
ok(cleanCode("k7q2 9xfd") === "K7Q29XFD" && codeOk("K7Q2-9XFD") && !codeOk("K7Q2"), "typed codes are cleaned; short ones refused");
// deep merge
const A = { accounts: [{ id: "a", name: "CIB" }], txns: [{ id: "t1", amount: 100, ts: 1 }, { id: "t2", amount: 50, ts: 5 }], lang: "ar" };
const B = { accounts: [{ id: "a", name: "CIB" }, { id: "b", name: "Cash" }], txns: [{ id: "t1", amount: 120, ts: 9 }, { id: "t3", amount: 7, ts: 2 }], lang: "en" };
const M = mergeValue(A, B);
ok(M.accounts.length === 2 && M.txns.length === 3, "lists with ids are joined: nothing is lost");
ok(M.txns.find((x) => x.id === "t1").amount === 120, "the newer copy of the same item wins (edited on the other device later)");
ok(M.lang === "ar", "a plain setting keeps this device's value");
ok(JSON.stringify(mergeValue([1, 2], [3])) === "[1,2]", "plain lists are not mixed");
const K = syncMerge({ "ledger.v3": JSON.stringify(A), "attune:theme": "dark" }, { "ledger.v3": JSON.stringify(B), "attune:fit:v1": "{\"weights\":[]}", "attune:sync:v1": "{\"pass\":\"x\"}" });
ok(JSON.parse(K["ledger.v3"]).txns.length === 3 && K["attune:fit:v1"] && !K["attune:sync:v1"], "whole stores merge; what this device lacks is added; sync settings never travel");
ok(passphraseProblem("short") && !passphraseProblem("my crane yard 2026"), "the Drive passphrase must be long");
// a full exchange: phone (host) and computer (client)
const phone = new Store({ "ledger.v3": JSON.stringify(A), "attune:missions:v1": JSON.stringify({ items: [{ id: "m1", title: "save" }] }), "attune:sync:v1": "{\"device\":\"phone\"}" });
const pc = new Store({ "ledger.v3": JSON.stringify(B), "attune:life:v1": JSON.stringify({ items: [{ id: "l1" }] }) });
const code = makeCode(), it = { iterations: 1000 };
const fromPc = await packFor(code, pc, it);
let wrong = ""; try { await takeIn(fromPc, "AAAAAAAA", phone); } catch (e) { wrong = e.message; }
ok(/Wrong code/.test(wrong) && JSON.parse(phone.getItem("ledger.v3")).txns.length === 2, "a wrong code changes nothing");
const r1 = await takeIn(fromPc, code, phone);
const reply = await packFor(code, phone, it);
await takeIn(reply, code, pc);
const pl = JSON.parse(phone.getItem("ledger.v3")), cl = JSON.parse(pc.getItem("ledger.v3"));
ok(r1.added >= 1 && pl.txns.length === 3 && cl.txns.length === 3 && phone.getItem("attune:life:v1") && pc.getItem("attune:missions:v1"), "after one exchange both devices have everything");
ok(phone.getItem("attune:sync:v1") === "{\"device\":\"phone\"}" && pc.getItem("attune:sync:v1") === null, "each device keeps its own sync settings");
// replace: the computer becomes exactly like the phone
pc.setItem("attune:extra", "{\"a\":1}");
await takeIn(await packFor(code, phone, it), code, pc, "replace");
ok(pc.getItem("attune:extra") === null && pc.getItem("ledger.v3") === phone.getItem("ledger.v3"), "Replace makes the other device the same (deletes travel this way)");
// Fleet's IndexedDB state travels too (through `extra`), merged by job id
const fleetA = { s: JSON.stringify({ jobs: [{ id: "j1", no: "JO-001" }] }) }, fleetB = { s: JSON.stringify({ jobs: [{ id: "j2", no: "JO-002" }] }) };
const ex = (box) => ({ read: async () => ({ "idb:fleet": box.s }), write: async (k, v) => { box.s = v; } });
const p2 = new Store({}), q2 = new Store({});
await takeIn(await packFor(code, q2, { ...it, extra: ex(fleetB) }), code, p2, "merge", ex(fleetA));
ok(JSON.parse(fleetA.s).jobs.length === 2 && !p2.getItem("idb:fleet"), "Fleet's jobs (IndexedDB) are merged and written back to Fleet, not to localStorage");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
