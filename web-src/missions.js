/* ---- v6.37 Missions (Ali picked option A, "do them all"): an agent that owns ONE goal with a deadline until it is done.
   «عايز أوفر 60 ألف قبل يونيو» · "lose 6 kg before 20 January" · «أشتري كورولا 2022 بأقل من 900 ألف قبل 1 ديسمبر».
   Every time Attune opens (and the morning notification), code — not the model — does the loop:
     1 sense     read your own data: the Money ledger, the Fit diary and weights, Scout's market book
     2 forecast  thousands of possible futures from YOUR real daily numbers → the chance of making it by the deadline
     3 plan      what is needed per day / week from now, and the ONE step that raises the chance most
     4 act       safe steps only (a Scout goal for a buy mission, the morning reminder); nothing leaves the phone
     5 debrief   a short morning report with the evidence behind each line
   Pure (tests/unit/v740missions.test.mjs); the page is missions-ui.jsx. Phase 1 kinds: save, weight, buy.
   v6.44 phases 3–4 (tests/unit/v744missions.test.mjs) — each new kind reads real data, never a guess:
     cap      «مش عايز أصرف أكتر من 3000 على الأكل الشهر ده» — a category (or all spending) kept under a limit
     debt     «عايز أخلص دين أحمد قبل ديسمبر» — a debt in Money → People paid off (or one owed to you collected)
     learn    "finish the Turkish course by December" — a Learn course's lessons done
     revenue  «عايز الأسطول يجيب 500 ألف الشهر ده» — company: Fleet's work entries (crane income)
     collect  "collect 200k from clients by the end of the month" — company: Fleet's incoming payments + cheques due  */
import { tr } from "./i18n.js";
import { homeCurrency } from "./locale.js";

const DAY = 86400000;
const iso = (t) => { const x = new Date(t); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const at12 = (s) => Date.parse(s + "T12:00:00");
const daysBetween = (a, b) => Math.round((at12(b) - at12(a)) / DAY);
const latin = (t) => String(t || "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");

// ---------- 1. reading the goal ----------
const MONTHS = [["يناير|jan(?:uary)?", 0], ["فبراير|feb(?:ruary)?", 1], ["مارس|mar(?:ch)?", 2], ["ابريل|apr(?:il)?", 3], ["مايو|may", 4], ["يونيو|jun(?:e)?", 5],
  ["يوليو|jul(?:y)?", 6], ["اغسطس|aug(?:ust)?", 7], ["سبتمبر|sep(?:t|tember)?", 8], ["اكتوبر|oct(?:ober)?", 9], ["نوفمبر|nov(?:ember)?", 10], ["ديسمبر|dec(?:ember)?", 11]];
const MRX = MONTHS.map((m) => m[0]).join("|");
const monthIdx = (w) => (MONTHS.find(([rx]) => new RegExp("^(?:" + rx + ")$", "i").test(w)) || [, -1])[1];

/** The deadline in the sentence: "by June" (the month's last day), "before 20 January", «قبل 1 ديسمبر», "in 3 months",
    «خلال شهرين», "by 30/6". Always in the future. */
export function deadlineIn(text, now = Date.now()) {
  const t = latin(text).toLowerCase(), n = new Date(now), y = n.getFullYear(), today = iso(now);
  const fix = (d) => (d <= today ? iso(new Date(at12(d)).setFullYear(new Date(at12(d)).getFullYear() + 1)) : d);
  let m = t.match(new RegExp("(\\d{1,2})\\s*(" + MRX + ")(?:\\s*(\\d{4}))?|(" + MRX + ")\\s*(\\d{1,2})(?:,?\\s*(\\d{4}))?", "i"));
  if (m) {
    const day = +(m[1] || m[5]), mon = monthIdx(m[2] || m[4]), yr = +(m[3] || m[6]) || y;
    if (mon >= 0 && day >= 1 && day <= 31) { const d = iso(new Date(yr, mon, day, 12)); return m[3] || m[6] ? d : fix(d); }
  }
  m = t.match(new RegExp("(?:by|before|until|till|end of|in|قبل|لحد|ل|في|اخر|آخر)\\s*(?:شهر\\s*)?(" + MRX + ")(?:\\s*(\\d{4}))?", "i"));
  if (m) { const mon = monthIdx(m[1]), yr = +m[2] || y; if (mon >= 0) { const d = iso(new Date(yr, mon + 1, 0, 12)); return m[2] ? d : fix(d); } }
  m = t.match(/(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*(\d{2,4}))?/);
  if (m && +m[2] >= 1 && +m[2] <= 12) { const yr = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : y; const d = iso(new Date(yr, +m[2] - 1, +m[1], 12)); return m[3] ? d : fix(d); }
  m = t.match(/(?:in|within|خلال|في|بعد)\s*(\d{1,2}|شهرين|اسبوعين|سنه|سنة)\s*(months?|weeks?|years?|شهور|اشهر|شهر|اسابيع|اسبوع|سنين|سنه)?/);
  if (m) {
    const w = m[1], unit = m[2] || "";
    const k = w === "شهرين" ? [2, "m"] : w === "اسبوعين" ? [2, "w"] : /سن/.test(w) ? [1, "y"] : [+w, /week|اسبوع|اسابيع/.test(unit) ? "w" : /year|سن/.test(unit) ? "y" : "m"];
    if (k[0] > 0) { const d = new Date(now); if (k[1] === "w") d.setDate(d.getDate() + 7 * k[0]); else if (k[1] === "y") d.setFullYear(d.getFullYear() + k[0]); else d.setMonth(d.getMonth() + k[0]); return iso(d); }
  }
  if (/end of (the )?year|اخر السنه|آخر السنة|نهايه السنه|this year|السنه دي/.test(t)) return iso(new Date(y, 11, 31, 12));
  // v6.44: "this month" / «الشهر ده» / "end of the month" → the month's last day; "this week" / «الأسبوع ده» → 6 days on
  if (/this month|end of (the )?month|الشهر ده|الشهر دا|الشهر دي|الشهر الحالي|اخر الشهر|نهايه الشهر/.test(t)) return iso(new Date(y, n.getMonth() + 1, 0, 12));
  if (/this week|الاسبوع ده|الاسبوع دا/.test(t)) return iso(now + 6 * DAY);
  return "";
}

/** "60k", "60 ألف", "1.2 مليون", "900,000" → the number. */
function amountIn(t) {
  const m = t.match(/(\d+(?:[.,]\d+)*)\s*(k|الف|ألف|مليون|million|m\b)?/i);
  if (!m) return 0;
  let v = parseFloat(m[1].replace(/,(?=\d{3}\b)/g, "").replace(",", "."));
  const u = (m[2] || "").toLowerCase();
  if (u === "k" || u === "الف" || u === "ألف") v *= 1000; else if (u === "مليون" || u === "million" || u === "m") v *= 1e6;
  return Math.round(v);
}

/** A sentence → { kind, target, deadline, item, title } — or null when it isn't a goal with a number. */
export function parseMission(text, now = Date.now()) {
  const raw = String(text || "").trim(), t = latin(raw).toLowerCase();
  if (raw.length < 6) return null;
  const deadline = deadlineIn(raw, now);
  const kg = t.match(/(\d+(?:[.,]\d)?)\s*(?:kg|kilos?|كيلو|ك)(?![a-z\u0600-\u06FF])/);   // (\b doesn't see Arabic letters)
  if (kg && /(lose|drop|خس|اخس|انزل|نزل|اخسس|وزن|weight)/.test(t)) {
    const target = parseFloat(kg[1].replace(",", "."));
    return target > 0 && target < 60 ? { kind: "weight", target, deadline, title: raw.slice(0, 80) } : null;
  }
  // v6.44 phases 3–4: never a question ("how much did Fleet earn this month?" is answered, not made a mission)
  const asks = /[?؟]|how (much|many)|\bكام\b|\bايه\b|\bقد ايه\b/.test(t), wants = /(want|goal|target|aim|need to|i will|i'll|let's|عايز|عاوز|هدف|نفسي|لازم|محتاج|هخلي|خلي)/.test(t) || /^(collect|make|earn|get|bring|حصل|احصل|خلي)/.test(t);
  // v6.44 phase 4 — company missions (Fleet & rentals)
  if (!asks && wants && /(collect|تحصيل|احصل|أحصل|احصّل|حصل من|اجمع من العملاء)/.test(t) && /(client|customer|عميل|عملا|العملا|الزباين|fleet|الاسطول)/.test(t)) {
    const target = amountIn(t.replace(/(\d{1,2})\s*[/.-]\s*(\d{1,2})/, " "));
    return target >= 100 ? { kind: "collect", target, deadline, title: raw.slice(0, 80) } : null;
  }
  if (!asks && wants && /(fleet|crane|الاسطول|الونش|الونشات|الكرين|المعدات|revenue|ايراد|دخل الشركه)/.test(t) && /(earn|make|bring|revenue|يجيب|يجيبو|يجيبوا|تجيب|يدخل|تدخل|يكسب|تكسب|ايراد|دخل)/.test(t)) {
    const target = amountIn(t.replace(/(\d{1,2})\s*[/.-]\s*(\d{1,2})/, " "));
    return target >= 100 ? { kind: "revenue", target, deadline, title: raw.slice(0, 80) } : null;
  }
  // v6.44 phase 3
  if (!asks && /(دين|سلف|debt|pay (off|back)|owe|اسدد|اخلص.*(فلوس|دين))/.test(t) && /(pay|off|back|collect|اخلص|اسدد|ادفع|اسد|اخد|احصل|يرجع)/.test(t)) return { kind: "debt", target: 0, deadline, title: raw.slice(0, 80) };
  if (!asks && /(course|lessons?|كورس|الكورس|دروس|الدروس|منهج)/.test(t) && /(finish|complete|done|اخلص|اكمل|اخلّص|خلص)/.test(t)) return { kind: "learn", target: 0, deadline, title: raw.slice(0, 80) };
  if (!asks && /(spend|اصرف|مصاريف|صرف)/.test(t) && /(less than|no more than|under|max|at most|اكتر من|اقل من|مش اكتر|بحد اقصي|ميزيدش)/.test(t)) {
    const target = amountIn(t.replace(/(\d{1,2})\s*[/.-]\s*(\d{1,2})/, " "));
    const cat = (CAP_WORDS.find(([, rx]) => rx.test(t)) || [null])[0];
    return target >= 10 ? { kind: "cap", target, deadline, cat, title: raw.slice(0, 80) } : null;
  }
  if (/(buy|get a|اشتري|اشترى|هشتري|عايز اشتري|عربيه|شقه)/.test(t)) {
    const under = t.match(/(?:under|below|less than|max|باقل من|بأقل من|اقل من|ب|بحد اقصي|في حدود)\s*(\d[\d.,]*\s*(?:k|الف|ألف|مليون|million)?)/i);
    const target = under ? amountIn(under[1]) : 0;
    const item = raw.replace(/(i want to|i'll|i will|عايز|هـ?|اشتري|اشترى|هشتري|buy|get)\s*/gi, "").replace(/(under|below|less than|باقل من|بأقل من|اقل من|by|before|قبل|لحد)[\s\S]*$/i, "").trim().slice(0, 60);
    return target > 1000 ? { kind: "buy", target, deadline, item: item || raw.slice(0, 40), title: raw.slice(0, 80) } : null;
  }
  if (/(save|put aside|اوفر|أوفر|احوش|أحوش|حوش|توفير|اوفّر|اجمع|ادخر)/.test(t)) {
    const target = amountIn(t.replace(/(\d{1,2})\s*[/.-]\s*(\d{1,2})/, " ").replace(new RegExp("\\d{1,2}\\s*(?:" + MRX + ")", "i"), " "));
    return target >= 100 ? { kind: "save", target, deadline, title: raw.slice(0, 80) } : null;
  }
  return null;
}

// v6.44 cap: the words for each Money category (the ledger's own ids)
const CAP_WORDS = [["food", /(eating out|restaurant|takeaway|delivery|food|الاكل|اكل|مطاعم|دليفري|ديليفري)/], ["groceries", /(grocer|supermarket|بقاله|سوبر ?ماركت)/],
  ["transport", /(transport|uber|careem|taxi|fuel|petrol|مواصلات|اوبر|كريم|تاكسي|بنزين)/], ["shopping", /(shopping|clothes|شوبينج|لبس|هدوم)/],
  ["fun", /(fun|outings|going out|خروج|خروجات|فسح)/], ["coffee", /(coffee|cafe|tea|قهوه|كافيه|شاي)/], ["health", /(health|doctor|medicine|دكتور|دوا|علاج)/], ["gifts", /(gift|هدايا|هديه)/]];

// ---------- 2. sensing ----------
/** Money in the ledger's main currency: balance now, and the net (income − spending) of each of the last `days` days. */
export function moneySense(L, now = Date.now(), days = 60) {
  const cur = homeCurrency(L), accounts = (L && L.accounts) || [], txns = (L && L.txns) || [];
  const curOf = (id) => { const a = accounts.find((x) => x.id === id); return (a && a.currency) || cur; };
  const mine = (c) => !c || c === cur;
  let balance = 0;
  for (const a of accounts) if (mine(a.currency || cur)) balance += Number(a.start) || 0;
  for (const t of txns) {
    const amt = Number(t.amount) || 0, c = curOf(t.account);
    if (t.type === "income" && mine(c)) balance += amt; else if (t.type === "expense" && mine(c)) balance -= amt;
    else if (t.type === "transfer" && (t.toAccount || t.to)) { if (mine(c)) balance -= amt; if (mine(curOf(t.toAccount || t.to))) balance += Number(t.toAmount) || amt; }
  }
  const today = iso(now), first = txns.map((t) => t.date).filter(Boolean).sort()[0] || today;
  const span = Math.max(1, Math.min(days, daysBetween(first, today) + 1));
  const net = new Array(span).fill(0), inc = new Array(span).fill(0), byCat = {};
  for (const t of txns) {
    if (!t.date || !mine(curOf(t.account))) continue;
    const i = daysBetween(t.date, today); if (i < 0 || i >= span) continue;
    const amt = Number(t.amount) || 0;
    if (t.type === "income") { net[span - 1 - i] += amt; inc[span - 1 - i] += amt; }
    else if (t.type === "expense") { net[span - 1 - i] -= amt; if (i < 30) byCat[t.cat || "other"] = (byCat[t.cat || "other"] || 0) + amt; }
  }
  return { cur, balance: Math.round(balance * 100) / 100, net, inc, byCat };
}

/** Weight: the latest weight (7-entry average), the trend in kg per day over the last 28 days, and the calories eaten. */
export function bodySense(fit, now = Date.now()) {
  const w = [...((fit && fit.weights) || [])].filter((x) => x && x.d && x.kg > 0).sort((a, b) => (a.d < b.d ? -1 : 1));
  const today = iso(now), recent = w.filter((x) => daysBetween(x.d, today) <= 28);
  const last = w.length ? w.slice(-3).reduce((a, x) => a + x.kg, 0) / Math.min(3, w.length) : null;
  let slope = null, se = null;
  if (recent.length >= 3 && daysBetween(recent[0].d, recent[recent.length - 1].d) >= 7) {
    const xs = recent.map((x) => daysBetween(recent[0].d, x.d)), ys = recent.map((x) => x.kg), n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0), sxy = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
    slope = sxy / sxx;
    const res = ys.reduce((a, y, i) => a + (y - (my + slope * (xs[i] - mx))) ** 2, 0);
    se = n > 2 ? Math.sqrt(res / (n - 2) / sxx) : null;
  }
  return { last: last == null ? null : Math.round(last * 10) / 10, slope, se, entries: w.length };
}

// ---------- 3. forecasting ----------
/** A small seeded random number generator, so the same data gives the same chance every time it is shown. */
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const seedOf = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

/** The chance that `need` more is gathered in `days` days, if the future is like your past (a bootstrap of your own days).
    With 45+ days of history the draws are whole 30-day stretches (every stretch of your past), so a monthly salary comes
    once a month as it really does; with less, whole weeks. `shift` = a change per day (e.g. spending less). */
export function chanceToGather(net, need, days, { sims = 4000, seed = 1, shift = 0 } = {}) {
  if (need <= 0) return 1;
  if (!(days > 0) || !net || net.length < 14) return null;
  const blockLen = net.length >= 45 ? 30 : 7, blocks = [];
  for (let i = 0; i + blockLen <= net.length; i += blockLen === 30 ? 1 : 7) blocks.push(net.slice(i, i + blockLen).reduce((a, b) => a + b, 0) + blockLen * shift);
  if (blocks.length < 2) return null;
  const r = rng(seed), full = Math.floor(days / blockLen), rest = days - full * blockLen, daily = net.map((v) => v + shift);
  let hit = 0;
  for (let s = 0; s < sims; s++) {
    let sum = 0;
    for (let k = 0; k < full; k++) sum += blocks[Math.floor(r() * blocks.length)];
    for (let k = 0; k < rest; k++) sum += daily[Math.floor(r() * daily.length)];
    if (sum >= need) hit++;
  }
  return hit / sims;
}
const ncdf = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };

// ---------- the whole loop for one mission ----------
const CAT_AR = { food: "الأكل", groceries: "البقالة", transport: "المواصلات", shopping: "الشوبينج", fun: "الخروجات", eatingout: "الأكل برة", bills: "الفواتير", other: "حاجات تانية" };

/**
 * One mission, now → { value, target, left, pct, days, perDayNeed, perDayNow, chance (0–1 or null), state, step, evidence }
 *   state: "done" | "ahead" | "on-track" | "behind" | "late" | "unknown"
 *   step: { en, ar, chance } — the one thing that raises the chance most (or keeps it)
 */
export function evaluate(m, data, now = Date.now()) {
  const today = iso(now), days = m.deadline ? Math.max(0, daysBetween(today, m.deadline)) : 0;
  const ev = [];
  const out = (o) => ({ id: m.id, kind: m.kind, days, ...o, evidence: ev });
  if (m.kind === "save" || m.kind === "buy") {
    const ms = moneySense(data.ledger, now);
    const base = m.kind === "save" ? (m.base && m.base.balance) ?? ms.balance : 0;
    const value = m.kind === "save" ? ms.balance - base : ms.balance;    // saved since the start / money you have for it
    const target = m.target, left = Math.max(0, target - value);
    const perDayNow = ms.net.length ? ms.net.reduce((a, b) => a + b, 0) / ms.net.length : 0;
    ev.push({ en: `Balance ${fmtN(ms.balance)} ${ms.cur}; over the last ${ms.net.length} days you kept ${fmtN(perDayNow * 30)} a month.`, ar: `رصيدك ${fmtN(ms.balance)} ${ms.cur}؛ في آخر ${ms.net.length} يوم كنت بتحوّش ${fmtN(perDayNow * 30)} في الشهر.` });
    const moneyChance = left <= 0 ? 1 : days > 0 ? chanceToGather(ms.net, left, days, { seed: seedOf(m.id + today) }) : 0;
    let pAd = 1;
    // a buy mission also needs an ad at or under the price: from Scout's market book of that search
    let market = null;
    if (m.kind === "buy" && data.market && m.marketKey && (data.market[m.marketKey] || []).length >= 4) {
      const L = data.market[m.marketKey], fresh = L.filter((x) => now - x.at < 30 * DAY), pool = fresh.length >= 4 ? fresh : L;
      const under = pool.filter((x) => x.facts && x.facts.price <= m.target).length;
      market = { n: pool.length, under, share: under / pool.length, low: Math.min(...pool.map((x) => x.facts.price)) };
      const weeks = Math.max(1, days / 7); pAd = 1 - Math.pow(1 - Math.min(0.95, market.share || 0.02), weeks);   // at least one such ad in the weeks left
      ev.push({ en: `Scout's market: ${under} of ${pool.length} ads at or under ${fmtN(m.target)}; lowest ${fmtN(market.low)}.`, ar: `سوق Scout: ${under} من ${pool.length} إعلان بسعر ${fmtN(m.target)} أو أقل؛ أقل سعر ${fmtN(market.low)}.` });
    }
    const chance = moneyChance == null ? null : moneyChance * pAd;
    const perDayNeed = days > 0 ? left / days : left;
    let step = null;
    if (left > 0 && chance != null && chance < 0.9) {
      // the biggest spending you can cut: a quarter less of it, every day from now
      const cats = Object.entries(ms.byCat).filter(([c]) => c !== "bills" && c !== "rent").sort((a, b) => b[1] - a[1]);
      if (cats.length) {
        const [cat, amt] = cats[0], cut = Math.round(amt * 0.25);
        const c2 = (chanceToGather(ms.net, left, days, { seed: seedOf(m.id + today), shift: cut / 30 }) ?? 0) * pAd;
        if (c2 > chance + 0.02) step = { en: `Spend ${fmtN(cut)} less a month on ${cat} (a quarter of it) → ${pc(c2)} chance.`, ar: `اصرف ${fmtN(cut)} أقل في الشهر على ${CAT_AR[cat] || cat} (ربعه) ← فرصتك ${pc(c2)}.`, chance: c2, cat, cut };
      }
    }
    // far out of reach: say what IS reachable at your pace — a later date, or a smaller target
    if (!step && left > 0 && chance != null && chance < 0.2 && perDayNow > 0) {
      const reach = Math.round(value + perDayNow * days), when = iso(now + Math.ceil(left / perDayNow) * DAY);
      step = { en: `At your pace you reach about ${fmtN(reach)} by ${m.deadline}. Move the date to ${when}, or lower the target to ${fmtN(reach)}.`, ar: `بالمعدل ده هتوصل لحوالي ${fmtN(reach)} يوم ${m.deadline}. أجّل الميعاد لـ ${when}، أو قلّل الهدف لـ ${fmtN(reach)}.`, reach, when };
    }
    if (!step && m.kind === "buy" && market && market.under) step = { en: `${market.under} ads are already at your price — check them in Scout today.`, ar: `فيه ${market.under} إعلان بسعرك فعلًا — شوفهم في Scout النهارده.` };
    if (!step && left > 0) step = { en: `Keep ${fmtN(perDayNeed * 30)} a month aside until ${m.deadline}.`, ar: `سيب ${fmtN(perDayNeed * 30)} في الشهر على جنب لحد ${m.deadline}.` };
    const state = left <= 0 ? "done" : !days ? "late" : chance == null ? "unknown" : chance >= 0.8 ? "ahead" : chance >= 0.5 ? "on-track" : "behind";
    return out({ value: Math.round(value), target, left: Math.round(left), pct: Math.max(0, Math.min(100, Math.round((value / target) * 100))), perDayNeed, perDayNow, chance, state, step, market });
  }
  if (m.kind === "weight") {
    const b = bodySense(data.fit, now), start = (m.base && m.base.kg) || b.last;
    if (b.last == null || start == null) return out({ value: 0, target: m.target, left: m.target, pct: 0, chance: null, state: "unknown", step: { en: "Log your weight in Fit & Food (Progress) — the mission starts counting from it.", ar: "سجّل وزنك في الأكل واللياقة (التقدم) — المهمة هتبتدي تحسب منه." } });
    const value = Math.round((start - b.last) * 10) / 10, left = Math.max(0, Math.round((m.target - value) * 10) / 10);
    const perDayNeed = days > 0 ? left / days : left;
    let chance = null;
    if (left <= 0) chance = 1;
    else if (b.slope != null && days > 0) {
      const mean = -b.slope * days, sd = Math.max(0.6, (b.se || 0.02) * days + 0.4);   // + day-to-day water weight
      chance = ncdf((mean - left) / sd);
    }
    ev.push({ en: b.slope != null ? `Your weight trend: ${fmtN(-b.slope * 7, 1)} kg a week over the last 4 weeks (${b.entries} weigh-ins).` : `Only ${b.entries} weigh-ins so far — weigh yourself 2–3 times a week for a forecast.`,
      ar: b.slope != null ? `اتجاه وزنك: ${fmtN(-b.slope * 7, 1)} كيلو في الأسبوع آخر 4 أسابيع (${b.entries} مرة وزن).` : `${b.entries} مرات وزن بس لحد دلوقتي — اتوزن 2–3 مرات في الأسبوع عشان التوقع.` });
    const kcal = Math.round((perDayNeed * 7700) / 10) * 10;
    const step = left <= 0 ? null : perDayNeed * 7 > 1
      ? { en: `That is ${fmtN(perDayNeed * 7, 1)} kg a week — faster than is safe (about 1 kg). Move the date, or aim lower.`, ar: `ده ${fmtN(perDayNeed * 7, 1)} كيلو في الأسبوع — أسرع من الآمن (حوالي كيلو). أجّل الميعاد أو قلّل الهدف.` }
      : { en: `Eat about ${fmtN(kcal)} kcal a day under what you burn (Fit's target does it), and weigh in twice a week.`, ar: `كل حوالي ${fmtN(kcal)} سعرة في اليوم أقل من اللي بتحرقه (هدف الأكل واللياقة بيعمل كده)، واتوزن مرتين في الأسبوع.` };
    const state = left <= 0 ? "done" : !days ? "late" : chance == null ? "unknown" : chance >= 0.8 ? "ahead" : chance >= 0.5 ? "on-track" : "behind";
    return out({ value, target: m.target, left, pct: Math.max(0, Math.min(100, Math.round((value / m.target) * 100))), perDayNeed, perDayNow: b.slope == null ? null : -b.slope, chance, state, step });
  }
  if (m.kind === "cap") return evalCap(m, data, now, days, ev, out);
  if (m.kind === "debt") return evalDebt(m, data, now, days, ev, out);
  if (m.kind === "learn") return evalLearn(m, data, now, days, ev, out);
  if (m.kind === "revenue") return evalRevenue(m, data, now, days, ev, out);
  if (m.kind === "collect") return evalCollect(m, data, now, days, ev, out);
  return out({ value: 0, target: m.target, left: m.target, pct: 0, chance: null, state: "unknown", step: null });
}
const stateOf = (left, days, chance) => (left <= 0 ? "done" : !days ? "late" : chance == null ? "unknown" : chance >= 0.8 ? "ahead" : chance >= 0.5 ? "on-track" : "behind");
const pctOf = (v, t) => (t > 0 ? Math.max(0, Math.min(100, Math.round((v / t) * 100))) : 0);
/** A mission counted for "this month" starts at the month's first day, else on the day it was made. */
const fromOf = (m) => (m.base && m.base.from) || m.created || "";
/** Each of the last `n` days' total of `pick(t)` for the items dated in it (oldest first). */
const dailyOf = (items, dateOf, amountOf, today, n = 60) => {
  const first = items.map(dateOf).filter(Boolean).sort()[0] || today, span = Math.max(1, Math.min(n, daysBetween(first, today) + 1));
  const a = new Array(span).fill(0);
  for (const x of items) { const d = dateOf(x); if (!d) continue; const i = daysBetween(d, today); if (i >= 0 && i < span) a[span - 1 - i] += amountOf(x); }
  return a;
};
const normName = (x) => latin(String(x || "")).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff ]/g, " ").trim();
const CAT_EN = { food: "food", groceries: "groceries", transport: "transport", shopping: "shopping", fun: "going out", coffee: "coffee", health: "health", gifts: "gifts" };

function evalCap(m, data, now, days, ev, out) {
  const today = iso(now), from = fromOf(m), L = data.ledger || {}, cur = homeCurrency(L);
  const spend = ((L && L.txns) || []).filter((t) => t.type === "expense" && (!m.cat || (t.cat || "other") === m.cat));
  const spent = spend.filter((t) => t.date && t.date >= from && t.date <= today).reduce((a, t) => a + (+t.amount || 0), 0);
  const room = m.target - spent, what = m.cat ? CAT_EN[m.cat] || m.cat : "everything", whatAr = m.cat ? CAT_AR[m.cat] || m.cat : "كل حاجة";
  const daily = dailyOf(spend, (t) => t.date, (t) => +t.amount || 0, today);
  ev.push({ en: `Spent on ${what} since ${from}: ${fmtN(spent)} ${cur} of ${fmtN(m.target)}; your usual: ${fmtN((daily.reduce((a, b) => a + b, 0) / daily.length) * 30)} a month.`,
    ar: `صرفت على ${whatAr} من ${from}: ${fmtN(spent)} ${cur} من ${fmtN(m.target)}؛ المعتاد عندك: ${fmtN((daily.reduce((a, b) => a + b, 0) / daily.length) * 30)} في الشهر.` });
  // the chance the rest of the days stay inside the room left, if they are like your past days
  const over = room < 0 ? 1 : days > 0 ? chanceToGather(daily, room + 0.01, days, { seed: seedOf(m.id + today) }) : 0;
  const chance = room < 0 ? 0 : over == null ? null : 1 - over;
  const step = room < 0 ? { en: `Over the limit by ${fmtN(-room)} — nothing more on ${what} until ${m.deadline}.`, ar: `عدّيت الحد بـ ${fmtN(-room)} — ولا جنيه زيادة على ${whatAr} لحد ${m.deadline}.` }
    : days > 0 ? { en: `You can spend ${fmtN(room / days)} a day on ${what} until ${m.deadline}.`, ar: `تقدر تصرف ${fmtN(room / days)} في اليوم على ${whatAr} لحد ${m.deadline}.` } : null;
  // done only when the deadline has come and the limit held
  const state = room < 0 ? "behind" : !days ? "done" : chance == null ? "unknown" : chance >= 0.8 ? "ahead" : chance >= 0.5 ? "on-track" : "behind";
  return out({ value: Math.round(spent), target: m.target, left: Math.max(0, Math.round(room)), pct: pctOf(spent, m.target), perDayNeed: null, perDayNow: null, chance, state, step, cap: true });
}

/** The debt the mission names (a person in Money → People whose name is in the sentence), or the only open one. */
export function debtOf(m, L) {
  const open = ((L && L.debts) || []).filter((d) => !d.settled);
  const t = " " + normName(m.title) + " ";
  return open.find((d) => normName(d.person).split(/\s+/).some((w) => w.length >= 3 && t.includes(" " + w + " "))) || (open.length === 1 ? open[0] : null);
}
const debtLeft = (d) => (Number(d.amount) || 0) - ((d.payments || []).reduce((a, p) => a + (Number(p.amount) || 0), 0));
function evalDebt(m, data, now, days, ev, out) {
  const L = data.ledger, d = debtOf(m, L), today = iso(now);
  if (!d) return out({ value: 0, target: 0, left: 0, pct: 0, chance: null, state: "unknown", step: { en: "Add the debt in Money → People (who, how much) — the mission follows it from there.", ar: "ضيف الدين في الفلوس ← الناس (مين وكام) — المهمة هتتابعه من هناك." } });
  const left = Math.max(0, debtLeft(d)), start = (m.base && m.base.left) || Math.max(left, Number(d.amount) || 0), paid = Math.max(0, start - left);
  const toMe = d.type === "owed_to_me", who = d.person || "?";
  ev.push({ en: `${toMe ? who + " owes you" : "You owe " + who}: ${fmtN(left)} left of ${fmtN(start)} (${(d.payments || []).length} payments).`, ar: `${toMe ? who + " عليه ليك" : "عليك لـ " + who}: باقي ${fmtN(left)} من ${fmtN(start)} (${(d.payments || []).length} دفعات).` });
  if (toMe) {   // it depends on them: no forecast, a reminder instead
    const step = left > 0 ? { en: `Send ${who} a kind reminder: ${fmtN(left)} left${days ? `, ${fmtN(left / Math.max(1, days / 30))} a month would finish it by ${m.deadline}` : ""}.`, ar: `ابعت لـ ${who} تذكير لطيف: باقي ${fmtN(left)}${days ? `، ${fmtN(left / Math.max(1, days / 30))} في الشهر تخلّصه قبل ${m.deadline}` : ""}.` } : null;
    return out({ value: Math.round(paid), target: Math.round(start), left: Math.round(left), pct: pctOf(paid, start), chance: null, state: left <= 0 ? "done" : !days ? "late" : "unknown", step, person: who });
  }
  const ms = moneySense(L, now), chance = left <= 0 ? 1 : days > 0 ? chanceToGather(ms.net, left, days, { seed: seedOf(m.id + today) }) : 0;
  const perMonth = days > 0 ? left / (days / 30) : left;
  const step = left <= 0 ? null : { en: `Pay ${who} ${fmtN(perMonth)} a month (${fmtN(left / Math.max(1, days))} a day aside) until ${m.deadline}.`, ar: `ادفع لـ ${who} ${fmtN(perMonth)} في الشهر (${fmtN(left / Math.max(1, days))} في اليوم على جنب) لحد ${m.deadline}.` };
  return out({ value: Math.round(paid), target: Math.round(start), left: Math.round(left), pct: pctOf(paid, start), perDayNeed: days > 0 ? left / days : left, perDayNow: null, chance, state: stateOf(left, days, chance), step, person: who });
}

/** The course the mission names (its topic's words in the sentence), or the only one. */
export function courseOf(m, courses) {
  const cs = (courses || []).filter((c) => c && Array.isArray(c.plan) && c.plan.length);
  const t = " " + normName(m.title) + " ";
  // a language's name in English or Egyptian Arabic is the same course («كورس التركي» ↔ "Turkish")
  const alias = (w) => { for (const [en, ar] of LANG_ALIAS) if (w.startsWith(en) || ar.some((x) => w.replace(/^ال/, "").startsWith(x))) return en; return w; };
  const words = (x) => normName(x).split(/\s+/).filter((w) => w.length >= 4).map(alias);
  const said = words(m.title), same = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && (a.startsWith(b) || b.startsWith(a)));
  return cs.find((c) => words([c.topic, c.title].filter(Boolean).join(" ")).some((w) => said.some((x) => same(x, w)))) || (cs.length === 1 ? cs[0] : null);
}
const LANG_ALIAS = [["turkish", ["تركي"]], ["english", ["انجليز", "انجلش", "انقليز"]], ["french", ["فرنس", "فرنساوي"]], ["german", ["الماني", "ألماني"]], ["spanish", ["اسبان"]], ["italian", ["ايطال"]], ["arabic", ["عربي"]], ["chinese", ["صيني"]], ["japanese", ["ياباني"]]];
/** P(X ≥ k) for X ~ Poisson(λ). */
const poissonAtLeast = (k, lam) => { if (k <= 0) return 1; if (lam <= 0) return 0; let p = Math.exp(-lam), c = p; for (let i = 1; i < k; i++) { p *= lam / i; c += p; } return Math.max(0, 1 - c); };
function evalLearn(m, data, now, days, ev, out) {
  const c = courseOf(m, data.courses), today = iso(now);
  if (!c) return out({ value: 0, target: 0, left: 0, pct: 0, chance: null, state: "unknown", step: { en: "Start the course in Learn first — the mission counts its lessons.", ar: "ابدأ الكورس في اتعلّم الأول — المهمة بتعدّ دروسه." } });
  const total = c.plan.length, done = (c.lessons || []).filter((l) => l.done).length, left = Math.max(0, total - done);
  const recent = (c.lessons || []).filter((l) => l.done && l.day && daysBetween(l.day, today) < 14).length;
  const rate = recent / 14, lam = rate * days;
  const chance = left <= 0 ? 1 : days > 0 && (c.lessons || []).some((l) => l.done) ? poissonAtLeast(left, lam) : null;
  ev.push({ en: `${c.topic || c.title}: ${done} of ${total} lessons done; ${recent} in the last 2 weeks.`, ar: `${c.topic || c.title}: خلصت ${done} من ${total} درس؛ ${recent} في آخر أسبوعين.` });
  const perWeek = days > 0 ? Math.ceil((left / days) * 7) : left;
  const step = left <= 0 ? null : { en: `${perWeek} lesson${perWeek === 1 ? "" : "s"} a week finishes it by ${m.deadline}${rate > 0 ? ` (you do about ${fmtN(rate * 7, 1)} now)` : ""}.`, ar: `${perWeek} درس في الأسبوع يخلّصه قبل ${m.deadline}${rate > 0 ? ` (إنت بتعمل حوالي ${fmtN(rate * 7, 1)} دلوقتي)` : ""}.` };
  return out({ value: done, target: total, left, pct: pctOf(done, total), perDayNeed: null, perDayNow: null, chance, state: stateOf(left, days, chance), step, course: c.id || c.topic });
}

const flive = (a) => (a || []).filter((x) => x && !x.del);
function evalRevenue(m, data, now, days, ev, out) {
  const F = data.fleet, today = iso(now), from = fromOf(m);
  if (!F) return out({ value: 0, target: m.target, left: m.target, pct: 0, chance: null, state: "unknown", step: { en: "Open Business → Fleet & rentals and add the cranes and their work — the mission reads it.", ar: "افتح الأعمال ← الأسطول والإيجار وضيف الونشات وشغلها — المهمة بتقرا منه." } });
  const entries = flive(F.entries), cur = (F.settings && F.settings.currency) || "";
  const earned = entries.filter((e) => e.date >= from && e.date <= today).reduce((a, e) => a + (+e.amount || 0), 0), left = Math.max(0, m.target - earned);
  const daily = dailyOf(entries, (e) => e.date, (e) => +e.amount || 0, today);
  const chance = left <= 0 ? 1 : days > 0 ? chanceToGather(daily, left, days, { seed: seedOf(m.id + today) }) : 0;
  const working = new Set(flive(F.jobs).filter((j) => j.status === "active").map((j) => j.crane)), cranes = flive(F.cranes), idle = cranes.filter((c) => !working.has(c.id));
  ev.push({ en: `Fleet's work since ${from}: ${fmtN(earned)} ${cur}; ${working.size} of ${cranes.length} cranes on a job now.`, ar: `شغل الأسطول من ${from}: ${fmtN(earned)} ${cur}؛ ${working.size} من ${cranes.length} ونش في شغل دلوقتي.` });
  let step = null;
  if (left > 0 && idle.length && days > 0) {
    const best = [...idle].sort((a, b) => (b.daily || 0) - (a.daily || 0))[0], add = (best.daily || 0) * days;
    if (add > 0) step = { en: `${idle.length} crane${idle.length === 1 ? "" : "s"} idle — a job for ${best.name} at its day rate (${fmtN(best.daily)}) adds about ${fmtN(add)} by ${m.deadline}.`, ar: `${idle.length} ونش واقف — شغلانة لـ ${best.name} بسعر يومه (${fmtN(best.daily)}) تزوّد حوالي ${fmtN(add)} لحد ${m.deadline}.`, crane: best.id };
  }
  if (!step && left > 0) step = { en: `${fmtN(days > 0 ? left / days : left)} a day of work entries is needed until ${m.deadline}.`, ar: `محتاج ${fmtN(days > 0 ? left / days : left)} في اليوم شغل مسجّل لحد ${m.deadline}.` };
  return out({ value: Math.round(earned), target: m.target, left: Math.round(left), pct: pctOf(earned, m.target), perDayNeed: days > 0 ? left / days : left, perDayNow: daily.reduce((a, b) => a + b, 0) / daily.length, chance, state: stateOf(left, days, chance), step });
}
function evalCollect(m, data, now, days, ev, out) {
  const F = data.fleet, today = iso(now), from = fromOf(m);
  if (!F) return out({ value: 0, target: m.target, left: m.target, pct: 0, chance: null, state: "unknown", step: { en: "Open Business → Fleet & rentals and record the payments — the mission reads them.", ar: "افتح الأعمال ← الأسطول والإيجار وسجّل الدفعات — المهمة بتقرا منها." } });
  const ins = flive(F.cheques).filter((q) => q.dir === "in"), cur = (F.settings && F.settings.currency) || "";
  const got = ins.filter((q) => q.status === "cleared" && q.due >= from && q.due <= today).reduce((a, q) => a + q.amount, 0);
  const coming = ins.filter((q) => q.status === "pending" && q.due <= (m.deadline || today));
  const comingSum = coming.reduce((a, q) => a + q.amount, 0), left = Math.max(0, m.target - got);
  // cheques can bounce: your own clients' share of bounced cheques so far
  const decided = ins.filter((q) => q.method === "cheque" && q.status !== "pending"), bounce = decided.length ? decided.filter((q) => q.status === "bounced").length / decided.length : 0.05;
  const chance = left <= 0 ? 1 : comingSum >= left ? Math.max(0, Math.min(0.95, 1 - bounce * Math.max(1, coming.length / 2))) : null;
  ev.push({ en: `Collected since ${from}: ${fmtN(got)} ${cur}; cheques due by ${m.deadline}: ${coming.length} (${fmtN(comingSum)}); bounced before: ${Math.round(bounce * 100)}%.`, ar: `اتحصّل من ${from}: ${fmtN(got)} ${cur}؛ شيكات مستحقة قبل ${m.deadline}: ${coming.length} (${fmtN(comingSum)})؛ اللي ارتد قبل كده: ${Math.round(bounce * 100)}%.` });
  // who to call: the clients who owe the most (opening + work − payments)
  const bal = (k) => { const jobs = new Set(flive(F.jobs).filter((j) => j.client === k.id).map((j) => j.id)); const work = flive(F.entries).filter((e) => jobs.has(e.job)).reduce((a, e) => a + e.amount, 0);
    const paid = ins.filter((q) => q.client === k.id && q.status !== "bounced").reduce((a, q) => a + q.amount, 0); return (k.opening || 0) + work - paid; };
  const owe = flive(F.clients).map((k) => ({ k, b: bal(k) })).filter((x) => x.b > 0).sort((a, b) => b.b - a.b).slice(0, 3);
  const gap = Math.max(0, left - comingSum);
  const step = left <= 0 ? null : gap > 0 && owe.length ? { en: `Still ${fmtN(gap)} beyond the cheques due — call ${owe.map((x) => `${x.k.name} (${fmtN(x.b)})`).join(", ")}.`, ar: `لسه ${fmtN(gap)} غير الشيكات المستحقة — كلّم ${owe.map((x) => `${x.k.name} (${fmtN(x.b)})`).join("، ")}.`, clients: owe.map((x) => x.k.id) }
    : { en: `${coming.length} cheque${coming.length === 1 ? "" : "s"} cover it — deposit each on its date.`, ar: `${coming.length} شيك بيغطّوها — ودّع كل واحد في ميعاده.` };
  const state = left <= 0 ? "done" : !days ? "late" : chance == null ? "behind" : stateOf(left, days, chance);
  return out({ value: Math.round(got), target: m.target, left: Math.round(left), pct: pctOf(got, m.target), perDayNeed: days > 0 ? gap / days : gap, perDayNow: null, chance, state, step });
}
const fmtN = (v, d = 0) => (Math.round(Number(v) * 10 ** d) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: d });
const pc = (c) => Math.round(c * 100) + "%";

/** A new mission from what was read: it remembers where you start from (balance / weight), so progress is from today. */
export function startMission(p, data, now = Date.now()) {
  const id = "ms" + now.toString(36) + Math.random().toString(36).slice(2, 5);
  const base = {};
  if (p.kind === "save") base.balance = moneySense(data.ledger, now).balance;
  if (p.kind === "weight") base.kg = bodySense(data.fit, now).last;
  // v6.44: a mission for "this month" counts from the 1st; the debt's amount left when it started
  if (p.kind === "cap" || p.kind === "revenue" || p.kind === "collect") { const t0 = iso(now); base.from = p.deadline && p.deadline.slice(0, 7) === t0.slice(0, 7) ? t0.slice(0, 8) + "01" : t0; }
  if (p.kind === "debt") { const d = debtOf({ title: p.title }, data.ledger); if (d) { base.left = Math.max(0, debtLeft(d)); base.person = d.person; } }
  return { id, ...p, created: iso(now), base, status: "active", log: [] };
}

/** One line per mission for today's morning report (and the notification). */
export function debrief(missions, data, now = Date.now(), lang = "en") {
  const ar = lang === "ar";
  return (missions || []).filter((m) => m.status === "active").map((m) => {
    const e = evaluate(m, data, now);
    const head = e.state === "done" ? (ar ? "خلصت ✔" : tr("done ✔")) : e.chance == null ? (ar ? "محتاج بيانات" : tr("needs data")) : (ar ? `فرصتك ${pc(e.chance)}` : `${pc(e.chance)} chance`);
    const step = e.step ? (ar ? e.step.ar : tr(e.step.en)) : "";
    return { id: m.id, title: m.title, head, step, e };
  });
}

/** A one-day history entry per mission (for the chance-over-time line). */
export function logDay(m, e, now = Date.now()) {
  const d = iso(now), log = (m.log || []).filter((x) => x.d !== d);
  return { ...m, log: [...log, { d, v: e.value, c: e.chance == null ? null : Math.round(e.chance * 100) }].slice(-120) };
}

export const MISSIONS_KEY = "attune:missions:v1";
export const loadMissions = (ls = typeof localStorage !== "undefined" ? localStorage : null) => { try { const j = JSON.parse((ls && ls.getItem(MISSIONS_KEY)) || "null"); return j && Array.isArray(j.items) ? j : { items: [] }; } catch (e) { return { items: [] }; } };
export const saveMissions = (d, ls = typeof localStorage !== "undefined" ? localStorage : null) => { try { ls && ls.setItem(MISSIONS_KEY, JSON.stringify(d)); } catch (e) {} return d; };

/** Two missions that fight over the same money: a save and a buy (or two saves) whose needs together are more than you keep. */
export function conflicts(missions, data, now = Date.now()) {
  const act = (missions || []).filter((m) => m.status === "active" && (m.kind === "save" || m.kind === "buy"));
  if (act.length < 2) return null;
  const ms = moneySense(data.ledger, now), keep = ms.net.length ? (ms.net.reduce((a, b) => a + b, 0) / ms.net.length) * 30 : 0;
  const need = act.reduce((a, m) => { const e = evaluate(m, data, now); return a + (e.perDayNeed || 0) * 30; }, 0);
  return need > keep * 1.05 ? { need: Math.round(need), keep: Math.round(keep), ids: act.map((m) => m.id) } : null;
}
