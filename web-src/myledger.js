/* ---- v6.12: questions about your OWN money, answered by code from the Money ledger ------------------------------------------
   Ali asked Instant "What are my expenses in the last 4 days" and got "I need your expense data… please provide the data":
   the money is on the phone (Money / Yusr keeps it in localStorage "ledger.v3"), but only the Money tab ever read it.
   Now Instant and Chat spot a question about the person's own spending / income, read the ledger, and answer with sums
   computed here — the model never adds up money. Pure logic; tests: tests/unit/v702myledger.test.mjs.                       */

import { CAT_WORDS } from "./yusr/logtext.js";

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
  const mine = /\b(my|i|me|i've|did i|have i)\b/.test(t) || /(مصاريفي|مصروفاتي|صرفت|دفعت|دخلي|قبضت|فلوسي|مصروفي|حساباتي|اتصرف|كسبت|عندي كام)/.test(t);
  if (!mine) return "";
  const exp = /\b(expens\w*|spen[dt]\w*|spending|paid|pay(ments)?|costs?|purchases?|bought|outgoings?)\b/.test(t) || /(مصاريف|مصروف|صرفت|دفعت|اتصرف|اشتريت)/.test(t);
  const inc = /\b(income|earn\w*|received|got paid|salary|revenue)\b/.test(t) || /(دخل|قبضت|كسبت|استلمت|مرتب|راتب)/.test(t);
  const bal = /\b(balance|how much (money )?(do )?i have|net)\b/.test(t) || /(رصيد|معايا كام|عندي كام)/.test(t);
  if (!exp && !inc && !bal) return "";
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
    if (n > 0 && n < 400) { const days = n * unit; return { from: iso(back(days)), to: iso(today), label: [`the last ${n} ${unit === 7 ? "week" : unit === 30 ? "month" : "day"}${n > 1 ? "s" : ""}`, `آخر ${n} ${unit === 7 ? "أسبوع" : unit === 30 ? "شهر" : n > 2 && n < 11 ? "أيام" : "يوم"}`] };
    }
  }
  if (/\btoday\b|النهار ?ده|النهارده|اليوم/.test(t)) return { from: iso(today), to: iso(today), label: ["today", "النهارده"] };
  if (/\byesterday\b|امبارح|أمس|البارحة/.test(t)) { const y = back(2); return { from: iso(y), to: iso(y), label: ["yesterday", "امبارح"] }; }
  if (/\bthis week\b|الأسبوع ده|الاسبوع ده|هذا الأسبوع/.test(t)) { const f = new Date(today); f.setDate(f.getDate() - ((f.getDay() + 1) % 7)); return { from: iso(f), to: iso(today), label: ["this week", "الأسبوع ده"] }; }   // the week starts Saturday in Egypt
  if (/\blast week\b|الأسبوع اللي فات|الاسبوع اللي فات|الأسبوع الماضي/.test(t)) { const e = new Date(today); e.setDate(e.getDate() - ((e.getDay() + 1) % 7) - 1); const f = new Date(e); f.setDate(f.getDate() - 6); return { from: iso(f), to: iso(e), label: ["last week", "الأسبوع اللي فات"] }; }
  if (/\blast month\b|الشهر اللي فات|الشهر الماضي/.test(t)) { const f = new Date(today.getFullYear(), today.getMonth() - 1, 1), e = new Date(today.getFullYear(), today.getMonth(), 0); return { from: iso(f), to: iso(e), label: ["last month", "الشهر اللي فات"] }; }
  if (/\bthis year\b|السنة دي|هذا العام|السنه دي/.test(t)) return { from: `${today.getFullYear()}-01-01`, to: iso(today), label: ["this year", "السنة دي"] };
  return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today), label: ["this month", "الشهر ده"] };
}

/** The Money ledger as the Money tab saved it, or null. */
export function loadLedger(store = typeof localStorage !== "undefined" ? localStorage : null) {
  try { const j = JSON.parse((store && store.getItem("ledger.v3")) || "null"); return j && Array.isArray(j.txns) ? j : null; } catch (e) { return null; }
}

const money = (n, cur) => `${(Math.round(n * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${cur}`.trim();

/**
 * The answer, by code. → { text, total, count, empty, noLedger } (text = Markdown, in English or Arabic).
 * Expenses and income are summed per currency (an EGP account and a USD account are never added together).
 */
export function answerMyMoney(question, ledger, { now = Date.now(), ar = /[؀-ۿ]/.test(question), short = false } = {}) {
  const kind = myMoneyIntent(question) || "expense";
  const onlyCat = catAsked(question);   // v6.13: "how much on food this week?" counts food only
  const span = spanOf(question, now);
  const L = (en, a) => (ar ? a : en);
  if (!ledger) return { noLedger: true, text: L("Nothing is recorded in **Money** yet. Add your expenses there (or share a bank SMS to Attune) and ask again.", "مفيش حاجة متسجلة في **الفلوس** لسه. سجّل مصاريفك هناك (أو شارك رسالة البنك مع Attune) واسأل تاني.") };
  const acct = new Map((ledger.accounts || []).map((a) => [a.id, a]));
  const cur = (tx) => ((acct.get(tx.account) || {}).currency || ledger.currency || "EGP");
  const custom = new Map((ledger.customCats || []).map((c) => [c.id, [c.en || c.name || c.id, c.ar || c.en || c.id]]));
  const catName = (id) => { const c = CATS[id] || custom.get(id) || [String(id || "Other"), String(id || "أخرى")]; return ar ? c[1] : c[0]; };
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
      if (!rows.length) { out.push(type === "expense" ? L(`Nothing spent${onlyCat ? " on " + catName(onlyCat) : ""} in ${span.label[0]}.`, `مفيش مصاريف${onlyCat ? " على " + catName(onlyCat) : ""} في ${span.label[1]}.`) : L(`No income in ${span.label[0]}.`, `مفيش دخل في ${span.label[1]}.`)); return; }
      const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => { const [c, cat] = k.split("|"); return `${catName(cat)} ${money(v, c)}`; });
      const big = rows.reduce((m, x) => (+x.amount > +m.amount ? x : m), rows[0]);
      out.push(`**${head} ${curs.map((c) => money(sums[type + "|" + c], c)).join(" + ")}**${onlyCat && type === "expense" ? L(" on " + catName(onlyCat), " على " + catName(onlyCat)) : ""} ${L(`in ${span.label[0]}`, `في ${span.label[1]}`)} · ${rows.length} ${L(rows.length === 1 ? "entry" : "entries", "عملية")}.`
        + (onlyCat || top.length < 2 ? "" : "\n" + top.join(" · "))
        + (rows.length > 1 ? "\n" + L("Biggest: ", "الأكبر: ") + (big.note ? String(big.note).slice(0, 40) + " " : catName(big.cat) + " ") + money(+big.amount, cur(big)) + " · " + big.date : ""));
      return;
    }
    if (!rows.length) { out.push(type === "expense" ? L(`No expenses are recorded for ${span.label[0]} (${span.from} → ${span.to}).`, `مفيش مصاريف متسجلة في ${span.label[1]} (${span.from} → ${span.to}).`) : L(`No income is recorded for ${span.label[0]}.`, `مفيش دخل متسجل في ${span.label[1]}.`)); return; }
    out.push(`**${head} ${curs.map((c) => money(sums[type + "|" + c], c)).join(" + ")}** ${L(`in ${span.label[0]}`, `في ${span.label[1]}`)} (${span.from} → ${span.to}) · ${rows.length} ${L(rows.length === 1 ? "entry" : "entries", "عملية")}`);
    out.push("", `| ${L("Category", "البند")} | ${L("Amount", "المبلغ")} |`, "|---|---:|");
    for (const [k, v] of Object.entries(by).sort((a, b) => b[1] - a[1])) { const [c, cat] = k.split("|"); out.push(`| ${catName(cat)} | ${money(v, c)} |`); }
    out.push("", L("**Each entry:**", "**كل عملية:**"));
    for (const x of rows.slice(0, 15)) out.push(`- ${x.date} · ${catName(x.cat)} · ${money(+x.amount || 0, cur(x))}${x.note ? " — " + String(x.note).replace(/[|\n]/g, " ").slice(0, 60) : ""}`);
    if (rows.length > 15) out.push(L(`- …and ${rows.length - 15} more (open Money to see all).`, `- …و${rows.length - 15} كمان (افتح الفلوس تشوفهم كلهم).`));
    out.push("");
  };
  if (kind === "expense" || kind === "both") part("expense");
  if (kind === "income" || kind === "both") part("income");
  const total = Object.entries(sums).filter(([k]) => k.startsWith(kind === "income" ? "income" : "expense")).reduce((a, [, v]) => a + v, 0);
  if (!short) out.push(L("_Added up from your Money records on this phone._", "_اتجمعت من سجلات الفلوس على موبايلك._"));
  return { text: out.join("\n").trim(), total, count: inSpan.length, empty: !inSpan.length, span };
}
