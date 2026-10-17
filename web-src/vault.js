/* ---- v6.32: Private vault (roadmap: "Private vault with fingerprint (Money, Cycle, documents)") -----------------------------
   When it is on, the places the person picked open only after the phone's own fingerprint / face / screen lock (Vault.kt);
   on a computer or where the phone has none, a 4–6 digit PIN. Unlocked once, they stay open until Attune goes to the
   background for more than a minute. Pure parts here; tests: tests/unit/v736vault.test.mjs.                                    */

/** The places that can be locked, and the pages in each. */
export const VAULT_AREAS = {
  money: ["money", "guardian", "life", "lifeask"],
  cycle: ["cycle"],
  health: ["care", "health"],
  docs: ["radar", "reminders", "shelf", "memory"],
};
export const VAULT_LABEL = { money: "Money & people", cycle: "Cycle", health: "Family health", docs: "Documents & notes" };
export const GRACE_MS = 60000;

const KEY = "attune:vault:v1";
export function loadVault(ls = typeof localStorage !== "undefined" ? localStorage : null) {
  try { const j = JSON.parse((ls && ls.getItem(KEY)) || "null"); if (j && typeof j === "object") return { on: false, areas: ["money", "cycle"], ...j }; } catch (e) {}
  return { on: false, areas: ["money", "cycle"] };
}
export function saveVault(v, ls = typeof localStorage !== "undefined" ? localStorage : null) { try { ls && ls.setItem(KEY, JSON.stringify(v)); } catch (e) {} return v; }

/** Is this page behind the vault? */
export function vaulted(mode, v) { return !!(v && v.on && (v.areas || []).some((a) => (VAULT_AREAS[a] || []).includes(mode))); }
/** Still open? Opened this session and not in the background for more than the grace time. */
export function stillOpen(state, now = Date.now()) { return !!(state && state.open && (!state.hiddenAt || now - state.hiddenAt <= GRACE_MS)); }

// a PIN for phones with no screen lock and for the computer: salted, never stored as typed
const h53 = (str) => { let a = 0xdeadbeef, b = 0x41c6ce57; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); } a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909); b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909); return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36); };
export const validPin = (p) => /^\d{4,6}$/.test(String(p || ""));
export function withPin(v, pin, salt = Math.random().toString(36).slice(2, 10)) { return validPin(pin) ? { ...v, pin: { salt, h: h53("vault|" + salt + "|" + pin) } } : v; }
export const pinOk = (v, pin) => !!(v && v.pin && h53("vault|" + v.pin.salt + "|" + String(pin)) === v.pin.h);
/** How this device unlocks: "bio" (fingerprint/face/screen lock) or "pin". avail = AttuneNative.vaultAvailable() parsed. */
export const unlockWay = (avail) => (avail && (avail.bio || avail.secure) ? "bio" : "pin");
