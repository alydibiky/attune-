"""The offline food pack on a real browser's IndexedDB: install two shards, search by name / Arabic / barcode, resume, delete."""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env()
with sync_playwright() as p:
    br = p.chromium.launch(); errors = []
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    r = page.evaluate("""async () => {
      const { FP, store } = window.__attuneFoodPack;
      await store.clear();
      const L = (code, en, ar, brand, kcal, eg) => [code, en, ar, brand, kcal, 0, 10.6, 0, 0, '10.6', '', '0.01', '330', eg, 'E', '4'].join('\\t');
      const a = [L('6221000000001','Cola Zero','كولا زيرو','Pepsi',1,1), L('5449000000002','Coca-Cola Zero Sugar','','Coca-Cola',0,0), L('6221000000003','Cola Light','','Local',2,1)].join('\\n');
      let b = []; for (let i = 0; i < 20000; i++) b.push(L(String(7000000000000 + i), 'Biscuit ' + i, '', 'Brand' + (i % 50), 400 + (i % 100), i % 7 === 0 ? 1 : 0));
      const man = { version: 1, built: '2026-10-03', count: 20003, shards: [{ name: 'a', bytes: 1000 }, { name: 'b', bytes: 9000 }] };
      const asked = [];
      const get = async (n) => { asked.push(n); return n === 'a' ? a : b.join('\\n'); };
      const t0 = performance.now();
      const out = await FP.installPack({ store, manifest: man, getText: get });
      const t1 = performance.now();
      const cola = await FP.searchPack(store, 'cola zero');
      const ar = await FP.searchPack(store, 'كولا');
      const short = await FP.searchPack(store, 'bisc 19999');
      const bc = await FP.packByBarcode(store, '6221000000003');
      const t2 = performance.now();
      asked.length = 0;
      await FP.installPack({ store, manifest: man, getText: get });
      const meta = await store.getMeta();
      return { count: out.count, installMs: Math.round(t1 - t0), cola: cola.map(x => x.en), ar: ar.map(x => x.barcode), short: short.map(x => x.en), bc: bc && bc.en, searchMs: Math.round(t2 - t1), resumedAsked: asked.length, done: meta.done };
    }""")
    print(r)
    check(r["count"] == 20003, "two shards are installed in IndexedDB (%s foods in %s ms)" % (r["count"], r["installMs"]))
    check(len(r["cola"]) == 2 and all("Zero" in x for x in r["cola"]), "a name search finds the products")
    check(r["ar"] == ["6221000000001"], "an Arabic name finds its product")
    check(len(r["short"]) == 1 and r["short"][0].startswith("Biscuit 19999"), "word starts are enough (bisc 19999)")
    check(r["bc"] and "Cola Light" in r["bc"], "a barcode is found offline")
    check(r["searchMs"] < 1500, "four searches in %s ms" % r["searchMs"])
    check(r["resumedAsked"] == 0 and sorted(r["done"]) == ["a", "b"], "installing again downloads nothing (resume)")
    # the app's own search path uses the pack
    page.evaluate("async () => { await window.__attuneFoodPack.store.clear(); }")
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
