/* ---- v6.32 Fleet & rentals: where the data lives ---------------------------------------------------------------------
   IndexedDB "attune-fleet" (photos of time sheets are big; localStorage stops at ~5 MB). Key "state" = the whole fleet
   state (fleet.js); key "att:<id>" = one attachment (a data: URL). Falls back to localStorage when IndexedDB is missing.
   Never throws: save() returns true/false. The old crane app's lesson — never fail silently — is kept by the caller,
   which shows a red message when a save returns false.                                                               */
import { heal } from "./fleet.js";

const DB = "attune-fleet", STORE = "kv", LS = "attune:fleet:";
let _db = null;
function open() {
  if (_db) return _db;
  _db = new Promise((ok) => {
    try {
      if (typeof indexedDB === "undefined") return ok(null);
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
      r.onblocked = () => ok(null);
    } catch (e) { ok(null); }
  });
  return _db;
}
// a read gives the value (undefined when the key is missing); a write gives true
const req = (db, mode, fn) => new Promise((ok) => {
  try { const t = db.transaction(STORE, mode), r = fn(t.objectStore(STORE)); t.oncomplete = () => ok(mode === "readonly" ? r.result : true); t.onerror = () => ok(undefined); t.onabort = () => ok(undefined); }
  catch (e) { ok(undefined); }
});
async function get(key) {
  const db = await open();
  if (db) return req(db, "readonly", (st) => st.get(key));
  try { const v = localStorage.getItem(LS + key); return v == null ? undefined : JSON.parse(v); } catch (e) { return undefined; }
}
async function put(key, val) {
  const db = await open();
  if (db) return (await req(db, "readwrite", (st) => st.put(val, key))) !== undefined;
  try { localStorage.setItem(LS + key, JSON.stringify(val)); return true; } catch (e) { return false; }
}
async function del(key) {
  const db = await open();
  if (db) return req(db, "readwrite", (st) => st.delete(key));
  try { localStorage.removeItem(LS + key); } catch (e) {}
  return true;
}

export async function loadFleet() { const s = await get("state"); return s ? heal(s) : null; }
export const saveFleet = (s) => put("state", s);
export const wipeFleet = () => del("state");
/** A file (photo / PDF) → its id. Full quality, no compression (Ali's choice for evidence). */
export async function saveAttachment(file) {
  const url = await new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => bad(r.error); r.readAsDataURL(file); });
  const id = "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  if (!(await put("att:" + id, { name: file.name || "", type: file.type || "", url }))) throw new Error("The phone's storage is full — the photo was not saved");
  return id;
}
export const loadAttachment = (id) => get("att:" + id);
export const dropAttachment = (id) => del("att:" + id);

/* ---- v6.44 Sync carries Fleet's photos (time sheets, receipts) — the "idb:att:<id>" keys next to "idb:fleet".
   Only the photos a live record points at, the newest first, up to ATT_BUDGET characters (a data: URL is text), so one sync
   file stays well under the 64 MB a Wi-Fi exchange takes (LocalSync.kt MAX). A photo is never changed after it is saved
   (its id is new each time), so the receiving device writes it only when it doesn't have it. Pure parts tested in
   tests/unit/v744fleetsync.test.mjs. */
export const ATT_BUDGET = 30 * 1024 * 1024;
/** Every attachment id a live record points at (its `evidence`), newest first (the id carries its time). */
export function attachmentIds(s) {
  const out = new Set();
  const walk = (v, depth) => {
    if (!v || typeof v !== "object" || depth > 4) return;
    if (Array.isArray(v)) { for (const x of v) if (!(x && x.del)) walk(x, depth + 1); return; }
    for (const [k, x] of Object.entries(v)) {
      if (k === "evidence") for (const id of [].concat(x || [])) { if (typeof id === "string" && /^a[0-9a-z]{6,}$/.test(id)) out.add(id); }
      else walk(x, depth + 1);
    }
  };
  walk(s, 0);
  const t = (id) => parseInt(id.slice(1, 9), 36) || 0;
  return [...out].sort((a, b) => t(b) - t(a));
}
/** ids → { "idb:att:<id>": text } within the budget; `load(id)` gives the stored { name, type, url }. → { keys, skipped } */
export async function pickAttachments(ids, load, budget = ATT_BUDGET) {
  const keys = {}; let used = 0, skipped = 0;
  for (const id of ids) {
    const a = await load(id); if (!a || !a.url) continue;
    const text = JSON.stringify(a);
    if (used + text.length > budget) { skipped++; continue; }
    keys["idb:att:" + id] = text; used += text.length;
  }
  return { keys, skipped };
}
/** What Sync reads and writes outside localStorage: Fleet's state and its photos. */
export const fleetSyncExtra = {
  read: async () => {
    const f = await loadFleet(); if (!f) return {};
    const { keys } = await pickAttachments(attachmentIds(f), loadAttachment);
    return { "idb:fleet": JSON.stringify(f), ...keys };
  },
  write: async (k, v) => {
    if (k === "idb:fleet") return saveFleet(JSON.parse(v));
    if (k.startsWith("idb:att:")) { const id = k.slice(8); if (/^a[0-9a-z]{6,}$/.test(id) && !(await get("att:" + id))) { try { const a = JSON.parse(v); if (a && typeof a.url === "string" && a.url.startsWith("data:")) await put("att:" + id, { name: String(a.name || ""), type: String(a.type || ""), url: a.url }); } catch (e) {} } }
  },
};
