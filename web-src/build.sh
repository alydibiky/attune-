#!/bin/bash
# Builds the single-file Attune page into the Android app:
#   web-src/  ->  app/src/main/assets/www/index.html
# Needs Node 18+ and Python 3. Everything is inlined; the page loads nothing
# from the internet. Run from anywhere:  bash web-src/build.sh
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
OUT="$HERE/../app/src/main/assets/www/index.html"
TMP="$HERE/.build"
mkdir -p "$TMP"
rm -f "$TMP/app.css" "$TMP/app.js"

# Build tools, pinned, installed next to the source (git-ignored).
if [ ! -x node_modules/.bin/esbuild ] || [ ! -x node_modules/.bin/tailwindcss ]; then
  npm init -y >/dev/null 2>&1 || true
  npm i --no-save --silent esbuild@0.28.2 @tailwindcss/cli@4.3.3 tailwindcss@4.3.3
fi

# 1. CSS: Tailwind compiled from the classes the app actually uses.
node_modules/.bin/tailwindcss -i build/tw.css -o "$TMP/app.css" --minify >/dev/null 2>&1
test -s "$TMP/app.css" || { echo "CSS build failed"; exit 1; }

# 2. JS: the app, bundled.
node_modules/.bin/esbuild build/entry.jsx --bundle --format=iife --minify \
  --jsx=transform --jsx-factory=React.createElement --jsx-fragment=React.Fragment --target=es2018 \
  --alias:react="$HERE/build/react-shim.js" \
  --alias:react-dom/client="$HERE/build/reactdom-shim.js" \
  --alias:lucide-react="$HERE/build/lucide-shim.js" \
  --outfile="$TMP/app.js" --log-level=warning

# 3. Assemble: CSS, React, Yusr (base64) and the app into the shell.
python3 - "$TMP" "$OUT" <<'PY'
import base64, pathlib, sys
tmp, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
here = pathlib.Path('.')
shell = (here/'build/shell.html').read_text(encoding='utf-8')
def put(marker, content):
    global shell
    assert shell.count(marker) == 1, marker + ' placeholder missing'
    i = shell.index(marker); shell = shell[:i] + content + shell[i+len(marker):]
put('<script>__TAILWIND__</script>', '<style>' + (tmp/'app.css').read_text(encoding='utf-8') + '</style>')
put('<script>__REACT__</script>', '<script>' + (here/'vendor/react.js').read_text(encoding='utf-8') + '</script>')
put('<script>__REACTDOM__</script>', '<script>' + (here/'vendor/react-dom.js').read_text(encoding='utf-8') + '</script>')
b64 = base64.b64encode((here/'yusr/index.new.html').read_bytes()).decode('ascii')
put('<script>__APP__</script>', f'<script type="text/plain" id="yusr-src">{b64}</script>\n<script>' + (tmp/'app.js').read_text(encoding='utf-8') + '</script>')
out.write_text(shell, encoding='utf-8')
print(f'{out}  {len(shell.encode())/1e6:.2f} MB')
PY
