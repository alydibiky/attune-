// v9.9.17 (Ali, 11 Nov 2026: "a sample of 10000 notifications in every area that can be anything and see how the app deals with it").
// What Attune DOES with one notification — a mirror built from the app's own readers, in the order the pages use them:
//   Money's inbox           paylog.js readNotification (+ codeSure = "added by itself")
//   Autopilot's one card    autopilot.js suggestFrom   (subscription · expense / income · delivery follow-up · to-do · call back · bill)
//   "Is this money yours?"  notelabels.js asksFrom     (money in a chat, a receipt)
//   Deadline radar          deadlines.js fromNotifications
//   what it IS (Recall)     notifmeaning.js understandNote → kind
// No model, no phone. A result here is a strong hint, not proof (PayListener.kt / RecallLog.kt filter before the page sees anything).
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
const P = await import("../../web-src/paylog.js");
const NL = await import("../../web-src/notelabels.js");
const NM = await import("../../web-src/notifmeaning.js");
const AP = await import("../../web-src/autopilot.js");
const D = await import("../../web-src/deadlines.js");
const T = (f, d = null) => { try { return f(); } catch (e) { return d; } };
export const setCountry = (c) => localStorage.setItem("attune:country", c);
const TEACH = { rules: [], asked: [], skip: [] };

/** One notification → what happens: { money: {amount, dir, cur, auto} | null, card: "" | subscription | expense | income | followup |
 *  delivered | todo | callback | bill, cardAmount, cardTitle, ask: "" | "money" | "paid", guess, askAmount, deadline: bool, kind } */
export function act(n, { recent = [n] } = {}) {
  const pay = T(() => P.readNotification(n, { teach: TEACH }));
  const sug = T(() => AP.suggestFrom(n, { now: n.ts, recent }));
  const asks = T(() => NL.asksFrom([n], TEACH, { bankish: P.moneySourceNote, payOf: (x) => P.readNotification(x, { teach: TEACH }), now: n.ts, handled: (x) => !!AP.suggestFrom(x, { now: x.ts }) }), []) || [];
  const dls = T(() => D.fromNotifications([n], [], { now: n.ts, order: "dmy" }).filter((f) => f.date >= D.isoDay(n.ts)), []) || [];
  const k = T(() => NM.understandNote(n), {}) || {};
  return { money: pay ? { amount: pay.amount, dir: pay.direction, cur: pay.currency, auto: !!P.codeSure(pay) } : null,
    card: sug ? sug.kind : "", cardAuto: !!(sug && AP.isAuto(AP.emptyState(), sug)), cardAmount: sug ? sug.amount || 0 : 0, cardTitle: sug ? sug.title || "" : "", cardAt: sug ? sug.at || 0 : 0,
    ask: asks[0] ? asks[0].why : "", guess: asks[0] ? asks[0].guess || "" : "", askAmount: asks[0] && asks[0].pay ? asks[0].pay.amount : 0,
    deadline: dls.length > 0, kind: k.kind || "other" };
}
