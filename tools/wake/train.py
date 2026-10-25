"""Train Attune's wake model on openWakeWord features: 16 embeddings (≈2 s of sound) → P(«يا أتيون» just ended).
A small MLP in numpy (1536 → 128 → 64 → 1), Adam, weighted BCE, two rounds of hard-negative mining; exported to ONNX."""
import sys, glob, json, numpy as np
sys.path.insert(0, "/tmp/claude-0/wake"); import common
F = "/tmp/claude-0/wake/feat/"
rng = np.random.default_rng(0)
def load(p): return list(np.load(p, allow_pickle=True))
def wins(e, ks): return np.stack([e[k-15:k+1] for k in ks]).astype(np.float32) if len(ks) else np.zeros((0, 16, 96), np.float32)
def pos_windows(clips):
    P, N = [], []
    for e, S, E in clips:
        e = e.astype(np.float32); n = len(e)
        kp = [k for k in range(15, n) if E - 1280 <= common.end_sample(k) <= E + 4000]
        kn = [k for k in range(15, n) if common.end_sample(k) <= S or common.end_sample(k) >= E + 35200]
        P.append(wins(e, kp)); N.append(wins(e, kn))
    return np.concatenate(P), np.concatenate(N)
def neg_windows(seqs, stride=1):
    out = [wins(e.astype(np.float32), list(range(15, len(e), stride))) for e in seqs if len(e) > 16]
    return np.concatenate(out)
class MLP:
    def __init__(s, sizes=(1536, 128, 64, 1)):
        s.W = [rng.normal(0, np.sqrt(2 / a), (a, b)).astype(np.float32) for a, b in zip(sizes[:-1], sizes[1:])]
        s.b = [np.zeros(b, np.float32) for b in sizes[1:]]
        s.m = [np.zeros_like(x) for x in s.W + s.b]; s.v = [np.zeros_like(x) for x in s.W + s.b]; s.t = 0
    def fwd(s, x):
        h = [x.reshape(len(x), -1)]
        for i, (W, b) in enumerate(zip(s.W, s.b)):
            z = h[-1] @ W + b
            h.append(np.maximum(z, 0) if i < len(s.W) - 1 else z)
        return h
    def predict(s, x, bs=8192):
        out = []
        for i in range(0, len(x), bs): out.append(1 / (1 + np.exp(-np.clip(s.fwd(x[i:i+bs])[-1][:, 0], -30, 30))))
        return np.concatenate(out) if out else np.zeros(0)
    def step(s, x, y, w, lr=1e-3, l2=1e-4, drop=0.2):
        h = [x.reshape(len(x), -1)]; masks = []
        for i, (W, b) in enumerate(zip(s.W, s.b)):
            z = h[-1] @ W + b
            if i < len(s.W) - 1:
                a = np.maximum(z, 0); m = (rng.random(a.shape) > drop) / (1 - drop); masks.append(m); h.append(a * m)
            else: h.append(z)
        p = 1 / (1 + np.exp(-np.clip(h[-1][:, 0], -30, 30)))
        g = ((p - y) * w / w.sum())[:, None].astype(np.float32)
        gW, gb = [None] * len(s.W), [None] * len(s.W)
        for i in range(len(s.W) - 1, -1, -1):
            gW[i] = h[i].T @ g + l2 * s.W[i]; gb[i] = g.sum(0)
            if i > 0: g = (g @ s.W[i].T) * (h[i] > 0) * masks[i - 1]
        s.t += 1
        for j, (P, G) in enumerate(zip(s.W + s.b, gW + gb)):
            s.m[j] = 0.9 * s.m[j] + 0.1 * G; s.v[j] = 0.999 * s.v[j] + 0.001 * G * G
            mh = s.m[j] / (1 - 0.9 ** s.t); vh = s.v[j] / (1 - 0.999 ** s.t)
            P -= lr * mh / (np.sqrt(vh) + 1e-8)
def train(model, X, y, w, epochs, bs=512, lr=1e-3):
    n = len(X)
    for ep in range(epochs):
        idx = rng.permutation(n)
        for i in range(0, n, bs):
            j = idx[i:i+bs]; model.step(X[j], y[j], w[j], lr=lr * (0.5 ** (ep // max(1, epochs // 3))))
def stream_triggers(model, seqs, thr, patience, debounce=25):
    """How many times it would wake on these sequences (sound streamed as on the phone)."""
    hits = 0
    for e in seqs:
        if len(e) < 17: continue
        p = model.predict(wins(e.astype(np.float32), list(range(15, len(e)))))
        run = 0; cool = 0
        for v in p:
            if cool: cool -= 1; continue
            run = run + 1 if v >= thr else 0
            if run >= patience: hits += 1; run = 0; cool = debounce
    return hits
def clip_detect(model, clips, thr, patience):
    ok = 0
    for e, S, E in clips:
        e = e.astype(np.float32)
        ks = [k for k in range(15, len(e)) if common.end_sample(k) <= E + 16000]   # it must wake within 1 s of the word ending
        p = model.predict(wins(e, ks)); run = 0; hit = False
        for v in p:
            run = run + 1 if v >= thr else 0
            if run >= patience: hit = True; break
        ok += hit
    return ok / max(1, len(clips))
def hours(seqs): return sum(len(e) for e in seqs) * 0.08 / 3600
def export(model, path):
    import onnx
    from onnx import helper, TensorProto, numpy_helper
    inits = [numpy_helper.from_array(np.array([1, 1536], np.int64), "shape")]
    nodes = [helper.make_node("Reshape", ["x", "shape"], ["h0"])]
    for i, (W, b) in enumerate(zip(model.W, model.b)):
        inits += [numpy_helper.from_array(W, "W%d" % i), numpy_helper.from_array(b, "b%d" % i)]
        nodes.append(helper.make_node("Gemm", ["h%d" % (2 * i), "W%d" % i, "b%d" % i], ["z%d" % i]))
        nodes.append(helper.make_node("Relu" if i < len(model.W) - 1 else "Sigmoid", ["z%d" % i], ["h%d" % (2 * i + 2) if i < len(model.W) - 1 else "score"]))
    g = helper.make_graph(nodes, "attune_wake", [helper.make_tensor_value_info("x", TensorProto.FLOAT, [1, 16, 96])],
                          [helper.make_tensor_value_info("score", TensorProto.FLOAT, [1, 1])], inits)
    m = helper.make_model(g, opset_imports=[helper.make_opsetid("", 13)]); m.ir_version = 8
    onnx.checker.check_model(m); onnx.save(m, path)
if __name__ == "__main__":
    TEST = {"neg_ar_eg_test.npy", "neg_en_us_validation.npy"}
    pos_tr = sum([load(p) for p in sorted(glob.glob(F + "pos_train_*.npy"))], [])
    neg_tts = sum([load(p) for p in sorted(glob.glob(F + "neg_train_*.npy"))], [])
    speech = []
    for p in sorted(glob.glob(F + "neg_*.npy")):
        n = p.split("/")[-1]
        if n.startswith("neg_train_") or n.startswith("neg_test_") or n in TEST: continue
        speech += load(p)
    en = load(F + "neg_en_us_validation.npy"); speech += en[:300]; en_te = en[300:]
    ar_te = load(F + "neg_ar_eg_test.npy")
    pos_te, pos_ar = load(F + "pos_test_900000.npy"), load(F + "pos_test_ar_910000.npy"); neg_te = load(F + "neg_test_920000.npy")
    print("speech hours for training %.1f" % hours(speech), flush=True)
    Pp, Pn = pos_windows(pos_tr)
    Nt = neg_windows([c[0] for c in neg_tts])
    # a random sample of the speech windows (all of it is searched for hard negatives every round)
    sample = [speech[j] for j in rng.choice(len(speech), min(len(speech), 2500), replace=False)]
    Nf = neg_windows(sample, stride=3)
    print("positives", len(Pp), "neg (in pos clips)", len(Pn), "neg tts", len(Nt), "neg speech", len(Nf), flush=True)
    X = np.concatenate([Pp, Pn, Nt, Nf]); y = np.concatenate([np.ones(len(Pp)), np.zeros(len(Pn) + len(Nt) + len(Nf))]).astype(np.float32)
    w = np.concatenate([np.full(len(Pp), 1.0), np.full(len(Pn), 1.0), np.full(len(Nt), 2.0), np.full(len(Nf), 1.0)]).astype(np.float32)
    w[y == 1] *= (w[y == 0].sum() / w[y == 1].sum()) * 0.5
    model = MLP(tuple(int(x) for x in (sys.argv[1] if len(sys.argv) > 1 else "1536,128,64,1").split(",")))
    ROUNDS = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    for rnd in range(ROUNDS):
        train(model, X, y, w, epochs=6 if rnd == 0 else 3)
        hard = []
        for seq in speech + [c[0] for c in neg_tts]:
            e = seq.astype(np.float32)
            if len(e) < 17: continue
            W_ = wins(e, list(range(15, len(e)))); p = model.predict(W_)
            if (p > 0.1).any(): hard.append(W_[p > 0.1])
        hard = np.concatenate(hard) if hard else np.zeros((0, 16, 96), np.float32)
        if len(hard) > 60000: hard = hard[rng.choice(len(hard), 60000, replace=False)]
        print("round", rnd, "hard negatives", len(hard), " test: recall_ar %.3f fa_ar/h %.1f" % (clip_detect(model, pos_ar, 0.5, 2), stream_triggers(model, ar_te, 0.5, 2) / hours(ar_te)), flush=True)
        if len(hard):
            X = np.concatenate([X, hard]); y = np.concatenate([y, np.zeros(len(hard), np.float32)]); w = np.concatenate([w, np.full(len(hard), 3.0, np.float32)])
    res = {}
    for thr in [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95]:
        for pat in [1, 2, 3, 4]:
            r = dict(thr=thr, patience=pat, recall_en=clip_detect(model, pos_te, thr, pat), recall_ar=clip_detect(model, pos_ar, thr, pat),
                     fa_ar_per_h=stream_triggers(model, ar_te, thr, pat) / hours(ar_te), fa_en_per_h=stream_triggers(model, en_te, thr, pat) / hours(en_te),
                     fa_soundalike=stream_triggers(model, [c[0] for c in neg_te], thr, pat) / len(neg_te))
            print(json.dumps({k: round(v, 3) if isinstance(v, float) else v for k, v in r.items()}), flush=True)
            res["%s_%s" % (thr, pat)] = r
    np.save("/tmp/claude-0/wake/model.npy", np.array([model.W, model.b], dtype=object), allow_pickle=True)
    export(model, "/tmp/claude-0/wake/attune_wake.onnx")
    json.dump(res, open("/tmp/claude-0/wake/eval.json", "w"), indent=1)
    print("hours test ar %.2f en %.2f" % (hours(ar_te), hours(en_te)))
