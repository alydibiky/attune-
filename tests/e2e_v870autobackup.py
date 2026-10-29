"""v8.7 (Ali, 29 Oct: "messages in Recall stay forever, with offline and online backup like WhatsApp"): Recall's switch says
"forever" and the count; a search also finds an OLD message the phone keeps (recallFind, mocked); the daily-backup card:
password → folder (Google Drive, mocked picker) → Back up now writes a locked file that carries Recall's messages; the next
day Attune backs up by itself when it opens.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v870autobackup.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(time.time() * 1000)
OLD = [{"id": "o1", "pkg": "com.whatsapp", "app": "WhatsApp", "title": "Ahmed", "text": "The villa gate code is 4471", "ts": now - 400 * 86400000}]
def init(pre=""):
    return "try{" + pre + "}catch(e){}\n" + r"""(() => { const S = window.__ab = { writes: [], finds: [], folder: false };
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.recallNotesOn = () => {}; N.recallNotesIsOn = () => true; N.recallNotes = () => "[]"; N.recallCount = () => 12345; N.recallForgetAll = () => {};
    N.recallFind = (t, lim) => { S.finds.push(JSON.parse(t)); return %s; };
    N.recallExport = () => %s;
    N.autoBackupState = () => JSON.stringify(S.folder ? { set: true, name: "Attune", where: "drive" } : { set: false });
    N.autoBackupPick = () => { S.folder = true; setTimeout(() => window.dispatchEvent(new CustomEvent('attune-backup-folder', { detail: { ok: true, set: true, name: "Attune", where: "drive" } })), 30); };
    N.autoBackupWrite = (id, arg) => { S.writes.push(JSON.parse(arg)); setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ name: JSON.parse(arg).name })), 30); };
  }; go(); })();""" % (json.dumps(json.dumps(OLD)), json.dumps(json.dumps(OLD)))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=init("localStorage.setItem('attune:resume:v1', JSON.stringify({mode:'recall', at: Date.now()}));"))
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=recall-notes-toggle]", timeout=15000)
    t = page.locator("[data-testid=recall-notes-toggle]").inner_text()
    check("forever" in t and "12,345 kept" in page.locator("[data-testid=recall-notes-toggle] + p").inner_text(), "Recall keeps messages forever and says how many: %s" % t)
    page.fill("[data-testid=recall-q]", "villa gate code"); page.wait_for_timeout(900)
    hits = page.locator("[data-testid=recall-hit]").all_inner_texts()
    check(hits and "4471" in " ".join(hits), "a search finds a message from over a year ago, kept on the phone: %s" % (hits[0][:80].replace("\n", " · ") if hits else hits))
    check(page.evaluate("window.__ab.finds.length") >= 1 and "villa" in page.evaluate("window.__ab.finds.at(-1)"), "older ones are asked for by the question's words")
    # the daily backup card
    page.fill("[data-testid=autobackup-pw]", "my backup pass 1"); page.fill("[data-testid=autobackup-pw2]", "my backup pass 1"); page.click("[data-testid=autobackup-pw-save]")
    page.click("[data-testid=autobackup-folder]"); page.wait_for_selector("[data-testid=autobackup-now]", timeout=5000)
    check("Google Drive · Attune" in page.inner_text("[data-testid=autobackup]"), "the folder is in Google Drive (online backup)")
    page.click("[data-testid=autobackup-now]"); page.wait_for_function("() => window.__ab.writes.length === 1", timeout=30000)
    w = page.evaluate("window.__ab.writes[0]")
    check(w["name"].startswith("attune-auto-") and w["text"].startswith("{") and "4471" not in w["text"], "Back up now writes a LOCKED file (the message text isn't readable in it)")
    page.wait_for_function("() => JSON.parse(localStorage.getItem('attune:autobackup:v1') || '{}').last > 0", timeout=5000)
    check("Last:" in page.inner_text("[data-testid=autobackup]"), "it remembers when it last backed up")
    ctx.close()
    # the next day: it backs up by itself when Attune opens
    pre = "localStorage.setItem('attune:autobackup:v1', JSON.stringify({on:true,pw:'my backup pass 1',last:%d}));" % (now - 26 * 3600000)
    ctx, page = new_page(br, env, errors, extra_init=init(pre).replace("folder: false", "folder: true"))
    page.goto(env.url); page.wait_for_function("() => window.__ab && window.__ab.writes.length === 1", timeout=40000)
    check(True, "the next day Attune backs up by itself, with no tap")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
