// v10.3 (Ali, 17 Nov 2026: picked K1 — "I want the calendar to look very good" — and OK-G1 OK-G2 OK-G3): the week calendar in the
// middle of the computer's Home, and the glass look (dark glass, light glass in the phone's colours; a choice on the phone).
import { execFileSync } from "child_process";
import fs from "fs";
import * as W from "../../web-src/weekcal.js";
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
// his week (the mock-up he picked): Tue 17 Nov 2026, the week starts on Saturday in Egypt — here Monday as on the mock-up
const now = new Date("2026-11-17T19:24:00").getTime(), at = (d, h, m = 0) => new Date(d + "T00:00:00").getTime() + h * 3600e3 + m * 60e3;
const tl = [
  { id: "r1", date: "2026-11-17", time: at("2026-11-17", 18), kind: "reminder", what: "Call back Mama", page: "reminders" },
  { id: "r2", date: "2026-11-19", time: at("2026-11-19", 20, 30), kind: "reminder", what: "عيد ميلاد  نودي", page: "reminders" },
  { id: "p1", date: "2026-11-17", kind: "collect", what: "Sheikh · 3 of 8", amount: 2500, cur: "EGP", page: "life" },
  { id: "b1", date: "2026-11-18", kind: "bill", what: "CIB card bill", amount: 4320, cur: "EGP", page: "money" },
  { id: "d1", date: "2026-11-20", kind: "other", what: "FreeClip 2 arrives", amount: 0, page: "radar" },
  { id: "x", date: "2026-11-30", kind: "bill", what: "next month", amount: 10, page: "money" },
];
const txns = [{ id: "t1", date: "2026-11-16", type: "expense", amount: 800, note: "FACES", ts: at("2026-11-16", 17, 6) },
  { id: "t2", date: "2026-11-17", type: "expense", amount: 1160, note: "CIB transfer", ts: at("2026-11-17", 13, 56) },
  { id: "t3", date: "2026-11-19", type: "expense", amount: 99, note: "a payment dated in the future" }];
const wk = W.weekOf({ timeline: tl, txns, projects: [{ id: "f", name: "Flat", date: "2026-11-19", text: "order tiles" }], trip: { depart: "2026-11-21", ret: "2026-11-23", to: "Umrah · Makkah" }, now, startDay: 1 });
ok(wk.days[0] === "2026-11-16" && wk.days[6] === "2026-11-22" && wk.today === 1, "Mon 16 – Sun 22, today Tue: " + wk.days.join());
const T = (id) => wk.timed.find((x) => x.id === id), A = (id) => wk.allday.find((x) => x.id === id);
ok(T("r1") && T("r1").h === 18 && T("r1").kind === "people", "«Call back Mama» at 18:00, a people thing");
ok(T("r2") && T("r2").kind === "people" && T("r2").day === 3, "Noudy's birthday (written with a double space) is a people thing on Thursday");
ok(T("m:t1") && Math.abs(T("m:t1").h - 17.1) < 0.01 && T("m:t1").sign === "−", "FACES −800 at 17:06 on Monday");
ok(A("p1") && A("p1").sign === "+" && A("p1").kind === "money", "Sheikh's 2,500 is money coming in (+), all day");
ok(A("b1") && A("b1").sign === "−", "the CIB card bill goes out (−)");
ok(!wk.allday.some((x) => x.id === "x") && !wk.timed.some((x) => x.id === "x"), "next month's bill is not on this week");
ok(!wk.timed.some((x) => x.id === "m:t3") && !wk.allday.some((x) => x.id === "m:t3"), "a payment dated in the future is never drawn as paid");
const trip = A("trip"); ok(trip && trip.d0 === 5 && trip.d1 === 6 && trip.kind === "trip", "the Umrah trip: one bar Sat → Sun (cut at the week's end)");
ok(A("p:f") && A("p:f").kind === "work", "the Flat project's date is a project thing");
ok(W.nowLine(wk, now) > 19.3 && W.nowLine(wk, now) < 19.5, "the now line at 19:24 on today");
ok(W.weekStartOf(now, 6) === "2026-11-14" && W.weekStartOf(now, 0) === "2026-11-15", "the week starts on the country's day (Sat in Egypt, Sun elsewhere)");
// three things at 9:00 on one day → side by side
const busy = W.weekOf({ timeline: [0, 1, 2].map((i) => ({ id: "b" + i, date: "2026-11-17", time: at("2026-11-17", 9), kind: "reminder", what: "x" + i })), now, startDay: 1 });
ok(busy.timed.every((x) => x.cols === 3) && new Set(busy.timed.map((x) => x.col)).size === 3, "three things at 9:00 sit side by side, not on top of each other");
// very early → the hours grow to show it
ok(W.weekOf({ timeline: [{ id: "e", date: "2026-11-17", time: at("2026-11-17", 5, 30), kind: "reminder", what: "Fajr" }], now, startDay: 1 }).h0 === 5, "a 5:30 reminder widens the day to 5:00");
// (Ali's screens: a 00:05 payment made the grid a whole day tall; a 23:50 reminder hung under it)
{ const w2 = W.weekOf({ timeline: [{ id: "late", date: "2026-11-17", time: at("2026-11-17", 23, 50), kind: "reminder", what: "Call back Mama" }], txns: [{ id: "e", date: "2026-11-17", type: "expense", amount: 5, note: "x", ts: at("2026-11-17", 0, 5) }], now, startDay: 1 });
  const L = w2.timed.find((x) => x.id === "late");
  ok(Math.abs((w2.h1 - w2.h0) * w2.pxh - 360) < 1e-6, "the grid keeps one height (360 px) even for a whole day");
  ok(L.y1 <= w2.h1 + 1e-9 && (L.y1 - L.y0) * w2.pxh >= 40 - 1e-6, "the 23:50 box ends inside the day and is big enough to read"); }
// a full lane → "+N more", nothing lost
const many = W.weekOf({ timeline: [0, 1, 2, 3, 4].map((i) => ({ id: "m" + i, date: "2026-11-18", kind: "bill", what: "bill " + i, amount: 10 + i })), now, startDay: 1, maxRows: 3 });
ok(many.allday.length === 3 && many.more[2] === 2, "five bills on Wednesday: three shown, «+2 more»");
// ---- the 10,000 composed weeks (HARD), a 2,500 sample kept above its mark ----
{ const out = execFileSync("node", [new URL("../weekcal/gen.mjs", import.meta.url).pathname, "2500"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const m = out.match(/drawn right \(([\d.]+)%\) — (\d+) different shapes \[(\d+) of 100\]/);
  ok(m && +m[1] >= 99.5, "2,500 hard weeks drawn right ≥ 99.5%: " + out.split("\n")[0]);
  ok(m && +m[3] >= 60, "≥ 60 of 100 different shapes: " + (m && m[3])); }
// ---- the glass look ----
globalThis.matchMedia = (q) => ({ matches: /dark/.test(q) ? true : /min-width/.test(q) ? globalThis.__wide : false });
const S = await import("../../web-src/spaces.js");
const dark = S.glassVars({ accent: "burgundy", bg: "auto", look: "glass" }), light = S.glassVars({ accent: "burgundy", bg: "light", look: "glass" });
ok(!dark.light && /#4A1A2E/.test(dark.page) && dark.vars["--c-acc"] === "#E58AA2", "dark glass: the burgundy-to-black ground, the pink accent (G1)");
ok(light.light && /#F9E6EC/.test(light.page) && light.vars["--c-acc"] === "#7A1F3D" && /#F5F4F2/.test(light.page), "light glass in the phone's colours: warm grey, burgundy, soft pink (G2)");
ok(S.calmCss({ accent: "burgundy", bg: "light", look: "glass" }).includes("att-glass") && !S.calmCss({ accent: "burgundy", bg: "light", look: "plain" }).includes("att-glass"), "glass only when the look is Glass");
ok(S.glassCss({ accent: "teal", bg: "slate" }).includes('[class*="bg-black/"] .calm'), "a sheet over a dim backdrop keeps solid colours (readable)");
globalThis.__wide = true; ok(S.defaultLook() === "glass", "a computer wears glass by default");
globalThis.__wide = false; ok(S.defaultLook() === "plain", "a phone stays plain by default — glass is its choice in Theme (G3)");
const css = fs.readFileSync(new URL("../../web-src/build/tw.css", import.meta.url), "utf8");
ok(/html\.att-glass\.att-glass-blur[^{]*\{[^}]*backdrop-filter/.test(css) && !/html\.att-glass \.calm \.c-card[^{]*\{[^}]*backdrop-filter/.test(css), "real blur only on a computer (att-glass-blur); the phone has none (G3)");
const ui = fs.readFileSync(new URL("../../web-src/spaces-ui.jsx", import.meta.url), "utf8");
ok(ui.includes('[["plain", "Plain"], ["glass", "Glass"]]') && ui.includes('"look-" + id'), "Settings → Theme has Plain / Glass");
// every new line in all 20 languages
const src = fs.readFileSync(new URL("../../web-src/weekcal-ui.jsx", import.meta.url), "utf8") + ui;
const lines = [...new Set([...src.matchAll(/tr\("([^"]+)"/g)].map((m) => m[1]).concat(["Day", "Week", "Month", "Plain", "Glass", "Money", "People", "Home & orders", "Projects", "Trips"]))];
for (const id of ["ar", "arb", "es", "fr", "de", "pt", "it", "ru", "tr", "id", "hi", "ur", "fa", "bn", "sw", "th", "vi", "zh", "ja", "ko"]) {
  const f = fs.readFileSync(new URL(`../../web-src/i18n-${id}.js`, import.meta.url), "utf8");
  const miss = lines.filter((l) => !f.includes(JSON.stringify(l)) && !f.includes("'" + l + "'"));
  ok(!miss.length, `${id}: every calendar / glass line translated — missing: ${miss.slice(0, 4).join(" | ")}`);
}
console.log(fail ? `${fail} of ${n} FAILED` : `PASS ${n}`);
