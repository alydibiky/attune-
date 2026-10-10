// v6.16c — Arabic questions about a country search the English place packs too (Intl region names), and one dictionary entry
// at most reaches the model (its near-identical entries had pushed the physics textbook out of «Newton's second law»).
const K = await import("../../web-src/knowledge.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
ok(/Kazakhstan/.test(K.withEnglishPlaces("ما هي عاصمة كازاخستان؟")) && /capital/.test(K.withEnglishPlaces("ما هي عاصمة كازاخستان؟")), "«عاصمة كازاخستان» also searches «Kazakhstan capital»");
ok(/Saudi Arabia population/.test(K.withEnglishPlaces("كم سكان السعودية")) && /United Arab Emirates currency/.test(K.withEnglishPlaces("عملة الإمارات")), "short names people type (السعودية، الإمارات) work");
ok(K.withEnglishPlaces("متى صلاة المغرب؟") === "متى صلاة المغرب؟" && K.withEnglishPlaces("ما كفارة اليمين؟") === "ما كفارة اليمين؟", "the sunset prayer is not Morocco, an oath (اليمين) is not Yemen");
ok(K.withEnglishPlaces("What is the capital of Egypt?") === "What is the capital of Egypt?", "English questions are searched as typed");
const m = K.mergePackFacts([], [{ id: 1, pack: "dictionary", title: "Dictionary — Newton's second law of motion", text: "the rate of change of momentum is proportional to the force.", score: 10, cov: 1 },
  { id: 2, pack: "dictionary", title: "Dictionary — second law of motion", text: "same as Newton's second law.", score: 9, cov: 1 },
  { id: 3, pack: "physics", title: "University Physics — Newton's Second Law", text: "The net force equals mass times acceleration: F = ma.", score: 8, cov: 1 }], { question: "Newton's second law" });
ok(m.length === 2 && m.map((h) => h.chunk.pack).join() === "dictionary,physics", "one dictionary entry, then the textbook");
const kn = K.createKnowledge(K.memoryStore()); let asked = "";
kn.packSearch = async (q) => { asked = q; return [{ id: "c:1", pack: "cities", title: "Kazakhstan — country facts (GeoNames)", text: "Kazakhstan: capital Astana; currency Tenge (KZT).", score: 5, cov: 1 }]; };
const h = await kn.find("ما هي عاصمة كازاخستان؟");
ok(/Kazakhstan capital/.test(asked) && h.some((x) => /Astana/.test(x.chunk.text)), "find() searches the phone's packs with the English names and returns the capital");
console.log(fail ? `v728packfix: ${fail} FAILED` : "v728packfix ok");
