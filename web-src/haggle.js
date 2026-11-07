/* ---- v9.8 N1 The Haggler (Ali, 7 Nov: "do N1 … in the best way possible … without any mistakes") — MOCKUPS.md,
   https://claude.ai/artifact/2QaqFEiB5AyWHcmugbaZfC. You say what you want and your limits; Attune writes to several sellers in your
   Arabic / English / Franco, asks what matters, pushes the price down from the market price, flags dealers and scams, and tells you
   when one is worth a viewing. It NEVER agrees to buy, pays or promises anything: every text passes `safeText`, and a price inside
   your limit is brought to YOU ("Seller 2 says 980,000 — book the viewing?"). Pure; tests/unit/v980haggle.test.mjs.            */

const DIG = (s) => String(s || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
const AR = (s) => /[؀-ۿ]/.test(String(s || ""));

/** Money said any way: "980k", "1.05m", "980,000", «٩٨٠ ألف», «مليون و٥٠», «1.1 مليون» → [numbers]. */
export function pricesIn(text) {
  let t = DIG(text).replace(/(\d),(\d{3})/g, "$1$2").replace(/(\d),(\d{3})/g, "$1$2");
  // «مليون و٥٠» (a million with no number before it) = 1,050,000 · «مليون» alone = 1,000,000
  t = t.replace(/(^|[^\d.\s]|\s)(?<!\d\s?)مليون\s*(?:و|and)\s*(\d{1,3})(?!\d)/g, (m0, a, b) => a + (1000000 + +b * 1000)).replace(/(^|\s)(?<!\d\s?)مليون(?!\s*\d)/g, "$11000000");
  const out = [];
  const re = /(\d+(?:\.\d+)?)\s*(k|K|ألف|الف|آلاف|الاف|m|M|mn|million|مليون)?/g;
  let m;
  while ((m = re.exec(t))) {
    let v = +m[1]; const u = (m[2] || "").toLowerCase();
    if (/^(k|ألف|الف|آلاف|الاف)$/.test(u)) v *= 1000; else if (/^(m|mn|million|مليون)$/.test(u)) v *= 1e6;
    // «مليون و٥٠» / "1 million and 50" → 1,050,000
    if (/^(m|mn|million|مليون)$/.test(u)) { const tail = /^\s*(?:و|and)\s*(\d{1,3})(?!\d)/.exec(t.slice(re.lastIndex)); if (tail) { v += +tail[1] * 1000; re.lastIndex += tail[0].length; } }
    if (v >= 50) out.push(Math.round(v));
  }
  return out;
}

const VERB = /\b(negotiate|haggle|bargain|get (?:me )?(?:the )?best price|talk (?:to|with) (?:the )?sellers?)\b|فاصل|فاصلي|فاصللي|اتفاوض|اتفاصل|كسر(?:لي)? السعر|اكسر(?:لي)? السعر|نزل(?:لي)? السعر|كلم البياعين|كلملي البياعين|kaser|fasel|fasl/i;
const MAXW = /\b(?:under|below|max(?:imum)?|up to|no more than|not more than|budget|at most)\b|لحد|لغاية|مش اكتر من|مش أكتر من|ميزانيتي|ماكس|بحد اقصى|بحد أقصى|اقل من|أقل من|تحت/i;
const MUST_SPLIT = /\b(?:must|with|has to|needs?|only|and)\b|لازم|بشرط|يكون|و(?=\S)/i;
const MUSTS = [
  ["no-accident", /no accidents?|not crashed|مفيهاش رش|بدون رش|من غير رش|مش مضروبة|مفيهاش حوادث|بدون حوادث|فبريكة|فابريكا/i],
  ["service", /agency service|dealer service|service history|صيانة توكيل|صيانات توكيل|صيانه توكيل|في التوكيل|توكيل/i],
  ["papers", /papers?|licen[cs]e|رخصة|رخصه|ورق|اوراق|أوراق/i],
  ["low-km", /low (?:km|mileage)|كيلومترات قليلة|كيلو قليل|عداد قليل/i],
  ["warranty", /warranty|ضمان/i],
];
const PLACES = /\b(?:in|around|near)\s+([A-Z][a-z]+(?:\s*(?:\/|or|and)\s*[A-Z][a-z]+)*)|(?:في|ف)\s+(القاهرة|الجيزة|اسكندرية|الإسكندرية|المعادي|التجمع|اكتوبر|أكتوبر|الشيخ زايد|زايد|مدينة نصر|مصر الجديدة|القاهره|الجيزه)(?:\s*(?:او|أو|و)\s*(القاهرة|الجيزة|اسكندرية|المعادي|التجمع|اكتوبر|زايد|القاهره|الجيزه))?/;

/** "negotiate a Tucson 2022 under 1,050,000, no accidents, agency service, Cairo or Giza" → the plan (or null). */
export function parseHaggle(text) {
  const t = String(text || "").trim(); if (!VERB.test(t)) return null;
  const mx = MAXW.exec(t); let max = 0;
  if (mx) { const p = pricesIn(t.slice(mx.index)); if (p.length) max = p[0]; }
  if (!max) { const p = pricesIn(t).filter((v) => v >= 100); if (p.length) max = Math.max(...p); }
  let what = t.replace(VERB, " ").replace(/\b(?:a|an|the|for me|me|on)\b|لي|ليا|على|علي/gi, " ");
  if (mx) what = what.slice(0, Math.max(0, what.search(MAXW)));
  what = what.split(/[,،.]/)[0].replace(/\s+/g, " ").trim();
  if (!what) return null;
  const musts = MUSTS.filter(([, re]) => re.test(t)).map(([k]) => k);
  const pl = PLACES.exec(t); const area = pl ? (pl[1] || [pl[2], pl[3]].filter(Boolean).join(" / ")) : "";
  return { what, max, musts, area, lang: AR(t) ? "ar" : /\b(3|7|2)[a-z]/i.test(t) && /\b(ana|enta|3ayez|el)\b/i.test(t) ? "franco" : "en" };
}

export function makeHaggle(plan, now = Date.now()) {
  return { id: "hg" + now.toString(36), kind: "haggle", on: true, created: now, what: plan.what, max: plan.max || 0, musts: plan.musts || [], area: plan.area || "", lang: plan.lang || "ar", sellers: [], log: [] };
}

const phoneKey = (p) => DIG(p).replace(/\D/g, "").replace(/^(?:0020|20)/, "0").slice(-11);
/** Add a seller (from an ad, a shared link, a contact). The same phone / ad is one seller. */
export function addSeller(h, s, now = Date.now()) {
  const k = phoneKey(s.phone), same = (x) => (k && phoneKey(x.phone) === k) || (s.href && x.href === s.href);
  if ((h.sellers || []).some(same)) return h;
  const n = (h.sellers || []).length + 1;
  const seller = { id: "s" + n, n, name: s.name || "", phone: s.phone || "", href: s.href || "", site: s.site || "", ask: +s.ask || 0, text: String(s.text || "").slice(0, 600), ads: +s.ads || 1,
    state: "new", round: 0, offers: [], theirs: s.ask ? [+s.ask] : [], answers: {}, flags: [], added: now, lastAt: 0 };
  return { ...h, sellers: [...(h.sellers || []), seller] };
}

/** The market price: the middle of what the sellers ask (and what the agents saw), else 0. */
export function marketOf(h, seen = []) {
  const v = [...(h.sellers || []).map((s) => s.ask), ...seen].filter((x) => x > 0).sort((a, b) => a - b);
  if (!v.length) return 0; const m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
}
/** A round number people say: 5,000 steps above 100k, 1,000 above 10k, 50 below. */
export const roundDown = (v) => { const st = v >= 100000 ? 5000 : v >= 10000 ? 1000 : v >= 1000 ? 100 : 50; return Math.floor(v / st) * st; };
/** Where to aim: under the market (and never above your limit). */
export function targetOf(h, seen = []) {
  const mk = marketOf(h, seen), cap = h.max || Infinity;
  return roundDown(Math.min(cap, mk ? mk * 0.93 : cap));
}
/** The first number we say: low but serious (≈ 85 % of the market / the ask), never above the target. */
export function openingOffer(h, s, seen = []) {
  const mk = marketOf(h, seen) || s.ask, base = Math.min(s.ask || mk, mk || s.ask);
  return roundDown(Math.min(targetOf(h, seen), base * 0.85));
}

const SCAM = /(?:deposit|advance|transfer|send (?:the )?money|pay (?:first|before)|western union|vodafone cash|instapay|عربون|عربون الأول|حول الأول|حوّل الأول|ابعت الفلوس|فودافون كاش|انستاباي|دفعة مقدمة|مقدم قبل)/i;
const NO_VIEW = /(?:can'?t (?:meet|show)|no viewing|abroad|out of (?:the )?country|shipping only|مسافر|برا مصر|بره مصر|مش هينفع تشوفها|شحن بس|مفيش معاينة|من غير معاينة)/i;
const YES = /\b(yes|yeah|yep|sure|of course|correct)\b|أيوه|ايوه|اه|آه|ايوا|أكيد|اكيد|طبعا|طبعاً|تمام|مظبوط/i;
const NO = /\b(no|nope|not)\b|لا|لأ|مفيش|مفيهاش|ماعندهاش|مش/i;
/** What a seller's reply says: { price, final, sold, scam, noView, answers } — read by code (a model may add more, never less). */
export function readReply(text) {
  const t = String(text || ""), ps = pricesIn(t).filter((v) => v >= 1000);
  const answers = {};
  if (/رش|accident|crash|حوادث|مضروب/i.test(t)) answers["no-accident"] = /(?:مفيهاش|بدون|من غير|no|without|zero|مش)\s*(?:اي\s*)?(?:رش|حوادث|accidents?|crash)/i.test(t) || /فبريكة|فابريكا|original paint|zero accident/i.test(t) ? "yes" : /فيها رش|رش خفيف|has an? accident|minor accident|مضروبة/i.test(t) ? "no" : "";
  if (/توكيل|agency|service/i.test(t)) answers.service = /(?:مش|no|not|برا|بره|outside)\s*(?:في\s*)?(?:ال)?توكيل|not (?:at the )?(?:agency|dealer)/i.test(t) ? "no" : "yes";
  const km = /(\d[\d,.]*)\s*(?:k|الف|ألف)?\s*(?:km|كيلو|كم)\b/i.exec(DIG(t)); if (km) answers.km = Math.round(+km[1].replace(/,/g, "") * (/k|الف|ألف/i.test(km[0]) && +km[1] < 1000 ? 1000 : 1));
  return { price: ps.length ? Math.min(...ps) : 0, final: /(?:last|final|lowest|best) price|اخر كلام|آخر كلام|اخر سعر|آخر سعر|مفيش اقل|مش هينزل|ده اخري|ده آخري/i.test(t),
    sold: /\b(sold|no longer available|not available)\b|اتباعت|اتبعت|مش متاحة|خلاص اتباعت/i.test(t), scam: SCAM.test(t), noView: NO_VIEW.test(t), answers,
    yes: YES.test(t) && !NO.test(t.replace(YES, "")) };
}

// ---- what Attune says (your language; never a promise) ----------------------------------------------------------------------
const QUESTIONS = {
  ar: { "no-accident": "فيها رش أو حوادث؟", service: "الصيانة في التوكيل؟", papers: "الورق والرخصة سليمين؟", "low-km": "ماشية كام كيلو؟", warranty: "عليها ضمان؟" },
  en: { "no-accident": "Has it had any accidents or repaint?", service: "Was it serviced at the agency?", papers: "Are the papers and licence in order?", "low-km": "How many km has it done?", warranty: "Is there any warranty left?" },
  franco: { "no-accident": "feha rash aw 7awades?", service: "el siana fel tawkeel?", papers: "el wara2 wel rokhsa salmeen?", "low-km": "mashya kam kilo?", warranty: "3aleha daman?" },
};
const fmtN = (v) => Math.round(v).toLocaleString("en-US");
export function openingText(h, s) {
  const L = h.lang in QUESTIONS ? h.lang : "ar", q = (h.musts || []).map((k) => QUESTIONS[L][k]).filter(Boolean).slice(0, 3);
  if (L === "ar") return `السلام عليكم، بخصوص ${h.what}${s.ask ? ` المعروضة بـ ${fmtN(s.ask)}` : ""} — لسه متاحة؟ ${q.join(" ")} وآخر سعر كام؟`.replace(/\s+/g, " ").trim();
  if (L === "franco") return `Salam 3aleko, bekhosos ${h.what}${s.ask ? ` el ma3roda b ${fmtN(s.ask)}` : ""} — lessa mot7a? ${q.join(" ")} w akher se3r kam?`.replace(/\s+/g, " ").trim();
  return `Hello, about the ${h.what}${s.ask ? ` listed at ${fmtN(s.ask)}` : ""} — is it still available? ${q.join(" ")} What's your best price?`.replace(/\s+/g, " ").trim();
}
function offerText(h, v, final) {
  const L = h.lang in QUESTIONS ? h.lang : "ar", n = fmtN(v);
  if (L === "ar") return final ? `آخر حاجة أقدر عليها ${n} كاش. لو مناسب نحدد معاد معاينة.` : `ممكن ${n} كاش لو الحالة زي ما اتقال؟`;
  if (L === "franco") return final ? `akher 7aga a2dar 3aleha ${n} cash. law monaseb n7aded ma3ad mo3ayna.` : `momken ${n} cash law el 7ala zay ma et2al?`;
  return final ? `The most I can do is ${n} cash. If that works, let's set a time to see it.` : `Would you take ${n} cash if it's as described?`;
}
const thanks = (h) => (h.lang === "en" ? "Thanks, I'll pass on this one." : h.lang === "franco" ? "Shokran, mesh hanekamel." : "شكراً، مش هنكمل.");
/** Never sent: a yes to buy, a payment, a deposit, a promise. Attune only asks, offers and arranges a viewing. */
const PROMISE = /\b(i'?ll take it|deal|agreed|i accept|i'?ll (?:pay|transfer|send)|deposit|sold to me|it'?s mine)\b|اتفقنا|موافق|هاخدها|هحول|هحوّل|هدفع|عربون|خلاص عليا|ماشي هاخد/i;
export const safeText = (t) => !!t && !PROMISE.test(t);

/**
 * One step with one seller, after their reply (or none yet). → { seller, say, status, why }
 *  status: "ask" (questions sent) · "offer" (a number sent) · "final" (our last number) · "good" (inside your limit — YOUR turn) ·
 *          "walk" (above your limit after our last number, or sold) · "dealer" · "scam" · "wait".
 */
export function nextMove(h, s0, reply = "", seen = [], now = Date.now()) {
  let s = { ...s0, answers: { ...(s0.answers || {}) }, theirs: [...(s0.theirs || [])], offers: [...(s0.offers || [])], flags: [...(s0.flags || [])] };
  const r = reply ? readReply(reply) : null;
  if (r) { Object.assign(s.answers, Object.fromEntries(Object.entries(r.answers).filter(([, v]) => v !== ""))); if (r.price) s.theirs.push(r.price); s.lastAt = now; }
  const done = (st, say, why) => { s = { ...s, state: st, round: s.round + (say ? 1 : 0), ...(say ? { lastSaid: say, saidAt: now } : {}) }; return { seller: s, say: say && safeText(say) ? say : "", status: st, why }; };
  if (s.ads >= 3 && !s.flags.includes("dealer")) s.flags.push("dealer");
  if (r && r.scam) { s.flags.push("scam"); return done("scam", "", "asks for money before a viewing"); }
  if (r && r.noView) { s.flags.push("no-viewing"); return done("scam", "", "won't show it before paying"); }
  if (r && r.sold) return done("walk", "", "sold");
  if (s.answers["no-accident"] === "no" && (h.musts || []).includes("no-accident")) return done("walk", thanks(h), "had an accident — you said no accidents");
  if (s.answers.service === "no" && (h.musts || []).includes("service")) return done("walk", thanks(h), "not serviced at the agency — you asked for it");
  if (s.flags.includes("dealer") && s.state === "new") return done("dealer", "", "the same phone is in several ads — a dealer, not an owner");
  if (s.state === "new") return done("ask", openingText(h, s), "first message: available? your questions, best price");
  const theirs = s.theirs.length ? Math.min(...s.theirs) : s.ask, target = targetOf(h, seen), max = h.max || Infinity;
  if (!r) return done("wait", "", "waiting for their reply");
  // at or under the aim → your turn; inside your limit but above the aim → one more number first (our last), then your turn
  if (theirs && theirs <= max && (theirs <= target || s.state === "final")) return done("good", "", "inside your limit — your turn: book a viewing?");
  if (s.state === "final") return done(theirs && theirs <= max ? "good" : "walk", theirs && theirs <= max ? "" : thanks(h), theirs && theirs <= max ? "inside your limit" : "still above your limit after our last number");
  const last = s.offers.length ? s.offers[s.offers.length - 1] : 0;
  let next = last ? roundDown(last + (Math.min(target, theirs || target) - last) * 0.5) : openingOffer(h, s, seen);
  const final = s.offers.length >= 2 || (r.final && theirs > target && s.offers.length >= 1) || next >= target;   // "last price" in the first reply is normal haggling, not the end
  if (final) next = Math.min(target, max);
  if (next <= last) next = Math.min(target, max);
  s.offers.push(next);
  return done(final ? "final" : "offer", offerText(h, next, final), final ? "our last number" : "counter-offer");
}

/** Replies that came in (from the phone's kept notifications) for this seller since the last one read. */
export function repliesFor(notes = [], s) {
  const key = phoneKey(s.phone), nm = String(s.name || "").trim().toLowerCase();
  return notes.filter((n) => (n.ts || 0) > (s.lastAt || s.saidAt || 0) && /whatsapp|messag|sms|telegram|messenger|orca/i.test((n.pkg || "") + " " + (n.app || ""))
    && ((key && phoneKey(n.title) === key) || (nm && nm.length >= 3 && String(n.title || "").toLowerCase().includes(nm))))
    .sort((a, b) => (a.ts || 0) - (b.ts || 0));
}
/** The board's line: the best one so far and how many are being talked to. */
export function bestOf(h) {
  const live = (h.sellers || []).filter((s) => !["walk", "scam", "dealer"].includes(s.state));
  const priced = live.map((s) => ({ s, p: s.theirs && s.theirs.length ? Math.min(...s.theirs) : s.ask })).filter((x) => x.p > 0).sort((a, b) => a.p - b.p);
  return { best: priced[0] || null, talking: live.length, good: live.filter((s) => s.state === "good") };
}

/** One background step for one haggle: read new replies from the kept notifications, decide each seller's next move.
 *  → { h, sends: [{ seller, text }], news: [{ seller, status, why }] }. A message waits as `pending` until it is sent (one tap, or
 *  by itself when "Send by itself" is on); nothing is sent twice. */
export function tick(h, notes = [], now = Date.now(), seen = []) {
  const sends = [], news = [];
  const sellers = (h.sellers || []).map((s) => {
    if (["walk", "scam", "dealer", "good"].includes(s.state) || s.stopped) return s;
    if (s.state === "new" && !s.pending) { const m = nextMove(h, s, "", seen, now); if (m.say) { sends.push({ seller: m.seller, text: m.say }); return { ...m.seller, pending: m.say }; } news.push({ seller: m.seller, status: m.status, why: m.why }); return m.seller; }
    if (s.pending) return s;   // (waiting to be sent: no reply can come before it)
    const rs = repliesFor(notes, s); if (!rs.length) return s;
    const text = rs.map((r) => r.text || "").join("\n"), m = nextMove(h, { ...s, lastAt: rs[rs.length - 1].ts || now }, text, seen, rs[rs.length - 1].ts || now);
    const out = { ...m.seller, lastAt: rs[rs.length - 1].ts || now, heard: [...(s.heard || []), ...rs.map((r) => ({ at: r.ts, text: String(r.text || "").slice(0, 300) }))].slice(-12) };
    if (m.say) { sends.push({ seller: out, text: m.say }); out.pending = m.say; }
    if (["good", "walk", "scam", "dealer"].includes(m.status)) news.push({ seller: out, status: m.status, why: m.why });
    return out;
  });
  return { h: { ...h, sellers }, sends, news };
}
/** After a message left: no longer pending, kept in the seller's thread. */
export function sent(h, sellerId, now = Date.now()) {
  return { ...h, sellers: h.sellers.map((s) => (s.id === sellerId && s.pending ? { ...s, said: [...(s.said || []), { at: now, text: s.pending }].slice(-12), pending: "", saidAt: now } : s)) };
}
/** "Paste the ad": its phone, price and name, from the ad's text (Hatla2ee, Dubizzle, Facebook…). */
export function sellerFromAd(text) {
  const t = DIG(text);
  // an Egyptian mobile however it is spaced: 0100 123 4567 · +20 100 123 4567 · 01001234567
  const ph = [...t.replace(/[-.]/g, " ").matchAll(/\+?\d[\d ]{8,16}\d/g)].map((m) => m[0].replace(/\s/g, "")).map((d) => d.replace(/^\+?20(?=1)/, "0")).find((d) => /^01[0125]\d{8}$/.test(d));
  const prices = pricesIn(t).filter((v) => v >= 1000), url = /https?:\/\/\S+/.exec(text);
  const name = (/(?:seller|البائع|المعلن|name|الاسم)\s*[:：]\s*([^\n,،]{2,30})/i.exec(text) || [])[1] || "";
  return { phone: ph || "", ask: prices.length ? Math.max(...prices) : 0, href: url ? url[0] : "", name: name.trim(), site: url ? (() => { try { return new URL(url[0]).hostname.replace(/^www\./, ""); } catch (e) { return ""; } })() : "", text: String(text).slice(0, 600) };
}
