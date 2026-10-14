/* ---- v6.27 Family Health Keeper — the logic (care-ui.jsx is the page) -----------------------------------------------------------
   Ali: "the code should be smart and strong enough so the app doesn't make mistakes". In health that means:
     - a dose is NEVER invented: a prescription line is read by code (name, strength, how much, how often, how long, before /
       after food); whatever isn't written is left empty and ASKED — the line it came from is shown next to it;
     - an interaction is shown ONLY when an official drug label (the offline "medicines" pack: openFDA labels) names the other
       medicine in its Interactions section — quoted, with its source — and always "ask your pharmacist";
     - a lab value is judged ONLY against the range printed on that report; no range → no judgement, just the trend;
     - no diagnosis, no advice: it reads, reminds and keeps the history.
   Store "attune:care:v1" = { members: [], meds: [], labs: [], taken: { "<medId>|<YYYY-MM-DD>|<HH:MM>": ms } }.
   Pure. Tests: tests/unit/v727care.test.mjs.                                                                                     */

const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/٫/g, ".").replace(/٬/g, ",");
const pad = (n) => String(n).padStart(2, "0");
export const isoDay = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

// ---- how often: the words and the abbreviations doctors write (Latin, English, Arabic, French, Spanish, German…) --------------------
// word edges that work for Arabic too (JavaScript's \b only knows ASCII)
const B = (src) => new RegExp("(?<![\\p{L}\\p{N}])(?:" + src + ")(?![\\p{L}\\p{N}])", "iu");
const NUMW = { one: 1, once: 1, two: 2, twice: 2, three: 3, thrice: 3, four: 4, "واحده": 1, "واحدة": 1, "مرتين": 2, "تلات": 3, "ثلاث": 3, "اربع": 4, "أربع": 4, une: 1, deux: 2, trois: 3, quatre: 4, una: 1, dos: 2, tres: 3, cuatro: 4, ein: 1, zwei: 2, drei: 3, vier: 4 };
const FREQ = [
  [B("q\\.?\\s?4\\s?h|every 4 hours?|كل 4 ساعات"), 6, "every 4 hours"], [B("q\\.?\\s?6\\s?h|every 6 hours?|كل 6 ساعات|toutes les 6 heures|cada 6 horas|alle 6 stunden"), 4, "every 6 hours"],
  [B("q\\.?\\s?8\\s?h|every 8 hours?|كل 8 ساعات|toutes les 8 heures|cada 8 horas|alle 8 stunden"), 3, "every 8 hours"], [B("q\\.?\\s?12\\s?h|every 12 hours?|كل 12 ساعه|كل 12 ساعة|toutes les 12 heures|cada 12 horas|alle 12 stunden"), 2, "every 12 hours"],
  [B("q\\.?i\\.?d|qds|four times (?:a |per |each )?(?:day|daily)|4 ?x ?(?:daily|a day|/day)|1 ?[x×*] ?4"), 4, "4 times a day"],
  [B("t\\.?i\\.?d|tds|t\\.d\\.s|thrice daily|3 ?x ?(?:daily|a day|/day)|1 ?[x×*] ?3"), 3, "3 times a day"],
  [B("b\\.?i\\.?d|b\\.d|bd|twice (?:a |per |each )?(?:day|daily)|2 ?x ?(?:daily|a day|/day)|1 ?[x×*] ?2"), 2, "twice a day"],
  [B("q\\.?h\\.?s|h\\.s|at bedtime|at night|before bed|قبل النوم|au coucher|al acostarse|zur nacht"), 1, "at bedtime"],
  [B("o\\.?d|q\\.?d|once (?:a |per )?day|once daily|daily|every day|1 ?[x×*] ?1|مره واحده|مرة واحدة|مره يوميا|مرة يوميا|يوميا|يومياً|une fois par jour|una vez al día|einmal täglich|1 ?mal täglich"), 1, "once a day"],
  [B("once (?:a |per )?week|weekly|مره في الاسبوع|مرة في الأسبوع|une fois par semaine|una vez a la semana|einmal wöchentlich"), "week", "once a week"],
];
const PRN = B("p\\.?r\\.?n|as needed|when needed|if needed|if required|عند اللزوم|عند الحاجه|عند الحاجة|si besoin|en caso necesario|bei bedarf");
// "3 times daily", "٣ مرات يوميا", "2 fois par jour", "dreimal täglich" — the count said in words or digits
const TIMES_RE = new RegExp("(?<![\\p{L}\\p{N}])(\\d|" + Object.keys(NUMW).join("|") + ")\\s*(?:times?|x|مرات|مره|مرة|fois|veces|vez|mal)\\s*(?:a |per |each |في |par |al |por |pro )?(?:day|daily|اليوم|يوميا|يومياً|jour|día|dia|tag|täglich)(?![\\p{L}])", "iu");
// the times each frequency means (waking hours; the person can move them)
const TIMES = { 1: ["09:00"], 2: ["09:00", "21:00"], 3: ["08:00", "14:00", "20:00"], 4: ["08:00", "12:00", "16:00", "20:00"], 6: ["06:00", "10:00", "14:00", "18:00", "22:00", "02:00"] };
const TIMES_EXACT = { "every 8 hours": ["06:00", "14:00", "22:00"], "every 12 hours": ["08:00", "20:00"], "every 6 hours": ["06:00", "12:00", "18:00", "00:00"], "at bedtime": ["22:00"] };
const FORM = /(?<![\p{L}])(tab(?:let)?s?|caps?(?:ule)?s?|pills?|sachets?|drops?|puffs?|sprays?|ml|cc|tsp|teaspoons?|tbsp|spoons?|ampoules?|amp|vials?|injections?|units?|iu|suppos(?:itory|itories)?|patch(?:es)?|قرص|اقراص|أقراص|كبسوله|كبسولة|كبسولات|نقط|نقطة|بخه|بخة|بخات|ملعقه|ملعقة|حقنه|حقنة|كيس|اكياس|comprimés?|gélules?|gouttes?|comprimidos?|cápsulas?|gotas|tabletten?|kapseln?|tropfen)(?![\p{L}])/iu;
const STRENGTH = /(\d+(?:[.,]\d{3})*(?:[.,]\d+)?)\s?(mg|mcg|µg|g|ml|iu|units?|%|mg\/ml|mg\/5\s?ml|ملجم|مجم|مللي|جرام)(?![\p{L}])/iu;
const DURATION = /(?:for|x|×|لمده|لمدة|مده|مدة|pendant|durante|für|per)\s*(\d{1,3}|one|two|a)\s*(days?|d|weeks?|wks?|months?|ايام|أيام|يوم|اسبوع|أسبوع|اسابيع|أسابيع|شهر|jours?|días?|tage?|giorni|semaines?|semanas?|wochen?)(?![\p{L}])/iu;

/** One prescription line → { name, strength, dose, form, freq, perDay, times, days, food, prn, raw, missing: [] }.
 *  Missing = what the person must fill in (never guessed). */
export function readRxLine(line) {
  const raw = String(line || "").trim(); if (!raw) return null;
  const t = latin(raw).replace(/\s+/g, " ").replace(/^(?:rx|r\/|\d{1,2}[.)]|[-•*])\s*/i, "");
  // the name: the words before the strength / the first number / the dose words
  const cut = t.search(/\d|\b(?:tab|cap|caps|pills?|drops?|syrup|susp|inj)\b|قرص|كبسول|نقط|حقن/i);
  let name = (cut > 0 ? t.slice(0, cut) : t.split(/[,;:–—-]/)[0]).replace(/^(?:rx|r\/|\d+[.)]|[-•*])\s*/i, "").replace(/\b(tab(?:let)?|cap(?:sule)?|syrup|susp(?:ension)?|inj(?:ection)?|cream|ointment|drops?|amp)\.?\s*$/i, "").replace(/[\s,:;-]+$/, "").trim();
  if (!/\p{L}{3,}/u.test(name)) return null;
  const st = STRENGTH.exec(t);
  const strength = st ? `${st[1].replace(/[.,](?=\d{3}\b)/g, ",").replace(/,(?=\d{1,2}$)/, ".")} ${st[2].toLowerCase().replace(/ملجم|مجم/, "mg")}` : "";
  // how much each time: "1 tab", "2 caps", "5 ml", "½ tablet", "قرص واحد"
  let dose = "";
  // "tab 1 x 2" / "1 x 2" — one each time, twice a day
  const nx = /(?:^|\s)(\d|½)\s?[x×*]\s?([1-4])(?!\d)/.exec(t.replace(STRENGTH, " "));
  const formWord = (FORM.exec(t.replace(STRENGTH, " ")) || [])[1];
  const d1 = /(\d+(?:[.,]\d+)?|½|¼|one|two|half|نص|نصف|واحد)\s*(tab(?:let)?s?|caps?(?:ule)?s?|pills?|sachets?|drops?|puffs?|sprays?|ml|tsp|teaspoons?|spoons?|units?|قرص|كبسوله|كبسولة|نقط|بخه|بخة|ملعقه|ملعقة|comprimés?|gélules?|gouttes?|comprimidos?|cápsulas?|gotas|tabletten?|kapseln?|tropfen)\b/i.exec(t.replace(STRENGTH, " "));
  if (d1 && !/^[x×*]/.test(t.slice(d1.index + d1[0].length).trim()) ) dose = `${{ one: "1", two: "2", half: "½", "نص": "½", "نصف": "½", "واحد": "1" }[d1[1].toLowerCase()] || d1[1].replace(",", ".")} ${d1[2].toLowerCase()}`;
  else if (nx && formWord) dose = `${nx[1]} ${formWord.toLowerCase()}`;
  else { const ar = /(?:^|\s)(قرص|كبسوله|كبسولة)(?:\s+واحد)?(?=\s|$)/.exec(t); if (ar) dose = "1 " + ar[1]; }
  // insulin and the like: "10 units" with nothing else saying how much IS the dose
  let strength2 = strength;
  if (!dose && /\bunits?$/i.test(strength) && !/\b(mg|mcg|g|iu)\b/i.test(t)) { dose = strength; strength2 = ""; }   // "units" (insulin), not "IU" (a vitamin's strength)
  // how often: the count in words or digits first ("3 times daily"), then the doctors' abbreviations
  let perDay = null, freq = "";
  const tc = TIMES_RE.exec(t);
  if (tc) { const n = /^\d$/.test(tc[1]) ? +tc[1] : NUMW[tc[1].toLowerCase()]; if (n >= 1 && n <= 6) { perDay = n; freq = n === 1 ? "once a day" : n === 2 ? "twice a day" : n + " times a day"; } }
  if (!freq && nx) { perDay = +nx[2]; freq = perDay === 1 ? "once a day" : perDay === 2 ? "twice a day" : perDay + " times a day"; }
  if (!freq) { const f = FREQ.find(([re]) => re.test(t)); if (f) { freq = f[2]; perDay = f[1] === "week" ? "week" : f[1]; } }
  const prn = PRN.test(t);
  if (prn) freq = freq ? freq + ", only when needed" : "only when needed";
  const du = DURATION.exec(t);
  let days = 0;
  if (du) { const n = /^\d/.test(du[1]) ? +du[1] : 1, u = du[2].toLowerCase(); days = /week|wk|اسبوع|أسبوع|اسابيع|أسابيع|semaine|semana|woche/.test(u) ? n * 7 : /month|شهر/.test(u) ? n * 30 : n; }
  const food = B("after (?:food|meals?|eating)|p\\.c\\.?|بعد الاكل|بعد الأكل|après les repas|después de las comidas|nach dem essen").test(t) ? "after food" : B("before (?:food|meals?|eating|breakfast)|a\\.c\\.?|on an empty stomach|empty stomach|قبل الاكل|قبل الأكل|على الريق|avant les repas|antes de las comidas|vor dem essen").test(t) ? "before food" : B("with (?:food|meals?)|مع الاكل|مع الأكل|pendant le repas|con las comidas|zum essen").test(t) ? "with food" : "";
  const times = prn || perDay === "week" ? [] : TIMES_EXACT[freq] || (perDay ? TIMES[perDay] || [] : []);
  const missing = [];
  if (!dose) missing.push("How much each time?");
  if (!freq) missing.push("How often?");
  // a dose that changes during the course ("2 tabs daily for 5 days then 1 tab daily…") is never simplified: the person checks it
  if (/(?<![\p{L}])(then|thereafter|after that|ثم|بعدين|بعد كده|puis|ensuite|luego|después|dann|danach|poi|sonra|lalu|kemudian)(?![\p{L}])/iu.test(t)) missing.push("The dose changes during the course — check each part with the prescription");
  return { name: name.slice(0, 60), strength: strength2, dose, freq, perDay, times, days, food, prn, raw, missing };
}
/** A whole prescription (typed or read from a photo) → its medicine lines (doctor / clinic / date lines skipped). */
export function readPrescription(text) {
  const SKIP = /^(dr\.?|doctor|clinic|hospital|date|patient|name|age|sex|diagnosis|tel|phone|address|signature|rx\s*$|د\.|دكتور|الدكتور|عيادة|مستشفى|التاريخ|الاسم|السن|العمر|التشخيص|توقيع)/i;
  const lines = latin(text).split(/\n+/).map((l) => l.trim()).filter((l) => l && !SKIP.test(l));
  // a medicine and its instructions may be on two lines: "Amoxicillin 500 mg caps" / "1 cap 3 times daily for 7 days"
  const merged = [];
  for (const l of lines) {
    const startsWithInstruction = !/^\d{1,2}[.)]\s/.test(l) && /^(\d+(?:[.,]\d+)?|½|one|two|take|sig|قرص|كبسوله|كبسولة|ملعقه|ملعقة)(?![\p{L}])/iu.test(l) && !/\b\d+\s?(mg|mcg|g|iu)\b/i.test(l.split(" ").slice(0, 2).join(" "));
    if (startsWithInstruction && merged.length) merged[merged.length - 1] += " " + l; else merged.push(l);
  }
  return merged.map(readRxLine).filter(Boolean);
}

// ---- doses: what is due today, taken, missed -------------------------------------------------------------------------------------
export function activeOn(m, day) {
  if (m.stopped) return false;
  if (m.start && day < m.start) return false;
  if (m.days > 0 && m.start) { const end = isoDay(Date.parse(m.start + "T12:00:00") + (m.days - 1) * 86400000); if (day > end) return false; }
  return true;
}
/** Today's doses for everyone: [{ med, member, time, key, taken, late }] in time order. */
export function dosesOn(data, now = Date.now()) {
  const day = isoDay(now), d = new Date(now), hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`, out = [];
  for (const m of data.meds || []) {
    if (!activeOn(m, day) || m.prn) continue;
    for (const t of m.times || []) {
      const key = `${m.id}|${day}|${t}`;
      out.push({ med: m, member: (data.members || []).find((x) => x.id === m.member) || null, time: t, key, taken: !!(data.taken || {})[key], late: !(data.taken || {})[key] && t < hhmm && hoursBetween(t, hhmm) >= 1 });
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}
const hoursBetween = (a, b) => { const [h1, m1] = a.split(":").map(Number), [h2, m2] = b.split(":").map(Number); return (h2 * 60 + m2 - h1 * 60 - m1) / 60; };
export const markTaken = (data, key, now = Date.now()) => ({ ...data, taken: { ...(data.taken || {}), [key]: (data.taken || {})[key] ? undefined : now } });
/** The reminders for a medicine: one daily reminder per time, ended by the page when the course is over. */
export function medReminders(m, member, now = Date.now()) {
  if (m.prn || m.stopped || !(m.times || []).length) return [];
  const who = member && member.name ? member.name + " · " : "";
  return m.times.map((t) => {
    const [h, mi] = t.split(":").map(Number); const d = new Date(now); d.setHours(h, mi, 0, 0); if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return { id: `med-${m.id}-${t.replace(":", "")}`, at: d.getTime(), repeat: "daily", title: `${who}${m.name}${m.strength ? " " + m.strength : ""}`, body: [m.dose, m.food].filter(Boolean).join(" · ") || "Time for your medicine" };
  });
}
/** Medicines whose course has ended (their reminders are removed). */
export const ended = (data, now = Date.now()) => (data.meds || []).filter((m) => m.days > 0 && m.start && !activeOn(m, isoDay(now)) && isoDay(now) > m.start);

// ---- interactions: ONLY what an official label says --------------------------------------------------------------------------------
const nameKey = (s) => String(s || "").toLowerCase().replace(/[^a-z\u0600-\u06ff ]/g, " ").replace(/\s+/g, " ").trim();
/** From the medicines pack's passages (title "Medicine — INGREDIENTS (INN) — Section"), the ingredient names of a medicine. */
export function ingredientsOf(passages, medName) {
  const key = nameKey(medName).split(" ")[0];
  const names = new Set([key]);
  for (const p of passages || []) {
    const m = /^Medicine — (.+?) — /.exec(p.title || ""); if (!m) continue;
    const hay = nameKey(m[1] + " " + (p.text || "").slice(0, 200));
    if (!hay.includes(key)) continue;
    for (const part of m[1].split(/,| and |\(|\)/)) { const w = nameKey(part); if (w && w.length > 3) names.add(w); }
    const brands = /\(brands?: ([^)]+)\)/i.exec(p.text || ""); if (brands && nameKey(brands[1]).includes(key)) for (const b of brands[1].split(/,\s*/)) { const w = nameKey(b); if (w.length > 3) names.add(w); }
  }
  return [...names];
}
/** Pairwise: a label's Interactions passage of medicine A that names medicine B → { a, b, quote, url, title }. Pure: passages given. */
export function interactions(meds, passagesByMed) {
  const out = [], seen = new Set();
  const ing = meds.map((m) => ({ m, names: ingredientsOf(passagesByMed[m.id] || [], m.name) }));
  for (const A of ing) for (const B of ing) {
    if (A === B) continue;
    const pairKey = [A.m.id, B.m.id].sort().join("|"); if (seen.has(pairKey)) continue;
    for (const p of passagesByMed[A.m.id] || []) {
      if (!/ — Interactions$/i.test(p.title || "")) continue;
      if (!A.names.some((n) => nameKey(p.title).includes(n))) continue;      // the passage is about A
      const text = p.text || "";
      const hit = B.names.find((n) => n.length > 3 && new RegExp("(?<![a-z])" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![a-z])", "i").test(text));
      if (!hit) continue;
      // the sentence that names it, quoted as written
      const sent = text.split(/(?<=[.!?])\s+/).find((s) => new RegExp("(?<![a-z])" + hit + "(?![a-z])", "i").test(s)) || text.slice(0, 240);
      out.push({ a: A.m.name, b: B.m.name, quote: sent.trim().slice(0, 400), url: p.url || "", title: p.title });
      seen.add(pairKey); break;
    }
  }
  return out;
}

// ---- lab results: read, flagged only against the report's own range ---------------------------------------------------------------
const LAB_ALIASES = [
  ["Haemoglobin", /\b(h(?:a)?emoglobin|hgb|hb)\b|الهيموجلوبين|هيموجلوبين/i], ["HbA1c", /\b(hba1c|a1c|glycated h(?:a)?emoglobin|glycosylated)\b|السكر التراكمي|التراكمي/i],
  ["Fasting glucose", /\b(fasting (?:blood )?(?:glucose|sugar)|fbs|fbg|glucose,? fasting)\b|سكر صائم|السكر الصائم/i], ["Glucose", /\b(glucose|blood sugar|rbs)\b|سكر عشوائي|السكر/i],
  ["Total cholesterol", /\b(total cholesterol|cholesterol,? total|cholesterol)\b|الكوليسترول/i], ["LDL", /\b(ldl(?:-c)?|ldl cholesterol)\b/i], ["HDL", /\b(hdl(?:-c)?|hdl cholesterol)\b/i],
  ["Triglycerides", /\b(triglycerides?|tg)\b|الدهون الثلاثية/i], ["Creatinine", /\b(creatinine|creat)\b|الكرياتينين/i], ["Urea", /\b(urea|bun)\b|اليوريا/i], ["Uric acid", /\b(uric acid)\b|حمض اليوريك/i],
  ["ALT", /\b(alt|sgpt)\b/i], ["AST", /\b(ast|sgot)\b/i], ["TSH", /\b(tsh)\b/i], ["Free T4", /\b(free t4|ft4)\b/i], ["Vitamin D", /\b(vitamin d|25[- ]?oh|25-hydroxy)\b|فيتامين د/i],
  ["Vitamin B12", /\b(vitamin b12|b12|cobalamin)\b/i], ["Ferritin", /\b(ferritin)\b|الفيريتين/i], ["Iron", /\b(serum iron|iron)\b|الحديد/i], ["WBC", /\b(wbc|white blood cells?|leukocytes?|tlc)\b|كرات الدم البيضاء/i],
  ["Platelets", /\b(platelets?|plt)\b|الصفائح/i], ["RBC", /\b(rbc|red blood cells?)\b|كرات الدم الحمراء/i], ["Sodium", /\b(sodium|na)\b|الصوديوم/i], ["Potassium", /\b(potassium|k)\b|البوتاسيوم/i],
  ["Calcium", /\b(calcium|ca)\b|الكالسيوم/i], ["CRP", /\b(crp|c-reactive protein)\b/i], ["PSA", /\b(psa)\b/i], ["INR", /\b(inr)\b/i],
];
/** v6.28: the lab test a question or line names ("my HbA1c", "السكر التراكمي") → its name, or "". */
export function labTestOf(text) { const a = LAB_ALIASES.find(([, re]) => re.test(String(text || ""))); return a ? a[0] : ""; }
const NUMRE = "(\\d+(?:[.,]\\d+)?)";
/** A lab report (text) → [{ test, value, unit, low, high, flag, raw }] — flag only from the printed range ("" if none). */
export function readLabs(text) {
  const out = [];
  for (const line0 of latin(text).split(/\n+/)) {
    const line = line0.trim(); if (!line || line.length > 160) continue;
    const a = LAB_ALIASES.find(([, re]) => re.test(line)); if (!a) continue;
    if (out.some((x) => x.test === a[0])) continue;   // the first (main) line of each test
    const after = line.slice(a[1].exec(line).index + a[1].exec(line)[0].length);
    const v = new RegExp("^[^\\d]{0,24}?" + NUMRE + "\\s*([a-zA-Zµμ/%^0-9.³]+(?:/[a-zA-Z0-9.³]+)?)?").exec(after);
    if (!v) continue;
    const value = +v[1].replace(",", ".");
    let unit = (v[2] || "").replace(/^[0-9.]+$/, "");
    const rest = after.slice(v.index + v[0].length);
    const range = new RegExp(NUMRE + "\\s*[-–—~to]+\\s*" + NUMRE).exec(rest) || new RegExp("(?:ref(?:erence)?|normal|range|المعدل الطبيعي|الطبيعي)[^\\d]{0,12}" + NUMRE + "\\s*[-–—~]\\s*" + NUMRE, "i").exec(rest);
    const lt = /(?:<|less than|up to|أقل من)\s*(\d+(?:[.,]\d+)?)/i.exec(rest), gt = /(?:>|more than|above|أكثر من)\s*(\d+(?:[.,]\d+)?)/i.exec(rest);
    const low = range ? +range[1].replace(",", ".") : gt ? +gt[1].replace(",", ".") : null;
    const high = range ? +range[2].replace(",", ".") : lt ? +lt[1].replace(",", ".") : null;
    const flag = low != null && value < low ? "low" : high != null && value > high ? "high" : low != null || high != null ? "in range" : "";
    out.push({ test: a[0], value, unit, low, high, flag, raw: line.slice(0, 160) });
  }
  return out;
}
/** A test's history for the trend: [{ date, value, unit, low, high }] with the same unit as the latest (other units left out). */
export function trendOf(labs, test) {
  const list = (labs || []).filter((x) => x.test === test).sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) return [];
  const unit = list[list.length - 1].unit;
  return list.filter((x) => (x.unit || "") === (unit || ""));
}

// ---- the store ----------------------------------------------------------------------------------------------------------------------
export const CARE_KEY = "attune:care:v1";
export const loadCare = (store = typeof localStorage !== "undefined" ? localStorage : null) => { try { const j = JSON.parse((store && store.getItem(CARE_KEY)) || "null"); return j && Array.isArray(j.meds) ? { members: [], labs: [], taken: {}, ...j } : { members: [], meds: [], labs: [], taken: {} }; } catch (e) { return { members: [], meds: [], labs: [], taken: {} }; } };
export const saveCare = (d, store = typeof localStorage !== "undefined" ? localStorage : null) => { try { store && store.setItem(CARE_KEY, JSON.stringify(d)); } catch (e) {} return d; };
const newId = (p, now = Date.now()) => p + now.toString(36) + Math.random().toString(36).slice(2, 5);
export const addMember = (d, m, now) => { const x = { id: newId("p", now), name: String(m.name || "").slice(0, 40), born: m.born || "", notes: String(m.notes || "").slice(0, 300) }; return { data: { ...d, members: [...d.members, x] }, item: x }; };
export const addMed = (d, m, now = Date.now()) => { const x = { id: newId("m", now), member: m.member || "", name: m.name, strength: m.strength || "", dose: m.dose || "", freq: m.freq || "", perDay: m.perDay || null, times: m.times || [], days: m.days || 0, food: m.food || "", prn: !!m.prn, start: m.start || isoDay(now), raw: m.raw || "", source: m.source || "typed", stock: +m.stock > 0 ? +m.stock : 0, stockAt: +m.stock > 0 ? now : 0 }; return { data: { ...d, meds: [...d.meds, x] }, item: x }; };
export const updateMed = (d, id, patch) => ({ ...d, meds: d.meds.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
export const removeMed = (d, id) => ({ ...d, meds: d.meds.filter((m) => m.id !== id) });
export const addLabs = (d, member, date, results) => ({ ...d, labs: [...d.labs, ...results.map((r) => ({ ...r, member, date }))] });

// ---- v6.28 insulin ↔ Fit & Food: supply left, low blood sugar, carb counts. NEVER a dose (that is the doctor's) -------------------
const INSULIN = /insulin|انسولين|أنسولين|lantus|toujeo|basaglar|abasaglar|semglee|levemir|tresiba|ryzodeg|xultophy|soliqua|novorapid|novolog|fiasp|humalog|admelog|lyumjev|apidra|actrapid|humulin|insulatard|novomix|mixtard|glargin|detemir|degludec|aspart|lispro|glulisine/i;
export const isInsulin = (m) => !!m && (INSULIN.test(m.name || "") || INSULIN.test(m.raw || ""));
/** The number in "10 units" / "1 tablet" / "½" (null when none). */
export const doseAmount = (m) => { const x = /(\d+(?:[.,]\d+)?)/.exec(latin((m && m.dose) || "")); return x ? +x[1].replace(",", ".") : /½|half|نص|نصف/i.test((m && m.dose) || "") ? 0.5 : null; };
/** How much is left: m.stock (units / tablets) minus every dose marked taken since m.stockAt. */
export function stockLeft(data, m) {
  if (!(m.stock > 0)) return null;
  const per = doseAmount(m) || 1; let used = 0;
  for (const [k, t] of Object.entries(data.taken || {})) if (t && k.startsWith(m.id + "|") && (!m.stockAt || t >= m.stockAt)) used += per;
  return Math.max(0, m.stock - used);
}
/** Days the supply lasts at the prescribed rate (null when unknown). */
export function daysOfSupply(data, m) {
  const left = stockLeft(data, m); if (left == null) return null;
  const perDay = (doseAmount(m) || 1) * Math.max(1, (m.times || []).length || m.perDay || 1);
  return Math.floor(left / perDay);
}
export const LOW_SUPPLY_DAYS = 5;
export const lowSupply = (data) => (data.meds || []).filter((m) => !m.stopped && !m.prn).map((m) => ({ med: m, days: daysOfSupply(data, m), left: stockLeft(data, m) })).filter((x) => x.days != null && x.days <= LOW_SUPPLY_DAYS);
/** The refill reminder: 10:00 the next morning (or in an hour if before 9:00), one per medicine, replaced whenever the count changes. */
export function supplyReminder(x, now = Date.now()) {
  const d = new Date(now); if (d.getHours() >= 9) { d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); } else d.setTime(now + 3600000);
  return { id: `supply-${x.med.id}`, at: d.getTime(), repeat: "none", title: `${x.med.name}: ${x.days <= 0 ? "running out today" : `about ${x.days} day${x.days === 1 ? "" : "s"} left`}`, body: "Time to get a refill from the pharmacy." };
}
/** Blood sugar in mg/dL from a reading (a value under 35 is taken as mmol/L). */
export const mgdl = (v, unit) => (/mmol/i.test(unit || "") || (!unit && v < 35) ? Math.round(v * 18) : Math.round(v));
export const addGlucose = (d, member, value, unit, now = Date.now()) => ({ ...d, labs: [...(d.labs || []), { test: "Glucose", value: +value, unit: unit || "mg/dL", low: null, high: null, flag: mgdl(+value, unit) < 70 ? "low" : "", member, date: isoDay(now), at: now, source: "quick" }] });
/** What Fit & Food needs to know: { onInsulin, insulins, low (supply), sugar: { value, mgdl, at, low } | null, takenToday }. */
export function insulinState(data, now = Date.now()) {
  const insulins = (data.meds || []).filter((m) => !m.stopped && isInsulin(m));
  const g = (data.labs || []).filter((x) => /glucose/i.test(x.test) && x.at).sort((a, b) => a.at - b.at).pop();
  const sugar = g && now - g.at < 6 * 3600000 ? { value: g.value, unit: g.unit, mgdl: mgdl(g.value, g.unit), at: g.at, low: mgdl(g.value, g.unit) < 70 } : null;
  const day = isoDay(now);
  const takenToday = insulins.flatMap((m) => (m.times || []).filter((t) => (data.taken || {})[`${m.id}|${day}|${t}`]).map((t) => ({ med: m, time: t, at: (data.taken || {})[`${m.id}|${day}|${t}`] })));
  return { onInsulin: insulins.length > 0, insulins, low: lowSupply(data).filter((x) => isInsulin(x.med)), sugar, takenToday };
}
/** Tips for the Food diary: [{ id, kind: "hypo" | "eat" | "supply" | "carbs", text, ar }]. carbsToday in grams; mealsAfter(ts) = meals logged since. */
export function insulinTips(state, { carbsToday = 0, mealsSince = () => 0, now = Date.now() } = {}) {
  if (!state || (!state.onInsulin && !(state.sugar && state.sugar.low))) return [];
  const out = [];
  if (state.sugar && state.sugar.low) out.push({ id: "hypo", kind: "hypo", text: `Blood sugar ${state.sugar.value} ${state.sugar.unit || ""} is low. Take 15 g of fast sugar now (½ cup of juice, 1 tablespoon of honey or 4 sugar cubes), check again in 15 minutes, repeat if still under 70 mg/dL. If you feel confused or faint, get help.`, ar: `السكر ${state.sugar.value} ${state.sugar.unit || ""} منخفض. تناول ١٥ جرامًا من سكر سريع الآن (نصف كوب عصير، أو ملعقة كبيرة عسل، أو ٤ مكعبات سكر)، ثم قِس مرة أخرى بعد ١٥ دقيقة، وكرّر إن ظل أقل من ٧٠. إن شعرت بدوخة أو تشوش فاطلب المساعدة.` });
  for (const x of state.takenToday) {
    const mins = (now - x.at) / 60000;
    if (mins >= 20 && mins <= 120 && !mealsSince(x.at)) out.push({ id: "eat-" + x.med.id + x.time, kind: "eat", text: `You marked ${x.med.name} taken at ${x.time} and no meal is logged since. If it is a mealtime insulin, eat now to avoid low blood sugar.`, ar: `سجّلت أخذ ${x.med.name} الساعة ${x.time} ولم تُسجَّل وجبة بعدها. إن كان إنسولين وجبات فتناول طعامك الآن لتجنب هبوط السكر.` });
  }
  for (const x of state.low) out.push({ id: "supply-" + x.med.id, kind: "supply", text: `${x.med.name}: ${x.days <= 0 ? "runs out today" : `about ${x.days} day${x.days === 1 ? "" : "s"} left`} (${x.left} units). Get a refill.`, ar: `${x.med.name}: ${x.days <= 0 ? "ينفد اليوم" : `يكفي نحو ${x.days} يوم`} (${x.left} وحدة). اشترِ عبوة جديدة.` });
  if (state.onInsulin && carbsToday > 0) out.push({ id: "carbs", kind: "carbs", text: `Carbohydrates today: ${Math.round(carbsToday)} g. Each meal shows its carbohydrates so you can match the insulin your doctor set.`, ar: `الكربوهيدرات اليوم: ${Math.round(carbsToday)} جم. تظهر كربوهيدرات كل وجبة لتطابقها مع جرعة الإنسولين التي حددها طبيبك.` });
  return out;
}
