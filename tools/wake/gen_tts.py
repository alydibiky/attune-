"""Positives ('Ya Attune' as Egyptians / Gulf / English speakers say it) and sound-alike negatives, from commercial-safe voices only:
libritts_r (CC BY 4.0, 904 speakers), davefx / thorsten / amir (CC0), siwis (CC BY 4.0). Kareem (licence unclear) = test only."""
import sys, random, numpy as np, pyarrow.parquet as pq
sys.path.insert(0, "/tmp/claude-0/wake"); import common
from multiprocessing import Pool
from scipy.signal import fftconvolve, butter, sosfilt
V = "/tmp/claude-0/kws/voices/"
WAKE_PH = ["jˈaː ʔatjˈuːn", "jˈa ʔatjˈuːn", "jaː ʔattjˈuːn", "jˈaː ʔɐtˈuːn", "jˈa ætjˈuːn", "jˈaː atjˈuːn", "jˌa ʔatˈjuːn", "jatjˈuːn",
           "hˈeɪ ɐtˈuːn", "hˈeɪ ɐtjˈuːn", "jˈɑː ɐtˈuːn", "ʔˈaj ʔatjˈuːn"]
NEG_PH = ["jˈaː ʔustˈaːz", "jˈaː ʔitnˈeːn", "jˈaː ʔantˈoːn", "jˈaː ʕatˈijja", "jˈaː ʕˈamr", "jˈaː tˈuːna", "jˈaː ʔabˈuːna", "jˈaː ʔamˈiːn",
          "jˈaː ʔˈaħmad", "jˈaː salˈiːm", "jˈaː batˈuːl", "jˈaː maʔmˈuːn", "jˈaː ʕatˈuːf", "jˈaː ʔaljˈuːm", "jˈaː taʕbˈaːn", "ʔatjˈuːb",
          "jˈaː ʔatˈuːr", "jˈaː ʔajjˈuːb", "ʔˈana tˈaʕbaːn", "jˈaː ʔaljˈuːn", "jˈaː maʔmuːn", "jˈaː maʕˈiːn", "jˈaː ʔantˈuːn", "jˈaː ʔaθˈiːr",
          "jˈaː ʔatˈiːf", "jˈaː ʔatˈiːja", "jaː ʔatˈjaːm", "jˈaː saʕdˈuːn"]
NEG_TXT = ["a tune", "attend", "at noon", "attitude", "Hey Anthony", "Hey, a tuna", "Yeah, a tune", "ya tuna", "you attend", "fortune",
           "at June", "a tooth", "hey tune", "attain", "attack", "Antoine", "Hey Siri", "OK Google", "Alexa", "Hey Google", "costume", "commune",
           "yeah at noon", "the tune", "Attila", "Hey Anton", "yeah I attended", "hey, at two", "I want a tuna sandwich", "to tune the radio",
           "Hey Antonio", "a tomb", "hey Attila", "ya Allah", "ya habibi", "yeah, a tutu", "hey, attention please", "pay attention", "Hey Autumn",
           "Hey Adam", "yeah Arthur", "ya Ahmed, tell Mohamed", "you are a tool", "a tuner", "at you", "Jay attune"]
CMDS = ["send a message to Ahmed", "who messaged me", "call mom", "what's the time", "open Money", "remind me at nine", "navigate home"]
CMD_PH = ["ʔibʕˈat rˈisaːla li ʔˈaħmad", "mˈiːn baʕatˈliː", "kˈallim mˈaːma", "ʔissˈaːʕa kˈaːm", "ʔiftˈaħ ilfˈiluːs", "fakkˈarni bukra"]
VOICES = {}
def voice(n):
    from piper import PiperVoice
    if n not in VOICES: VOICES[n] = PiperVoice.load(V + n + ".onnx")
    return VOICES[n]
def tts(vn, ph=None, text=None, spk=None, rnd=random):
    from piper import SynthesisConfig
    v = voice(vn)
    cfg = SynthesisConfig(speaker_id=spk, length_scale=rnd.uniform(0.75, 1.35), noise_scale=rnd.uniform(0.4, 0.9), noise_w_scale=rnd.uniform(0.5, 1.1))
    if ph is not None:
        a = v.phoneme_ids_to_audio(v.phonemes_to_ids(list(ph)), cfg)
        a = np.asarray(a, np.float32)
        if a.dtype != np.float32 or np.abs(a).max() > 2: a = a / 32768
    else:
        a = np.concatenate([np.frombuffer(c.audio_int16_bytes, dtype=np.int16) for c in v.synthesize(text, syn_config=cfg)]).astype(np.float32) / 32768
    a = common.resample(a, v.config.sample_rate)
    nz = np.where(np.abs(a) > 0.02 * (np.abs(a).max() + 1e-6))[0]   # trim silence
    if len(nz): a = a[max(0, nz[0] - 400): nz[-1] + 400]
    return a / (np.abs(a).max() + 1e-6)
BAB = None
def babble(n, rnd):
    global BAB
    if BAB is None:
        t = pq.read_table("/tmp/claude-0/wake/data/es_419_validation.parquet", columns=["audio"]).slice(0, 60).to_pylist()
        BAB = [common.decode(r["audio"]["bytes"]) for r in t]
    out = np.zeros(n, np.float32)
    for _ in range(rnd.randint(1, 4)):
        b = BAB[rnd.randrange(len(BAB))]
        if len(b) < n: b = np.tile(b, n // len(b) + 1)
        s = rnd.randrange(0, len(b) - n + 1); out += b[s:s+n] / (np.abs(b).max() + 1e-6)
    return out
def noise(n, rnd):
    k = rnd.random()
    w = np.random.randn(n).astype(np.float32)
    if k < 0.3: return w
    if k < 0.6: return np.cumsum(w).astype(np.float32) * 0.02 - np.convolve(np.cumsum(w) * 0.02, np.ones(400) / 400, "same").astype(np.float32)   # brown-ish
    if k < 0.8: return babble(n, rnd)
    t = np.arange(n) / 16000; return (np.sin(2 * np.pi * rnd.choice([50, 60, 100, 120]) * t) + 0.3 * w).astype(np.float32)   # hum / car
def rir(rnd):
    rt = rnd.uniform(0.15, 0.8); n = int(16000 * rt)
    h = np.random.randn(n).astype(np.float32) * np.exp(-6.9 * np.arange(n) / n).astype(np.float32); h[0] = 1.0
    return h / np.sqrt((h ** 2).sum())
def augment(a, rnd):
    if rnd.random() < 0.5: a = fftconvolve(a, rir(rnd))[:len(a)].astype(np.float32)
    if rnd.random() < 0.3:
        sos = butter(4, [rnd.uniform(150, 400), rnd.uniform(3400, 7000)], "bandpass", fs=16000, output="sos"); a = sosfilt(sos, a).astype(np.float32)
    if rnd.random() < 0.85:
        nz = noise(len(a), rnd); snr = rnd.uniform(0, 25)
        p_s = (a ** 2).mean() + 1e-9; p_n = (nz ** 2).mean() + 1e-9
        a = a + nz * np.sqrt(p_s / (p_n * 10 ** (snr / 10)))
    return (a / (np.abs(a).max() + 1e-6) * rnd.uniform(0.03, 0.9)).astype(np.float32)
def pick_voice(rnd, split):
    if split == "test_ar": return "ar_JO-kareem-medium", None
    if split == "test": return "en_US-libritts_r-medium", rnd.randrange(800, 904)
    r = rnd.random()
    if r < 0.75: return "en_US-libritts_r-medium", rnd.randrange(0, 800)
    return rnd.choice(["es_ES-davefx-medium", "de_DE-thorsten-medium", "fa_IR-amir-medium", "fr_FR-siwis-medium"]), None
def make(args):
    seed, kind, split = args
    rnd = random.Random(seed); np.random.seed(seed % (2**32))
    vn, spk = pick_voice(rnd, split)
    pre = rnd.uniform(0.6, 2.0); post = rnd.uniform(0.6, 1.6)
    if kind == "pos":
        if vn.startswith("ar_JO"): w = tts(vn, text=rnd.choice(["يا أتيون", "يا اتيون", "يا أتيون،", "هاي أتيون"]), rnd=rnd)
        else: w = tts(vn, ph=rnd.choice(WAKE_PH), spk=spk, rnd=rnd)
    else:
        w = tts(vn, ph=rnd.choice(NEG_PH), spk=spk, rnd=rnd) if (rnd.random() < 0.5 and not vn.startswith("ar")) else tts(vn, text=rnd.choice(NEG_TXT), spk=spk, rnd=rnd)
    w = w * rnd.uniform(0.5, 1.0)
    parts = [np.zeros(int(pre * 16000), np.float32), w]; E = len(parts[0]) + len(w)
    if rnd.random() < 0.5:   # a command follows
        c = tts(vn, ph=rnd.choice(CMD_PH), spk=spk, rnd=rnd) if (rnd.random() < 0.5 and not vn.startswith("ar")) else tts(vn, text=rnd.choice(CMDS), spk=spk, rnd=rnd)
        parts += [np.zeros(int(rnd.uniform(0.05, 0.4) * 16000), np.float32), c * rnd.uniform(0.5, 1.0)]
    parts.append(np.zeros(int(post * 16000), np.float32))
    a = augment(np.concatenate(parts), rnd)
    e = common.embed(a).astype(np.float16)
    S = len(parts[0])
    return (e, S, E)   # wake word from sample S to E
if __name__ == "__main__":
    kind, split, n, seed0 = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    with Pool(3) as p: res = p.map(make, [(seed0 + i, kind, split) for i in range(n)], chunksize=8)
    np.save("/tmp/claude-0/wake/feat/%s_%s_%d.npy" % (kind, split, seed0), np.array(res, dtype=object), allow_pickle=True)
    print(kind, split, len(res), flush=True)
