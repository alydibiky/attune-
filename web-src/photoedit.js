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

