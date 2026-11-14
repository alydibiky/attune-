# 1M test part E (TEST_1M.md): EXACTLY 50,000 journeys in the real page, each checked step by step in the app's own stores.
#   49,000 run through the Home box's own code (window.__attuneDoIt = what typing in the box and pressing Send runs) in batches:
#     say it → the right store changed (the amount / the time / the person and direction) → Undo → every store exactly as before;
#     two orders in one sentence → both, Undo → both gone; a change of mind → the second amount; "don't…" / a question → nothing saved;
#     one in ten spendings is kept, and at the end the day's total in Money must equal what was kept.
#    1,000 typed into the real Home box and sent with the real button, then the real Undo button tapped.
#   No JavaScript error may happen anywhere (checked after every batch).
#     python3 tests/onemillion/partE.py [scale=1]
import sys, os, json, time
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
os.environ.setdefault("ATTUNE_PAGE_PORT", "8880"); os.environ.setdefault("ATTUNE_ENGINE_PORT", "18880")
from playwright.sync_api import sync_playwright
from harness import Env, new_page
SCALE = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
N_PAGE, N_UI, BATCH = int(49000 * SCALE), int(1000 * SCALE), 250
FLOWS = r"""
async ({ n, seed0 }) => {
  let seed = seed0; const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
  const KEYS = ["ledger.v3", "attune:life:v1", "attune:reminders:v1"];
  const snap = () => KEYS.map((k) => localStorage.getItem(k) || "").join("\u0001");
  const txns = () => (J("ledger.v3", { txns: [] }).txns || []), life = () => (J("attune:life:v1", { items: [] }).items || []), rems = () => { const r = J("attune:reminders:v1", []); return Array.isArray(r) ? r : r.items || []; };
  const THING = ["lunch", "a taxi", "coffee", "groceries", "petrol", "medicine", "the gym", "a haircut", "parking", "dinner", "a cake", "bread"], THING_AR = ["الغدا", "تاكسي", "القهوة", "الخضار", "البنزين", "الدوا", "الحلاق", "الباركينج"];
  const NAMES = ["Ahmed", "Sara", "Omar", "Mona", "Karim", "Laila", "Youssef", "Nada"], NAMES_AR = ["احمد", "سارة", "عمر", "منى", "كريم"], TASK = ["call the bank", "pay the rent", "take my medicine", "send the report", "water the plants"];
  const out = { n: 0, bad: [], kept: 0, keptN: 0 };
  let restoreTo = null;   // after a failure the stores are put back, so one failure never spills into the next check
  const restore = () => { if (restoreTo == null) return; restoreTo.split("\u0001").forEach((v, k) => { v ? localStorage.setItem(KEYS[k], v) : localStorage.removeItem(KEYS[k]); }); };
  const fail = (kind, s, why) => { if (out.bad.length < 40) out.bad.push(kind + " | " + s + " | " + why); out.badN = (out.badN || 0) + 1; restore(); };
  for (let i = 0; i < n; i++) {
    out.n++;
    const r0 = rnd(), before = snap(), t0 = txns().length, l0 = life().length, m0 = rems().length, now = Date.now(); restoreTo = before;
    let s = "", kind = "";
    try {
      if (r0 < 0.35) {   // a spending, in one of many shapes
        kind = "spend"; const a = int(5, 4999), th = pick(THING), tha = pick(THING_AR);
        s = pick([`spent ${a} on ${th}`, `paid ${a} for ${th}`, `${th} ${a}`, `${a} ${th}`, `صرفت ${a} على ${tha}`, `دفعت ${a} في ${tha}`, `${tha} ب${a}`, `gasté ${a} en el almuerzo`, `j'ai payé ${a} pour le taxi`, `점심에 ${a}원 썼어`, `sraft ${a} 3ala el ghada`]);
        const r = window.__attuneDoIt(s); const t = txns();
        if (t.length !== t0 + 1) { fail(kind, s, "expected one new entry, got " + (t.length - t0) + " " + JSON.stringify(r && r.lines && r.lines[0]).slice(0, 80)); continue; }
        const x = t[t.length - 1]; if (Math.abs(+x.amount - a) > 0.01 || x.type !== "expense") { fail(kind, s, "saved " + x.type + " " + x.amount); continue; }
        if (rnd() < 0.1) { out.kept += a; out.keptN++; continue; }   // kept: the day's total is checked at the end
        if (!r || typeof r.undo !== "function") { fail(kind, s, "no Undo"); continue; }
        r.undo(); if (snap() !== before) fail(kind, s, "Undo left something behind");
      } else if (r0 < 0.55) {   // a reminder with its time
        kind = "remind"; const H = int(7, 21), task = pick(TASK), d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(H, 0, 0, 0);
        const ar = rnd() < 0.3; s = ar ? `فكرني بكرة الساعة ${H > 12 ? H - 12 : H} ${H >= 12 ? "بالليل" : "الصبح"} ${pick(["اكلم البنك", "ادفع الايجار", "اخد الدوا"])}` : `remind me tomorrow at ${H > 12 ? H - 12 : H} ${H >= 12 ? "pm" : "am"} to ${task}`;
        if (ar && H >= 12 && H < 18) { s = s.replace("بالليل", "العصر"); }
        const r = window.__attuneDoIt(s); const m = rems();
        if (m.length !== m0 + 1) { fail(kind, s, "expected one new reminder, got " + (m.length - m0)); continue; }
        const x = m[m.length - 1]; if (Math.abs(x.at - d.getTime()) > 60e3) { fail(kind, s, "time " + new Date(x.at).toString().slice(0, 21) + " ≠ " + d.toString().slice(0, 21)); }
        if (r && r.undo) { r.undo(); if (rems().length !== m0) fail(kind, s, "Undo left the reminder"); } else fail(kind, s, "no Undo");
      } else if (r0 < 0.75) {   // a debt, either way
        kind = "debt"; const a = int(1, 400) * 50, nm = pick(NAMES), nma = pick(NAMES_AR), dir = rnd() < 0.5 ? "in" : "out";
        s = dir === "in" ? pick([`${nm} owes me ${a}`, `I lent ${nm} ${a}`, `${nma} عليه ${a}`, `salaft ${pick(["ahmed", "sara"])} ${a}`]) : pick([`I owe ${nm} ${a}`, `I borrowed ${a} from ${nm}`, `استلفت ${a} من ${nma}`]);
        const r = window.__attuneDoIt(s); const L = life();
        if (L.length !== l0 + 1) { fail(kind, s, "expected one new plan, got " + (L.length - l0)); continue; }
        const x = L[L.length - 1]; if (x.dir !== dir) fail(kind, s, "direction " + x.dir + " ≠ " + dir); else if (Math.abs((+x.total || +x.amount) - a) > 0.01) fail(kind, s, "amount " + (x.total || x.amount) + " ≠ " + a);
        if (r && r.undo) { r.undo(); if (snap() !== before) fail(kind, s, "Undo left something behind"); } else fail(kind, s, "no Undo");
      } else if (r0 < 0.85) {   // two orders in one sentence
        kind = "two"; const a = int(10, 2000), h = int(1, 5); s = pick([`paid ${a} for ${pick(THING)} and remind me in ${h} hours to ${pick(TASK)}`, `spent ${a} on ${pick(THING)}, also remind me in ${h} hours to ${pick(TASK)}`]);
        const r = window.__attuneDoIt(s);
        const okT = txns().length === t0 + 1 && Math.abs(+txns()[txns().length - 1].amount - a) < 0.01, okM = rems().length === m0 + 1 && Math.abs(rems()[rems().length - 1].at - (now + h * 36e5)) < 120e3;
        if (!okT || !okM) fail(kind, s, (okT ? "" : "money missing ") + (okM ? "" : "reminder missing/wrong"));
        if (r && r.undo) { r.undo(); if (txns().length !== t0 || rems().length !== m0) fail(kind, s, "Undo left something behind"); } else fail(kind, s, "no Undo");
      } else if (r0 < 0.9) {   // a change of mind
        kind = "correct"; const a = int(100, 900), b = a - int(10, 90); s = pick([`spent ${a} on ${pick(THING)}, no wait ${b}`, `paid ${a} for ${pick(THING)} — sorry, ${b}`, `صرفت ${a} على ${pick(THING_AR)} لا استنى ${b}`]);
        const r = window.__attuneDoIt(s); const t = txns();
        if (t.length !== t0 + 1 || Math.abs(+t[t.length - 1].amount - b) > 0.01) fail(kind, s, "saved " + (t.length - t0) + " × " + (t.length ? t[t.length - 1].amount : "") + " (want " + b + ")");
        if (r && r.undo) r.undo(); if (snap() !== before) fail(kind, s, "Undo left something behind");
      } else {   // nothing may be saved: a "don't", a question
        kind = "nothing"; s = pick([`don't remind me to ${pick(TASK)}`, "I didn't spend anything today", "how much did I spend today?", "who owes me money?", "متفكرنيش اكلم البنك", "what's due this week?", "مصرفتش حاجة النهارده"]);
        window.__attuneDoIt(s); if (snap() !== before) fail(kind, s, "something was saved");
      }
    } catch (e) { fail(kind || "?", s, "threw " + String(e && e.message || e).slice(0, 90)); }
  }
  return out;
}
"""
UIFLOW = r"""
async ({ s, a, kind }) => {
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
  return { t: (J("ledger.v3", { txns: [] }).txns || []).length, l: (J("attune:life:v1", { items: [] }).items || []).length, m: (() => { const r = J("attune:reminders:v1", []); return (Array.isArray(r) ? r : r.items || []).length; })(),
    last: (J("ledger.v3", { txns: [] }).txns || []).slice(-1)[0] || null };
}
"""
env = Env(); errors = []; res = {"page": {"n": 0, "bad": 0, "ex": []}, "ui": {"n": 0, "bad": 0, "ex": []}}
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:country','eg')}catch(e){}", legacy_nav=False)
    page.goto(env.url); page.wait_for_selector("[data-testid=home-ask]", timeout=20000); page.wait_for_timeout(800)
    kept = 0
    for b in range(0, N_PAGE, BATCH):
        n = min(BATCH, N_PAGE - b)
        r = page.evaluate(FLOWS, {"n": n, "seed0": 777 + b})
        res["page"]["n"] += r["n"]; res["page"]["bad"] += r.get("badN", 0); kept += r["kept"]
        for x in r["bad"]:
            if len(res["page"]["ex"]) < 60: res["page"]["ex"].append(x)
        errs = [e for e in errors if "ERR_" not in e and "engine-400" not in e and "Failed to load resource" not in e]
        if errs: res["page"]["bad"] += 1; res["page"]["ex"].append("JS error | " + errs[-1][:160]); errors.clear()
        if (b // BATCH) % 20 == 0: print("page flows", res["page"]["n"], "wrong", res["page"]["bad"], flush=True)
    # what was kept is today's spending in Money
    total = page.evaluate("() => { const t = new Date(); const d = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); return (JSON.parse(localStorage.getItem('ledger.v3') || '{\"txns\":[]}').txns || []).filter((x) => x.type === 'expense' && x.date === d).reduce((a, x) => a + (+x.amount || 0), 0); }")
    if abs(total - kept) > 0.01: res["page"]["bad"] += 1; res["page"]["ex"].append("kept total | Money's total today %s ≠ kept %s" % (total, kept))
    # 1,000 typed into the real box, sent with the real button, undone with the real Undo button
    import random; R = random.Random(4242)
    page.evaluate("() => { localStorage.removeItem('ledger.v3'); localStorage.removeItem('attune:life:v1'); localStorage.setItem('attune:reminders:v1','[]'); }"); page.reload(); page.wait_for_selector("[data-testid=home-ask]", timeout=20000); page.wait_for_timeout(600)
    for i in range(N_UI):
        kind = R.choice(["spend", "spend", "debt", "remind"]); a = R.randint(5, 4000)
        s = {"spend": R.choice(["spent %d on lunch" % a, "صرفت %d على القهوة" % a, "taxi %d" % a]), "debt": R.choice(["Sara owes me %d" % a, "I owe Omar %d" % a]), "remind": "remind me tomorrow at %d pm to call the bank" % R.randint(1, 9)}[kind]
        b0 = page.evaluate(UIFLOW, {"s": s, "a": a, "kind": kind}); why = ""
        try:
            page.fill("[data-testid=home-ask]", s); page.click("[data-testid=home-send]"); page.wait_for_timeout(250)
            b1 = page.evaluate(UIFLOW, {"s": s, "a": a, "kind": kind})
            key = {"spend": "t", "debt": "l", "remind": "m"}[kind]
            if b1[key] != b0[key] + 1: why = "not saved (%s %d→%d)" % (key, b0[key], b1[key])
            elif kind == "spend" and abs(float(b1["last"]["amount"]) - a) > 0.01: why = "amount %s ≠ %d" % (b1["last"]["amount"], a)
            if not why:
                u = page.locator("[data-testid=do-undo]")
                if u.count() == 0: why = "no Undo button"
                else:
                    u.first.click(); page.wait_for_timeout(150); b2 = page.evaluate(UIFLOW, {"s": s, "a": a, "kind": kind})
                    if b2[key] != b0[key]: why = "Undo button left it (%s %d→%d)" % (key, b0[key], b2[key])
        except Exception as e: why = "error " + str(e)[:100]
        errs = [e for e in errors if "ERR_" not in e and "engine-400" not in e and "Failed to load resource" not in e]
        if errs and not why: why = "JS error " + errs[-1][:120]
        errors.clear(); res["ui"]["n"] += 1
        if why: res["ui"]["bad"] += 1; res["ui"]["ex"].append("%s | %s | %s" % (kind, s, why)) if len(res["ui"]["ex"]) < 40 else None
        page.keyboard.press("Escape")
        if i % 100 == 99: print("ui flows", res["ui"]["n"], "wrong", res["ui"]["bad"], flush=True)
    br.close()
env.close()
tot = res["page"]["n"] + res["ui"]["n"]; bad = res["page"]["bad"] + res["ui"]["bad"]
md = "# 1M part E — %d journeys in the real page, %d right (%.3f%%)\n\n| kind | journeys | wrong |\n|---|---|---|\n| through the Home box's own code (say it → saved right → Undo → exactly as before) | %d | %d |\n| typed in the real box, real Send, real Undo button | %d | %d |\n" % (tot, tot - bad, 100 * (tot - bad) / max(1, tot), res["page"]["n"], res["page"]["bad"], res["ui"]["n"], res["ui"]["bad"])
md += "\n## What went wrong\n" + "".join("- %s\n" % x.replace("|", "·") for x in res["page"]["ex"] + res["ui"]["ex"])
if SCALE == 1.0: open(os.path.join(HERE, "E-flows.md"), "w").write(md)
print(md)
