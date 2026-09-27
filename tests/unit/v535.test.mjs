// Unit tests for v5.35: Chat X-Ray (a WhatsApp export read by code on the phone).
import { parseExport, candidates, chunksOf, parseItems, ledgerOf, unanswered, statsOf, searchChat, matchPerson } from "../../web-src/chatxray.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

const android = `27/09/2026, 09:14 - Messages and calls are end-to-end encrypted. No one outside of this chat can read them.
27/09/2026, 09:15 - Hassan Crane Co: Good morning Ali
27/09/2026, 09:16 - Ali: Morning. The 50 t crane for Friday is 18,000 EGP per day
27/09/2026, 09:20 - Hassan Crane Co: OK. I'll transfer 9,000 EGP deposit tomorrow
and the rest after the job
27/09/2026, 09:21 - Hassan Crane Co: <Media omitted>
28/09/2026, 18:02 - Hassan Crane Co: Sent 9,000 on InstaPay
29/09/2026, 11:00 - Hassan Crane Co: Can you send the operator's licence copy?`;
const a = parseExport(android);
eq(a.messages.length, 5, "an Android export: 5 real messages (encryption notice and media left out)");
eq(a.people, ["Hassan Crane Co", "Ali"], "…the people, most messages first");
eq(a.messages[2].text, "OK. I'll transfer 9,000 EGP deposit tomorrow\nand the rest after the job", "…a message over two lines stays one message");
eq(new Date(a.messages[0].t).getDate() === 27 && new Date(a.messages[0].t).getHours() === 9, true, "…date and time read day-first");

const ios = `[9/27/26, 2:03:11 PM] Ali: Did you get the invoice?
[9/27/26, 2:05:40 PM] Sara: Yes, I'll pay $450 on Monday`;
const b = parseExport(ios);
eq(b.order, "mdy", "an iPhone export with month-first dates is detected");
eq(new Date(b.messages[1].t).getHours(), 14, "…and 2:05 PM is 14:05");

const arabic = "‏٢٧/٩/٢٠٢٦، ٩:١٥ م - محمود: هحولك ٥٠٠٠ جنيه بكرة إن شاء الله\n‏٢٨/٩/٢٠٢٦، ١٠:٠٠ ص - علي: تمام";
const c = parseExport(arabic);
eq([c.messages.length, c.messages[0].who, new Date(c.messages[0].t).getHours(), c.messages[0].text], [2, "محمود", 21, "هحولك 5000 جنيه بكرة إن شاء الله"], "an Arabic export: Arabic digits, ، and م (PM) are read");

const cand = candidates(a.messages);
eq(cand.map((m) => m.i), [0, 1, 2, 3, 4], "money, promises and questions are picked (with the message before each)");
eq(candidates(a.messages.slice(0, 1)).length, 0, "a greeting alone is not sent to the model");
eq(chunksOf(a.messages.slice(1, 2))[0].startsWith("#1 2026-09-27 Ali: Morning. The 50 t crane"), true, "chunks number each message with its date and author");

const byIndex = new Map(a.messages.map((m) => [m.i, m]));
const raw = JSON.stringify({ items: [
  { type: "owes", msg: 1, from: "Hassan", to: "Ali", amount: 18000, currency: "EGP", what: "crane day" },
  { type: "paid", msg: 3, from: "Hassan Crane Co", to: "Ali", amount: 9000, currency: "EGP", what: "deposit" },
  { type: "promise", msg: 2, from: "Hassan", to: "Ali", amount: null, what: "rest after the job", due: "2026-09-28" },
  { type: "owes", msg: 2, from: "Hassan", to: "Ali", amount: 99999, what: "invented" },
  { type: "paid", msg: 77, from: "Hassan", to: "Ali", amount: 5, what: "no such message" },
] });
const items = parseItems(raw, byIndex, a.people);
eq(items.length, 4, "an item pointing at a message that doesn't exist is dropped");
eq(items[0].from, "Hassan Crane Co", "'Hassan' is matched to the chat's 'Hassan Crane Co'");
eq(items[3].amount, null, "an amount that isn't in the message (99,999) is not trusted");
eq(items[1].quote, "Sent 9,000 on InstaPay", "the quote is the message itself, not the model's words");
const led = ledgerOf(items, "Ali");
eq(led.map((r) => [r.person, r.currency, r.net]), [["Hassan Crane Co", "EGP", 9000]], "the ledger by code: 18,000 owed − 9,000 paid = Hassan still owes 9,000");

const un = unanswered(a.messages, "Ali", new Date(2026, 9, 5).getTime());
eq(un.map((u) => u.quote), ["Can you send the operator's licence copy?"], "a question Ali never answered is found");
eq(statsOf(a.messages).per, [["Hassan Crane Co", 4], ["Ali", 1]], "messages per person");
eq(searchChat(a.messages, "how much is the 50 t crane per day").some((m) => /18,000/.test(m.text)), true, "the question finds the message with the price");
eq(matchPerson("sara", ["Ali", "Sara Mostafa"]), "Sara Mostafa", "names match loosely");

if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
