// v10.8 (Ali, 21 Nov 2026: "any notification is to do even if it's not that important" — Mr.Beard's WhatsApp advert «📷 تخيل بوكس فيه كل
// اللي ممكن تحتاجه … عليه خصم ٥٠٪» became a late to-do). An advert in a one-to-one chat is kept quietly ("offer" noise); «ممكن تحتاجه»
// is "you might need it", not "could you"; a person's request that mentions a discount is still a to-do. 2,500 hardened, composed
// cases of tests/chats/offers.mjs (the full run is 10,000, held-out 10,000) must stay at 99.5 % or better.
process.env.N = "2500";
const { result } = await import("../chats/offers.mjs");
const { decide } = await import("../../web-src/autopilot2.js");
const { noiseOf } = await import("../../web-src/chats.js");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const mrBeard = { id: "b1", app: "WhatsApp", pkg: "com.whatsapp", title: "Mr.Beard", text: "📷 تخيل بوكس فيه كل اللي ممكن تحتاجه عشان تهتم بنفسك و كمان عليه خصم ٥٠٪ لو ع", ts: 1763700000000 };
ok(noiseOf(mrBeard.text) === "offer", "Ali's Mr.Beard advert is an advert");
ok(decide(mrBeard, {}).kind === "keep", "… kept quietly, never a to-do");
ok(decide({ ...mrBeard, title: "Mama", text: "ممكن تبعتلي اللوكيشن؟" }, {}).kind === "todo", "Mama's «ممكن تبعتلي اللوكيشن؟» is still a to-do");
ok(decide({ ...mrBeard, title: "Noudy", text: "the jackets are 30% off, can  you pick one up for Omar?" }, {}).kind === "todo", "a request that mentions a discount (and two spaces) is still a to-do");
ok(result.pass / result.N >= 0.995, `2,500 composed cases: ${result.pass}/${result.N}`);
ok(result.share >= 0.6, "the cases are varied (≥ 60 % different shapes): " + (100 * result.share).toFixed(1) + "%");
console.log(fail ? `FAIL ${fail}/${n}` : `PASS v1080offers ${n}/${n}`); process.exit(fail ? 1 : 0);
