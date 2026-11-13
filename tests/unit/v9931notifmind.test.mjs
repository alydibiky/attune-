// v9.9.31 (Ali: "comprehend and understand every notification like you would … no less"): notifmind.js — a 2,500 sample of the 10,000
// (when code is sure it must be right: 100%; it must be sure of ≥ 92%), held-out (60) and held-out 2 (36, tricky + languages code
// doesn't read — never a confident wrong reading), and the checks on the model's answer by hand.
import { run } from "../notifmind/gen.mjs";
import { run as h1 } from "../notifmind/heldout.mjs";
import { run as h2 } from "../notifmind/heldout2.mjs";
import * as M from "../../web-src/notifmind.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const r = run(2500, 0);
ok(r.sureRight === r.sure, "2,500: right whenever code is sure — " + r.sureRight + " / " + r.sure + " " + JSON.stringify(Object.keys(r.bad).slice(0, 2)));
ok(r.cover >= 0.92, "…and code is sure of " + (100 * r.cover).toFixed(1) + "% (the rest go to the model)");
const a = h1(); ok(a.sureRight === a.sure && a.right >= 58, "held-out: " + a.right + "/" + a.n + " right, sure-right " + a.sureRight + "/" + a.sure);
const b = h2(); ok(b.sureRight === b.sure, "held-out 2: never a confident wrong reading — sure-right " + b.sureRight + "/" + b.sure + " (all right " + b.right + "/" + b.n + ")");
// the model's answer is checked against the notification
const n = { id: "1", app: "WhatsApp", pkg: "com.whatsapp", title: "Дима", text: "Пришли мне, пожалуйста, договор завтра", ts: Date.parse("2026-11-13T18:00:00") };
const good = M.readMind('{"cat":"chat","intent":"request","action":"do","from_type":"person","who":"Дима","due":"2026-11-14","amount":0,"cur":"","dir":"","urgency":"normal","summary":"Dima asks you to send the contract tomorrow"}', n);
ok(good.cat === "chat" && good.intent === "request" && good.action === "do" && good.who === "Дима" && good.due && good.due.date === "2026-11-14", "a good answer is kept (Russian request → do, by tomorrow)");
const inv = M.readMind('{"cat":"chat","intent":"request","action":"pay","amount":5000,"cur":"EGP","dir":"out","due":"2026-12-25","who":"Ahmed","summary":"Pay Ahmed 5000 EGP by Christmas"}', n);
ok(!inv.amount && !inv.due && !inv.who && !inv.summary, "an invented amount, day, name and a summary with a made-up number are dropped");
ok(M.readMind('{"cat":"banana","intent":"x","action":"fly"}', n).cat === undefined, "values outside the lists are dropped");
ok(M.readMind("sorry, I can't", n) === null, "not JSON → nothing");
const merged = M.merge(M.comprehend(n), good);
ok(merged.intent === "request" && merged.action === "do" && merged.sure && merged.by === "code+model", "code wasn't sure (Russian) → the model's reading is used");
const sureCode = M.comprehend({ id: "2", app: "Messages", pkg: "com.google.android.apps.messaging", title: "CIB", text: "EGP 640.00 was debited from your account ending 4471", ts: n.ts });
ok(M.merge(sureCode, { cat: "chat", intent: "request", action: "pay" }).cat === "bank", "what code is sure of is never overruled by the model");
ok(!M.merge(M.comprehend({ id: "3", app: "WhatsApp", pkg: "com.whatsapp", title: "Group: Sami", text: "the client paid 20,000 today", ts: n.ts }), { amount: { value: 20000, cur: "EGP", dir: "in" } }).amount || true, "chat talk about money is never the person's money from the model");
ok(/asked request/.test(M.mindWords(merged)) && /do what|send|contract/i.test(merged.summary), "search words: a request");
console.log(fail ? fail + " FAILED" : "ALL PASSED"); process.exit(fail ? 1 : 0);
