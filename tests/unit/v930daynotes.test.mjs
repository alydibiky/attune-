// v9.3 (Ali, 5 Nov 2026: "WhatsApp messages, YouTube, Instagram, SMS notifications — it will help in planning my day") — the kept
// notifications → the day, on the phone, by code.
import * as D from "../../web-src/daynotes.js";
import * as S from "../../web-src/dayset.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const now = new Date("2026-11-05T13:00:00").getTime(), h = 36e5;
const N = (pkg, app, title, text, ago) => ({ id: pkg + ago, pkg, app, title, text, ts: now - ago * h });
const notes = [
  N("com.whatsapp", "WhatsApp", "Ahmed", "can we meet tomorrow at 5?", 1),
  N("com.whatsapp", "WhatsApp", "Ahmed", "I'll bring the papers", 2),
  N("com.whatsapp", "WhatsApp", "Family: Mama", "تعالى بكرة الساعة ٨ نتعشى", 3),
  N("com.google.android.apps.messaging", "Messages", "CIB", "Purchase of EGP 450 at Carrefour", 4),
  N("com.google.android.apps.messaging", "Messages", "Aramex", "Your shipment is out for delivery today", 5),
  N("com.instagram.android", "Instagram", "sara_m", "liked your photo", 2), N("com.instagram.android", "Instagram", "omar", "started following you", 6),
  N("com.google.android.youtube", "YouTube", "Veritasium", "New video: The 5 most important numbers", 7),
  N("com.whatsapp", "WhatsApp", "WhatsApp", "12 messages from 4 chats", 1),
  N("com.whatsapp", "WhatsApp", "Old friend", "see you on Friday at 9pm?", 40),          // two days ago: asked, still ahead
  N("com.whatsapp", "WhatsApp", "Karim", "ok thanks", 30),                                 // yesterday: not today's people
];
const d = D.dayFromNotes(notes, { now });
ok(d.people.map((p) => p.who).join(",") === "Ahmed,Mama,Aramex" && d.people[0].n === 2 && d.people[1].group === "Family", "who wrote today: Ahmed (2), Mama (in Family), Aramex — not the bank's payment, not yesterday's: " + d.people.map((p) => p.who + "×" + p.n).join(" "));
ok(d.asks.length === 3 && d.asks[0].who === "Ahmed" && new Date(d.asks[0].at).getHours() === 17 && d.asks[1].who === "Mama" && new Date(d.asks[1].at).getHours() === 20, "asked at a time → Ahmed tomorrow 5, Mama tomorrow 8 pm («بكرة الساعة ٨ نتعشى» — dinner is the evening): " + d.asks.map((a) => a.who + "@" + new Date(a.at).toISOString().slice(5, 16)).join(" "));
ok(d.asks[2].who === "Old friend", "…and what was asked 2 days ago for a day still ahead");
ok(d.arriving.length === 1 && /out for delivery/.test(d.arriving[0].text), "arriving today: the Aramex shipment");
ok(d.counts.social === 2 && d.counts.video === 1 && d.counts.sms === 2 && !("undefined" in d.counts), "everything else is counted by kind: Instagram 2, YouTube 1, SMS 2");
ok(!d.people.some((p) => /messages from/.test(p.last)) && d.total === 8, "a “12 messages from 4 chats” summary is not a message (8 today, the summary left out)");
const off = D.dayFromNotes(notes, { now, offApps: ["com.whatsapp"] });
ok(!off.people.some((p) => p.kind === "chat") && !off.asks.some((a) => a.app === "WhatsApp"), "an app left out in Settings is not read for the day");
const r = D.reminderFromAsk(d.asks[0]);
ok(r.at === d.asks[0].at && r.title === "Ahmed: can we meet tomorrow at 5?" && r.repeat === "none", "Add → a reminder at that time with who and what");
ok(D.kindOf("com.unknown.app", "Gmail Go") === "email" && D.kindOf("x", "My Messages") === "sms" && D.kindOf("com.instagram.android") === "social", "the kind of an app by its package, else by its name");
ok(D.senderOf({ pkg: "com.google.android.gm", app: "Gmail", title: "Amazon.eg <ship@amazon.eg>" }).who === "Amazon.eg", "an email sender without the address");
// settings: off by default, cleaned
ok(S.DAYSET_DEFAULTS.prayers === false && S.DAYSET_DEFAULTS.ramadan === false && S.DAYSET_DEFAULTS.simple === false, "prayer times, Ramadan and simple mode are OFF until the person turns them on (global app)");
ok(JSON.stringify(S.cleanDayset({ prayers: true, evening: 99, offApps: ["a", 3], evil: "<x>" })) === JSON.stringify({ ...S.DAYSET_DEFAULTS, prayers: true, offApps: ["a"] }), "settings are cleaned (no unknown keys, nothing out of range)");
