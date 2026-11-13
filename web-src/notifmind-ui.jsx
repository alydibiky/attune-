/* ---- v9.9.31 the model reads what code isn't sure of (notifmind.js). Readings are kept by notification id (attune:notifmind:v1) and
   used by Recall search, Chat's "what Attune already knows" and Autopilot (a request in Russian / Chinese / a long message → a to-do).
   MindRunner: while the model is loaded, the newest notifications of the last 3 days that code is not sure of are read one by one
   (at most 15 each time Attune opens / the model wakes), the answer checked (readMind: no number, date or name that isn't in the
   notification) and merged with code's reading. No screen of its own. */
import { useEffect } from "react";
import { getLang } from "./i18n.js";
import { comprehend, mindPrompt, readMind, merge } from "./notifmind.js";
const KEY = "attune:notifmind:v1", MAX = 600;
export function loadMinds() { try { const j = JSON.parse(localStorage.getItem(KEY) || "{}"); return j && typeof j === "object" ? j : {}; } catch (e) { return {}; } }
function saveMind(id, r) { try { const all = loadMinds(); all[id] = { ...r, at: Date.now() }; const ids = Object.keys(all); if (ids.length > MAX) ids.sort((a, b) => (all[a].at || 0) - (all[b].at || 0)).slice(0, ids.length - MAX).forEach((k) => delete all[k]); localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {} }
/** The best reading of a notification: the model's (merged) if Attune has one, else code's. */
export function mindOf(n, minds = null) { if (!n) return null; const m = (minds || loadMinds())[String(n.id)]; if (m) return m; try { return comprehend(n); } catch (e) { return null; } }
function recent() { try { const N = window.AttuneNative; return N && N.recallNotes ? JSON.parse(N.recallNotes() || "[]") : []; } catch (e) { return []; } }
export function MindRunner({ ready, ask }) {
  useEffect(() => { if (!ready || !ask) return; let stop = false;
    (async () => { const minds = loadMinds(), since = Date.now() - 3 * 864e5, lang = getLang();
      const todo = recent().filter((n) => n && n.id && (n.ts || 0) >= since && !minds[String(n.id)]).sort((a, b) => (b.ts || 0) - (a.ts || 0))
        .map((n) => ({ n, code: (() => { try { return comprehend(n); } catch (e) { return null; } })() })).filter((x) => x.code && !x.code.sure).slice(0, 15);
      for (const { n, code } of todo) { if (stop) return; let out = "";
        try { out = String(await ask(mindPrompt(n, { lang, now: n.ts || Date.now() })) || ""); } catch (e) { return; }
        saveMind(String(n.id), merge(code, readMind(out, n)));
        try { window.dispatchEvent(new CustomEvent("attune-notifmind")); } catch (e) {} } })();
    return () => { stop = true; }; }, [ready]);
  return null;
}
