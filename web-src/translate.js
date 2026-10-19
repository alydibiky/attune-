/* ---- v6.27 Translation with checks (Ali: "very good in translating anything to any language … with exceptional accuracy") ---------
   The phone's model translates; CODE makes sure it can't silently get the hard parts wrong:
     1. LOCKED TOKENS — numbers, amounts, dates, times, links, e-mails, codes (INV-2026-001, A12345), model names (iPhone 15,
        RTX 3050), placeholders ({name}, %s) are replaced by markers ⟦1⟧ ⟦2⟧ before the model sees the text and put back after:
        the model cannot change them. Every marker must come back exactly once.
     2. CHECKS on every piece: markers all back; written in the target language's script; not left untranslated; the
        person's glossary terms used. A piece that fails is sent again ON ITS OWN with the reason; if it still fails it is
        kept but marked "check this" — never silently wrong.
     3. CONTEXT — the piece before travels with each batch (pronouns, terms stay consistent).
     4. "Extra careful" — each piece is translated back and compared by code (locked tokens + content words).
   Pure (the model is passed in as llm(messages, opts) → text). Tests: tests/unit/v727translate.test.mjs.                     */

// ---- 1. locked tokens -------------------------------------------------------------------------------------------------------------
const PRODUCTS = "iPhone|iPad|iPod|MacBook(?:\\s(?:Air|Pro))?|Galaxy(?:\\s[A-Z])?|Pixel|Redmi|Xiaomi|Honor|Huawei|Oppo|Vivo|OnePlus|Nokia|Lenovo|ThinkPad|Surface|PlayStation|PS|Xbox|Windows|Android|iOS|Model";
const LOCK = new RegExp([
  "https?:\\/\\/[^\\s<>\"']*[^\\s<>\"'.,;:!?)]", "www\\.[^\\s<>\"']*[^\\s<>\"'.,;:!?)]", "[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+",   // links, e-mails (not their full stop)
  "\\{[\\w.]+\\}|%[sd]|\\$\\{[\\w.]+\\}|\\{\\{[\\w.]+\\}\\}",                                                     // placeholders
  "\\b[A-Z]{1,6}[-/]\\d[\\w/-]*\\b|\\b[A-Z]{1,3}\\d{3,}[\\w-]*\\b|\\b\\d+[A-Z]{1,4}\\d*\\b",                      // codes: INV-2026-001, A12345, 12B
  "\\b(?:" + PRODUCTS + ")\\s?\\d{1,4}\\w*(?:\\s(?:Pro|Max|Plus|Ultra|Mini|Lite|SE))?\\b",                         // iPhone 15 Pro, Galaxy S24
  "\\b[A-Z]{2,5}[- ]?\\d{2,5}\\w*\\b",                                                                            // RTX 3050, LTM 1100, GT-500
  "\\d{1,4}[-/.]\\d{1,2}[-/.]\\d{2,4}", "\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s?[ap]\\.?m\\.?)?",                        // dates, times
  "[$€£¥₹₺₽₩₦₱฿₫৳₪]\\s?\\d[\\d.,'\\u00a0]*\\d|[$€£¥₹₺₽₩₦₱฿₫৳₪]\\s?\\d|\\d(?:[\\d.,']*\\d)?\\s?(?:[$€£¥₹₺₽₩₦₱฿₫৳₪]|[A-Z]{3}\\b)|\\b[A-Z]{3}\\s?\\d[\\d.,']*\\d", // amounts
  "\\d+(?:[.,]\\d+)*\\s?%", "\\d+(?:[.,']\\d+)*",                                                                 // percentages, numbers
].join("|"), "gu");
export function protect(text) {
  const tokens = [];
  const masked = String(text || "").replace(LOCK, (m) => { tokens.push(m); return "⟦" + tokens.length + "⟧"; });
  return { masked, tokens };
}
/** Markers → the original tokens. ok only if every marker came back exactly once and no unknown one appeared. */
export function restore(text, tokens) {
  const seen = new Map(); let bad = [];
  const out = String(text || "").replace(/⟦\s*(\d+)\s*⟧|\[\[\s*(\d+)\s*\]\](?!\s)|«(\d+)»/g, (m, a, b, c) => {
    const k = +(a || b || c); if (!(k >= 1 && k <= tokens.length)) { bad.push(m); return m; }
    seen.set(k, (seen.get(k) || 0) + 1); return tokens[k - 1];
  });
  // a model that wrote the real value back instead of its marker kept it too (digits compared as Latin)
  const lat = (x) => String(x).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/\s/g, "");
  const missing = tokens.map((t, i) => (seen.get(i + 1) || lat(out).includes(lat(t)) ? null : t)).filter((x) => x != null);
  const doubled = [...seen].filter(([, n]) => n > 1).map(([k]) => tokens[k - 1]);
  return { text: out, ok: !missing.length && !doubled.length && !bad.length, missing, doubled, bad };
}

// ---- 2. checks ------------------------------------------------------------------------------------------------------------------------
const SCRIPTS = { ar: /[\u0600-\u06FF]/g, fa: /[\u0600-\u06FF]/g, ur: /[\u0600-\u06FF]/g, he: /[\u0590-\u05FF]/g, ru: /[\u0400-\u04FF]/g, uk: /[\u0400-\u04FF]/g, bg: /[\u0400-\u04FF]/g,
  el: /[\u0370-\u03FF]/g, hi: /[\u0900-\u097F]/g, bn: /[\u0980-\u09FF]/g, th: /[\u0E00-\u0E7F]/g, ko: /[\uAC00-\uD7AF\u1100-\u11FF]/g, ja: /[\u3040-\u30FF\u4E00-\u9FFF]/g, zh: /[\u4E00-\u9FFF]/g,
  ta: /[\u0B80-\u0BFF]/g, am: /[\u1200-\u137F]/g };
const LATIN = /[A-Za-zÀ-ÖØ-öø-ÿĀ-žƀ-ɏ]/g;
/** Is the text written in the target language's script (at least 60 % of its letters, ignoring locked tokens)? */
export function scriptOk(text, lang) {
  const t = String(text || "").replace(LOCK, " ");
  const letters = (t.match(/\p{L}/gu) || []).length; if (letters < 4) return true;
  const re = SCRIPTS[lang] || LATIN;
  const n = (t.match(re) || []).length;
  return n / letters >= (SCRIPTS[lang] ? 0.6 : 0.75);
}
const words = (s) => String(s || "").toLowerCase().replace(LOCK, " ").match(/\p{L}{2,}/gu) || [];
/** Left untranslated: the same words as the source (for languages that share a script). */
export function untranslated(src, out) {
  const a = words(src), b = words(out); if (a.length < 3) return false;
  const A = new Set(a); const same = b.filter((w) => A.has(w)).length;
  return b.length > 0 && same / b.length > 0.8;
}
/** The person's glossary [{ from, to }]: a term in the source must come out as theirs. → the terms not respected. */
export function glossaryMisses(src, out, glossary = []) {
  return glossary.filter((g) => g.from && g.to && new RegExp("(?<![\\p{L}])" + esc(g.from) + "(?![\\p{L}])", "iu").test(src) && !new RegExp(esc(g.to), "iu").test(out));
}
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---- the prompts ----------------------------------------------------------------------------------------------------------------------
export function messages(pieces, language, { context = "", glossary = [], fix = "" } = {}) {
  const body = pieces.map((t, i) => `[[${i + 1}]] ${String(t).replace(/\n/g, " <br> ")}`).join("\n");
  const g = glossary.filter((x) => x.from && x.to).map((x) => `"${x.from}" → "${x.to}"`).join("; ");
  return [
    { role: "system", content: `You are a professional translator. Translate into ${language}. Translate the meaning naturally and accurately, in the tone of the original — not word by word. Copy every marker like ⟦3⟧ exactly where it belongs (they stand for numbers, names and codes). Keep "<br>" where it is.${g ? " Always use these translations: " + g + "." : ""} Reply ONLY with the numbered lines, each starting with its marker [[n]] — no notes.` },
    { role: "user", content: (context ? `(Context, do not translate: ${String(context).slice(-400)})\n` : "") + (fix ? `(Your last answer was wrong: ${fix}. Fix it.)\n` : "") + body },
  ];
}
export function parse(reply, n) {
  const out = Array(n).fill(null);
  const parts = String(reply || "").split(/\[\[(\d+)\]\](?!\s*⟧)/);
  for (let i = 1; i < parts.length; i += 2) { const k = +parts[i] - 1, t = (parts[i + 1] || "").trim().replace(/\s*<br>\s*/gi, "\n"); if (k >= 0 && k < n && t && out[k] == null) out[k] = t; }
  if (n === 1 && out[0] == null && String(reply || "").trim() && !/\[\[\d+\]\]/.test(reply)) out[0] = String(reply).trim().replace(/\s*<br>\s*/gi, "\n");
  return out;
}

/** One piece's translation checked → { text, ok, why } */
export function check(src, out, { lang, tokens, glossary = [] } = {}) {
  if (out == null || !String(out).trim()) return { text: null, ok: false, why: "missing" };
  const r = restore(out, tokens);
  const why = [];
  if (!r.ok) why.push(r.missing.length ? `these must be kept exactly: ${r.missing.join(", ")}` : r.doubled.length ? `these appear twice: ${r.doubled.join(", ")}` : "unknown markers");
  if (!scriptOk(r.text, lang)) why.push(`it must be written in ${lang} script`);
  if (lang && (!SCRIPTS[lang]) && untranslated(src, r.text)) why.push("it was not translated");
  const gm = glossaryMisses(src, r.text, glossary); if (gm.length) why.push("use: " + gm.map((g) => `"${g.from}" → "${g.to}"`).join(", "));
  return { text: r.text, ok: !why.length, why: why.join("; ") };
}

/**
 * Translate pieces with every check. llm(messages, { maxTokens }) → reply text.
 * o: { lang (code: ar, fr…), language (its name for the model), glossary, careful, sourceLanguage, onProgress(i, n) }
 * → [{ src, text, ok, why, back? }] in order (text is never null: a piece that failed twice keeps its best try, or the source).
 */
export async function translatePieces(pieces, llm, o = {}) {
  const lang = o.lang || "", language = o.language || lang, glossary = o.glossary || [];
  const prot = pieces.map((p) => protect(p));
  const results = pieces.map((src) => ({ src, text: null, ok: false, why: "" }));
  // a piece that is only numbers, codes and names ("LTM 1100", "14:30") has nothing to translate: it stays as it is
  const todo = pieces.map((_, i) => i).filter((i) => /\p{L}{2,}/u.test(prot[i].masked.replace(/⟦\d+⟧/g, " ")));
  for (let i = 0; i < pieces.length; i++) if (!todo.includes(i)) results[i] = { src: pieces[i], text: pieces[i], ok: true, why: "" };
  // batches under ~1500 characters, the piece before as context
  const batches = []; let cur = [], len = 0;
  todo.forEach((i) => { const l = prot[i].masked.length + 8; if (cur.length && len + l > 1500) { batches.push(cur); cur = []; len = 0; } cur.push(i); len += l; });
  if (cur.length) batches.push(cur);
  for (let b = 0; b < batches.length; b++) {
    const idx = batches[b];
    o.onProgress && o.onProgress(b, batches.length);
    const ctx = idx[0] > 0 ? pieces[idx[0] - 1] : "";
    let got = [];
    try { got = parse(await llm(messages(idx.map((i) => prot[i].masked), language, { context: ctx, glossary }), { maxTokens: Math.min(3500, 300 + Math.round(idx.reduce((n, i) => n + pieces[i].length, 0) * 1.8)) }), idx.length); } catch (e) { got = []; }
    for (let j = 0; j < idx.length; j++) {
      const i = idx[j];
      let c = check(pieces[i], got[j], { lang, tokens: prot[i].tokens, glossary });
      if (!c.ok) {   // once more, alone, with the reason
        let again = null;
        try { again = parse(await llm(messages([prot[i].masked], language, { context: i > 0 ? pieces[i - 1] : "", glossary, fix: c.why || "a line was missing" }), { maxTokens: 1500 }), 1)[0]; } catch (e) {}
        const c2 = check(pieces[i], again, { lang, tokens: prot[i].tokens, glossary });
        if (c2.ok || (!c.text && c2.text)) c = c2;
      }
      results[i] = { src: pieces[i], text: c.text || pieces[i], ok: c.ok, why: c.ok ? "" : c.why || "missing" };
    }
  }
  // extra careful: translate back; code checks the locked tokens and the negation; the model judges meaning only when the words differ
  if (o.careful && o.sourceLanguage) {
    for (const r of results) {
      if (!r.ok) continue;
      let back = null;
      try { back = parse(await llm(messages([protect(r.text).masked], o.sourceLanguage, {}), { maxTokens: 1500 }), 1)[0]; } catch (e) {}
      if (back == null) continue;
      const bt = restore(back, protect(r.text).tokens).text;
      r.back = bt; r.backScore = overlap(r.src, bt);
      if (r.backScore === 0 && !tokensSurvive(r.src, bt)) { r.ok = false; r.why = "a number or name changed on the way back — check this one"; continue; }
      if (negated(r.src) !== negated(bt)) { r.ok = false; r.why = "“not / no” may have been lost or added — check this one"; continue; }
      if (r.backScore < 0.5) {
        let same = "";
        try { same = String(await llm([{ role: "system", content: "Answer only YES or NO." }, { role: "user", content: `Do these two sentences say the same thing (same facts, same meaning)?\nA: ${r.src}\nB: ${bt}` }], { maxTokens: 4 })); } catch (e) {}
        if (!/\byes\b|نعم|oui|sí|si\b|ja\b|evet/i.test(same)) { r.ok = false; r.why = "the meaning may have changed — check this one"; }
      }
    }
  }
  return results;
}
const NEG = /(?<![\p{L}])(not|no|never|none|without|nobody|nothing|n't|cannot|لا|ليس|ليست|لم|لن|غير|بدون|مش|ne|pas|jamais|sans|no|nunca|sin|nicht|kein|keine|nie|ohne|non|senza|değil|yok|hiç|tidak|bukan|tanpa|не|нет|без)(?![\p{L}])/iu;
const negated = (s) => NEG.test(String(s || "").replace(/n't/g, " not"));
const tokensSurvive = (a, b) => { const tb = new Set(protect(b).tokens.map((x) => x.replace(/\s/g, ""))); return protect(a).tokens.every((t) => tb.has(t.replace(/\s/g, ""))); };
/** How much of the source's content survives a round trip (locked tokens must all come back; content words by stem). */
export function overlap(a, b) {
  const ta = protect(a).tokens, tb = new Set(protect(b).tokens.map((x) => x.replace(/\s/g, "")));
  if (ta.some((t) => !tb.has(t.replace(/\s/g, "")))) return 0;
  const stem = (w) => w.replace(/(ing|ed|es|s|ly|tion|ment)$/, "").slice(0, 6);
  const A = words(a).filter((w) => w.length > 3).map(stem), B = new Set(words(b).filter((w) => w.length > 3).map(stem));
  if (!A.length) return 1;
  return A.filter((w) => B.has(w)).length / A.length;
}

// ---- languages --------------------------------------------------------------------------------------------------------------------------
export const LANGS = { en: "English", ar: "Arabic", fr: "French", es: "Spanish", de: "German", it: "Italian", pt: "Portuguese", tr: "Turkish", ru: "Russian", uk: "Ukrainian", pl: "Polish",
  nl: "Dutch", sv: "Swedish", el: "Greek", he: "Hebrew", fa: "Persian", ur: "Urdu", hi: "Hindi", bn: "Bengali", ta: "Tamil", th: "Thai", vi: "Vietnamese", id: "Indonesian", ms: "Malay",
  tl: "Filipino", sw: "Swahili", am: "Amharic", zh: "Chinese (Simplified)", ja: "Japanese", ko: "Korean" };
/** Split a text into pieces: paragraphs (long ones by sentence) — the units checked one by one. */
export function piecesOf(text) {
  const out = [];
  for (const para of String(text || "").split(/\n{2,}/)) {
    const p = para.trim(); if (!p) continue;
    if (p.length <= 700) { out.push(p); continue; }
    let cur = "";
    for (const s of p.split(/(?<=[.!?؟。])\s+/)) { if ((cur + " " + s).length > 600 && cur) { out.push(cur.trim()); cur = s; } else cur += (cur ? " " : "") + s; }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
}

/** v6.41 (H4): the speech-recogniser tag for a language (the phone listens in that language). */
const TAGS = { en: "en-US", ar: "ar-EG", fr: "fr-FR", es: "es-ES", de: "de-DE", it: "it-IT", pt: "pt-BR", tr: "tr-TR", ru: "ru-RU", uk: "uk-UA", pl: "pl-PL", nl: "nl-NL", zh: "zh-CN", ja: "ja-JP", ko: "ko-KR", hi: "hi-IN", ur: "ur-PK", fa: "fa-IR", he: "he-IL", id: "id-ID", ms: "ms-MY", th: "th-TH", vi: "vi-VN", bn: "bn-BD", sw: "sw-KE" };
export const speechTag = (code) => TAGS[code] || code || "en-US";
