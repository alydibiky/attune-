// v6.44 Sync: deletes travel (tombstones) — a Money entry deleted on the phone is deleted on the computer at the next sync;
// an edit made after the delete wins; wipes, emptied lists and mass removals never travel (fail-safe).
import { makeCode, packFor, takeIn, noteGone, dropGone, idLists, GONE_KEY, SEEN_KEY } from "../../web-src/sync.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
class Store { constructor(o = {}) { this.m = new Map(Object.entries(o)); } get length() { return this.m.size; } key(i) { return [...this.m.keys()][i] ?? null; } getItem(k) { return this.m.has(k) ? this.m.get(k) : null; } setItem(k, v) { this.m.set(k, String(v)); } removeItem(k) { this.m.delete(k); } }
const code = makeCode(), it = { iterations: 1000 };
const L = (txns) => JSON.stringify({ currency: "EGP", txns });
const sync = async (a, b) => { await takeIn(await packFor(code, a, it), code, b); await takeIn(await packFor(code, b, it), code, a); };
const ids = (st, k = "ledger.v3") => JSON.parse(st.getItem(k)).txns.map((x) => x.id).join();
// two devices that synced once
const phone = new Store({ "ledger.v3": L([{ id: "t1", amount: 85 }, { id: "t2", amount: 40 }, { id: "t3", amount: 600 }]), "attune:chats:v1": JSON.stringify([{ id: "c1", messages: [{ id: "m1" }, { id: "m2" }] }, { id: "c2", messages: [] }]) });
const pc = new Store({});
await sync(phone, pc);
ok(ids(pc) === "t1,t2,t3" && phone.getItem(SEEN_KEY) && pc.getItem(SEEN_KEY), "first sync: both have everything, each remembers the ids it saw");
// the phone deletes t2 and the chat c2; the computer adds t4
phone.setItem("ledger.v3", L([{ id: "t1", amount: 85 }, { id: "t3", amount: 600 }]));
phone.setItem("attune:chats:v1", JSON.stringify([{ id: "c1", messages: [{ id: "m1" }, { id: "m2" }] }]));
pc.setItem("ledger.v3", L([...JSON.parse(pc.getItem("ledger.v3")).txns, { id: "t4", amount: 7 }]));
await sync(phone, pc);
ok(ids(pc) === "t1,t3,t4" && ids(phone) === "t1,t3,t4", "a delete on the phone travels to the computer; the computer's new entry still comes over: " + ids(pc));
ok(JSON.parse(pc.getItem("attune:chats:v1")).length === 1, "a deleted chat is deleted on the other device too");
ok(JSON.parse(pc.getItem(GONE_KEY))["ledger.v3|txns|t2"] > 0, "the tombstone travels with the data");
// a delete inside an item (one message of a chat)
pc.setItem("attune:chats:v1", JSON.stringify([{ id: "c1", messages: [{ id: "m1" }] }]));
await sync(phone, pc);
ok(JSON.parse(phone.getItem("attune:chats:v1"))[0].messages.length === 1, "a list inside an item: one deleted message travels");
// deleted on one, edited later on the other → the edit wins
const g = { "ledger.v3|txns|t9": 1000 };
ok(dropGone({ txns: [{ id: "t9", ts: 2000 }, { id: "t8" }] }, "ledger.v3", g).txns.length === 2 && dropGone({ txns: [{ id: "t9", ts: 500 }] }, "ledger.v3", g).txns.length === 0, "an item edited after the delete stays; an older copy goes");
// fail-safe: a wipe, an emptied list, a mass removal → nothing tombstoned
const seen = { "ledger.v3": idLists({ txns: Array.from({ length: 30 }, (_, i) => ({ id: "x" + i })) }) };
ok(Object.keys(noteGone(seen, {})).length === 0, "the whole store gone (a wipe or reset) — no deletes travel");
ok(Object.keys(noteGone(seen, { "ledger.v3": L([]) })).length === 0, "a list emptied at once — no deletes travel");
ok(Object.keys(noteGone(seen, { "ledger.v3": L([{ id: "x0" }, { id: "x1" }]) })).length === 0, "28 of 30 gone at once (an old backup restored) — no deletes travel");
ok(Object.keys(noteGone(seen, { "ledger.v3": L(Array.from({ length: 29 }, (_, i) => ({ id: "x" + i }))) })).length === 1, "one of 30 deleted — that one travels");
const old = noteGone({}, {}, { "a|b|c": Date.now() - 200 * 86400e3, "a|b|d": Date.now() });
ok(!old["a|b|c"] && old["a|b|d"], "tombstones older than 120 days are dropped");
// Fleet's IndexedDB state: a deleted crane travels too
const fA = { s: JSON.stringify({ cranes: [{ id: "c1" }, { id: "c2" }] }) }, fB = { s: "" };
const ex = (box) => ({ read: async () => (box.s ? { "idb:fleet": box.s } : {}), write: async (k, v) => { box.s = v; } });
const a3 = new Store({}), b3 = new Store({});
const sx = async () => { await takeIn(await packFor(code, a3, { ...it, extra: ex(fA) }), code, b3, "merge", ex(fB)); await takeIn(await packFor(code, b3, { ...it, extra: ex(fB) }), code, a3, "merge", ex(fA)); };
await sx();
ok(JSON.parse(fB.s).cranes.length === 2, "Fleet: first sync copies the cranes");
fA.s = JSON.stringify({ cranes: [{ id: "c1" }] });
await sx();
ok(JSON.parse(fB.s).cranes.length === 1 && JSON.parse(fA.s).cranes.length === 1, "Fleet: a crane removed on one device is removed on the other");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
