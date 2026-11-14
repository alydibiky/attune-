/* ---- v9.2 To-dos & lists (Ali, 4 Nov 2026, picked 1A: "the to-do list or remind should appear on Home when it's due or not finished
   … recurring to-do lists … I'm travelling, it shows my travel list on Home" — "and there should be a part where I add my list and
   choose whether it repeats or not, clear and visible").
   A list = a name, its items (ticks) and WHEN it is needed:
     once  — until every box is ticked (optionally from a date)            repeat: { every: "once", date? }
     day   — every day, boxes empty again each morning                    repeat: { every: "day" }
     week  — on chosen weekdays (0 = Sunday … 6 = Saturday)               repeat: { every: "week", days: [6] }
     month — on a day of the month (31 → the month's last day)            repeat: { every: "month", dom: 1 }
     date  — before a date (a trip): shown `before` days ahead until the day, boxes empty again for each new date
                                                                          repeat: { every: "date", date: "2026-11-12", before: 1 }
   A list that repeats keeps its items; each new round ("cycle") starts with every box empty. An unfinished round stays on Home until
   the next round starts — nothing due is hidden. Pure: tests/unit/v922lists.test.mjs. The page reads / writes LISTS_KEY.            */
export const LISTS_KEY = "attune:lists:v1";
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");
export const isoDay = (t) => { const d = new Date(t); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
const atNoon = (iso) => new Date(iso + "T12:00:00").getTime();
const uid = () => Math.random().toString(36).slice(2, 10);

export function loadLists() {
  try { const v = JSON.parse(localStorage.getItem(LISTS_KEY) || "null"); return v && Array.isArray(v.lists) ? v : { lists: [] }; } catch (e) { return { lists: [] }; }
}
export function saveLists(st) { try { localStorage.setItem(LISTS_KEY, JSON.stringify(st)); window.dispatchEvent(new CustomEvent("attune-lists")); } catch (e) {} return st; }

/** A new list. items: strings or { text }. */
export function makeList({ name, emoji = "", items = [], repeat = { every: "once" }, now = Date.now() } = {}) {
  const nm = String(name || "").trim().slice(0, 60) || "List";
  return { id: "l" + uid(), name: nm.charAt(0).toUpperCase() + nm.slice(1), emoji: emoji || emojiFor(nm + " " + (items || []).map((x) => (x && x.text) || x).join(" ")),
    items: (items || []).map((x) => ({ id: "i" + uid(), text: String(x && x.text != null ? x.text : x).trim().slice(0, 140), done: false })).filter((x) => x.text),
    repeat: cleanRepeat(repeat), cycle: "", created: now };
}
export function cleanRepeat(r = {}) {
  const every = ["once", "day", "week", "month", "date"].includes(r.every) ? r.every : "once";
  const out = { every };
  if (every === "week") out.days = [...new Set((r.days || []).map(Number).filter((d) => d >= 0 && d <= 6))].sort();
  if (every === "week" && !out.days.length && !Array.isArray(r.days)) out.days = [6];   // a new weekly list starts on Saturday; the editor may clear it
  if (every === "month") out.dom = Math.min(31, Math.max(1, +r.dom || 1));
  if (every === "date" || every === "once") { if (/^\d{4}-\d{2}-\d{2}$/.test(r.date || "")) out.date = r.date; }
  if (every === "date") out.before = Math.min(14, Math.max(0, r.before == null ? 1 : +r.before));
  return out;
}
const EMOJI = [[/travel|trip|safar|flight|umrah|hajj|سفر|سفريه|سفرية|رحله|رحلة|عمره|عمرة|حج/i, "🧳"], [/clean|house|home|تنضيف|تنظيف|البيت|بيت/i, "🧹"],
  [/shop|grocer|market|buy|شراء|طلبات|سوبر|بقاله|بقالة/i, "🛒"], [/school|study|exam|مذاكره|مذاكرة|امتحان|مدرسه|مدرسة/i, "📚"], [/work|office|شغل/i, "💼"],
  [/gym|sport|workout|جيم|رياضه|رياضة/i, "🏋️"], [/ramadan|رمضان|eid|عيد/i, "🌙"], [/baby|kids|اطفال|عيال|الولاد/i, "🧸"], [/car|عربيه|عربية/i, "🚗"]];
export const emojiFor = (name) => (EMOJI.find(([re]) => re.test(String(name || ""))) || [, "📝"])[1];

// ---- when a list is needed ------------------------------------------------------------------------------------------------------
/** The round this list is in on `now` ("" = none yet / not needed). Day / week / month: the date that round began; date: the date. */
export function cycleOf(list, now = Date.now()) {
  const c = cycleRaw(list, now);
  // a round from before the list was made does not count (a list made on Wednesday for Saturdays waits for Saturday)
  return c && /^\d/.test(c) && list.created && list.repeat.every !== "date" && c < isoDay(list.created) ? "" : c;
}
function cycleRaw(list, now) {
  const r = (list && list.repeat) || { every: "once" }, today = isoDay(now);
  if (r.every === "day") return today;
  if (r.every === "week") {
    for (let k = 0; k < 7; k++) { const t = now - k * DAY; if ((r.days || []).includes(new Date(t).getDay())) return isoDay(t); }
    return "";
  }
  if (r.every === "month") {
    const d = new Date(now), y = d.getFullYear(), m = d.getMonth();
    const on = (yy, mm) => { const last = new Date(yy, mm + 1, 0).getDate(); return yy + "-" + pad(mm + 1) + "-" + pad(Math.min(r.dom || 1, last)); };
    const thisM = on(y, m);
    return thisM <= today ? thisM : on(m ? y : y - 1, m ? m - 1 : 11);
  }
  if (r.every === "date") return r.date || "";
  return r.date && today < r.date ? "" : "once";
}
/** The list as it is on `now`: a new round starts with every box empty. Returns the same object when nothing changes. */
export function current(list, now = Date.now()) {
  const c = cycleOf(list, now);
  if (!c || c === list.cycle || list.repeat.every === "once") return c && list.repeat.every === "once" && list.cycle !== c ? { ...list, cycle: c } : list;
  return { ...list, cycle: c, items: list.items.map((x) => (x.done ? { ...x, done: false } : x)) };
}
/** Is it on Home today? Needed (its round has begun, or a trip is close) and not finished. */
export function onHome(list, now = Date.now()) {
  const l = current(list, now), r = l.repeat, today = isoDay(now);
  if (!l.items.length || l.items.every((x) => x.done)) return false;
  if (r.every === "date") {
    if (!r.date) return false;
    const from = isoDay(atNoon(r.date) - (r.before == null ? 1 : r.before) * DAY);
    return today >= from && today <= r.date;
  }
  return !!cycleOf(l, now);
}
/** When it is needed, in words (for the list's own row). → { en, v } for tr(). */
export function whenLine(list, now = Date.now()) {
  const r = list.repeat || {}, WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  if (r.every === "day") return { en: "Every day" };
  if (r.every === "week") return r.days.length === 7 ? { en: "Every day" } : { en: "Every {d}", v: { d: r.days.map((d) => WD[d]) } };
  if (r.every === "month") return r.dom >= 31 ? { en: "The last day of every month" } : { en: "Every month on the {n}", v: { n: r.dom } };
  if (r.every === "date") return r.date ? { en: "Before {d}", v: { date: r.date } } : { en: "Before a date — pick it" };
  return r.date ? { en: "Once, from {d}", v: { date: r.date } } : { en: "Once" };
}
export const progress = (list) => ({ done: list.items.filter((x) => x.done).length, of: list.items.length });

// ---- changes (pure: return the new store) ---------------------------------------------------------------------------------------
const put = (st, id, fn) => ({ ...st, lists: st.lists.map((l) => (l.id === id ? fn(l) : l)) });
export const addList = (st, l) => ({ ...st, lists: [l, ...st.lists] });
export const removeList = (st, id) => ({ ...st, lists: st.lists.filter((l) => l.id !== id) });
export const editList = (st, id, patch) => put(st, id, (l) => ({ ...l, ...patch, ...(patch.repeat ? { repeat: cleanRepeat(patch.repeat), cycle: "" } : {}) }));
export const tick = (st, id, itemId, now = Date.now()) => put(st, id, (l) => { const c = current(l, now); return { ...c, items: c.items.map((x) => (x.id === itemId ? { ...x, done: !x.done } : x)) }; });
export const addItem = (st, id, text) => put(st, id, (l) => ({ ...l, items: [...l.items, ...String(text || "").split(/\s*[,،\n]\s*/).map((t) => t.trim()).filter(Boolean).map((t) => ({ id: "i" + uid(), text: t.slice(0, 140), done: false }))] }));
export const removeItem = (st, id, itemId) => put(st, id, (l) => ({ ...l, items: l.items.filter((x) => x.id !== itemId) }));
/** Bring every list to today (new rounds start empty) — the page saves it when something changed. */
export function refresh(st, now = Date.now()) { let changed = false; const lists = st.lists.map((l) => { const c = current(l, now); if (c !== l) changed = true; return c; }); return changed ? { ...st, lists } : st; }
export const homeLists = (st, now = Date.now()) => st.lists.filter((l) => onHome(l, now)).map((l) => current(l, now));

/** Find a list by a name said in a sentence ("travel", «السفر»). */
export function findList(st, name) {
  const f = (s) => String(s || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/^(ال)/, "").replace(/(ing|list|checklist|ليسته|ليستة|قايمه|قائمه)$/g, "").trim();
  const n = f(name); if (!n) return null;
  const same = (l) => { const m = f(l.name); return m && (m === n || m.includes(n) || n.includes(m) || (TRAVEL.test(n) && TRAVEL.test(m))); };
  return st.lists.find(same) || null;
}
const TRAVEL = /travel|trip|safar|سفر|رحل|umrah|عمر/i;

// ---- what was said ----------------------------------------------------------------------------------------------------------------
const WDAY = [[0, /\b(sun(day)?)\b|حد|أحد|احد/i], [1, /\b(mon(day)?)\b|اتنين|إثنين|اثنين/i], [2, /\b(tue(s|sday)?)\b|تلات|ثلاثاء/i],
  [3, /\b(wed(nesday)?)\b|اربع|أربع/i], [4, /\b(thu(rs|rsday)?)\b|خميس/i], [5, /\b(fri(day)?)\b|جمعه|جمعة/i], [6, /\b(sat(urday)?)\b|سبت/i]];
const daysIn = (t) => WDAY.filter(([, re]) => re.test(t)).map(([d]) => d);
/** "Thursday" / «الخميس» / "tomorrow" / "on the 12th" / "12/11" / "in 3 days" → the next such date (iso). */
export function dateIn(t, now = Date.now()) {
  const s = String(t || "");
  if (/\b(today)\b|النهارده|النهاردة|انهارده/i.test(s)) return isoDay(now);
  if (/\b(tomorrow)\b|بكره|بكرة|بكرا/i.test(s)) return isoDay(now + DAY);
  if (/\bafter tomorrow\b|بعد بكره|بعد بكرة/i.test(s)) return isoDay(now + 2 * DAY);
  let m = s.match(/\bin (\d{1,2}) days?\b|بعد (\d{1,2}) (?:يوم|ايام|أيام)/i); if (m) return isoDay(now + (+(m[1] || m[2])) * DAY);
  m = s.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
  if (m) { const d = +m[1], mo = +m[2]; let y = m[3] ? +m[3] : new Date(now).getFullYear(); if (y < 100) y += 2000; const iso = y + "-" + pad(mo) + "-" + pad(d); if (mo <= 12 && d <= 31) return !m[3] && iso < isoDay(now) ? (y + 1) + iso.slice(4) : iso; }
  const ds = daysIn(s);
  if (ds.length) { for (let k = 1; k <= 7; k++) { const t2 = now + k * DAY; if (new Date(t2).getDay() === ds[0]) return isoDay(t2); } }
  m = s.match(/\bon the (\d{1,2})(st|nd|rd|th)?\b|يوم (\d{1,2})(?!\s*[\/.-])/i);
  if (m) { const d = +(m[1] || m[3]), now0 = new Date(now); let y = now0.getFullYear(), mo = now0.getMonth(); if (d < now0.getDate()) { mo++; if (mo > 11) { mo = 0; y++; } } return y + "-" + pad(mo + 1) + "-" + pad(d); }
  return "";
}
const MAKE = /^\s*(?:please\s+)?(?:make|create|start|new|save)\s+(?:me\s+)?(?:a\s+|my\s+)?(.{2,40}?)\s*(?:check\s?list|list)\s*[:\-]\s*(.+)$/i;
const MAKE_AR = /^\s*(?:اعمل|اعملي|اعملّي|عايز|سجل|احفظ)\s*(?:لي|ليا)?\s*(?:ليسته|ليستة|قايمه|قايمة|قائمة|قائمه|لستة|لسته)\s+(.{2,30}?)\s*[:\-]\s*(.+)$/;
const EVERY = /^\s*(?:every|each)\s+(day|morning|week(?:day)?s?|month|sunday|monday|tuesday|wednesday|thursday|friday|saturday|(?:sun|mon|tue|wed|thu|fri|sat)\w*(?:\s*(?:,|and|&)\s*\w+)*)\s*[:\-]\s*(.+)$/i;
const EVERY_AR = /^\s*(?:كل)\s+(يوم|شهر|اسبوع|أسبوع|(?:ال)?(?:حد|أحد|احد|اتنين|إثنين|اثنين|تلات|ثلاثاء|اربع|أربع|أربعاء|اربعاء|خميس|جمعه|جمعة|سبت)(?:\s*(?:و|،|,)\s*(?:ال)?\S+)*)\s*[:\-]\s*(.+)$/;
const GOING = /\b(i'?m|i am|we'?re|we are)\s+(travel+ing|flying|going on (?:a |my )?trip|leaving for)\b|\bmy (trip|flight|travel) is\b|\b(travel+ing|flying)\s+(on|this|next|tomorrow)\b|(انا\s+)?(مسافر|مسافره|مسافرة|هسافر|هنسافر|طيارتي|سفري)(?![\u0600-\u06ff])/i;
const SHOW_FOR = /\b(what('?s| is)|show( me)?|open|read)\b.{0,20}\b(check\s?list|list|to-?do list)\s+(for|of)\s+(my\s+|the\s+)?(.{2,30}?)\s*[?؟.]?$/i;
const SHOW = /\b(what('?s| is)|show( me)?|open|read)\b.{0,20}?\b(my\s+)?(.{2,30}?)\s*(check\s?list|list|to-?do list)\b|(وريني|هات|ايه|إيه)\s*(ليسته|ليستة|قايمه|قايمة|لستة)\s+(.{2,30}?)\s*[?؟]?$/i;
const ADD_TO = /^\s*(?:please\s+)?(?:add|put|write)\s+(.{2,200}?)\s+(?:to|on|in)\s+(?:my\s+|the\s+)?(.{2,30}?)\s*(?:check\s?list|list)\s*[.!]?$/i;
const ADD_TO_AR = /^\s*(?:ضيف|ضيفلي|حط|حطلي|زود|اكتب)\s+(.{2,200}?)\s+(?:ل|في|على|علي)\s*(?:ليسته|ليستة|قايمه|قايمة|لستة|قائمه|قائمة)\s+(.{2,30}?)\s*$/;
const splitItems = (s) => String(s || "").split(/\s*(?:,|،|\n|;| and | و(?=\S{2,}))\s*/).map((x) => x.replace(/^[-•☐\s]+|[.!]+$/g, "").trim()).filter((x) => x.length >= 2).slice(0, 60);

/** A sentence about lists → { op: "make" | "trip" | "show", … } or null.
 *  make: { name, items, repeat }  ·  trip: { date, name? }  ·  show: { name } */
export function parseListCommand(text, now = Date.now()) {
  const t = String(text || "").trim();
  if (!t || t.length > 600) return null;
  let m = t.match(EVERY) || t.match(EVERY_AR);
  if (m) {
    const w = m[1].toLowerCase(), items = splitItems(m[2]);
    if (!items.length) return null;
    let repeat;
    if (/^(day|morning|يوم)$/.test(w)) repeat = { every: "day" };
    else if (/^(month|شهر)$/.test(w)) repeat = { every: "month", dom: new Date(now).getDate() };
    else if (/^(week|اسبوع|أسبوع)$/.test(w)) repeat = { every: "week", days: [new Date(now).getDay()] };
    else if (/^weekdays?$/.test(w)) repeat = { every: "week", days: [0, 1, 2, 3, 4] };
    else { const ds = daysIn(w); if (!ds.length) return null; repeat = { every: "week", days: ds }; }
    const name = repeat.every === "week" && repeat.days.length === 1 ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][repeat.days[0]] : repeat.every === "day" ? "Every day" : repeat.every === "month" ? "Every month" : "Weekly";
    return { op: "make", name: /[؀-ۿ]/.test(t) ? ("كل " + m[1]).slice(0, 30) : name, items, repeat };
  }
  m = t.match(MAKE) || t.match(MAKE_AR);
  if (m) {
    const items = splitItems(m[2]); if (!items.length) return null;
    const name = m[1].replace(/^(a|my|the)\s+/i, "").trim();
    return { op: "make", name, items, repeat: TRAVEL.test(name) ? { every: "date", before: 1 } : { every: "once" } };
  }
  if (GOING.test(t) && !/[?؟]\s*$/.test(t)) { const date = dateIn(t, now); if (date) return { op: "trip", date }; }
  // v9.9.15 (the 10,000-sentence run: "add milk to my shopping list" went to the AI): add to a list by its name — made if it isn't there yet.
  // The to-do list is Mind's (commands.js todoAdd), so "to-do / tasks" is left to it.
  m = t.match(ADD_TO) || t.match(ADD_TO_AR);
  if (m && !/^(to-?dos?|todos?|tasks?|المهام|مهامي|التودو)$/i.test(m[2].trim())) { const items = splitItems(m[1]); if (items.length) return { op: "add", name: m[2].replace(/^(my|the)\s+/i, "").trim(), items }; }
  // v9.9.18 (the hard run: "shopping list: chicken, milk, pasta", "we're out of sugar and yoghurt" went to the AI)
  m = /^\s*(?:my\s+|the\s+)?([\p{L}][\p{L} '’-]{1,28}?)\s+(?:check\s?list|list)\s*[:\-]\s*(.{2,400})$/iu.exec(t) || /^\s*(?:ليسته|ليستة|قايمه|قايمة|لستة|قائمة)\s+([\p{L} ]{2,28}?)\s*[:\-]\s*(.{2,400})$/u.exec(t);
  if (m && !/^(to-?dos?|todos?|tasks?|المهام)$/i.test(m[1].trim())) { const items = splitItems(m[2]); if (items.length) return { op: "add", name: m[1].replace(/^(my|the)\s+/i, "").trim(), items }; }
  m = /^\s*(?:we'?re|we are|i'?m|i am)\s+(?:all\s+)?out of\s+(.{2,200}?)\s*[.!]?$/i.exec(t) || /^\s*(?:خلص|خلصت|خلصو|خلصوا|مفيش)\s+(.{2,200}?)\s*$/.exec(t);
  // v9.9.38 CG-3: «خلصت كتاب» / «خلصت الكورس» is a book or course FINISHED, not one to buy
  if (m && /^(?:خلصت|خلّصت)\s/.test(t.trim()) && /^(?:كتاب|كتابين|روايه|رواية|الكتاب|الرواية|الروايه|كورس|الكورس|[\d٠-٩]{1,2}\s+كتب)/.test(m[1])) m = null;
  if (m && !/[\d٠-٩]/.test(m[1]) && !/\b(time|money|battery|ideas?|patience|breath|options|luck)\b|(?:^|\s)(?:الوقت|الفلوس|الشحن|البطارية|الشغل|الامتحان|المذاكرة)/i.test(m[1])) { const items = splitItems(m[1].replace(/^(?:ال)/, "")).map((x) => x.replace(/^(?:some|the)\s+/i, "").replace(/^ال(?=\S{2,})/, "")); if (items.length && items.length <= 12) return { op: "add", name: /[\u0600-\u06ff]/.test(t) ? "المشتريات" : "Shopping", items }; }
  m = t.match(SHOW_FOR);
  if (m) return { op: "show", name: m[7].trim() };
  m = t.match(SHOW);
  // v9.9.18: the name is group 5 / 9 ("show my shopping list" found no name); "my to-do list" is Mind's (commands.js)
  if (m && !/to-?do/i.test(m[6] || "")) { const name = (m[5] || m[9] || "").trim().replace(/^(?:(?:on|in|of|for|my|the|is|are)\s+)+/i, "").trim(); if (name && !/^(to-?dos?|todos?|tasks?)$/i.test(name)) return { op: "show", name }; }
  return null;
}

/** Do it on the store. → { st, list, line: { en, v } } — the line says what happened (for the answer card). */
export function applyListCommand(st, c, now = Date.now()) {
  if (!c) return null;
  if (c.op === "make") {
    const old = findList(st, c.name);
    if (old) { const st2 = editList(addItem(st, old.id, c.items.filter((x) => !old.items.some((y) => y.text.toLowerCase() === x.toLowerCase())).join(",")), old.id, { repeat: c.repeat.every === "once" ? old.repeat : c.repeat });
      return { st: st2, list: st2.lists.find((l) => l.id === old.id), line: { en: "Added to your list “{n}”", v: { n: old.name } } }; }
    const l = makeList({ name: c.name, items: c.items, repeat: c.repeat, now });
    return { st: addList(st, l), list: l, line: { en: l.items.length === 1 ? "Saved your list “{n}” — 1 item" : "Saved your list “{n}” — {k} items", v: { n: l.name, k: l.items.length } } };
  }
  if (c.op === "add") {
    const old = findList(st, c.name);
    if (!old) { const l = makeList({ name: c.name, items: c.items, repeat: { every: "once" }, now }); return { st: addList(st, l), list: l, line: { en: l.items.length === 1 ? "Saved your list “{n}” — 1 item" : "Saved your list “{n}” — {k} items", v: { n: l.name, k: l.items.length } } }; }
    const fresh = c.items.filter((x) => !old.items.some((y) => y.text.toLowerCase() === x.toLowerCase()));
    const st2 = fresh.length ? addItem(st, old.id, fresh.join(",")) : st;
    return { st: st2, list: st2.lists.find((l) => l.id === old.id), line: { en: "Added to your list “{n}”", v: { n: old.name } } };
  }
  if (c.op === "trip") {
    const l = st.lists.find((x) => TRAVEL.test(x.name)) || null;
    if (!l) return { st, list: null, line: { en: "Have a nice trip! Make a travel list once — “make my travel checklist: passport, charger…” — and it comes back before every trip." } };
    const st2 = editList(st, l.id, { repeat: { ...l.repeat, every: "date", date: c.date, before: l.repeat.before == null ? 1 : l.repeat.before } });
    return { st: st2, list: st2.lists.find((x) => x.id === l.id), line: { en: "Your list “{n}” will be on Home before {d}", v: { n: l.name, date: c.date } } };
  }
  if (c.op === "show") {
    const l = findList(st, c.name);
    return l ? { st, list: current(l, now), line: { en: "Your list “{n}”", v: { n: l.name } } } : { st, list: null, line: { en: "No list called “{n}” yet — make one: “make my {n} list: …”", v: { n: c.name } } };
  }
  return null;
}
