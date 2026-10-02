/* ---- v6.10: where the books live ------------------------------------------------------------------
   IndexedDB (hundreds of MB; localStorage stops at ~5 MB, which a busy shop passes in a few thousand documents).
   One record per collection (customers, items, docs, journal…) so a save only rewrites what changed.
   If IndexedDB is unavailable the same API falls back to localStorage. Never throws: save() returns true/false. */
import { EMPTY } from "./books-ops.js";

const DB = "attune-books", STORE = "kv", LS = "attune:books:";
let _db = null;
const last = {};      // the last JSON written per collection, so unchanged collections are skipped

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
const idb = (db, mode, fn) => new Promise((ok, bad) => { try { const t = db.transaction(STORE, mode); const out = fn(t.objectStore(STORE)); t.oncomplete = () => ok(out && out.result !== undefined ? out.result : undefined); t.onerror = () => bad(t.error); t.onabort = () => bad(t.error); } catch (e) { bad(e); } });

async function getAll(db) {
  const out = {};
  if (db) {
    await new Promise((ok) => {
      const t = db.transaction(STORE, "readonly"), st = t.objectStore(STORE), q = st.openCursor();
      q.onsuccess = () => { const c = q.result; if (c) { out[c.key] = c.value; c.continue(); } };
      t.oncomplete = ok; t.onerror = ok; t.onabort = ok;
    });
  } else {
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(LS)) out[k.slice(LS.length)] = JSON.parse(localStorage.getItem(k)); } } catch (e) {}
  }
  return out;
}

/** Load the books (a fresh empty set the first time). Collections added by newer versions are filled from EMPTY(). */
export async function loadBooks() {
  const db = await open();
  const all = await getAll(db);
  const base = EMPTY();
  const s = { ...base };
  for (const k of Object.keys(base)) if (all[k] !== undefined) s[k] = all[k];
  for (const k of Object.keys(s)) last[k] = JSON.stringify(s[k]);
  return s;
}
/** Write only what changed. */
export async function saveBooks(state) {
  try {
    const db = await open();
    const writes = [];
    for (const k of Object.keys(state)) {
      const js = JSON.stringify(state[k]);
      if (last[k] === js) continue;
      writes.push([k, state[k], js]);
    }
    if (!writes.length) return true;
    if (db) await idb(db, "readwrite", (st) => { for (const [k, v] of writes) st.put(v, k); });
    else for (const [k, , js] of writes) localStorage.setItem(LS + k, js);
    for (const [k, , js] of writes) last[k] = js;
    return true;
  } catch (e) { return false; }
}
/** Everything as one JSON text (a backup the owner can keep anywhere). */
export const exportBooks = (state) => JSON.stringify({ app: "attune-books", version: 1, exportedAt: new Date().toISOString(), state });
/** Read a backup; returns the state or throws a clear error. */
export function parseBackup(text) {
  let j; try { j = JSON.parse(text); } catch (e) { throw new Error("That file is not a books backup"); }
  if (!j || j.app !== "attune-books" || !j.state || typeof j.state !== "object") throw new Error("That file is not a books backup");
  const base = EMPTY(), s = { ...base };
  for (const k of Object.keys(base)) if (j.state[k] !== undefined) s[k] = j.state[k];
  return s;
}
/** Replace everything with a restored state (used by Restore). */
export async function replaceBooks(state) {
  try {
    const db = await open();
    if (db) await idb(db, "readwrite", (st) => { st.clear(); });
    else Object.keys(last).forEach((k) => { try { localStorage.removeItem(LS + k); } catch (e) {} });
    for (const k of Object.keys(last)) delete last[k];
    return saveBooks(state);
  } catch (e) { return false; }
}
