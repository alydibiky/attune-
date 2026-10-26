import sys, numpy as np, pyarrow.parquet as pq
sys.path.insert(0, "/tmp/claude-0/wake"); import common
from multiprocessing import Pool
def work(blobs):
    out = []
    for b in blobs:
        a = common.decode(b)
        a = a / (np.abs(a).max() + 1e-6) * np.random.uniform(0.05, 0.7)
        out.append(common.embed(a).astype(np.float16))
    return out
if __name__ == "__main__":
    for name in sys.argv[1:]:
        f = "/tmp/claude-0/wake/data/%s.parquet" % name
        pf = pq.ParquetFile(f)
        def jobs():
            for b in pf.iter_batches(batch_size=25, columns=["audio"]):
                yield [r["bytes"] for r in b.column("audio").to_pylist()]
        with Pool(4) as p: res = [e for r in p.imap(work, jobs()) for e in r]
        np.save("/tmp/claude-0/wake/feat/neg_%s.npy" % name, np.array(res, dtype=object), allow_pickle=True)
        print(name, len(res), sum(len(x) for x in res) * 0.08 / 3600, "hours", flush=True)
    # also keep raw audio of a few for babble backgrounds
