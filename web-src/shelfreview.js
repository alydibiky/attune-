/* ---- v6.37 (upgrade H6): Shelf that makes you remember — a few of your own notes come back each day as short reviews,
   scheduled by the same memory model as Learn (fsrs.js): a note you remember comes back later and later; one you forgot
   comes back tomorrow. Locked books, the trash, the archive and tiny notes are left out. Pure (tests/unit/v740shelfreview.test.mjs). */
import { review } from "./fsrs.js";
import { isLive, bookOf, noteTitle } from "./shelf.js";

export const REVIEW_KEY = "attune:shelf:review:v1";      // { cards: { [noteId]: fsrs card }, day, newToday }
const DAY = 86400000;
const dayOf = (t) => new Date(t).toISOString().slice(0, 10);

/** The notes due today: those whose review is due, then up to `newPerDay` notes never reviewed (older than a day first). */
export function dueNotes(records, shelf, state, now = Date.now(), { max = 5, newPerDay = 3 } = {}) {
  const cards = (state && state.cards) || {}, today = dayOf(now);
  const newDone = state && state.day === today ? state.newToday || 0 : 0;
  // (bookOf gives the book's id, so the book itself is looked up for its lock)
  const ok = (r) => { if (!isLive(r)) return false; const bid = bookOf(r, shelf), b = ((shelf && shelf.books) || []).find((x) => x.id === bid); if (b && b.locked) return false; return String(r.text || "").replace(/\s+/g, " ").trim().length >= 20; };
  const live = (records || []).filter(ok);
  const due = live.filter((r) => cards[r.id] && cards[r.id].due <= now).sort((a, b) => cards[a.id].due - cards[b.id].due);
  const fresh = live.filter((r) => !cards[r.id] && now - (r.created || r.ts || now) >= DAY).sort((a, b) => (a.created || 0) - (b.created || 0)).slice(0, Math.max(0, newPerDay - newDone));
  return [...due, ...fresh].slice(0, max).map((r) => ({ id: r.id, title: noteTitle(r), text: String(r.text || ""), isNew: !cards[r.id] }));
}

/** grade: 1 forgot · 2 hard · 3 remembered · 4 easy → the new state. */
export function grade(state, noteId, g, now = Date.now()) {
  const s = state || { cards: {} }, today = dayOf(now), wasNew = !(s.cards || {})[noteId];
  const card = review((s.cards || {})[noteId], g, now);
  return { ...s, cards: { ...(s.cards || {}), [noteId]: card }, day: today, newToday: (s.day === today ? s.newToday || 0 : 0) + (wasNew ? 1 : 0) };
}

export function loadReview(ls = typeof localStorage !== "undefined" ? localStorage : null) { try { return JSON.parse((ls && ls.getItem(REVIEW_KEY)) || "null") || { cards: {} }; } catch (e) { return { cards: {} }; } }
export function saveReview(v, ls = typeof localStorage !== "undefined" ? localStorage : null) { try { ls && ls.setItem(REVIEW_KEY, JSON.stringify(v)); } catch (e) {} return v; }
