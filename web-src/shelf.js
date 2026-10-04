/* ---- v6.11 Shelf («رف») -------------------------------------------------------------------------
   Ali (item 25): the notes become a shelf of books, like his phone's notebook app — a grid of covers,
   each book holding its own notes. ONE source of truth: a note is a Mind record (kind "note") with
   meta.book = the book's id, so every note is found by Mind's search and every plain note kept in Mind
   shows up on the Shelf (a note with no book, or with a book that is gone, sits in the first book).
   The shelf itself (book names, covers, order) is small JSON under SHELF_KEY.
   Pure functions here (tests: tests/unit/shelf.test.mjs); the screen is shelf-ui.jsx.            */
import { normText, kindOf } from "./mind.js";

export const SHELF_KEY = "attune:shelf:v1";
export const BACKUP_KEY = "attune:memory:preshelf-backup";   // the old notes, as they were before the move
export const MY_BOOK = "mybook";
export const MY_BOOK_NAME = "My Book";

/* ---- built-in covers: drawn in code (SVG data URIs + CSS gradients), no pictures ---- */
const svg = (w, h, body) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`)}")`;
const star8 = (c, s) => { // an eight-point star (two squares) — the classic girih motif
  const p = (r, a) => [0, 1, 2, 3].map((i) => { const t = a + i * Math.PI / 2; return `${(c + r * Math.cos(t)).toFixed(1)},${(c + r * Math.sin(t)).toFixed(1)}`; }).join(" ");
  return `<polygon points='${p(s, 0)}' fill='none' stroke='currentColor'/><polygon points='${p(s, Math.PI / 4)}' fill='none' stroke='currentColor'/>`;
};
export const COVERS = [
  { id: "dusk", name: "Dusk", bg: "linear-gradient(160deg,#f6c1d9 0%,#d9c2f0 45%,#eef1fb 100%)", fg: "#4a3a5c" },
  { id: "girih", name: "Girih", bg: `${svg(40, 40, `<g style='color:#d8b45a' stroke-width='1.2'>${star8(20, 13)}</g>`)},#123a3a`, fg: "#f3e6c4" },
  { id: "zellige", name: "Zellige", bg: `${svg(30, 30, `<g style='color:#ffffff' opacity='.55' stroke-width='1'>${star8(15, 10)}<circle cx='15' cy='15' r='3' fill='#fff'/></g>`)},linear-gradient(135deg,#1f5fa8,#2aa39a)`, fg: "#ffffff" },
  { id: "sunset", name: "Sunset", bg: "radial-gradient(circle at 50% 78%,#ffd36b 0 14%,transparent 15%),linear-gradient(180deg,#2b1a4a 0%,#c1446b 50%,#f59b4c 78%,#3a2140 79%,#1b1027 100%)", fg: "#fff3e0" },
  { id: "desert", name: "Desert", bg: `${svg(120, 160, "<path d='M0 110 Q30 90 60 108 T120 100 V160 H0Z' fill='#c9853f'/><path d='M0 130 Q40 112 80 128 T120 124 V160 H0Z' fill='#a8642c'/><circle cx='92' cy='40' r='14' fill='#fff1c9'/>")},linear-gradient(180deg,#f7d9a6,#e9b06e)`, fg: "#4d2b10" },
  { id: "ocean", name: "Ocean", bg: `${svg(60, 24, "<path d='M0 12 Q15 2 30 12 T60 12' fill='none' stroke='#ffffff' stroke-opacity='.35' stroke-width='2'/>")},linear-gradient(180deg,#0f4c75,#1b6f9c 55%,#3fb0c9)`, fg: "#e6f6ff" },
  { id: "paper", name: "Paper", bg: `${svg(200, 28, "<line x1='0' y1='27' x2='200' y2='27' stroke='#9bb7d8' stroke-width='1'/>")},linear-gradient(90deg,transparent 18px,#e8a0a0 18px 19px,transparent 19px),#fbf7ee`, fg: "#3b3a36" },
  { id: "kraft", name: "Kraft", bg: `${svg(8, 8, "<circle cx='2' cy='2' r='.7' fill='#7a5a34' opacity='.35'/><circle cx='6' cy='5' r='.5' fill='#fff' opacity='.25'/>")},#b98d5c`, fg: "#2e1f0e" },
  { id: "mosaic", name: "Mosaic", bg: `${svg(48, 42, "<polygon points='0,0 24,0 12,21' fill='#ffffff' opacity='.18'/><polygon points='24,0 48,0 36,21' fill='#000' opacity='.08'/><polygon points='12,21 36,21 24,42' fill='#ffffff' opacity='.12'/><polygon points='0,42 12,21 24,42' fill='#000' opacity='.06'/>")},linear-gradient(160deg,#ff8fa3,#a77bf3 60%,#6ec3f4)`, fg: "#ffffff" },
  { id: "arch", name: "Arches", bg: `${svg(40, 56, "<path d='M4 56 V26 Q4 6 20 4 Q36 6 36 26 V56' fill='none' stroke='#e9d8a6' stroke-width='1.5'/>")},linear-gradient(180deg,#5b1d2f,#7d2a3e)`, fg: "#f6e7c1" },
  { id: "emerald", name: "Emerald", bg: "linear-gradient(145deg,#064e3b,#059669)", fg: "#ecfdf5" },
  { id: "ink", name: "Ink", bg: "linear-gradient(145deg,#0f172a,#334155)", fg: "#e2e8f0" },
  { id: "saffron", name: "Saffron", bg: "linear-gradient(145deg,#f59e0b,#ea580c)", fg: "#1c1206" },
  { id: "rose", name: "Rose", bg: "linear-gradient(145deg,#be185d,#f472b6)", fg: "#fff1f7" },
];
export const coverOf = (id) => COVERS.find((c) => c.id === id) || COVERS[0];
export const isPhotoCover = (c) => typeof c === "string" && c.startsWith("photo:");

/* ---- the shelf ---- */
const newId = (now) => "b" + now.toString(36) + Math.random().toString(36).slice(2, 6);
export function emptyShelf() { return { v: 1, books: [], migrated: false }; }
export function loadShelf(storage) {
  try { const s = JSON.parse(storage.getItem(SHELF_KEY) || "null"); if (s && Array.isArray(s.books)) return s; } catch (e) {}
  return emptyShelf();
}
export function saveShelf(storage, shelf) { try { storage.setItem(SHELF_KEY, JSON.stringify(shelf)); } catch (e) {} return shelf; }

/** A note on the shelf: a plain note the person kept (not a tool's answer, not a photo). */
export const isShelfNote = (r) => !!r && (r.kind === "note" || !!(r.meta && r.meta.book)) && !(r.output && String(r.output).trim()) && kindOf(r) !== "photo";

/**
 * Once: every note already kept goes into the first book, "My Book"; a copy of the old records is kept
 * under BACKUP_KEY. Running it again changes nothing. → { shelf, records, changed }
 */
export function migrate(shelf, records, { storage = null, now = Date.now() } = {}) {
  if (shelf.migrated) return { shelf, records, changed: false };
  if (storage) { try { if (!storage.getItem(BACKUP_KEY)) storage.setItem(BACKUP_KEY, JSON.stringify(records)); } catch (e) {} }
  const books = shelf.books.some((b) => b.id === MY_BOOK) ? shelf.books : [{ id: MY_BOOK, name: MY_BOOK_NAME, cover: "dusk", created: now }, ...shelf.books];
  const out = records.map((r) => (isShelfNote(r) && !(r.meta && r.meta.book) ? { ...r, meta: { ...(r.meta || {}), book: MY_BOOK } } : r));
  return { shelf: { ...shelf, books, migrated: true }, records: out, changed: true };
}

/** Which book a note sits in (a missing book → the first one). */
export function bookOf(rec, shelf) {
  const id = rec && rec.meta && rec.meta.book;
  if (id && shelf.books.some((b) => b.id === id)) return id;
  return shelf.books[0] ? shelf.books[0].id : null;
}
/** A book's notes: pinned first, then newest. */
export function notesIn(records, shelf, bookId) {
  return records.filter((r) => isLive(r) && bookOf(r, shelf) === bookId)
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.meta && b.meta.edited || b.ts) - (a.meta && a.meta.edited || a.ts));
}
export function counts(records, shelf) {
  const n = {}; for (const b of shelf.books) n[b.id] = 0;
  for (const r of records) if (isLive(r)) { const b = bookOf(r, shelf); if (b) n[b] = (n[b] || 0) + 1; }
  return n;
}

export function addBook(shelf, name, cover = "dusk", now = Date.now()) {
  const b = { id: newId(now), name: String(name || "").trim().slice(0, 80) || MY_BOOK_NAME, cover, created: now };
  return { shelf: { ...shelf, books: [...shelf.books, b] }, book: b };
}
export const renameBook = (shelf, id, name) => ({ ...shelf, books: shelf.books.map((b) => (b.id === id && String(name || "").trim() ? { ...b, name: String(name).trim().slice(0, 80), named: true } : b)) });
export const setCover = (shelf, id, cover) => ({ ...shelf, books: shelf.books.map((b) => (b.id === id ? { ...b, cover } : b)) });
/** Move a book from one place to another (the drag), or by +1 / -1 (the arrows). */
export function reorder(shelf, from, to) {
  const books = shelf.books.slice();
  if (from < 0 || from >= books.length) return shelf;
  to = Math.max(0, Math.min(books.length - 1, to));
  const [b] = books.splice(from, 1); books.splice(to, 0, b);
  return { ...shelf, books };
}
export const moveBook = (shelf, id, dir) => { const i = shelf.books.findIndex((b) => b.id === id); return reorder(shelf, i, i + dir); };
/** Delete a book and its notes; `undo` puts both back exactly. */
export function deleteBook(shelf, records, id) {
  const index = shelf.books.findIndex((b) => b.id === id);
  if (index < 0) return { shelf, records, undo: null };
  const notes = records.filter((r) => isShelfNote(r) && bookOf(r, shelf) === id);
  const ids = new Set(notes.map((r) => r.id));
  return { shelf: { ...shelf, books: shelf.books.filter((b) => b.id !== id) }, records: records.filter((r) => !ids.has(r.id)), undo: { book: shelf.books[index], index, notes } };
}
export function undoDelete(shelf, records, undo) {
  if (!undo) return { shelf, records };
  const books = shelf.books.filter((b) => b.id !== undo.book.id); books.splice(Math.min(undo.index, books.length), 0, undo.book);
  const have = new Set(records.map((r) => r.id));
  return { shelf: { ...shelf, books }, records: [...undo.notes.filter((r) => !have.has(r.id)), ...records] };
}

/* ---- notes ---- */
export function makeNote({ title = "", text = "", book, now = Date.now() }) {
  const id = "n" + now.toString(36) + Math.random().toString(36).slice(2, 7);
  return { id, ts: now, kind: "note", title: String(title).slice(0, 90), text: String(text), output: "", lang: null, tags: ["note"], meta: { book, edited: now, shelf: true }, pinned: false };
}
export const editNote = (rec, { title, text }, now = Date.now()) => ({ ...rec, title: title != null ? String(title).slice(0, 90) : rec.title, text: text != null ? String(text) : rec.text, meta: { ...(rec.meta || {}), edited: now, aiAt: undefined, aiTitle: undefined } });
export function moveNotes(records, ids, bookId) {
  const s = new Set(ids);
  return records.map((r) => (s.has(r.id) ? { ...r, meta: { ...(r.meta || {}), book: bookId } } : r));
}
export function copyNote(rec, bookId, now = Date.now()) {
  const c = makeNote({ title: rec.title, text: rec.text, book: bookId, now });
  return { ...c, tags: rec.tags || c.tags };
}
/** Toggle the n-th checklist line ("- [ ]" / "- [x]") of a note's text. */
export function toggleCheck(text, n) {
  let i = -1;
  return String(text).split("\n").map((l) => {
    const m = l.match(/^(\s*[-*]\s*)\[( |x|X)\](.*)$/);
    if (!m) return l; i++;
    return i === n ? `${m[1]}[${m[2] === " " ? "x" : " "}]${m[3]}` : l;
  }).join("\n");
}
export const noteTitle = (r) => (r.meta && r.meta.myTitle) || r.title || String(r.text || "").split("\n")[0].slice(0, 70);

/* ---- search across every book (Arabic / English folding from mind.js) ---- */
export function searchShelf(records, shelf, q) {
  const words = normText(q).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (!words.length) return [];
  const out = [];
  for (const r of records) {
    if (!isShelfNote(r) || isTrashed(r)) continue;
    const hay = normText(`${noteTitle(r)}\n${r.text}`);
    if (words.every((w) => hay.includes(w))) { const b = bookOf(r, shelf); out.push({ rec: r, book: shelf.books.find((x) => x.id === b) || null, inTitle: words.every((w) => normText(noteTitle(r)).includes(w)) }); }
  }
  return out.sort((a, b) => (b.inTitle ? 1 : 0) - (a.inTitle ? 1 : 0) || b.rec.ts - a.rec.ts);
}

/* ---- reminders: the app's own reminder list + the phone's alarm (scheduleReminder in attune.jsx) ---- */
export const reminderId = (rec) => "shelf-" + rec.id;
export function noteReminder(rec, at, now = Date.now()) {
  if (!(at > now)) return null;
  return { id: reminderId(rec), at, title: noteTitle(rec) || "Note", body: String(rec.text || "").slice(0, 140), repeat: "none", created: now, source: "shelf" };
}
/** Sets the reminder through `schedule` (the app's scheduleReminder) → the updated record, or null. */
export function remindNote(rec, at, schedule, now = Date.now()) {
  const r = noteReminder(rec, at, now);
  if (!r) return null;
  schedule(r);
  return { ...rec, meta: { ...(rec.meta || {}), remindAt: at } };
}
export function upcoming(records, shelf, now = Date.now()) {
  return records.filter((r) => isLive(r) && r.meta && r.meta.remindAt > now)
    .sort((a, b) => a.meta.remindAt - b.meta.remindAt)
    .map((r) => ({ rec: r, at: r.meta.remindAt, book: shelf.books.find((b) => b.id === bookOf(r, shelf)) || null }));
}

/* ---- export a book as Markdown ---- */
export function bookMarkdown(book, notes, name = book.name) {
  return `# ${name}\n\n` + notes.map((r) => `## ${noteTitle(r) || "—"}\n\n${String(r.text || "").trim()}\n`).join("\n");
}

/* ---- v6.11 group 2: trash, archive, colours, tags, sort, duplicate, merge, info, templates, import ---- */
export const TRASH_DAYS = 30;
const DAYMS = 86400000;
export const isTrashed = (r) => !!(r && r.meta && r.meta.trashed);
export const isArchived = (r) => !!(r && r.meta && r.meta.archived);
const setM = (r, m) => ({ ...r, meta: { ...(r.meta || {}), ...m } });
export const trashNotes = (records, ids, now = Date.now()) => { const s = new Set(ids); return records.map((r) => (s.has(r.id) ? setM(r, { trashed: now }) : r)); };
export const restoreNotes = (records, ids) => { const s = new Set(ids); return records.map((r) => (s.has(r.id) ? setM(r, { trashed: 0 }) : r)); };
export const archiveNotes = (records, ids, on = true) => { const s = new Set(ids); return records.map((r) => (s.has(r.id) ? setM(r, { archived: on ? 1 : 0 }) : r)); };
/** Notes in the trash for more than 30 days are deleted for good. */
export const purgeTrash = (records, now = Date.now()) => records.filter((r) => !(isTrashed(r) && now - r.meta.trashed > TRASH_DAYS * DAYMS));
export const trashOf = (records) => records.filter((r) => isShelfNote(r) && isTrashed(r)).sort((a, b) => b.meta.trashed - a.meta.trashed);
export const archiveOf = (records, shelf) => records.filter((r) => isShelfNote(r) && !isTrashed(r) && isArchived(r));
/** What shows in a book: not in the trash, not archived. */
export const isLive = (r) => isShelfNote(r) && !isTrashed(r) && !isArchived(r);

export const NOTE_COLORS = ["", "#7f1d1d", "#78350f", "#365314", "#134e4a", "#1e3a8a", "#4c1d95", "#831843"];
export const setColor = (rec, color) => setM(rec, { color });
export const toggleStar = (rec) => setM(rec, { star: !(rec.meta && rec.meta.star) });

/** #tags written in a note (English or Arabic). */
export function noteTags(rec) {
  const out = []; const rx = /(?:^|\s)#([\p{L}\p{N}_]{2,30})/gu; let m;
  const t = String(rec && rec.text || ""); while ((m = rx.exec(t))) { const k = normText(m[1]); if (!out.includes(k)) out.push(k); }
  return out;
}
export function tagsIn(notes) { const n = new Map(); for (const r of notes) for (const t of noteTags(r)) n.set(t, (n.get(t) || 0) + 1); return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count })); }

/** Sort a book's notes: pinned first, then by edited | created | title. */
export function sortNotes(notes, by = "edited") {
  const key = { edited: (r) => -((r.meta && r.meta.edited) || r.ts), created: (r) => -r.ts, title: (r) => noteTitle(r).toLowerCase() }[by] || ((r) => 0);
  return notes.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}
export const sortBooks = (books, by, counts = {}) => by === "name" ? books.slice().sort((a, b) => a.name.localeCompare(b.name)) : by === "notes" ? books.slice().sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)) : books;

export function duplicateBook(shelf, records, id, now = Date.now()) {
  const b = shelf.books.find((x) => x.id === id); if (!b) return { shelf, records };
  const { shelf: s2, book } = addBook(shelf, b.name + " (2)", b.cover, now);
  const i = s2.books.findIndex((x) => x.id === book.id), books = s2.books.slice(); books.splice(i, 1); books.splice(shelf.books.indexOf(b) + 1, 0, book);
  const copies = records.filter((r) => isLive(r) && bookOf(r, shelf) === id).map((r, k) => copyNote(r, book.id, now + k));
  return { shelf: { ...s2, books }, records: [...copies, ...records], book };
}
/** Merge book `from` into `into`: its notes move, the book goes. */
export function mergeBooks(shelf, records, from, into) {
  if (from === into) return { shelf, records };
  const ids = records.filter((r) => isShelfNote(r) && bookOf(r, shelf) === from).map((r) => r.id);
  return { shelf: { ...shelf, books: shelf.books.filter((b) => b.id !== from) }, records: moveNotes(records, ids, into) };
}
export function noteInfo(rec) {
  const t = String(rec.text || "");
  return { created: rec.ts, edited: (rec.meta && rec.meta.edited) || rec.ts, words: (t.match(/[\p{L}\p{N}]+/gu) || []).length, chars: t.length, checks: (t.match(/^\s*[-*]\s*\[( |x|X)\]/gm) || []).length };
}
export const TEMPLATES = [
  { id: "meeting", en: "Meeting", title: "Meeting — ", text: "Who:\nAgenda:\n- \nDecisions:\n- \nActions:\n- [ ] " },
  { id: "todo", en: "To-do list", title: "To do", text: "- [ ] \n- [ ] \n- [ ] " },
  { id: "journal", en: "Journal", title: "", text: "How I feel:\nWhat happened today:\nGrateful for:\n" },
  { id: "shopping", en: "Shopping list", title: "Shopping", text: "- [ ] \n- [ ] \n- [ ] " },
];
/** A .txt / .md file → notes: "## heading" sections become notes; a file with none is one note. */
export function importText(text, fileName, bookId, now = Date.now()) {
  const t = String(text || "").replace(/\r\n/g, "\n");
  const parts = t.split(/^##\s+/m);
  if (parts.length > 1) return parts.slice(1).map((p, i) => { const [h, ...rest] = p.split("\n"); return makeNote({ title: h.trim(), text: rest.join("\n").trim(), book: bookId, now: now + i }); });
  const body = t.replace(/^#\s+.*\n+/, "");
  return body.trim() ? [makeNote({ title: String(fileName || "").replace(/\.\w+$/, ""), text: body.trim(), book: bookId, now })] : [];
}
/* ---- v6.11 group 3: a PIN lock on a book (like Business's owner PIN: keeps casual eyes out on a shared
   phone; it is NOT encryption — the notes stay readable in the phone's storage and in Mind) ---- */
const h53 = (str) => { let a = 0xdeadbeef, b = 0x41c6ce57; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); } a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909); b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909); return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36); };
export const validPin = (pin) => /^\d{4,6}$/.test(String(pin || ""));
export function setPin(shelf, pin) {
  if (!validPin(pin)) return null;
  const salt = Math.random().toString(36).slice(2, 10);
  return { ...shelf, security: { salt, pin: h53("shelf|" + salt + "|" + pin) } };
}
export const hasPin = (shelf) => !!(shelf.security && shelf.security.pin);
export const checkPin = (shelf, pin) => hasPin(shelf) && h53("shelf|" + shelf.security.salt + "|" + String(pin)) === shelf.security.pin;
export const setLocked = (shelf, id, locked) => ({ ...shelf, books: shelf.books.map((b) => (b.id === id ? { ...b, locked: !!locked } : b)) });
/** Search leaves out locked books unless they were unlocked in this session (`open` = Set of ids). */
export const visibleHits = (hits, open) => hits.filter((h) => !(h.book && h.book.locked) || (open && open.has(h.book.id)));

/** Move the n-th checklist line up or down among the checklist lines. */
export function moveCheck(text, n, dir) {
  const lines = String(text).split("\n"); const idx = [];
  lines.forEach((l, i) => { if (/^\s*[-*]\s*\[( |x|X)\]/.test(l)) idx.push(i); });
  const a = idx[n], b = idx[n + dir]; if (a == null || b == null) return text;
  [lines[a], lines[b]] = [lines[b], lines[a]]; return lines.join("\n");
}
/** Wrap the selection [s, e) of `text` in Markdown (bold, italic…) or start its line with a prefix. */
export function format(text, s, e, kind) {
  const W = { bold: "**", italic: "_", strike: "~~" }[kind];
  if (W) return { text: text.slice(0, s) + W + text.slice(s, e) + W + text.slice(e), s: s + W.length, e: e + W.length };
  const P = { h1: "# ", h2: "## ", bullet: "- ", number: "1. ", check: "- [ ] ", quote: "> " }[kind] || "";
  const ls = text.lastIndexOf("\n", s - 1) + 1;
  return { text: text.slice(0, ls) + P + text.slice(ls), s: s + P.length, e: e + P.length };
}
