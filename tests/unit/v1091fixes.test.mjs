// v10.9.1 — Ali's 10-point list (23 Nov 2026): every mistake he found gets a test so it can't come back.
import fs from "fs";
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const ok = (c, t) => { console.log((c ? "PASS " : "FAIL ") + t); if (!c) process.exitCode = 1; };
const src = (f) => fs.readFileSync(new URL("../../web-src/" + f, import.meta.url), "utf8");
const F = await import("../../web-src/lifefacts.js");
const BC = await import("../../web-src/bankcheck.js");
const AP = await import("../../web-src/autopilot2.js");
const SP = await import("../../web-src/spaces.js");
const LJ = await import("../../web-src/lsjson.js");
const P = await import("../../web-src/plan.js");
const B = await import("../../web-src/billing.js");

// 7 — "Most of it went on cmuwco6x7sl16y" (a category id) → its name, or what the money was for
const now = Date.parse("2026-11-22T12:00:00");
const top = (L) => F.facts({ ledger: L }, {}, { now }).find((f) => f.id.startsWith("money:top:"));
let t = top({ currency: "EGP", txns: [{ type: "expense", amount: 25000, date: "2026-11-05", cat: "cmuwco6x7sl16y", note: "Amazon laptop" }, { type: "expense", amount: 2000, date: "2026-11-06", cat: "food" }] });
ok(t && t.T[1].c === "Amazon laptop" && !/cmuwco/.test(JSON.stringify(t.T)), "7: an unknown category id never shows — what the money was for instead (" + (t && t.T[1].c) + ")");
ok(t && /one payment/.test(t.T[0]), "7: one payment says so (not \"1 times\")");
t = top({ currency: "EGP", customCats: [{ id: "cmabc12345x", en: "Car" }], txns: [{ type: "expense", amount: 900, date: "2026-11-05", cat: "cmabc12345x" }, { type: "expense", amount: 300, date: "2026-11-06", cat: "cmabc12345x" }] });
ok(t && t.T[1].c === "Car" && t.T[1].n === 2, "7: his own category by its name (" + (t && t.T[1].c) + ")");
t = top({ currency: "EGP", customCats: [{ id: "cmq9x8w7v6u5" }], txns: [{ type: "expense", amount: 900, date: "2026-11-05", cat: "cmq9x8w7v6u5" }, { type: "expense", amount: 30, date: "2026-11-06", cat: "food" }] });
ok(t && !/cmq9x8/.test(t.T[1].c), "7: a custom category with no name never shows its id (" + (t && t.T[1].c) + ")");

// "What Attune knows → waiting for you": an app's ad is not a person waiting
const ts = now - 3600e3;
const msgs = (notes, minds) => F.facts({ notes, minds }, {}, { now }).filter((f) => f.area === "messages").map((f) => f.T[1].w);
ok(msgs([{ id: "a", pkg: "com.sahl.app", app: "Sahl", title: "🏥⚕️ لسه مادفعتش الإشتراك؟", text: "ادفع دلوقتي المشروع العلاجي لنقابة المهن الطبية من البيت مع سهل، في خطوات بسيطة.", ts }], { a: { action: "reply" } }).length === 0,
  "Sahl's «لسه مادفعتش الإشتراك؟ ادفع دلوقتي» is not 'waiting for your answer'");
ok(msgs([{ id: "b", pkg: "com.whatsapp", app: "WhatsApp", title: "Mama", text: "هتيجي امتى؟", ts }], { b: { action: "reply", who: "Mama" } }).join() === "Mama", "Mama on WhatsApp still waits for an answer");
ok(msgs([{ id: "c", pkg: "com.whatsapp", app: "WhatsApp", title: "Ahmed", text: "pay me back the 500 please", ts }], { c: { action: "do", who: "Ahmed" } }).join() === "Ahmed", "a person asking to pay in a chat is still kept");
ok(msgs([{ id: "d", pkg: "com.noon", app: "noon", title: "Yellow Friday", text: "خصم 50% على كل حاجة — اطلب دلوقتي", ts }], { d: { action: "do" } }).length === 0, "a shop's advert is never waiting for you");

// the Autopilot to-do «Aswa2 pen fel taree5» → "Someone is requesting something related to …"
const c = { chat: "S7s Bomb", who: "S7s Bomb", text: "Aswa2 pen fel taree5" };
ok(AP.vagueSummary("Someone is requesting something related to 'S7s Bomb' and 'Aswa2 pen fel taree5'", c), "a summary that says nothing is vague");
ok(!AP.vagueSummary("Send the signed contract tomorrow morning", { chat: "Dima", text: "пришли договор завтра" }), "a real request is not vague");
ok(!AP.vagueSummary("Pay Ahmed 500 for the tickets", { chat: "Ahmed", text: "..." }), "a payment ask is not vague");
ok(/vagueSummary\(md\.summary, c\)/.test(src("autopilot2.js")), "the model's to-do asks vagueSummary first");

// 3 — the bank step when done says if it is still reading
const L1 = { txns: [{ amount: 450, note: "CIB", date: "2026-11-22", source: "notification", type: "expense" }, { amount: 90, note: "Uber", date: "2026-11-02", source: "notification", type: "expense" }] };
let b = BC.bankCheck({ access: true, diag: { live: true, seen: now - 600e3 }, ledger: L1, now });
ok(b.state === "done" && b.n === 1 && b.last && b.last.note === "CIB" && !b.asleep, "3: done → how many this week (1), the last one (CIB), awake");
b = BC.bankCheck({ access: true, diag: { live: false }, ledger: L1, now });
ok(b.state === "done" && b.asleep, "3: done but Android paused the reader → it says so (asleep)");
b = BC.bankCheck({ access: true, diag: { smsSwitch: false }, ledger: L1, now });
ok(b.smsoff, "3: done but the SMS switch is off → it says so");
b = BC.bankCheck({ access: false, ledger: L1, now });
ok(b.state === "off", "3: notification access turned off later → 'off', never a stale 'done'");
const su = src("setup-ui.jsx");
ok(/role="button"/.test(su) && /setup-open/.test(su) && /BankWorking/.test(su) && /s\.id === "backup" \? openIt/.test(su), "3: every Set up row opens something; the bank row shows the live status; backup opens the backup");

// 6 — Glass: each dark ground is its own; Settings over a coloured area keeps the theme's colour
const pages = ["slate", "black", "zinc", "stone", "light"].map((bg) => SP.glassVars({ accent: "burgundy", bg, look: "glass" }).page);
ok(new Set(pages).size === 5, "6: Glass + Midnight / Black / Graphite / Warm / Light = 5 different grounds");
const gc = SP.glassCss({ accent: "rose", bg: "zinc", look: "glass" });
ok(/html\.att-glass\{[^}]*--g-bar:/.test(gc) && /--g-solid:/.test(gc), "8: the bar colours are on html too (the top bar is outside .calm — it was see-through)");
ok(/:not\(\[role="dialog"\] \*\):not\(\[class\*="bg-black\/"\] \*\)/.test(SP.areaCss({ bg: "zinc" })), "6: an area's colour never reaches a sheet or window (Settings over Documents was violet)");
ok(/html\.att-glass:not\(\.att-glass-blur\) \.sticky \{ background: var\(--g-solid\)/.test(src("build/tw.css")), "8: on a phone (no blur) a stuck bar is solid");
ok(/createPortal/.test(src("chatpilot-ui.jsx")) && /bg-\[var\(--g-solid,var\(--c-surf\)\)\]/.test(src("chatpilot-ui.jsx")), "5: the Autopilot sheet opens on the page itself, with a solid background");

// 4 — the GPU switch shows where the engine really runs + one clear line after the restart
const sp = src("speed-ui.jsx");
ok(/sp\.fastBackend \? sp\.fastBackend === "GPU"/.test(sp) && /Now on the graphics chip/.test(sp) && /The graphics chip refused/.test(sp), "4: the switch follows the real backend and says what happened");

// 1 — option A: bank messages by themselves in Free
ok(P.allowed("autoMoney", false), "1: bank / wallet messages saved by themselves are Free");
ok(B.COMPARE_ROWS.some((r) => /Money Guardian/.test(r[0]) && r[1] === "The first finding"), "1: Money Guardian is the Pro depth in the table");

// 9 — speed: a stored value is parsed once per change
let parses = 0; const realParse = JSON.parse; JSON.parse = (s, r) => { parses++; return realParse(s, r); };
localStorage.setItem("ledger.v3", JSON.stringify({ txns: [{ id: 1 }], ui: {} }));
for (let i = 0; i < 50; i++) LJ.readJSON("ledger.v3");
ok(parses === 1, "9: 50 reads of an unchanged ledger parse it once (" + parses + ")");
const a = LJ.readJSON("ledger.v3"); a.txns = []; ok(LJ.readJSON("ledger.v3").txns.length === 1, "9: a caller swapping a field never changes what the next reader gets");
localStorage.setItem("ledger.v3", JSON.stringify({ txns: [{ id: 1 }, { id: 2 }] }));
ok(LJ.readJSON("ledger.v3").txns.length === 2 && parses === 2, "9: a changed ledger is read again");
JSON.parse = realParse;
ok(/if \(!run && \(!bonusOpen \|\| Date\.now\(\) - last < 30000\)\) return;/.test(su), "9: the Set up driver no longer reads all stores every 1.5 s when nothing runs");
ok(/readJSON\("ledger\.v3"/.test(src("myledger.js")), "9: Money's loadLedger uses the cached reader");

// all 20 languages for the new lines
const lines = ["Now on the graphics chip ✓", "Working ✓ — {n} read this week · last: {x}", "Done · {n} saved", "Most of it went on {c}: {a} in one payment, {p}% of what you spent.", "The first finding"];
for (const l of "ar arb es fr de pt it ru tr id hi ur fa bn sw th vi zh ja ko".split(" ")) {
  const d = src("i18n-" + l + ".js"); ok(lines.every((x) => d.includes(JSON.stringify(x) + ":")), "the new lines are in " + l);
}
