// v9.9.38 (Ali: "are all the languages up to date?" — the answers worked out by code were English in 18 languages): in every one of the
// 20 languages, the answers to "who owes me money?", "what do I owe?", "what's due this week?", "what are my subscriptions?", "how much
// did I spend this month / today / in the last 3 days / on food?" come in that language, with the right numbers, and no English left.
const I = await import("../../web-src/i18n.js"), A = await import("../../web-src/lifeask.js"), M = await import("../../web-src/myledger.js");
let fail = 0; const ok = (c, m) => { if (!c) { console.log("FAIL " + m); fail++; } };
const now = Date.parse("2026-11-14T12:00:00");
const stores = { life: { items: [
  { id: "a", kind: "installment", person: "Ahmed", dir: "in", amount: 1000, count: 12, total: 12000, every: "month", start: "2026-08-01", currency: "EGP", paid: [0, 1] },
  { id: "b", kind: "debt", person: "Sara", dir: "in", amount: 2500, count: 0, total: 0, every: null, start: "", currency: "EGP", paid: [] },
  { id: "c", kind: "installment", person: "", title: "Car", dir: "out", amount: 4500, count: 10, total: 45000, every: "month", start: "2026-10-01", currency: "EGP", paid: [0] },
  { id: "s", kind: "subscription", title: "Netflix", dir: "out", amount: 200, count: 0, total: 0, every: "month", start: "2026-01-01", currency: "EGP", paid: [] }] },
  radar: { items: [{ id: "r", title: "Car licence", date: "2026-11-18", status: "open" }] }, reminders: [],
  ledger: { currency: "EGP", accounts: [{ id: "c", currency: "EGP", start: 0 }], txns: [{ id: "1", type: "expense", amount: 150, cat: "food", date: "2026-11-14", note: "lunch", account: "c" }, { id: "2", type: "expense", amount: 300, cat: "transport", date: "2026-11-12", note: "uber", account: "c" }] } };
const Q = [["who owes me money?", /12,500/], ["what do I owe?", /40,500/], ["what's due this week?", /\b15\b.*2026-01-01|2026-01-01.*\b15\b|15.*2026-01-01/], ["what are my subscriptions?", /200/]];
const MQ = [["how much did I spend this month?", /450/], ["how much did I spend today?", /150/], ["how much did I spend in the last 3 days?", /450/], ["how much did I spend on food this month?", /150/]];
// English left behind = two or more English words from these answers' own sentences
const EN = /\b(?:owes?|people|person|still|payments?|commitments?|things?|First|subscriptions?|Biggest|spent|entries|entry|month|today|days|in all|already|late)\b/g;
const LANGS = "ar arb es fr de pt it ru tr id hi ur fa bn sw th vi zh ja ko".split(" ");
let checked = 0;
for (const lg of LANGS) {
  const mod = await import("../../web-src/i18n-" + lg + ".js"); I.registerDicts({ [lg]: Object.values(mod).find((v) => v && typeof v === "object") });
  I.setLang(lg);
  if (I.getLang() !== lg) { ok(false, lg + ": could not switch the language"); continue; }
  for (const [q, num] of Q) { const a = A.askLife(q, stores, { now }), t = A.sayAnswer(a); checked++;
    const left = (t.match(EN) || []).filter((w) => !/Netflix/.test(w));
    ok(num.test(t), `${lg} «${q}»: the number is missing — ${t}`); ok(left.length < 2, `${lg} «${q}»: English left (${left.join(", ")}) — ${t}`); }
  for (const [q, num] of MQ) { const t = M.answerMyMoney(q, stores.ledger, { now, short: true, ar: lg === "ar" }).text.split("\n")[0]; checked++;
    const left = (t.match(EN) || []); ok(num.test(t), `${lg} «${q}»: the number is missing — ${t}`); ok(left.length < 2, `${lg} «${q}»: English left (${left.join(", ")}) — ${t}`); }
}
I.setLang("en");
console.log(fail ? `FAIL ${fail} of ${checked * 2} checks` : `ALL PASSED (${checked} answers in ${LANGS.length} languages)`);
process.exit(fail ? 1 : 0);
