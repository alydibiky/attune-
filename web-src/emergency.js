/* ---- v9.9.24 B6 X4 the emergency card (Ali picked A+B combined: one Family → Emergency page, a tab per person, each the full card —
   blood type, medicines, allergies, doctor, insurance, who to call first; share one person or all). Pure.
   - Medicines come from Family health (care.js) and are ALWAYS today's: a stopped or finished course is never on the card (stale = wrong).
   - Blood type is read from how people write it (O+, o pos, "O positive", «أو موجب», «A سالب», "AB neg", "0+", Rh) into one of the 8
     types; anything else stays as typed and is marked "check" — never guessed.
   - The shared card is plain text (works offline, in any app) in the READER's language — 20 languages.
   Tests: tests/x4/gen.mjs (10,000 family records) + tests/unit/v9924x4.test.mjs. */
import { activeOn, isoDay } from "./care.js";
const TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
/** "o pos" / «أو موجب» / "AB negative" / "0+" → "O+" … ; null when it isn't clearly one of the 8. */
export function bloodType(raw) {
  let s = latin(raw).toLowerCase().normalize("NFKC").replace(/[\s._()\[\]:]+/g, " ").trim(); if (!s) return null;
  s = s.replace(/^(blood( type| group)?|groupe sanguin|grupo sangu[ií]neo|blutgruppe|فصيلة الدم|فصيله الدم|فصيلة|فصيله|زمرة الدم)\s*/, "");
  // the sign: +/-, Rh, or the word for positive / negative in the 20 languages
  const POS = /(positi(ve|f|vo|v)|\bpos\b|\bplus\b|\+|pozitif|موجب|ايجابي|إيجابي|مثبت|पॉजिटिव|पॉज़िटिव|পজিটিভ|chanya|บวก|dương|阳性|陽性|양성|положительн)/;
  const NEG = /(n[eé]gati(ve|f|vo|v)|\bneg\b|\bminus\b|\-|−|–|سالب|سلبي|منفی|منفي|नेगेटिव|নেগেটিভ|hasi|ลบ|âm|阴性|陰性|음성|отрицательн)/;
  const sp = POS.test(s), sn = NEG.test(s); if (sp === sn) return null; const sign = sp ? "+" : "-";
  const g = s.replace(new RegExp(POS.source, "g"), " ").replace(new RegExp(NEG.source, "g"), " ").replace(/\b(rh|rhd|d|ve|type|group|groupe|grupo|gruppe|tipo)\b|型|형|группа|kan grubu|golongan darah|ब्लड ग्रुप|بلڈ گروپ|گروه خونی/g, " ").replace(/\s+/g, " ").trim()
    .replace(/^(اي بي|ايه بي|إيه بي|ab|аб|ab형)$/, "AB").replace(/^(ايه|إيه|a|ا|а)$/, "A").replace(/^(بي|b|ب|в|б)$/, "B").replace(/^(او|أو|o|0|زيرو|صفر|ou|о)$/, "O");
  const t = g.toUpperCase() + sign; return TYPES.includes(t) ? t : null;
}
/** Insurance / ID numbers on a card shared with others: first 2 and last 2 only. */
export const mask = (n) => { const s = String(n || "").replace(/\s+/g, ""); return s.length <= 4 ? s : s.slice(0, 2) + "…" + s.slice(-2); };
const medLine = (m) => [m.name, m.strength, m.dose, (m.times || []).length ? "(" + m.times.join(", ") + ")" : ""].filter(Boolean).join(" ").trim();
/** One person's card. care = loadCare() shape; member = { id, name, emergency: { blood, allergies[], conditions, doctor {name, phone}, insurance {company, number}, call [{ name, phone, rel }] } } */
export function cardOf(member, care = {}, now = Date.now()) {
  const e = (member && member.emergency) || {}, day = isoDay(now);
  const meds = (care.meds || []).filter((m) => m.member === member.id && activeOn(m, day)).map(medLine);
  const bt = bloodType(e.blood);
  const card = { id: member.id, name: member.name || "", blood: bt || (e.blood ? String(e.blood).trim() : ""), bloodSure: !!bt,
    meds, allergies: (e.allergies || []).map((x) => String(x).trim()).filter(Boolean), noAllergies: !!e.noAllergies, conditions: String(e.conditions || "").trim(),
    doctor: e.doctor && (e.doctor.name || e.doctor.phone) ? { name: String(e.doctor.name || "").trim(), phone: String(e.doctor.phone || "").trim() } : null,
    insurance: e.insurance && (e.insurance.company || e.insurance.number) ? { company: String(e.insurance.company || "").trim(), number: String(e.insurance.number || "").trim() } : null,
    call: (e.call || []).filter((c) => c && (c.name || c.phone)).map((c) => ({ name: String(c.name || "").trim(), phone: String(c.phone || "").trim(), rel: String(c.rel || "").trim() })) };
  // what an emergency needs and is still empty (shown as "add …" on the card)
  card.missing = [!card.blood && "blood", !card.call.length && "call", !card.doctor && "doctor", !card.allergies.length && !e.noAllergies && "allergies"].filter(Boolean);
  return card;
}
// the shared card's words, in the reader's language
export const LABELS = {
  en: ["Emergency card", "Blood type", "Medicines", "Allergies", "No known allergies", "Conditions", "Doctor", "Insurance", "Call first"],
  ar: ["كارت الطوارئ", "فصيلة الدم", "الأدوية", "حساسية", "مفيش حساسية معروفة", "أمراض", "الدكتور", "التأمين", "كلّم الأول"],
  arb: ["بطاقة الطوارئ", "فصيلة الدم", "الأدوية", "الحساسية", "لا حساسية معروفة", "الحالات المرضية", "الطبيب", "التأمين", "اتصل أولًا بـ"],
  es: ["Tarjeta de emergencia", "Grupo sanguíneo", "Medicamentos", "Alergias", "Sin alergias conocidas", "Enfermedades", "Médico", "Seguro", "Llamar primero"],
  fr: ["Carte d'urgence", "Groupe sanguin", "Médicaments", "Allergies", "Aucune allergie connue", "Maladies", "Médecin", "Assurance", "Appeler d'abord"],
  de: ["Notfallkarte", "Blutgruppe", "Medikamente", "Allergien", "Keine bekannten Allergien", "Erkrankungen", "Arzt", "Versicherung", "Zuerst anrufen"],
  pt: ["Cartão de emergência", "Tipo sanguíneo", "Medicamentos", "Alergias", "Sem alergias conhecidas", "Doenças", "Médico", "Seguro", "Ligar primeiro"],
  it: ["Scheda di emergenza", "Gruppo sanguigno", "Farmaci", "Allergie", "Nessuna allergia nota", "Patologie", "Medico", "Assicurazione", "Chiamare prima"],
  ru: ["Экстренная карта", "Группа крови", "Лекарства", "Аллергии", "Аллергий нет", "Заболевания", "Врач", "Страховка", "Звонить сначала"],
  tr: ["Acil durum kartı", "Kan grubu", "İlaçlar", "Alerjiler", "Bilinen alerji yok", "Hastalıklar", "Doktor", "Sigorta", "Önce ara"],
  id: ["Kartu darurat", "Golongan darah", "Obat", "Alergi", "Tidak ada alergi", "Penyakit", "Dokter", "Asuransi", "Hubungi dulu"],
  hi: ["आपातकालीन कार्ड", "ब्लड ग्रुप", "दवाइयाँ", "एलर्जी", "कोई ज्ञात एलर्जी नहीं", "बीमारियाँ", "डॉक्टर", "बीमा", "पहले कॉल करें"],
  ur: ["ایمرجنسی کارڈ", "بلڈ گروپ", "دوائیں", "الرجی", "کوئی معلوم الرجی نہیں", "بیماریاں", "ڈاکٹر", "انشورنس", "پہلے کال کریں"],
  fa: ["کارت اضطراری", "گروه خونی", "داروها", "حساسیت‌ها", "حساسیت شناخته‌شده‌ای ندارد", "بیماری‌ها", "پزشک", "بیمه", "اول تماس بگیرید"],
  bn: ["জরুরি কার্ড", "রক্তের গ্রুপ", "ওষুধ", "অ্যালার্জি", "কোনো জানা অ্যালার্জি নেই", "রোগ", "ডাক্তার", "বিমা", "আগে ফোন করুন"],
  sw: ["Kadi ya dharura", "Kundi la damu", "Dawa", "Mzio", "Hakuna mzio unaojulikana", "Magonjwa", "Daktari", "Bima", "Piga kwanza"],
  th: ["บัตรฉุกเฉิน", "กรุ๊ปเลือด", "ยา", "แพ้", "ไม่มีประวัติแพ้", "โรคประจำตัว", "แพทย์", "ประกัน", "โทรหาก่อน"],
  vi: ["Thẻ khẩn cấp", "Nhóm máu", "Thuốc", "Dị ứng", "Không có dị ứng đã biết", "Bệnh", "Bác sĩ", "Bảo hiểm", "Gọi trước"],
  zh: ["紧急卡", "血型", "药物", "过敏", "无已知过敏", "疾病", "医生", "保险", "先联系"],
  ja: ["緊急カード", "血液型", "服用中の薬", "アレルギー", "既知のアレルギーなし", "持病", "医師", "保険", "まず連絡"],
  ko: ["비상 카드", "혈액형", "복용 약", "알레르기", "알려진 알레르기 없음", "질환", "의사", "보험", "먼저 연락"],
};
/** Plain text to share (offline, any app), in the reader's language. One card or several. */
export function shareText(cards, lang = "en") {
  const L = LABELS[lang] || LABELS.en, out = [];
  for (const c of [].concat(cards)) {
    const lines = ["🆘 " + L[0] + " — " + c.name];
    if (c.blood) lines.push(L[1] + ": " + c.blood);
    if (c.meds.length) lines.push(L[2] + ": " + c.meds.join("; "));
    // (never "no known allergies" just because nobody filled it in — only when it was ticked; an emergency doctor trusts this line)
    if (c.allergies.length) lines.push(L[3] + ": " + c.allergies.join(", ")); else if (c.noAllergies) lines.push(L[4]);
    if (c.conditions) lines.push(L[5] + ": " + c.conditions);
    if (c.doctor) lines.push(L[6] + ": " + [c.doctor.name, c.doctor.phone].filter(Boolean).join(" · "));
    if (c.insurance) lines.push(L[7] + ": " + [c.insurance.company, mask(c.insurance.number)].filter(Boolean).join(" · "));
    if (c.call.length) lines.push(L[8] + ": " + c.call.map((x, i) => (i + 1) + ". " + [x.name, x.rel ? "(" + x.rel + ")" : "", x.phone].filter(Boolean).join(" ")).join("  "));
    out.push(lines.join("\n"));
  }
  return out.join("\n\n");
}
