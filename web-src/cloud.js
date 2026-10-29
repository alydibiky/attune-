/* ---- v6.32: the parts that need Ali's accounts — Google Drive sync, the Family circle, and paid web search for Pro --------
   Everything here is ready except the account ids, which only Ali can create (SETUP_CLOUD.md has the exact steps). Until
   CLOUD has them, nothing on screen changes: syncReady() and proSearchReady() are false and the app behaves as today.

   Drive sync = the encrypted backup (backup.js: PBKDF2 + AES-GCM, the password never leaves the phone) kept in the app's
   hidden Drive folder (drive.appdata: Attune can see only its own file, never the user's Drive). Each phone pulls, merges
   (mergeKeys: lists joined by id, nothing lost) and pushes. Google sees only locked bytes.
   Family circle = shared lists on top of the same sync: each list is a set of items with an id, a time and a "deleted" mark,
   so two phones that changed the list offline both keep their changes (mergeList).
   Paid search for Pro = when the free engines return nothing, a Pro phone asks Attune's small relay (tools/pro-search-relay,
   holding Ali's search key), which returns pages in the same shape as the free search.
   Tests: tests/unit/v736cloud.test.mjs.                                                                                       */
import { collectData, encryptBackup, decryptBackup, mergeKeys, restoreData } from "./backup.js";

/** Filled in by Ali's setup (SETUP_CLOUD.md). Empty = off. */
export const CLOUD = {
  googleWebClientId: "",     // Google Cloud → Credentials → "Web application" client id (…apps.googleusercontent.com)
  proSearchUrl: "",          // the relay's address after `wrangler deploy` (https://attune-search.<name>.workers.dev)
};

export const syncReady = (c = CLOUD) => /\.apps\.googleusercontent\.com$/.test(String(c.googleWebClientId || ""));
export const proSearchReady = (c = CLOUD) => /^https:\/\/[^/\s]+/.test(String(c.proSearchUrl || ""));

const SYNC_KEY = "attune:sync:v1";        // { lastSync: ISO, device: id, remoteStamp: ISO } — never synced itself
// v8.7: what Gmail gave (and the messages waiting for review) stays on the phone that read it — Google's free review of
// gmail.readonly depends on email content never leaving the phone (docs/GMAIL_VERIFICATION.md); each phone reads Gmail itself
export const SYNC_SKIP = [/^attune:sync:/, /^attune:vault:/, /^attune:dev$/, /^attune:testing-pro$/, /^attune:gmail:/, /^attune:sms-old:/];

/** What to send: the backup's keys minus this phone's own settings that must not travel (sync state, the PIN vault, Gmail). */
export function syncKeys(all) {
  const out = {};
  for (const [k, v] of Object.entries(all || {})) if (!SYNC_SKIP.some((re) => re.test(k))) out[k] = v;
  // the Overpaying check keeps the emails it read: the ones from Gmail ("gm:") stay here; pasted ones and the export may travel
  if (out["attune:overpay:v1"]) { try { const o = JSON.parse(out["attune:overpay:v1"]); if (o && Array.isArray(o.emails)) { o.emails = o.emails.filter((e) => !String(e && e.id).startsWith("gm:")); out["attune:overpay:v1"] = JSON.stringify(o); } } catch (e) {} }
  return out;
}

/** What to do, from this phone's last sync and the stamp of the file on Drive. */
export function syncStep(state, remote) {
  if (!remote) return "push";                                              // nothing on Drive yet
  if (!state || !state.remoteStamp) return "merge";                       // first time on this phone: keep both sides
  return remote.created > state.remoteStamp ? "merge" : "push";           // another phone wrote since: merge first
}

/**
 * One sync: get the file from Drive (native "driveSync" get) → merge → put it back. `call` is nativeCall;
 * `storage` is localStorage. Returns { step, pulled, pushed }. Errors (no setup, signed out, wrong password) are thrown.
 */
export async function syncNow({ call, password, storage, app = "6" }) {
  if (!syncReady()) throw new Error("Drive sync is not set up yet");
  const s = storage || localStorage;
  let state = {}; try { state = JSON.parse(s.getItem(SYNC_KEY) || "{}"); } catch (e) {}
  const got = await call("driveSync", { op: "get", clientId: CLOUD.googleWebClientId });
  const remoteText = got && got.text;
  let remote = null; try { remote = remoteText ? JSON.parse(remoteText) : null; } catch (e) {}
  const step = syncStep(state, remote);
  let pulled = 0;
  if (step === "merge") {
    const theirs = await decryptBackup(remoteText, password);              // a wrong password stops here, nothing changed
    const keys = syncKeys(theirs);
    pulled = Object.keys(keys).length;
    restoreData(keys, "merge", s);
  }
  const mine = syncKeys(collectData(s));
  const text = await encryptBackup(mine, password, { app });
  await call("driveSync", { op: "put", clientId: CLOUD.googleWebClientId, text });
  const head = JSON.parse(text);
  s.setItem(SYNC_KEY, JSON.stringify({ ...state, lastSync: new Date().toISOString(), remoteStamp: head.created }));
  return { step, pulled, pushed: Object.keys(mine).length };
}
export { mergeKeys };

/* ---- the Family circle: shared lists that merge item by item --------------------------------------------------------- */
/** A list item: { id, text, done, by, at (ms), deleted } */
export function mergeList(a, b) {
  const map = new Map();
  for (const it of [...(a || []), ...(b || [])]) {
    if (!it || !it.id) continue;
    const o = map.get(it.id);
    if (!o || (it.at || 0) > (o.at || 0)) map.set(it.id, it);
  }
  return [...map.values()].sort((x, y) => (x.created || x.at || 0) - (y.created || y.at || 0));
}
export const visible = (list) => (list || []).filter((x) => !x.deleted);
/** A change to an item, stamped so the newer one wins on every phone. */
export function edit(item, change, who, now = Date.now()) { return { ...item, ...change, by: who || item.by, at: Math.max(now, (item.at || 0) + 1) }; }

/* ---- paid web search for Pro --------------------------------------------------------------------------------------- */
let PRO = false;
/** The app says whether this phone has Pro (attune.jsx sets it from the plan / trial). */
export function setProSearch(on) { PRO = !!on; }
export const proSearchOn = () => PRO && proSearchReady();

/** Ask the relay: { q, pages } → hits in the free search's shape [{ title, text, url, date }]. */
export async function proLookup(q, { pages = 6, device = "", fetchFn } = {}) {
  if (!proSearchOn()) return { hits: [], via: "none", why: "" };
  const f = fetchFn || fetch;
  const r = await f(CLOUD.proSearchUrl.replace(/\/$/, "") + "/search", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Attune-Device": device },
    body: JSON.stringify({ q: String(q || "").slice(0, 300), pages }) });
  if (r.status === 429) return { hits: [], via: "pro", why: "Today's Pro searches are used up" };
  if (!r.ok) return { hits: [], via: "pro", why: "Pro search returned " + r.status };
  const j = await r.json();
  const hits = (j.hits || []).filter((h) => h && h.url).map((h) => ({ title: String(h.title || ""), text: String(h.text || "").slice(0, 4000), url: h.url, date: h.date || "", source: "web" }));
  return { hits, via: "pro", why: hits.length ? "" : "Nothing came back for that." };
}
