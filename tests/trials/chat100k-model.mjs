// v9.9.32 (Ali, 13 Nov 2026: "try the code and model with 100,000 scenarios"): the real model on what the code leaves to it.
// The 100,000 chat orders (tests/scenarios/chat100k.mjs) and the 100,000 hard sentences (mega.mjs) are decided by code; when the
// referee sees two possible kinds (or a kind only the words show), the phone's model picks with the app's own prompt and parser
// (understand.js judgeMessages / parseJudge). This sends a sample of exactly those to a real model through llama-server.
//   CHAT_JSON=rows.json node tests/scenarios/chat100k.mjs        (writes every order with what the code did)
//   llama-server -m Qwen3.5-4B-Q4_K_M.gguf --port 8099 -c 4096 --cache-ram 0 &
//   MODEL_NAME=qwen3.5-4b node tests/trials/chat100k-model.mjs rows.json [sample=300]
import fs from "fs";
import { judgeMessages, parseJudge, looksFranco, francoToArabic } from "../../web-src/understand.js";
import { readable } from "../../web-src/wrapclean.js";
const PORT = process.env.TRIAL_PORT || 8099, rows = JSON.parse(fs.readFileSync(process.argv[2])), N = +(process.argv[3] || 300);
const pool = rows.filter((r) => r.model && r.cands && r.cands.length);
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const sample = pool.length <= N ? pool : pool.map((r) => [rnd(), r]).sort((a, b) => a[0] - b[0]).slice(0, N).map((x) => x[1]);
async function ask(messages) {
  const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages, max_tokens: 12, temperature: 0, chat_template_kwargs: { enable_thinking: false } }) });
  const j = await r.json(); return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
}
const by = {}, wrong = []; let secs = 0;
for (const r of sample) {
  const t0 = Date.now(), t1 = readable(r.s), tt = looksFranco(t1) ? francoToArabic(t1) : t1;
  const ans = await ask(judgeMessages(tt, r.cands)), got = parseJudge(ans.replace(/<think>[\s\S]*?<\/think>/g, ""), r.cands) || "chat";
  secs += (Date.now() - t0) / 1000;
  const b = (by[r.g] = by[r.g] || { n: 0, ok: 0 }); b.n++; if (got === r.want) b.ok++; else wrong.push(`- [${r.g}] «${r.s}» → model ${JSON.stringify(ans.trim().slice(0, 30))}, want ${r.want} (${r.cands.join("/")})`);
}
const n = sample.length, ok = Object.values(by).reduce((s, b) => s + b.ok, 0);
let md = `# Chat orders the code leaves to the model — real model\n\nModel: ${process.env.MODEL_NAME || "?"} · ${n} of ${pool.length} such orders (of ${rows.length}) · ${(secs / Math.max(1, n)).toFixed(1)} s each on this machine (4 CPU cores)\n\n**Model picked the right kind: ${ok}/${n} = ${(100 * ok / Math.max(1, n)).toFixed(1)}%**\n\n| group | n | right |\n|---|---|---|\n`;
for (const [g, b] of Object.entries(by)) md += `| ${g} | ${b.n} | ${(100 * b.ok / b.n).toFixed(1)}% |\n`;
md += "\n## Wrong\n" + wrong.join("\n") + "\n";
fs.writeFileSync(new URL("./chat100k-" + (process.env.MODEL_NAME || "model") + ".md", import.meta.url), md);
console.log(md.split("## Wrong")[0]);
