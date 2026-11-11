// v9.9.18 AU1 held-out: phrasings written AFTER the rules reader passed its 10,000 — different words, orders and names than gen.mjs.
// Each: [sentence, expected trigger type, expected action types, extra check]. A miss here is fixed by its CLASS, never one sentence.
import { parseRule } from "../../web-src/rules.js";
const ctx = { people: [{ id: "karim", name: "Karim", aka: ["كريم"] }, { id: "mama", name: "Mama", role: "mother", aka: ["ماما", "mum", "mom", "maman", "mamá", "mamma", "мама", "anne", "ibu", "माँ", "امی", "مامان", "মা", "mama", "แม่", "mẹ", "妈妈", "お母さん", "엄마"] }],
  places: [{ id: "office", name: "the office", aka: ["office", "المكتب", "الشغل", "bureau", "oficina", "büro", "escritório", "ufficio", "офис", "ofis", "kantor", "ऑफिस", "دفتر", "অফিস", "ofisi", "ออฟฟิศ", "văn phòng", "公司", "会社", "회사"] }],
  devices: [{ id: "car", name: "Car audio", aka: ["car"] }], pots: [{ id: "emergency", name: "Emergency", aka: ["emergency fund", "الطوارئ", "urgence", "emergencia", "notfall", "emergência", "emergenza", "чп", "acil", "darurat", "आपातकाल", "ایمرجنسی", "اضطراری", "জরুরি", "dharura", "ฉุกเฉิน", "khẩn cấp", "应急", "緊急", "비상"] }] };
const C = [
  ["Whenever Mama calls, put my phone on silent", "call", ["silent"]],
  ["if Karim texts me on WhatsApp let me know", "message", ["tell"]],
  ["every Friday at 8am remind me to call Karim", "time", ["remind"]],
  ["When I get to the office, show me my to-do list", "arrive", ["show"]],
  ["as soon as my paycheck lands, move 15% to Emergency", "money_in", ["pot"]],
  ["When I leave the office remind me to buy bread", "leave", ["remind"]],
  ["لو ماما كلمتني خلي الموبايل سايلنت", "call", ["silent"]],
  ["اول ما اوصل المكتب فكرني اكلم كريم", "arrive", ["remind"]],
  ["كل جمعة الساعة 10 الصبح فكرني بالجمعية", "time", ["remind"]],
  ["لما مرتبي ينزل حط 10% في صندوق الطوارئ", "money_in", ["pot"]],
  ["Quand maman m'appelle, mets le téléphone en silencieux", "call", ["silent"]],
  ["Tous les lundis à 9 h, rappelle-moi de payer le loyer", "time", ["remind"]],
  ["Cuando mi mamá me llame, ponme el teléfono en silencio", "call", ["silent"]],
  ["Cada viernes a las 8, recuérdame sacar la basura", "time", ["remind"]],
  ["Wenn Mama anruft, schalte das Handy lautlos", "call", ["silent"]],
  ["Jeden Montag um 7 Uhr erinnere mich an den Müll", "time", ["remind"]],
  ["Quando a mamãe ligar, coloque o celular no silencioso", "call", ["silent"]],
  ["Quando arriva lo stipendio metti il 10% nel fondo emergenza", "money_in", ["pot"]],
  ["Когда мама позвонит, включи беззвучный", "call", ["silent"]],
  ["Каждый понедельник в 9:00 напомни заплатить за квартиру", "time", ["remind"]],
  ["Annem aradığında telefonu sessize al", "call", ["silent"]],
  ["Setiap Senin jam 7 ingatkan aku bayar sewa", "time", ["remind"]],
  ["जब माँ कॉल करे तो फोन साइलेंट कर दो", "call", ["silent"]],
  ["جب امی کال کرے فون سائلنٹ کر دو", "call", ["silent"]],
  ["وقتی مامان زنگ بزنه گوشی رو بی صدا کن", "call", ["silent"]],
  ["যখন মা কল করলে ফোন সাইলেন্ট করো", "call", ["silent"]],
  ["Mama akinipigia, weka simu kimya", "call", ["silent"]],
  ["เมื่อแม่โทรมา ให้ปิดเสียงโทรศัพท์", "call", ["silent"]],
  ["Khi mẹ gọi, để điện thoại im lặng", "call", ["silent"]],
  ["妈妈打电话来时，把手机静音", "call", ["silent"]],
  ["お母さんから電話が来たらマナーモードにして", "call", ["silent"]],
  ["엄마가 전화하면 무음으로 해줘", "call", ["silent"]],
  ["when I plug in my phone at night start a 30 minute timer", "charging", ["timer"]],
  ["when my car connects, read my tasks", "bluetooth", ["read"]],
  ["كل يوم الساعة 9 بالليل اقرالي مهام بكرة", "time", ["read"]],
  ["What's the time in London?", null, []],
  ["I had pizza for 120", null, []],
  ["Mona is my sister", null, []],
  ["عايز اعرف الجو بكرة", null, []],
  ["Combien j'ai dépensé ce mois-ci ?", null, []],
];
let ok = 0; const miss = [];
for (const [s, wt, wa] of C) { const r = parseRule(s, ctx);
  const good = wt === null ? r === null : r && r.when && r.when.type === wt && wa.every((a) => (r.do || []).some((d) => d.type === a)) && !(r.ask || []).length;
  if (good) ok++; else miss.push(s + "  →  " + JSON.stringify(r && { when: r.when && r.when.type, do: (r.do || []).map((d) => d.type), ask: (r.ask || []).map((a) => a.field) })); }
console.log(`held-out: ${ok} of ${C.length} right (${(100 * ok / C.length).toFixed(1)}%)\n` + miss.map((m) => "  ✗ " + m).join("\n"));
{ const r = parseRule("when mum calls, message Karim \"I'm driving\"", ctx); const ok2 = r && r.when.type === "call" && r.when.who === "mama" && r.do.some((d) => d.type === "message" && d.who === "karim");
  console.log((ok2 ? "PASS" : "FAIL") + " two people: mum calls → message Karim  " + JSON.stringify(r && { when: r.when, do: r.do })); }
