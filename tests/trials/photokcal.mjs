// v6.17 — Fit photos: calories per plate, measured (Ali: "4 eggs … each one in a toast with tomato sauce … told me 21 kcal").
// The app's own prompt (fit.js photoMessages) and parser (parsePhoto) on real plates whose calories are known from their
// ingredient grams. Needs a llama-server with a vision model:   PORT=18900 SET=set.json node tests/trials/photokcal.mjs
import * as F from "../../web-src/fit.js";
import { readFileSync, writeFileSync, existsSync } from "fs";
const PORT = process.env.PORT || 18900, set = JSON.parse(readFileSync(process.env.SET, "utf8"));
const N = +(process.env.N || set.length), HINTS = process.env.HINTS ? JSON.parse(readFileSync(process.env.HINTS, "utf8")) : null;
F.setCountry && F.setCountry("eg");
const errs = []; let unknown = 0, t0 = Date.now();
for (const [k, s] of set.slice(0, N).entries()) {
  const msgs = F.photoMessages("", "eg", HINTS ? HINTS[k] || [] : []);
  const img = "data:image/jpeg;base64," + readFileSync(s.file).toString("base64");
  const user = msgs[msgs.length - 1];
  const body = { messages: [...msgs.slice(0, -1), { role: "user", content: [{ type: "image_url", image_url: { url: img } }, { type: "text", text: user.content }] }],
    max_tokens: 1000, temperature: 0, response_format: { type: "json_object" }, chat_template_kwargs: { enable_thinking: false } };
  const t = Date.now();
  let raw = "";
  // RAW=<file>.json keeps every answer (re-scored later without the model: RESCORE=1)
  const cache = process.env.RAW && existsSync(process.env.RAW) ? JSON.parse(readFileSync(process.env.RAW, "utf8")) : {};
  if (process.env.RESCORE && cache[k] != null) raw = cache[k];
  else try { const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); raw = (await r.json()).choices[0].message.content; } catch (e) { raw = ""; }
  if (process.env.RAW && !process.env.RESCORE) { cache[k] = raw; writeFileSync(process.env.RAW, JSON.stringify(cache)); }
  const p = F.parsePhoto(raw);
  const kcal = p.items.reduce((a, x) => a + (x.kcal || 0), 0); unknown += p.items.filter((x) => x.kcal == null).length;
  const e = (kcal - s.kcal) / s.kcal; errs.push(e);
  console.log(`${String(k).padStart(2)} ref ${String(s.kcal).padStart(4)} got ${String(Math.round(kcal)).padStart(4)} (${(e * 100).toFixed(0).padStart(4)}%) ${((Date.now() - t) / 1000).toFixed(0)}s  ${s.dish.slice(0, 34).padEnd(34)} → ${p.items.map((x) => (x.count ? x.count + "× " : "") + (x.name || x.said) + " " + x.grams + "g").join(", ").slice(0, 110)}`);
}
const a = errs.map(Math.abs).sort((x, y) => x - y), med = a[Math.floor(a.length / 2)];
console.log(`SUMMARY n=${errs.length} median |error| ${(med * 100).toFixed(0)}%  within ±25%: ${(a.filter((x) => x <= 0.25).length / a.length * 100).toFixed(0)}%  within ±40%: ${(a.filter((x) => x <= 0.4).length / a.length * 100).toFixed(0)}%  unknown items ${unknown}  ${((Date.now() - t0) / 1000 / errs.length).toFixed(0)} s/photo`);
