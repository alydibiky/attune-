// v8.6: docs/privacy-policy.html (the page Google Play links to) is built from the SAME text the app shows (web-src/privacy.js),
// so the published policy can never fall behind the app again. Run: node tools/privacy_html.mjs
import { writeFileSync } from "node:fs";
import { PRIVACY, PRIVACY_UPDATED } from "../web-src/privacy.js";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const part = (rows) => rows.map(([h, p]) => `<h2>${esc(h)}</h2><p>${esc(p)}</p>`).join("\n");
const AR_DATE = { October: "أكتوبر", November: "نوفمبر", December: "ديسمبر" };
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Attune — Privacy policy</title>
<style>body{font-family:system-ui,"Segoe UI",Roboto,"Noto Sans Arabic",sans-serif;max-width:760px;margin:0 auto;padding:24px 16px;line-height:1.6;color:#16201d;background:#f4f5f3}h1{font-size:26px}h2{font-size:17px;margin-top:22px}.ar{direction:rtl;text-align:right;border-top:1px solid #ccc;margin-top:40px;padding-top:10px}</style></head><body>
<h1>Attune — Privacy policy</h1><p><em>Updated ${esc(PRIVACY_UPDATED)}</em></p>
${part(PRIVACY.en)}
<div class="ar" lang="ar"><h1>Attune — سياسة الخصوصية</h1><p><em>آخر تحديث ${esc(PRIVACY_UPDATED.replace(/[A-Za-z]+/, (m) => AR_DATE[m] || m))}</em></p>
${part(PRIVACY.ar)}
</div></body></html>
`;
writeFileSync(new URL("../docs/privacy-policy.html", import.meta.url), html);
console.log("docs/privacy-policy.html: " + PRIVACY.en.length + " sections (EN) + " + PRIVACY.ar.length + " (AR), updated " + PRIVACY_UPDATED);
