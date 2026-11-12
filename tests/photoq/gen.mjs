// v9.9.23 photo quality: 10,000 synthetic document photos (sharp / blurred / dark / glare / small) with what Attune must say.
// Calibration (rendered ID cards, 1400 px wide, sensor noise σ 0 / 3 / 8; tesseract reading the 9-digit numbers): blur σ ≤ 2 px reads
// 39–40 / 40 (sharpness 25.3–27.6); σ 2.5 → 36 / 40 (21.4–23.2); σ 3 → 34 / 40 (18.0–19.8). So the "blur" limit is 20: σ ≥ 3 px is
// "take another", σ ≤ 2 px always passes. Here: ok photos have σ ≤ 1.4 px, blurred ones σ ≥ 2.7 px.
const mod = await import(process.env.PQ || "../../web-src/photoquality.js");
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function blur(g, w, h, k) { let a = Float32Array.from(g), b = new Float32Array(a.length);   // k passes of a separable 3×3 box (σ² = 2/3 each)
  for (let p = 0; p < k; p++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; b[i] = (a[x > 0 ? i - 1 : i] + a[i] + a[x < w - 1 ? i + 1 : i]) / 3; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; a[i] = (b[y > 0 ? i - w : i] + b[i] + b[y < h - 1 ? i + w : i]) / 3; } }
  return a; }
export function make(i) {
  const r = rng(i * 7919 + 1), kinds = ["ok", "blur", "dark", "glare", "small"], kind = kinds[i % 5];
  const w = kind === "small" ? 200 + Math.floor(r() * 270) : 620 + Math.floor(r() * 160), h = kind === "small" ? 150 + Math.floor(r() * 200) : 500 + Math.floor(r() * 100);
  const bg = kind === "dark" ? 15 + r() * 30 : kind === "glare" ? 200 : 150 + r() * 70, ink = kind === "dark" ? 0 : 10 + r() * 40;
  let g = new Float32Array(w * h).fill(bg);
  // text-like letters at a real card's size (the calibration cards: 26–44 px type → strokes 3–5 px, letters 18–32 px tall)
  for (let y = 24; y < h - 44; y += 40 + Math.floor(r() * 16)) { const lh = 18 + Math.floor(r() * 14);
    for (let x = 20; x < w - 30; x += 12 + Math.floor(r() * 10)) { if (r() < 0.2) continue; const sw = 3 + Math.floor(r() * 3), shape = Math.floor(r() * 3);
      const bar = (x0, y0, bw, bh) => { for (let yy = y0; yy < y0 + bh; yy++) for (let xx = x0; xx < x0 + bw; xx++) if (xx < w && yy < h) g[yy * w + xx] = ink; };
      bar(x, y, sw, lh); if (shape) bar(x, shape === 1 ? y : y + lh - sw, 8, sw); if (shape === 2) bar(x + 8, y, sw, lh); } }
  if (kind === "glare") { const cx = w * (0.3 + r() * 0.4), cy = h * (0.3 + r() * 0.4), R = Math.min(w, h) * (0.42 + r() * 0.08);   // ~30–60% of the photo washed out (≥ 70% looks like a white page; its unreadable text is caught after reading)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x - cx) ** 2 + (y - cy) ** 2 < R * R) g[y * w + x] = 255; }
  // good photos of white receipts: part of the paper burnt pure white (up to ~15% of the photo) — must NOT be called glare
  if (kind === "ok" && r() < 0.4) { const x0 = Math.floor(r() * w * 0.5), y0 = Math.floor(r() * h * 0.5), bw = Math.floor(w * (0.2 + r() * 0.2)), bh = Math.floor(h * (0.2 + r() * 0.15));
    for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) if (g[y * w + x] > 100) g[y * w + x] = 255; }
  // blur of σ ≥ 2.5 px (where the text reader starts failing, see the top) — then the phone's sensor noise on top
  if (kind === "blur") g = blur(g, w, h, 11 + Math.floor(r() * 8)); else if (r() < 0.5) g = blur(g, w, h, 1 + Math.floor(r() * 3));
  for (let k = 0; k < g.length; k++) g[k] = Math.max(0, Math.min(255, g[k] + (r() + r() + r() - 1.5) * 2 * (1 + Math.floor(r() * 4))));
  // screenshots (no noise, no blur): a white page or dark mode — must pass (Translate and Timetable take screenshots too)
  if (kind === "ok" && i % 10 === 5) { const dark = r() < 0.5; for (let k = 0; k < g.length; k++) g[k] = g[k] > 100 ? (dark ? 18 : 255) : (dark ? 235 : 20); }
  return { gray: Uint8ClampedArray.from(g), w, h, want: kind === "ok" ? "" : kind };
}
export function run(N = 10000, from = 0) {
  let pass = 0; const bad = [];
  for (let i = from; i < from + N; i++) { const c = make(i), q = mod.quality(c); if (q.why === c.want) pass++; else if (bad.length < 5) bad.push({ i, want: c.want, got: q.why, sharp: q.sharp, light: q.light, glare: q.glare }); }
  return { pass, N, rate: pass / N, bad };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) { const r = run(+(process.argv[2] || 10000), +(process.argv[3] || 0)); console.log(JSON.stringify(r)); }
