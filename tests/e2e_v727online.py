"""v6.27 — a country's map shown ONLINE without downloading it (Ali: "streets and compounds everywhere online — and I don't
want to pay for maps"). Nothing is installed; the phone's mapRange (HTTP range requests to our free GitHub release) is
mocked with a tiny real vector map of central Cairo (tests/fixtures/cairo-mini.pmtiles).

  python3 tests/e2e_v727online.py
"""
import base64, json, os, subprocess, sys, tempfile
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = base64.b64encode(open(os.path.join(HERE, "fixtures", "cairo-mini.pmtiles"), "rb").read()).decode()
# a tiny online search file (<code>-find.bin) made by the real builder: a compound the web searches don't know
TMP = tempfile.mkdtemp()
subprocess.run([sys.executable, "-c", """
import sys; sys.path.insert(0, %r); import build_map_pack as B
idx = B.Index(sys.argv[1]); idx.add({"name": "Zayed Dunes", "landuse": "residential"}, 30.06, 31.24)
for i in range(50): idx.add({"name": "Street %%d" %% i, "highway": "residential"}, 30.05, 31.25)
idx.close(); B.build_find(sys.argv[1], sys.argv[2])""" % os.path.join(HERE, "..", "tools"), os.path.join(TMP, "p.sqlite"), os.path.join(TMP, "f.bin")], check=True)
FIND = base64.b64encode(open(os.path.join(TMP, "f.bin"), "rb").read()).decode()
env = Env(); errors = []
INIT = r"""
(() => { const S = window.__mapmock = { calls: [] };
  const u8 = (s) => { const raw = atob(s), b = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) b[i] = raw.charCodeAt(i); return b; };
  const bytes = u8("%(fix)s"), find = u8("%(find)s");
  const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.mapPacks = () => JSON.stringify({ packs: [], assets: false });
    N.mapRead = (a) => { S.calls.push(["read", JSON.parse(a).path]); return ""; };
    N.unmetered = () => false;   // mobile data: the world map must not download by itself
    const later = (id, v, ms) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(v)), ms || 30);
    N.mapRange = (id, a) => { const o = JSON.parse(a); S.calls.push(["range", o.code, o.name, o.offset, o.length]);
      const f = o.name === "eg-find.bin" ? find : bytes;
      later(id, { b64: b64(f.subarray(o.offset, Math.min(f.length, o.offset + o.length))) }); };
    N.mapAssets = (id) => { S.calls.push(["assets"]); later(id, { assets: true }); };
    N.mapRemote = (id, a) => later(id, { code: JSON.parse(a).code, date: "2026-10-09", files: [{ name: "x.pmtiles", bytes: 1 }] });
    N.mapInstall = (id) => { S.calls.push(["install"]); };
  }; go(); })();""" % {"fix": FIX, "find": FIND}

with sync_playwright() as p:
    br = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.on("dialog", lambda d: d.accept())
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.evaluate("localStorage.setItem('attune:map:v1', JSON.stringify({ view: { lat: 30.05, lon: 31.25, z: 12 }, places: [] }))")
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Maps')").first.click()
    page.wait_for_selector("[data-testid=map-page]", timeout=8000)
    page.wait_for_function("() => window.__attuneMap && window.__attuneMap.isStyleLoaded()", timeout=30000)
    page.evaluate("window.__attuneMap.jumpTo({ center: [31.25, 30.05], zoom: 12 })")
    page.wait_for_function("() => (document.querySelector('[data-testid=map-mode]') || {}).innerText && document.querySelector('[data-testid=map-mode]').innerText.includes('online map')", timeout=15000)
    page.wait_for_function("() => window.__attuneMap.isStyleLoaded() && window.__attuneMap.areTilesLoaded()", timeout=20000); page.wait_for_timeout(800)
    feats = page.evaluate("() => window.__attuneMap.queryRenderedFeatures().map((f) => f.sourceLayer || f.layer.id)")
    check("roads" in feats, "with nothing downloaded, Cairo's streets are drawn online: %s" % sorted(set(feats))[:8])
    calls = page.evaluate("window.__mapmock.calls")
    ranges = [c for c in calls if c[0] == "range"]
    check(len(ranges) >= 2 and all(c[1] == "eg" and c[2] == "eg.pmtiles" for c in ranges), "every piece came from Egypt's published map through the phone (%d pieces)" % len(ranges))
    check(all(c[4] <= 4_000_000 for c in ranges), "only small pieces are asked for (largest %d bytes)" % max(c[4] for c in ranges))
    check(["assets"] in calls and not any(c[0] == "install" for c in calls), "only the fonts and icons are downloaded — never the whole country")
    mode = page.locator("[data-testid=map-mode]").inner_text()
    check("online map" in mode and "Egypt" in mode, "the search bar says: " + mode)
    check(page.locator("[data-testid=map-empty]").count() == 0, "no 'No map yet' box while the online map shows")
    page.click("[data-testid=map-open-offline]"); page.wait_for_selector("[data-testid=map-offline]", timeout=3000)
    check(page.locator("[data-testid=map-online-note]").count() == 1, "the country list says every country shows online without downloading")
    # search: the country's own places index, read online in one small piece (the web searches can't be reached here)
    page.locator("[data-testid=map-tab-places]").click(); page.wait_for_timeout(150)
    page.fill("[data-testid=map-search]", "zayed dun"); page.press("[data-testid=map-search]", "Enter")
    page.wait_for_selector("[data-testid=map-hit]", timeout=15000)
    hit = page.locator("[data-testid=map-hit]").first.inner_text()
    check("Zayed Dunes" in hit and "compound" in hit, "a compound is found ONLINE in Egypt's own index without downloading it: " + hit.replace("\n", " · "))
    finds = [c for c in page.evaluate("window.__mapmock.calls") if c[0] == "range" and c[2] == "eg-find.bin"]
    check(len(finds) == 3, "the search read 3 small pieces: the header, the index and one piece (%d)" % len(finds))
    # no signal: nothing online, the empty state again
    page.evaluate("window.dispatchEvent(new Event('offline'))"); page.wait_for_timeout(400)
    check(page.locator("[data-testid=map-empty]").count() == 1, "with no signal and nothing downloaded: 'No map on this device yet'")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
