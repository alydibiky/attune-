// v9.0 (Ali: "make the app perfect and really smart"): the sentence bank — real sentences in English, Egyptian Arabic and
// Franco, read by the same readers Chat uses (understand.js referee, doit.js Home reader, Franco → Arabic). Each must land where it
// belongs. Every sentence Ali shows that went wrong is added here.
import { looksLikeAction } from "../../web-src/actions.js";
import { myMoneyIntent } from "../../web-src/myledger.js";
import { parsePayment } from "../../web-src/yusr/paytext.js";
import { looksLikeCalc } from "../../web-src/calc.js";
import { chatDeadlineIntent } from "../../web-src/deadlines.js";
import { chatLifeIntent } from "../../web-src/life.js";
import { parseAgent } from "../../web-src/agents.js";
import { understand as doU } from "../../web-src/doit.js";
import { signalsOf, decide, looksFranco, francoToArabic } from "../../web-src/understand.js";
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } };
const now = Date.parse("2026-11-02T20:00:00");
const DO_HERE = ["money", "food", "water", "weight", "workout", "dose", "sugar", "bp", "sleep", "repay", "pot", "family"];
const route = (t0) => {
  let t = t0;
  if (looksFranco(t0)) { const a = francoToArabic(t0); if (a !== t0 && (looksLikeAction(a) || doU(a, { now }).actions.length || myMoneyIntent(a) || chatLifeIntent(a))) t = a; }
  const p = parsePayment(t, { now }), dk = (() => { const u = doU(t, { now }); return u.ask ? [] : u.actions.map((a) => a.kind); })();
  let ag = null; try { ag = parseAgent(t, { country: "EG", now }); } catch (e) {}
  const f = { action: !!looksLikeAction(t), "money-log": !!((p && p.ok) || dk.some((k) => DO_HERE.includes(k))) && !/[?؟]\s*$/.test(t), "money-ask": !!myMoneyIntent(t), calc: !!looksLikeCalc(t),
    agent: !!(ag && ["watch", "buy", "track", "order"].includes(ag.kind)), deadline: !!chatDeadlineIntent(t, { now, home: "EGP", order: "dmy" }), life: !!chatLifeIntent(t) };
  const sig = signalsOf(t, f), fl = new Set(Object.entries(f).filter(([k, v]) => v && sig.has(k)).map(([k]) => k)), d = decide(sig, t, {}, fl);
  return d.unsure ? { ask: d.candidates, fallback: d.fallback } : { kind: d.pick || "chat" };
};
const BANK = {
  action: ["remind me tomorrow at 9 to call the bank", "Remind me on the last day of each month to pay interest for mom", "set an alarm for 6:30", "wake me up at 7", "فكرني بكرة الساعة 9 اكلم ماما", "فكرني ادفع الكهربا يوم 1", "صحيني الساعة 6 ونص",
    "fakarny bokra el sa3a 9 akalem mama", "remind me every friday to call my grandmother", "call Ahmed", "send Mahmoud on WhatsApp that I'll be late", "ابعت لأحمد واتساب اني هتأخر", "timer 10 minutes", "remind me in 20 minutes to take the food out", "فكرني بعد ساعتين اشرب الدوا"],
  "money-log": ["lunch 150", "taxi 60", "paid 200 for lunch", "spent 500 on groceries at carrefour", "غدا 150", "دفعت 300 بنزين", "صرفت 1200 في كارفور", "المرتب 25000", "got my salary 25000", "uber 85", "ghada 150", "breakfast 80", "فطار 60", "koshary for lunch, 80 pounds", "drank 2 glasses of water", "weight 82"],
  "money-ask": ["how much did I spend this month?", "how much did I spend on food this week", "what are my expenses in the last 4 days", "صرفت كام الشهر ده؟", "صرفت كام على الأكل الأسبوع ده", "how much did I earn in October?"],
  agent: ["tell me when Huawei FreeClip 2 is under 8400", "buy me AirPods Pro 2 under 9000", "tell me when hotels near the Haram are under 45k for 4 nights from 10 December", "tell me when my Amazon order arrives", "order my usual from Talabat"],
  deadline: ["my Netflix trial ends on 20 November", "my car license expires on 15 December", "رخصة العربية بتخلص يوم 15 ديسمبر"],
  life: ["Ahmed owes me 12,000, 1,000 a month for a year", "أحمد عليه 12000 ألف كل شهر", "I borrowed 5000 from Sara", "جمعية ٢٠٠٠ في الشهر لمدة ١٠ شهور ودوري الرابع"],
  calc: ["15% of 2400", "2400 * 12", "what is 350 + 275 + 1200", "كام 15% من 2400"],
  chat: ["what is the capital of France?", "explain photosynthesis simply", "اشرحلي النسبية ببساطة", "write me a poem about the sea", "how do I make koshary?", "what's the best alarm clock app?", "what should I eat for dinner?", "who won the world cup in 2022?", "had lunch", "lunch with Ahmed tomorrow"],
};
// a sentence with two kinds goes to the phone's model; it counts as right when its answer can be the right one and, without a model,
// the fallback is right too
const AGENT_ASK_OK = new Set(["نبهني لما الايفون 16 ينزل أقل من 40 ألف", "اشتريلي ايربودز برو 2 بأقل من 9000"]);
let n = 0;
for (const [want, list] of Object.entries(BANK)) for (const t of list) {
  n++; const r = route(t);
  const right = r.kind ? r.kind === want || (want === "money-log" && r.kind === "money-log") : r.ask.includes(want) && (want === "chat" || r.fallback === want);
  ok(right, `"${t}" should be ${want}, got ${JSON.stringify(r)}`);
}
for (const t of AGENT_ASK_OK) { n++; const r = route(t); ok(r.kind === "agent" || (r.ask && r.ask.includes("agent")), `"${t}" can be an agent: ${JSON.stringify(r)}`); }
console.log(bad ? bad + " FAILED" : `PASS v908bank: ${n} real sentences land where they belong`);
