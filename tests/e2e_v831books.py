"""v8.3 Library at scale (Ali: "group books into topics — History — handle 20 GB, and don't overload the model or the phone"):
on the phone the books live in BookShelf.kt (a full-text index read in the background); this test stands in for it and checks the
page: topics, picking books / a folder for a topic, the reading progress, a question searched ONLY in the topic's books, passages
cut to what the model holds, Read deeper in rounds, moving a book and deleting a topic.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v831books.py
"""
import json, os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHELF = r"""(() => { const N = window.AttuneNative; const S = window.__shelf = { topics: [], books: [], job: {}, picks: [], searches: [], dbBytes: 2.4e9 };
  let id = 1;
  const page = (t, b, p, txt) => ({ book: String(b), title: t, topic: '', page: p, text: txt, score: 5 });
  N.booksState = () => JSON.stringify(S);
  N.booksTopic = (j) => { const a = JSON.parse(j);
    if (a.op === 'add' && !S.topics.includes(a.name)) S.topics.push(a.name);
    if (a.op === 'delete') { S.topics = S.topics.filter((t) => t !== a.name); S.books.forEach((b) => { if (b.topic === a.name) b.topic = ''; }); }
    if (a.op === 'move') S.books.forEach((b) => { if (b.id === a.book) b.topic = a.name; });
    return JSON.stringify(S); };
  N.booksRemove = (i) => { S.books = S.books.filter((b) => String(b.id) !== String(i)); return JSON.stringify(S); };
  N.booksPick = (j) => { const a = JSON.parse(j); S.picks.push(a);
    const add = (name, pages) => { const b = { id: id++, name, topic: a.topic, kind: 'pdf', pages, done: 0, chunks: 0, scans: 0, state: 'reading', err: '' }; S.books.push(b); return b; };
    const b1 = add('ibn-kathir-al-bidaya-vol13.pdf', 900), b2 = add('lapidus-islamic-societies.pdf', 1100);
    S.job = { book: b1.id, name: b1.name, page: 120, pages: 900 }; b1.done = 120;
    setTimeout(() => { for (const b of [b1, b2]) { b.done = b.pages; b.chunks = b.pages * 3; b.state = 'done'; } S.job = {}; }, 2500); };
  N.booksSearch = (cid, j) => { const a = JSON.parse(j); S.searches.push(a);
    const out = S.books.filter((b) => b.chunks > 0 && (!a.topic || b.topic === a.topic)).flatMap((b) => Array.from({ length: Math.min(a.perBook, 12) }, (_, k) =>
      page(b.name, b.id, 300 + k, 'In 1260 at Ain Jalut the Mamluks under Qutuz met the Mongols. ' + 'x'.repeat(700) + ' (' + b.name + ' part ' + k + ')'))).slice(0, a.k);
    setTimeout(() => window.__attuneNative.resolve(cid, JSON.stringify({ passages: out, searched: S.books.length, ms: 7 })), 20); };
})();"""
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1500)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    page.evaluate(SHELF)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'booklib'}}))"); page.wait_for_selector("[data-testid=booklib-page]")
    check(page.locator("[data-testid=booklib-add-folder]").count() == 1, "on the phone: + Books and + A folder (a whole folder of books at once)")
    # a topic
    page.click("[data-testid=booklib-topic-new]"); page.fill("[data-testid=booklib-topic-name]", "History"); page.click("[data-testid=booklib-topic-save]"); page.wait_for_timeout(200)
    check(page.evaluate("window.__shelf.topics") == ["History"] and page.locator("[data-testid=booklib-topic][aria-pressed=true]").inner_text() == "History", "a topic called History, chosen")
    page.click("[data-testid=booklib-add]"); page.wait_for_timeout(300)
    check(page.evaluate("window.__shelf.picks")[0] == {"topic": "History", "folder": False}, "+ Books picks books FOR History (the phone reads them)")
    page.evaluate("window.dispatchEvent(new Event('attune-resume'))"); page.wait_for_timeout(300)
    job = page.locator("[data-testid=booklib-job]")
    check(job.count() == 1 and "120 of 900" in job.inner_text(), "the reading progress shows (book, page 120 of 900): " + (job.inner_text() if job.count() else "none"))
    page.wait_for_function("document.querySelector('[data-testid=booklib-job]') === null", timeout=8000)
    shelf = page.locator("[data-testid=booklib-shelf]").inner_text()
    check("2 books" in shelf and "2,000 pages" in shelf and "2.4 GB" in shelf, "2 books · 2,000 pages, the index size on the phone: " + shelf.split("\n")[0])
    # a question goes to History's books only, cut to what the model holds
    page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = a; }", ["Qutuz beat the Mongols in 1260 [ibn kathir al bidaya vol13, p. 300]."])
    page.fill("[data-testid=booklib-input]", "What happened at Ain Jalut?"); page.click("[data-testid=booklib-send]")
    page.wait_for_selector("[data-testid=booklib-a]", timeout=20000)
    s0 = page.evaluate("window.__shelf.searches")[0]
    check(s0["topic"] == "History" and s0["k"] == 24 and s0["perBook"] == 4, "searched in History only (24 passages, 4 a book): %s" % s0)
    body = page.evaluate("window.__mock.bodies.filter((b) => b.max_tokens > 2).map((b) => b.messages[b.messages.length - 1].content).join('')")
    ctxw = page.evaluate("window.__mock.engine && window.__mock.engine.settings || ''")
    check(0 < len(body) < 26000 and "[lapidus islamic societies, p. 30" in body and "[ibn kathir al bidaya vol13, p. 30" in body, "the model reads passages from both books, never more than it holds (%d characters)" % len(body))
    # Read deeper: many more passages, read in rounds
    page.click("[data-testid=booklib-deep]")
    page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = a; }", ["- note [x, p. 1]"] * 9 + ["Deep answer [lapidus islamic societies, p. 301]."])
    page.fill("[data-testid=booklib-input]", "Why did the Mongols lose at Ain Jalut?"); page.click("[data-testid=booklib-send]")
    page.wait_for_function("document.querySelectorAll('[data-testid=booklib-a]').length === 2", timeout=40000)
    s1 = page.evaluate("window.__shelf.searches")[-1]
    calls = page.evaluate("window.__mock.bodies.filter((b) => b.max_tokens > 2).map((b) => b.messages[b.messages.length - 1].content.length)")
    check(s1["k"] == 80 and s1["perBook"] == 12 and 2 <= len(calls) <= 9 and max(calls) < 12000, "Read deeper: 80 passages, read in %d rounds, each small enough (%d characters at most)" % (len(calls) - 1, max(calls)))
    # move a book, delete the topic (the books stay)
    page.click("[data-testid=booklib-topic-all]"); page.wait_for_timeout(150)
    check(page.locator("[data-testid=booklib-book]").count() == 2, "All books shows every topic's books")
    page.click("[data-testid=booklib-topic]"); page.wait_for_timeout(150)
    page.on("dialog", lambda d: d.accept())
    page.click("[data-testid=booklib-topic-delete]"); page.wait_for_timeout(200)
    check(page.evaluate("window.__shelf.topics") == [] and len(page.evaluate("window.__shelf.books")) == 2, "deleting a topic keeps its books")
    # v8.7 (Ali picked 4B "one Library"): a book switched on is looked into by Chat too, cited [Book, p. N]
    page.locator("[data-testid=booklib-answer] summary").click(); page.wait_for_timeout(150)
    page.locator("[data-testid=booklib-answer-toggle]").first.check(); page.wait_for_timeout(150)
    on = page.evaluate("JSON.parse(localStorage.getItem('attune:booklib:answer:v1') || '[]')")
    check(len(on) == 1, "a book is switched on for Chat and the voice: %s" % on)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'home'}}))"); page.wait_for_selector("[data-testid=home-ask]", timeout=8000)
    page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = a; }", ["At Ain Jalut in 1260 the Mamluks beat the Mongols [ibn kathir al bidaya vol13, p. 300]."])
    n0 = len(page.evaluate("window.__shelf.searches"))
    page.fill("[data-testid=home-ask]", "What happened at Ain Jalut with the Mamluks?"); page.click("[data-testid=home-send]")
    page.wait_for_function("window.__mock.bodies.some((b) => b.max_tokens > 2 && JSON.stringify(b.messages).includes('own Library'))", timeout=20000)
    s2 = page.evaluate("window.__shelf.searches")[n0:]
    body2 = page.evaluate("window.__mock.bodies.filter((b) => b.max_tokens > 2).map((b) => JSON.stringify(b.messages)).join('')")
    check(len(s2) >= 1 and s2[-1].get("books") == [str(x) for x in on] and "Ain Jalut" in s2[-1]["q"], "Chat searched only the switched-on book: %s" % (s2[-1:] if s2 else s2))
    check("p. 300" in body2 and "own Library" in body2, "…and the model got its passages with book and page")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
