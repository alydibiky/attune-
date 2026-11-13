// v9.9.30 (Ali, 13 Nov 2026: "I want Attune to understand notifications very well, not keep asking like a stupid … I want it really
// smart"). Before: of 10,000 notifications Attune asked 1,875 questions and left 2,845 cards waiting for a tap. Kept here:
//   · a 2,500 sample of tests/notifs/gen.mjs — every one handled right, nothing wrongly made money, and ZERO interruptions
//   · held-out (heldout.mjs, 60) and held-out 2 (heldout2.mjs, written after the fix, 28) — all right
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { run as held2 } from "../notifs/heldout2.mjs";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const gen = fileURLToPath(new URL("../notifs/gen.mjs", import.meta.url)), hold = fileURLToPath(new URL("../notifs/heldout.mjs", import.meta.url));
const out = execFileSync(process.execPath, [gen, "2500"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const right = /(\d+) notifications, (\d+) handled right/.exec(out), money = /NOT a payment: \*\*(\d+)\*\*/.exec(out), intr = /Interruptions[^*]*\*\*(\d+)\*\*/.exec(out);
ok(right && right[1] === right[2], "2,500 notifications handled right: " + (right ? right[2] + " / " + right[1] : "?"));
ok(money && money[1] === "0", "nothing that is not a payment became money");
ok(intr && intr[1] === "0", "no question and no card waiting for a tap: " + (intr ? intr[1] : "?"));
const h1 = /held-out: (\d+) of (\d+)/.exec(execFileSync(process.execPath, [hold], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
ok(h1 && h1[1] === h1[2], "held-out: " + (h1 ? h1[1] + " / " + h1[2] : "?"));
const h2 = held2(); ok(h2.right === h2.n, "held-out 2 (written after the fix): " + h2.right + " / " + h2.n + (h2.miss.length ? " — " + h2.miss[0] : ""));
console.log(fail ? fail + " FAILED" : "ALL PASSED"); process.exit(fail ? 1 : 0);
