// v9.9.31 real-model trial of notification comprehension (the phone's own model, e.g. Qwen3.5-4B Q4_K_M, through llama-server).
// Runs the model on: everything code is NOT sure of in the 10,000 run (a sample), all of heldout.mjs and heldout2.mjs, and a sample of
// what code IS sure of (to see whether the model agrees). Reports: the model alone, code + model (merge), how often the checker had to
// drop an invented number / date, seconds per notification.
//   llama-server -m Qwen3.5-4B-Q4_K_M.gguf --port 8099 -c 4096 --cache-ram 0 &   then   node tests/trials/notifmind-model.mjs [unsureSample] [sureSample]
import http from "http";
import fs from "fs";
import * as M from "../../web-src/notifmind.js";
import { make, NOW } from "../notifmind/gen.mjs";
import { HELD } from "../notifmind/heldout.mjs";
import { HELD2 } from "../notifmind/heldout2.mjs";
const PORT = process.env.TRIAL_PORT || 8099, LANG = { en: "en", ar: "ar", arb: "ar", fr: "fr", es: "es", de: "de", pt: "pt", it: "it", tr: "tr", id: "id" };
function post(body) { return new Promise((res, rej) => { const req = http.request({ host: "127.0.0.1", port: PORT, path: "/v1/chat/completions", method: "POST", headers: { "content-type": "application/json" } }, (r) => { let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }); req.on("error", rej); req.write(JSON.stringify(body)); req.end(); }); }
async function ask(n, lang) { const t0 = Date.now();
  const j = await post({ messages: M.mindPrompt(n, { lang, now: NOW }), max_tokens: 220, temperature: 0, stream: false, response_format: { type: "json_object" }, chat_template_kwargs: { enable_thinking: false } });
  return { out: (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "", sec: (Date.now() - t0) / 1000 }; }
const U = +(process.argv[2] || 120), S = +(process.argv[3] || 40);
const cases = [];
{ let u = 0, s = 0; for (let i = 0; i < 10000 && (u < U || s < S); i++) { const c = make(i), code = M.comprehend(c.n, { now: NOW });
    if (!code.sure && u < U && i % 3 === 0) { cases.push({ set: "10k-unsure", n: c.n, want: c.want, lang: c.lang }); u++; }
    else if (code.sure && s < S && i % 97 === 0) { cases.push({ set: "10k-sure", n: c.n, want: c.want, lang: c.lang }); s++; } } }
for (const [cat, intent, action, n, due, amount] of HELD) cases.push({ set: "heldout", n, want: { cat, intent, action, due: due || null, amount: amount || null }, lang: "en" });
for (const [cat, intent, action, n] of HELD2) cases.push({ set: "heldout2", n, want: { cat, intent, action, due: null, amount: null }, lang: "en" });
const ok3 = (m, w) => m && m.cat === w.cat && m.intent === w.intent && m.action === w.action;
const by = {}; let secs = 0, dropped = 0, bad = 0; const lines = [];
for (const c of cases) {
  const code = M.comprehend(c.n, { now: NOW }); let r; try { r = await ask(c.n, LANG[c.lang] || "en"); } catch (e) { console.log("server error", e.message); process.exit(1); }
  secs += r.sec; const model = M.readMind(r.out, c.n); if (!model) bad++;
  const raw = (() => { try { return JSON.parse((/\{[\s\S]*\}/.exec(r.out) || ["{}"])[0]); } catch (e) { return {}; } })();
  if ((+raw.amount > 0 && !(model && model.amount)) || (raw.due && !(model && model.due))) dropped++;
  const merged = M.merge(code, model), mOnly = model ? { cat: model.cat || code.cat, intent: model.intent, action: model.action } : null;   // (the model is told the kind)
  const b = (by[c.set] = by[c.set] || { n: 0, code: 0, model: 0, merged: 0 }); b.n++;
  if (ok3(code, c.want)) b.code++; if (ok3(mOnly, c.want)) b.model++; if (ok3(merged, c.want)) b.merged++;
  if (!ok3(merged, c.want)) lines.push(`- [${c.set}] want ${c.want.cat}/${c.want.intent}/${c.want.action} · code ${code.cat}/${code.intent}/${code.action}${code.sure ? " (sure)" : ""} · model ${mOnly ? mOnly.cat + "/" + mOnly.intent + "/" + mOnly.action : "—"} · «${(c.n.title + ": " + c.n.text).slice(0, 110)}»`);
}
let md = `# Notification comprehension — real model\n\nModel: ${process.env.MODEL_NAME || "?"} · ${cases.length} notifications · ${(secs / cases.length).toFixed(1)} s each on this machine (4 CPU cores) · not JSON: ${bad} · invented number / date dropped by the checker: ${dropped}\n\n| set | n | code alone | model alone | code + model |\n|---|---|---|---|---|\n`;
for (const [k, v] of Object.entries(by)) md += `| ${k} | ${v.n} | ${(100 * v.code / v.n).toFixed(1)}% | ${(100 * v.model / v.n).toFixed(1)}% | ${(100 * v.merged / v.n).toFixed(1)}% |\n`;
md += "\n(right = kind, reason and what to do all right)\n\n## Still wrong after code + model\n" + lines.join("\n") + "\n";
fs.writeFileSync(new URL("./notifmind-" + (process.env.MODEL_NAME || "model") + ".md", import.meta.url), md);
console.log(md.split("## Still")[0]);
