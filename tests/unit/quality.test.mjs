// Unit tests for web-src/quality.js — loop detection and readable math.
import { detectLoop, trimLoop, mathToText } from "../../web-src/quality.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

// Ali's real answer (25 Sep): the "(Correction: …)" loop and 60.666…
const corr = "Let d be the distance.\n1. t = d/30\n" + Array(5).fill("    (Correction: $\\frac{2}{60} - \\frac{1}{30} = \\frac{1}{30} - \\frac{1}{30}$ is incorrect. Let's redo step 6.)\n    $60.6666... + \\frac{1}{x} = 0.3333...$").join("\n");
const r1 = detectLoop(corr);
eq(r1.loop, true, "a model correcting itself the same way again and again is a loop");
eq((trimLoop(corr, r1.cut).match(/Correction/g) || []).length, 1, "…and the answer is cut after the first one");
const six = "The required average speed of 60." + "6".repeat(400);
const r2 = detectLoop(six);
eq([r2.loop, trimLoop(six, r2.cut).length < 60], [true, true], "60.6666… for a page is a loop, cut short");
const rep = "Intro text that is long enough to count here.\n" + "the marble is on the counter. ".repeat(4);
eq(detectLoop(rep).loop, true, "a sentence repeated back to back at the end is a loop");
const fine = "1. Place the marble.\n2. Turn the glass.\n3. Carry it.\n4. The marble stays on the counter.\n| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n".repeat(1);
eq(detectLoop(fine).loop, false, "a normal list and a table are not loops");
const code = "```python\nclass A:\n    def get(self, i):\n        return self.h[i]\n    def set(self, i, v):\n        self.h[i] = v\n```\n" + "x = 1\n".repeat(3);
eq(detectLoop(code).loop, false, "short repeated code lines are not loops");

const table = "Capacities:\n| Crane | Capacity | Radius |\n|---|---|---|\n" + [1,2,3,4,5,6].map((i) => `| Liebherr LTM 10${i}0 | ${i*10} t at 10 m | ${i*5} m |`).join("\n");
eq(detectLoop(table).loop, false, "a table whose rows differ only in numbers is not a loop");
const steps = [1,2,3,4].map((i) => `Step ${i}: add the counterweight block number ${i} to the frame.`).join("\n");
eq(detectLoop(steps).loop, false, "numbered steps that look alike are not a loop");
eq(detectLoop("A wide table follows so the reader can compare everything.\n|" + "-".repeat(90) + "|\n| a |").loop, false, "a long |-----| separator is not a loop");
// math
eq(mathToText("$t_{AB} = \\frac{d}{30}$ hours"), "t_AB = d/30 hours", "\\frac and subscripts become plain text");
eq(mathToText("$60 \\left( \\frac{1}{30} + \\frac{1}{x} \\right) = 2$"), "60 ( 1/30 + 1/x ) = 2", "\\left/\\right vanish");
eq(mathToText("Average $= \\frac{\\text{Total Distance}}{\\text{Total Time}}$"), "Average = (Total Distance)/(Total Time)", "\\text{} inside fractions");
eq(mathToText("$x^2 + y^{10} \\times 3 \\neq 5$"), "x² + y¹⁰ × 3 ≠ 5", "powers, × and ≠");
eq(mathToText("$$\\sqrt{2d}$$"), "\n√(2d)\n", "display math on its own line, √");
eq(mathToText("It costs $5 and $10 later"), "It costs $5 and $10 later", "money with $ is left alone");
eq(mathToText("`$x = 1$` in code"), "`$x = 1$` in code", "code is left alone");
console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
process.exit(fails.length ? 1 : 0);
