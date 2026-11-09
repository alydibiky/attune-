// v9.9.3 Ali picked L1–L4 (9 Nov): teach Attune from notifications — "Nada is my wife", rules by talking, asks once, uses it
import assert from "node:assert/strict";
import * as T from "../../web-src/noteteach.js";
import { emptyDir, addCard } from "../../web-src/entities.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS " + m); };
const NOW = Date.parse("2026-11-09T12:00:00"), H = 36e5;
const life = (title, text, ago = 1) => ({ id: String(Math.random()), app: "Life360", pkg: "com.life360.android.safetymapd", title, text, ts: NOW - ago * H });
let dir = emptyDir(), teach = T.emptyTeach();

// L1
let x = T.readTeach("Nada is my wife", dir);
ok(x && x.kind === "who" && x.name === "Nada" && x.role === "wife", "“Nada is my wife” → Nada = wife");
ok(T.readTeach("نادا مراتي", dir).name === "نادا" && T.readTeach("نادا تبقى مراتي", dir).role === "wife", "«نادا مراتي» / «نادا تبقى مراتي» → wife");
x = T.readTeach("she's my wife", dir, { name: "Nada" });
ok(x.kind === "who" && x.name === "Nada", "on Nada's notification, “she's my wife” → Nada (the notification's person)");
ok(T.readTeach("this is my wife", dir).kind === "ask", "“this is my wife” with no person → asks who (never a guess)");
ok(T.readTeach("Ahmed is my brother", dir).role === "brother" && T.readTeach("Karim = boss", dir).role === "boss", "“Ahmed is my brother”, “Karim = boss”");
ok(T.readTeach("who is my wife?", dir) === null, "a question is not teaching");
ok(T.understood(T.readTeach("Nada is my wife", dir)) === "Nada = your wife", "what is shown before saving: “Nada = your wife”");
let r = T.applyTeach(T.readTeach("Nada is my wife", dir), { dir, teach, now: NOW });
dir = r.dir; teach = r.teach;
ok(dir.items.length === 1 && dir.items[0].name === "Nada" && dir.items[0].role === "wife", "saved on Nada's People card (role wife) — the card Chat and “Which Ahmed?” use");
r = T.applyTeach(T.readTeach("Nada is my wife", dir), { dir, teach, now: NOW + 1 });
ok(r.dir.items.length === 1, "said again → the same card, not a second Nada");

// L4
const drive = life("Nada", "🏁 Completed a 13km drive");
const d = T.describe(drive, dir);
ok(d && d.line === "Your wife (Nada) · Completed a 13km drive", "Life360 “Nada · Completed a 13km drive” → “Your wife (Nada) · Completed a 13km drive”");
ok(T.describe(life("Karim", "Arrived at Work"), dir) === null, "someone you didn't teach about stays as it was");
const w = T.whereIs("where's my wife?", [drive, life("Nada", "Arrived at Home", 0.5)], dir);
ok(w && w.person.name === "Nada" && /Home/.test(w.note.text), "Chat: “where's my wife?” → the newest Life360 note: Arrived at Home");
ok(T.whereIs("مراتي فين", [drive], dir).person.name === "Nada", "«مراتي فين» works too");

// L2
x = T.readTeach("tell me when my wife gets home", dir);
ok(x.kind === "rule" && x.rule.kind === "arrive" && x.rule.who === "Nada" && x.rule.place === "Home", "“tell me when my wife gets home” → an arrival rule for Nada at Home");
ok(T.understood(x) === "I'll tell you when Nada arrives — Home", "shown first: I'll tell you when Nada arrives — Home");
r = T.applyTeach(x, { dir, teach, now: NOW });
ok(r.watch && r.watch.who[0] === "Nada" && r.watch.app === "pkgs:com.life360.android.safetymapd" && r.watch.words.some((w) => /arrived/.test(w)), "it becomes a phone alert on Life360 (works with Attune closed)");
ok(T.readTeach("tell me when my husband gets home", dir).kind === "ask", "“…my husband…” but no husband taught → asks who, doesn't guess");
x = T.readTeach("never show Yazio", dir);
ok(x.kind === "rule" && x.rule.kind === "hide" && x.rule.app === "yazio", "“never show Yazio” → hide Yazio");
teach = T.applyTeach(x, { dir, teach, now: NOW }).teach;
ok(T.isHidden({ app: "Yazio", pkg: "com.yazio.android" }, teach) && !T.isHidden({ app: "Life360" }, teach), "Yazio is hidden, Life360 is not");
ok(T.readTeach("قولي لما مراتي توصل البيت", dir).rule.who === "Nada", "«قولي لما مراتي توصل البيت» → the same arrival rule");

// L3
const notes = [life("Sara", "Arrived at Work", 2), life("Sara", "Left Work", 20), life("Sara", "Completed a 5km drive", 40), life("Nada", "Arrived at Home", 3), life("Nada", "x", 4), life("Nada", "y", 5)];
let q = T.whoAsk(notes, dir, teach, NOW);
ok(q && q.name === "Sara", "Sara seen 3 times this week, never taught → Attune asks once “Who is Sara?” (Nada is known)");
teach = T.skipAsk(teach, "Sara");
ok(T.whoAsk(notes, dir, teach, NOW) === null, "Skip → never asked again");
ok(T.whoAsk([life("Ali", "a"), life("Ali", "b")], emptyDir(), T.emptyTeach(), NOW) === null, "seen twice → not asked yet");
console.log("ALL PASSED v993noteteach (" + n + " checks)");
