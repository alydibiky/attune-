// v10.2 L1 (Ali OK'd: "it should still redirect me to the right listing — I don't want to open the product in search and search again")
// — EXACTLY 10,000 checks of "is the page Attune landed on THIS offer?": products in Egyptian / Gulf stores and hotels on booking sites;
// the right listing (a longer name, the price a little off, an ad hop or tracking in the address, the canonical address), and every
// way it can be wrong (a results / category / brand page, another model — 16 vs 16 Pro, FreeClip vs FreeClip 2, a case FOR it —, another
// seller's price, another hotel). Truth written HERE; a wrong "ok" is the mistake that matters (it would send Ali to the wrong page).
//     node tests/listing/verify.mjs [n]      HELDOUT=1 → other products / stores / hotels written after the code (verify-heldout.mjs)
const L = await import("../../web-src/listing.js");
const H = process.env.HELDOUT ? (await import("./verify-heldout.mjs")).H : null;
const N = +(process.argv[2] || 10000);
let seed = 9090 + (H ? 77 : 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const ASIN = () => "B0" + Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789"[int(0, 33)]).join("");
// [the offer's name, a longer page name, another model that must NOT pass, price range]
const PRODUCTS = H ? H.products : [
  ["HUAWEI FreeClip 2", "HUAWEI FreeClip 2 Open-Ear Earbuds, Dual-Driver, Black", "HUAWEI FreeClip Open-Ear Earbuds, Black", [6500, 9000]],
  ["Apple AirPods Pro 2", "Apple AirPods Pro 2 Wireless Earbuds with USB-C Charging Case", "Silicone Case for Apple AirPods Pro 2, Pink", [9000, 14000]],
  ["iPhone 16 128GB", "Apple iPhone 16 (128 GB) - Ultramarine", "Apple iPhone 16 Pro (128 GB) - Desert Titanium", [45000, 60000]],
  ["Samsung Galaxy S25 Ultra 256GB", "Samsung Galaxy S25 Ultra, 256GB, 12GB RAM, Titanium Gray", "Samsung Galaxy S25, 256GB, Navy", [55000, 75000]],
  ["PlayStation 5 Slim", "Sony PlayStation 5 Slim Console (Disc Edition) 1TB", "PlayStation 5 DualSense Controller, White", [25000, 35000]],
  ["Xiaomi Redmi Note 14 Pro", "Xiaomi Redmi Note 14 Pro 8GB/256GB Midnight Black", "Xiaomi Redmi Note 14 8GB/256GB", [12000, 17000]],
  ["Tefal Air Fryer Easy Fry XXL", "Tefal Easy Fry XXL Air Fryer EY801 5.6L", "Tefal Easy Fry Compact Air Fryer 1.6L", [5000, 8000]],
  ["Lenovo IdeaPad Slim 3 i5", "Lenovo IdeaPad Slim 3 15IRH8 Laptop - Intel Core i5-13420H, 16GB, 512GB SSD", "Lenovo IdeaPad Slim 3 Laptop Intel Core i3, 8GB", [28000, 38000]],
];
const STORES = H ? H.stores : [
  ["Amazon", "EGP", () => { const a = ASIN(); return { own: `https://www.amazon.eg/-/en/Huawei-FreeClip/dp/${a}?ref=sr_1_3&qid=17&th=1`, clean: `https://www.amazon.eg/dp/${a}`, search: "https://www.amazon.eg/s?k=freeclip+2", hop: (u) => `https://www.amazon.eg/sspa/click?ie=UTF8&url=${encodeURIComponent(u.replace("https://www.amazon.eg", ""))}` }; }],
  ["noon", "EGP", () => { const id = "N" + int(10000000, 99999999) + "A"; return { own: `https://www.noon.com/egypt-en/freeclip-2/${id}/p/?o=${id.toLowerCase()}-1`, search: "https://www.noon.com/egypt-en/search/?q=freeclip%202", hop: null }; }],
  ["Jumia", "EGP", () => { const n = int(100000, 999999); return { own: `https://www.jumia.com.eg/huawei-freeclip-2-${n}.html`, search: "https://www.jumia.com.eg/catalog/?q=freeclip+2", hop: null }; }],
  ["B.TECH", "EGP", () => { const n = int(1000, 99999); return { own: `https://btech.com/en/huawei-freeclip-2-black-${n}.html`, search: "https://btech.com/en/catalogsearch/result/?q=freeclip", hop: null }; }],
  ["Amazon.sa", "SAR", () => { const a = ASIN(); return { own: `https://www.amazon.sa/dp/${a}/ref=sr_1_1`, clean: `https://www.amazon.sa/dp/${a}`, search: "https://www.amazon.sa/s?k=airpods+pro+2", hop: (u) => `https://www.google.com/url?q=${encodeURIComponent(u)}&sa=D` }; }],
];
const HOTELS = H ? H.hotels : [["Le Méridien Pyramids Hotel & Spa", "le-meridien-pyramids", "Steigenberger Pyramids Cairo"], ["Marriott Mena House, Cairo", "mena-house-oberoi", "Pyramids Park Resort Cairo"],
  ["Hilton Suites Makkah", "hilton-suites-makkah", "Hilton Makkah Convention Hotel"], ["Swissôtel Al Maqam Makkah", "swissotel-al-maqam-makkah", "Swissôtel Makkah"],
  ["Rixos Premium Seagate", "rixos-premium-seagate", "Rixos Sharm El Sheikh"], ["Kempinski Hotel Soma Bay", "kempinski-soma-bay", "Steigenberger Aqua Magic"]];
const bad = {}; let pass = 0, made = 0, wrongOk = 0; const kinds = {};
for (; made < N; made++) {
  let a = {}, o, page, landed = "", want, kind;
  if (rnd() < 0.62) {   // a product
    const [name, long, other, [lo, hi]] = pick(PRODUCTS), [site, cur, mk] = pick(STORES), u = mk(), price = int(lo, hi);
    a = { what: name, kind: "buy" }; o = { name: rnd() < 0.5 ? name : long.slice(0, 60), price, currency: cur, site, url: u.search };
    kind = pick(["right", "right", "right", "rightCanon", "rightHop", "rightNearPrice", "results", "category", "other", "otherPrice", "noName"]);
    const base = { name: long, price, currency: cur, many: 0, photo: "https://img/x.jpg", rating: 4.6 };
    if (kind === "right") { page = { ...base, url: u.own }; want = true; }
    else if (kind === "rightCanon") { page = { ...base, url: u.own + "&psc=1", canonical: u.clean || u.own }; want = true; }
    else if (kind === "rightHop") { page = { ...base, url: u.own }; landed = u.hop ? u.hop(u.own) : u.own; want = true; }
    else if (kind === "rightNearPrice") { page = { ...base, url: u.own, price: Math.round(price * (1 + (rnd() * 0.08 - 0.04))) }; want = true; }
    else if (kind === "results") { page = { ...base, name: long.split(" ").slice(0, 2).join(" ") + " - Search results", url: u.search, many: int(8, 40) }; want = false; }
    else if (kind === "category") { page = { ...base, name: "Headphones & Earbuds", url: u.search.replace(/\/s\?.*|search.*|catalog.*/, "category/headphones"), many: int(10, 60), price: 0 }; want = false; }
    else if (kind === "other") { page = { ...base, name: other, url: u.own }; want = false; }
    else if (kind === "otherPrice") { page = { ...base, url: u.own, price: Math.round(price * (rnd() < 0.5 ? 1.12 + rnd() * 0.5 : 0.6 + rnd() * 0.25)) }; want = false; }
    else { page = { ...base, name: "", url: u.own }; want = true; }   // the page's name not read; the address is the product's own and the price matches
  } else {   // a hotel
    const [hn, slug, other] = pick(HOTELS), d = int(10, 20), ci = `2026-12-${d}`, co = `2026-12-${d + 3}`, price = int(9000, 40000);
    const own = pick([`https://www.booking.com/hotel/eg/${slug}.html`, `https://www.booking.com/hotel/sa/${slug}.en-gb.html?aid=304142&label=gen173`, `https://www.agoda.com/${slug}/hotel/cairo-eg.html?cid=1844104`]);
    a = { fields: { hotel: true, city: "Giza" }, url: `https://www.booking.com/searchresults.html?ss=Giza&checkin=${ci}&checkout=${co}&group_adults=2` };
    o = { name: hn, price, currency: "EGP", checkin: ci, checkout: co, site: "Booking.com", url: a.url };
    kind = pick(["stayRight", "stayRight", "stayRightPrice", "stayResults", "stayOther"]);
    const base = { name: hn + pick(["", ", Giza (updated prices 2026)", " – Cairo", " | Booking.com"]), price: 0, currency: "EGP", many: 0 };
    if (kind === "stayRight") { page = { ...base, url: own }; want = true; }
    else if (kind === "stayRightPrice") { page = { ...base, url: own, price: Math.round(price * (0.85 + rnd() * 0.3)) }; want = true; }
    else if (kind === "stayResults") { page = { ...base, name: "Giza: 312 properties found", url: a.url, many: int(10, 30) }; want = false; }
    else { page = { ...base, name: other, url: own.replace(slug, other.toLowerCase().replace(/[^a-z]+/g, "-")) }; want = false; }
  }
  kinds[kind] = (kinds[kind] || 0) + 1;
  const r = L.verifyListing(a, o, page, landed);
  let why = "";
  if (r.ok !== want) why = (want ? "right page refused (" + r.why + ")" : "WRONG PAGE ACCEPTED") + " · " + kind;
  else if (want && /search|catalogsearch|\/s\?|searchresults|\/catalog\//.test(r.url)) why = "kept a search address · " + kind;
  else if (want && o.checkin && /booking\.com/.test(r.url) && !(r.url.includes("checkin=" + o.checkin))) why = "the stay lost its dates · " + kind;
  else if (want && /sspa|google\.com\/url|qid=|ref=/.test(r.url)) why = "kept an ad / tracking address · " + kind;
  if (why) { if (!want && r.ok) wrongOk++; (bad[why] = bad[why] || []).push(JSON.stringify({ o: o.name, page: page.name, url: page.url, got: r.url || r.why }).slice(0, 220)); } else pass++;
}
const pct = (pass / N * 100).toFixed(2);
console.log(`${H ? "held-out" : "generated"}: ${N} checks — right: ${pass} (${pct}%) · wrong pages accepted: ${wrongOk}`);
for (const [k, v] of Object.entries(bad)) console.log(" ", v.length, k, "e.g.", v[0]);
if (process.env.REPORT) (await import("fs")).writeFileSync(new URL(H ? "./verify-report-heldout.md" : "./verify-report.md", import.meta.url), `# Is this page the offer? — ${H ? "held-out" : "10,000"}\n\n${N} checks: **${pct}%** right, wrong pages accepted: **${wrongOk}**.\n\nKinds: ${JSON.stringify(kinds)}\n\n` + Object.entries(bad).map(([k, v]) => `- ${v.length} × ${k} — e.g. ${v[0]}`).join("\n") + "\n");
