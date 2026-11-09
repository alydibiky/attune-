// v9.9.14 (Ali: "I don't want a small fix … choose which balance to take from if it's taking from me, and if someone else is paying
// make me choose who — someone Attune knows, from contacts, or nothing … remind me whether I am paying or not").
import * as LF from "../../web-src/life.js";
import { appendToLedger } from "../../web-src/paylog.js";
import * as AP from "../../web-src/autopilot.js";
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const base = { v: 1, items: [
  { id: "g", kind: "subscription", dir: "out", title: "Google Gemini", amount: 939.99, currency: "EGP", every: "month", start: "2026-11-07", count: 0, total: 0, paid: [0], auto: true, person: "" },
  { id: "m", kind: "regular", dir: "out", title: "Maid", person: "", amount: 600, currency: "EGP", every: "week", start: "2026-11-07", count: 0, total: 0, paid: [] },
  { id: "d", kind: "debt", dir: "in", person: "Sheikh", amount: 19500, count: 8, total: 19500, every: "month", start: "2026-11-01", paid: [] }] };
ok(LF.hasPayer(base.items[0]) && LF.hasPayer(base.items[1]) && !LF.hasPayer(base.items[2]), "who pays applies to every renewing payment (subscription, the maid…), not to a debt someone owes you");
ok(LF.payerUnknown(base).map((c) => c.id).join() === "g", "only the one Attune added by itself asks on its own");
// me + an account
let d = LF.setPayer(base, "g", { payer: "me", account: "cib", accountName: "CIB" });
let g = d.items[0];
ok(g.payer === "me" && g.account === "cib" && LF.paysMe(g) && LF.payerLine(g) === "You pay · from CIB", "Me → from CIB: " + LF.payerLine(g));
const led = { txns: [], accounts: [{ id: "cash", name: "Cash", currency: "EGP" }, { id: "cib", name: "CIB", currency: "EGP" }] };
ok(appendToLedger(led, [{ type: "expense", amount: 939.99, currency: "EGP", account: "cib", date: "2026-11-07" }]).ledger.txns[0].account === "cib", "the payment goes out of the chosen account (CIB), not the first one (Cash)");
const s = AP.suggestions([{ id: "x", app: "Gmail", pkg: "com.google.android.gm", title: "Google Play", ts: Date.parse("2026-12-07T15:00:00"), text: "Your Google Play Order Receipt from 7 Dec 2026. Your subscription continues and you've been charged. Order date: 7 Dec 2026. Google AI Pro (Google One) EGP 939.99/month" }], { now: Date.parse("2026-12-07T16:00:00"), life: d });
ok(s[0] && AP.actionsFor(s[0]).find((x) => x.kind === "money").items[0].account === "cib", "next month's receipt (by itself) takes it from CIB too");
let r = LF.nextReminder(g, Date.parse("2026-11-20T10:00:00"));
ok(r && /from CIB/.test(r.body) && new Date(r.at).getDate() === 7, "you pay → reminded on the 7th: " + r.title + " — " + r.body);
// someone else: a known person, a contact, a typed name
const dir = { items: [{ id: "p1", kind: "person", name: "Ahmed", role: "brother" }, { id: "p2", kind: "person", name: "Karim", role: "plumber" }, { id: "p3", kind: "person", name: "Baba", role: "my father", contact: { phone: "+2010" } }] };
const pc = LF.peopleChoices(dir, base);
ok(pc[0].name === "Ahmed" || pc[0].name === "Baba", "people Attune knows are offered, family first: " + pc.map((x) => x.name + (x.role ? " (" + x.role + ")" : "")).join(", "));
ok(pc.some((x) => x.name === "Sheikh") && pc.findIndex((x) => x.name === "Karim") > pc.findIndex((x) => x.name === "Baba"), "…then the others, and the people in your plans (Sheikh)");
d = LF.setPayer(base, "g", { payer: "Baba", ref: { id: "p3", phone: "+2010" } }); g = d.items[0];
ok(g.payer === "Baba" && g.payerRef.id === "p3" && g.payerRef.phone === "+2010" && !g.account && !LF.paysMe(g), "a known person (with their contact) saved; no account");
ok(LF.peopleChoices(dir, d)[0].name === "Baba", "…and offered first next time");
r = LF.nextReminder(g, Date.parse("2026-11-20T10:00:00"));
ok(/Renews today/.test(r.title) && /Baba pays it; your balance stays the same/.test(r.body), "someone else pays → still reminded: " + r.body);
d = LF.setPayer(base, "g", "none"); g = d.items[0];
ok(g.payer === "none" && !LF.paysMe(g) && LF.payerLine(g) === "Nobody set — reminder only", "Nobody → " + LF.payerLine(g));
r = LF.nextReminder(g, Date.parse("2026-11-20T10:00:00"));
ok(r && /nobody's balance changes/.test(r.body), "…and still reminded: " + r.body);
ok(LF.paysMe(base.items[1]) && LF.payerLine(base.items[1]) === "You pay", "nothing saved yet (the maid, from before) = you pay, as always");
// reminders kept for every renewing payment, even ones Autopilot ticks
const rem = LF.lifeReminders(d, [], Date.parse("2026-11-20T10:00:00"));
ok(rem.some((x) => x.id === "life-g") && rem.some((x) => x.id === "life-m") && !rem.some((x) => x.id === "life-d"), "every renewing payment has its next reminder (Gemini, the maid); a debt keeps its own way");
ok(LF.lifeReminders(d, rem, Date.parse("2026-11-20T10:00:00")).length === 0, "…set once — nothing new when they are already there");
if (fails) { console.log(fails + " failed"); process.exit(1); }
