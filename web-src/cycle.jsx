// Cycle — a private period tracker.
//
// Everything stays on the phone: the entries live in this app's own storage,
// are never added to the searchable Memory, and are never sent to the model
// unless the person types a log the phone could not read by itself (and
// then only that one sentence, to the model running on the phone).
//
// A log can be typed in plain words from Instant — "I got my period 2 hours
// ago and it was heavy", "الدورة نزلت امبارح بالليل وكانت خفيفة" — and lands
// on the right day of the calendar, with the flow and any symptoms.
import React, { useState, useMemo } from "react";
import { tr } from "./i18n.js";
import { CalendarDays, ChevronLeft, ChevronRight, Droplet, Trash2, ShieldCheck, Plus, X } from "lucide-react";

const KEY = "attune:cycle:v1";
const DAY = 86400000;

// ---- dates, always local calendar days ---------------------------------------
export function dayKey(d) {
  const x = new Date(d);
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
}
function fromKey(k) { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(k, n) { const d = fromKey(k); d.setDate(d.getDate() + n); return dayKey(d); }
function diffDays(a, b) { return Math.round((fromKey(b) - fromKey(a)) / DAY); }

// ---- storage -----------------------------------------------------------------
export function cycleLoad() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && v.days) return v;
  } catch (e) {}
  return { days: {}, settings: { cycleLen: 28, periodLen: 5 }, log: [] };
}
export function cycleSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} return s; }

// One record per calendar day: { flow: "spotting|light|medium|heavy"|null,
// symptoms: [], note, start: bool, end: bool, at: timestamp of the log }
export function cycleSetDay(state, key, patch) {
  const prev = state.days[key] || {};
  const next = { ...prev, ...patch };
  if (patch.symptoms) next.symptoms = Array.from(new Set([...(prev.symptoms || []), ...patch.symptoms]));
  const days = { ...state.days, [key]: next };
  if (!next.flow && !(next.symptoms || []).length && !next.note && !next.start && !next.end) delete days[key];
  return { ...state, days };
}
export function cycleClearDay(state, key) {
  const days = { ...state.days }; delete days[key];
  return { ...state, days };
}

// ---- periods and predictions -------------------------------------------------
// A period is a run of bleeding days (spotting on its own does not start one),
// allowing a gap of up to two days — a light day that went unlogged should not
// split one period into two.
export function periodsOf(state) {
  const keys = Object.keys(state.days).filter((k) => {
    const d = state.days[k];
    return d.flow && d.flow !== "spotting";
  }).sort();
  const out = [];
  for (const k of keys) {
    const last = out[out.length - 1];
    const forcedStart = state.days[k].start;
    if (last && !forcedStart && diffDays(last.end, k) <= 3 && !state.days[last.end].end) last.end = k;
    else out.push({ start: k, end: k });
  }
  return out.map((p) => ({ ...p, length: diffDays(p.start, p.end) + 1 }));
}

export function cycleStats(state, todayKey) {
  const periods = periodsOf(state);
  const lens = [];
  for (let i = 1; i < periods.length; i++) {
    const L = diffDays(periods[i - 1].start, periods[i].start);
    if (L >= 18 && L <= 60) lens.push(L);         // ignore obvious mis-logs
  }
  const recent = lens.slice(-6);
  const cycleLen = recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : (state.settings.cycleLen || 28);
  const plens = periods.slice(-6).map((p) => p.length).filter((n) => n >= 2 && n <= 10);
  const periodLen = plens.length ? Math.round(plens.reduce((a, b) => a + b, 0) / plens.length) : (state.settings.periodLen || 5);
  const variation = recent.length >= 3 ? Math.max(...recent) - Math.min(...recent) : null;
  const last = periods[periods.length - 1] || null;
  let nextStart = null, ovulation = null, fertile = null, cycleDay = null, inPeriod = false, late = 0;
  if (last) {
    nextStart = addDays(last.start, cycleLen);
    cycleDay = diffDays(last.start, todayKey) + 1;
    // Past the expected date with nothing logged: move the prediction to
    // today rather than showing a date in the past, and say it is late.
    if (diffDays(nextStart, todayKey) > 0) { late = diffDays(nextStart, todayKey); }
    ovulation = addDays(nextStart, -14);
    fertile = { from: addDays(ovulation, -5), to: addDays(ovulation, 1) };
    // In a period today: today falls inside the logged run, or the run was
    // logged up to yesterday and not marked as ended (bleeding days are often
    // logged the evening after).
    const endMarked = !!(state.days[last.end] || {}).end;
    const sinceStart = diffDays(last.start, todayKey);
    const sinceEnd = diffDays(last.end, todayKey);
    inPeriod = sinceStart >= 0 && sinceStart < 10 && (sinceEnd <= 0 || (!endMarked && sinceEnd <= 1));
  }
  return { periods, cycleLen, periodLen, variation, lens: recent, last, nextStart, ovulation, fertile, cycleDay, inPeriod, late, known: lens.length };
}

// What each calendar day should look like.
export function dayKind(state, stats, key, todayKey) {
  const d = state.days[key];
  if (d && d.flow) return { kind: d.flow === "spotting" ? "spotting" : "period", flow: d.flow, logged: true };
  if (!stats.last) return { kind: d ? "note" : "" };
  // Predict the next three cycles, from the day after today onward.
  if (diffDays(todayKey, key) >= 0) {
    for (let c = 0; c < 3; c++) {
      const s = addDays(stats.last.start, stats.cycleLen * (c + 1));
      const e = addDays(s, stats.periodLen - 1);
      if (diffDays(s, key) >= 0 && diffDays(key, e) >= 0) return { kind: "predicted" };
      const ov = addDays(s, -14);
      if (key === ov) return { kind: "ovulation" };
      if (diffDays(addDays(ov, -5), key) >= 0 && diffDays(key, addDays(ov, 1)) >= 0) return { kind: "fertile" };
    }
  }
  return { kind: d ? "note" : "" };
}

// ---- reading a log written in plain words -----------------------------------
const PERIOD_WORDS = /\b(period|periods|menstrua\w*|my cycle|spotting|pms|on my rag)\b|الدور[ةه]|البريود|الحيض|دورتي|العاده الشهري[ةه]|العادة الشهرية|الطمث/i;
const QUESTIONY = /(^|\s)(what|why|how|is it|is this|should i|can i|do i|does|when will|هل|ليه|ازاي|إزاي|امتى|إمتى|ايه|إيه)\b/i;

const NOT_A_LOG = /^(please\s+)?(summari[sz]e|translate|explain|rewrite|write|draft|what|why|how)\b|^(لخص|ترجم|اشرح|اكتب)|training|course|تدريبي|تدريبية|الدورة البرلمانية|الدورة الأولمبية|olympic/i;
export function looksLikePeriodLog(text) {
  const t = String(text || "").trim();
  if (!t || t.length > 400) return false;
  if (!PERIOD_WORDS.test(t)) return false;
  if (NOT_A_LOG.test(t)) return false;
  // "Is it normal to have a heavy period?" is a question for the model, not a log.
  if (/[?؟]\s*$/.test(t) && QUESTIONY.test(t)) return false;
  // It has to say something happened: a start, an end, a flow, a symptom.
  const p = parsePeriodText(t, Date.now());
  return p.sure;
}

const NUM_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  twelve: 12, couple: 2, few: 3, "واحد": 1, "واحدة": 1, "اتنين": 2, "اثنين": 2, "تلات": 3, "تلاتة": 3, "ثلاث": 3, "ثلاثة": 3,
  "اربع": 4, "أربع": 4, "اربعة": 4, "خمس": 5, "خمسة": 5, "ست": 6, "ستة": 6 };
const AR_DIGITS = { "٠": 0, "١": 1, "٢": 2, "٣": 3, "٤": 4, "٥": 5, "٦": 6, "٧": 7, "٨": 8, "٩": 9 };
const toLatinDigits = (s) => s.replace(/[٠-٩]/g, (c) => AR_DIGITS[c]);

// When did it happen? Returns a timestamp, and whether a time was actually said.
function whenOf(t, now) {
  const s = toLatinDigits(t.toLowerCase());
  let m;
  if ((m = s.match(/(\d+(?:\.\d+)?|an?|one|two|three|four|five|six|seven|eight|nine|ten|twelve|couple of|few)\s*(hours?|hrs?|h|minutes?|mins?|days?)\s*ago/))) {
    const n = Number(m[1]) || NUM_WORDS[m[1].replace(" of", "")] || 1;
    const u = m[2][0] === "d" ? DAY : m[2][0] === "m" ? 60000 : 3600000;
    return { at: now - n * u, said: true };
  }
  // Egyptian / Arabic: "من ساعتين", "من ٣ ساعات", "من يومين", "من ساعة", "من نص ساعة"
  if (/(من|بقالها|بقالي|قبل)\s*(نص|نصف)\s*ساع/.test(s)) return { at: now - 1800000, said: true };
  if ((m = s.match(/(?:من|بقالها|بقالي|قبل)\s*(\d+|[؀-ۿ]+)?\s*(ساعتين|يومين|ساعات|ساعة|ساعه|أيام|ايام|يوم|دقايق|دقائق|دقيقة)/))) {
    const unit = m[2];
    let n = m[1] && /\d/.test(m[1]) ? Number(m[1]) : (m[1] && NUM_WORDS[m[1]]) || 1;
    if (unit === "ساعتين" || unit === "يومين") n = 2;
    const u = /يوم|أيام|ايام/.test(unit) ? DAY : /دق/.test(unit) ? 60000 : 3600000;
    return { at: now - n * u, said: true };
  }
  const d = new Date(now);
  const at = (daysBack, hour) => { const x = new Date(d); x.setDate(x.getDate() - daysBack); if (hour != null) x.setHours(hour, 0, 0, 0); return x.getTime(); };
  if (/day before yesterday|اول امبارح|أول امبارح|أول أمس|اول امس/.test(s)) return { at: at(2, 12), said: true };
  if (/last night|امبارح بالليل|امس بالليل|أمس بالليل|ليلة امبارح/.test(s)) return { at: at(1, 22), said: true };
  if (/yesterday|امبارح|أمس|امس/.test(s)) return { at: at(1, 12), said: true };
  if (/this morning|الصبح|صباح النهارده|النهارده الصبح/.test(s)) return { at: at(0, 8), said: true };
  if (/tonight|this evening|بالليل/.test(s)) return { at: at(0, 20), said: true };
  if (/today|النهارده|النهاردة|اليوم/.test(s)) return { at: now, said: true };
  const wd = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const wdAr = ["الحد", "الاتنين", "التلات", "الاربع", "الخميس", "الجمعة", "السبت"];
  for (let i = 0; i < 7; i++) {
    if (new RegExp("\\b(on |last )?" + wd[i] + "\\b").test(s) || s.includes("يوم " + wdAr[i])) {
      let back = (d.getDay() - i + 7) % 7; if (back === 0) back = 7;
      return { at: at(back, 12), said: true };
    }
  }
  return { at: now, said: false };
}

function flowOf(s) {
  if (/spotting|spot\b|brown discharge|تنقيط|نقط/.test(s)) return "spotting";
  if (/\bheavy|very heavy|a lot|flooding|soaked|غزير|غزيرة|كتير|كثير|جامد|جامدة|تقيل|تقيلة/.test(s)) return "heavy";
  if (/\blight|little|barely|خفيف|خفيفة|قليل|قليلة|بسيط|بسيطة/.test(s)) return "light";
  if (/\bmedium|normal|moderate|regular|متوسط|متوسطة|عادي|عادية/.test(s)) return "medium";
  return null;
}
const SYMPTOMS = [
  ["cramps", /cramp|مغص|تقلص|تقلصات|وجع بطن|ألم في البطن/],
  ["headache", /headache|migraine|صداع|وجع راس|وجع رأس/],
  ["back pain", /back ?pain|backache|ضهري|ظهري|وجع ضهر/],
  ["bloating", /bloat|انتفاخ|نفخة/],
  ["tired", /tired|fatigue|exhausted|تعبانة|تعب|ارهاق|إرهاق/],
  ["mood", /mood|irritable|sad|anxious|cranky|مزاج|عصبية|متضايقة|زهقانة/],
  ["nausea", /nause|sick to my stomach|غثيان|ترجيع/],
  ["acne", /acne|pimple|breakout|حبوب|حب الشباب/],
  ["tender breasts", /tender breast|sore breast|breast pain|ألم الصدر|وجع صدر/],
];
export const SYMPTOM_LIST = SYMPTOMS.map((x) => x[0]);

// Read a log. Returns { event: start|end|flow|spotting|symptom, at, flow,
// symptoms, sure } — `sure` is false when the phone could not tell what
// happened and the model should read it instead.
export function parsePeriodText(text, now) {
  const s = toLatinDigits(String(text || "").toLowerCase());
  const when = whenOf(s, now || Date.now());
  const flow = flowOf(s);
  const symptoms = SYMPTOMS.filter(([, re]) => re.test(s)).map(([k]) => k);
  let event = null;
  if (/(ended|stopped|finished|is over|went away|done with)\b|خلصت|وقفت|انتهت|راحت/.test(s)) event = "end";
  else if (/\b(got|get|started|start|came|began|arrived|begun)\b.*\b(period|menstrua)|period (has )?(started|came|began|arrived|is here|just started)|نزلت|نزل|جات|جاتلي|جت|بدأت|بدات|ابتدت|جاتني/.test(s)) event = "start";
  else if (flow === "spotting") event = "spotting";
  else if (/\b(on|having|have|still on)\b.{0,6}\b(my|a|the)?\s*period|عندي الدور|انا في الدور|أنا في الدور|لسه الدور/.test(s)) event = "flow";
  else if (flow) event = "flow";
  else if (symptoms.length) event = "symptom";
  const sure = !!event;
  return { event: event || "flow", at: when.at, timeSaid: when.said, flow: flow === "spotting" ? "spotting" : flow, symptoms, sure };
}

// Apply a parsed log to the tracker. Returns the new state and a sentence
// saying what was recorded, so the person can see it was read correctly.
export function applyPeriodLog(state, p) {
  const key = dayKey(p.at);
  const time = new Date(p.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const dateText = new Date(p.at).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
  let next = state, title = "", detail = "";
  const flow = p.flow || (p.event === "start" ? "medium" : null);
  const flowWord = { spotting: "spotting", light: "light flow", medium: "medium flow", heavy: "heavy flow" };
  if (p.event === "start") {
    next = cycleSetDay(next, key, { flow: flow, start: true, end: false, at: p.at, symptoms: p.symptoms });
    title = "Period logged — started " + dateText;
    detail = "Started around " + time + " · " + (flowWord[flow] || "flow") + (p.symptoms.length ? " · " + p.symptoms.join(", ") : "") +
      (p.flow ? "" : "\nFlow wasn't mentioned, so it's set to medium — tap the day in Cycle to change it.");
  } else if (p.event === "end") {
    const st = cycleStats(state, key);
    const endKey = st.last && diffDays(st.last.end, key) >= 0 ? key : key;
    next = cycleSetDay(next, endKey, { flow: (state.days[endKey] || {}).flow || "light", end: true, at: p.at });
    title = "Period end logged — " + dateText;
    detail = st.last ? "This period lasted " + (diffDays(st.last.start, endKey) + 1) + " days." : "";
  } else if (p.event === "spotting") {
    next = cycleSetDay(next, key, { flow: "spotting", at: p.at, symptoms: p.symptoms });
    title = "Spotting logged — " + dateText;
  } else if (p.event === "symptom") {
    next = cycleSetDay(next, key, { symptoms: p.symptoms, at: p.at });
    title = "Logged for " + dateText;
    detail = p.symptoms.join(", ");
  } else {
    next = cycleSetDay(next, key, { flow: flow || "medium", at: p.at, symptoms: p.symptoms });
    title = "Flow logged — " + dateText;
    detail = (flowWord[flow || "medium"]) + (p.symptoms.length ? " · " + p.symptoms.join(", ") : "");
  }
  const st2 = cycleStats(next, dayKey(Date.now()));
  if (st2.nextStart) detail += (detail ? "\n" : "") + "Next period expected around " + fromKey(st2.nextStart).toLocaleDateString([], { day: "numeric", month: "long" }) + ".";
  return { state: next, key, title, detail };
}

// The prompt used only when the phone could not read a log by itself.
export function periodExtractPrompt(text, now) {
  return `Read this personal period-tracker note and extract what happened. Output ONLY one line of JSON, nothing else:
{"event":"start|end|flow|spotting|symptom","hours_ago":<number, 0 if now>,"flow":"light|medium|heavy|spotting|null","symptoms":[<any of: ${SYMPTOM_LIST.join(", ")}>]}

Now is ${new Date(now).toString()}.

Note: ${text}`;
}
export function parseExtract(raw, now) {
  const m = String(raw || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const ev = ["start", "end", "flow", "spotting", "symptom"].includes(j.event) ? j.event : "flow";
    const h = Math.max(0, Math.min(24 * 14, Number(j.hours_ago) || 0));
    const fl = ["light", "medium", "heavy", "spotting"].includes(j.flow) ? j.flow : null;
    const sy = Array.isArray(j.symptoms) ? j.symptoms.filter((x) => SYMPTOM_LIST.includes(x)) : [];
    return { event: ev, at: now - h * 3600000, flow: fl, symptoms: sy, sure: true };
  } catch (e) { return null; }
}

// ---- the screen ----------------------------------------------------------------
const FLOW_BG = { spotting: "bg-rose-300/30 text-rose-100", light: "bg-rose-400/40 text-white", medium: "bg-rose-500/70 text-white", heavy: "bg-rose-600 text-white" };
const FLOWS = [["spotting", "Spotting"], ["light", "Light"], ["medium", "Medium"], ["heavy", "Heavy"]];

export function CycleTab({ cycle, setCycle, flash, goInstant }) {
  const todayKey = dayKey(Date.now());
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState(null);           // selected day key for editing
  const stats = useMemo(() => cycleStats(cycle, todayKey), [cycle, todayKey]);
  const upd = (fn) => setCycle((c) => cycleSave(fn(c)));

  const grid = useMemo(() => {
    const first = new Date(month);
    const startPad = (first.getDay() + 1) % 7;     // weeks start on Saturday, as in Egypt
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(dayKey(new Date(first.getFullYear(), first.getMonth(), d)));
    return cells;
  }, [month]);

  const headline = (() => {
    if (!stats.last) return { big: "Log your first period", small: "Tap a day below, or type it in Instant: “my period started yesterday, light”." };
    if (stats.inPeriod) {
      const d = diffDays(stats.last.start, todayKey) + 1;
      return { big: "Period · day " + d, small: "Usually lasts about " + stats.periodLen + " days for you." };
    }
    if (stats.late > 0) return { big: stats.late + " day" + (stats.late === 1 ? "" : "s") + " late", small: "Expected " + fromKey(stats.nextStart).toLocaleDateString([], { day: "numeric", month: "long" }) + ". Cycles vary — a few days either way is common." };
    const inN = diffDays(todayKey, stats.nextStart);
    return { big: "Next period in " + inN + " day" + (inN === 1 ? "" : "s"),
      small: fromKey(stats.nextStart).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }) + " · cycle day " + stats.cycleDay };
  })();

  const selDay = sel ? cycle.days[sel] || {} : null;
  const cellStyle = (k) => {
    const dk = dayKind(cycle, stats, k, todayKey);
    if (dk.kind === "period" || dk.kind === "spotting") return FLOW_BG[dk.flow] || FLOW_BG.medium;
    if (dk.kind === "predicted") return "border border-dashed border-rose-400/70 text-rose-200";
    if (dk.kind === "ovulation") return "bg-teal-500/40 text-white";
    if (dk.kind === "fertile") return "bg-teal-500/15 text-teal-100";
    return "text-slate-300";
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <section className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
        <p className="text-xs uppercase tracking-wider text-rose-300/80 flex items-center gap-1.5"><Droplet size={13} /> {tr("Cycle")}</p>
        <p className="text-2xl text-white font-semibold mt-1">{headline.big}</p>
        <p className="text-sm text-slate-400 mt-1 leading-snug">{headline.small}</p>
        {stats.last ? (
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-slate-950 rounded-xl p-2.5"><p className="text-[10px] text-slate-500">{tr("Cycle")}</p><p className="text-sm text-slate-100">{stats.cycleLen} days{stats.known ? "" : tr(" (default)")}</p></div>
            <div className="bg-slate-950 rounded-xl p-2.5"><p className="text-[10px] text-slate-500">{tr("Period")}</p><p className="text-sm text-slate-100">{stats.periodLen} days</p></div>
            <div className="bg-slate-950 rounded-xl p-2.5"><p className="text-[10px] text-slate-500">{tr("Fertile window")}</p><p className="text-sm text-slate-100">{stats.fertile ? fromKey(stats.fertile.from).toLocaleDateString([], { day: "numeric", month: "short" }) + "–" + fromKey(stats.fertile.to).getDate() : "—"}</p></div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {!stats.inPeriod ? (
            <button onClick={() => { upd((c) => cycleSetDay(c, todayKey, { flow: "medium", start: true, at: Date.now() })); flash(tr("Period started today")); }}
              className="px-3 py-2 rounded-lg bg-rose-500 text-white text-sm font-medium active:scale-95">{tr("Period started today")}</button>
          ) : (
            <button onClick={() => { upd((c) => cycleSetDay(c, todayKey, { flow: (c.days[todayKey] || {}).flow || "light", end: true, at: Date.now() })); flash(tr("Marked as ended today")); }}
              className="px-3 py-2 rounded-lg bg-slate-700 text-white text-sm font-medium active:scale-95">{tr("Period ended today")}</button>
          )}
          <button onClick={() => setSel(todayKey)} className="px-3 py-2 rounded-lg border border-slate-700 text-slate-200 text-sm">{tr("Log today")}</button>
          <button onClick={goInstant} className="px-3 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm">{tr("Type it instead")}</button>
        </div>
        {stats.variation != null && stats.variation > 9 ? (
          <p className="text-[11px] text-amber-300/80 mt-3 leading-snug">{tr("Your last cycles differed by")} {stats.variation} {tr("days, so predictions are rough. If cycles are often very irregular, it's worth mentioning to a doctor.")}</p>
        ) : null}
      </section>

      {/* calendar */}
      <section className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="att-icon-btn"><ChevronLeft size={18} className="rtl:rotate-180" /></button>
          <p className="text-sm text-slate-200 font-medium">{month.toLocaleDateString([], { month: "long", year: "numeric" })}</p>
          <button onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="att-icon-btn"><ChevronRight size={18} className="rtl:rotate-180" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["Sa", "Su", "Mo", "Tu", "We", "Th", "Fr"].map((d) => <span key={d} className="text-[10px] text-slate-500 py-1">{tr(d)}</span>)}
          {grid.map((k, i) => k ? (
            <button key={k} onClick={() => setSel(k)}
              className={`aspect-square rounded-lg text-sm flex flex-col items-center justify-center relative ${cellStyle(k)} ${k === todayKey ? "ring-2 ring-white/70" : ""} ${sel === k ? "outline outline-2 outline-teal-400" : ""}`}>
              {fromKey(k).getDate()}
              {(cycle.days[k] && (cycle.days[k].symptoms || []).length) ? <span className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-300" /> : null}
            </button>
          ) : <span key={"p" + i} />)}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-500/70" /> {tr("Period")}</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-dashed border-rose-400" /> {tr("Expected")}</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-teal-500/15" /> {tr("Fertile")}</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-teal-500/40" /> {tr("Ovulation (est.)")}</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-300" /> {tr("Symptoms")}</span>
        </div>
      </section>

      {/* edit one day */}
      {sel ? (
        <section className="bg-slate-900 rounded-2xl border border-teal-800/60 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-100 font-medium">{fromKey(sel).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}</p>
            <button onClick={() => setSel(null)} className="att-icon-btn"><X size={16} /></button>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 mb-1.5">{tr("Flow")}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {FLOWS.map(([k, l]) => (
              <button key={k} onClick={() => upd((c) => cycleSetDay(c, sel, { flow: selDay.flow === k ? null : k }))}
                className={`py-2 rounded-lg text-xs border ${selDay.flow === k ? "border-rose-400 " + FLOW_BG[k] : "border-slate-800 bg-slate-950 text-slate-300"}`}>{tr(l)}</button>
            ))}
          </div>
          <div className="flex gap-1.5 mt-2">
            <button onClick={() => upd((c) => cycleSetDay(c, sel, { start: !selDay.start, flow: selDay.flow || "medium" }))}
              className={`flex-1 py-2 rounded-lg text-xs border ${selDay.start ? "border-rose-400 text-rose-200" : "border-slate-800 text-slate-400"}`}>{tr("First day of a period")}</button>
            <button onClick={() => upd((c) => cycleSetDay(c, sel, { end: !selDay.end }))}
              className={`flex-1 py-2 rounded-lg text-xs border ${selDay.end ? "border-slate-400 text-slate-100" : "border-slate-800 text-slate-400"}`}>{tr("Last day")}</button>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 mb-1.5">{tr("Symptoms")}</p>
          <div className="flex flex-wrap gap-1.5">
            {SYMPTOM_LIST.map((sy) => {
              const on = (selDay.symptoms || []).includes(sy);
              return (
                <button key={sy} onClick={() => upd((c) => {
                  const cur = (c.days[sel] || {}).symptoms || [];
                  const days = { ...c.days, [sel]: { ...(c.days[sel] || {}), symptoms: on ? cur.filter((x) => x !== sy) : [...cur, sy] } };
                  return { ...c, days };
                })} className={`text-xs px-2.5 py-1.5 rounded-lg border ${on ? "border-amber-400 text-amber-200 bg-amber-500/10" : "border-slate-800 text-slate-400"}`}>{tr(sy)}</button>
              );
            })}
          </div>
          <input value={selDay.note || ""} onChange={(e) => upd((c) => ({ ...c, days: { ...c.days, [sel]: { ...(c.days[sel] || {}), note: e.target.value } } }))}
            placeholder={tr("Note (optional)")} dir="auto"
            className="w-full mt-3 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500" />
          {cycle.days[sel] ? (
            <button onClick={() => { upd((c) => cycleClearDay(c, sel)); flash(tr("Day cleared")); }} className="mt-3 text-xs text-slate-500 flex items-center gap-1"><Trash2 size={12} /> {tr("Clear this day")}</button>
          ) : null}
        </section>
      ) : null}

      {/* history */}
      {stats.periods.length ? (
        <section className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">{tr("History")}</p>
          <div className="space-y-1">
            {stats.periods.slice().reverse().slice(0, 8).map((p, i, arr) => {
              const prev = stats.periods[stats.periods.length - 1 - i - 1];
              return (
                <div key={p.start} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-800/60 last:border-0">
                  <span className="text-slate-200">{fromKey(p.start).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}</span>
                  <span className="text-slate-400 text-xs">{p.length} day{p.length === 1 ? "" : "s"}{prev ? " · cycle " + diffDays(prev.start, p.start) + " days" : ""}</span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <p className="flex items-start justify-center gap-1.5 text-[11px] text-slate-500 text-center px-4 leading-snug">
        <ShieldCheck size={12} className="mt-0.5 shrink-0" /> {tr("Stays on this phone — kept out of Memory and never sent anywhere. Predictions are estimates, not contraception or medical advice.")}
      </p>
    </div>
  );
}
