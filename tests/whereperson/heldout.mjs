// v10.6 held-out, written after the fixes: 10,000 more with other seeds.
import { run } from "./gen.mjs";
let right = 0, total = 0;
for (const s of [21, 22]) { const r = run(5000, s, { quiet: true }); right += r.right; total += r.total; for (const w of r.wrong.slice(0, 6)) console.log("  WRONG", JSON.stringify(w)); }
console.log(`where is a person held-out: ${right} / ${total} (${(100 * right / total).toFixed(2)} %)`);
