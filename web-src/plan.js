/* ---- v9.9.34 Free and Pro (Ali picked FP-4, 13–14 Nov 2026: "Free = you do it, Attune keeps it · Pro = Attune does it for you,
   everywhere" — with his condition on OK-1: "Don't remove undo as the app could still get something wrong"). One place that knows:
     - whether Pro is on right now (Pro, the trial, a bonus, or developer testing) — set by attune.jsx each render (setProNow);
     - the FP-4 limits for Free and the daily counts;
     - which features are Pro only.
   Everything typed or said stays unlimited in Free; nothing a person made is ever deleted when Pro ends (only what Attune does BY ITSELF
   or the extra reach stops). Pure, with localStorage wrapped. Tests: tests/plan/gen.mjs (10,000) + tests/unit/v9934plan.test.mjs. */

let PRO = true;
/** attune.jsx says whether Pro (or the trial) is on, every render. */
export function setProNow(v) { PRO = !!v; }
export const proNow = () => PRO;

/** FP-4: how much Free includes. Per day where it says "day"; otherwise a count of things kept at once. */
export const LIMITS = {
  agents: 1,          // agents (price watch, hotels, flights, Scout) running at once
  rules: 1,           // automations and phone rules switched on at once
  papers: 10,         // documents with dates (Deadline Radar / papers)
  photo: 3,           // photo reads a day (receipts, papers)
  deal: 3,            // Deal Checks a day
  xray: 3,            // Chat X-Rays a day
  convert: 3,         // file conversions a day
  slides: 3,          // presentations or reports a day
  historyMonths: 3,   // Money history shown: this month and the 2 before (older months stay saved, shown with Pro)
};
/** FP-4: what only Pro has (Free sees it with a short "Pro" note; nothing is deleted). */
export const PRO_ONLY = new Set([
  "autoMoney",        // bank / wallet messages saved by themselves (Free: each one waits for a tap)
  "guardianChase",    // Money Guardian chases for you (Free: sees the findings)
  "closeDay", "weekPlan", "msgSchedule",   // Free keeps the morning brief
  "sync", "desktop", "moneyForTwo", "driveBackup",
  "yearReport", "pdfExport", "excelExport",
  "expertReview", "deepResearch",
  "guideFull", "brain",
]);
export const isProOnly = (feature) => PRO_ONLY.has(feature);
/** May this be used now? A Pro-only feature needs Pro; anything else is free. */
export const allowed = (feature, pro = PRO) => pro || !PRO_ONLY.has(feature);

const KEY = "attune:plan:uses:v1";
const day = (now) => { const d = new Date(now); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
function load() { try { const v = JSON.parse(localStorage.getItem(KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } }
function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
/** How many times `kind` was used today. */
// (a count per day — v9.9.34 the 10,000 run: one remembered day let a use stamped on another day, after a clock or time-zone change,
//  wipe today's count; only the last 3 days are kept)
const perDay = (x) => (x && typeof x === "object" && !("day" in x) ? x : x && x.day ? { [x.day]: x.n || 0 } : {});
export function usedToday(kind, now = Date.now()) { return perDay(load()[kind])[day(now)] || 0; }
/** One more use of `kind` today (counted for everyone, so Pro can say what it saved). */
export function noteUse(kind, now = Date.now()) {
  const v = load(), d = day(now), m = perDay(v[kind]); m[d] = (m[d] || 0) + 1;
  v[kind] = Object.fromEntries(Object.entries(m).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 3)); save(v); return m[d];
}
/** Can one more `kind` be used today? → { ok, left, limit } (Pro: always ok, left Infinity). `count` = how many are kept now, for limits of things kept at once. */
export function canUse(kind, { pro = PRO, now = Date.now(), count = null } = {}) {
  const limit = LIMITS[kind];
  if (pro || limit == null) return { ok: true, left: Infinity, limit: Infinity };
  const used = count != null ? count : usedToday(kind, now), left = Math.max(0, limit - used);
  return { ok: left > 0, left, limit };
}
/** The first day Free shows in Money's history (ISO), or "" with Pro. 3 months = this month and the 2 before. */
export function historyFrom(now = Date.now(), pro = PRO) {
  if (pro) return "";
  const d = new Date(now); d.setDate(1); d.setMonth(d.getMonth() - (LIMITS.historyMonths - 1));
  return day(d.getTime());
}

/** v9.9.34: rules switched on now — automations (attune:auto) + phone rules (attune:rules) — for the Free limit of 1. */
export function rulesOn() {
  const n = (k, f) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return f(v) || 0; } catch (e) { return 0; } };
  return n("attune:auto:v1", (v) => (v && Array.isArray(v.rules) ? v.rules.length : 0)) + n("attune:rules:v1", (v) => (Array.isArray(v) ? v.filter((r) => r && r.on !== false).length : v && Array.isArray(v.rules) ? v.rules.filter((r) => r && r.on !== false).length : 0));
}
/** May one more rule be switched on? (adding `adding` rules at once) */
export const ruleRoom = (adding = 1, pro = PRO) => pro || rulesOn() + adding <= LIMITS.rules;

/* ---- v9.9.34 PM-1 + PM-2 (Ali picked): Pro is shown at the moment of effort and once a week — never more than 1 Pro note a day, never
   on a day something is due, "Not now" = quiet for 14 days. Counted from Money itself: a payment saved from a bank / wallet message
   has source "notification"; anything else was typed (or said) by the person. */
const DAY = 86400000;
/** This week (the last 7 days): payments typed by hand, saved from messages, and reminders made. */
export function weekStats(ledger, reminders = [], now = Date.now()) {
  const from = day(now - 6 * DAY), txns = ((ledger && ledger.txns) || []).filter((t) => t && (t.type === "expense" || t.type === "income") && String(t.date || "") >= from && String(t.date || "") <= day(now));
  const made = (r) => +(r && (r.created || r.made || r.createdAt)) || 0;
  return { typed: txns.filter((t) => !t.source).length, fromMsgs: txns.filter((t) => t.source === "notification").length,
    reminders: (reminders || []).filter((r) => made(r) >= now - 7 * DAY && made(r) <= now).length };
}
/** Minutes saved: about 45 seconds for each payment Attune saved from a message instead of you typing it. */
export const minutesFor = (payments) => Math.round((payments * 45) / 60);
const NKEY = "attune:plan:nudge:v1";
const nload = () => { try { return JSON.parse(localStorage.getItem(NKEY) || "{}") || {}; } catch (e) { return {}; } };
const nsave = (v) => { try { localStorage.setItem(NKEY, JSON.stringify(v)); } catch (e) {} };
/** PM-1: show "Pro would have done this" now? Free, ≥ 5 typed this week, not shown today, no Pro note today, not snoozed, nothing due today. */
export function showTypedNudge({ pro = PRO, typed = 0, dueToday = 0, now = Date.now(), st = nload() } = {}) {
  return !pro && typed >= 5 && !dueToday && st.day !== day(now) && now >= (st.until || 0);
}
/** PM-2: the Friday card (once a week, on Friday — or the first open after it that week). */
export function showWeekCard({ now = Date.now(), st = nload(), dueToday = 0 } = {}) {
  const d = new Date(now), fri = new Date(now - ((d.getDay() + 2) % 7) * DAY);   // this week's Friday (today when it is Friday)
  return !dueToday && st.day !== day(now) && st.week !== day(fri.getTime()) && (d.getDay() === 5 || d.getDay() === 6);
}
/** Marks a Pro note as shown today (and the week for the Friday card); "Not now" snoozes for 14 days. */
export function noteShown(kind, { now = Date.now(), notNow = false } = {}) {
  const st = nload(), d = new Date(now), fri = new Date(now - ((d.getDay() + 2) % 7) * DAY);
  st.day = day(now); if (kind === "week") st.week = day(fri.getTime()); if (notNow) st.until = now + 14 * DAY; nsave(st); return st;
}
