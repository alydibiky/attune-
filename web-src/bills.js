/* ---- v8.7 (persona 4, idea 14 — Ali: "do all"): the bills autopilot ------------------------------------------------------------
   Code learns each home bill from Money's own payments (no model, no server): which day of the month it usually comes, how much
   it usually is. Then it says, in time:
     high      "Electricity is 40% higher than usual this month — check the meter reading"
     late      "Electricity usually comes around the 10th — not paid yet this month"
     coming    "Internet usually comes on the 3rd — in 2 days, about 450 EGP"
   A bill is learned after 3 months with it. The usual amount is the MEDIAN of the earlier months (one odd month doesn't move it).
   Pure: ledger in, a list out. Guardian shows high / late as findings; the morning card says high / late / coming.           */
const DAY = 864e5;
const iso = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** The home bills, each with the words that name it (English, Egyptian Arabic, Franco). */
export const BILL_KINDS = [
  ["electricity", "Electricity", "الكهربا", /\b(electricity|electric|power bill|kahraba|ka?hraba)\b|كهرباء|كهربا/i],
  ["water", "Water", "المية", /\b(water bill|water)\b|(?<![ء-ي])(?:ال|بال|و|ب)?(?:مية|مياه|ماء)(?![ء-ي])/i],
  ["gas", "Gas", "الغاز", /\b(gas bill|natural gas|town gas|petrotrade)\b|(?<![ء-ي])(?:ال|بال|و|ب)?غاز(?![ء-ي])/i],
  ["internet", "Internet", "النت", /\b(internet|wifi|wi-fi|adsl|broadband|fiber|we home|te data)\b|انترنت|إنترنت|(?<![ء-ي])(?:ال|بال|و|ب)?نت(?![ء-ي])/i],
  ["mobile", "Mobile", "الموبايل", /\b(mobile|phone bill|recharge|vodafone|orange|etisalat|e&|we mobile|sim)\b|موبايل|رصيد|شحن|فودافون|اورانج|أورانج|اتصالات/i],
  ["landline", "Landline", "التليفون الأرضي", /\b(landline|home phone)\b|أرضي|ارضي/i],
];
const kindOf = (t) => { const s = `${t.note || ""} ${t.cat || ""}`; if (/\bgas(oline| station)?\b/i.test(s) && /station|petrol|fuel|بنزين/i.test(s)) return null; for (const k of BILL_KINDS) if (k[3].test(s)) return k; return null; };

/** → [{ kind, label, ar, usualDay, usual, months, paid, thisMonth, status: "high"|"late"|"coming"|"ok", pct, inDays }] */
export function billsOf(ledger, now = Date.now()) {
  const txns = ((ledger && ledger.txns) || []).filter((t) => t && t.type === "expense" && t.amount > 0 && t.date);
  const by = new Map();
  for (const t of txns) { const k = kindOf(t); if (k) (by.get(k[0]) || by.set(k[0], { k, list: [] }).get(k[0])).list.push(t); }
  const mo = iso(now).slice(0, 7), today = new Date(now).getDate(), out = [];
  for (const [, { k, list }] of by) {
    const months = new Map();
    for (const t of list) { const m = t.date.slice(0, 7); const x = months.get(m) || { amount: 0, day: 31 }; x.amount += t.amount; x.day = Math.min(x.day, +t.date.slice(8, 10)); months.set(m, x); }
    const before = [...months.entries()].filter(([m]) => m < mo).sort();
    if (before.length < 3) continue;
    const recent = before.slice(-6), usual = median(recent.map(([, x]) => x.amount)), usualDay = Math.round(median(recent.map(([, x]) => x.day)));
    const cur = months.get(mo), pct = cur ? Math.round((cur.amount / usual - 1) * 100) : 0;
    let status = "ok", inDays = null;
    if (cur && pct >= 25) status = "high";
    else if (!cur && today > usualDay + 3) status = "late";
    else if (!cur && usualDay >= today && usualDay - today <= 3) { status = "coming"; inDays = usualDay - today; }
    out.push({ kind: k[0], label: k[1], ar: k[2], usualDay, usual: Math.round(usual), months: before.length, paid: !!cur, thisMonth: cur ? cur.amount : 0, status, pct, inDays });
  }
  const order = { high: 0, late: 1, coming: 2, ok: 3 };
  return out.sort((a, b) => order[a.status] - order[b.status] || b.usual - a.usual);
}

const nth = (d) => d + (d % 10 === 1 && d !== 11 ? "st" : d % 10 === 2 && d !== 12 ? "nd" : d % 10 === 3 && d !== 13 ? "rd" : "th");
const f = (v) => Math.round(v).toLocaleString("en-US");

/** One line for a bill that needs a word (high / late / coming), in English or Egyptian Arabic; "" when it's fine. */
export function billLine(b, lang = "en", cur = "") {
  const ar = lang === "ar", c = cur ? " " + cur : "";
  if (b.status === "high") return ar ? `${b.ar} الشهر ده أعلى من العادي بـ${b.pct}% (${f(b.thisMonth)} بدل ${f(b.usual)}) — راجع قراية العداد` : `${b.label} is ${b.pct}% higher than usual (${f(b.thisMonth)} vs ${f(b.usual)}${c}) — check the meter reading`;
  if (b.status === "late") return ar ? `${b.ar} بتيجي عادةً يوم ${b.usualDay} — لسه متدفعتش الشهر ده` : `${b.label} usually comes around the ${nth(b.usualDay)} — not paid yet this month`;
  if (b.status === "coming") return ar ? `${b.ar} ${b.inDays === 0 ? "النهارده" : b.inDays === 1 ? "بكرة" : `كمان ${b.inDays} أيام`} — حوالي ${f(b.usual)}${c}` : `${b.label} ${b.inDays === 0 ? "is due today" : b.inDays === 1 ? "comes tomorrow" : `comes in ${b.inDays} days`} — about ${f(b.usual)}${c}`;
  return "";
}

/** "my bills" / «فواتيري» — every learned bill: when it comes, how much, this month. */
export function billsAnswer(ledger, now = Date.now(), lang = "en", cur = "") {
  const list = billsOf(ledger, now), ar = lang === "ar";
  if (!list.length) return ar ? "لسه معرفتش فواتيرك — بعد ٣ شهور من تسجيل الكهربا والمية والنت في الفلوس هقولك ميعاد كل واحدة وقيمتها." : "I don't know your bills yet — after 3 months of electricity, water or internet in Money I'll tell you when each comes and how much.";
  return list.map((b) => billLine(b, lang, cur) || (ar ? `${b.ar}: يوم ${b.usualDay} عادةً، حوالي ${f(b.usual)}${b.paid ? ` — اتدفعت ${f(b.thisMonth)}` : ""}` : `${b.label}: around the ${nth(b.usualDay)}, about ${f(b.usual)}${b.paid ? ` — paid ${f(b.thisMonth)}` : ""}`)).join("\n");
}
export const billsIntent = (q) => /^\s*(?:what are |show |list )?(?:my |the )?(?:home |monthly )?bills\s*\??\s*$|\bwhen (?:does|do) (?:my |the )?\w+ bills? come\b|^\s*(?:ايه )?فواتيري\s*[؟?]?\s*$|^\s*الفواتير\s*[؟?]?\s*$/i.test(String(q || ""));
