// v10.8 (launch; Ali has no testers for the other languages, so each meaning is checked here): a short English word means what
// the screen means — "Left" in the month plan is the money LEFT (it was the direction in all 20 languages, like «شمال» before);
// "Start" is only on buttons now (a verb); "Details" opens the details (not a bank statement's "description"); Japanese "Clear"
// was «他のアプリから保存»; "Didn't come" is a person who didn't come.
const L = { ar: "AR", arb: "ARB", es: "ES", fr: "FR", de: "DE", pt: "PT", it: "IT", ru: "RU", tr: "TRK", id: "IDN", hi: "HI", ur: "UR", fa: "FA", bn: "BN", sw: "SW", th: "TH", vi: "VI", zh: "ZH", ja: "JA", ko: "KO" };
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const DIR = /شمال|اليسار|izquierda|gauche|links|esquerda|sinistra|слева|^sol$|^kiri$|बाएँ|بائیں|^چپ$|বাঁ|kushoto|ซ้าย|^trái$|左|왼쪽/i;
const NOUN_START = /^(inicio|début|beginn|начало|başlangıç|शुरुआत|آغاز|mwanzo|البداية|início|inizio)$/i;
for (const [l, nm] of Object.entries(L)) {
  const d = (await import("../../web-src/i18n-" + l + ".js"))[nm];
  ok(d.Left && !DIR.test(d.Left), l + ": month plan “Left” = money left, not the direction: " + d.Left);
  ok(d.Start && !NOUN_START.test(d.Start), l + ": “Start” on a button is a verb: " + d.Start);
  ok(d.Planned && d["Start date"], l + ": “Planned” and “Start date” have their own lines");
}
const JA = (await import("../../web-src/i18n-ja.js")).JA; ok(JA.Clear === "クリア", "ja: Clear = クリア");
const DE = (await import("../../web-src/i18n-de.js")).DE; ok(DE["Didn't come"] === "Nicht gekommen", "de: “Didn't come” is a person");
for (const [l, nm] of [["es", "ES"], ["it", "IT"], ["tr", "TRK"], ["id", "IDN"]]) { const d = (await import("../../web-src/i18n-" + l + ".js"))[nm]; ok(!/concepto|descrizione|açıklama|keterangan/i.test(d.Details), l + ": “Details” = details: " + d.Details); }
ok(DE.Emergency === "Notfall" && DE.Jobs === "Aufgaben", "de: the emergency card is «Notfall» (not savings); night jobs «Aufgaben»");
{ const ZH = (await import("../../web-src/i18n-zh.js")).ZH; ok(ZH.Jobs === "任务", "zh: night jobs = 任务 (not work orders)"); }
{ const fs = await import("fs"); const pl = fs.readFileSync(new URL("../../web-src/paylog-ui.jsx", import.meta.url), "utf8"), mp = fs.readFileSync(new URL("../../web-src/money-pages-ui.jsx", import.meta.url), "utf8");
  ok(!/tr\("Review"\)/.test(pl), "payments: “Check” (Review read as “revise for an exam” in 7 languages)");
  ok(/tr\("Zakāt certificate"\)/.test(mp), "Zakāt: its own “certificate” line (ja «資格» is a qualification, for the CV)"); }
{ const g = async (l, n) => (await import("../../web-src/i18n-" + l + ".js"))[n];
  const TH = await g("th", "TH"), VI = await g("vi", "VI"), ZH2 = await g("zh", "ZH"), RU = await g("ru", "RU"), JA2 = await g("ja", "JA");
  ok(!/ถูก/.test(TH["Not yet"]) && !/đúng/.test(VI["Not yet"]) && !/不对/.test(ZH2["Not yet"]), "“Not yet” = not done yet (it read “not correct yet” in th / vi / zh)");
  ok(DE.Design === "Design" && RU.Design === "Оформление" && JA2.Design === "デザイン", "“Design” = the look (slides, CV), not an engineering draft"); }
// "tell me when my wife gets home": the place is a house, not the app's Home page («Inicio», «Startseite»)
const NT = await import("../../web-src/noteteach.js");
const ES = (await import("../../web-src/i18n-es.js")).ES, DE2 = (await import("../../web-src/i18n-de.js")).DE;
const trOf = (d) => (s, v) => (d[s] || s).replace(/\{(\w+)\}/g, (_, k) => v[k]);
const x = { kind: "watch", rule: { kind: "arrive", who: "Nada", place: "Home" } };
ok(/casa/.test(NT.understood(x, { tr: trOf(ES) })) && !/Inicio/.test(NT.understood(x, { tr: trOf(ES) })), "es: arrives — casa (not Inicio): " + NT.understood(x, { tr: trOf(ES) }));
ok(/Hause/.test(NT.understood(x, { tr: trOf(DE2) })), "de: zu Hause: " + NT.understood(x, { tr: trOf(DE2) }));
ok(/— Home$/.test(NT.understood(x, {})), "en: the place as Life360 names it (“Home”): " + NT.understood(x, {}));
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`); process.exit(fail ? 1 : 0);
