/* ---- v9.9.18 B1 wiring (Ali OK'd AU5 / AU7 / AU8 on the combined screens, 12 Nov 2026). Joins the pure parts (nag.js, notifpay.js,
   donelog.js) to the app's stores: a payment reminder from People & plans carries the Paid → balance buttons (AU7); the taps the phone
   kept are turned into Money exactly once when Attune opens, the instalment is ticked, and each one is written in "Done for you"
   (AU8) with Undo; the person's quiet hours and the button words go with every reminder (AU5). Tests: tests/unit/v9918b1wire.test.mjs. */
import { tr } from "./i18n.js";
import { payButtons, applyTaps } from "./notifpay.js";
import * as D from "./donelog.js";
import { loadLife, saveLife, togglePaid, progressOf } from "./life.js";
import { appendToLedger } from "./paylog.js";

export const PAYS_KEY = "attune:pays:v1", NP_KEY = "attune:notifpay:v1", QUIET_KEY = "attune:quiet:v1";
const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
export const quietHours = () => get(QUIET_KEY, { from: "23:00", to: "07:00" });
export const setQuietHours = (q) => put(QUIET_KEY, q);
/** The words on the phone's buttons, in the person's language. */
export const buttonWords = () => ({ done: tr("Done"), hour: tr("In 1 hour"), tomorrow: tr("Tomorrow") });

/** A People & plans reminder → the same reminder with the Paid → balance buttons, when it is money I pay from my own balances. */
export function withPayButtons(r, data, accounts = []) {
  try {
    if (!r || !/^life-/.test(r.id)) return r;
    const c = ((data && data.items) || []).find((x) => "life-" + x.id === r.id); if (!c || c.dir === "in") return r;
    if (c.payer && c.payer !== "me") return r;   // someone else pays / nobody: no Paid button (it never touches my balance)
    const n = progressOf(c).next; if (!n) return r;
    const accs = c.account ? accounts.filter((a) => a.id === c.account) : accounts;
    const pay = payButtons({ amount: n.amount, currency: c.currency || (accs[0] && accs[0].currency) || "", note: c.title || c.person || "", cat: c.kind === "rent" ? "rent" : "bills" }, (accs.length ? accs : accounts).map((a) => ({ id: a.id, name: a.name })),
      { paid: tr("Paid"), tomorrow: tr("Tomorrow"), hour: tr("In 1 hour"), which: tr("Paid {a} — from which balance?"), done: tr("✓ {a} from {b}"), undo: tr("Undo") });
    const pays = get(PAYS_KEY, {}); pays[r.id] = { ...pay, lifeId: c.id, i: n.i }; put(PAYS_KEY, pays);
    return { ...r, pay };
  } catch (e) { return r; }
}

/** When Attune opens: the taps from the notifications → Money (once), the instalment ticked, "Done for you" written. → lines to show */
export function applyPhoneTaps(native, { loadLedger, saveLedger, now = Date.now() } = {}) {
  let taps = []; try { taps = JSON.parse((native && native.takeTaps && native.takeTaps()) || "[]"); } catch (e) { taps = []; }
  if (!taps.length) return [];
  const pays = get(PAYS_KEY, {}), r = applyTaps(taps, pays, get(NP_KEY, { seen: {}, paid: {} }), now);
  put(NP_KEY, r.state);
  const lines = [];
  let led = loadLedger && loadLedger(), life = loadLife(), dl = D.load();
  if (led && r.add.length) { const a = appendToLedger(led, r.add.map(({ id, ...t }) => ({ ...t, nid: id }))); led = a.ledger;   // (each line keeps its tap's id: nid)
    for (const x of r.add) { const p = Object.entries(pays).find(([rid]) => "np-" + rid === x.id.slice(0, ("np-" + rid).length)); const info = p && p[1];
      if (info && info.lifeId != null) { const c = life.items.find((y) => y.id === info.lifeId); if (c && !(c.paid || []).includes(info.i)) life = togglePaid(life, info.lifeId, info.i); }
      dl = D.record(dl, { kind: "money", source: x.note, amount: x.amount, cat: x.cat, account: x.account, what: tr("Paid from the notification: {n}", { n: x.note }), undo: { nid: x.id, lifeId: info && info.lifeId, i: info && info.i } }, now).st;
      lines.push(tr("{n}: {a} recorded in Money", { n: x.note, a: x.amount.toLocaleString() })); } }
  if (led && r.remove.length) { led = { ...led, txns: led.txns.filter((t) => !r.remove.includes(t.nid)) };
    for (const nid of r.remove) { const rid = Object.keys(pays).find((k) => nid.startsWith("np-" + k + "-")), info = rid && pays[rid];
      if (info && info.lifeId != null) { const c = life.items.find((y) => y.id === info.lifeId); if (c && (c.paid || []).includes(info.i)) life = togglePaid(life, info.lifeId, info.i); }
      const e = dl.log.find((x) => x.undo && x.undo.nid === nid && !x.undone); if (e) dl = D.undo(dl, e.id).st; }
    lines.push(tr("Undone")); }
  if (led && saveLedger) saveLedger(led); saveLife(life); D.save(dl);
  return lines;
}

/** Undo from the "Done for you" page: takes the payment out of Money and un-ticks the instalment. */
export function undoDone(id, { loadLedger, saveLedger } = {}) {
  let dl = D.load(); const r = D.undo(dl, id); if (!r.entry) return false; dl = r.st; D.save(dl);
  const u = r.entry.undo || {};
  if (u.nid && loadLedger) { const led = loadLedger(); if (led) saveLedger({ ...led, txns: led.txns.filter((t) => t.nid !== u.nid) }); }
  if (u.lifeId != null) { let life = loadLife(); const c = life.items.find((y) => y.id === u.lifeId); if (c && (c.paid || []).includes(u.i)) { life = togglePaid(life, u.lifeId, u.i); saveLife(life); } }
  return true;
}
/** Edit from the "Done for you" page: the ledger line changes too. → { ask, remember, entry } */
export function editDone(id, patch, { loadLedger, saveLedger } = {}) {
  let dl = D.load(); const r = D.edit(dl, id, patch); if (!r.entry) return { ask: false }; D.save(r.st);
  const u = (r.entry.undo || {}); if (u.nid && loadLedger) { const led = loadLedger(); if (led) saveLedger({ ...led, txns: led.txns.map((t) => (t.nid === u.nid ? { ...t, ...("amount" in patch ? { amount: +patch.amount } : {}), ...("cat" in patch ? { cat: patch.cat } : {}), ...("account" in patch ? { account: patch.account } : {}) } : t)) }); }
  return r;
}
