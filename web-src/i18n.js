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
import { FR } from "./i18n-fr.js";
import { ES } from "./i18n-es.js";
import { TRK } from "./i18n-tr.js";

export const LANG_KEY = "attune:ui:lang";
/** v6.32 more interface languages (roadmap: "more UI languages after English + Arabic"). [id, its own name, locale for dates and
    numbers]. Arabic is complete; the others cover the screens people see first and show English where a line has no translation
    yet (tests/unit/v736langs.test.mjs measures each one's share). A new language = a dictionary file + one row here. */
export const LANGS = [["en", "English", "en-US"], ["ar", "العربية", "ar-EG-u-nu-latn"], ["fr", "Français", "fr-FR"], ["es", "Español", "es-ES"], ["tr", "Türkçe", "tr-TR"]];
const DICTS = { ar: AR, fr: FR, es: ES, tr: TRK };
const RTL = new Set(["ar", "ur", "fa", "he"]);
const known = (l) => LANGS.some((x) => x[0] === l);

function initialLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (known(saved)) return saved;
  } catch (e) {}
  return "en";
}
let LANG = initialLang();

export function getLang() { return LANG; }
/** v5.31: dates in the APP's language (Arabic month and day names, Western digits like the rest of the app). */
export function dateLocale() { return LANG === "en" ? undefined : (LANGS.find((x) => x[0] === LANG) || [])[2]; }
export function isRTL(l) { return RTL.has(l || LANG); }

export function applyDir() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = LANG;
  document.documentElement.dir = isRTL() ? "rtl" : "ltr";
}

/** Switch the interface language. Also tells the Yusr ledger, then reloads. */
export function setLang(l, opts = {}) {
  LANG = known(l) ? l : "en";
  try { localStorage.setItem(LANG_KEY, LANG); } catch (e) {}
  // Yusr (the Money ledger) keeps its own language setting inside ledger.v3.
  try {
    const raw = localStorage.getItem("ledger.v3");
    if (raw) {
      const db = JSON.parse(raw);
      const yl = LANG === "ar" ? "ar" : "en";      // (Yusr itself is English or Arabic)
      if (db && typeof db === "object" && db.lang !== yl) { db.lang = yl; localStorage.setItem("ledger.v3", JSON.stringify(db)); }
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
  if (ON_DESKTOP) out = forDesktop(out);
  return out;
}

// v6.25 — in the Windows/Mac app the words say "computer", not "phone" (Ali: "it is not optimized for desktop").
// A phone number, a phone call and the phone's own apps keep their word.
const ON_DESKTOP = typeof window !== "undefined" && !!(window.AttuneNative && window.AttuneNative.desktop);
export function forDesktop(t) {
  return String(t)
    .replace(/\b(your|this|the) phone(?!\s*(number|numbers|call|calls|app|apps|book))\b('s)?/gi, (m, w, _x, s) => (/^[A-Z]/.test(w) ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()) + " computer" + (s || ""))
    .replace(/على هاتفك/g, "على جهازك").replace(/على الهاتف/g, "على الجهاز").replace(/في هاتفك/g, "في جهازك").replace(/هاتفك/g, "جهازك");
}

/** Numbers with Western digits in both languages: Egyptian business documents
    and the ledger use 0-9, so Arabic-Indic digits would only get in the way. */
export function fmtNum(n, opts) {
  try { return Number(n).toLocaleString((LANGS.find((x) => x[0] === LANG) || LANGS[0])[2], opts); } catch (e) { return String(n); }
}

applyDir();
