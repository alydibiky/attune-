/* ---- v10.9.9 the Mind search index (BM25), moved out of attune.jsx so it can be tested. Ali: "still the app is very glitchy and slow" —
   every chat answer is kept in Mind, and the WHOLE index was rebuilt after each one (1,500 records ≈ 100 ms on a computer, 3–5× that on
   a phone: a freeze right when the answer ends). The index now holds the records themselves (not their positions) and each record's
   words are counted once, so a new / changed / removed record only touches its own words. Tests: tests/unit/v1099askmind.test.mjs. */
export const K1 = 1.2, B = 0.75;
export function makeMemIndex(memTokens) {
  // v10.9.9 (Ali: "still the app is very glitchy and slow"): every chat answer is kept in Mind, and the WHOLE index was rebuilt after
  // each one (1,500 records ≈ 100 ms on a computer, 3–5× that on a phone — a freeze right when the answer ends). The index now holds
  // the records themselves (not their positions), so a new / changed / removed record only touches its own words.
  const memTfCache = new WeakMap();   // record → Map(token → count)
  function memTf(rec) {
    let tf = memTfCache.get(rec); if (tf) return tf;
    const mm = rec.meta || {};   // v6.8 Mind: its title, summary, tags and your note are searchable too
    const toks = memTokens(rec.title + " \n " + rec.text + " \n " + rec.output + " " + (rec.tags || []).join(" ") +
      " " + [mm.myTitle, mm.aiTitle, mm.summary, mm.myNote, ...(mm.aiTags || []), ...(mm.myTags || [])].filter(Boolean).join(" "));
    tf = new Map(); for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    tf.n = toks.length || 1; memTfCache.set(rec, tf); return tf;
  }
  function memIndexAdd(ix, rec) {
    const tf = memTf(rec); ix.len.set(rec, tf.n); ix.total += tf.n;
    for (const [t, n] of tf) { ix.df.set(t, (ix.df.get(t) || 0) + 1); let p = ix.post.get(t); if (!p) ix.post.set(t, (p = [])); p.push([rec, n]); }
  }
  function memIndexRemove(ix, rec) {
    const tf = memTf(rec); if (!ix.len.has(rec)) return; ix.total -= ix.len.get(rec); ix.len.delete(rec);
    for (const t of tf.keys()) { const d = (ix.df.get(t) || 1) - 1; if (d > 0) ix.df.set(t, d); else ix.df.delete(t);
      const p = ix.post.get(t); if (p) { const q = p.filter((x) => x[0] !== rec); if (q.length) ix.post.set(t, q); else ix.post.delete(t); } }
  }
  function memIndexFinish(ix) { ix.n = ix.len.size; ix.avg = ix.total / (ix.n || 1); return ix; }
  function memBuildIndex(records) {
    const ix = { df: new Map(), post: new Map(), len: new Map(), total: 0, n: 0, avg: 1 };
    for (const rec of records) if (rec) memIndexAdd(ix, rec);
    return memIndexFinish(ix);
  }
  /** The new index from the last one: only the records that came, went or changed are (re)indexed. Many changes → a fresh build. */
  function memIndexUpdate(prev, prevRecs, records) {
    if (!prev || !prevRecs) return memBuildIndex(records);
    const was = new Set(prevRecs), now = new Set(records);
    const added = records.filter((r) => r && !was.has(r)), gone = prevRecs.filter((r) => r && !now.has(r));
    if (added.length + gone.length > 200) return memBuildIndex(records);
    const ix = { df: new Map(prev.df), post: new Map(prev.post), len: new Map(prev.len), total: prev.total, n: prev.n, avg: prev.avg };
    // (posting lists are shared with the old index until touched: copy one before changing it)
    const touched = new Set(); const own = (t) => { if (!touched.has(t)) { touched.add(t); const p = ix.post.get(t); if (p) ix.post.set(t, p.slice()); } };
    for (const r of gone) { for (const t of memTf(r).keys()) own(t); memIndexRemove(ix, r); }
    for (const r of added) { for (const t of memTf(r).keys()) own(t); memIndexAdd(ix, r); }
    return memIndexFinish(ix);
  }

  function memSearch(records, index, query, opts) {
    const o = opts || {};
    const now = o.now || Date.now();
    const qt = [...new Set(memTokens(query))];
    if (!qt.length) return [];
    const score = new Map();
    for (const t of qt) {
      const p = index.post.get(t);
      if (!p) continue;
      const df = index.df.get(t) || 1;
      const idf = Math.log(1 + (index.n - df + 0.5) / (df + 0.5));
      for (const [rec, tf] of p) {
        const norm = tf * (K1 + 1) / (tf + K1 * (1 - B + B * (index.len.get(rec) || 1) / index.avg));
        score.set(rec, (score.get(rec) || 0) + idf * norm);
      }
    }
    const out = [];
    for (const [rec, s] of score) {
      const ageD = Math.max(0, (now - rec.ts) / 86400000);
      // Recency is a nudge, not a ranking. Something from March that actually
      // matches should still beat yesterday's near-miss.
      const boost = 1 + 0.30 * Math.exp(-ageD / 45) + (rec.pinned ? 0.5 : 0);
      out.push({ rec, score: s * boost });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, o.limit || 30);
  }


  return { memBuildIndex, memIndexUpdate, memSearch };
}
