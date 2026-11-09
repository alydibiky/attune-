/* ---- v9.9.6 N3 (Ali OK'd: "@ links to people and things — in any note, @ shows your people and things; a tap opens everything
   about them; 'he'll pay Thursday' becomes a follow-up"). The note's text stays plain ("@Sheikh"); the links are worked out from
   the People directory (entities.js) — the same cards Chat, voice and "Which Ahmed?" use. Pure; tests: v996mentions.test.mjs.
     atQuery(text, caret)      → the "@she" being typed before the caret, or null
     suggest(q, dir)           → the cards whose name / alias starts with it (people first), max 6
     insertAt(text, caret, q, name) → the text with "@she" replaced by "@Sheikh " and the new caret
     linksIn(text, dir)        → the cards a note @-mentions (by their names, longest first, Arabic and English)
     promisesIn(text, dir, now) → "@Sheikh … he'll pay Thursday" → [{ pid, who, line, at }] — a follow-up to OFFER (never made alone) */
import { fold } from "./entities.js";

export function atQuery(text, caret) {
  const before = String(text || "").slice(0, caret == null ? String(text || "").length : caret);
  const m = /(^|[\s(،,])@([\p{L}\p{N}_.-]{0,24})$/u.exec(before);
  return m ? { q: m[2], start: before.length - m[2].length - 1 } : null;
}
const namesOf = (p) => [p.name, ...(p.aliases || [])].filter(Boolean);
export function suggest(q, dir, max = 6) {
  const k = fold(q).trim(), items = (dir && dir.items) || [];
  const hit = items.filter((p) => !k || namesOf(p).some((n) => fold(n).trim().startsWith(k) || fold(n).includes(" " + k)));
  const rank = { person: 0, thing: 1, place: 2 };
  return hit.sort((a, b) => (rank[a.kind] ?? 3) - (rank[b.kind] ?? 3) || (b.used || 0) - (a.used || 0) || String(a.name).localeCompare(String(b.name))).slice(0, max);
}
export function insertAt(text, caret, at, name) {
  const t = String(text || ""), end = caret == null ? t.length : caret, ins = "@" + String(name).trim() + " ";
  const out = t.slice(0, at.start) + ins + t.slice(end).replace(/^\s+/, "");
  return { text: out, caret: at.start + ins.length };
}
/** The cards a note mentions with "@" (a name of two words is matched whole: "@Grove GMK"). */
export function linksIn(text, dir) {
  const t = " " + fold(String(text || "").replace(/@/g, " @")) + " ", out = [], seen = new Set();
  const all = ((dir && dir.items) || []).flatMap((p) => namesOf(p).map((n) => ({ p, n: fold(n).trim() }))).filter((x) => x.n).sort((a, b) => b.n.length - a.n.length);
  const raw = String(text || "");
  for (const { p, n } of all) {
    if (seen.has(p.id)) continue;
    const re = new RegExp("@" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\p{L}\\p{N}])", "iu");
    if (re.test(fold(raw).replace(/\s+/g, " ")) || re.test(raw)) { seen.add(p.id); out.push(p); }
  }
  void t;
  return out;
}
const DAYS = { sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, wednesday: 3, wed: 3, thursday: 4, thu: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
  "الحد": 0, "الاحد": 0, "الاتنين": 1, "الاثنين": 1, "التلات": 2, "الثلاثاء": 2, "الاربع": 3, "الاربعاء": 3, "الخميس": 4, "الجمعه": 5, "الجمعة": 5, "السبت": 6 };
const PROMISE = /\b(will|'ll|is going to|promised|said he'd|said she'd|should)\s+(pay|send|transfer|call|come|bring|deliver|finish|return|give)\b|هيدفع|هتدفع|هيبعت|هتبعت|هيحول|هتحول|هيكلم|هتكلم|هيجي|هتيجي|هيجيب|هتجيب|وعد|وعدني|هيسلم|هتسلم|هيرجع|هترجع/i;
/** "@Sheikh … he'll pay Thursday" → a follow-up to offer on that day at 9:00 (today / tomorrow / a weekday / «بكرة»). */
export function promisesIn(text, dir, now = Date.now()) {
  const out = [];
  for (const line of String(text || "").split(/[\n.!؟?]+/)) {
    if (!PROMISE.test(line)) continue;
    // the person named first in the sentence ("@Sheikh about the @Grove GMK rental, he'll pay" → Sheikh), people before things
    const ls = linksIn(line, dir), pos = (p) => { const i = String(line).toLowerCase().indexOf("@" + String(p.name).toLowerCase()); return i < 0 ? 1e9 : i; };
    const who = ls.filter((p) => p.kind === "person").sort((a, b) => pos(a) - pos(b))[0] || ls[0]; if (!who) continue;
    const l = line.toLowerCase(), d = new Date(now); d.setHours(9, 0, 0, 0);
    let at = 0;
    if (/\b(today|tonight)\b|النهارده|النهاردة/.test(l)) at = d.getTime() < now ? now + 3600e3 : d.getTime();
    else if (/\btomorrow\b|بكره|بكرة/.test(l)) at = d.getTime() + 864e5;
    else { const k = Object.keys(DAYS).find((w) => new RegExp("(^|[^\\p{L}])" + w + "(?![\\p{L}])", "u").test(l)); if (k) { const add = ((DAYS[k] - d.getDay() + 7) % 7) || 7; at = d.getTime() + add * 864e5; } }
    if (!at) continue;
    out.push({ pid: who.id, who: who.name, line: line.trim().replace(/\s+/g, " ").slice(0, 120), at });
  }
  return out;
}
/** A person's page: the notes that @-mention them (newest first). */
export const notesAbout = (records = [], p) => records.filter((r) => r && (r.kind === "note" || (r.meta && r.meta.book)) && linksIn([r.title, r.text].join(" "), { items: [p] }).length).sort((a, b) => (b.ts || 0) - (a.ts || 0));
