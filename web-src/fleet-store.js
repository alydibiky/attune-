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
const req = (db, mode, fn) => new Promise((ok) => {
  try { const t = db.transaction(STORE, mode), r = fn(t.objectStore(STORE)); t.oncomplete = () => ok(r && r.result !== undefined ? r.result : true); t.onerror = () => ok(undefined); t.onabort = () => ok(undefined); }
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
