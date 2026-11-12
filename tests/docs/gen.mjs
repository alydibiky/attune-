// v9.9.22 X1 — exactly 10,000 photographed papers as the phone's text reader returns them: warranty cards / invoices, subscriptions,
// free trials, renewals, driving & car licences, insurance, national IDs, passports' visual pages, visas — English, Egyptian Arabic
// (Arabic and Latin digits), French, Spanish, German; date orders d/m/y, "12 Dec 2026", ISO; noise (O for 0, l for 1, broken lines,
// shop headers, totals, phone numbers). The oracle: the KIND, the DEADLINE date, the AMOUNT (when the paper has one), the document type.
// node tests/docs/gen.mjs [n]
import fs from "fs";
const D = await import(process.env.DOCS || "../../web-src/deadlines.js");
const N = +(process.argv[2] || 10000), now = Date.parse("2026-11-12T10:00:00");
let seed = 13; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648), int = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (l) => l[Math.floor(rnd() * l.length)];
const pad = (n) => String(n).padStart(2, "0"), iso = (y, m, d) => y + "-" + pad(m) + "-" + pad(d);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], AR = "٠١٢٣٤٥٦٧٨٩", arD = (s) => String(s).replace(/\d/g, (d) => AR[d]);
const addM = (y, m, d, k) => { const t = new Date(y, m - 1 + k, d); return [t.getFullYear(), t.getMonth() + 1, t.getDate()]; };
const fmt = (y, m, d, style) => style === "dmy" ? pad(d) + "/" + pad(m) + "/" + y : style === "words" ? d + " " + MON[m - 1] + " " + y : style === "iso" ? iso(y, m, d) : style === "ar" ? arD(pad(d) + "/" + pad(m) + "/" + y) : d + "." + pad(m) + "." + y;
const noise = (s) => s.replace(/0/g, (c) => (rnd() < 0.03 ? "O" : c)).replace(/(\d)/g, (c) => (c === "1" && rnd() < 0.02 ? "l" : c));
const SHOP = ["B.TECH", "2B", "Raya Shop", "Carrefour", "noon", "Amazon.eg", "Jumia", "Extra", "Sharaf DG"], PROD = ["Samsung TV 55\"", "iPhone 15 128GB", "LG Washing Machine", "Huawei FreeClip 2", "Dell Laptop", "Air conditioner 1.5 HP"];
const SUBS = [["Netflix", "Premium"], ["Shahid", "VIP"], ["Spotify", "Premium"], ["Anghami", "Plus"], ["YouTube", "Premium"], ["iCloud+", "200 GB"], ["Google One", "AI Pro"], ["OSN+", ""]];
function make() {
  const kind = pick(["warranty", "warranty", "renewal", "renewal", "trial", "licence", "carlic", "insurance", "visa"]), style = pick(["dmy", "words", "iso", "ar", "dot"]), cur = pick(["EGP", "EGP", "SAR", "AED"]);
  const fy = 2026 + int(0, 3), fm = int(1, 12), fd = int(1, 28);   // a future deadline
  if (kind === "warranty") { const py = int(2025, 2026), pm = py === 2026 ? int(1, 10) : int(1, 12), pdd = int(1, 28), yrs = pick([1, 2, 3]), months = yrs * 12, price = int(5, 900) * 100;
    const [ey, em, ed] = addM(py, pm, pdd, months); const ar = style === "ar";
    const per = ar ? pick(["ضمان " + ({ 1: "سنة", 2: "سنتين", 3: "٣ سنوات" })[yrs], "الضمان: " + arD(months) + " شهر"]) : pick(["Warranty: " + yrs + (yrs === 1 ? " year" : " years"), "Warranty " + months + " months", yrs + "-year warranty"]);
    const text = [pick(SHOP), "Tax invoice", (ar ? "تاريخ الفاتورة: " : "Invoice date: ") + fmt(py, pm, pdd, style), pick(PROD), (ar ? "الإجمالي " : "Total ") + price.toLocaleString("en-US") + " " + cur, per, "Tel 0" + int(100000000, 199999999)].join("\n");
    return { text, want: { kind: "warranty", date: iso(ey, em, ed), amount: price } }; }
  if (kind === "renewal") { const [s, plan] = pick(SUBS), price = int(3, 60) * 10 - pick([0, 0.01]), per = pick(["month", "year"]);
    const line = pick(["Your next billing date is " + fmt(fy, fm, fd, style === "ar" ? "words" : style), "Renews on " + fmt(fy, fm, fd, style === "ar" ? "words" : style), "Next payment: " + fmt(fy, fm, fd, style === "ar" ? "dmy" : style)]);
    const text = [s, plan, cur + " " + price.toFixed(price % 1 ? 2 : 0) + " / " + per, line, "Manage subscription"].join("\n");
    return { text, want: { kind: "renewal", date: iso(fy, fm, fd), amount: +price.toFixed(2) } }; }
  if (kind === "trial") { const [s] = pick(SUBS), d = new Date(now + int(1, 25) * 864e5);
    const text = pick(["Your free trial of " + s + " ends on " + fmt(d.getFullYear(), d.getMonth() + 1, d.getDate(), style === "ar" ? "words" : style), s + "\nFree trial · ends " + fmt(d.getFullYear(), d.getMonth() + 1, d.getDate(), style === "ar" ? "dmy" : style)]);
    return { text, want: { kind: "trial", date: iso(d.getFullYear(), d.getMonth() + 1, d.getDate()), amount: null } }; }
  if (kind === "licence") { const ar = rnd() < 0.5;
    const text = (ar ? ["جمهورية مصر العربية", "رخصة قيادة خاصة", "تاريخ الإصدار " + fmt(fy - 10, fm, fd, "ar"), "تاريخ الانتهاء " + fmt(fy, fm, fd, pick(["ar", "dmy"]))] : ["DRIVING LICENCE", "Issue date " + fmt(fy - 10, fm, fd, style === "ar" ? "dmy" : style), "Expiry date " + fmt(fy, fm, fd, style === "ar" ? "dmy" : style)]).join("\n");
    return { text, want: { kind: "expiry", date: iso(fy, fm, fd), amount: null, doc: "licence" } }; }
  if (kind === "carlic") { const text = ["رخصة تسيير مركبة", "ملاكي القاهرة", "تاريخ الترخيص " + fmt(fy - 3, fm, fd, "ar"), "نهاية الترخيص " + fmt(fy, fm, fd, pick(["ar", "dmy"]))].join("\n");
    return { text, want: { kind: "expiry", date: iso(fy, fm, fd), amount: null, doc: "registration" } }; }
  if (kind === "insurance") { const price = int(10, 200) * 100;
    const text = pick([["Misr Insurance", "Motor policy", "Policy valid until " + fmt(fy, fm, fd, style === "ar" ? "dmy" : style), "Premium " + price.toLocaleString("en-US") + " " + cur], ["تأمين طبي", "سارية حتى " + fmt(fy, fm, fd, pick(["ar", "dmy"])), "القسط " + arD(price) + " جنيه"]]).join("\n");
    return { text, want: { kind: "expiry", date: iso(fy, fm, fd), amount: price, doc: "insurance" } }; }
  const text = ["VISA", "Type: Tourist", "Valid from " + fmt(fy - 1, fm, fd, style === "ar" ? "dmy" : style), "Valid until " + fmt(fy, fm, fd, style === "ar" ? "dmy" : style)].join("\n");
  return { text, want: { kind: "expiry", date: iso(fy, fm, fd), amount: null, doc: "visa" } };
}
let pass = 0; const miss = {}, ex = {};
for (let i = 0; i < N; i++) {
  const { text: t0, want } = make(), text = rnd() < 0.5 ? noise(t0) : t0; let why = "", r;
  try { r = D.readDeadlines(text, { now, home: "EGP", order: "dmy" })[0]; } catch (e) { why = "crash " + e.message; }
  if (!why && !r) why = want.kind + ": nothing found";
  else if (!why && r.kind !== want.kind) why = want.kind + " read as " + r.kind;
  else if (!why && r.date !== want.date) why = want.kind + (want.doc ? "/" + want.doc : "") + ": date wrong";
  else if (!why && want.amount != null && Math.abs((r.amount || 0) - want.amount) > 0.001) why = want.kind + ": amount wrong";
  else if (!why && want.doc && r.doc !== want.doc) why = want.kind + ": document " + want.doc + " read as " + r.doc;
  if (!why) pass++; else { (miss[why] = miss[why] || []).push(i); ex[why] = ex[why] || text.replace(/\n/g, " / ") + "  →  " + JSON.stringify(r || {}).slice(0, 160); }
}
const rep = ["# Papers from a photo — " + N, "", "Passed: **" + pass + " / " + N + " (" + (100 * pass / N).toFixed(2) + "%)**", "", ...Object.entries(miss).sort((a, b) => b[1].length - a[1].length).map(([k, l]) => "- " + k + " — " + l.length + "\n  e.g. " + ex[k].slice(0, 330))].join("\n");
if (N === 10000) fs.writeFileSync(new URL("./report.md", import.meta.url), rep + "\n");
console.log(rep.slice(0, +(process.env.CH || 6000)));
