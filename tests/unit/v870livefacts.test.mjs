// v8.7 (Ali: Liverpool–Chelsea 1-1 was in his notifications; the chat answered "Passage 1 mentions …") — live answers by code
import assert from "node:assert/strict";
import * as F from "../../web-src/livefacts.js";
let n = 0; const t = (name, f) => { f(); n++; };
const now = new Date(2026, 9, 29, 0, 25).getTime();
const notes = [
  { title: "Goal by N. Brown at 72'", text: "Bayern 5 - 1 Magdeburg", ts: now - 7 * 60e3, app: "Google" },
  { title: "Liverpool 1 - 1 Chelsea", text: "Live score · Second half", ts: now - 16 * 60e3, app: "Google" },
  { title: "21° in At Tabarani", text: "Feels like 24°", ts: now - 24 * 60e3, app: "Google" }];
t("the question: live, a score, the two teams (any order, any spelling)", () => {
  assert.ok(F.isLive("What is the score of Chelsea and Liverpool now") && F.isScoreQuestion("What is the score of Chelsea and Liverpool now"));
  assert.deepEqual(F.teamsOf("What is the score of Chelsea and Liverpool now").sort(), ["chelsea", "liverpool"]);
  assert.deepEqual(F.teamsOf("ماتش الأهلي والزمالك كام كام").sort(), ["al ahly", "zamalek"]);
  assert.ok(!F.isScoreQuestion("how do I make pasta"));
});
t("from the phone first: the notification that has the score", () => {
  const a = F.fromNotes(notes, "What is the score of Chelsea and Liverpool now", { now });
  assert.ok(a); assert.match(a.en, /\*\*Liverpool 1 – 1 Chelsea\*\* \(second half\) — from your Google notification/);
  assert.equal(F.fromNotes(notes, "score of Arsenal and Spurs", { now }), null);
  assert.equal(F.fromNotes(notes, "score of Chelsea and Liverpool now", { now: now + 8 * 3600e3 }), null, "an old notification is not “now”");
});
t("from web pages: the score most pages agree on", () => {
  const ps = [{ title: "Liverpool vs Chelsea LIVE", text: "Liverpool 1-1 Chelsea: Gakpo cancels out the opener, second half under way", url: "https://www.liverpoolecho.co.uk/x" },
    { title: "Chelsea vs Liverpool Live Scores", text: "Liverpool 1 - 1 Chelsea 67'", url: "https://livescore.com/y" }, { title: "Preview", text: "Chelsea 2-0 Liverpool last season", url: "https://a.com" }];
  const a = F.fromPassages(ps, "What is the score of Chelsea and Liverpool now");
  assert.match(a.en, /\*\*Liverpool 1 – 1 Chelsea\*\*.*2 of the pages/);
});
t("an answer that only describes the sources is caught", () => {
  assert.ok(F.isMetaAnswer('- Passage (1) mentions "Chelsea vs Liverpool Live Scores" (1).\n- Passage (2) mentions "Liverpool vs Chelsea LIVE" (2).'.replace(/\((\d)\)/g, "$1")));
  assert.ok(!F.isMetaAnswer("**Liverpool 1–1 Chelsea** in the second half [1]."));
});
console.log(`v870livefacts: ${n} checks passed`);
t("the meta answer is replaced by the pages' own lines", () => {
  const md = F.keyLines([{ text: "Cookie banner text here. Liverpool and Chelsea drew 1-1 at Anfield on Sunday evening." }, { text: "Nothing useful at all on this page today." }], "What is the score of Chelsea and Liverpool");
  assert.match(md, /^- Liverpool and Chelsea drew 1-1 at Anfield.*\[1\]$/);
});
console.log("v870livefacts: keyLines ok");
import * as LA from "../../web-src/lifeask.js";
{
  const stores = { memory: [{ title: "Turkey", text: "These 2 boys came back now from the trip", ts: now - 864e5 }], notes };
  const a = LA.askLife("What is the score of Chelsea and Liverpool now", stores, { now });
  assert.equal(a.kind, "live"); assert.match(a.en, /Liverpool 1 – 1 Chelsea/);
  const b = LA.askLife("What is the weather now", { memory: stores.memory }, { now });
  assert.equal(b.kind, "world");
  console.log("v870livefacts: Your life sends the world to the web");
}
import * as R from "../../web-src/lookback.js";
{
  const docs = R.recallDocs({ notes: notes.map((x, i) => ({ ...x, id: "g" + i })), memory: [{ id: "x", title: "Shopping list", text: "milk, eggs, bread", ts: now - 3600e3 }] });
  for (const q of ["chelsea score", "what was the score of the chelsea match", "ماتش تشيلسي", "chelsy liverpol", "نتيجة ليفربول"]) {
    const r = R.recallSearch(docs, q, { now });
    assert.ok(r.hits.length && /Liverpool 1 - 1 Chelsea/.test(r.hits[0].doc.title), "Recall: " + q + " → " + (r.hits[0] && r.hits[0].doc.title));
  }
  assert.match(R.recallSearch(docs, "how hot is it", { now }).hits[0]?.doc.title || "", /21°/, "the weather notification by meaning");
  console.log("v870livefacts: Recall free text finds what you mean");
}
{ // v8.7 (Ali: "what was the score … yesterday" — the notification was older than 6 hours)
  const y = { title: "Liverpool 1 - 1 Chelsea", text: "Full time", ts: now - 20 * 3600e3, app: "Google" };
  assert.ok(F.fromNotes([y], "What was the score of Liverpool and Chelsea yesterday", { now }), "yesterday looks back 48 h");
  assert.equal(F.fromNotes([y], "score of Liverpool and Chelsea now", { now }), null, "“now” stays 6 h");
  assert.deepEqual(F.scoreQueries("What was the score of Liverpool and Chelsea yesterday"), ["Liverpool vs Chelsea score", "Liverpool Chelsea result", "Chelsea vs Liverpool"]);
  console.log("v870livefacts: yesterday + score searches ok");
}
