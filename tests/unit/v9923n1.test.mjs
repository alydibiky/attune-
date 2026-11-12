// v9.9.23 B5 N1 the person page: a 2,500 sample of tests/n1/gen.mjs (every record on its owner's page, in its section, opening ITS
// original, never sure on someone else's page) must stay at 100%; plus a held-out 500 and the rules one by one.
import { run } from "../n1/gen.mjs";
import * as P from "../../web-src/personpage.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const r = run(2500, 0); ok(r.pass === 2500, "2,500 generated records: " + r.pass + " / 2500 " + JSON.stringify(r.bad.slice(0, 2)));
const h = run(500, 90000); ok(h.pass === 500, "500 held-out records: " + h.pass + " / 500");
const dir = { items: [{ id: "a", kind: "person", name: "Ahmed Samir", aliases: [] }, { id: "b", kind: "person", name: "Ahmed Kamal", aliases: [] }, { id: "m", kind: "person", name: "منى فوزي", aliases: [] }] };
const st = { ledger: { currency: "EGP", txns: [{ id: "t1", type: "expense", amount: 300, date: "2026-11-01", note: "Paid Ahmed Samir for the sink" }, { id: "t2", type: "expense", amount: 50, date: "2026-11-02", note: "Ahmed — cables" }] },
  life: { items: [{ id: "l1", kind: "debt", person: "Ahmed Kamal", dir: "in", amount: 500, total: 500, count: 1, start: "2026-10-02", done: false }, { id: "l2", kind: "debt", person: "Ahmed Kamal", dir: "in", amount: 200, total: 200, count: 1, start: "2026-09-01", paid: [0] }] },
  memory: [{ id: "n1", kind: "note", ts: Date.parse("2026-10-10"), title: "منى بتشتغل في البنك", text: "", meta: {} }], radar: { items: [] }, reminders: [], notes: [] };
const pa = P.personSections(dir.items[0], st, dir), pb = P.personSections(dir.items[1], st, dir), pm = P.personSections(dir.items[2], st, dir);
const lines = (pg) => pg.sections.flatMap((s) => s.items.map((x) => ({ sec: s.key, ...x })));
const a1 = lines(pa).find((x) => x.id === "tx:t1");
ok(a1 && a1.sec === "money" && !a1.maybe && a1.target.mode === "money" && a1.target.id === "tx:t1", "Ahmed Samir's payment: on his page, Money, opens that payment");
ok(!lines(pb).some((x) => x.id === "tx:t1"), "…and never on Ahmed Kamal's page");
ok(lines(pa).some((x) => x.id === "tx:t2" && x.maybe) && lines(pb).some((x) => x.id === "tx:t2" && x.maybe), "\"Ahmed — cables\" (which Ahmed?) → on both, marked maybe");
const b1 = lines(pb).find((x) => x.id === "life:l1");
ok(b1 && b1.sec === "money" && b1.target.mode === "life" && b1.target.flash === "life:l1", "Ahmed Kamal owes 500 → Money section, opens that follow-up");
ok(!lines(pb).some((x) => x.id === "life:l2"), "a paid debt isn't listed");
const m1 = lines(pm).find((x) => x.id === "mem:n1");
ok(m1 && m1.sec === "notes" && m1.target.mode === "memory" && m1.target.key === "attune:mind:open" && m1.target.id === "n1", "منى's note (first name only, Arabic) → Notes, opens that note in Mind");
ok(P.personSections(null, st, dir).count === 0, "no card → nothing");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
