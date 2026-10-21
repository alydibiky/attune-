/* ---- v6.48 Where things are (CHAT_RUNS_APP.md S4; Ali: "remember that my passport is on the desk → it asks me 'so it's not in the
   drawer any more?' and I tick yes … then 'where do I usually keep my passport' → 'you kept it there 5 times and there 4 times'").
   Each "it is here now" is one Mind record (kind "where", meta { thing, key, place, pkey }); the newest one says where it is, all of
   them say where it usually is. Pure code; tests: tests/unit/v748where.test.mjs.                                               */
import { fold } from "./commands.js";

const DROP = /^(remember( that)?|note( that)?|افتكر( ان| إن)?|خلي في بالك( ان| إن)?|ان|إن)\s+/i;
const OWN = /^(my|the|our|your)\s+/i;
const AR_OWN = /\s+(بتاعي|بتاعتي|بتاعنا|بتوعي)$/;
const PREP_EN = "in|on|under|inside|at|behind|beside|next to|near|in the|on the";
const PREP_AR = "في|فى|على|علي|تحت|جوه|جوا|جنب|ورا|عند";
/** The name a thing is kept under: "my passport" / «الباسبور بتاعي» / «باسبوري» → "passport" / «باسبور». */
export function thingKey(name) {
  let t = fold(name).replace(OWN, "").replace(AR_OWN, "").replace(/^ال(?=\S{2,})/, "").trim();
  t = t.replace(/(ي|ى)$/, (m) => (t.length > 4 ? "" : m));            // «باسبوري» → «باسبور» (my passport), short words kept
  return t.replace(/s$/, (m) => (t.length > 3 && !/ss$/.test(t) ? "" : m));   // "keys" → "key"
}
export const placeKey = (place) => fold(place).replace(new RegExp(`^(${PREP_EN}|${PREP_AR})\\s+`, "i"), "").replace(/^(the|a|my)\s+/i, "").replace(/^ال(?=\S{2,})/, "").replace(/\s+(بتاعي|بتاعتي)$/, "").trim();

/** "remember my passport is on the desk" / "I left my keys in the car" / «الباسبور على المكتب» → { thing, place }, or null. */
export function parseWhereSet(text) {
  let t = String(text || "").trim().replace(/[.!]+$/, "").replace(DROP, "");
  let m = t.match(new RegExp(`^(?:(?:my|the|our)\\s+)?(.{2,40}?)\\s+(?:is|are)\\s+(?:now\\s+)?((?:${PREP_EN})\\s+.{1,60})$`, "i"));
  if (m) return { thing: m[1].trim(), place: m[2].trim() };
  m = t.match(new RegExp(`^i\\s+(?:put|left|keep|placed|kept)\\s+(?:my|the|our)\\s+(.{2,40}?)\\s+((?:${PREP_EN})\\s+.{1,60})$`, "i"));
  if (m) return { thing: m[1].trim(), place: m[2].trim() };
  m = t.match(new RegExp(`^(?:انا\\s+)?(?:حطيت|سبت|شلت)\\s+(.{2,40}?)\\s+((?:${PREP_AR})\\s+.{1,60})$`));
  if (m) return { thing: m[1].trim(), place: m[2].trim() };
  m = t.match(new RegExp(`^(.{2,40}?)\\s+((?:${PREP_AR})\\s+.{1,60})$`));
  if (m && !/[?؟]/.test(t) && m[1].split(/\s+/).length <= 3) return { thing: m[1].trim(), place: m[2].trim() };
  return null;
}
/** "where is my passport", "where do I usually keep my passport", «فين الباسبور», «بحط الباسبور فين عادة» → { thing, usual }, or null. */
export function parseWhereAsk(text) {
  const t = String(text || "").trim().replace(/[?؟.!]+$/, "");
  const usual = /\b(usually|normally|always|most of the time)\b|عاده|عادة|دايما|غالبا|في العاده/i.test(t);
  let m = t.match(/^where\s+(?:do|did)\s+i\s+(?:usually\s+|normally\s+|always\s+)?(?:put|leave|keep|store)\s+(?:my|the|our)\s+(.{2,40}?)(?:\s+usually|\s+normally)?$/i);
  if (m) return { thing: m[1].trim(), usual: usual || /\b(do i)\b/i.test(t) && !/did/i.test(t) };
  m = t.match(/^where(?:'s|\s+is|\s+are)\s+(?:my|the|our)\s+(.{2,40}?)(?:\s+usually)?$/i);
  if (m) return { thing: m[1].trim(), usual };
  m = t.match(/^(?:انا\s+)?(?:بحط|بنحط|حطيت|سبت|بسيب)\s+(.{2,40}?)\s+فين(?:\s+.*)?$/);
  if (m) return { thing: m[1].trim(), usual: usual || /^(?:انا\s+)?(?:بحط|بنحط|بسيب)/.test(t) };
  m = t.match(/^فين\s+(.{2,40}?)(?:\s+(?:عاده|عادة|دايما))?$/);
  if (m) return { thing: m[1].trim(), usual };
  m = t.match(/^(.{2,40}?)\s+فين(?:\s+(?:عاده|عادة|دايما))?$/);
  if (m) return { thing: m[1].trim(), usual };
  return null;
}

/** The "where" records of one thing, newest first. */
export const placesOf = (records, thing) => { const k = thingKey(thing); return (records || []).filter((r) => r && r.kind === "where" && r.meta && r.meta.key === k).sort((a, b) => b.ts - a.ts); };
/** Where it is now (the newest record), or null. */
export const whereNow = (records, thing) => placesOf(records, thing)[0] || null;
/** How often each place was used: [{ place, n, last }], most used first (ties: the most recent). */
export function usualPlaces(records, thing) {
  const m = new Map();
  for (const r of placesOf(records, thing)) { const k = r.meta.pkey; const o = m.get(k) || { place: r.meta.place, n: 0, last: 0 }; o.n++; if (r.ts > o.last) { o.last = r.ts; o.place = r.meta.place; } m.set(k, o); }
  return [...m.values()].sort((a, b) => b.n - a.n || b.last - a.last);
}
/** Saving "it is here now": a different place from the last one → ask first ("not in the drawer any more?"); same place → nothing new. */
export function planSet(records, set) {
  const now = whereNow(records, set.thing);
  if (now && now.meta.pkey === placeKey(set.place)) return { same: true, now };
  return { ask: !!now, was: now ? now.meta.place : null };
}
/** The Mind record for "it is here now". */
export const whereRecord = (set, ts = Date.now()) => ({ kind: "where", ts, title: `${set.thing} — ${set.place}`, text: `${set.thing} ${set.place}`, tags: ["where"],
  meta: { thing: set.thing, key: thingKey(set.thing), place: set.place, pkey: placeKey(set.place) } });

/** The answer to "where is it" / "where do I usually keep it". → { en, ar } or null when nothing is known. */
export function whereAnswer(records, q, now = Date.now()) {
  const list = usualPlaces(records, q.thing), cur = whereNow(records, q.thing);
  if (!cur) return null;
  const ago = (ts) => { const d = Math.round((now - ts) / 864e5); return d <= 0 ? ["today", "النهارده"] : d === 1 ? ["yesterday", "امبارح"] : [`${d} days ago`, `من ${d} يوم`]; };
  const [aE, aA] = ago(cur.ts);
  const nowLine = { en: `Last time you said: ${cur.meta.place} (${aE}).`, ar: `آخر مرة قلت: ${cur.meta.place} (${aA}).` };
  if (!q.usual || list.length < 1) return nowLine;
  const parts = list.slice(0, 3);
  const times = (n, ar) => (ar ? (n === 1 ? "مرة" : n === 2 ? "مرتين" : `${n} مرات`) : n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
  return { en: `You kept it ${parts.map((p) => `${p.place} ${times(p.n)}`).join(", ")}. ${nowLine.en}`,
    ar: `حطيته ${parts.map((p) => `${p.place} ${times(p.n, true)}`).join("، و")}. ${nowLine.ar}` };
}
/** The things kept so far (for the meaning-guesser: "where is the passport" is about a thing, not a place on the map). */
export const thingsKnown = (records) => [...new Set((records || []).filter((r) => r && r.kind === "where" && r.meta).map((r) => r.meta.thing))].slice(0, 200);
