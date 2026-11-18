// v10.6 — Ali, 18 Nov: "the app is still not smart enough" — what his screenshots showed, each kept as a test:
//  · "I see «ما يخص المرتبات» often in WhatsApp. Who is this? My wife · Family…" — a GROUP's name was asked as a person;
//  · Autopilot: "New chat · Orders — Not sure what Orders is yet" (and «الطلبات» read as a shopping list, which he corrected on 17 Nov);
//  · "Arriving · Supplexon — order #2812 has been delivered …" twice (out for delivery + delivered), the text repeated and cut.
import * as NT from "../../web-src/noteteach.js";
import * as CR from "../../web-src/chatroles.js";
import { parcelLine } from "../../web-src/daynotes.js";
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const wa = (title, x = {}) => NT.personOf({ app: "WhatsApp", pkg: "com.whatsapp", title, text: "…", ...x });
ok(wa("ما يخص المرتبات") === "" && wa("صيانة الاوناش في الضبعة") === "" && wa("Orders") === "", "a chat's name is never asked as a person");
ok(wa("Dibiki Dabaa", { group: true, who: "Omar" }) === "Omar", "in a group, the person is who wrote");
ok(wa("Nada") === "Nada" && wa("Sara Ali") === "Sara Ali" && wa("Mama") === "Mama", "people's names still are");
const now = Date.now(), notes = [1, 2, 3, 4].map((i) => ({ app: "WhatsApp", pkg: "com.whatsapp", title: "ما يخص المرتبات", text: "Ahmed: " + i, ts: now - i * 6e4, group: true, who: "Ahmed Abd El Mo8ees" }));
const q = NT.whoAsk(notes, { items: [] }, { asked: [], skip: [] }, now);
ok(!q || q.name !== "ما يخص المرتبات", "Home never asks “who is ما يخص المرتبات”: " + JSON.stringify(q));
for (const nm of ["Orders", "orders", "الطلبات", "طلباتي", "My orders"]) ok(CR.readDescription(nm).role === "orders" && CR.guessRole({ chat: nm, group: true }, []).role === "orders", "a chat named “" + nm + "” = a record of the orders you buy");
ok(CR.readDescription("Shopping").role === "shopping" && CR.readDescription("طلبات البيت").role === "shopping", "…a shopping list is still a shopping list");
const a = parcelLine({ app: "Supplexon", title: "Supplexon", ts: 2 }, "A shipment from order #2812 has been delivered Supplexon Order #2812 Your order has been delivered Haven't received your");
const b = parcelLine({ app: "Supplexon", title: "Supplexon", ts: 1 }, "A shipment from order #2812 is out for delivery Supplexon Order #2812 Your order is out for delivery");
ok(a.key === b.key && a.state === "delivered" && b.state === "coming", "the same order is one line; delivered says Delivered");
ok(a.text === "Supplexon — A shipment from order #2812 has been delivered", "one clean sentence: " + a.text);
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`);
