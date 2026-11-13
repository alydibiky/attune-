/* ---- v9.9.28 T4 place reminders on the phone (Ali picked P-2 — the APK he installs first; combined OK'd OK-2 OK-3 OK-4, no separate
   explanation screen). Android's proximity alerts say "entered" (150 m) / "left" (200 m); this decides whether a reminder rings —
   PlaceRing in PlaceGeo.kt does exactly the same:
     · "when I arrive": rings on entering — once per arrival: not again until it has left and stayed away 10 minutes (driving past the
       edge, a GPS bounce in and out, sitting in the car park don't ring twice); an "entered" within 2 minutes of the last "left" is a bounce.
     · "when I leave": rings on leaving — only after it was inside at least 3 minutes (driving past doesn't count), once per visit.
   Pure. Tests: tests/placering/gen.mjs (10,000 sequences) + tests/unit/v9928placering.test.mjs. */
const AWAY = 10 * 60000, STAY = 3 * 60000;
/** One proximity event → { ring, state }. state: { inside, visitAt (start of this visit), leftAt, rung (this visit) } */
export function placeRing(rem, ev, st = {}, now = Date.now()) {
  const s = { ...st };
  if (!rem || rem.done || !ev) return { ring: false, state: s };
  if (ev.entering) {
    if (s.inside) return { ring: false, state: s };   // (Android repeats itself — already inside)
    s.inside = true;
    const sameVisit = s.leftAt != null && now - s.leftAt < AWAY;   // back within 10 minutes = the same visit (a GPS bounce, around the block)
    if (!sameVisit) { s.visitAt = now; s.rung = false; }
    if (rem.on !== "leave" && !s.rung) { s.rung = true; return { ring: true, state: s }; }
    return { ring: false, state: s };
  }
  if (!s.inside) return { ring: false, state: s };
  s.inside = false; s.leftAt = now;
  if (rem.on === "leave" && !s.rung && s.visitAt != null && now - s.visitAt >= STAY) { s.rung = true; return { ring: true, state: s }; }
  return { ring: false, state: s };
}
