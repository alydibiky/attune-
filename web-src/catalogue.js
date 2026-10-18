/* ---- v6.40 (upgrade W4) — Shop catalogue: the shop's items with their shelf prices and whether they are in stock, as a WhatsApp
   message and as a page / PDF, with "Order on WhatsApp" links (wa.me + the item). Built from Books on the phone, so it always
   matches the stock; when a price or the stock changed since it was last shared, the Stock tab says "share the new one".
   (A live web link would need a server — Attune keeps the shop on the phone, so the catalogue is shared as a message and a
   file.) Pure; tests/unit/v740catalogue.test.mjs. */
import * as Ops from "./books-ops.js";
import * as B from "./books.js";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (m, cur) => B.fromMinor(m).toLocaleString("en-US", { maximumFractionDigits: 2 }) + (cur ? " " + cur : "");
const phoneOf = (p) => String(p || "").replace(/[^\d]/g, "").replace(/^0(?=1\d{9}$)/, "20");   // an Egyptian 01… number → 201…

/** → [{ name, price (minor), inStock: true | false | null (not tracked) }] — items with a price, ingredients left out */
export function catalogueItems(books) {
  const lv = Ops.levels(books);
  return (books.items || []).filter((i) => i.price > 0 && !i.ingredient && !i.hidden).map((i) => ({ id: i.id, name: i.name, price: i.price,
    inStock: i.track === false ? null : ((lv[i.id] || { qty: 0 }).qty > 0) }));
}
/** A fingerprint of what the catalogue shows — it changes when a price or "in stock / sold out" changes. */
export function catalogueStamp(books) { return catalogueItems(books).map((x) => `${x.id}:${x.price}:${x.inStock}`).join("|"); }

export function catalogueText(books, { phone = "", lang = "en", soldOut = true } = {}) {
  const ar = lang === "ar", cur = books.currency, list = catalogueItems(books).filter((x) => soldOut || x.inStock !== false);
  const L = list.map((x) => `• ${x.name} — ${money(x.price, cur)}${x.inStock === false ? (ar ? " (خلص)" : " (sold out)") : ""}`);
  const p = phoneOf(phone);
  return (ar ? `🛍️ ${books.company.name} — الأسعار النهارده\n` : `🛍️ ${books.company.name} — today's prices\n`) + L.join("\n") + (p ? (ar ? `\n\nللطلب: wa.me/${p}` : `\n\nTo order: wa.me/${p}`) : "");
}
export function catalogueHtml(books, { phone = "", lang = "en", color = "#0f766e", date = new Date().toISOString().slice(0, 10) } = {}) {
  const ar = lang === "ar", cur = books.currency, p = phoneOf(phone);
  const order = (x) => p ? `<a href="https://wa.me/${p}?text=${encodeURIComponent((ar ? "عايز أطلب: " : "I'd like to order: ") + x.name)}">${ar ? "اطلب على واتساب" : "Order on WhatsApp"}</a>` : "";
  return `<!doctype html><html lang="${ar ? "ar" : "en"}" dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#111}h1{color:${color};margin:0 0 4px}p.d{color:#666;margin:0 0 16px}
.i{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #e5e7eb}.n{flex:1;font-weight:600}.p{font-weight:700}.s{color:#b91c1c;font-size:12px}
a{color:#fff;background:#16a34a;padding:5px 10px;border-radius:8px;text-decoration:none;font-size:12px;white-space:nowrap}</style></head><body>
<h1>${esc(books.company.name)}</h1><p class="d">${ar ? "الأسعار بتاريخ" : "Prices on"} ${esc(date)}</p>
${catalogueItems(books).map((x) => `<div class="i"><span class="n">${esc(x.name)}${x.inStock === false ? ` <span class="s">${ar ? "خلص" : "sold out"}</span>` : ""}</span><span class="p">${esc(money(x.price, cur))}</span>${x.inStock === false ? "" : order(x)}</div>`).join("")}
</body></html>`;
}
