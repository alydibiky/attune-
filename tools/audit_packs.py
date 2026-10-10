#!/usr/bin/env python3
"""v6.16c — quality audit of built Knowledge packs (Ali: "make sure the knowledge packs have all correct and reliable info").
   python3 tools/audit_packs.py <dir with <id>.sqlite or .sqlite.gz> [--show 3]
Per pack: passages, empty or tiny ones, exact duplicates, HTML left in the text, mojibake (UTF-8 read as Latin-1), the
replacement character, editors' [[notes]] or footnote lines left in, and Arabic titles in another language's letters.
Exit code 1 if any pack has a problem above its limit (so a build can refuse to publish it)."""
import gzip, hashlib, os, re, sqlite3, sys, tempfile

CHECKS = {   # name: (regex on the text or title, limit as a share of passages)
    "html": (re.compile(r"</?(p|div|span|br|td|tr|li|ul|a|img|table|sup|sub)\b[^>]*>|&(nbsp|amp|lt|gt|quot);", re.I), 0.002),
    "mojibake": (re.compile(r"Ã[\x80-\xbf]|Ø[\x80-\xbf§¨ª«]|Ù[\x80-\x8a]|â€[™œ\x9d“”]"), 0.001),
    "replacement": (re.compile("�"), 0.001),
    "editor notes": (re.compile(r"\[\[.*?\]\]|^_{5,}", re.M | re.S), 0.001),
}
FOREIGN_AR = re.compile(r"[کگپچژیەېۆۇڭ]")   # ک گ پ چ ژ ی ە ې ۆ ۇ ڭ — Persian, Urdu, Uyghur, Kurdish letters

def open_db(path):
    if path.endswith(".gz"):
        tmp = tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False)
        with gzip.open(path) as f: tmp.write(f.read())
        tmp.close(); return sqlite3.connect(tmp.name), tmp.name
    return sqlite3.connect(path), None

# what's normal for a pack: code docs show HTML and RST underlines; Quran verses can be one word («الم»)
EXEMPT = {"coding": {"html", "editor notes", "replacement"}, "quran": {"tiny"}, "egy-laws": {"duplicates"}}

def audit(path, show=3):
    db, tmp = open_db(path)
    rows = db.execute("select id, title, text from passages").fetchall()
    n = len(rows) or 1
    out = {"passages": len(rows)}
    bad = {k: [] for k in CHECKS}
    seen, dups, tiny, foreign = {}, [], [], []
    for pid, title, text in rows:
        text = text or ""
        if len(text.strip()) < 25: tiny.append((pid, title))
        h = hashlib.md5(text.strip().encode()).hexdigest()
        if h in seen: dups.append((pid, title, seen[h]))
        else: seen[h] = title
        for k, (rx, _) in CHECKS.items():
            if rx.search(text) or rx.search(title or ""): bad[k].append((pid, title))
        if FOREIGN_AR.search(title or ""): foreign.append((pid, title))
    if tmp: os.unlink(tmp)
    problems, pid = [], os.path.basename(path).split(".")[0]
    for k, (_, limit) in CHECKS.items():
        out[k] = len(bad[k])
        if len(bad[k]) / n > limit and k not in EXEMPT.get(pid, ()): problems.append(k)
    out["tiny"], out["duplicates"], out["foreign-script titles"] = len(tiny), len(dups), len(foreign)
    if len(tiny) / n > 0.01 and "tiny" not in EXEMPT.get(pid, ()): problems.append("tiny")
    if len(dups) / n > 0.02 and "duplicates" not in EXEMPT.get(pid, ()): problems.append("duplicates")
    if len(foreign) / n > 0.001: problems.append("foreign-script titles")
    samples = {k: v[:show] for k, v in list(bad.items()) + [("tiny", tiny), ("duplicates", dups), ("foreign-script titles", foreign)] if v}
    return out, problems, samples

def main():
    d = sys.argv[1]; show = int(sys.argv[sys.argv.index("--show") + 1]) if "--show" in sys.argv else 3
    files = sorted(f for f in os.listdir(d) if f.endswith(".sqlite") or f.endswith(".sqlite.gz"))
    failed = False
    print("| pack | passages | empty/tiny | duplicates | HTML | mojibake | � | editor notes | foreign-script titles | verdict |\n|---|---|---|---|---|---|---|---|---|---|")
    details = []
    for f in files:
        out, problems, samples = audit(os.path.join(d, f), show)
        failed |= bool(problems)
        print(f"| {f.split('.')[0]} | {out['passages']:,} | {out['tiny']} | {out['duplicates']} | {out['html']} | {out['mojibake']} | {out['replacement']} | {out['editor notes']} | {out['foreign-script titles']} | {'❌ ' + ', '.join(problems) if problems else '✅'} |")
        if samples: details.append((f, samples))
    for f, samples in details:
        print(f"\n**{f}** examples:")
        for k, v in samples.items(): print(f"- {k}: " + "; ".join(str(x)[:160] for x in v))
    sys.exit(1 if failed else 0)

if __name__ == "__main__": main()
