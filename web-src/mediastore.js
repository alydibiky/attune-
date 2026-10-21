/* ---- v6.48 the videos and recordings kept with /remember (CHAT_RUNS_APP.md S8): the file itself, on the phone, by its Mind id —
   so Mind can play it from the second that was found. IndexedDB "attune-media" (a store of Blobs). Never throws. */
const NAME = "attune-media";
let dbP = null;
function db() {
  if (dbP) return dbP;
  dbP = new Promise((ok, bad) => { try { const r = indexedDB.open(NAME, 1); r.onupgradeneeded = () => r.result.createObjectStore("files"); r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error); } catch (e) { bad(e); } });
  return dbP;
}
export const MEDIA_MAX = 300 * 1024 * 1024;   // a bigger file is remembered by its words only
export async function mediaPut(id, blob) {
  try { if (!blob || blob.size > MEDIA_MAX) return false; const d = await db(); return await new Promise((ok) => { const t = d.transaction("files", "readwrite"); t.objectStore("files").put(blob, id); t.oncomplete = () => ok(true); t.onerror = () => ok(false); t.onabort = () => ok(false); }); } catch (e) { return false; }
}
export async function mediaGet(id) { try { const d = await db(); return await new Promise((ok) => { const q = d.transaction("files").objectStore("files").get(id); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); }); } catch (e) { return null; } }
export async function mediaDel(id) { try { const d = await db(); d.transaction("files", "readwrite").objectStore("files").delete(id); } catch (e) {} }
/** "1:42" from milliseconds. */
export const clock = (ms) => { const s = Math.max(0, Math.round((ms || 0) / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
/** The cue where the asked words are said: the one holding the most of them (the first such). → { at, text } or null. */
export function cueFor(cues, words) {
  let best = null, n = 0;
  for (const c of cues || []) { const t = String(c.text || "").toLowerCase(); const k = words.filter((w) => t.includes(w)).length; if (k > n) { n = k; best = c; } }
  return best ? { at: best.start, text: best.text } : null;
}
/** A frame of a video (at ~1 s) as a small JPEG data URL, for Mind's wall; null when the phone can't. */
export function videoFrame(file, at = 1) {
  return new Promise((ok) => {
    try {
      const url = URL.createObjectURL(file), v = document.createElement("video");
      let done = false; const end = (r) => { if (done) return; done = true; try { URL.revokeObjectURL(url); } catch (e) {} ok(r); };
      v.muted = true; v.preload = "auto"; v.src = url;
      v.onloadeddata = () => { try { v.currentTime = Math.min(at, (v.duration || 2) / 2); } catch (e) { end(null); } };
      v.onseeked = () => { try { const k = Math.min(1, 420 / Math.max(v.videoWidth, v.videoHeight)); const c = document.createElement("canvas"); c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k); c.getContext("2d").drawImage(v, 0, 0, c.width, c.height); end({ thumb: c.toDataURL("image/jpeg", 0.72), dur: Math.round((v.duration || 0) * 1000) }); } catch (e) { end(null); } };
      v.onerror = () => end(null); setTimeout(() => end(null), 8000);
    } catch (e) { ok(null); }
  });
}
/** How long a recording is (ms), or 0. */
export function audioLength(file) {
  return new Promise((ok) => { try { const url = URL.createObjectURL(file), a = document.createElement("audio"); a.preload = "metadata"; a.src = url;
    const end = (v) => { try { URL.revokeObjectURL(url); } catch (e) {} ok(v); }; a.onloadedmetadata = () => end(Math.round((a.duration || 0) * 1000)); a.onerror = () => end(0); setTimeout(() => end(0), 5000); } catch (e) { ok(0); } });
}
/** What an attached file is: "photo" | "video" | "audio" | "doc". */
export const kindOfFile = (f) => (/^image\//.test(f.type || "") || /\.(jpe?g|png|webp|heic|gif|bmp)$/i.test(f.name || "") ? "photo"
  : /^video\//.test(f.type || "") || /\.(mp4|mov|mkv|webm|3gp|m4v)$/i.test(f.name || "") ? "video"
  : /^audio\//.test(f.type || "") || /\.(m4a|mp3|wav|ogg|aac|opus|amr|flac)$/i.test(f.name || "") ? "audio" : "doc");
const sliceB64 = (blob) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => bad(new Error("Couldn't read that file")); r.readAsDataURL(blob); });
/** A file → the Android app's cache, in pieces (nativeCall "cacheAppend"); onPct(0..100). → the name the app keeps it under. */
export async function sendToApp(file, nativeCall, onPct = () => {}, alive = () => true) {
  const step = 768 * 1024, name = Date.now().toString(36) + "-" + String(file.name || "media").replace(/[^A-Za-z0-9._-]/g, "_").slice(-60);
  let path = name;
  for (let at = 0; at < file.size || at === 0; at += step) {
    if (!alive()) throw new Error("Stopped");
    const r = await nativeCall("cacheAppend", { name, b64: await sliceB64(file.slice(at, at + step)), first: at === 0 });
    path = r.path || name; onPct(Math.min(100, ((at + step) / Math.max(1, file.size)) * 100));
    if (file.size === 0) break;
  }
  return path;
}
