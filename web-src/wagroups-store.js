/* ---- v8.7 the WhatsApp groups library's storage (wagroups.js): IndexedDB "attune-wa" — one record per group (its items, what the
   phone saw in its photos, the moves made by hand, its kind) + the group's last export text (for Money & promises), and, in the
   browser / computer app, the photos themselves (on Android they are files the phone keeps: /wa/<group>/<name>).
   Never throws. */
const DB = "attune-wa";
let dbP = null;
function db() {
  if (dbP) return dbP;
  dbP = new Promise((ok) => {
    try {
      if (typeof indexedDB === "undefined") return ok(null);
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore("groups"); r.result.createObjectStore("raw"); r.result.createObjectStore("photos"); };
      r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); r.onblocked = () => ok(null);
    } catch (e) { ok(null); }
  });
  return dbP;
}
const req = (store, mode, fn) => db().then((d) => new Promise((ok) => {
  if (!d) return ok(null);
  try { const t = d.transaction(store, mode); const r = fn(t.objectStore(store)); t.oncomplete = () => ok(r && "result" in r ? r.result : true); t.onerror = () => ok(null); } catch (e) { ok(null); }
}));
export async function loadGroups() {
  const d = await db(); if (!d) return [];
  return new Promise((ok) => { try { const out = []; const c = d.transaction("groups").objectStore("groups").openCursor();
    c.onsuccess = () => { const cur = c.result; if (cur) { out.push(cur.value); cur.continue(); } else ok(out.sort((a, b) => (b.updated || 0) - (a.updated || 0))); }; c.onerror = () => ok(out); } catch (e) { ok([]); } });
}
export const saveGroup = (g) => req("groups", "readwrite", (s) => s.put(g, g.id));
export const deleteGroup = async (id) => { await req("groups", "readwrite", (s) => s.delete(id)); await req("raw", "readwrite", (s) => s.delete(id)); };
export const saveRaw = (id, text) => req("raw", "readwrite", (s) => s.put(String(text || ""), id));
export const loadRaw = (id) => req("raw", "readonly", (s) => s.get(id));
export const putPhoto = (gid, name, blob) => req("photos", "readwrite", (s) => s.put(blob, gid + "/" + name));
export const getPhoto = (gid, name) => req("photos", "readonly", (s) => s.get(gid + "/" + name));
