/* ---- v10.2 L1 (Ali OK'd the combined page https://claude.ai/artifact/CkbzEJEpupPdYdBKbjtxdn: "OK-L1", with his condition "it should still
   redirect me to the right listing because I don't want to open the product in search and search again by myself").
   When an agent finds an offer, Attune's browser opens it once (AgentBrowser check mode → agent-kit product()) and reads the page it
   landed on. verifyListing() says whether that page IS the offer: a listing (not a results / category / seller page), the same
   product (the model numbers and words like Pro / Max must all be there — matchScore), the same price (products: within 5 %;
   hotels: the name, since the price moves with the dates). Only then is the address kept on the offer as `verified`, and "Open"
   goes there directly. A page that is not the offer is never kept, and Attune never sends the person to a search page instead.
   Pure; tests: tests/listing/verify.mjs (10,000 + held-out), tests/unit/v1020listing.test.mjs. */
import { cleanListing, listingKind, offerUrl } from "./agent-rules.js";

const fold = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
const CUR_ALIAS = { "$": "usd", "us$": "usd", "€": "eur", "£": "gbp", "egp": "egp", "le": "egp", "l.e": "egp", "l.e.": "egp", "ج.م": "egp", "جنيه": "egp", "sar": "sar", "ر.س": "sar", "aed": "aed", "د.إ": "aed" };
const curOf = (c) => { const k = fold(c).replace(/\s+/g, ""); return CUR_ALIAS[k] || k; };
// ---- the same product / the same hotel? ----
const UNIT = /(\d+(?:[.,]\d+)?)\s*(gb|tb|mb|mah|w|l|ml|kg|g|mm|cm|inch|in|"|hz|mp)(?![\p{L}])/giu;
// (a model code's region / colour suffix is part of the code: "HD9650/91", "SM-R630/DS" → one word, never a model number of its own)
const norm = (s) => fold(s).replace(/\b([a-z]{1,4}-?\d{2,}[a-z\d]*)\/[a-z\d]{1,4}\b/gi, "$1").replace(UNIT, (m, n, u) => n.replace(",", ".") + (u === '"' ? "in" : u)).replace(/[^\p{L}\p{N}.]+/gu, " ").replace(/(?<!\d)\.|\.(?!\d)/g, " ").trim();
const toks = (s) => norm(s).split(/\s+/).filter(Boolean);
// words that make another model: a generation number, Pro / Max / Ultra…, a size
const VAR = /^(pro|max|plus|ultra|mini|lite|se|fe|slim|xl|xxl|xs|compact|neo|edge|fold|flip|note|air)$/;
const hardTok = (w) => /\d/.test(w) || VAR.test(w);
const bareTok = (w) => /^\d{1,3}$/.test(w) || VAR.test(w);   // "2", "16", "Pro" — not codes like 15irh8 or 128gb
// a thing FOR the product: a case, a cover, a charger, a controller…
const ACC = /^(case|cases|cover|covers|charger|cable|strap|band|protector|skin|stand|holder|mount|adapter|controller|remote|replacement|compatible|for|sleeve|pouch|glass|film|tips|dock|جراب|كفر|شاحن|سلك|اسكرينه|حامل)$/;
const STAY_STOP = /^(hotel|hotels|and|the|by|spa|of|in|at|a|فندق)$/;
/** Is the page's item the offer's item? (products: every model word on both sides, the same kind of thing; stays: the same name) */
export function sameItem(offerName, pageName, stay = false) {
  const o = toks(offerName), title = toks(String(pageName || "").split(/\s[|–—]\s|\s-\s|,|\(updated/i)[0]), p = toks(pageName);
  if (!o.length || !p.length) return false;
  const P = new Set(p), O = new Set(o);
  if (stay) {
    const key = o.filter((w) => !STAY_STOP.test(w));
    const key2 = title.filter((w) => !STAY_STOP.test(w));
    return key.length > 0 && key.every((w) => P.has(w)) && key2.filter((w) => !O.has(w)).length <= 2;
  }
  if (o.filter(hardTok).some((w) => !P.has(w))) return false;            // the offer's 2 / Pro / 128gb must be on the page
  if (title.filter(bareTok).some((w) => !O.has(w))) return false;        // the page's Pro / 16 / XXL must be the offer's
  // a case FOR it is not it: an accessory word before the product's own words, or "for / compatible" in the title
  // ("Silicone Case for AirPods Pro 2" — but "AirPods Pro 2 … with Charging Case" is the earbuds)
  if (!o.some((w) => ACC.test(w))) { const first = title.findIndex((w) => O.has(w)), acc = title.findIndex((w) => ACC.test(w));
    if (acc >= 0 && (first < 0 || acc < first || title.some((w) => w === "for" || w === "compatible"))) return false; }
  const soft = o.filter((w) => !hardTok(w) && w.length > 1), common = soft.filter((w) => P.has(w)).length;
  const tsoft = title.filter((w) => !hardTok(w) && w.length > 1), tcommon = tsoft.filter((w) => O.has(w)).length;
  return (soft.length ? common / soft.length >= 0.6 : true) || (tsoft.length ? tcommon / tsoft.length >= 0.6 : false);
}

/** Is it a hotel / stay (its price depends on the dates on the page)? */
export const isStay = (a, o) => !!((o && (o.checkin || o.checkout)) || (a && a.fields && (a.fields.hotel || a.fields.city)) || /booking\.com|agoda\.|expedia\.|airbnb\.|hotels\.com|trip\.com|almosafer/i.test(String((o && (o.href || o.url)) || "")));

/** offer = what the agent found { name, price, currency, href, url, checkin, checkout }; page = agent-kit product() { url, canonical,
 *  name, price, currency, many }; landed = the address the browser ended on. → { ok, why, url, page } — why: "listing" | "results" |
 *  "other product" | "other price" | "no page" */
export function verifyListing(a, o, page, landed = "") {
  if (!page || !(page.name || page.price)) return { ok: false, why: "no page" };
  const stay = isStay(a, o);
  // the address to keep: the page's own (canonical) address when it is a listing, else where the browser landed
  const cands = [page.canonical, page.url, landed].map((u) => cleanListing(u)).filter(Boolean);
  const own = cands.find((u) => listingKind(u) === "yes") || cands.find((u) => listingKind(u) === "maybe") || "";
  if (!own || (page.many > 3 && listingKind(own) !== "yes")) return { ok: false, why: "results" };
  // the same product: every model number / Pro / Max of the offer on the page, and most of its words (both ways round: a store's
  // page name is often longer — "HUAWEI FreeClip 2 Open-Ear Earbuds, Black, Dual-Driver…")
  const on = String((o && o.name) || ""), pn = String(page.name || "");
  if (on && pn && !sameItem(on, pn, stay)) return { ok: false, why: "other product" };
  // the same price (products); a stay's price is the dates' — checked only when the page shows one in the same money
  const op = +((o && o.price) || 0), pp = +(page.price || 0);
  if (op > 0 && pp > 0 && (!page.currency || !o.currency || curOf(page.currency) === curOf(o.currency))) {
    const off = Math.abs(pp - op) / op;
    if (off > (stay ? 0.25 : 0.05)) return { ok: false, why: "other price" };
  }
  if (!(pp > 0) && listingKind(own) !== "yes") return { ok: false, why: "results" };
  // a stay keeps its days and guests in the address (offerUrl adds them when the page dropped them)
  const url = stay ? offerUrl(a || {}, { ...o, href: own }) : own;
  return { ok: true, why: "listing", url, page: { name: pn.slice(0, 200), price: pp, currency: page.currency || "", photo: page.photo || "", rating: +page.rating || 0, reviews: +page.reviews || 0, seller: page.seller || "", delivery: page.delivery || "" } };
}

/** The offers of an agent that still need their page checked (the best 3, and the find waiting for "Order it"), at most `n`. */
export function toVerify(a, n = 3) {
  const list = [...(a && a.pending ? [a.pending] : []), ...((a && a.best3) || [])];
  const seen = new Set(), out = [];
  for (const o of list) {
    if (!o) continue; const k = (o.key || o.name || "") + "|" + (o.price || "") + "|" + (o.site || "");
    if (seen.has(k)) continue; seen.add(k);
    if (o.verified && o.verified.price === o.price) continue;   // checked at this price already
    if (o.unverified && Date.now() - o.unverified < 6 * 3600e3) continue;   // tried in the last 6 hours
    out.push(o); if (out.length >= n) break;
  }
  return out;
}

/** Put what the check found on every copy of that offer (best 3, the find waiting, the day table). */
export function markVerified(a, o, res, now = Date.now()) {
  const same = (x) => x && o && (x === o || (x.key && x.key === o.key) || (x.name && x.name === o.name && x.price === o.price && (x.site || "") === (o.site || "")));
  const fix = (x) => (!same(x) ? x : res && res.ok ? { ...x, href: res.url, verified: { at: now, price: x.price, url: res.url }, page: res.page, unverified: 0 } : { ...x, unverified: now, why: res ? res.why : "no page" });
  return { ...a, ...(a.best3 ? { best3: a.best3.map(fix) } : {}), ...(a.pending ? { pending: fix(a.pending) } : {}), ...(a.byDay ? { byDay: a.byDay.map((d) => (d && d.offers ? { ...d, offers: d.offers.map(fix) } : d)) } : {}) };
}
