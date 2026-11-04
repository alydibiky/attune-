/* v6.43 the photo editor's pure helpers (photoedit-ui.jsx): which subject is the main one, where a subject sits, what a tap hits. */
/** The main subject: big and near the middle (the one Honor keeps when it removes passers-by). → its index, or -1. */
export function mainSubject(subs, w, h) {
  let best = -1, score = -1;
  (subs || []).forEach((s, i) => {
    const cx = (s.x + s.w / 2) / w - 0.5, cy = (s.y + s.h / 2) / h - 0.5;
    const sc = (s.area || s.w * s.h) * (1 - Math.min(0.8, Math.hypot(cx, cy) * 1.2));
    if (sc > score) { score = sc; best = i; }
  });
  return best;
}
/** A subject's box in another picture size (the mask canvas, the screen). */
export const maskRect = (s, k) => [s.x * k, s.y * k, s.w * k, s.h * k];
/** The subject under a point (in the analysed picture's pixels): the smallest one whose shape covers it. alphaAt(i, x, y) → 0–255. */
export function hitSubject(subs, x, y, alphaAt) {
  let hit = -1, best = Infinity;
  (subs || []).forEach((s, i) => {
    if (x < s.x || y < s.y || x >= s.x + s.w || y >= s.y + s.h) return;
    if (alphaAt(i, Math.floor(x - s.x), Math.floor(y - s.y)) < 128) return;
    const a = s.area || s.w * s.h; if (a < best) { best = a; hit = i; }
  });
  return hit;
}


/* v6.44 (the Honor gallery removes a person's shadow with them): the shadow of a subject — the darker patch on the ground that
   touches the subject's lower half. px = RGBA pixels W×H; subj = 1 where the subject is (same grid); box = its [x, y, w, h].
   The ground's brightness and colour are read around the subject's feet (the median, so a shadow there doesn't move it);
   a shadow pixel is darker than the ground (12–78 %) with nearly the same colour (a shadow darkens, it doesn't recolour).
   It grows from the pixels touching the subject's lower half, inside one subject-width each side and 0.8 of its height
   below. Nothing (null) when the scene is too dark, the patch is tiny, or it is bigger than twice the subject (dark ground,
   not a shadow). → { mask: Uint8Array W×H (1 = shadow), n } */
export function findShadow({ px, W, H, subj, box }) {
  const [bx, by, bw, bh] = box.map(Math.round);
  const x0 = Math.max(0, bx - bw), x1 = Math.min(W, bx + 2 * bw), y0 = Math.max(0, Math.round(by + 0.4 * bh)), y1 = Math.min(H, Math.round(by + 1.8 * bh));
  if (x1 - x0 < 3 || y1 - y0 < 3) return null;
  const lum = (i) => 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  const chr = (i) => { const s = px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2] + 3; return [(px[i * 4] + 1) / s, (px[i * 4 + 1] + 1) / s]; };
  const L = [], step = Math.max(1, Math.round(Math.sqrt(((x1 - x0) * (y1 - y0)) / 4000)));
  for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) { const i = y * W + x; if (!subj[i]) L.push(i); }
  if (L.length < 20) return null;
  const ls = L.map(lum).sort((a, b) => a - b), Lg = ls[Math.floor(ls.length / 2)];
  if (Lg < 25) return null;
  const lit = L.filter((i) => lum(i) >= 0.85 * Lg).map(chr), med = (k) => { const a = lit.map((c) => c[k]).sort((p, q) => p - q); return a[Math.floor(a.length / 2)]; };
  if (!lit.length) return null;
  const cr = med(0), cg = med(1);
  const shadowy = (i) => { if (subj[i]) return false; const l = lum(i); if (l >= 0.78 * Lg || l <= 0.12 * Lg) return false; const [r, g] = chr(i); return Math.abs(r - cr) < 0.07 && Math.abs(g - cg) < 0.07; };
  const mask = new Uint8Array(W * H), q = [];
  const inside = (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
  const feet = Math.round(by + 0.5 * bh);
  for (let y = Math.max(y0, feet); y < Math.min(y1, by + bh + 1); y++) for (let x = Math.max(x0, bx - 1); x < Math.min(x1, bx + bw + 1); x++) {
    const i = y * W + x; if (subj[i] || mask[i] || !shadowy(i)) continue;
    if ((x > 0 && subj[i - 1]) || (x < W - 1 && subj[i + 1]) || (y > 0 && subj[i - W]) || (y < H - 1 && subj[i + W])) { mask[i] = 1; q.push(i); }
  }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % W, y = (i - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (!inside(nx, ny)) continue;
      const j = ny * W + nx; if (mask[j] || !shadowy(j)) continue; mask[j] = 1; q.push(j);
    }
  }
  let area = 0; for (let i = 0; i < W * H; i++) area += subj[i] ? 1 : 0;
  if (q.length < Math.max(4, area * 0.01) || q.length > area * 2) return null;
  // the soft edge of a shadow is lighter than the threshold: grow it by two pixels
  let m = mask;
  for (let r = 0; r < 2; r++) { const o = m.slice(); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (!m[i] && !subj[i] && (m[i - 1] || m[i + 1] || m[i - W] || m[i + W])) o[i] = 1; } m = o; }
  let n = 0; for (let i = 0; i < W * H; i++) n += m[i];
  return { mask: m, n };
}

/* ---- v6.45 Expand (outpaint): the photo on a bigger canvas, the new edges filled by the eraser model (LaMa / MI-GAN) —
   the same "fill what is missing" it already does for a removed person. shape: "all" (+25 % round), "wide" / "tall"
   (+50 % one way), or an aspect "1:1", "4:5", "16:9", "9:16". The canvas never grows more than 1.6× a side (beyond that
   the fill turns to mush). → { W, H, x, y }: the canvas and where the photo sits on it (centred). */
export const EXPAND_SHAPES = ["all", "wide", "tall", "1:1", "4:5", "16:9", "9:16"];
export function expandBox(w, h, shape = "all", max = 1.6) {
  let W = w, H = h;
  if (shape === "all") { W = w * 1.5; H = h * 1.5; }
  else if (shape === "wide") W = w * 1.5;
  else if (shape === "tall") H = h * 1.5;
  else { const [a, b] = String(shape).split(":").map(Number); if (!(a > 0 && b > 0)) throw new Error("Unknown shape " + shape);
    const r = a / b; if (w / h < r) W = h * r; else H = w / r; }
  W = Math.min(Math.round(W), Math.round(w * max)); H = Math.min(Math.round(H), Math.round(h * max));
  W = Math.max(W, w); H = Math.max(H, h);
  return { W, H, x: Math.floor((W - w) / 2), y: Math.floor((H - h) / 2), same: W === w && H === h };
}
