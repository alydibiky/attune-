// v10.9.9 B5 (Ali OK'd 27 Nov): Test every page — the steps (Home · Chat · Money · Mind first, then every page the Tools list shows, each
// once), the person's own words in them, the results (✓ / ✗ / skip, the next untried page), the report (wrong ones first; the .html file
// escapes what was typed and keeps only real pictures).
const TP = await import("../../web-src/testpages.js");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c || process.env.V) console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const pages = [["lists", "To-dos & lists"], ["timeline", "Follow-ups"], ["radar", "Deadline Radar"], ["memory", "Mind"], ["habits", "Habits"], ["lists", "To-dos & lists"]];
const steps = TP.stepsFor(pages, {});
ok(steps.map((s) => s.id).join(",") === "home,chat,money,memory,lists,timeline,radar,habits", "Home · Chat · Money · Mind first, then each Tools page once: " + steps.map((s) => s.id).join(","));
ok(steps.find((s) => s.id === "habits").try === "Open {p} and use its main button once." && steps.find((s) => s.id === "habits").v.p === "Habits", "a page with no step of its own gets the general one, with its name");
ok(steps.find((s) => s.id === "chat").v.x === "groceries" && steps.find((s) => s.id === "chat").def.includes("x"), "no data → a plain example, marked to be translated");
const stores = { ledger: { txns: [{ type: "expense", note: "hany rabee3 cut", date: "2026-11-20" }, { type: "expense", note: "Carrefour", date: "2026-11-01" }, { type: "income", note: "salary", date: "2026-11-25" }] },
  radar: { items: [{ title: "Passport renewal", date: "2027-03-03" }] }, memory: [{ kind: "chat", text: "who won" }, { kind: "note", text: "that in the barber I go to hany" }], life: { items: [{ person: "Ahmed Sami" }] } };
const mine = TP.stepsFor(pages, stores), chat = mine.find((s) => s.id === "chat");
ok(chat.v.x === "hany rabee3 cut" && !chat.def.includes("x"), "the newest expense names the Chat step (never the salary): " + chat.v.x);
ok(mine.find((s) => s.id === "radar").v.paper === "Passport renewal" && mine.find((s) => s.id === "memory").v.note === "that in" && mine.find((s) => s.id === "home").v.who === "Ahmed Sami", "the first paper, a note's words (not a chat), a person — the person's own");
let run = TP.fresh("10.9.9");
run = TP.mark(run, steps, "home", "ok");
ok(run.idx === 1 && run.res.home.r === "ok", "✓ → the next page");
run = TP.mark(run, steps, "chat", "bad", "said 0 <b>", "chat");
run = TP.mark(run, steps, "memory", "skip");
ok(run.idx === 4, "the next page is the next untried one after this page (lists)");
{ let w = TP.fresh("1"); for (const s of steps.slice(3)) w = TP.mark(w, steps, s.id, "ok"); ok(w.idx === 0, "…and at the end, back to a page left untried before (Home)"); }
const c = TP.counts(run, steps);
ok(c.ok === 1 && c.bad === 1 && c.skip === 1 && c.left === 5, "counts: " + JSON.stringify(c));
const txt = TP.reportText(run, steps);
ok(/version 10\.9\.9/.test(txt) && txt.indexOf("✗ Chat") < txt.indexOf("✓ Home") && /Note: said 0/.test(txt) && /Screenshot attached/.test(txt), "the report: version, the wrong one first with its note and screenshot");
const html = TP.reportHtml(run, steps, { chat: "data:image/jpeg;base64,AAA", home: "javascript:alert(1)" });
ok(html.includes("said 0 &lt;b&gt;") && html.includes('src="data:image/jpeg;base64,AAA"') && !html.includes("javascript:"), "the .html report escapes typed text and keeps only real pictures");
const all = TP.stepsFor(pages, {}); let r2 = TP.fresh("1"); for (const s of all) r2 = TP.mark(r2, all, s.id, "ok");
ok(r2.idx === all.length && TP.counts(r2, all).left === 0, "every page answered → the end");
const mem = {}; const st = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); } };
TP.save(run, st); ok(TP.load(st).res.chat.note === "said 0 <b>", "the run is kept (carry on later)");
console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED v1099b5 (${n} checks)`);
if (fail) process.exit(1);
