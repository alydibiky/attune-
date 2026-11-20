// v10.8 problem reports (CR3; OK-CR: "I don't want users to see the problem — they just send it"), phone and computer.
import fs from "fs"; import os from "os"; import path from "path"; import { createRequire } from "module";
const require = createRequire(import.meta.url);
const K = (f) => fs.readFileSync(new URL("../../app/src/main/java/com/aldibiki/attune/" + f, import.meta.url), "utf8");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const cl = K("CrashLog.kt"), ma = K("MainActivity.kt"), ew = K("ExitWatch.kt"), nb = K("NativeBridge.kt");
ok(/CrashLog\.add\(this, "closed by itself"[\s\S]{0,300}pending = true\)/.test(ma), "phone: a crash on the screen thread is kept, and Home asks once");
ok(/CrashLog\.add\(ctx, "closed by itself"[\s\S]{0,200}pending = true\)/.test(ew) && /optBoolean\("fg"\)/.test(ew), "phone: Android's reason is kept only when Attune was on screen");
ok(["crashState", "crashNote", "crashPage", "crashDismiss", "crashSend"].every((m) => new RegExp("fun " + m + "\\(").test(nb)), "phone: the page's five calls");
ok(/ACTION_SEND/.test(nb.slice(nb.indexOf("fun crashSend"), nb.indexOf("fun crashSend") + 900)) && !/http|URL\(/.test(cl), "phone: Send = the share sheet; nothing is sent by itself");
ok(/take\(30\)|length\(\) - 30/.test(cl) && !/ledger|notes|recall|contacts/i.test(cl.replace(/\/\*[\s\S]*?\*\//, "")), "phone: the newest 30, no messages / money / people in the report");
// the computer
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "crash-")), C = require("../../desktop/lib/crashlog.js")(dir, "10.8");
ok(JSON.parse(C.state()).count === 0, "computer: empty at first");
C.page("money"); C.add("closed by itself", "the window stopped: crashed", true); C.note("home", "TypeError: x");
const st = JSON.parse(C.state()); ok(st.pending && st.count === 2, "computer: a crash asks once; page errors are kept");
const r = C.report(); ok(/Attune problem report/.test(r) && /on money/.test(r) && /TypeError/.test(r), "computer: the report has the version, the page and the lines");
C.dismiss(); ok(!JSON.parse(C.state()).pending, "computer: Not now / Send → asked no more");
for (let i = 0; i < 40; i++) C.add("page error", "e" + i); ok(JSON.parse(C.state()).count === 30, "computer: the newest 30");
const ui = fs.readFileSync(new URL("../../web-src/crash-ui.jsx", import.meta.url), "utf8");
ok(!/crashReport|\.text\b|stack/.test(ui.replace(/\/\*[\s\S]*?\*\//, "")), "the page never reads or shows the problem itself");
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`); process.exit(fail ? 1 : 0);
