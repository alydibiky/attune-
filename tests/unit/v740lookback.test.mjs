// v6.40 Recall (agent C): one search over screenshots, kept notifications, chats, Mind, saved pages and payments — by meaning,
// with dates, kinds and apps taken from the question. Pure (web-src/lookback.js).
import * as L from "../../web-src/lookback.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
const NOW = new Date(2026, 9, 18, 15, 0).getTime(), D = 86400000;
const memory = [
  { id: "s1", kind: "photo", title: "Screenshot", text: "Network: Nour_Home\nPassword: 7781 2290 a", ts: NOW - 9 * D, meta: { thumb: true } },
  { id: "s2", kind: "photo", title: "Carrefour", text: "CARREFOUR MAADI\nTotal EGP 1,245.50\nThank you", ts: NOW - 40 * D, meta: { thumb: true } },
  { id: "m1", kind: "note", title: "Crane hire", text: "Tadano 50 t for Hassan, 18,000 a day", ts: NOW - 3 * D },
];
const notes = [
  { id: "n1", pkg: "com.whatsapp", app: "WhatsApp", title: "Ahmed", text: "العنوان: ١٢ شارع ٩ المعادي، الدور التالت", ts: NOW - 2 * D },
  { id: "n2", pkg: "com.google.android.gm", app: "Gmail", title: "EgyptAir", text: "Your booking MS 985 Cairo – Dubai, 2 Nov 08:40", ts: NOW - 5 * D },
  { id: "n3", pkg: "com.whatsapp", app: "WhatsApp", title: "Mona", text: "متنساش ميعاد الدكتور بكره الساعة ٧", ts: NOW - 1 * D - 3600e3 },
];
const chats = [{ id: "c1", title: "AC repair", updated: NOW - 20 * D, messages: [{ text: "The technician said the AC compressor warranty is 5 years" }] }];
const pages = [{ id: "a1", title: "Water tracker", updated: NOW - 4 * D, versions: [{ content: "<h1>Water tracker</h1><p>cups today</p>" }] }];
const pays = [{ id: "p1", app: "CIB", title: "CIB", text: "Purchase EGP 600.00 at KHEIR ZAMAN", ts: NOW - 6 * D, pkg: "com.cib.mobile" }];
const docs = L.recallDocs({ memory, notes, chats, pages, pays });
ok(docs.length === 9 && docs.filter((d) => d.kind === "photo").length === 2, "one list: 2 screenshots, 1 Mind note, 3 notifications, 1 chat, 1 page, 1 payment");
const top = (q) => { const r = L.recallSearch(docs, q, { now: NOW }); return r.hits[0] && r.hits[0].doc.id; };
ok(top("the wifi password from the screenshot") === "m:s1", "“the wifi password from the screenshot” → the router screenshot");
ok(top("باسورد الواي فاي") === "m:s1", "«باسورد الواي فاي» → the same screenshot (the text says Password)");
ok(top("كلمة السر") === "m:s1", "«كلمة السر» means password");
ok(top("العنوان اللي أحمد بعته على الواتس") === "n:n1", "«العنوان اللي أحمد بعته على الواتس» → Ahmed's WhatsApp");
ok(top("Ahmed's address") === "n:n1", "“Ahmed's address” (English) finds the Arabic message: address = العنوان");
ok(top("flight ticket to Dubai") === "n:n2", "“flight ticket to Dubai” → the EgyptAir booking email");
ok(top("حجز الطيارة") === "n:n2", "«حجز الطيارة» → the booking");
ok(top("doctor appointment") === "n:n3", "“doctor appointment” → Mona's «ميعاد الدكتور»");
ok(top("Carrefour receipt") === "m:s2", "“Carrefour receipt” → the receipt photo");
ok(top("فاتورة كارفور") === "m:s2" || top("فاتورة carrefour") === "m:s2", "«فاتورة carrefour» → the receipt photo");
ok(top("AC warranty") === "c:c1", "“AC warranty” → the chat about the compressor");
ok(top("ضمان التكييف") !== "n:n1", "a word Recall doesn't know is not forced onto something unrelated");
ok(top("Tadano crane") === "m:m1", "Mind notes are found too");
ok(top("water tracker") === "a:a1", "saved pages are found too");
ok(top("600 Kheir Zaman") === "p:p1", "a payment by its amount and shop");
// filters
let r = L.recallSearch(docs, "screenshots last month", { now: NOW });
ok(r.ask.kind === "photo" && r.hits.length === 1 && r.hits[0].doc.id === "m:s2", "“screenshots last month” → only the September receipt (" + r.hits.map((h) => h.doc.id) + ")");
r = L.recallSearch(docs, "واتس امبارح", { now: NOW });
ok(r.hits.length === 1 && r.hits[0].doc.id === "n:n3", "«واتس امبارح» → only yesterday's WhatsApp");
r = L.recallSearch(docs, "gmail", { now: NOW });
ok(r.hits.length === 1 && r.hits[0].doc.id === "n:n2", "an app name alone lists that app's notifications");
r = L.recallSearch(docs, "in September", { now: NOW });
ok(r.ask.from === new Date(2026, 8, 1).getTime() && r.hits.every((h) => new Date(h.doc.ts).getMonth() === 8), "a month name → that month");
r = L.recallSearch(docs, "from 2 days ago", { now: NOW });
ok(r.hits.length === 1 && r.hits[0].doc.id === "n:n1", "“2 days ago” → that day");
ok(L.parseAsk("the code of the wifi", NOW).terms.join(",") === "code,wifi", "glue words are dropped: " + L.parseAsk("the code of the wifi", NOW).terms);
ok(L.recallSearch(docs, "", { now: NOW }).hits[0].doc.id === "n:n3", "an empty search lists the newest first");
ok(/Password/.test(L.recallSearch(docs, "wifi password", { now: NOW }).hits[0].snip), "the line that matched is shown");
ok(L.shotTitle("12:45\n5G\nCARREFOUR MAADI\nTotal") === "CARREFOUR MAADI", "a screenshot's title skips the clock: " + L.shotTitle("12:45\n5G\nCARREFOUR MAADI\nTotal"));
// Arabic digits and joined letters
ok(L.fold("١٢ شارع") === "12 شارع" && top("بالفاتورة") === "m:s2", "Arabic digits fold to 0-9; «بالفاتورة» (joined letters) finds the receipt that says Total");
{ const d2 = L.recallDocs({ notes: [{ id: "w", pkg: "com.whatsapp", app: "WhatsApp", title: "Omar", text: "باسورد الواي فاي الجديد: nour2026", ts: NOW - D }] });
  ok(L.recallSearch(d2, "wifi", { now: NOW }).hits.length === 1, "“wifi” finds a message that says «الواي فاي» (two words)"); }
console.log(bad ? bad + " FAILED" : "v740lookback ok");
