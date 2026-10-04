// The big model test (v6.12). Ali: "create a big and complete test to test each model" — not only coding, Arabic and maths.
// ~200 cases in 15 categories (tests/trials/full-cases.mjs), every one checked by code. Uses the app's own language rule (web-src/langs.js).
//   TRIAL_PORT=8099 MODEL_NAME=x FULL_REPORT=./full-x.md node tests/trials/full.mjs [categories, comma list]
//   FULL_THINK=1 turns the model's thinking on (the app's Think switch); FULL_QUICK=1 runs every second case.
import fs from "fs";
import http from "http";
import { execFileSync } from "child_process";
import { CASES, CODE, codeCase, SYS } from "./full-cases.mjs";
import { replyLanguageRule } from "../../web-src/langs.js";
const PORT = process.env.TRIAL_PORT || 8099, THINK = !!process.env.FULL_THINK;
const only = (process.argv[2] || "").split(",").filter(Boolean);
const REPORT = process.env.FULL_REPORT || new URL("./full.md", import.meta.url).pathname;
const post = (body) => new Promise((ok, bad) => {
  const req = http.request({ host: "127.0.0.1", port: PORT, path: "/v1/chat/completions", method: "POST", headers: { "content-type": "application/json" } }, (res) => {
    let d = ""; res.setEncoding("utf8"); res.on("data", (x) => (d += x)); res.on("end", () => { try { ok(JSON.parse(d)); } catch (e) { ok({ error: d.slice(0, 300) }); } });
  });
  req.on("error", bad); req.setTimeout(0); req.end(JSON.stringify(body));
});
// FULL_SAMPLING='{"top_k":20,"min_p":0.05}' adds sampler settings, to compare per-family defaults.
const SAMPLING = process.env.FULL_SAMPLING ? JSON.parse(process.env.FULL_SAMPLING) : {};
let genTok = 0, genMs = 0;
async function ask(messages, max) {
  const t0 = Date.now();
  const j = await post({ messages, max_tokens: THINK ? max * 6 : max, temperature: 0.3, ...SAMPLING, stream: false, chat_template_kwargs: { enable_thinking: THINK } });
  const m = (j.choices && j.choices[0] && j.choices[0].message) || {};
  const tm = j.timings || {}; if (tm.predicted_n) { genTok += tm.predicted_n; genMs += tm.predicted_ms; }
  const text = String(m.content || (j.error ? "[error] " + JSON.stringify(j.error).slice(0, 200) : "")).replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  return { text, secs: Math.round((Date.now() - t0) / 100) / 10 };
}
const runPython = (src) => { try { execFileSync("python3", ["-c", src], { timeout: 15000, stdio: "pipe" }); return true; } catch (e) { return false; } };
const all = [...CASES, ...CODE.map((c) => codeCase(...c))];
const rows = {}, out = [];
let n = 0;
for (const c of all) {
  if (only.length && !only.includes(c.cat)) continue;
  if (process.env.FULL_QUICK && (n++ % 2)) continue;
  const turns = Array.isArray(c.q) ? c.q.map(([role, content]) => ({ role, content })) : [{ role: "user", content: c.q }];
  const last = turns[turns.length - 1].content;
  const rule = c.cat === "Code" ? "" : replyLanguageRule(String(last).length >= 12 ? String(last).slice(-400) : String(last));
  const r = await ask([{ role: "system", content: SYS + (rule ? "\n\n" + rule : "") }, ...turns], c.max || 300);
  let ok = false;
  try {
    if (c.tests) {
      const m = r.text.match(/```(?:python|py)?\n([\s\S]*?)```/) || [null, r.text];
      ok = runPython(m[1] + "\n" + c.tests);
    } else ok = !!c.ok(r.text);
  } catch (e) { ok = false; }
  const row = (rows[c.cat] ||= { pass: 0, total: 0, secs: 0 });
  row.total++; row.secs += r.secs; if (ok) row.pass++;
  const label = Array.isArray(c.q) ? c.q[c.q.length - 1][1] : c.q;
  out.push(`- ${ok ? "✅" : "❌"} **${c.cat}** · ${String(label).replace(/\n/g, " ").slice(0, 110)} · ${r.secs}s${ok ? "" : "\n  > " + r.text.replace(/\n/g, " ⏎ ").slice(0, 260)}`);
  console.log(`${ok ? "ok  " : "FAIL"} ${c.cat} · ${String(label).replace(/\n/g, " ").slice(0, 70)}`);
}
const tps = genMs ? Math.round(genTok / genMs * 10000) / 10 : 0;
const tot = Object.values(rows).reduce((a, r) => [a[0] + r.pass, a[1] + r.total], [0, 0]);
const table = Object.entries(rows).map(([k, r]) => `| ${k} | ${r.pass}/${r.total} | ${Math.round(r.pass / r.total * 100)}% | ${Math.round(r.secs / r.total * 10) / 10}s |`).join("\n");
const head = `# Full model test — ${process.env.MODEL_NAME || "model"} — ${new Date().toISOString().slice(0, 16)}${THINK ? " — thinking on" : ""}\n\n**Score: ${tot[0]}/${tot[1]} (${Math.round(tot[0] / tot[1] * 100)}%)** · writes ${tps} tokens/s\n\n| Category | Passed | % | Avg time |\n|---|---|---|---|\n${table}\n\n## Every case\n`;
fs.writeFileSync(REPORT, head + out.join("\n") + "\n");
fs.writeFileSync(REPORT.replace(/\.md$/, ".json"), JSON.stringify({ model: process.env.MODEL_NAME, think: THINK, score: tot, tps, rows }, null, 1));
console.log(`\nFULL ${tot[0]}/${tot[1]} · write ${tps} t/s`);
for (const [k, r] of Object.entries(rows)) console.log(`  ${k}: ${r.pass}/${r.total}`);
