// v6.8 Mind (mind.js): kinds by code, tags, plain-words filters (English + Egyptian Arabic, whole words
// only), the model's filing checked, Spaces, From your past.
const M = await import("../../web-src/mind.js");
let fail = 0;
const ok = (c, what) => { console.log((c ? "PASS " : "FAIL ") + what); if (!c) fail++; };
const now = new Date("2026-09-28T12:00:00").getTime(), DAY = 86400000;

const k = (text, extra = {}) => M.kindOf({ text, ...extra });
ok(k("https://www.youtube.com/watch?v=x crane setup") === "link", "kind: a link");
ok(k("https://maps.app.goo.gl/abc") === "place", "kind: a maps link is a place");
ok(k("«الصبر مفتاح الفرج» — مثل") === "quote" && k("\"Stay hungry, stay foolish.\" — Steve Jobs") === "quote", "kind: quotes (Arabic and English)");
ok(k("iPhone 16 Pro 256GB — 62,000 EGP at B.Tech") === "product" && k("شاحن أنكر ب 850 جنيه") === "product", "kind: a price → product");
ok(k("Hassan Orascom +20 100 123 4567") === "contact", "kind: a phone number → contact");
ok(k("- [ ] call Karim\n- [ ] pay invoice") === "todo" && k("اشتري زيت للعربية") === "todo", "kind: to-dos");
ok(k("المكونات: رز، عدس، بصل\nطريقة التحضير: ...") === "recipe", "kind: a recipe");
ok(k("def f(x):\n  return x") === "code", "kind: code");
ok(k("x", { kind: "instant", output: "y" }) === "answer" && k("x", { kind: "photo" }) === "photo", "kind: a tool's answer, a photo");
ok(k("Meeting with Hassan about the 100 t crane on Saturday") === "note", "kind: plain text stays a note");

ok(JSON.stringify(M.tagsOf({ text: "Liebherr invoice 18000 EGP" })) === '["cranes","money"]', "tags: topics by code");
ok(M.tagsOf({ text: "x", meta: { myTags: ["Gift Idea"], aiTags: ["cranes"], hidden: ["cranes"] } }).join() === "gift idea", "tags: yours kept, a hidden one stays hidden");
ok(M.linkParts("see https://www.amazon.eg/dp/B0-crane-toy?x=1").site === "Amazon", "links: the site's name");

const q = (s) => M.parseQuery(s, now);
let r = q("photos of the crane from last week");
ok(r.kind === "photo" && r.words === "crane" && r.from === new Date("2026-09-15T00:00:00").getTime(), "search: “photos … last week” → photos, the week, “crane”");
r = q("لينكات الونش الشهر اللي فات");
ok(r.kind === "link" && r.words === "الونش" && new Date(r.from).getMonth() === 7, "search: «لينكات الونش الشهر اللي فات»");
ok(q("الأماكن اللي حفظتها في مارس").kind === "place" && new Date(q("الأماكن اللي حفظتها في مارس").from).getMonth() === 2, "search: hamza and Arabic months");
ok(q("ملاحظات عن وظيفي").words === "وظيفي", "search: «في» is not cut out of «وظيفي»");
ok(q("what may help me").from === null && q("notes in May").from !== null, "search: “may” is a month only as “in May”");
ok(q("المفضلة").pinned && q("pinned links").kind === "link", "search: pinned / favourites");

const recs = [
  { id: "a", ts: now - 1 * DAY, kind: "note", text: "https://www.amazon.eg/dp/crane-toy", meta: { aiTags: ["cranes"] } },
  { id: "b", ts: now - 2 * DAY, kind: "note", text: "Karim serviced the Liebherr", meta: { aiTags: ["cranes", "service"] } },
  { id: "c", ts: now - 40 * DAY, kind: "note", text: "Orascom job notes", meta: { myTags: ["cranes"] }, pinned: true },
  { id: "d", ts: now - 365 * DAY, kind: "note", text: "Last year's price list 9000 EGP" },
];
const search = (w) => recs.filter((x) => x.text.toLowerCase().includes(w.toLowerCase())).map((rec) => ({ rec }));
ok(M.mindSearch(recs, "links", search, { now }).items.map((x) => x.id).join() === "a", "mindSearch: “links”");
ok(M.mindSearch(recs, "cranes", search, { now }).items.length === 3, "mindSearch: a tag finds items whose text never says it");
ok(M.autoSpaces(recs)[0].tag === "cranes" && M.autoSpaces(recs)[0].count === 3, "Spaces from tags");
const past = M.resurface(recs, now, 3);
ok(past.length === 2 && past.some((p) => p.rec.id === "d" && p.why === "a year ago"), "From your past: a year ago, and older items");
ok(M.resurface(recs, now).map((p) => p.rec.id).join() === M.resurface(recs, now + 3600000).map((p) => p.rec.id).join(), "From your past: the same all day");

const good = M.parseTagReply('{"title":"صيانة الونش ليبهر","summary":"كريم عمل صيانة.","tags":["صيانة","ليبهر","note"],"kind":"note"}');
ok(good && good.tags.join() === "صيانه,ليبهر" && good.title === "صيانة الونش ليبهر", "filing: the model's reply read (useless tags dropped)");
ok(M.parseTagReply("sorry") === null, "filing: nonsense → nothing");
let f = M.fileRecord({ id: "x", text: "hello there friend" }, good, now);
ok(f.meta.aiAt === now && f.meta.aiTitle && M.titleOf(f) === "صيانة الونش ليبهر", "filing saved on the record");
ok(M.needsFiling([f, { id: "y", text: "a long enough note" }]).map((x) => x.id).join() === "y", "filing: done items are not read again");
f = M.fileRecord(M.fileRecord({ id: "z", text: "a long enough note" }, null), null);
ok(M.needsFiling([f]).length === 0, "filing: an item the model failed twice is left alone");
ok(M.fileRecord({ id: "p", text: "iPhone 62,000 EGP" }, { title: "t", tags: [], kind: "quote" }).meta.mindKind === undefined, "filing: code's kind (a price) beats the model's");

// the trials: a small model filed English items in Arabic ("outriggers" → «جرار»)
const en = { text: "https://www.youtube.com/watch?v=abc — how to set up outriggers on a Liebherr LTM 1090" };
ok(M.itemLang(en) === "en" && M.itemLang({ text: "وصفة كشري: رز، عدس، مكرونة" }) === "ar", "filing: the item's language is read (a link doesn't count)");
ok(/ENGLISH/.test(M.tagMessages(en)[1].content), "filing: the model is told the item is in English");
const wrongLang = M.parseTagReply('{"title":"تثبيت أعمدة الدعم في جرار ليبرر","summary":"دليل فيديو","tags":["جرار ليبرر","LTM 1090","تثبيت"]}', en);
ok(wrongLang && wrongLang.title === "" && wrongLang.summary === "" && wrongLang.tags.join() === "ltm 1090", "filing: an Arabic title for an English item is not kept; the card keeps its own line");
const allWrong = M.parseTagReply('{"title":"Egyptian proverb about patience","summary":"A saying.","tags":["patience","proverb"]}', { text: "«الصبر مفتاح الفرج» — مثل مصري" });
ok(allWrong && !allWrong.title && !allWrong.tags.length && M.fileRecord({ text: "x" }, allWrong).meta.aiAt, "filing: a reply all in the wrong language still counts as filed (not asked again)");
ok(M.parseTagReply('{"title":"Liebherr outrigger setup","tags":["liebherr","crane","outriggers"]}', en).title === "Liebherr outrigger setup", "filing: a filing in the right language is kept");

console.log(fail ? `\n${fail} FAILED` : "\nALL PASSED");
if (fail) process.exit(1);
