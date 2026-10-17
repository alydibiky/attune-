// v6.32: the account-backed parts, ready for Ali's ids — Drive sync (encrypted backup → merge → back), Family circle lists,
// paid web search for Pro. Off (and invisible) until CLOUD is filled in.
import * as C from "../../web-src/cloud.js";
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
class Store { constructor(o = {}) { this.m = new Map(Object.entries(o)); } get length() { return this.m.size; } key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; } setItem(k, v) { this.m.set(k, String(v)); } removeItem(k) { this.m.delete(k); } }

ok(!C.syncReady() && !C.proSearchReady(), "off until Ali's ids are filled in");
ok(C.syncReady({ googleWebClientId: "123-abc.apps.googleusercontent.com" }) && C.proSearchReady({ proSearchUrl: "https://attune-search.x.workers.dev" }), "on with real-looking ids");
ok(C.syncStep({}, null) === "push" && C.syncStep({}, { created: "2026-10-17" }) === "merge", "nothing on Drive → push; first sync → merge");
ok(C.syncStep({ remoteStamp: "2026-10-17T10:00" }, { created: "2026-10-17T11:00" }) === "merge" && C.syncStep({ remoteStamp: "2026-10-17T11:00" }, { created: "2026-10-17T11:00" }) === "push", "another phone wrote since → merge, else push");
const sk = C.syncKeys({ "attune:chats:v1": "[]", "attune:sync:v1": "{}", "attune:vault:v1": "x", "ledger.v3": "{}" });
ok(Object.keys(sk).join(",") === "attune:chats:v1,ledger.v3", "the sync state and the PIN vault never travel");

// two phones, one Drive
let drive = null;
const call = async (name, a) => { if (name !== "driveSync") throw new Error("?"); if (a.op === "get") return { text: drive }; drive = a.text; return { ok: true }; };
let threw = ""; try { await C.syncNow({ call, password: "pw", storage: new Store() }); } catch (e) { threw = e.message; }
ok(/not set up/.test(threw), "sync refuses until set up");
C.CLOUD.googleWebClientId = "123-abc.apps.googleusercontent.com";
const A = new Store({ "attune:chats:v1": JSON.stringify([{ id: "a1", title: "from A", updated: 1 }]) });
const B = new Store({ "attune:chats:v1": JSON.stringify([{ id: "b1", title: "from B", updated: 2 }]) });
const r1 = await C.syncNow({ call, password: "correct horse", storage: A });
ok(r1.step === "push" && drive && !drive.includes("from A"), "phone A pushes; Drive holds only locked bytes");
const r2 = await C.syncNow({ call, password: "correct horse", storage: B });
ok(r2.step === "merge" && JSON.parse(B.getItem("attune:chats:v1")).length === 2, "phone B merges A's chats with its own");
const r3 = await C.syncNow({ call, password: "correct horse", storage: A });
ok(r3.step === "merge" && JSON.parse(A.getItem("attune:chats:v1")).map((x) => x.id).sort().join() === "a1,b1", "phone A gets B's chat back");
const r4 = await C.syncNow({ call, password: "correct horse", storage: A });
ok(r4.step === "push", "nothing new on Drive → just push");
let wrong = ""; try { await C.syncNow({ call, password: "nope", storage: new Store({ x: "1" }) }); } catch (e) { wrong = e.message; }
ok(/Wrong password/.test(wrong), "a wrong password stops before anything changes");

// Family circle lists
const base = [{ id: "1", text: "Milk", at: 1, created: 1 }, { id: "2", text: "Bread", at: 1, created: 2 }];
const mom = [C.edit(base[0], { done: true }, "Mom", 10), base[1]];
const me = [base[0], C.edit(base[1], { deleted: true }, "Ali", 12), { id: "3", text: "Eggs", at: 11, created: 11 }];
const m = C.mergeList(mom, me);
ok(m.length === 3 && m.find((x) => x.id === "1").done && m.find((x) => x.id === "2").deleted, "both phones' offline changes are kept");
ok(C.visible(m).map((x) => x.text).join() === "Milk,Eggs", "deleted items are hidden, order kept");
ok(C.edit({ at: 50 }, {}, "x", 10).at === 51, "an edit is always newer than what it changes");

// Pro search
C.setProSearch(true);
ok(!C.proSearchOn(), "Pro search waits for the relay address");
C.CLOUD.proSearchUrl = "https://attune-search.x.workers.dev/";
const seen = [];
const fetchFn = async (u, o) => { seen.push([u, JSON.parse(o.body)]); return { ok: true, status: 200, json: async () => ({ hits: [{ title: "T", url: "https://a.com", text: "x".repeat(5000) }, { title: "no url" }] }) }; };
const pr = await C.proLookup("سعر جالكسي", { fetchFn });
ok(seen[0][0] === "https://attune-search.x.workers.dev/search" && seen[0][1].q === "سعر جالكسي", "asks the relay");
ok(pr.via === "pro" && pr.hits.length === 1 && pr.hits[0].text.length === 4000, "hits in the free search's shape");
const lim = await C.proLookup("x", { fetchFn: async () => ({ ok: false, status: 429 }) });
ok(!lim.hits.length && /used up/.test(lim.why), "the daily cap is said plainly");
C.setProSearch(false);
ok((await C.proLookup("x", { fetchFn })).via === "none", "Free phones never use it");

if (fails) { console.log(fails + " FAILED"); process.exit(1); }
console.log("ALL PASSED");
