/* ---- v6.37 (upgrade S4): your brand on every deck and report — set once: the company name, its colour and its logo.
   A "Your brand" design is made from the colour (cover = the colour darkened, cards = a light tint, text chosen for contrast);
   the logo goes on the cover and small in the corner of every slide; the name in the footer. Pure (tests/unit/v740brand.test.mjs). */
export const BRAND_KEY = "attune:brand:v1";      // { name, color: "1D4ED8", logo: "data:image/png;base64,…", lw, lh }

const hex = (h) => { const m = String(h || "").replace("#", "").match(/^([0-9a-f]{6})$/i); return m ? m[1].toUpperCase() : null; };
const rgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (a) => a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();
const mix = (h, to, k) => toHex(rgb(h).map((v, i) => v + (rgb(to)[i] - v) * k));
/** Relative luminance (WCAG) — to pick white or near-black text on a colour. */
export function luminance(h) { const c = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
export const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/** The brand kit → a deck theme in the same shape as slides.js THEMES. A very light colour is darkened until text on it reads. */
export function brandTheme(kit) {
  let c = hex(kit && kit.color) || "1D4ED8";
  for (let i = 0; i < 6 && contrast(c, "FFFFFF") < 3; i++) c = mix(c, "000000", 0.18);   // accent must read on white
  const cover = mix(c, "000000", 0.45);
  const onAccent = contrast(c, "FFFFFF") >= 4.5 ? "FFFFFF" : "111827";
  return { name: (kit && kit.name) || "Your brand", brand: true, bg: "FFFFFF", card: mix(c, "FFFFFF", 0.9), text: "0F172A", sub: "475569",
    accent: c, accent2: mix(c, "F59E0B", 0.5), cover, coverText: "FFFFFF", onAccent };
}
export function loadBrand(ls = typeof localStorage !== "undefined" ? localStorage : null) { try { return JSON.parse((ls && ls.getItem(BRAND_KEY)) || "null"); } catch (e) { return null; } }
export function saveBrand(k, ls = typeof localStorage !== "undefined" ? localStorage : null) { try { ls && (k ? ls.setItem(BRAND_KEY, JSON.stringify(k)) : ls.removeItem(BRAND_KEY)); } catch (e) {} return k; }
/** data:image/png;base64,… → bytes (for the .pptx). */
export function dataUrlBytes(u) {
  const m = String(u || "").match(/^data:image\/(png|jpeg);base64,(.+)$/); if (!m) return null;
  const bin = typeof atob === "function" ? atob(m[2]) : Buffer.from(m[2], "base64").toString("binary");
  const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return { ext: m[1] === "jpeg" ? "jpeg" : "png", bytes: out };
}
