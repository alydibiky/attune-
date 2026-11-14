import { weekStart } from "./country.js";   // v9.9.38 WK: the week starts on your day
/* ---- v6.12: questions about your OWN money, answered by code from the Money ledger ------------------------------------------
   Ali asked Instant "What are my expenses in the last 4 days" and got "I need your expense data… please provide the data":
   the money is on the phone (Money / Yusr keeps it in localStorage "ledger.v3"), but only the Money tab ever read it.
   Now Instant and Chat spot a question about the person's own spending / income, read the ledger, and answer with sums
   computed here — the model never adds up money. Pure logic; tests: tests/unit/v702myledger.test.mjs.                       */

import { tr, dateLocale } from "./i18n.js";
import { homeCurrency } from "./locale.js";
import { CAT_WORDS } from "./yusr/logtext.js";
import { LEX } from "./understand.js";

/** The category a question is about ("how much on food this week?" → "food"), or "". Salary only for income questions. */
export function catAsked(q) {
  for (const [id, re] of Object.entries(CAT_WORDS)) if (id !== "salary" && re.test(q)) return id;
  return "";
}

const CATS = { food: ["Food", "طعام"], groceries: ["Groceries", "بقالة"], transport: ["Transport", "مواصلات"], bills: ["Bills", "فواتير"], rent: ["Rent", "إيجار"],
  shopping: ["Shopping", "تسوق"], health: ["Health", "صحة"], fun: ["Fun", "ترفيه"], coffee: ["Coffee/Tea", "قهوة/شاي"], gifts: ["Gifts", "هدايا"], salary: ["Salary", "راتب"],
  invoice: ["Invoices", "فواتير مبيعات"], other: ["Other", "أخرى"] };
const AR_D = "٠١٢٣٤٥٦٧٨٩";
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => String(AR_D.indexOf(d)));
const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fourteen: 14, thirty: 30,
  "واحد": 1, "يومين": 2, "اسبوعين": 14, "أسبوعين": 14, "تلات": 3, "ثلاث": 3, "تلاتة": 3, "ثلاثة": 3, "اربع": 4, "أربع": 4, "اربعة": 4, "أربعة": 4, "خمس": 5, "خمسة": 5, "ست": 6, "ستة": 6, "سبع": 7, "سبعة": 7, "عشر": 10, "عشرة": 10 };

/** Is this a question about the person's own money (not money in general)? → "expense" | "income" | "both" | "" */
export function myMoneyIntent(q) {
  const t = latin(q).toLowerCase();
  const mine = /\b(my|i|me|i've|did i|have i)\b/.test(t) || /(مصاريفي|مصروفاتي|صرفت|دفعت|دخلي|قبضت|فلوسي|مصروفي|حساباتي|اتصرف|كسبت|عندي كام|معايا كام|فاضلي|فاضل معايا|ميزانيتي|بصرف|باصرف|بدفع|بادفع)/.test(t) || /^\s*total (?:spent|spending|expenses)\b/.test(t);
  if (!mine) return "";
  // v9.0 (Ali: "Remind me on the last day of each month to pay interest for mom" was answered with this month's spending): a
  // reminder, an alarm, a to-do or a payment to make is something to SET, never a question about money already spent
  if ((LEX.action.test(q) && !/[?؟]\s*$/.test(String(q).trim())) || /\b(remind(er)?|alarm|alert me|notify me|schedule|don'?t let me forget|wake me)\b/.test(t) || /(فكرني|فكّرني|ذكرني|ذكّرني|نبهني|نبّهني|حطلي تذكير|منبه|متنسانيش)/.test(t)) return "";
  if (/^\s*(please\s+)?(pay|transfer|send)\b/.test(t) || /\b(i need to|i have to|i must|i should|i want to|i'?ll|i will|i'?m going to)\s+pay\b/.test(t) || /(لازم|محتاج|عايز|هدفع|حادفع)\s+(ا|أ)?دفع/.test(t)) return "";
  const exp = /\b(expens\w*|spen[dt]\w*|spending|paid|pay(ments)?|costs?|purchases?|bought|outgoings?)\b|\bhow much (did|have) i (give|given|gave)\b/.test(t) || /(مصاريف|مصروف|صرفت|دفعت|اتصرف|اشتريت|بصرف|باصرف|بدفع|بادفع)/.test(t);
  const inc = /\b(income|earn\w*|received|got paid|salary|revenue)\b/.test(t) || /(دخل|قبضت|كسبت|استلمت|مرتب|راتب)/.test(t);
  const bal = /\b(balance|how much (money )?(do )?i have|net|left in my budget|budget left|left (?:this|for the) month)\b/.test(t) || /(رصيد|معايا كام|عندي كام|فاضلي كام|فاضل معايا)/.test(t);
  if (!exp && !inc && !bal) return "";
  // v9.0 (the sentence bank: "I bought a fridge on instalments, 1500 a month" was read as a question): a statement of what was
  // bought or paid, with its amount and no question, is something to record — not a question about spending
  if (!/[?؟]/.test(t) && !/\b(how much|what|which|show|list|total|sum|did i|have i|my (expenses|spending|income|outgoings))\b|كام|ايه|إيه|اد ايه|قد ايه|مصاريفي|مصروفاتي|دخلي/.test(t) && /\d/.test(t)) return "";
  // (persona 9: "when did I last pay netflix?" was answered with this month's bills — a "when" question is People & plans' / Ask's)
  if (/\b(when did (i|we) last|last time (i|we)|when was the last time)\b/.test(t) || /(امتى|إمتى|امتي)\s+(اخر|آخر)\s+(مره|مرة)/.test(t)) return "";
  if (/\b(how to|tips|should i|advice|budget(ing)? plan|reduce|save more)\b/.test(t) || /(ازاي اقلل|نصايح|ازاي أوفر|ازاي اوفر)/.test(t)) return "";   // advice, not a lookup
  return exp && inc ? "both" : exp ? "expense" : inc ? "income" : "both";
}

const day0 = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const iso = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };

/** The time span a question asks about → { from, to, label:[en, ar] } (dates as YYYY-MM-DD, both included). Default: this month. */
export function spanOf(q, now = Date.now()) {
  const t = latin(q).toLowerCase(), today = day0(now);
  const back = (n) => { const f = new Date(today); f.setDate(f.getDate() - (n - 1)); return f; };
  let m = /(?:last|past|previous)\s+(\d+|\w+)\s+(day|week|month)s?/.exec(t) || /(?:آخر|اخر|ف?ي? ?ال)\s*(\d+|\S+)\s*(يوم|أيام|ايام|أسبوع|اسبوع|أسابيع|اسابيع|شهر|شهور)/.exec(t);
  if (m) {
    let n = /^\d+$/.test(m[1]) ? +m[1] : WORDNUM[m[1]] || 0;
    const unit = /week|سبوع|سابيع/.test(m[2]) ? 7 : /month|شهر|شهور/.test(m[2]) ? 30 : 1;
    if (!n && /^(أسبوع|اسبوع|شهر|يوم)$/.test(m[1])) n = 1;
    if (n > 0 && n < 400) { const days = n * unit; return { key: "last", n, unit: unit === 7 ? "week" : unit === 30 ? "month" : "day", from: iso(back(days)), to: iso(today), label: [`the last ${n} ${unit === 7 ? "week" : unit === 30 ? "month" : "day"}${n > 1 ? "s" : ""}`, `آخر ${n} ${unit === 7 ? "أسبوع" : unit === 30 ? "شهر" : n > 2 && n < 11 ? "أيام" : "يوم"}`] };
    }
  }
  if (/\btoday\b|النهار ?ده|النهارده|اليوم/.test(t)) return { key: "today", from: iso(today), to: iso(today), label: ["today", "النهارده"] };
  if (/\byesterday\b|امبارح|أمس|البارحة/.test(t)) { const y = back(2); return { key: "yesterday", from: iso(y), to: iso(y), label: ["yesterday", "امبارح"] }; }
  if (/\bthis week\b|الأسبوع ده|الاسبوع ده|هذا الأسبوع/.test(t)) { const f = new Date(today); f.setDate(f.getDate() - ((f.getDay() - weekStart() + 7) % 7)); return { key: "this week", from: iso(f), to: iso(today), label: ["this week", "الأسبوع ده"] }; }   // the week starts Saturday in Egypt
  if (/\blast week\b|الأسبوع اللي فات|الاسبوع اللي فات|الأسبوع الماضي/.test(t)) { const e = new Date(today); e.setDate(e.getDate() - ((e.getDay() - weekStart() + 7) % 7) - 1); const f = new Date(e); f.setDate(f.getDate() - 6); return { key: "last week", from: iso(f), to: iso(e), label: ["last week", "الأسبوع اللي فات"] }; }
  if (/\blast month\b|الشهر اللي فات|الشهر الماضي/.test(t)) { const f = new Date(today.getFullYear(), today.getMonth() - 1, 1), e = new Date(today.getFullYear(), today.getMonth(), 0); return { key: "last month", from: iso(f), to: iso(e), label: ["last month", "الشهر اللي فات"] }; }
  if (/\bthis year\b|السنة دي|هذا العام|السنه دي/.test(t)) return { key: "this year", from: `${today.getFullYear()}-01-01`, to: iso(today), label: ["this year", "السنة دي"] };
  // v8.7 (persona 4, idea 5 — "how much did I spend on uber in September?" was answered for this month): a month by name is that
  // month (this year's, or last year's when it hasn't come yet)
  { const EN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], AR = ["يناير", "فبراير", "مارس", "أبريل|ابريل", "مايو", "يونيو", "يوليو", "أغسطس|اغسطس", "سبتمبر", "أكتوبر|اكتوبر", "نوفمبر", "ديسمبر"];
    let mo = EN.findIndex((m) => new RegExp("\\b(in|for|during|of|on)?\\s*" + m + "[a-z]*\\b").test(t) && new RegExp("\\b" + m + "(uary|ruary|ch|il|e|y|ust|tember|ober|ember)?\\b").test(t));
    if (mo < 0) mo = AR.findIndex((m) => new RegExp("(?:^|\\s|في|ف)(" + m + ")(?![\\u0621-\\u064A])").test(t));
    if (mo >= 0) { const y = mo > today.getMonth() ? today.getFullYear() - 1 : today.getFullYear(), f = new Date(y, mo, 1), e = new Date(y, mo + 1, 0);
      const name = f.toLocaleDateString("en-GB", { month: "long" }); return { key: "month", mo, y, from: iso(f), to: iso(e > today ? today : e), label: ["in " + name, "في " + AR[mo].split("|")[0]] }; } }
  return { key: "this month", from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today), label: ["this month", "الشهر ده"] };
}

/** v9.9.38: a span in the screen's language — "this month", «في الشهر ده», "este mes", "in the last 3 days", "en septiembre"… */
export function spanWords(span) {
  if (!span) return "";
  const k = span.key;
  if (k === "last") return tr(span.unit === "week" ? "in the last {n} weeks" : span.unit === "month" ? "in the last {n} months" : "in the last {n} days", { n: span.n });
  if (k === "month") { let m = ""; try { m = new Date(span.y, span.mo, 1).toLocaleDateString(dateLocale(), { month: "long" }); } catch (e) { m = String(span.mo + 1); } return tr("in {m}", { m }); }
  return tr({ today: "today", yesterday: "yesterday", "this week": "this week", "last week": "last week", "this month": "this month", "last month": "last month", "this year": "this year" }[k] || span.label[0]);
}
/** The Money ledger as the Money tab saved it, or null. */
export function loadLedger(store = typeof localStorage !== "undefined" ? localStorage : null) {
  try { const j = JSON.parse((store && store.getItem("ledger.v3")) || "null"); return j && Array.isArray(j.txns) ? j : null; } catch (e) { return null; }
}

// v9.9.38 (the 1M test: "You spent 150 EGP in today", «في النهارده»): "in" only where English / Arabic say it
const inEn = (l) => (/^(?:today|yesterday|this |last |in )/.test(l) ? l : "in " + l);
const inAr = (l) => (/^(?:في |النهارده|امبارح)/.test(l) ? l : "في " + l);
const money = (n, cur) => `${(Math.round(n * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${cur}`.trim();

/**
 * The answer, by code. → { text, total, count, empty, noLedger } (text = Markdown, in English or Arabic).
 * Expenses and income are summed per currency (an EGP account and a USD account are never added together).
 */
export function answerMyMoney(question, ledger, { now = Date.now(), ar = /[؀-ۿ]/.test(question), short = false } = {}) {
  const kind = myMoneyIntent(question) || "expense";
  const onlyCat = catAsked(question);   // v6.13: "how much on food this week?" counts food only
  const span = spanOf(question, now);
  const L = (en, a) => (ar ? a : tr(en));
  // v9.9.38: every other language gets the sentence as a template with its numbers (a finished English sentence can't be translated)
  const T = (t, v, a) => (ar ? a : tr(t, v)), P = spanWords(span);
  if (!ledger) return { noLedger: true, text: L("Nothing is recorded in **Money** yet. Add your expenses there (or share a bank SMS to Attune) and ask again.", "لا يوجد شيء مسجّل في **المال** بعد. سجّل مصروفاتك هناك (أو شارك رسالة البنك مع Attune) واسأل مرة أخرى.") };
  const acct = new Map((ledger.accounts || []).map((a) => [a.id, a]));
  const cur = (tx) => ((acct.get(tx.account) || {}).currency || ledger.currency || homeCurrency());
  const custom = new Map((ledger.customCats || []).map((c) => [c.id, [c.en || c.name || c.id, c.ar || c.en || c.id]]));
  const catName = (id) => { const c = CATS[id] || custom.get(id) || [String(id || "Other"), String(id || "أخرى")]; return ar ? c[1] : tr(c[0]); };
  const inSpan = (ledger.txns || []).filter((x) => x && x.date >= span.from && x.date <= span.to && (x.type === "expense" || x.type === "income") && (acct.get(x.account) || {}).unit !== "g"
    && (!onlyCat || x.type === "income" || (x.cat || "other") === onlyCat));
  const out = [], sums = {};
  const part = (type) => {
    const rows = inSpan.filter((x) => x.type === type).sort((a, b) => (a.date < b.date ? 1 : -1));
    const by = {};
    for (const x of rows) { const c = cur(x), k = c + "|" + (x.cat || "other"); by[k] = (by[k] || 0) + (+x.amount || 0); sums[type + "|" + c] = (sums[type + "|" + c] || 0) + (+x.amount || 0); }
    const curs = [...new Set(rows.map(cur))];
    const head = type === "expense" ? L("You spent", "صرفت") : L("You received", "دخلك");
    if (short) {   // v6.13: a chat-sized answer for Yusr's write-or-ask bar
      if (!rows.length) { out.push(type === "expense" ? T(onlyCat ? "Nothing spent on {c} {p}." : "Nothing spent {p}.", { c: catName(onlyCat), p: P }, `لا توجد مصروفات${onlyCat ? " على " + catName(onlyCat) : ""} ${inAr(span.label[1])}.`) : T("No income {p}.", { p: P }, `لا يوجد دخل ${inAr(span.label[1])}.`)); return; }
      const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => { const [c, cat] = k.split("|"); return `${catName(cat)} ${money(v, c)}`; });
      const big = rows.reduce((m, x) => (+x.amount > +m.amount ? x : m), rows[0]);
      const amt = curs.map((c) => money(sums[type + "|" + c], c)).join(" + "), one = rows.length === 1;
      out.push((ar ? `**${head} ${amt}**${onlyCat && type === "expense" ? " على " + catName(onlyCat) : ""} ${inAr(span.label[1])} · ${rows.length} عملية.`
        : tr(type === "income" ? (one ? "**You received {a}** {p} · 1 entry." : "**You received {a}** {p} · {n} entries.")
          : onlyCat ? (one ? "**You spent {a}** on {c} {p} · 1 entry." : "**You spent {a}** on {c} {p} · {n} entries.") : (one ? "**You spent {a}** {p} · 1 entry." : "**You spent {a}** {p} · {n} entries."),
          { a: amt, c: catName(onlyCat), p: P, n: rows.length }))
        + (onlyCat || top.length < 2 ? "" : "\n" + top.join(" · "))
        + (rows.length > 1 ? "\n" + L("Biggest: ", "الأكبر: ") + (big.note ? String(big.note).slice(0, 40) + " " : catName(big.cat) + " ") + money(+big.amount, cur(big)) + " · " + big.date : ""));
      return;
    }
    if (!rows.length) { out.push(type === "expense" ? T("No expenses are recorded {p} ({f} → {t}).", { p: P, f: span.from, t: span.to }, `لا توجد مصروفات مسجّلة ${inAr(span.label[1])} (${span.from} → ${span.to}).`) : T("No income is recorded {p}.", { p: P }, `لا يوجد دخل مسجّل ${inAr(span.label[1])}.`)); return; }
    { const amt = curs.map((c) => money(sums[type + "|" + c], c)).join(" + "), one = rows.length === 1;
      out.push(ar ? `**${head} ${amt}** ${inAr(span.label[1])} (${span.from} → ${span.to}) · ${rows.length} عملية`
        : tr(type === "income" ? (one ? "**You received {a}** {p} ({f} → {t}) · 1 entry" : "**You received {a}** {p} ({f} → {t}) · {n} entries") : (one ? "**You spent {a}** {p} ({f} → {t}) · 1 entry" : "**You spent {a}** {p} ({f} → {t}) · {n} entries"),
          { a: amt, p: P, f: span.from, t: span.to, n: rows.length })); }
    out.push("", `| ${L("Category", "البند")} | ${L("Amount", "المبلغ")} |`, "|---|---:|");
    for (const [k, v] of Object.entries(by).sort((a, b) => b[1] - a[1])) { const [c, cat] = k.split("|"); out.push(`| ${catName(cat)} | ${money(v, c)} |`); }
    out.push("", L("**Each entry:**", "**كل عملية:**"));
    for (const x of rows.slice(0, 15)) out.push(`- ${x.date} · ${catName(x.cat)} · ${money(+x.amount || 0, cur(x))}${x.note ? " — " + String(x.note).replace(/[|\n]/g, " ").slice(0, 60) : ""}`);
    if (rows.length > 15) out.push(T("- …and {n} more (open Money to see all).", { n: rows.length - 15 }, `- …و${rows.length - 15} أخرى (افتح «المال» لرؤيتها كلها).`));
    out.push("");
  };
  if (kind === "expense" || kind === "both") part("expense");
  if (kind === "income" || kind === "both") part("income");
  const total = Object.entries(sums).filter(([k]) => k.startsWith(kind === "income" ? "income" : "expense")).reduce((a, [, v]) => a + v, 0);
  if (!short) out.push(L("_Added up from your Money records on this phone._", "_جُمعت من سجلات المال على هاتفك._"));
  return { text: out.join("\n").trim(), total, count: inSpan.length, empty: !inSpan.length, span };
}
