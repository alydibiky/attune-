// v10.0.2 (Ali, 16 Nov 2026: "agents still does not open to the specific listing so fix it for good") — EXACTLY 10,000 links as an
// agent reads them on a store's or a hotel site's results: a product / hotel page (clean, with tracking, or wrapped in an ad hop),
// or a link that is NOT the listing (the search itself, a category, a brand, a seller's shop, a bare ad hop, nothing). Truth written
// HERE: a listing is opened directly at its own clean page (its id kept, no ad hop, no tracking); anything else is never opened as
// if it were the product — Attune's browser finds the offer by name on the results (with a fallback).
//     node tests/listing/gen.mjs [n]      HELDOUT=1 → other stores and link shapes, written after the code (heldout.mjs)
import fs from "fs";
const R = await import("../../web-src/agent-rules.js");
const H = process.env.HELDOUT ? (await import("./heldout.mjs")).H : null;
const N = +(process.argv[2] || 10000);
let seed = 9091 + 7919 * +(process.env.SEED_SHIFT || 0) + (H ? 31 : 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const AZ = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789", asin = () => "B0" + Array.from({ length: 8 }, () => AZ[int(0, AZ.length - 1)]).join("");
const THINGS = ["huawei freeclip 2 wireless earbuds black", "samsung galaxy a55 5g 256gb", "anker soundcore liberty 4 nc", "xiaomi redmi note 13 pro", "tornado air fryer 5 litre digital", "apple airpods pro 2 usb c", "sony wh 1000xm5 headphones", "jbl flip 6 bluetooth speaker"];
const HOTELS = ["swissotel makkah", "pullman zamzam makkah", "hilton suites makkah", "le meridien towers makkah", "four seasons cairo nile plaza"];
const slug = (s) => s.replace(/\s+/g, "-"), q = (s) => encodeURIComponent(s).replace(/%20/g, "+");
// each store: its search page, its product pages (id = what must survive), and pages that are NOT a listing
const SITES = H ? H.sites : [
  { site: "Amazon", search: (t) => `https://www.amazon.eg/s?k=${q(t)}&language=en`, prod: (t) => { const a = asin(); return { id: "/dp/" + a, url: pick([`https://www.amazon.eg/${slug(t)}/dp/${a}/`, `https://www.amazon.eg/dp/${a}`, `https://www.amazon.eg/gp/product/${a}`, `https://www.amazon.eg/-/en/${slug(t)}/dp/${a}/ref=sr_1_3`]) }; },
    not: (t) => pick([`https://www.amazon.eg/s?k=${q(t)}&page=2`, `https://www.amazon.eg/stores/page/1A2B3C4D-5E6F`, `https://www.amazon.eg/b?node=21832883031`, `https://www.amazon.eg/gp/help/customer/display.html`]) },
  { site: "noon", search: (t) => `https://www.noon.com/egypt-en/search/?q=${q(t)}`, prod: (t) => { const id = "N" + int(10000000, 99999999) + "A"; return { id, url: `https://www.noon.com/egypt-en/${slug(t)}/${id}/p/` }; },
    not: (t) => pick([`https://www.noon.com/egypt-en/search/?q=${q(t)}&page=2`, `https://www.noon.com/egypt-en/electronics-and-mobiles/`, `https://www.noon.com/egypt-en/seller/p-12345/`.replace("/p-12345/", "/s-12345/"), `https://www.noon.com/egypt-en/brand/huawei/`]) },
  { site: "Jumia", search: (t) => `https://www.jumia.com.eg/catalog/?q=${q(t)}`, prod: (t) => { const id = String(int(10000000, 99999999)); return { id, url: `https://www.jumia.com.eg/${slug(t)}-${id}.html` }; },
    not: (t) => pick([`https://www.jumia.com.eg/catalog/?q=${q(t)}&page=3`, `https://www.jumia.com.eg/phones-tablets/`, `https://www.jumia.com.eg/mlp-huawei-official-store/`, `https://www.jumia.com.eg/seller/tech-zone/`]) },
  { site: "B.TECH", search: (t) => `https://btech.com/en/catalogsearch/result/?q=${q(t)}`, prod: (t) => ({ id: slug(t), url: `https://btech.com/en/${slug(t)}.html` }),
    not: (t) => pick([`https://btech.com/en/catalogsearch/result/?q=${q(t)}`, `https://btech.com/en/moblies/smartphones.html`, `https://btech.com/en/brands/huawei`]) },
  { site: "2B", search: (t) => `https://2b.com.eg/en/catalogsearch/result/?q=${q(t)}`, prod: (t) => ({ id: slug(t), url: `https://2b.com.eg/en/${slug(t)}.html` }),
    not: (t) => pick([`https://2b.com.eg/en/catalogsearch/result/?q=${q(t)}`, `https://2b.com.eg/en/mobile-and-tablet.html`]) },
  { site: "Raya Shop", search: (t) => `https://www.rayashop.com/en/search?q=${q(t)}`, prod: (t) => { const id = String(int(100000, 999999)); return { id, url: `https://www.rayashop.com/en/${slug(t)}-${id}` }; },
    not: (t) => pick([`https://www.rayashop.com/en/search?q=${q(t)}`, `https://www.rayashop.com/en/category/mobiles`]) },
  { site: "Dubizzle", search: (t) => `https://www.dubizzle.com.eg/en/ads/q-${slug(t)}/`, prod: (t) => { const id = "ID" + int(100000000, 999999999); return { id, url: `https://www.dubizzle.com.eg/en/ad/${slug(t)}-${id}.html` }; },
    not: (t) => pick([`https://www.dubizzle.com.eg/en/mobile-phones-tablets-accessories-numbers/`, `https://www.dubizzle.com.eg/en/search/?q=${q(t)}`]) },
  { site: "Carrefour", search: (t) => `https://www.carrefouregypt.com/mafegy/en/v4/search?keyword=${q(t)}`, prod: (t) => { const id = String(int(100000, 999999)); return { id: "/p/" + id, url: `https://www.carrefouregypt.com/mafegy/en/${slug(t)}/p/${id}` }; },
    not: (t) => pick([`https://www.carrefouregypt.com/mafegy/en/v4/search?keyword=${q(t)}`, `https://www.carrefouregypt.com/mafegy/en/c/NFEGY4000000`]) },
  { site: "Tradeline", search: (t) => `https://www.tradelinestores.com/search?q=${q(t)}`, prod: (t) => ({ id: "/products/" + slug(t), url: `https://www.tradelinestores.com/products/${slug(t)}` }),
    not: (t) => pick([`https://www.tradelinestores.com/collections/airpods`, `https://www.tradelinestores.com/search?q=${q(t)}`]) },
  { site: "Booking.com", hotel: true, search: (t) => `https://www.booking.com/searchresults.html?ss=Makkah&checkin=2026-12-10&checkout=2026-12-14&group_adults=2`, prod: (t) => ({ id: "/hotel/sa/" + slug(t) + ".html", url: `https://www.booking.com/hotel/sa/${slug(t)}.html` }),
    not: (t) => pick([`https://www.booking.com/searchresults.html?ss=Makkah&map=1`, `https://www.booking.com/searchresults.html?ss=${q(t)}&nflt=class%3D5`, `https://www.booking.com/reviews/sa/hotel/${slug(t)}.html`]) },
];
const TRACKS = H ? H.tracks : ["utm_source=google&utm_medium=cpc", "ref=sr_1_3&qid=1731700000&sr=8-3", "gclid=EAIaIQobChMI", "fbclid=IwAR0abc", "pd_rd_w=x1&pf_rd_p=y2&pd_rd_r=z3", "srsltid=AfmBOoq", "aid=304142&label=gen173nr", "spm=a2g0o.home"];
// ad hops: the real page is inside
const HOPS = H ? H.hops : [(u) => "https://www.google.com/url?q=" + encodeURIComponent(u) + "&sa=U&ved=2ah", (u) => "https://www.googleadservices.com/pagead/aclk?sa=L&ai=DChc&adurl=" + encodeURIComponent(u),
  (u) => { const x = new URL(u); return x.origin + "/sspa/click?ie=UTF8&spc=MTo&url=" + encodeURIComponent(x.pathname + x.search) + "&qualifier=1"; }, (u) => "https://www.awin1.com/cread.php?awinmid=1&ulp=" + encodeURIComponent(encodeURIComponent(u))];
const BARE_HOPS = ["https://www.googleadservices.com/pagead/aclk?sa=L&ai=DChcSEwj", "https://www.google.com/aclk?sa=l&ai=DChc", "https://aax-eu.amazon.eg/x/c/abc/click?x=1".replace("aax-eu.amazon.eg/x/c/abc/click", "www.amazon.eg/gp/slredirect/picassoRedirect.html")];
const bad = {}; let pass = 0, made = 0; const seen = new Set(), kinds = {};
while (made < N) {
  const S = pick(SITES), t = pick(S.hotel ? HOTELS : THINGS), a = { kind: S.hotel ? "watch" : "buy", what: t, site: S.site, url: S.search(t) };
  const name = t.replace(/\b\w/g, (c) => c.toUpperCase()), price = int(300, 90000);
  const k = pick(["prod", "prod+track", "prod+track", "prod+hop", "prod+hop", "not", "not", "not", "barehop", "none"]);
  let href = "", id = "";
  if (k.startsWith("prod")) { const p = S.prod(t); id = p.id; href = p.url;
    if (k !== "prod") href += (href.includes("?") ? "&" : "?") + pick(TRACKS);
    if (k === "prod+hop") href = pick(HOPS)(href); }
  else if (k === "not") href = S.not(t); else if (k === "barehop") href = pick(BARE_HOPS);
  const key = S.site + "|" + href + "|" + name + "|" + price; if (seen.has(key)) { seed += 1; continue; } seen.add(key); made++; kinds[k] = (kinds[k] || 0) + 1;
  const o = { name, price, href, url: a.url, site: S.site, ...(S.hotel ? { checkin: "2026-12-10", checkout: "2026-12-14" } : {}) }, r = R.offerOpen(a, o);
  let why = "";
  if (id) {
    if (!r.direct) why = "a listing not opened directly";
    else if (!decodeURIComponent(r.url).includes(id)) why = "the listing's id lost";
    else if (/sspa\/click|\/aclk|google\.com\/url|googleadservices|awin1|doubleclick/.test(r.url)) why = "the ad hop kept";
    else if (/[?&](?:utm_[a-z]+|gclid|fbclid|qid|sr|ref|pd_rd_w|pf_rd_p|srsltid|spm|aid|label)=/.test(r.url)) why = "tracking kept";
    else if (S.hotel && !/checkin=2026-12-10/.test(r.url)) why = "the hotel's dates lost";
  } else {
    if (r.direct) why = "NOT a listing, but opened as one";
    else if (r.url !== a.url) why = "not sent to its results page";
    else if (!r.goto || r.goto.name !== name || r.goto.price !== price) why = "the offer to find (name, price) lost";
    else if (r.fallback && /sspa\/click|\/aclk|googleadservices|slredirect/.test(r.fallback)) why = "an ad hop as the fallback";
  }
  if (why) { const kk = why + " — " + S.site + " · " + k; (bad[kk] = bad[kk] || []).push(href); } else pass++;
}
const md = `# Opening the exact listing — ${N} links, ${pass} right (${(100 * pass / N).toFixed(2)}%)${H ? " — HELD-OUT" : ""}\n\n` + Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(" · ") + "\n\n" + Object.entries(bad).sort((a, b) => b[1].length - a[1].length).slice(0, 30).map(([k, v]) => `- **${k}** × ${v.length} — e.g. ${v[0]}`).join("\n") + "\n";
if (N === 10000) fs.writeFileSync(new URL(H ? "./report-heldout.md" : "./report.md", import.meta.url), md);
console.log(md.slice(0, 5000));
