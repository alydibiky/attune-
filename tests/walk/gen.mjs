// v10.9.8 the new-user walk-through (24 Nov 2026): EXACTLY 10,000 HARD questions a person asks Chat about their OWN records — the four
// kinds the walk-through found answered wrong — composed from parts in random order, each with the answer's details checked:
//   owed  — "how much does Ahmed owe me?" asked in English / Egyptian Arabic / Franco, the name saved in EITHER script (أحمد = Ahmed)
//   paper — "when does my passport expire?": the paper NAMED is answered (any date, any language of its title), never "call the bank"
//   none  — a paper asked about that has no date saved: says so by name, never answers with something else
//   day   — "what do I have tomorrow / today?": that day's reminders, with their times, nothing from another day
//   food  — "how much on food?" with nothing under Food: says Food by name and names Groceries / Coffee spending ("Related")
// HARD: every question goes through tests/lib/hard.mjs harden() (human: true — people type these); distinct shapes reported.
//     node tests/walk/gen.mjs [count]          (seeded: every run gives the same questions; SEED_SHIFT=n for the held-out set)
const mem = {}; globalThis.localStorage = globalThis.localStorage || { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; }, key: () => null, length: 0 };
const { chatAsk, askLife } = await import("../../web-src/lifeask.js");
const { readable } = await import("../../web-src/wrapclean.js");   // (Chat reads `typed = readable(raw)` — the same step here)
const { harden, shapeReport, SHAPE_BAR } = await import("../lib/hard.mjs");
const NOW = Date.parse("2026-11-24T20:00:00"), DAY = 86400000;
const iso = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function run(total = 10000, shift = 0, { quiet = false } = {}) {
  let seed = 20261124 + 7919 * shift; const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)], maybe = (p, s) => (rnd() < p ? s : "");
  const NAMES = [["Ahmed", "أحمد", "m"], ["Mohamed", "محمد", "m"], ["Sara", "سارة", "f"], ["Youssef", "يوسف", "m"], ["Mona", "منى", "f"], ["Karim", "كريم", "m"], ["Omar", "عمر", "m"], ["Hany", "هاني", "m"], ["Nour", "نور", "f"], ["Mahmoud", "محمود", "m"], ["Salma", "سلمى", "f"], ["Tarek", "طارق", "m"]];
  const PAPERS = [{ en: ["Passport", "passport"], ar: ["جواز السفر", "الباسبور"], fr: ["el basbor", "el passport"] }, { en: ["Car licence", "driving licence", "license"], ar: ["رخصة العربية", "الرخصة"], fr: ["el rokhsa"] },
    { en: ["Visa", "visa"], ar: ["الفيزا", "التأشيرة"], fr: ["el visa"] }, { en: ["Car insurance", "insurance"], ar: ["التأمين", "تأمين العربية"], fr: ["el ta2meen"] }, { en: ["National ID", "ID card"], ar: ["البطاقة"], fr: ["el beta2a"] },
    { en: ["Rent contract", "contract"], ar: ["عقد الإيجار", "العقد"], fr: ["3a2d el egar"] }];
  const TASKS = [["call the bank", "اكلم البنك"], ["pay the rent", "ادفع الإيجار"], ["dentist", "الدكتور"], ["meeting with Hany", "اجتماع مع هاني"], ["pick up the kids", "اجيب الولاد"], ["gym", "الجيم"], ["send the report", "ابعت التقرير"], ["car service", "صيانة العربية"]];
  const cases = [];
  for (let i = 0; i < total; i++) {
    const k = pick(["owed", "owed", "paper", "paper", "none", "day", "day", "food"]);
    const stores = { life: { items: [] }, radar: { items: [] }, reminders: [], ledger: null, care: { members: [] } };
    let q = "", want = null;
    // things the question must NOT be answered with: other people, other papers, a reminder on another day
    for (let j = 0, m = Math.floor(rnd() * 3); j < m; j++) stores.reminders.push({ id: "o" + j, at: NOW + (3 + j) * DAY + 3600000 * j, title: pick(TASKS)[pick([0, 1])] });
    if (k === "owed") {
      const [en, ar, g] = pick(NAMES), other = pick(NAMES.filter((n) => n[0] !== en)), amt = pick([150, 500, 750, 1200, 2500, 4000, 10000]);
      stores.life.items.push({ id: "c1", person: rnd() < 0.5 ? en : ar, currency: "EGP", start: "", every: null, paid: [], kind: pick(["debt", "loan"]), dir: "in", amount: amt, count: 1, total: amt, created: NOW - pick([1, 5, 30]) * DAY });
      if (rnd() < 0.6) stores.life.items.push({ id: "c2", person: rnd() < 0.5 ? other[0] : other[1], currency: "EGP", start: "", every: null, paid: [], kind: "debt", dir: "in", amount: 333, count: 1, total: 333, created: NOW - DAY });
      const ask = pick(["en", "ar", "fr"]);
      q = ask === "en" ? pick([`how much does ${en} owe me?`, `does ${en} still owe me?`, `${en} owes me how much?`, `how much does ${en} still owe me`, `what does ${en} owe me?`])
        : ask === "ar" ? pick([`${ar} ${g === "f" ? "عليها" : "عليه"} كام؟`, `${ar} ${g === "f" ? "عليها" : "عليه"} لسه كام؟`, `${maybe(0.4, "هو ")}${ar} ${g === "f" ? "عليها" : "عليه"} كام`, `${ar} ${g === "f" ? "عليها" : "عليه"} فلوس ليا؟`])
        : pick([`${en} ${g === "f" ? "3aleha" : "3aleh"} kam?`, `${en} ${g === "f" ? "3aleha" : "3aleh"} lessa kam?`, `${en.toLowerCase()} ${g === "f" ? "3aleha" : "3aleh"} kam`]);
      want = { kind: "owed-in", amount: amt };
    } else if (k === "paper" || k === "none") {
      const [p, other] = [pick(PAPERS), pick(PAPERS)], d = iso(NOW + pick([-20, 3, 40, 99, 200, 400]) * DAY), titleLang = pick(["en", "ar"]);
      if (k === "paper") stores.radar.items.push({ id: "r1", kind: "doc", title: (titleLang === "en" ? p.en : p.ar)[0], date: d, status: "" });
      if (other !== p || k === "none") stores.radar.items.push({ id: "r2", kind: "doc", title: (k === "none" ? other === p ? PAPERS[(PAPERS.indexOf(p) + 1) % PAPERS.length] : other : other).en[0], date: iso(NOW + 10 * DAY), status: "" });
      if (k === "none") stores.radar.items = stores.radar.items.filter((x) => x.title !== p.en[0]);
      stores.reminders.push({ id: "n1", at: NOW + DAY + 9 * 3600000 - 20 * 3600000, title: "call the bank" });
      const ask = pick(["en", "ar", "fr"]);
      q = ask === "en" ? pick([`when does my ${pick(p.en).toLowerCase()} expire?`, `when does the ${pick(p.en).toLowerCase()} expire`, `my ${pick(p.en).toLowerCase()} expires when?`, `when is my ${pick(p.en).toLowerCase()} renewal due?`, `${pick(p.en)} expiry?`.replace(/^./, (c) => c.toUpperCase())])
        : ask === "ar" ? pick([`${pick(p.ar)} ${maybe(0.5, "بتاعي ")}هينتهي امتى؟`, `${pick(p.ar)} بينتهي امتى`, `امتى ${pick(p.ar)} هينتهي؟`, `تجديد ${pick(p.ar).replace(/^ال/, "")} امتى؟`])
        : pick([`${pick(p.fr)} beyentehy emta?`, `${pick(p.fr)} hayentehy emta`, `emta ${pick(p.fr)} beyentehy?`]);
      want = k === "paper" ? { kind: "due", date: d } : { kind: "due", none: true };
      if (k === "none" && p === other && stores.radar.items.some((x) => x.title === p.en[0])) want = null;
    } else if (k === "day") {
      const tmr = rnd() < 0.6, day0 = NOW - 20 * 3600000 + (tmr ? DAY : 0);   // (NOW is 20:00 — today's reminders sit in the evening still ahead)
      const n = Math.floor(rnd() * 3), titles = [];
      for (let j = 0; j < n; j++) { const [te, ta] = pick(TASKS), t = pick([te, ta]), h = tmr ? 8 + Math.floor(rnd() * 12) : 21 + j; titles.push(t); stores.reminders.push({ id: "d" + j, at: day0 + h * 3600000 + pick([0, 15, 30]) * 60000, title: t }); }
      const ask = pick(["en", "ar", "fr"]);
      q = tmr ? (ask === "en" ? pick(["what do I have tomorrow?", "anything planned tomorrow?", "what's on tomorrow?", "do I have anything tomorrow", "what's my schedule tomorrow?"]) : ask === "ar" ? pick(["عندي ايه بكره؟", "ورايا ايه بكرة؟", "عندي مواعيد بكره؟", "بكره عندي ايه"]) : pick(["3andi eh bokra?", "3andi eh bokra", "ana 3andi eh bokra?"]))
        : (ask === "en" ? pick(["what do I have today?", "anything planned today?", "what's on today?", "what's my schedule today?"]) : ask === "ar" ? pick(["عندي ايه النهارده؟", "ورايا ايه النهاردة؟", "النهارده عندي ايه"]) : pick(["3andi eh el naharda?", "3andi eh ennaharda"]));
      want = { kind: "due", day: iso(day0), titles };
    } else {
      const g = pick([85, 120, 450, 1300]), c = pick([0, 45, 60]);
      stores.ledger = { currency: "EGP", accounts: [{ id: "a", name: "Cash", currency: "EGP" }], txns: [{ id: "t1", type: "expense", amount: g, cat: "groceries", account: "a", date: iso(NOW - DAY), note: pick(["Spinneys", "عيش وجبنة", "Carrefour"]) }, ...(c ? [{ id: "t2", type: "expense", amount: c, cat: "coffee", account: "a", date: iso(NOW), note: "coffee" }] : []), { id: "t3", type: "expense", amount: 300, cat: "transport", account: "a", date: iso(NOW), note: "Uber" }] };
      q = pick(["how much did I spend on food this month?", "how much on food this month?", "what did I spend on food this month?", "صرفت كام على الأكل الشهر ده؟", "صرفت كام على الاكل الشهر ده"]);
      want = { kind: "food", g, c };
    }
    if (!want) { i--; continue; }
    // composed around the question, in random order: who's asking, why, a greeting, a filler, a time stamp — what people really add
    const arQ = /[\u0600-\u06ff]/.test(q), frQ = !arQ && /\b(3aleh|3aleha|3andi|beyentehy|hayentehy|emta|bokra|ennaharda|el)\b/i.test(q);
    const PRE = arQ ? ["", "", "يا أتيون ", "بقولك ", "سؤال سريع: ", "معلش ", "لو سمحت ", "بص ", "اه صحيح ", "كنت عايز اعرف ", "قولي ", "ممكن تقولي ", "طب ", "انا نسيت، "]
      : frQ ? ["", "", "ya attune ", "2olly ", "law sama7t ", "bos ", "ah sa7 ", "kont 3ayez a3raf ", "momken t2olly ", "tab ", "ana nseet, "]
      : ["", "", "hey Attune, ", "quick question: ", "Attune ", "sorry, ", "please tell me ", "um ", "ok so ", "remind me, ", "I forgot — ", "can you check: ", "btw ", "one thing: "];
    const POST = arQ ? ["", "", " بسرعة", " لو سمحت", " يا باشا", " عشان مراتي بتسأل", " عشان انا ناسي", " الله يخليك", " ؟؟", " 🙏", " (ضروري)", " دلوقتي"]
      : frQ ? ["", "", " please", " ya basha", " 3ashan mrati bteso2al", " 3ashan ana nasy", " bsor3a", " ??", " 🙏", " dlw2ty"]
      : ["", "", " please", " thanks!", " — my wife is asking", " (I keep forgetting)", " asap", " ??", " 🙏", " right now", " again", " pls", " real quick"];
    const SEP = [" ", ", ", " — ", ": ", "... ", " - ", "\n", " | "];
    const NUM = arQ ? ["", "", "", "سؤالين: ", "١) ", "سؤال ٢: ", "تاني مرة: "] : frQ ? ["", "", "", "so2al: ", "1) ", "2 so2alat: "] : ["", "", "", "2 questions: ", "1) ", "Q2: ", "#3 ", "one more (2/2): "];
    const MIX = arQ ? ["", "", "", "please ", "ok ", "sorry "] : ["", "", "", "يا أتيون ", "معلش ", "بص "];
    // (a filler that ends with its own punctuation — "remind me," / "quick question:" — takes no second one: ",," / ",:" are not typed)
    const join = (a, b) => (!a ? b : /[,:،—]\s*$/.test(a) ? a.replace(/\s*$/, " ") + b : a + pick(SEP) + b);
    let qq = join(join(pick(NUM) + pick(PRE).trim(), rnd() < 0.5 ? "" : pick(MIX).trim()).trim(), q) + pick(POST) + (rnd() < 0.3 ? pick(SEP) + pick(POST).trim() : "");
    qq = qq.replace(/^\s*[,:—|\-.]+\s*/, "").replace(/\s+([,.!?؟])/g, "$1").trim();
    if (rnd() < 0.15) qq = qq.replace(/[?؟]+/g, "").trim() + pick([" ?", "?!", "…", ".", ""]);
    cases.push({ k, q: harden(qq, rnd, { human: true, allowCut: false }), stores, want });
  }
  let ok = 0; const bad = [], by = {};
  for (const c of cases) {
    let r = null; try { const typed = readable(c.q); r = chatAsk(typed, c.stores, { now: NOW }) || (c.k === "food" ? askLife(typed, c.stores, { now: NOW }) : null); } catch (e) { r = { err: String(e) }; }
    const txt = r ? String(r.en || "") + " " + String(r.ar || "") + " " + String(r.text || "") : "", w = c.want;
    const good = !!r && (w.kind === "owed-in" ? r.kind === "owed-in" && txt.replace(/,/g, "").includes(String(w.amount)) && !/nothing/i.test(r.en || "")
      : w.kind === "food" ? /Food|طعام/.test(txt) && /Related|قريب/.test(txt) && txt.replace(/,/g, "").includes(String(w.g))
      : w.none ? r.kind === "due" && /Nothing saved for/.test(r.en || "")
      : w.date ? r.kind === "due" && r.v && r.v.d === w.date
      : r.kind === "due" && (r.en || "").includes(w.day) && w.titles.every((t) => (r.en || "").includes(t)) && (w.titles.length ? /^(Tomorrow|Today)/.test(r.en) : /^Nothing planned/.test(r.en)));
    by[c.k] = by[c.k] || [0, 0]; by[c.k][1]++; if (good) { ok++; by[c.k][0]++; } else if (bad.length < 40) bad.push(`${c.k} | ${JSON.stringify(c.q)} → ${r ? (r.en || r.err || r.text || "").slice(0, 140) : "null"} | want ${JSON.stringify(w)}`);
  }
  const sh = shapeReport(cases.map((c) => c.q));
  if (!quiet) { console.log(Object.entries(by).map(([k, [a, b]]) => `${k} ${a}/${b}`).join(" · ")); for (const b of bad.slice(0, 25)) console.log("  ✗ " + b); }
  return { ok, total: cases.length, shapes: sh, by, bad };
}
if (import.meta.url === "file://" + process.argv[1]) {
  const r = run(+(process.argv[2] || 10000), +(process.env.SEED_SHIFT || 0));
  console.log(`own-data questions: ${r.ok} / ${r.total} right (${(100 * r.ok / r.total).toFixed(2)} %) · ${r.shapes.shapes} different shapes (${(100 * r.shapes.share).toFixed(1)} %, bar ${100 * SHAPE_BAR} %)`);
}
