/* ---- v9.9.23 (Ali: "if the photo isn't clear make Attune tell take another clearer photo"). Before a document photo is read, its quality
   is checked by code: too blurry (how steep the letters' edges are once the sensor noise is smoothed out, against the paper's contrast), too dark, washed out / glare (a big share of
   burnt-white pixels), or too far (the picture too small to read a card's text). Each says WHY and how to fix it. The blur limit is set from
   measurements (tests/photoq/gen.mjs top: rendered ID cards at rising blur — the point where the reader starts missing text).
   Pure on gray pixels: quality({ gray, w, h }) → { ok, why, sharp, light, glare }. In the page: checkPhoto(dataUrl) reads the pixels. */
// glare: a quarter of the photo burnt white. (A white receipt's paper often comes out pure white on phones — up to ~15% of the photo —
// so a lower limit would warn on good photos; a small glare spot that hides the text is caught after reading: "I couldn't read this clearly".)
export const LIMITS = { sharp: 20, dark: 55, bright: 235, glare: 0.25, minSide: 480 };
// a 3×3 box smoothing (two passes take the phone's sensor noise out but keep the edges of the letters)
function box3(a, W, H) { const b = new Float32Array(a.length), c = new Float32Array(a.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; b[i] = (a[x ? i - 1 : i] + a[i] + a[x < W - 1 ? i + 1 : i]) / 3; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; c[i] = (b[y ? i - W : i] + b[i] + b[y < H - 1 ? i + W : i]) / 3; }
  return c; }
const pct = (hist, total, q, step) => { let k = 0, want = total * q; for (let i = 0; i < hist.length; i++) { k += hist[i]; if (k >= want) return i * step; } return (hist.length - 1) * step; };
/** gray: Uint8 / number array (w·h), row by row. */
export function quality({ gray, w, h }, L = LIMITS) {
  if (!gray || !w || !h) return { ok: false, why: "unreadable" };
  if (Math.min(w, h) < L.minSide) return { ok: false, why: "small" };
  // measured at most ~1400 px on the long side — the size the Dates page reads at (sharpness in pixels depends on scale)
  const s = Math.max(1, Math.floor(Math.max(w, h) / 1400)), W = Math.floor(w / s), H = Math.floor(h / s); let g = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = gray[(y * s) * w + x * s];
  const lh = new Float64Array(256); let sum = 0, white = 0;
  for (let i = 0; i < g.length; i++) { const v = g[i]; sum += v; if (v >= 250) white++; lh[Math.max(0, Math.min(255, Math.round(v)))]++; }
  const light = sum / g.length, glare = white / g.length, range = pct(lh, g.length, 0.5, 1) - pct(lh, g.length, 0.03, 1);   // the paper (the middle) against the ink (the darkest 3%) — a burnt-white patch doesn't change it
  // sharpness = how steep the strongest edges (the letters) are, after the noise is smoothed away, against the paper's contrast:
  // a sharp letter edge rises in ~1–2 px; blurred by σ px it rises over ~σ·2.5 px. (Laplacian variance was tried first: phone noise fooled it.)
  g = box3(box3(g, W, H), W, H);
  const gh = new Float64Array(1024); let n = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x, gx = Math.abs(g[i + 1] - g[i - 1]) / 2, gy = Math.abs(g[i + W] - g[i - W]) / 2;
    gh[Math.min(1023, Math.round(Math.max(gx, gy) * 4))]++; n++; }
  const sharp = n ? (100 * pct(gh, n, 0.997, 0.25)) / Math.max(20, range) : 0;
  const r = { sharp: Math.round(sharp * 10) / 10, light: Math.round(light), glare: Math.round(glare * 1000) / 1000 };
  // a screenshot (dark mode, or a white page) is sharp and full of contrast — only a photo that is dark / washed out AND flat is refused;
  // a white page burnt almost all white (≥ 70%) is a screenshot or a scan, not a glare spot
  const spread = pct(lh, g.length, 0.97, 1) - pct(lh, g.length, 0.03, 1);
  if (light < L.dark && spread < 80) return { ok: false, why: "dark", ...r };
  if ((glare > L.glare && glare < 0.7) || (light > L.bright && spread < 80)) return { ok: false, why: "glare", ...r };
  if (sharp < L.sharp) return { ok: false, why: "blur", ...r };
  return { ok: true, why: "", ...r };
}
export const ADVICE = { blur: "This photo is blurry — hold the phone still, let it focus, and take another one.", dark: "This photo is too dark — take it again in more light.",
  glare: "There's glare on the paper — tilt it away from the light and take another one.", small: "The paper is too far or the photo too small — move closer so it fills the photo.",
  unreadable: "I couldn't open this photo — take another one.", unread: "I couldn't read this clearly — take a closer, sharper photo of just the paper." };
/** In the page: a data URL → its quality (loads it into a canvas). */
export function checkPhoto(url) {
  return new Promise((res) => {
    try { const im = new Image(); im.onload = () => { try { const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext("2d"); x.drawImage(im, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data, gray = new Uint8ClampedArray(c.width * c.height); for (let i = 0, j = 0; i < d.length; i += 4, j++) gray[j] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
        res(quality({ gray, w: c.width, h: c.height })); } catch (e) { res({ ok: true, why: "" }); } };
      im.onerror = () => res({ ok: false, why: "unreadable" }); im.src = url; } catch (e) { res({ ok: true, why: "" }); }
  });
}
