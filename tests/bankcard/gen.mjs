// v10.0.3 (Ali, 16 Nov 2026: a scanned bank card filled the note with its whole number and found no expiry) — EXACTLY 10,000 texts
// as OCR reads a card (bank, level, the number in groups — sometimes with a lost digit or two —, VALID FROM / THRU in any order and
// form, the holder's name, the network, Arabic digits) and papers that are NOT a bank card (a receipt, a passport line, a phone
// number, a national ID, a warranty). Truth written HERE: the last 4 digits, the expiry's month (its last day), the bank — and
// that the whole number is never in what Attune keeps.
//     node tests/bankcard/gen.mjs [n]      HELDOUT=1 → other banks / layouts written after the code (heldout.mjs)
import fs from "fs";
const B = await import("../../web-src/bankcard.js");
const H = process.env.HELDOUT ? (await import("./heldout.mjs")).H : null;
const N = +(process.argv[2] || 10000);
let seed = 5151 + 7919 * +(process.env.SEED_SHIFT || 0) + (H ? 17 : 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1)), dig = (n) => Array.from({ length: n }, () => int(0, 9)).join("");
const BANKS = H ? H.banks : [["CIB", "CIB"], ["CIB", "CIB Wealth"], ["NBE", "National Bank of Egypt"], ["NBE", "البنك الأهلي المصري"], ["Banque Misr", "Banque Misr"], ["Banque Misr", "بنك مصر"], ["QNB", "QNB ALAHLI"], ["HSBC", "HSBC Premier"], ["", ""], ["AAIB", "Arab African International Bank"]];
const NETS = H ? H.nets : [["Visa", "VISA"], ["Mastercard", "mastercard"], ["Meeza", "meeza"], ["Visa", "VISA Platinum"], ["Mastercard", "MasterCard World"]];
const NAMES = ["ALY ALDIBIKI", "MOHAMED A HASSAN", "SARA M IBRAHIM", "NOUR EL DIN", "AHMED K"];
const EXP = H ? H.exp : [(m, y) => `VALID THRU ${m}/${y}`, (m, y) => `VALID\nTHRU ${m}/${y}`, (m, y) => `EXP ${m}/${y}`, (m, y) => `${m}/${y}`, (m, y) => `EXPIRES END ${m}-${y}`, (m, y) => `GOOD THRU ${m}/20${y}`, (m, y) => `صالحة حتى ${m}/${y}`.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d])];
const FROM = [(m, y) => `VALID FROM ${m}/${y}`, (m, y) => `MEMBER SINCE ${m}/${y}`, () => ""];
const NOT = H ? H.not : [() => `Carrefour Maadi\nTotal EGP ${int(100, 5000)}.00\nDate ${int(1, 28)}/11/2026\nThank you`, () => `P<EGY${pick(NAMES).replace(/ /g, "<")}<<<<<<<<<<\nA${dig(8)}<4EGY${dig(6)}1M${dig(6)}7<<<<<<<<<<<<<<04`,
  () => `Call us on 0100 ${dig(3)} ${dig(4)} or 19666`, () => `${pick([2, 3])}${dig(13)}\nجمهورية مصر العربية بطاقة تحقيق الشخصية`, () => `Warranty 24 months from ${int(1, 28)}/10/2026 serial SN${dig(9)}`, () => `Order #${dig(6)} arrives Thursday`, () => `IBAN EG${dig(27)}`];
const bad = {}; let pass = 0, made = 0; const seen = new Set(), kinds = {};
while (made < N) {
  const isCard = rnd() < 0.8; let text = "", want = null, kind = "";
  if (isCard) {
    const [bank, bankTxt] = pick(BANKS), [net, netTxt] = pick(NETS), len = pick([16, 16, 16, 16, 15, 19]), full = dig(len).replace(/^0/, "5");
    const groups = len === 15 ? [full.slice(0, 4), full.slice(4, 10), full.slice(10)] : len === 19 ? [full.slice(0, 4), full.slice(4, 8), full.slice(8, 12), full.slice(12, 16), full.slice(16)] : [full.slice(0, 4), full.slice(4, 8), full.slice(8, 12), full.slice(12)];
    kind = pick(["clean", "clean", "lostdigits", "glued", "cur"]);
    let numTxt = groups.join(" ");
    if (kind === "lostdigits" && len === 16) numTxt = [groups[0], groups[1], groups[2].slice(0, 2), groups[3]].join(" ");   // Ali's "5576 0199 17 3251"
    if (kind === "glued") numTxt = groups.join(pick([" ", "  ", "-"]));
    const m = String(int(1, 12)).padStart(2, "0"), y = int(27, 33), fm = String(int(1, 12)).padStart(2, "0"), fy = int(21, 26);
    const hasExp = rnd() < 0.9, exp = hasExp ? pick(EXP)(m, y) : "", from = pick(FROM)(fm, fy);
    const lines = [bankTxt + (kind === "cur" ? "EGP" : ""), numTxt, ...(rnd() < 0.5 ? [from, exp] : [exp, from]), pick(NAMES), netTxt].filter(Boolean);
    if (kind === "cur") lines.splice(0, 2, bankTxt + "EGP" + numTxt);   // "CB WealthEGP5576 0199 …" — glued by the OCR
    text = lines.join("\n");
    const ld = new Date(Date.UTC(2000 + y, +m, 0)).getUTCDate();
    want = { last4: full.slice(-4), expiry: hasExp ? `20${y}-${m}-${String(ld).padStart(2, "0")}` : "", bank, net, full };
  } else { kind = "not"; text = pick(NOT)(); }
  if (seen.has(text)) continue; seen.add(text); made++; kinds[kind] = (kinds[kind] || 0) + 1;
  const r = B.readBankCard(text); let why = "";
  if (!want) { if (r) why = "NOT a card, read as one"; }
  else if (!r) why = "a card not seen";
  else if (r.last4 !== want.last4) why = "last 4 wrong";
  else if (r.expiry !== want.expiry) why = "expiry " + (r.expiry || "none") + " ≠ " + (want.expiry || "none");
  else if (r.bank !== want.bank) why = "bank " + r.bank + " ≠ " + want.bank;
  else if (r.network !== want.net) why = "network";
  else if (JSON.stringify(r).includes(want.full.slice(0, 8)) || B.cardTitle(r).replace(/\D/g, "").length > 4) why = "THE NUMBER IS KEPT";
  if (why) { const kk = why.replace(/\d{4}-\d\d-\d\d/g, "D") + " · " + kind; (bad[kk] = bad[kk] || []).push(text.replace(/\n/g, " ⏎ ")); } else pass++;
}
const md = `# Scanning a bank card — ${N} texts, ${pass} right (${(100 * pass / N).toFixed(2)}%)${H ? " — HELD-OUT" : ""}\n\n` + Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(" · ") + "\n\n" + Object.entries(bad).sort((a, b) => b[1].length - a[1].length).slice(0, 30).map(([k, v]) => `- **${k}** × ${v.length} — e.g. ${v[0]}`).join("\n") + "\n";
if (N === 10000) fs.writeFileSync(new URL(H ? "./report-heldout.md" : "./report.md", import.meta.url), md);
console.log(md.slice(0, 5000));
