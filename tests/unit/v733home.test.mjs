// v6.29 Home (Ali picked A + "What's waiting"): one card with all that waits, and a live line under each recent tool.
import { waitingList, toolLine } from "../../web-src/home.js";
import * as D from "../../web-src/daily.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const now = new Date(2026, 9, 15, 10, 0).getTime(), DAY = 86400000;
const scout = { goals: [{ id: "a", text: "flat", g: { what: "a flat in Maadi" }, unseen: ["x1", "x2"] }, { id: "b", g: { what: "a car" }, unseen: [] }] };
let c = D.readyCourse("turkish"); c = D.addLesson(c, 0, { body: "x".repeat(100), visual: null, keyPoints: ["ç: ch"] }, { now: now - 2 * DAY }); c = D.markDone(c, 0, now - 2 * DAY);
const care = { members: [{ id: "me", name: "Me" }], meds: [{ id: "m1", member: "me", name: "Lantus", dose: "20 units", times: ["09:00"], start: "2026-09-01", stock: 20, stockAt: now - DAY }], taken: {} };
const w = waitingList({ scout, courses: [c], care, life: { items: [] }, ledger: null, radar: { items: [] }, now });
const t = w.map((x) => x.title).join(" | ");
ok(/2 new finds: a flat in Maadi/.test(t), "new Scout finds wait on Home: " + t);
ok(/1 card to review · lesson 2 — Turkish/.test(t), "the card to review and today's lesson wait on Home");
ok(!/a car/.test(t), "a goal with nothing new isn't listed");
ok(toolLine("scout", { scout }) === "2 new finds" && toolLine("scout", { scout: { goals: [{ unseen: [] }] } }) === "1 goal watched", "Scout's line: new finds, else the goals watched");
ok(/Review 1 card · Lesson 2/.test(toolLine("learn", { courses: [c], now })), "Learn daily's line: " + toolLine("learn", { courses: [c], now }));
ok(toolLine("slides", { slides: [{ title: "Fleet pitch" }] }) === "Fleet pitch" && toolLine("convert", {}) === "", "Slides: the last deck; a tool with nothing to say → its own description is shown");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
