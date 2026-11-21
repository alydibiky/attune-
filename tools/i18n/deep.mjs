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
const ph = (x) => (String(x).match(/\{\w+\}/g) || []).sort().join(",");
const PARTNER = { ar: "arb", ja: "zh", zh: "ja", es: "pt", pt: "es", it: "es", fr: "es", fa: "ur", ur: "fa", arb: "ar" };
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
        // 1 and 2 are often words («صفحتان», "un jour", «يومين», "一天"); a 12-hour time may be written on the 24-hour clock (5 → 17)
        const word = (n) => n <= 2 || (Number.isInteger(n) && n <= 12 && b.includes(n + 12));
        if (a.some((n) => !b.includes(n) && !word(n)) || b.some((n) => !a.includes(n) && !a2.includes(n) && !(n >= 13 && n <= 24 && a.includes(n - 12)))) add("numbers", en, t, `en ${a2.join(" ")} · ${l} ${b.join(" ")}`);
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
    // shifted: a run of lines whose translation fits the NEXT (or previous) English line better than its own — a batch that slipped by one
    // (Japanese 1708–1725 did: "Cancel" read «言い方が違いますか？ 修正する →»). Judged by length, end mark (? → … : —), numbers, placeholders.
    const E = Object.keys(d).filter((k) => typeof d[k] === "string"), V = E.map((k) => d[k]);
    const ratios = E.map((k, i) => V[i].length / Math.max(1, k.length)).filter((r) => isFinite(r) && r > 0).sort((a, b) => a - b), rho = ratios[ratios.length >> 1] || 1;
    const endOf = (x) => { const m = /([?？؟→…:：—–-]|\.\.\.)\s*$/u.exec(String(x).trim()); return m ? m[1].replace(/[？؟]/, "?").replace(/[：]/, ":").replace(/\.\.\./, "…").replace(/[–-]/, "—") : ""; };
    const sig = (x) => ph(x) + "|" + nums(x).join(",");
    // a related language's translation of the same English line shares characters / words (ja↔zh kanji, es↔pt↔it, fa↔ur, arb↔ar)
    const P = PARTNER[l] ? await load(PARTNER[l]) : null;
    const grams = (x) => { const t = String(x).toLowerCase().replace(/\{\w+\}/g, ""); const g = new Set(); if (/[\u3040-\u9fff\uac00-\ud7af]/.test(t)) { for (const c of t) if (/[\u4e00-\u9fff]/.test(c)) g.add(c); } else for (const w of t.match(/[\p{L}]{3,}/gu) || []) g.add(w.slice(0, 5)); return g; };
    const jac = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; for (const x of a) if (b.has(x)) n++; return n / Math.min(a.size, b.size); };
    const latinIn = (t) => new Set((quoted(t).match(/[A-Za-z][A-Za-z0-9]{2,}/g) || []).map((w) => w.toLowerCase()));
    const fit = (j, t) => { const en = E[j]; let f = -Math.abs(Math.log(Math.max(1, t.length) / (rho * Math.max(1, en.length)))); if (endOf(en) === endOf(t)) f += 0.6; if (sig(en) === sig(t)) f += 0.6; else f -= 0.6;
      if (P && typeof P[en] === "string" && P[en] !== en) f += 2 * jac(grams(t), grams(P[en]));
      const lt = latinIn(t); if (lt.size) f += 1.2 * jac(lt, latinIn(en)); return f; };
    const better = E.map((k, i) => { if (V[i] === k) return 0; const own = fit(i, V[i]); const nx = i + 1 < E.length ? fit(i + 1, V[i]) : -9, pv = i ? fit(i - 1, V[i]) : -9; return nx > own + 0.7 ? 1 : pv > own + 0.7 ? -1 : 0; });
    // a swap: this line fits the next one and the next one fits this one (Bengali "Save the correction" ↔ "Cancel")
    for (let i = 0; i + 1 < E.length; i++) if (better[i] === 1 && better[i + 1] === -1) { add("shifted", E[i], V[i], "swapped with the next line"); add("shifted", E[i + 1], V[i + 1], "swapped with the line before"); better[i] = better[i + 1] = 0; i++; }
    for (let i = 0; i < E.length; i++) { if (!better[i]) continue; let j = i; while (j + 1 < E.length && better[j + 1] === better[i]) j++; if (j > i) for (let q = i; q <= j; q++) add("shifted", E[q], V[q], `${better[i] > 0 ? "fits the next line" : "fits the line before"} (run of ${j - i + 1})`); i = j; }
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
