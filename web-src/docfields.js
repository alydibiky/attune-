/* ---- v9.9.5 D2 + S1 (Ali, 10 Nov 2026: "for documents and passports I want to write more than 1 thing — ID number, visa number,
   expiry date, password, CVC"; picked S1 "make the vault customizable: things I want to hide and protect and things that are normal
   to be visible, and set the time like I want for each one separately, and an option to do S2").
   A document's details = rows { id, name, value, lock, secs }:
     lock "none"   → always shown          ·  "tap" → •••• until tapped (S2)  ·  "finger" → •••• until the fingerprint / screen lock (S1)
     secs          → how long a shown secret stays shown (15 s … 10 min, 0 = until you leave the page)
   Secret values are kept apart from the item (SECRETS_KEY) so they are not in sync or the backup file. Pure; tests: v995docfields. */

export const SECRETS_KEY = "attune:radar:secrets:v1";
export const SECS = [15, 30, 60, 300, 600, 0];
const id6 = () => "f" + Math.random().toString(36).slice(2, 8);

// the usual details of each document — the ones that are secrets start locked with the fingerprint
export const SUGGEST = {
  passport: ["Passport number", "Issue date", "Place of issue", "Nationality"],
  id: ["ID number", "Issue date", "Address on the card"],
  visa: ["Visa number", "Type", "Entries", "Valid from", "Valid until"],
  licence: ["Licence number", "Category", "Traffic unit"],
  insurance: ["Policy number", "Company", "Phone"],
  registration: ["Plate number", "Chassis number", "Traffic unit"],
  card: ["Card number", "Name on card", "Expiry", "CVC", "PIN"],
  account: ["Username", "Email", "Password"],
};
const SECRET = /\b(cvc|cvv|cvv2|pin|password|passcode|pass|secret|security code|otp)\b|كلمة السر|كلمه السر|الباسورد|باسورد|الرقم السري|رقم سري|سيكيوريتي/i;
const CARD_NO = /\b(card number|card no)\b|رقم الكارت|رقم البطاقة البنكية/i;
/** A new row: secrets (CVC, PIN, password) locked with the fingerprint for 30 s; a card number tap-to-show; the rest shown. */
export function newField(name, value = "") {
  const n = String(name || "").trim().slice(0, 40);
  return { id: id6(), name: n, value: String(value || "").slice(0, 400), lock: SECRET.test(n) ? "finger" : CARD_NO.test(n) ? "tap" : "none", secs: SECRET.test(n) ? 30 : 60 };
}
export const isLocked = (f) => !!f && (f.lock === "tap" || f.lock === "finger");
/** What a locked value shows: •••• (a card number keeps its last 4). */
export function masked(f) {
  const v = String((f && f.value) || ""); if (!isLocked(f)) return v;
  if (CARD_NO.test(f.name) && /\d{4}\s*$/.test(v)) return "•••• •••• •••• " + v.replace(/\s/g, "").slice(-4);
  return "•".repeat(Math.min(8, Math.max(3, v.length)));
}

// "passport number A12345678, issued Cairo" · "visa number H1234567 valid until 1 Dec 2027" · «رقم الباسبور A123 صادر من القاهرة»
const READERS = [
  [/\b(?:passport (?:number|no\.?)|رقم (?:الباسبور|الجواز|جواز السفر))\s*[:=]?\s*([A-Z0-9][A-Z0-9-]{4,})/i, "Passport number"],
  [/\b(?:visa (?:number|no\.?)|رقم (?:الفيزا|التأشيرة))\s*[:=]?\s*([A-Z0-9][A-Z0-9-]{3,})/i, "Visa number"],
  [/\b(?:id (?:number|no\.?)|national id|الرقم القومي|رقم البطاقة)\s*[:=]?\s*([\d٠-٩ -]{6,})/i, "ID number"],
  [/\b(?:licen[cs]e (?:number|no\.?)|رقم الرخصة|رقم الرخصه)\s*[:=]?\s*([A-Z0-9][A-Z0-9 -]{3,})/i, "Licence number"],
  [/\b(?:policy (?:number|no\.?)|رقم الوثيقة|رقم البوليصة)\s*[:=]?\s*([A-Z0-9][A-Z0-9-]{3,})/i, "Policy number"],
  [/\b(?:card number|card no\.?|رقم الكارت)\s*[:=]?\s*([\d ]{12,23})/i, "Card number"],
  [/\b(?:cvc|cvv)\s*[:=]?\s*(\d{3,4})\b/i, "CVC"],
  [/\b(?:pin)\s*[:=]?\s*(\d{4,6})\b|الرقم السري\s*[:=]?\s*(\d{4,6})/i, "PIN"],
  [/\b(?:password|pass)\s*[:=]\s*(\S{3,})|(?:الباسورد|كلمة السر)\s*[:=]?\s*(\S{3,})/i, "Password"],
  [/\b(?:username|user name|user)\s*[:=]\s*(\S{2,})/i, "Username"],
  [/\b(?:issued (?:in|at|from)?|place of issue|صادر(?:ة)? من)\s*[:=]?\s*([\p{L}][\p{L} ]{1,30}?)(?=[,.;]|$|\s+(?:on|valid|expires|until))/iu, "Place of issue"],
  [/\b(?:valid until|valid till|expires? (?:on)?|expiry|ينتهي|تنتهي|صالح(?:ة)? لحد|صالح(?:ة)? حتى)\s*[:=]?\s*([\d٠-٩]{1,2}[\s/.-][\p{L}\d٠-٩]{1,9}[\s/.-][\d٠-٩]{2,4})/iu, "Valid until"],
  [/\b(?:type)\s*[:=]?\s*([A-Z]\d?\/?[A-Z]?\d?)\b/i, "Type"],
  [/\b(single|double|multiple)[- ]entr(?:y|ies)\b/i, "Entries"],
];
// (\b doesn't see Arabic letters: each reader starts at "no letter before" instead)
const RD = READERS.map(([re, name]) => [new RegExp(re.source.replace(/^\\b/, "(?<![\\p{L}\\p{N}])"), re.flags.includes("u") ? re.flags : re.flags + "u"), name]);
const AR_D = "٠١٢٣٤٥٦٧٨٩";
/** A sentence → the detail rows it says (each value exactly as written). */
export function readDetails(text) {
  const t = String(text || ""), out = [], seen = new Set();
  for (const [re, name] of RD) {
    const m = re.exec(t); if (!m) continue;
    const v = String(m[1] || m[2] || "").replace(/[٠-٩]/g, (d) => AR_D.indexOf(d)).trim().replace(/[,.;]+$/, "");
    if (!v || seen.has(name)) continue; seen.add(name); out.push(newField(name, name === "Entries" ? v.toLowerCase() : v));
  }
  return out;
}
/** Adds / replaces rows by name (a detail said again replaces its old value; its lock is kept). */
export function mergeFields(old = [], add = []) {
  const out = old.map((f) => ({ ...f }));
  for (const a of add) { const i = out.findIndex((f) => f.name.toLowerCase() === a.name.toLowerCase()); if (i >= 0) out[i] = { ...out[i], value: a.value }; else out.push(a); }
  return out;
}

// ---- secrets kept apart: { itemId: { fieldId: value } } -------------------------------------------------------------------------------
const ls = () => (typeof localStorage !== "undefined" ? localStorage : null);
export function loadSecrets(st = ls()) { try { return JSON.parse((st && st.getItem(SECRETS_KEY)) || "{}") || {}; } catch (e) { return {}; } }
export function saveSecrets(s, st = ls()) { try { st && st.setItem(SECRETS_KEY, JSON.stringify(s)); } catch (e) {} return s; }
/** The item keeps the rows WITHOUT the values of locked ones; the values go to the secrets store. → { fields, secrets } */
export function split(itemId, fields, secrets = {}) {
  const mine = { ...(secrets[itemId] || {}) }, keep = [];
  for (const f of fields) { if (isLocked(f)) { mine[f.id] = f.value; keep.push({ ...f, value: "" }); } else { delete mine[f.id]; keep.push(f); } }
  return { fields: keep, secrets: { ...secrets, [itemId]: mine } };
}
/** The rows with their values back (for the page). */
export const joined = (itemId, fields = [], secrets = {}) => fields.map((f) => (isLocked(f) ? { ...f, value: ((secrets[itemId] || {})[f.id]) ?? f.value ?? "" } : f));
/** "my passport number" / «رقم الباسبور بتاعي» in Chat → the row (only rows that are not locked are answered without unlocking). */
export function findDetail(q, items = []) {
  const t = String(q || "").toLowerCase();
  for (const x of items) for (const f of x.fields || []) {
    const n = f.name.toLowerCase(); if (!n || !t.includes(n.split(" ")[0])) continue;
    if (t.includes(n) || (x.doc && t.includes(x.doc)) || t.includes(String(x.title || "").toLowerCase())) return { item: x, field: f };
  }
  return null;
}
