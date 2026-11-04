/* ---- v6.32 Business v2: one encrypted-backup format for Fleet and for the systems you build -------------------------
   The same protection as the Books vault (books-vault.js): PBKDF2-SHA-256, 600,000 iterations, a random 16-byte salt
   per file → AES-GCM-256. The readable header (kind, name, date, counts) is authenticated with the data, so changing
   either is detected; a SHA-256 of the contents is checked again after decryption. Nothing leaves the phone.
   Tests: tests/unit/v732bizv2.test.mjs.                                                                              */
export const BIZ_VAULT = "attune-biz-vault";
export const BIZ_VAULT_V = 1;
const ITER = 600000;
const enc = new TextEncoder(), dec = new TextDecoder();
const subtle = () => { const c = globalThis.crypto && globalThis.crypto.subtle; if (!c) throw new Error("This phone has no encryption support (WebCrypto) — update Android System WebView"); return c; };
const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function keyFrom(secret, salt, iter) {
  if (!secret || String(secret).length < 4) throw new Error("Choose a passphrase of at least 4 characters");
  const base = await subtle().importKey("raw", enc.encode(String(secret)), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
const aad = (h) => enc.encode(JSON.stringify({ format: h.format, v: h.v, kind: h.kind, name: h.name, created: h.created, kdf: h.kdf, iv: h.iv, counts: h.counts, fp: h.fp }));

/** data (any JSON) → the file text. kind: "fleet" | "system". counts: a small readable summary. */
export async function sealData(data, secret, { kind, name = "", counts = {}, now = new Date().toISOString(), iterations = ITER } = {}) {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16)), iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const body = JSON.stringify(data), fp = hex(await subtle().digest("SHA-256", enc.encode(body)));
  const h = { format: BIZ_VAULT, v: BIZ_VAULT_V, kind, name, created: now, kdf: { name: "PBKDF2", hash: "SHA-256", iter: iterations, salt: b64(salt) }, iv: b64(iv), counts, fp };
  const key = await keyFrom(secret, salt, iterations);
  const ct = await subtle().encrypt({ name: "AES-GCM", iv, additionalData: aad(h) }, key, enc.encode(body));
  return JSON.stringify({ ...h, data: b64(new Uint8Array(ct)) });
}
/** The readable header, no passphrase needed. */
export function vaultHeader(text) {
  let h; try { h = JSON.parse(text); } catch (e) { throw new Error("This is not an Attune Business backup"); }
  if (!h || h.format !== BIZ_VAULT) throw new Error("This is not an Attune Business backup");
  if (h.v > BIZ_VAULT_V) throw new Error("This backup was made by a newer version — update the app first");
  if (!h.kdf || !h.iv || !h.data) throw new Error("The backup file is incomplete");
  return h;
}
/** file text + passphrase → { data, header }. Throws on a wrong passphrase, the wrong kind, or ANY change to the file. */
export async function openData(text, secret, kind = null) {
  const h = vaultHeader(text);
  if (kind && h.kind !== kind) throw new Error(kind === "fleet" ? "This backup is not a Fleet backup" : "This backup is not a Business system");
  const key = await keyFrom(secret, unb64(h.kdf.salt), h.kdf.iter);
  let plain;
  try { plain = await subtle().decrypt({ name: "AES-GCM", iv: unb64(h.iv), additionalData: aad(h) }, key, unb64(h.data)); }
  catch (e) { throw new Error("Wrong passphrase, or the file was changed or damaged"); }
  const body = dec.decode(plain);
  if (hex(await subtle().digest("SHA-256", enc.encode(body))) !== h.fp) throw new Error("The backup's contents do not match its fingerprint — not restored");
  return { data: JSON.parse(body), header: h };
}
