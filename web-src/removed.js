/* v9.1 (Ali, 4 Nov 2026: "the goal of the app is to be a life planner / organiser" — Studio and Business are removed; Business
   becomes the separate product Attune Business). These tool ids are out of the app: in no list, hub, group, guide, "/" command or
   Home tile. Their code is kept in archive/<name>/ (Ali's rule: never deleted — one prompt brings a feature back). */
export const REMOVED = ["studio", "business", "fleet", "fleet-rentals", "field", "crane"];
export const isRemoved = (id) => REMOVED.includes(String(id || ""));
export const withoutRemoved = (ids) => (ids || []).filter((x) => !isRemoved(Array.isArray(x) ? x[0] : x && x.id ? x.id : x));
