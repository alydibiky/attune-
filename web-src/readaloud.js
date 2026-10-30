/* ---- v6.27 "Read it to me" — for anyone who finds reading hard (about 750 million adults can't read well; 1 in 4 in Egypt), or
   whose eyes are tired, or who is holding a paper in a language they don't read. The phone reads the paper aloud, says what it
   is and what to do — and does it (a due date → Deadline Radar, a medicine → Family health, a bill → Money).
   Everything here is CODE: the kind of paper, the amount, the dates, the dose. A loaded model may add a plain explanation,
   always labelled and never replacing what the paper says. Tests: tests/unit/v727read.test.mjs.                              */
import { tr } from "./i18n.js";
import { readDeadlines, datesIn, isoDay } from "./deadlines.js";
import { readPrescription, readRxLine } from "./care.js";
import { payAmount, payCurrency } from "./yusr/paytext.js";

const W = (s) => new RegExp("(?<![\\p{L}])(?:" + s + ")(?![\\p{L}])", "iu");
export const KINDS = {
  prescription: W("rx|prescription|ordonnance|receta|rezept|روشت[ةه]|وصف[ةه] طبي[ةه]|الدكتور|دكتور|عياد[ةه]"),
  medicine: W("tablets?|capsules?|syrup|mg|dosage|dose|take \\d|keep out of (?:the )?reach of children|side effects|comprimés?|posologie|tabletas?|dosis|tabletten|أقراص|قرص|كبسول|شراب|الجرع[ةه]|يحفظ بعيدا عن متناول الأطفال|الآثار الجانبي[ةه]"),
  bill: W("bill|invoice|amount due|total due|balance due|pay by|due date|account number|meter|kwh|facture|montant dû|factura|importe|rechnung|fattura|fatura|tagihan|فاتور[ةه]|المبلغ المستحق|تاريخ الاستحقاق|آخر موعد للسداد|رقم الحساب|عداد|كيلووات"),
  receipt: W("receipt|subtotal|vat|change due|cashier|ticket de caisse|recibo|quittung|scontrino|fiş|struk|إيصال|ايصال|الإجمالي|ضريب[ةه] القيم[ةه] المضاف[ةه]"),
  school: W("school|teacher|homework|parents?|pupil|student|class \\d|exam|école|parents d'élèves|escuela|schule|scuola|okul|sekolah|مدرس[ةه]|المدرس[ةه]|ولي الأمر|أولياء الأمور|الطالب|التلميذ|امتحان|واجب"),
  official: W("ministry|government|court|tax office|embassy|passport office|municipality|police|summons|fine|penalty|ministère|tribunal|amende|ministerio|multa|ministerium|bußgeld|bakanlık|وزار[ةه]|محكم[ةه]|مصلح[ةه]|الضرائب|سفار[ةه]|بلدي[ةه]|حي|شرط[ةه]|غرام[ةه]|مخالف[ةه]|استدعاء"),
  letter: W("dear|sincerely|regards|yours faithfully|madame|monsieur|estimado|sehr geehrte|gentile|sayın|السيد|السيدة|تحي[ةه] طيب[ةه]|وبعد|مع التحي[ةه]|المحترم"),
  sign: /^[^\n]{1,40}(\n[^\n]{1,40}){0,3}$/,
};
const ORDER = ["prescription", "medicine", "bill", "receipt", "school", "official", "letter"];
const DUE = /(?:due(?: date)?|pay(?:ment)? (?:by|before|due)|payable by|before|by|à payer avant|date limite|vencimiento|pagar antes|fällig|zahlbar bis|scadenza|son ödeme|jatuh tempo|تاريخ الاستحقاق|آخر موعد(?: للسداد)?|يستحق(?: في)?|قبل|حتى)\W{0,15}$/i;

/** What kind of paper this is (the first that fits, in order of how much a mistake would cost). */
export function kindOf(text) {
  const t = String(text || "");
  for (const k of ORDER) if (KINDS[k].test(t)) {
    if (k === "prescription" && !readPrescription(t).length) continue;   // a doctor's letterhead alone is not a prescription
    return k;
  }
  return KINDS.sign.test(t.trim()) ? "sign" : "other";
}

/** The facts code can read: the amount, the due date, other dates, medicines and their doses. */
export function factsOf(text, { now = Date.now(), home = "", order = "dmy" } = {}) {
  const raw = String(text || ""), kind = kindOf(raw);
  const dates = datesIn(raw, { now, order });
  const f = { kind, amount: 0, currency: "", due: "", dates: dates.map((d) => isoDay(d.t)), meds: [], deadlines: [] };
  if (kind === "bill" || kind === "receipt" || kind === "official") {
    let masked = raw; for (const d of dates) masked = masked.slice(0, d.at) + " ".repeat(d.len) + masked.slice(d.at + d.len);
    // the amount next to "total / amount due / المبلغ" first, else the largest amount on the paper
    const lines = masked.split(/\n/);
    const totalLine = lines.find((l) => /(total|amount due|balance|to pay|montant|importe|betrag|totale|toplam|jumlah|الإجمالي|المبلغ|المطلوب|الإجمالى)/i.test(l) && payAmount(l, home));
    const a = totalLine ? payAmount(totalLine, home) : null;
    const all = lines.map((l) => payAmount(l, home)).filter(Boolean).sort((x, y) => y.value - x.value);
    const pick = a || all[0];
    if (pick) { f.amount = pick.value; f.currency = payCurrency(raw, home) || home || ""; }
    // the due date: the date right after "due / pay by / آخر موعد"
    for (const d of dates) { if (DUE.test(raw.slice(Math.max(0, d.at - 40), d.at))) { f.due = isoDay(d.t); break; } }
  }
  if (kind === "prescription") f.meds = readPrescription(raw);
  if (kind === "medicine") {
    const line = raw.split(/\n/).find((l) => /(take|adults?|children|يؤخذ|تناول|للبالغين|للأطفال|prendre|tomar|einnehmen)/i.test(l) && /\d/.test(l));
    const name = raw.split(/\n/).map((l) => l.trim()).find((l) => /\p{L}{3,}/u.test(l) && l.length < 40) || "";
    const r = line ? readRxLine(name + " " + line) : null;
    f.meds = r ? [r] : name ? [{ name, missing: ["How much each time?", "How often?"] }] : [];
  }
  f.deadlines = readDeadlines(raw, { now, home, order });
  return f;
}

/** What to say first and what can be done, by code. lang: "en" | "ar". */
export function explain(f, lang = "en") {
  const ar = lang === "ar", n = (x) => Number(x).toLocaleString("en", Number.isInteger(Number(x)) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 }), money = f.amount ? `${n(f.amount)} ${f.currency}`.trim() : "";
  const day = (iso) => { try { return new Date(iso + "T12:00:00").toLocaleDateString(ar ? "ar-EG-u-nu-latn" : "en-GB", { weekday: "long", day: "numeric", month: "long" }); } catch (e) { return iso; } };
  const WHAT = { prescription: ["A prescription from a doctor.", "هذه وصفة طبية من طبيب."], medicine: ["A medicine's box or leaflet.", "هذه علبة دواء أو نشرته."],
    bill: ["A bill to pay.", "هذه فاتورة للدفع."], receipt: ["A receipt for something you bought.", "هذا إيصال لشيء اشتريته."], school: ["A note from the school.", "هذه رسالة من المدرسة."],
    official: ["An official paper (government, court, tax or police).", "هذه ورقة رسمية (حكومة أو محكمة أو ضرائب أو شرطة)."], letter: ["A letter.", "هذه رسالة."], sign: ["A sign or a notice.", "هذه لافتة أو إعلان."], other: ["A paper with writing on it.", "ورقة مكتوب عليها."] };
  const say = [WHAT[f.kind][ar ? 1 : 0]], todo = [], actions = [];
  if (money) say.push(ar ? `المبلغ: ${money}.` : `The amount: ${money}.`);
  if (f.due) { say.push(ar ? `آخر موعد للدفع: ${day(f.due)}.` : `Pay by ${day(f.due)}.`); actions.push({ type: "radar", item: { kind: "other", title: (ar ? "دفع " : tr("Pay ")) + (money || (ar ? "فاتورة" : tr("the bill"))), date: f.due, amount: f.amount, currency: f.currency } }); }
  if ((f.kind === "bill" || f.kind === "receipt") && money) actions.push({ type: "money" });
  for (const m of f.meds) {
    const parts = [m.name, m.strength, m.dose, m.freq].filter(Boolean).join(" · ");
    say.push(ar ? `دواء: ${parts}.` : `Medicine: ${parts}.`);
    if ((m.missing || []).length) todo.push(ar ? `لم تُقرأ الجرعة بوضوح — اسأل الصيدلي عن ${m.name}.` : `The dose isn't clear — ask the pharmacist about ${m.name}.`);
  }
  if (f.meds.length) actions.push({ type: "care" });
  for (const d of f.deadlines) {
    if (d.kind === "expiry") { say.push(ar ? `ينتهي في ${day(d.date)}.` : `It expires on ${day(d.date)}.`); actions.push({ type: "radar", item: d }); }
    if (d.kind === "return" || d.kind === "warranty") actions.push({ type: "radar", item: d });
  }
  if (f.kind === "official") todo.push(ar ? "ورقة رسمية: إن كان فيها موعد أو غرامة، لا تتجاهلها — اعرضها على شخص تثق به أو على الجهة نفسها." : tr("An official paper: if it has a date or a fine, don't ignore it — show it to someone you trust or to the office itself."));
  if (f.kind === "school" && f.dates.length) { say.push(ar ? `فيها تاريخ: ${day(f.dates[0])}.` : `It mentions a date: ${day(f.dates[0])}.`); actions.push({ type: "radar", item: { kind: "other", title: ar ? "المدرسة" : tr("School"), date: f.dates[0] } }); }
  // one Radar action per date
  const seen = new Set(); const acts = actions.filter((a) => (a.type !== "radar" ? true : !seen.has(a.item.date) && seen.add(a.item.date)));
  return { say, todo, actions: acts };
}

/** The paper read aloud sentence by sentence (short pieces so the voice can be followed and paused). */
export function sentences(text) {
  return String(text || "").replace(/[ \t]+/g, " ").split(/\n+|(?<=[.!?؟。])\s+/).map((s) => s.trim()).filter((s) => /[\p{L}\p{N}]/u.test(s));
}
/** The paper's language, by its letters (for the voice). */
export function langOf(text) {
  const t = String(text || ""), count = (re) => (t.match(re) || []).length;
  const scripts = [["ar", /[؀-ۿ]/g], ["he", /[֐-׿]/g], ["ru", /[Ѐ-ӿ]/g], ["el", /[Ͱ-Ͽ]/g], ["hi", /[ऀ-ॿ]/g], ["th", /[฀-๿]/g], ["zh", /[一-鿿]/g], ["ja", /[぀-ヿ]/g], ["ko", /[가-힯]/g]];
  let best = ["", 0]; for (const [k, re] of scripts) { const c = count(re); if (c > best[1]) best = [k, c]; }
  if (best[1] > 3) return best[0];
  const w = t.toLowerCase();
  const LAT = [["fr", /\b(le|la|les|des|est|vous|et|pour|avec)\b/g], ["es", /\b(el|los|las|es|usted|para|con|por|una)\b/g], ["de", /\b(der|die|das|und|ist|sie|mit|für|nicht)\b/g], ["it", /\b(il|gli|della|sono|per|con|che|non)\b/g], ["tr", /\b(ve|bir|bu|için|ile|değil)\b/g], ["en", /\b(the|and|is|you|for|with|this|to|of)\b/g]];
  let b2 = ["en", 0]; for (const [k, re] of LAT) { const c = (w.match(re) || []).length; if (c > b2[1]) b2 = [k, c]; }
  return b2[0];
}
/** A model's plain explanation (optional, labelled in the UI): the paper only, short, nothing invented. */
export function explainPrompt(text, lang) {
  return [{ role: "system", content: `You explain papers to someone who cannot read well. Answer in ${lang === "ar" ? "simple Arabic" : "simple " + lang}. Use only what the paper says — never add facts, numbers or dates. 3 short sentences: what it is, what it asks, what to do and by when. If something is unclear, say "ask someone you trust to check".` }, { role: "user", content: String(text).slice(0, 4000) }];
}
