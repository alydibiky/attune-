// Unit tests for v5.15: answer recipes (skills.js).
import { skillFor } from "../../web-src/skills.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }
const id = (t) => (skillFor(t) || {}).id || null;

eq(id("Is the robot vacuum 5 pro same as h50 pro"), "compare", "Ali's Gemini example is a comparison");
eq(id("Liebherr LTM 1100 vs Grove GMK5150"), "compare", "X vs Y");
eq(id("ايه الفرق بين الونش التلسكوبي والشبكي؟"), "compare", "Arabic: الفرق بين");
eq(id("How do I set up outriggers on soft ground?"), "steps", "how do I → steps");
eq(id("ازاي اغير زيت الهيدروليك في الونش"), "steps", "Arabic: ازاي");
eq(id("Explain how a hydraulic telescopic boom works"), "explain", "explain");
eq(id("يعني ايه counterweight؟"), "explain", "Arabic: يعني ايه");
eq(id("Write an email to a client asking for the overdue payment"), "email", "write an email");
eq(id("اكتب رسالة للعميل عن التأخير"), "email", "Arabic: اكتب رسالة");
eq(id("Translate into Turkish: we will deliver the crane tomorrow"), "translate", "translate");
eq(id("Suggest 5 names for my crane rental company"), "list", "suggest → list");
eq(id("Make me a 4-week plan to learn Turkish"), "plan", "plan");
eq(id("Summarise this: the crane arrived late and the client refused to pay"), "summary", "summarise");
eq(id("hello"), null, "a greeting gets no recipe");
eq(id("thanks, that's great"), null, "…nor does thanks");
eq(id("x".repeat(2500)), null, "a pasted document gets none");
const b = skillFor("A vs B").block;
eq(b.length < 600 && b.includes("table"), true, "a recipe is short (few tokens) and concrete");
console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
if (fails.length) process.exit(1);
