// v8.8 the connected memory, part 1 (Ali: "when I say Ahmed it asks me which Ahmed if there is more than one")
import * as E from "../../web-src/entities.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const now = Date.parse("2026-10-30T12:00:00");
let d = E.emptyDir(), a, b, c;
({ dir: d, id: a } = E.addCard(d, { name: "Ahmed the plumber", role: "plumber", contact: { name: "Ahmed Samir Sabbak", phone: "+20 100 123 4521" } }, now));
({ dir: d, id: b } = E.addCard(d, { name: "Ahmed", role: "work", aliases: ["Ahmed Work"] }, now));
({ dir: d, id: c } = E.addCard(d, { name: "Osama", role: "barber", aliases: ["الحلاق"] }, now));

ok(E.mentions("I paid Osama 250", d)[0].ids.join() === c, "a name in a sentence → its card");
ok(E.mentions("اديت أسامة ٢٥٠", d)[0].ids.join() === c, "the same name in Arabic («أسامة» = Osama)");
ok(E.mentions("روحت للحلاق", d).length === 0 && E.mentions("الحلاق جه", d)[0].ids.join() === c, "your own name for him («الحلاق») finds him");
ok(E.mentions("did Mohamed call", { items: [{ id: "m", name: "Muhammad" }] })[0].ids.join() === "m", "spellings are one name (Mohamed = Muhammad)");
const r1 = E.resolve("What do I owe Ahmed?", d, { now });
ok(!r1.found.length && r1.ask && r1.ask.choices.length === 2, "two Ahmeds and nothing tells them apart → «Which Ahmed?»");
const r2 = E.resolve("Ahmed fixed the plumber leak, how much did I pay him?", d, { now });
ok(r2.found[0] && r2.found[0].id === a && r2.found[0].sure === false && !r2.ask, "the sentence says plumber → the plumber, with a change chip (not sure)");
ok(E.resolve("Ahmed the plumber", d, { now }).found[0].id === a, "the full name you gave him → that card, no question");
d = E.learnPick(d, b, "what about the meeting with Ahmed tomorrow", now);
d = E.learnPick(d, b, "Ahmed meeting notes", now);
const r3 = E.resolve("is the meeting with Ahmed moved?", d, { now });
ok(r3.found[0] && r3.found[0].id === b, "after you picked work-Ahmed for meetings twice, a meeting → him");
// both: his contact AND your own name
const { dir: d2, id: same } = E.addCard(d, { name: "Sabbak", contact: { name: "Ahmed S.", phone: "01001234521" } }, now);
ok(same === a && d2.items.length === 3 && d2.items.find((p) => p.id === a).aliases.includes("Sabbak"), "the same phone number → one card, the new name kept as another name");
ok(E.labelOf(d2.items.find((p) => p.id === a)) === "Ahmed the plumber · plumber", "how he is told apart: " + E.labelOf(d2.items.find((p) => p.id === a)));
// names with no card yet
ok(E.newNames("paid Karim 300 for the tiles", d).join() === "Karim", "a new name in “paid Karim” → «Who is Karim?»");
ok(E.newNames("سلفت مجدي ٥٠٠", d).join() === "مجدي", "«سلفت مجدي» → Magdy is new");
ok(E.newNames("paid Osama 250 and Ahmed 300", d).length === 0, "known names are not asked again");
ok(E.newNames("دفعت للسوبر ماركت ٣٠٠", d).length === 0 && E.newNames("paid to the Bank 300", d).length === 0, "not a name: a shop, «السوبر»");
ok(E.newNames("paid Karim", E.skipName(d, "Karim")).length === 0, "Skip = never asked again");
// merge two cards that are one person
const m = E.mergeCards(d, a, c); ok(m.items.length === 2 && m.items.find((p) => p.id === a).aliases.includes("Osama"), "merge: one card with both names");
// seed from what the app already has
const s = E.seedFrom(E.emptyDir(), { life: { items: [{ id: "1", person: "Fatma", title: "Maid every Saturday" }, { id: "2", person: "Fatma" }] }, voicePeople: { "~ماما": { is: "Mom ❤️" } } }, now);
ok(s.items.length === 2 && s.items[0].role === "maid" && s.items[1].aliases.length === 0 && s.items[1].name === "ماما", "People & plans' people and the voice's nicknames become cards once");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
