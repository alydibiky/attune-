/* ---- reminders and phone actions --------------------------------------------
   "Remind me tomorrow at 9 to call Ahmed", "صحيني الساعة 6", "حط ميعاد مع
   المهندس يوم الخميس الساعة 11", "ابعت لمحمود على الواتساب إني هتأخر".

   Split of work, on purpose:
   1. The MODEL decides what kind of action it is and pulls out the pieces
      (title, contact, phone, message, the time phrase copied word for word).
      Its answer is forced into an exact JSON shape by a GBNF grammar that the
      engine applies token by token — it cannot produce anything else. With a
      small model, "please answer in JSON" alone works only ~80–85% of the
      time; with the grammar it is 100% well-formed.
   2. THIS FILE turns the time phrase into a real date and time. Date
      arithmetic ("next Thursday", "بعد ساعتين") is exactly what small models
      get wrong, and it is easy to do exactly in code.
   3. The person sees a card with everything spelled out and taps to confirm.
      Nothing is scheduled, opened or sent without that tap.
   Without a model, the same parser plus keyword rules still handle the
   common cases (quickAction).                                                 */

export const REMINDERS_KEY = "attune:reminders:v1";
export const KINDS = ["reminder", "alarm", "timer", "calendar", "whatsapp", "call", "none"];

// ---- digits and words -----------------------------------------------------------
const AR_DIGITS = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9" };
export function normDigits(s) { return String(s || "").replace(/[٠-٩۰-۹]/g, (d) => AR_DIGITS[d]); }

const NUM_WORDS = [
  [/\b(one|an?)\b|واحد(ة)?/i, 1], [/\btwo\b|اتنين|اثنين|إثنين/i, 2], [/\bthree\b|تلاتة|ثلاثة|تلات/i, 3],
  [/\bfour\b|اربعة|أربعة|اربع/i, 4], [/\bfive\b|خمسة|خمس/i, 5], [/\bsix\b|ستة|ست/i, 6], [/\bseven\b|سبعة|سبع/i, 7],
  [/\beight\b|تمانية|ثمانية|تمن/i, 8], [/\bnine\b|تسعة|تسع/i, 9], [/\bten\b|عشرة|عشر/i, 10], [/\beleven\b|حداشر|احد عشر/i, 11],
  [/\btwelve\b|اتناشر|اثنا عشر/i, 12], [/\bfifteen\b|ربع ساعة/i, 15], [/\btwenty\b|عشرين/i, 20], [/\bthirty\b|تلاتين|ثلاثين/i, 30],
];
function wordNum(s) { for (const [re, n] of NUM_WORDS) if (re.test(s)) return n; return null; }

const WEEKDAY = [
  [/\bsun(day)?\b|الحد|الاحد|الأحد/i, 0], [/\bmon(day)?\b|الاتنين|الإثنين|الاثنين/i, 1], [/\btue(s|sday)?\b|التلات|الثلاثاء|التلاتاء/i, 2],
  [/\bwed(nesday)?\b|الاربع|الأربع|الاربعاء|الأربعاء/i, 3], [/\bthu(rs|rsday)?\b|الخميس/i, 4], [/\bfri(day)?\b|الجمعة|الجمعه/i, 5],
  [/\bsat(urday)?\b|السبت/i, 6],
];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const AR_MONTHS = [/يناير/, /فبراير/, /مارس/, /ابريل|أبريل/, /مايو/, /يونيو/, /يوليو/, /اغسطس|أغسطس/, /سبتمبر/, /اكتوبر|أكتوبر/, /نوفمبر/, /ديسمبر/];

// Parts of the day, with the hour they mean when no hour is said, and whether
// an hour said with them is in the afternoon ("5 in the evening" = 17:00).
const DAYPART = [
  [/\b(this )?morning\b|الصبح|صباحا|صباحًا|الصباح|بدري/i, 9, "am"],
  [/\bnoon\b|midday|الضهر|الظهر/i, 12, "noon"],
  [/\b(this )?afternoon\b|العصر|بعد الضهر|بعد الظهر/i, 15, "pm"],
  [/\b(this )?evening\b|المغرب|مساء|مساءً|بالليل|باليل|الليلة|tonight/i, 20, "pm"],
  [/\bmidnight\b|نص الليل|منتصف الليل/i, 0, "midnight"],
];

function at(d, h, m) { const x = new Date(d); x.setHours(h, m || 0, 0, 0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

/**
 * A spoken time → a moment. English and Egyptian Arabic.
 * Returns { at: ms, allDay: bool, said: {day, time} } or null if there is no time in it.
 * `now` is a Date or ms.
 */
export function parseTime(text, nowIn) {
  const now = new Date(nowIn || Date.now());
  const s = normDigits(text).toLowerCase().replace(/[،,]/g, " ").replace(/\s+/g, " ");

  // 1. Relative: "in 20 minutes", "بعد ساعتين", "بعد نص ساعة"
  let m = s.match(/\b(?:in|after)\s+(\d+(?:\.\d+)?|an?|one|two|three|four|five|ten|fifteen|twenty|thirty|half an?)\s*(min(?:ute)?s?|hours?|hrs?|h|days?)\b/)
    || s.match(/(?:بعد|كمان|خلال)\s+(\d+(?:\.\d+)?|نص|ربع|ساعتين|يومين|دقيقتين)?\s*(دقيقة|دقايق|دقائق|دقيقه|ساعة|ساعه|ساعات|يوم|ايام|أيام|ساعتين|يومين|دقيقتين)?/);
  if (m && (m[1] || m[2])) {
    let n = null, unit = m[2] || "";
    const w = m[1] || "";
    if (/^\d/.test(w)) n = parseFloat(w);
    else if (/half|نص/.test(w)) n = 0.5;
    else if (/ربع/.test(w)) { n = 15; unit = "min"; }
    else if (w === "ساعتين" || unit === "ساعتين") { n = 2; unit = "hour"; }
    else if (w === "يومين" || unit === "يومين") { n = 2; unit = "day"; }
    else if (w === "دقيقتين" || unit === "دقيقتين") { n = 2; unit = "min"; }
    else if (w) n = wordNum(w);
    else if (unit) n = 1;                                   // "بعد ساعة"
    if (n != null && unit) {
      const ms = /^(min|دقي|دقا|دقائ)/.test(unit) ? 60000 : /^(h|ساع)/.test(unit) ? 3600000 : 86400000;
      if (ms === 86400000) {
        const d = addDays(now, Math.round(n));
        const t = clockIn(s);
        return { at: (t ? at(d, t.h, t.m) : at(d, 9, 0)).getTime(), allDay: !t, said: { day: "+" + n + "d", time: t ? "clock" : "" } };
      }
      return { at: now.getTime() + Math.round(n * ms), allDay: false, said: { day: "relative", time: "relative" } };
    }
  }

  // 2. The day
  let day = null, dayWord = "";
  if (/day after tomorrow|بعد بكرة|بعد بكره|بعد غد/.test(s)) { day = addDays(now, 2); dayWord = "+2"; }
  else if (/\btomorrow\b|بكرة|بكره|غدا|غدًا|الغد/.test(s)) { day = addDays(now, 1); dayWord = "+1"; }
  else if (/\btoday\b|\btonight\b|النهارده|النهاردة|اليوم|الليلة دي|انهارده/.test(s)) { day = new Date(now); dayWord = "0"; }
  if (!day) {
    for (const [re, wd] of WEEKDAY) if (re.test(s)) {
      let diff = (wd - now.getDay() + 7) % 7;
      if (diff === 0) diff = 7;                             // "on Thursday" said on a Thursday = next one
      day = addDays(now, diff); dayWord = "wd" + wd; break;
    }
  }
  if (!day) {
    // 25/9, 25-9-2026, 2026-09-25, 25 Sep, Sep 25, 25 سبتمبر
    let dm = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    let y, mo, d;
    if (dm) { y = +dm[1]; mo = +dm[2] - 1; d = +dm[3]; }
    else if ((dm = s.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/))) { d = +dm[1]; mo = +dm[2] - 1; y = dm[3] ? (+dm[3] < 100 ? 2000 + +dm[3] : +dm[3]) : null; }
    else {
      const mi = MONTHS.findIndex((x) => new RegExp("\\b" + x).test(s));
      const ai = AR_MONTHS.findIndex((re) => re.test(s));
      const mIdx = mi >= 0 ? mi : ai;
      const dd = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
      if (mIdx >= 0 && dd) { mo = mIdx; d = +dd[1]; y = null; }
    }
    if (mo != null && d >= 1 && d <= 31 && mo >= 0 && mo <= 11) {
      y = y || now.getFullYear();
      let cand = new Date(y, mo, d);
      if (cand.getMonth() === mo && cand.getDate() === d) {
        if (cand < at(now, 0, 0) && !dm) cand = new Date(y + 1, mo, d);
        day = cand; dayWord = "date";
      }
    }
  }

  // 3. The time of day
  const t = clockIn(s);
  let dp = null;
  for (const [re, h, kind] of DAYPART) if (re.test(s)) { dp = { h, kind }; break; }

  if (!day && !t && !dp) return null;
  let hh, mm = 0, allDay = false;
  if (t) {
    hh = t.h; mm = t.m;
    if (t.ampm === "pm" && hh < 12) hh += 12;
    else if (t.ampm === "am" && hh === 12) hh = 0;
    else if (!t.ampm) {
      if (dp && (dp.kind === "pm") && hh < 12) hh += 12;
      else if (dp && dp.kind === "midnight" && hh === 12) hh = 0;
      else if (!dp && hh >= 1 && hh <= 6) hh += 12;        // "at 5" means 5 pm in everyday speech
    }
  } else if (dp) { hh = dp.h; }
  else { hh = 9; allDay = true; }                          // a day with no time: 9 am, and say so

  let base = day || new Date(now);
  let when = at(base, hh, mm);
  // No day said and the time already passed today → the next one.
  if (!day && when.getTime() <= now.getTime()) {
    if (t && !t.ampm && !dp && hh < 12 && at(now, hh + 12, mm) > now) when = at(now, hh + 12, mm);
    else when = at(addDays(now, 1), hh, mm);
  }
  return { at: when.getTime(), allDay, said: { day: dayWord, time: t ? "clock" : dp ? dp.kind : "" } };
}

// "9", "9:30", "9.30", "21:00", "9am", "9 pm", "الساعة 9", "الساعة 9 ونص", "9 وربع", "10 الا ربع"
function clockIn(s) {
  let m = s.match(/\b(\d{1,2})[:.](\d{2})\s*(am|pm|a\.m\.|p\.m\.|ص|م)?(?![\d/])/);
  if (m && +m[1] <= 23 && +m[2] <= 59) return { h: +m[1], m: +m[2], ampm: ap(m[3]) };
  m = s.match(/\b(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)\b/);
  if (m && +m[1] >= 1 && +m[1] <= 12) return { h: +m[1], m: 0, ampm: ap(m[2]) };
  m = s.match(/(?:\bat\b|@|الساعة|الساعه|ساعة|الساعة ال|على)\s*(\d{1,2})(?:\s*(?:و\s*)?(نص|ربع|الا ربع|إلا ربع|الا تلت|تلت))?\s*(am|pm|ص|م)?/);
  if (m && +m[1] <= 23) {
    let h = +m[1], mi = 0;
    if (m[2]) { if (/الا ربع|إلا ربع/.test(m[2])) { h -= 1; mi = 45; } else if (/نص/.test(m[2])) mi = 30; else if (/ربع/.test(m[2])) mi = 15; else if (/تلت/.test(m[2])) mi = /الا/.test(m[2]) ? 40 : 20; }
    if (m[2] && /الا/.test(m[2]) && h < 0) h = 23;
    return { h, m: mi, ampm: ap(m[3]) };
  }
  // Arabic hour words: "الساعة تسعة"
  m = s.match(/(?:الساعة|الساعه)\s+(\S+)/);
  if (m) { const n = wordNum(m[1]); if (n && n <= 12) return { h: n, m: /ونص/.test(s) ? 30 : /وربع/.test(s) ? 15 : 0, ampm: null }; }
  return null;
}
function ap(x) { if (!x) return null; return /^(p|م)/.test(x) ? "pm" : "am"; }

/** "set a timer for 10 minutes", "تايمر ربع ساعة" → seconds, or 0. */
export function parseDuration(text) {
  const s = normDigits(text).toLowerCase();
  let total = 0, m;
  const re = /(\d+(?:\.\d+)?)\s*(h(?:ours?|rs?)?|ساعة|ساعه|ساعات|m(?:in(?:ute)?s?)?|دقيقة|دقيقه|دقايق|دقائق|s(?:ec(?:ond)?s?)?|ثانية|ثواني)\b/g;
  while ((m = re.exec(s))) {
    const n = parseFloat(m[1]); const u = m[2];
    total += /^(h|ساع)/.test(u) ? n * 3600 : /^(m|دقي|دقا|دقائ)/.test(u) ? n * 60 : n;
  }
  if (!total) {
    if (/نص ساعة|half an hour/.test(s)) total = 1800;
    else if (/ربع ساعة|quarter of an hour/.test(s)) total = 900;
    else if (/ساعتين/.test(s)) total = 7200;
    else if (/دقيقتين/.test(s)) total = 120;
    else if (/\b(an? )?hour\b|ساعة|ساعه/.test(s)) total = 3600;
  }
  return Math.round(total);
}

/** An Egyptian mobile or any international number → digits for wa.me / tel:, or "". */
export function normalizePhone(p) {
  let d = normDigits(p).replace(/[^\d+]/g, "");
  if (!d) return "";
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (/^01[0125]\d{8}$/.test(d)) d = "2" + d;          // 010/011/012/015 + 8 digits → +20
  return d.length >= 8 && d.length <= 15 ? d : "";
}

// ---- is this a request to DO something? ------------------------------------------
const ACTION_HINT = new RegExp([
  "\\bremind(er)? me\\b", "\\bremind\\b", "\\bset (an? )?(alarm|timer|reminder)\\b", "\\bwake me\\b", "\\balarm\\b", "\\btimer\\b",
  "\\b(add|put|schedule|book) .*(calendar|meeting|appointment)\\b", "\\bcalendar\\b",
  "\\bwhats ?app\\b", "\\b(text|message) [A-Z]", "\\bcall [A-Za-z]",
  "فكرني", "فكّرني", "ذكرني", "ذكّرني", "افكرك", "صحيني", "صحّيني", "منبه", "منبّه", "المنبه", "تايمر", "مؤقت",
  "ميعاد", "موعد", "اجتماع", "النتيجة", "الكالندر", "التقويم", "واتس", "الواتساب", "واتساب", "ابعت ل", "ابعتله", "ابعتلها", "كلم ", "اتصل ب",
].join("|"), "i");
export function looksLikeAction(text) {
  const t = String(text || "");
  if (t.length > 400) return false;                           // a pasted document is not a command
  if (/[?؟]\s*$/.test(t) && !/remind|فكرني|ذكرني|صحيني/i.test(t)) return false;  // a question about alarms is not a request
  return ACTION_HINT.test(t);
}

// ---- the grammar -------------------------------------------------------------------
// Every key, always, in this order: simple for a small model to follow and
// simple to read back. Strings are bounded so a confused model cannot ramble:
// at most ~390 characters in all, so ACTION_MAX_TOKENS always lets the JSON
// close even when every character costs 3 byte-tokens (a real model writes ~60).
export const ACTION_MAX_TOKENS = 1400;
export const ACTION_GRAMMAR = String.raw`root ::= "{" ws "\"action\":" ws action "," ws "\"title\":" ws text50 "," ws "\"time_text\":" ws text30 "," ws "\"when\":" ws when "," ws "\"repeat\":" ws repeat "," ws "\"minutes\":" ws num "," ws "\"contact\":" ws text30 "," ws "\"phone\":" ws phone "," ws "\"message\":" ws text200 "," ws "\"place\":" ws text40 ws "}"
action ::= "\"reminder\"" | "\"alarm\"" | "\"timer\"" | "\"calendar\"" | "\"whatsapp\"" | "\"call\"" | "\"none\""
repeat ::= "\"none\"" | "\"daily\"" | "\"weekly\"" | "\"weekdays\""
when ::= "\"\"" | "\"" [0-9] [0-9] [0-9] [0-9] "-" [0-9] [0-9] "-" [0-9] [0-9] "T" [0-9] [0-9] ":" [0-9] [0-9] "\""
num ::= "0" | [1-9] | [1-9] [0-9] | [1-9] [0-9] [0-9] | [1-9] [0-9] [0-9] [0-9]
phone ::= "\"" [+0-9 ]{0,18} "\""
text30 ::= "\"" char{0,30} "\""
text40 ::= "\"" char{0,40} "\""
text50 ::= "\"" char{0,50} "\""
text200 ::= "\"" char{0,200} "\""
char ::= [^"\\\x00-\x1F] | "\\" ["\\/nt]
ws ::= [ ]?`;

const pad = (n) => String(n).padStart(2, "0");
function localISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The two messages that ask the model to read the request. */
export function actionMessages(text, nowIn) {
  const now = new Date(nowIn || Date.now());
  return [
    { role: "system", content:
`You turn a request into ONE phone action, as JSON. You never chat.
Now: ${DAYS_EN[now.getDay()]} ${localISO(now)} (local time).
action: reminder = notify me at a time; alarm = wake-up/clock alarm; timer = countdown; calendar = a meeting or appointment to put in the calendar; whatsapp = send a WhatsApp message; call = phone someone; none = not a request to do something.
title: short, in the user's language, what it is about (e.g. "Call Ahmed", "اجتماع مع المهندس").
time_text: the time words EXACTLY as the user wrote them (e.g. "tomorrow at 9", "بكرة الساعة 9"), or "".
when: your best reading of that time as YYYY-MM-DDTHH:MM, or "".
repeat: none unless they said every day/week/weekday.
minutes: timer length in minutes, or the meeting length (default 60 for calendar), else 0.
contact: the person's name if any. phone: digits only if a number was written. message: the text to send (whatsapp) or a note, in the user's language. place: where, if said.` },
    { role: "user", content: text },
  ];
}

/**
 * The model's JSON (or nothing) + the original words → one action, checked.
 * The time comes from parseTime() on the user's own words first; the model's
 * "when" is used only if the words alone can't be read. Returns
 * { kind, title, at, allDay, repeat, durationSec, contact, phone, message, place, problems[] }.
 */
export function buildAction(json, text, nowIn) {
  const now = nowIn || Date.now();
  const j = json && typeof json === "object" ? json : {};
  let kind = KINDS.includes(j.action) ? j.action : guessKind(text);
  const problems = [];
  const words = [j.time_text, text].filter(Boolean);
  let t = null;
  for (const w of words) { t = parseTime(w, now); if (t) break; }
  if (!t && j.when && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(j.when)) {
    const [d, hm] = j.when.split("T"); const [y, mo, da] = d.split("-").map(Number); const [h, mi] = hm.split(":").map(Number);
    const dt = new Date(y, mo - 1, da, h, mi);
    if (dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === da && h < 24 && mi < 60) t = { at: dt.getTime(), allDay: false, said: { day: "model", time: "model" } };
  }
  let durationSec = 0;
  if (kind === "timer") { durationSec = parseDuration(text) || (j.minutes > 0 ? j.minutes * 60 : 0); if (!durationSec) problems.push("How long should the timer be?"); }
  if ((kind === "reminder" || kind === "alarm" || kind === "calendar") && !t) problems.push("When? Pick the date and time.");
  if (t && t.at < now - 60000 && kind !== "timer") problems.push("That time has already passed — pick a later one.");
  if (t && t.at > now + 366 * 86400000) problems.push("That is more than a year away — check the date.");
  const phone = normalizePhone(j.phone || (String(text).match(/(?:\+|00)?\d[\d\s-]{7,16}\d/) || [""])[0]);
  const contact = cleanText(j.contact, 40);
  if ((kind === "whatsapp" || kind === "call") && !phone && !contact) problems.push("Who should it go to?");
  const message = cleanText(j.message, 300) || (kind === "whatsapp" ? messageFrom(text) : "");
  let title = cleanText(j.title, 60) || titleFrom(text, kind, contact);
  const repeat = ["daily", "weekly", "weekdays"].includes(j.repeat) ? j.repeat : repeatIn(text);
  const minutes = kind === "calendar" ? (j.minutes > 0 && j.minutes <= 24 * 60 ? j.minutes : 60) : 0;
  if (kind === "none") problems.push("This doesn't look like something to set on the phone.");
  return { kind, title, at: t ? t.at : null, allDay: !!(t && t.allDay), repeat, durationSec, minutes, contact, phone, message,
    place: cleanText(j.place, 60), problems };
}

/** No model loaded: keywords + the parser, for the common cases. */
export function quickAction(text, nowIn) { return buildAction({ action: guessKind(text) }, text, nowIn); }

function guessKind(text) {
  const s = String(text || "");
  if (/\btimer\b|تايمر|مؤقت|countdown/i.test(s)) return "timer";
  if (/\bwake me\b|\balarm\b|صحيني|صحّيني|منبه|منبّه/i.test(s)) return "alarm";
  if (/whats ?app|واتس|واتساب|ابعت ل|ابعتله|ابعتلها/i.test(s)) return "whatsapp";
  if (/\bcall\b|كلم |اتصل ب/i.test(s) && !/remind|فكرني|ذكرني/i.test(s)) return "call";
  if (/calendar|meeting|appointment|ميعاد|موعد|اجتماع|الكالندر|التقويم/i.test(s) && !/remind|فكرني|ذكرني/i.test(s)) return "calendar";
  if (/remind|فكرني|فكّرني|ذكرني|ذكّرني/i.test(s)) return "reminder";
  return "none";
}
function repeatIn(text) {
  const s = String(text || "");
  if (/every ?day|daily|كل يوم|يوميا|يوميًا/i.test(s)) return "daily";
  if (/weekdays|every weekday|أيام الشغل|ايام الشغل/i.test(s)) return "weekdays";
  if (/every (week|sun|mon|tue|wed|thu|fri|sat)|weekly|كل اسبوع|كل أسبوع|أسبوعيا|اسبوعيا/i.test(s)) return "weekly";
  return "none";
}
function cleanText(x, n) { return String(x || "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n); }
function messageFrom(text) {
  const m = String(text).match(/(?:saying|that|to say|إن|ان|إني|اني|انه|إنه|وقوله|وقولها|قوله|قولها)\s+(.+)$/i);
  return m ? cleanText(m[1], 300) : "";
}
function titleFrom(text, kind, contact) {
  let s = String(text || "")
    .replace(/^(please |can you |could you )?(remind me( to)?|set (an? )?(alarm|timer|reminder)( for)?|wake me( up)?|add|put|schedule)\s*/i, "")
    .replace(/^(فكرني|فكّرني|ذكرني|ذكّرني|صحيني|صحّيني|حطلي|حط|اعمل|اعملي)\s*/, "")
    .replace(/\b(tomorrow|today|tonight|at \d{1,2}(:\d{2})?\s*(am|pm)?|in \d+ \w+)\b/gi, "")
    .replace(/(بكرة|بكره|النهارده|الساعة \d{1,2}|بعد \d+ \S+)/g, "");
  s = cleanText(s, 60);
  if (!s && contact) s = (kind === "call" ? "Call " : "Message ") + contact;
  return s || { reminder: "Reminder", alarm: "Alarm", timer: "Timer", calendar: "Appointment", whatsapp: "WhatsApp", call: "Call" }[kind] || "Reminder";
}

// ---- stored reminders ----------------------------------------------------------------
// [{ id, at, title, body, repeat, created, source, done }]
export function loadReminders() {
  try { const v = JSON.parse(localStorage.getItem(REMINDERS_KEY) || "[]"); return Array.isArray(v) ? v : (v && v.items) || []; } catch (e) { return []; }
}
export function saveReminders(list) { try { localStorage.setItem(REMINDERS_KEY, JSON.stringify(list)); } catch (e) {} return list; }
export const newReminderId = () => "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** The next time a repeating reminder fires after `after`. */
export function nextOccurrence(r, after) {
  let t = r.at;
  if (!r.repeat || r.repeat === "none") return t;
  let guard = 0;
  while (t <= after && guard++ < 1000) {
    const d = new Date(t);
    if (r.repeat === "daily") d.setDate(d.getDate() + 1);
    else if (r.repeat === "weekly") d.setDate(d.getDate() + 7);
    else if (r.repeat === "weekdays") { do { d.setDate(d.getDate() + 1); } while (d.getDay() === 5 || d.getDay() === 6); } // Egypt: Fri + Sat off
    t = d.getTime();
  }
  return t;
}

/** Tell the phone about every reminder still to come (idempotent — same id replaces). */
export function syncToPhone(native, list) {
  if (!native || !native.schedule) return 0;
  let wanted = new Set(), n = 0;
  for (const r of list) {
    if (r.done) continue;
    const at = nextOccurrence(r, Date.now() - 1000);
    if (!at || at < Date.now() - 1000) continue;
    wanted.add(r.id);
    try { native.schedule(JSON.stringify({ id: r.id, at, title: r.title, body: r.body || "", repeat: r.repeat || "none" })); n++; } catch (e) {}
  }
  try {
    const onPhone = JSON.parse(native.scheduled() || "[]");
    for (const x of onPhone) if (!wanted.has(x.id)) native.unschedule(x.id);
  } catch (e) {}
  return n;
}
