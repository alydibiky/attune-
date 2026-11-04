// v6.44 the photo editor: a tapped person's shadow is found and erased with them (like the Honor gallery).
import { findShadow } from "../../web-src/photoedit.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const W = 120, H = 100;
const scene = ({ ground = [170, 160, 140], dark = false } = {}) => {
  const px = new Uint8ClampedArray(W * H * 4), subj = new Uint8Array(W * H);
  const put = (x, y, c) => { const i = (y * W + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, ((x * 7 + y * 3) % 11 < 1) ? ground.map((v) => v - 6) : ground);   // a little texture
  for (let y = 20; y < 70; y++) for (let x = 40; x < 55; x++) { put(x, y, [200, 30, 40]); subj[y * W + x] = 1; }     // the person
  const sh = (v) => ground.map((c, k) => Math.round(c * 0.45 + (k === 2 ? 8 : 0)));                                       // shade: darker, a bit bluer
  for (let y = 62; y < 74; y++) for (let x = 55; x < 85; x++) if (((x - 68) / 17) ** 2 + ((y - 68) / 6) ** 2 <= 1) put(x, y, sh());   // its shadow, at the feet
  for (let y = 80; y < 92; y++) for (let x = 95; x < 110; x++) put(x, y, sh());                                          // another dark patch, not touching
  for (let y = 22; y < 30; y++) for (let x = 55; x < 62; x++) put(x, y, sh());                                           // a dark thing by the head
  if (dark) for (let i = 0; i < W * H; i++) if (!subj[i]) { px[i * 4] = 60; px[i * 4 + 1] = 55; px[i * 4 + 2] = 50; }
  return { px, subj };
};
const { px, subj } = scene();
const r = findShadow({ px, W, H, subj, box: [40, 20, 15, 50] });
const at = (x, y) => r && r.mask[y * W + x];
ok(r && at(70, 68) && at(60, 66), "the shadow at the feet is found (" + (r && r.n) + " px)");
ok(r && !at(100, 85), "a dark patch that doesn't touch the person is kept");
ok(r && !at(58, 25), "something dark by the head (not on the ground at the feet) is kept");
ok(r && !at(20, 50) && !at(47, 40), "the plain ground and the person themselves are not in the shadow mask");
ok(findShadow({ ...scene({ dark: true }), W, H, box: [40, 20, 15, 50] }) === null, "a dark scene with no shade: nothing extra");
const lit = scene(); for (let i = 0; i < W * H; i++) if (!lit.subj[i]) { lit.px[i * 4] = 170; lit.px[i * 4 + 1] = 160; lit.px[i * 4 + 2] = 140; }
ok(findShadow({ ...lit, W, H, box: [40, 20, 15, 50] }) === null, "no shadow in the picture → nothing extra is erased");
const t0 = Date.now(); const BW = 384, BH = 288, bp = new Uint8ClampedArray(BW * BH * 4).fill(150), bs = new Uint8Array(BW * BH);
for (let y = 60; y < 220; y++) for (let x = 150; x < 200; x++) bs[y * BW + x] = 1;
findShadow({ px: bp, W: BW, H: BH, subj: bs, box: [150, 60, 50, 160] });
ok(Date.now() - t0 < 300, "fast on the editor's grid (384×288 in " + (Date.now() - t0) + " ms)");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
