/* ---- v9.9.18 AU5 "Nag until done" (Ali picked A + B combined, 11 Nov 2026 — AUTOMATION_PLAN.md):
   every reminder has a level of persistence — once · every 10 min · every 15 min (★ Important) · every hour · until I tick (every
   30 min, no cap) — and rings again on that rhythm until it is ticked, never inside the person's quiet hours. The same rules run on
   the phone (Reminders.kt nextNag) — keep the two equal. Pure; tests: tests/nag (10,000 cases) + tests/unit/v9918nag.test.mjs.     */

/** The levels, in the order the screen shows them. every = minutes between rings; cap = most rings after the first (0 = no cap). */
export const LEVELS = [
  { id: "once", every: 0, cap: 0, en: "Once" },
  { id: "m10", every: 10, cap: 12, en: "Every 10 min" },
  { id: "m15", every: 15, cap: 16, en: "Every 15 min", star: true },
  { id: "h1", every: 60, cap: 12, en: "Every hour" },
  { id: "until", every: 30, cap: 0, en: "Until I tick" },
];
export const IMPORTANT = "m15";   // ★ Important = every 15 min until done
export const levelOf = (id) => LEVELS.find((l) => l.id === id) || LEVELS[0];
/** A reminder's level: its own `nag`, else ★ → m15, else once. */
export const nagOf = (r) => levelOf((r && r.nag) || (r && r.important ? IMPORTANT : "once"));

const DAY = 864e5;
const hm = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "")); return m ? +m[1] * 60 + +m[2] : null; };
/** Quiet hours { from: "23:00", to: "07:00" } (may cross midnight). → is local time t inside them? */
export function inQuiet(t, quiet) {
  const f = hm(quiet && quiet.from), to = hm(quiet && quiet.to); if (f == null || to == null || f === to) return false;
  const d = new Date(t), m = d.getHours() * 60 + d.getMinutes();
  return f < to ? m >= f && m < to : m >= f || m < to;
}
/** The end of the quiet hours that t is inside (local time). */
export function quietEnd(t, quiet) {
  const to = hm(quiet.to), d = new Date(t), e = new Date(d); e.setHours(Math.floor(to / 60), to % 60, 0, 0);
  if (e.getTime() <= t) e.setTime(e.getTime() + DAY);
  return e.getTime();
}
/** After a ring at `last` (the n-th repeat already rung = n), the next ring — or 0 when it should stop. */
export function nextNag(r, last, n, { quiet = null } = {}) {
  const L = nagOf(r); if (!L.every) return 0;
  if (r && r.done) return 0;
  if (L.cap && n >= L.cap) return 0;
  let t = last + L.every * 60000;
  if (quiet && inQuiet(t, quiet)) t = quietEnd(t, quiet);
  return t;
}
/** Every ring from the first (at r.at) until `doneAt` (the tick) or `until`: for the tests and for "it came 3 times". */
export function rings(r, { quiet = null, doneAt = Infinity, until = r.at + 2 * DAY } = {}) {
  const out = [];
  let t = r.at; if (quiet && inQuiet(t, quiet)) t = quietEnd(t, quiet);
  let n = 0;
  while (t && t < doneAt && t <= until && out.length < 500) { out.push(t); t = nextNag(r, t, n, { quiet }); n++; }
  return out;
}
/** "3rd time" → the count shown on the notification (1 = the first ring). */
export const ringCount = (r, at, opts) => rings(r, { ...opts, until: at }).length;
