// v10.9.3 — Ali's OK-BK (23 Nov 2026): "Read from your messages" (every saved message + where it went), the live line on Money (BK2),
// the "stopped reading" notification (BK3). Logic: web-src/readlog.js; the phone side: ReadWatch.kt (same rule).
import fs from "fs";
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const ok = (c, t) => { console.log((c ? "PASS " : "FAIL ") + t); if (!c) process.exitCode = 1; };
const src = (f) => fs.readFileSync(new URL("../../" + f, import.meta.url), "utf8");
const R = await import("../../web-src/readlog.js");
const { run } = await import("../readlog/gen.mjs");

// the 10,000-case generator: a 2,500 sample stays above its mark (HARD, composed)
const r = run(2500, 7, { quiet: true });
ok(r.right / r.total >= 0.995, `2,500 composed HARD cases: ${r.right}/${r.total} right (mark 99.5 %)`);
ok(r.share >= 0.6, `…in ${(100 * r.share).toFixed(1)} % different shapes (bar 60 %)`);

// every reason the reader can give has its words
const reasons = new Set([...src("web-src/paylog.js").matchAll(/no\("([a-z]+)"\)/g)].map((m) => m[1]));
for (const m of src("web-src/notifwords.js").matchAll(/return "([a-z]+)";/g)) reasons.add(m[1]);
const missing = [...reasons].filter((x) => !R.WHY[x]);
ok(!missing.length, "every reason a message is left alone has its words on the page (" + [...reasons].join(", ") + ")" + (missing.length ? " — missing " + missing : ""));

// BK2 — the line
const now = Date.parse("2026-11-23T14:00:00"), H = 3600e3;
const L = { txns: [{ id: "a", type: "expense", amount: 312, source: "notification", created: now - 2 * H, date: "2026-11-23" }, { id: "b", type: "expense", amount: 50, created: now - H, date: "2026-11-23" }] };
let l = R.liveLine({ reader: true, access: true, diag: { live: true, seen: now - 60e3, smsSwitch: true }, ledger: L, now });
ok(l.tone === "ok" && l.n === 1 && l.last === now - 2 * H, "BK2: reading → green, 1 today (a hand-typed one doesn't count), the last one's time");
ok(R.liveLine({ reader: true, access: true, diag: { live: false }, ledger: L, now }).state === "asleep", "BK2: Android paused the reader → amber");
ok(R.liveLine({ reader: true, access: true, diag: { seen: now - 7 * H }, ledger: L, now }).state === "asleep", "BK2: silent 7 hours → amber");
ok(R.liveLine({ reader: true, access: false, ledger: L, now }).state === "off", "BK2: access off → amber");
ok(R.liveLine({ reader: true, access: true, diag: { smsSwitch: false, seen: now }, ledger: L, now }).state === "smsoff", "BK2: SMS switch off → amber");
ok(R.liveLine({ reader: false, ledger: L, now }).state === "phone" && R.liveLine({ reader: false, ledger: { txns: [] }, now }) === null, "BK2 on the computer: what the phone read, or nothing at all");

// BK3 — the rule, the same numbers in ReadWatch.kt
const base = { was: true, access: true, seen: now - 60e3, conn: now - 86400e3, now, hour: 14, interactive: true, lastAlert: 0, sms: [] };
ok(R.stopAlert(base) === null, "BK3: working → no notification");
ok(R.stopAlert({ ...base, access: false }) === "off" && R.stopAlert({ ...base, seen: now - 6 * H, conn: now - 9 * H }) === "silent", "BK3: access off / 6 h silent → it says so");
ok(R.stopAlert({ ...base, sms: [{ ts: now - H, money: true, otp: false, sw: false }] }) === "smsoff", "BK3: a money SMS while the SMS switch is off → it says so");
ok(R.stopAlert({ ...base, access: false, hour: 2 }) === null && R.stopAlert({ ...base, access: false, lastAlert: now - 5 * H }) === null && R.stopAlert({ ...base, access: false, was: false }) === null,
  "BK3: never at night, at most once a day, never if it was never on");
const kt = src("app/src/main/java/com/aldibiki/attune/ReadWatch.kt");
ok(new RegExp("SILENT_H = " + R.SILENT_H + "\\b").test(kt) && new RegExp("ALERT_GAP_H = " + R.ALERT_GAP_H + "\\b").test(kt) && kt.includes("NIGHT_FROM = " + R.NIGHT[0]) && kt.includes("NIGHT_TO = " + R.NIGHT[1]),
  "BK3: ReadWatch.kt has the same numbers as readlog.js");
ok(/ReadWatchReceiver/.test(src("app/src/main/AndroidManifest.xml")) && /fun readWatchSet/.test(src("app/src/main/java/com/aldibiki/attune/NativeBridge.kt")), "BK3: the receiver is declared and the page can send the words");

// wiring
ok(/<MoneyLiveLine \/>[\s\S]*<MoneyLiveLine \/>/.test(src("web-src/money-calm-ui.jsx")), "BK2: the line is on Money on a phone AND a computer");
ok(/bank-working-read/.test(src("web-src/setup-ui.jsx")) && /<ReadLogHost \/>/.test(src("web-src/attune.jsx")) && /mode === "readlog"/.test(src("web-src/attune.jsx")), "the list opens from Set up, from anywhere, and from the notification");

// all 20 languages
const lines = [...Object.values(R.WHY), R.ALERT.silent.d, "Read from your messages", "Reading bank messages · {n} today · last {t}", "Not reading since {t} — Android paused it", "See what was read"];
for (const g of "ar arb es fr de pt it ru tr id hi ur fa bn sw th vi zh ja ko".split(" ")) { const d = src("web-src/i18n-" + g + ".js"); ok(lines.every((x) => d.includes(JSON.stringify(x) + ":")), "the new lines are in " + g); }
