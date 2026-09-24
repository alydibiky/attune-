/* ---- interface language ------------------------------------------------------
   tr("English text") returns the text in the chosen interface language. The
   English sentence itself is the key, so the source stays readable and a
   missing translation simply shows English — never a blank or a key name.
   {name} placeholders are filled from the second argument:
     tr("Saved {n} chats", { n: 3 })
   Arabic flips the whole page right-to-left (dir="rtl" on <html>).

   Changing the language reloads the page (the model stays loaded in the
   engine, so this takes a second). That lets tables of labels defined once at
   start-up be translated with plain tr() calls.                              */
import { AR } from "./i18n-ar.js";

export const LANG_KEY = "attune:ui:lang";
const DICTS = { ar: AR };

function initialLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "ar" || saved === "en") return saved;
  } catch (e) {}
  return "en";
}
let LANG = initialLang();

export function getLang() { return LANG; }
export function isRTL(l) { return (l || LANG) === "ar"; }

export function applyDir() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = LANG;
  document.documentElement.dir = isRTL() ? "rtl" : "ltr";
}

/** Switch the interface language. Also tells the Yusr ledger, then reloads. */
export function setLang(l, opts = {}) {
  LANG = l === "ar" ? "ar" : "en";
  try { localStorage.setItem(LANG_KEY, LANG); } catch (e) {}
  // Yusr (the Money ledger) keeps its own language setting inside ledger.v3.
  try {
    const raw = localStorage.getItem("ledger.v3");
    if (raw) {
      const db = JSON.parse(raw);
      if (db && typeof db === "object" && db.lang !== LANG) { db.lang = LANG; localStorage.setItem("ledger.v3", JSON.stringify(db)); }
    }
  } catch (e) {}
  applyDir();
  if (opts.reload !== false && typeof location !== "undefined") location.reload();
}

export function tr(s, vars) {
  if (typeof s !== "string") return s;          // numbers, elements: shown as they are
  let out = s;
  const d = DICTS[LANG];
  if (d) {
    if (Object.prototype.hasOwnProperty.call(d, s)) out = d[s];
    // Tests collect any English still shown in Arabic mode.
    else if (typeof window !== "undefined" && window.__trMiss && /[A-Za-z]{2}/.test(s)) window.__trMiss.add(s);
  }
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  return out;
}

/** Numbers with Western digits in both languages: Egyptian business documents
    and the ledger use 0-9, so Arabic-Indic digits would only get in the way. */
export function fmtNum(n, opts) {
  try { return Number(n).toLocaleString(LANG === "ar" ? "ar-EG-u-nu-latn" : "en-US", opts); } catch (e) { return String(n); }
}

applyDir();
