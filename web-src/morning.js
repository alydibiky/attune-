/* ---- v8.7 (persona 4, idea 1 — Ali: "I like everything, do all"): the morning card ------------------------------------------
   One notification a morning, written by code from what is on the phone: what is due or late (Follow-ups' timeline), what is safe
   to spend today, yesterday's food against the goal, and what an agent found. People open apps that tell them something new.
   Android shows the text stored when the reminder was set, so the app writes TOMORROW's card each time it opens (and on the
   way out) — with the data of that moment. Pure: stores in, { title, lines } out.                                              */
import { tr } from "./i18n.js";
import { timeline } from "./timeline.js";
import { safeToSpend } from "./safespend.js";
import { dayTotals } from "./fit.js";
import { billsOf, billLine } from "./bills.js";
import { homeCurrency } from "./locale.js";
import { vitalsWeek } from "./vitals.js";

const DAY = 864e5;
const iso = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const f = (v) => Math.round(v).toLocaleString("en-US");

/** The card for the morning of `day` (ms, any time that day). → { title, lines: [string], count } — count 0 = nothing to say. */
export function morningCard({ ledger, life, radar, fit, agents, reminders = [], vitals = null } = {}, day = Date.now(), lang = "en") {
  const ar = lang === "ar", d0 = new Date(day); d0.setHours(8, 0, 0, 0);
  const today = iso(d0), lines = [];
  // what is due today, and what is late
  let tl = []; try { tl = timeline({ life, radar, ledger, reminders, now: d0.getTime(), days: 0, back: 30 }); } catch (e) {}
  const late = tl.filter((x) => x.late && x.kind !== "reminder"), due = tl.filter((x) => x.date === today && !x.late);
  for (const x of due.slice(0, 3)) lines.push((ar ? "النهارده: " : tr("Today: ")) + x.what + (x.amount ? ` · ${f(x.amount)}` : ""));
  if (late.length) lines.push(ar ? `${late.length} متأخرين — ${late[0].what}` : `${late.length} late — ${late[0].what}${late.length > 1 ? " and more" : ""}`);
  // v8.7 bills autopilot: higher than usual, not come yet, coming in a few days
  try { for (const b of billsOf(ledger, d0.getTime()).filter((b) => b.status !== "ok").slice(0, 2)) lines.push(billLine(b, lang, homeCurrency(ledger))); } catch (e) {}
  // safe to spend
  try { const s = safeToSpend({ ledger, life, radar, now: d0.getTime() }); if (s && s.perDay > 0 && ((ledger && ledger.txns) || []).length) lines.push(ar ? `تقدر تصرف النهارده ${f(s.perDay)} ${s.cur}` : `Safe to spend today: ${f(s.perDay)} ${s.cur}`); } catch (e) {}
  // yesterday's food
  const y = iso(d0.getTime() - DAY), yd = fit && fit.days && fit.days[y];
  if (yd && Object.values(yd.meals || {}).some((m) => (m || []).length)) {
    const k = Math.round(dayTotals(yd).kcal || 0), goal = fit.goal || (fit.profile && fit.profile.kcal) || 0;
    lines.push(goal ? (ar ? `امبارح أكلت ${f(k)} من ${f(goal)} سعرة` : `Yesterday: ${f(k)} of ${f(goal)} kcal`) : (ar ? `امبارح أكلت ${f(k)} سعرة` : `Yesterday: ${f(k)} kcal`));
  }
  // v8.7 the watch: one line when something is off (low oxygen, high blood pressure, short sleep, stress)
  try { const w = vitals && vitalsWeek(vitals, d0.getTime()), l = w && w.lines.find((x) => x.level !== "ok"); if (l) lines.push(ar ? l.ar : tr(l.en)); } catch (e) {}
  // what an agent found (the newest find in the last 2 days)
  const found = ((agents && agents.agents) || []).filter((a) => a.on !== false && a.found && a.found.at > d0.getTime() - 2 * DAY).sort((a, b) => b.found.at - a.found.at)[0];
  if (found) lines.push(ar ? `الوكيل لقى ${found.title || found.what}: ${f(found.found.price)}` : `Agent found ${found.title || found.what}: ${f(found.found.price)}`);
  return { title: ar ? "صباح الخير — يومك في سطور" : tr("Good morning — your day in a few lines"), lines: lines.slice(0, 5), count: lines.length };
}

/** The reminder for tomorrow 8:00 (or `hour`) — or null when the card would say nothing. id is fixed: each one replaces the last. */
export function morningReminder(stores, now = Date.now(), lang = "en", hour = 8) {
  const t = new Date(now); t.setDate(t.getDate() + (t.getHours() >= hour ? 1 : 0)); t.setHours(hour, 0, 0, 0);
  const c = morningCard(stores, t.getTime(), lang);
  if (!c.count) return null;
  return { id: "daily-morning", at: t.getTime(), repeat: "none", title: c.title, body: c.lines.join(" · "), created: now, source: "morning" };
}
