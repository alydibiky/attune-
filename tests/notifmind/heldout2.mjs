// v9.9.31 HELD-OUT 2 — written after heldout.mjs was used for fixes, so this is the honest score. Tricky on purpose: sarcasm-free but
// mixed languages, Franco-Arabic, languages code doesn't read (ru / hi / zh / ja — code must say "not sure", never a confident wrong
// reading), money words that are not money, requests inside long messages. Scored: right when code is sure (the number that matters:
// a confident wrong reading is the mistake Ali can't accept) and how many it leaves to the model.   node tests/notifmind/heldout2.mjs
import * as M from "../../web-src/notifmind.js";
export const NOW = Date.parse("2026-11-13T18:00:00");
let k = 0; const n = ([app, pkg], title, text) => ({ id: "q" + (++k), app, pkg, title, text, ts: NOW });
const WA = ["WhatsApp", "com.whatsapp"], TG = ["Telegram", "org.telegram.messenger"], SMS = ["Messages", "com.google.android.apps.messaging"], GM = ["Gmail", "com.google.android.gm"];
export const HELD2 = [
  ["chat", "request", "do", n(WA, "Omar", "law sam7t eb3atli el file bokra")],                        // Franco: please send me the file tomorrow
  ["chat", "question", "reply", n(WA, "Rana", "enta fein?")],
  ["chat", "request", "do", n(WA, "Boss 👔", "Before you leave today, print the two contracts and leave them on my desk. Thanks")],
  ["chat", "info", "none", n(WA, "Sherif", "Just landed ✈️")],
  ["chat", "greeting", "none", n(WA, "Auntie", "كل سنة وانت طيب يا حبيبي ربنا يسعدك")],
  ["chat", "invite", "reply", n(WA, "Hiking club: Ziad", "Join us for the Wadi Degla hike on Saturday 7 AM!")],
  ["chat", "request", "pay", n(WA, "Gym coach", "Reminder to pay this month's subscription, 800 EGP")],
  ["chat", "info", "none", n(WA, "Work team: Nada", "The client paid the 50,000 deposit today 🎉")],
  ["call", "alert", "call_back", n(["Phone", "com.android.dialer"], "Missed call (2)", "Mama")],
  ["bank", "info", "none", n(SMS, "CIB", "Transfer of EGP 2,000.00 to MONA ALI from your account ending 4471 was successful")],
  ["bank", "info", "none", n(SMS, "NBE", "تم سحب 3,000 جنيه من ماكينة الصراف الآلي بالبطاقة ***881")],
  ["bank", "alert", "check", n(SMS, "QNB", "Suspicious transaction blocked on your card ending 7712. Call 19700 if it was you")],
  ["receipt", "confirm", "none", n(GM, "Apple", "Your receipt from Apple. iCloud+ 50GB, USD 0.99")],
  ["bill", "reminder", "pay", n(SMS, "WE", "عميلنا العزيز، فاتورة شهر نوفمبر 450 جنيه، آخر موعد للسداد 25 نوفمبر")],
  ["delivery", "info", "none", n(["Amazon Shopping", "com.amazon.mShop.android.shopping"], "Amazon", "Delivered: your package was left at the front door")],
  ["delivery", "info", "pickup", n(["Bosta", "com.bosta.app"], "Bosta", "Our courier is at your address. Please receive your order")],
  ["food", "info", "none", n(["talabat", "com.talabat"], "talabat", "Your rider is 5 minutes away 🛵")],
  ["travel", "info", "travel", n(["Turkish Airlines", "com.turkishairlines.mobile"], "Turkish Airlines", "Boarding for TK 691 starts at gate F12")],
  ["appointment", "cancel", "none", n(["Vezeeta", "com.vezeeta.patients"], "Vezeeta", "Your appointment with Dr Karim on Sunday has been cancelled by the clinic")],
  ["school", "alert", "none", n(["Seesaw", "com.seesaw.android"], "Seesaw", "School is closed tomorrow due to bad weather")],
  ["government", "reminder", "renew", n(SMS, "Traffic Dept", "رخصة السيارة تنتهي يوم 1 ديسمبر، برجاء التجديد")],
  ["security", "alert", "verify", n(["Microsoft Authenticator", "com.azure.authenticator"], "Microsoft", "Approve sign-in? Someone is trying to sign in to your account")],
  ["code", "info", "none", n(SMS, "Google", "G-482910 is your Google verification code")],
  ["promo", "offer", "none", n(["noon", "com.noon.buyerapp"], "noon", "Yellow Friday is LIVE 💛 up to 70% off")],
  ["news", "info", "read", n(["BBC News", "bbc.mobile.news.ww"], "BBC News", "Storm Bert: thousands without power across the UK")],
  ["social", "info", "none", n(["TikTok", "com.zhiliaoapp.musically"], "TikTok", "sara_k started following you")],
  ["media", "info", "none", n(["Spotify", "com.spotify.music"], "Spotify", "Your Release Radar is ready")],
  ["system", "info", "none", n(["Google Play Store", "com.android.vending"], "Google Play", "12 apps updated")],
  ["smart_home", "alert", "check", n(["Mi Home", "com.xiaomi.smarthome"], "Mi Home", "Water leak detected in the kitchen")],
  ["sports", "info", "none", n(["365Scores", "com.scores365"], "365Scores", "Full time: Real Madrid 3-1 Barcelona")],
  ["markets", "info", "none", n(["Binance", "com.binance.dev"], "Binance", "ETH dropped 7% in 24h")],
  ["job", "info", "none", n(["Wuzzuf", "net.wuzzuf.app"], "Wuzzuf", "5 new jobs match your profile: Accountant")],
  // languages code does not read — code must leave them to the model (never a confident wrong reading)
  ["chat", "request", "do", n(WA, "Дима", "Пришли мне, пожалуйста, договор завтра")],
  ["chat", "question", "reply", n(WA, "राहुल", "तुम कल कितने बजे आओगे?")],
  ["chat", "request", "do", n(WA, "小王", "明天请把合同发给我")],
  ["chat", "invite", "reply", n(WA, "Yuki", "土曜日の夕食に来ませんか？")],
];
export function run() {
  let sure = 0, sureRight = 0, right = 0; const miss = [];
  for (const [cat, intent, action, nn] of HELD2) { const m = M.comprehend(nn, { now: NOW }), ok = m.cat === cat && m.intent === intent && m.action === action;
    if (ok) right++; if (m.sure) { sure++; if (ok) sureRight++; } if (!ok) miss.push((m.sure ? "SURE " : "unsure ") + [m.cat, m.intent, m.action].join("/") + " ≠ " + [cat, intent, action].join("/") + " · " + nn.title + ": " + nn.text); }
  return { n: HELD2.length, right, sure, sureRight, miss };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) { const r = run();
  for (const m of r.miss) console.log("  " + m); console.log(`held-out 2: ${r.right}/${r.n} all right · code sure of ${r.sure} · right when sure ${r.sureRight}/${r.sure}`); }
