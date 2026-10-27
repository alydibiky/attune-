/* ---- v8.5 (Ali, 27 Oct: "why not get all the information from reputable sites — there are sites that hold the whole information
   of a car — or from YouTube videos; instead of quantity I want quality") — Option A of REVIEW_2026-10-27 §C.
   1. TRUSTED: for cars, phones and machines, the sites that hold a whole spec sheet per version (auto-data.net, ultimatespecs,
      gsmarena, lectura-specs …), the Egyptian price sites (hatla2ee, contactcars, yallamotor) and serious reviewers. The search
      asks THEM first ("site:auto-data.net Lynk & Co 900") instead of ten random pages.
   2. specCards: every spec page → one column (one version), its rows copied by CODE from the page's own "Spec | Value" table.
      The model never re-types a figure; it writes the overview, what reviewers say, pros and cons.
   3. egyptPrices: price rows from the Egyptian price sites (trim → EGP price), copied as written.
   4. YouTube reviews (WebTools.videoReviews): the transcripts of the top review videos, read like pages — "what reviewers say".
   Pure; tests/unit/v850trusted.test.mjs.                                                                                      */
import { ATTRS } from "./factsheet.js";

const host = (u) => String(u || "").replace(/^https?:\/\//i, "").split(/[/?#]/)[0].replace(/^www\./, "").toLowerCase();

// [site, role] — role: specs (a whole spec sheet per version) | price (Egypt) | review
export const TRUSTED = {
  vehicle: [["auto-data.net", "specs"], ["ultimatespecs.com", "specs"], ["ev-database.org", "specs"], ["carnewschina.com", "specs"],
    ["hatla2ee.com", "price"], ["contactcars.com", "price"], ["yallamotor.com", "price"],
    ["topgear.com", "review"], ["autocar.co.uk", "review"], ["carwow.co.uk", "review"], ["whatcar.com", "review"], ["caranddriver.com", "review"], ["insideevs.com", "review"]],
  gadget: [["gsmarena.com", "specs"], ["notebookcheck.net", "specs"], ["phonearena.com", "specs"], ["btech.com", "price"], ["2b.com.eg", "price"],
    ["theverge.com", "review"], ["techradar.com", "review"], ["tomsguide.com", "review"]],
  machine: [["lectura-specs.com", "specs"], ["ritchiespecs.com", "specs"], ["cranepedia.com", "specs"], ["liebherr.com", "specs"], ["tadano.com", "specs"],
    ["manitowoc.com", "specs"], ["khl.com", "review"], ["cranenetwork.com", "review"]],
};
const ALL = Object.entries(TRUSTED).flatMap(([kind, l]) => l.map(([s, role]) => ({ s, role, kind })));
/** The trusted site a page is from → { s, role, kind } | null */
export function trustedOf(url) {
  const h = host(url);
  return ALL.find((t) => h === t.s || h.endsWith("." + t.s)) || null;
}

/**
 * The searches for a subject — trusted sites first, few and targeted: the spec sheets, the Egyptian price, one review site.
 * t = the bare subject ("Lynk & Co 900"). → queries (at most n)
 */
export function trustedQueries(t, kind, { egypt = true, n = 5 } = {}) {
  const list = TRUSTED[kind]; if (!list || !t) return [];
  const pick = (role, k) => list.filter((x) => x[1] === role).slice(0, k).map((x) => x[0]);
  const spec = pick("specs", 2), price = egypt ? pick("price", 2) : [], rev = pick("review", 1);
  const out = [...spec.map((s) => `site:${s} ${t}`), ...price.map((s) => `site:${s} ${t}`), ...rev.map((s) => `site:${s} ${t} review`)];
  return out.slice(0, n);
}

/** Search-ranking bonus for a page: a trusted site counts far more than an unknown one. */
export const trustedBonus = (url) => (trustedOf(url) ? 3 : 0);

// "Spec | Value" rows (2 cells), and "Spec: value" lines
const pairsOf = (text) => String(text || "").split("\n").map((l) => l.replace(/^\[[^\]]{1,80}\]\s*/, "").trim()).map((l) => {
  if (l.includes("|")) { const c = l.split("|").map((x) => x.trim()).filter(Boolean); return c.length === 2 ? c : null; }
  const m = /^([^:]{2,40}):\s+(.{1,80})$/.exec(l); return m ? [m[1], m[2]] : null;
}).filter(Boolean);

// rows a spec card shows, in this order (ids from factsheet ATTRS)
const CARD = ["powertrain", "engine", "motor", "power", "torque", "battery", "range", "fuel", "accel", "top", "drive", "charge", "length", "width", "height",
  "wheelbase", "weight", "seats", "capacity", "boom", "screen", "storage", "ram", "camera", "price"];
const AT = new Map(ATTRS.map((a) => [a[0], a]));
// labels that look like a spec but are another one ("Power per litre", "Weight-to-power ratio", "Range of seats") are skipped
const NOT = /\bper (litre|liter|ton|kg)\b|\bratio\b|to-power|power-to|\bmax\.? weight|\bpermitted\b|\btrailer\b|\btowing\b|\broof load|\b(fuel )?tank\b|\(nedc\)/i;

/** One page → { name, site, url, values: Map(id → value) } when it is a spec sheet (5+ specs in its own table), else null. */
export function specCard(page) {
  const vals = new Map();
  for (const [label, value] of pairsOf(page && page.text)) {
    if (label.length > 60 || NOT.test(label)) continue;
    for (const id of CARD) {
      if (vals.has(id)) continue;
      const [, , , key, val] = AT.get(id);
      if (!key.test(label)) continue;
      const m = value.match(val) || (id === "seats" && /^\s*(\d{1,2})\s*$/.exec(value));
      if (m) { vals.set(id, (id === "powertrain" || id === "drive" ? m[0] : value.length <= 48 ? value : m[0]).replace(/\s+/g, " ").trim()); break; }
    }
  }
  if (vals.size < 5) return null;
  const name = String((page && page.title) || "").replace(/\s*[|–—-]\s*(auto-data\.net|ultimatespecs\.com|gsmarena\.com|ev database|lectura specs|ritchiespecs|carnewschina|specifications?|specs?|technical specs?)\b.*$/i, "")
    .replace(/\b(technical )?(specifications?|specs?|data|fuel consumption|dimensions)\b[, &]*/gi, " ").replace(/\s{2,}/g, " ").trim().slice(0, 70);
  return { name: name || host(page.url), site: host(page.url), url: page.url, values: vals };
}

/**
 * Spec sheets from several pages → one table, a column per version (at most `max`), rows copied by code.
 * pages: [{title, url, text}] (numbered as the answer's sources: [n] = index + 1). → { md, cards }
 */
export function specCards(pages, { ar = false, max = 5 } = {}) {
  const cards = [];
  (pages || []).forEach((p, i) => {
    const c = specCard(p); if (!c) return;
    const key = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (cards.some((x) => x.key === key)) return;
    cards.push({ ...c, key, n: i + 1 });
  });
  const use = cards.slice(0, max);
  if (!use.length) return { md: "", cards: [] };
  const rows = CARD.filter((id) => use.some((c) => c.values.has(id)) && (use.length === 1 || use.filter((c) => c.values.has(id)).length >= Math.min(2, use.length)));
  const label = (id) => { const a = AT.get(id); return ar ? a[2] : a[1]; };
  const cell = (s) => String(s).replace(/\|/g, "/");
  const sites = [...new Set(use.map((c) => c.site))].join(", ");
  const md = (ar ? `### المواصفات لكل فئة (منقولة بالحرف من ${sites})\n` : `### Specs by version (copied exactly from ${sites})\n`) +
    "| " + (ar ? "البند" : "Spec") + " | " + use.map((c) => cell(c.name) + " [" + c.n + "]").join(" | ") + " |\n" +
    "|" + Array(use.length + 1).fill(" --- ").join("|") + "|\n" +
    rows.map((id) => "| " + label(id) + " | " + use.map((c) => cell(c.values.get(id) || "—")).join(" | ") + " |").join("\n");
  return { md, cards: use };
}

const EGP = /(?:EGP|LE|L\.E\.?|E£|جنيه|ج\.م)\s?\d[\d,.]*|\d[\d,.]{3,}\s?(?:EGP|LE|L\.E\.?|E£|جنيه|ج\.م)|\d{1,3}(?:,\d{3}){2,}/i;
/** Price rows (version → EGP price) from the Egyptian price sites, as written. → { md, rows } */
export function egyptPrices(pages, { ar = false, max = 10 } = {}) {
  const rows = [];
  (pages || []).forEach((p, i) => {
    const t = trustedOf(p && p.url); if (!t || t.role !== "price") return;
    for (const l of String(p.text || "").split("\n")) {
      const c = l.replace(/^\[[^\]]{1,80}\]\s*/, "").split("|").map((x) => x.trim()).filter(Boolean);
      if (c.length < 2 || c.length > 5) continue;
      const pc = c.slice(1).find((x) => EGP.test(x));
      if (!pc || !/[a-z؀-ۿ]/i.test(c[0]) || c[0].length > 70 || /price|السعر|الفئة|trim/i.test(c[0])) continue;
      const price = pc.match(EGP)[0].trim();
      if (rows.some((r) => r.trim === c[0] && r.price === price)) continue;
      rows.push({ trim: c[0], price, site: host(p.url), n: i + 1 });
    }
  });
  const use = rows.slice(0, max);
  if (!use.length) return { md: "", rows: [] };
  const md = (ar ? "### الأسعار في مصر (منقولة بالحرف)\n| الفئة | السعر | الموقع |\n| --- | --- | --- |\n" : "### Prices in Egypt (copied exactly)\n| Version | Price | Site |\n| --- | --- | --- |\n") +
    use.map((r) => `| ${r.trim.replace(/\|/g, "/")} | ${r.price} | ${r.site} [${r.n}] |`).join("\n");
  return { md, rows: use };
}

/** The model's part when code writes the tables: talk, don't re-type. */
export const CARDS_NOTE = "\n\n(The app adds, under your answer, the tables of every version's specifications and the prices — copied by code from the spec and price sites. So do NOT write spec or price tables. Write: ## Overview (maker and country, body, powertrains, who it is for) · ## What reviewers say (from the review pages and the YouTube review transcripts — name the reviewer or site) · ## Advantages · ## Disadvantages · ## Which version to choose · ## Rivals. Cite the source number after each point.)";

/** YouTube transcripts → pages the ranker can read (title "YouTube review — …"). */
export function videoPages(hits) {
  return (hits || []).filter((h) => h && h.url && String(h.text || "").length > 200)
    .map((h) => ({ ...h, title: "YouTube review — " + String(h.title || "").replace(/\s*-\s*YouTube\s*$/i, ""), source: "youtube" }));
}
