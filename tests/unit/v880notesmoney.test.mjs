// v8.8 (Ali: "make the code also read the notes I write when I am putting an expense or income")
import { moneyFromNotes } from "../../web-src/notesmoney.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const now = Date.parse("2026-10-30T12:00:00"), day = 864e5;
const recs = [
  { id: "a", kind: "note", title: "House", text: "paid the plumber 300 for the sink\ncall the carpenter tomorrow", ts: now - 2 * day, meta: { book: "mybook" } },
  { id: "b", kind: "note", title: "مصاريف", text: "دفعت للسباك ٣٠٠\nاشتريت خضار ب ١٢٠", ts: now - day },
  { id: "c", kind: "note", title: "Salary", text: "got 15000 salary", ts: now - day },
  { id: "d", kind: "note", title: "Ideas", text: "the flat is 120 square metres", ts: now - day },
  { id: "e", kind: "chat", title: "x", text: "paid 50", output: "ok", ts: now - day },
  { id: "f", kind: "note", title: "old", text: "paid 999", ts: now - 90 * day },
];
const ledger = { txns: [{ amount: 120, date: "2026-10-28", type: "expense" }] };
const s = moneyFromNotes(recs, ledger, { now });
ok(s.some((x) => x.recId === "a" && x.item.amount === 300 && x.item.type === "expense"), "“paid the plumber 300” in a Shelf note → a 300 expense to add");
ok(s.some((x) => x.recId === "b" && x.item.amount === 300), "«دفعت للسباك ٣٠٠» → 300");
ok(!s.some((x) => x.recId === "b" && x.item.amount === 120), "«خضار ١٢٠» is already in Money (same amount, a day apart) → not offered twice");
ok(s.some((x) => x.recId === "c" && x.item.type === "income" && x.item.amount === 15000), "“got 15000 salary” → income");
ok(!s.some((x) => ["d", "e", "f"].includes(x.recId)), "not money (a size), not a chat answer, not 3 months old");
ok(moneyFromNotes(recs, ledger, { now, done: s.map((x) => x.id) }).length === 0, "Add / Not money → never offered again");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
