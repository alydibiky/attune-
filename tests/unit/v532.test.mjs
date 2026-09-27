// Unit tests for v5.32: web answers repaired by code (Ali's Winner Sky and Lynk & Co answers).
import { repairFigures, tidyAnswer, gapsOf } from "../../web-src/answerfix.js";
import { estTokens } from "../../web-src/longread.js";
import { rulesOf, violations } from "../../web-src/constraints.js";
import { placeFor } from "../../web-src/places.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

const src = [
  { title: "Winner Sky W06", text: "The W06 has a 200W motor and a 48V 15Ah battery." },
  { title: "Lynk & Co 90 revealed", text: "The Lynk & Co 90 is a six-seater built on next-gen SPA Evo. Second-row seats rotate 180 degrees. The roof rack supports 75kg while driving. The 90 features lidar and 4D radar." },
  { title: "Winner Sky V10", text: "The V10 features 10-inch pneumatic dirt tires (80/65-6), reaches speeds of up to 45 km/h and has a range of 40 km on a single charge." },
];

eq(repairFigures("* It features 0-inch pneumatic dirt tires [3].", src).text, "* It features 10-inch pneumatic dirt tires [3].", "a dropped digit is put back from the cited source (0-inch → 10-inch)");
eq(repairFigures("* It has a range of 4 km on a single charge [3].", src).text, "* It has a range of 40 km on a single charge [3].", "4 km → 40 km (same unit in the cited source)");
eq(repairFigures("* Speeds of up to 45 km/h [3].", src).text, "* Speeds of up to 45 km/h [3].", "a correct figure is left alone");
eq(repairFigures("* The roof rack supports 0kg while driving [2].", src).text, "* The roof rack supports 75kg while driving [2].", "0kg → 75kg");
eq(repairFigures("* The 0 features lidar [2].", src).text, "* The 90 features lidar [2].", "no unit: the words around it find the figure (The 0 features → The 90 features)");
eq(repairFigures("* It is a sixseater on a nextgen platform [2].", src).text, "* It is a six-seater on a next-gen platform [2].", "glued words get their source spelling back");
eq(repairFigures("* Seats rotate180degrees [2].", src).text, "* Seats rotate 180 degrees [2].", "rotate180degrees → rotate 180 degrees");
eq(repairFigures("* It has a range of 4 km [1].", src).text, "* It has a range of 40 km [1].", "a wrong citation: the figure is found in the other sources");
eq(repairFigures("* Top speed 45 km/h [1].", src).text, "* Top speed 45 km/h [1].", "a right figure with a wrong citation is left alone");
eq(repairFigures("* A 200W motor [1] and 48V [1].", src).fixed, [], "nothing to fix → nothing changed");
eq(repairFigures("* It costs 999 dollars [1].", src).text, "* It costs 999 dollars [1].", "a figure with no single match stays (the audit flags it instead)");

eq(tidyAnswer("**Winner Sky (V10)**** has LED lights [3]."), "**Winner Sky (V10)** has LED lights [3].", "broken bold (****) is repaired");
eq(tidyAnswer("Good scooters [1][2, 3, 5][5]."), "Good scooters [1][2][3][5].", "citation lists become chips; repeats go");
eq(tidyAnswer("* A is fast [3].\n* A is fast [3].\n* B is slow [4]."), "* A is fast [3].\n* B is slow [4].", "a repeated bullet is dropped");
eq(tidyAnswer("Intro.\n* The passages do not provide specific prices in USD [3].\n* The passages do not provide detailed specs for all trims [].\n* Real fact [1]."), "Intro.\n* Real fact [1].", "'the passages do not provide…' lines are removed");
eq(tidyAnswer("| Version | Motors | Output | Range |\n| :--- | :--- |\n| Mid | dual | 50kW |"), "| Version | Motors | Output | Range |\n| --- | --- | --- | --- |\n| Mid | dual | 50kW | — |", "table rows match the header");

eq(gapsOf("Lynk & Co 90 detailed specs, all trims and prices in USD", "It has 630kW [5]."), ["price", "trims versions", "specifications"], "missing price / trims / specs are found");
eq(gapsOf("price of the Lynk & Co 90", "It costs $45,000 [2]."), [], "a price with a currency is not a gap");
eq(gapsOf("مواصفات وسعر لينك 90", "القوة 630 كيلوواط"), ["سعر", "المواصفات"], "Arabic gaps search in Arabic");

eq(estTokens("Trim | 180 kW | 350 Nm | 1,293 mm") > estTokens("The quick brown fox jumps over it"), true, "number-heavy text counts as more tokens than prose of the same length");

const ask = "Write a four-sentence product pitch for an autonomous drone delivery network. Rules:\nDo not use the letter 'e' anywhere in the response.\nEvery sentence must contain exactly eight words.\nDo not include numbers or symbols.";
eq(rulesOf(ask), { noLetters: ["e"], wordsPerSentence: 8, sentences: 4, noDigits: true, noSymbols: true }, "Ali's rules are read from the request");
const good = "Our drones bring your parcels to you fast. A smart flying unit avoids traffic and walls. It lands softly on your porch or roof. Join now and watch your mail zip in.";
eq(violations(good, rulesOf(ask)).filter((v) => !/letter/.test(v)), [], "a pitch with 4 sentences of 8 words and no digits passes the counts");
eq(violations("Drones deliver everything. Fast!", rulesOf(ask)).length >= 3, true, "breaking the rules is caught: the letter e, sentence count, word count");
eq(violations("Quick drops at 5 pm.", { noDigits: true }), ["it contains digits"], "digits are caught");
eq(rulesOf("What is the capital of France?"), null, "an ordinary question has no rules");

const pf = placeFor("I want to go to fuel up and I am at emerald park compound now what shall i do");
eq(pf && pf.query, "gas station near emerald park compound", "Ali's fuel question becomes a map search near where he is");
eq(!!(pf && pf.url.startsWith("https://www.google.com/maps/search/")), true, "…one tap to Google Maps");
eq((placeFor("أقرب صيدلية فين؟") || {}).query, "صيدلية قريبة", "Arabic: nearest pharmacy");
eq(placeFor("Summarise this text about pharmacy law"), null, "no place request → no map button");

if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
