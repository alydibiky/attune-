#!/bin/bash
# Puts Python into the app for the Code workbench's sandbox:
#   app/src/main/assets/www/py/   (Pyodide — CPython compiled to WebAssembly, MPL-2.0)
#
# Only the core and a few packages are copied (numpy, pandas, sympy and what
# they need): ~26 MB. The package list the app ships is trimmed to exactly
# these, so Python never tries to fetch anything from the internet — an
# import of something else fails at once with a clear message.
# Every file is checked against the SHA-256 in Pyodide's own lock file.
#
#   bash web-src/fetch-pyodide.sh          (CI runs this before building the APK)
set -e
VER=314.0.7
PKGS="numpy pandas sympy"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../app/src/main/assets/www/py"
CACHE="${PYODIDE_CACHE:-$HERE/.pyodide-cache}"
mkdir -p "$CACHE"
TAR="$CACHE/pyodide-$VER.tar.bz2"
if [ ! -s "$TAR" ]; then
  echo "Downloading Pyodide $VER (one time, ~340 MB)…"
  curl -fsSL --retry 4 -o "$TAR.part" "https://github.com/pyodide/pyodide/releases/download/$VER/pyodide-$VER.tar.bz2"
  mv "$TAR.part" "$TAR"
fi
if [ ! -f "$CACHE/pyodide/pyodide-lock.json" ] || ! grep -q "\"$VER\"\|$VER" "$CACHE/pyodide/pyodide.mjs" 2>/dev/null; then
  rm -rf "$CACHE/pyodide"
  tar xjf "$TAR" -C "$CACHE" --wildcards 'pyodide/pyodide.mjs' 'pyodide/pyodide.asm.mjs' 'pyodide/pyodide.asm.wasm' \
    'pyodide/python_stdlib.zip' 'pyodide/pyodide-lock.json' 'pyodide/*.whl'
fi
rm -rf "$OUT"; mkdir -p "$OUT"
python3 - "$CACHE/pyodide" "$OUT" "$PKGS" "$VER" <<'PY'
import hashlib, json, shutil, sys, pathlib
src, out, pkgs, ver = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), sys.argv[3].split(), sys.argv[4]
lock = json.loads((src / "pyodide-lock.json").read_text())
P = lock["packages"]
want, stack = set(), list(pkgs)
while stack:                                   # the packages and everything they depend on
    n = stack.pop()
    if n in want: continue
    if n not in P: raise SystemExit(f"{n} is not in Pyodide {ver}")
    want.add(n); stack += P[n].get("depends", [])
for n in sorted(want):
    f = P[n]["file_name"]; data = (src / f).read_bytes()
    if hashlib.sha256(data).hexdigest() != P[n]["sha256"]: raise SystemExit(f"checksum mismatch: {f}")
    (out / f).write_bytes(data)
lock["packages"] = {n: P[n] for n in sorted(want)}
(out / "pyodide-lock.json").write_text(json.dumps(lock))
for f in ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip"]:
    shutil.copy(src / f, out / f)
# Excel files: openpyxl (MIT), et_xmlfile and xlrd (BSD, old .xls) are pure Python but not part of
# Pyodide; they come from PyPI, pinned and checksum-checked, and are added to
# the package list so pandas.read_excel / import openpyxl just work.
EXTRA = [("openpyxl", "3.1.5", "openpyxl-3.1.5-py2.py3-none-any.whl", "5282c12b107bffeef825f4617dc029afaf41d0ea60823bbb665ef3079dc79de2", ["et-xmlfile"], ["openpyxl"]),
         ("et-xmlfile", "2.0.0", "et_xmlfile-2.0.0-py3-none-any.whl", "7a91720bc756843502c3b7504c77b8fe44217c85c537d85037f0f536151b2caa", [], ["et_xmlfile"]),
         # old Excel files (.xls, 97–2003) — v5.13; BSD licence, pure Python
         ("xlrd", "2.0.1", "xlrd-2.0.1-py2.py3-none-any.whl", "6a33ee89877bd9abc1158129f6e94be74e2679636b8a205b43b85206c3f0bbdd", [], ["xlrd"])]
import os, urllib.request, subprocess
cache = src.parent
for name, v, fn, sha, deps, imports in EXTRA:
    f = cache / fn
    if not f.exists():
        subprocess.run([sys.executable, "-m", "pip", "download", "--quiet", "--no-deps", "--only-binary=:all:", "-d", str(cache), f"{name.replace('-', '_')}=={v}"], check=True)
    data = f.read_bytes()
    if hashlib.sha256(data).hexdigest() != sha: raise SystemExit(f"checksum mismatch: {fn}")
    (out / fn).write_bytes(data)
    lock["packages"][name] = {"name": name, "version": v, "file_name": fn, "install_dir": "site", "sha256": sha, "package_type": "package",
                              "imports": imports, "depends": deps, "unvendored_tests": False, "tool": {}}
    want.add(name)
(out / "pyodide-lock.json").write_text(json.dumps(lock))
(out / "VERSION").write_text(ver + "\n" + " ".join(sorted(want)) + "\n")
size = sum(p.stat().st_size for p in out.iterdir())
print(f"Python {lock['info']['python']} (Pyodide {ver}) with {', '.join(sorted(want))}: {size/1e6:.1f} MB -> {out}")
PY
