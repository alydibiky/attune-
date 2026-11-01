// v8.9 (Ali: the maid's 600 went to Bills although he has a Maid category): a tick uses the person's own category,
// learns from an edit, and falls back to bills / rent.
import { catForCommitment } from "../../web-src/regular.js";
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } };
const led = { customCats: [{ id: "c_maid", en: "Maid", ar: "الشغالة", type: "expense" }], txns: [] };
ok(catForCommitment(led, { kind: "regular", title: "Maid" }) === "c_maid", "English title → the Maid category");
ok(catForCommitment(led, { kind: "regular", title: "الشغالة" }) === "c_maid", "Arabic title → the Maid category");
ok(catForCommitment({ customCats: [{ id: "h", name: "Housekeeping" }], txns: [] }, { kind: "regular", title: "maid" }) === "h", "maid → a Housekeeping category (same meaning)");
ok(catForCommitment({ customCats: [], txns: [{ type: "expense", cat: "home", note: "maid · 2026-10-25", date: "2026-10-25" }] }, { kind: "regular", title: "maid" }) === "home", "learns the category the person picked last time");
ok(catForCommitment({ customCats: [], txns: [] }, { kind: "regular", title: "maid" }) === "bills", "no matching category → bills");
ok(catForCommitment({ customCats: [], txns: [] }, { kind: "rent", title: "flat" }) === "rent", "rent → rent");
console.log(bad ? bad + " FAILED" : "PASS v890maidcat: the maid's payment goes to the Maid category");
