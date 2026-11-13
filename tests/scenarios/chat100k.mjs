// v9.9.32 (Ali, 13 Nov 2026: "also 100,000 texts chatting with the chat and ordering it also in a very hard and unique way").
// EXACTLY 100,000 different ORDERS typed into Chat — the hard ways people really order: indirect ("ping me", "nudge me", "can you make
// sure I…"), changing their mind in the middle ("at 5, no wait, 6", "200, sorry I mean 250"), negations ("don't remind me…", "I don't
// owe Ahmed anything"), long stories full of numbers that are not the amount, two orders in one message, pages by any name ("take me to
// my money page"), questions to the AI full of numbers that must NOT be logged, questions about your own money in slang, debts and
// agents said oddly, 7 more languages, Franco. Each is checked for WHAT Chat does and the details (amount, hour, person, direction).
// A sentence the code hands to the phone's model (the referee: two possible kinds, or a kind only the words show) is counted apart as
// "left to the model" — tests/trials/chat100k-model.mjs runs the real model on a sample of exactly those.
//     node tests/scenarios/chat100k.mjs           (100,000 → tests/scenarios/chat100k-report.md)
//     node tests/scenarios/chat100k.mjs 2500      (a sample, same proportions; used by tests/unit/v9932chat.test.mjs)
import fs from "fs";
globalThis.__HARD_IMPORT = true;
const H = await import("./hard.mjs");
const { classify } = await import("./brain.mjs");
const { readable: cleanTyped } = await import("../../web-src/wrapclean.js");
const { money, moneyAll, remind, life, at, plus, NOT, itemsOf, hm, NAMES, NAMES_AR, THINGS, THINGS_AR, PRODUCTS, PLACES, PLACES_AR, TASKS, TASKS_AR, WHEN_EN, WHEN_AR, CITIES, sub, arD } = H;
const NOW = H.NOW, TOTAL = +(process.argv[2] || 100000);
let seed = 20261114; const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const AMT = [15, 25, 35, 45, 55, 60, 75, 85, 95, 110, 120, 135, 145, 150, 165, 175, 180, 210, 220, 240, 250, 275, 290, 300, 320, 350, 380, 420, 450, 480, 520, 550, 600, 650, 720, 780, 800, 850, 950, 1100, 1250, 1400, 1500, 1750, 1900, 2200, 2500, 2750, 3200, 3800];
const BIG = [500, 700, 800, 1000, 1200, 1500, 2000, 2500, 3000, 3500, 4000, 5000, 6000, 6500, 7500, 8000, 9000, 10000, 12000, 15000, 18000, 20000, 25000, 30000, 40000];
const amt = () => pick(AMT), big = () => pick(BIG);
const anyN = () => pick(NAMES), anyNA = () => pick(NAMES_AR);
const task = () => sub(pick(TASKS), { n: anyN() }), taskA = () => sub(pick(TASKS_AR), { n: anyNA() });
const G = []; const add = (name, n, maker) => G.push([name, n, maker]);
const MODEL = Symbol("model");   // accepted when the code leaves it to the model with this kind among the candidates

// A — reminders asked indirectly (English)
add("indirect_remind_en", 9000, () => { const t = task(), [w, ms] = pick(WHEN_EN);
  return [pick([`ping me ${w} to ${t}`, `nudge me ${w} to ${t}`, `give me a shout ${w} to ${t}`, `can you make sure I ${t} ${w}`, `I keep forgetting to ${t}, remind me ${w}`,
    `buzz me ${w} so I ${t}`, `would you mind reminding me ${w} to ${t}`, `I'd love a reminder ${w} to ${t}`, `heads up ${w}: ${t}`, `jog my memory ${w} to ${t}`,
    `make sure you remind me ${w} to ${t}`, `if you could remind me to ${t} ${w} that would be great`, `alert me ${w} to ${t}`, `set an alarm ${w} to ${t}`, `be a dear and remind me ${w} to ${t}`,
    `I really need to ${t} ${w}, remind me please`, `remind me, ${w}, to ${t}`, `${w} I have to ${t}, remind me`, `please don't let me forget to ${t} ${w}`, `reminder please: ${t}, ${w}`]), ["reminder"], remind(ms, "")]; });
// B — reminders asked indirectly (Egyptian Arabic)
add("indirect_remind_ar", 7000, () => { const t = taskA(), [w, ms] = pick(WHEN_AR);
  return [pick([`لو ينفع فكرني ${w} ${t}`, `ابقى فكرني ${w} ${t}`, `متنسانيش ${w} ${t}`, `حطلي تذكير ${w} ${t}`, `خليك فاكرلي ${w} اني ${t}`, `نبهني ${w} عشان ${t}`,
    `انا دايما بنسى ${t}، فكرني ${w}`, `لو سمحت فكرني ${w} ${t}`, `عايز تذكير ${w} ${t}`, `فكرني من فضلك ${w} ${t}`, `${w} لازم ${t} فكرني`, `يا ريت تفكرني ${w} ${t}`]), ["reminder"], remind(ms, "")]; });
// C — changing their mind in the middle: only the corrected value counts
add("corrections", 6000, () => { const a = amt(), b = amt(), w = pick(THINGS), wa = pick(THINGS_AR), t = task(), h1 = int(1, 9), h2 = h1 + int(1, 2); if (a === b) return null;
  return pick([
    [`spent ${a} on ${w}, sorry I mean ${b}`, ["money", "confirm"], money(b)], [`paid ${a} for ${w} — no wait, it was ${b}`, ["money", "confirm"], money(b)], [`${w} ${a}, no actually ${b}`, ["money", "confirm"], money(b)],
    [`${w} ${a} oops I meant ${b}`, ["money", "confirm"], money(b)], [`دفعت ${a} ${wa} لا قصدي ${b}`, ["money", "confirm"], money(b)], [`صرفت ${a} على ${wa}، لا غلطت كانوا ${b}`, ["money", "confirm"], money(b)],
    [`remind me at ${h1} pm, no wait, ${h2} pm to ${t}`, ["reminder"], remind(at(0, 12 + h2), "")], [`remind me tomorrow at ${h1} am, sorry ${h2} am, to ${t}`, ["reminder"], remind(at(1, h2), "")],
    [`فكرني الساعة ${h1} لا قصدي ${h2} بالليل ${taskA()}`, ["reminder"], remind(at(0, h2 + 12 >= 24 ? h2 : h2 + 12), "")]]); });
// D — negations: nothing may be recorded or set
add("negations", 6000, () => { const t = task(), ta = taskA(), n = anyN(), na = anyNA(), a = amt(), w = pick(THINGS);
  return [pick([`don't remind me to ${t}`, `no need to remind me to ${t}`, `you don't have to remind me about ${t} anymore`, `I don't owe ${n} anything`, `${n} doesn't owe me anything anymore`,
    `I didn't spend anything today`, `I didn't pay ${a} for ${w}`, `stop reminding me to ${t}`, `never mind, don't set the reminder`, `${n} and I are even now, no debts`, `I don't want a reminder for ${t}`,
    `متفكرنيش ${ta}`, `مش عايز تذكير ${ta}`, `انا مش مديون ل${na} بحاجة`, `${na} مش عليه حاجة خلاص`, `مصرفتش حاجة النهارده`, `مدفعتش ${a} في ${pick(THINGS_AR)}`, `بطل تفكرني ${ta}`]),
    NOT("money", "life", "reminder", "both"), () => ""]; });
// E — long stories: many numbers, one amount
add("story_spend", 10000, () => { const a = amt(), w = pick(THINGS), wa = pick(THINGS_AR), n = anyN(), p = pick(PLACES), pa = pick(PLACES_AR), k = int(2, 9), r = int(101, 899), h = int(1, 11), m = int(10, 55);
  return [pick([`after the ${k}-hour meeting in room ${r} I grabbed ${w} for ${a}`, `${k} of us went to ${p} at ${h} pm and I paid ${a} for ${w}`, `table ${r} at ${p}: ${w} came to ${a}, I paid it all`,
    `took the ${h}:${m} train, then paid ${a} for ${w} near platform ${k}`, `I paid ${a} for ${w} at ${p}, gate ${k}, order number ${r}`,
    `on my way home at ${h} I stopped at ${p} and spent ${a} on ${w}`, `${n} and I split nothing, I just paid ${a} for ${w} myself`, `long day, ${k} meetings, then ${w} for ${a} at ${p}`,
    `bought ${w} for ${a} for flat ${r}`, `${w} for ${a}, invoice ${r}${k}`, `at ${h}:${m} I paid ${a} EGP for ${w}`,
    `بعد اجتماع ${k} ساعات في اوضة ${r} اشتريت ${wa} ب${a}`, `رحنا ${k} افراد ${pa} الساعة ${h} ودفعت ${a} في ${wa}`, `ترابيزة ${r} في ${pa} الحساب ${a} على ${wa} ودفعته كله`,
    `وانا مروح الساعة ${h} عديت على ${pa} وصرفت ${a} على ${wa}`, `دفعت ${a} ${wa} رقم الطلب ${r}`]), ["money", "confirm"], (r, s) => money(a)(r.k === "confirm" ? { ...r, k: "money" } : r, s)]; });
// F — two orders in one message: both done
add("two_orders_hard", 6000, () => { const a = amt(), w = pick(THINGS), t = task(), [wh, ms] = pick(WHEN_EN.slice(0, 16)), wa = pick(THINGS_AR), ta = taskA(), [wha, msa] = pick(WHEN_AR.slice(0, 12));
  const [s, when] = pick([[`${w} ${a} — oh and remind me ${wh} to ${t}`, ms], [`remind me ${wh} to ${t}; also spent ${a} on ${w}`, ms], [`spent ${a} on ${w}. Also please remind me ${wh} to ${t}`, ms],
    [`paid ${a} for ${w} and don't let me forget to ${t} ${wh}`, ms], [`صرفت ${a} على ${wa} وفكرني ${wha} ${ta}`, msa], [`فكرني ${wha} ${ta} ودفعت ${a} ${wa}`, msa]]);
  return [s, ["both"], (r) => { const it = r.parts ? r.parts.money : []; if (!it.some((x) => Math.abs(x - a) < 0.01)) return "payment " + a + " not recorded"; return !r.parts.at || hm(r.parts.at) !== hm(when) ? "reminder time " + (r.parts.at ? hm(r.parts.at) : "none") + " ≠ " + hm(when) : ""; }]; });
// G — pages by any name
const PG = [["money", "Money", "الفلوس"], ["reminders", "reminders", "التذكيرات"], ["agents", "agents", "الوكلاء"], ["settings", "settings", "الاعدادات"], ["timeline", "follow-ups", "المتابعات"],
  ["lists", "to-do list", "المهام"], ["booklib", "documents", "المستندات"], ["health", "health", "الصحة"], ["family", "family", "العيلة"], ["habits", "habits", "العادات"], ["projects", "projects", "المشاريع"], ["tools", "tools", "الادوات"]];
add("open_pages", 5000, () => { const [id, en, ar] = pick(PG);
  return [pick([`open ${en}`, `take me to my ${en} page`, `show me the ${en} screen`, `can you open ${en}`, `pull up ${en}`, `bring up my ${en}`, `open up the ${en} tab`, `go to ${en} please`, `I want to see my ${en}`,
    `jump to ${en}`, `switch to ${en}`, `open the ${en} section`, `افتح ${ar}`, `افتحلي ${ar}`, `وديني على ${ar}`, `وريني ${ar}`, `افتحلي صفحة ${ar}`, `عايز اشوف ${ar}`, `روح على ${ar}`]), id === "lists" ? ["open", "todo"] : ["open"], () => ""]; });   // the to-do card IS the list
// H — questions to the AI that are full of numbers: nothing may be logged or set
add("ai_questions_numbers", 10000, () => { const a = amt(), b = big(), w = pick(THINGS), n = anyN(), p = pick(PRODUCTS), c = pick(CITIES), k = int(2, 12), pc = pick([5, 8, 10, 12, 15, 20]);
  return [pick([`if I invest ${b} at ${pc}% for ${k} years how much will I have?`, `my colleague spends ${a} a month on ${w}, is that crazy?`, `${n} paid ${a} for ${w}, is that normal?`, `is ${a} too much for ${w} in ${c}?`,
    `how many months to save ${b} if I put away ${a} a month?`, `what's a fair price for ${p}? I saw it for ${b}`, `should I pay ${b} for ${p} or wait for black friday?`, `explain why ${w} went from ${a} to ${a * 2} in ${k} years`,
    `write a polite message asking ${n} for the ${b} he owes me`, `how do I tell my landlord the rent of ${b} is too high?`, `can you help me plan a ${k}-day trip to ${c} with ${b}?`, `what's ${pc}% tip on ${a}?`,
    `is a ${b} salary good for a family of ${k} in ${c}?`, `how much protein is in ${a} grams of chicken?`, `what can I cook with ${k} eggs and ${a} grams of rice?`, `who scored ${k} goals in one match?`,
    `هو ${b} مرتب كويس لعيلة من ${k} افراد؟`, `صاحبي دفع ${a} في ${pick(THINGS_AR)} ده طبيعي؟`, `لو حوشت ${a} كل شهر هوصل ل${b} امتى؟`, `اكتبلي رسالة ل${anyNA()} اطلب منه ال${b} اللي عليه`, `هل ${p} يستاهل ${b}؟`]),
    NOT("money", "life", "reminder", "both", "deadline"), () => ""]; });
// I — questions about your own money and plans, in slang
add("own_data_questions", 7000, () => { const cat = pick(["coffee", "food", "uber", "groceries", "eating out", "clothes", "transport", "bills", "restaurants", "taxis"]), per = pick(["this week", "last week", "this month", "last month", "yesterday", "today", "since the 1st"]), n = anyN(), na = anyNA();
  return [pick([`how much did I blow on ${cat} ${per}?`, `how much have I burned on ${cat} ${per}?`, `what did ${cat} cost me ${per}?`, `how much went on ${cat} ${per}?`, `what's my ${cat} total ${per}?`,
    `who still owes me cash?`, `does ${n} still owe me anything?`, `how much do I owe ${n}?`, `how much money is left this month?`, `what's left in my budget?`, `how much did I earn ${per}?`,
    `صرفت كام على ${pick(["القهوة", "الاكل", "اوبر", "الخضار", "المواصلات"])} ${pick(["الاسبوع ده", "الشهر ده", "امبارح", "النهارده"])}؟`, `${na} لسه عليه حاجة؟`, `عليا كام ل${na}؟`, `فاضلي كام الشهر ده؟`]),
    ["money-ask", "ask:owed-in", "ask:owed-out", "ask:money", "ask:life", "ask:bills", "ask:subs", "ask:today", MODEL], () => ""]; });
// J — debts said oddly
add("debts_odd", 8000, () => { const n = anyN(), na = anyNA(), a = big(), d = pick(["Friday", "next week", "the end of the month", "Sunday"]), m = pick(["October", "the summer", "Ramadan", "last month"]);
  const [s, dir, who] = pick([[`lent ${n} ${a} bucks yesterday, he'll return it ${d}`, "in", n], [`${n} still hasn't paid back the ${a} from ${m}`, "in", n], [`gave ${n} ${a} till ${d}`, "in", n],
    [`${n} borrowed ${a} from me for ${pick(["the car", "rent", "the wedding", "a trip"])}`, "in", n], [`I borrowed ${a} from ${n}, I'll pay it back ${d}`, "out", n], [`${n} covered my ${a} for ${pick(["dinner", "the tickets", "the hotel"])}, I owe him`, "out", n],
    [`${n} fronted me ${a}`, "out", n], [`I still owe ${n} ${a} from ${m}`, "out", n], [`${na} لسه مرجعليش ال${a}`, "in", ""], [`سلفت ${na} ${a} لحد ${pick(["الجمعة", "اخر الشهر", "الاسبوع الجاي"])}`, "in", ""],
    [`${na} سلفني ${a} وهرجعهم ${pick(["الجمعة", "اخر الشهر"])}`, "out", ""], [`لسه عليا ل${na} ${a} من ${pick(["رمضان", "الشهر اللي فات"])}`, "out", ""]]);
  return [s, ["life", "confirm", MODEL], life({ dir, total: a, ...(who ? { person: who } : {}) })]; });
// K — agents said oddly
add("agents_odd", 6000, () => { const p = pick(PRODUCTS), a = pick([3000, 5000, 9000, 15000, 20000, 25000, 45000, 60000]), pa = pick(["ايفون 16", "بلايستيشن 5", "سماعة ابل", "لابتوب لينوفو", "ساعة هواوي"]);
  return [pick([`ping me if ${p} dips below ${a}`, `keep tabs on ${p} for me, max ${a}`, `let me know the moment ${p} drops under ${a}`, `watch ${p} and tell me when it's below ${a}`, `I'm waiting for ${p} to go under ${a}, watch it`,
    `alert me when ${p} is cheaper than ${a}`, `track the price of ${p} please, my limit is ${a}`, `لو ${pa} نزل تحت ${a} قولي`, `تابعلي سعر ${pa} ولما يبقى اقل من ${a} نبهني`, `عرفني لما ${pa} يبقى بأقل من ${a}`]),
    ["agent", MODEL], () => ""]; });
// L — seven more languages: payments and reminders
const OL = {
  es: { spend: ["gasté {a} en {w}", "pagué {a} por {w}", "{w} {a} euros"], w: ["el almuerzo", "la cena", "un taxi", "el café", "la gasolina", "el supermercado"], remind: ["recuérdame mañana a las {h} {t}", "recuérdame en 2 horas {t}"], t: ["llamar a {n}", "pagar la luz", "tomar la medicina"] },
  fr: { spend: ["j'ai payé {a} pour {w}", "j'ai dépensé {a} pour {w}", "{w} {a} euros"], w: ["le déjeuner", "le dîner", "un taxi", "le café", "l'essence", "les courses"], remind: ["rappelle-moi demain à {h}h de {t}", "rappelle-moi dans 2 heures de {t}"], t: ["appeler {n}", "payer l'électricité", "prendre le médicament"] },
  de: { spend: ["ich habe {a} euro für {w} bezahlt", "{a} euro für {w} ausgegeben", "{w} {a} euro"], w: ["Mittagessen", "Abendessen", "ein Taxi", "Kaffee", "Benzin", "Lebensmittel"], remind: ["erinnere mich morgen um {h} daran, {t}", "erinnere mich in 2 Stunden daran, {t}"], t: ["{n} anzurufen", "den Strom zu bezahlen", "die Medizin zu nehmen"] },
  pt: { spend: ["gastei {a} no {w}", "paguei {a} pelo {w}", "{w} {a} reais"], w: ["almoço", "jantar", "táxi", "café", "combustível", "mercado"], remind: ["me lembre amanhã às {h} de {t}", "me lembra em 2 horas de {t}"], t: ["ligar para {n}", "pagar a luz", "tomar o remédio"] },
  it: { spend: ["ho speso {a} per {w}", "ho pagato {a} per {w}", "{w} {a} euro"], w: ["il pranzo", "la cena", "un taxi", "il caffè", "la benzina", "la spesa"], remind: ["ricordami domani alle {h} di {t}", "ricordami tra 2 ore di {t}"], t: ["chiamare {n}", "pagare la luce", "prendere la medicina"] },
  tr: { spend: ["{w} için {a} lira ödedim", "{w} {a} lira", "{w} için {a} lira harcadım"], w: ["öğle yemeği", "akşam yemeği", "taksi", "kahve", "benzin", "market"], remind: ["yarın saat {h}'da {t} hatırlat", "2 saat sonra {t} hatırlat"], t: ["{n}'i aramayı", "elektriği ödemeyi", "ilacımı almayı"] },
  id: { spend: ["bayar {a} untuk {w}", "habis {a} buat {w}", "{w} {a} ribu"], w: ["makan siang", "makan malam", "taksi", "kopi", "bensin", "belanja"], remind: ["ingatkan aku besok jam {h} untuk {t}", "ingatkan aku 2 jam lagi untuk {t}"], t: ["telepon {n}", "bayar listrik", "minum obat"] },
};
add("other_languages", 14000, () => { const L = pick(Object.keys(OL)), o = OL[L], a = int(12, 980), w = pick(o.w), h = int(6, 11), n = pick(NAMES);
  if (rnd() < 0.6) { const s = sub(pick(o.spend), { a, w }), want = /ribu/.test(s) ? a * 1000 : a; return [s, ["money", MODEL], (r) => (r.k === "money" ? money(want)(r, s) : "")]; }   // "ribu" = thousand
  return [sub(pick(o.remind), { t: sub(pick(o.t), { n }), h }), ["reminder", MODEL], () => ""]; });
// M — Franco, hard
add("franco_hard", 6000, () => { const a = amt(), w = pick(["ghada", "3asha", "fetar", "ahwa", "taxi", "uber", "banzeen", "khodar", "kahraba", "dawa", "gym", "pizza", "7ala2", "hedoom"]), n = pick(["mama", "baba", "ahmed", "sara", "omar", "mona"]);
  return pick([[pick([`ya attune sraft ${a} 3ala el ${w} enharda`, `bos ana dafa3t ${a} fel ${w}`, `el ${w} enharda kan b ${a} geneh ya3ni`, `dafa3t ${a} geneh ${w} w khalas`, `${w} ${a} geneh shokran`, `sraft ${a} 3al ${w} el sob7`]), ["money"], money(a)],
    [pick([`fakarny bokra el sa3a 9 el sob7 akalem ${n} law sama7t`, `ya attune fakarny kaman sa3a akalem ${n}`, `fakarny ba3d bokra el sa3a 10 el sob7 akalem ${n}`, `nabehny bokra el sa3a 7 el sob7 akalem ${n}`]), ["reminder"], remind(null, "")]]); });

// ---- make exactly TOTAL different sentences -------------------------------------------------------------------------------------------
const full = G.reduce((s, g) => s + g[1], 0); if (full !== 100000) throw new Error("the groups add up to " + full + ", not 100000");
const seen = new Set(), rows = [];
const PRE = ["", "", "", "", "hey attune, ", "ok so ", "pls ", "btw ", "quick one - "], PRE_AR = ["", "", "", "", "يا أتيون، ", "بقولك ", "طيب "], SUF = ["", "", "", "", " thanks", " 🙏", "!!", "...", " ty"], SUF_AR = ["", "", "", "", " شكرا", " 🙏", "!!", " لو سمحت"];
for (const [name, n0, maker] of G) { const n = Math.round(n0 * TOTAL / 100000); let made = 0, tries = 0;
  while (made < n) { if (tries++ > n * 800) throw new Error(name + ": only " + made + " different sentences of " + n);
    const m = maker(); if (!m) continue; let [s, accept, chk] = m; if (!s) continue;
    if (tries > n * 2) { const ar = /[؀-ۿ]/.test(s); s = pick(ar ? PRE_AR : PRE) + s + pick(ar ? SUF_AR : SUF); }   // more variety once the plain ones run out
    if (seen.has(s)) continue; seen.add(s); made++;
    let r; try { r = classify(s, { now: NOW, both: true }); } catch (e) { r = { k: "THROW " + e.message }; }
    // the referee was unsure and asks the phone's model: right here only when the right kind is among the model's choices
    const LBL = { money: "money-log", reminder: "action", life: "life", agent: "agent", open: "chat", "money-ask": "money-ask", deadline: "deadline", both: "money-log" };
    const okKinds = accept.not ? null : accept.filter((x) => x !== MODEL);
    const modelOk = !accept.not && !!r.unsure && !okKinds.includes(r.k) && (r.cands || []).some((c) => okKinds.some((k) => LBL[k] === c || (/^ask:/.test(k) && c === "money-ask")));
    const wrongKind = accept.not ? accept.not.includes(r.k) : !okKinds.includes(r.k) && !modelOk; let why = "";
    if (!wrongKind && !modelOk) { try { why = chk(r, cleanTyped(s)) || ""; } catch (e) { why = "check threw " + e.message; } }
    rows.push({ g: name, s, want: accept.not ? "chat" : ({ money: "money-log", reminder: "action", both: "money-log", confirm: "money-log" }[okKinds[0]] || okKinds[0]), k: r.k, model: modelOk, cands: r.cands, ok: !wrongKind && !why, why: wrongKind ? "→ " + r.k + (r.sub ? "/" + r.sub : "") : why.replace(/\d+(\.\d+)?/g, "N").replace(/“[^”]*”/g, "“…”") }); } }
if (new Set(rows.map((r) => r.s)).size !== rows.length) throw new Error("duplicate sentences");
const by = {}; for (const r of rows) { const b = (by[r.g] = by[r.g] || { n: 0, bad: 0, model: 0, ex: {} }); b.n++; if (r.model) b.model++; if (!r.ok) { b.bad++; (b.ex[r.why] = b.ex[r.why] || []).push(r.s); } }
const total = rows.length, bad = rows.filter((r) => !r.ok).length, toModel = rows.filter((r) => r.model).length;
let md = `# 100,000 chat orders — ${total} orders, ${total - bad} right (${(100 * (total - bad) / total).toFixed(2)}%)\n\nEvery order is different (checked). "Left to the model" = the code saw two possible kinds (or a kind only the words show) and the phone's model picks — counted right here only when the right kind is among its choices; the real model is tried on a sample by tests/trials/chat100k-model.mjs. ${toModel} orders (${(100 * toModel / total).toFixed(1)}%) were left to the model.\n\n| group | orders | wrong | left to the model | right % |\n|---|---|---|---|---|\n`;
for (const [g, b] of Object.entries(by).sort((a, b) => b[1].bad / b[1].n - a[1].bad / a[1].n)) md += `| ${g} | ${b.n} | ${b.bad} | ${b.model} | ${(100 * (b.n - b.bad) / b.n).toFixed(2)} |\n`;
md += "\n## What went wrong (examples of each)\n";
for (const [g, b] of Object.entries(by)) if (b.bad) { md += `\n### ${g}\n`; for (const [why, ex] of Object.entries(b.ex).sort((a, b) => b[1].length - a[1].length).slice(0, 12)) md += `- **${why}** × ${ex.length}: ${ex.slice(0, 6).map((x) => "«" + x.replace(/\n/g, " ⏎ ") + "»").join(" · ")}\n`; }
if (TOTAL === 100000) fs.writeFileSync(new URL("./chat100k-report.md", import.meta.url), md);
if (process.env.CHAT_JSON) fs.writeFileSync(process.env.CHAT_JSON, JSON.stringify(rows));
console.log(md.split("\n## What")[0]);
