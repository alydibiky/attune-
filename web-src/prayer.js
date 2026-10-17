/* ---- v6.32: prayer-aware planner (roadmap: "Prayer-aware planner and Ramadan mode across the apps") -----------------------
   1. The five prayer times by the sun's position, for any city (calculation methods used across the Muslim world; Egypt's by
      default in Egypt, Umm al-Qura in Saudi Arabia, etc.; Asr by shadow length 1 or 2).
   2. "Plan my day": the tasks you type («جيم ساعة، مذاكرة ساعتين، مكالمة ماما ربع ساعة», "groceries 30 min, gym 1h") are placed
      into the free time between prayers — each prayer keeps a short window free (Friday's Dhuhr a longer one for Jumu'ah), and in
      Ramadan Iftar and Taraweeh are kept free too. Each planned task can become a reminder.
   Pure; tests: tests/unit/v736prayer.test.mjs.                                                                                 */

const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
// [fajr angle, isha angle or minutes after maghrib ("90m")]
export const METHODS = {
  egypt: { name: "Egyptian General Authority of Survey", fajr: 19.5, isha: 17.5 },
  mwl: { name: "Muslim World League", fajr: 18, isha: 17 },
  makkah: { name: "Umm al-Qura, Makkah", fajr: 18.5, ishaMin: 90 },
  isna: { name: "ISNA (North America)", fajr: 15, isha: 15 },
  karachi: { name: "University of Islamic Sciences, Karachi", fajr: 18, isha: 18 },
  dubai: { name: "UAE", fajr: 18.2, isha: 18.2 },
  kuwait: { name: "Kuwait", fajr: 18, isha: 17.5 },
  qatar: { name: "Qatar", fajr: 18, ishaMin: 90 },
  turkey: { name: "Diyanet, Turkey", fajr: 18, isha: 17 },
  singapore: { name: "MUIS / JAKIM (Southeast Asia)", fajr: 20, isha: 18 },
};
/** The usual method for a time zone (the city's own authority), else the Muslim World League. */
export function methodFor(zone = "") {
  const z = String(zone);
  if (/Cairo/.test(z)) return "egypt";
  if (/Riyadh|Aden/.test(z)) return "makkah";
  if (/Dubai|Muscat/.test(z)) return "dubai";
  if (/Kuwait|Baghdad/.test(z)) return "kuwait";
  if (/Qatar|Bahrain/.test(z)) return "qatar";
  if (/Istanbul/.test(z)) return "turkey";
  if (/Karachi|Kolkata|Dhaka|Kabul/.test(z)) return "karachi";
  if (/Singapore|Kuala_Lumpur|Jakarta|Brunei|Makassar|Jayapura/.test(z)) return "singapore";
  if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Toronto|Vancouver|Phoenix|Detroit)/.test(z)) return "isna";
  return "mwl";
}

function sun(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const n = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 864e5);
  const g = (2 * Math.PI / 365) * (n - 1 + 0.5);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  return { eqt, decl };
}
const hourAngle = (lat, decl, altDeg) => { const c = (Math.sin(rad(altDeg)) - Math.sin(rad(lat)) * Math.sin(decl)) / (Math.cos(rad(lat)) * Math.cos(decl)); return c < -1 || c > 1 ? null : deg(Math.acos(c)) * 4; };
export const hm = (x) => (x == null ? "" : String(Math.floor((((x % 1440) + 1440) % 1440) / 60)).padStart(2, "0") + ":" + String(Math.round((((x % 1440) + 1440) % 1440) % 60) % 60).padStart(2, "0"));

/** The day's times as minutes after local midnight (+ "HH:MM"). tzMin: the local offset from UTC; asr: 1 (most schools) or 2 (Hanafi). */
export function prayerTimes(date, lat, lon, tzMin, { method = "mwl", asr = 1 } = {}) {
  const M = METHODS[method] || METHODS.mwl;
  const { eqt, decl } = sun(date);
  const noon = 720 - 4 * lon - eqt + tzMin;
  const at = (alt, evening) => { const h = hourAngle(lat, decl, alt); return h == null ? null : noon + (evening ? h : -h); };
  const sunrise = at(-0.833, false), maghrib = at(-0.833, true);
  const asrAlt = deg(Math.atan(1 / (asr + Math.tan(Math.abs(rad(lat) - decl)))));
  const t = { fajr: at(-M.fajr, false), sunrise, dhuhr: noon + 1, asr: at(asrAlt, true), maghrib, isha: M.ishaMin ? (maghrib == null ? null : maghrib + M.ishaMin) : at(-M.isha, true) };
  const out = {};
  for (const k of Object.keys(t)) { out[k] = t[k] == null ? null : Math.round(t[k]); out[k + "At"] = hm(out[k]); }
  return out;
}

// ---- tasks from a sentence ---------------------------------------------------------------------------------------------------
const AR_D = "٠١٢٣٤٥٦٧٨٩";
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => AR_D.indexOf(d));
/** "gym 1h, groceries 30 min, call mum 15m at 18:00" · «جيم ساعة، مذاكرة ساعتين، مكالمة ماما ربع ساعة» → [{ title, minutes, at }] */
export function parseTasks(text) {
  const parts = latin(text).split(/\s*(?:[,،;\n]|\band then\b|\bthen\b|\band\b|\bو(?=\S)|\s+و\s+|ثم|وبعدين)\s*/).map((x) => x.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    let minutes = 0, at = "";
    const atM = /(?:\bat\b|الساعه|الساعة|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|ص|م)?/i.exec(p);
    if (atM) { let h = +atM[1]; if (/pm|م/i.test(atM[3] || "") && h < 12) h += 12; if (/am|ص/i.test(atM[3] || "") && h === 12) h = 0; at = String(h).padStart(2, "0") + ":" + (atM[2] || "00"); }
    const q = p.replace(atM ? atM[0] : "", " ");
    let m;
    if ((m = /(\d+(?:\.\d+)?)\s*(?:h|hrs?|hours?|ساعات|ساعه|ساعة)\b/i.exec(q))) minutes += Math.round(+m[1] * 60);
    if ((m = /(\d+)\s*(?:m|min|mins|minutes?|دقيقه|دقيقة|دقايق|دقائق)(?![\p{L}])/iu.exec(q))) minutes += +m[1];
    if (!minutes) {
      if (/ساعتين/.test(q)) minutes = 120; else if (/ساعه ونص|ساعة ونص|ساعة ونصف/.test(q)) minutes = 90; else if (/نص ساعه|نص ساعة|نصف ساعة/.test(q)) minutes = 30;
      else if (/ربع ساعه|ربع ساعة/.test(q)) minutes = 15; else if (/(?:^|\s)ساعه|(?:^|\s)ساعة/.test(q)) minutes = 60;
      else if (/\bhalf an hour\b/i.test(q)) minutes = 30; else if (/\ban hour\b/i.test(q)) minutes = 60; else if (/\bquarter of an hour\b/i.test(q)) minutes = 15;
    }
    const title = q.replace(/(\d+(?:\.\d+)?)\s*(?:h|hrs?|hours?|m|min|mins|minutes?|ساعات|ساعه|ساعة|دقيقه|دقيقة|دقايق|دقائق)(?![\p{L}])/giu, " ")
      .replace(/ساعتين|ساعه ونص|ساعة ونص|ساعة ونصف|نص ساعه|نص ساعة|نصف ساعة|ربع ساعه|ربع ساعة|(?:^|\s)ساعه|(?:^|\s)ساعة|\bhalf an hour\b|\ban hour\b|\bfor\b|لمده|لمدة/gi, " ").replace(/\s+/g, " ").trim();
    if (title) out.push({ title, minutes: minutes || 30, at });
  }
  return out;
}

/** The busy windows on a day: each prayer keeps `pray` minutes free (Friday Dhuhr `jumuah`); Ramadan: Iftar and Taraweeh. */
export function prayerBlocks(times, { pray = 20, friday = false, jumuah = 60, ramadan = false } = {}) {
  const b = [];
  for (const k of ["fajr", "dhuhr", "asr", "maghrib", "isha"]) {
    if (times[k] == null) continue;
    const len = k === "dhuhr" && friday ? jumuah : k === "maghrib" && ramadan ? 60 : pray;
    b.push({ name: k === "maghrib" && ramadan ? "iftar" : k === "dhuhr" && friday ? "jumuah" : k, from: times[k] - (k === "dhuhr" && friday ? 15 : 0), to: times[k] + len });
    if (k === "isha" && ramadan) b.push({ name: "taraweeh", from: times[k] + len, to: times[k] + len + 60 });
  }
  return b.sort((a, c) => a.from - c.from);
}

/** Tasks → a plan for the day: fixed-time tasks first, the rest in order into the free gaps from `start` to `end` (minutes).
    → { plan: [{ title, from, to, fromAt, toAt, moved }], blocks, left: [tasks that didn't fit] } */
export function planDay(tasks, times, { start = 9 * 60, end = 22 * 60, gap = 10, now = null, ...opt } = {}) {
  const blocks = prayerBlocks(times, opt);
  const busy = blocks.map((x) => ({ ...x }));
  const plan = [], left = [];
  const clash = (f, t) => busy.find((x) => f < x.to && t > x.from);
  const s0 = Math.max(start, now != null ? Math.ceil(now / 5) * 5 : start);
  const place = (task, from, moved = false) => { const p = { title: task.title, from, to: from + task.minutes, moved }; plan.push(p); busy.push({ name: "task", from: p.from, to: p.to + gap }); };
  for (const task of tasks.filter((x) => x.at)) {
    const [h, m] = task.at.split(":").map(Number); let from = h * 60 + m;
    const c = clash(from, from + task.minutes);
    if (c && c.name !== "task") { from = c.to; place(task, from, true); } else place(task, from);
  }
  for (const task of tasks.filter((x) => !x.at)) {
    let from = s0, ok = false;
    for (let guard = 0; guard < 200 && from + task.minutes <= end; guard++) {
      const c = clash(from, from + task.minutes);
      if (!c) { ok = true; break; }
      from = c.to + (c.name === "task" ? 0 : 0);
    }
    if (ok) place(task, from); else left.push(task);
  }
  plan.sort((a, b) => a.from - b.from);
  return { plan: plan.map((p) => ({ ...p, fromAt: hm(p.from), toAt: hm(p.to) })), blocks: blocks.map((x) => ({ ...x, fromAt: hm(x.from), toAt: hm(x.to) })), left };
}
