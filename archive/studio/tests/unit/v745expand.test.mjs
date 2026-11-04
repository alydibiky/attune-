// v6.45 Expand (outpaint) in the photo editor: the bigger canvas and where the photo sits on it.
import { expandBox, EXPAND_SHAPES } from "../../web-src/photoedit.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const j = (o) => [o.W, o.H, o.x, o.y].join();
ok(j(expandBox(1000, 800, "all")) === "1500,1200,250,200", "all round: +25 % each side, the photo centred");
ok(j(expandBox(1000, 800, "wide")) === "1500,800,250,0" && j(expandBox(1000, 800, "tall")) === "1000,1200,0,200", "wider / taller: +50 % one way");
ok(j(expandBox(1000, 800, "1:1")) === "1000,1000,0,100", "square from landscape: taller");
ok(j(expandBox(1080, 1920, "16:9")) === "1728,1920,324,0", "16:9 from a portrait: wider, but never more than 1.6×");
ok(expandBox(1000, 1000, "1:1").same && !expandBox(1000, 1000, "all").same, "already that shape → nothing to do");
ok(EXPAND_SHAPES.length === 7 && EXPAND_SHAPES.every((s) => { const b = expandBox(640, 480, s); return b.W >= 640 && b.H >= 480; }), "every shape only grows the canvas");
let threw = false; try { expandBox(10, 10, "x:y"); } catch (e) { threw = true; } ok(threw, "an unknown shape is refused");
