// v6.11 Shelf (shelf.js): migration keeps every note, books, reorder, move/copy, search, reminders, export.
const S = await import("../../web-src/shelf.js");
let fail = 0;
const ok = (c, what) => { console.log((c ? "PASS " : "FAIL ") + what); if (!c) fail++; };
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const now = new Date("2026-10-04T10:00:00").getTime();

// ---- migration: old → new, counts and texts identical
const old = [
  { id: "a", ts: 1, kind: "note", title: "Crane", text: "Call Hassan about the 100 t crane", output: "", tags: [], meta: null, pinned: true },
  { id: "b", ts: 2, kind: "note", title: "الشريعة", text: "ملاحظة عن الشريعة والفقه", output: "", tags: [], meta: { aiTitle: "x" }, pinned: false },
  { id: "c", ts: 3, kind: "note", title: "list", text: "- [ ] milk\n- [x] bread", output: "", tags: [], meta: null, pinned: false },
  { id: "d", ts: 4, kind: "instant", title: "answer", text: "q", output: "an answer", tags: [], meta: null },
  { id: "e", ts: 5, kind: "photo", title: "Photo", text: "read text", output: "", tags: ["photo"], meta: { thumb: true, mindKind: "photo" } },
];
const st = mem();
const before = JSON.stringify(old);
let { shelf, records, changed } = S.migrate(S.emptyShelf(), old, { storage: st, now });
ok(changed && shelf.migrated && shelf.books.length === 1 && shelf.books[0].id === S.MY_BOOK && shelf.books[0].name === "My Book", "migration makes «My Book»");
ok(records.length === old.length && records.every((r, i) => r.id === old[i].id && r.text === old[i].text && r.title === old[i].title && r.pinned === old[i].pinned && r.output === old[i].output), "no record lost or changed in text (count + texts identical)");
ok(JSON.stringify(old) === before, "the old array is not mutated");
ok(st.getItem(S.BACKUP_KEY) === before, "a backup copy of the old data is kept under its own key");
const inBook = S.notesIn(records, shelf, S.MY_BOOK);
ok(inBook.length === 3 && inBook.map((r) => r.id).sort().join() === "a,b,c", "the 3 notes are in My Book (answers and photos stay in Mind only)");
ok(records[1].meta.aiTitle === "x", "existing meta is kept");
const again = S.migrate(shelf, records, { storage: st, now: now + 9 });
ok(!again.changed && again.records === records && again.shelf === shelf, "migration runs once (idempotent)");
st.setItem(S.BACKUP_KEY, "keep"); S.migrate(S.emptyShelf(), records, { storage: st }); ok(st.getItem(S.BACKUP_KEY) === "keep", "the backup is never overwritten");

// ---- store
S.saveShelf(st, shelf); ok(JSON.stringify(S.loadShelf(st)) === JSON.stringify(shelf), "store: saved and loaded back");
ok(S.loadShelf(mem()).books.length === 0, "store: empty when nothing saved");

// ---- books
let r1 = S.addBook(shelf, "Novels links", "girih", now); shelf = r1.shelf; const nov = r1.book;
let r2 = S.addBook(shelf, "  الشريعة ", "ocean", now + 1); shelf = r2.shelf; const sh = r2.book;
ok(shelf.books.map((b) => b.name).join("|") === "My Book|Novels links|الشريعة", "create books (names trimmed, Arabic ok)");
shelf = S.renameBook(shelf, nov.id, "Novels"); ok(shelf.books[1].name === "Novels", "rename");
ok(S.renameBook(shelf, nov.id, "  ").books[1].name === "Novels", "an empty name is refused");
shelf = S.setCover(shelf, nov.id, "photo:cover:x"); ok(S.isPhotoCover(shelf.books[1].cover), "change cover to a photo");
ok(S.COVERS.length >= 12 && new Set(S.COVERS.map((c) => c.id)).size === S.COVERS.length && S.COVERS.every((c) => !/https?:\/\/(?!www\.w3\.org)/.test(c.bg)), "12+ built-in covers, drawn in code (no outside images)");
ok(S.reorder(shelf, 2, 0).books.map((b) => b.id).join() === [sh.id, S.MY_BOOK, nov.id].join(), "reorder by drag (2 → 0)");
ok(S.moveBook(shelf, S.MY_BOOK, -1) .books[0].id === S.MY_BOOK && S.moveBook(shelf, S.MY_BOOK, 1).books[1].id === S.MY_BOOK, "move up/down, clamped at the ends");

// ---- notes: create, move (single + multi), copy, checklists
const n1 = S.makeNote({ title: "Ibn Khaldun", text: "المقدمة — كتاب رائع", book: nov.id, now });
records = [n1, ...records];
ok(S.notesIn(records, shelf, nov.id).length === 1 && S.counts(records, shelf)[nov.id] === 1, "a new note sits in its book; counts");
records = S.moveNotes(records, ["a", "c"], sh.id);
ok(S.counts(records, shelf)[sh.id] === 2 && S.counts(records, shelf)[S.MY_BOOK] === 1, "move notes (multi-select)");
const cp = S.copyNote(n1, S.MY_BOOK, now + 5); records = [cp, ...records];
ok(cp.id !== n1.id && cp.text === n1.text && S.counts(records, shelf)[S.MY_BOOK] === 2 && S.counts(records, shelf)[nov.id] === 1, "copy a note to another book");
ok(S.toggleCheck("- [ ] milk\n- [x] bread\ntext", 0) === "- [x] milk\n- [x] bread\ntext" && S.toggleCheck("- [ ] milk\n- [x] bread", 1) === "- [ ] milk\n- [ ] bread", "checklists toggle");
const ed = S.editNote(n1, { text: "new" }, now + 9); ok(ed.text === "new" && ed.title === n1.title && ed.meta.book === nov.id, "edit keeps title and book");
ok(S.bookOf({ kind: "note", meta: { book: "gone" } }, shelf) === S.MY_BOOK && S.bookOf({ kind: "note" }, shelf) === S.MY_BOOK, "a note from Mind with no book (or a gone one) shows in the first book");

// ---- search across books (Arabic folding)
const hits = S.searchShelf(records, shelf, "الشريعه");
ok(hits.length === 1 && hits[0].rec.id === "b" && hits[0].book.id === S.MY_BOOK, "search across books: Arabic ة/ه folded, result knows its book");
ok(S.searchShelf(records, shelf, "crane HASSAN")[0].book.id === sh.id, "English, any case, several words");
ok(S.searchShelf(records, shelf, "answer").length === 0, "tool answers are not Shelf notes");
ok(S.searchShelf(records, shelf, "  ").length === 0, "empty search → nothing");

// ---- delete + undo
const del = S.deleteBook(shelf, records, sh.id);
ok(del.shelf.books.length === 2 && del.records.length === records.length - 2, "delete a book removes its notes");
const un = S.undoDelete(del.shelf, del.records, del.undo);
ok(un.shelf.books.map((b) => b.id).join() === shelf.books.map((b) => b.id).join() && un.records.length === records.length, "undo puts the book back in its place with its notes");

// ---- reminders with a mocked NATIVE
const NATIVE = { calls: [], schedule(j) { this.calls.push(JSON.parse(j)); return JSON.stringify({ ok: true }); } };
const schedule = (r) => NATIVE.schedule(JSON.stringify(r));
const later = now + 3600e3;
const withRem = S.remindNote(n1, later, schedule, now);
ok(withRem && withRem.meta.remindAt === later && NATIVE.calls.length === 1 && NATIVE.calls[0].id === "shelf-" + n1.id && NATIVE.calls[0].at === later && NATIVE.calls[0].title === "Ibn Khaldun", "a reminder goes to the phone with the note's title");
ok(S.remindNote(n1, now - 1, schedule, now) === null && NATIVE.calls.length === 1, "a time in the past is refused");
const up = S.upcoming([withRem, ...records.filter((r) => r.id !== n1.id)], shelf, now);
ok(up.length === 1 && up[0].book.id === nov.id, "the alarm list shows upcoming reminders with their book");

// ---- export
const md = S.bookMarkdown(shelf.books[1], [n1]); ok(md.startsWith("# Novels") && md.includes("## Ibn Khaldun") && md.includes("المقدمة"), "export a book as Markdown");

// ---- group 2: trash (30 days), archive, tags, sort, duplicate, merge, info, import, checklist reorder, format
{
  const DAY = 86400000;
  let rs = S.trashNotes(records, [n1.id], now);
  ok(S.counts(rs, shelf)[nov.id] === 0 && S.trashOf(rs).length === 1 && S.searchShelf(rs, shelf, "Khaldun").length === 1, "trash: the note leaves its book and search");
  ok(S.counts(S.restoreNotes(rs, [n1.id]), shelf)[nov.id] === 1, "trash: restore");
  ok(S.purgeTrash(rs, now + 29 * DAY).length === rs.length && S.purgeTrash(rs, now + 31 * DAY).length === rs.length - 1, "trash empties itself after 30 days");
  rs = S.archiveNotes(records, [n1.id]);
  ok(S.counts(rs, shelf)[nov.id] === 0 && S.archiveOf(rs, shelf).length === 1 && S.searchShelf(rs, shelf, "Khaldun").length === 2, "archive: out of the book, still searchable");
  ok(JSON.stringify(S.noteTags({ text: "trip #Travel and #سفر, not a#b" })) === '["travel","سفر"]', "#tags in English and Arabic");
  const a = { id: "x", ts: 1, title: "b", text: "", meta: { edited: 5 } }, b = { id: "y", ts: 2, title: "a", text: "", meta: { edited: 3 } };
  ok(S.sortNotes([a, b], "title")[0].id === "y" && S.sortNotes([a, b], "created")[0].id === "y" && S.sortNotes([a, b], "edited")[0].id === "x", "sort by title / created / edited");
  const d = S.duplicateBook(shelf, records, nov.id, now);
  ok(d.shelf.books.length === shelf.books.length + 1 && d.shelf.books[2].id === d.book.id && S.counts(d.records, d.shelf)[d.book.id] === S.counts(records, shelf)[nov.id], "duplicate a book (next to it, with copies of its notes)");
  const mg = S.mergeBooks(shelf, records, sh.id, S.MY_BOOK);
  ok(mg.shelf.books.length === shelf.books.length - 1 && S.counts(mg.records, mg.shelf)[S.MY_BOOK] === S.counts(records, shelf)[S.MY_BOOK] + S.counts(records, shelf)[sh.id], "merge two books");
  const inf = S.noteInfo({ ts: 1, text: "one two ثلاثة\n- [ ] x", meta: { edited: 9 } });
  ok(inf.words === 4 && inf.checks === 1 && inf.edited === 9, "note info: words, checklist, edited");
  const im = S.importText("# Book\n\n## First\nbody 1\n## Second\nbody 2", "x.md", nov.id, now);
  ok(im.length === 2 && im[1].title === "Second" && im[1].text === "body 2" && im[0].meta.book === nov.id, "import Markdown: ## sections become notes");
  ok(S.importText("just text", "memo.txt", nov.id)[0].title === "memo", "import a plain text file as one note");
  ok(S.moveCheck("- [ ] a\nx\n- [ ] b", 0, 1) === "- [ ] b\nx\n- [ ] a", "reorder checklist lines");
  ok(S.format("hello", 0, 5, "bold").text === "**hello**" && S.format("a\nb", 2, 3, "h1").text === "a\n# b", "format: bold, heading");
  ok(S.TEMPLATES.length >= 4, "templates");
  // PIN lock
  ok(S.setPin(shelf, "12a") === null && S.setPin(shelf, "123") === null, "PIN must be 4–6 digits");
  const ps = S.setLocked(S.setPin(shelf, "4321"), nov.id, true);
  ok(S.hasPin(ps) && S.checkPin(ps, "4321") && !S.checkPin(ps, "1234") && !JSON.stringify(ps).includes("4321"), "PIN checked by a salted hash, never stored as is");
  const hs = S.searchShelf(records, ps, "Khaldun");
  ok(S.visibleHits(hs, new Set()).every((h) => h.book.id !== nov.id) && S.visibleHits(hs, new Set([nov.id])).some((h) => h.book.id === nov.id), "a locked book's notes are left out of search until it is unlocked");
}

console.log(fail ? `${fail} FAILED` : "ALL PASSED");
process.exit(fail ? 1 : 0);
