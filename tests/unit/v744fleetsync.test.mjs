// v6.44 Sync carries Fleet's photos: the ids live records point at (newest first), within a size budget; a full exchange.
import { attachmentIds, pickAttachments } from "../../web-src/fleet-store.js";
import { makeCode, packFor, takeIn } from "../../web-src/sync.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const id = (t) => "a" + t.toString(36) + "xy";
const old = id(1700000000000), mid = id(1750000000000), fresh = id(1790000000000), gone = id(1760000000000);
const s = { entries: [{ id: "e1", evidence: old }, { id: "e2", evidence: fresh }, { id: "e3", evidence: gone, del: 1 }, { id: "e4", evidence: "demo" }], expenses: [{ id: "x1", evidence: mid }], store: { tx: [{ id: "t1", evidence: null }] } };
const ids = attachmentIds(s);
ok(ids.join() === [fresh, mid, old].join(), "the photos live records point at, newest first; a deleted record's photo and 'demo' are left out");
const att = { [old]: { name: "o.jpg", type: "image/jpeg", url: "data:image/jpeg;base64," + "A".repeat(500) }, [mid]: { url: "data:image/png;base64," + "B".repeat(500) }, [fresh]: { url: "data:image/png;base64," + "C".repeat(500) } };
const r = await pickAttachments(ids, async (k) => att[k], 1200);
ok(Object.keys(r.keys).length === 2 && r.keys["idb:att:" + fresh] && r.keys["idb:att:" + mid] && r.skipped === 1, "within the budget: the two newest go, the oldest waits (skipped: " + r.skipped + ")");
// a full exchange through `extra`: the phone's photo reaches the computer, and is not rewritten when it is already there
class Store { constructor(o = {}) { this.m = new Map(Object.entries(o)); } get length() { return this.m.size; } key(i) { return [...this.m.keys()][i] ?? null; } getItem(k) { return this.m.has(k) ? this.m.get(k) : null; } setItem(k, v) { this.m.set(k, String(v)); } removeItem(k) { this.m.delete(k); } }
const box = (state, photos) => ({ state, photos, writes: 0 });
const ex = (b) => ({ read: async () => { if (!b.state) return {}; const { keys } = await pickAttachments(attachmentIds(b.state), async (k) => b.photos[k]); return { "idb:fleet": JSON.stringify(b.state), ...keys }; },
  write: async (k, v) => { b.writes++; if (k === "idb:fleet") b.state = JSON.parse(v); else if (k.startsWith("idb:att:") && !b.photos[k.slice(8)]) b.photos[k.slice(8)] = JSON.parse(v); } });
const phone = box({ entries: [{ id: "e2", evidence: fresh }] }, { [fresh]: att[fresh] }), pc = box(null, {});
const code = makeCode(), it = { iterations: 1000 };
await takeIn(await packFor(code, new Store(), { ...it, extra: ex(phone) }), code, new Store(), "merge", ex(pc));
ok(pc.photos[fresh] && pc.photos[fresh].url === att[fresh].url && pc.state.entries[0].evidence === fresh, "the time-sheet photo travels with its entry");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
