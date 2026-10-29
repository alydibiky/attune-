// v8.7 (Ali: "draft the emails in Gmail and send with my confirmation, like Gemini")
import assert from "node:assert/strict";
import * as E from "../../web-src/emaildraft.js";
let n = 0; const t = (name, f) => { f(); n++; };
t("a request to write an email — not a question about email", () => {
  for (const s of ["email ahmed@site.com that the meeting moved to Sunday", "Write an email to Sara about the invoice", "/email the client that the crane is ready",
    "ابعت ايميل لأحمد إن الاجتماع اتأجل للأحد", "اكتبلي ايميل للمدير بخصوص الإجازة", "draft a mail to HR asking for my salary certificate"]) assert.ok(E.isEmailAsk(s), s);
  for (const s of ["how do I write an email?", "what is my email", "I got an email from Sara", "remind me to email Ahmed tomorrow"]) assert.ok(!E.isEmailAsk(s), s);
  assert.ok(!E.isEmailAsk("how do I write an email?"));
});
t("who and what, by code", () => {
  const a = E.parseEmailAsk("email ahmed@Site.com that the meeting moved to Sunday");
  assert.deepEqual(a.to, ["ahmed@site.com"]); assert.equal(a.about, "the meeting moved to Sunday"); assert.equal(a.lang, "en");
  const b = E.parseEmailAsk("Write an email to Sara about the invoice for October");
  assert.equal(b.toName, "Sara"); assert.equal(b.about, "the invoice for October");
  const c = E.parseEmailAsk("ابعت ايميل لأحمد إن الاجتماع اتأجل للأحد");
  assert.equal(c.lang, "ar"); assert.equal(c.toName, "أحمد"); assert.equal(c.about, "الاجتماع اتأجل للأحد");
  assert.ok(E.parseEmailAsk("email my manager that I'm sick today").formal);
});
t("the model's answer → subject and body; a broken one → the person's own words", () => {
  const ask = E.parseEmailAsk("email ahmed@site.com that the meeting moved to Sunday");
  assert.deepEqual(E.readDraft('{"subject":"Meeting moved","body":"Hi Ahmed,\\n\\nThe meeting moved to Sunday.\\n\\nBest"}', ask), { subject: "Meeting moved", body: "Hi Ahmed,\n\nThe meeting moved to Sunday.\n\nBest" });
  const d = E.readDraft("", ask);
  assert.equal(d.subject, "The meeting moved to Sunday"); assert.match(d.body, /The meeting moved to Sunday\./);
});
t("the Gmail link carries everything; addresses are checked", () => {
  assert.equal(E.mailtoOf({ to: ["a@b.com"], subject: "Hi there", body: "Line 1\nLine 2" }), "mailto:a%40b.com?subject=Hi%20there&body=Line%201%0ALine%202");
  assert.ok(E.validAddr("x.y@co.eg") && !E.validAddr("ahmed"));
  assert.deepEqual(E.addrsOf("a@b.com, c@d.com"), ["a@b.com", "c@d.com"]);
});
console.log(`v870email: ${n} checks passed`);
