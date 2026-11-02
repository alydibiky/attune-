// v9.0 (Ali: "I want all the languages to be correct and accurate — make sure"): every interface language passes the audit —
// placeholders kept, the language's own script, nothing left in English, Egyptian and Standard Arabic not mixed (tools/i18n/audit.mjs).
import { execFileSync } from "child_process";
let out = "", ok = true;
try { out = execFileSync("node", [new URL("../../tools/i18n/audit.mjs", import.meta.url).pathname], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { ok = false; out = String(e.stdout || e.message); }
if (!ok) console.log("FAIL the language audit found problems:\n" + out.split("\n").filter((l) => / — |^== /.test(l)).slice(0, 40).join("\n"));
console.log(ok ? "PASS v907i18naudit: all 20 languages pass the audit" : "1 FAILED");
