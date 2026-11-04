/* v9.1 (Ali, 4 Nov 2026: "the goal of the app is to be a life planner / organiser"): these tool ids are out of the app — in no list,
   hub, group, guide, "/" command or Home tile. Their code is kept in archive/<name>/ (Ali's rule: never deleted — one prompt brings a
   feature back). Studio · Business (→ Attune Business: business, fleet, fleet-rentals, field, crane) · Fit (→ Attune Fit: fit,
   food-photo, cycle, and "health", the page that joined them) · Deal Check (Money Guardian) · Learn daily
   + Homework Coach (maybe Attune Learn) · the Code page (its Python checker stays) · Video tools (subtitles stay in Translate). */
export const REMOVED = ["studio", "business", "fleet", "fleet-rentals", "field", "crane", "fit", "food-photo", "cycle", "health",
  "deal", "learn", "coach", "code", "video"];
export const isRemoved = (id) => REMOVED.includes(String(id || ""));
export const withoutRemoved = (ids) => (ids || []).filter((x) => !isRemoved(Array.isArray(x) ? x[0] : x && x.id ? x.id : x));
/* v9.1 FOLDED into another feature: no app of its own (no tab, menu, guide or Home tile), but still opened from the feature that
   took it over — Scout's results open from an Agent card ("watch ads for a used Tucson"). */
export const FOLDED = ["scout"];
export const hiddenFromMenus = (id) => isRemoved(id) || FOLDED.includes(String(id || ""));
export const withoutHidden = (ids) => (ids || []).filter((x) => !hiddenFromMenus(Array.isArray(x) ? x[0] : x && x.id ? x.id : x));
