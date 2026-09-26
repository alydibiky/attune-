// Unit tests for v5.23: branded model names and power levels.
import { brandOf, powerFor, setPower, getPower, BRANDS, LEVELS, EXPERT_RULES } from "../../web-src/power.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

eq(brandOf({ id: "xs", label: "Qwen 0.6B", quant: "Q4" }).brand, "Whisper", "the smallest model is Whisper");
eq(brandOf({ id: "moe-xl", label: "Big", quant: "Q4" }).brand, "Maestro", "the biggest is Maestro");
eq(brandOf({ id: "md", label: "Gemma 4B", quant: "Q4_K_M" }).real, "Gemma 4B · Q4_K_M", "the real model is still shown under the name");
eq(new Set(Object.values(BRANDS).map((b) => b.brand)).size, Object.keys(BRANDS).length, "every model has its own name");
eq([brandOf({ id: "new", label: "X", params: "1B" }).level, brandOf({ id: "new", label: "X", params: "14B" }).level, brandOf({ id: "new", label: "X", params: "30B" }).level], [1, 4, 5], "an unknown model gets a level from its size");
eq(brandOf(null).level, 3, "no model → the middle level");
eq(Object.values(LEVELS).map((l) => l.name), ["Basic", "Everyday", "Smart", "Expert", "Master"], "five levels");

const p = [1, 2, 3, 4, 5].map((l) => powerFor(l, 32768));
const up = (k) => p.every((x, i) => i === 0 || x[k] >= p[i - 1][k]);
eq(["maxTokens", "longTokens", "notesChars", "codeTokens", "designTokens", "round2"].every(up), true, "each level can do at least as much as the one below");
eq(p[4].maxTokens >= 3 * p[0].maxTokens && p[4].codeTokens >= 4 * p[0].codeTokens, true, "Master answers are clearly much longer than Basic");
eq([p[2].expert, p[3].expert, p[4].expert, p[3].thinkHard], [false, true, true, true], "Expert and Master get expert rules and think on hard questions");
eq(p[0].round2, 0, "Basic doesn't do a second research round");
eq(powerFor(5, 4096).maxTokens <= 4096 / 3 + 1, true, "a small context window caps the answer (the question isn't pushed out)");
eq(powerFor(5, 4096).codeTokens, 2048, "…and the code budget too");
eq(powerFor(9).level, 5, "levels are clamped");

setPower({ id: "ultra", label: "U", ctx: 32768 });
eq([getPower().level, getPower().expert], [5, true], "the app's active profile follows the chosen model");
setPower({ id: "xs", label: "S", ctx: 4096 });
eq(getPower().expert, false, "…and back down");
eq(/edge cases/.test(EXPERT_RULES) && /calculations/.test(EXPERT_RULES), true, "expert rules ask for edge cases and full calculations");

console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
if (fails.length) process.exit(1);
