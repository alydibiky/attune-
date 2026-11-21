// v10.8 (Ali, 21 Nov 2026: "read every line of the 18 languages"): the app's own example lines say "Ahmed me debe 12.000, 1.000 al mes",
// "12 000", «৪০,০০০», «5万» — and the sentence readers took "12.000" as 12, ignored Bengali digits, didn't know 万 / लाख / triệu / тыс / mila,
// read a lakh as a million, multiplied "3,500 km" / «1.500 kenara» / «61,000 más» by a thousand or a million, and skipped "200 thousand",
// "15,000 thanks" and «20000 thứ Sáu» as if they were "200th". 2,500 hardened composed cases of tests/numbers/gen.mjs (the full run is
// 10,000 — 95.63 % before the fixes, 100 % after; held-out 10,000: 100 %) must stay at 99.5 % or better.
process.env.N = "2500";
const { RESULT } = await import("../numbers/gen.mjs");
const { ungroup, digits, bigWords } = await import("../../web-src/numfmt.js");
const { amountsIn } = await import("../../web-src/life.js");
const { amountIn } = await import("../../web-src/braindump.js");
const fs = await import("fs");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const has = (s, v) => amountsIn(s).some((a) => a.value === v);
// the readers
for (const [s, v] of [["Ahmed me debe 12.000, 1.000 al mes", 12000], ["Ahmed schuldet mir 12.000, 1.000 im Monat", 12000], ["Ahmed me doit 12 000, 1 000 par mois", 12000],
  ["sueldo 25.000 el día 1", 25000], ["1.500,50 €", 1500.5], ["৪০,০০০-এর নিচে", 40000], ["5万円", 50000], ["2 लाख रुपये", 200000], ["3 triệu đồng", 3e6], ["12 тыс руб", 12000],
  ["12 mila euro", 12000], ["elfu 12", 12000], ["1,20,000 रुपये", 120000], ["Sisihkan 1.500 hari ini", 1500], ["tiền thuê là 20000 thứ Sáu", 20000], ["rent is 20,000 on Friday", 20000]])
  ok(has(s, v), `Money reads ${JSON.stringify(s)} as ${v} — got ${JSON.stringify(amountsIn(s).map((a) => a.value))}`);
for (const [s, v] of [["Ahmed me debe 12.000, 1.000 al mes", 12000], ["bought a phone for 200 thousand pounds at 5", 200000], ["اجاره ۱۵٬۰۰۰ thanks", 15000],
  ["फ़ोन लिया 1,20,000 रुपये", 120000], ["2 लाख", 200000], ["le propriétaire 8 000 m'a prêté", 8000], ["mein Bruder schuldet mir 9.000 am Freitag", 9000], ["a  las 5 el alquiler es 12.000", 12000],
  ["sewa 250 rb", 250000], ["ساعت ۵ اجاره ۵۰۰٬۰۰۰ ریال", 500000], ["remind me at 5 pm, rent 6,000", 6000]])
  ok(amountIn(s) === v, `Tell Attune reads ${JSON.stringify(s)} as ${v} — got ${amountIn(s)}`);
// not multiplied by the next word
for (const [s, bad] of [["Over 3,500 km with a 3–4 hour delay", 3.5e6], ["2,100 kcal", 2.1e6], ["Bugün 1.500 kenara ayır", 1.5e6], ["Al contado es 61,000 más barato", 6.1e10], ["below 2,500 m", 2.5e9], ["3 kişi · 21.500 EGP", 3000]])
  ok(!has(s, bad), `${JSON.stringify(s)} is not ${bad}`);
// left as they were
for (const s of ["3.5 kg", "on 12.03.2026", "192.168.1.20:41873", "3.500 KWD", "KD 3.500", "1 2 345", "Ahmed owes me 12,000, 1,000"]) ok(ungroup(s) === s, `ungroup leaves ${JSON.stringify(s)}`);
ok(ungroup("3.500", "KWD") === "3.500", "a three-decimal currency keeps its decimals");
ok(digits("١٢٣ ۴۵۶ ७८९ ০১২ ๓๔๕ ６７８") === "123 456 789 012 345 678", "every script's digits");
ok(bigWords("5万 2 लाख 3 triệu") === "50000 200000 3000000", "the big-number words");
// the dictionaries write thousands the way each language writes them (a German "12,000" reads as twelve)
for (const l of ["de", "es", "pt", "it", "tr", "id", "vi", "fr", "ru"]) {
  const src = fs.readFileSync(new URL(`../../web-src/i18n-${l}.js`, import.meta.url), "utf8");
  const bad = src.split("\n").filter((line) => { const m = /^\s*"(?:[^"\\]|\\.)*":\s*"((?:[^"\\]|\\.)*)"/.exec(line); return m && /(?<![\d.,])\d{1,3}(?:,\d{3})+(?![\d]|[.,]\d)/.test(m[1]); });
  ok(!bad.length, `${l}: no English "12,000" in a translation — ${bad.length}: ${bad.slice(0, 1).join(" ").slice(0, 120)}`);
}
ok(RESULT.ok / RESULT.n >= 0.995, `2,500 composed cases: ${RESULT.ok}/${RESULT.n}`);
ok(RESULT.share >= 0.6, `different shapes ${(100 * RESULT.share).toFixed(1)} %`);
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`);
process.exit(fail ? 1 : 0);
