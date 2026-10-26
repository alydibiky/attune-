"""Option C stage 2: the person's own «يا أتيون» (3 recordings) as templates; a stage-1 wake is accepted only when the sound is
close to one of them. Proxy: the kareem voice (never trained on) = 'the owner'; held-out LibriTTS speakers = other people."""
import sys, glob, numpy as np
sys.path.insert(0, "/tmp/claude-0/wake"); import common
from train import MLP, load, wins, hours, F
W, b = np.load(sys.argv[1] if len(sys.argv) > 1 else "/tmp/claude-0/wake/model.npy", allow_pickle=True)
m = MLP(); m.W, m.b = list(W), list(b)
pos_ar = load(F + "pos_test_ar_910000.npy"); pos_te = load(F + "pos_test_900000.npy")
eg = load(F + "neg_fl_ar_eg_train.npy"); ar_te = load(F + "neg_ar_eg_test.npy") + eg[len(eg) // 2:]
en_te = load(F + "neg_en_us_validation.npy")[300:] + load(F + "neg_ls_other_3.npy")
def norm(x): return x / (np.linalg.norm(x, axis=-1, keepdims=True) + 1e-6)
def dtw(a, b):
    a, b = norm(a), norm(b); D = 1 - a @ b.T; n = len(a)
    C = np.full((n + 1, n + 1), np.inf); C[0, 0] = 0
    for i in range(1, n + 1):
        for j in range(max(1, i - 4), min(n, i + 4) + 1):
            C[i, j] = D[i - 1, j - 1] + min(C[i - 1, j], C[i, j - 1], C[i - 1, j - 1])
    return C[n, n] / (2 * n)
def triggers(e, thr, pat, debounce=25):
    """windows (16x96) at each stage-1 wake"""
    e = e.astype(np.float32)
    if len(e) < 17: return []
    p = m.predict(wins(e, list(range(15, len(e))))); out = []; run = 0; cool = 0
    for i, v in enumerate(p):
        if cool: cool -= 1; continue
        run = run + 1 if v >= thr else 0
        if run >= pat: out.append(e[i:i + 16]); run = 0; cool = debounce
    return out
def peak_window(c):
    e, S, E = c; e = e.astype(np.float32)
    ks = [k for k in range(15, len(e)) if common.end_sample(k) <= E + 16000]
    p = m.predict(wins(e, ks)); k = ks[int(np.argmax(p))]
    return e[k - 15:k + 1]
def first_trigger(c, thr, pat):
    e, S, E = c; e = e.astype(np.float32)
    ks = [k for k in range(15, len(e)) if common.end_sample(k) <= E + 16000]
    p = m.predict(wins(e, ks)); run = 0
    for i, v in enumerate(p):
        run = run + 1 if v >= thr else 0
        if run >= pat: return e[ks[i] - 15:ks[i] + 1]
    return None
for thr, pat in [(0.3, 2), (0.4, 2), (0.3, 1), (0.5, 2)]:
    enrol = [peak_window(c) for c in pos_ar[:3]]
    selfd = [dtw(a, b) for i, a in enumerate(enrol) for b in enrol[i + 1:]]
    tp = [first_trigger(c, thr, pat) for c in pos_ar[3:]]
    own = [min(dtw(w, t) for t in enrol) for w in tp if w is not None]
    oth = [min(dtw(w, t) for t in enrol) for w in (first_trigger(c, thr, pat) for c in pos_te[:200]) if w is not None]
    fa_ar = [min(dtw(w, t) for t in enrol) for e in ar_te for w in triggers(e, thr, pat)]
    fa_en = [min(dtw(w, t) for t in enrol) for e in en_te for w in triggers(e, thr, pat)]
    print("== stage1 thr %.1f pat %d: own recall %.3f, other people %.3f, FA/h ar %.2f en %.2f; enrol self-dist %s" % (thr, pat, len(own) / len(pos_ar[3:]), len(oth) / 200, len(fa_ar) / hours(ar_te), len(fa_en) / hours(en_te), np.round(selfd, 3)))
    for tau in [0.10, 0.125, 0.15, 0.175, 0.2, 0.25]:
        print("   tau %.3f: own recall %.3f | other people %.3f | FA/h ar %.2f en %.2f" % (tau, sum(d < tau for d in own) / len(pos_ar[3:]), sum(d < tau for d in oth) / 200,
              sum(d < tau for d in fa_ar) / hours(ar_te), sum(d < tau for d in fa_en) / hours(en_te)), flush=True)
