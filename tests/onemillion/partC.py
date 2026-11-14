# 1M test part C (TEST_1M.md): UI and UX. Every screen (opened by its name), in all 21 interface languages, light and dark (the default
# theme follows the phone, so the browser's light / dark is switched), phone (412×915, touch) and computer (1280×800), at the top, the
# middle and the bottom of the screen; each view is checked for 15 things, plus "Back works" once per screen:
#   c01 page wider than the screen · c02 an element outside the screen · c03 the crash screen · c04 a JavaScript error
#   c05 a {placeholder} shown · c06 undefined / NaN / null / [object Object] shown · c07 English left in another language
#   c08 wrong direction (Arabic / Urdu / Persian right-to-left) · c09 a button / link / field with no name for screen readers
#   c10 a tap target smaller than 32 px · c11 text contrast under 4.5 (3 for large text) · c12 a one-word label broken over lines
#   c13 text cut off · c14 an image with no alt · c15 a button covered by something else (the bottom bar, a sheet…) · c16 Back works
# With real-looking data (money, people & plans, reminders, papers, agents), so screens show their full content.
#     python3 tests/onemillion/partC.py SHARD NSHARDS        (each shard: its own ports; merge: python3 tests/onemillion/partC.py merge)
import sys, os, json, time, datetime, hashlib
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
if len(sys.argv) > 1 and sys.argv[1] == "merge":
    rows = []
    for f in sorted(os.listdir(HERE)):
        if f.startswith("C-shard-") and f.endswith(".json"): rows += json.load(open(os.path.join(HERE, f)))
    checks = sum(r["n"] for r in rows); bad = [r for r in rows if r["fails"]]
    nfail = sum(len(r["fails"]) for r in rows)
    by = {}
    for r in rows:
        for c, why in r["fails"]:
            b = by.setdefault(c, {}); k = why[:90]; b.setdefault(k, []).append("%s %s %s %s @%s" % (r["screen"], r["lang"], r["theme"], r["dev"], r["pos"]))
    views = len(rows); screens = len(set(r["screen"] for r in rows))
    md = "# 1M part C — UI and UX: %d views (%d screens × 21 languages × light/dark × phone/computer × 3 scroll positions), %d checks, %d right (%.3f%%)\n\n" % (views, screens, checks, checks - nfail, 100 * (checks - nfail) / max(1, checks))
    md += "| check | failures |\n|---|---|\n" + "".join("| %s | %d |\n" % (c, sum(len(v) for v in by[c].values())) for c in sorted(by))
    md += "\n## Every failure class (examples)\n"
    for c in sorted(by):
        md += "\n### %s\n" % c
        for k, v in sorted(by[c].items(), key=lambda x: -len(x[1]))[:15]: md += "- **%s** × %d: %s\n" % (k.replace("|", "/"), len(v), " · ".join(v[:4]))
    open(os.path.join(HERE, "C-uiux.md"), "w").write(md); print(md.split("\n## Every")[0]); sys.exit(0)

SHARD, NSH = int(sys.argv[1]), int(sys.argv[2])
os.environ["ATTUNE_PAGE_PORT"] = str(8870 + SHARD); os.environ["ATTUNE_ENGINE_PORT"] = str(18870 + SHARD)
from playwright.sync_api import sync_playwright
from harness import Env, new_page
LANGS = os.environ.get("C_LANGS", "en ar arb es fr de pt it ru tr id hi ur fa bn sw th vi zh ja ko").split()   # run C_LANGS=en first: the English words of each screen are what the others are compared with
RTL = {"ar", "arb", "ur", "fa"}
SCREENS = os.environ.get("C_SCREENS", "home chat money life reminders agents lists people brain setup guardian radar missions projects memory recall remember shelf knowledge news instant assistants skills artifacts xray translate convert pdfchat slides cv map travel timetable timeline tables split salary scout planner privacy lifeask guide groups family errands donefor copilot compress humanize improve write voice booklib automations ask care").split()
T = datetime.date(2026, 11, 10)
def d(n): return (T + datetime.timedelta(days=n)).isoformat()
L = {"currency": "EGP", "accounts": [{"id": "c", "name": "CIB", "currency": "EGP", "start": 25000}, {"id": "w", "name": "Wallet", "currency": "EGP", "start": 1500}],
     "txns": [{"id": "t%d" % i, "type": "expense" if i % 5 else "income", "amount": [150, 640, 85, 1200, 12000, 320, 75, 2400][i % 8], "cat": ["food", "bills", "transport", "shopping", "salary", "health", "coffee", "groceries"][i % 8],
               "account": "c" if i % 3 else "w", "date": d(-i), "note": ["Lunch at Zooba", "Electricity", "Uber", "Shoes", "Salary", "Pharmacy", "Coffee", "Carrefour"][i % 8]} for i in range(40)]}
LIFE = {"v": 1, "items": [
  {"id": "a", "kind": "installment", "person": "Ahmed", "dir": "in", "amount": 1000, "count": 12, "total": 12000, "every": "month", "start": d(-60), "currency": "EGP", "paid": [0, 1], "title": ""},
  {"id": "b", "kind": "bill", "person": "", "dir": "out", "amount": 640, "count": 1, "total": 640, "every": None, "start": d(2), "currency": "EGP", "paid": [], "title": "Electricity bill"},
  {"id": "s", "kind": "subscription", "person": "", "dir": "out", "amount": 200, "count": 0, "total": 0, "every": "month", "start": d(-30), "currency": "EGP", "paid": [], "title": "Netflix"},
  {"id": "e", "kind": "debt", "person": "Sara", "dir": "out", "amount": 2500, "count": 0, "total": 0, "every": None, "start": "", "currency": "EGP", "paid": [], "title": ""}]}
REM = [{"id": "r1", "at": int(time.mktime((T + datetime.timedelta(days=1)).timetuple()) * 1000) + 9 * 3600000, "title": "Call the bank about the card", "body": "", "repeat": "none"},
       {"id": "r2", "at": int(time.mktime(T.timetuple()) * 1000) + 20 * 3600000, "title": "Take vitamin D", "body": "", "repeat": "daily"}]
SEED = "".join("try{localStorage.setItem(%s,%s)}catch(e){};" % (json.dumps(k), json.dumps(json.dumps(v))) for k, v in [("ledger.v3", L), ("attune:life:v1", LIFE), ("attune:reminders:v1", REM)])
SEED += "try{localStorage.setItem('attune:country','eg');localStorage.setItem('attune:start','home');localStorage.setItem('attune:test:quiet','1')}catch(e){};"

DATA = sorted({t["note"] for t in L["txns"]} | {x["title"] for x in LIFE["items"] if x["title"]} | {x["person"] for x in LIFE["items"] if x["person"]} | {r["title"] for r in REM} | {"CIB", "Wallet"})   # the person's own words are not interface text
PROBE = open(os.path.join(HERE, "partC_probe.js")).read()
ctxs = [(lg, th, dev) for dev in ["phone", "computer"] for th in ["light", "dark"] for lg in LANGS]
mine = [c for i, c in enumerate(ctxs) if i % NSH == SHARD]
env = Env(); rows = []; en_text = {}
# English first (its words are what "English left in another language" is compared with) — each shard reads the English of its own
# theme / device: the English text sets are written by shard runs that hold "en" and read from disk by the others
EN_DIR = os.path.join(HERE, "C-en"); os.makedirs(EN_DIR, exist_ok=True)
def en_file(th, dev, sc): return os.path.join(EN_DIR, "%s-%s-%s.json" % (th, dev, sc))
with sync_playwright() as p:
    br = p.chromium.launch()
    for lg, th, dev in sorted(mine, key=lambda c: c[0] != "en"):
        errors = []
        init = SEED + "try{localStorage.setItem('attune:ui:lang',%s);localStorage.setItem('attune:theme:v1',JSON.stringify({accent:'burgundy',bg:'auto',a43:1,v87:1,v95:1}))}catch(e){};" % json.dumps(lg)
        ctx, page = new_page(br, env, errors, extra_init=init, legacy_nav=False, desktop=(1280, 800) if dev == "computer" else None)
        page.emulate_media(color_scheme=th)
        try:
            page.goto(env.url); page.wait_for_timeout(1500)
        except Exception as e:
            print("load", lg, th, dev, e, flush=True); ctx.close(); continue
        home_sig = None
        for sc in SCREENS:
            errors.clear()
            try:
                page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open', { detail: { mode: m } }))", sc); page.wait_for_timeout(700)
            except Exception as e:
                rows.append({"screen": sc, "lang": lg, "theme": th, "dev": dev, "pos": "open", "n": 1, "fails": [["c03 crash", "could not open: " + str(e)[:80]]]}); continue
            try:
                is_home = sc != "home" and page.evaluate("(() => { const e = document.querySelector('[data-testid=home-ask]'); return !!(e && e.getBoundingClientRect().height); })()")
            except Exception: is_home = False
            if is_home: page.evaluate("window.dispatchEvent(new CustomEvent('attune-open', { detail: { mode: 'home' } }))"); continue   # an old name that opens Home: not a screen
            if sc == "home": home_sig = page.evaluate("(document.querySelector('main')||document.body).innerText.slice(0,80)")
            if lg == "en": en_words = None
            else:
                try: en_words = json.load(open(en_file(th, dev, sc)))
                except Exception: en_words = None
            seen_en = set()
            for pos in ["top", "middle", "bottom"]:
                try:
                    page.evaluate("(p) => { const s = document.scrollingElement; const els = [s, ...document.querySelectorAll('main, [data-scroll], .overflow-y-auto')]; for (const e of els) { if (!e || e.scrollHeight <= e.clientHeight + 4) continue; e.scrollTop = p === 'top' ? 0 : p === 'middle' ? (e.scrollHeight - e.clientHeight) / 2 : e.scrollHeight; } }", pos)
                    page.wait_for_timeout(150)
                    r = page.evaluate(PROBE, {"lang": lg, "rtl": lg in RTL, "en": en_words or [], "pos": pos, "data": DATA})
                except Exception as e:
                    rows.append({"screen": sc, "lang": lg, "theme": th, "dev": dev, "pos": pos, "n": 15, "fails": [["c03 crash", "probe failed: " + str(e)[:80]]]}); continue
                if lg == "en": seen_en.update(r.get("texts", []))
                fails = [[k, v] for k, v in r["fails"]]
                errs = [e for e in errors if "ERR_TUNNEL" not in e and "ERR_PROXY" not in e and "ERR_NAME" not in e and "engine-400" not in e and "Failed to load resource" not in e]
                if errs: fails.append(["c04 js error", errs[-1][:110]])
                errors.clear()
                rows.append({"screen": sc, "lang": lg, "theme": th, "dev": dev, "pos": pos, "n": 15, "fails": fails, "sig": r.get("sig")})
            if lg == "en": json.dump(sorted(seen_en), open(en_file(th, dev, sc), "w"))
            # c16: Back works — the app's own back leaves the screen without an error
            try:
                before = page.evaluate("location.hash + '|' + (document.querySelector('main') || document.body).innerText.slice(0, 200)")
                page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(400)
                after = page.evaluate("location.hash + '|' + (document.querySelector('main') || document.body).innerText.slice(0, 200)")
                crash = page.evaluate("document.body.innerText.includes('Something went wrong on this screen')")
                f16 = [["c16 back", "crash after Back"]] if crash else ([["c16 back", "Back did nothing"]] if before == after and sc != "home" else [])
            except Exception as e: f16 = [["c16 back", str(e)[:80]]]
            rows.append({"screen": sc, "lang": lg, "theme": th, "dev": dev, "pos": "back", "n": 1, "fails": f16})
            page.keyboard.press("Escape"); page.evaluate("window.dispatchEvent(new CustomEvent('attune-open', { detail: { mode: 'home' } }))"); page.wait_for_timeout(250)   # (a full-screen call / sheet is closed first, as a person would)
        ctx.close()
        n = sum(r["n"] for r in rows); nf = sum(len(r["fails"]) for r in rows)
        print("%s %s %s · %d checks so far, %d failed" % (lg, th, dev, n, nf), flush=True)
        json.dump(rows, open(os.path.join(HERE, "C-shard-%s-%d.json" % ("en" if os.environ.get("C_LANGS") == "en" else "rest", SHARD)), "w"))
    br.close()
env.close()
