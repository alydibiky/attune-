/* ---- v6.32 Business "Pro": the crane system's brains for every system the builder makes ----------------------------
   Ali: "i want the output of any job like a grocery store or an erp system for any company to be as good and as
   professional as this" (his crane + warehouse ERPs, see fleet.js). So every built system gets, from its own design:
   - Stock: on hand = opening + what comes in (Purchases…) − what goes out (Sales…); low-stock alerts; a sale that would
     take an item below zero is refused (like the warehouse app's "not enough stock").
   - Balances: each customer / supplier: charges (invoices, credit sales…) − payments, and a statement with a running
     balance (كشف حساب). A sale paid in cash doesn't touch the balance; only "on credit" does.
   - Due dates: overdue / soon (invoices, licences, maintenance…), unless the record is done or paid.
   - Bookings: the same asset (crane, room, car, table…) can't be booked twice for overlapping days.
   - Documents: any record prints as a professional document (number, date, party, its lines, totals, signatures).
   - Recycle bin: deleted records stay 7 days; restore any of them.
   - Demo data: realistic sample records for any design, tagged so they can be erased in one tap.
   - Excel: every table as a sheet.
   All found from names (English and Arabic) and types; the owner can switch each rule off (sys.pro.off).
   Pure; unit tested in tests/unit/v732pro.test.mjs.                                                                   */
import * as E from "./erp.js";

export const BIN_DAYS = 7, SOON_DAYS = 7;
const DAY = 86400000;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const has = (re, s) => re.test(String(s || ""));
const fieldBy = (t, re, types) => t.fields.find((f) => (!types || types.includes(f.type)) && re.test(f.name));
const rowsOf = (sys, tid) => (sys.rows[tid] || []).map((r) => E.computeRow(sys.tables.find((t) => t.id === tid), r));
const tOf = (sys, tid) => sys.tables.find((t) => t.id === tid);
const num = (v) => (typeof v === "number" && isFinite(v) ? v : v != null && v !== "" && !isNaN(Number(v)) ? Number(v) : null);

const RE = {
  stock: /\b(in stock|stock|on hand|opening|qty on hand|quantity in stock)\b|مخزون|رصيد|الكمية المتاحة|متوفر/i,
  reorder: /reorder|minimum|\bmin\b|low stock|حد الطلب|الحد الأدنى|حد أدنى/i,
  qty: /\b(qty|quantity|quant|units?|pieces?|pcs|count|kg|litres?)\b|عدد|كمي|كمية|قطع/i,
  out: /sale|sold|order|invoice|issue|out\b|outgoing|consum|usage|used|dispatch|deliver|بيع|مبيع|طلب|صرف|فاتور|منصرف|استهلاك|تسليم/i,
  in: /purchase|bought|receiv|incoming|supply|supplies|restock|stock in|goods in|شراء|مشتري|وارد|استلام|توريد/i,
  party: /customer|client|supplier|vendor|tenant|patient|student|member|account|عميل|عملاء|زبون|زبائن|مورد|موردين|مستأجر|مريض|طالب|عضو|حساب/i,
  supplier: /supplier|vendor|مورد/i,
  charge: /invoice|bill|sale|sold|order|job|rental|hire|booking|reservation|charge|contract|purchase|subscription|fee|visit|session|فاتور|بيع|مبيع|طلب|تأجير|إيجار|ايجار|حجز|عقد|شراء|مشتري|اشتراك|رسوم|زيار|جلس/i,
  pay: /payment|receipt|collection|settle|paid in|دفع|مدفوع|تحصيل|سداد|إيصال|ايصال|قبض/i,
  amount: /total|amount|grand|net|value|price|إجمالي|اجمالي|المبلغ|مبلغ|قيمة|صافي/i,
  paid: /^(paid|amount paid|paid amount|deposit|المدفوع|مدفوع|عربون)$/i,
  credit: /credit|on account|deferred|later|آجل|اجل|على الحساب/i,
  due: /due|expir|deadline|renew|valid until|next service|next due|استحقاق|انتهاء|موعد|تجديد|صلاحية/i,
  done: /^(done|paid|closed|complete|completed|cancel+ed|delivered|finished|returned|renewed|منته|مدفوع|مغلق|مكتمل|ملغ|تم|مسلم)/i,
  cancel: /cancel|void|ملغ|إلغاء/i,
  start: /\b(start|from|begin|check[- ]?in|pick[- ]?up|date out)\b|بداية|من تاريخ|البدء|استلام|دخول/i,
  end: /\b(end|to|until|finish|check[- ]?out|return|drop[- ]?off|date in)\b|نهاية|إلى تاريخ|الى تاريخ|انتهاء|تسليم|خروج/i,
};

/** What the Pro layer found in a design (before the owner's switches). */
export function detect(sys) {
  const out = { stock: [], parties: [], dues: [], bookings: [] };
  const tables = sys.tables || [];
  const linksTo = (tid) => tables.flatMap((t) => t.fields.filter((f) => f.type === "link" && f.link === tid).map((f) => ({ t, f })));
  // ---- stock
  for (const items of tables) {
    const opening = fieldBy(items, RE.stock, ["number"]); if (!opening) continue;
    const moves = [];
    for (const { t, f } of linksTo(items.id)) {
      const qty = fieldBy(t, RE.qty, ["number"]); if (!qty) continue;
      const sign = has(RE.in, t.name) ? 1 : has(RE.out, t.name) ? -1 : 0;
      if (sign) moves.push({ tid: t.id, link: f.id, qty: qty.id, sign });
    }
    const reorder = fieldBy(items, RE.reorder, ["number"]);
    out.stock.push({ items: items.id, opening: opening.id, reorder: reorder ? reorder.id : null, moves });
  }
  // ---- parties and their money
  const amountOf = (t) => {
    const cand = t.fields.filter((f) => (f.type === "money" || f.type === "formula") && RE.amount.test(f.name) && !RE.paid.test(f.name) && !/balance|رصيد|باقي|متبقي|vat|tax|ضريب|cost|تكلفة/i.test(f.name));
    return cand.find((f) => /total|إجمالي|اجمالي/i.test(f.name) && /vat|with|شامل/i.test(f.name)) || cand.find((f) => /total|grand|إجمالي|اجمالي/i.test(f.name)) || cand[0]
      || t.fields.find((f) => f.type === "money" && !RE.paid.test(f.name));
  };
  // charges and payments reach a party directly (Sales → Customer) or through one record (Invoices → Projects → Clients)
  const reach = (pid) => {
    const out = linksTo(pid).map(({ t, f }) => ({ t, link: f.id, via: null }));
    for (const { t: mid, f: mf } of linksTo(pid)) for (const { t, f } of linksTo(mid.id)) if (t.id !== pid && !out.some((o) => o.t.id === t.id)) out.push({ t, link: f.id, via: { tid: mid.id, link: mf.id } });
    return out;
  };
  for (const party of tables) {
    if (!RE.party.test(party.name)) continue;
    let charges = [], payments = [];
    for (const { t, link, via } of reach(party.id)) {
      if (t.id === party.id) continue;
      const amount = amountOf(t); if (!amount) continue;
      const date = t.fields.find((x) => x.type === "date");
      if (RE.pay.test(t.name)) { payments.push({ tid: t.id, link, via, amount: amount.id, date: date ? date.id : null }); continue; }
      if (!RE.charge.test(t.name)) continue;
      const paid = t.fields.find((x) => (x.type === "money" || x.type === "number") && RE.paid.test(x.name));
      const paidBool = t.fields.find((x) => x.type === "bool" && /^(paid|settled|مدفوع|تم الدفع|خالص)/i.test(x.name));
      const pm = t.fields.find((x) => x.type === "choice" && (x.options || []).some((o) => RE.credit.test(o)));
      charges.push({ tid: t.id, link, via, amount: amount.id, date: date ? date.id : null, paid: paid ? paid.id : null, paidBool: paidBool ? paidBool.id : null,
        creditField: pm ? pm.id : null, creditValues: pm ? pm.options.filter((o) => RE.credit.test(o)) : null });
    }
    // an invoice for a job: the invoice is the charge, not the job as well
    const billed = new Set(charges.flatMap((c) => tOf(sys, c.tid).fields.filter((f) => f.type === "link" && charges.some((d) => d.tid === f.link && d.tid !== c.tid)).map((f) => f.link)));
    charges = charges.filter((c) => !billed.has(c.tid));
    // a payment of a charge table we no longer count is still a payment of the party; keep payments as found
    if (charges.length || payments.length) out.parties.push({ tid: party.id, supplier: RE.supplier.test(party.name), charges, payments });
  }
  // ---- due dates
  for (const t of tables) for (const f of t.fields) if (f.type === "date" && RE.due.test(f.name)) {
    const status = t.fields.find((x) => x.type === "choice" && (x.options || []).some((o) => RE.done.test(o)));
    const doneBool = t.fields.find((x) => x.type === "bool" && /paid|done|closed|complete|renewed|مدفوع|تم|منته/i.test(x.name));
    const bal = t.fields.find((x) => x.type === "formula" && /balance|remaining|due amount|رصيد|باقي|متبقي/i.test(x.name));
    out.dues.push({ tid: t.id, fid: f.id, status: status ? status.id : null, doneBool: doneBool ? doneBool.id : null, balance: bal ? bal.id : null });
  }
  // ---- bookings: one asset, two dates
  const partyIds = new Set(out.parties.map((p) => p.tid));
  for (const t of tables) {
    const start = fieldBy(t, RE.start, ["date"]), end = t.fields.find((f) => f.type === "date" && f !== start && RE.end.test(f.name) && !RE.due.test(f.name));
    if (!start || !end) continue;
    const asset = t.fields.find((f) => f.type === "link" && !partyIds.has(f.link) && !RE.party.test((tOf(sys, f.link) || {}).name));
    if (!asset) continue;
    const status = t.fields.find((x) => x.type === "choice" && (x.options || []).some((o) => RE.cancel.test(o)));
    out.bookings.push({ tid: t.id, link: asset.id, start: start.id, end: end.id, status: status ? status.id : null });
  }
  return out;
}

/** The rules in force: what was found minus what the owner switched off. */
export function rules(sys) {
  const d = detect(sys), off = new Set(((sys.pro && sys.pro.off) || []));
  return { stock: off.has("stock") ? [] : d.stock, parties: off.has("balances") ? [] : d.parties, dues: off.has("dues") ? [] : d.dues, bookings: off.has("bookings") ? [] : d.bookings, off: [...off] };
}
export const RULES = ["stock", "balances", "dues", "bookings"];
export function setRule(sys, rule, on) {
  const off = new Set(((sys.pro && sys.pro.off) || []));
  if (on) off.delete(rule); else off.add(rule);
  return { ...sys, pro: { ...(sys.pro || {}), off: [...off] }, updated: Date.now() };
}
/** A short, plain list of what a system does for you (shown in Tools → Rules and on the Launch step). */
export function describeRules(sys) {
  const d = detect(sys), n = (x) => (tOf(sys, x) || {}).name || "?", out = [];
  for (const s of d.stock) out.push({ rule: "stock", en: `${n(s.items)}: stock on hand from ${s.moves.map((m) => n(m.tid) + (m.sign > 0 ? " (+)" : " (−)")).join(", ") || "the opening figure"}`, ar: `${n(s.items)}: المخزون المتاح من ${s.moves.map((m) => n(m.tid) + (m.sign > 0 ? " (+)" : " (−)")).join("، ") || "الرصيد الافتتاحي"}` });
  for (const p of d.parties) out.push({ rule: "balances", en: `${n(p.tid)}: a balance and a statement (charges: ${p.charges.map((c) => n(c.tid)).join(", ") || "—"}; payments: ${[...new Set(p.payments.map((c) => n(c.tid)))].join(", ") || "—"})`, ar: `${n(p.tid)}: رصيد وكشف حساب (المستحق: ${p.charges.map((c) => n(c.tid)).join("، ") || "—"}؛ المدفوعات: ${[...new Set(p.payments.map((c) => n(c.tid)))].join("، ") || "—"})` });
  for (const x of d.dues) { const t = tOf(sys, x.tid), f = t.fields.find((y) => y.id === x.fid); out.push({ rule: "dues", en: `${t.name}: a warning when ${f.name} is near or past`, ar: `${t.name}: تنبيه عند اقتراب ${f.name} أو فواته` }); }
  for (const b of d.bookings) { const t = tOf(sys, b.tid), a = t.fields.find((y) => y.id === b.link); out.push({ rule: "bookings", en: `${t.name}: the same ${a.name} can't be booked twice at the same time`, ar: `${t.name}: لا يُحجز ${a.name} نفسه مرتين في الوقت نفسه` }); }
  return out;
}

// ---- stock -------------------------------------------------------------------------------------------------------
/** On hand for every item of a stock rule: [{ row, name, opening, in, out, onHand, reorder, low }]. */
export function stockLevels(sys, s) {
  const items = tOf(sys, s.items); if (!items) return [];
  const moved = {};
  for (const m of s.moves) for (const r of sys.rows[m.tid] || []) {
    const id = r[m.link], q = num(r[m.qty]); if (!id || q == null) continue;
    const x = (moved[id] = moved[id] || { in: 0, out: 0 }); if (m.sign > 0) x.in += q; else x.out += q;
  }
  return (sys.rows[s.items] || []).map((row) => {
    const opening = num(row[s.opening]) || 0, mv = moved[row._id] || { in: 0, out: 0 };
    const onHand = r2(opening + mv.in - mv.out), reorder = s.reorder ? num(row[s.reorder]) : null;
    return { row, name: E.displayOf(items, row), opening, in: r2(mv.in), out: r2(mv.out), onHand, reorder, low: reorder != null ? onHand <= reorder : onHand <= 0, tracked: row[s.opening] != null || mv.in > 0 };
  });
}

// ---- balances ----------------------------------------------------------------------------------------------------
/** A party's statement: dated lines with a running balance, oldest first. → { lines, charged, paid, balance } */
export function statement(sys, p, partyId) {
  const lines = [];
  const mineOf = (x) => (x.via ? new Set((sys.rows[x.via.tid] || []).filter((r) => r[x.via.link] === partyId).map((r) => r._id)) : null);
  for (const c of p.charges) {
    const t = tOf(sys, c.tid), mine = mineOf(c);
    for (const r of rowsOf(sys, c.tid)) {
      if (mine ? !mine.has(r[c.link]) : r[c.link] !== partyId) continue;
      if (c.creditField && r[c.creditField] && !c.creditValues.includes(r[c.creditField])) continue;   // paid on the spot
      const a = num(r[c.amount]); if (a == null) continue;
      lines.push({ date: c.date ? r[c.date] || "" : "", what: t.name + " " + E.displayOf(t, r), tid: c.tid, rid: r._id, debit: r2(a), credit: 0 });
      const paid = c.paidBool && r[c.paidBool] ? a : c.paid ? num(r[c.paid]) : null;
      if (paid) lines.push({ date: c.date ? r[c.date] || "" : "", what: "Paid on " + E.displayOf(t, r), tid: c.tid, rid: r._id, debit: 0, credit: r2(paid) });
    }
  }
  for (const pay of p.payments) {
    const t = tOf(sys, pay.tid), mine = mineOf(pay);
    for (const r of rowsOf(sys, pay.tid)) {
      if (mine ? !mine.has(r[pay.link]) : r[pay.link] !== partyId) continue;
      const a = num(r[pay.amount]); if (a == null) continue;
      lines.push({ date: pay.date ? r[pay.date] || "" : "", what: t.name + " " + E.displayOf(t, r), tid: pay.tid, rid: r._id, debit: 0, credit: r2(a) });
    }
  }
  lines.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  let run = 0; for (const l of lines) { run = r2(run + l.debit - l.credit); l.balance = run; }
  const charged = r2(lines.reduce((s, l) => s + l.debit, 0)), paid = r2(lines.reduce((s, l) => s + l.credit, 0));
  return { lines, charged, paid, balance: r2(charged - paid) };
}
/** Every party's balance, biggest first. */
export function balances(sys, p) {
  const t = tOf(sys, p.tid); if (!t) return [];
  return (sys.rows[p.tid] || []).map((row) => { const s = statement(sys, p, row._id); return { row, name: E.displayOf(t, row), ...s }; })
    .sort((a, b) => b.balance - a.balance);
}

// ---- due dates ---------------------------------------------------------------------------------------------------
const dayIdx = (iso) => Math.floor(Date.parse(String(iso).slice(0, 10) + "T00:00:00Z") / DAY);
export function dueList(sys, today, days = SOON_DAYS) {
  const R = rules(sys), out = [], t0 = dayIdx(today);
  for (const x of R.dues) {
    const t = tOf(sys, x.tid), f = t.fields.find((y) => y.id === x.fid);
    for (const r of rowsOf(sys, x.tid)) {
      const v = r[x.fid]; if (!v) continue;
      if (x.status && r[x.status] && RE.done.test(r[x.status])) continue;
      if (x.doneBool && r[x.doneBool]) continue;
      if (x.balance && typeof r[x.balance] === "number" && r[x.balance] <= 0) continue;
      const left = dayIdx(v) - t0; if (isNaN(left) || left > days) continue;
      out.push({ tid: x.tid, rid: r._id, table: t.name, field: f.name, name: E.displayOf(t, r), date: v, left, overdue: left < 0 });
    }
  }
  return out.sort((a, b) => a.left - b.left);
}

// ---- checks before a record is saved ------------------------------------------------------------------------------
/** null, or { tpl, vars } saying why this change can't be saved (an overlap, or stock going below zero). */
export function checkChange(before, after) {
  const R = rules(after);
  for (const b of R.bookings) {
    const now = after.rows[b.tid] || [], was = new Map((before.rows[b.tid] || []).map((r) => [r._id, r]));
    const changed = now.filter((r) => was.get(r._id) !== r); if (!changed.length) continue;
    const t = tOf(after, b.tid), a = t.fields.find((f) => f.id === b.link);
    const live = (r) => r[b.link] && r[b.start] && !(b.status && RE.cancel.test(r[b.status] || ""));
    for (const r of changed) {
      if (!live(r)) continue;
      const s1 = r[b.start], e1 = r[b.end] || r[b.start];
      if (e1 < s1) return { tpl: "The end date is before the start date", vars: {} };
      const hit = now.find((o) => o._id !== r._id && live(o) && o[b.link] === r[b.link] && o[b.start] <= e1 && (o[b.end] || o[b.start]) >= s1);
      if (hit) return { tpl: "{asset} is already booked from {from} to {to} ({rec}).", vars: { asset: E.show(after, a, r[b.link]), from: hit[b.start], to: hit[b.end] || hit[b.start], rec: E.displayOf(t, hit) } };
    }
  }
  for (const s of R.stock) {
    const touched = s.moves.some((m) => (before.rows[m.tid] || []) !== (after.rows[m.tid] || [])) || (before.rows[s.items] || []) !== (after.rows[s.items] || []);
    if (!touched) continue;
    const old = new Map(stockLevels(before, s).map((x) => [x.row._id, x.onHand]));
    for (const x of stockLevels(after, s)) {
      if (x.onHand >= 0 || !x.tracked) continue;
      if (old.has(x.row._id) && old.get(x.row._id) <= x.onHand) continue;       // it was already short; this change didn't make it worse
      return { tpl: "Not enough {item} in stock: only {have} left.", vars: { item: x.name, have: Math.max(0, old.has(x.row._id) ? old.get(x.row._id) : 0) } };
    }
  }
  return null;
}

// ---- the Today view: numbers and warnings ------------------------------------------------------------------------
export function overview(sys, today) {
  const R = rules(sys);
  const low = R.stock.flatMap((s) => stockLevels(sys, s).filter((x) => x.low && x.tracked).map((x) => ({ ...x, tid: s.items })));
  const owed = R.parties.filter((p) => !p.supplier).flatMap((p) => balances(sys, p).filter((b) => b.balance > 0).map((b) => ({ ...b, tid: p.tid })));
  const weOwe = R.parties.filter((p) => p.supplier).flatMap((p) => balances(sys, p).filter((b) => b.balance > 0).map((b) => ({ ...b, tid: p.tid })));
  const due = dueList(sys, today);
  const month = String(today).slice(0, 7);
  let sales = 0;
  for (const p of R.parties.filter((x) => !x.supplier)) for (const c of p.charges) for (const r of rowsOf(sys, c.tid)) if (c.date && String(r[c.date] || "").startsWith(month)) sales += num(r[c.amount]) || 0;
  // (a charge table shared by two parties — rare — would be counted twice; the first party wins)
  return { low, owed, weOwe, due, receivable: r2(owed.reduce((s, b) => s + b.balance, 0)), payable: r2(weOwe.reduce((s, b) => s + b.balance, 0)), monthSales: r2(sales),
    has: { stock: R.stock.length > 0, balances: R.parties.length > 0, dues: R.dues.length > 0, bookings: R.bookings.length > 0 } };
}

// ---- recycle bin -------------------------------------------------------------------------------------------------
export function trash(sys, tid, rid, { now = Date.now() } = {}) {
  const row = (sys.rows[tid] || []).find((r) => r._id === rid); if (!row) return sys;
  return { ...sys, rows: { ...sys.rows, [tid]: sys.rows[tid].filter((r) => r._id !== rid) }, bin: [...(sys.bin || []), { tid, row, at: now }], updated: now };
}
export function restore(sys, rid, { now = Date.now() } = {}) {
  const b = (sys.bin || []).find((x) => x.row._id === rid); if (!b) return sys;
  if (!tOf(sys, b.tid)) throw new Error("Its table was deleted");
  return { ...sys, rows: { ...sys.rows, [b.tid]: [...(sys.rows[b.tid] || []), b.row] }, bin: sys.bin.filter((x) => x !== b), updated: now };
}
export function binList(sys, { now = Date.now() } = {}) {
  return (sys.bin || []).filter((b) => now - b.at < BIN_DAYS * DAY).map((b) => { const t = tOf(sys, b.tid); return { ...b, table: t ? t.name : "?", name: t ? E.displayOf(t, b.row) : "?", daysLeft: Math.max(0, Math.ceil((b.at + BIN_DAYS * DAY - now) / DAY)) }; }).reverse();
}
export function purge(sys, { now = Date.now() } = {}) {
  const keep = (sys.bin || []).filter((b) => now - b.at < BIN_DAYS * DAY);
  return keep.length === (sys.bin || []).length ? sys : { ...sys, bin: keep };
}

// ---- demo data: realistic sample records for any design ------------------------------------------------------------
const PEOPLE = ["Ahmed Hassan", "Mona Adel", "Karim Fathy", "Sara Mahmoud", "Omar Khaled", "Nour El-Din", "Hala Samir", "Youssef Ali"];
const PEOPLE_AR = ["أحمد حسن", "منى عادل", "كريم فتحي", "سارة محمود", "عمر خالد", "نور الدين", "هالة سمير", "يوسف علي"];
const COMPANIES = ["Delta Trading", "Nile Foods", "Cairo Build Co.", "Al Noor Stores", "Green Valley", "Sun Logistics"];
const COMPANIES_AR = ["دلتا للتجارة", "النيل للأغذية", "القاهرة للمقاولات", "محلات النور", "الوادي الأخضر", "الشمس للنقل"];
const ITEMS = ["Rice 1kg", "Sugar 1kg", "Cooking oil 1L", "Tea 250g", "Pasta 400g", "Milk 1L", "Cheese 500g", "Eggs (30)"];
const ITEMS_AR = ["أرز 1 كجم", "سكر 1 كجم", "زيت طعام 1 لتر", "شاي 250 جم", "مكرونة 400 جم", "لبن 1 لتر", "جبن 500 جم", "بيض (30)"];
const CITIES = ["Cairo", "Giza", "Alexandria", "Mansoura", "Tanta", "Suez"], CITIES_AR = ["القاهرة", "الجيزة", "الإسكندرية", "المنصورة", "طنطا", "السويس"];
const isoOf = (t0, d) => new Date((t0 + d) * DAY).toISOString().slice(0, 10);

/** Adds n sample records to every table (parents first, so links point at real records). Each is tagged _demo. */
export function loadDemo(sys0, { today = new Date().toISOString().slice(0, 10), n = 6, seed = 7 } = {}) {
  let sys = sys0, s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const ar = E.designLang(sys.name + " " + sys.tables.map((t) => t.name).join(" ")) === "Arabic";
  const t0 = dayIdx(today);
  // parents first: a table whose links all point at tables already filled
  const order = [], left = [...sys.tables];
  while (left.length) {
    const i = left.findIndex((t) => t.fields.every((f) => f.type !== "link" || f.link === t.id || order.some((o) => o.id === f.link) || !left.some((l) => l.id === f.link)));
    order.push(...left.splice(i < 0 ? 0 : i, 1));
  }
  const R = detect(sys0);
  const stockOpen = new Set(R.stock.map((x) => x.opening)), reorders = new Set(R.stock.map((x) => x.reorder));
  for (const t of order) {
    const isBooking = R.bookings.find((b) => b.tid === t.id);
    const isIn = R.stock.some((x) => x.moves.some((m) => m.tid === t.id && m.sign > 0));
    for (let i = 0; i < n; i++) {
      const v = {};
      const startOff = isBooking ? i * 4 - 10 : 0;
      for (const f of t.fields) {
        const nm = f.name;
        switch (f.type) {
          case "text": v[f.id] = i === 0 && t.fields.indexOf(f) > 2 ? "" :
            /name|customer|client|person|driver|staff|employee|patient|student|contact|اسم|عميل|موظف|مريض|طالب|سائق/i.test(nm) ? (ar ? PEOPLE_AR : PEOPLE)[(i + t.name.length) % 8]
            : /company|supplier|vendor|شركة|مورد/i.test(nm) ? (ar ? COMPANIES_AR : COMPANIES)[i % 6]
            : /product|item|ingredient|material|part|good|منتج|صنف|مادة|قطعة/i.test(nm) || /product|item|stock|ingredient|منتج|أصناف|مخزن/i.test(t.name) && t.fields.indexOf(f) <= 1 ? (ar ? ITEMS_AR : ITEMS)[i % 8]
            : /city|area|address|site|location|مدينة|منطقة|عنوان|موقع/i.test(nm) ? (ar ? CITIES_AR : CITIES)[(i * 3) % 6]
            : (t.fields.indexOf(f) <= 1 ? (ar ? t.name + " " : t.name.replace(/s$/i, "") + " ") + (i + 1) : ""); break;
          case "longtext": v[f.id] = i % 3 === 0 ? (ar ? "ملاحظة تجريبية" : "Sample note") : ""; break;
          case "phone": v[f.id] = "010" + String(10000000 + Math.floor(rnd() * 89999999)); break;
          case "email": v[f.id] = "demo" + (i + 1) + "@example.com"; break;
          case "number": v[f.id] = stockOpen.has(f.id) ? (i === 1 ? 4 : 20 + Math.floor(rnd() * 60)) : reorders.has(f.id) ? 15 : RE.qty.test(nm) ? (isIn ? 10 + Math.floor(rnd() * 20) : 1 + Math.floor(rnd() * 5)) : /year|سنة/i.test(nm) ? 2015 + Math.floor(rnd() * 10) : 1 + Math.floor(rnd() * 20); break;
          case "money": v[f.id] = RE.paid.test(nm) ? (i % 2 ? 0 : 500) : (Math.round(50 + rnd() * 950) * (/rate|daily|rent|إيجار/i.test(nm) ? 10 : 1)); break;
          case "date": { const isEnd = isBooking && f.id === isBooking.end, isStart = isBooking && f.id === isBooking.start;
            v[f.id] = isStart ? isoOf(t0, startOff) : isEnd ? isoOf(t0, startOff + 2) : RE.due.test(nm) ? isoOf(t0, i * 6 - 8) : isoOf(t0, -Math.floor(rnd() * 25)); break; }
          case "bool": v[f.id] = rnd() > 0.5; break;
          case "choice": { const o = (f.options || []).filter((x) => !RE.cancel.test(x)), cr = o.find((x) => RE.credit.test(x));
            v[f.id] = cr && i % 2 === 0 ? cr : o.length ? o[(i + Math.floor(rnd() * 2)) % o.length] : null; break; }   // some sales on credit, so balances show
          case "link": { const pool = sys.rows[f.link] || []; v[f.id] = pool.length ? pool[(i + Math.floor(rnd() * pool.length)) % pool.length]._id : null; break; }
          default: break;
        }
      }
      const was = sys;
      const res = E.addRow(sys, t.id, v);
      if (res.errors.length) continue;
      const candidate = { ...res.sys, rows: { ...res.sys.rows, [t.id]: res.sys.rows[t.id].map((r) => (r._id === res.row._id ? { ...r, _demo: 1 } : r)) } };
      if (checkChange(was, candidate)) continue;                       // a sample that would overlap or oversell is skipped
      sys = candidate;
    }
  }
  return sys;
}
export const hasDemo = (sys) => Object.values(sys.rows || {}).some((rs) => rs.some((r) => r._demo));
export function eraseDemo(sys) {
  return { ...sys, rows: Object.fromEntries(Object.entries(sys.rows).map(([k, rs]) => [k, rs.filter((r) => !r._demo)])), updated: Date.now() };
}

// ---- Excel: one sheet per table ----------------------------------------------------------------------------------
export function sheets(sys) {
  return sys.tables.map((t) => ({ name: t.name.slice(0, 31), rows: [t.fields.map((f) => f.name), ...rowsOf(sys, t.id).map((r) => t.fields.map((f) => (f.type === "link" || f.type === "bool" || f.type === "choice" ? E.show(sys, f, r[f.id]) : r[f.id] == null ? "" : r[f.id])))] }));
}

// ---- documents: any record as a professional page to print or save as PDF -------------------------------------------
const H = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const showDate = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d\d)-(\d\d)/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || ""); };
const val = (sys, f, v) => (f.type === "date" ? showDate(v) : f.type === "money" ? E.show(sys, f, v) : E.show(sys, f, v));
/** → an HTML page: header (company, document title and number, date), the party, the record's fields, its lines
    (records of other tables that point at it, with their totals) and signature lines. rtl for Arabic. */
export function recordDoc(sys, tid, rid, { company = "", rtl = false, words = {} } = {}) {
  const w = { date: "Date", total: "Total", sign: "Signature", received: "Received by", page: "", ...words };
  const t = tOf(sys, tid), row = t && rowsOf(sys, tid).find((r) => r._id === rid); if (!row) return "";
  const no = t.fields.find((f) => f.type === "auto"), date = t.fields.find((f) => f.type === "date");
  const partyF = t.fields.find((f) => f.type === "link" && RE.party.test((tOf(sys, f.link) || {}).name)) || t.fields.find((f) => f.type === "link");
  const partyT = partyF && tOf(sys, partyF.link), partyR = partyT && (sys.rows[partyT.id] || []).find((r) => r._id === row[partyF.id]);
  const shown = t.fields.filter((f) => f !== no && f !== date && f !== partyF && row[f.id] != null && row[f.id] !== "" && f.type !== "longtext");
  const notes = t.fields.filter((f) => f.type === "longtext" && row[f.id]);
  const title = t.name.replace(/ies$/i, "y").replace(/(?<!s)s$/i, "");
  const lines = sys.tables.filter((x) => x.id !== tid).flatMap((x) => x.fields.filter((f) => f.type === "link" && f.link === tid).map((f) => ({ x, f })))
    .map(({ x, f }) => ({ x, f, rows: rowsOf(sys, x.id).filter((r) => r[f.id] === rid) })).filter((l) => l.rows.length);
  const cur = sys.currency || "";
  const linesHTML = lines.map(({ x, f, rows }) => {
    const cols = x.fields.filter((c) => c !== f && c.type !== "longtext" && rows.some((r) => r[c.id] != null && r[c.id] !== "")).slice(0, 7);
    const tot = E.totals(x, rows);
    return `<h3>${H(x.name)}</h3><table class="lines"><thead><tr>${cols.map((c) => `<th>${H(c.name)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td${["number", "money", "formula"].includes(c.type) ? ' class="n"' : ""}>${H(val(sys, c, r[c.id]))}</td>`).join("")}</tr>`).join("")}</tbody>`
      + (cols.some((c) => (c.type === "money" || c.type === "formula") && tot[c.id] != null) ? `<tfoot><tr>${cols.map((c, i) => `<td class="n">${(c.type === "money" || c.type === "formula") && tot[c.id] != null ? H(E.show(sys, { type: "money" }, tot[c.id])) : i === 0 ? H(w.total) : ""}</td>`).join("")}</tr></tfoot>` : "") + `</table>`;
  }).join("");
  const big = t.fields.filter((f) => (f.type === "money" || f.type === "formula") && row[f.id] != null && /total|grand|إجمالي|اجمالي|balance|رصيد/i.test(f.name)).slice(-1)[0];
  const partyLines = partyR ? partyT.fields.filter((f) => ["text", "phone", "email"].includes(f.type) && partyR[f.id]).slice(0, 4).map((f) => H(partyR[f.id])).join("<br>") : "";
  return `<!doctype html><html dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${H(title)} ${H(no ? row[no.id] : "")}</title><style>
body{font-family:system-ui,"Segoe UI",Tahoma,sans-serif;color:#0F172A;margin:32px;font-size:13px}
.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0F172A;padding-bottom:14px}
.co{font-size:20px;font-weight:800}.doc{text-align:end}.doc b{font-size:22px;display:block;letter-spacing:.5px}
.meta{display:flex;justify-content:space-between;gap:20px;margin:18px 0}.box{border:1px solid #CBD5E1;border-radius:8px;padding:10px 12px;min-width:220px}
.box small{color:#64748B;display:block;margin-bottom:4px}
table{width:100%;border-collapse:collapse;margin:6px 0 14px}th,td{border:1px solid #CBD5E1;padding:6px 8px;text-align:start}th{background:#F1F5F9}
td.n{text-align:end;font-variant-numeric:tabular-nums}tfoot td{font-weight:700;background:#F8FAFC}
.fields td:first-child{width:38%;color:#475569}.grand{font-size:18px;font-weight:800;text-align:end;margin:10px 0}
h3{font-size:14px;margin:16px 0 4px}.sign{display:flex;justify-content:space-between;gap:40px;margin-top:56px}.sign div{flex:1;border-top:1px solid #0F172A;padding-top:6px;color:#475569}
.notes{white-space:pre-wrap;border:1px dashed #CBD5E1;padding:8px;border-radius:6px}@media print{body{margin:14mm}}
</style></head><body>
<div class="top"><div class="co">${H(company || sys.name)}</div><div class="doc"><b>${H(title)}</b>${no ? H(row[no.id]) : ""}</div></div>
<div class="meta">${partyR ? `<div class="box"><small>${H(partyF.name)}</small><b>${H(E.displayOf(partyT, partyR))}</b><br>${partyLines}</div>` : "<div></div>"}<div class="box"><small>${H(date ? date.name : w.date)}</small><b>${H(showDate(date ? row[date.id] : new Date().toISOString()))}</b></div></div>
<table class="fields"><tbody>${shown.map((f) => `<tr><td>${H(f.name)}</td><td${["number", "money", "formula"].includes(f.type) ? ' class="n"' : ""}>${H(val(sys, f, row[f.id]))}${f.type === "money" && cur ? " " + H(cur) : ""}</td></tr>`).join("")}</tbody></table>
${linesHTML}
${big ? `<div class="grand">${H(big.name)}: ${H(E.show(sys, { type: "money" }, row[big.id]))} ${H(cur)}</div>` : ""}
${notes.map((f) => `<h3>${H(f.name)}</h3><div class="notes">${H(row[f.id])}</div>`).join("")}
<div class="sign"><div>${H(w.sign)}</div><div>${H(w.received)}</div></div>
</body></html>`;
}
/** A party's statement as a printable page. */
export function statementDoc(sys, p, partyId, { company = "", rtl = false, words = {} } = {}) {
  const w = { title: "Statement of account", date: "Date", what: "Details", debit: "Debit", credit: "Credit", balance: "Balance", ...words };
  const t = tOf(sys, p.tid), row = (sys.rows[p.tid] || []).find((r) => r._id === partyId); if (!row) return "";
  const s = statement(sys, p, partyId), m = (n) => (n ? E.show(sys, { type: "money" }, n) : "");
  return `<!doctype html><html dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${H(w.title)}</title><style>body{font-family:system-ui,"Segoe UI",Tahoma,sans-serif;margin:32px;font-size:13px;color:#0F172A}
.top{display:flex;justify-content:space-between;border-bottom:3px solid #0F172A;padding-bottom:12px;margin-bottom:16px}.co{font-size:20px;font-weight:800}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #CBD5E1;padding:6px 8px;text-align:start}th{background:#F1F5F9}td.n{text-align:end;font-variant-numeric:tabular-nums}
tfoot td{font-weight:800;background:#F8FAFC}</style></head><body>
<div class="top"><div class="co">${H(company || sys.name)}</div><div style="text-align:end"><b style="font-size:18px">${H(w.title)}</b><br>${H(E.displayOf(t, row))}</div></div>
<table><thead><tr><th>${H(w.date)}</th><th>${H(w.what)}</th><th>${H(w.debit)}</th><th>${H(w.credit)}</th><th>${H(w.balance)}</th></tr></thead><tbody>
${s.lines.map((l) => `<tr><td>${H(showDate(l.date))}</td><td>${H(l.what)}</td><td class="n">${m(l.debit)}</td><td class="n">${m(l.credit)}</td><td class="n">${H(E.show(sys, { type: "money" }, l.balance))}</td></tr>`).join("")}
</tbody><tfoot><tr><td colspan="2">${H(sys.currency || "")}</td><td class="n">${m(s.charged)}</td><td class="n">${m(s.paid)}</td><td class="n">${H(E.show(sys, { type: "money" }, s.balance))}</td></tr></tfoot></table></body></html>`;
}
