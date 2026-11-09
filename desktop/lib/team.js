/* ---- v9.9.8 M4 (Ali OK'd: "on a computer, two models together — a fast one writes, a bigger one checks"). The team is
   llama.cpp's speculative decoding: a small model of the SAME family (same words / tokenizer) writes a few words ahead, the big
   model checks them all in one pass and keeps only the words it would have written itself — so the answer is exactly the big
   model's, only faster (typically 1.5–2.5× on a computer; on phones it was measured slower and is off there — HANDOFF §5.39).
   Rules: the helper is small (≤ 1.5 B) and at most a quarter of the big one; both together fit the memory budget; if the pair
   won't start, the big model starts alone (engine.js tries with the team first). Pure; tests: desktop/test/team.js.          */
const GB = 1024 * 1024 * 1024;

/** The model family by its name: only the same family shares the words a draft must use. */
function familyOf(m) {
  const s = [m && m.source, m && m.label, m && m.id, m && m.realName].filter(Boolean).join(" ");
  if (/qwen\W?3\.?6/i.test(s)) return "qwen3.6";
  if (/qwen\W?3\.?5/i.test(s)) return "qwen3.5";
  if (/gemma\W?4/i.test(s)) return "gemma4";
  if (/llama\W?3/i.test(s)) return "llama3";
  return "";
}
/** Its size in billions of parameters from the name ("Qwen3.5-0.8B", "35B-A3B" → 35, "E2B" → 2), or from the file size. */
function paramsOf(m) {
  const s = [m && m.source, m && m.label, m && m.params].filter(Boolean).join(" ");
  const x = /(?:^|[^\d.])(\d+(?:\.\d+)?)\s*B(?![a-z])/i.exec(s.replace(/-A\d+(?:\.\d+)?B/gi, ""));
  if (x) return parseFloat(x[1]);
  return m && m.sizeBytes ? m.sizeBytes / GB / 0.6 : 0;   // ~0.6 GB per billion at 4-bit
}
/** How much model this computer can hold: the graphics chip's memory + 70 % of the RAM (the same budget the picker uses). */
function budgetOf(info) {
  const ram = (info && info.totalRamBytes) || 0, vram = ((info && info.vramGB) || 0) * GB;
  return vram + ram * 0.7;
}
/** The helper for `target`, or null: same family, ≤ 1.5 B and ≤ ¼ of the target, both fit; the smallest such (fastest). */
function pickDraft(target, installed, info, { on = true } = {}) {
  if (!on || !target) return null;
  const fam = familyOf(target), tp = paramsOf(target); if (!fam || !tp) return null;
  if (tp < 3) return null;   // a small model alone is already fast; a helper would only cost memory
  const fits = (d) => (target.sizeBytes || 0) + (d.sizeBytes || 0) + (target.mmprojBytes || 0) <= budgetOf(info);
  const c = (installed || []).filter((d) => d && d.id !== target.id && familyOf(d) === fam && paramsOf(d) > 0 && paramsOf(d) <= 1.5 && paramsOf(d) <= tp / 4 && fits(d));
  return c.sort((a, b) => paramsOf(a) - paramsOf(b))[0] || null;
}
/** llama-server's arguments for the helper (on the graphics chip when the big one is, else CPU). */
function draftArgs(d, gpu) {
  const a = ["-md", d.modelFile, "--draft-max", "16", "--draft-min", "1", "-cd", "4096"];
  if (gpu) a.push("-ngld", "99"); else a.push("-ngld", "0", "-devd", "none");
  return a;
}
module.exports = { familyOf, paramsOf, budgetOf, pickDraft, draftArgs };
