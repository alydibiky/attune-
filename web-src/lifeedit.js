/* ---- v9.9 Edit by talking (Ali, 8 Nov 2026, with FU6: "I want an option to also edit anything by talking to Chat — for example telling
   it the maid is now taking 700 and it gets done"). A sentence that CHANGES something already in People & plans:
     "the maid is now taking 700" · «الخدامة بقت بـ٧٠٠» · "car wash is 800 now" · "the maid comes on Friday now" · "move the car wash to
     the 5th" · «الخدامة بقت تيجي يوم الجمعة» · "stop the car wash" · «الخدامة مش هتيجي تاني»
   editIntent(text, items, now) → { id, what, change: { amount } | { weekday } | { day } | { stop: true }, from } | { ask: [names] } |
     { blocked: "plan", id, what, total } | null
   applyEdit(data, intent, now) → new data. The change starts TODAY: the days before keep what they were (c.changes, read by
   life.js scheduleOf), so Money and the history never change. A plan with a total (Sheikh 19,500 in 8) is not changed by a sentence —
   its total would break — it says so and opens People & plans. Tests: tests/unit/v990edit.test.mjs. */

const AR_D = "٠١٢٣٤٥٦٧٨٩";
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => AR_D.indexOf(d)).replace(/٫/g, ".");
const fold = (s) => latin(s).toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$|[^\p{L}])/gu, "ه").replace(/[ً-ْ]/g, "");
const iso = (t) => { const x = new Date(t); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };

// the same person / thing said in another language (the maid saved as «الخدامة», asked about as "maid")
const SAME = [
  ["maid", "housekeeper", "cleaner", "cleaning lady", "nanny", "dada", "khadama", "shaghala", "خدامه", "الخدامه", "شغاله", "الشغاله", "داده", "الداده", "مدام النضافه", "بتاعه النضافه"],
  ["driver", "sawa2", "سواق", "السواق"],
  ["car wash", "carwash", "washing the car", "غسيل العربيه", "غسيل عربيه", "غسيل"],
  ["tutor", "teacher", "lesson", "مدرس", "المدرس", "مدرسه", "المدرسه", "درس", "الدرس"],
  ["doorman", "bawab", "بواب", "البواب"],
  ["gardener", "جنايني", "الجنايني"],
  ["gym", "الجيم", "جيم"],
  ["internet", "wifi", "net", "النت", "نت", "انترنت"],
  ["electricity", "كهربا", "الكهربا", "الكهرباء"],
  ["rent", "ايجار", "الايجار"],
];
const groupOf = (word) => SAME.findIndex((g) => g.some((x) => fold(x) === word));
const wordsOf = (s) => fold(s).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !/^(the|and|bill|pay|every|monthly|weekly|regular|من|في|كل)$/.test(w));

/** Which items does the sentence name? (title or person; a word of 3+ letters, or the same thing in another language) */
export function namedIn(text, items = []) {
  const t = " " + fold(text).replace(/[^\p{L}\p{N}]+/gu, " ") + " ";
  const groupsSaid = new Set(SAME.map((g, k) => (g.some((x) => t.includes(" " + fold(x) + " ") || t.includes(" ال" + fold(x) + " ")) ? k : -1)).filter((k) => k >= 0));
  return items.filter((c) => {
    const names = [c.title, c.person].filter(Boolean).join(" ");
    if (!names.trim()) return false;
    const ws = wordsOf(names);
    if (ws.some((w) => t.includes(" " + w + " ") || t.includes(" ال" + w + " ") || t.includes(" " + w.replace(/^ال/, "") + " "))) return true;
    const whole = fold(names).trim();
    if (whole.length >= 3 && t.includes(" " + whole + " ")) return true;
    return ws.some((w) => { const g = groupOf(w) >= 0 ? groupOf(w) : groupOf(w.replace(/^ال/, "")); return g >= 0 && groupsSaid.has(g); });
  });
}

const CHANGE_RE = /\b(now|is now|are now|became|becomes|changed?|update|raised?|increased?|lowered?|reduced?|make it|set it|from now on|anymore|any more|takes?|taking|costs?|charges?|asks? for|instead)\b|بقت|بقى|بقا|بقي|بقيت|دلوقتي|دلوقت|من النهارده|من دلوقتي|غير|غيّر|عدل|عدّل|زود|زوّد|نزل|نزّل|خلي|خليه|خليها|بتاخد|هتاخد|بياخد|هياخد|بقيت باخد|بدل|بدل ما/i;
const PAID_RE = /\b(paid|gave|sent|transferred|received|got)\b|دفعت|دفعتله|دفعتلها|اديت|اديته|اديتها|ادتني|اداني|ادالي|حولت|استلمت/i;
const STOP_RE = /\b(stop|cancel|cancelled|canceled|end|ended|remove|delete|no longer|not coming|doesn'?t come|won'?t come|quit|left)\b|وقف|وقّف|الغي|الغى|إلغي|لغي|امسح|مبقتش|مبقاش|مش هتيجي|مش هيجي|مش جايه|مش جاي|سابت|ساب|مشيت|خلاص مش/i;
const MOVE_RE = /\b(comes?|coming|move|moved|now on|on|to the|switch|instead)\b|تيجي|بتيجي|هتيجي|ييجي|بييجي|هييجي|يوم|خليها|خليه|نقل|انقل|غير/i;
const WEEKDAYS = [
  [0, /\b(sunday|sun)\b|(?<![\p{L}])(ال)?(حد|احد)(?![\p{L}])/u],
  [1, /\b(monday|mon)\b|(?<![\p{L}])(ال)?(اتنين|اثنين)(?![\p{L}])/u],
  [2, /\b(tuesday|tue|tues)\b|التلات|الثلاثاء|التلاتاء/],
  [3, /\b(wednesday|wed)\b|الاربع|الاربعاء|الأربع/],
  [4, /\b(thursday|thu|thurs)\b|الخميس/],
  [5, /\b(friday|fri)\b|الجمعه|الجمعة/],
  [6, /\b(saturday|sat)\b|السبت/],
];

/** The amounts in the sentence (not a day of the month "the 5th" / «يوم ٥», not a time). */
function amountsOf(t) {
  const s = latin(t).replace(/\b(?:the\s+)?\d{1,2}(?:st|nd|rd|th)\b/gi, " ").replace(/يوم\s*\d{1,2}(?!\d)/g, " ").replace(/\b\d{1,2}:\d{2}\b/g, " ");
  return (s.match(/\d[\d,]*(?:\.\d+)?\s*(?:k|الف|ألف)?/gi) || []).map((x) => { const k = /k|الف|ألف/i.test(x); const v = +x.replace(/[^\d.]/g, ""); return k ? v * 1000 : v; }).filter((v) => v > 0);
}
function dayOfMonth(t) {
  const s = latin(t);
  const m = /\b(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/i.exec(s) || /يوم\s*(\d{1,2})(?!\d)/.exec(s) || /\bon\s+(\d{1,2})(?!\d|[,.]\d)/i.exec(s);
  const d = m ? +m[1] : 0; return d >= 1 && d <= 31 ? d : 0;
}

export function editIntent(text, items = [], now = Date.now()) {
  const raw = String(text || "").trim();
  if (!raw || raw.length > 160 || /[?؟]\s*$/.test(raw)) return null;
  const t = fold(raw);
  const named = namedIn(raw, (items || []).filter((c) => !c.done && !c.ended));
  if (!named.length) return null;
  const stop = STOP_RE.test(t) && !amountsOf(t).length;
  const amts = amountsOf(t);
  const wd = WEEKDAYS.find(([, re]) => re.test(t));
  const dom = dayOfMonth(t);
  let change = null;
  if (stop) change = { stop: true };
  else if (amts.length === 1 && CHANGE_RE.test(t) && !PAID_RE.test(t)) change = { amount: amts[0] };
  else if (!amts.length && wd && MOVE_RE.test(t) && (CHANGE_RE.test(t) || /\b(comes?|now on|move|moved)\b|تيجي|بقت|هتيجي|خليها|غير|نقل/i.test(t))) change = { weekday: wd[0] };
  else if (!amts.length && dom && /\b(move|moved|now|change|switch|instead)\b|خليها|خليه|غير|بقى|بقت|نقل|دلوقتي/i.test(t)) change = { day: dom };
  if (!change) return null;
  if (named.length > 1) return { ask: named.map((c) => c.title || c.person) };
  const c = named[0], what = c.title || c.person || "";
  // a plan with a total / a count (Sheikh 19,500 in 8) — a sentence must not break its total
  if (c.count > 0 || (c.total > 0 && c.kind !== "regular")) return { blocked: "plan", id: c.id, what, total: c.total || c.amount * c.count };
  if (change.weekday != null && (c.every !== "week" || (Array.isArray(c.days) && c.days.length > 1))) return null;
  if (change.day && c.every !== "month") return null;
  if (change.amount && Math.abs(change.amount - (c.amount || 0)) < 0.005) return { same: true, id: c.id, what, amount: change.amount };
  return { id: c.id, what, change, from: iso(now), was: c.amount, every: c.every || "", cur: c.currency || "" };
}

/** What the item cost on a day. c.amount is always what it costs NOW; each amount change keeps what it was before
 *  (c.changes: [{ from, amount, was } | { from, start } | { from, stop }]), so the days before a change keep their old amount. */
export function amountAt(c, date) {
  let a = c.amount;
  for (const ch of [...(c.changes || [])].filter((x) => x.amount != null).sort((x, y) => y.from.localeCompare(x.from))) if (ch.from > date) a = ch.was;
  return a;
}

/** The new date its days start from: the first such weekday / day of the month from today on. */
function nextStart(change, now) {
  const d = new Date(iso(now) + "T12:00:00");
  if (change.weekday != null) { while (d.getDay() !== change.weekday) d.setDate(d.getDate() + 1); return iso(d); }
  if (change.day) { const x = new Date(d.getFullYear(), d.getMonth(), change.day, 12); if (iso(x) < iso(now)) x.setMonth(x.getMonth() + 1); return iso(x); }
  return iso(d);
}

export function applyEdit(data, intent, now = Date.now()) {
  if (!intent || !intent.id || !intent.change) return data;
  const from = iso(now);
  return { ...data, items: (data.items || []).map((c) => {
    if (c.id !== intent.id) return c;
    const ch = intent.change;
    const same = (x, e) => x.from === from && ((x.amount != null && e.amount != null) || (x.start && e.start) || (x.stop && e.stop));
    const old = (c.changes || []).find((x) => same(x, { amount: ch.amount, start: ch.amount == null && !ch.stop, stop: ch.stop }));
    const entry = ch.stop ? { from, stop: true } : ch.amount != null ? { from, amount: ch.amount, was: old ? old.was : c.amount } : { from, start: nextStart(ch, now) };
    const changes = [...(c.changes || []).filter((x) => !same(x, entry)), entry];
    return { ...c, changes, ...(ch.amount != null ? { amount: ch.amount } : {}), ...(ch.stop ? { ended: from } : {}) };
  }) };
}

/** The sentence that says what was done (English through tr(), Egyptian Arabic written out). */
export function editDone(intent, { tr = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]), ar = false, now = Date.now() } = {}) {
  const n = (v) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (intent.ask) return ar ? `تقصد مين؟ ${intent.ask.join(" · ")}` : tr("Which one do you mean? {list}", { list: intent.ask.join(" · ") });
  if (intent.blocked) return ar ? `${intent.what} عليه خطة بإجمالي ${n(intent.total)} — غيّرها من «الناس والالتزامات» عشان الإجمالي ما يبوظش.` : tr("{w} is a plan with a total of {t} — change it in People & plans so the total stays right.", { w: intent.what, t: n(intent.total) });
  if (intent.same) return ar ? `${intent.what} هو ${n(intent.amount)} أصلاً — مفيش حاجة اتغيرت.` : tr("{w} is already {a} — nothing changed.", { w: intent.what, a: n(intent.amount) });
  const ch = intent.change, w = intent.what;
  if (ch.stop) return ar ? `تمام — ${w} وقف من النهارده. اللي فات فاضل زي ما هو في الفلوس.` : tr("Done — {w} stopped from today. What was paid before stays in Money.", { w });
  if (ch.amount != null) {
    const per = intent.every === "week" ? (ar ? " في الأسبوع" : " " + tr("a week")) : intent.every === "month" ? (ar ? " في الشهر" : " " + tr("a month")) : intent.every === "year" ? (ar ? " في السنة" : " " + tr("a year")) : "";
    return ar ? `تمام — ${w} بقى ${n(ch.amount)}${per} من النهارده (كان ${n(intent.was)}).` : tr("Done — {w} is now {a} from today (was {b}).", { w, a: n(ch.amount) + per, b: n(intent.was) });
  }
  const start = nextStart(ch, now), d = new Date(start + "T12:00:00");
  const day = d.toLocaleDateString(ar ? "ar-EG-u-nu-latn" : undefined, { weekday: "long", day: "numeric", month: "short" });
  return ar ? `تمام — ${w} بقى ${ch.weekday != null ? "كل " + d.toLocaleDateString("ar-EG", { weekday: "long" }) : "يوم " + ch.day + " من كل شهر"}، أول مرة ${day}.` : tr("Done — {w} moves to {d}, the first time on {f}.", { w, d: ch.weekday != null ? d.toLocaleDateString(undefined, { weekday: "long" }) : tr("the {n} of each month", { n: ch.day }), f: day });
}
