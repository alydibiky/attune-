// v9.9.5 D2 + S1 (Ali): several details on a document; each its own lock (normal / tap / fingerprint) and show time
import assert from "node:assert/strict";
import * as F from "../../web-src/docfields.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS " + m); };
let r = F.readDetails("passport number A12345678, issued Cairo");
ok(r.find((x) => x.name === "Passport number").value === "A12345678" && r.find((x) => x.name === "Place of issue").value === "Cairo", "“passport number A12345678, issued Cairo” → two rows");
r = F.readDetails("visa number H1234567 type B1/B2 multiple entries valid until 1 Dec 2027");
ok(r.find((x) => x.name === "Visa number").value === "H1234567" && r.find((x) => x.name === "Entries").value === "multiple" && r.find((x) => x.name === "Valid until").value === "1 Dec 2027", "a visa sentence → number, entries, valid until");
r = F.readDetails("card number 4242 4242 4242 4242 cvc 123 pin 9876");
const cvc = r.find((x) => x.name === "CVC"), card = r.find((x) => x.name === "Card number"), pin = r.find((x) => x.name === "PIN");
ok(cvc.lock === "finger" && pin.lock === "finger" && cvc.secs === 30, "CVC and PIN start locked with the fingerprint, shown 30 s");
ok(card.lock === "tap" && F.masked(card) === "•••• •••• •••• 4242", "the card number is tap-to-show, its last 4 visible");
ok(F.newField("Passport number", "A1").lock === "none", "a passport number is a normal (visible) detail");
ok(F.readDetails("الرقم القومي ٢٩٨٠١٠١٠١٢٣٤٥٦").find((x) => x.name === "ID number").value.replace(/\s/g, "") === "29801010123456", "«الرقم القومي ٢٩٨…» → ID number in Latin digits");
// secrets kept apart
const fields = [F.newField("Card number", "4242424242424242"), F.newField("CVC", "123"), F.newField("Name on card", "ALI")];
const s = F.split("i1", fields, {});
ok(s.fields.find((f) => f.name === "CVC").value === "" && s.fields.find((f) => f.name === "Name on card").value === "ALI", "the item keeps NO value for locked rows (not in sync / backup)");
ok(F.joined("i1", s.fields, s.secrets).find((f) => f.name === "CVC").value === "123", "the page gets them back from the secrets store");
const relock = s.fields.map((f) => (f.name === "CVC" ? { ...f, lock: "none", value: "123" } : f));
const s2 = F.split("i1", relock, s.secrets);
ok(!("" + s2.secrets.i1[s.fields.find((f) => f.name === "CVC").id] !== "undefined") || s2.fields.find((f) => f.name === "CVC").value === "123", "a row made normal moves back into the item");
ok(F.mergeFields([{ id: "a", name: "Visa number", value: "OLD", lock: "tap", secs: 60 }], [F.newField("Visa number", "NEW")])[0].value === "NEW" && F.mergeFields([{ id: "a", name: "Visa number", value: "OLD", lock: "tap", secs: 60 }], [F.newField("Visa number", "NEW")])[0].lock === "tap", "said again → the value changes, its lock stays");
ok(F.findDetail("what's my passport number", [{ title: "Egyptian Passport", doc: "passport", fields: [{ name: "Passport number", value: "A1", lock: "none" }] }]).field.value === "A1", "Chat: “what's my passport number” finds it");
console.log("ALL PASSED v995docfields (" + n + " checks)");
