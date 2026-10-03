/* ---- Fit & Food: the photo read that never hangs (v6.10) ----------------------------------------
   Ali: "stayed on Recognising the food… then crashed — and it recognises no food".
   One time budget for the whole photo read (≈60 s from the moment the model is awake), shared by every
   model call, and a fallback chain so the person always gets something usable:
     1. the full look (JSON: foods, counts, plate share)            — most of the budget
     2. a quick look: "just name the foods" (a few tokens, no JSON)  — what is left
     3. the person's own note under the photo, read by the offline reader
     4. nothing → the person names it / searches (the photo is let go so typing works at once)
   Every name the model gives that the food table doesn't know is matched in code: the offline reader
   (Arabic, synonyms, Egyptian dish names) and then the offline food pack (packSearch). Pure logic — the
   screen (fit-ui.jsx) only wires it up. */
import * as F from "./fit.js";
import * as R from "./fitread.js";
import { norm } from "./foodpack.js";

export const PHOTO_BUDGET_MS = 60000;

/** A shared time budget. slice(max, reserve) = how long the next call may take, keeping `reserve` for later steps. */
export function budget(total = PHOTO_BUDGET_MS, now = () => Date.now()) {
  const t0 = now();
  const left = () => Math.max(0, total - (now() - t0));
  return { left, slice: (max, reserve = 0) => Math.max(0, Math.min(max, left() - reserve)) };
}

/** A promise with a time limit: on timeout `onTimeout` runs (cancel the model) and it fails with "slow". */
export function withLimit(p, ms, onTimeout) {
  return new Promise((ok, bad) => {
    if (!(ms > 0)) { try { onTimeout && onTimeout(); } catch (e) {} bad(new Error("slow")); return; }
    const t = setTimeout(() => { try { onTimeout && onTimeout(); } catch (e) {} bad(new Error("slow")); }, ms);
    Promise.resolve(p).then((v) => { clearTimeout(t); ok(v); }, (e) => { clearTimeout(t); bad(e); });
  });
}

/** The quick look: only the names, comma-separated — a handful of output tokens, so it fits in what's left. */
export function namesMessages(note, cc = F.getCountry()) {
  const local = !cc || cc === "eg" ? "the Egyptian/Arabic dish name" : "the usual dish name in " + ((F.COUNTRIES[cc] || {}).en || "the country");   // v6.10: the chosen country's dishes
  return [
    { role: "system", content: `List the foods and drinks you can see in this photo, comma-separated, most visible first. Use short common names (English, or ${local}). Count countable things, e.g. "2 fried eggs, baladi bread". Nothing else. If there is no food, reply: none.${note ? "\nThe person adds: " + note : ""}` },
    { role: "user", content: "Which foods?" },
  ];
}

/** The quick look's reply → up to 8 clean names ("2 fried eggs", "baladi bread"). Also takes a JSON reply. */
export function parseNames(raw) {
  let s = String(raw || "").trim();
  if (!s) return [];
  if (/^[[{]/.test(s) || s.includes('"food"')) {
    try {
      const j = JSON.parse(s.slice(s.search(/[[{]/), Math.max(s.lastIndexOf("}"), s.lastIndexOf("]")) + 1));
      const arr = Array.isArray(j) ? j : Array.isArray(j && j.items) ? j.items : Array.isArray(j && j.foods) ? j.foods : [];
      const got = arr.map((x) => (typeof x === "string" ? x : x && (x.food || x.name)) || "").filter(Boolean);
      if (got.length) s = got.join(",");
    } catch (e) {}
  }
  const out = [];
  for (let p of s.split(/[,\n;،؛]|\s+(?:and|with|plus)\s+/i)) {
    p = p.replace(/^[\s\-*•·\d]+[.)]\s*/, "").replace(/^[\s\-*•·]+/, "").replace(/["'`]/g, "").replace(/[.!]+$/, "").trim();
    if (!p || p.length > 40 || /^(none|no food|nothing|n\/a|لا يوجد|مفيش)$/i.test(p)) continue;
    if (/^(i see|the photo|this (photo|image)|here)/i.test(p)) continue;
    if (!out.some((x) => x.toLowerCase() === p.toLowerCase())) out.push(p);
  }
  return out.slice(0, 8);
}

/** The best offline-pack food for a name the model gave, or null. Generic (no brand), short, Egyptian names win;
 *  a long product name that only shares one word with a two-word name is not accepted. */
export function bestPackMatch(name, foods) {
  const qw = norm(name).split(" ").filter((w) => w.length >= 2);
  if (!qw.length || !Array.isArray(foods)) return null;
  let best = null, bestS = -1;
  for (const fd of foods) {
    if (!fd || fd.kcal == null) continue;
    const base = norm(String(fd.en || "").replace(/\s*\([^)]*\)\s*$/, "") || fd.ar);
    const nw = base.split(" ").filter(Boolean);
    const hit = qw.filter((w) => nw.some((h) => h.startsWith(w))).length;
    if (hit < qw.length) continue;   // every word of the name must be in the product's name
    if (nw.length > qw.length + 3) continue;   // "egg" is not "egg noodles with chicken and sauce flavour"
    const s = (base === qw.join(" ") ? 10 : 0) + (fd.brand ? 0 : 2) + (fd.egypt ? 1 : 0) - (nw.length - qw.length) * 0.8;
    if (s > bestS) { bestS = s; best = fd; }
  }
  return best;
}

const sleepNull = (ms) => new Promise((ok) => setTimeout(() => ok(null), ms));

/** A photo-style item the table doesn't know yet (grams unknown → 150 g until a food is found). */
export function unknownItem(name, grams = null, extra = {}) {
  const g = grams > 0 && grams < 3000 ? Math.round(grams) : 150;
  return { name, said: name, qty: 1, unit: "g", grams: g, kcal: null, p: null, c: null, f: null, fib: 0, estimate: true, unknown: true, alts: [], conf: 0.4, base: g, ...(grams ? {} : { guessGrams: true }), ...extra };
}

/** One unknown item → a known food when the offline reader (names, Arabic, counts) or the food pack can place it. */
export async function resolveItem(it, packSearch, ms = 3000) {
  if (!it || !it.unknown) return it;
  const said = String(it.said || it.name || "").trim(); if (!said) return it;
  const r = R.readMealText(said);
  if (r.items.length && !r.unknown.length) {
    const x = r.items[0], fd = F.food(x.id);
    if (fd) {
      const g = it.guessGrams ? r.items.reduce((a, y) => a + (y.id === x.id ? y.grams : 0), 0) || x.grams : it.grams;
      const { guessGrams, ...rest } = it;
      return { ...F.chooseFood({ ...rest, grams: g }, fd), chosen: false, base: g, matched: "reader" };
    }
  }
  if (packSearch) {
    let hits = null;
    try { hits = await Promise.race([packSearch(said, 12), sleepNull(ms)]); } catch (e) { hits = null; }
    const fd = bestPackMatch(said, hits || []);
    if (fd) { const { guessGrams, ...rest } = it; const g = guessGrams && fd.portions && fd.portions.serving ? fd.portions.serving : rest.grams; return { ...F.chooseFood({ ...rest, grams: g }, fd), chosen: false, base: g, matched: "pack" }; }
  }
  return it;
}

/** Every unknown item of a photo read, matched in code (bounded: ≈ ms in all, the pack is searched side by side). */
export async function resolveItems(items, packSearch, ms = 4000) {
  return Promise.all((items || []).map((it) => resolveItem(it, packSearch, ms)));
}

/** Names (from the quick look) → draft items. */
export async function namesToItems(names, packSearch, ms = 4000) {
  return (await resolveItems((names || []).map((n) => unknownItem(n)), packSearch, ms)).filter(Boolean);
}

/** Step 3: the person's own words under the photo ("eggs and bread") → items, or [] when the reader can't place them. */
export function noteItems(note) {
  const t = String(note || "").trim(); if (!t) return [];
  const r = R.readMealText(t);
  return r.items.length && !r.unknown.length ? r.items : [];
}
