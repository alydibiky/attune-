// v8.7 (Ali: "fix that — but don't remove the feature"): old bank SMS from a backup file, no SMS permission
import assert from "node:assert/strict";
import * as F from "../../web-src/smsfile.js";
const now = Date.parse("2026-10-29T12:00:00");
const d = (days) => now - days * 864e5;
const XML = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<smses count="5">
  <sms protocol="0" address="CIB" date="${d(40)}" type="1" body="Your card ending 1234 was charged EGP 850.00 at NOON on 19/09" contact_name="(Unknown)" />
  <sms protocol="0" address="NBE" date="${d(20)}" type="1" body="تم خصم مبلغ 1,250.00 جنيه من حسابك لدى فودافون" />
  <sms protocol="0" address="CIB" date="${d(10)}" type="1" body="Your OTP is 482913. Do not share it." />
  <sms protocol="0" address="+201001234567" date="${d(5)}" type="2" body="I sent you 500 EGP" />
  <sms protocol="0" address="CIB" date="${d(400)}" type="1" body="Your card was charged EGP 99.00 at UBER" />
  <sms protocol="0" address="Ahmed" date="${d(3)}" type="1" body="See you at 5 &amp; bring the papers" />
</smses>`;
let n = 0;
{ const all = F.parseSmsBackup(XML);
  assert.equal(all.length, 6); assert.equal(all[0].who, "CIB"); assert.equal(all[5].text, "See you at 5 & bring the papers"); assert.equal(all[3].inbox, false);
  const m = F.moneySms(all, { now });
  assert.equal(m.length, 2, "only the two bank payments of the last year: " + m.map((x) => x.text).join(" | "));
  assert.ok(m.every((x) => !/OTP/i.test(x.text)), "never a one-time code"); assert.ok(m[0].ts > m[1].ts && m[0].id.startsWith("smsf:"));
  n += 6; }
{ const j = F.parseSmsBackup(JSON.stringify([{ address: "QNB", body: "EGP 300.00 debited from your account for CARREFOUR", date: d(2), type: 1 }]));
  assert.equal(F.moneySms(j, { now }).length, 1); n++; }
console.log(`v870smsfile: ${n} checks passed`);
