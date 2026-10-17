/* ---- v6.28 Device levels (ROADMAP_2026-10-13 §2: "each device shows what it can really do") --------------------------------------
   Measured once from what the app already knows (memory, cores, phone or computer) → a level. A light phone gets small models,
   no Studio (a picture takes 10+ minutes there) and lighter effects; a flagship gets everything sized to it; a computer gets all of
   it. Nothing is locked: "Show every tool anyway" brings a hidden tool back. Pure, so it is unit-tested (tests/unit/v731device.test.mjs).
   The model router (router.js) already picks the model per question; this caps what is offered per device.                      */

export const LEVELS = [
  null,
  { level: 1, name: "Light", ar: "خفيف", maxModel: "sm", studio: "off", lite: true, hide: ["studio"], what: "Small models, no Studio, lighter effects" },
  { level: 2, name: "Standard", ar: "قياسي", maxModel: "md", studio: "fast", lite: false, hide: [], what: "Models up to Core, fast Studio pictures" },
  { level: 3, name: "Strong", ar: "قوي", maxModel: "lg", studio: "xl", lite: false, hide: [], what: "Models up to Sense and Blaze+, sharper Studio pictures" },
  // v6.29 Flash-MoE: a flagship also gets Everest (35B-A3B) — its experts are read from storage as needed (flash-moe.yml)
  { level: 4, name: "Flagship", ar: "رائد", maxModel: "max", extra: ["moe-xl"], studio: "full", lite: false, hide: [], what: "Every phone model up to Zenith+, Everest in flash mode, full Studio" },
  { level: 5, name: "Computer", ar: "كمبيوتر", maxModel: "moe-xl-long", studio: "full", lite: false, hide: [], what: "Everything, the biggest models and full Studio" },
];
// the model ids in order of size (power.js brands): a device offers those up to its maxModel
export const MODEL_ORDER = ["xs", "sm", "fast-e2b", "md-lo", "md", "md-hi", "md-max", "fast-e4b", "lg", "xl", "max", "moe-lg", "ultra", "moe-xl", "moe-xl-long"];

/** device = detectDevice() → its level. A phone that reports few cores drops one level (it runs hot and slow). */
export function deviceLevel(device) {
  const d = device || {};
  if (d.platform !== "mobile" || !(d.ram > 0)) return LEVELS[5];   // a computer, or nothing measured: never cut down
  const ram = d.ram;
  let lv = ram >= 12 ? 4 : ram >= 8 ? 3 : ram >= 6 ? 2 : 1;
  const big = d.bigCores != null ? d.bigCores : null;
  if (lv > 1 && ((d.cores && d.cores < 6) || (big != null && big < 2))) lv--;
  return LEVELS[lv];
}

/** Is this model offered on this device? (unknown ids are offered — a new model is never hidden by mistake) */
export function modelFits(level, modelId) {
  const lv = level || LEVELS[5], i = MODEL_ORDER.indexOf(modelId), cap = MODEL_ORDER.indexOf(lv.maxModel);
  return i < 0 || cap < 0 || i <= cap || (lv.extra || []).includes(modelId);
}

export const SHOW_ALL_KEY = "attune:device:showall";
export function showAll() { try { return localStorage.getItem(SHOW_ALL_KEY) === "1"; } catch (e) { return false; } }
export function setShowAll(on) { try { localStorage.setItem(SHOW_ALL_KEY, on ? "1" : "0"); } catch (e) {} }

/** The tool groups for this device: tools the level hides are left out (unless "show every tool"). Empty groups go too. */
export function groupsFor(groups, level, all = false) {
  const hide = all || !level ? [] : level.hide;
  return groups.map(([t, ids]) => [t, ids.filter((id) => !hide.includes(id))]).filter(([, ids]) => ids.length);
}
