// v6.35 Ali's phone list of 18 Oct: lesson conversation on Blaze, Solve the questions, Lynk & Co 08 vs 900, a looping answer,
// Scout (exact year, category pages, impossible prices, typos)
import * as SP from "../../web-src/speak.js";
import * as Q from "../../web-src/docqa.js";
import * as R from "../../web-src/research.js";
import { tidyAnswer } from "../../web-src/answerfix.js";
import * as S from "../../web-src/scout.js";
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

// 1. the lesson conversation, however the model writes it
const cut = SP.parseDialogue('```json\n{"title":"Café","lines":[{"who":"Ayşe","text":"Merhaba!","say":"Hi"},{"who":"Mehmet","text":"Merhaba","say":"Hi"},{"who":"Ayşe","text":"Nasılsın?","say":"How are you"},{"who":"Mehmet","text":"İyiyim","say":"Fine"},{"who":"Ayşe","text":"Çay ist');
ok(cut && cut.lines.length === 4 && cut.lines[0].who === "A" && cut.lines[1].who === "B", "JSON cut off by the limit + names instead of A/B → 4 lines, A/B");
const plain = SP.parseDialogue("**A:** Merhaba! (Hello!)\n**B:** Merhaba, nasılsın? (Hi, how are you?)\nA: İyiyim, teşekkürler. — I am fine, thanks.\nB: Ben de iyiyim.\n(I am fine too.)");
ok(plain && plain.lines.length === 4 && plain.lines[3].say === "I am fine too.", "plain 'A: … (meaning)' lines are read, a meaning on its own line too");
ok(SP.parseDialogue('{"lines":[{"who":"A","text":"x",}],}') === null, "too short stays none (and a trailing comma doesn't throw)");
ok(/A: <the line/.test(SP.dialogueMessages({ topic: "Turkish", level: "beginner", lang: "en" }, { title: "Greetings" }, true)[0].content), "the second try asks for plain lines");

// 2. Solve the questions: found by code
const idx = Q.buildIndex([{ n: 1, text: "Biotech assignment. 1. Calculate the yield coefficient if 10 g glucose give 4 g biomass. 2. Explain why it differs from the theory?" }, { n: 2, text: "3) Estimate qs using mu = 0.2 1/h.\n4. Distinguish it from the reactor rate." }]);
const qs = Q.questionsOf(idx);
ok(qs.length === 4 && qs[2].page === 2 && /Estimate/.test(qs[2].text), "four questions found across two pages, one long PDF line split: " + qs.map((q) => q.n + "@p" + q.page).join(" "));
ok(Q.questionsOf(Q.buildIndex([{ n: 1, text: "Introduction\n1. Background\n2. Methods" }])).length === 0, "numbered headings are not questions");
ok(/one question below/.test(Q.solveOneMessages("Solve the questions", qs[0], "page text")[0].content), "each one solved on its own, with its page");

// 3. Lynk & Co 900: a page about the 08 is not about the 900
const q = "Lynk & Co 900 price and specs";
ok(!R.onTopic({ title: "Lynk & Co 08 review", url: "https://x.com/lynk-co-08", text: "The Lynk & Co 08 … 1,900,000 EGP" }, q), "a page about the 08 is left out");
ok(R.onTopic({ title: "New flagship SUV", url: "https://x.com/news", text: "The Lynk & Co 900 has 730 hp" }, q), "a page that names the 900 is used");
ok(R.onTopic({ title: "Hyundai Tucson price", url: "https://x.com/t", text: "Tucson" }, "Hyundai Tucson 2022 price"), "a year is not a model number (stays optional)");

// 4. an answer that starts again is cut
const loop = tidyAnswer("**Comparison:** The Lynk & Co 900 has 730 hp [10], while others have less. The 9 **Comparison:** The Lynk");
ok(loop === "**Comparison:** The Lynk & Co 900 has 730 hp [10], while others have less.", "the repeated '**Comparison:**' and the cut-off words go: " + JSON.stringify(loop));
ok(tidyAnswer("Line one.\nSecond line here.") === "Line one.\nSecond line here.", "lines stay lines");

// 5. Scout: Hyundai Tuscon 2022 used price
const g = S.parseGoal("Hyundai Tuscon 2022 used price");
ok(g.wish.some((w) => w.k === "year" && w.min === 2022 && w.max === 2022), "a plain year in a car goal is THAT year");
ok(!S.isAdPage("https://www.dubizzle.com.eg/en/vehicles/cars-for-sale/hyundai/tucson/", "Browse cars price 151 EGP", "Hyundai Tuscon - Vehicles for sale in Egypt | dubizzle"), "a category page is not an ad");
const a27 = S.readAd({ url: "https://www.dubizzle.com.eg/en/ad/x-ID1.html", title: "Hyundai Tucson 2027", text: "Hyundai Tucson model 2027, price 151 EGP views, asking price EGP 2,100,000" }, g);
ok(a27.facts.price === 2100000, "151 EGP is not a car's price; the real one is used: " + a27.facts.price);
ok(S.check(a27, g).out, "a 2027 car is out for a 2022 goal");
const a22 = S.readAd({ url: "https://www.dubizzle.com.eg/en/ad/x-ID2.html", title: "Hyundai Tucson 2022 used", text: "Hyundai Tucson model 2022, used, asking price EGP 1,450,000" }, g);
ok(!S.check(a22, g).out && S.check(a22, g).score >= 75, "the 2022 Tucson matches although the goal says 'Tuscon'");
ok(S.close1("tuscon", "tucson") && S.close1("tucson", "tuson") && !S.close1("tucson", "kona"), "one letter off or two swapped = the same word");

if (fails) { console.log(fails + " FAILED"); process.exit(1); } else console.log("ALL PASSED");
