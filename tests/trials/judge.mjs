// v9.0 (Ali: "99 percent accurate"; "on the computer, with the bigger offline models, it must have no mistakes"): the referee's model
// step with a REAL model. Every bank sentence the code leaves to the model (two kinds, or a kind only the words suggest) — plus a
// sample the code decides alone, asked anyway — goes to the model with the app's own prompt (understand.js judgeMessages) and
// parser (parseJudge). Score = how often the model picks the right kind.
//   llama-server -m model.gguf --port 8099 --cache-ram 0 &   then:   TRIAL_PORT=8099 node tests/trials/judge.mjs [all]
import fs from "fs";
import { route } from "../bank/route.mjs";
import { judgeMessages, parseJudge, KINDS, looksFranco, francoToArabic } from "../../web-src/understand.js";
const PORT = process.env.TRIAL_PORT || 8099, ALL = process.argv[2] === "all";
const DIR = new URL("../bank/", import.meta.url).pathname;
async function ask(messages) {
  const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages, max_tokens: 12, temperature: 0, chat_template_kwargs: { enable_thinking: false } }) });
  const j = await r.json(); return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
}
let n = 0, ok = 0; const wrong = [], t0 = Date.now();
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".json"))) {
  for (const [want, list] of Object.entries(JSON.parse(fs.readFileSync(DIR + f, "utf8")))) for (const t of list) {
    const r = route(t);
    // the model's own question: what the code left open, or (all) every kind the app has for a sentence the code decided
    const cands = r.ask ? r.ask : ALL ? [...new Set([r.kind, want, "chat", "action", "money-log", "money-ask"])].filter((k) => KINDS[k]) : null;
    if (!cands) continue;
    n++;
    const tt = looksFranco(t) ? francoToArabic(t) : t;   // as the app does: Franco is read as Arabic first
    const ans = await ask(judgeMessages(tt, cands)), got = parseJudge(ans.replace(/<think>[\s\S]*?<\/think>/g, ""), cands) || r.fallback || "chat";   // as the app: no clear answer → the code's order
    if (got === want) ok++; else wrong.push(`${t}  → want ${want}, model said ${JSON.stringify(ans.trim().slice(0, 40))} (${cands.join("/")})`);
  }
}
console.log(wrong.map((w) => "  ✗ " + w).join("\n"));
console.log(`\nmodel step: ${ok}/${n} right = ${n ? Math.round((ok / n) * 1000) / 10 : 0}%  (${Math.round((Date.now() - t0) / 1000)} s)`);
