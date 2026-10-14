// v6.27 Translation with checks (translate.js): locked tokens can't be changed; a fake model that drops numbers, writes the
// wrong script, leaves text untranslated or ignores the glossary is caught, retried with the reason, and flagged if still wrong.
import * as T from "../../web-src/translate.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
// locked tokens
const p = T.protect("Invoice INV-2026-0042 for 1,250.50 EGP is due on 12/10/2026 at 09:30 — pay at https://pay.example.com or mail ali@example.com. RTX 3050, iPhone 15 Pro, 14% VAT, {name}, page 15.");
ok(["INV-2026-0042", "1,250.50 EGP", "12/10/2026", "09:30", "https://pay.example.com", "ali@example.com", "RTX 3050", "iPhone 15 Pro", "14%", "{name}"].every((t) => p.tokens.includes(t)), "locked: code, amount, date, time, link, e-mail, model names, percent, placeholder: " + JSON.stringify(p.tokens));
ok(/page ⟦\d+⟧/.test(p.masked) && p.tokens.includes("15") && !p.tokens.some((t) => /^(for|on|at|page) /.test(t)), "'page 15', 'for 1,250': only the number is locked, the word is translated");
const r = T.restore("فاتورة ⟦1⟧ بمبلغ ⟦2⟧ ⟦2⟧", ["INV-1", "100 EGP"]);
ok(!r.ok && r.doubled.includes("100 EGP"), "a marker twice is caught");
ok(!T.restore("فاتورة ⟦1⟧", ["INV-1", "100 EGP"]).ok && T.restore("فاتورة ⟦1⟧", ["INV-1", "100 EGP"]).missing[0] === "100 EGP", "a marker dropped is caught");
// scripts
ok(T.scriptOk("مرحبا بك في المتجر", "ar") && !T.scriptOk("Welcome to the shop", "ar") && T.scriptOk("Bienvenue au magasin", "fr") && T.scriptOk("Добро пожаловать", "ru") && !T.scriptOk("Добро пожаловать", "fr"), "the target script is checked");
ok(T.untranslated("The meeting is on Monday at the office", "The meeting is on Monday at the office") && !T.untranslated("The meeting is on Monday", "La réunion est lundi"), "left untranslated is caught");
// the pipeline with a deliberately bad model
const SRC = ["Your order INV-2026-0042 of 1,250.50 EGP ships on 12/10/2026.", "Our warranty covers 24 months.", "Contact support@shop.example for help.", "The meeting room is on floor 3."];
let calls = 0;
const fake = async (msgs) => {
  calls++;
  const user = msgs[msgs.length - 1].content;
  const lines = [...user.matchAll(/\[\[(\d+)\]\] (.*)/g)];
  const fixing = /was wrong/.test(user);
  return lines.map(([, n, t]) => {
    let out = t.replace("Your order", "طلبك").replace("of", "بقيمة").replace("ships on", "يُشحن في").replace("Our warranty covers", "يغطي ضماننا").replace("months", "شهرًا")
      .replace("Contact", "تواصل مع").replace("for help", "للمساعدة").replace("The meeting room is on floor", "غرفة الاجتماعات في الطابق");
    if (!fixing) {
      if (/طلبك/.test(out)) out = out.replace(/⟦2⟧/, "1250");            // drops a locked amount (first time)
      if (/ضماننا/.test(out)) out = "Our warranty covers ⟦1⟧ months.";     // wrong script (first time)
    }
    if (/غرفة/.test(out)) out = out.replace(/⟦\d+⟧/, "");                    // always drops the floor number → flagged
    return `[[${n}]] ${out}`;
  }).join("\n");
};
const res = await T.translatePieces(SRC, fake, { lang: "ar", language: "Arabic" });
ok(res[0].ok && res[0].text.includes("1,250.50 EGP") && res[0].text.includes("INV-2026-0042") && res[0].text.includes("12/10/2026"), "a dropped amount is retried with the reason; the result keeps it exactly: " + res[0].text);
ok(res[1].ok && /ضماننا/.test(res[1].text) && res[1].text.includes("24"), "the wrong script is retried: " + res[1].text);
ok(res[2].ok && res[2].text.includes("support@shop.example"), "the e-mail survives: " + res[2].text);
ok(!res[3].ok && /kept exactly: 3/.test(res[3].why), "a number still missing after the retry is FLAGGED, not hidden: " + res[3].why);
// glossary
const g = await T.translatePieces(["Attune Business helps your shop."], async (m) => /was wrong/.test(m[1].content) ? "[[1]] يساعد أتيون للأعمال متجرك." : "[[1]] يساعد أتيون بيزنس متجرك.", { lang: "ar", language: "Arabic", glossary: [{ from: "Attune Business", to: "أتيون للأعمال" }] });
ok(g[0].ok && /أتيون للأعمال/.test(g[0].text), "the glossary term is enforced (retried until used): " + g[0].text);
// extra careful: the round trip
// the judge: says YES when two sentences mean the same (synonyms), NO when they don't
const judge = (u) => (/price is 500 EGP for two people[\s\S]*cost is 500 EGP for two persons/.test(u) ? "YES" : "NO");
const back = await T.translatePieces(["The price is 500 EGP for two people."], async (m) => {
  if (m[0].content === "Answer only YES or NO.") return judge(m[1].content);
  if (/Arabic/.test(m[0].content)) return "[[1]] السعر ⟦1⟧ لشخصين.";
  return "[[1]] The cost is ⟦1⟧ for two persons.";
}, { lang: "ar", language: "Arabic", careful: true, sourceLanguage: "English" });
ok(back[0].ok && /500 EGP/.test(back[0].back), "extra careful: the round trip keeps 500 EGP; different words, same meaning → accepted: " + back[0].back);
const drift = await T.translatePieces(["The price is 500 EGP for two people."], async (m) => m[0].content === "Answer only YES or NO." ? judge(m[1].content) : /Arabic/.test(m[0].content) ? "[[1]] الطقس جميل ⟦1⟧." : "[[1]] The weather is nice ⟦1⟧.", { lang: "ar", language: "Arabic", careful: true, sourceLanguage: "English" });
ok(!drift[0].ok && /meaning may have changed/.test(drift[0].why), "a translation whose meaning drifted is flagged by the round trip");
const neg = await T.translatePieces(["Do not take this medicine with alcohol."], async (m) => m[0].content === "Answer only YES or NO." ? "YES" : /Arabic/.test(m[0].content) ? "[[1]] تناول هذا الدواء مع الكحول." : "[[1]] Take this medicine with alcohol.", { lang: "ar", language: "Arabic", careful: true, sourceLanguage: "English" });
ok(!neg[0].ok && /not \/ no/.test(neg[0].why), "a lost “not” is caught by code even when the model's judge says yes: " + neg[0].why);
ok(T.piecesOf("A.\n\nB is long. ".repeat(1) + "x".repeat(10)).length === 2, "text → pieces by paragraph");
console.log(bad ? bad + " FAILED" : "v727translate ok");
