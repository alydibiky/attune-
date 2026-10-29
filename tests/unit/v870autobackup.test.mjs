// v8.7 (Ali: "messages in Recall stay forever, with offline and online backup like WhatsApp")
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;
import * as A from "../../web-src/autobackup.js";
import * as B from "../../web-src/backup.js";
import * as R from "../../web-src/lookback.js";
const mem = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } }; };
let n = 0;
{ // the password is checked, kept on this phone, never inside a backup
  const s = mem({ "ledger.v3": '{"txns":[1]}', "attune:gmail:v1": '{"emails":[1]}', "attune:sms-old:v1": "[1]" });
  assert.equal(A.setAutoPassword("short", "short", s) !== "", true);
  assert.equal(A.setAutoPassword("long enough pw", "long enough pw", s), ""); assert.equal(A.loadAuto(s).on, true);
  assert.ok(!("attune:autobackup:v1" in B.collectData(s)), "the backup password is never inside a backup");
  assert.equal(A.autoDue(A.loadAuto(s), false), false, "no folder yet → nothing"); assert.equal(A.autoDue(A.loadAuto(s), true), true);
  // the daily backup: everything + Recall's messages, minus what Gmail gave; it opens with the password
  const native = { recallExport: () => JSON.stringify([{ id: "n1", title: "Liverpool 1 - 1 Chelsea", ts: 5 }]) };
  let wrote = null; const call = async (m, a) => { wrote = [m, a]; return { name: a.name }; };
  const r = await A.runAutoBackup(call, native, { s, iterations: 1000, now: Date.parse("2026-10-29T10:05:00") });
  assert.equal(wrote[0], "autoBackupWrite"); assert.match(wrote[1].name, /^attune-auto-2026-10-29-\d{4}\.attune$/); assert.equal(r.name, wrote[1].name);
  const keys = await B.decryptBackup(wrote[1].text, "long enough pw");
  assert.ok(keys["ledger.v3"] && !keys["attune:gmail:v1"] && !keys["attune:sms-old:v1"]);
  assert.match(keys[B.NATIVE_RECALL], /Liverpool/);
  assert.equal(A.autoDue(A.loadAuto(s), true, Date.parse("2026-10-29T12:00:00")), false, "done today");
  // restoring hands the messages back to the phone and keeps them out of the page's storage
  let back = null; const t = B.takePhoneData(keys, { recallImport: (j) => { back = j; return 1; } });
  assert.equal(t.messages, 1); assert.match(back, /Liverpool/); assert.ok(!(B.NATIVE_RECALL in t.keys));
  n += 12; }
{ // older messages are asked for by the question's words and the words that mean the same
  const w = R.wordsFor("chelsea score");
  assert.ok(w.includes("chelsea") && w.includes("score") && w.length <= 8, w.join());
  n++; }
console.log(`v870autobackup: ${n} checks passed`);
