// v6.45 Business client portal (fleet-portal.js): the client's own records only, an open page and a PIN-locked one that
// opens with the right PIN (the same steps the client's browser runs) and refuses a wrong one.
import * as F from "../../web-src/fleet.js";
import { portalData, portalHTML } from "../../web-src/fleet-portal.js";
import { sealData } from "../../web-src/biz-vault.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const s = F.loadDemo(F.EMPTY());
const [c1, c2] = F.live(s.clients);
const d = portalData(s, c1.id);
ok(d.client === c1.name && d.balance.owed === F.clientBalance(s, c1.id).balance, "the client's balance: " + d.balance.owed);
ok(d.jobs.length >= 1 && d.jobs.every((j) => j.no && j.crane), "their job orders with the crane");
ok(d.payments.every((p) => p.amount > 0) && d.payments.length === F.live(s.cheques).filter((q) => q.client === c1.id && q.dir === "in").length, "their payments");
const txt = JSON.stringify(d);
ok(!txt.includes(c2.name) && !/profit|expense|wage/i.test(txt), "nothing about another client, costs or profit");
const open = portalHTML({ data: d, lang: "ar", title: c1.name });
ok(open.includes('dir="rtl"') && open.includes("حسابك") && open.includes(JSON.stringify(c1.name).slice(1, -1)) && !open.includes("<script src"), "an open page: Arabic, self-contained");
// run the page's own script in a tiny DOM stand-in
const run = async (html, pin) => {
  const el = {}, m = { innerHTML: "" }, err = { textContent: "" }; let submit = null;
  const doc = { getElementById: (id) => (id === "m" ? m : id === "err" ? err : id === "pin" ? { value: pin } : { set onsubmit(f) { submit = f; } }) };
  const js = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
  new Function("document", "crypto", "TextEncoder", "TextDecoder", "atob", "window", js)(doc, globalThis.crypto, TextEncoder, TextDecoder, atob, { crypto: globalThis.crypto });
  if (submit) { submit({ preventDefault() {} }); await new Promise((r) => setTimeout(r, 1500)); }
  return { body: m.innerHTML, err: err.textContent };
};
const r1 = await run(open);
ok(r1.body.includes("عليك") && r1.body.includes(d.invoices.length ? d.invoices[0].no : d.jobs[0].no), "the open page draws itself");
const sealed = await sealData(d, "4826", { kind: "portal", iterations: 1000 });   // no name in the readable header
const locked = portalHTML({ sealed, lang: "en" });
ok(!locked.includes(c1.name) && locked.includes("This page is locked"), "a locked page shows no name or number before the PIN");
const bad = await run(locked, "1111"); ok(!bad.body.includes("You owe") && bad.err === "That PIN is not right", "a wrong PIN: refused");
const good = await run(locked, "4826"); ok(good.body.includes("You owe") && good.body.includes(c1.name), "the right PIN: the account opens");
