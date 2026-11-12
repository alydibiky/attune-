// v9.9.24 B6 X6 Kids & school: exactly 10,000 class-group messages (English, Egyptian Arabic with Arabic-Indic digits, French, Spanish,
// German, Turkish, Indonesian, Portuguese) — a greeting, then 1–4 of: an exam (an explicit date "15 Nov" / «١٥ نوفمبر» / "15/11", or a
// weekday), a fee with its amount and day, a trip, something to bring / uniform, a holiday, a meeting; sometimes a weekday that is TODAY's
// weekday (ambiguous), an exam with no day, a fee with no amount, "chapters 3-4". Checked: each thing found with the right kind, day and
// amount; the ambiguous / missing ones ASKED (never guessed); the greeting and other lines never become items.
const S = await import(process.env.X6 || "../../web-src/schoolmsg.js");
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const NOW = Date.parse("2026-11-12T12:00:00");   // a Thursday
const AR = (s) => String(s).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
const WD = { en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], ar: ["الأحد", "الاتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"],
  fr: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"], es: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
  de: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"], tr: ["pazar", "pazartesi", "salı", "çarşamba", "perşembe", "cuma", "cumartesi"],
  id: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"], pt: ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] };
const MON = { en: "Nov", ar: "نوفمبر", fr: "novembre", es: "noviembre", de: null, tr: null, id: null, pt: null };
const P = {   // [greeting, exam, fee, trip, bring, holiday, meeting, on-weekday, currency]
  en: ["Dear parents", "Math exam on {d}", "Trip fee {a} EGP by {d}", "School trip on {d}", "Please bring the lab coat on {d}", "No school on {d}", "Parents meeting on {d}", "{w}"],
  ar: ["السادة أولياء الأمور", "امتحان الرياضيات يوم {d}", "رسوم الرحلة {a} جنيه آخر ميعاد {d}", "رحلة المدرسة يوم {d}", "يجيبوا البالطو يوم {d}", "{d} أجازة", "اجتماع أولياء الأمور يوم {d}", "{w}"],
  fr: ["Chers parents", "Contrôle de maths le {d}", "Frais de sortie {a} euros à payer avant {d}", "Sortie au musée {d}", "Apporter la blouse {d}", "Pas d'école, férié le {d}", "Réunion des parents le {d}", "{w}"],
  es: ["Estimadas familias", "Examen de matemáticas el {d}", "Cuota de la excursión {a} euros, pagar antes del {d}", "Excursión al museo el {d}", "Traer el uniforme el {d}", "El {d} es feriado", "Reunión de padres el {d}", "{w}"],
  de: ["Liebe Eltern", "Mathe-Klassenarbeit am {d}", "Gebühr für den Ausflug {a} Euro bis {d} bezahlen", "Ausflug ins Museum am {d}", "Bitte die Sportkleidung am {d} mitbringen", "Am {d} schulfrei", "Elternabend am {d}", "{w}"],
  tr: ["Sayın veliler", "Matematik sınavı {d}", "Gezi ücreti {a} TL, {d} gününe kadar", "Müze gezisi {d}", "Önlüğü {d} getirin", "{d} tatil", "Veli toplantısı {d}", "{w}"],
  id: ["Yth. Bapak/Ibu", "Ulangan matematika hari {d}", "Biaya karyawisata {a} ribu, bayar sebelum {d}", "Karyawisata ke museum hari {d}", "Bawa seragam olahraga hari {d}", "Libur hari {d}", "Rapat orang tua hari {d}", "{w}"],
  pt: ["Prezados pais", "Prova de matemática na {d}", "Taxa do passeio {a} reais, pagar até {d}", "Passeio ao museu na {d}", "Levar o uniforme na {d}", "Feriado na {d}", "Reunião de pais na {d}", "{w}"],
};
const KINDS = ["exam", "fee", "trip", "bring", "holiday", "meeting"];
const iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
export function make(i) {
  const r = rng(i * 31 + 7), pick = (a) => a[Math.floor(r() * a.length)], lang = Object.keys(P)[i % 8], L = P[lang], ar = lang === "ar", want = [];
  const parts = [L[0]]; const n = 1 + Math.floor(r() * 4), used = new Set();
  for (let k = 0; k < n; k++) {
    let kind; do { kind = pick(KINDS); } while (used.has(kind)); used.add(kind);
    const form = Math.floor(r() * 10);   // 0–4 weekday (not today) · 5–6 explicit date · 7 weekday = today (ask) · 8 no day (ask, except bring)
    let d = "", date = null, ask = null;
    if (form <= 4 || (form >= 5 && form <= 6 && !MON[lang] && lang !== "en")) { const wd = [0, 1, 2, 3, 5, 6][Math.floor(r() * 6)]; d = WD[lang][wd]; const add = (wd - 4 + 7) % 7; date = iso(NOW + add * 864e5); }
    else if (form <= 6) { const day = 13 + Math.floor(r() * 15), mm = day > 30 ? 12 : 11, dd = day > 30 ? day - 30 : day;
      d = MON[lang] && r() < 0.6 ? (ar ? AR(dd) : dd) + " " + MON[lang] : (ar ? AR(dd + "/" + mm) : dd + "/" + mm); date = "2026-" + String(mm).padStart(2, "0") + "-" + String(dd).padStart(2, "0"); }
    else if (form === 7) { d = WD[lang][4]; date = iso(NOW); ask = "which"; }
    else { d = ""; ask = kind === "bring" ? null : "day"; }
    let amount = null; const noAmount = kind === "fee" && r() < 0.15;
    if (kind === "fee" && !noAmount) amount = 50 + Math.floor(r() * 900);
    const said = amount;   // what is written; Indonesian "316 ribu" means 316,000
    if (lang === "id" && amount != null) amount = amount * 1000;
    const idx = 1 + KINDS.indexOf(kind);
    // the amount after the comma ("Trip fee by Wednesday, it is 350 EGP") — it belongs to the same fee
    const LATER = { en: "Trip fee by {d}, it is {a} EGP", ar: "رسوم الرحلة آخر ميعاد {d}، المبلغ {a} جنيه", fr: "Frais de sortie avant {d}, montant {a} euros" };
    let tpl = kind === "fee" && LATER[lang] && r() < 0.4 ? LATER[lang] : L[idx];
    let line = tpl.replace("{a}", noAmount ? "" : ar ? AR(said) : said).replace("{d}", d).replace(/\s+/g, " ").trim();
    if (kind === "exam" && r() < 0.3) line += lang === "ar" ? " (الدروس ٣-٤)" : " (chapters 3-4)";
    if (kind !== "fee" && r() < 0.25) line += lang === "ar" ? " في فصل " + AR(200 + Math.floor(r() * 99)) : " in room " + (200 + Math.floor(r() * 99));   // a number that isn't money
    if (kind === "fee" && noAmount && !ask) ask = "amount";
    if (kind === "fee" && noAmount && ask) ask = ask;   // a day question comes first
    parts.push(line); want.push({ kind, date: ask === "day" ? null : date, amount, ask: kind === "fee" && noAmount && !ask ? "amount" : ask });
  }
  return { text: parts.join(lang === "ar" ? "، " : ". ") + ".", want, lang };
}
export function run(N = 10000, from = 0) {
  let pass = 0; const bad = [];
  for (let i = from; i < from + N; i++) {
    const c = make(i), got = S.readClassMessage(c.text, NOW), why = [];
    if (got.length !== c.want.length) why.push("found " + got.length + " ≠ " + c.want.length + " " + JSON.stringify(got.map((g) => g.kind)));
    else c.want.forEach((w, k) => { const g = got[k];
      if (g.kind !== w.kind) why.push(k + " kind " + g.kind + " ≠ " + w.kind);
      if (w.ask === "day") { if (g.ask !== "day") why.push(k + " no day but not asked (" + g.date + ")"); }
      else if (w.ask === "which") { if (g.ask !== "which") why.push(k + " today's weekday not asked"); }
      else if (g.date !== w.date) why.push(k + " date " + g.date + " ≠ " + w.date);
      if (w.kind === "fee") { if (w.amount == null ? g.ask == null : g.amount !== w.amount) why.push(k + " amount " + g.amount + " ≠ " + w.amount + " ask " + g.ask); }
      else if (g.amount != null) why.push(k + " an amount on a " + g.kind); });
    if (why.length) { if (bad.length < 8) bad.push({ i, lang: c.lang, text: c.text, why }); } else pass++;
  }
  return { pass, N, rate: pass / N, bad };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) console.log(JSON.stringify(run(+(process.argv[2] || 10000), +(process.argv[3] || 0))));
