/* ---- v9.9.24 B6 X6 Kids & school (Ali picked A+B combined — the child's page + "found in the class group" to tick, everything editable;
   OK'd 12 Nov). A class-group message → the school things in it: an exam / quiz, a fee to pay (with the amount), a trip, uniform or
   something to bring, a holiday / day off, a meeting — each with its day; what can't be known for sure is ASKED, never guessed:
   "Thursday" said on a Thursday (today, or next week?), an exam / trip / holiday with no day, a fee with no amount.
   Languages: English, Arabic (Egyptian + formal), French, Spanish, German, Turkish, Indonesian, Portuguese (the school languages of
   the 30 countries Attune knows). Days and amounts by braindump.js; explicit dates (15 Nov, ١٥ نوفمبر, 15/11) read here. Pure.
   Tests: tests/x6/gen.mjs (10,000 messages) + tests/unit/v9924x6.test.mjs. */
import { clauses, dayIn, amountIn, latinDigits } from "./braindump.js";
// (word starts / ends by letters, not \b — \b is ASCII-only, so «Önlüğü», "gezisi", "examen" need these)
const B0 = "(?<![\\p{L}])", W = (src) => new RegExp(src, "iu");
const KIND = [
  ["exam", W(B0 + "(exam|test|quiz|midterm|final|examen|contr[oô]le|interro|prueba|evaluaci[oó]n|pr[uü]fung|klassenarbeit|sınav|yazılı|ujian|ulangan|prova|avalia[cç][aã]o)|امتحان|اختبار|كويز|إمتحان")],
  ["fee", W(B0 + "(fees?|payment|pay|subscription|frais|payer|cotisation|cuota|pagar|pago|geb[uü]hr|bezahlen|[uü]cret|[oö]deme|biaya|bayar|iuran|taxa|pagamento)|رسوم|مصاريف|اشتراك|تدفع|يدفع|المبلغ")],
  ["trip", W(B0 + "(trip|excursion|outing|sortie|excursi[oó]n|salida|ausflug|klassenfahrt|gezi|karyawisata|darmawisata|passeio)|رحلة|رحله|زيارة")],
  ["bring", W(B0 + "(bring|uniform|lab coat|apron|costume|wear|apporter|tenue|blouse|uniforme|traer|llevar|mitbringen|sportkleidung|getir|önlü|forma|bawa|seragam|levar|trazer)|إحضار|احضار|يجيب|هات |يونيفورم|الزي|البالطو|بالطو|مريلة")],
  ["holiday", W(B0 + "(holiday|day off|no school|cong[eé]|vacances|f[eé]ri[eé]|pas d'[eé]cole|feriado|vacaciones|ferien|schulfrei|tatil|libur)|أجازة|اجازة|إجازة|عطلة|عطله|مفيش مدرسة")],
  ["meeting", W(B0 + "(meeting|parents'? evening|open day|r[eé]union|reuni[oó]n|elternabend|toplant|rapat|reuni[aã]o)|اجتماع|مجلس الآباء")],
];
// the weekdays (index 0 = Sunday) in the school languages — for "on Thursday" in each
const WDN = [["sunday", "sun", "الأحد", "الاحد", "dimanche", "domingo", "sonntag", "pazar", "minggu"], ["monday", "mon", "الاتنين", "الإثنين", "الاثنين", "lundi", "lunes", "montag", "pazartesi", "senin", "segunda"],
  ["tuesday", "tue", "tues", "التلات", "الثلاثاء", "mardi", "martes", "dienstag", "salı", "selasa", "terça", "terca"], ["wednesday", "wed", "الأربع", "الاربع", "الأربعاء", "الاربعاء", "mercredi", "miércoles", "miercoles", "mittwoch", "çarşamba", "rabu", "quarta"],
  ["thursday", "thu", "thurs", "الخميس", "jeudi", "jueves", "donnerstag", "perşembe", "kamis", "quinta"], ["friday", "fri", "الجمعة", "الجمعه", "vendredi", "viernes", "freitag", "cuma", "jumat", "sexta"],
  ["saturday", "sat", "السبت", "samedi", "sábado", "sabado", "samstag", "cumartesi", "sabtu"]];
function weekdayIn(s) { const t = s.toLowerCase(); let best = null;
  WDN.forEach((ns, i) => { for (const n of ns) { const re = new RegExp("(?<![\\p{L}])(?:ي?وم\\s|[بلو])?" + n + "(?:-feira)?(?![\\p{L}])", "iu"), m = re.exec(t); if (m && (!best || n.length > best.n.length)) best = { i, n, cut: m[0] }; } });
  return best; }
const GREETING = /^(dear|hello|hi|good (morning|evening)|السادة|السلام|الأعزاء|اعزائي|أعزائي|أولياء|صباح|مساء|chers?|bonjour|estimad|hola|liebe|sehr geehrte|sayın|merhaba|yth|bapak|ibu|prezad|ol[aá])\b|^السادة|^أولياء|^اولياء/i;
const MON = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  "يناير": 1, "فبراير": 2, "مارس": 3, "ابريل": 4, "أبريل": 4, "مايو": 5, "يونيو": 6, "يوليو": 7, "اغسطس": 8, "أغسطس": 8, "سبتمبر": 9, "اكتوبر": 10, "أكتوبر": 10, "نوفمبر": 11, "ديسمبر": 12,
  janvier: 1, "février": 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, "août": 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, "décembre": 12, decembre: 12,
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
/** An explicit date in the clause ("15 Nov", "Nov 15", «١٥ نوفمبر», "15/11", "le 15 novembre") → { date, rest } — the next one on or after today. */
export function explicitDate(s, now = Date.now()) {
  const t = latinDigits(s), today = new Date(now); today.setHours(12, 0, 0, 0);
  const at = (m, d) => { if (m < 1 || m > 12 || d < 1 || d > 31) return null; let y = today.getFullYear(), x = new Date(y, m - 1, d, 12); if (x.getMonth() !== m - 1) return null; if (x < today - 864e5 * 0.5) x = new Date(y + 1, m - 1, d, 12); return iso(x); };
  const names = Object.keys(MON).sort((a, b) => b.length - a.length).join("|");
  let m = new RegExp("(?<!\\d)(\\d{1,2})(?:st|nd|rd|th|er)?\\s*(?:de\\s+)?(" + names + ")(?![\\p{L}])", "iu").exec(t);   // (not \\b: ASCII-only, «١٦ نوفمبر»)
  if (m) { const d = at(MON[m[2].toLowerCase()], +m[1]); if (d) return { date: d, cut: m[0] }; }
  m = new RegExp("(?<![\\p{L}])(" + names + ")\\.?\\s*(\\d{1,2})(?!\\d)", "iu").exec(t);
  if (m) { const d = at(MON[m[1].toLowerCase()], +m[2]); if (d) return { date: d, cut: m[0] }; }
  m = /(?<![\d.])(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?(?![\d.])/.exec(t);
  if (m) { const d = at(+m[2], +m[1]); if (d) return { date: d, cut: m[0] }; }
  return null;
}
const iso2 = (t) => iso(new Date(t));
/** One message → [{ kind, title, date, amount, ask: null | "day" | "which" | "amount", src }] */
export function readClassMessage(text, now = Date.now()) {
  const out = [], today = new Date(now); today.setHours(12, 0, 0, 0); const todayIso = iso(today);
  let cur = null, curSi = -1;
  for (const { c: c0, si } of clauses(text, true)) {
    const c = c0.trim(); if (!c) continue;
    const k = KIND.find(([, re]) => re.test(c));
    if (!k && (GREETING.test(c) || si !== curSi || !cur)) continue;   // a greeting / a line about nothing
    // the day in this clause: an explicit date, else a weekday (today's weekday → ask), else braindump's words (tomorrow…)
    let date = null, ask = null, cut = "";
    const ex = explicitDate(c, now);
    if (ex) { date = ex.date; cut = ex.cut; }
    else { const w = weekdayIn(c);
      if (w) { const add = (w.i - today.getDay() + 7) % 7; date = iso2(today.getTime() + add * 864e5); cut = w.cut;
        if (add === 0 && !/today|this|النهارده|اليوم|aujourd'hui|hoy|heute|bugün|hari ini|hoje/i.test(c)) ask = "which"; }
      else { const d = dayIn(c, now); date = d.date; } }
    const money = () => { const v = amountIn(latinDigits(c).replace(latinDigits(cut), " ").replace(/(?<!\d)\d{1,2}\s*[-–]\s*\d{1,2}(?!\d)/g, " ").replace(/[٠-٩]{1,2}\s*[-–]\s*[٠-٩]{1,2}/g, " ")); return v; };
    if (k && !(cur && si === curSi && cur.kind === k[0])) {   // a new thing
      cur = { kind: k[0], title: c.replace(/\s+/g, " ").slice(0, 80), date, amount: k[0] === "fee" ? money() : null, ask, src: c }; curSi = si; out.push(cur);
    } else {   // more about the same thing ("…465 euros, pay before Monday")
      if (!cur.date && date) { cur.date = date; cur.ask = ask; }
      if (cur.kind === "fee" && cur.amount == null) cur.amount = money();
      cur.src += ", " + c;
    }
  }
  for (const x of out) { if (!x.date && !x.ask && x.kind !== "bring") x.ask = "day"; if (x.kind === "fee" && x.amount == null && !x.ask) x.ask = "amount"; }
  return out;
}
