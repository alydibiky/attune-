/* ---- v9.9.18 batch B4: T4 place reminders (Ali picked A — a place inside the reminder) and T5 auto-plan my week (A — the calendar
   with blocks). Pure; tests: tests/b4plan (10,000 each) + tests/unit/v9918b4.test.mjs.
   T4: from the phone's location samples → "arrive" / "leave" for a saved place: inside = within its radius (150 m), arrival after 2
       samples in a row inside, leaving after 2 in a row beyond radius + 50 m (so standing at the edge never flickers); a sample less
       accurate than 200 m is ignored (a GPS jump), so passing by on the ring road at speed doesn't count as one sample.
   T5: tasks { id, minutes, due } placed earliest-deadline-first in 30-minute chunks inside work hours, never on a busy slot or a
       prayer time (when prayers are on), never after the task's deadline; a task that doesn't fit is reported, never squeezed. */
const R = 6371000, rad = (d) => (d * Math.PI) / 180;
export function meters(a, b) { const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng), x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.min(1, Math.sqrt(x))); }
/** samples: [{ t, lat, lng, acc }] in order; place: { lat, lng, r }. → [{ t, e: "arrive" | "leave" }] */
export function placeEvents(samples = [], place, startInside = false) {
  const r = place.r || 150, out = []; let inside = startInside, run = 0;
  for (const s of samples || []) {
    if (!(s.acc <= 200)) continue;
    const d = meters(s, place), now = inside ? d > r + 50 : d <= r;
    if (now) { run++; if (run >= 2) { inside = !inside; out.push({ t: s.t, e: inside ? "arrive" : "leave" }); run = 0; } } else run = 0;
  }
  return out;
}
const M = 60000, CH = 30;
const hm = (s) => { const [h, m] = String(s).split(":").map(Number); return h * 60 + m; };
/** → { blocks: [{ id, from, to }], late: [ids] } */
export function planWeek(tasks = [], busy = [], { now = Date.now(), days = 7, work = { from: "09:00", to: "22:00" }, prayers = [] } = {}) {
  const slots = [];   // free 30-min slots from the next half hour on
  const start = new Date(now); start.setSeconds(0, 0); start.setMinutes(Math.ceil(start.getMinutes() / CH) * CH);
  const blocked = [...(busy || []), ...(prayers || []).map((p) => ({ from: p, to: p + 15 * M }))];
  for (let t = start.getTime(); t < now + days * 864e5; t += CH * M) {
    const d = new Date(t), m = d.getHours() * 60 + d.getMinutes();
    if (m < hm(work.from) || m + CH > hm(work.to)) continue;
    if (blocked.some((b) => t < b.to && t + CH * M > b.from)) continue;
    slots.push(t);
  }
  const used = new Set(), blocks = [], late = [];
  for (const k of [...(tasks || [])].sort((a, b) => a.due - b.due)) {
    const need = Math.ceil(k.minutes / CH), mine = [];
    for (const t of slots) { if (mine.length === need) break; if (used.has(t) || t + CH * M > k.due) continue; mine.push(t); }
    if (mine.length < need) { late.push(k.id); continue; }
    for (const t of mine) used.add(t);
    // join back-to-back chunks into one block
    for (const t of mine.sort((a, b) => a - b)) { const last = blocks[blocks.length - 1]; if (last && last.id === k.id && last.to === t) last.to = t + CH * M; else blocks.push({ id: k.id, from: t, to: t + CH * M }); }
  }
  return { blocks, late };
}
