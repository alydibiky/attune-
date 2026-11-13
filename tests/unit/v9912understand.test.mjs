// v9.9.12 (Ali, 10 Nov: "Follow-ups is not logical — how does it not understand these notifications?"; agents: "how do I know if the
// new findings are better than the current ones?"). His exact screenshots.
import * as L from "../../web-src/notelabels.js";
import * as A from "../../web-src/agents.js";
import { readNotification } from "../../web-src/paylog.js";
import * as AP from "../../web-src/autopilot.js";
import { understandNote as meaning } from "../../web-src/notifmeaning.js";
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const now = Date.now();
const uber = { id: "u", pkg: "com.ubercab", app: "Uber", title: "Uber", text: "Invite a friend to Uber and get ج.م.‏ 30 off when they take their first trip. Terms apply.", ts: now };
const talabat = { id: "t", pkg: "com.talabat", app: "talabat", title: "talabat", text: "For 206 EGP only instead of 295 EGP order 4 gateaux pieces from La Poire. Treat yourself on talabat.", ts: now };
const gmail = { id: "g", pkg: "com.google.android.gm", app: "Gmail", title: "Google Play", text: "Your Google Play Order Receipt from 7 Nov 2026\nThank you\nYour subscription from Google Commerce Limited on Google Play continues and you've been charged. Manage your subscriptions\nOrder number: SOP.3339-9808-7181-66103..6\nItem\nPrice\nGoogle AI Pro (5 TB) (Google One) (by Google LLC)\nج.م.‏ ٩٣٩٫٩٩/month\nAuto-renewing subscription", ts: now };
const yt = { id: "y", pkg: "com.google.android.youtube", app: "YouTube", title: "MrBeast", text: "I Hustled Streamers for $250,000", ts: now };
const wa = { id: "w", pkg: "com.whatsapp", app: "WhatsApp", title: "ما يخص المرتبات: Mahmoud 3ashour (Alex Accountant)", text: "ابراهيم حسن ايام الجراح ٣٠٠\nمن يوم ١٠/٦\nغفره بليل ٤٥٠ جنيه+١٠٠جنيه اعاشه", ts: now };
const friend = { id: "f", pkg: "com.whatsapp", app: "WhatsApp", title: "Karim", text: "I sent you 500 EGP for the tickets", ts: now };
const U = (n) => L.understandNote(n) || {};
ok(U(uber).meaning === "ads" && U(uber).sure, "Uber “invite a friend … get 30 off” → an offer, never asked");
ok(U(talabat).meaning === "ads" && U(talabat).sure, "talabat “206 EGP only instead of 295” → an offer, never asked");
ok(U(yt).meaning === "notmoney" && U(yt).sure, "a YouTube video title with “$250,000” → not money, never asked");
ok(U(gmail).meaning === "paid", "the Google Play receipt (“you've been charged”) → a payment you made");
ok(U(wa).meaning === "work" && !U(wa).sure, "the wages group with the accountant → a GUESS: work talk (asked as “I think …”)");
ok(!L.understandNote(friend), "a friend's “I sent you 500” in a chat → not guessed (asked)");
ok(L.sourceOf(gmail).kind === "mail" && L.sourceOf(gmail).name === "Google Play", "an email's source is its sender (Google Play), never all of Gmail");
ok(!U({ ...gmail, text: "Your subscription will renew on 7 Dec — you'll be charged EGP 939.99" }).meaning, "a renewal that has NOT happened yet is not “paid”");
const payOf = (n) => readNotification(n, { teach: { rules: [] } });
// (v9.9.30: chats are asked about only when the person asks to teach Attune — this is that path)
const asks = L.asksFrom([uber, talabat, gmail, yt, wa, friend], { rules: [], asked: [], skip: [] }, { max: 9, payOf, teach: true });
ok(!L.asksFrom([wa, friend], { rules: [], asked: [], skip: [] }, { max: 9, payOf }).length, "v9.9.30: by itself, Attune never asks about the wages group or a friend's chat");
ok(!asks.some((a) => ["u", "t", "y"].includes(a.n.id)), "offers and videos are not in the questions (" + asks.map((a) => a.n.app).join(", ") + ")");
const pay = asks.find((a) => a.n.id === "g");
ok(pay && pay.why === "paid" && pay.pay.amount === 939.99 && pay.pay.direction === "out", "the receipt is asked as “You paid 939.99 EGP — add it to Money?”");
ok(L.asksFrom([gmail], { rules: [], asked: [], skip: [] }, { payOf: () => null }).length === 0, "…and not asked once it was added / dismissed / already in Money");
const g = asks.find((a) => a.n.id === "w");
ok(g && g.guess === "work", "the wages group comes with Attune's guess (work talk)");
ok(asks.find((a) => a.n.id === "f") && !asks.find((a) => a.n.id === "f").guess, "the friend's money is asked plainly");
ok(/emails from Google Play/i.test(L.understoodLabel({ kind: "label", meaning: "ignore", src: L.sourceOf(gmail) })), "“I understood” names the sender for an email");
// agents: each check says whether it beat the best before it
const chat = A.agentChat({ said: "x", created: 1, site: "Booking.com", checks: [{ at: 2, price: 43090 }, { at: 3, price: 42124 }, { at: 4, price: 42124 }, { at: 5, price: 45092 }, { at: 6, blocked: true }] });
const t = chat.filter((m) => m.who === "agent" && m.T).map((m) => m.T[0]);
ok(/^Checked: cheapest/.test(t[1]), "the first price is just “Checked”");
ok(/^New best/.test(t[2]) && chat.find((m) => m.better).T[1].x === 966, "a lower price → “New best — 966 less than the best before”");
ok(/same as your best/.test(t[3]), "the same price → “the same as your best”");
ok(/no better\. Your best is still/.test(t[4]) && chat.find((m) => m.T && /no better/.test(m.T[0])).T[1].b === 42124, "a higher price → “no better. Your best is still 42,124”");
{ const c3 = A.agentChat({ said: "x", created: 1, site: "Booking.com", checks: [{ at: 2, price: 41495 }, { at: 3, blocked: true }, { at: 4, blocked: true }] }), m = c3.find((x) => x.n === 2);
  ok(m && /Your best stays/.test(m.T[0]) && m.T[1].site === "Booking.com", "background misses say why (Booking.com shows prices only in a browser) and that the best stays"); }
// the table: the same 41,495 on the same days once
const offers = [{ name: "Booking.com", price: 41495, checkin: "2027-01-08", checkout: "2027-01-12", text: "a" }, { name: "Booking.com", price: 41495, checkin: "2027-01-08", checkout: "2027-01-12", text: "b" }, { name: "Booking.com", price: 42124, checkin: "2027-01-04", checkout: "2027-01-08" }];
ok(A.compareOffers(offers).rows.length === 2, "“Best found” shows the same 41,495 on 01/08 → 01/12 once (it showed it twice)");
ok(A.uniqueOffers([{ name: "Swissotel", price: 1, checkin: "a" }, { name: "Hilton", price: 1, checkin: "a" }]).length === 2, "two different hotels at the same price stay two");
// Ali: "why wasn't the Google subscription added to the dates by itself?" — the amount «ج.م.‏ ٩٣٩٫٩٩» (Arabic digits, Arabic decimal mark,
// a hidden direction mark) was read as 0, so Autopilot skipped it
ok(meaning(gmail).amount === 939.99, "«ج.م.‏ ٩٣٩٫٩٩/month» is read as 939.99 (it was 0)");
const sub = AP.suggestFrom(gmail, { now });
ok(sub && sub.kind === "subscription" && sub.title === "Google Gemini" && sub.amount === 939.99 && sub.cur === "EGP", "→ Autopilot: a Google Gemini / Google One subscription, 939.99 EGP (it found nothing): " + JSON.stringify(sub && [sub.title, sub.amount, sub.cur]));
ok(sub && sub.date.endsWith("-11-07"), "…on the day the receipt says it was paid (7 Nov), so the plan renews on the 7th: " + (sub && sub.date));
ok(AP.isAuto(AP.emptyState ? AP.emptyState() : { always: [], skipApps: [] }, sub), "…and it is added by itself (plan + Money, with Undo)");
ok(AP.paidDayOf("Order date: 7 Nov 2026 15:33:27 EET", Date.parse("2026-11-09")) === "2026-11-07" && AP.paidDayOf("no date", now) === "", "the paid day is read from the receipt, else the day it arrived");
if (fails) { console.log(fails + " failed"); process.exit(1); }
