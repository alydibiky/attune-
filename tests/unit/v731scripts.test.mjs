// v6.28 converter: a subscript / superscript the PDF reader put on its own line goes back next to its word (a real paper's table
// was split in two by μ_max's "max", and its formula μ = μmax S / (KS + S) was pulled apart).
import { attachScripts, pdfLinesToBlocks } from "../../web-src/convert.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const W = (x, t, e, v = 0) => [x, t, false, false, 0, e, v];
const line = (y, s, sp) => ({ y, x: sp[0][0], e: sp[sp.length - 1][3].slice(-1)[0][5], s, b: false, i: false, r: false, c: 0, sp });
const page = { w: 595, h: 842, lines: [
  line(100, 10, [[50, "Parameter", 10, [W(50, "Parameter", 95)]], [200, "Value", 10, [W(200, "Value", 225)]]]),
  line(115, 10, [[50, "μ", 10, [W(50, "μ", 55)]], [200, "0.42", 10, [W(200, "0.42", 216)]]]),
  line(119, 7.5, [[55, "max", 7.5, [W(55, "max", 68)]]]),
  line(130, 10, [[50, "K", 10, [W(50, "K", 57)]], [200, "0.18", 10, [W(200, "0.18", 216)]]]),
  line(200, 10, [[50, "X(t) = X0 e", 10, [W(50, "X(t)", 68), W(71, "=", 77), W(80, "X0", 90), W(93, "e", 98)]]]),
  line(196, 8.5, [[98, "μt", 8.5, [W(98, "μt", 105)]]]),
] };
const [p] = attachScripts([page]);
ok(p.lines.length === 4, "the two script-only lines are gone (6 → 4)");
const mu = p.lines.find((l) => l.y === 115).sp[0];
ok(mu[3].map((w) => w[1]).join() === "μ,max" && mu[3][1][6] === -1, "“max” below μ is its subscript");
const e = p.lines.find((l) => l.y === 200).sp[0];
ok(e[3].slice(-1)[0][1] === "μt" && e[3].slice(-1)[0][6] === 1 && /e\^\(μt\)$/.test(e[1]), "“μt” above e is its superscript (e^(μt))");
const t = pdfLinesToBlocks([page]).filter((b) => b.type === "table");
ok(t.length === 1 && t[0].rows.length === 3, "one table of 3 rows (it was split by the subscript row): " + JSON.stringify(t.map((x) => x.rows)));
// nothing is attached to a word that is not right next to it, or when the piece is full-size text
const far = { w: 595, h: 842, lines: [line(100, 10, [[50, "Hello", 10, [W(50, "Hello", 75)]]]), line(104, 7, [[120, "note", 7, [W(120, "note", 135)]]]), line(112, 10, [[75, "world", 10, [W(75, "world", 100)]]])] };
ok(attachScripts([far])[0].lines.length === 3, "a small piece far from any word's end, or full-size text, stays where it is");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
