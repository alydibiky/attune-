"""The phone's pack search (KnowPacks.kt) replicated exactly, for trials: normalised words, common words dropped, light stemming,
prefix OR match over FTS4, BM25 from matchinfo('pcnalx'), top k across every pack.
  python3 tests/trials/packsearch.py <packs dir> "question" [k]   → JSON {ms, passages}"""
import json, math, os, re, sqlite3, struct, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "tools"))
from build_map_pack import normalize

STOP = set("the a an of in on at to for and or is are was were be by with from as that this these those it its into about what which who whom whose when where why how do does did can could will would should may might than then there their them they he she his her you your i we our not no tell me please explain word words mean means meaning say says said define روي قال يقول في من على عن الى هو هي ما ماذا متى اين كيف كم هل التي الذي الذين او ثم مع كان كانت هذا هذه ذلك تلك".split())
def stem(w):
    if len(w) <= 4 or not w.isascii() or not w.isalpha(): return w
    for suf in ("ies", "ing", "ed", "es", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 4: return w[: -len(suf)]
    return w
def bm25(blob):
    ints = struct.unpack("%dI" % (len(blob) // 4), blob)
    p, c, n, avg = ints[0], ints[1], ints[2], max(1, ints[3]); ln = ints[3 + c]; x0 = 3 + 2 * c; s = 0.0
    for i in range(p):
        o = x0 + 3 * (i * c); tf, df = ints[o], ints[o + 2]
        if tf <= 0: continue
        s += math.log(1 + (n - df + 0.5) / (df + 0.5)) * (tf * 2.4) / (tf + 1.4 * (0.75 + 0.25 * ln / avg))   # v6.16b: a mild length penalty (long = the main model with all its versions)
    return s

_DB = {}
def db(path):
    if path not in _DB: _DB[path] = sqlite3.connect(path, check_same_thread=False)
    return _DB[path]

QUOTE = re.compile(r"«([^»]{6,200})»|“([^”]{6,200})”|\"([^\"]{6,200})\"|﴿([^﴾]{6,200})﴾|(?<![A-Za-z])'([^']{3,60})'(?![A-Za-z])")
def phrases_of(q):
    """Quoted text in the question («…», "…", ﴿…﴾) → exact phrases to look for first (a verse, a hadith, a saying)."""
    out = []
    for m in QUOTE.finditer(q or ""):
        w = normalize(next(g for g in m.groups() if g)).split()
        if len(w) >= 2 or (len(w) == 1 and len(w[0]) >= 5): out.append(" ".join(w[:12]))   # one quoted word: 'ubiquitous'
    return out[:2]

def terms_of(q):
    return list(dict.fromkeys(stem(w) for w in normalize(q).split() if len(w) >= 2 and w not in STOP))[:10]

def probe(con, words):
    """How many passages of this pack hold each word (and how many passages it has) — one cheap FTS call."""
    phr = [w.replace('"', "") + "*" for w in words]
    r = con.execute("SELECT matchinfo(passages_fts, 'pcnalx') FROM passages_fts WHERE passages_fts MATCH ? LIMIT 1", (" OR ".join(phr),)).fetchone()
    if not r: return None
    ints = struct.unpack("%dI" % (len(r[0]) // 4), r[0]); p, c, n = ints[0], ints[1], ints[2]; x0 = 3 + 2 * c
    return n, [ints[x0 + 3 * (i * c) + 2] for i in range(p)]

def near_phrase(q):
    """v6.16c: no quotes → the question's own run of words from its first to its last search word, when that is 2–4 words long
    («law of demand», «Newton's second law») — passages holding it word for word get ×2 («law» and «demand» alone are everywhere
    in an economics book)."""
    t = normalize(q).split()
    idx = [i for i, w in enumerate(t) if len(w) >= 2 and w not in STOP]
    if len(idx) < 2 or idx[-1] - idx[0] > 3: return None
    return " ".join(t[idx[0]:idx[-1] + 1])

def pack_search(con, words, k, gidf=None, pr=None, phrases=(), soft=None):
    """One pack (v6.16b): how rare is each word → filter by the rarest ones → rank by BM25 × coverage, with a title bonus."""
    phr = [w.replace('"', "") + "*" for w in words]
    pr = pr or probe(con, words)
    if not pr: return []
    n, df = pr
    # candidates: every passage holding a DISTINCTIVE word (in ≤ 3 % of the pack, or the 3 rarest); none → all words must match
    order = sorted(range(len(words)), key=lambda i: df[i])
    rare = [i for i in order if 0 < df[i] <= max(200, n * 0.03)] or [i for i in order if df[i] > 0][:1]
    if not rare: return []
    if sum(df[i] for i in rare) > 6000: rare = rare[:2]
    q = "(" + " OR ".join(phr[i] for i in rare) + ") (" + " OR ".join(phr) + ")"
    rows = con.execute("SELECT rowid, matchinfo(passages_fts, 'pcnalx') FROM passages_fts WHERE passages_fts MATCH ? LIMIT 6000", (q,)).fetchall()
    exact = set()
    for ph in phrases:                     # the quoted phrase, word for word: those passages first (×3)
        got = con.execute("SELECT rowid FROM passages_fts WHERE passages_fts MATCH ? LIMIT 60", ('"' + ph.replace('"', "") + '"',)).fetchall()
        exact |= {r[0] for r in got}
    loose = set()
    if soft and not phrases:
        loose = {r[0] for r in con.execute("SELECT rowid FROM passages_fts WHERE passages_fts MATCH ? LIMIT 200", ('"' + soft.replace('"', "") + '"',)).fetchall()}
    extra = []
    if exact:
        have = {r[0] for r in rows}
        missing = [r for r in exact if r not in have]
        if missing:   # the quoted passages that hold no distinctive word: fetched too (their matchinfo offset is the word count)
            extra = con.execute("SELECT rowid, matchinfo(passages_fts, 'pcnalx') FROM passages_fts WHERE passages_fts MATCH ? AND rowid IN (%s)" % ",".join(map(str, missing)),
                                ("(" + " OR ".join(phr) + ") (" + " OR ".join(phr) + ")",)).fetchall()
    out = []
    nf = len(rare)   # the matchinfo phrases: the distinctive words first, then every word of the question
    idf = gidf or [math.log(1 + n / max(1, d)) for d in df]      # how telling each word is — across all the packs when known
    tot = sum(idf)
    for rowid, blob, off in [(r, b, nf) for r, b in rows] + [(r, b, len(words)) for r, b in extra]:
        ii = struct.unpack("%dI" % (len(blob) // 4), blob)
        hit = [ii[3 + 2 * ii[1] + 3 * ((off + j) * ii[1])] > 0 for j in range(len(words))]
        cov = sum(w for w, h in zip(idf, hit) if h) / tot          # coverage weighted by how telling each word is
        out.append([rowid, bm25(blob) * (0.3 + cov) ** 2 * (3 if rowid in exact else 2 if rowid in loose else 1), cov])
    out.sort(key=lambda x: -x[1]); out = out[: k * 3]
    res = []
    for rowid, sc, cov in out:
        t = con.execute("SELECT title, text FROM passages WHERE id = ?", (rowid,)).fetchone()
        if not t: continue
        tw = normalize(t[0]).split()
        near = lambda x, w: x == w or (x.startswith(w) and x[len(w):] in ("s", "es", "ed", "er", "ing"))   # "seal" → "seals", not "sealion" or "seal6"
        inT = [any(near(x, w) for x in tw) for w in words]
        tcov = sum(w for w, h in zip(idf, inT) if h) / tot
        head = set(normalize(re.sub(r"\([^)]*\)", " ", t[0]).split(" — ")[0]).split())    # the name the passage is about ("BYD Seal")
        tprec = sum(1 for x in head if any(near(x, w) for w in words)) / max(1, len(head))   # "BYD Seal" beats "BYD Seal U" for "BYD Seal"
        res.append({"title": t[0], "text": t[1], "score": sc * (1 + tcov) * (1 + tprec) ** 2, "cov": round(cov, 3), "rowid": rowid})
    res.sort(key=lambda h: -h["score"])
    return res[:k]

def search(packs_dir, q, k=24, ids=None):
    words = terms_of(q); phrases = phrases_of(q); soft = near_phrase(q)
    if not words: return []
    hits, cons = [], []
    for fn in sorted(os.listdir(packs_dir)):
        if not fn.endswith(".sqlite"): continue
        pid = fn[:-7]
        if ids and pid not in ids: continue
        con = db(os.path.join(packs_dir, fn)); cons.append((pid, con, probe(con, words)))
    N = sum(p[0] for _, _, p in cons if p) or 1
    DF = [sum(p[1][i] for _, _, p in cons if p) for i in range(len(words))]
    gidf = [math.log(1 + N / max(1, d)) for d in DF]          # a word no pack has weighs as the rarest
    for pid, con, pr in cons:
        if not pr: continue
        for h in pack_search(con, words, k, gidf, pr, phrases, soft):
            hits.append({"pack": pid, "id": f"{pid}:{h['rowid']}", "title": h["title"], "text": h["text"], "score": h["score"], "cov": h["cov"]})
    hits.sort(key=lambda h: -h["score"])
    return hits[:k]

if __name__ == "__main__" and len(sys.argv) > 2 and sys.argv[2] == "--serve":
    pass
elif __name__ == "__main__":
    t = time.time(); r = search(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 24)
    print(json.dumps({"ms": round((time.time() - t) * 1000), "passages": r}, ensure_ascii=False))

def serve(packs_dir):
    """Line mode for the Node trial: one JSON {q, k} per line in → one JSON {ms, passages} per line out."""
    for line in sys.stdin:
        a = json.loads(line); t = time.time()
        r = search(packs_dir, a["q"], a.get("k", 24), a.get("ids"))
        sys.stdout.write(json.dumps({"ms": round((time.time() - t) * 1000, 1), "passages": r}, ensure_ascii=False) + "\n"); sys.stdout.flush()

if __name__ == "__main__" and len(sys.argv) > 2 and sys.argv[2] == "--serve": serve(sys.argv[1])
