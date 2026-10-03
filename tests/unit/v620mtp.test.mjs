// v6.20 — faster writing (MTP): every catalogue entry marked mtp points at a "-MTP-GGUF" repo, and
// every Qwen 3.5 llama.cpp entry is marked; the Kotlin side finds MTP builds by that repo name
// (it ends up in the install's "source"), reads the three-way setting, and keeps a safety net.
import fs from "fs";
const rd = (p) => fs.readFileSync(new URL("../../" + p, import.meta.url), "utf8");
let bad = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
const src = rd("web-src/attune.jsx").split("\n");
const a = src.findIndex((l) => l.startsWith("const MODEL_TIERS"));
const b = src.findIndex((l, i) => i > a && /^\];/.test(l));
const TIERS = new Function(src.slice(a, b + 1).join("\n").replace("const MODEL_TIERS =", "return"))();

const marked = TIERS.filter((t) => t.mtp);
ok(marked.length === 7, "six Qwen 3.5 entries and Everest XL are MTP builds (got " + marked.length + ")");
for (const t of marked) {
  const m = /^unsloth\/Qwen3\.([56])-([0-9.]+B(?:-A3B)?)-MTP-GGUF$/.exec(t.repo || "");
  ok(!!m && t.realName.startsWith("Qwen3." + m[1] + " " + m[2]), t.label + ": repo " + t.repo + " matches " + t.realName);
  ok(/^(UD-)?(IQ|Q)\d/.test(t.quant) && !t.url, t.label + ": quant " + t.quant + " resolved by name in the repo");
}
for (const t of TIERS) if (/Qwen3\.5-/.test(t.repo || "")) ok(t.mtp === true, t.label + " (" + t.realName + ") is marked mtp");
for (const t of TIERS) if (!t.mtp && t.repo) ok(!/-MTP-/.test(t.repo), t.label + ": unmarked entries do not use an MTP repo");

const eng = rd("app/src/main/java/com/aldibiki/attune/Engine.kt");
ok(eng.includes('"--spec-type", "draft-mtp", "--spec-draft-n-max", "3", "--spec-draft-p-min", "0.5"'), "Engine adds the three MTP flags");
ok(/fun hasMtp/.test(eng) && eng.includes('"-MTP-"'), "Engine detects MTP builds by repo name");
ok(/setMtpBad/.test(eng) && /startBlocking\(ctx, model, forceCpu, true\)/.test(eng), "Engine restarts once without MTP and remembers it");
ok(/if \(mtpFor\(ctx, model\)\) return null/.test(eng), "the 0.8B helper is not combined with MTP");
const nb = rd("app/src/main/java/com/aldibiki/attune/NativeBridge.kt");
ok(nb.includes('-MTP-GGUF", "-GGUF"'), "install falls back to the standard repo when the MTP file is missing");
ok(nb.includes('a.has("mtp")'), "setSpeed accepts the mtp setting");
const ar = rd("web-src/i18n-ar.js");
for (const k of ["Faster writing (MTP)", "Same answers, faster for code, tables, JSON, emails and summaries; roughly the same or slightly slower for free-form explanations."])
  ok(ar.includes('"' + k + '":'), "Arabic string for: " + k.slice(0, 40));
const sui = rd("web-src/speed-ui.jsx");
ok(!sui.includes("installDraft}"), "the helper-model download button is gone from the UI");
console.log(bad ? "FAILED" : "ALL PASSED"); process.exit(bad ? 1 : 0);
