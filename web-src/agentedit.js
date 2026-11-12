/* ---- v9.9.21 OK-3 / OK-4 (Ali OK'd 12 Nov — MOCKUPS.md, https://claude.ai/artifact/DQyJJ7Pm2U8FujwNYz4eS3: "editable as much as you can for
   every agent in an easy way"). Pure: settingsOf(a) → the lines of "What I watch" for this kind of agent (each with its key, so a tap
   opens the right sheet); applyEdit(a, key, value) → the agent with that one setting changed. A change to WHAT is searched (dates,
   city, nights, stars, near, guests, product, flight days) rebuilds the search links and clears the old offers (they were for the old
   search); a change to a rule (budget, sites, must have, avoid, how often…) keeps the offers — the rules filter them.
   Tests: tests/unit/v9921agentedit.test.mjs (+ tests/agentedit/gen.mjs, 10,000 edits).                                               */
import { bookingUrl, windowStarts } from "./agents.js";
import { flightTries } from "./flights.js";
import { cleanRules } from "./agent-rules.js";
import { storeTries, productEnglish } from "./agent.js";

const DAY = 864e5;
const isoDay = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const addDays = (iso, n) => isoDay(Date.parse(iso + "T12:00:00") + n * DAY);
const daysBetween = (a, b) => Math.round((Date.parse(b + "T12:00:00") - Date.parse(a + "T12:00:00")) / DAY);
export const kindOf = (a) => (!a ? "" : a.kind !== "watch" ? a.kind : a.fields && a.fields.flight ? "flight" : a.fields && a.fields.city ? "hotel" : "product");
export const HOTEL_SITES = ["booking", "agoda", "expedia", "airbnb", "almosafer"];
export const SHOP_SITES = ["amazon", "noon", "jumia"];
export const AIRLINES = ["egyptair", "saudia", "flynas", "flyadeal", "nileair", "airarabia", "emirates", "qatar", "turkish"];

/** The "What I watch" lines: [{ k, icon, en, v }] — en is the line's name, v its value (an object the screen writes in words). */
export function settingsOf(a) {
  const k = kindOf(a), r = (a && a.rules) || {}, f = (a && a.fields) || {}, out = [];
  const add = (key, icon, en, v) => out.push({ k: key, icon, en, v });
  if (k === "hotel") {
    add("dates", "📅", "Dates", f.window ? { window: f.window, nights: f.nights } : { from: f.checkin, to: f.checkout, nights: f.nights || (f.checkin && f.checkout ? daysBetween(f.checkin, f.checkout) : 0) });
    add("city", "📍", "Where", { city: f.city, near: !!f.near, walk: r.maxWalk || 0 });
    add("stars", "★", "Stars", { stars: r.minStars || (f.stars && f.stars.length ? Math.min(...f.stars) : 0) });
    add("guests", "👤", "Guests", { adults: f.adults || 2, rooms: f.rooms || 1 });
  } else if (k === "flight") {
    const fl = f.flight || {};
    add("fdates", "📅", "Dates", { from: fl.depart, to: fl.ret || "", flex: fl.flex || 0 });
    add("route", "✈", "Route", { from: fl.from, to: fl.to });
    add("stops", "↔", "Stops", { n: r.maxStops == null ? -1 : r.maxStops });
    add("cabin", "💺", "Cabin", { cabin: r.cabin || "economy" });
    add("bags", "🧳", "Bags", { n: r.bags || 0 });
  } else if (k === "product") {
    add("what", "🔎", "Product", { what: a.what || a.title || "" });
  }
  if (["hotel", "flight", "product", "buy"].includes(k) || (a && a.below > 0)) add("budget", "₤", "Budget", { below: a.below || r.below || 0, cur: a.currency || "" });
  if (k === "hotel" || k === "product" || k === "flight") add("sites", "🌐", k === "flight" ? "Airlines" : "Sites", { only: r.onlySites || [], avoid: r.avoidSites || [], list: k === "hotel" ? HOTEL_SITES : k === "flight" ? AIRLINES : SHOP_SITES });
  if (k === "hotel" || k === "product") { add("must", "✓", "Must have", { words: r.mustHave || [] }); add("avoid", "✕", "Avoid", { words: r.avoid || [] }); }
  if (a && a.kind !== "send" && a.kind !== "reply") add("hours", "🔁", "Check", { hours: r.hours || (k === "hotel" || k === "flight" ? 3 : 24) });
  return out;
}

/** One setting changed → the new agent (never the old object). Unknown keys or bad values → the agent unchanged. */
export function applyEdit(a, key, v, now = Date.now()) {
  if (!a) return a;
  const k = kindOf(a), r = { ...(a.rules || {}) };
  const rules = (patch) => { const nr = cleanRules({ ...r, ...patch }); for (const x of Object.keys(patch)) if (patch[x] == null || (Array.isArray(patch[x]) && !patch[x].length)) delete nr[x]; return { ...a, rules: nr, ...(patch.below !== undefined ? { below: nr.below || 0 } : {}) }; };
  const fresh = (b) => ({ ...b, best3: [], byDay: [], found: null, pending: null, checks: (b.checks || []).map((c) => ({ ...c, old: true })), edited: now });
  if (key === "budget") { const n = Math.round(+v.below || 0); return n > 0 ? rules({ below: n }) : rules({ below: null }); }
  if (key === "hours") { const n = Math.round(+v.hours || 0); return n >= 1 && n <= 168 ? rules({ hours: n }) : a; }
  if (key === "sites") return rules({ onlySites: (v.only || []).map(String), avoidSites: (v.avoid || []).filter((x) => !(v.only || []).includes(x)).map(String) });
  if (key === "must") return rules({ mustHave: (v.words || []).map(String) });
  if (key === "avoid") return rules({ avoid: (v.words || []).map(String) });
  if (key === "stops") return rules({ maxStops: v.n >= 0 && v.n <= 3 ? Math.round(v.n) : null });
  if (key === "bags") return rules({ bags: v.n >= 0 && v.n <= 4 ? Math.round(v.n) : null });
  if (key === "cabin") return ["economy", "premium", "business", "first"].includes(v.cabin) ? rules({ cabin: v.cabin === "economy" ? null : v.cabin }) : a;
  if (k === "hotel") {
    const f = { ...(a.fields || {}) };
    if (key === "dates") {
      if (v.window && v.window.from && v.window.to && v.nights > 0 && daysBetween(v.window.from, v.window.to) > v.nights) { f.window = { from: v.window.from, to: v.window.to }; f.nights = Math.round(v.nights); f.checkin = v.window.from; f.checkout = addDays(v.window.from, f.nights); }
      else if (v.from && v.to && daysBetween(v.from, v.to) >= 1 && v.from >= isoDay(now)) { delete f.window; f.checkin = v.from; f.checkout = v.to; f.nights = daysBetween(v.from, v.to); }
      else return a;
    } else if (key === "city") { const c = String(v.city || "").trim(); if (!c) return a; f.city = c; f.near = !!v.near; if (v.walk > 0) r.maxWalk = Math.round(v.walk); else delete r.maxWalk; }
    else if (key === "stars") { const s = Math.round(+v.stars || 0); if (s >= 1 && s <= 5) { f.stars = Array.from({ length: 6 - s }, (_, i) => s + i); r.minStars = s; } else { delete f.stars; delete r.minStars; } }
    else if (key === "guests") { const ad = Math.round(+v.adults || 0), ro = Math.round(+v.rooms || 0); if (!(ad >= 1 && ad <= 30 && ro >= 1 && ro <= 10)) return a; f.adults = ad; f.rooms = ro; }
    else return a;
    const tries = f.window ? windowStarts(f.window, f.nights).map((ci) => { const co = addDays(ci, f.nights); return { checkin: ci, checkout: co, url: bookingUrl({ ...f, checkin: ci, checkout: co }) }; }) : null;
    const stars = f.stars && f.stars.length ? " · " + f.stars[0] + (f.stars.length > 1 ? "–5" : "") + "★" : "";
    const b = { ...a, fields: f, rules: cleanRules(r), url: bookingUrl(f), title: "Hotels · " + String(f.city).split(",")[0] + (f.nights ? " · " + f.nights + " nights" : "") + stars };
    if (tries) b.tries = tries; else delete b.tries;
    return fresh(b);
  }
  if (k === "flight") {
    const fl = { ...((a.fields || {}).flight || {}) };
    if (key === "fdates") { if (!v.from || v.from < isoDay(now) || (v.to && v.to <= v.from)) return a; fl.depart = v.from; if (v.to) fl.ret = v.to; else delete fl.ret; delete fl.window; fl.flex = Math.max(0, Math.min(3, Math.round(+v.flex || 0))); }
    else if (key === "route") { const fr = String(v.from || "").trim().toUpperCase(), to = String(v.to || "").trim().toUpperCase(); if (!/^[A-Z]{3}$/.test(fr) || !/^[A-Z]{3}$/.test(to) || fr === to) return a; fl.from = fr; fl.to = to; delete fl.toCountry; }
    else return a;
    const tries = flightTries(fl, fl.flex || 0), dm = (iso) => iso.slice(8) + "/" + iso.slice(5, 7);
    return fresh({ ...a, fields: { ...(a.fields || {}), flight: fl }, tries, url: tries[0].url, site: tries.length + " sites", title: "Flights · " + fl.from + " → " + fl.to + " · " + dm(fl.depart) + (fl.ret ? " → " + dm(fl.ret) : "") });
  }
  if (k === "product" && key === "what") {
    const w = String(v.what || "").trim(); if (w.length < 2) return a;
    const pe = productEnglish(w), q = pe.left ? w : pe.en, tries = storeTries(q, v.country || "", "").map((l) => ({ url: l.url, site: l.site }));
    if (!tries.length) return a;
    const b = { ...a, what: pe.left ? w : pe.match, title: w, url: tries[0].url, site: tries.length > 1 ? tries.length + " stores" : tries[0].site, tries: tries.length > 1 ? tries : undefined };
    if (pe.changed) { b.said = w; b.q = q; } else { delete b.said; delete b.q; }
    if (!b.tries) delete b.tries;
    return fresh(b);
  }
  return a;
}
