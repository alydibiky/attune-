/* ---- interface language ------------------------------------------------------
   t("English text") returns the text in the chosen interface language. The
   English sentence itself is the key, so the source stays readable and a
   missing translation simply shows English — never a blank or a key name.
   {name} placeholders are filled from the second argument:
     t("Saved {n} chats", { n: 3 })
   Arabic flips the whole page right-to-left (dir="rtl" on <html>).          */
import { AR } from "./i18n-ar.js";

export const LANG_KEY = "attune:ui:lang";
const DICTS = { ar: AR };
let LANG = "en";
try {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved === "ar" || saved === "en") LANG = saved;
} catch (e) {}
const listeners = new Set();

export function getLang() { return LANG; }
export function isRTL(l) { return (l || LANG) === "ar"; }

export function applyDir() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = LANG;
  document.documentElement.dir = isRTL() ? "rtl" : "ltr";
}

export function setLang(l) {
  LANG = l === "ar" ? "ar" : "en";
  try { localStorage.setItem(LANG_KEY, LANG); } catch (e) {}
  applyDir();
  listeners.forEach((f) => { try { f(LANG); } catch (e) {} });
}

export function onLang(f) { listeners.add(f); return () => listeners.delete(f); }

export function t(s, vars) {
  let out = s;
  const d = DICTS[LANG];
  if (d && Object.prototype.hasOwnProperty.call(d, s)) out = d[s];
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  return out;
}

/** Numbers in the interface language's digits (Arabic-Indic for Arabic is NOT used:
    Egyptian business documents use Western digits, and so does the ledger). */
export function fmtNum(n, opts) {
  try { return Number(n).toLocaleString(LANG === "ar" ? "ar-EG-u-nu-latn" : "en-US", opts); } catch (e) { return String(n); }
}

applyDir();
