/* ---- v10.6 (Ali, 18 Nov: "the app is still not smooth in opening or transitioning between pages"). Measured with a phone filled like
   his (3,000 kept notifications, 900 payments, 250 reminders) at a mid-phone's speed: opening took 17 s, Home 4 s — the kept
   notifications were fetched from the phone (and copied across the bridge) by every card on its own, 21 places. They are fetched once
   here and shared for a few seconds; each caller still parses its own copy (nothing shared is changed by anyone). */
const TTL = 3000;
let raw = null, at = 0, src = null;
/** The kept notifications as the phone gives them (a JSON string), at most once every 3 s. */
export function recallRaw(N) {
  if (!N || !N.recallNotes) return "[]";
  const now = Date.now();
  if (raw != null && src === N && now - at < TTL) return raw;
  try { raw = N.recallNotes() || "[]"; } catch (e) { raw = "[]"; }
  at = now; src = N; return raw;
}
/** After Recall forgets something, the next read asks the phone again. */
export const forgetRecallCache = () => { raw = null; at = 0; };
