"""v10.9 (Ali, 22 Nov 2026: "your tests are bullshit — whenever I try a simple thing there is always a problem"). The tests checked the code
around the model with a stand-in model that says what the test wrote. This runs the REAL phone model (Blaze = Gemma 4 E2B, Google's 4-bit
QAT GGUF) through the REAL Chat screen — routing, packs, guards, everything — with the sentences Ali typed and ~100 everyday ones, and writes
every answer to tests/trials/realchat-<name>.md to be READ, not counted.
  ATTUNE_MODEL=/home/user/models/blaze-e2b-q4.gguf ATTUNE_THREADS=4 ATTUNE_PAGE_PORT=8896 ATTUNE_ENGINE_PORT=18896 \
    PYTHONPATH=tests/pwshim:tests python3 tests/trials/realchat.py [first-N] [only-ids,comma]
"""
import json, sys, time, os, datetime
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from playwright.sync_api import sync_playwright
from harness import Env, new_page
from realchat_set import SET

NOW = datetime.datetime(2026, 11, 22, 13, 0, 0)
LEDGER = {"currency": "EGP", "accounts": [{"id": "a1", "name": "Cash", "currency": "EGP"}], "recurring": [],
          "customCats": [{"id": "c_nada", "en": "masroof nada", "ar": "مصروف ندى", "e": "👗"}],
          "txns": [{"id": "t1", "type": "expense", "amount": 500, "cat": "other", "note": "لأحمد السباك", "date": "2026-11-10", "account": "a1"},
                   {"id": "t2", "type": "expense", "amount": 25000, "cat": "c_nada", "note": "shopping winter clothes", "date": "2026-11-12", "account": "a1"},
                   {"id": "t3", "type": "expense", "amount": 300, "cat": "food", "note": "lunch with Ahmed", "date": "2026-11-15", "account": "a1"},
                   {"id": "t4", "type": "expense", "amount": 1200, "cat": "transport", "note": "uber", "date": "2026-11-18", "account": "a1"}]}
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));localStorage.setItem('ledger.v3',%s)}catch(e){}\n"
        "(() => { function w(){ const N = window.AttuneNative; if (!N || !window.__mock) return setTimeout(w, 5);"
        " window.__mock.engine = { ...window.__mock.engine, state: 'ready', modelId: 'test-model' };"
        " window.dispatchEvent(new CustomEvent('attune-engine', { detail: { ...window.__mock.engine } })); } w(); })();") % json.dumps(json.dumps(LEDGER))
LAST = """() => { const c = JSON.parse(localStorage.getItem('attune:chats:v1') || '[]'); const list = Array.isArray(c) ? c : (c.chats || []);
  const ch = list.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0))[0] || { messages: [] }; const a = ch.messages.filter((m) => m.role === 'assistant');
  const m = a[a.length - 1] || {}; return { n: list.reduce((k, x) => k + (x.messages || []).length, 0), phase: m.phase || '', text: m.text || '', card: m.card ? (m.card.title + ' — ' + (m.card.detail || '')) : m.actionCard && m.status !== 'reading' ? ('[action ' + m.status + '] ' + JSON.stringify(m.action || m.plan || {}).slice(0, 200)) : '', streaming: !!m.streaming, err: m.error || '',
  from: [m.knowledgeUsed ? 'pack-shown' : '', (m.kchips || []).length ? 'pack-used' : '', m.verified ? 'code-checked' : '', m.askedAgain ? 'asked-again' : '', m.ruleFixed ? 'rule-fixed' : '', m.refused ? 'refused' : '', (m.sources || []).length ? 'web' : ''].filter(Boolean).join(','), secs: m.secs || 0 }; }"""

def main():
    first = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else None
    only = set(sys.argv[2].split(",")) if len(sys.argv) > 2 else None
    items = [x for x in SET if not only or x[0] in only][:first]
    name = os.path.basename(os.environ.get("ATTUNE_MODEL", "tiny")).replace(".gguf", "")
    out = os.path.join(os.path.dirname(__file__), "realchat-%s.md" % name)
    env = Env(); errors = []
    rows = []
    with sync_playwright() as p:
        br = p.chromium.launch()
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
        ctx.clock.install(time=NOW)
        if os.environ.get("RC_NET"):
            page.on("request", lambda rq: ("127.0.0.1" not in rq.url and not rq.url.startswith("data:")) and print("   NET", round(time.time(), 1), rq.method, rq.url[:140], flush=True))
            page.on("requestfailed", lambda rq: ("127.0.0.1" not in rq.url) and print("   NETFAIL", round(time.time(), 1), rq.url[:100], rq.failure, flush=True))
        page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1500)
        if os.environ.get("RC_NET"):
            page.evaluate("""() => { const N = window.AttuneNative; window.__calls = []; for (const k of Object.keys(N)) if (typeof N[k] === 'function') { const f = N[k]; N[k] = function (...a) { window.__calls.push([performance.now() | 0, k, String(a[0] || '').slice(0, 50)]); return f.apply(this, a); }; } }""")
        page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_selector("textarea[placeholder='Message Attune']", timeout=20000)
        for (iid, turns, expect) in items:
            if os.environ.get("RC_NET"): print("   NEWCHAT", round(time.time(), 1), "stop-btn:", page.locator("button[title='Stop'], button[aria-label='Stop']").count(), flush=True)
            try: page.click("header button[aria-label='New chat']", timeout=3000)
            except Exception: pass
            page.wait_for_timeout(300)
            page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_timeout(300)
            for t in (turns if isinstance(turns, list) else [turns]):
                n0 = page.evaluate(LAST)["n"]
                page.evaluate("() => { window.__mock.fakeQueue = []; window.__mock.bodies = []; }")
                t0 = time.time()
                if os.environ.get("RC_NET"): print("   ASK", round(t0, 1), t[:40], flush=True)
                page.locator("textarea[placeholder='Message Attune']").fill(t); page.locator("button[title='Send']").click()
                if os.environ.get("RC_NET"): print("   SENT", round(time.time() - t0, 1), "busy-ui:", page.locator("button[title='Stop']").count(), flush=True)
                r = None
                for _ in range(int(os.environ.get('RC_WAIT', '1200'))):   # up to 10 min
                    page.wait_for_timeout(500); ctx.clock.run_for(500)
                    r = page.evaluate(LAST)
                    if r["n"] > n0 and not r["streaming"] and (r["text"] or r["card"] or r["err"]): break
                r["wall"] = round(time.time() - t0, 1); r["q"] = t
                r["calls"] = page.evaluate("() => (window.__mock.bodies || []).map(b => (b.max_tokens || 0) + ':' + String((b.messages || []).slice(-1)[0]?.content || '').slice(0, 40).replace(/\\n/g, ' '))")
                if r["streaming"]: print("   STILL STREAMING, phase:", r.get("phase"), flush=True)
                rows.append((iid, expect, r))
                print("%s %5.1fs %-14s %s → %s" % (iid, r["wall"], r["from"], t[:50], (r["text"] or r["card"] or r["err"]).replace("\n", " ")[:160]), flush=True)
                if os.environ.get("RC_CALLS"): print("   calls:", r["calls"], flush=True)
                if os.environ.get("RC_NET"): print("   NATIVE:", page.evaluate("() => { const c = window.__calls.splice(0); return c.map(x => x.join(' ')).join(' | ') }")[:3000], flush=True)
        br.close()
    env.close()
    with open(out, "w", encoding="utf-8") as f:
        f.write("# Real model through the real Chat — %s (%s)\n\n" % (name, time.strftime("%Y-%m-%d %H:%M")))
        for iid, expect, r in rows:
            f.write("## %s — %s\n_want:_ %s · _%.0f s · %s_\n\n%s\n\n" % (iid, r["q"], expect, r["wall"], r["from"] or "model", (r["text"] or ("[card] " + r["card"]) or ("[error] " + r["err"])).strip()))
    print("written", out)

if __name__ == "__main__":
    main()
