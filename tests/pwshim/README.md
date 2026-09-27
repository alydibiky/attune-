`sitecustomize.py` makes Playwright launch the pre-installed Chromium at `/opt/pw-browsers/chromium`
(Claude Code on the web). Put this folder on `PYTHONPATH` (tests/run_all.sh does). On a normal PC
with `playwright install chromium`, delete the path check or just don't add this folder.
