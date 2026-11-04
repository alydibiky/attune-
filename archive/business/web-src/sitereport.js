import { tr } from "./i18n.js";
/* ---- v6.37 (upgrade W3): voice site report — speak it on site (Arabic or English), add photos; every photo is stamped
   with its time and place (GPS when the phone gives it), and the finished record + photos become ONE PDF to send.
   Pure (tests/unit/v740sitereport.test.mjs); the page is site-ui.jsx. */
const pad = (n) => String(n).padStart(2, "0");
export const stampTime = (t) => { const d = new Date(t); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const stampPlace = (lat, lon) => (lat == null || lon == null ? "" : `${(+lat).toFixed(5)}, ${(+lon).toFixed(5)}`);
/** The line printed under a photo: "Photo 2 · 18/10/2026 14:05 · 30.04442, 31.23571 · crack near the outrigger". */
export function stampLine(p, i, lang = "en") {
  const where = stampPlace(p.lat, p.lon);
  return [(lang === "ar" ? "صورة " : tr("Photo ")) + (i + 1), stampTime(p.at), where, String(p.note || "").trim()].filter(Boolean).join(" · ");
}
const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
/** The report + its photos → printable HTML (A4), two photos per row, each with its stamp; a map link per located photo. */
export function reportHtml({ title, text, by = "", photos = [], lang = "en", now = Date.now() }) {
  const rtl = lang === "ar" || /[؀-ۿ]/.test(text || "");
  const L = rtl ? { by: "كتبه", at: "التاريخ", photos: "الصور" } : { by: "Filed by", at: "Date", photos: "Photos" };
  const ph = photos.map((p, i) => `<figure><img src="${esc(p.url)}" alt=""><figcaption>${esc(stampLine(p, i, rtl ? "ar" : "en"))}${p.lat != null ? ` · <a href="https://maps.google.com/?q=${p.lat},${p.lon}">map</a>` : ""}</figcaption></figure>`).join("");
  return `<!doctype html><html dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:13px system-ui,Segoe UI,Tahoma,sans-serif;margin:28px;color:#0F172A}h1{font-size:19px;margin:0 0 4px}.m{color:#475569;margin:0 0 14px}pre{white-space:pre-wrap;font:13px/1.55 system-ui,Tahoma,sans-serif;margin:0 0 18px}h2{font-size:15px;margin:18px 0 8px}.g{display:grid;grid-template-columns:1fr 1fr;gap:10px}figure{margin:0;break-inside:avoid}img{width:100%;border-radius:6px;border:1px solid #CBD5E1}figcaption{font-size:11px;color:#334155;margin-top:3px}</style></head><body>
<h1>${esc(title)}</h1><p class="m">${L.at}: ${esc(stampTime(now))}${by ? ` · ${L.by}: ${esc(by)}` : ""}</p><pre>${esc(text)}</pre>${photos.length ? `<h2>${L.photos} (${photos.length})</h2><div class="g">${ph}</div>` : ""}</body></html>`;
}
