// v6.17 — Fit photos: calories per plate, measured (Ali: "4 eggs … each one in a toast with tomato sauce … told me 21 kcal").
// The app's own prompt (fit.js photoMessages) and parser (parsePhoto) on real plates whose calories are known from their
// ingredient grams. Needs a llama-server with a vision model:   PORT=18900 SET=set.json node tests/trials/photokcal.mjs
import * as F from "../../web-src/fit.js";
import { readFileSync, writeFileSync, existsSync } from "fs";
const PORT = process.env.PORT || 18900, set = JSON.parse(readFileSync(process.env.SET, "utf8"));
const N = +(process.env.N || set.length), HINTS = process.env.HINTS ? JSON.parse(readFileSync(process.env.HINTS, "utf8")) : null;
F.setCountry && F.setCountry("eg");
// v2 (candidate): neutral — no dish list to force names, no example to copy; every food with grams AND the model's own kcal
const V2 = [{ role: "system", content: `You are an expert dietitian estimating the calories of a meal from a photo.
Reply with ONLY compact JSON on ONE line: {"meal":"short name of the whole meal","items":[{"food":"common English name","count":number or null,"grams":number,"kcal":number}],"total_kcal":number}
List EVERY food you can see as its own item: the main food, bread/buns/toast/wraps, rice/pasta/fries, cheese, sauces and spreads, visible oil or butter, toppings, sides, drinks. A burger or sandwich: list the bun/bread, the filling, the cheese and the sauce separately. Count countable things (eggs, slices, pieces, balls, skewers).
Estimate grams as served from the photo: a dinner plate is about 26 cm across; use typical restaurant/home portions. kcal = your best estimate for that item. Do not list foods you cannot see.` },
  { role: "user", content: "Estimate this meal." }];
const errs = []; let unknown = 0, t0 = Date.now();
for (const [k, s] of set.slice(0, N).entries()) {
  const msgs = process.env.PROMPT === "v2" ? V2 : F.photoMessages("", "eg", HINTS ? HINTS[k] || [] : []);
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
  let kcal = p.items.reduce((a, x) => a + (x.kcal || 0), 0); unknown += p.items.filter((x) => x.kcal == null).length;
  if (process.env.PROMPT === "v2") {   // the table's calories for foods it knows, the model's own estimate for the rest; MODE=model: the model's total
    let j = {}; try { j = JSON.parse(String(raw).replace(/^[^{]*/, "").replace(/[^}]*$/, "")); } catch (e) {}
    const its = Array.isArray(j.items) ? j.items : [];
    const tab = its.reduce((a, it) => { const fd = F.matchFood(String(it.food || "")); const g = +it.grams > 0 ? +it.grams : 0; return a + (fd && g ? fd.kcal * g / 100 : +it.kcal || 0); }, 0);
    const own = +j.total_kcal || its.reduce((a, it) => a + (+it.kcal || 0), 0);
    kcal = process.env.MODE === "model" ? own : process.env.MODE === "blend" ? (tab + own) / 2 : tab;
    p.items = its.map((it) => ({ name: it.food, grams: it.grams, count: it.count }));
  }
  const e = (kcal - s.kcal) / s.kcal; errs.push(e);
  console.log(`${String(k).padStart(2)} ref ${String(s.kcal).padStart(4)} got ${String(Math.round(kcal)).padStart(4)} (${(e * 100).toFixed(0).padStart(4)}%) ${((Date.now() - t) / 1000).toFixed(0)}s  ${s.dish.slice(0, 34).padEnd(34)} → ${p.items.map((x) => (x.count ? x.count + "× " : "") + (x.name || x.said) + " " + x.grams + "g").join(", ").slice(0, 110)}`);
}
const a = errs.map(Math.abs).sort((x, y) => x - y), med = a[Math.floor(a.length / 2)];
console.log(`SUMMARY n=${errs.length} median |error| ${(med * 100).toFixed(0)}%  within ±25%: ${(a.filter((x) => x <= 0.25).length / a.length * 100).toFixed(0)}%  within ±40%: ${(a.filter((x) => x <= 0.4).length / a.length * 100).toFixed(0)}%  unknown items ${unknown}  ${((Date.now() - t0) / 1000 / errs.length).toFixed(0)} s/photo`);
