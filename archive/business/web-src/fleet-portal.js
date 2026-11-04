/* ---- v6.45 Business client portal (Ali's "still to build" list): ONE page a client can open on any phone or computer —
   sent on WhatsApp or by email — with what they owe, their invoices (paid / partly / overdue), their payments and cheques,
   and their job orders. No server and no account: the page is a single HTML file. With a PIN it is locked — the data
   inside is sealed with the same encryption as the Business backups (biz-vault.js: PBKDF2-SHA-256 600,000 rounds →
   AES-GCM-256) and opens only with that PIN, in the client's own browser. Pure; tests: v745portal (unit + e2e).          */
import { live, byId, r2, isoDay, showDate, clientBalance, jobTotal } from "./fleet.js";
import { invoiceStatus } from "./fleet-pro.js";

/** What the client sees: their own records only (never another client's, never costs or profit). */
export function portalData(s, clientId, today = isoDay()) {
  const c = byId(s.clients, clientId); if (!c || c.del) throw new Error("This client was deleted.");
  const nm = (arr, id) => (byId(arr, id) || {}).name || "";
  const b = clientBalance(s, clientId);
  const jobs = live(s.jobs).filter((j) => j.client === clientId).map((j) => ({ no: j.no, crane: nm(s.cranes, j.crane), site: nm(s.sites, j.site), start: showDate(j.start), status: j.status, total: jobTotal(s, j.id) })).reverse();
  const invoices = invoiceStatus(s, today).filter((v) => v.client === clientId).map((v) => ({ no: v.no, date: showDate(v.date), due: showDate(v.due), total: v.net, paid: v.paid, left: v.left, status: v.status, late: v.late }));
  const payments = live(s.cheques).filter((q) => q.dir === "in" && q.client === clientId).sort((a, b) => (a.due < b.due ? 1 : -1))
    .map((q) => ({ date: showDate(q.due), method: q.method, no: q.no || "", bank: q.bank || "", amount: q.amount, status: q.status }));
  return { v: 1, made: showDate(today), company: s.settings.company || "", taxNo: s.settings.taxNo || "", currency: s.settings.currency || "EGP",
    client: c.name, balance: { opening: b.opening, work: b.work, tax: b.tax, paid: b.paid, pending: b.pending, owed: b.balance },
    overdue: r2(invoices.filter((v) => v.status === "overdue").reduce((n, v) => n + v.left, 0)), jobs, invoices, payments };
}

// The page's own words, in the language it was made in (the client may not have Attune).
const W = {
  en: { title: "Your account", owed: "You owe", overdue: "Overdue", paid: "Paid so far", waiting: "Cheques waiting", invoices: "Invoices", payments: "Payments", jobs: "Job orders",
    no: "No.", date: "Date", due: "Due", total: "Total", left: "Left", status: "Status", amount: "Amount", crane: "Crane", site: "Site", made: "Made", locked: "This page is locked",
    pin: "Enter the PIN you were given", open: "Open", wrong: "That PIN is not right", none: "Nothing yet", browser: "Open this file in Chrome, Safari or Edge to unlock it",
    st: { paid: "Paid", partial: "Partly paid", unpaid: "Unpaid", overdue: "Overdue", pending: "Waiting", cleared: "Cleared", bounced: "Bounced", active: "Working", completed: "Finished", cancelled: "Cancelled" },
    m: { cheque: "Cheque", cash: "Cash", transfer: "Transfer" } },
  ar: { title: "حسابك", owed: "عليك", overdue: "متأخر", paid: "اللي اتدفع", waiting: "شيكات مستنية", invoices: "الفواتير", payments: "المدفوعات", jobs: "أوامر الشغل",
    no: "رقم", date: "التاريخ", due: "الاستحقاق", total: "الإجمالي", left: "الباقي", status: "الحالة", amount: "المبلغ", crane: "الونش", site: "الموقع", made: "اتعملت", locked: "الصفحة دي مقفولة",
    pin: "اكتب الرقم السري اللي اتبعتلك", open: "افتح", wrong: "الرقم السري مش صح", none: "مفيش حاجة لسه", browser: "افتح الملف ده في Chrome أو Safari أو Edge عشان يتفتح",
    st: { paid: "مدفوعة", partial: "مدفوعة جزئيًا", unpaid: "مش مدفوعة", overdue: "متأخرة", pending: "مستني", cleared: "اتصرف", bounced: "مرتجع", active: "شغال", completed: "خلص", cancelled: "اتلغى" },
    m: { cheque: "شيك", cash: "كاش", transfer: "تحويل" } },
};

// The renderer runs in the client's browser: data → the page body. Kept as a plain function so it is embedded as text.
function render(d, w) {
  const e = (x) => String(x == null ? "" : x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const n = (x) => (+x || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const tag = (s) => '<span class="t t-' + e(s) + '">' + e(w.st[s] || s) + "</span>";
  const table = (head, rows) => rows.length ? '<div class="tw"><table><tr>' + head.map((h) => "<th>" + e(h) + "</th>").join("") + "</tr>" + rows.map((r) => "<tr>" + r.join("") + "</tr>").join("") + "</table></div>" : '<p class="mu">' + e(w.none) + "</p>";
  const td = (x, num) => '<td class="' + (num ? "n" : "") + '">' + (num ? n(x) : x) + "</td>";
  return '<header><p class="mu">' + e(d.company) + (d.taxNo ? " · " + e(d.taxNo) : "") + "</p><h1>" + e(w.title) + " — " + e(d.client) + "</h1></header>"
    + '<section class="k"><div><span>' + e(w.owed) + "</span><b id=\"owed\">" + n(d.balance.owed) + " " + e(d.currency) + "</b></div>"
    + (d.overdue ? '<div class="bad"><span>' + e(w.overdue) + "</span><b>" + n(d.overdue) + "</b></div>" : "")
    + "<div><span>" + e(w.paid) + "</span><b>" + n(d.balance.paid) + "</b></div>" + (d.balance.pending ? "<div><span>" + e(w.waiting) + "</span><b>" + n(d.balance.pending) + "</b></div>" : "") + "</section>"
    + "<h2>" + e(w.invoices) + "</h2>" + table([w.no, w.date, w.due, w.total, w.left, w.status], d.invoices.map((v) => [td(e(v.no)), td(e(v.date)), td(e(v.due)), td(v.total, 1), td(v.left, 1), td(tag(v.status))]))
    + "<h2>" + e(w.payments) + "</h2>" + table([w.date, w.no, w.amount, w.status], d.payments.map((p) => [td(e(p.date)), td(e((w.m[p.method] || p.method) + (p.no ? " " + p.no : "") + (p.bank ? " · " + p.bank : ""))), td(p.amount, 1), td(tag(p.status))]))
    + "<h2>" + e(w.jobs) + "</h2>" + table([w.no, w.crane, w.site, w.date, w.total, w.status], d.jobs.map((j) => [td(e(j.no)), td(e(j.crane)), td(e(j.site)), td(e(j.start)), td(j.total, 1), td(tag(j.status))]))
    + '<p class="mu ft">' + e(w.made) + " " + e(d.made) + "</p>";
}
// Opening a locked page: the same steps as biz-vault.js openData, in the client's browser.
function unlock(text, pin) {
  const enc = new TextEncoder(), unb = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)), h = JSON.parse(text), S = crypto.subtle;
  const aad = enc.encode(JSON.stringify({ format: h.format, v: h.v, kind: h.kind, name: h.name, created: h.created, kdf: h.kdf, iv: h.iv, counts: h.counts, fp: h.fp }));
  return S.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"])
    .then((b) => S.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: unb(h.kdf.salt), iterations: h.kdf.iter }, b, { name: "AES-GCM", length: 256 }, false, ["decrypt"]))
    .then((k) => S.decrypt({ name: "AES-GCM", iv: unb(h.iv), additionalData: aad }, k, unb(h.data)))
    .then((buf) => JSON.parse(new TextDecoder().decode(buf)));
}

/** The page: open (data inside as JSON) or locked (sealed = the biz-vault text; the PIN opens it in the browser). */
export function portalHTML({ data = null, sealed = null, lang = "en", title = "" }) {
  const w = W[lang === "ar" ? "ar" : "en"], rtl = lang === "ar";
  const json = (x) => JSON.stringify(x).replace(/</g, "\\u003c");
  const css = "body{margin:0;font:15px/1.45 system-ui,-apple-system,Segoe UI,Tahoma,sans-serif;background:#F4F6FA;color:#0F172A}main{max-width:860px;margin:0 auto;padding:18px 16px 40px}h1{font-size:22px;margin:2px 0 10px}h2{font-size:16px;margin:22px 0 8px}.mu{color:#5B6B80;margin:0}.ft{margin-top:24px;font-size:12px}"
    + ".k{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.k div{background:#fff;border:1px solid #DCE3EC;border-radius:16px;padding:12px}.k span{display:block;font-size:12px;color:#5B6B80}.k b{font-size:20px;font-variant-numeric:tabular-nums}.k .bad b{color:#B91C1C}"
    + ".tw{overflow-x:auto;background:#fff;border:1px solid #DCE3EC;border-radius:16px}table{border-collapse:collapse;width:100%;font-size:13.5px}th,td{padding:9px 10px;text-align:start;border-top:1px solid #EEF2F7;white-space:nowrap}th{color:#5B6B80;font-weight:600;border-top:0}.n{text-align:end;font-variant-numeric:tabular-nums}"
    + ".t{font-size:11.5px;font-weight:700;border-radius:99px;padding:2px 8px;background:#E2E8F0;color:#475569}.t-paid,.t-cleared,.t-completed{background:#DCFCE7;color:#15803D}.t-overdue,.t-bounced{background:#FEE2E2;color:#B91C1C}.t-partial,.t-pending,.t-active{background:#FEF3C7;color:#B45309}"
    + "form{background:#fff;border:1px solid #DCE3EC;border-radius:18px;padding:18px;margin-top:40px;display:grid;gap:10px}input{font:inherit;padding:12px;border-radius:12px;border:1px solid #CBD5E1}button{font:inherit;font-weight:700;padding:12px;border:0;border-radius:12px;background:#0F766E;color:#fff}#err{color:#B91C1C;margin:0;min-height:1em}";
  const lock = '<form id="f"><b>' + w.locked + "</b><label>" + w.pin + '<br><input id="pin" type="password" inputmode="numeric" autocomplete="off" autofocus></label><p id="err"></p><button>' + w.open + "</button></form>";
  const boot = sealed
    ? "var S=" + json(sealed) + ";document.getElementById('f').onsubmit=function(ev){ev.preventDefault();if(!(window.crypto&&crypto.subtle)){document.getElementById('err').textContent=W.browser;return;}Promise.resolve().then(function(){return unlock(S,document.getElementById('pin').value);}).then(function(d){document.getElementById('m').innerHTML=render(d,W);}).catch(function(){document.getElementById('err').textContent=W.wrong;});};"
    : "document.getElementById('m').innerHTML=render(" + json(data) + ",W);";
  return '<!doctype html><html lang="' + (rtl ? "ar" : "en") + '" dir="' + (rtl ? "rtl" : "ltr") + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">'
    + "<title>" + String(title || w.title).replace(/</g, "") + "</title><style>" + css + "</style></head><body><main id=\"m\">" + (sealed ? lock : "") + "</main><script>var W=" + json(w) + ";var render=(" + render.toString() + ");var unlock=(" + unlock.toString() + ");" + boot + "</script></body></html>";
}
