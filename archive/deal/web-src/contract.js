import { tr } from "./i18n.js";
/* ---- v6.32: Contract "second opinion" (roadmap: "paste a contract or offer → code flags risky terms", grows out of Deal Check) ----
   Code reads the contract — no model, so it works on any phone, offline, in a second. For each risky term it shows the exact
   sentence, what it means in plain words, and what to ask for instead. It also says what a contract of that kind usually has
   and this one is missing (a rent with no end date, a job with no salary…). English and Arabic (formal and Egyptian).
   It is a first look, not legal advice — it says so. Pure; tests: tests/unit/v736contract.test.mjs.                              */

const AR_D = "٠١٢٣٤٥٦٧٨٩";
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => AR_D.indexOf(d)).replace(/٫/g, ".").replace(/٬/g, ",").replace(/٪/g, "%");
const fold = (s) => latin(s).replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$|[،,.!?؟:؛])/g, "ه").replace(/[ًٌٍَُِّْـ]/g, "");

/** Does this text look like a contract (not a seller's offer)? */
export function looksLikeContract(text) {
  const t = fold(text).toLowerCase();
  const hits = (t.match(/\b(agreement|contract|party|parties|hereby|shall|clause|terms and conditions|tenant|landlord|lessee|lessor|employer|employee|termination|liability|governing law|witnesseth|whereas)\b|عقد|الطرف الاول|الطرف الثاني|الطرفين|بند|البند|يلتزم|المستاجر|المؤجر|صاحب العمل|العامل|الموظف|فسخ|يقر|تحرر|شروط/g) || []).length;
  return hits >= 3 || (hits >= 2 && t.length > 400);
}

/** What kind of contract it is (decides what it should contain). */
export function kindOf(text) {
  const t = fold(text).toLowerCase();
  if (/\b(lease|rent|tenant|landlord|lessee|lessor)\b|ايجار|المستاجر|المؤجر|العين المؤجره|الشقه/.test(t)) return "rent";
  if (/\b(employ(?:ee|er|ment)|salary|probation|job title|working hours)\b|صاحب العمل|العامل|الموظف|الراتب|المرتب|فتره الاختبار|عقد عمل/.test(t)) return "job";
  if (/\b(loan|borrower|lender|repay|interest rate)\b|قرض|المقترض|المقرض|سلفه/.test(t)) return "loan";
  if (/\b(sale|purchase|buyer|seller|unit|apartment|installments?)\b|بيع|البائع|المشتري|الوحده|اقساط|تقسيط/.test(t)) return "sale";
  if (/\b(services?|contractor|client|freelanc\w*|deliverables?|scope of work)\b|خدمات|المقاول|العميل|اعمال/.test(t)) return "service";
  return "other";
}

// [id, level, English pattern, Arabic pattern (on folded text), what it means, what to ask for] — level: 3 serious · 2 check · 1 note
const RULES = [
  ["blank-cheque", 3, /\b(security cheques?|guarantee cheques?|post-?dated cheques? as (?:a )?guarantee|promissory note|trust receipt|sign(?:ed)? (?:a )?blank)\b/i, /شيكات? ضمان|شيك ضمان|ايصال امانه|ايصالات امانه|كمبيالات? ضمان|توقيع علي بياض|علي بياض/,
    { en: "Cheques or a trust receipt (إيصال أمانة) as a guarantee: if anything goes wrong they can be used against you in a criminal case, not only a civil one.", ar: "شيكات أو إيصال أمانة كضمان: عند أي خلاف يمكن استخدامها ضدك في قضية جنائية، لا مدنية فقط." },
    { en: "Ask for a normal deposit or a bank guarantee instead, and never sign anything blank.", ar: "اطلب تأمينًا عاديًا أو خطاب ضمان بدلًا منها، ولا توقّع على أي ورقة فارغة." }],
  ["auto-renew", 2, /\b(automatically renew\w*|auto-?renew\w*|renews? automatically|shall be renewed (?:automatically|for (?:a|an) (?:similar|equal|further)))\b/i, /يت?جدد(?: العقد)? تلقائيا|تجديد تلقائي|يت?جدد(?: العقد)? لمده مماثله/,
    { en: "It renews by itself — you keep paying unless you cancel in time.", ar: "يتجدد وحده — وتستمر في الدفع ما لم تُلغِ في الوقت المحدد." },
    { en: "Ask for renewal only by written agreement, or put the cancel-by date in your Deadline Radar.", ar: "اطلب أن يكون التجديد باتفاق مكتوب فقط، أو ضع موعد الإلغاء في «رادار المواعيد»." }],
  ["one-sided-end", 3, /\b(may terminate (?:this (?:agreement|contract) )?at any time|terminate (?:this (?:agreement|contract) )?(?:at its|at their|in its) (?:sole )?discretion|without (?:prior )?notice)\b/i, /للطرف الاول (?:الحق في )?فسخ|يحق للطرف الاول (?:انهاء|فسخ)|دون اخطار|بدون اخطار|دون انذار|بدون انذار|في اي وقت دون/,
    { en: "Only one side can end it, or it can be ended without notice.", ar: "طرف واحد فقط يستطيع إنهاءه، أو يمكن إنهاؤه دون إخطار." },
    { en: "Ask that both sides can end it, with the same written notice (e.g. 30 days).", ar: "اطلب أن يحق للطرفين الإنهاء بنفس مدة الإخطار المكتوب (مثل 30 يومًا)." }],
  ["unilateral-change", 3, /\b(may (?:change|amend|modify|vary) (?:these terms|this agreement|the (?:price|fees|rent))|reserves the right to (?:change|amend|modify)|at any time without (?:your )?consent)\b/i, /يحق ل(?:ل)?(?:طرف الاول|لشركه|شركه) تعديل|يحق للمؤجر زياده|يحق له تعديل|تعديل الاسعار في اي وقت|دون الرجوع الي الطرف الثاني/,
    { en: "The other side can change the terms or the price on its own.", ar: "الطرف الآخر يستطيع تغيير الشروط أو السعر وحده." },
    { en: "Ask that changes need both signatures, and that you can leave without a penalty if you don't accept them.", ar: "اطلب أن يكون أي تعديل بتوقيع الطرفين، وأن تستطيع الخروج دون غرامة إن لم توافق." }],
  ["penalty", 2, /\b(penalt(?:y|ies)|liquidated damages|forfeit\w*)\b/i, /غرامه|شرط جزائي|الشرط الجزائي|يلتزم بدفع مبلغ .{0,30}تعويض|يسقط حقه/,
    { en: "A penalty or forfeit clause — check the amount and that it applies to both sides.", ar: "بند غرامة أو شرط جزائي — راجع المبلغ وأنه يسري على الطرفين." },
    { en: "Ask for a cap (e.g. one month's value) and the same penalty for the other side.", ar: "اطلب حدًا أقصى (مثل قيمة شهر) ونفس الغرامة على الطرف الآخر." }],
  ["non-refundable", 2, /\b(non-?refundable|not (?:be )?refundable|no refunds?)\b/i, /لا يرد|لا ترد|غير قابل للاسترداد|غير مسترد|لا يسترد/,
    { en: "Money you pay here does not come back, even if the deal falls through.", ar: "المبلغ الذي تدفعه هنا لا يُرد، حتى لو لم تكتمل الصفقة." },
    { en: "Ask that it is refunded if the other side cancels or doesn't deliver.", ar: "اطلب رده إذا ألغى الطرف الآخر أو لم يسلّم." }],
  ["unlimited-liability", 3, /\b(unlimited liability|(?:indemnify|hold harmless)\b[^.]{0,80}\b(?:any and all|all) (?:claims|losses|damages)|jointly and severally)\b/i, /مسؤوليه كامله عن اي|يتحمل كافه الاضرار|يتحمل جميع الاضرار|بالتضامن والتكافل|متضامنين/,
    { en: "You carry all the risk, with no limit.", ar: "أنت تتحمل كل المخاطر بلا حد." },
    { en: "Ask for a limit (e.g. the contract's value) and to exclude what you can't control.", ar: "اطلب حدًا (مثل قيمة العقد) واستثناء ما لا تتحكم فيه." }],
  ["non-compete", 2, /\b(non-?compet\w*|shall not (?:work for|engage in)[^.]{0,60}competitor|not to compete)\b/i, /عدم المنافسه|عدم العمل لدي (?:اي )?منافس|لا يجوز له العمل لدي/,
    { en: "You may not work for a competitor after you leave — check how long and where.", ar: "لا يجوز لك العمل لدى منافس بعد تركك — راجع المدة والمكان." },
    { en: "Ask for 6–12 months at most, one city or field, and pay for the time it applies.", ar: "اطلب 6–12 شهرًا كحد أقصى، في مدينة أو مجال واحد، ومقابلًا عن مدته." }],
  ["ip-all", 2, /\b(all (?:intellectual property|inventions|work product)[^.]{0,80}(?:whether or not|outside (?:of )?working hours|during or after))\b/i, /جميع حقوق الملكيه الفكريه .{0,60}(?:خارج|بعد) (?:اوقات|ساعات) العمل/,
    { en: "Everything you make — even in your own time — would belong to them.", ar: "كل ما تصنعه — حتى في وقتك الخاص — يصبح ملكهم." },
    { en: "Ask to limit it to work done for them, in work time, with their tools.", ar: "اطلب قصره على العمل الذي تؤديه لهم، في وقت العمل، بأدواتهم." }],
  ["arbitration-abroad", 1, /\b(arbitration|governed by the laws of (?!egypt|the arab republic of egypt)\w+|courts of (?!cairo|egypt|giza|alexandria)\w+)\b/i, /التحكيم|تحكيم/,
    { en: "Disputes go to arbitration or to another country's courts — this can be slow and expensive for you.", ar: "النزاعات تذهب للتحكيم أو لمحاكم دولة أخرى — وقد يكون ذلك بطيئًا ومكلفًا لك." },
    { en: "Ask for the courts of your own city.", ar: "اطلب أن تختص محاكم مدينتك." }],
  ["waive", 3, /\b(waives? (?:any|all|his|her|their|the) (?:right|rights|claims?)|irrevocabl[ey] waive\w*)\b/i, /يتنازل عن (?:حقه|اي حق|كافه حقوقه|جميع حقوقه)|تنازل نهائي/,
    { en: "You give up a right (to sue, to a refund, to object).", ar: "تتنازل عن حق (التقاضي، الاسترداد، الاعتراض)." },
    { en: "Ask to delete the waiver.", ar: "اطلب حذف التنازل." }],
  ["as-is", 1, /\b(as[- ]is|without (?:any )?warrant(?:y|ies)|no warranty)\b/i, /بحالته الراهنه|بحالتها الراهنه|بالحاله التي هي عليها|دون ضمان|بدون ضمان|المعاينه النافيه للجهاله/,
    { en: "Sold as it is, with no guarantee — problems found later are yours.", ar: "بيع بحالته دون ضمان — ما يظهر بعد ذلك من عيوب يتحمله أنت." },
    { en: "Inspect it first (with an expert), or ask for a written guarantee period.", ar: "عاينه أولًا (مع خبير)، أو اطلب مدة ضمان مكتوبة." }],
  ["confidential-forever", 1, /\b(confidential\w*[^.]{0,60}(?:indefinitely|perpetual\w*|in perpetuity|forever))\b/i, /السريه .{0,40}(?:مدي الحياه|الي الابد|غير محدده المده)/,
    { en: "Secrecy that never ends.", ar: "سرية بلا نهاية." },
    { en: "Ask for a fixed number of years (2–5 is common).", ar: "اطلب عددًا محددًا من السنوات (2–5 شائع)." }],
  ["salary-deduction", 2, /\b(deduct\w*[^.]{0,40}(?:from (?:the |your )?salary|wages))\b/i, /يخصم من (?:راتبه|المرتب|الراتب|اجره)|خصم من الراتب/,
    { en: "They may take money from your salary — check when and how much.", ar: "يمكنهم الخصم من راتبك — راجع متى وكم." },
    { en: "Ask that deductions are only for set reasons, with a written notice and a cap.", ar: "اطلب أن يكون الخصم لأسباب محددة فقط، بإخطار مكتوب وبحد أقصى." }],
];

/** Numbers that are risky in themselves: a late fee over 2 % a month, a rent rise over 10 % a year, a probation over 3 months. */
function numberFlags(t, kind) {
  const out = [];
  const pctNear = (re) => { const m = re.exec(t); return m ? +((m[1] || m[2] || "0").replace(",", ".")) : null; };
  const late = pctNear(/(?:late|delay|overdue|تاخير|التاخير)[^.%]{0,60}?(\d+(?:[.,]\d+)?)\s*%|(\d+(?:[.,]\d+)?)\s*%[^.]{0,40}(?:per|a|each|عن كل|لكل)\s*(?:day|يوم)/i);
  if (late != null && (/day|يوم/.test(t.slice(Math.max(0, t.search(/late|delay|تاخير/) - 10), t.search(/late|delay|تاخير/) + 120)) ? late * 30 > 2 : late > 2))
    out.push(["late-fee", 3, { en: `A late fee of ${late}% — far above a normal rate.`, ar: `غرامة تأخير ${late}% — أعلى كثيرًا من المعتاد.` }, { en: "Ask for no more than about 1–2 % a month, and a few days' grace.", ar: "اطلب ألا تزيد عن 1–2% شهريًا تقريبًا، مع أيام سماح." }, /(?:late|delay|overdue|تاخير)/i]);
  const rise = pctNear(/(?:increase|rise|زياده|يزاد|تزيد)[^.%]{0,60}?(\d+(?:[.,]\d+)?)\s*%/i);
  if (kind === "rent" && rise != null && rise > 10)
    out.push(["rent-rise", 2, { en: `The rent goes up ${rise}% — check it is per year, not per month.`, ar: `الإيجار يزيد ${rise}% — تأكد أنها سنويًا لا شهريًا.` }, { en: "Ask for 5–10 % a year, written as a fixed schedule.", ar: "اطلب 5–10% سنويًا بجدول ثابت مكتوب." }, /increase|rise|زياده|يزاد/i]);
  const prob = /(?:probation|فتره الاختبار|فتره تحت الاختبار)[^.]{0,40}?(\d+)\s*(months?|شهور|اشهر|شهر)/i.exec(t);
  if (kind === "job" && prob && +prob[1] > 3)
    out.push(["probation", 2, { en: `A probation of ${prob[1]} months — Egypt's labour law allows 3 at most.`, ar: `فترة اختبار ${prob[1]} أشهر — قانون العمل المصري يسمح بثلاثة كحد أقصى.` }, { en: "Ask for 3 months.", ar: "اطلب 3 أشهر." }, /probation|الاختبار/i]);
  return out;
}

// what a contract of each kind should say (missing → a question to ask)
const MUST = {
  rent: [["the start and end dates", "تاريخ البداية والنهاية", /\b(from|starting|commenc\w*|term of|period of|for a period)\b|اعتبارا من|تبدا|مده العقد|لمده/i],
    ["the rent and when it is paid", "قيمة الإيجار وموعد دفعه", /\b(rent of|monthly rent|rent (?:is|shall be)|amount of)\b|القيمه الايجاريه|الايجار الشهري|قيمه الايجار/i],
    ["the deposit and when it comes back", "التأمين وموعد رده", /\b(deposit|security)\b|تامين|التامين/i],
    ["who pays for repairs", "من يتحمل الإصلاحات", /\b(repair|maintenance)\b|صيانه|اصلاح|ترميم/i],
    ["who pays electricity, water and gas", "من يدفع الكهرباء والمياه والغاز", /\b(utilit\w*|electricity|water|gas)\b|الكهرباء|المياه|الغاز|المرافق/i]],
  job: [["the salary", "الراتب", /\b(salary|wage|remuneration|compensation)\b|الراتب|المرتب|الاجر/i],
    ["the working hours", "ساعات العمل", /\b(working hours|hours per|hours a)\b|ساعات العمل|عدد ساعات/i],
    ["paid leave", "الإجازات المدفوعة", /\b(leave|vacation|holiday)\b|اجازه|الاجازات|اجازات/i],
    ["social insurance", "التأمينات الاجتماعية", /\b(social insurance|social security|insurance)\b|التامينات|تامين اجتماعي/i],
    ["the notice to end it", "مدة الإخطار عند الإنهاء", /\b(notice)\b|اخطار|انذار/i]],
  sale: [["the full price and what it includes", "السعر الكامل وما يشمله", /\b(price|total|amount)\b|الثمن|السعر|القيمه/i],
    ["the delivery date, and a penalty if late", "موعد التسليم وغرامة التأخير", /\b(deliver\w*|handover|hand over)\b|التسليم|الاستلام/i],
    ["what happens if it is not delivered", "ما يحدث إن لم يُسلَّم", /\b(refund|cancel\w*|terminat\w*)\b|استرداد|فسخ|الغاء/i]],
  loan: [["the interest or fees", "الفائدة أو الرسوم", /\b(interest|fees?|apr)\b|فائده|الفائده|رسوم/i], ["the repayment schedule", "جدول السداد", /\b(installments?|repay\w*|schedule)\b|اقساط|سداد|جدول/i]],
  service: [["what exactly will be delivered", "ما الذي سيُسلَّم بالضبط", /\b(scope|deliverables?|services? (?:include|to be provided))\b|نطاق|المطلوب|الاعمال المطلوبه/i],
    ["the price and when it is paid", "السعر وموعد الدفع", /\b(fee|price|payment|invoice)\b|السعر|المقابل|الدفع|الاتعاب/i],
    ["the deadline", "الموعد النهائي", /\b(deadline|within \d+|by \d+|delivery date)\b|خلال|موعد/i]],
  other: [],
};

/** The sentence around a match, trimmed, for quoting. */
function sentenceAt(raw, at) {
  const before = raw.slice(0, at), after = raw.slice(at);
  const s = Math.max(before.lastIndexOf("."), before.lastIndexOf("\n"), before.lastIndexOf("؛"), before.lastIndexOf("۔")) + 1;
  const eRel = after.search(/[.\n؛]/);
  const e = eRel < 0 ? raw.length : at + eRel + 1;
  const q = raw.slice(s, e).trim();
  return q.length > 260 ? q.slice(0, 257) + "…" : q;
}

/** The review: { kind, flags: [{ id, level, quote, means, ask }], missing: [{ en, ar }], level: "serious"|"check"|"ok" }. */
export function reviewContract(text) {
  const raw = String(text || ""); const f = fold(raw); const low = f.toLowerCase();
  const kind = kindOf(raw), flags = [];
  for (const [id, level, en, ar, means, ask] of RULES) {
    const m = en.exec(low) || ar.exec(f);
    if (!m) continue;
    flags.push({ id, level, quote: sentenceAt(raw, m.index), means, ask });
  }
  for (const [id, level, means, ask, re] of numberFlags(low, kind)) { const m = re.exec(low); flags.push({ id, level, quote: m ? sentenceAt(raw, m.index) : "", means, ask }); }
  flags.sort((a, b) => b.level - a.level);
  const missing = (MUST[kind] || []).filter(([, , re]) => !re.test(low) && !re.test(f)).map(([en, ar]) => ({ en, ar }));
  const level = flags.some((x) => x.level === 3) ? "serious" : flags.length || missing.length >= 2 ? "check" : "ok";
  return { kind, flags, missing, level };
}

/** The message to send back asking for the changes (one line per flag), in the contract's language. */
export function changeRequest(r, lang = "en") {
  const ar = lang === "ar";
  const lines = r.flags.map((x, i) => `${i + 1}. ${ar ? x.ask.ar : tr(x.ask.en)}`);
  const miss = r.missing.map((m) => (ar ? "• " + m.ar : "• " + m.en));
  return [ar ? "قبل التوقيع، أرجو تعديل الآتي:" : tr("Before I sign, I'd like these changes:"), ...lines,
    ...(miss.length ? [ar ? "وأرجو أن يذكر العقد أيضًا:" : tr("Please also add:"), ...miss] : [])].join("\n");
}
