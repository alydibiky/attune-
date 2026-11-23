// v10.9.4 the subscription reader (Ali's OK-SS, 23 Nov 2026: "accuracy is everything"; SCAN_PLAN.md S1).
// EXACTLY 10,000 different screenshots / e-mails / photos' text, COMPOSED from parts in random order, HARD (tests/lib/hard.mjs):
//   the service (its own spellings, Arabic too), a plan, the price in the 30 countries' currencies and number styles (symbol / code / word,
//   before / after, 1,234.50 / 1.234,50 / ١٢٣٫٥٠), a period in 8 languages (or none — then the next date or the service decides), the
//   next payment date in many styles, the card's last 4, and DISTRACTORS in any order: a crossed-out old price, a discount, VAT + subtotal
//   (the total is the price), "free for 7 days, then …", an order number, a phone number, "200 GB", "4 screens", the payment date.
//   The answer must be exact: service, amount, currency, period, next date — and SURE. Plus screens that must NEVER be saved as yours:
//   a news post about a price rise, an advert, a plans page with several prices → not sure (Attune asks, never guesses).
//     node tests/scan/gen.mjs   (10,000; HARD=0 easy)   SEED_SHIFT=1 → another 10,000 (held-out)
import { readSubscription, SERVICES } from "../../web-src/subread.js";
import { harden, shapeOf, shapeReport, SHAPE_BAR } from "../lib/hard.mjs";

const HARD = process.env.HARD !== "0";
export function run(total = 10000, shift = 0, { quiet = false } = {}) {
  let seed = 20261124 + 7919 * shift; const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; };
  const NOW = Date.parse("2026-11-23T12:00:00") + shift * 86400e3;
  const SV = [["Netflix", ["NETFLIX", "Netflix", "نتفليكس"]], ["Shahid VIP", ["Shahid VIP", "SHAHID", "شاهد VIP"]], ["Spotify", ["Spotify Premium", "Spotify"]], ["YouTube Premium", ["YouTube Premium", "YouTube Music"]],
    ["Apple", ["iCloud+", "Apple Music", "Apple TV+", "Apple One"]], ["Google One", ["Google One"]], ["Disney+", ["Disney+", "Disney Plus"]], ["Amazon Prime", ["Amazon Prime", "Prime Video"]],
    ["ChatGPT", ["ChatGPT Plus", "OpenAI"]], ["Canva", ["Canva Pro"]], ["Anghami", ["Anghami Plus", "أنغامي بلس"]], ["OSN+", ["OSN+", "OSN Plus"]], ["WATCH IT", ["WATCH IT", "واتش ات"]],
    ["Microsoft 365", ["Microsoft 365 Family", "Microsoft 365"]], ["Duolingo", ["Duolingo Super"]], ["Adobe", ["Adobe Creative Cloud", "Lightroom"]], ["STARZPLAY", ["STARZPLAY"]],
    ["Crunchyroll", ["Crunchyroll"]], ["Deezer", ["Deezer Premium"]], ["PlayStation Plus", ["PlayStation Plus Essential", "PS Plus"]], ["Dropbox", ["Dropbox Plus"]], ["Notion", ["Notion Plus"]]];
  const CURS = [["EGP", ["EGP", "LE", "ج.م", "جنيه"]], ["SAR", ["SAR", "ر.س"]], ["AED", ["AED", "د.إ"]], ["USD", ["$", "USD", "US$"]], ["EUR", ["€", "EUR"]], ["GBP", ["£", "GBP"]],
    ["INR", ["₹", "INR"]], ["TRY", ["₺", "TRY", "TL"]], ["KWD", ["KWD"]], ["QAR", ["QAR"]], ["MAD", ["MAD"]], ["IDR", ["IDR", "Rp"]], ["BRL", ["R$", "BRL"]], ["JOD", ["JOD"]]];
  const PER = { month: ["/month", "/mo", "per month", "monthly", "a month", "شهريًا", "/ شهر", "في الشهر", "par mois", "al mes", "pro Monat", "aylık", "per bulan", "por mês"],
    year: ["/year", "/yr", "per year", "yearly", "annually", "سنويًا", "في السنة", "par an", "al año", "pro Jahr", "yıllık", "per tahun", "por ano"] };
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], MON_L = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const AR_MON = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const dateStr = (d) => pick([() => `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`, () => `${MON_L[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`, () => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`,
    () => iso(d), () => `${d.getDate()} ${AR_MON[d.getMonth()]} ${d.getFullYear()}`, () => `${d.getDate()} ${MON_L[d.getMonth()]} ${d.getFullYear()}`])();
  const NEXT = ["Next billing date", "Renews on", "Your next payment is on", "Next payment", "Auto-renews on", "يتجدد في", "تاريخ التجديد", "الدفعة القادمة", "Prochain paiement le", "Próximo pago", "Nächste Zahlung am"];
  const fmtNum = (v, style) => { const [i, f] = v.toFixed(2).split("."); const th = (sep) => i.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    return style === 0 ? th(",") + "." + f : style === 1 ? th(".") + "," + f : style === 2 ? (f === "00" ? th(",") : th(",") + "." + f) : style === 3 ? th(" ") + "," + f : i; };
  const money = (v, sym, style) => { const n = fmtNum(v, style); return /^[$€£₹₺]|R\$|Rp|US\$/.test(sym) ? (rnd() < 0.8 ? sym + n : sym + " " + n) : pick([n + " " + sym, sym + " " + n]); };
  const right = { n: 0 }, wrong = [], shapes = [];
  let ok = 0;
  for (let i = 0; i < total; i++) {
    const neg = rnd() < 0.12;
    const [svc, names] = pick(SV), name = pick(names);
    const [cur, syms] = pick(CURS), sym = pick(syms), style = pick(sym.length > 1 && /^[A-Z]{3}$/.test(sym) ? [0, 1, 2, 3, 4] : [0, 2, 4, 0, 1]);
    const big = ["IDR", "INR", "EGP"].includes(cur) && rnd() < 0.5;
    const v = big ? int(100, 250000) : +(int(1, 600) + pick([0, 0.99, 0.49, 0.5, 0.0])).toFixed(2);
    const vv = style === 4 || (style === 2 && v % 1) ? Math.round(v) : v;
    const lines = [], exp = { service: svc, amount: style === 4 ? Math.round(v) : vv, currency: cur, cycle: "", next: "", sure: !neg };
    if (neg) {
      const kind = pick(["news", "ad", "plans"]);
      if (kind === "news") lines.push(pick([`${name} raises its price to ${money(vv, sym, style)} ${pick(PER.month)}`, `${name} price increase: plans will rise to ${money(vv, sym, style)} ${pick(PER.month)}`, `${name} ترفع سعر الاشتراك إلى ${money(vv, sym, style)} ${pick(PER.month)}`]));
      else if (kind === "ad") lines.push(pick([`${name} — starting at ${money(vv, sym, style)} ${pick(PER.month)}. Subscribe now!`, `${name} يبدأ من ${money(vv, sym, style)} ${pick(PER.month)} — اشترك الآن`, `Try it free for 30 days. ${name} from just ${money(vv, sym, style)} ${pick(PER.month)}`]));
      else { lines.push("Choose your plan", name); for (const p of shuffle(["Basic", "Standard", "Premium"])) lines.push(`${p} ${money(+(vv * (0.5 + rnd())).toFixed(2), sym, style)} ${pick(PER.month)}`); }
    } else {
      const cyc = rnd() < 0.7 ? "month" : rnd() < 0.5 ? "year" : "";
      const nextD = new Date(NOW + (cyc === "year" ? int(330, 365) : int(3, 30)) * 86400e3); const withNext = rnd() < 0.7 || !cyc;
      exp.cycle = cyc || "month"; exp.next = withNext ? iso(nextD) : "";
      if (!cyc && withNext) { const days = (Date.parse(iso(nextD) + "T12:00:00") - NOW) / 864e5; if (days > 32) exp.cycle = "month"; }
      const head = [pick(["", "Your receipt from ", "Thank you for your payment — ", "Your membership · ", "Your subscription: ", "اشتراكك في ", "Votre abonnement "]) + name];
      if (rnd() < 0.6) head.push(pick(["Plan: ", "", "الباقة: ", ""]) + pick(["Standard", "Premium", "Individual", "Family", "VIP", "Basic"]));
      const priceLine = () => pick([`${pick(["Price", "Total", "Amount", "You paid", "Plan price", "السعر", "المبلغ", "Montant", "Total charged"])}: ${money(vv, sym, style)}${cyc ? " " + pick(PER[cyc]) : ""}`,
        `${money(vv, sym, style)}${cyc ? " " + pick(PER[cyc]) : ""}`, `${name} ${money(vv, sym, style)}${cyc ? " " + pick(PER[cyc]) : ""}`]);
      const parts = [];
      // distractors
      const D = [
        () => `Was ${money(+(vv * 1.5 + 1).toFixed(2), sym, style)}`, () => `Save ${int(10, 50)}%`, () => `Order #${int(100000, 9999999)}`, () => `Card ending ${int(1000, 9999)}`,
        () => `Visa •••• ${int(1000, 9999)}`, () => `Call us: +20 2 ${int(1000, 9999)} ${int(1000, 9999)}`, () => `${int(2, 4)} screens · ${pick(["HD", "4K"])}`, () => `${pick([50, 100, 200, 2000])} GB storage`,
        () => `Paid on ${dateStr(new Date(NOW - int(0, 3) * 86400e3))}`, () => `Includes ${int(1, 6)} months of extras`, () => `بطاقة المنتهية بـ ${int(1000, 9999)}`,
      ];
      const vat = rnd() < 0.2;
      if (vat) { const net = +(vv / 1.14).toFixed(2); parts.push(`Subtotal ${money(net, sym, style === 4 ? 0 : style)}`, `VAT 14% ${money(+(vv - net).toFixed(2), sym, style === 4 ? 0 : style)}`, `Total ${money(vv, sym, style)}${cyc ? " " + pick(PER[cyc]) : ""}`);
        if (style === 4) exp.amount = Math.round(vv); }
      else if (rnd() < 0.15) parts.push(`Free for ${pick(["7 days", "1 month", "14 days"])}, then ${money(vv, sym, style)} ${pick(PER[cyc || "month"])}`), exp.cycle = cyc || "month";
      else parts.push(priceLine());
      for (let k = int(0, 3); k > 0; k--) parts.push(pick(D)());
      if (withNext) parts.push(`${pick(NEXT)} ${dateStr(nextD)}`);
      lines.push(...head, ...shuffle(parts));
      // nothing on the screen says it is YOURS (no "your / thank you" heading, no renewal date, no card, no "paid on", no receipt with
      // VAT): it could be a plans page — Attune must ask, never save it by itself (accuracy first)
      if (!head[0].trim().replace(name, "").trim() && !withNext && !vat && !parts.some((p) => /Card ending|••••|بطاقة المنتهية|Paid on/.test(p))) exp.sure = false;
      if (!withNext && !cyc) exp.cycle = "month";
    }
    // (the hardener keeps the currency signs: «د.إ» → «د.أ» is a typing change — it is the Jordanian dinar's sign — and never happens to text
    // read from a screenshot)
    const SIG = ["د.إ", "د.أ", "ر.س"], hide = (l) => SIG.reduce((x, g, k) => x.split(g).join("\u0001" + "QXZ"[k] + "\u0001"), l), show = (l) => l.replace(/\u0001([QXZqxz])\u0001/g, (m, k) => SIG["QXZ".indexOf(k.toUpperCase())]);
    const text = lines.map((l) => (HARD ? show(harden(hide(l), rnd, { keep: /\d[\d,. ]*\d|\d/, allowCut: false })) : l)).join(pick(["\n", "\n", "\n\n", " \n"]));
    const r = readSubscription(text, { now: NOW, order: "dmy" });
    let good;
    if (neg) good = !r || !r.sure;
    else if (!exp.sure) good = !r || !r.sure || (r.service === exp.service && Math.abs(r.amount - exp.amount) < 0.005 && r.currency === exp.currency);   // asking is right; saving is OK only when every field is right
    else good = !!r && r.sure && r.service === exp.service && Math.abs(r.amount - exp.amount) < 0.005 && r.currency === exp.currency && r.cycle === exp.cycle && (!exp.next || r.next === exp.next);
    if (good) ok++; else if (wrong.length < 60) wrong.push({ exp, got: r && { s: r.service, a: r.amount, c: r.currency, cy: r.cycle, n: r.next, sure: r.sure, why: r.why, p: r.prices }, text });
    shapes.push(shapeOf(text));
  }
  const sh = shapeReport(shapes);
  if (!quiet) {
    console.log(`subscriptions: ${ok} / ${total} right (${(100 * ok / total).toFixed(2)} %) · ${HARD ? "HARD" : "easy"} · ${sh.shapes} different shapes (${(100 * sh.share).toFixed(1)} %, bar ${100 * SHAPE_BAR} %)`);
    for (const w of wrong.slice(0, 14)) console.log("  WRONG exp " + JSON.stringify(w.exp) + "\n    got " + JSON.stringify(w.got) + "\n    " + w.text.replace(/\n/g, " | ").slice(0, 300));
  }
  return { right: ok, total, share: sh.share, wrong };
}
if (import.meta.url === "file://" + process.argv[1]) run(+(process.argv[2] || 10000), +(process.env.SEED_SHIFT || 0));
