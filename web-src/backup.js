/* ---- encrypted backup and restore ------------------------------------------
   Everything Attune knows lives only on this phone, in the page's storage:
   chats, the Yusr ledger (ledger.v3), the cycle log, Memory, settings. Lose the
   phone and it is gone. This packs all of it into ONE file locked with a
   password, which can be kept anywhere (Google Drive, a USB stick, WhatsApp to
   yourself) because without the password it is unreadable noise.

   How the lock works (all of it is the browser's built-in WebCrypto):
   1. password + a random 16-byte salt → PBKDF2-SHA-256, 600,000 rounds → a
      256-bit key. The rounds make every password guess cost ~0.5 s on a phone.
   2. the data (JSON, gzip-compressed when the phone can) → AES-256-GCM with a
      random 12-byte nonce. GCM also detects any change to the file: a wrong
      password or a damaged file fails loudly instead of restoring garbage.
   3. the readable header (format, version, date, counts) is bound to the
      ciphertext as "additional data", so it cannot be edited either.

   File format (UTF-8 JSON, extension .attune):
   { "format":"attune-backup", "v":1, "created":ISO, "app":"5.x",
     "kdf":{"name":"PBKDF2","hash":"SHA-256","iter":600000,"salt":b64},
     "cipher":{"name":"AES-GCM","iv":b64}, "zip":"gzip"|"none",
     "summary":{...counts...}, "data":b64 }                                   */

export const BACKUP_FORMAT = "attune-backup";
export const BACKUP_VERSION = 1;
export const KDF_ITERATIONS = 600000;
export const LAST_BACKUP_KEY = "attune:backup:last";

// Keys never worth saving: caches that rebuild themselves, and per-launch state.
const SKIP = [/^attune:net:/, /^attune:store$/, /^attune:loaded$/, /^attune:backend$/, /^attune:barmin$/,
  /^attune:backup:last$/, /\.pre-import$/];

export function collectData(storage) {
  const s = storage || localStorage;
  const keys = {};
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k == null || SKIP.some((re) => re.test(k))) continue;
    keys[k] = s.getItem(k);
  }
  return keys;
}

function safeJSON(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function len(x) { return Array.isArray(x) ? x.length : x && typeof x === "object" ? Object.keys(x).length : 0; }

/** Plain-language counts of what a set of keys holds, shown before saving and restoring. */
export function summarize(keys) {
  const chats = safeJSON(keys["attune:chats:v1"]);
  const ledger = safeJSON(keys["ledger.v3"]);
  const cycle = safeJSON(keys["attune:cycle:v1"]);
  const memKey = Object.keys(keys).find((k) => /^attune:memory:v\d+$/.test(k));
  const mem = memKey ? safeJSON(keys[memKey]) : null;
  const reminders = safeJSON(keys["attune:reminders:v1"]);
  const ledgerEntries = ledger ? (len(ledger.txns) || len(ledger.entries) || len(ledger.transactions) || len(ledger.tx) || 0) : 0;
  return {
    chats: len(chats && (chats.chats || chats.list || chats)),
    ledger: ledgerEntries,
    hasLedger: !!ledger,
    cycleDays: len(cycle && (cycle.days || cycle)),
    memory: len(mem && (mem.records || mem.items || mem)),
    reminders: len(reminders && (reminders.items || reminders)),
    keys: Object.keys(keys).length,
    bytes: Object.values(keys).reduce((a, v) => a + (v ? v.length : 0), 0),
  };
}

// ---- base64 for binary (btoa on a large string would overflow the stack) ----
export function b64(bytes) {
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(s);
}
export function unb64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function pipe(bytes, stream) {
  const r = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(r).arrayBuffer());
}
const canZip = () => typeof CompressionStream === "function" && typeof DecompressionStream === "function";

function subtle() {
  const c = (typeof crypto !== "undefined" && crypto.subtle) || null;
  if (!c) throw new Error("This phone's browser has no encryption support (WebCrypto). Update Android System WebView.");
  return c;
}

async function deriveKey(password, salt, iter) {
  const base = await subtle().importKey("raw", new TextEncoder().encode(password.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, base,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

// The header fields that are authenticated with the data (everything except the data itself).
function aad(h) {
  return new TextEncoder().encode(JSON.stringify([h.format, h.v, h.created, h.app, h.kdf, h.cipher, h.zip, h.summary]));
}

export function passwordProblem(pw, again) {
  if (!pw || pw.length < 8) return "At least 8 characters.";
  if (again != null && pw !== again) return "The two passwords don't match.";
  return "";
}

/** Rough strength, for the hint under the box: 0 weak … 3 strong. */
export function passwordStrength(pw) {
  if (!pw) return 0;
  let kinds = 0;
  if (/[a-z]/.test(pw)) kinds++; if (/[A-Z]/.test(pw)) kinds++; if (/\d/.test(pw)) kinds++;
  if (/[^A-Za-z0-9]/.test(pw)) kinds++;
  if (pw.length >= 16 || (pw.length >= 12 && kinds >= 3)) return 3;
  if (pw.length >= 10 && kinds >= 2) return 2;
  return pw.length >= 8 ? 1 : 0;
}

/** keys (from collectData) + password → the backup file's text. */
export async function encryptBackup(keys, password, opts = {}) {
  const iter = opts.iterations || KDF_ITERATIONS;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  let plain = new TextEncoder().encode(JSON.stringify({ keys }));
  const zip = canZip() ? "gzip" : "none";
  if (zip === "gzip") plain = await pipe(plain, new CompressionStream("gzip"));
  const head = {
    format: BACKUP_FORMAT, v: BACKUP_VERSION, created: new Date().toISOString(), app: opts.app || "5",
    kdf: { name: "PBKDF2", hash: "SHA-256", iter, salt: b64(salt) },
    cipher: { name: "AES-GCM", iv: b64(iv) }, zip, summary: summarize(keys),
  };
  const key = await deriveKey(password, salt, iter);
  const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv, additionalData: aad(head) }, key, plain));
  return JSON.stringify({ ...head, data: b64(ct) });
}

/** Reads only the readable header (no password needed): date and counts. */
export function readHeader(text) {
  const h = safeJSON(text);
  if (!h || h.format !== BACKUP_FORMAT) throw new Error("This is not an Attune backup file.");
  if (h.v > BACKUP_VERSION) throw new Error("This backup was made by a newer Attune. Update the app first.");
  if (!h.kdf || !h.cipher || !h.data) throw new Error("The backup file is incomplete.");
  return h;
}

/** backup text + password → keys. Throws "Wrong password…" when it can't be opened. */
export async function decryptBackup(text, password) {
  const h = readHeader(text);
  const key = await deriveKey(password, unb64(h.kdf.salt), h.kdf.iter);
  let plain;
  try {
    plain = new Uint8Array(await subtle().decrypt({ name: "AES-GCM", iv: unb64(h.cipher.iv), additionalData: aad(h) }, key, unb64(h.data)));
  } catch (e) {
    throw new Error("Wrong password, or the file was changed or damaged.");
  }
  if (h.zip === "gzip") {
    if (!canZip()) throw new Error("This phone can't unpack compressed backups. Update Android System WebView.");
    plain = await pipe(plain, new DecompressionStream("gzip"));
  }
  const obj = safeJSON(new TextDecoder().decode(plain));
  if (!obj || !obj.keys || typeof obj.keys !== "object") throw new Error("The backup opened but its contents are unreadable.");
  return obj.keys;
}

// Lists that can be joined item by item (each item has an id).
const LIST_KEYS = [/^attune:chats:v1$/, /^attune:memory:v\d+$/, /^attune:reminders:v1$/, /^attune:commits:v1$/];

function unionById(phoneArr, backupArr) {
  const seen = new Set(phoneArr.map((x) => x && x.id).filter(Boolean));
  const add = backupArr.filter((x) => !(x && x.id && seen.has(x.id)));
  const all = phoneArr.concat(add);
  const when = (x) => (x && (x.updated || x.ts || x.created || x.at)) || 0;
  return all.every((x) => when(x)) ? all.sort((a, b) => when(b) - when(a)) : all;
}

/**
 * "Merge": what is on this phone stays, and the backup adds to it.
 *  - chats, memory, reminders: joined by id (the phone's copy wins on a tie)
 *  - cycle: days joined (the phone's entry wins for the same day)
 *  - anything else (Money ledger, settings): taken from the backup only if
 *    this phone has none — two ledgers are never mixed silently.
 */
export function mergeKeys(phone, backup) {
  const out = { ...phone };
  for (const [k, v] of Object.entries(backup)) {
    if (!(k in phone) || phone[k] == null) { out[k] = v; continue; }
    const a = safeJSON(phone[k]), b = safeJSON(v);
    if (LIST_KEYS.some((re) => re.test(k)) && Array.isArray(a) && Array.isArray(b)) out[k] = JSON.stringify(unionById(a, b));
    else if (LIST_KEYS.some((re) => re.test(k)) && a && b && Array.isArray(a.items) && Array.isArray(b.items)) out[k] = JSON.stringify({ ...b, ...a, items: unionById(a.items, b.items) });
    else if (k === "attune:cycle:v1" && a && b && a.days && b.days) out[k] = JSON.stringify({ ...b, ...a, days: { ...b.days, ...a.days } });
    // else: keep the phone's value
  }
  return out;
}

/**
 * Put a backup's keys on this phone.
 *  mode "replace": this phone ends up exactly like the backup (Attune keys not
 *                  in the backup are removed).
 *  mode "merge":   the phone keeps what it has and gains the backup's items (mergeKeys).
 * If the phone runs out of storage half way, the previous state is put back.
 */
export function restoreData(keys, mode = "replace", storage) {
  const s = storage || localStorage;
  const before = collectData(s);
  try {
    const target = mode === "merge" ? mergeKeys(before, keys) : keys;
    if (mode === "replace") for (const k of Object.keys(before)) if (!(k in target)) s.removeItem(k);
    for (const [k, v] of Object.entries(target)) if (typeof v === "string" && v !== before[k]) s.setItem(k, v);
  } catch (e) {
    try { for (const k of Object.keys(keys)) s.removeItem(k); for (const [k, v] of Object.entries(before)) s.setItem(k, v); } catch (e2) {}
    throw new Error("Not enough space on the phone to restore — nothing was changed.");
  }
  return before;
}

export function backupFileName(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `Attune-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.attune`;
}

export function daysSinceBackup() {
  try {
    const t = Number(localStorage.getItem(LAST_BACKUP_KEY) || 0);
    return t ? Math.floor((Date.now() - t) / 86400000) : null;
  } catch (e) { return null; }
}
