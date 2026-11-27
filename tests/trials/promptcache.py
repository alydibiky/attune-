# v10.9.9 A4: how much of each chat prompt the engine re-reads (cache_n = kept, prompt_n = read now), on the real chat flow incl. the
# pre-read when the box is tapped. PYTHONPATH=tests/pwshim:tests python3 tests/trials/promptcache.py
import os, json, urllib.request
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "e2e_v1099askmind.py")).read().split("with sync_playwright() as p:")[0])
from harness import ENGINE_PORT
allb = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init(), desktop=None)
    page.set_viewport_size({"width": 390, "height": 860})
    page.goto(env.url); page.wait_for_timeout(1500)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))")
    page.wait_for_selector("textarea[placeholder='Message Attune']", timeout=15000)
    for q in ["hi", "what is the capital of australia", "give me 3 tips to sleep better", "and for kids?"]:
        # short fake answers so nothing is "cut" and continued (the tiny model never stops on its own)
        page.evaluate("() => { window.__mock.bodies = []; window.__mock.fakeQueue = ['**Fine.** Short answer.']; }")
        page.locator("textarea[placeholder='Message Attune']").click(); page.wait_for_timeout(600)
        page.locator("textarea[placeholder='Message Attune']").fill(q); page.locator("button[title='Send']").click()
        page.wait_for_timeout(3500)
        bs = page.evaluate("window.__mock.bodies")
        print("Q:", q, "->", len(bs), "requests", [ (b.get('max_tokens'), len(b.get('messages',[]))) for b in bs])
        allb += [(q, b) for b in bs]
    br.close()
    # replay in order on the real engine: how much of each prompt is reused from the one before
    for q, b in allb:
        b2 = dict(b); b2["max_tokens"] = 1; b2["stream"] = False; b2["cache_prompt"] = True
        req = urllib.request.Request(f"http://127.0.0.1:{ENGINE_PORT}/v1/chat/completions", data=json.dumps(b2).encode(), headers={"Content-Type": "application/json", "Authorization": "Bearer testkey"})
        r = json.load(urllib.request.urlopen(req, timeout=120)); t = r.get("timings", {})
        print("replay", ("WARM " if b.get("max_tokens") == 1 else "") + q[:22].ljust(22), "cached", t.get("cache_n"), "read now", t.get("prompt_n"))
env.close()
import difflib
w = [b for q,b in allb if q.startswith("what is") and b.get("max_tokens")==1][0]; a=[b for q,b in allb if q.startswith("what is") and b.get("max_tokens")!=1][0]
for i,(x,y) in enumerate(zip(w["messages"], a["messages"])):
    if x != y:
        print("MSG", i, x.get("role"))
        for l in difflib.unified_diff(str(x.get("content")).split("\n"), str(y.get("content")).split("\n"), lineterm="", n=0): print("   ", l[:200])
print({k:(w.get(k),a.get(k)) for k in set(w)|set(a) if k!="messages" and w.get(k)!=a.get(k)})
