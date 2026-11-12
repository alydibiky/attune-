// v9.9.23 B5 P2 "before you meet": a 2,500 sample of tests/p2/gen.mjs must stay at 100%, a held-out 500 too, and the rules one by one.
import { run } from "../p2/gen.mjs";
import * as BM from "../../web-src/beforemeet.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const r = run(2500, 0); ok(r.pass === 2500, "2,500 generated meetings: " + r.pass + " / 2500 " + JSON.stringify(r.bad.slice(0, 2)));
const h = run(500, 90000); ok(h.pass === 500, "500 held-out meetings: " + h.pass + " / 500");
const NOW = Date.parse("2026-11-12T12:00:00");
const dir = { items: [{ id: "s", kind: "person", name: "Sheikh Mahmoud", aliases: ["Sheikh"] }, { id: "a", kind: "person", name: "Ahmed Samir", aliases: [] }, { id: "b", kind: "person", name: "Ahmed Kamal", aliases: [] }] };
const st = { ledger: { txns: [] }, memory: [{ id: "n1", kind: "note", ts: NOW - 864e5, title: "Sheikh's son got married last week", text: "", meta: {} }], radar: { items: [] }, reminders: [], notes: [],
  life: { items: [{ id: "i1", kind: "installment", person: "Sheikh", dir: "in", amount: 2437.5, total: 19500, count: 8, start: "2026-09-01", paid: [0, 1], created: 1 },
                  { id: "i2", kind: "debt", person: "Sheikh", dir: "in", amount: 300, total: 300, count: 1, start: "2026-08-01", paid: [0], created: 2 },
                  { id: "i3", kind: "person", person: "Sheikh", title: "send him the price list", count: 1, start: "2026-11-02", created: 3 }] } };
const at = Date.parse("2026-11-13T16:00:00");
const out = BM.beforeMeet([{ id: "r1", at, title: "Meeting Sheikh", repeat: "none" }], st, dir, NOW), n = out[0];
ok(n && n.id === "meet-r1" && n.at === at - 36e5, "Meeting Sheikh at 16:00 → a notification at 15:00");
ok(n && n.lines.length === 3 && /Owes you 14,625 \(2 of 8 paid\)/.test(n.lines[0]), "line 1: he owes 14,625 (2 of 8 paid): " + (n && n.lines[0]));
ok(n && /Open: .*price list/.test(n.lines[1]) && /Note: .*married/.test(n.lines[2]), "line 2: the open promise, line 3: the latest note: " + (n && n.lines.slice(1).join(" | ")));
ok(n && !n.lines.some((l) => /300/.test(l)), "the 300 he already paid back isn't there");
ok(n && /^In 1 hour: Meeting Sheikh · 16:00$/.test(n.title), "title: " + (n && n.title));
ok(BM.beforeMeet([{ id: "r2", at, title: "Call Ahmed", repeat: "none" }], st, dir, NOW).length === 0, "\"Call Ahmed\" with two Ahmeds → nothing (never the wrong person)");
ok(BM.beforeMeet([{ id: "r3", at, title: "Call Ahmed Samir", repeat: "none" }], st, dir, NOW).length === 0, "Ahmed Samir has nothing open → nothing");
ok(BM.beforeMeet([{ id: "r4", at: NOW + 30 * 6e4, title: "Meeting Sheikh", repeat: "none" }], st, dir, NOW).length === 0, "a meeting in 30 minutes → too late for the 1-hour note");
ok(BM.beforeMeet([{ id: "r5", at: NOW + 10 * 864e5, title: "Meeting Sheikh", repeat: "none" }], st, dir, NOW).length === 0, "a meeting in 10 days → not yet (it comes in the week before)");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
