// v6.16 — الدرر السنية: hadith questions also ask Dorar's official API when online; its answer (HTML inside JSON) is read into
// passages with the narrator, the scholar, the source, the number and the scholar's ruling. Sample: a real recorded answer.
import { readFileSync } from "node:fs";
const K = await import("../../web-src/knowledge.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const snap = JSON.parse(readFileSync(new URL("../fixtures/dorar_api_sample.json", import.meta.url), "utf8"));

ok(K.isHadithQuestion("هل حديث إنما الأعمال بالنيات صحيح؟") && K.isHadithQuestion("Is this hadith authentic?") && !K.isHadithQuestion("ما عاصمة اليابان؟"), "hadith questions are recognised; others are not sent to Dorar");
ok(K.dorarQuery("هل حديث «إنما الأعمال بالنيات» صحيح؟") === "إنما الأعمال بالنيات", "only the hadith's own words are searched: " + K.dorarQuery("هل حديث «إنما الأعمال بالنيات» صحيح؟"));

const ps = K.parseDorar(snap.body, "إنما الأعمال بالنيات");
ok(ps.length >= 5 && ps.length <= 15, "the answer becomes passages: " + ps.length);
const p0 = ps[0];
ok(/^إن\S* الأعمالُ بالنياتِ/.test(p0.text) && !/^\d/.test(p0.text) && !/</.test(p0.text), "the hadith text, without its list number or HTML");
ok(/الراوي: أبو سعيد الخدري/.test(p0.text) && /المحدث: ابن عبدالبر/.test(p0.text) && /المصدر: التمهيد/.test(p0.text) && /الصفحة أو الرقم: 21\/270/.test(p0.text) && /خلاصة حكم المحدث: خطأ/.test(p0.text), "narrator, scholar, source, number and the scholar's ruling are kept word for word");
ok(p0.title === "الدرر السنية — التمهيد 21/270 (ابن عبدالبر)" && p0.pack === "dorar" && /dorar\.net/.test(p0.url) && p0.notice_ar, "titled with the source, number and scholar; links back to Dorar");
ok(ps.some((p) => /خلاصة حكم المحدث: صحيح غريب/.test(p.text)), "each result keeps its own ruling");
ok(K.parseDorar("not json").length === 0 && K.parseDorar({}).length === 0, "a broken answer gives nothing (no crash)");

// asked only for hadith questions, only online; merged with the packs in find()
let calls = [];
const native = async (m, q) => { calls.push([m, q]); return { body: snap.body }; };
let online = true;
const live = K.dorarSearch(native, () => online);
ok((await live("ما عاصمة اليابان؟")).length === 0 && calls.length === 0, "a non-hadith question never reaches Dorar");
online = false; ok((await live("حديث إنما الأعمال بالنيات")).length === 0 && calls.length === 0, "offline: Dorar is not asked");
online = true;
const kn = K.createKnowledge(K.memoryStore());
kn.liveSearch = live;
kn.packSearch = async () => [{ id: "hadith:1", pack: "hadith", title: "صحيح البخاري — الحديث 1", text: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى\nالحكم: صحيح — من صحيح البخاري", url: "" }];
const h = await kn.find("هل حديث إنما الأعمال بالنيات صحيح؟");
ok(calls.length === 1 && calls[0][0] === "dorarSearch", "a hadith question asks Dorar through the phone");
ok(h.some((x) => x.chunk.pack === "dorar") && h.some((x) => x.chunk.pack === "hadith"), "the answer draws on Dorar and the offline hadith pack together: " + h.map((x) => x.chunk.pack).join(","));
kn.liveSearch = async () => { throw new Error("offline"); };
ok((await kn.find("هل حديث إنما الأعمال بالنيات صحيح؟")).some((x) => x.chunk.pack === "hadith"), "if Dorar can't be reached, the offline pack still answers");
console.log(fail ? `${fail} FAILED` : "v725dorar ok");
process.exit(fail ? 1 : 0);
