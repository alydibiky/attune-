// v9.1 (Ali, 4 Nov: "the prompt tools can just be in home chat"): Chat reads "improve this prompt for Claude…", "humanize this…",
// "make this shorter…" (English and Egyptian Arabic) and runs the same tuned instructions the archived pages used.
import { promptToolOf } from "../../web-src/prompttools.js";
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } };
const P = promptToolOf;
let r = P("improve this prompt for Claude: write a cover letter for a crane operator job");
ok(r && r.kind === "improve" && r.target === "claude" && r.text.startsWith("write a cover letter"), "improve for Claude: " + JSON.stringify(r));
r = P("Improve my prompt for ChatGPT\nexplain VAT in Egypt");
ok(r && r.target === "chatgpt" && r.text === "explain VAT in Egypt", "improve for ChatGPT, text on the next line");
r = P("improve this prompt: summarise this contract"); ok(r && r.kind === "improve" && r.target === "chatgpt", "no AI named → ChatGPT by default");
r = P("حسن البرومبت ده لكلود: اكتبلي خطة تسويق"); ok(r && r.kind === "improve" && r.target === "claude" && r.text === "اكتبلي خطة تسويق", "Egyptian: «حسن البرومبت ده لكلود»");
r = P("humanize this: In conclusion, it is important to note that..."); ok(r && r.kind === "humanize" && r.text.startsWith("In conclusion"), "humanize with its text");
r = P("humanize this"); ok(r && r.kind === "humanize" && r.text === "", "humanize this → Chat's last answer");
r = P("خليه طبيعي"); ok(r && r.kind === "humanize" && r.text === "", "Egyptian: «خليه طبيعي»");
r = P("make this shorter by 30%: " + "word ".repeat(40)); ok(r && r.kind === "shorten" && r.pct === 30 && r.text.length > 50, "shorten by 30%");
r = P("اختصره"); ok(r && r.kind === "shorten" && r.pct === 40 && r.text === "", "Egyptian: «اختصره» → 40%, Chat's last answer");
for (const t of ["what is a good prompt for a logo?", "how do I humanize my dog's behaviour", "remind me to shorten my CV", "improve my CV", "lunch 150"]) ok(P(t) === null, "not a prompt tool: " + t);
console.log(bad ? bad + " FAILED" : "PASS v911prompttools: improve / humanize / shorten read from Chat in English and Egyptian Arabic");
