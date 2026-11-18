// v10.4 — Ali's 18 Nov phone list, each kept as a test:
//  (2) "Turn on backup" in Set up your life opened the old prompt-compressor page (navTo("backup") — no such page; the last page in the
//      chain caught it). Now Backup / Profile / Plan open their panel from any way in, and EVERY page a button opens must exist.
//  (3) "I can't press allow or tick, it does not do anything" + "fix the SMS notification for good": the bank step says what is really
//      happening (bankcheck.js) with the button that fixes it; a bank SMS in CAPITALS ("RS.2500.00 DEBITED") is read.
import fs from "fs";
import { bankCheck, SAY, BTN } from "../../web-src/bankcheck.js";
import { readNotification } from "../../web-src/paylog.js";
import { STEPS } from "../../web-src/setup.js";
import { run } from "../bankcheck/gen.mjs";
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const src = fs.readFileSync(new URL("../../web-src/attune.jsx", import.meta.url), "utf8");

// ---- (2) every page a button / a step / the feature finder opens exists (or is a panel, or navTo turns it into one) ----
const pages = new Set([...src.matchAll(/mode === "([a-z]+)"/g)].map((m) => m[1]));
const panels = new Set((/PANEL_IDS = new Set\(\[([^\]]+)\]\)/.exec(src) || [, ""])[1].match(/[a-z]+/g) || []);
const viaNav = new Set(["voice", "braindump", "weekplan", "focus", "habits", "countdowns", "notes", "lifeask", "settings", "things"]);
const removed = (fs.readFileSync(new URL("../../web-src/removed.js", import.meta.url), "utf8").match(/REMOVED = \[([^\]]+)\]/) || [, ""])[1].match(/[a-z-]+/g);
ok(panels.has("backup") && panels.has("profile") && panels.has("plan"), "Backup / Profile / Plan are panels: " + [...panels]);
ok(/const pn = String\(m \|\| ""\)\.replace\(\/\^panel:\/, ""\); if \(PANEL_IDS\.has\(pn\)\)/.test(src), "navTo opens the panel for a panel name");
ok(/\/\^\(panel:\)\?\[a-z\]\+\$\/\.test\(m\)/.test(src), "“attune-open” lets panel:backup through to navTo");
const dir = new URL("../../web-src/", import.meta.url);
const bad = [];
for (const f of fs.readdirSync(dir).filter((f) => /\.(js|jsx)$/.test(f) && !f.startsWith("i18n-"))) {
  const s = fs.readFileSync(new URL(f, dir), "utf8");
  for (const re of [/attune-open", \{ detail: \{ mode: "([a-z]+)"/g, /navTo\("([a-z]+)"\)/g, /\bopen: "([a-z]+)"/g])
    for (const m of s.matchAll(re)) { const id = m[1]; if (!pages.has(id) && !panels.has(id) && !viaNav.has(id) && !removed.includes(id)) bad.push(f + ": " + id); }
}
ok(!bad.length, "every page a button opens exists: " + bad.join(", "));
ok(STEPS.every((s) => pages.has(s.open) || panels.has(s.open)), "every Set up step opens a real page or panel: " + STEPS.map((s) => s.open));

// ---- (3) the bank step ----
const now = Date.parse("2026-11-18T16:00:00"), O = { home: "EGP", order: "dmy" };
const cib = { id: "q1", pkg: "com.google.android.apps.messaging", app: "Messages", title: "CIB", text: "Your debit card ending 1234 was charged EGP 350.00 at CARREFOUR MAADI on 18/11 at 14:22. Available balance EGP 12,450.75", ts: now - 3600e3 };
const base = { reader: true, access: true, diag: { live: true, smsSwitch: true, seen: now - 60e3, conn: now - 86400e3, sms: [] }, queue: [], done: [], ledger: { txns: [] }, now, opts: O };
let c = bankCheck({ ...base, queue: [cib] });
ok(c.state === "waiting" && c.n === 1 && c.add.length === 1, "his case — allowed, a bank SMS read, waiting for an OK (Free): says so, with Add: " + c.state);
ok(SAY.waiting.a.includes("add") && BTN.add === "Add them to Money", "…the button is “Add them to Money”");
ok(bankCheck({ ...base, queue: [cib], done: ["q1"] }).state === "nosms", "a payment already handled never waits again");
ok(bankCheck({ ...base, queue: [cib], ledger: { txns: [{ type: "expense", amount: 350, date: "2026-11-18", note: "typed" }] } }).add.length === 0, "the same payment typed by hand: it waits, but Add doesn't save it twice");
ok(bankCheck({ ...base, access: false }).state === "off" && SAY.off.a[0] === "allow", "access off → Allow");
ok(bankCheck({ ...base, ledger: { txns: [{ amount: 50, source: "notification" }] } }).state === "done", "a payment read from a notification → done");
ok(bankCheck({ ...base, diag: { ...base.diag, live: false } }).state === "asleep", "Android paused the reader → Fix it now");
ok(bankCheck({ ...base, diag: { ...base.diag, seen: now - 9 * 3600e3, conn: now - 20 * 3600e3 } }).state === "asleep", "nothing for 9 hours → paused");
ok(bankCheck({ ...base, diag: { ...base.diag, smsSwitch: false } }).state === "smsoff", "SMS switched off → Turn SMS on");
const tr = (k, ts) => ({ ts, pkg: "com.android.mms", from: "CIB", hidden: k === "h", money: k === "m", otp: k === "o" });
ok(bankCheck({ ...base, diag: { ...base.diag, sms: [tr("h", now - 6e5), tr("h", now - 9e5)] } }).state === "hidden", "the SMS app hides the words → says where to show them");
ok(bankCheck({ ...base, diag: { ...base.diag, sms: [tr("m", now - 6e5)] } }).state === "notpay", "money words but not a payment → says so");
ok(bankCheck({ ...base, diag: { ...base.diag, sms: [tr("", now - 6e5), tr("o", now - 7e5)] } }).state === "notbank", "SMS arrive, none from a bank");
ok(bankCheck({ ...base, diag: { ...base.diag, sms: [tr("o", now - 6e5), tr("h", now - 30 * 86400e3)] } }).state === "nosms", "codes and month-old SMS don't count");
ok(bankCheck({ ...base, reader: false }).state === "unavailable", "a build without the reader says so");
// every state has words and only known buttons
ok(Object.values(SAY).every((w) => w.t && w.a.every((a) => BTN[a])), "every state: words + known buttons");
// a bank SMS in CAPITALS (found by the 10,000 run)
const caps = readNotification({ id: "c", app: "Messages", title: "AD-HDFCBK", text: "HDFC BANK: RS.2500.00 DEBITED FROM A/C **3545 ON 10-11-26 TO VPA SWIGGY@ICICI (UPI REF NO 631012345678). NOT YOU? CALL 18002586161", ts: now }, { ...O, teach: [] });
ok(caps && caps.amount === 2500 && caps.direction === "out", "“RS.2500.00 DEBITED” in capitals is read: " + JSON.stringify(caps && [caps.amount, caps.currency]));
// the page: the box is a button, the bank row always has a button and its check
const ui = fs.readFileSync(new URL("../../web-src/setup-ui.jsx", import.meta.url), "utf8");
ok(/data-testid="setup-box"/.test(ui) && /data-testid="setup-bank-check"/.test(ui) && /<BankCheckBox/.test(ui), "Set up page: the tick box is a button; the bank row has Check + the check box");
ok(/a\.startsWith\("bank-"\)/.test(ui), "Chat's card buttons run the same bank actions");
const kt = fs.readFileSync(new URL("../../app/src/main/java/com/aldibiki/attune/PayListener.kt", import.meta.url), "utf8");
ok(/override fun onListenerConnected[\s\S]{0,400}rescan\(\)/.test(kt) && /object SmsDiag/.test(kt), "the phone reads the shade again on every reconnect + keeps the SMS trace");
// the 10,000 run, a 2,500 sample (HARD) stays at its mark
const r = run(2500, 3, { quiet: true });
ok(r.right / r.total >= 0.995 && r.share >= 0.6, `bank check 2,500 sample ${r.right}/${r.total}, shapes ${(100 * r.share).toFixed(1)} %`);
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`);
