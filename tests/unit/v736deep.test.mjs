// v6.32 Deep answer: one question → the strongest installed model the phone can run at all (also a slow flash-mode one), thinking first.
import { deepModel, deepLine, pickModel } from "../../web-src/router.js";
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) { fails++; process.exitCode = 1; } };
const T = (id, label, extra = {}) => ({ id, tier: { id, label, ...extra } });
const inst = [T("md-lo", "Core Lite", { smoothRam: 6 }), T("md-max", "Core Max", { smoothRam: 12 }), T("moe-xl", "Everest", { smoothRam: 32, flashMin: 12 })];
const d = deepModel(inst, { active: "md-lo", ramGB: 16 });
ok(d.id === "moe-xl" && d.switch && d.slow && d.label === "Everest", "Deep answer moves to Everest even though it only runs slowly from storage: " + JSON.stringify(d));
ok(pickModel("reason", inst, { active: "md-lo", ramGB: 16 }).id !== "moe-xl", "…Auto never picks the slow model by itself");
const s = deepModel([T("md-lo", "Core Lite", { smoothRam: 6 }), T("md", "Core", { smoothRam: 8 })], { active: "md", ramGB: 12 });
ok(s.id === "md" && !s.switch && !s.slow, "the strongest model already loaded stays (no switch, no warning)");
const p = deepModel([T("md-lo", "Core Lite", { vision: true }), T("moe-xl", "Everest", { smoothRam: 32 })], { active: "moe-xl", ramGB: 16, photo: true });
ok(p.id === "md-lo" && p.switch, "a photo goes to the strongest model that sees");
ok(deepModel([], { active: "x" }).switch === false, "nothing installed → keep what is loaded");
ok(/few minutes/.test(deepLine("Everest", true)) && /بضع دقائق/.test(deepLine("Everest", true, true)) && !/minutes/.test(deepLine("Core", false)), "the status line warns only when it will be slow, in English and Arabic");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
