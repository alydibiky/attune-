// v6.41 H2: what a voice call says aloud — sentences, no markdown / code / tables / links, an end word.
import * as V from "../../web-src/voicecall.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
const s = V.sayable("**Sure!** The nearest pharmacy is El Ezaby [1]. It closes at 11 pm.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nSee https://x.com/y for more.");
ok(s[0] === "Sure!" && s[1] === "The nearest pharmacy is El Ezaby." && s[2] === "It closes at 11 pm." && s[s.length - 1] === "The details are on the screen.", "sentences, no ** or [1]; the table and link become one note: " + JSON.stringify(s));
ok(!s.some((x) => /\||https/.test(x)), "nothing of the table or the link is read out");
const ar = V.sayable("أكيد. أقرب صيدلية العزبي، وبتقفل الساعة ١١.\n```js\nx=1\n```", true);
ok(ar.length === 3 && ar[0] === "أكيد." && ar[2] === "التفاصيل على الشاشة.", "Arabic: sentences, code → «التفاصيل على الشاشة»: " + JSON.stringify(ar));
const long = V.sayable("word ".repeat(120).trim() + ".");
ok(long.every((x) => x.length <= 221) && long.length >= 3, "a long sentence is cut at a space (≤ 220 letters each)");
ok(V.endsCall("bye") && V.endsCall("سلام") && V.endsCall("خلاص كده") && !V.endsCall("what's the bill"), "bye / سلام / خلاص كده end the call");
console.log(bad ? bad + " FAILED" : "v741voicecall ok");
