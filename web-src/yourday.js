/* ---- v9.3 "Your day" on Home (Ali picked D1 A: a morning card — prayers, due to-dos, agents' news — that turns into "Close the day" in
   the evening, with one tap to move what is left to tomorrow; prayers ONLY when turned on in Settings; A2 A: Ramadan, also only when
   turned on). Pure; tests: tests/unit/v930yourday.test.mjs.                                                                         */
import { prayerTimes, methodFor } from "./prayer.js";
import { CITIES, zoneOffset } from "./fitplus.js";
import { agentStatus } from "./agent-rules.js";

export const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const minOf = (d) => d.getHours() * 60 + d.getMinutes();
/** Today's five prayers for the city the person chose, and which one is next. → { list: [{ k, min, at "HH:MM" }], next: k|"" , city } */
export function prayersToday(cityKey, now = Date.now(), { asr = 1 } = {}) {
  const c = CITIES[cityKey] || CITIES.cairo, d = new Date(now);
  const t = prayerTimes(d, c.lat, c.lon, zoneOffset(d, c.tz), { method: methodFor(c.tz), asr });
  const list = PRAYERS.map((k) => ({ k, min: t[k], at: t[k + "At"] })).filter((x) => x.min != null);
  const m = minOf(d), next = (list.find((x) => x.min > m) || { k: "" }).k;
  return { list, next, city: cityKey in CITIES ? cityKey : "cairo" };
}

/** Morning or evening: from the evening hour (Settings, 20:00 by default) until 3 am the card is "Close the day". */
export const isEvening = (now = Date.now(), hour = 20) => { const h = new Date(now).getHours(); return h >= hour || h < 3; };

const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** The evening count: what was done today, what is left (late or still today), and which reminders can move to tomorrow. */
export function closeDay(reminders = [], todos = [], now = Date.now()) {
  const s = startOfDay(now), end = s + 864e5;
  const done = reminders.filter((r) => r && r.done && r.doneAt >= s).length + todos.filter((r) => r && r.meta && r.meta.done && r.meta.doneAt >= s).length;
  const left = reminders.filter((r) => r && !r.done && r.at && r.at < end && r.at >= s - 3 * 864e5 && (!r.repeat || r.repeat === "none"));
  const openTodos = todos.filter((r) => r && r.meta && r.meta.todo && !r.meta.done).length;
  return { done, left: left.length + openTodos, movable: left.map((r) => r.id) };
}
/** "Move to tomorrow": each reminder keeps its time of day, on tomorrow's date. */
export function moveToTomorrow(reminders = [], ids = [], now = Date.now()) {
  const want = new Set(ids), tomorrow = startOfDay(now) + 864e5;
  return reminders.map((r) => {
    if (!r || !want.has(r.id)) return r;
    const d = new Date(r.at), at = tomorrow + (d.getHours() * 60 + d.getMinutes()) * 6e4;
    return { ...r, at, moved: (r.moved || 0) + 1 };
  });
}

/** The agents' news for the day: what needs you, then what was found (newest first), at most 3. */
/** v9.9 (Ali's Home: "Huawei free clips 2 · Found · 120 EGP" — a case kept from before the v9.8 price guard): a price is believed only
 *  when it is not under 30 % of the person's limit / of what this agent usually sees, and not a few hundred pounds for earbuds,
 *  a phone, a laptop… (an accessory). */
const PRICEY = /\b(free ?clips?|freebuds|airpods|buds|earbuds|headphones?|iphone|galaxy|pixel|phone|laptop|macbook|ipad|tablet|watch|tv|playstation|ps5|xbox|camera|car|apartment|flat|hotel)\b|سماعه|سماعة|موبايل|لابتوب|ساعه|ساعة|تليفزيون|عربيه|عربية|شقه|شقة|فندق/i;
export function believable(a, price) {
  if (!(price > 0)) return false;
  const ps = (a.checks || []).map((c) => c.price).filter((v) => v > 0).sort((x, y) => x - y), mid = ps.length ? ps[Math.floor(ps.length / 2)] : 0;
  const ref = a.below > 0 ? a.below : mid;
  if (ref && price < ref * 0.3) return false;
  if (/^(egp|جنيه)?$/i.test(String(a.currency || "EGP")) && PRICEY.test(String(a.what || a.title || a.said || "")) && price < 400) return false;
  return true;
}
export function agentNews(agents = [], now = Date.now()) {
  const rows = (agents || []).filter((a) => a && a.on !== false).map((a) => ({ a, s: agentStatus(a) })).filter((x) => x.s === "needs" || x.s === "found")
    .filter((x) => x.s === "needs" || !(x.a.found && x.a.found.price > 0) || believable(x.a, x.a.found.price));
  const last = (a) => Math.max(0, ...((a.checks || []).map((c) => c.at || 0)), (a.found && a.found.at) || 0);
  return rows.sort((x, y) => (x.s === y.s ? last(y.a) - last(x.a) : x.s === "needs" ? -1 : 1)).slice(0, 3).map(({ a, s }) => {
    const p = [a.found && a.found.price, ((a.checks || []).filter((c) => c.price > 0).slice(-1)[0] || {}).price, (a.pending || {}).price].find((v) => v > 0 && believable(a, v)) || 0;
    return { id: a.id, status: s, title: String(a.what || a.title || "").replace(/^[^·]*·\s*/, (m) => (a.what ? "" : m)).slice(0, 70), price: p, currency: a.currency || "" };
  });
}

/** Ramadan: the countdown to iftar (Maghrib) during the day, to the end of suhoor (Fajr) at night. → { to: "iftar"|"suhoor", at, left (ms) } */
export function ramadanCountdown(cityKey, now = Date.now()) {
  const p = prayersToday(cityKey, now), d = new Date(now), m = minOf(d);
  const get = (k) => (p.list.find((x) => x.k === k) || {}).min;
  const fajr = get("fajr"), maghrib = get("maghrib");
  const atMin = (min, plusDay = 0) => { const x = new Date(now); x.setHours(0, 0, 0, 0); return x.getTime() + plusDay * 864e5 + min * 6e4; };
  if (fajr != null && m < fajr) return { to: "suhoor", at: atMin(fajr), left: atMin(fajr) - now, fajr: p.list[0].at, maghrib: (p.list.find((x) => x.k === "maghrib") || {}).at };
  if (maghrib != null && m < maghrib) return { to: "iftar", at: atMin(maghrib), left: atMin(maghrib) - now, fajr: p.list[0].at, maghrib: (p.list.find((x) => x.k === "maghrib") || {}).at };
  const tomorrowFajr = prayersToday(cityKey, now + 864e5).list[0];
  return { to: "suhoor", at: atMin(tomorrowFajr.min, 1), left: atMin(tomorrowFajr.min, 1) - now, fajr: tomorrowFajr.at, maghrib: (p.list.find((x) => x.k === "maghrib") || {}).at };
}
export const hms = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 3600) + ":" + String(Math.floor(s / 60) % 60).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
