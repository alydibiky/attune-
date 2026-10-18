/* ---- v6.37 Sync (Ali: "in the syncing part I want the two options: either cloud using Google or using Wi-Fi").
   The same encrypted file as Backup (backup.js: PBKDF2 600,000 rounds → AES-256-GCM), carried two ways:
     • Wi-Fi: one device hosts and shows a code + its address; the other sends its file; each merges the other's.
       Nothing leaves your home network, nothing is stored anywhere else.
     • Google: your OWN Google Drive, in the hidden app folder only Attune can see (scope drive.appdata). The file is locked
       with your sync passphrase BEFORE it leaves the phone, so Google sees only noise.
   Merging (syncMerge) never loses anything: every list of items with an id (Money entries, accounts, bills, debts,
   People & plans, the Radar, missions, chats, Mind…) is joined item by item — the newer copy of the same item wins — and
   anything else keeps this device's value unless this device has none. A delete does not travel (yet): to make the other
   device exactly like this one, use "Replace the other device".
   Pure where it can be (tests/unit/v740sync.test.mjs); the native side only carries text (LocalSync.kt, GoogleDrive.kt,
   desktop/main.js).                                                                                                    */
import { collectData, encryptBackup, decryptBackup, restoreData } from "./backup.js";

export const SYNC_KEY = "attune:sync:v1";          // { pass (Drive passphrase, this device only), last, lastDrive, device }
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

const deviceKeys = (s) => { const k = collectData(s); for (const x of Object.keys(k)) if (x.startsWith("attune:sync:")) delete k[x]; return k; };
const ITER = 600000;
/** What this device sends: all its data, locked with the code or passphrase. `opts.extra` = stores that are not in
    localStorage (Fleet's IndexedDB state): { read: async () => ({ key: text }), write: async (key, text) => {} }. */
export async function packFor(secret, s = localStorage, opts = {}) {
  const keys = deviceKeys(s);
  if (opts.extra) Object.assign(keys, await opts.extra.read());
  return encryptBackup(keys, secret, { iterations: opts.iterations || ITER, app: "sync" });
}

/** The other device's file → merged into this device (mode "merge"), or this device made the same as it ("replace").
    → { added, changed } counts. Throws "Wrong code…" when it can't be opened. */
export async function takeIn(text, secret, s = localStorage, mode = "merge", extra = null) {
  let theirs;
  try { theirs = await decryptBackup(text, secret); } catch (e) { throw new Error(/Wrong password/.test(String(e && e.message)) ? "Wrong code or passphrase — nothing was changed." : String((e && e.message) || e)); }
  // the stores outside localStorage ("idb:" keys) are merged the same way, then written back through `extra`
  const outside = Object.keys(theirs).filter((k) => k.startsWith("idb:"));
  if (extra && outside.length) {
    const mineX = await extra.read();
    for (const k of outside) { const v = mode === "replace" || !mineX[k] ? theirs[k] : syncMerge({ [k]: mineX[k] }, { [k]: theirs[k] })[k]; if (v !== mineX[k]) await extra.write(k, v); }
  }
  for (const k of outside) delete theirs[k];
  const mine = deviceKeys(s);
  const target = mode === "replace" ? theirs : syncMerge(mine, theirs);
  let added = 0, changed = 0;
  for (const [k, v] of Object.entries(target)) { if (!(k in mine)) added++; else if (mine[k] !== v) changed++; }
  // replace: keys this device has that the other doesn't are removed (but never the sync settings)
  restoreData({ ...target, ...Object.fromEntries(Object.entries(collectData(s)).filter(([k]) => k.startsWith("attune:sync:"))) }, mode === "replace" ? "replace" : "merge-exact", s);
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
