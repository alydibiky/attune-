// v7.9 (Ali: "Studio report gives an error"): a component that returns early and only then calls a hook breaks React's rule
// (the same hooks, in the same order, on every render) — opening the Studio report showed an error. This scans every page.
import { readFileSync, readdirSync } from "node:fs";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const dir = new URL("../../web-src/", import.meta.url);
export function hooksAfterReturn(src) {
  const out = []; let comp = null, early = 0;
  src.split("\n").forEach((l, i) => {
    const m = /^(export )?(default )?function ([A-Z]\w*)\s*\(/.exec(l);
    if (m) { comp = m[3]; early = 0; return; }
    if (!comp) return;
    if (/^  if \(.*\) \{? ?return\b/.test(l)) early = early || i + 1;
    if (early && /^  ((const|let) .*)?\buse[A-Z]\w*\(/.test(l)) out.push(comp + ":" + (i + 1));
    if (l.startsWith("}")) comp = null;
  });
  return out;
}
ok(hooksAfterReturn("function A() {\n  const [x] = useState(1);\n  if (x) return null;\n  const y = useRef(null);\n}").join() === "A:4", "the scan finds a hook after an early return");
ok(hooksAfterReturn("function A() {\n  const [x] = useState(1);\n  const y = useRef(null);\n  if (x) return null;\n}").length === 0, "hooks above the return are fine");
const bad = readdirSync(dir).filter((f) => f.endsWith(".jsx")).flatMap((f) => hooksAfterReturn(readFileSync(new URL(f, dir), "utf8")).map((x) => f + " " + x));
ok(bad.length === 0, "no page calls a hook after an early return" + (bad.length ? ": " + bad.join(", ") : ""));
console.log(fail ? "FAILED " + fail : "ALL PASSED");
