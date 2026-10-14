// v6.28 device levels: memory and cores → what the device offers (models, Studio, effects, the tool list). Nothing is locked.
import * as V from "../../web-src/device.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const ph = (ram, cores = 8, bigCores) => V.deviceLevel({ platform: "mobile", ram, cores, bigCores });
ok(ph(4).level === 1 && ph(6).level === 2 && ph(8).level === 3 && ph(12).level === 4 && ph(16).level === 4, "4 / 6 / 8 / 12 GB phones → levels 1 / 2 / 3 / 4");
ok(V.deviceLevel({ platform: "desktop", ram: 8 }).level === 5 && V.deviceLevel({}).level === 5, "a computer is level 5 (and an unknown device is never cut down)");
ok(ph(12, 4).level === 3 && ph(8, 8, 1).level === 2 && ph(4, 4).level === 1, "few cores → one level down (never below 1)");
ok(ph(4).lite && ph(4).hide.includes("studio") && !ph(6).lite && !ph(6).hide.length, "a light phone: no Studio, lighter effects; the others keep everything");
ok(V.modelFits(ph(4), "sm") && !V.modelFits(ph(4), "md") && V.modelFits(ph(12), "max") && !V.modelFits(ph(12), "ultra") && V.modelFits(V.LEVELS[5], "moe-xl"), "models offered up to each level's biggest");
ok(V.modelFits(ph(4), "brand-new-model"), "an unknown (new) model is never hidden by mistake");
const G = [["Mind", ["coach", "learn"]], ["Create", ["studio", "code"]], ["Pics", ["studio"]]];
ok(JSON.stringify(V.groupsFor(G, ph(4))) === JSON.stringify([["Mind", ["coach", "learn"]], ["Create", ["code"]]]), "the tool list on a light phone leaves Studio out (and a group left empty)");
ok(V.groupsFor(G, ph(4), true).length === 3 && V.groupsFor(G, ph(8)).length === 3, "“Show every tool anyway” brings it back; stronger devices list everything");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
