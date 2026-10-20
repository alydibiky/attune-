/* ---- v6.37 Sync (Ali: "in the syncing part I want the two options: either cloud using Google or using Wi-Fi").
   The same encrypted file as Backup (backup.js: PBKDF2 600,000 rounds → AES-256-GCM), carried two ways:
     • Wi-Fi: one device hosts and shows a code + its address; the other sends its file; each merges the other's.
       Nothing leaves your home network, nothing is stored anywhere else.
     • Google: your OWN Google Drive, in the hidden app folder only Attune can see (scope drive.appdata). The file is locked
       with your sync passphrase BEFORE it leaves the phone, so Google sees only noise.
   Merging (syncMerge) never loses anything: every list of items with an id (Money entries, accounts, bills, debts,
   People & plans, the Radar, missions, chats, Mind…) is joined item by item — the newer copy of the same item wins — and
   anything else keeps this device's value unless this device has none. v6.44: deletes travel too (tombstones, below);
   "Replace the other device" still makes the other device exactly like this one.
   Pure where it can be (tests/unit/v740sync.test.mjs); the native side only carries text (LocalSync.kt, GoogleDrive.kt,
   desktop/main.js).                                                                                                    */
import { collectData, encryptBackup, decryptBackup, restoreData } from "./backup.js";

export const SYNC_KEY = "attune:sync:me:v1";       // { pass (Drive passphrase, this device only), last, lastHow } (cloud.js keeps attune:sync:v1)
const ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";    // no 0/O, 1/I: easy to read out loud

/** A one-time pairing code: 8 characters (40 bits), shown as "K7Q2 9XFD". */
export function makeCode(rand = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const b = rand(8);
  return Array.from(b, (x) => ALPHA[x & 31]).join("");
}
export const showCode = (c) => String(c || "").replace(/(.{4})(?=.)/, "$1 ");
export const cleanCode = (c) => String(c || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
export const codeOk = (c) => cleanCode(c).length === 8 && [...cleanCode(c)].every((ch) => ALPHA.includes(ch));

const parse = (t) => { try { return JSON.parse(t); } catch (e) { return undefined; } };
const when = (x) => Number((x && (x.updated || x.edited || x.ts || x.at || x.created)) || 0) || (typeof (x && x.created) === "string" ? Date.parse(x.created) || 0 : 0);
const hasIds = (a) => Array.isArray(a) && a.length > 0 && a.every((x) => x && typeof x === "object" && (typeof x.id === "string" || typeof x.id === "number"));

/** Two values of the same thing → one. Lists of items with ids are joined; objects are merged key by key; else `mine`. */
export function mergeValue(mine, theirs) {
  if (mine === undefined || mine === null) return theirs;
  if (theirs === undefined || theirs === null) return mine;
  if (Array.isArray(mine) && Array.isArray(theirs)) {
    if (!(hasIds(mine) || hasIds(theirs)) || !mine.concat(theirs).every((x) => x && typeof x === "object" && x.id != null)) return mine.length ? mine : theirs;
    const byId = new Map(mine.map((x) => [String(x.id), x]));
    const order = mine.map((x) => String(x.id));
    for (const t of theirs) {
      const k = String(t.id), m = byId.get(k);
      if (!m) { byId.set(k, t); order.push(k); }
      else byId.set(k, when(t) > when(m) ? mergeValue(t, m) : mergeValue(m, t));   // the newer copy wins, gaps filled from the other
    }
    return order.map((k) => byId.get(k));
  }
  if (typeof mine === "object" && typeof theirs === "object" && !Array.isArray(mine) && !Array.isArray(theirs)) {
    const out = { ...theirs, ...mine };
    for (const k of Object.keys(mine)) if (k in theirs) out[k] = mergeValue(mine[k], theirs[k]);
    return out;
  }
  return mine;
}

/** This device's keys + the other's → the merged keys (each value parsed as JSON when it is JSON). */
export function syncMerge(mine, theirs) {
  const out = { ...mine };
  for (const [k, v] of Object.entries(theirs || {})) {
    if (k.startsWith("attune:sync:")) continue;                 // the pairing and passphrase stay on each device
    if (!(k in mine) || mine[k] == null) { out[k] = v; continue; }
    const a = parse(mine[k]), b = parse(v);
    if (a === undefined || b === undefined || typeof a !== "object" || typeof b !== "object") continue;   // a plain value: this device's
    out[k] = JSON.stringify(mergeValue(a, b));
  }
  return out;
}

/* ---- v6.44 deletes that travel (tombstones). No delete button anywhere has to change: each device keeps the ids it had
   after its last sync (SEEN_KEY, this device only); at the next sync an id that was there and is gone now was deleted
   here → a tombstone "store|path|id" → when (GONE_KEY, travels with the data). Merging drops an item that has a tombstone
   unless the item was edited after it (then the edit wins). Fail-safe — a delete that doesn't travel is the old behaviour,
   a wrong delete is lost data — so nothing is tombstoned when a whole store is missing (a wipe, a reset), when a list was
   emptied (more than 3 items), or when most of a long list vanished at once (a restore of an old backup): there "Replace" stays the way. */
export const GONE_KEY = "attune:gone:v1";
export const SEEN_KEY = "attune:sync:seen:v1";
const GONE_DAYS = 120, GONE_MAX = 5000;
const tomb = (k, path, id) => k + "|" + path + "|" + id;
/** Every list of items with ids inside a value → { path: [ids] } ("" = the value itself, "txns", "c3/messages"…). */
export function idLists(v, path = "", out = {}, depth = 0) {
  if (depth > 4 || !v || typeof v !== "object") return out;
  if (Array.isArray(v)) {
    if (hasIds(v)) { out[path] = v.map((x) => String(x.id)); for (const x of v) idLists(x, (path ? path + "/" : "") + x.id, out, depth + 1); }
    return out;
  }
  for (const [k, x] of Object.entries(v)) idLists(x, path ? path + "/" + k : k, out, depth + 1);
  return out;
}
const synced = (k) => !k.startsWith("attune:sync:") && k !== GONE_KEY;
/** The ids of every store now (what SEEN_KEY keeps after a sync). */
export function seenOf(keys) {
  const out = {};
  for (const [k, v] of Object.entries(keys || {})) { if (!synced(k)) continue; const p = parse(v); if (p && typeof p === "object") { const l = idLists(p); if (Object.keys(l).length) out[k] = l; } }
  return out;
}
/** seen (after the last sync) vs keys (now) → the tombstones, old ones kept, the new ones dated `now`. */
export function noteGone(seen, keys, gone = {}, now = Date.now()) {
  const out = { ...(gone || {}) };
  for (const [k, lists] of Object.entries(seen || {})) {
    if (!(k in keys) || keys[k] == null) continue;                      // a whole store gone: a wipe or a reset, not a delete
    const p = parse(keys[k]); if (!p || typeof p !== "object") continue;
    const cur = idLists(p);
    for (const [path, ids] of Object.entries(lists)) {
      if (!(path in cur)) continue;                                      // the list itself is gone (its parent deleted, or emptied)
      const have = new Set(cur[path]), lost = ids.filter((id) => !have.has(id));
      if (!lost.length || (lost.length === ids.length && ids.length > 3) || (ids.length > 20 && lost.length > ids.length * 0.8)) continue;
      for (const id of lost) { const t = tomb(k, path, id); if (!out[t]) out[t] = now; }
    }
  }
  // old tombstones go (every device has long synced by then), and at most GONE_MAX are kept, the newest
  const keep = Object.entries(out).filter(([, t]) => t > now - GONE_DAYS * 86400e3).sort((a, b) => b[1] - a[1]).slice(0, GONE_MAX);
  return Object.fromEntries(keep);
}
/** A value with every tombstoned item taken out (unless it was edited after the delete). */
export function dropGone(v, k, gone, path = "", depth = 0) {
  if (depth > 4 || !v || typeof v !== "object") return v;
  if (Array.isArray(v)) {
    if (!hasIds(v)) return v;
    return v.filter((x) => { const t = gone[tomb(k, path, String(x.id))]; return !t || when(x) > t; })
      .map((x) => dropGone(x, k, gone, (path ? path + "/" : "") + x.id, depth + 1));
  }
  const out = {};
  for (const [key, x] of Object.entries(v)) out[key] = dropGone(x, k, gone, path ? path + "/" + key : key, depth + 1);
  return out;
}
const goneOf = (keys) => { const g = parse(keys && keys[GONE_KEY]); return g && typeof g === "object" && !Array.isArray(g) ? g : {}; };
const mergeGone = (a, b) => { const o = { ...a }; for (const [t, w] of Object.entries(b || {})) if (!(o[t] >= w)) o[t] = w; return o; };
/** Every store of `keys` with the tombstones applied → only the keys that changed. */
function applyGone(keys, gone) {
  const out = {};
  if (!Object.keys(gone).length) return out;
  for (const [k, v] of Object.entries(keys)) {
    if (!synced(k)) continue;
    const p = parse(v); if (!p || typeof p !== "object") continue;
    const d = JSON.stringify(dropGone(p, k, gone));
    if (d !== JSON.stringify(p)) out[k] = d;
  }
  return out;
}

const parseSeen = (s) => { try { return JSON.parse(s.getItem(SEEN_KEY) || "null") || {}; } catch (e) { return {}; } };
const deviceKeys = (s) => { const k = collectData(s); for (const x of Object.keys(k)) if (x.startsWith("attune:sync:")) delete k[x]; return k; };
const ITER = 600000;
/** What this device sends: all its data, locked with the code or passphrase. `opts.extra` = stores that are not in
    localStorage (Fleet's IndexedDB state): { read: async () => ({ key: text }), write: async (key, text) => {} }. */
export async function packFor(secret, s = localStorage, opts = {}) {
  const keys = deviceKeys(s);
  if (opts.extra) Object.assign(keys, await opts.extra.read());
  // the deletes made here since the last sync go with the file
  const gone = noteGone(parseSeen(s), keys, goneOf(keys), opts.now || Date.now());
  if (Object.keys(gone).length) { keys[GONE_KEY] = JSON.stringify(gone); try { s.setItem(GONE_KEY, keys[GONE_KEY]); } catch (e) {} }
  return encryptBackup(keys, secret, { iterations: opts.iterations || ITER, app: "sync" });
}

/** The other device's file → merged into this device (mode "merge"), or this device made the same as it ("replace").
    → { added, changed } counts. Throws "Wrong code…" when it can't be opened. */
export async function takeIn(text, secret, s = localStorage, mode = "merge", extra = null) {
  let theirs;
  try { theirs = await decryptBackup(text, secret); } catch (e) { throw new Error(/Wrong password/.test(String(e && e.message)) ? "Wrong code or passphrase — nothing was changed." : String((e && e.message) || e)); }
  // v6.44 tombstones: this device's own deletes since its last sync, joined with the other device's
  const mineX = extra ? await extra.read() : {};
  const mine = deviceKeys(s), now = Date.now();
  const gone = mode === "replace" ? goneOf(theirs) : mergeGone(noteGone(parseSeen(s), { ...mine, ...mineX }, goneOf(mine), now), goneOf(theirs));
  // the stores outside localStorage ("idb:" keys) are merged the same way, then written back through `extra`
  const outside = Object.keys(theirs).filter((k) => k.startsWith("idb:"));
  const seenX = {};
  if (extra) {
    for (const k of new Set([...outside, ...Object.keys(mineX)])) {
      let v = mode === "replace" || !mineX[k] ? (theirs[k] ?? mineX[k]) : !theirs[k] ? mineX[k] : syncMerge({ [k]: mineX[k] }, { [k]: theirs[k] })[k];
      if (mode !== "replace") v = applyGone({ [k]: v }, gone)[k] ?? v;
      if (v !== mineX[k]) await extra.write(k, v);
      seenX[k] = v;
    }
  }
  for (const k of outside) delete theirs[k];
  const target = mode === "replace" ? theirs : syncMerge(mine, theirs);
  if (mode !== "replace") Object.assign(target, applyGone(target, gone));
  if (Object.keys(gone).length) target[GONE_KEY] = JSON.stringify(gone);
  let added = 0, changed = 0;
  for (const [k, v] of Object.entries(target)) { if (!(k in mine)) added++; else if (mine[k] !== v) changed++; }
  // replace: keys this device has that the other doesn't are removed (but never the sync settings)
  restoreData({ ...target, ...Object.fromEntries(Object.entries(collectData(s)).filter(([k]) => k.startsWith("attune:sync:"))) }, mode === "replace" ? "replace" : "merge-exact", s);
  // what both devices have now — the next sync compares against it to find what was deleted in between
  try { s.setItem(SEEN_KEY, JSON.stringify(seenOf({ ...target, ...seenX }))); } catch (e) {}
  return { added, changed };
}

export function loadSync(s = typeof localStorage !== "undefined" ? localStorage : null) { try { return JSON.parse((s && s.getItem(SYNC_KEY)) || "null") || {}; } catch (e) { return {}; } }
export function saveSync(v, s = typeof localStorage !== "undefined" ? localStorage : null) { try { s && s.setItem(SYNC_KEY, JSON.stringify(v)); } catch (e) {} return v; }

/** The Drive passphrase: long enough to resist guessing, since the file sits in the cloud. */
export function passphraseProblem(p) {
  const t = String(p || "");
  if (t.length < 10) return "Use at least 10 characters — the file lives in your Drive, so the passphrase is its only lock.";
  if (/^(.)\1+$/.test(t) || /^(0123456789|1234567890|password)/i.test(t)) return "That passphrase is too easy to guess.";
  return "";
}
