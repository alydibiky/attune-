// v10.9 (Ali, 22 Nov 2026: "do the notifications to 100 percent"). The 10,000-notification run was 100 % — on notifications written HERE.
// This run is the REAL ones: 90 distinct Egyptian bank / wallet / InstaPay / Vodafone Cash / Fawry SMS (and the wallet's own adverts, OTPs,
// declined payments and withdrawal requests) taken from the test data of public, MIT-licensed SMS-parser projects (ahmedoshelmy/qirsh,
// Ziadtareks/paysync-gateway, abdoSobhy1/financy-mobile-app and two more read for their message samples only) — names, phone and account
// numbers replaced. The first run on them found 14 real bugs (an incoming «تحويل إنستاباي وارد» read as money OUT, «لحسابكم» missed after
// "1,500.00", the Vodafone Cash balance taken as the withdrawal, a withdrawal REQUEST counted, a card limit as a Spotify price…), fixed
// generally in paytext.js / notifwords.js / autopilot.js. Truth = each message read by hand (tests/notifs/real-eg.json "want").
// Each real message is then sent ~110 more times the way phones really deliver it: another sender name, the bank's app instead of
// Messages, cut off, with direction marks / Arabic-Indic digits / line breaks (tests/lib/hard.mjs, SMS mode) → 10,000 cases.
//   node tests/notifs/real.mjs        (N=2500 for the unit test)
import fs from "fs";
import { harden, shapeReport, SHAPE_BAR } from "../lib/hard.mjs";
const { act, setCountry } = await import("./brain.mjs");
setCountry("EG");
const N = +(process.env.N || 10000);
const REAL = JSON.parse(fs.readFileSync(new URL("./real-eg.json", import.meta.url), "utf8"));
let seed = 4049; const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const SENDERS = ["CIB", "NBE", "BanqueMisr", "Banque Misr", "QNB ALAHLI", "HSBC", "AAIB", "Vodafone Cash", "VF-Cash", "InstaPay", "19623", "AlexBank", "Fawry", "BM"];
const APPS = [["Messages", "com.google.android.apps.messaging"], ["Messages", "com.samsung.android.messaging"], ["CIB Mobile", "com.cib.digital"], ["Vodafone Cash", "com.vodafone.cash"], ["InstaPay", "com.egyptianbanks.instapay"]];
const ts = new Date("2026-11-20T12:00").getTime();
const cases = [];
for (let i = 0; i < N; i++) {
  const r = REAL[i % REAL.length], first = i < REAL.length;
  const [app, pkg] = first ? APPS[0] : pick(APPS);
  let text = first ? r.text : harden(r.text, rnd, { lang: /[؀-ۿ]/.test(r.text) ? "ar" : "en", sms: true, allowCut: rnd() < 0.3, keep: r.want ? new RegExp(String(r.want.amount).replace(".", "\\.")) : null });
  const title = first ? r.from || "Bank" : rnd() < 0.7 ? (r.from || pick(SENDERS)) : pick(SENDERS);
  cases.push({ n: { id: "r" + i, app, pkg, title, text, ts }, want: r.want, real: first, src: r.text });
}
let ok = 0, okReal = 0; const fails = [];
const lat = (x) => Number(String(x));
for (const c of cases) {
  const a = act(c.n);
  // what Money keeps: the payment's amount and direction (or nothing at all for an advert / OTP / declined / a request)
  const got = a.money ? { dir: a.money.dir, amount: lat(a.money.amount) } : null;
  // a message cut short may lose its amount: then nothing is a right answer (never a wrong amount)
  const cut = /…$/.test(c.n.text) && !c.real;
  const good = c.want == null ? !got && !(a.card === "expense" || a.card === "income" || a.card === "subscription") : got ? got.dir === c.want.dir && Math.abs(got.amount - c.want.amount) < 0.01 : cut;
  if (good) { ok++; if (c.real) okReal++; } else if (fails.length < 60) fails.push(`${c.real ? "[REAL] " : ""}${JSON.stringify(c.n.title + ": " + c.n.text).slice(0, 220)} — want ${JSON.stringify(c.want)}, got ${JSON.stringify(got)} card ${a.card}`);
}
const sh = shapeReport(cases.map((c) => c.n.text));
console.log(`real messages ${okReal}/${REAL.length} · with phone variations ${ok}/${N} = ${(100 * ok / N).toFixed(2)} % · shapes ${(100 * sh.share).toFixed(1)} % (bar ${SHAPE_BAR * 100} %)`);
if (fails.length) console.log(fails.slice(0, +(process.env.SHOW || 30)).join("\n"));
export const RESULT = { ok, n: N, okReal, nReal: REAL.length, share: sh.share };
