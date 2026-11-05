/* ---- v9.3 Money for two (Ali picked D4: "make A and B and users choose what they want").
   A — share some accounts (a "House" account, the family card); B — share all of Money. Either way the share is ONE file, locked with
   a family code you agree on (like the Family page's file — no account, no server): "Send the update" through WhatsApp or any app,
   the other phone "Opens the update", and the ledger merges it by id (the newer copy of an entry wins; who added each is kept; an entry
   deleted on one phone leaves the other). Never a zakat entry; never anything outside what was chosen. Pure (the ledger merges it
   itself: Yusr's "merge-share" op). Tests: tests/unit/v930moneyshare.test.mjs. */
import { encryptBackup, decryptBackup } from "./backup.js";

export const SHARE_KEY = "attune:sync:moneyshare";   // this phone only (attune:sync:* never travels): { id, scope, me, code, lastIds }
export const FILE_KEY = "attune:moneyshare";
export const newShareId = (rand = Math.random) => "ms-" + Date.now().toString(36) + "-" + Math.floor(rand() * 1e9).toString(36);
export function loadShare(s = typeof localStorage !== "undefined" ? localStorage : null) { try { return JSON.parse((s && s.getItem(SHARE_KEY)) || "null") || null; } catch (e) { return null; } }
export function saveShare(v, s = typeof localStorage !== "undefined" ? localStorage : null) { try { s && s.setItem(SHARE_KEY, JSON.stringify(v)); } catch (e) {} return v; }

/** What goes in the file. scope: { kind: "all" } | { kind: "accounts", ids: [...] }. lastIds: the entries in the last update sent or opened
 *  (an id missing now was deleted here → it goes as "gone"). */
export function shareData(ledger, scope, { id, me = "", lastIds = [], now = Date.now() } = {}) {
  const L = ledger || {}, all = scope && scope.kind === "all";
  const accs = (L.accounts || []).filter((a) => a && a.id && (all || ((scope && scope.ids) || []).includes(a.id)));
  const ids = new Set(accs.map((a) => a.id));
  const txns = (L.txns || []).filter((t) => t && t.id && ids.has(t.account) && (t.type !== "transfer" || ids.has(t.toAccount)) && t.type !== "zakat" && t.cat !== "zakat" && Number(t.amount) > 0)
    .map((t) => ({ id: String(t.id), type: t.type, amount: Number(t.amount), account: t.account, ...(t.type === "transfer" ? { toAccount: t.toAccount } : {}), cat: t.cat || "other", date: t.date || "",
      note: String(t.note || "").slice(0, 80), created: +t.created || 0, updated: +t.updated || 0, by: String(t.by || me || "").slice(0, 30) }));
  const have = new Set(txns.map((t) => t.id));
  return { v: 1, id, from: String(me || "").slice(0, 30), scope: all ? { kind: "all" } : { kind: "accounts", ids: [...ids] }, at: now,
    accounts: accs.map((a) => ({ id: a.id, name: String(a.name || "").slice(0, 60), emoji: String(a.emoji || "").slice(0, 8), currency: a.currency, start: +a.start || 0, kind: a.kind || "cash", ...(a.karat ? { karat: a.karat } : {}) })),
    txns, gone: (lastIds || []).filter((x) => !have.has(x)) };
}
/** The file text (locked with the family code). */
export const packShare = (data, code, opts = {}) => encryptBackup({ [FILE_KEY]: JSON.stringify(data) }, code, { iterations: opts.iterations || 200000, app: "money-share" });
/** A file opened here → the share inside it. Throws "Wrong family code…" / "This isn't a Money share." */
export async function readShare(text, code) {
  let keys;
  try { keys = await decryptBackup(text, code); } catch (e) { throw new Error(/Wrong password/.test(String(e && e.message)) ? "Wrong family code — nothing was changed." : String((e && e.message) || e)); }
  let d = null; try { d = JSON.parse(keys[FILE_KEY] || "null"); } catch (e) { d = null; }
  if (!d || d.v !== 1 || typeof d.id !== "string" || !Array.isArray(d.accounts) || !Array.isArray(d.txns)) throw new Error("This isn't a Money share.");
  return d;
}
/** Who added an entry, for the little circle on it: the first letter of the name. */
export const initial = (by) => String(by || "").trim().slice(0, 1).toUpperCase();
