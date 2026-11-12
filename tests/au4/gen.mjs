// v9.9.25 B8 AU4 scheduled AI jobs: exactly 10,000 schedule sentences in the 20 languages (+ English) — weekly ("every Sunday 21:00",
// «كل يوم خميس», "jeden Montag", "her cuma", "每周一"… day names as each language writes them), daily ("every day at 07:30", «كل يوم الساعة»,
// "tous les jours", "每天"…), monthly on a day ("on the 25th", «يوم ٢٥ كل شهر», "le 31 de chaque mois", "25-го каждого месяца", "毎月25日"…,
// with the 29th–31st in short months) — with a time (HH:MM) or none (→ 21:00) and the job's words. Checked: the kind, the days, the day of
// the month, the time, and the next run (a separate calendar: the 31st in a 30-day month = its last day; never a run in the past).
const J = await import(process.env.AU4 || "../../web-src/jobs.js");
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const LOC = { en: "en-US", ar: "ar-EG", arb: "ar", es: "es-ES", fr: "fr-FR", de: "de-DE", pt: "pt-BR", it: "it-IT", ru: "ru-RU", tr: "tr-TR", id: "id-ID", hi: "hi-IN", ur: "ur-PK", fa: "fa-IR", bn: "bn-BD", sw: "sw-KE", th: "th-TH", vi: "vi-VN", zh: "zh-CN", ja: "ja-JP", ko: "ko-KR" };
const DAILY = { en: "every day", ar: "كل يوم", arb: "يوميًا", es: "todos los días", fr: "tous les jours", de: "jeden Tag", pt: "todos os dias", it: "ogni giorno", ru: "каждый день", tr: "her gün", id: "setiap hari", hi: "हर दिन", ur: "ہر روز", fa: "هر روز", bn: "প্রতিদিন", sw: "kila siku", th: "ทุกวัน", vi: "mỗi ngày", zh: "每天", ja: "毎日", ko: "매일" };
const MONTH = { en: "every month on the {n}th", ar: "يوم {n} كل شهر", arb: "يوم {n} من كل شهر", es: "el día {n} de cada mes", fr: "le {n} de chaque mois", de: "am {n}. jeden Monat", pt: "dia {n} todo mês", it: "il {n} di ogni mese",
  ru: "{n}-го каждый месяц", tr: "her ay ayın {n}'i", id: "setiap bulan tanggal {n}", hi: "हर महीने {n} तारीख", ur: "ہر مہینے {n} تاریخ", fa: "هر ماه {n} ام", bn: "প্রতি মাসে {n} তারিখ", sw: "kila mwezi tarehe {n}", th: "ทุกเดือน วันที่ {n}", vi: "hằng tháng ngày {n}", zh: "每月{n}号", ja: "毎月{n}日", ko: "매월 {n}일" };
const TASK = { en: "plan my week", ar: "خطط أسبوعي", arb: "خطط لأسبوعي", es: "planifica mi semana", fr: "planifie ma semaine", de: "plane meine Woche", pt: "planeje minha semana", it: "pianifica la mia settimana", ru: "спланируй мою неделю", tr: "haftamı planla",
  id: "rencanakan mingguku", hi: "मेरा हफ़्ता प्लान करो", ur: "میرا ہفتہ پلان کرو", fa: "هفته‌ام را برنامه‌ریزی کن", bn: "আমার সপ্তাহ সাজাও", sw: "panga wiki yangu", th: "วางแผนสัปดาห์ของฉัน", vi: "lên kế hoạch tuần", zh: "规划我的一周", ja: "今週の計画を立てて", ko: "내 한 주 계획해 줘" };
const AR = (s) => String(s).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
const pad = (n) => String(n).padStart(2, "0");
function dayName(lang, d, r) { if (lang === "ar" && r() < 0.5) return ["الحد", "الاتنين", "التلات", "الاربع", "الخميس", "الجمعة", "السبت"][d];
  const s = new Intl.DateTimeFormat(LOC[lang], { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 10, 1 + d))); return s; }
function oracle(kind, days, dom, h, m, now) {
  const base = new Date(now);
  for (let k = 0; k < 400; k++) { const x = new Date(base.getFullYear(), base.getMonth(), base.getDate() + k, h, m, 0, 0); if (x.getTime() <= now) continue;
    if (kind === "daily") return x.getTime();
    if (kind === "weekly" && days.includes(x.getDay())) return x.getTime();
    if (kind === "monthly") { const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); if (x.getDate() === Math.min(dom, last)) return x.getTime(); } }
  return null;
}
export function run(N = 10000, from = 0) {
  let pass = 0; const bad = [];
  const langs = Object.keys(LOC);
  for (let i = from; i < from + N; i++) {
    const r = rng(i * 37 + 9), lang = langs[i % langs.length], kind = ["weekly", "weekly", "daily", "monthly"][Math.floor(r() * 4)];
    const hasT = r() < 0.75, h = hasT ? Math.floor(r() * 24) : 21, m = hasT ? [0, 15, 30, 45][Math.floor(r() * 4)] : 0, tm = hasT ? pad(h) + ":" + pad(m) : "";
    const tmS = lang === "ar" && hasT && r() < 0.4 ? AR(tm) : tm;
    let days = [], dom = null, sched;
    if (kind === "weekly") { const d = Math.floor(r() * 7); days = [d]; sched = (lang === "ar" ? "كل يوم " : lang === "en" ? "every " : "") + dayName(lang, d, r); }
    else if (kind === "daily") sched = DAILY[lang];
    else { dom = 1 + Math.floor(r() * 31); sched = MONTH[lang].replace("{n}", lang === "ar" && r() < 0.5 ? AR(dom) : dom); }
    const text = r() < 0.5 ? [sched, tmS, TASK[lang]].filter(Boolean).join(" ") : [TASK[lang], sched, tmS].filter(Boolean).join(" ");
    const now = Date.parse("2026-" + pad(1 + Math.floor(r() * 12)) + "-" + pad(1 + Math.floor(r() * 28)) + "T" + pad(Math.floor(r() * 24)) + ":" + pad(Math.floor(r() * 60)) + ":00");
    const s = J.readSchedule(text), why = [];
    if (!s) why.push("no schedule");
    else {
      if (s.kind !== kind) why.push("kind " + s.kind + " ≠ " + kind);
      if (kind === "weekly" && JSON.stringify(s.days) !== JSON.stringify(days)) why.push("days " + s.days + " ≠ " + days);
      if (kind === "monthly" && s.dom !== dom) why.push("dom " + s.dom + " ≠ " + dom);
      if (s.at.h !== h || s.at.m !== m) why.push("time " + s.at.h + ":" + s.at.m + " ≠ " + h + ":" + m);
      if (!why.length) { const nx = J.nextRun(s, now), want = oracle(kind, days, dom, h, m, now); if (nx !== want) why.push("next " + new Date(nx).toString().slice(0, 21) + " ≠ " + new Date(want).toString().slice(0, 21)); }
    }
    if (why.length) { if (bad.length < 10) bad.push({ i, lang, text, why }); } else pass++;
  }
  return { pass, N, rate: pass / N, bad };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) console.log(JSON.stringify(run(+(process.argv[2] || 10000), +(process.argv[3] || 0))));
