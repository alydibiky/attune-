/* ---- v6.27 "Shop in your pocket" — a shop's daily work on top of Books (books-ops.js) ------------------------------------------------
   Ali: "help people start business by creating them a complex ERP system … the code should be smart and strong enough so the
   app doesn't make mistakes". So every sale goes through Books' own operations — a numbered invoice, its receipt, the stock
   moves at moving-average cost, the ledger — nothing is written around them. This file adds what a counter needs:
     - a shop set up from one sentence ("a bakery called Nour in Lagos, we sell bread, cakes and coffee, 3 staff"): the kind of
       shop, its starter items (no invented prices — the owner sets them), the country's usual tax rate to CONFIRM;
     - shelf prices that include tax, split so the receipt total is the shelf price to the cent (searched, not rounded);
     - a sale: cart → invoice → receipt (cash / card / wallet) or on credit; change for cash; recipes use up ingredients;
     - the day's close: sales by payment method, the cash that should be in the drawer vs counted, top items, low stock;
     - re-order messages for suppliers, from what is low.
   Pure (Books state in → state out). Tests: tests/unit/v727shop.test.mjs.                                                     */
import * as Ops from "./books-ops.js";
import * as B from "./books.js";

// ---- the usual standard VAT / GST rate by country (public; the owner CONFIRMS it — rates change) ----------------------------------------
export const VAT_STANDARD = { EG: 14, SA: 15, AE: 5, BH: 10, OM: 5, KW: 0, QA: 0, JO: 16, LB: 11, MA: 20, TN: 19, DZ: 19, TR: 20, GB: 20, IE: 23, FR: 20, DE: 19, ES: 21,
  IT: 22, PT: 23, NL: 21, BE: 21, AT: 20, CH: 8.1, SE: 25, NO: 25, DK: 25, FI: 25.5, PL: 23, CZ: 21, HU: 27, GR: 24, PK: 18, BD: 15, SG: 9, TH: 7, PH: 12, JP: 10,
  KR: 10, CN: 13, AU: 10, NZ: 15, ZA: 15, NG: 7.5, KE: 16, MX: 16, AR: 21, CL: 19, CO: 19, PE: 18 };
// shelf prices usually INCLUDE tax, except where they are shown before sales tax
const PRICES_EXCLUDE_TAX = new Set(["US", "CA"]);

// ---- kinds of shop: words that say it (many languages) and starter items (names and units only — the owner sets prices) -------------
// recipes are EXAMPLES the owner checks before they are used (recipe.confirmed); nothing is deducted from an unconfirmed recipe
export const SHOP_TYPES = [
  { id: "bakery", words: /bakery|bakehouse|patisserie|pâtisserie|boulangerie|panadería|panaderia|padaria|bäckerei|forno|fırın|toko roti|مخبز|فرن|حلواني|حلويات/i,
    items: [["Bread", "pcs", false], ["Croissant", "pcs", false], ["Cake slice", "pcs", false], ["Cookies (box)", "box", false], ["Flour", "kg", true], ["Sugar", "kg", true], ["Butter", "kg", true], ["Eggs", "pcs", true], ["Yeast", "kg", true]],
    recipes: { "Bread": [["Flour", 0.25], ["Yeast", 0.005]], "Croissant": [["Flour", 0.06], ["Butter", 0.03]], "Cake slice": [["Flour", 0.04], ["Sugar", 0.03], ["Eggs", 0.5], ["Butter", 0.02]] } },
  { id: "cafe", words: /caf[eé]|coffee shop|coffee|espresso bar|cafeter[ií]a|kahve|kedai kopi|kafe|قهوه|قهوة|كافيه|كوفي|مقهى/i,
    items: [["Espresso", "cup", false], ["Cappuccino", "cup", false], ["Latte", "cup", false], ["Tea", "cup", false], ["Croissant", "pcs", true], ["Water bottle", "pcs", true], ["Coffee beans", "kg", true], ["Milk", "l", true], ["Cups", "pcs", true]],
    recipes: { "Espresso": [["Coffee beans", 0.018], ["Cups", 1]], "Cappuccino": [["Coffee beans", 0.018], ["Milk", 0.15], ["Cups", 1]], "Latte": [["Coffee beans", 0.018], ["Milk", 0.25], ["Cups", 1]] } },
  { id: "restaurant", words: /restaurant|diner|eatery|takeaway|take-away|food truck|grill|pizzeria|burger|shawarma|koshary|restaurante|lokanta|restoran|rumah makan|warung|مطعم|مشويات|شاورما|كشري|فول وطعميه|فول وطعمية/i,
    items: [["Main dish", "plate", false], ["Sandwich", "pcs", false], ["Salad", "plate", false], ["Soft drink", "can", true], ["Water bottle", "pcs", true], ["Bread", "pcs", true]], recipes: {} },
  { id: "juice", words: /juice bar|juice|smoothie|عصير|عصاير|jugos|suco|saft/i,
    items: [["Orange juice", "cup", false], ["Mango juice", "cup", false], ["Lemon mint", "cup", false], ["Oranges", "kg", true], ["Mango", "kg", true], ["Sugar", "kg", true], ["Cups", "pcs", true]],
    recipes: { "Orange juice": [["Oranges", 0.6], ["Cups", 1]], "Mango juice": [["Mango", 0.35], ["Sugar", 0.02], ["Cups", 1]] } },
  { id: "grocery", words: /grocery|groceries|mini ?market|supermarket|convenience store|corner shop|kiosk|bodega|tienda|épicerie|epicerie|mercearia|kiosk|bakkal|market|warung|toko|سوبر ?ماركت|بقاله|بقالة|كشك|ماركت/i,
    items: [["Rice 1 kg", "pcs", true], ["Sugar 1 kg", "pcs", true], ["Cooking oil 1 l", "pcs", true], ["Milk 1 l", "pcs", true], ["Bread", "pcs", true], ["Eggs (tray)", "tray", true], ["Water 1.5 l", "pcs", true], ["Soft drink", "can", true], ["Tea (box)", "box", true]], recipes: {} },
  { id: "pharmacy", words: /pharmacy|chemist|drugstore|pharmacie|farmacia|farmácia|apotheke|eczane|apotek|صيدليه|صيدلية/i,
    items: [["Paracetamol 500 mg (pack)", "pack", true], ["Ibuprofen 400 mg (pack)", "pack", true], ["Vitamin C (pack)", "pack", true], ["Bandages", "box", true], ["Hand sanitiser", "pcs", true], ["Face masks (box)", "box", true]], recipes: {} },
  { id: "clothing", words: /clothing|clothes|boutique|fashion|apparel|shoes|vêtements|ropa|roupas|kleidung|abbigliamento|giyim|pakaian|ملابس|بوتيك|احذيه|أحذية|هدوم/i,
    items: [["T-shirt", "pcs", true], ["Shirt", "pcs", true], ["Trousers", "pcs", true], ["Dress", "pcs", true], ["Jacket", "pcs", true], ["Shoes", "pair", true]], recipes: {} },
  { id: "phones", words: /phone shop|mobile shop|phones|mobiles|electronics|accessories|gadgets|téléphones|celulares|móviles|handyladen|telefon|موبايلات|موبايل|اكسسوارات|إلكترونيات|الكترونيات/i,
    items: [["Phone case", "pcs", true], ["Screen protector", "pcs", true], ["Charger", "pcs", true], ["USB cable", "pcs", true], ["Earphones", "pcs", true], ["Power bank", "pcs", true], ["Repair service", "job", false]], recipes: {} },
  { id: "salon", words: /salon|barber|barbershop|hairdresser|beauty|nails|spa|coiffeur|peluquer[ií]a|barbearia|friseur|parrucchiere|kuaför|berber|salon|حلاق|كوافير|صالون|تجميل/i,
    items: [["Haircut", "service", false], ["Beard trim", "service", false], ["Hair colour", "service", false], ["Blow-dry", "service", false], ["Manicure", "service", false], ["Shampoo", "pcs", true]], recipes: {} },
  { id: "repair", words: /repair|workshop|garage|mechanic|service centre|service center|réparation|taller|oficina|werkstatt|officina|tamir|bengkel|ورشه|ورشة|صيانه|صيانة|ميكانيكي/i,
    items: [["Labour (hour)", "hour", false], ["Inspection", "job", false], ["Oil change", "job", false], ["Spare part", "pcs", true], ["Engine oil 1 l", "pcs", true]], recipes: {} },
  { id: "stationery", words: /stationery|bookshop|bookstore|library|papeterie|papelería|papelaria|schreibwaren|cartoleria|kırtasiye|alat tulis|مكتبه|مكتبة|ادوات مكتبيه|أدوات مكتبية/i,
    items: [["Notebook", "pcs", true], ["Pen", "pcs", true], ["Pencil", "pcs", true], ["Printing (page)", "page", false], ["Photocopy (page)", "page", false], ["School bag", "pcs", true]], recipes: {} },
  { id: "hardware", words: /hardware|tools|building materials|quincaillerie|ferretería|ferreteria|ferragens|baumarkt|ferramenta|hırdavat|toko bangunan|خردوات|عدد وادوات|مواد بناء|أدوات صحية/i,
    items: [["Screws (box)", "box", true], ["Paint 4 l", "pcs", true], ["Cement bag", "bag", true], ["Hammer", "pcs", true], ["Electrical cable (m)", "m", true], ["Light bulb", "pcs", true]], recipes: {} },
];
const GENERIC = { id: "shop", words: /./, items: [], recipes: {} };

// ---- set up from one sentence -----------------------------------------------------------------------------------------------------------
const cap = (s) => String(s || "").trim().replace(/^\p{Ll}/u, (c) => c.toUpperCase());
/** "A bakery called Nour in Lagos — we sell bread, cakes and coffee, 3 staff" → { type, name, items, staff, taxPct, taxInclusive, currency, notes }. */
export function setupFromSentence(text, { country = "", currency = "" } = {}) {
  const t = String(text || "").trim();
  const type = SHOP_TYPES.find((x) => x.words.test(t)) || GENERIC;
  const name = ((/(?:called|named|name is|اسمه|اسمها|إسمه|nommée?|llamad[oa]|chamad[oa]|namens|chiamat[oa]|adı)\s+["“«]?(.{2,40}?)(?=["”»]|\s+(?:in|at|on|near|with|and|في|ب|à|en|em|bei|a|di|de)\s|\s*[—–\-,.;:\n]|$)/iu.exec(t) || /["“«]([^"”»]{2,40})["”»]/.exec(t) || [])[1] || "").trim();
  const staffM = /(\d{1,3})\s*(?:staff|employees|workers|people working|cashiers|موظف|عامل|عمال|employés|empleados|funcionários|mitarbeiter|dipendenti|çalışan|karyawan)/i.exec(t);
  // "we sell bread, cakes and coffee" / "نبيع عيش وكيك وقهوة"
  const sellM = /(?:we sell|i sell|selling|sells|نبيع|ببيع|بنبيع|بيبيع|nous vendons|vendemos|wir verkaufen|vendiamo|satıyoruz|kami menjual)\s+([^.\n]{2,200})/i.exec(t);
  const mentioned = sellM ? sellM[1].split(/,|،| and | و| y | et | und | e | ve | dan |&/i).map((x) => cap(x.replace(/^(?:also|some|fresh)\s+/i, "").trim())).filter((x) => x && x.length <= 40 && !/^\d+$/.test(x)
    // not something to sell: a head count, staff, branches, a place ("2 staff", "3 employees", "in Lagos", "موظفين")
    && !/^\d+\s|(?<![\p{L}])(staff|employees?|workers?|people|persons|branch(?:es)?|cashiers?|in|at|near|موظف|موظفين|عامل|عمال|فرع|فروع|employés|empleados|funcionários|mitarbeiter|dipendenti|çalışan|karyawan)(?![\p{L}])/iu.test(x)) : [];
  const starter = type.items.map(([n, unit, track]) => ({ name: n, unit, track, price: 0 }));
  const items = [...starter];
  for (const m of mentioned) if (!items.some((x) => x.name.toLowerCase() === m.toLowerCase() || x.name.toLowerCase().startsWith(m.toLowerCase().replace(/s$/, "")))) items.unshift({ name: m, unit: "pcs", track: true, price: 0, mentioned: true });
  const rate = VAT_STANDARD[country];
  return { type: type.id, name: cap(name), items, staff: staffM ? +staffM[1] : 0, currency, country,
    taxPct: rate != null ? rate : null, taxInclusive: !PRICES_EXCLUDE_TAX.has(country), recipes: type.recipes || {},
    confirm: [rate != null ? `Tax: ${rate}% is the usual standard rate in ${country} — check it for your shop` : "Your sales tax / VAT rate"] };
}

/** The setup → Books: company, currency, tax, items (price 0 = not set yet), a walk-in customer. */
export function applySetup(books, setup, { at } = {}) {
  let s = books || Ops.EMPTY();
  s = Ops.setCompany(s, { name: setup.name || s.company.name || "My shop" }, { at });
  s = { ...s, currency: setup.currency || s.currency };
  if (setup.taxPct != null) {
    const bp = Math.round(Number(setup.taxPct) * 100);
    s = { ...s, tax: { ...s.tax, asOf: (at || new Date().toISOString()).slice(0, 10), vatCodes: { ...s.tax.vatCodes, S: { label: `Standard ${setup.taxPct}%`, bp } } } };
  }
  const have = new Set(s.items.map((i) => i.name.toLowerCase()));
  for (const it of setup.items || []) {
    if (have.has(it.name.toLowerCase())) continue;
    s = Ops.upsert(s, "items", { name: it.name, unit: it.unit || "pcs", track: it.track !== false, price: Math.max(0, Math.round(Number(it.price) || 0)), cost: 0, vat: Number(setup.taxPct) === 0 ? "Z" : "S", reorder: it.track !== false ? (it.reorder ?? null) : null }, { at }).state;
  }
  if (!s.customers.some((c) => c.walkIn)) s = Ops.upsert(s, "customers", { name: "Walk-in customer", walkIn: true, creditDays: 0 }, { at }).state;
  return s;
}

// ---- prices that include tax: the net price whose line total is the shelf price EXACTLY --------------------------------------------------
/** The ex-tax unit price (minor units) such that qty × net with its tax totals qty × shelf exactly; null if no such price exists. */
export function netForShelf(shelfMinor, qty, line, tax) {
  const want = Math.round(shelfMinor * qty);
  const code = ((tax && tax.vatCodes) || {})[line.vat || "S"] || { bp: 0 };
  const bp = code.exempt ? 0 : code.bp + 0;
  const guess = Math.round(shelfMinor * 10000 / (10000 + bp));
  for (let d = 0; d <= 6; d++) for (const net of [guess - d, guess + d]) {
    if (net < 0) continue;
    if (B.lineFigures({ ...line, qty, price: net }, tax).total === want) return net;
  }
  return null;
}
/** A cart → Books lines whose total IS the shelf total, to the cent. cart: [{ item, qty, price (shelf, minor) }].
 *  Prices with tax: each line's net is searched; when a whole-cent unit price can't hit the shelf total (qty > 1), the last unit
 *  is priced on its own line to close the gap, and a visible "Rounding" line (tax-exempt, 0.01–0.03) covers the rare rest.
 *  → { lines, total, target, rounding } */
export function cartLines(books, cart, { taxInclusive = true, discountBp = 0 } = {}) {
  const tax = books.tax, lines = [];
  let target = 0, rounding = 0;
  const totalOf = (ls) => B.docTotals({ lines: ls }, tax).total;
  for (const c of cart) {
    const it = books.items.find((x) => x.id === c.item); if (!it) continue;
    const qty = Number(c.qty); if (!(qty > 0)) continue;
    const base = { item: it.id, desc: it.name, vat: it.vat || "S", discBp: discountBp };
    const shelf = Math.round(Number(c.price ?? it.price) || 0);
    if (!taxInclusive) { lines.push({ ...base, qty, price: shelf }); target += totalOf([{ ...base, qty, price: shelf }]); continue; }
    const want = B.roundHalfAway(shelf * qty * (10000 - discountBp) / 10000);
    target += want;
    const one = netForShelfTotal(want, qty, base, tax);
    if (one != null) { lines.push({ ...base, qty, price: one }); continue; }
    // split: all but the last unit at the nearest price, the last unit priced to close the gap
    const whole = Number.isInteger(qty) && qty > 1;
    const bp = ((tax.vatCodes || {})[base.vat] || { bp: 0 }).bp || 0;
    let n1 = Math.round(shelf * 10000 / (10000 + bp));
    while (whole && n1 > 0 && totalOf([{ ...base, qty: qty - 1, price: n1 }]) > want) n1--;   // the head never passes the total
    const head = whole ? [{ ...base, qty: qty - 1, price: n1 }] : [];
    const rest = want - (head.length ? totalOf(head) : 0);
    let done = false;
    for (let k = 0; k <= 3 && !done; k++) {
      const n2 = netForShelfTotal(rest - k, whole ? 1 : qty, base, tax);
      if (n2 != null) { lines.push(...head, { ...base, qty: whole ? 1 : qty, price: n2 }); rounding += k; done = true; }
    }
    if (!done) { lines.push({ ...base, qty, price: n1 }); rounding += want - totalOf([{ ...base, qty, price: n1 }]); }
  }
  if (rounding > 0) lines.push({ desc: "Rounding", qty: 1, price: rounding, vat: "E" });
  const total = totalOf(lines);
  return { lines, total, target, rounding, exact: total === target };
}
/** The net unit price whose line total (qty, discount, tax) is exactly `want`; null if none. */
function netForShelfTotal(want, qty, base, tax) {
  const bp = ((tax.vatCodes || {})[base.vat] || { bp: 0 }).bp || 0, dsc = Number(base.discBp || 0);
  const guess = Math.round(want * 10000 * 10000 / ((10000 + bp) * (10000 - dsc) * qty));
  for (let d = 0; d <= 8; d++) for (const net of [guess - d, guess + d]) {
    if (net < 0) continue;
    if (B.lineFigures({ ...base, qty, price: net }, tax).total === want) return net;
  }
  return null;
}

// ---- a sale ----------------------------------------------------------------------------------------------------------------------------
/**
 * cart → a posted invoice (+ a receipt unless on credit) + recipe ingredients used. Throws Books' own errors (no customer, no price…).
 * o: { method: "cash"|"card"|"wallet"|"credit", customer (id; default the walk-in), today, given (cash handed over, minor), taxInclusive,
 *      discountBp, recipes: { itemId: { confirmed, parts: [{ item, qty }] } }, at }
 * → { state, number, total, change, warnings }
 */
export function sell(books, cart, o = {}) {
  const today = o.today || new Date().toISOString().slice(0, 10), at = o.at;
  if (!cart || !cart.length) throw new Ops.BooksError("The cart is empty");
  for (const c of cart) { const it = books.items.find((x) => x.id === c.item); if (!it) throw new Ops.BooksError("Unknown item"); if (!(Math.round(Number(c.price ?? it.price) || 0) > 0)) throw new Ops.BooksError(`Set a price for ${it.name} first`); }
  const method = o.method || "cash";
  const walk = books.customers.find((c) => c.walkIn);
  const customer = o.customer || (walk && walk.id);
  if (method === "credit" && (!o.customer || (walk && o.customer === walk.id))) throw new Ops.BooksError("A sale on credit needs the customer's name");
  const { lines, total, exact, rounding } = cartLines(books, cart, { taxInclusive: o.taxInclusive !== false, discountBp: o.discountBp || 0 });
  if (method === "cash" && o.given != null && o.given < total) throw new Ops.BooksError("The cash given is less than the total");
  let s = books;
  // v6.44: the cashier's name stays on the sale (Shop → Close → by cashier)
  const d = Ops.saveDraft(s, { type: "invoice", customer, date: today, lines, notes: "Counter sale", ...(o.cashier ? { cashier: String(o.cashier) } : {}) }, { at }); s = d.state;
  const p = Ops.post(s, d.id, { at, today }); s = p.state;
  const warnings = [...p.warnings]; if (!exact) warnings.push("The total differs from the shelf prices by a rounding of 0.01");
  if (method !== "credit") s = Ops.receive(s, { customer, date: today, method, amount: total, allocations: [{ doc: p.number, amount: total }] }, { at }).state;
  // recipes: the ingredients a sold item uses leave stock (only recipes the owner has confirmed)
  for (const c of cart) {
    const r = (o.recipes || {})[c.item]; if (!r || !r.confirmed) continue;
    for (const part of r.parts || []) {
      if (!s.items.find((x) => x.id === part.item) || !(part.qty > 0)) continue;
      s = Ops.adjustStock(s, { item: part.item, date: today, qty: -Math.round(part.qty * c.qty * 1000) / 1000, reason: `used in ${p.number}` }, { at });
    }
  }
  return { state: s, number: p.number, total, change: method === "cash" && o.given != null ? o.given - total : 0, warnings };
}

// ---- the end of the day -------------------------------------------------------------------------------------------------------------------
/** day: "YYYY-MM-DD"; counted: cash counted in the drawer (minor) or null. */
export function dayClose(books, day, counted = null, openingFloat = 0) {
  const inv = books.docs.filter((d) => d.type === "invoice" && d.status === "posted" && d.date === day);
  const pays = books.payments.filter((p) => p.date === day);
  const byMethod = { cash: 0, card: 0, wallet: 0, bank: 0, credit: 0 };
  for (const p of pays) byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
  const sales = inv.reduce((a, d) => a + B.docTotals(d, books.tax).total, 0);
  const paidToday = inv.reduce((a, d) => a + pays.filter((p) => (p.allocations || []).some((x) => x.doc === d.number)).reduce((x, p) => x + p.allocations.filter((y) => y.doc === d.number).reduce((z, y) => z + y.amount, 0), 0), 0);
  byMethod.credit = Math.max(0, sales - paidToday);
  const cashExpenses = books.expenses.filter((e) => e.date === day && e.method === "cash").reduce((a, e) => a + e.amount, 0);
  const expectedCash = openingFloat + byMethod.cash - cashExpenses;
  const top = B.salesBy(inv, "item", day, day, books.tax).slice(0, 5).map((x) => ({ name: (books.items.find((i) => i.id === x.name) || { name: x.name }).name, net: x.net }));
  return { day, count: inv.length, sales, byMethod, cashExpenses, expectedCash, counted, difference: counted == null ? null : counted - expectedCash, top, low: B.lowStock(books.items.filter((i) => i.track !== false), Ops.levels(books)) };
}

/** What to order from a supplier: every low item, enough to reach twice its re-order level. → text for WhatsApp / SMS / email. */
export function reorderMessage(books, { supplier = "", shop = "", lang = "en" } = {}) {
  const low = B.lowStock(books.items.filter((i) => i.track !== false), Ops.levels(books));
  if (!low.length) return "";
  const lines = low.map((l) => { const it = books.items.find((i) => i.id === l.id) || {}; const want = Math.max(l.reorder || 1, (l.reorder || 1) * 2 - Math.max(0, l.onHand)); return `• ${l.name}: ${Math.ceil(want)} ${it.unit || ""}`.trim(); });
  return lang === "ar"
    ? `مرحبًا${supplier ? " " + supplier : ""}، نرجو إرسال:\n${lines.join("\n")}\nشكرًا${shop ? " — " + shop : ""}`
    : `Hello${supplier ? " " + supplier : ""}, please send:\n${lines.join("\n")}\nThank you${shop ? " — " + shop : ""}`;
}

// ---- the shop's own store (what Books doesn't keep): setup choices, recipes, barcodes, shifts, day closes ----------------------------------
export const SHOP_KEY = "attune:shop:v1";
export const loadShop = (store = typeof localStorage !== "undefined" ? localStorage : null) => { try { const j = JSON.parse((store && store.getItem(SHOP_KEY)) || "null"); return j && j.v ? j : null; } catch (e) { return null; } };
export const saveShop = (x, store = typeof localStorage !== "undefined" ? localStorage : null) => { try { store && store.setItem(SHOP_KEY, JSON.stringify(x)); } catch (e) {} return x; };
/** Recipes from the setup's example names → item ids (unconfirmed until the owner checks them). */
export function recipesFor(books, setup) {
  const out = {};
  for (const [prod, parts] of Object.entries(setup.recipes || {})) {
    const p = books.items.find((i) => i.name === prod); if (!p) continue;
    const ps = parts.map(([n, q]) => ({ item: (books.items.find((i) => i.name === n) || {}).id, qty: q })).filter((x) => x.item);
    if (ps.length) out[p.id] = { confirmed: false, parts: ps };
  }
  return out;
}
export const clockIn = (shop, who, now = Date.now()) => ({ ...shop, shifts: [...(shop.shifts || []), { who, in: now, out: null }] });
export const clockOut = (shop, who, now = Date.now()) => ({ ...shop, shifts: (shop.shifts || []).map((x) => (x.who === who && !x.out ? { ...x, out: now } : x)) });
export const hoursOn = (shop, day) => { const out = {}; for (const x of shop.shifts || []) { if (new Date(x.in).toISOString().slice(0, 10) !== day) continue; out[x.who] = (out[x.who] || 0) + ((x.out || Date.now()) - x.in) / 3600000; } return out; };
