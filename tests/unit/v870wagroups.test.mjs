// v8.7 (Ali: "a WhatsApp group … understands what's in it with photos and organizes it" — design A, albums)
import assert from "node:assert/strict";
import * as W from "../../web-src/wagroups.js";
let n = 0; const t = (name, f) => { f(); n++; };
const DESIGN = `12/10/2026, 9:15 pm - Ali: IMG-20261012-WA0001.jpg (file attached)
كنبة رمادي للريسبشن
12/10/2026, 9:16 pm - Ali: IMG-20261012-WA0002.jpg (file attached)
13/10/2026, 10:00 am - Ali: نجفة دهبي للسفرة
13/10/2026, 10:02 am - Ali: <Media omitted>
14/10/2026, 8:00 pm - Ali: IMG-20261014-WA0003.jpg (file attached)
Kitchen island with marble top
15/10/2026, 8:00 pm - Ali: https://pin.it/abc123`;
t("an export → items, with their photos and captions", () => {
  const items = W.itemsOf(DESIGN, ["IMG-20261012-WA0001.jpg", "IMG-20261012-WA0002.jpg", "IMG-20261014-WA0003.jpg"]);
  assert.equal(items.length, 5);
  assert.deepEqual(items.map((x) => x.kind), ["photo", "photo", "text", "photo", "link"]);
  assert.equal(items[0].text, "كنبة رمادي للريسبشن"); assert.ok(items[0].has && items[0].file === "IMG-20261012-WA0001.jpg");
  assert.deepEqual(W.attachmentOf("<attached: 00000012-PHOTO-2026-10-01-12-00-00.jpg> nice"), { file: "00000012-PHOTO-2026-10-01-12-00-00.jpg", caption: "nice" });
  const again = W.mergeItems(items, W.itemsOf(DESIGN + "\n16/10/2026, 9:00 am - Ali: ستارة بيج لأوضة النوم", []));
  assert.equal(again.added, 1, "a second export adds only what's new");
});
t("design: albums by room and by thing — the photo's labels count too", () => {
  const items = W.itemsOf(DESIGN, ["IMG-20261012-WA0001.jpg", "IMG-20261012-WA0002.jpg", "IMG-20261014-WA0003.jpg"]);
  const seen = { "IMG-20261012-WA0002.jpg": { labels: [{ text: "Bed" }, { text: "Lamp" }], text: "" } };
  assert.equal(W.kindOf(items, { title: "Design ideas", seen }), "design");
  assert.equal(W.kindOf(items, { title: "Home", seen }), "design", "from what's inside, without the name");
  const a = W.albumsOf(items, "design", { seen });
  const ids = (id) => a.rows.flatMap((r) => r.albums).find((x) => x.id === id)?.ids || [];
  assert.ok(ids("living").includes(items[0].id) && ids("sofas").includes(items[0].id), "grey sofa for the reception → Living room and Sofas");
  assert.ok(ids("bedroom").includes(items[1].id) && ids("lighting").includes(items[1].id), "a photo with no words, the phone saw a bed and a lamp");
  assert.ok(ids("dining").includes(items[2].id) && ids("lighting").includes(items[2].id));
  assert.ok(ids("kitchen").includes(items[3].id));
  assert.equal(a.more.ids[0], items[4].id, "a link with nothing to go on → More");
  assert.equal(a.rows.flatMap((r) => r.albums).find((x) => x.id === "living").cover, "IMG-20261012-WA0001.jpg");
  const moved = W.albumsOf(items, "design", { seen, moves: { [items[4].id]: "decor" } });
  assert.ok(moved.rows.flatMap((r) => r.albums).find((x) => x.id === "decor").ids.includes(items[4].id) && !moved.more, "a move by hand is kept");
});
t("news and Hadith groups are sorted their own way", () => {
  const news = W.itemsOf(`1/10/2026, 9:00 am - Ali: عاجل: البنك المركزي يرفع الفائدة ٢٪ والدولار يسجل ٤٨ جنيه
2/10/2026, 9:00 am - Ali: Liverpool beat Chelsea 2-1 in the Premier League
3/10/2026, 9:00 am - Ali: وقف اطلاق النار في غزة يبدأ اليوم`, []);
  assert.equal(W.kindOf(news, { title: "اخبار العالم" }), "news");
  const na = W.albumsOf(news, "news"), id = (k) => na.rows[0].albums.find((x) => x.id === k)?.ids || [];
  assert.ok(id("economy").includes(news[0].id) && id("sport").includes(news[1].id) && id("arab").includes(news[2].id));
  assert.equal(W.headline("عاجل:\nالبنك المركزي يرفع الفائدة. التفاصيل بعد قليل"), "البنك المركزي يرفع الفائدة.");
  const h = W.hadithOf("عن أبي هريرة رضي الله عنه قال: قال رسول الله صلى الله عليه وسلم: «لا تغضب» رواه البخاري");
  assert.deepEqual([h.isHadith, h.narrator, h.text, h.source], [true, "أبي هريرة", "لا تغضب", "البخاري"]);
  const rel = W.itemsOf(`1/10/2026, 9:00 am - Ali: عن أبي هريرة رضي الله عنه قال: قال رسول الله صلى الله عليه وسلم: «لا تغضب» رواه البخاري
2/10/2026, 9:00 am - Ali: قال رسول الله ﷺ: «من صلى الفجر في جماعة فهو في ذمة الله» رواه مسلم`, []);
  assert.equal(W.kindOf(rel, { title: "Group" }), "religion");
  const ra = W.albumsOf(rel, "religion").rows[0].albums;
  assert.ok(ra.find((x) => x.id === "manners").ids.includes(rel[0].id) && ra.find((x) => x.id === "prayer").ids.includes(rel[1].id));
});
t("search across all groups, in free text", () => {
  const items = W.itemsOf(DESIGN, ["IMG-20261012-WA0001.jpg"]);
  const lib = { groups: [{ id: "g1", title: "Design", items, seen: {} }] };
  const r2 = W.searchLibrary(lib, "كنبة رمادي");
  assert.equal(r2[0].item.id, items[0].id);
  assert.equal(W.titleOf("WhatsApp Chat with Design ideas.txt"), "Design ideas");
});
console.log(`v870wagroups: ${n} checks passed`);
{ // v8.7: adding directly — shared photos with a note, a note alone, a group made in Attune
  const it = W.addedItems({ text: "كنبة رمادي", files: ["add-1.jpg", "add-2.jpg"], t: 1000, who: "Me" });
  assert.equal(it.length, 2); assert.equal(it[0].text, "كنبة رمادي"); assert.equal(it[1].text, ""); assert.ok(it.every((x) => x.has && x.kind === "photo" && x.added));
  const note = W.addedItems({ text: "https://pin.it/abc", t: 2000 });
  assert.equal(note.length, 1); assert.equal(note[0].kind, "link");
  const g = W.newGroup("Kitchen ideas", "design", 5);
  assert.equal(g.kind, "design"); assert.ok(g.own && g.id.startsWith("g"));
  const a = W.albumsOf(it, "design"); assert.ok(a.rows.flatMap((r) => r.albums).some((x) => x.id === "sofas" && x.ids.includes(it[0].id)));
  console.log("v870wagroups: adding directly ok");
}
