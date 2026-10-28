/* ---- v8.7 (Ali: "for every friend you send a link to who subscribes, you get a month free, maximum 3" + "can't it be linked to a
   Google account"): the invite card's logic. The person signs in once with Google (Google's own screen, NativeBridge.googleAccount
   → a token that only says who they are); the referral server (server/referral, Firebase) gives their invite code and counts the
   friends who SUBSCRIBED (Google Play tells it — it can't be faked from a phone). Each friend = +30 days: Play moves the giver's
   renewal (never charged), or, with no Play subscription, 30 Pro days wait here until the app takes them (redeem).
   REFERRAL_SERVER is empty until Ali deploys the server (server/referral/README.md); then the card turns on by itself.          */
export const REFERRAL_SERVER = "";   // e.g. "https://europe-west1-<project>.cloudfunctions.net/referral"
export const INVITE_KEY = "attune:invite:v1";
// (the tests point the card at a pretend server; a person can't set this)
const serverAddr = () => { try { return REFERRAL_SERVER || localStorage.getItem("attune:invite-server") || ""; } catch (e) { return REFERRAL_SERVER; } };
export const BONUS_KEY = "attune:pro-bonus-until";
const DAY = 864e5;

export const inviteReady = (native, server = serverAddr()) => !!(server && native && native.googleAccount);
export function loadInvite(s = typeof localStorage !== "undefined" ? localStorage : null) { try { return JSON.parse((s && s.getItem(INVITE_KEY)) || "null"); } catch (e) { return null; } }
const saveInvite = (v, s = typeof localStorage !== "undefined" ? localStorage : null) => { try { s && s.setItem(INVITE_KEY, JSON.stringify(v)); } catch (e) {} return v; };

/** Pro days given by friends: until when (ms), 0 = none. */
export function bonusUntil(s = typeof localStorage !== "undefined" ? localStorage : null, now = Date.now()) { try { const v = +((s && s.getItem(BONUS_KEY)) || 0); return v > now ? v : 0; } catch (e) { return 0; } }
/** Add `days` of Pro after whatever is left (friends' months stack). */
export function addBonus(days, s = typeof localStorage !== "undefined" ? localStorage : null, now = Date.now()) {
  const from = Math.max(now, bonusUntil(s, now)), until = from + days * DAY;
  try { s && s.setItem(BONUS_KEY, String(until)); } catch (e) {} return until;
}

/** Sign in (once) and ask the server: → { code, friends, max, days, referred, acct }. `call` = nativeCall; `post` = fetch-like. */
export async function inviteHello(call, { ref = "", purchaseToken = "", productId = "", server = serverAddr(), post = typeof fetch === "function" ? fetch : null, store } = {}) {
  if (!server || !post) throw new Error("Invites aren't switched on yet");
  const tok = await call("googleAccount", {});
  if (!tok || !tok.token) throw new Error((tok && tok.error) || "Google sign-in was cancelled");
  const r = await post(server, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "hello", token: tok.token, ref, purchaseToken, productId }) });
  const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "The invite server didn't answer");
  return saveInvite({ ...j, at: Date.now() }, store);
}
/** The waiting days → Pro days on this phone. → days added. */
export async function inviteRedeem(call, { server = serverAddr(), post = typeof fetch === "function" ? fetch : null, store } = {}) {
  const tok = await call("googleAccount", {});
  const r = await post(server, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "redeem", token: tok.token }) });
  const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "The invite server didn't answer");
  if (j.days > 0) addBonus(j.days, store);
  const inv = loadInvite(store); if (inv) saveInvite({ ...inv, days: 0 }, store);
  return j.days || 0;
}
