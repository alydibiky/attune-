/* ---- v6.27 "What you're owed" — money a company owes you, decided by CODE from the published rules, and the letter to claim it.
   · flightClaim: EU261 (EU/EEA/Switzerland), UK261, Canada's APPR. The rule that applies, the amount, and why — or why not
     (extraordinary circumstances, too little delay, cancellation announced 14+ days ahead). Distances are great-circle between
     the two airports, as the rules say. Nothing is guessed: a missing fact (the cause, the arrival delay) is asked.
   · claimLetter / returnLetter / warrantyLetter / disputeLetter: the letter in English or Arabic, with every fact filled in.
   Blended: Travel → Trip ("Flight delayed or cancelled?"), Deadline Radar (returns, warranties: "Write the claim"),
   Money Guardian (a double charge: "Ask for it back"), Chat ("my flight was 4 hours late").
   Tests: tests/unit/v727owed.test.mjs.                                                                                          */

// airport → [lat, lon, region] — region: eu (EU/EEA/CH: EU261), uk (UK261), ca (APPR), or "" (none of these)
export const AIRPORT_POS = {
  CAI: [30.12, 31.41], HRG: [27.18, 33.80], SSH: [27.98, 34.39], HBE: [30.92, 29.70], LXR: [25.67, 32.71], ASW: [23.96, 32.82], RMF: [25.56, 34.58], SPX: [30.11, 30.89],
  DXB: [25.25, 55.36], AUH: [24.43, 54.65], SHJ: [25.33, 55.52], DOH: [25.27, 51.61], RUH: [24.96, 46.70], JED: [21.68, 39.16], DMM: [26.47, 49.80], MED: [24.55, 39.71],
  KWI: [29.24, 47.97], BAH: [26.27, 50.63], MCT: [23.59, 58.28], AMM: [31.72, 35.99], BEY: [33.82, 35.49], BGW: [33.26, 44.23], EBL: [36.24, 43.96], CMN: [33.37, -7.59],
  RAK: [31.61, -8.04], TUN: [36.85, 10.23], ALG: [36.69, 3.22], KRT: [15.59, 32.55], IST: [41.26, 28.74], SAW: [40.90, 29.31], AYT: [36.90, 30.80], ESB: [40.13, 32.99],
  TLV: [32.01, 34.89], LHR: [51.47, -0.45, "uk"], LGW: [51.15, -0.19, "uk"], MAN: [53.35, -2.27, "uk"], EDI: [55.95, -3.37, "uk"], DUB: [53.42, -6.27, "eu"],
  CDG: [49.01, 2.55, "eu"], NCE: [43.66, 7.22, "eu"], LYS: [45.73, 5.08, "eu"], FRA: [50.03, 8.57, "eu"], MUC: [48.35, 11.79, "eu"], BER: [52.37, 13.50, "eu"],
  HAM: [53.63, 9.99, "eu"], DUS: [51.29, 6.77, "eu"], AMS: [52.31, 4.76, "eu"], BRU: [50.90, 4.48, "eu"], ZRH: [47.46, 8.55, "eu"], GVA: [46.24, 6.11, "eu"],
  VIE: [48.11, 16.57, "eu"], FCO: [41.80, 12.25, "eu"], MXP: [45.63, 8.72, "eu"], VCE: [45.51, 12.35, "eu"], NAP: [40.88, 14.29, "eu"], MAD: [40.49, -3.57, "eu"],
  BCN: [41.30, 2.08, "eu"], AGP: [36.67, -4.50, "eu"], LIS: [38.77, -9.13, "eu"], OPO: [41.24, -8.68, "eu"], ATH: [37.94, 23.94, "eu"], CPH: [55.62, 12.66, "eu"],
  ARN: [59.65, 17.92, "eu"], OSL: [60.19, 11.10, "eu"], HEL: [60.32, 24.96, "eu"], WAW: [52.17, 20.97, "eu"], PRG: [50.10, 14.26, "eu"], BUD: [47.44, 19.26, "eu"],
  OTP: [44.57, 26.10, "eu"], SOF: [42.70, 23.41, "eu"], BEG: [44.82, 20.31], TBS: [41.67, 44.95], GYD: [40.47, 50.05], SVO: [55.97, 37.41], LED: [59.80, 30.26],
  KBP: [50.35, 30.89], JFK: [40.64, -73.78], EWR: [40.69, -74.17], LAX: [33.94, -118.41], SFO: [37.62, -122.38], ORD: [41.98, -87.90], MIA: [25.80, -80.29],
  IAD: [38.95, -77.46], BOS: [42.36, -71.01], ATL: [33.64, -84.43], DFW: [32.90, -97.04], IAH: [29.98, -95.34], SEA: [47.45, -122.31], LAS: [36.08, -115.15],
  MCO: [28.43, -81.31], DEN: [39.86, -104.67], YYZ: [43.68, -79.63, "ca"], YUL: [45.47, -73.74, "ca"], YVR: [49.19, -123.18, "ca"], MEX: [19.44, -99.07],
  CUN: [21.04, -86.87], GRU: [-23.43, -46.47], GIG: [-22.81, -43.25], EZE: [-34.82, -58.54], SCL: [-33.39, -70.79], BOG: [4.70, -74.15], LIM: [-12.02, -77.11],
  DEL: [28.56, 77.10], BOM: [19.09, 72.87], BLR: [13.20, 77.71], MAA: [12.99, 80.17], HYD: [17.24, 78.43], CCU: [22.65, 88.45], COK: [10.15, 76.40],
  KHI: [24.91, 67.16], LHE: [31.52, 74.40], ISB: [33.55, 72.83], DAC: [23.84, 90.40], CMB: [7.18, 79.88], KTM: [27.70, 85.36], MLE: [4.19, 73.53],
  BKK: [13.69, 100.75], HKT: [8.11, 98.32], KUL: [2.75, 101.71], SIN: [1.36, 103.99], CGK: [-6.13, 106.66], DPS: [-8.75, 115.17], MNL: [14.51, 121.02],
  SGN: [10.82, 106.66], HAN: [21.22, 105.81], HKG: [22.31, 113.92], PEK: [40.08, 116.58], PVG: [31.14, 121.81], CAN: [23.39, 113.30], SZX: [22.64, 113.81],
  TPE: [25.08, 121.23], ICN: [37.46, 126.44], NRT: [35.77, 140.39], KIX: [34.43, 135.24], SYD: [-33.95, 151.18], MEL: [-37.67, 144.84], BNE: [-27.38, 153.12],
  PER: [-31.94, 115.97], AKL: [-37.01, 174.79], JNB: [-26.14, 28.24], CPT: [-33.97, 18.60], NBO: [-1.32, 36.93], ADD: [8.98, 38.80], LOS: [6.58, 3.32],
  ABV: [9.01, 7.26], ACC: [5.61, -0.17], DKR: [14.67, -17.07], DAR: [-6.88, 39.20], ZNZ: [-6.22, 39.22], MRU: [-20.43, 57.68],
};
// airlines by IATA code: whose rule follows them on flights INTO the region (EU/UK/Canada carriers), and Canada's large carriers
const EU_CARRIERS = new Set(["LH", "AF", "KL", "IB", "VY", "FR", "AZ", "OS", "LX", "SN", "SK", "AY", "TP", "A3", "LO", "OK", "RO", "FB", "EI", "W6", "HV", "DY", "D8", "EW", "DE", "X3", "UX", "EN", "WK", "BT", "JU", "OU", "4U", "TO", "V7"]);
const UK_CARRIERS = new Set(["BA", "VS", "U2", "LS", "BY", "W9", "LM", "T3"]);
const CA_LARGE = new Set(["AC", "WS", "TS", "PD", "F8", "WG", "RV"]);
const CA_CARRIERS = new Set([...CA_LARGE, "QK", "WR", "MO", "4N"]);

export function distanceKm(a, b) {
  const A = AIRPORT_POS[a], B = AIRPORT_POS[b]; if (!A || !B) return null;
  const r = Math.PI / 180, dLat = (B[0] - A[0]) * r, dLon = (B[1] - A[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(A[0] * r) * Math.cos(B[0] * r) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
}
export const regionOf = (code) => (AIRPORT_POS[code] || [])[2] || "";
export const carrierOf = (flightNo) => { const m = String(flightNo || "").toUpperCase().replace(/\s+/g, "").match(/^([A-Z0-9]{2})(?=\d)/); return m ? m[1] : ""; };

// causes: the airline's own (owed) vs extraordinary (not owed); "unknown" is asked, never assumed
export const CAUSES = {
  technical: { owed: true, en: "A technical problem with the plane", ar: "عطل فني في الطائرة" },
  crew: { owed: true, en: "Crew shortage or the airline's own staff strike", ar: "نقص الطاقم أو إضراب موظفي شركة الطيران" },
  overbooked: { owed: true, en: "Overbooking / operational reasons", ar: "حجز زائد / أسباب تشغيلية" },
  weather: { owed: false, en: "Bad weather", ar: "سوء الأحوال الجوية" },
  atc: { owed: false, en: "Air-traffic control or airport strike", ar: "مراقبة الحركة الجوية أو إضراب في المطار" },
  security: { owed: false, en: "Security, political unrest, a bird strike, medical emergency", ar: "أمن، اضطرابات، اصطدام طائر، حالة طبية طارئة" },
  unknown: { owed: null, en: "I don't know / they didn't say", ar: "لا أعرف / لم يذكروا السبب" },
};

/** The flight, what happened, and the rule's answer.
    f = { from, to, flight, kind: "delay"|"cancel"|"denied", arrivalDelayH, noticeDays, cause, euCarrier?: bool } */
export function flightClaim(f) {
  const from = String(f.from || "").toUpperCase(), to = String(f.to || "").toUpperCase();
  const ask = [];
  if (!AIRPORT_POS[from]) ask.push("Which airport did you fly from?");
  if (!AIRPORT_POS[to]) ask.push("Which airport were you flying to?");
  if (!f.kind) ask.push("What happened — a delay, a cancellation, or you were refused boarding?");
  if (f.kind === "delay" && !(f.arrivalDelayH >= 0)) ask.push("How late did you ARRIVE (hours)?");
  if (f.kind === "cancel" && !(f.noticeDays >= 0)) ask.push("How many days before the flight were you told?");
  if (ask.length) return { status: "ask", ask };
  const km = distanceKm(from, to), rf = regionOf(from), rt = regionOf(to);
  const code = carrierOf(f.flight);
  const euCarrier = f.euCarrier != null ? f.euCarrier : EU_CARRIERS.has(code) ? true : code ? false : null;
  const ukCarrier = f.ukCarrier != null ? f.ukCarrier : UK_CARRIERS.has(code) ? true : code ? false : null;
  // which rule: departing the region always; arriving in it only on that region's airline
  let rule = "";
  if (rf === "eu") rule = "EU261"; else if (rf === "uk") rule = "UK261";
  else if (rt === "eu" && euCarrier) rule = "EU261"; else if (rt === "uk" && ukCarrier) rule = "UK261";
  if (!rule && (rf === "ca" || rt === "ca")) rule = "APPR";
  if (!rule && rt === "eu" && euCarrier == null) return { status: "ask", ask: ["Was the airline a European one? (EU rules cover flights INTO Europe only on European airlines)"], km };
  if (!rule && rt === "uk" && ukCarrier == null) return { status: "ask", ask: ["Was the airline a UK one? (UK rules cover flights INTO the UK only on UK airlines)"], km };
  const base = { km, rule, from, to, flight: f.flight || "", code, kind: f.kind };
  if (!rule) return { ...base, status: "no-rule", code: "no-rule", why: "No passenger-compensation law covers this route (EU, UK and Canada have one). The airline's own policy may still give a refund, meals or a voucher — ask." };
  const cause = CAUSES[f.cause] ? f.cause : "unknown";
  if (CAUSES[cause].owed === false) return { ...base, status: "not-owed", code: "extraordinary", why: "Extraordinary circumstances (" + CAUSES[cause].en.toLowerCase() + ") are not owed compensation. You are still owed care (meals, a hotel if overnight) and, after a 5-hour delay or a cancellation, a refund if you don't fly.", care: true };
  if (rule === "APPR") return appr({ ...base, cause }, f, code);
  // EU261 / UK261: three distance bands; delays count at ARRIVAL (3 h+)
  if (f.kind === "delay" && f.arrivalDelayH < 3) return { ...base, status: "not-owed", code: "under3", why: "Compensation starts at a 3-hour delay at arrival. You arrived " + f.arrivalDelayH + " h late." };
  if (f.kind === "cancel" && f.noticeDays >= 14) return { ...base, status: "not-owed", code: "notice14", why: "A cancellation announced 14 or more days before the flight is not owed compensation — but you are owed a full refund or another flight." };
  const intra = rf === "eu" && rt === "eu";                       // within the EU over 1,500 km is always the middle band
  const band = km <= 1500 ? 0 : km <= 3500 || intra ? 1 : 2;
  const AMT = rule === "UK261" ? [220, 350, 520] : [250, 400, 600], cur = rule === "UK261" ? "GBP" : "EUR";
  let amount = AMT[band], note = "";
  if (f.kind === "delay" && band === 2 && f.arrivalDelayH < 4) { amount = AMT[2] / 2; note = "Over 3,500 km with a 3–4 hour delay: the airline may halve it."; }
  if (f.kind === "cancel" && f.noticeDays >= 7) note = "Told 7–13 days ahead: not owed if they offered a flight leaving at most 2 h earlier and arriving at most 4 h later than yours.";
  if (f.kind === "cancel" && f.noticeDays < 7) note = note || "Told under 7 days ahead: not owed only if they offered a flight leaving at most 1 h earlier and arriving at most 2 h later than yours.";
  return { ...base, status: cause === "unknown" ? "likely" : "owed", amount, cur, per: "per passenger", note,
    why: `${rule}: ${km.toLocaleString("en")} km, ${f.kind === "delay" ? f.arrivalDelayH + " h late at arrival" : f.kind === "cancel" ? "cancelled " + f.noticeDays + " days before" : "refused boarding"}.`,
    askCause: cause === "unknown", care: true };
}
function appr(base, f, code) {
  const large = f.largeCarrier != null ? f.largeCarrier : CA_LARGE.has(code) ? true : CA_CARRIERS.has(code) ? false : null;
  if (large == null) return { ...base, status: "ask", ask: ["Which airline was it? (Canada's amounts depend on its size)"] };
  const h = f.kind === "delay" ? f.arrivalDelayH : f.arrivalDelayH >= 0 ? f.arrivalDelayH : null;
  if (h == null) return { ...base, status: "ask", ask: ["How late did you arrive at your destination (hours)?"] };
  if (f.kind === "cancel" && f.noticeDays >= 14) return { ...base, status: "not-owed", code: "notice14", why: "Canada: a cancellation announced 14+ days ahead is not owed compensation; a refund or rebooking is." };
  if (h < 3) return { ...base, status: "not-owed", code: "under3", why: "Canada: compensation starts at a 3-hour arrival delay." };
  const amount = large ? (h < 6 ? 400 : h < 9 ? 700 : 1000) : (h < 6 ? 125 : h < 9 ? 250 : 500);
  return { ...base, status: base.cause === "unknown" ? "likely" : "owed", amount, cur: "CAD", per: "per passenger", askCause: base.cause === "unknown",
    why: `Canada (APPR), ${large ? "large" : "small"} airline: ${h} h late at arrival.`, note: "Owed when the delay was within the airline's control and not for safety. Claim within 1 year.", care: true };
}

const fmtMoney = (a, c) => (c === "EUR" ? "€" : c === "GBP" ? "£" : c === "CAD" ? "CAD " : "") + a.toLocaleString("en");
/** The claim letter, every fact filled in by code. */
export function claimLetter(r, { name = "", booking = "", date = "", lang = "en", passengers = 1 } = {}) {
  const total = r.amount * Math.max(1, passengers);
  const law = r.rule === "EU261" ? "Regulation (EC) No 261/2004" : r.rule === "UK261" ? "the UK's Regulation 261/2004 (as retained)" : "Canada's Air Passenger Protection Regulations";
  const what = { delay: { en: "arrived more than 3 hours late", ar: "وصلت متأخرة أكثر من 3 ساعات" }, cancel: { en: "was cancelled", ar: "أُلغيت" }, denied: { en: "denied me boarding", ar: "رُفض صعودي إليها" } }[r.kind];
  if (lang === "ar") return [
    "إلى خدمة العملاء في شركة الطيران،", "",
    `الموضوع: طلب تعويض — الرحلة ${r.flight || ""} من ${r.from} إلى ${r.to} بتاريخ ${date}${booking ? " — رقم الحجز " + booking : ""}`, "",
    `الرحلة المذكورة ${what.ar}. وبموجب ${law} يحق لي تعويض قدره ${fmtMoney(r.amount, r.cur)} عن كل مسافر (المسافة ${r.km.toLocaleString("en")} كم)${passengers > 1 ? `، أي ${fmtMoney(total, r.cur)} عن ${passengers} مسافرين` : ""}.`,
    "أرجو تحويل المبلغ خلال 14 يومًا. وإن كان سبب التأخير ظرفًا استثنائيًا، فأرجو إرسال ما يثبت ذلك.", "",
    "مع الشكر،", name || "[الاسم]"].join("\n");
  return [
    "To the airline's customer relations team,", "",
    `Subject: Compensation claim — flight ${r.flight || ""} ${r.from} to ${r.to} on ${date}${booking ? " — booking " + booking : ""}`, "",
    `The flight above ${what.en}. Under ${law} I am entitled to ${fmtMoney(r.amount, r.cur)} per passenger (distance ${r.km.toLocaleString("en")} km)${passengers > 1 ? `, ${fmtMoney(total, r.cur)} for ${passengers} passengers` : ""}.`,
    "Please pay this within 14 days. If you say the cause was an extraordinary circumstance, please send the evidence for it.", "",
    "Kind regards,", name || "[Your name]"].join("\n");
}
/** A return, a warranty repair or a double charge: the request, with the facts filled in. */
export function returnLetter(x, { name = "", lang = "en" } = {}) {
  if (lang === "ar") return [`الموضوع: طلب إرجاع — ${x.title}`, "", `اشتريت «${x.title}» بتاريخ ${x.base || ""}${x.amount ? " بمبلغ " + x.amount + " " + (x.currency || "") : ""}، وأرغب في إرجاعه خلال مدة الإرجاع التي تنتهي في ${x.date}.`, "أرجو إخباري بخطوات الإرجاع واسترداد المبلغ بالطريقة نفسها التي دفعت بها.", "", "مع الشكر،", name || "[الاسم]"].join("\n");
  return [`Subject: Return request — ${x.title}`, "", `I bought "${x.title}" on ${x.base || ""}${x.amount ? " for " + x.amount + " " + (x.currency || "") : ""} and would like to return it within the return window, which ends on ${x.date}.`, "Please tell me how to send it back and refund me to the same payment method.", "", "Kind regards,", name || "[Your name]"].join("\n");
}
export function warrantyLetter(x, { name = "", fault = "", lang = "en" } = {}) {
  if (lang === "ar") return [`الموضوع: طلب إصلاح بالضمان — ${x.title}`, "", `اشتريت «${x.title}» بتاريخ ${x.base || ""}، وهو ما زال في فترة الضمان التي تنتهي في ${x.date}.`, `العطل: ${fault || "[صف العطل]"}.`, "أرجو إصلاحه أو استبداله دون تكلفة، وإخباري بالخطوات. مرفق إيصال الشراء.", "", "مع الشكر،", name || "[الاسم]"].join("\n");
  return [`Subject: Warranty claim — ${x.title}`, "", `I bought "${x.title}" on ${x.base || ""}; it is still under warranty until ${x.date}.`, `The fault: ${fault || "[describe the fault]"}.`, "Please repair or replace it free of charge and tell me what to do next. The receipt is attached.", "", "Kind regards,", name || "[Your name]"].join("\n");
}
export function disputeLetter({ merchant, amount, currency, dates = [] }, { name = "", lang = "en" } = {}) {
  if (lang === "ar") return [`الموضوع: خصم مكرر — ${merchant}`, "", `خُصم مبلغ ${amount} ${currency || ""} من حسابي مرتين لدى ${merchant}${dates.length ? " بتاريخ " + dates.join(" و") : ""}، وهي عملية واحدة فقط.`, "أرجو رد المبلغ المكرر إلى حسابي.", "", "مع الشكر،", name || "[الاسم]"].join("\n");
  return [`Subject: Duplicate charge — ${merchant}`, "", `I was charged ${amount} ${currency || ""} twice by ${merchant}${dates.length ? " on " + dates.join(" and ") : ""} for a single purchase.`, "Please refund the duplicate charge to my account.", "", "Kind regards,", name || "[Your name]"].join("\n");
}

/** Chat: "my flight MS777 from Cairo to London was 4 hours late" → the facts code can read (the rest is asked on the card). */
export function flightFromText(text, airportOf) {
  const t = String(text || "");
  if (!/(flight|plane|رحل[ةهت]|طيار[ةهت]|vol\b|vuelo|flug)/i.test(t) || !/(delay|late|cancel|overbook|denied|refused|تأخر|اتأخر|متأخر|إلغاء|اتلغت|ألغيت|الغاء|vol annulé|retard|retraso|cancelado|verspätet|annulliert)/i.test(t)) return null;
  const kind = /(cancel|إلغاء|اتلغت|ألغيت|الغاء|annul|cancelad)/i.test(t) ? "cancel" : /(overbook|denied|refused|رفض|ما ركبتش)/i.test(t) ? "denied" : "delay";
  const hm = t.match(/(\d+(?:\.\d+)?)\s*(?:h\b|hrs?|hours?|ساع|heures?|horas?|stunden?)/i), h = hm ? Number(hm[1]) : /(ساعتين)/.test(t) ? 2 : null;
  const fl = (t.match(/\b([A-Z0-9]{2}\s?\d{2,4})\b/) || [])[1] || "";
  const codes = [...t.matchAll(/\b([A-Z]{3})\b/g)].map((m) => m[1]).filter((c) => AIRPORT_POS[c]);
  let from = codes[0] || "", to = codes[1] || "";
  if ((!from || !to) && airportOf) { const fm = t.match(/(?:from|من)\s+([^\s,.]+(?:\s[^\s,.]+)?)/i), tm = t.match(/(?:to|إلى|الى|لـ?)\s+([^\s,.]+(?:\s[^\s,.]+)?)/i); from = from || (fm && airportOf(fm[1])) || ""; to = to || (tm && airportOf(tm[1])) || ""; }
  return { kind, arrivalDelayH: h, flight: fl.replace(/\s/g, ""), from, to };
}
