/* ---- v6.18 Business builder: the five steps and the AI interview's suggestions ------------------------------------
   Ali: "step by step like business name or system name then design for mobile and desktop interfaces then the actual
   logic and databases or in the order you see best"; "a mix of the 3 in a brilliant way".
   The order: Name → Data → Logic → Screens → Launch (the screens come after the data so they show real tables).
   In each step the "interview" asks one question with tappable answers. The answers here are computed from the design
   itself — no AI model needed, applied in one tap and undoable — and free-form requests go to the model.
   suggestions(sys, step) → [{ id, en, ar, ops }]  (ops = erp.js applyOps operations). Pure; unit-tested.         */
import * as E from "./erp.js";
import * as SC from "./erp-screens.js";

export const STEPS = [
  { id: "name", en: "Name", ar: "الاسم", q: { en: "What is your business, and what should the system be called?", ar: "ما نشاطك، وما اسم النظام؟" } },
  { id: "data", en: "Data", ar: "البيانات", q: { en: "These are the tables I made. Anything to add?", ar: "هذه الجداول التي أعددتها. هل تريد إضافة شيء؟" } },
  { id: "logic", en: "Logic", ar: "المنطق", q: { en: "Which calculations and rules should it handle for you?", ar: "ما الحسابات والقواعد التي يتولاها عنك؟" } },
  { id: "screens", en: "Screens", ar: "الشاشات", q: { en: "How should it look on a phone and on a computer?", ar: "كيف يبدو على الهاتف وعلى الكمبيوتر؟" } },
  { id: "launch", en: "Launch", ar: "التشغيل", q: { en: "Ready. Create it, try it, and share it with your team.", ar: "جاهز. أنشئه وجرّبه وشاركه مع فريقك." } },
];

const has = (t, re) => t.fields.some((f) => re.test(f.name));
const isNum = (f) => f.type === "number" || f.type === "money";
const tableLike = (sys, re) => sys.tables.find((t) => re.test(t.name));

/** Tappable answers for a step, from the design itself. */
export function suggestions(sys, step) {
  if (!sys || !sys.tables) return [];
  const out = [];
  if (step === "data") {
    const cust = tableLike(sys, /customer|client|عميل|عملاء|زبون/i);
    if (cust && !has(cust, /phone|mobile|هاتف|موبايل|تليفون/i)) out.push({ id: "phone", en: `Add a phone number to ${cust.name}`, ar: `أضف رقم الهاتف إلى ${cust.name}`, ops: [{ op: "addField", table: cust.id, name: "Phone", type: "phone" }] });
    if (cust && !has(cust, /e-?mail|بريد/i)) out.push({ id: "email", en: `Add an email to ${cust.name}`, ar: `أضف البريد الإلكتروني إلى ${cust.name}`, ops: [{ op: "addField", table: cust.id, name: "Email", type: "email" }] });
    const inv = tableLike(sys, /invoice|bill|فاتور/i);
    if (inv && !tableLike(sys, /payment|دفع|مدفوع|تحصيل/i)) out.push({ id: "payments", en: `Add a Payments table linked to ${inv.name}`, ar: `أضف جدول المدفوعات مرتبطًا بـ${inv.name}`,
      ops: [{ op: "addTable", table: "Payments", fields: [{ name: "Invoice", type: "link", link: inv.name }, { name: "Date", type: "date" }, { name: "Amount", type: "money" }, { name: "Method", type: "choice", options: ["Cash", "Bank transfer", "Cheque", "Card"] }] }] });
    const first = sys.tables[0];
    if (first && !has(first, /note|ملاحظ/i)) out.push({ id: "notes", en: `Add Notes to ${first.name}`, ar: `أضف ملاحظات إلى ${first.name}`, ops: [{ op: "addField", table: first.id, name: "Notes", type: "longtext" }] });
    for (const t of sys.tables) if (!t.fields.some((f) => f.type === "auto") && /invoice|order|job|rental|فاتور|طلب|أمر|تأجير/i.test(t.name)) {
      out.push({ id: "no-" + t.id, en: `Number each ${t.name} record automatically`, ar: `رقّم سجلات ${t.name} تلقائيًا`, ops: [{ op: "addField", table: t.id, name: "No.", type: "auto", prefix: t.name.slice(0, 3).toUpperCase() + "-" }] }); break;
    }
  }
  if (step === "logic") {
    for (const t of sys.tables) {
      // a total needs a quantity (days, hours, units…), not any number: "Capacity (t) × Daily rate" is not a total
      const nums = t.fields.filter((f) => f.type === "number" && /qty|quant|days?\b|hours?\b|units?|pieces?|count|nights?|months?|عدد|كمي|أيام|ايام|ساعات|قطع|شهور/i.test(f.name)), money = t.fields.filter((f) => f.type === "money");
      const hasTotal = t.fields.some((f) => f.type === "formula");
      if (!hasTotal && nums.length && money.length) {
        const q = nums[0], p = money[0];
        out.push({ id: "total-" + t.id, en: `${t.name}: Total = ${q.name} × ${p.name}`, ar: `${t.name}: الإجمالي = ${q.name} × ${p.name}`,
          ops: [{ op: "addField", table: t.id, name: "Total", type: "formula", formula: `[${q.name}] * [${p.name}]` }] });
      }
      if (/invoice|bill|فاتور/i.test(t.name) && !has(t, /vat|tax|ضريب/i)) {
        const base = t.fields.find((f) => f.type === "formula") || money[money.length - 1];
        if (base) out.push({ id: "vat-" + t.id, en: `${t.name}: add 14% VAT and a total with VAT`, ar: `${t.name}: أضف ضريبة القيمة المضافة 14% والإجمالي بعدها`,
          ops: [{ op: "addField", table: t.id, name: "VAT", type: "formula", formula: `[${base.name}] * 0.14` }, { op: "addField", table: t.id, name: "Total with VAT", type: "formula", formula: `[${base.name}] * 1.14` }] });
      }
    }
    for (const t of sys.tables) {
      const f = t.fields.find((x) => x.type === "text" && !x.required);
      if (f && t.fields.indexOf(f) === 0) { out.push({ id: "req-" + t.id, en: `${t.name}: ${f.name} must be filled in`, ar: `${t.name}: يجب ملء ${f.name}`, ops: [{ op: "setRequired", table: t.id, field: f.id, required: true }] }); if (out.length > 5) break; }
    }
  }
  if (step === "screens") {
    const u = SC.uiOf(sys);
    for (const c of ["blue", "green", "orange", "black"]) if (u.color !== c) out.push({ id: "c-" + c, en: `Make it ${c}`, ar: `اجعله ${SC.COLORS_AR[c]}`, ops: [{ op: "setColor", color: c }] });
    if (!u.home.includes("chart")) out.push({ id: "chart", en: "Show a chart on the home screen", ar: "اعرض رسمًا بيانيًا في الشاشة الرئيسية", ops: [{ op: "setHome", parts: [...u.home, "chart"] }] });
    if (!u.home.includes("alerts")) out.push({ id: "alerts", en: "Show alerts (missing information) on the home screen", ar: "اعرض التنبيهات (بيانات ناقصة) في الشاشة الرئيسية", ops: [{ op: "setHome", parts: ["alerts", ...u.home] }] });
    out.push({ id: "menu", en: u.menu === "left" ? "On a computer, put the menu on top" : "On a computer, put the menu on the left", ar: u.menu === "left" ? "على الكمبيوتر، ضع القائمة في الأعلى" : "على الكمبيوتر، ضع القائمة على اليسار", ops: [{ op: "setMenu", position: u.menu === "left" ? "top" : "left" }] });
  }
  return out.slice(0, 6);
}

/** Things worth fixing before launch (shown on the Launch step and as Home alerts). */
export function checks(sys) {
  const out = [];
  if (!sys.tables.length) out.push({ en: "The system has no tables", ar: "لا توجد جداول في النظام" });
  for (const t of sys.tables) if (t.fields.length < 2) out.push({ en: `${t.name} has only one field`, ar: `في ${t.name} حقل واحد فقط` });
  const linked = new Set(sys.tables.flatMap((t) => t.fields.filter((f) => f.type === "link").map((f) => f.link)));
  if (sys.tables.length > 2 && !linked.size) out.push({ en: "No table links to another — link related records (e.g. an invoice to its customer)", ar: "لا يرتبط أي جدول بآخر — اربط السجلات المتصلة (مثل الفاتورة بعميلها)" });
  return out;
}

/** Home "alerts": records missing a required field (first few per table). */
export function alerts(sys, limit = 5) {
  const out = [];
  for (const t of sys.tables) {
    const req = t.fields.filter((f) => f.required && f.type !== "formula" && f.type !== "auto");
    for (const r of (sys.rows[t.id] || [])) {
      const miss = req.filter((f) => r[f.id] == null || r[f.id] === "");
      if (miss.length) out.push({ table: t, row: r, missing: miss.map((f) => f.name) });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** A small bar chart's data: the biggest money (or number) total per choice of the first table that has both. */
export function chartData(sys) {
  for (const t of sys.tables) {
    const g = t.fields.find((f) => f.type === "choice" || f.type === "link"), v = t.fields.find((f) => f.type === "money") || t.fields.find(isNum);
    if (!g) continue;
    const rows = E.summary(sys, t.id, g.id, v ? v.id : null).slice(0, 6);
    if (rows.length) return { title: v ? `${v.name} by ${g.name} (${t.name})` : `${t.name} by ${g.name}`, rows: rows.map((r) => ({ label: String(r.group), value: v ? r.sum : r.count })) };
  }
  return null;
}
