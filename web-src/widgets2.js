/* ---- v10.5 the interactive widgets (Ali, 18 Nov 2026: "widgets for most things in the app in a smart way … interactive … so I can do
   things without opening the app"; he OK'd OK-A1 OK-W1 OK-W2 OK-W3 OK-W5 OK-W6 OK-W7 OK-S on docs/mockups/widgets-combined.html).
   What each widget SHOWS, worked out here from the app's own stores (pure: the words come in through `t`), and what the TAPS made on the
   home screen DO (applyActs). The phone only draws the cards (AttuneWidgets.kt) and keeps the taps until the page applies them.
     list   A1  every list, its round now: what's left first, the ticked ones under it; ‹ › switches list (per widget)
     day    W1  today's next 3: reminders (Done · +1h), bills due today (Paid), to-dos (Done)
     money  W2  safe to spend today, a bank SMS waiting (Add ✓ · ✕), − I spent / + I got (the small box)
     agents W5  each agent's latest find + its change (Open ↗ the exact listing · Pause)
     med · papers · trip · next  W6  one thing each (Taken / +30m · Steps · Open · Remind)
     stack  W7  the cards above as pages, the first chosen by code — a bank SMS waiting, a medicine due, an agent's better price, the
                night (close the day), the morning (your day) — every page says why it is first
   A card: { title, icon, side, big, bigLabel, rows: [{ id, text, sub, btns: [[action, label, primary]], open }], btns, empty, open }.
   An action from the phone: { w, a, id, at } (w = widget kind, a = action). Tests: tests/widgets/gen.mjs (10,000 HARD) + held-out +
   tests/unit/v1050widgets.test.mjs. */
import * as L from "./lists.js";
import { dueSoon, togglePaid, paysMe } from "./life.js";
import { dosesOn, markTaken } from "./care.js";
import { occasions } from "./b5people.js";
import { bestSoFar, bestChange } from "./agents.js";

const DAY = 864e5, H = 36e5;
const pad = (n) => String(n).padStart(2, "0");
export const isoDay = (t) => { const d = new Date(t); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
const hm = (t) => { const d = new Date(t); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
const num = (v) => Math.round(Number(v) || 0).toLocaleString("en-US");
const daysTo = (iso, now) => Math.round((Date.parse(iso + "T12:00:00") - Date.parse(isoDay(now) + "T12:00:00")) / DAY);
const clip = (s, n = 80) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);
const id0 = (x) => String(x == null ? "" : x);

/* ---------------------------------------------------------------- A1 the lists */
/** Every list's round now → [{ id, title, left, items: [{ id, text, done }] }] (what is left first, then the ticked ones). */
export function listsData(st, { now = Date.now(), t = (s) => s } = {}) {
  return ((st && st.lists) || []).map((l0) => { const l = L.current(l0, now), items = l.items || [];
    const left = items.filter((x) => !x.done), done = items.filter((x) => x.done);
    return { id: l.id, title: clip((l.emoji ? l.emoji + " " : "") + l.name, 50), left: left.length, of: items.length,
      side: left.length ? t("{n} left").replace("{n}", left.length) : items.length ? t("All done ✓") : "",
      items: [...left, ...done].slice(0, 60).map((x) => ({ id: id0(x.id), text: clip(x.text, 80), done: !!x.done })) }; });
}

/* ---------------------------------------------------------------- W1 your day */
/** Today's next 3 things, in time order (untimed after): reminders (late ones first), bills due today I pay, open to-dos. */
export function dayCard({ reminders = [], todos = [], life = { items: [] }, now = Date.now(), t = (s) => s, loc = "" } = {}) {
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const rem = (reminders || []).filter((r) => r && !r.done && !r.deleted && r.at > 0 && r.at <= end.getTime() && (r.at >= now - 12 * H))
    .map((r) => ({ id: "rem:" + r.id, at: r.at, text: clip(r.title), sub: r.at < now ? t("late") : hm(r.at), btns: [["snooze", t("+1h"), 0], ["done", t("Done"), 1]], open: "reminders" }));
  const today = isoDay(now);
  let bills = []; try { bills = dueSoon(life || { items: [] }, now, 0).filter((x) => x.date === today && x.c && x.c.dir !== "in" && paysMe(x.c)); } catch (e) { bills = []; }
  const bl = bills.map((x) => ({ id: "bill:" + x.c.id + ":" + x.i, at: end.getTime() - 1, text: clip((x.c.title || x.c.person || t("Bill")) + " · " + num(x.amount)), sub: t("due today"), btns: [["paid", t("Paid"), 1]], open: "life" }));
  const td = (todos || []).filter((r) => r && r.id && !(r.meta && r.meta.done)).map((r) => ({ id: "todo:" + r.id, at: end.getTime(), text: clip(r.title || r.text), sub: "", btns: [["done", t("Done"), 1]], open: "memory" }));
  const all = [...rem, ...bl, ...td].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let wd = ""; try { wd = new Date(now).toLocaleDateString(loc || undefined, { weekday: "long" }); } catch (e) {}
  return { kind: "day", icon: "☀", title: t("Your day") + (wd ? " · " + wd : ""), side: all.length ? t("{n} left").replace("{n}", all.length) : "",
    rows: all.slice(0, 3).map(({ at, ...r }) => r), empty: t("Nothing left today ✓"), open: "timeline" };
}

/* ---------------------------------------------------------------- W2 money */
/** safe = safespend.js result (or null), pending = bank payments waiting for an OK (bankcheck.js `add`), salaryDay = 1–31 or 0. */
export function moneyCard({ safe = null, pending = [], salaryDay = 0, t = (s) => s } = {}) {
  const p = (pending || [])[0];
  return { kind: "money", icon: "£", title: t("Money"), side: salaryDay ? t("salary on the {d}").replace("{d}", salaryDay) : "",
    bigLabel: safe ? t("Safe to spend today") : t("Open Money once to start"), big: safe ? num(safe.today) + (safe.cur ? " " + safe.cur : "") : "",
    rows: p ? [{ id: "bank:" + p.id, text: (p.direction === "in" ? "+" : "−") + num(p.amount) + " " + clip(p.party || p.from || "", 30), sub: clip(p.from || p.app || "", 20),
      btns: [["dismiss", "✕", 0], ["add", t("Add ✓"), 1]], open: "money" }] : [],
    btns: [["spend", t("− I spent"), 1], ["got", t("+ I got"), 0]], empty: "", open: "money", hideable: true };
}

/* ---------------------------------------------------------------- W5 agents */
export function agentsCard(st, { now = Date.now(), t = (s) => s } = {}) {
  const on = ((st && st.agents) || []).filter((a) => a && a.on !== false);
  const last = (a) => Math.max(0, ...((a.checks || []).map((c) => c.at || 0)));
  const rows = on.map((a) => { const b = bestSoFar(a), ch = bestChange(a), price = b && b.price > 0 ? b.price : 0;
    const what = clip(a.what || a.title || a.said || "", 40);
    const sub = price ? (ch && ch.by > 0 ? "−" + Math.round(100 * ch.by / (ch.was || 1)) + "%" : ch && ch.by < 0 ? "+" + Math.round(100 * -ch.by / (b.price || 1)) + "%" : "") : t("not found yet");
    return { id: "agent:" + a.id, at: last(a), text: what + (price ? " · " + num(price) + (b.site ? " " + t("at {s}").replace("{s}", clip(b.site, 18)) : "") : ""), sub,
      btns: [["pause", t("Pause"), 0], ...(b && /^https:\/\//.test(b.href || "") ? [["url:" + b.href, t("Open ↗"), 1]] : [])], open: "agents" }; })
    .sort((x, y) => y.at - x.at);
  const lastAt = Math.max(0, ...rows.map((r) => r.at));
  return { kind: "agents", icon: "◎", title: t("Agents"), side: lastAt ? t("checked {h}").replace("{h}", hm(lastAt)) : "", rows: rows.slice(0, 3).map(({ at, ...r }) => r),
    empty: t("No agent watching — tell Attune what to watch"), open: "agents" };
}

/* ---------------------------------------------------------------- W6 four small ones */
export function medCard(care, { now = Date.now(), t = (s) => s } = {}) {
  let d = []; try { d = dosesOn(care || {}, now); } catch (e) { d = []; }
  const nowHm = hm(now), next = d.find((x) => !x.taken && (x.late || x.time >= nowHm)) || null;
  return { kind: "med", icon: "💊", title: t("Medicine"), line: next ? clip(next.med.name + (next.member && next.member.name ? " · " + next.member.name : ""), 40) : t("No dose left today"),
    big: next ? next.time : "", rows: next ? [{ id: "med:" + next.key, text: clip(next.med.name, 40), sub: next.time, btns: [["snooze", t("+30m"), 0], ["taken", t("Taken"), 1]], open: "care" }] : [], open: "care" };
}
export function papersCard(radar, { now = Date.now(), t = (s) => s } = {}) {
  const today = isoDay(now);
  const it = (((radar && radar.items) || []).filter((x) => x && x.date && x.date >= today && x.status !== "deleted" && x.status !== "done").sort((a, b) => a.date.localeCompare(b.date)))[0];
  const n = it ? daysTo(it.date, now) : 0;
  return { kind: "papers", icon: "📄", title: t("Papers"), line: it ? clip(it.title, 40) : t("Nothing ends soon"), big: it ? (n === 0 ? t("today") : t("{n} days").replace("{n}", n)) : "",
    rows: it ? [{ id: "paper:" + it.id, text: clip(it.title, 40), sub: it.date, btns: [["open", t("Steps"), 0]], open: "radar" }] : [], open: "radar" };
}
export function tripCard(trip, { now = Date.now(), t = (s) => s, place = "" } = {}) {
  const ok = trip && /^\d{4}-\d{2}-\d{2}$/.test(trip.depart || "") && trip.depart >= isoDay(now);
  const n = ok ? daysTo(trip.depart, now) : 0;
  return { kind: "trip", icon: "✈", title: t("Trip"), line: ok ? clip((place || trip.country || "") + " · " + trip.depart, 40) : t("No trip planned"), big: ok ? (n === 0 ? t("today") : t("{n} days").replace("{n}", n)) : "",
    rows: ok ? [{ id: "trip:" + (trip.country || "x"), text: clip(place || trip.country || "", 40), sub: trip.depart, btns: [["open", t("Open"), 0]], open: "travel" }] : [], open: "travel" };
}
export function nextCard(dates, { now = Date.now(), t = (s) => s } = {}) {
  let o = null; try { o = occasions(dates || [], now)[0] || null; } catch (e) { o = null; }
  const what = o ? (o.kind === "birthday" ? t("{n}'s birthday") : o.kind === "anniversary" ? t("{n}'s anniversary") : t("{n}'s day")).replace("{n}", clip(o.who, 24)) : "";
  return { kind: "next", icon: "📅", title: t("Next date"), line: o ? what : t("No dates saved"), big: o ? (o.inDays === 0 ? t("today") : o.inDays === 1 ? t("tomorrow") : t("{n} days").replace("{n}", o.inDays)) : "",
    rows: o ? [{ id: "date:" + o.id + ":" + o.next, text: what, sub: o.next, btns: [["remind", t("Remind"), 0]], open: "people" }] : [], open: "people" };
}

/* ---------------------------------------------------------------- W7 the smart stack */
/** cards = { day, money, agents, med, papers, trip, next, lists } (built above), signals = { bankWaiting, medDueIn (minutes or null),
 *  agentBetter (true when an agent's price fell in the last 12 h), placeList (a list id the phone says you are near) }. → { pages: [card + reason] } */
export function stackData(cards, signals = {}, { now = Date.now(), t = (s) => s, spentToday = 0, left = 0 } = {}) {
  const h = new Date(now).getHours(), pages = [], add = (c, reason) => { if (c && !pages.some((p) => p.kind === c.kind)) pages.push({ ...c, reason }); };
  const list = signals.placeList && (cards.lists || []).find((l) => l.id === signals.placeList);
  if (list) add({ kind: "list", icon: "🛒", title: list.title, side: list.side, rows: list.items.filter((x) => !x.done).slice(0, 3).map((x) => ({ id: "list:" + list.id + ":" + x.id, text: x.text, sub: "", btns: [["tick", "✓", 1]], open: "lists" })), open: "lists" }, t("You're near a shop on this list"));
  if (signals.bankWaiting && cards.money && cards.money.rows.length) add(cards.money, t("A bank message is waiting"));
  if (signals.medDueIn != null && signals.medDueIn <= 60 && cards.med && cards.med.rows.length) add(cards.med, t("A medicine is due"));
  if (signals.agentBetter && cards.agents && cards.agents.rows.length) add(cards.agents, t("An agent found a better price"));
  if (h >= 22 || h < 3) add({ kind: "night", icon: "🌙", title: t("Close the day"), line: t("Spent today {a} · {n} things left").replace("{a}", num(spentToday)).replace("{n}", left), rows: [], btns: [["close", t("Close the day"), 1]], open: "home" }, t("It's late"));
  if (h >= 5 && h < 12) add(cards.day, t("Good morning — your day"));
  for (const k of ["day", "money", "agents", "med", "papers", "trip", "next"]) if (cards[k] && (cards[k].rows.length || k === "day" || k === "money")) add(cards[k], "");
  return { pages: pages.slice(0, 8) };
}

/* ---------------------------------------------------------------- the taps */
/** The taps made on the home screen → the stores changed once each (an action already applied is skipped by its key).
 *  stores = { reminders, lists, life, care, agents }. → { stores (only the changed ones), mind: [todo ids], schedule: [reminders to set],
 *  bankAdd: [ids], bankDismiss: [ids], done: [keys] } */
export const actKey = (x) => [x.w, x.a, x.id, x.at].join("|");
export function applyActs(acts = [], stores = {}, { now = Date.now(), seen = [], t = (s) => s } = {}) {
  let { reminders = [], lists = { lists: [] }, life = { items: [] }, care = {}, agents = { agents: [] } } = stores;
  const changed = new Set(), mind = [], schedule = [], bankAdd = [], bankDismiss = [], done = [], skip = new Set(seen || []);
  for (const x of acts || []) {
    if (!x || !x.a || !x.id) continue;
    const k = actKey(x); if (skip.has(k)) continue; skip.add(k); done.push(k);
    const [kind, ...rest] = String(x.id).split(":"), rid = rest.join(":"), at = x.at || now;
    if (kind === "rem") {
      if (x.a === "done") { reminders = reminders.map((r) => (String(r.id) === rid && !r.done ? { ...r, done: true, doneAt: at } : r)); changed.add("reminders"); }
      if (x.a === "snooze") { reminders = reminders.map((r) => { if (String(r.id) !== rid || r.done) return r; const n = { ...r, at: Math.max(r.at || 0, at) + H }; schedule.push(n); return n; }); changed.add("reminders"); }
    } else if (kind === "todo" && x.a === "done") mind.push(rid);
    else if (kind === "bill" && x.a === "paid") {
      const cut = rid.lastIndexOf(":"), cid = rid.slice(0, cut), i = +rid.slice(cut + 1), c = (life.items || []).find((y) => String(y.id) === cid);
      if (c && Number.isFinite(i) && !(c.paid || []).includes(i)) { life = togglePaid(life, c.id, i); changed.add("life"); }
    } else if (kind === "list") {
      const cut = rid.indexOf(":"), lid = cut > 0 ? rid.slice(0, cut) : rid, iid = cut > 0 ? rid.slice(cut + 1) : "";
      const l = (lists.lists || []).find((y) => y.id === lid); if (!l) continue;
      const cur = L.current(l, at), item = cur.items.find((y) => y.id === iid);
      if ((x.a === "tick" || x.a === "untick") && item && item.done !== (x.a === "tick")) { lists = L.tick(lists, lid, iid, at); changed.add("lists"); }
      if (x.a === "clear") { lists = { ...lists, lists: lists.lists.map((y) => (y.id === lid ? { ...L.current(y, at), items: L.current(y, at).items.filter((z) => !z.done) } : y)) }; changed.add("lists"); }
    } else if (kind === "bank") { if (x.a === "add") bankAdd.push(rid); if (x.a === "dismiss") bankDismiss.push(rid); }
    else if (kind === "med") {
      if (x.a === "taken" && !((care.taken || {})[rid])) { care = markTaken(care, rid, at); changed.add("care"); }
      if (x.a === "snooze") { const m = (care.meds || []).find((y) => rid.startsWith(y.id + "|")); schedule.push({ id: "wmed-" + rid.replace(/\W/g, ""), at: at + 30 * 60e3, title: t("Medicine: {m}").replace("{m}", m ? m.name : ""), repeat: "none", created: at, source: "widget" }); }
    } else if (kind === "agent" && x.a === "pause") { agents = { ...agents, agents: (agents.agents || []).map((a) => (String(a.id) === rid ? { ...a, on: false } : a)) }; changed.add("agents"); }
    else if (kind === "date" && x.a === "remind") {
      const cut = rid.lastIndexOf(":"), day = rid.slice(cut + 1);
      if (/^\d{4}-\d{2}-\d{2}$/.test(day)) { const d = new Date(day + "T09:00:00").getTime() - DAY; schedule.push({ id: "wdate-" + rid.replace(/\W/g, ""), at: Math.max(d, at + 60e3), title: t("Tomorrow: {w}").replace("{w}", clip(x.text || "", 60)), repeat: "none", created: at, source: "widget" }); }
    }
  }
  const out = {}; if (changed.has("reminders")) out.reminders = reminders; if (changed.has("lists")) out.lists = lists; if (changed.has("life")) out.life = life; if (changed.has("care")) out.care = care; if (changed.has("agents")) out.agents = agents;
  return { stores: out, mind, schedule, bankAdd, bankDismiss, done };
}

/* ---------------------------------------------------------------- the small box (W3, A1 "+ Add", W2 "I spent / I got") */
/** "cheese, pickles and bread" / «جبنة و مخلل» → the items to add (commas, "and", «و» between words). */
// (the 10,000 run: people end what they type with "thanks", "ok", «شكرا», «تمام», an emoji or "!!" — never part of the item)
const COURTESY = /(?:\s+|^)(?:thanks?|thank you|thx|ok(?:ay)?|pls|please|شكرا|شكراً|متشكر|تمام|ماشي|لو سمحت|!+|\([\d٠-٩]\/[\d٠-٩]\)|[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+)\s*$/iu;
const tidy = (s) => { let t = String(s).replace(/[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g, "").replace(/\s+/g, " ").trim(), prev; do { prev = t; t = t.replace(COURTESY, "").trim(); } while (t !== prev && t); return t; };
export function itemsOf(text) {
  return String(text || "").replace(/[\u200e\u200f\u061c]/g, "").split(/\s*(?:[,،;\n]|\s+and\s+|\s+&\s+|\s+و\s*(?=\S))\s*/i).map((s) => tidy(s.trim().replace(/^و(?=\S)/, ""))).filter((s) => s && s.length <= 140).slice(0, 30);
}
/** "200 koshary" / "koshary 200" / «٢٠٠ كشري» → { amount, note } or null. */
export function spendOf(text) {
  const s = String(text || "").replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/(\d)[,٬](?=\d{3}\b)/g, "$1");
  const m = /(\d+(?:[.٫]\d+)?)/.exec(s); if (!m) return null;
  const amount = parseFloat(m[1].replace("٫", ".")); if (!(amount > 0 && amount < 1e9)) return null;
  return { amount, note: clip(s.replace(m[0], " ").replace(/\b(egp|le|l\.e|usd|eur|sar|aed)\b|جنيه|جم|ج\.م|\bon\b|\bfor\b/gi, " "), 60) };
}
