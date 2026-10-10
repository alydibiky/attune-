// v6.16c (Ali: "I won't take money from people for the Dorar service") — a hadith question never counts toward a daily limit.
const B = await import("../../web-src/billing.js");
const K = await import("../../web-src/knowledge.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
ok(B.countsTowardLimit("ما صحة حديث «إنما الأعمال بالنيات»؟", K.isHadithQuestion) === false, "a hadith question is free on every plan");
ok(B.countsTowardLimit("What is the capital of Egypt?", K.isHadithQuestion) === true, "other questions count as before");
ok(B.COMPARE_ROWS.some((r) => /Dorar/.test(r[0]) && r.slice(1).every((x) => /Free, unlimited/.test(x))), "the plans table says Dorar search is free and unlimited on every plan");
console.log(fail ? `v729dorarfree: ${fail} FAILED` : "v729dorarfree ok");
