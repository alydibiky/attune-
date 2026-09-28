// v6.8 — Ali: "test every model". For EVERY model in the catalogue (MODEL_TIERS in attune.jsx), ask
// Hugging Face which file the app would download — the same rule as ModelStore.resolveHf, line by
// line — and check: the file exists, its size matches the catalogue's sizeGB, a photo model has its
// photo reader (mmproj), and the memory numbers make sense (needRam < smoothRam, the file fits the
// engine's 55 % memory rule on a phone of needRam). Needs internet. node tests/models/catalogue.mjs
import fs from "fs";
const src = fs.readFileSync(new URL("../../web-src/attune.jsx", import.meta.url), "utf8").split("\n");
const a = src.findIndex((l) => l.startsWith("const MODEL_TIERS"));
const b = src.findIndex((l, i) => i > a && /^\];/.test(l));
const TIERS = new Function(src.slice(a, b + 1).join("\n").replace("const MODEL_TIERS =", "return") )();

function resolveHf(files, quantSpec, vision) {         // ModelStore.resolveHf, ported
  const quant = quantSpec.trim().split(/\s+/).pop().toLowerCase();
  const wantQat = /qat/i.test(quantSpec);
  const esc = quant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const boundary = new RegExp("(^|[-_./])" + esc + "([-_./]|$)");
  const cands = files.filter((f) => { const p = f.path.toLowerCase(); const base = p.split("/").pop();
    return !base.startsWith("mmproj") && boundary.test(p) && (quant.startsWith("ud-") || !p.includes("ud-" + quant)); });
  if (!cands.length) return null;
  const split = /-(\d{5})-of-(\d{5})\.gguf$/i;
  const groups = {}; for (const c of cands) (groups[c.path.replace(split, "")] ||= []).push(c);
  const best = Object.entries(groups).sort((x, y) => ((wantQat && !/qat/i.test(x[0])) ? 1 : 0) - ((wantQat && !/qat/i.test(y[0])) ? 1 : 0) || x[0].length - y[0].length)[0][1];
  let mm = null;
  if (vision) { const pref = ["f16", "bf16", "q8_0", "f32"]; const rank = (n) => { const i = pref.findIndex((p) => n.toLowerCase().includes(p)); return i < 0 ? 99 : i; };
    mm = files.filter((f) => f.path.split("/").pop().toLowerCase().startsWith("mmproj")).sort((x, y) => rank(x.path) - rank(y.path) || x.size - y.size)[0] || null; }
  return { parts: best, size: best.reduce((n, p) => n + p.size, 0), mm };
}
const rows = []; let bad = 0;
for (const t of TIERS) {
  const out = { id: t.id, label: t.label, problems: [] };
  try {
    if (t.url) {
      const r = await fetch(t.url, { method: "HEAD", redirect: "follow" });
      const size = +(r.headers.get("x-linked-size") || r.headers.get("content-length") || 0);
      out.file = t.url.split("/").pop(); out.gb = size / 1e9;
      if (!r.ok) out.problems.push("the link answers " + r.status);
    } else {
      const j = await (await fetch(`https://huggingface.co/api/models/${t.repo}/tree/main?recursive=true`)).json();
      if (!Array.isArray(j)) throw new Error("repo not found: " + t.repo);
      const files = j.filter((o) => o.type === "file" && /\.gguf$/i.test(o.path)).map((o) => ({ path: o.path, size: (o.lfs && o.lfs.size) || o.size }));
      const plan = resolveHf(files, t.quant, !!t.vision);
      if (!plan) throw new Error(`no ${t.quant} file in ${t.repo}`);
      out.file = plan.parts.map((p) => p.path).join(" + "); out.gb = plan.size / 1e9;
      if (t.vision && !plan.mm) out.problems.push("marked as reading photos, but the repo has no mmproj");
      out.mm = plan.mm ? plan.mm.path + " " + (plan.mm.size / 1e9).toFixed(2) + " GB" : "";
    }
    if (Math.abs(out.gb - t.sizeGB) / t.sizeGB > 0.08) out.problems.push(`catalogue says ${t.sizeGB} GB, the file is ${out.gb.toFixed(2)} GB`);
    if (!(t.needRam < t.smoothRam || t.needRam === t.smoothRam)) out.problems.push("needRam above smoothRam");
    const usable = (t.phoneMin || t.needRam) * 1e9 * 0.93;   // a "12 GB" phone reports ~11.2 GiB
    // v6.8 Engine.allowedBytes: always up to 55 %; up to 62 % when that memory is really free
    if (!t.engine && out.gb * 1e9 > usable * 0.62) out.problems.push(`on a ${t.phoneMin || t.needRam} GB phone the engine's memory rule (up to 62 % when free) refuses a ${out.gb.toFixed(2)} GB file`);
    else if (!t.engine && out.gb * 1e9 > usable * 0.55) out.note = `needs free memory on a ${t.phoneMin || t.needRam} GB phone (${Math.round(out.gb * 1e9 / usable * 100)} %)`;
  } catch (e) { out.problems.push(String(e.message || e)); }
  if (out.problems.length) bad++;
  rows.push(out);
  console.log(`${out.problems.length ? "FAIL" : "PASS"} ${t.label.padEnd(11)} ${(out.gb || 0).toFixed(2).padStart(6)} GB  ${out.file || ""}${out.mm ? "  · photos: " + out.mm : ""}${out.note ? "  · " + out.note : ""}${out.problems.length ? "\n     → " + out.problems.join("\n     → ") : ""}`);
}
console.log(bad ? `\n${bad} FAILED` : "\nALL PASSED");
