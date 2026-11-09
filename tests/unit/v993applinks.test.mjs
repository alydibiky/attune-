// v9.9.3 W2 (Ali): open apps at the right screen; "Which Ahmed?" with Pick from contacts; Play-safe links only
import assert from "node:assert/strict";
import * as A from "../../web-src/applinks.js";
import { emptyDir, addCard } from "../../web-src/entities.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS " + m); };
let x = A.readOpen("send Ahmed 'I'm on my way' on WhatsApp");
ok(x && x.kind === "msg" && x.who === "Ahmed" && x.text === "I'm on my way" && x.app === "whatsapp", "“send Ahmed 'I'm on my way' on WhatsApp” → WhatsApp to Ahmed, the words written");
ok(A.readOpen("send Ahmed 'I'm on my way' tomorrow at 5") === null, "with a time it is a scheduled message (Messages), not this");
x = A.readOpen("ابعت لأحمد قوله انا جاي");
ok(x && x.kind === "msg" && /أحمد/.test(x.who) && x.text === "انا جاي", "«ابعت لأحمد قوله انا جاي» → WhatsApp to Ahmed: انا جاي");
ok(A.readOpen("call Mama").who === "Mama" && A.readOpen("كلم ماما").who === "ماما", "“call Mama” / «كلم ماما» → the dialer");
x = A.readOpen("uber to Cairo Festival City");
ok(x.kind === "ride" && x.dest === "Cairo Festival City" && A.linkOf(x).includes("dropoff%5Bformatted_address%5D") === false && A.linkOf(x).includes("Cairo%20Festival%20City"), "“uber to Cairo Festival City” → Uber's ride link with the destination");
ok(A.readOpen("directions to Fawzy El-Kababgy").kind === "maps" && A.linkOf(A.readOpen("directions to Fawzy El-Kababgy")).startsWith("https://www.google.com/maps/dir/"), "“directions to …” → Google Maps directions");
ok(A.readOpen("email Karim about the invoice").subject === "the invoice", "“email Karim about the invoice” → an email with the subject");
ok(A.linkOf({ kind: "msg", app: "whatsapp", text: "hi" }, "0100 123 4567") === "https://wa.me/201001234567?text=hi", "an Egyptian 010 number → wa.me/2010…");
ok(A.linkOf({ kind: "call" }, "+20 100 123 4567") === "tel:201001234567" || A.linkOf({ kind: "call" }, "+20 100 123 4567").startsWith("tel:"), "a call is tel: — the dialer opens, the person presses Call (no CALL_PHONE)");
// Which Ahmed?
let dir = emptyDir();
dir = addCard(dir, { name: "Ahmed Salah", aliases: ["Ahmed"], contact: { name: "Ahmed Salah", phone: "01001234567" } }).dir;
ok(A.whoFor("Ahmed", dir).card && A.whoFor("Ahmed", dir).card.name === "Ahmed Salah", "one Ahmed with a number → sure");
dir = addCard(dir, { name: "Ahmed work", aliases: ["Ahmed"], contact: { name: "Ahmed Work", phone: "01111111111" } }).dir;
let w = A.whoFor("Ahmed", dir);
ok(w.ask && w.ask.length === 2, "two Ahmeds → asks “Which Ahmed?” with both (and Pick from contacts)");
dir = A.rememberPick(dir, w.ask[0].id, "Ahmed");
ok(A.whoFor("Ahmed", dir).card && A.whoFor("Ahmed", dir).card.id === w.ask[0].id, "after the pick, “Ahmed” = that one next time");
ok(A.whoFor("Karim", dir).ask && A.whoFor("Karim", dir).ask.length === 0, "a name not saved → asks with only Pick from contacts");
console.log("ALL PASSED v993applinks (" + n + " checks)");
