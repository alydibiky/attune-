/* ---- v9.9.24 B6 X1 (rest): a business card photo → a People card (Ali: "upload the photo … it fills out all info … same goes with
   everything"). From the card's text (the phone's reader): the person's name, job title, company, phone numbers (mobile first; a fax
   is never taken as the phone), email, website — English, Arabic (both sides of the card), French; Arabic-Indic digits. What isn't
   sure (no name line found) is left for the person to fill — never a company name taken as a person's. Pure.
   Tests: tests/x1card/gen.mjs (10,000 cards) + tests/unit/v9924bizcard.test.mjs. */
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
const TITLE = /\b(manager|director|engineer|eng\.|ceo|cfo|coo|cto|founder|co-founder|partner|head|lead|officer|consultant|specialist|accountant|lawyer|attorney|doctor|dr\.?|sales|marketing|analyst|designer|developer|architect|executive|president|vice|supervisor|coordinator|representative|agent|advisor|adviser|associate|assistant|owner|chairman|directeur|directrice|ing[ée]nieur|responsable|g[ée]rant|chef|avocat|comptable|conseiller)\b|مدير|مهندس|م\.|دكتور|د\.|محاسب|محامي|مستشار|رئيس|مؤسس|شريك|مندوب|أخصائي|اخصائي|مشرف|منسق|نائب|صاحب|مالك/i;
const COMPANY = /\b(ltd|llc|inc|co\.|company|corp|corporation|group|holding|s\.?a\.?e?|sarl|gmbh|bank|hospital|clinic|university|school|agency|solutions|systems|technologies|consulting|trading|industries|motors|realty|properties|groupe|compagnie|cabinet|banque|clinique|entreprise|empresa|grupo|firma|gruppe)\b|soci[ée]t[ée]|[şs]irketi|شركة|شركه|مؤسسة|مجموعة|بنك|مستشفى|مستشفي|عيادة|جامعة|مدرسة|للتجارة|للاستثمار|للمقاولات|القابضة/i;
const isEmail = (s) => /[\w.+-]+@[\w-]+\.[\w.-]+/.test(s);
const isWeb = (s) => /\b(www\.|https?:\/\/)[^\s]+|\b[\w-]+\.(com|net|org|eg|com\.eg|sa|ae|io|co)(\/\S*)?\b/i.test(s) && !isEmail(s);
/** The phone numbers on a line: { number, kind: "mobile" | "phone" | "fax" } */
function phonesIn(line) {
  const t = latin(line), out = [];
  const label = /fax|فاكس|télécopie/i.test(t) ? "fax" : /mob|cell|mobile|موبايل|محمول|جوال|portable|whatsapp|واتس/i.test(t) ? "mobile" : "";
  for (const m of t.matchAll(/(\+?\d[\d\s().-]{6,}\d)/g)) { const digits = m[1].replace(/[^\d+]/g, ""); const d = digits.replace(/^\+/, "");
    if (d.length < 7 || d.length > 15) continue;
    const kind = label || (/^(\+?20)?0?1[0125]\d{8}$/.test(digits) || /^(\+?966)?0?5\d{8}$/.test(digits) || /^(\+?971)?0?5\d{8}$/.test(digits) ? "mobile" : "phone");
    out.push({ number: m[1].trim(), kind }); }
  return out;
}
/** The card's text → { name, title, company, phones: [{ number, kind }], phone (the one to save: a mobile first, never a fax), email, website, sure: { name } } */
export function readCard(text) {
  const lines = String(text || "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const r = { name: "", title: "", company: "", phones: [], phone: "", email: "", website: "", sure: { name: false } };
  const rest = [];
  for (const l of lines) {
    const em = /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(l); if (em && !r.email) { r.email = em[0].toLowerCase(); continue; }
    const ph = phonesIn(l); if (ph.length && latin(l).replace(/[\d\s+().:-]/g, "").length <= 14) { r.phones.push(...ph); continue; }
    if (isWeb(l) && !r.website) { r.website = (/(?:https?:\/\/)?(?:www\.)?[\w.-]+\.[a-z]{2,}(?:\/\S*)?/i.exec(l) || [l])[0]; continue; }
    rest.push(l);
  }
  // (a name written with its honorific — "Dr. Sara", "Eng. Omar", «م. محمود», «د. منى» — is the name, not the title)
  const HON = /^(dr\.?|eng\.?|prof\.?|م\.|د\.|أ\.|المهندس|الدكتور|دكتور|مهندس)\s+/i;
  const named = (l) => HON.test(l) && l.replace(HON, "").trim().split(/\s+/).length >= 2;   // «مهندس أحمد كمال» = a name; «مهندس أول» = a title
  const titleOf = (l) => !named(l) && TITLE.test(l) && !COMPANY.test(l);
  for (const l of rest) { if (!r.title && titleOf(l)) { r.title = l; continue; } if (!r.company && COMPANY.test(l)) { r.company = l; continue; } }
  // the name: a line of 2–4 words, letters only, that isn't the title or the company (often the biggest, near the top)
  const nameLine = rest.find((l) => l !== r.title && l !== r.company && !COMPANY.test(l) && (named(l) || !TITLE.test(l)) && !TITLE.test(l.replace(HON, "")) && /^[\p{L}\s.'-]+$/u.test(l) && l.replace(HON, "").split(/\s+/).length >= 2 && l.split(/\s+/).length <= 6);
  if (nameLine) { r.name = nameLine.replace(/^(mr\.?|mrs\.?|ms\.?|السيد|الأستاذ|الاستاذ)\s+/i, "").replace(HON, "").trim(); r.sure.name = true; }
  const mob = r.phones.find((p) => p.kind === "mobile") || r.phones.find((p) => p.kind === "phone");
  r.phone = mob ? mob.number : "";
  return r;
}
