// v6.12 — Auto: the model, the web and thinking chosen per question.
const R = await import("../../web-src/router.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
ok(R.taskOf("Write a Python function that returns VAT-inclusive price with tests") === "code", "code");
ok(R.taskOf("3 cranes × 4 days × 12,500 EGP a day + 14% VAT — total?") === "math", "maths");
ok(R.taskOf("A, B, C, D sit around a round table; who is opposite B? Solve this puzzle step by step") === "reason", "reasoning");
ok(R.taskOf("hi, how are you?") === "quick" && R.taskOf("x", { photo: true }) === "photo", "quick and photo");
ok(R.wantsWeb("Lynk & Co 900 all trims and prices in Egypt") && R.wantsWeb("سعر الدولار النهارده") && R.wantsWeb("Who won the match yesterday?"), "fresh facts → web");
ok(!R.wantsWeb("Explain how a counterbalance valve works") && !R.wantsWeb("Write an email to my client about the late invoice price") && !R.wantsWeb("What are my expenses this month") && !R.wantsWeb("3 × 12,500 EGP price total?"), "knowledge, writing, personal data, maths → no web");
ok(R.wantsThink("solve this riddle: what gets smaller every time it takes a bath?") && !R.wantsThink("hi there") && !R.wantsThink("solve 2+2", "math", false), "thinking for puzzles/maths, never on a model that can't think");
const T = (id, smoothRam, vision = true, engine) => ({ id, tier: { id, smoothRam, vision, engine } });
const inst = [T("fast-e4b", 12, true, "litert"), T("xl", 12, true), T("sm", 6, true), T("moe-xl", 32, false)];
let p = R.pickModel("quick", inst, { active: "fast-e4b", ramGB: 16 });
ok(!p.switch && p.id === "fast-e4b", "a quick question keeps the loaded model (no 10–30 s switch)");
p = R.pickModel("code", inst, { active: "fast-e4b", ramGB: 16 });
ok(p.switch && p.id === "xl", "code moves to the strongest model that runs smoothly on 16 GB (Zenith; Everest needs 32)");
p = R.pickModel("code", inst, { active: "xl", ramGB: 16 });
ok(!p.switch, "already on the best → stays");
p = R.pickModel("photo", [T("moe-xl", 12, false), T("sm", 6, true)], { active: "moe-xl", ramGB: 16 });
ok(p.switch && p.id === "sm", "a photo needs a model that sees");
p = R.pickModel("reason", [T("fast-e4b", 12, true, "litert"), T("md", 8)], { active: "fast-e4b", ramGB: 16 });
ok(!p.switch, "a model barely better (< 1 step) is not worth a switch");
ok(/Zenith/.test(R.switchLine("Zenith", "code")) && /زينث|Zenith/.test(R.switchLine("Zenith", "code", true)), "the switch is announced");
// v6.18: a bare product / model name is a lookup (Ali: "Lynk and co 900" answered from the packs, no web)
for (const t of ["Lynk and co 900", "Lynk & Co 900?", "iPhone 17 Pro Max", "BYD Seal 06", "Galaxy S25 Ultra", "Chery Tiggo 8 Pro", "Liebherr LTM 1100", "شيري تيجو 8"])
  ok(R.wantsWeb(t), "Auto searches the web for a product name: " + t);
for (const t of ["give me 5", "top 10", "chapter 3", "what is 25 * 4", "page 12", "hello there", "I have 2 cats", "remind me in 10", "Day 3", "write a poem about 2 cats"])
  ok(!R.wantsWeb(t), "…but not for: " + t);
console.log(fail ? `${fail} FAILED` : "ALL PASSED");
