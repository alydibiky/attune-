// v9.9.24 B6 X3 What I own: exactly 10,000 cases — 8,000 receipts (English, Egyptian Arabic with Arabic-Indic digits, French, Spanish,
// German, Turkish, Indonesian; dates 02/10/2026, 2026-10-02, 2.10.26, "2 Oct 2026"; thousands with , or ٬ or space; a TOTAL line
// or none; a VAT line; a warranty line or none; sometimes a second date ("return by …")) and 2,000 box labels (S/N, serial no.,
// «الرقم المسلسل», model, an IMEI that is right or has one digit wrong). Checked: the price is the TOTAL and "sure" only when a total
// line exists; the date is the receipt's and "sure" only when it is the only date; the warranty months; the item's name; the serial
// exactly; an IMEI only when its check digit is right.
const T = await import(process.env.X3 || "../../web-src/things.js");
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const NOW = Date.parse("2026-11-12T12:00:00");
const AR = (s) => String(s).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
const ITEMS = [["Samsung TV 55\"", "شاشة سامسونج ٥٥"], ["Toshiba washer 8kg", "غسالة توشيبا ٨ كيلو"], ["iPhone 15 128GB", "ايفون ١٥ ١٢٨ جيجا"], ["Dyson V8", "مكنسة دايسون"], ["Sharp AC 1.5HP", "تكييف شارب ١.٥ حصان"], ["Lenovo laptop", "لابتوب لينوفو"]];
const STORES = [["B.TECH Maadi", "بي تك المعادي"], ["Carrefour City Stars", "كارفور سيتي ستارز"], ["2B Computer", "توبي كمبيوتر"], ["Raya Shop", "راية شوب"]];
const LANG = { en: ["TOTAL", "VAT 14%", "Warranty {n} years", "Return by"], ar: ["الإجمالي", "ضريبة القيمة المضافة", "ضمان {n} سنين", "الاسترجاع حتى"], fr: ["TOTAL", "TVA 20%", "Garantie {n} ans", "Retour avant"],
  es: ["TOTAL", "IVA 21%", "Garantía {n} años", "Devolver antes"], de: ["Summe", "MwSt 19%", "Garantie {n} Jahre", "Rückgabe bis"], tr: ["TOPLAM", "KDV %20", "Garanti {n} yıl", "İade"], id: ["JUMLAH", "PPN 11%", "Garansi {n} tahun", "Retur s/d"] };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function luhnDigit(s14) { let sum = 0; for (let i = 0; i < 14; i++) { let d = +s14[i]; if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; } sum += d; } return (10 - (sum % 10)) % 10; }
export function make(i) {
  const r = rng(i * 7 + 13), pick = (a) => a[Math.floor(r() * a.length)];
  if (i % 5 === 4) {   // a box label
    const kind = Math.floor(r() * 4), serial = Array.from({ length: 10 + Math.floor(r() * 6) }, () => "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"[Math.floor(r() * 33)]).join("");
    let s14 = "35" + String(Math.floor(r() * 1e12)).padStart(12, "0"), imei = s14 + luhnDigit(s14), bad = r() < 0.3;
    if (bad) { const k = 2 + Math.floor(r() * 12); imei = imei.slice(0, k) + ((+imei[k] + 1 + Math.floor(r() * 8)) % 10) + imei.slice(k + 1); }
    const label = ["S/N: ", "Serial No. ", "الرقم المسلسل: ", "SN "][kind];
    const text = ["Model: UA55AU" + Math.floor(r() * 9000), label + serial, kind === 0 ? "IMEI " + imei : "Made in Egypt"].join("\n");
    return { box: true, text, serial, imei: kind === 0 && !bad ? imei : "" };
  }
  const lang = pick(Object.keys(LANG)), W = LANG[lang], ar = lang === "ar", it = pick(ITEMS), st = pick(STORES);
  const price = (500 + Math.floor(r() * 60000)) + (r() < 0.3 ? 0.5 : 0), d = new Date(NOW - Math.floor(r() * 700) * 864e5);
  const y = d.getFullYear(), m = d.getMonth() + 1, dd = d.getDate(), iso = y + "-" + String(m).padStart(2, "0") + "-" + String(dd).padStart(2, "0");
  const fmt = Math.floor(r() * 4), ds = [`${String(dd).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`, iso, `${dd}.${m}.${String(y).slice(2)}`, `${dd} ${MON[m - 1]} ${y}`][fmt];
  const money = (v) => { const s = v.toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); return ar ? AR(s).replace(/,/g, "٬").replace(/\./g, "٫") : r() < 0.2 ? s.replace(/,/g, " ") : s; };
  const hasTotal = r() < 0.85, wy = r() < 0.5 ? 1 + Math.floor(r() * 3) : 0, two = r() < 0.15;
  const L = [ar ? st[1] : st[0], "Tel 02" + Math.floor(10000000 + r() * 8e7), (ar ? "التاريخ " : "Date ") + (ar ? AR(ds) : ds), (ar ? it[1] : it[0]) + "  " + money(price)];
  if (r() < 0.6) L.push(W[1] + "  " + money(Math.round(price * 0.12)));
  if (hasTotal) L.push(W[0] + "  " + money(price));
  if (wy) L.push(W[2].replace("{n}", ar ? AR(wy) : wy));
  if (two) { const d2 = new Date(d.getTime() + 14 * 864e5); if (d2.getTime() < NOW) L.push(W[3] + " " + `${String(d2.getDate()).padStart(2, "0")}/${String(d2.getMonth() + 1).padStart(2, "0")}/${d2.getFullYear()}`); }
  const second = L.some((l) => l.startsWith(W[3]));
  return { box: false, lines: L, price, iso, hasTotal, wm: wy * 12, second, name: ar ? it[1] : it[0], lang };
}
export function run(N = 10000, from = 0) {
  let pass = 0; const bad = [];
  for (let i = from; i < from + N; i++) {
    const c = make(i), why = [];
    if (c.box) { const b = T.readBox(c.text); if (b.serial !== c.serial) why.push("serial " + b.serial + " ≠ " + c.serial); if (b.imei !== c.imei) why.push("imei " + b.imei + " ≠ " + c.imei); }
    else {
      const x = T.readReceipt(c.lines, NOW);
      if (c.hasTotal) { if (!(x.sure.price && Math.abs(x.price - c.price) < 0.01)) why.push("price " + x.price + (x.sure.price ? "" : "?") + " ≠ " + c.price); }
      else if (x.sure.price) why.push("no total line but price marked sure");
      if (c.second) { if (x.sure.date) why.push("two dates but date marked sure"); }
      else if (!(x.date === c.iso && x.sure.date)) why.push("date " + x.date + (x.sure.date ? "" : "?") + " ≠ " + c.iso);
      if (x.warrantyMonths !== c.wm) why.push("warranty " + x.warrantyMonths + " ≠ " + c.wm);
      if (!x.name || !c.name.replace(/[\d٠-٩".]+/g, "").trim().split(/\s+/).every((w) => !w || x.name.includes(w.replace(/[٠-٩]/g, "")) || x.name.includes(w))) why.push("name " + JSON.stringify(x.name) + " ≠ " + JSON.stringify(c.name));
    }
    if (why.length) { if (bad.length < 8) bad.push({ i, lang: c.lang, why, lines: c.lines }); } else pass++;
  }
  return { pass, N, rate: pass / N, bad };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) console.log(JSON.stringify(run(+(process.argv[2] || 10000), +(process.argv[3] || 0))));
