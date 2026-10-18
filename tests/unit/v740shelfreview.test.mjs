// v6.37 H6: Shelf review — your notes come back, spaced by how well you remembered them.
import { dueNotes, grade } from "../../web-src/shelfreview.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const D = 86400000, now = Date.parse("2026-10-18T09:00:00");
const note = (id, text, book = "b1", extra = {}) => ({ id, kind: "note", text, title: "", created: now - 3 * D, meta: { book, ...extra } });
const shelf = { books: [{ id: "b1", name: "Ideas" }, { id: "b2", name: "Private", locked: true }] };
const recs = [note("n1", "Compound interest: money grows on its growth"), note("n2", "Pareto: 20% of causes give 80% of the results"), note("n3", "short"),
  note("n4", "A locked note with enough words in it", "b2"), note("n5", "Trashed note that is long enough to count", "b1", { trashed: now }), note("n6", "Too new to come back yet, written today"), note("n7", "Ebbinghaus: we forget most within days")];
recs[5].created = now - 3600e3;
let st = { cards: {} };
let due = dueNotes(recs, shelf, st, now);
ok(due.map((x) => x.id).join() === "n1,n2,n7", "new notes, three a day; not short, locked, trashed or brand-new ones (" + due.map((x) => x.id) + ")");
st = grade(st, "n1", 3, now); st = grade(st, "n2", 1, now);
ok(st.newToday === 2 && dueNotes(recs, shelf, st, now).map((x) => x.id).join() === "n7", "two reviewed today → one new one left today");
ok(st.cards.n1.due - now >= 2 * D && st.cards.n2.due - now <= 1.01 * D, "remembered comes back in days; forgot comes back tomorrow");
const later = now + 1.2 * D, d2 = dueNotes(recs, shelf, st, later).map((x) => x.id);
ok(d2[0] === "n2" && !d2.includes("n1"), "tomorrow: the forgotten one first; the remembered one not yet (" + d2 + ")");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
