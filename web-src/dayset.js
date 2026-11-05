/* ---- v9.3 "Your day" settings (Ali, 5 Nov 2026: D1 A "but I want the prayers not to be automatic — people open it in the settings first
   if they want it, as again this is a global app"; A2 A "make it choosable in the settings"; D5 A simple mode).
   Everything here is OFF until the person turns it on, except reading notifications for the day (on once Android's Notification access
   is allowed — the person already said yes to that, with the disclosure first; each app can be left out).                           */
export const DAYSET_KEY = "attune:dayset:v1";
export const DAYSET_DEFAULTS = { prayers: false, ramadan: false, notes: true, offApps: [], simple: false, evening: 20, widgetMoney: false };

export function loadDayset(s = typeof localStorage !== "undefined" ? localStorage : null) {
  try { const v = JSON.parse((s && s.getItem(DAYSET_KEY)) || "null"); if (v && typeof v === "object") return cleanDayset(v); } catch (e) {}
  return { ...DAYSET_DEFAULTS };
}
/** Only known keys, only sane values (a restored backup or a synced file can't put anything else here). */
export function cleanDayset(v = {}) {
  const o = { ...DAYSET_DEFAULTS };
  for (const k of ["prayers", "ramadan", "notes", "simple", "widgetMoney"]) if (typeof v[k] === "boolean") o[k] = v[k];
  if (Array.isArray(v.offApps)) o.offApps = v.offApps.filter((x) => typeof x === "string" && x.length < 120).slice(0, 200);
  if (Number.isInteger(+v.evening) && +v.evening >= 16 && +v.evening <= 23) o.evening = +v.evening;
  return o;
}
export function saveDayset(v, s = typeof localStorage !== "undefined" ? localStorage : null) {
  const c = cleanDayset(v);
  try { s && s.setItem(DAYSET_KEY, JSON.stringify(c)); } catch (e) {}
  try { typeof window !== "undefined" && window.dispatchEvent(new CustomEvent("attune-dayset", { detail: c })); } catch (e) {}
  return c;
}
