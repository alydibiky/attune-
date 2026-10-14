// v6.28 Studio with the strong models (Zenith, Zenith+): their thinking never reaches the picture model, and they get time to
// write the description (at 45 s a phone's 12B ran out, and the raw — often Arabic — idea was drawn instead).
import { cleanPrompt, enhanceWaitMs } from "../../web-src/studio.js";
import { powerFor } from "../../web-src/power.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const D = "A golden retriever puppy running across a sunlit meadow at dusk, warm backlight, shallow depth of field, photorealistic";
ok(cleanPrompt("<think>The user wants a dog…</think>\n" + D, "x") === D, "Qwen's closed <think> is removed");
ok(cleanPrompt("<think>The user wants a dog, I should describe the meadow and", "كلب") === "كلب", "a think that never closed (out of tokens) → the idea, never the thinking");
ok(cleanPrompt("<|channel>thought\nPlanning the scene…<channel|>" + D, "x") === D, "Gemma 4's thought channel is removed");
ok(cleanPrompt("<|channel|>analysis<|message|>We need 40-70 words.<|end|><|start|>assistant<|channel|>final<|message|>" + D, "x") === D, "gpt-oss's analysis channel is removed, the final kept");
ok(cleanPrompt("Here is the description: \"" + D + "\"", "x") === D, "a preface and quotes are still removed");
ok(enhanceWaitMs(powerFor(4)) === 120000 && enhanceWaitMs(powerFor(5)) === 120000 && enhanceWaitMs(powerFor(2)) === 45000, "Zenith and above get 2 minutes for the description; small models keep 45 s");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
