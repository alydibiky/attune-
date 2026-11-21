// v10.8 (Ali, 21 Nov: "read every line of the 18 languages other than Arabic"): a deeper pass over EVERY line of every dictionary than
// audit.mjs — the mistakes a reader finds by eye, found by code so none of the ~15,000 lines × 18 languages is skipped:
//   numbers      a number in the English that is missing / different in the translation (a wrong line, a typo, a shifted batch)
//   english      English words left inside a translated sentence ("your", "with", "the" …) — half-translated lines
//   script       letters of another writing system (Hangul in Japanese, kana in Chinese, Arabic ي/ك in Persian, Cyrillic in Latin …)
//   brand        "Attune" in the English but gone from the translation
//   symbols      an arrow / tick / bullet / emoji of the English missing from the translation (the app uses them as icons)
//   length       a translation 3.5× longer or 4× shorter than the English (a wrong line or a cut one)
//   broken       broken characters (Ã, â€, �), doubled spaces, a space before a comma/full stop in Latin scripts
//   lines        a different number of line breaks
//   empty        an empty translation
//   node tools/i18n/deep.mjs [lang] [kind]   → prints problems by language and kind; writes tools/i18n/deep-report.txt
import fs from "fs";
const ROOT = new URL("../../", import.meta.url).pathname;
const LANGS = ["arb", "es", "fr", "de", "pt", "it", "ru", "tr", "id", "hi", "ur", "fa", "bn", "sw", "th", "vi", "zh", "ja", "ko"];
const load = async (l) => { const m = await import(`${ROOT}web-src/i18n-${l}.js`); return Object.values(m).find((v) => v && typeof v === "object" && Object.keys(v).length > 50) || {}; };
const LATIN = new Set(["es", "fr", "de", "pt", "it", "tr", "id", "sw", "vi"]);
// letters that never belong in that language's lines (names in Latin letters are fine everywhere)
const FOREIGN = {
  ja: /[가-힯Ѐ-ӿ؀-ۿऀ-ॿ฀-๿]/, zh: /[぀-ゟ゠-ヿ가-힯Ѐ-ӿ؀-ۿ]/, ko: /[぀-ヿЀ-ӿ؀-ۿ]/,
  ru: /[؀-ۿ一-鿿가-힯]/, hi: /[؀-ۿঀ-৿一-鿿]/, bn: /[؀-ۿऀ-ॣ०-ॿ一-鿿]/, th: /[؀-ۿ一-鿿가-힯]/,
  fa: /[يكة]/, ur: /[ةكي]/,   // Persian writes ی ک; Urdu ی ک ہ — the Arabic letters mean a line was copied from Arabic
  arb: /[پچژگ]/,             // Persian/Urdu letters in Arabic
};
for (const l of LATIN) FOREIGN[l] = /[Ѐ-ӿ؀-ۿऀ-ॿ一-鿿぀-ヿ가-힯฀-๿]/;
// English words that are never part of another language's sentence
const EN_WORDS = /\b(the|your|you|with|and|this|that|from|will|have|when|what|which|there|here|would|should|could|into|about|been|their|them|they|were|only|also|after|before|every|never|always|please|tap|open)\b/i;
const EN_OK = { de: /\b(also|will|tap|open|here)\b/i, it: /\b(open)\b/i, id: /\b(tap)\b/i, sw: /\b(tap)\b/i, fr: /\b(open)\b/i, es: /\b(open)\b/i, pt: /\b(open)\b/i, tr: /\b(open)\b/i };
const SYM = /[→←✓✔✗✕•★☆⚠️🔒🔔📌⏰💬]/gu;
const toLatinDigits = (s) => String(s).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
  .replace(/[०-९]/g, (d) => "०१२३४५६७८९".indexOf(d)).replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d)).replace(/[๐-๙]/g, (d) => "๐๑๒๓๔๕๖๗๘๙".indexOf(d))
  .replace(/[٫]/g, ".").replace(/(\d)[\s  .,'](?=\d{3}\b)/g, "$1");
const quoted = (s) => String(s).replace(/"[^"]*"|“[^”]*”|«[^»]*»|'[^']*'|`[^`]*`|https?:\/\/\S+|\b[\w.-]+\.(?:com|org|net|app|eg|io)\b|\{\w+\}/g, " ");
// 12,000 = 12.000 = 12 000 = 12'000 (thousands); 3.5 = 3,5 (decimals); Arabic-Indic / Persian / Devanagari / Bengali / Thai digits read as digits
const ungroup = (s) => { let x = String(s), y; do { y = x; x = x.replace(/(\d)[,.\s\u00a0\u202f'](?=\d{3}(?!\d))/g, "$1"); } while (x !== y); return x; };
const nums = (s) => (ungroup(toLatinDigits(String(s).replace(/\{\w+\}/g, ""))).match(/\d+(?:[.,]\d+)?/g) || []).map((n) => n.replace(",", ".")).map(Number).sort((a, b) => a - b);
// numbers that may rightly change: 2pm → 14, 12-hour clock, "1st", ordinal words, "×10" etc. are compared after the 24-hour fold
const fold12 = (en) => String(en).replace(/\b(\d{1,2})(?::(\d\d))?\s*(am|pm)\b/gi, (m, h, mm, ap) => { let x = +h % 12; if (/pm/i.test(ap)) x += 12; return x + (mm ? ":" + mm : ""); });
export async function deep(only, kindOnly) {
  const out = {};
  const langs = only ? [only] : LANGS;
  for (const l of langs) {
    const d = await load(l); const probs = [];
    const add = (k, en, t, why) => { if (!kindOnly || kindOnly === k) probs.push([k, en, t, why || ""]); };
    for (const [en, t0] of Object.entries(d)) {
      if (typeof t0 !== "string") continue;
      const t = t0;
      if (!t.trim()) { add("empty", en, t); continue; }
      if (t === en) continue;   // left as written (names, codes) — audit.mjs judges those
      // numbers
      const a = nums(fold12(en)), b = nums(t);
      const a2 = nums(en);
      const same = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
      if (a.length && !same(a, b) && !same(a2, b)) {
        const miss = a.filter((n) => !b.includes(n) && !a2.filter((m) => !b.includes(m)).length === false);
        // allowed: written-out numbers ("one", "two") vs digits, or a number of the English dropped because the language has a word for it
        if (a.some((n) => !b.includes(n)) || b.some((n) => !a.includes(n) && !a2.includes(n))) add("numbers", en, t, `en ${a2.join(" ")} · ${l} ${b.join(" ")}`);
        void miss;
      }
      // English words in the middle of a translation
      const words = (quoted(t).match(/[A-Za-z]{2,}/g) || []);
      if (words.length) {
        const ws = quoted(t).match(new RegExp(EN_WORDS.source, "gi")) || [];
        const bad = ws.filter((w) => !(EN_OK[l] && EN_OK[l].test(w)) && !new RegExp("\\b" + w + "\\b", "i").test(quoted(en)) === false);
        // a word counts only if it is also in the English (so it was copied, not a native word that looks the same)
        if (bad.length >= (LATIN.has(l) ? 2 : 1)) add("english", en, t, bad.join(" "));
      }
      if (FOREIGN[l] && FOREIGN[l].test(quoted(t)) && !FOREIGN[l].test(en)) add("script", en, t, (quoted(t).match(FOREIGN[l]) || [])[0]);
      if (/\bAttune\b/.test(en) && !/Attune|أتيون|اتيون|アチューン|아튠|阿图恩|अट्यून|অ্যাটিউন|แอททูน/.test(t)) add("brand", en, t);
      const sa = (en.match(SYM) || []).length, sb = (t.match(SYM) || []).length;
      if (sa > sb) add("symbols", en, t, `${sa} → ${sb}`);
      const le = en.replace(/\{\w+\}/g, "x").length, lt = t.replace(/\{\w+\}/g, "x").length;
      const wide = /^(zh|ja|ko)$/.test(l) ? 2.2 : 1;   // a CJK letter carries about two Latin ones
      if (le >= 12 && (lt * wide > le * 3.5 || lt * wide * 4 < le)) add("length", en, t, `${le} → ${lt}`);
      if (/Ã.|â€|�/.test(t)) add("broken", en, t, "broken characters");
      if (/ {2,}/.test(t) && !/ {2,}/.test(en)) add("broken", en, t, "double space");
      if (LATIN.has(l) && l !== "fr" && / [,.;:!?](?=\s|$)/.test(t) && !/ [,.;:!?]/.test(en)) add("broken", en, t, "space before punctuation");
      if ((en.match(/\n/g) || []).length !== (t.match(/\n/g) || []).length) add("lines", en, t, `${(en.match(/\n/g) || []).length} → ${(t.match(/\n/g) || []).length}`);
    }
    out[l] = probs;
  }
  return out;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await deep(process.argv[2] && process.argv[2] !== "all" ? process.argv[2] : null, process.argv[3]);
  let txt = "", total = 0;
  for (const [l, probs] of Object.entries(r)) {
    const by = {}; for (const p of probs) (by[p[0]] = by[p[0]] || []).push(p);
    total += probs.length;
    console.log(`${l}: ${probs.length}  ` + Object.entries(by).map(([k, v]) => `${k} ${v.length}`).join(" · "));
    for (const [k, v] of Object.entries(by)) { txt += `\n== ${l} · ${k} (${v.length})\n`; for (const [, en, t, why] of v) txt += `${JSON.stringify(en).slice(0, 160)}\n   → ${JSON.stringify(t).slice(0, 200)}${why ? "   [" + why + "]" : ""}\n`; }
  }
  fs.writeFileSync(`${ROOT}tools/i18n/deep-report.txt`, txt);
  console.log(`\n${total} to read → tools/i18n/deep-report.txt`);
}
