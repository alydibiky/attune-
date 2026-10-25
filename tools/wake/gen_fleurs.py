import sys, numpy as np, pyarrow.parquet as pq
sys.path.insert(0, "/tmp/claude-0/wake"); import common
from multiprocessing import Pool
def work(args):
    f, i0, i1 = args
    t = pq.read_table(f, columns=["audio"]).slice(i0, i1 - i0).to_pylist()
    out = []
    for r in t:
        a = common.decode(r["audio"]["bytes"])
        a = a / (np.abs(a).max() + 1e-6) * np.random.uniform(0.05, 0.7)
        out.append(common.embed(a).astype(np.float16))
    return out
if __name__ == "__main__":
    for name in sys.argv[1:]:
        f = "/tmp/claude-0/wake/data/%s.parquet" % name
        n = pq.ParquetFile(f).metadata.num_rows
        jobs = [(f, i, min(n, i + 25)) for i in range(0, n, 25)]
        with Pool(4) as p: res = [e for r in p.map(work, jobs) for e in r]
        np.save("/tmp/claude-0/wake/feat/neg_%s.npy" % name, np.array(res, dtype=object), allow_pickle=True)
        print(name, len(res), sum(len(x) for x in res) * 0.08 / 3600, "hours", flush=True)
    # also keep raw audio of a few for babble backgrounds
