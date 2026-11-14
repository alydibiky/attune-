// v9.9.40 AP-1 (Ali OK'd K1 / EX-1): the WhatsApp export reader — 2,500 samples of the 10,000-file generator and of its held-out
// formats, plus the exact lines from Ali's own groups.
import { execFileSync } from "child_process";
const W = await import("../../web-src/waexport.js");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const run = (env = {}) => +((/\(([\d.]+)%\)/.exec(execFileSync("node", [new URL("../waexport/gen.mjs", import.meta.url).pathname, "2500"], { env: { ...process.env, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })) || [0, 0])[1]);
const a = run(), h = run({ HELDOUT: "1" });
ok(a === 100, "10,000-file generator, 2,500 sample: " + a + "%"); ok(h >= 99, "held-out formats, 2,500 sample: " + h + "% (the mark: 99%)");
const ar = W.readExport("١٤‏/١١‏/٢٠٢٦، ١٠:٣٢ م - نودي: تورتيا\n١٤‏/١١‏/٢٠٢٦، ١٠:٣٣ م - نودي: chicken strips\nالمجمدة\n١٥‏/١١‏/٢٠٢٦، ٩:٠٠ ص - Ali: <تم استبعاد الوسائط>", { fileName: "محادثة واتساب مع Talabat.txt" });
ok(ar.chat === "Talabat" && ar.messages.length === 3, "an Arabic export of Talabat: 3 messages");
ok(ar.messages[0].author === "نودي" && ar.messages[0].text === "تورتيا" && new Date(ar.messages[0].ts).getHours() === 22, "«١٠:٣٢ م» = 22:32, by نودي, «تورتيا»");
ok(ar.messages[1].text === "chicken strips\nالمجمدة", "a message over two lines stays one message");
ok(ar.messages[2].kind === "media" && ar.members.join() === "نودي,Ali", "media omitted; the members");
const en = W.readExport("14/11/2026, 18:40 - Messages and calls are end-to-end encrypted.\n14/11/2026, 18:41 - Dr Hazem Wagdy (Admin , Address East): لا حول و لا قوة إلا بالله\n14/11/2026, 18:42 - M. Mohamed Sayed Depak: الجراج مقفول: ٥٠٠ جنيه", { fileName: "WhatsApp Chat with Address East Owners.txt" });
ok(en.chat === "Address East Owners" && en.messages[0].kind === "system" && en.messages[1].author === "Dr Hazem Wagdy (Admin , Address East)", "Address East: the system line, the admin's name with its brackets");
ok(en.messages[2].author === "M. Mohamed Sayed Depak" && en.messages[2].text === "الجراج مقفول: ٥٠٠ جنيه", "a name with a dot; the message keeps «٥٠٠» as written");
console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED (${n} checks)`);
process.exit(fail ? 1 : 0);
