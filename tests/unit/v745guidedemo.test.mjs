// v6.45 How to use, redesigned (Ali chose A + C): every guide has sample data to play (what you give → what you get →
// what you do next), in English AND Egyptian Arabic; the "What Attune can do" goals point at real guides.
import * as G from "../../web-src/guide.js";
import * as GD from "../../web-src/guide-demo.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const keys = [...Object.keys(G.TOOLS), ...G.START.map((s) => "start:" + s.id)];
const missing = keys.filter((k) => !GD.demoFor(k));
ok(!missing.length, "every guide (" + keys.length + ") has sample data (missing: " + missing.join(", ") + ")");
const extra = Object.keys(GD.DEMOS).filter((k) => !G.TOOLS[k] && !G.START.some((s) => s.id === k));
ok(!extra.length, "no sample data for a guide that doesn't exist (" + extra + ")");
const pair = (x) => Array.isArray(x) && x.length === 2 && x[0] && x[1];
const bad = Object.entries(GD.DEMOS).filter(([, d]) => !["type", "photo", "file", "chat", "pick"].includes(d.in) || !pair(d.say) || !pair(d.title) || !pair(d.note)
  || d.lines.length !== 3 || d.lines.some((l) => !l[0] || !l[1] || l[2] == null || (Array.isArray(l[2]) && !pair(l[2]))) || !d.act.length || !d.act.every(pair) || (d.bar != null && !(d.bar >= 0 && d.bar <= 1)));
ok(!bad.length, "each demo: what goes in, a title, 3 lines, buttons and a note — in both languages (" + bad.map((b) => b[0]) + ")");
const ar = Object.values(GD.DEMOS).flatMap((d) => [d.title[1], d.note[1], ...d.lines.map((l) => l[1]), ...d.act.map((a) => a[1])]);
ok(ar.filter((t) => !/[؀-ۿ]/.test(t) && !/^[0-9]+$|PDF|PowerPoint|LTM/.test(t)).length === 0, "the Arabic side is Arabic: " + ar.filter((t) => !/[؀-ۿ]/.test(t) && !/^[0-9]+$|PDF|PowerPoint|LTM/.test(t)).slice(0, 4).join(" | "));
ok(!ar.some((t) => /الهاتف|تريد|يجب أن|عندما/.test(t)), "Egyptian, not formal");
ok(GD.GOALS.length >= 5 && GD.GOALS.every((g) => pair(g.title) && g.tools.length >= 4 && g.tools.every((id) => GD.demoFor(id))), "What Attune can do: " + GD.GOALS.length + " goals, each with 4+ cards that have a guide");
ok(GD.pickV(["a", "ب"], true) === "ب" && GD.pickV("x", true) === "x", "a value shows in the language");
ok(GD.demoFor("start:say").title[0] === "Done in two places" && /koshari/.test(GD.demoFor("start:say").say[0]), "Home's sample: one sentence → Food and Money");
