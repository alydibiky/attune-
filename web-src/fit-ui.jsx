/* ---- More → Fit & Food (v5.42) ------------------------------------------------------------
   Ali: "a Yazio-like app, better — a huge database of recipes and meals, food photo recognition".
   Everything that is a number comes from fit.js (the food table, Mifflin-St Jeor, MET) — code, not
   the model. The model only READS: what's on a plate in a photo or in a sentence, then the person
   confirms every item before it's saved. All data stays on the phone (localStorage). */
import React, { useState, useRef, useMemo, useEffect } from "react";
import { Mic, Apple, Camera, Search, Plus, Trash2, Loader2, Check, Droplet, Timer, Dumbbell, BarChart3, X, Sparkles, ChevronLeft, Play, Square, Star } from "lucide-react";
import { getLang } from "./i18n.js";
import * as F from "./fit.js";
import { searchGenerated, getGenerated, GENERATED_COUNT } from "./fit-recipegen.js";
import * as DB from "./fitdb.js";
import * as R from "./fitread.js";
import * as PH from "./fitphoto.js";
import * as CL from "./fitclip.js";
import * as P from "./fitplus.js";
import { WatchCard, Grades, DayQuality, RamadanCard, QuickLog, SaveMyMeal, WeekPlanView, WeekReport, BodyCard, FitSettings, RAMADAN_NAMES } from "./fitplus-ui.jsx";
import { useSubBack, useSticky } from "./backstack.js";

const KEY = "attune:fit:v1";
const EMPTY = { profile: null, days: {}, weights: [], fast: null, myRecipes: [], favs: [], favFoods: [] };
const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && typeof v === "object" ? { ...EMPTY, ...v } : EMPTY; } catch (e) { return EMPTY; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
const MEAL_NAMES0 = { breakfast: ["Breakfast", "فطار"], lunch: ["Lunch", "غدا"], dinner: ["Dinner", "عشا"], snacks: ["Snacks", "سناكس"] };
let MEAL_NAMES = MEAL_NAMES0;   // v6.2: Ramadan mode renames the slots (Suhoor, Iftar, After Taraweeh)
const mealNow = () => { const h = new Date().getHours(); return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 21 ? "dinner" : "snacks"; };
const r0 = (v) => (v == null ? "—" : Math.round(v));

/** A photo → {media, data, url}, shrunk to 768 px so the model reads it quickly. */
function readPhoto(file) {
  return new Promise((ok, bad) => {
    const r = new FileReader();
    r.onerror = () => bad(new Error("photo"));
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 768 / Math.max(img.width, img.height));   // v6.10: 768 px is enough to see food, and the model reads it far quicker
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        const url = c.toDataURL("image/jpeg", 0.8);
        ok({ media: "image/jpeg", data: url.split(",")[1], url });
      };
      img.onerror = () => bad(new Error("photo"));
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

/** A part of a photo (box = [x, y, w, h], 0–1), with a margin, enlarged to 640 px — for the zoomed look. */
function cropPhoto(url, box) {
  return new Promise((ok, bad) => {
    const img = new Image();
    img.onload = () => {
      const m = 0.08, [x, y, w, h] = box;
      const sx = Math.max(0, (x - m) * img.width), sy = Math.max(0, (y - m) * img.height);
      const sw = Math.min(img.width - sx, (w + 2 * m) * img.width), sh = Math.min(img.height - sy, (h + 2 * m) * img.height);
      if (!(sw > 8 && sh > 8)) return bad(new Error("box"));
      const k = 640 / Math.max(sw, sh), c = document.createElement("canvas"); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
      c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      const u = c.toDataURL("image/jpeg", 0.88); ok({ media: "image/jpeg", data: u.split(",")[1], url: u });
    };
    img.onerror = () => bad(new Error("photo")); img.src = url;
  });
}

function Ring({ value, max, size = 132, children }) {
  const R = size / 2 - 9, C = 2 * Math.PI * R, pct = max > 0 ? Math.min(1, value / max) : 0, over = value > max;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={R} stroke="currentColor" className="text-slate-800" strokeWidth="10" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={R} stroke="currentColor" className={over ? "text-rose-400" : "text-emerald-400"} strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
function Bar({ label, v, max, cls }) {
  const pct = max > 0 ? Math.min(100, (v / max) * 100) : 0;
  return (
    <div className="min-w-0">
      <div className="flex justify-between text-[11px] text-slate-400"><span className="truncate">{label}</span><span className="tabular-nums">{r0(v)}/{r0(max)}</span></div>
      <div className="h-1.5 rounded-full bg-slate-800 mt-1"><div className={"h-1.5 rounded-full " + cls} style={{ width: pct + "%" }} /></div>
    </div>
  );
}

// v6.7 (Ali approved the billing plan): Free keeps typed / spoken logging, barcode, search, favorites,
// the watch and 3 photo meals a day; Pro adds unlimited photo meals, the week's meal plan + shopping
// list and the week report. `pro` defaults to on (web preview, tests); the app passes the real state.
export const FREE_PHOTOS_PER_DAY = 3;
export function FitApp({ llm, abort, ready, canSee = true, modelReady, openEngine, flash, incoming, clearIncoming, fetchJson, packText, scanBarcode, native, share, listen, health, pro = true, openPlan, photoClip }) {
  const ar = getLang() === "ar";
  const L = (en, a) => (ar ? a : en);
  const [st, setSt] = useState(load);
  MEAL_NAMES = st.ramadan && st.ramadan.on ? RAMADAN_NAMES : MEAL_NAMES0;
  const upd = (fn) => setSt((s) => { const n = fn(s); save(n); return n; });
  // v6.10: the food of the chosen country (Settings → «Food from»); the phone's own country until one is chosen
  const country = F.setCountry(st.country || F.defaultCountry());
  const [tab, setTab] = useSticky("fit:tab", "today");
  const [dayKey, setDayKey] = useState(F.today());
  const day = st.days[dayKey] || { meals: {}, water: 0, workouts: [] };
  const tg = useMemo(() => { const t = st.profile ? F.targets(st.profile) : null; return t ? { ...t, kg: +st.profile.kg } : null; }, [st.profile]);
  const tot = F.dayTotals(day);
  const setDay = (fn) => upd((s) => { const d = s.days[dayKey] || { meals: {}, water: 0, workouts: [] }; return { ...s, days: { ...s.days, [dayKey]: fn(d) } }; });
  const addItems = (meal, items) => setDay((d) => ({ ...d, meals: { ...d.meals, [meal]: [...((d.meals || {})[meal] || []), ...items.map((x) => ({ ...x, t: Date.now() }))] } }));

  // ---- logging ----
  const [adding, setAdding] = useState(null);           // meal slot being added to, or null
  useSubBack(!!adding, () => setAdding(null));
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null);             // items read, waiting for the person's OK
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [online, setOnline] = useState(null);           // { q, foods } from the big databases
  const [searching, setSearching] = useState(false);
  const [replaceAt, setReplaceAt] = useState(-1);       // a draft item being swapped for a searched food
  // v6.10: the photo fast path (fitclip.js) is on the phone → a photo is named in about a second, no chat model needed
  const [clipOn, setClipOn] = useState(() => { try { return !!(photoClip && photoClip.status().installed) || !!(typeof window !== "undefined" && window.__attuneClipTest); } catch (e) { return false; } });
  useEffect(() => { if (photo && clipOn && photoClip) CL.loadClip(photoClip.base).catch(() => {}); }, [photo, clipOn]);   // warm it up while the person types a note
  const fileRef = useRef(null);
  const codeRef = useRef(null);
  const run = useRef(0);
  useEffect(() => { if (incoming) { setText(incoming); setAdding(mealNow()); setTab("today"); clearIncoming && clearIncoming(); } }, [incoming]);

  const readMeal = async () => {
    if (!text.trim() && !photo) return;
    const me = ++run.current;
    // v6.3: the dietitian-style reader first (numbers, fractions, «بيضتين», «ربع كيلو», sizes, units,
    // what people call foods) — instant and offline; only the words it can't place go to the model
    const read = photo ? { items: [], unknown: [] } : R.readMealText(text);
    if (!photo && read.items.length && !read.unknown.length) { setDraft(read.items); return; }
    if (!modelReady && !(photo && clipOn)) { if (read.items.length) { setDraft(read.items); flash && flash(L(`Not placed: “${read.unknown.join(", ")}” — load a model to read it, or search it below`, `ما عرفتش: «${read.unknown.join("، ")}» — شغّل موديل يقراها، أو دوّر عليها تحت`)); } else openEngine && openEngine(); return; }
    setBusy(true);
    try {
      if (photo) {
        const used = (st.photoUse && st.photoUse.d === F.today() ? st.photoUse.n : 0);
        if (!pro && used >= FREE_PHOTOS_PER_DAY) { flash && flash(L(`${FREE_PHOTOS_PER_DAY} photo meals a day are free — Pro reads every photo. Type or say it meanwhile.`, `${FREE_PHOTOS_PER_DAY} صور وجبات في اليوم ببلاش — Pro بيقرا كل الصور. اكتبها أو قولها لحد كده.`)); setPhoto(null); openPlan && openPlan(); return; }   // the photo goes, so typing the meal works at once
        await readPhotoMeal(me);
        if (!pro) upd((s) => ({ ...s, photoUse: { d: F.today(), n: (s.photoUse && s.photoUse.d === F.today() ? s.photoUse.n : 0) + 1 } }));
        return;
      }
      const ask = read.items.length ? read.unknown.join(", ") : text.trim();
      const raw = await llm(F.mealMessages(ask, false), null, { json: true, maxTokens: 600, temperature: 0 });
      if (run.current !== me) return;
      let got = R.parseMealChecked(raw);
      // v6.4: one unknown phrase read as one food → it can be corrected and learned like any typed food
      if (read.unknown.length === 1 && got.length === 1) got = [R.applyLearned({ ...got[0], said: read.unknown[0], explicit: false })];
      const items = R.mergeSame([...read.items, ...got]);
      if (!items.length) { flash && flash(L("Couldn't read that — try naming the foods, e.g. “2 eggs and a loaf of baladi bread”", "مقدرتش أقراها — اكتب الأكلات، مثلاً «٢ بيض ورغيف عيش بلدي»")); return; }
      setDraft(items);
    } catch (e) {
      if (e && e.message === "slow") { flash && flash(L("Reading the photo took too long — name the food instead (e.g. “2 fried eggs and baladi bread”) and I'll log it at once", "قراية الصورة خدت وقت طويل — اكتب اسم الأكل (مثلاً «٢ بيض مقلي وعيش بلدي») وهسجّلها فورًا")); setPhoto(null); }
      else flash && flash(L("Couldn't read that meal", "مقدرتش أقرا الوجبة"));
    }
    finally { if (run.current === me) { setBusy(false); setStage(""); } }
  };
  // v6.1 photo: a barcode in the picture → the exact product; else the plate read with guesses,
  // then a second look for hidden calories; a nutrition label → its own numbers.
  // v6.10 — a photo read never hangs: each model call has a time limit; when it runs out the call is cancelled and
  // the person is told to name the food (the offline reader takes it from there). Ali: "stayed on Recognising… then crashed".
  // v6.10: one budget (≈60 s from the moment the model is awake) for the whole read, and a fallback chain —
  // full look → quick "name the foods" look → the person's note → name it / search. Names the table
  // doesn't know are matched by the offline reader and the food pack (fitphoto.js).
  const limit = (p, ms) => PH.withLimit(p, ms, abort);
  const giveUp = () => { flash && flash(L("Couldn't recognise the food in time — name it instead (e.g. “2 fried eggs and baladi bread”) or search it below", "مقدرتش أتعرّف على الأكل في الوقت — اكتب اسمه (مثلاً «٢ بيض مقلي وعيش بلدي») أو دوّر عليه تحت")); setPhoto(null); };
  // v6.10 step 0 — the fast look (fitclip.js): no chat model, ≈ a second. Started at once, side by side with the barcode look.
  const fastLook = async () => {
    const clip = await PH.withLimit(CL.loadClip(photoClip ? photoClip.base : CL.CLIP_BASE), 20000);   // the first load reads ≈ 100 MB from the phone's storage
    return CL.decide(clip.bank, await PH.withLimit(CL.classify(clip, photo.url, 5), 8000));
  };
  const useFast = async (fast, me) => {
    let items = fast.items;
    if (items.some((x) => x.unknown)) { items = await PH.resolveItems(items, DB.packSearch, 2000); if (run.current !== me) return; }
    setDraft(items);
  };
  const readPhotoMeal = async (me) => {
    const fastP = clipOn ? fastLook().catch(() => null) : Promise.resolve(null);
    if (scanBarcode) {
      setStage(L("Looking for a barcode…", "بدوّر على باركود…"));
      try { const codes = await PH.withLimit(scanBarcode(photo.data), 8000); if (run.current !== me) return;
        for (const c of codes || []) { const fd = await DB.byBarcode(c, fetchJson); if (fd) { setDraft([{ ...F.itemFromFood(fd, 1, Object.keys(fd.portions || {})[0] || "serving"), base: null }]); return; } }
      } catch (e) {}
    }
    const note = text.trim();
    let fast = null;
    if (clipOn) {
      setStage(L("Recognising the food…", "بتعرّف على الأكل…"));
      fast = await fastP; if (run.current !== me) return;
      if (fast && fast.status === "auto") { await useFast(fast, me); return; }   // sure enough: done, the chat model is not needed
    }
    // not sure (or no fast model): the chat model has a look when it can; the fast guess is kept for when it can't
    if (!modelReady || !canSee) {
      if (fast && fast.status === "guess") { await useFast(fast, me); return; }
      const ni = PH.noteItems(note); if (ni.length) { setDraft(ni); return; }
      if (!modelReady) { flash && flash(L("Couldn't recognise this photo — name the food instead, e.g. “2 fried eggs and baladi bread”", "مقدرتش أتعرّف على الصورة دي — اكتب اسم الأكل، مثلاً «٢ بيض مقلي وعيش بلدي»")); setPhoto(null); return; }
      flash && flash(clipOn || !photoClip ? L("This model can't read photos right now — name the food instead, e.g. “2 fried eggs and baladi bread”", "الموديل ده مش بيقرا صور دلوقتي — اكتب اسم الأكل، مثلاً «٢ بيض مقلي وعيش بلدي»")
        : L("This model can't read photos — get “Fast photo recognition” in My plan, or name the food, e.g. “2 fried eggs and baladi bread”", "الموديل ده مش بيقرا صور — نزّل «التعرّف السريع على صور الأكل» من خطتي، أو اكتب اسم الأكل، مثلاً «٢ بيض مقلي وعيش بلدي»")); setPhoto(null); return;
    }
    const noFood = () => { if (fast && fast.status === "guess") return useFast(fast, me); giveUp(); };   // the chat model found nothing: the fast guess beats "name it"
    if (ready) { setStage(L("Waking the model…", "بصحّي الموديل…")); try { await PH.withLimit(ready(), 90000); } catch (e) {} if (run.current !== me) return; }   // the time limit counts from here, not from the wake-up
    const b = PH.budget();
    setStage(L("Recognising the food…", "بتعرّف على الأكل…"));
    let r = null;
    try { r = F.parsePhoto(await limit(llm(F.photoMessages(note), photo, { json: true, maxTokens: 700, temperature: 0 }), b.slice(42000, 14000))); } catch (e) { r = null; }
    if (run.current !== me) return;
    if (r && r.label) { DB.keepFoods([r.label]); setDraft([F.itemFromFood(r.label, 1, Object.keys(r.label.portions || {})[0] || "g")]); return; }
    let items = r ? r.items : [];
    if (!items.length && b.left() > 6000) {   // the quick look: just the names
      setStage(L("Taking a quick look…", "ببص بصة سريعة…"));
      try { const names = PH.parseNames(await limit(llm(PH.namesMessages(note), photo, { maxTokens: 60, temperature: 0 }), b.slice(20000, 2000))); if (run.current !== me) return; items = await PH.namesToItems(names, DB.packSearch, 3000); } catch (e) {}
      if (run.current !== me) return;
    }
    if (!items.length) { const ni = PH.noteItems(note); if (ni.length) { setDraft(ni); return; } await noFood(); return; }
    if (items.some((x) => x.unknown)) { items = await PH.resolveItems(items, DB.packSearch, 3000); if (run.current !== me) return; }
    setDraft(items);
    // v6.3: a zoomed second look at one food the model wasn't sure of (cropped from the photo, enlarged) — only when time is left
    const unsure = items.map((x, i) => [x, i]).filter(([x]) => x.box && x.conf < 0.6).slice(0, 1);
    for (const [x, i] of unsure) {
      if (b.left() < 20000) break;
      setStage(L(`Looking closer at “${x.said}”…`, `ببص أقرب على «${x.said}»…`));
      try { const crop = await cropPhoto(photo.url, x.box); if (run.current !== me) return;
        const z = F.applyZoom(x, await limit(llm(F.zoomMessages(x), crop, { json: true, maxTokens: 200, temperature: 0 }), b.slice(20000, 8000)));
        if (run.current === me) setDraft((d) => (d || []).map((y, j) => (j === i && y.said === x.said ? z : y)));
      } catch (e) {}
    }
    if (b.left() < 12000) return;
    setStage(L("Checking for hidden calories (oil, sauce, drinks)…", "بدوّر على سعرات مستخبية (زيت، صوص، مشروبات)…"));
    try {
      const more = F.parseHidden(await limit(llm(F.hiddenMessages(items), photo, { json: true, maxTokens: 300, temperature: 0 }), b.slice(25000, 1000)), items);
      const extra = more.length ? await PH.resolveItems(more, DB.packSearch, 2000) : [];
      if (run.current === me && extra.length) setDraft((d) => [...(d || []), ...extra]);
    } catch (e) {}
  };
  // v6.3 voice and "change something" by talking
  const [listening, setListening] = useState("");
  const [cmd, setCmd] = useState("");
  const [cmdNote, setCmdNote] = useState("");
  const speak = async (target) => {
    if (!listen) { flash && flash(L("Voice input works in the Android app", "الكلام شغال في تطبيق أندرويد")); return; }
    if (listening) return;
    setListening(target);
    try {
      const said = await listen(ar ? "ar-EG" : "", (partial) => (target === "cmd" ? setCmd(partial) : setText(partial)));
      if (said) { if (target === "cmd") { setCmd(said); runCmd(said); } else setText(said); }
    } catch (e) { flash && flash(String((e && e.message) || e).slice(0, 100)); }
    finally { setListening(""); }
  };
  const runCmd = (c = cmd) => {
    const r = R.draftCommand(draft || [], c);
    if (!r) { setCmdNote(L("I didn't get that change — try “remove the cola”, “rice 200 g”, “add a spoon of oil”", "مفهمتش التعديل — جرّب «شيل البيبسي»، «الرز ٢٠٠ جرام»، «ضيف معلقة زيت»")); return; }
    setDraft(r.items); setCmdNote(L(r.done.en, r.done.ar)); setCmd("");
  };
  const scaleAt = (i, k) => setDraft((d) => d.map((x, j) => (j === i ? F.scaleItem(x, k) : x)));
  const chooseAt = (i, fd) => setDraft((d) => d.map((x, j) => (j === i ? F.chooseFood(x, fd) : x)));
  // search: the table + foods kept on the phone at once; the big databases on demand
  const searchOnline = async () => {
    const qq = q.trim(); if (!qq) return;
    if (/^\d{8,14}$/.test(qq)) { setSearching(true); try { const fd = await DB.byBarcode(qq, fetchJson); if (fd) { pickFood(fd); } else flash && flash(L("No product with that barcode yet", "مفيش منتج بالباركود ده لسه")); } catch (e) { flash && flash(String(e.message || e)); } finally { setSearching(false); } return; }
    setSearching(true);
    try { const r = await DB.searchAll(qq, fetchJson); setOnline({ q: qq, foods: r.foods }); if (!r.online || (r.errors.length && !r.foods.length)) flash && flash(L("Couldn't reach the food databases — showing what's on the phone", "مقدرتش أوصل لقواعد الأكل — دي اللي على الموبايل")); }
    catch (e) { flash && flash(String(e.message || e)); } finally { setSearching(false); }
  };
  const pickFood = (fd) => {
    DB.keepFoods([fd]);
    const unit = Object.keys(fd.portions || {})[0] || "g";
    const it = F.itemFromFood(fd, unit === "g" ? 100 : 1, unit);
    if (replaceAt >= 0 && draft) { chooseAt(replaceAt, fd); setReplaceAt(-1); }
    else setDraft((d) => [...(d || []), it]);
    setQ(""); setOnline(null);
  };
  const scanCode = async (file) => {
    if (!scanBarcode) return;
    try { const ph = await readPhoto(file); setSearching(true); const codes = await scanBarcode(ph.data);
      if (!codes || !codes.length) { flash && flash(L("No barcode found — hold the phone closer, straight on", "ملقتش باركود — قرّب الموبايل وخليه مستقيم")); return; }
      const fd = await DB.byBarcode(codes[0], fetchJson);
      if (fd) pickFood(fd); else { setQ(codes[0]); flash && flash(L("This product isn't in the databases yet — log it by name", "المنتج ده مش في قواعد البيانات لسه — سجّله بالاسم")); }
    } catch (e) { flash && flash(String(e.message || e)); } finally { setSearching(false); }
  };
  const setGrams = (i, g) => setDraft((d) => d.map((x, k) => {
    if (k !== i) return x;
    const grams = Math.max(0, +g || 0);
    if (x.kcal == null || !x.grams) return { ...x, grams };
    const s = grams / x.grams;
    const q = {}; for (const k of ["sug", "sat", "salt"]) if (x[k] != null) q[k] = Math.round(x[k] * s * 10) / 10;
    return { ...x, ...q, grams, kcal: Math.round(x.kcal * s), p: Math.round(x.p * s * 10) / 10, c: Math.round(x.c * s * 10) / 10, f: Math.round(x.f * s * 10) / 10, fib: Math.round((x.fib || 0) * s * 10) / 10 };
  }));
  const confirm = () => {
    const ok = (draft || []).filter((x) => x.grams > 0);
    if (!ok.length) return;
    // v6.1: what you corrected is remembered for the next photo (the food you chose, your usual portion)
    // v6.4: typed meals too — the words you wrote are remembered with the food you picked and, when you
    // didn't write the amount yourself, your usual portion ("rice" → 300 g brown rice next time)
    for (const x of ok) if (x.said && x.from === "text") {
      const rb = x.readBase || x.base, moved = !x.explicit && rb && Math.abs(x.grams - rb) / rb > 0.1;
      if (!x.chosen && !moved && !x.learned) continue;
      const fd = F.food(x.id) || DB.cachedFood(x.id); if (fd) F.learnFix("t:" + x.said, fd, x.explicit || !rb ? 1 : x.grams / rb);
    } else if (x.said && (x.chosen || (x.base && Math.abs(x.grams - x.base) / x.base > 0.1))) {
      const fd = F.food(x.id) || DB.cachedFood(x.id); if (fd) F.learnFix(x.said, fd, x.base ? x.grams / x.base : 1);
    }
    addItems(adding, ok);
    flash && flash(L(`Added to ${MEAL_NAMES[adding][0].toLowerCase()} — ${ok.reduce((a, x) => a + (x.kcal || 0), 0)} kcal`, `اتضاف لل${MEAL_NAMES[adding][1]} — ${ok.reduce((a, x) => a + (x.kcal || 0), 0)} سعر`));
    setDraft(null); setText(""); setPhoto(null); setQ(""); setAdding(null);
  };
  // the offline food pack answers while you type (when it is installed)
  const [packHits, setPackHits] = useState([]);
  useEffect(() => {
    const qq = q.trim(); if (qq.length < 2) { setPackHits([]); return; }
    let on = true; const t = setTimeout(() => { DB.packSearch(qq, 12).then((h) => on && setPackHits(h)); }, 120);
    return () => { on = false; clearTimeout(t); };
  }, [q, adding]);
  const results = useMemo(() => {
    if (q.trim().length < 2) return [];
    const base = online && online.q === q.trim() ? online.foods : DB.searchOffline(q, 12);
    const seen = new Set(base.map((f) => f.barcode || f.id));
    return [...base, ...packHits.filter((f) => !seen.has(f.barcode || f.id))];
  }, [q, online, packHits]);

  // ---- profile ----
  const [pf, setPf] = useState(st.profile || { sex: "m", age: "", cm: "", kg: "", activity: "light", goal: "lose", rate: 0.5, goalKg: "", diet: "balanced" });
  const [editProfile, setEditProfile] = useState(false);
  useSubBack(editProfile, () => setEditProfile(false));
  const saveProfile = () => {
    const t = F.targets(pf);
    if (!t) { flash && flash(L("Enter your age, height and weight", "اكتب سنك وطولك ووزنك")); return; }
    upd((s) => ({ ...s, profile: { ...pf }, weights: s.weights.length ? s.weights : [{ d: F.today(), kg: +pf.kg }] }));
    setEditProfile(false);
  };

  const Tabs = [["today", L("Today", "النهارده"), Apple], ["recipes", L("Recipes", "وصفات"), Star], ["move", L("Move", "رياضة"), Dumbbell], ["progress", L("Progress", "التقدم"), BarChart3]];

  if (!st.profile || editProfile) return <ProfileForm pf={pf} setPf={setPf} save={saveProfile} L={L} cancel={st.profile ? () => setEditProfile(false) : null} extra={st.profile ? <FitSettings {...{ L, ar, st, upd, native, flash, packText, photoClip }} onClip={setClipOn} /> : null} />;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4" data-testid="fit-app">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 min-w-0"><Apple size={19} className="text-emerald-300 shrink-0" /><span className="truncate">{L("Fit & Food", "الأكل والرياضة")}</span></h2>
        <button onClick={() => setEditProfile(true)} className="text-[12px] text-slate-400 underline shrink-0" data-testid="fit-edit-profile">{L("My plan", "خطتي")}</button>
      </div>
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-900 p-1">
        {Tabs.map(([k, label, Ic]) => (
          <button key={k} onClick={() => setTab(k)} data-testid={"fit-tab-" + k} className={"rounded-lg py-2 text-[12px] flex flex-col items-center gap-0.5 " + (tab === k ? "bg-slate-700 text-white" : "text-slate-400")}><Ic size={16} />{label}</button>
        ))}
      </div>

      {adding ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-3 space-y-3" data-testid="fit-log">
          <div className="flex items-center justify-between">
            <div className="text-white font-medium">{L("Add to", "ضيف لل")}{ar ? "" : " "}
              <select value={adding} onChange={(e) => setAdding(e.target.value)} className="bg-slate-800 rounded px-1 text-white" data-testid="fit-log-meal">
                {F.MEALS.map((m) => <option key={m} value={m}>{L(MEAL_NAMES[m][0], MEAL_NAMES[m][1])}</option>)}
              </select>
            </div>
            <button onClick={() => { setAdding(null); setDraft(null); }} className="text-slate-400"><X size={18} /></button>
          </div>
          {!draft ? (<>
            <QuickLog {...{ L, ar, st, upd, adding, dayKey, flash }} addToDraft={(items) => setDraft((d) => [...(d || []), ...items.map((x) => ({ ...x }))])} />
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} data-testid="fit-log-text"
              placeholder={L("What did you eat? e.g. 2 eggs, a loaf of baladi bread and a plate of ful", "كلت إيه؟ مثلاً ٢ بيض ورغيف عيش وطبق فول")}
              className="w-full rounded-xl bg-slate-800 p-2.5 text-[14px] text-white placeholder:text-slate-500" />
            {photo && <div className="relative w-28"><img src={photo.url} className="rounded-lg w-28 h-28 object-cover" /><button onClick={() => setPhoto(null)} className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"><X size={14} /></button></div>}
            <div className="flex gap-2">
              <button onClick={() => speak("text")} className={"rounded-xl px-3 py-2 text-[13px] flex items-center gap-1.5 shrink-0 " + (listening === "text" ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-200")} data-testid="fit-mic"><Mic size={16} />{listening === "text" ? L("Listening…", "بسمع…") : L("Say it", "قول")}</button>
              <button onClick={() => fileRef.current && fileRef.current.click()} className="rounded-xl bg-slate-800 px-3 py-2 text-[13px] text-slate-200 flex items-center gap-1.5 shrink-0" data-testid="fit-photo"><Camera size={16} />{L("Photo", "صورة")}</button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" data-testid="fit-photo-input" onChange={async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) { try { setPhoto(await readPhoto(f)); } catch (x) { flash && flash(L("Couldn't open that picture", "مقدرتش أفتح الصورة")); } } }} />
              <button onClick={readMeal} disabled={busy || (!text.trim() && !photo)} className="flex-1 rounded-xl bg-emerald-600 disabled:opacity-40 py-2 text-[14px] font-medium text-white flex items-center justify-center gap-1.5" data-testid="fit-read">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}{busy ? stage || L("Reading…", "بقرا…") : L("Read it", "اقرا")}
              </button>
            </div>
            <div className="relative">
              <Search size={15} className="absolute top-2.5 start-2.5 text-slate-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") searchOnline(); }} data-testid="fit-search" placeholder={L("Or search foods, brands or a barcode…", "أو دوّر على أكلة أو ماركة أو باركود…")} className="w-full rounded-xl bg-slate-800 py-2 ps-8 pe-2 text-[14px] text-white placeholder:text-slate-500" />
            </div>
            <div className="flex gap-2">
              {fetchJson && q.trim().length >= 2 ? <button onClick={searchOnline} disabled={searching} className="flex-1 rounded-lg bg-sky-700 py-1.5 text-[12.5px] text-white flex items-center justify-center gap-1" data-testid="fit-search-online">{searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}{L("Search millions of foods", "دوّر في ملايين الأكلات")}</button> : null}
              {scanBarcode ? <button onClick={() => codeRef.current && codeRef.current.click()} disabled={searching} className="flex-1 rounded-lg bg-slate-800 py-1.5 text-[12.5px] text-slate-200 flex items-center justify-center gap-1" data-testid="fit-barcode"><Camera size={14} />{L("Scan a barcode", "صوّر الباركود")}</button> : null}
              <input ref={codeRef} type="file" accept="image/*" capture="environment" className="hidden" data-testid="fit-barcode-input" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) scanCode(f); }} />
            </div>
            {results.map((fd) => (
              <button key={fd.id} onClick={() => pickFood(fd)} className="w-full flex justify-between gap-2 text-start rounded-lg px-2 py-1.5 hover:bg-slate-800" data-testid={"fit-food-" + fd.id}>
                <span className="text-[13.5px] text-slate-200 truncate">{ar && fd.ar ? fd.ar : fd.en}{fd.src === "off" ? <span className="ms-1 text-[10px] text-sky-300">{fd.egypt ? "🇪🇬 " : ""}{L("product", "منتج")}</span> : fd.src === "usda" ? <span className="ms-1 text-[10px] text-violet-300">USDA</span> : null}{fd.check ? <span className="ms-1 text-[10px] text-amber-300">{L("label may be wrong", "الملصق ممكن يكون غلط")}</span> : null}<Grades x={fd} L={L} /></span><span className="text-[12px] text-slate-500 shrink-0 tabular-nums">{fd.kcal} kcal/100g</span>
              </button>
            ))}
          </>) : (
            <div className="space-y-2" data-testid="fit-draft">
              <div className="text-[12.5px] text-slate-400">{L("Check the amounts — change the grams if needed, then save.", "راجع الكميات — غيّر الجرامات لو محتاج، وبعدين احفظ.")}</div>
              {busy && stage ? <div className="text-[12px] text-sky-300 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" />{stage}</div> : null}
              {draft.map((x, i) => (
                <div key={i} className="rounded-lg bg-slate-800/70 px-2 py-1.5 space-y-1.5" data-testid="fit-draft-item">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] text-white truncate">
                        {x.conf != null ? <span className={"inline-block w-2 h-2 rounded-full me-1.5 " + (x.conf >= 0.75 ? "bg-emerald-400" : x.conf >= 0.5 ? "bg-amber-400" : "bg-rose-400")} title={L("how sure", "متأكد قد إيه")} /> : null}
                        {ar && x.ar ? x.ar : x.name}
                        {x.hidden ? <span className="ms-1 text-[10.5px] text-sky-300" data-testid="fit-hidden">{L("easy to miss", "سهل يتنسي")}</span> : null}
                        {x.learned ? <span className="ms-1 text-[10.5px] text-violet-300">{L("as you corrected it", "زي ما صححته")}</span> : null}
                        {x.flag ? <span className="ms-1 text-[10.5px] text-amber-300" data-testid="fit-flag">{x.flag === "amount" ? L(`check the amount (${x.was} g written)`, `راجع الكمية (اتكتب ${x.was} جم)`) : L("check the portion", "راجع الكمية")}</span> : null}
                        {x.zoomed ? <span className="ms-1 text-[10.5px] text-sky-300">{L("looked closer", "اتبص عليها أقرب")}</span> : null}
                        {x.estimate && <span className="ms-1 text-[10.5px] text-amber-300">{x.unknown ? L("unknown", "مش معروف") : L("estimate", "تقدير")}</span>}
                        {x.check ? <span className="ms-1 text-[10.5px] text-amber-300">{L("label may be wrong", "الملصق ممكن يكون غلط")}</span> : null}
                        <Grades x={x} L={L} />
                      </div>
                      <div className="text-[11.5px] text-slate-400 tabular-nums">{r0(x.kcal)} kcal · P {r0(x.p)} · C {r0(x.c)} · F {r0(x.f)}</div>
                    </div>
                    <input type="number" inputMode="numeric" value={x.grams} onChange={(e) => setGrams(i, e.target.value)} className="w-16 rounded bg-slate-900 px-1.5 py-1 text-[13px] text-white text-end" data-testid="fit-draft-grams" />
                    <span className="text-[11px] text-slate-500">g</span>
                    {x.id ? <button onClick={() => { const on = P.isFav(st.favFoods, x.id); upd((s) => ({ ...s, favFoods: P.toggleFav(s.favFoods, x) })); flash && flash(on ? L("Removed from favorites", "اتشالت من المفضلة") : L(`★ ${x.name} — ${x.grams} g, one tap next time`, `★ ${x.ar || x.name} — ${x.grams} جم، ضغطة واحدة المرة الجاية`)); }}
                      className={P.isFav(st.favFoods, x.id) ? "text-amber-300" : "text-slate-500"} data-testid="fit-fav-toggle" aria-label={L("Favorite", "مفضلة")}><Star size={15} fill={P.isFav(st.favFoods, x.id) ? "currentColor" : "none"} /></button> : null}
                    <button onClick={() => setDraft((d) => d.filter((_, k) => k !== i))} className="text-slate-500"><Trash2 size={15} /></button>
                  </div>
                  {(x.alts && x.alts.length > 1) || x.from === "text" ? (
                    <div className="flex flex-wrap gap-1" data-testid="fit-alts">
                      <span className="text-[11px] text-slate-500 self-center">{L("Is it:", "هل هي:")}</span>
                      {(x.alts || []).map((a, k) => a.food ? <button key={k} onClick={() => chooseAt(i, a.food)} className={"rounded-full px-2 py-0.5 text-[11.5px] " + (a.food.id === x.id ? "bg-emerald-700 text-white" : "bg-slate-900 text-slate-300")} data-testid="fit-alt">{ar && a.food.ar ? a.food.ar : a.food.en}</button> : null)}
                      <button onClick={() => { setReplaceAt(i); setDraft((d) => d); }} className="rounded-full px-2 py-0.5 text-[11.5px] bg-slate-900 text-sky-300" data-testid="fit-alt-other">{L("something else…", "حاجة تانية…")}</button>
                    </div>) : null}
                  {x.base ? (
                    <div className="flex flex-wrap gap-1" data-testid="fit-portions">
                      {[0.5, 0.75, 1, 1.5, 2].map((k) => <button key={k} onClick={() => scaleAt(i, k)} className={"rounded px-2 py-0.5 text-[11.5px] " + ((x.k || 1) === k ? "bg-sky-700 text-white" : "bg-slate-900 text-slate-300")} data-testid={"fit-portion-" + k}>{k === 1 ? (x.from === "text" ? L("as written", "زي ما كتبت") : L("as seen", "زي الصورة")) : "×" + k}</button>)}
                    </div>) : null}
                </div>
              ))}
              {replaceAt >= 0 ? (
                <div className="space-y-1" data-testid="fit-replace">
                  <div className="relative"><Search size={15} className="absolute top-2.5 start-2.5 text-slate-500" />
                    <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") searchOnline(); }} placeholder={L("What is it really?", "هي إيه بالظبط؟")} className="w-full rounded-xl bg-slate-900 py-2 ps-8 pe-2 text-[14px] text-white placeholder:text-slate-500" data-testid="fit-replace-q" /></div>
                  {results.map((fd) => <button key={fd.id} onClick={() => pickFood(fd)} className="w-full flex justify-between gap-2 text-start rounded-lg px-2 py-1.5 hover:bg-slate-800" data-testid={"fit-food-" + fd.id}><span className="text-[13px] text-slate-200 truncate">{ar && fd.ar ? fd.ar : fd.en}</span><span className="text-[11.5px] text-slate-500 shrink-0">{fd.kcal} kcal/100g</span></button>)}
                </div>) : null}
              <div className="flex gap-2" data-testid="fit-cmd-row">
                <input value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && cmd.trim()) runCmd(); }} placeholder={L("Change something: “remove the cola”, “rice 200 g”…", "عدّل: «شيل البيبسي»، «الرز ٢٠٠ جرام»…")}
                  className="flex-1 min-w-0 rounded-lg bg-slate-900 px-2 py-1.5 text-[13px] text-white placeholder:text-slate-500" data-testid="fit-cmd" />
                <button onClick={() => speak("cmd")} className={"rounded-lg px-2.5 " + (listening === "cmd" ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-300")} data-testid="fit-cmd-mic"><Mic size={15} /></button>
                <button onClick={() => cmd.trim() && runCmd()} className="rounded-lg bg-sky-700 px-3 text-[12.5px] text-white" data-testid="fit-cmd-go">{L("Do it", "نفّذ")}</button>
              </div>
              {cmdNote ? <div className="text-[12px] text-sky-300" data-testid="fit-cmd-note">{cmdNote}</div> : null}
              {draft.length ? <SaveMyMeal {...{ L, draft, upd, flash }} /> : null}
              <div className="flex gap-2">
                <button onClick={() => setDraft(null)} className="rounded-xl bg-slate-800 px-3 py-2 text-[13px] text-slate-300">{L("Back", "رجوع")}</button>
                <button onClick={confirm} disabled={!draft.length} className="flex-1 rounded-xl bg-emerald-600 disabled:opacity-40 py-2 text-[14px] font-medium text-white flex items-center justify-center gap-1.5" data-testid="fit-confirm"><Check size={16} />{L("Save", "احفظ")} · {F.sumN(draft.filter((x) => x.kcal != null)).kcal} kcal</button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {tab === "today" && !adding && <Today {...{ L, ar, st, upd, tg, tot, day, dayKey, setDayKey, setDay, setAdding, addItems, flash, health }} />}
      {tab === "recipes" && !adding && <Recipes {...{ L, ar, st, upd, tg, addItems, llm, modelReady, openEngine, flash, share, pro, openPlan }} />}
      {tab === "move" && !adding && <><WatchCard {...{ L, ar, health, st, upd, dayKey }} /><Move {...{ L, ar, tg, setDay, llm, modelReady, openEngine, flash, kg: +st.profile.kg }} /></>}
      {tab === "progress" && !adding && <Progress {...{ L, ar, st, upd, tg, pro, openPlan }} />}
    </div>
  );
}

function ProfileForm({ pf, setPf, save, L, cancel, extra }) {
  const set = (k, v) => setPf((p) => ({ ...p, [k]: v }));
  const tg = F.targets(pf);
  const Sel = (k, opts) => (
    <div className="flex flex-wrap gap-1.5">{opts.map(([v, label]) => <button key={v} onClick={() => set(k, v)} data-testid={`fit-pf-${k}-${v}`} className={"rounded-full px-3 py-1.5 text-[12.5px] " + (pf[k] === v ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300")}>{label}</button>)}</div>
  );
  const Num = (k, label) => (
    <label key={k} className="flex-1 min-w-0 text-[12px] text-slate-400">{label}
      <input type="number" inputMode="decimal" value={pf[k]} onChange={(e) => set(k, e.target.value)} data-testid={"fit-pf-" + k} className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-[14px] text-white" />
    </label>
  );
  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4" data-testid="fit-profile">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Apple size={19} className="text-emerald-300" />{L("Your plan", "خطتك")}</h2>
      <p className="text-[12.5px] text-slate-400">{L("Your daily calories and protein are worked out by the Mifflin-St Jeor formula — the one dietitians use. Everything stays on your phone.", "السعرات والبروتين بيتحسبوا بمعادلة ميفلين-سان جيور — اللي أخصائيين التغذية بيستخدموها. كل حاجة بتفضل على موبايلك.")}</p>
      {Sel("sex", [["m", L("Male", "ذكر")], ["f", L("Female", "أنثى")]])}
      <div className="flex gap-2">{Num("age", L("Age", "السن"))}{Num("cm", L("Height (cm)", "الطول (سم)"))}{Num("kg", L("Weight (kg)", "الوزن (كجم)"))}</div>
      <div className="text-[12px] text-slate-400">{L("How active are you?", "نشاطك قد إيه؟")}</div>
      {Sel("activity", [["sedentary", L("Desk, little walking", "مكتب، مشي قليل")], ["light", L("Light", "خفيف")], ["moderate", L("Moderate", "متوسط")], ["active", L("Active", "نشيط")], ["very", L("Very active", "نشيط جداً")]])}
      <div className="text-[12px] text-slate-400">{L("Goal", "الهدف")}</div>
      {Sel("goal", [["lose", L("Lose weight", "أخس")], ["maintain", L("Keep my weight", "أثبت وزني")], ["gain", L("Gain muscle", "أزوّد عضل")]])}
      {pf.goal !== "maintain" && <div className="flex gap-2">{Num("goalKg", L("Goal weight (kg)", "الوزن المطلوب (كجم)"))}
        <label className="flex-1 text-[12px] text-slate-400">{L("Pace (kg a week)", "السرعة (كجم في الأسبوع)")}
          <select value={pf.rate} onChange={(e) => set("rate", +e.target.value)} className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-[14px] text-white">{[0.25, 0.5, 0.75, 1].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        </label></div>}
      <div className="text-[12px] text-slate-400">{L("Eating style", "نظام الأكل")}</div>
      {Sel("diet", Object.entries(F.DIETS).map(([k, en]) => [k, L(en, { balanced: "متوازن", "high-protein": "بروتين عالي", "low-carb": "كارب قليل", keto: "كيتو", vegetarian: "نباتي" }[k])]))}
      {pf.sex === "f" && <label className="flex items-center gap-2 text-[13px] text-slate-300"><input type="checkbox" checked={!!pf.pregnant} onChange={(e) => set("pregnant", e.target.checked)} />{L("Pregnant or breastfeeding", "حامل أو بترضعي")}</label>}
      {tg && (
        <div className="rounded-xl border border-emerald-800 bg-emerald-500/10 p-3 text-[13px] text-emerald-100 space-y-1" data-testid="fit-pf-result">
          <div className="text-[15px] font-semibold">{tg.kcal} kcal · {L("protein", "بروتين")} {tg.protein} g · {L("water", "مية")} {(tg.water / 1000).toFixed(1)} L</div>
          <div className="text-emerald-200/80">BMI {tg.bmi} · {L("burns", "بتحرق")} ~{tg.tdee} kcal/{L("day", "يوم")}{tg.weeks ? ` · ${L("goal in", "الهدف خلال")} ~${tg.weeks} ${L("weeks", "أسبوع")}` : ""}</div>
          {tg.notes.map((n, i) => <div key={i} className="text-amber-200">• {L(n.en, n.ar)}</div>)}
        </div>
      )}
      {extra}
      <div className="flex gap-2">
        {cancel && <button onClick={cancel} className="rounded-xl bg-slate-800 px-4 py-2.5 text-slate-300">{L("Cancel", "إلغاء")}</button>}
        <button onClick={save} className="flex-1 rounded-xl bg-emerald-600 py-2.5 font-medium text-white" data-testid="fit-pf-save">{L("Save my plan", "احفظ خطتي")}</button>
      </div>
    </div>
  );
}

function Today({ L, ar, st, upd, tg, tot, day, dayKey, setDayKey, setDay, setAdding, addItems, flash, health }) {
  const left = tg.kcal - tot.kcal + tot.burned;
  const shift = (n) => { const d = new Date(dayKey + "T12:00:00"); d.setDate(d.getDate() + n); const k = F.today(d); if (k <= F.today()) setDayKey(k); };
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!st.fast) return; const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, [st.fast]);
  const fs = F.fastState(st.fast, now);
  const country = F.getCountry();
  const plan = useMemo(() => F.mealPlan(tg, { diet: st.profile.diet, seed: Math.floor(Date.parse(dayKey) / 864e5), country }), [tg, dayKey, st.profile.diet, country]);
  const tips = F.dayTips(tot, tg, ar ? "ar" : "en");
  const hm = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"); };
  return (
    <div className="space-y-4" data-testid="fit-today">
      <div className="flex items-center justify-center gap-3 text-[13px] text-slate-300">
        <button onClick={() => shift(-1)} className="p-1"><ChevronLeft size={16} className="rtl:rotate-180" /></button>
        <span data-testid="fit-day">{dayKey === F.today() ? L("Today", "النهارده") : dayKey}</span>
        <button onClick={() => shift(1)} className="p-1" disabled={dayKey === F.today()}><ChevronLeft size={16} className="rotate-180 rtl:rotate-0" /></button>
      </div>
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4 flex items-center gap-4">
        <Ring value={tot.kcal} max={tg.kcal + tot.burned}>
          <div className={"text-2xl font-bold tabular-nums " + (left < 0 ? "text-rose-300" : "text-white")} data-testid="fit-left">{Math.abs(left)}</div>
          <div className="text-[11px] text-slate-400">{left < 0 ? L("kcal over", "سعر زيادة") : L("kcal left", "سعر فاضل")}</div>
        </Ring>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="text-[12px] text-slate-400 tabular-nums">{L("Eaten", "أكلت")} <b className="text-white" data-testid="fit-eaten">{tot.kcal}</b> · {L("Burned", "حرقت")} <b className="text-white">{tot.burned}</b> · {L("Goal", "الهدف")} {tg.kcal}</div>
          <Bar label={L("Protein", "بروتين")} v={tot.p} max={tg.protein} cls="bg-sky-400" />
          <Bar label={L("Carbs", "كارب")} v={tot.c} max={tg.carbs} cls="bg-amber-400" />
          <Bar label={L("Fat", "دهون")} v={tot.f} max={tg.fat} cls="bg-rose-400" />
          <Bar label={L("Fibre", "ألياف")} v={tot.fib} max={tg.fibre} cls="bg-emerald-400" />
        </div>
      </div>
      {st.ramadan && st.ramadan.on && dayKey === F.today() ? <RamadanCard {...{ L, ar, tg, city: st.ramadan.city }} /> : null}
      <DayQuality {...{ L, day, tg }} isToday={dayKey === F.today()} />
      <WatchCard {...{ L, ar, health, st, upd, dayKey }} compact />
      {tips.map((t, i) => <div key={i} className="rounded-xl bg-amber-500/10 border border-amber-800 px-3 py-2 text-[12.5px] text-amber-100">{t}</div>)}

      {F.MEALS.map((m) => {
        const items = (day.meals || {})[m] || [];
        const sum = F.sumN(items.filter((x) => x.kcal != null));
        return (
          <div key={m} className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3" data-testid={"fit-meal-" + m}>
            <div className="flex items-center justify-between">
              <div className="text-white font-medium">{L(MEAL_NAMES[m][0], MEAL_NAMES[m][1])} <span className="text-[12px] text-slate-400 tabular-nums">{sum.kcal} kcal</span></div>
              <button onClick={() => setAdding(m)} className="rounded-full bg-emerald-600 p-1.5 text-white" data-testid={"fit-add-" + m}><Plus size={16} /></button>
            </div>
            {items.map((x, i) => (
              <div key={i} className="flex items-center justify-between gap-2 mt-1.5 text-[13px]">
                <span className="text-slate-300 truncate">{ar && x.ar ? x.ar : x.name} <span className="text-slate-500">{x.grams} g</span></span>
                <span className="flex items-center gap-2 shrink-0"><span className="text-slate-400 tabular-nums">{r0(x.kcal)}</span>
                  <button onClick={() => setDay((d) => ({ ...d, meals: { ...d.meals, [m]: d.meals[m].filter((_, k) => k !== i) } }))} className="text-slate-600"><Trash2 size={14} /></button></span>
              </div>
            ))}
            {!items.length && plan && plan.meals[m] && dayKey === F.today() && (
              <button onClick={() => { const pm = plan.meals[m]; addItems(m, [{ name: pm.recipe.en, ar: pm.recipe.ar, grams: Math.round(F.recipeNutrients(pm.recipe).grams * pm.x), kcal: pm.kcal, p: pm.p, c: pm.c, f: pm.f, fib: 0, recipe: pm.recipe.id }]); flash && flash(L("Logged", "اتسجل")); }}
                className="mt-2 w-full text-start rounded-lg bg-slate-800/60 px-2.5 py-2 text-[12.5px] text-slate-300" data-testid={"fit-suggest-" + m}>
                <span className="text-emerald-300">{L("Suggested", "مقترح")}:</span> {ar ? plan.meals[m].recipe.ar : plan.meals[m].recipe.en}{plan.meals[m].x !== 1 ? ` ×${plan.meals[m].x}` : ""} · {plan.meals[m].kcal} kcal — <u>{L("I ate this", "أكلت ده")}</u>
              </button>
            )}
          </div>
        );
      })}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3" data-testid="fit-water">
          <div className="text-[13px] text-white flex items-center gap-1.5"><Droplet size={15} className="text-sky-300" />{L("Water", "مية")}</div>
          <div className="text-xl font-semibold text-white tabular-nums mt-1">{(tot.water / 1000).toFixed(2)} <span className="text-[12px] text-slate-400">/ {(tg.water / 1000).toFixed(1)} L</span></div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => setDay((d) => ({ ...d, water: Math.max(0, (d.water || 0) - 250) }))} className="flex-1 rounded-lg bg-slate-800 py-1.5 text-slate-300">−</button>
            <button onClick={() => setDay((d) => ({ ...d, water: (d.water || 0) + 250 }))} className="flex-1 rounded-lg bg-sky-600 py-1.5 text-white" data-testid="fit-water-add">+ {L("glass", "كوباية")}</button>
          </div>
        </div>
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3" data-testid="fit-fast">
          <div className="text-[13px] text-white flex items-center gap-1.5"><Timer size={15} className="text-violet-300" />{L("Fasting", "صيام")}</div>
          {fs ? (<>
            <div className={"text-xl font-semibold tabular-nums mt-1 " + (fs.reached ? "text-emerald-300" : "text-white")}>{hm(fs.done)} <span className="text-[12px] text-slate-400">/ {st.fast.hours}h</span></div>
            <div className="h-1.5 rounded-full bg-slate-800 mt-1"><div className="h-1.5 rounded-full bg-violet-400" style={{ width: fs.pct + "%" }} /></div>
            <button onClick={() => upd((s) => ({ ...s, fast: null }))} className="mt-2 w-full rounded-lg bg-slate-800 py-1.5 text-[12.5px] text-slate-200">{L("End fast", "اكسر الصيام")}</button>
          </>) : (
            <div className="flex flex-wrap gap-1 mt-2">{Object.entries(F.FASTS).map(([k, h]) => <button key={k} onClick={() => upd((s) => ({ ...s, fast: { start: Date.now(), hours: h } }))} className="rounded-lg bg-slate-800 px-2 py-1 text-[12px] text-slate-200" data-testid={"fit-fast-" + h}>{k}</button>)}</div>
          )}
        </div>
      </div>
    </div>
  );
}

const TAGS = [["all", "All", "الكل"], ["egyptian", "Egyptian", "مصري"], ["breakfast", "Breakfast", "فطار"], ["lunch", "Lunch", "غدا"], ["dinner", "Dinner", "عشا"], ["snack", "Snack", "سناك"], ["high-protein", "High protein", "بروتين عالي"], ["low-carb", "Low carb", "كارب قليل"], ["vegetarian", "Vegetarian", "نباتي"], ["fav", "★", "★"]];
function Recipes({ L, ar, st, upd, tg, addItems, llm, modelReady, openEngine, flash, share, pro = true, openPlan }) {
  const [q, setQ] = useSticky("fit:rq", "");
  const [tag, setTag] = useSticky("fit:rtag", "all");
  const [open, setOpen] = useState(null);
  useSubBack(!!open, () => setOpen(null));
  const [week, setWeek] = useState(false);
  useSubBack(week, () => setWeek(false));
  const [have, setHave] = useState("");
  const [busy, setBusy] = useState(false);
  // v6.10: the chosen country's dishes first; its tag replaces «Egyptian» when the country isn't Egypt
  const cc = F.getCountry();
  const all = [...st.myRecipes, ...(cc !== "eg" ? F.countryRecipes(cc) : []), ...F.RECIPES];
  const tags = cc === "eg" ? TAGS : TAGS.map((t) => (t[0] === "egyptian" ? ["c-" + cc, F.countryName(cc, false), F.countryName(cc, true)] : t));
  useEffect(() => { if (tag !== "all" && tag !== "fav" && !tags.some((t) => t[0] === tag)) setTag("all"); }, [cc]);   // another country's tag left over
  const nq = q.trim().toLowerCase();
  const curated = all.filter((rc) => (tag === "all" || (tag === "fav" ? st.favs.includes(rc.id) : rc.tags.includes(tag))) &&
    (!nq || (rc.en + " " + rc.ar + " " + (rc.local || "")).toLowerCase().includes(nq) || rc.items.some(([id]) => { const fd = F.food(id); return fd && fd.names.some((n) => n.toLowerCase().includes(nq)); })));
  // the 25,000-dish recipe book: built on demand; with nothing typed it shows a varied dozen as ideas
  const generated = useMemo(() => {
    if (tag === "fav") return st.favs.filter((id) => /^g\d-\d+$/.test(id)).map(getGenerated).filter(Boolean);
    return searchGenerated(nq, { tag, n: nq ? 40 : 12, ingredientNames: (id) => { const fd = F.food(id); return fd ? fd.names : []; } });
  }, [nq, tag, st.favs]);
  const list = [...curated, ...generated];
  const invent = async () => {
    if (!modelReady) { openEngine && openEngine(); return; }
    setBusy(true);
    try {
      const rc = F.parseRecipe(await llm(F.recipeMessages(have.trim(), "", ar ? "ar" : "en", tg ? Math.round(tg.kcal * 0.33) : 0), null, { json: true, maxTokens: 800, temperature: 0.5 }));
      if (!rc) { flash && flash(L("Couldn't make a recipe from that — try listing a few ingredients", "مقدرتش أعمل وصفة — اكتب كام مكوّن")); return; }
      upd((s) => ({ ...s, myRecipes: [rc, ...s.myRecipes].slice(0, 40) }));
      setOpen(rc); setHave("");
    } catch (e) { flash && flash(L("Couldn't make a recipe", "مقدرتش أعمل وصفة")); }
    finally { setBusy(false); }
  };
  if (open) {
    const n = F.recipeNutrients(open);
    const fav = st.favs.includes(open.id);
    return (
      <div className="space-y-3" data-testid="fit-recipe">
        <button onClick={() => setOpen(null)} className="text-[13px] text-slate-400 flex items-center gap-1"><ChevronLeft size={15} className="rtl:rotate-180" />{L("Recipes", "الوصفات")}</button>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-white font-semibold text-[16px]">{ar && open.ar ? open.ar : open.en}</h3>
          <button onClick={() => upd((s) => ({ ...s, favs: fav ? s.favs.filter((x) => x !== open.id) : [...s.favs, open.id] }))} className={fav ? "text-amber-300" : "text-slate-500"}><Star size={18} /></button>
        </div>
        <div className="text-[12.5px] text-slate-400">{open.mins ? <>{open.mins} {L("min", "دقيقة")} · </> : null}{open.dish ? <>{L("one serving", "حصة واحدة")} · </> : <>{L("serves", "يكفي")} {open.serves} · </>} <b className="text-white">{n.kcal} kcal</b> {L("a serving", "للفرد")} · P {n.p} · C {n.c} · F {n.f}</div>
        <div className="rounded-xl bg-slate-900/60 p-3 space-y-1">
          {open.items.map(([id, g], i) => { const fd = F.food(id); return <div key={i} className="flex justify-between text-[13px]"><span className="text-slate-200">{fd ? (ar ? fd.ar : fd.en) : id}</span><span className="text-slate-400 tabular-nums">{g} g</span></div>; })}
          {(open.unknown || []).map((u, i) => <div key={"u" + i} className="flex justify-between text-[13px]"><span className="text-amber-200">{u.name}</span><span className="text-slate-500">{u.grams} g · {L("not counted", "مش محسوب")}</span></div>)}
        </div>
        <ol className="list-decimal ps-5 space-y-1 text-[13.5px] text-slate-200">{open.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        <button onClick={() => { addItems(mealNow(), [{ name: open.en, ar: open.ar, grams: n.grams, kcal: n.kcal, p: n.p, c: n.c, f: n.f, fib: n.fib, recipe: open.id }]); flash && flash(L("Logged one serving", "اتسجلت حصة")); }}
          className="w-full rounded-xl bg-emerald-600 py-2.5 font-medium text-white" data-testid="fit-recipe-log">{L("I ate one serving", "أكلت حصة")}</button>
      </div>
    );
  }
  if (week) return <WeekPlanView {...{ L, ar, tg, diet: st.profile.diet, share }} close={() => setWeek(false)} />;
  return (
    <div className="space-y-3" data-testid="fit-recipes">
      <button onClick={() => (pro ? setWeek(true) : openPlan && openPlan())} className="w-full rounded-xl bg-emerald-700 py-2.5 text-[13.5px] font-medium text-white" data-testid="fit-week-open">📅 {L("Plan my week + shopping list", "خطط أسبوعي + قايمة المشتريات")}{pro ? "" : " · Pro"}</button>
      <div className="relative"><Search size={15} className="absolute top-2.5 start-2.5 text-slate-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} data-testid="fit-recipe-search" placeholder={L(`Search ${(all.length + GENERATED_COUNT).toLocaleString()} recipes or an ingredient…`, `دوّر في ${(all.length + GENERATED_COUNT).toLocaleString("en")} وصفة أو مكوّن…`)} className="w-full rounded-xl bg-slate-800 py-2 ps-8 pe-2 text-[14px] text-white placeholder:text-slate-500" /></div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">{tags.map(([k, en, a]) => <button key={k} onClick={() => setTag(k)} className={"shrink-0 rounded-full px-3 py-1 text-[12px] " + (tag === k ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300")}>{L(en, a)}</button>)}</div>
      <div className="rounded-xl border border-slate-800 p-2.5 flex gap-2">
        <input value={have} onChange={(e) => setHave(e.target.value)} placeholder={L("What's in your fridge? AI makes a recipe", "عندك إيه في التلاجة؟ الذكاء يعمل وصفة")} className="flex-1 min-w-0 bg-transparent text-[13px] text-white placeholder:text-slate-500" data-testid="fit-invent-text" />
        <button onClick={invent} disabled={busy} className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-[12.5px] text-white flex items-center gap-1" data-testid="fit-invent">{busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}{L("Create", "اعمل")}</button>
      </div>
      {list.map((rc) => { const n = F.recipeNutrients(rc); return (
        <button key={rc.id} onClick={() => setOpen(rc)} className="w-full text-start rounded-xl bg-slate-900/60 border border-slate-800 px-3 py-2.5" data-testid={"fit-rc-" + rc.id}>
          <div className="text-[14px] text-white">{ar && rc.ar ? rc.ar : rc.en}</div>
          <div className="text-[12px] text-slate-400 tabular-nums">{n.kcal} kcal · P {n.p} g{rc.mins ? <> · {rc.mins} {L("min", "دقيقة")}</> : <> · {n.grams} g</>}</div>
        </button>); })}
      {!list.length && <div className="text-center text-[13px] text-slate-500 py-6">{L("No recipe matches", "مفيش وصفة مطابقة")}</div>}
    </div>
  );
}

function Move({ L, ar, tg, setDay, llm, modelReady, openEngine, flash, kg }) {
  const [what, setWhat] = useState("");
  const [mins, setMins] = useState(30);
  const [sess, setSess] = useState(null);     // {plan, i, left (s), running}
  useSubBack(!!sess, () => setSess(null));
  const [aiPlan, setAiPlan] = useSticky("fit:aiplan", null);
  const [busy, setBusy] = useState(false);
  const ex = F.matchExercise(what);
  const logIt = (name, minutes, kcal) => { setDay((d) => ({ ...d, workouts: [...(d.workouts || []), { name, min: minutes, kcal, t: Date.now() }] })); flash && flash(L(`Logged — ${kcal} kcal burned`, `اتسجل — حرقت ${kcal} سعر`)); };
  useEffect(() => {
    if (!sess || !sess.running) return;
    const t = setInterval(() => setSess((s) => {
      if (!s || !s.running) return s;
      if (s.left > 1) return { ...s, left: s.left - 1 };
      return next(s);
    }), 1000);
    return () => clearInterval(t);
  }, [sess && sess.running]);
  // the last step done → the workout is logged once (outside the timer's state update)
  useEffect(() => { if (sess && sess.finished) { const c = F.planCost(sess.plan.workout, kg); logIt(ar ? sess.plan.ar : sess.plan.en, c.minutes, c.kcal); setSess(null); } }, [sess && sess.finished]);
  const steps = (plan) => plan.workout.flatMap(([id, sets, reps, rest]) => Array.from({ length: sets }, (_, k) => [{ id, reps, set: k + 1, sets }, rest ? { rest } : null]).flat().filter(Boolean));
  const secsOf = (st) => (st.rest ? st.rest : typeof st.reps === "string" ? (/m$/.test(st.reps) ? parseFloat(st.reps) * 60 : parseFloat(st.reps)) : 0);
  function next(s) {
    const i = s.i + 1;
    if (i >= s.steps.length) return { ...s, finished: true, running: false };
    const sec = secsOf(s.steps[i]);
    return { ...s, i, left: sec, running: sec > 0 };
  }
  if (sess && !sess.finished) {
    const cur = sess.steps[sess.i], e = cur.id ? F.exercise(cur.id) : null;
    return (
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 text-center space-y-3" data-testid="fit-session">
        <div className="text-[12px] text-slate-400">{sess.i + 1} / {sess.steps.length}</div>
        <div className="text-2xl font-semibold text-white">{cur.rest ? L("Rest", "راحة") : e ? (ar ? e.ar : e.en) : cur.id}</div>
        {!cur.rest && <div className="text-slate-300">{L("Set", "مجموعة")} {cur.set}/{cur.sets} · {typeof cur.reps === "number" ? `${cur.reps} ${L("reps", "عدّة")}` : cur.reps}</div>}
        {e && !cur.rest && e.how && <div className="text-[12.5px] text-slate-400">{e.how}</div>}
        {sess.left > 0 && <div className="text-5xl font-bold tabular-nums text-emerald-300">{Math.floor(sess.left / 60)}:{String(sess.left % 60).padStart(2, "0")}</div>}
        <div className="flex gap-2">
          <button onClick={() => setSess(null)} className="rounded-xl bg-slate-800 px-4 py-2.5 text-slate-300"><Square size={16} /></button>
          <button onClick={() => setSess((s) => next(s))} className="flex-1 rounded-xl bg-emerald-600 py-2.5 font-medium text-white" data-testid="fit-session-next">{sess.left > 0 ? L("Skip", "تخطّي") : L("Done — next", "خلصت — اللي بعده")}</button>
        </div>
      </div>
    );
  }
  const planList = aiPlan ? [...F.PLANS, ...aiPlan.days.map((d, i) => ({ id: "ai-" + i, en: aiPlan.name + " — " + d.name, ar: aiPlan.name + " — " + d.name, workout: d.exercises.map((x) => [x.id || x.name, x.sets, x.reps, x.rest]) }))] : F.PLANS;
  return (
    <div className="space-y-3" data-testid="fit-move">
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3 space-y-2">
        <div className="text-[13px] text-white">{L("Log an activity", "سجّل نشاط")}</div>
        <div className="flex gap-2">
          <input value={what} onChange={(e) => setWhat(e.target.value)} placeholder={L("walking, football, swimming…", "مشي، كورة، سباحة…")} className="flex-1 min-w-0 rounded-lg bg-slate-800 px-2 py-2 text-[14px] text-white" data-testid="fit-act" />
          <input type="number" value={mins} onChange={(e) => setMins(+e.target.value || 0)} className="w-16 rounded-lg bg-slate-800 px-2 py-2 text-[14px] text-white" data-testid="fit-act-min" />
          <span className="self-center text-[12px] text-slate-400">{L("min", "د")}</span>
        </div>
        {ex && <button onClick={() => { logIt(ar ? ex.ar : ex.en, mins, F.burned(ex.met, kg, mins)); setWhat(""); }} className="w-full rounded-lg bg-emerald-600 py-2 text-[13px] text-white" data-testid="fit-act-log">
          {ar ? ex.ar : ex.en} · {mins} {L("min", "د")} ≈ {F.burned(ex.met, kg, mins)} kcal — {L("log it", "سجّل")}</button>}
        {what.trim().length > 2 && !ex && <div className="text-[12px] text-slate-500">{L("Not in the list yet — try a simpler name", "مش في القايمة — جرّب اسم أبسط")}</div>}
      </div>
      <div className="text-[13px] text-slate-400">{L("Guided workouts — the timer walks you through", "تمارين بمدرب — التايمر بيمشي معاك")}</div>
      {planList.map((p) => { const c = F.planCost(p.workout, kg); return (
        <div key={p.id} className="rounded-xl bg-slate-900/60 border border-slate-800 px-3 py-2.5 flex items-center gap-3">
          <div className="flex-1 min-w-0"><div className="text-[14px] text-white truncate">{ar ? p.ar : p.en}</div><div className="text-[12px] text-slate-400">~{c.minutes} {L("min", "دقيقة")} · ~{c.kcal} kcal</div></div>
          <button onClick={() => { const s = steps(p); const sec = secsOf(s[0]); setSess({ plan: p, steps: s, i: 0, left: sec, running: sec > 0 }); }} className="shrink-0 rounded-full bg-emerald-600 p-2 text-white" data-testid={"fit-start-" + p.id}><Play size={15} /></button>
        </div>); })}
      <button disabled={busy} onClick={async () => {
        if (!modelReady) { openEngine && openEngine(); return; }
        setBusy(true);
        try { const p = F.parseWorkout(await llm(F.workoutMessages({ goal: tg.goal === "lose" ? "lose fat" : tg.goal === "gain" ? "build muscle" : "stay fit", level: "beginner", equipment: "none", minutes: 30, days: 3, lang: ar ? "ar" : "en" }), null, { json: true, maxTokens: 900, temperature: 0.3 })); if (p) setAiPlan(p); else flash && flash(L("Couldn't make a plan — try again", "مقدرتش أعمل خطة — جرّب تاني")); }
        catch (e) { flash && flash(L("Couldn't make a plan", "مقدرتش أعمل خطة")); } finally { setBusy(false); }
      }} className="w-full rounded-xl bg-violet-600 py-2.5 text-[13.5px] text-white flex items-center justify-center gap-1.5" data-testid="fit-ai-plan">{busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}{L("Make me a weekly plan", "اعملّي خطة أسبوعية")}</button>
      {aiPlan && aiPlan.tips.map((t, i) => <div key={i} className="text-[12.5px] text-slate-400">• {t}</div>)}
    </div>
  );
}

function Progress({ L, ar, st, upd, tg, pro = true, openPlan }) {
  const [w, setW] = useState("");
  const tr = F.trend(st.weights);
  const wk = F.weekSummary(st.days, st.weights, tg);
  const strk = F.streak(st.days);
  const maxK = Math.max(tg.kcal * 1.2, ...wk.rows.map((r) => r.kcal));
  const pts = tr.slice(-30);
  const lo = Math.min(...pts.map((p) => p.kg), st.profile.goalKg ? +st.profile.goalKg : Infinity) - 1, hi = Math.max(...pts.map((p) => p.kg)) + 1;
  const X = (i) => (pts.length < 2 ? 150 : (i / (pts.length - 1)) * 290 + 5), Y = (v) => 110 - ((v - lo) / (hi - lo || 1)) * 100;
  return (
    <div className="space-y-4" data-testid="fit-progress">
      {pro ? <WeekReport {...{ L, st, tg }} /> : <button onClick={() => openPlan && openPlan()} className="w-full rounded-2xl border border-amber-800 bg-amber-500/10 p-3 text-start text-[13px] text-amber-100" data-testid="fit-report-locked">📊 {L("Your week report — what went well, what to change — is in Pro.", "تقرير أسبوعك — إيه اللي ماشي كويس وإيه اللي يتغيّر — في Pro.")}</button>}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-900/60 p-2.5"><div className="text-xl font-semibold text-white" data-testid="fit-streak">{strk}</div><div className="text-[11px] text-slate-400">{L("day streak", "يوم ورا بعض")}</div></div>
        <div className="rounded-xl bg-slate-900/60 p-2.5"><div className="text-xl font-semibold text-white">{wk.avg}</div><div className="text-[11px] text-slate-400">{L("avg kcal (7 d)", "متوسط السعرات")}</div></div>
        <div className="rounded-xl bg-slate-900/60 p-2.5"><div className="text-xl font-semibold text-white">{wk.change == null ? "—" : (wk.change > 0 ? "+" : "") + wk.change}</div><div className="text-[11px] text-slate-400">{L("kg this week", "كجم الأسبوع ده")}</div></div>
      </div>
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3">
        <div className="text-[13px] text-white mb-2">{L("Last 7 days", "آخر 7 أيام")} <span className="text-slate-400">· {L("on target", "في الهدف")} {wk.onTarget}/{wk.logged}</span></div>
        <div className="flex items-end gap-1.5 h-24">{wk.rows.map((r) => (
          <div key={r.day} className="flex-1 flex flex-col items-center justify-end h-full">
            <div className={"w-full rounded-t " + (r.kcal > tg.kcal * 1.1 ? "bg-rose-400" : "bg-emerald-400")} style={{ height: (r.kcal / maxK) * 100 + "%" }} />
            <div className="text-[10px] text-slate-500 mt-1">{r.day.slice(8)}</div>
          </div>))}</div>
      </div>
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3 space-y-2">
        <div className="text-[13px] text-white">{L("Weight", "الوزن")} {tr.length ? <span className="text-slate-400">· {L("trend", "الاتجاه")} {tr[tr.length - 1].avg} kg</span> : null}</div>
        {pts.length >= 2 && (
          <svg viewBox="0 0 300 120" className="w-full h-28" data-testid="fit-weight-chart">
            {st.profile.goalKg && <line x1="0" x2="300" y1={Y(+st.profile.goalKg)} y2={Y(+st.profile.goalKg)} stroke="#34d399" strokeDasharray="4 4" strokeWidth="1" />}
            <polyline fill="none" stroke="#64748b" strokeWidth="1" points={pts.map((p, i) => `${X(i)},${Y(p.kg)}`).join(" ")} />
            <polyline fill="none" stroke="#38bdf8" strokeWidth="2.5" points={pts.map((p, i) => `${X(i)},${Y(p.avg)}`).join(" ")} />
          </svg>
        )}
        <div className="flex gap-2">
          <input type="number" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} placeholder={L("Today's weight (kg)", "وزن النهارده (كجم)")} className="flex-1 min-w-0 rounded-lg bg-slate-800 px-2 py-2 text-[14px] text-white" data-testid="fit-weight" />
          <button onClick={() => { const kg = parseFloat(w); if (!(kg > 25 && kg < 400)) return; upd((s) => ({ ...s, weights: [...s.weights.filter((x) => x.d !== F.today()), { d: F.today(), kg }], profile: { ...s.profile, kg } })); setW(""); }} className="shrink-0 rounded-lg bg-sky-600 px-4 text-white" data-testid="fit-weight-save">{L("Save", "احفظ")}</button>
        </div>
        <div className="text-[11.5px] text-slate-500">{L("The blue line is the 7-entry average — daily weight jumps with water and salt; the average is the truth.", "الخط الأزرق هو المتوسط — الوزن اليومي بيتغير بالمية والملح؛ المتوسط هو الحقيقة.")}</div>
      </div>
      <BodyCard {...{ L, st, upd }} />
    </div>
  );
}
