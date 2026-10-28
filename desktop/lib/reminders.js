// Reminders on the desktop — the phone's Reminders.kt: {id, at (ms), title, body, repeat: none|daily|weekly|weekdays|monthly|last:N|days:…},
// the same id replaces; shown as a system notification at its time; a repeating one moves to its next time
// (Egypt's weekend is Friday + Saturday for "weekdays"). They ring while Attune is open (or in the tray).
"use strict";
const fs = require("fs");
const path = require("path");

const MAX_WAIT = 6 * 3600e3;   // timers are re-armed at least every 6 hours (setTimeout tops out at ~24 days, and clocks change)

function next(from, repeat, after) {
  const d = new Date(from); let guard = 0;
  while (d.getTime() <= after && guard++ < 1000) {
    if (repeat === "daily") d.setDate(d.getDate() + 1);
    else if (repeat === "weekly") d.setDate(d.getDate() + 7);
    else if (repeat === "weekdays") { do { d.setDate(d.getDate() + 1); } while (d.getDay() === 5 || d.getDay() === 6); }
    // v8.7 (Ali: "the fixes on the desktop app too"): the same repeats as the phone's Reminders.kt — it rang once and stopped
    else if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
    else if (/^last:\d$/.test(repeat || "")) {   // "every last Friday of the month" (0 = Sunday)
      const wd = +repeat.slice(5); d.setDate(1); d.setMonth(d.getMonth() + 1); d.setMonth(d.getMonth() + 1, 0);
      while (d.getDay() !== wd) d.setDate(d.getDate() - 1);
    } else if (/^days:/.test(repeat || "")) {    // "days:0,2,4" — the next of those weekdays
      const ds = new Set(repeat.slice(5).split(",").map((x) => +x).filter((x) => x >= 0 && x <= 6));
      if (!ds.size) return from;
      do { d.setDate(d.getDate() + 1); } while (!ds.has(d.getDay()));
    }
    else return from;
  }
  return d.getTime();
}

function makeReminders({ data, notify, now = () => Date.now() }) {
  const file = path.join(data, "reminders.json");
  let list = []; try { list = JSON.parse(fs.readFileSync(file, "utf8")); if (!Array.isArray(list)) list = []; } catch (e) {}
  const save = () => { try { fs.writeFileSync(file, JSON.stringify(list)); } catch (e) {} };
  const timers = new Map();
  function arm(r) {
    clearTimeout(timers.get(r.id));
    const wait = r.at - now();
    timers.set(r.id, setTimeout(() => (r.at - now() > 1000 ? arm(r) : fire(r.id)), Math.max(0, Math.min(wait, MAX_WAIT))));
  }
  function fire(id) {
    const r = list.find((x) => x.id === id); if (!r) return;
    try { notify(r); } catch (e) {}
    // it may fire up to 1 s early: move past its own time too, or a repeating one rings twice
    if ((r.repeat || "none") !== "none") { r.at = next(r.at, r.repeat, Math.max(now(), r.at)); save(); arm(r); }
    else unschedule(id);
  }
  function schedule(r) {
    if (!r || !r.id || !(r.at > 0)) return false;
    const item = { id: String(r.id), at: +r.at, title: String(r.title || ""), body: String(r.body || ""), repeat: r.repeat || "none" };
    list = list.filter((x) => x.id !== item.id).concat([item]); save(); arm(item);
    return true;
  }
  function unschedule(id) {
    clearTimeout(timers.get(id)); timers.delete(id);
    const n = list.length; list = list.filter((x) => x.id !== id); save();
    return list.length !== n;
  }
  // after a restart: repeating ones missed while closed move to their next time; one-off missed ones are left for the page to show
  function rearmAll() {
    const t = now();
    for (const r of list) {
      if (r.at <= t) { if ((r.repeat || "none") === "none") continue; r.at = next(r.at, r.repeat, t); }
      arm(r);
    }
    save();
  }
  return { schedule, unschedule, all: () => list.slice(), rearmAll, next, stop: () => { for (const t of timers.values()) clearTimeout(t); } };
}

module.exports = { makeReminders, next };
