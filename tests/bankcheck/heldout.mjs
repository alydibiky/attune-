// v10.4 the held-out run, written after the fixes: 10,000 more situations with other seeds (another day, other parts, other orders).
import { run } from "./gen.mjs";
let right = 0, total = 0;
for (const s of [7, 8]) { const r = run(5000, s, { quiet: true }); right += r.right; total += r.total; for (const w of r.wrong.slice(0, 5)) console.log("  WRONG", JSON.stringify(w).slice(0, 400)); }
console.log(`bank check held-out: ${right} / ${total} (${(100 * right / total).toFixed(2)} %)`);
