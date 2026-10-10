import sys, json; import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from harness import Env, new_page
env = Env()
TOOLS = "instant studio assistants projects artifacts code learn news slides xray convert video business crane field fleet reminders fit deal memory map travel cycle improve compress humanize copilot library ask".split()
PROBE = r"""() => {
  const W = innerWidth, bad = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (el.parentElement && el.parentElement.closest('.overflow-hidden')) continue;
    if (el.closest('.att-hscroll,.att-chips,.overflow-x-auto,[data-i18n-skip],pre,table,iframe')) continue;
    const cs = getComputedStyle(el); if (cs.position === 'fixed' && r.width >= W - 2) continue;
    if (r.right > W + 2 || r.left < -2) { bad.push((el.tagName + '.' + String(el.className).split(' ').slice(0,2).join('.')).slice(0,60) + ' ' + Math.round(r.left) + '→' + Math.round(r.right) + ' "' + (el.innerText||'').trim().slice(0,30) + '"'); }
  }
  const small = [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && r.height && r.top < innerHeight && r.bottom > 0 && (r.height < 26 || r.width < 26) && (b.innerText||'').trim().length < 3; }).map(b => b.outerHTML.slice(0,140));
  // a one-word label broken over lines ("P / as / te") — the button got squeezed
  const squeezed = [];
  for (const b of document.querySelectorAll('button, a, span, p, label')) {
    const r0 = b.getBoundingClientRect(); if (!r0.width || r0.bottom < 0 || r0.top > innerHeight * 3) continue;
    for (const n of b.childNodes) { if (n.nodeType !== 3) continue; const t = n.nodeValue.trim(); if (t.length < 3 || /\s/.test(t)) continue;
      const rg = document.createRange(); rg.selectNodeContents(n); const ys = new Set([...rg.getClientRects()].map((q) => Math.round(q.top)));
      if (ys.size > 1) squeezed.push(t.slice(0, 20)); }
  }
  const crash = document.body.innerText.includes('Something went wrong on this screen') || document.body.innerText.includes('حدثت مشكلة في هذه الشاشة');
  return { overflow: document.documentElement.scrollWidth > W + 1, bad: [...new Set(bad)].slice(0, 5), small, crash, squeezed: [...new Set(squeezed)].slice(0, 5) };
}"""
LATIN = r"""() => { const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.nodeValue.trim(); const el = n.parentElement;
    if (!t || !el || el.closest('[data-i18n-skip],textarea,script,style,pre,code')) continue; const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight * 3) continue;
    const words = (t.match(/[A-Za-z]{4,}/g) || []).filter((w) => !/^(Attune|Spark|Glow|Blaze|Core|Lite|Sense|Zenith|Apex|Everest|GGUF|InstaPay|Yusr|ChatGPT|Claude|Gemini|English|Brave|DuckDuckGo|NEON|KleidiAI|Vulkan|Adreno|OpenCL|QUALCOMM|Studio|Turbo|Excel|Access|WhatsApp|Vodafone|Cash|Google|Wikipedia|Copilot|NotebookLM|Manus|Perplexity|Grok|DeepSeek|Mistral|Llama|Kimi|Qwen|Python|JavaScript|HTML|FLUX|Liebherr|Grove|Tadano|Demag|Sany|XCMG|Zoomlion|Terex|Manitowoc|Tavily|Serper|Pyodide|LiteRT|llama|cpp|dotprod|matmul|imatrix|mmap|KleidiAI)$/.test(w));
    if (words.length) out.push(t.slice(0, 70)); } return [...new Set(out)].slice(0, 6); }"""
errors_all = []
with sync_playwright() as p:
    br = p.chromium.launch()
    # "en-narrow": a 320-px screen — text as big for the width as on a phone with a larger Text size
    for lang in ["en", "ar", "en-narrow"]:
        errors = []
        ctx, page = new_page(br, env, errors, extra_init=("localStorage.setItem('attune:lang','ar');" if lang == "ar" else ""))
        if lang == "en-narrow": page.set_viewport_size({"width": 320, "height": 760})
        page.goto(env.url); page.wait_for_selector("nav", timeout=15000); page.wait_for_timeout(500)
        if lang == "ar" and page.evaluate("document.documentElement.dir") != "rtl":
            page.locator("nav button").last.click(); page.wait_for_timeout(300)
            try:
                with page.expect_navigation(timeout=8000): page.locator("button[data-lang=ar]").first.click()
            except Exception as e: print("lang switch", e)
            page.wait_for_selector("nav", timeout=15000)
        def report(name):
            r = page.evaluate(PROBE); lat = page.evaluate(LATIN) if lang == "ar" else []
            issues = []
            if r["crash"]: issues.append("CRASH")
            if r["overflow"] or r["bad"]: issues.append("overflow " + json.dumps(r["bad"], ensure_ascii=False))
            if r["small"]: issues.append("tiny " + json.dumps(r["small"], ensure_ascii=False))
            if r["squeezed"]: issues.append("squeezed " + json.dumps(r["squeezed"], ensure_ascii=False))
            if lat: issues.append("english: " + json.dumps(lat, ensure_ascii=False))
            if errors: issues.append("JS: " + errors[-1][:120]); errors.clear()
            print(("%-3s %-12s " % (lang, name)) + ("OK" if not issues else " | ".join(issues)), flush=True)
        nav = page.locator("nav button")
        for i in range(nav.count() - 1):
            nav.nth(i).click(); page.wait_for_timeout(500); report("tab%d" % i)
        for i, t in enumerate(TOOLS):
            page.locator("nav button").last.click(); page.wait_for_timeout(300)
            tiles = page.locator("[data-testid=more-group] button")
            if i >= tiles.count(): print(lang, t, "no tile"); continue
            tiles.nth(i).click(); page.wait_for_timeout(700); report(t)
        for label, sel in [("engine", 0), ("profile", 1), ("plan", 2), ("backup", 3)]:
            page.locator("nav button").last.click(); page.wait_for_timeout(300)
            page.locator("[data-testid=more-settings] button").nth(sel).click(); page.wait_for_timeout(700); report(label)
            page.keyboard.press("Escape"); page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(300)
        ctx.close()
    br.close()
env.close()
