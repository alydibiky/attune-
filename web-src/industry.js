/* ---- v6.50 A neutral app (Ali, 22 Oct: "I don't want people to mistake the app as a fleet app … the app must be neutral").
   The crane built-ins (the Crane expert assistant, the Crane hydraulics course, the crane skills) show only to people who use
   Business → Fleet & rentals; everyone else sees a general app. Fleet marks it the first time it saves cranes (fleet-store.js).
   Tests: tests/unit/v750neutral.test.mjs. */
export const FLEET_FLAG = "attune:uses:fleet";
const store = () => (typeof localStorage !== "undefined" ? localStorage : null);
export function usesFleet(st = store()) { try { return !!(st && st.getItem(FLEET_FLAG)); } catch (e) { return false; } }
export function markFleet(st = store()) { try { if (st && !st.getItem(FLEET_FLAG)) st.setItem(FLEET_FLAG, "1"); } catch (e) {} }
/** The built-ins that belong to the crane business, by list. */
export const CRANE_ONLY = { assistants: ["a-crane"], courses: ["hydraulics"], skills: ["crane-quote", "toolbox", "hydraulics"] };
/** The list without the crane built-ins, unless this person uses Fleet. */
export function neutral(list, kind, st = store()) {
  const ids = CRANE_ONLY[kind] || [];
  return usesFleet(st) ? list : (list || []).filter((x) => !(x && ids.includes(x.id)));
}
