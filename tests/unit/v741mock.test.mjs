// v6.41 S5: the scored mock interview — pace, structure, fillers, confidence, the scorecard, the better-answer prompt.
import * as J from "../../web-src/jobready.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
ok(J.pace(150, 60).wpm === 150 && J.pace(150, 60).verdict === "good" && J.pace(60, 60).verdict === "slow" && J.pace(220, 60).verdict === "fast", "pace: 150 wpm good, 60 slow, 220 fast");
const strong = "When I was at my last job there was a problem with late deliveries. I decided to build a simple tracking sheet and I called every driver each morning. As a result we cut late deliveries by 40% in two months and the client renewed the contract. I also trained two colleagues to keep it going after I moved to another project, so the result stayed.";
const weak = "Um, I think, like, I am good with people, you know, maybe I can, um, kind of help the team.";
const s1 = J.scoreAnswer(strong, 28), s2 = J.scoreAnswer(weak, 20);
ok(s1.structure === 100 && s1.confidence === 100 && s1.total > 80, "a story with a number, no hedging: structure 100, total " + s1.total);
ok(s2.structure < 40 && s2.fillersScore < 50 && s2.hedges >= 3 && s2.total < 40, "fillers + 'I think / maybe / kind of': low scores, total " + s2.total);
ok(J.scoreAnswer(strong, 0).paceScore === null, "no timing → pace not scored (not guessed)");
const c = J.scorecard([{ score: s1 }, { score: s2 }], "en");
ok(c.n === 2 && c.weakest && c.tip.length > 10, "scorecard: the weakest part and one tip: " + c.weakest);
ok(J.scorecard([], "en") === null, "no answers → no scorecard");
const p = J.betterAnswerPrompt("Tell me about a problem you solved", weak, "ar");
ok(/ONLY facts/.test(p[0].content) && /\[number\]/.test(p[0].content) && /Egyptian Arabic/.test(p[0].content), "the better answer uses only their facts; a missing number is left as [number]");
console.log(bad ? bad + " FAILED" : "v741mock ok");
