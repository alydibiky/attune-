import numpy as np, onnxruntime as ort, io, soundfile as sf
W = "/tmp/claude-0/wake"
_o = ort.SessionOptions(); _o.intra_op_num_threads = 1; _o.inter_op_num_threads = 1
MEL = ort.InferenceSession(W + "/melspectrogram.onnx", _o, providers=["CPUExecutionProvider"])
EMB = ort.InferenceSession(W + "/embedding_model.onnx", _o, providers=["CPUExecutionProvider"])
MEL_IN = MEL.get_inputs()[0].name; EMB_IN = EMB.get_inputs()[0].name
def embed_batch(a16):
    """a16: float32 audio at 16 kHz in [-1,1] -> embeddings [T,96]; embedding k ends at sample (8k+76)*160 (approx)."""
    x = (np.clip(a16, -1, 1) * 32767).astype(np.int16).astype(np.float32)[None]
    spec = np.squeeze(MEL.run(None, {MEL_IN: x})[0]) / 10 + 2
    n = (spec.shape[0] - 76) // 8 + 1
    if n <= 0: return np.zeros((0, 96), np.float32)
    win = np.stack([spec[i*8:i*8+76] for i in range(n)])[..., None].astype(np.float32)
    out = []
    for i in range(0, n, 64): out.append(EMB.run(None, {EMB_IN: win[i:i+64]})[0].reshape(-1, 96))
    return np.concatenate(out).astype(np.float32)
def end_sample(k): return (8 * k + 76) * 160
def resample(a, sr, to=16000):
    if sr == to: return a.astype(np.float32)
    from scipy.signal import resample_poly
    from math import gcd
    g = gcd(sr, to); return resample_poly(a, to // g, sr // g).astype(np.float32)
def decode(b):
    a, sr = sf.read(io.BytesIO(b), dtype="float32")
    if a.ndim > 1: a = a.mean(1)
    return resample(a, sr)

def embed(a16):
    """Exactly what the phone does (WakeWord.kt): every 80 ms (1280 samples) the mel model runs on the last 1760 samples (8 frames
    appended); then the embedding model runs on the last 76 mel frames. Embedding k is produced after sample 1280*(k+1)+OFFSET."""
    x = (np.clip(a16, -1, 1) * 32767).astype(np.int16).astype(np.float32)
    x = np.concatenate([np.zeros(480, np.float32), x])
    n = (len(x) - 480) // 1280
    if n <= 0: return np.zeros((0, 96), np.float32)
    wins = np.stack([x[i*1280:i*1280+1760] for i in range(n)])
    mels = []
    for i in range(0, n, 256): mels.append(np.squeeze(MEL.run(None, {MEL_IN: wins[i:i+256]})[0], 1))
    spec = np.concatenate(mels).reshape(-1, 32) / 10 + 2          # [n*8, 32]
    spec = np.concatenate([np.ones((68, 32), np.float32), spec])   # the phone starts with a buffer of ones (like openWakeWord)
    k = n
    win = np.stack([spec[i*8:i*8+76] for i in range(k)])[..., None].astype(np.float32)
    out = []
    for i in range(0, k, 256): out.append(EMB.run(None, {EMB_IN: win[i:i+256]})[0].reshape(-1, 96))
    return np.concatenate(out).astype(np.float32)
def end_sample(k): return 1280 * (k + 1)   # embedding k includes audio up to this sample
