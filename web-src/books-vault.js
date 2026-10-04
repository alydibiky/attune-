/* ---- Business books: automatic ENCRYPTED backups --------------------------------------------------------------------
   A snapshot = the whole books, gzip-free JSON, encrypted with AES-GCM-256 (WebCrypto). The key comes from the Business
   PIN or a separate passphrase through PBKDF2-SHA-256 with 600,000 iterations and a random 16-byte salt per file.
   The readable header (date, counts, fingerprint) is authenticated with the data (AES-GCM additional data), so changing
   either is detected. Inside, a SHA-256 of the books is checked again after decryption, then the audit chain and the
   trial balance are verified: a restore is offered only for a file that passes all of that.

   Policy (planSnapshots): on app open, a snapshot is taken only when the books changed since the last one; keep the
   last 7 snapshots plus the newest one of each month (up to 24 months). Older ones are dropped.
   Restore is two steps: a dry run (diffBooks: what would be added / removed / changed) and then the replace.
   Tests: tests/unit/v620bizextras.test.mjs (round trip, wrong passphrase, tamper with header / data / inner hash).    */
import { verifyAudit, EMPTY } from "./books-ops.js";
import { trialBalance } from "./books.js";

export const VAULT_FORMAT = "attune-books-vault";
export const VAULT_VERSION = 1;
export const VAULT_ITER = 600000;
const enc = new TextEncoder(), dec = new TextDecoder();
const subtle = () => { const c = globalThis.crypto && globalThis.crypto.subtle; if (!c) throw new Error("This phone has no encryption support (WebCrypto) — update Android System WebView"); return c; };
const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (t) => { const s = atob(t); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

/** A stable JSON (keys sorted) so the same books always give the same fingerprint. */
export function canon(x) {
  if (Array.isArray(x)) return "[" + x.map(canon).join(",") + "]";
  if (x && typeof x === "object") return "{" + Object.keys(x).sort().filter((k) => x[k] !== undefined).map((k) => JSON.stringify(k) + ":" + canon(x[k])).join(",") + "}";
  return JSON.stringify(x === undefined ? null : x);
}
export async function fingerprint(state) { return hex(await subtle().digest("SHA-256", enc.encode(canon(state)))); }

async function keyFrom(secret, salt, iter) {
  if (!secret || String(secret).length < 4) throw new Error("A PIN or passphrase is needed");
  const base = await subtle().importKey("raw", enc.encode(String(secret).normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
const aad = (h) => enc.encode(canon({ format: h.format, v: h.v, created: h.created, kdf: h.kdf, iv: h.iv, summary: h.summary, fp: h.fp }));
export const summary = (s) => ({ docs: (s.docs || []).length, bills: (s.bills || []).length, payments: (s.payments || []).length, customers: (s.customers || []).length, items: (s.items || []).length, journal: (s.journal || []).length, audit: (s.audit || []).length, company: (s.company || {}).name || "" });

/** books + secret → the file text. opts: { iterations, now } (tests use fewer iterations; the app always uses VAULT_ITER). */
export async function seal(state, secret, opts = {}) {
  const iter = opts.iterations || VAULT_ITER;
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16)), iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const fp = await fingerprint(state);
  const h = { format: VAULT_FORMAT, v: VAULT_VERSION, created: opts.now || new Date().toISOString(), kdf: { name: "PBKDF2", hash: "SHA-256", iter, salt: b64(salt) }, iv: b64(iv), summary: summary(state), fp };
  const key = await keyFrom(secret, salt, iter);
  const ct = await subtle().encrypt({ name: "AES-GCM", iv, additionalData: aad(h) }, key, enc.encode(JSON.stringify({ fp, state })));
  return JSON.stringify({ ...h, data: b64(new Uint8Array(ct)) });
}
/** The readable header (no secret needed). */
export function header(text) {
  let h; try { h = JSON.parse(text); } catch (e) { throw new Error("This is not a books backup"); }
  if (!h || h.format !== VAULT_FORMAT) throw new Error("This is not a books backup");
  if (h.v > VAULT_VERSION) throw new Error("This backup was made by a newer version — update the app first");
  if (!h.kdf || !h.iv || !h.data) throw new Error("The backup file is incomplete");
  return h;
}
/** file text + secret → { state, header, check }. Throws on a wrong secret or ANY change to the file. */
export async function open(text, secret) {
  const h = header(text);
  const key = await keyFrom(secret, unb64(h.kdf.salt), h.kdf.iter);
  let plain;
  try { plain = await subtle().decrypt({ name: "AES-GCM", iv: unb64(h.iv), additionalData: aad(h) }, key, unb64(h.data)); }
  catch (e) { throw new Error("Wrong PIN / passphrase, or the file was changed or damaged"); }
  let obj; try { obj = JSON.parse(dec.decode(plain)); } catch (e) { throw new Error("The backup opened but is unreadable"); }
  const fp = await fingerprint(obj.state);
  if (fp !== obj.fp || fp !== h.fp) throw new Error("The backup's contents do not match its fingerprint — not restored");
  const base = EMPTY(), state = { ...base };
  for (const k of Object.keys(base)) if (obj.state[k] !== undefined) state[k] = obj.state[k];
  const audit = verifyAudit(state), tb = trialBalance(state.journal || []);
  return { state, header: h, check: { fingerprint: true, audit: audit.ok, auditBrokenAt: audit.brokenAt || null, balanced: tb.balanced, ok: audit.ok && tb.balanced } };
}

// ---- which snapshots to keep ------------------------------------------------------------------------------------
/** list: [{ name, date: "YYYY-MM-DD", at, fp }] (any order). → { take, keep, drop } for a new snapshot of `fp` on `today`.
    take = false when the newest snapshot already has these exact books. A second snapshot on the same day replaces
    the first. keep = the last 7 + the newest of each older month (max 24 months). */
export function planSnapshots(list, today, fp, name) {
  const sorted = [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const take = !sorted.length || sorted[0].fp !== fp;
  const all = take ? [{ name: name || `books-${today}.vault`, date: today, fp }, ...sorted.filter((x) => x.date !== today)] : sorted;
  const keep = all.slice(0, 7);
  const months = new Set(keep.map((x) => x.date.slice(0, 7)));
  let monthly = 0;
  for (const x of all.slice(7)) { const m = x.date.slice(0, 7); if (!months.has(m) && monthly < 24) { months.add(m); monthly++; keep.push(x); } }
  const kept = new Set(keep.map((x) => x.name));
  return { take, keep, drop: list.filter((x) => !kept.has(x.name)).map((x) => x.name) };
}

// ---- the dry run: what a restore would change ---------------------------------------------------------------------
const keyOf = (x, i) => (x && (x.id || x.number || (x.n != null ? "n" + x.n : null))) || "i" + i;
/** → { lists: { docs: { now, backup, added, removed, changed } ... }, same, lastNumbers: { now, backup } } */
export function diffBooks(now, backup) {
  const lists = {};
  let same = true;
  for (const k of ["customers", "suppliers", "items", "docs", "bills", "payments", "supplierPayments", "expenses", "stock", "journal", "deliveries", "priceLists", "users", "fxRates", "audit"]) {
    const a = now[k] || [], b = backup[k] || [];
    const A = new Map(a.map((x, i) => [keyOf(x, i), JSON.stringify(x)])), Bm = new Map(b.map((x, i) => [keyOf(x, i), JSON.stringify(x)]));
    let added = 0, removed = 0, changed = 0;
    for (const [id, v] of Bm) if (!A.has(id)) added++; else if (A.get(id) !== v) changed++;
    for (const id of A.keys()) if (!Bm.has(id)) removed++;
    lists[k] = { now: a.length, backup: b.length, added, removed, changed };
    if (added || removed || changed) same = false;
  }
  const lastNo = (s) => (s.docs || []).filter((d) => d.number && d.type === "invoice").map((d) => d.number).sort().pop() || "";
  const company = JSON.stringify(now.company || {}) === JSON.stringify(backup.company || {});
  if (!company) same = false;
  return { lists, same, company, lastInvoice: { now: lastNo(now), backup: lastNo(backup) } };
}
