/* ---- v9.9.3 T1 (Ali picked: "timetable photo → reminders — a bit slower okay but don't compromise quality and accuracy").
   A photo / screenshot of a uni or school timetable → the classes, checked, → a weekly reminder before each, until the term ends.
   Two ways to read it, both checked by code before anything is shown:
     fromLines(lines)  — the phone's text reader (ML Kit: each line with x, y, w, h): a GRID (days across the top, times down the side,
                         each class put in the cell its middle falls in) or a LIST ("Sunday 9:00–10:30 Accounting B204")
     fromModel(text)   — the small photo model (Arabic / handwriting): it is asked for JSON only; every row is validated
   A class: { day 0–6 (Sun = 0), start "HH:MM", end "HH:MM" | "", subject, room }. Nothing is saved until the person checks the table.
   toReminders(classes, { minutes, until, now }) → the weekly reminders. Pure; tests: tests/unit/v993timetable.test.mjs. */

const AR_D = "٠١٢٣٤٥٦٧٨٩";
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => AR_D.indexOf(d));
export const DAYS = [
  [0, /\b(sun|sunday|su)\b|الأحد|الاحد|الحد/i], [1, /\b(mon|monday|mo)\b|الاثنين|الإثنين|الاتنين/i], [2, /\b(tue|tues|tuesday|tu)\b|الثلاثاء|الثلاثا|التلات/i],
  [3, /\b(wed|wednesday|we)\b|الأربعاء|الاربعاء|الاربع/i], [4, /\b(thu|thur|thurs|thursday|th)\b|الخميس/i], [5, /\b(fri|friday|fr)\b|الجمعة|الجمعه/i], [6, /\b(sat|saturday|sa)\b|السبت/i]];
const dayOf = (t) => { const s = String(t || "").trim(); const d = DAYS.find(([, re]) => re.test(s)); return d ? d[0] : -1; };
// "9:00", "09.30", "9 am", "1:15 pm", "13:00", «٩:٣٠ ص»
const TIME = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(?:(am|pm|a\.m\.|p\.m\.|ص|م)(?![\p{L}]))?(?![\d%])/iu;
export function hhmm(s, ref = "") {
  const m = TIME.exec(latin(s)); if (!m) return "";
  let h = +m[1]; const min = m[2] ? +m[2] : 0, ap = (m[3] || "").toLowerCase();
  if (!m[2] && !ap) return "";                               // a bare number is not a time (a room, a group)
  if (min > 59 || h > 23) return "";
  if (/^(pm|p\.m\.|م)$/.test(ap) && h < 12) h += 12;
  if (/^(am|a\.m\.|ص)$/.test(ap) && h === 12) h = 0;
  // a uni day runs ~7:00–22:00: "1:00" with no am/pm next to morning classes is 13:00
  if (!ap && h >= 1 && h <= 6) h += 12;
  return String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
}
const RANGE = /(\d{1,2}(?:[:.]\d{2})?\s*(?:(?:am|pm|ص|م)(?![\p{L}]))?)\s*(?:-|–|—|to|الى|إلى|ل)\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:(?:am|pm|ص|م)(?![\p{L}]))?)/iu;
const ROOM_W = /\b(?:room|hall|lab|rm|r\.)\s*[\w-]+|قاعة\s*\S+|قاعه\s*\S+|مدرج\s*\S+|معمل\s*\S+/i, ROOM_C = /\b[A-Z]{1,2}-?\d{2,4}\b/;
const ROOM = { exec: (s) => ROOM_W.exec(s) || ROOM_C.exec(s) };
const tidy = (s) => String(s || "").replace(/\s+/g, " ").replace(/^[\s,;:|·-]+|[\s,;:|·-]+$/g, "").trim();

/** A class is believable: a real day, a start time in the day, end after start, a subject of real words. */
export function valid(c) {
  if (!c || !(c.day >= 0 && c.day <= 6) || !/^\d{2}:\d{2}$/.test(c.start)) return false;
  const [h] = c.start.split(":").map(Number); if (h < 6 || h > 22) return false;
  if (c.end && (!/^\d{2}:\d{2}$/.test(c.end) || c.end <= c.start)) return false;
  return /[\p{L}]{2,}/u.test(c.subject || "");
}
const key = (c) => c.day + "|" + c.start + "|" + String(c.subject).toLowerCase();
export const clean = (list) => { const seen = new Set(), out = []; for (const c of list) { if (!valid(c) || seen.has(key(c))) continue; seen.add(key(c)); out.push(c); } return out.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start)); };

// ---- a LIST: one class per line ("Sunday 9:00-10:30 Accounting B204") --------------------------------------------------------------
function fromList(lines) {
  const out = []; let day = -1;
  for (const l of lines) {
    const t = latin(String(l.text || l)).trim(); if (!t) continue;
    const d = dayOf(t); if (d >= 0) day = d;
    const r = RANGE.exec(t), start = r ? hhmm(r[1]) : hhmm(t), end = r ? hhmm(r[2], r[1]) : "";
    if (day < 0 || !start) continue;
    let rest = t.replace(r ? r[0] : TIME.exec(t)[0], " ");
    for (const [, re] of DAYS) rest = rest.replace(re, " ");
    const room = (ROOM.exec(rest) || [""])[0];
    const subject = tidy(rest.replace(room, " "));
    if (subject) out.push({ day, start, end, subject, room: tidy(room) });
  }
  return out;
}

// ---- a GRID: days across the top, times down the side --------------------------------------------------------------------------------
function fromGrid(lines) {
  const L = lines.filter((l) => l && l.text && l.w > 0).map((l) => ({ ...l, text: latin(l.text), cx: l.x + l.w / 2, cy: l.y + (l.h || 10) / 2 }));
  const heads = L.filter((l) => dayOf(l.text) >= 0 && l.text.length <= 14);
  if (heads.length < 2) return [];
  // the day headers sit on one row (similar y); the time labels in one column on the side
  const hy = heads.map((h) => h.cy).sort((a, b) => a - b)[Math.floor(heads.length / 2)];
  const cols = heads.filter((h) => Math.abs(h.cy - hy) < Math.max(20, (h.h || 10) * 1.5)).map((h) => ({ day: dayOf(h.text), cx: h.cx })).sort((a, b) => a.cx - b.cx);
  if (cols.length < 2) return [];
  const colW = (cols[cols.length - 1].cx - cols[0].cx) / Math.max(1, cols.length - 1);
  const times = L.filter((l) => l.cy > hy + 5 && (RANGE.test(l.text) || hhmm(l.text)) && l.cx < cols[0].cx - colW * 0.4)
    .map((l) => { const r = RANGE.exec(l.text); return { cy: l.cy, start: r ? hhmm(r[1]) : hhmm(l.text), end: r ? hhmm(r[2], r[1]) : "" }; }).filter((t) => t.start).sort((a, b) => a.cy - b.cy);
  if (!times.length) return [];
  const cells = new Map();
  for (const l of L) {
    if (l.cy <= hy + 5 || heads.includes(l) || l.cx < cols[0].cx - colW * 0.4) continue;
    const col = cols.reduce((b, c) => (Math.abs(c.cx - l.cx) < Math.abs(b.cx - l.cx) ? c : b), cols[0]);
    if (Math.abs(col.cx - l.cx) > colW * 0.6) continue;
    // the time row: the last time label at or above the line's middle (a class written in two lines stays one class)
    const row = times.filter((t) => t.cy <= l.cy + 12).slice(-1)[0] || times[0];
    const k = col.day + "|" + row.start;
    const c = cells.get(k) || { day: col.day, start: row.start, end: row.end, parts: [] };
    c.parts.push(l.text); cells.set(k, c);
  }
  return [...cells.values()].map((c) => { const all = c.parts.join(" "), room = (ROOM.exec(all) || [""])[0]; return { day: c.day, start: c.start, end: c.end, subject: tidy(all.replace(room, " ")), room: tidy(room) }; });
}

/** The phone's text reader → the classes (grid first; a list when it isn't a grid). */
export function fromLines(lines = []) {
  const g = clean(fromGrid(lines));
  const l = clean(fromList([...lines].sort((a, b) => (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0))));
  return g.length >= l.length ? g : l;
}

/** What the photo model is asked (JSON only, nothing invented). */
export const MODEL_PROMPT = "This is a photo of a class timetable. List EVERY class you can read, as JSON only: " +
  '[{"day":"Sunday","start":"09:00","end":"10:30","subject":"Accounting","room":"B204"}]. Use 24-hour times. Copy the subject and room exactly as written ' +
  "(any language). If a cell is unreadable, leave it out. Do not guess or invent. No text outside the JSON.";
/** The photo model's answer → the classes (each row checked; a broken answer → []). */
export function fromModel(text) {
  const s = String(text || ""), a = s.indexOf("["), b = s.lastIndexOf("]"); if (a < 0 || b <= a) return [];
  let rows = []; try { rows = JSON.parse(s.slice(a, b + 1)); } catch (e) { return []; }
  return clean((Array.isArray(rows) ? rows : []).map((r) => ({ day: typeof r.day === "number" ? r.day : dayOf(r.day), start: hhmm(r.start) || hhmm(String(r.start || "") + " "), end: hhmm(r.end || ""), subject: tidy(r.subject), room: tidy(r.room || "") }))
    .map((c) => ({ ...c, start: c.start || (/^\d{1,2}:\d{2}$/.test(String(c.start)) ? c.start : "") })));
}
/** Both readers agree → more sure; the result keeps what both read, plus what only one read (marked to check). */
export function merge(a = [], b = []) {
  const ka = new Map(a.map((c) => [c.day + "|" + c.start, c])), out = [];
  for (const c of b) { const x = ka.get(c.day + "|" + c.start); out.push(x ? { ...x, sure: true } : { ...c, check: true }); if (x) ka.delete(c.day + "|" + c.start); }
  for (const c of ka.values()) out.push({ ...c, check: true });
  return clean(out);
}

/** The weekly reminders: `minutes` before each class, from its next day on, until the term's last day. */
export function toReminders(classes, { minutes = 15, until = "", now = Date.now() } = {}) {
  const end = until ? Date.parse(until + "T23:59:00") : 0;
  return clean(classes).map((c) => {
    const [h, m] = c.start.split(":").map(Number), d = new Date(now); d.setHours(h, m, 0, 0);
    let add = (c.day - d.getDay() + 7) % 7; if (add === 0 && d.getTime() - minutes * 6e4 <= now) add = 7;
    const at = d.getTime() + add * 864e5 - minutes * 6e4;
    return { id: "class-" + c.day + "-" + c.start.replace(":", "") + "-" + String(c.subject).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 16), at, repeat: "weekly", until: end || 0,
      title: c.subject + (c.room ? " · " + c.room : ""), body: c.start + (c.end ? "–" + c.end : ""), source: "timetable" };
  }).filter((r) => !end || r.at <= end);
}
