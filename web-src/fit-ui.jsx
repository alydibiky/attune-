/* ---- More → Fit & Food (v5.42) ------------------------------------------------------------
   Ali: "a Yazio-like app, better — a huge database of recipes and meals, food photo recognition".
   Everything that is a number comes from fit.js (the food table, Mifflin-St Jeor, MET) — code, not
   the model. The model only READS: what's on a plate in a photo or in a sentence, then the person
   confirms every item before it's saved. All data stays on the phone (localStorage). */
import React, { useState, useRef, useMemo, useEffect } from "react";
import { Mic, Apple, Camera, Search, Plus, Trash2, Loader2, Check, Droplet, Timer, Dumbbell, BarChart3, X, Sparkles, ChevronLeft, Play, Square, Star, Copy, ChevronDown } from "lucide-react";
import { getLang } from "./i18n.js";
import * as F from "./fit.js";
import { searchGenerated, getGenerated, GENERATED_COUNT } from "./fit-recipegen.js";
import * as DB from "./fitdb.js";
import * as FP from "./foodpack.js";
import * as R from "./fitread.js";
import * as PH from "./fitphoto.js";
import * as CL from "./fitclip.js";
import * as AQ from "./fitamount.js";
import * as LK from "./fitlook.js";
import { LookStyle, PhotoMarks, PulseLoader } from "./fitlook-ui.jsx";
import * as P from "./fitplus.js";
import * as Y from "./fityazio.js";
import * as MI from "./fitmicro.js";
import * as CARE from "./care.js";
import { WatchCard, Grades, DayQuality, RamadanCard, InsulinCard, QuickLog, SaveMyMeal, WeekPlanView, WeekReport, BodyCard, FitSettings, RAMADAN_NAMES } from "./fitplus-ui.jsx";
import { useSubBack, useSticky } from "./backstack.js";
import * as H from "./fithome.js";
import { AR } from "./i18n-ar.js";
import { Barcode, Undo2, Pencil, User } from "lucide-react";

const KEY = "attune:fit:v1";
const EMPTY = { profile: null, days: {}, weights: [], fast: null, myRecipes: [], favs: [], favFoods: [] };
const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && typeof v === "object" ? { ...EMPTY, ...v } : EMPTY; } catch (e) { return EMPTY; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
const MEAL_NAMES0 = { breakfast: ["Breakfast", "فطور"], lunch: ["Lunch", "غداء"], dinner: ["Dinner", "عشاء"], snacks: ["Snacks", "وجبات خفيفة"] };
let MEAL_NAMES = MEAL_NAMES0;   // v6.2: Ramadan mode renames the slots (Suhoor, Iftar, After Taraweeh)
const mealNow = () => { const h = new Date().getHours(); return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 21 ? "dinner" : "snacks"; };
const r0 = (v) => (v == null ? "—" : Math.round(v));
// v6.27 (Ali: "c p f is just lame"): nutrients always in full words, each with its own colour (the Diary bars' colours)
const MACRO = [["p", "Protein", "بروتين", "#38BDF8"], ["c", "Carbs", "كربوهيدرات", "#FBBF24"], ["f", "Fat", "دهون", "#FB7185"]];
function Macros({ L, x, kcal = true, only, className = "" }) {
  return (
    <div className={"flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-slate-400 tabular-nums " + className} data-testid="fit-macros">
      {kcal ? <b className="text-slate-200 font-semibold">{r0(x.kcal)} {L("kcal", "سعرة")}</b> : null}
      {MACRO.filter(([k]) => !only || only.includes(k)).map(([k, en, ar, col]) => (
        <span key={k} className="inline-flex items-center gap-1 whitespace-nowrap"><i className="inline-block w-2 h-2 rounded-full" style={{ background: col }} />{L(en, ar)} {r0(x[k])} {L("g", "جم")}</span>))}
    </div>);
}

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
export function FitApp({ llm, abort, ready, canSee = true, modelReady, openEngine, flash, incoming, clearIncoming, fetchJson, packText, scanBarcode, readText, native, onExit, share, listen, health, pro = true, openPlan, photoClip, minimal = false }) {
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
  const tg = useMemo(() => { const t = H.targetsOf(st.profile); return t ? { ...t, kg: +st.profile.kg || 70 } : null; }, [st.profile]);
  const t = (en) => (ar ? AR[en] || en : en);   // v6.10 home: every new string lives in i18n-ar.js
  const tot = F.dayTotals(day);
  const setDay = (fn) => upd((s) => { const d = s.days[dayKey] || { meals: {}, water: 0, workouts: [] }; return { ...s, days: { ...s.days, [dayKey]: fn(d) } }; });
  // v6.14: the home-screen widget shows today's calories left and water (FitWidget.kt)
  useEffect(() => {
    if (!native || !native.setFitWidget || !tg) return;
    const td = st.days[F.today()] || { meals: {}, water: 0, workouts: [] }, t = F.dayTotals(td);
    const goal = st.profile.cycleExtra ? Y.dayGoal(tg.kcal, F.today(), st.profile.cycleExtra) : tg.kcal, left = goal + (t.burned || 0) - t.kcal;
    try { native.setFitWidget(JSON.stringify({ left: String(Math.abs(left)), leftLabel: left < 0 ? L("kcal over today", "سعر زيادة اليوم") : L("kcal left today", "سعر متبقٍ اليوم"),
      line: L(`Eaten ${t.kcal} · goal ${goal} · protein ${Math.round(t.p)}/${tg.protein} g`, `أكلت ${t.kcal} · الهدف ${goal} · بروتين ${Math.round(t.p)}/${tg.protein} جم`),
      water: L(`Water ${(t.water / 1000).toFixed(1)} / ${(tg.water / 1000).toFixed(1)} L`, `الماء ${(t.water / 1000).toFixed(1)} / ${(tg.water / 1000).toFixed(1)} لتر`) })); } catch (e) {}
  }, [st.days, tg]);
  const addItems = (meal, items) => setDay((d) => ({ ...d, meals: { ...d.meals, [meal]: [...((d.meals || {})[meal] || []), ...items.map((x) => ({ ...x, t: Date.now() }))] } }));
  // v6.10 home: every add says "Added · Undo" for 5 s with a light haptic tick (no confirm dialog)
  const [undo, setUndo] = useState(null);
  useEffect(() => { if (!undo) return; const h = setTimeout(() => setUndo((u) => (u && u.id === undo.id ? null : u)), 5000); return () => clearTimeout(h); }, [undo]);
  const tick = () => { try { if (native && native.haptic) native.haptic("tick"); else if (navigator.vibrate) navigator.vibrate(12); } catch (e) {} };
  const logNow = (meal, items, label) => {
    const stamp = Date.now(), key = dayKey;
    upd((s) => { const d = s.days[key] || { meals: {}, water: 0, workouts: [] }; return { ...s, days: { ...s.days, [key]: { ...d, meals: { ...d.meals, [meal]: [...((d.meals || {})[meal] || []), ...items.map((x) => ({ ...x, t: stamp }))] } } } }; });
    tick();
    setUndo({ id: stamp, label, revert: () => upd((s) => { const d = s.days[key]; if (!d) return s; return { ...s, days: { ...s.days, [key]: { ...d, meals: { ...d.meals, [meal]: ((d.meals || {})[meal] || []).filter((x) => x.t !== stamp) } } } }; }) });
  };

  // ---- logging ----
  const [adding, setAdding] = useState(null);           // meal slot being added to, or null
  useSubBack(!!adding, () => setAdding(null));
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  // the pulse stays at least 0.7 s, so a meal read by code in 80 ms is a calm moment, not a flicker
  const [hold, setHold] = useState(false);
  const holdT = useRef(0);
  const pulse = () => { setHold(true); clearTimeout(holdT.current); holdT.current = setTimeout(() => setHold(false), 700); };
  useEffect(() => { if (busy) pulse(); }, [busy]);
  useEffect(() => () => clearTimeout(holdT.current), []);
  const [draft, setDraft] = useState(null);             // items read, waiting for the person's OK
  // v6.12 (Ali: "28 s is a lot, Yazio takes 5 s"): the fast look's answer is shown at once and can be saved; the chat model
  // double-checks in the background and replaces the list only if the person has not changed it (else it is offered)
  const draftRef = useRef(null); useEffect(() => { draftRef.current = draft; }, [draft]);
  const shownRef = useRef(null);
  const fastSeen = useRef(null);
  const pinNo = useRef({});        // v6.18 (look Night): the number of each food's pin on the photo   // the last photo's vectors from the fast look (fitclip.js)
  const [refining, setRefining] = useState(false);
  const [fastDl, setFastDl] = useState("");
  const [aiAlt, setAiAlt] = useState(null);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [online, setOnline] = useState(null);           // { q, foods } from the big databases
  const [searching, setSearching] = useState(false);
  const [replaceAt, setReplaceAt] = useState(-1);       // a draft item being swapped for a searched food
  // v6.10: the photo fast path (fitclip.js) is on the phone → a photo is named in about a second, no chat model needed
  const [clipOn, setClipOn] = useState(() => { try { return !!(photoClip && photoClip.status().installed) || !!(typeof window !== "undefined" && window.__attuneClipTest); } catch (e) { return false; } });
  useEffect(() => { if (photo && clipOn && photoClip) CL.loadClip(photoClip.base).catch(() => {}); }, [photo, clipOn]);   // warm it up while the person types a note
  // v6.19 (Ali: "Eggs with tomatoes, 123 g = 22 kcal" — fixed in the name bank weeks ago, but the phone kept its first download):
  // once a day, quietly, only what changed is fetched (big files wait for Wi-Fi); the next photo uses the new bank
  useEffect(() => {
    if (!clipOn || !photoClip || !photoClip.update || !CL.updateDue()) return;
    photoClip.update().then((r) => { if (r && r.fetched) CL.resetClip(); }).catch(() => {});
  }, [clipOn]);
  const fileRef = useRef(null);
  const codeRef = useRef(null);
  const run = useRef(0);
  useEffect(() => { if (incoming) { setText(incoming); setAdding(mealNow()); setTab("today"); clearIncoming && clearIncoming(); } }, [incoming]);
  // v6.28: a meal tapped on Home / Health opens straight on adding to it
  useEffect(() => { let m = ""; try { m = localStorage.getItem("attune:fit:openAdd") || ""; localStorage.removeItem("attune:fit:openAdd"); } catch (e) {} if (F.MEALS.includes(m)) { setTab("today"); setAdding(m); } }, []);

  const readMeal = async () => {
    if (!text.trim() && !photo) return;
    const me = ++run.current;
    // v6.3: the dietitian-style reader first (numbers, fractions, «بيضتين», «ربع كيلو», sizes, units,
    // what people call foods) — instant and offline; only the words it can't place go to the model
    const read = photo ? { items: [], unknown: [] } : R.readMealText(text);
    if (!photo && read.items.length && !read.unknown.length) { pulse(); setDraft(read.items); return; }
    if (!modelReady && !(photo && clipOn)) { if (read.items.length) { setDraft(read.items); flash && flash(L(`Not placed: “${read.unknown.join(", ")}” — load a model to read it, or search it below`, `ما عرفتش: «${read.unknown.join("، ")}» — شغّل موديل يقراها، أو دوّر عليها تحت`)); } else openEngine && openEngine(); return; }
    setBusy(true);
    try {
      if (photo) {
        const used = (st.photoUse && st.photoUse.d === F.today() ? st.photoUse.n : 0);
        if (!pro && used >= FREE_PHOTOS_PER_DAY) { flash && flash(L(`${FREE_PHOTOS_PER_DAY} photo meals a day are free — Pro reads every photo. Type or say it meanwhile.`, `${FREE_PHOTOS_PER_DAY} صور وجبات يوميًا مجانًا — ويقرأ Pro كل الصور. اكتبها أو قلها حتى ذلك الحين.`)); setPhoto(null); openPlan && openPlan(); return; }   // the photo goes, so typing the meal works at once
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
      if (!items.length) { flash && flash(L("Couldn't read that — try naming the foods, e.g. “2 eggs and a loaf of baladi bread”", "تعذّرت القراءة — اكتب أسماء الأطعمة، مثلًا «٢ بيض ورغيف عيش بلدي»")); return; }
      setDraft(items);
    } catch (e) {
      if (e && e.message === "slow") { flash && flash(L("Reading the photo took too long — name the food instead (e.g. “2 fried eggs and baladi bread”) and I'll log it at once", "استغرقت قراءة الصورة وقتًا طويلًا — اكتب اسم الطعام (مثلًا «٢ بيض مقلي وعيش بلدي») وسيُسجَّل فورًا")); setPhoto(null); }
      else flash && flash(L("Couldn't read that meal", "تعذّرت قراءة الوجبة"));
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
  const giveUp = () => { flash && flash(L("Couldn't recognise the food in time — name it instead (e.g. “2 fried eggs and baladi bread”) or search it below", "تعذّر التعرّف على الطعام في الوقت المناسب — اكتب اسمه (مثلًا «٢ بيض مقلي وعيش بلدي») أو ابحث عنه في الأسفل")); setPhoto(null); };
  // v6.10 step 0 — the fast look (fitclip.js): no chat model, ≈ a second. Started at once, side by side with the barcode look.
  const fastLook = async () => {
    const clip = await PH.withLimit(CL.loadClip(photoClip ? photoClip.base : CL.CLIP_BASE), 30000);   // the first load reads ≈ 200 MB (two models) from the phone's storage
    const ranked = await PH.withLimit(CL.classify(clip, photo.url, 5), 15000);
    fastSeen.current = { clip, embs: clip.lastEmbs, photo: photo.url };   // v6.17: kept with the dish you save, so next time it is known
    return CL.decide(clip.bank, ranked);
  };
  const useFast = async (fast, me) => {
    let items = fast.items;
    if (items.some((x) => x.unknown)) { items = await PH.resolveItems(items, DB.packSearch, 2000); if (run.current !== me) return; }
    shownRef.current = items; setDraft(items);
  };
  const readPhotoMeal = async (me) => { setAiAlt(null); shownRef.current = null; try { await readPhotoMeal0(me); } finally { if (run.current === me) setRefining(false); } };
  const readPhotoMeal0 = async (me) => {
    let instant = false;
    // the chat model's list: in place of the instant one when it is untouched, else offered with one tap
    const place = (items) => { if (!instant) { setDraft(items); return; } if (draftRef.current === shownRef.current) { shownRef.current = items; setDraft(items); } else setAiAlt(items); };
    const fastP = clipOn ? fastLook().catch(() => null) : Promise.resolve(null);
    // v6.16c: the text in the photo, read side by side with the barcode look — a menu / delivery app / label that prints the
    // dish and its calories («Big BAIK … 1000 kcal») is logged with those numbers, never with a guess from the picture
    const textP = readText ? PH.withLimit(readText(photo.data), 6000).catch(() => null) : Promise.resolve(null);
    if (scanBarcode) {
      setStage(L("Looking for a barcode…", "بدوّر على باركود…"));
      try { const codes = await PH.withLimit(scanBarcode(photo.data), 8000); if (run.current !== me) return;
        for (const c of codes || []) { const fd = await DB.byBarcode(c, fetchJson); if (fd) { setDraft([{ ...F.itemFromFood(fd, 1, Object.keys(fd.portions || {})[0] || "serving"), base: null }]); return; } }
      } catch (e) {}
    }
    { const menu = PH.menuFromText(await textP); if (run.current !== me) return;
      if (menu) { setDraft([PH.menuItem(menu)]); return; } }
    const note = text.trim();
    let fast = null;
    if (clipOn) {
      setStage(L("Recognising the food…", "جارٍ التعرّف على الطعام…"));
      fast = await fastP; if (run.current !== me) return;
      if (fast && fast.status === "auto") { await useFast(fast, me); return; }   // sure enough: done, the chat model is not needed
      if (fast && fast.status === "guess" && fast.items.length && modelReady && canSee) {   // shown now (≈1 s); the chat model checks it meanwhile
        await useFast(fast, me); if (run.current !== me) return;
        instant = true; setBusy(false); setStage(""); setRefining(true);
      }
    }
    // not sure (or no fast model): the chat model has a look when it can; the fast guess is kept for when it can't
    if (!modelReady || !canSee) {
      if (fast && fast.status === "guess") { await useFast(fast, me); return; }
      const ni = PH.noteItems(note); if (ni.length) { setDraft(ni); return; }
      if (!modelReady) { flash && flash(L("Couldn't recognise this photo — name the food instead, e.g. “2 fried eggs and baladi bread”", "تعذّر التعرّف على هذه الصورة — اكتب اسم الطعام، مثلًا «٢ بيض مقلي وعيش بلدي»")); setPhoto(null); return; }
      flash && flash(clipOn || !photoClip ? L("This model can't read photos right now — name the food instead, e.g. “2 fried eggs and baladi bread”", "هذا النموذج لا يقرأ الصور الآن — اكتب اسم الطعام، مثلًا «٢ بيض مقلي وعيش بلدي»")
        : L("This model can't read photos — get “Fast photo recognition” in My plan, or name the food, e.g. “2 fried eggs and baladi bread”", "هذا النموذج لا يقرأ الصور — نزّل «التعرّف السريع على صور الطعام» من «خطتي»، أو اكتب اسم الطعام، مثلًا «٢ بيض مقلي وعيش بلدي»")); setPhoto(null); return;
    }
    const noFood = () => { if (instant) return; if (fast && fast.status === "guess") return useFast(fast, me); giveUp(); };   // the chat model found nothing: the fast guess beats "name it"
    if (ready) { setStage(L("Waking the model…", "بصحّي الموديل…")); try { await PH.withLimit(ready(), 90000); } catch (e) {} if (run.current !== me) return; }   // the time limit counts from here, not from the wake-up
    const b = PH.budget();
    setStage(L("Recognising the food…", "جارٍ التعرّف على الطعام…"));
    let r = null;
    const hints = fast && fast.items && fast.items[0] ? (fast.items[0].alts || []).map((a) => a.label) : [];   // v6.12: the fast look's guesses help the chat model (it said "Eggs with tomatoes"; the chat model alone said "Fried egg")
    try { r = F.parsePhoto(await limit(llm(F.photoMessages(note, undefined, hints), photo, { json: true, maxTokens: 1000, temperature: 0 }), b.slice(42000, 14000))); } catch (e) { r = null; }
    if (run.current !== me) return;
    if (r && r.label) { DB.keepFoods([r.label]); place([F.itemFromFood(r.label, 1, Object.keys(r.label.portions || {})[0] || "g")]); return; }
    let items = r ? r.items : [];
    if (!items.length && b.left() > 6000) {   // the quick look: just the names
      setStage(L("Taking a quick look…", "ببص بصة سريعة…"));
      try { const names = PH.parseNames(await limit(llm(PH.namesMessages(note), photo, { maxTokens: 60, temperature: 0 }), b.slice(20000, 2000))); if (run.current !== me) return; items = await PH.namesToItems(names, DB.packSearch, 3000); } catch (e) {}
      if (run.current !== me) return;
    }
    if (!items.length) { const ni = PH.noteItems(note); if (ni.length) { place(ni); return; } await noFood(); return; }
    if (items.some((x) => x.unknown)) { items = await PH.resolveItems(items, DB.packSearch, 3000); if (run.current !== me) return; }
    place(items);
    if (instant && draftRef.current !== items && shownRef.current !== items) return;   // offered, not placed: no more passes
    // v6.3: a zoomed second look at one food the model wasn't sure of (cropped from the photo, enlarged) — only when time is left
    const unsure = items.map((x, i) => [x, i]).filter(([x]) => x.box && x.conf < 0.6).slice(0, 1);
    for (const [x, i] of unsure) {
      if (instant || b.left() < 20000) break;   // in the background: no extra pass
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
    if (!listen) { flash && flash(L("Voice input works in the Android app", "الإدخال الصوتي متاح في تطبيق أندرويد")); return; }
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
    if (!r) { setCmdNote(L("I didn't get that change — try “remove the cola”, “rice 200 g”, “add a spoon of oil”", "لم أفهم التعديل — جرّب «شيل البيبسي»، «الرز ٢٠٠ جرام»، «ضيف معلقة زيت»")); return; }
    setDraft(r.items); setCmdNote(L(r.done.en, r.done.ar)); setCmd("");
  };
  const scaleAt = (i, k) => setDraft((d) => d.map((x, j) => (j === i ? F.scaleItem(x, k) : x)));
  const chooseAt = (i, fd) => setDraft((d) => d.map((x, j) => (j === i ? F.chooseFood(x, fd) : x)));
  // search: the table + foods kept on the phone at once; the big databases on demand
  const searchOnline = async () => {
    const qq = q.trim(); if (!qq) return;
    if (/^\d{8,14}$/.test(qq)) { setSearching(true); try { const fd = await DB.byBarcode(qq, fetchJson); if (fd) { pickFood(fd); } else flash && flash(L("No product with that barcode yet", "لا يوجد منتج بهذا الباركود بعد")); } catch (e) { flash && flash(String(e.message || e)); } finally { setSearching(false); } return; }
    setSearching(true);
    try { const r = await DB.searchAll(qq, fetchJson); setOnline({ q: qq, foods: r.foods }); if (!r.online || (r.errors.length && !r.foods.length)) flash && flash(L("Couldn't reach the food databases — showing what's on the phone", "تعذّر الوصول إلى قواعد بيانات الطعام — هذه النتائج من الهاتف")); }
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
      if (!codes || !codes.length) { flash && flash(L("No barcode found — hold the phone closer, straight on", "لم يُعثر على باركود — قرّب الهاتف واجعله مستقيمًا")); return; }
      const fd = await DB.byBarcode(codes[0], fetchJson);
      if (fd) pickFood(fd); else { setQ(codes[0]); flash && flash(L("This product isn't in the databases yet — log it by name", "هذا المنتج غير موجود في قواعد البيانات بعد — سجّله بالاسم")); }
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
    const ok = (draft || []).filter((x) => x.grams > 0 || x.quick);   // v6.14: a quick add has calories but no grams
    if (!ok.length) return;
    if (refining) { run.current++; setRefining(false); try { abort && abort(); } catch (e) {} }   // saved before the background check finished: stop it
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
    // v6.17: a photo meal teaches the photo matcher this dish (its first food) — Arab dishes 75 → 92 % after 3 such photos (measured)
    const fs = fastSeen.current;
    if (fs && photo && fs.photo === photo.url && fs.embs) { const x = ok[0]; try { CL.remember(fs.clip.bank, fs.embs, x.like || x.id, x.chosen ? "" : x.said); } catch (e) {} fastSeen.current = null; }
    logNow(adding, ok, L(`Added to ${MEAL_NAMES[adding][0].toLowerCase()} — ${ok.reduce((a, x) => a + (x.kcal || 0), 0)} kcal`, `أُضيف إلى ${MEAL_NAMES[adding][1]} — ${ok.reduce((a, x) => a + (x.kcal || 0), 0)} سعر`));
    setDraft(null); setText(""); setPhoto(null); setQ(""); setAdding(null);
  };
  // v6.16c (Ali: "I downloaded all the packs but typing the food loaded nothing" — the food pack lived in Fit's settings):
  // the food database (Egypt + the most popular, ≈240,000 products) downloads by itself on Wi-Fi the first time Fit opens
  const [packBg, setPackBg] = useState(null);
  useEffect(() => {
    let stopped = false;
    (async () => {
      const s = DB.getPackStore(); if (!packText || !s) return;
      if (!(native && native.unmetered && native.unmetered())) return;
      const meta = await s.getMeta(); const m = JSON.parse(await packText("manifest.json")); const want = Math.min(10, m.shards.length);
      if ((meta.done || []).length >= want) return;
      setPackBg({ shard: 0, of: want, count: 0 });
      await FP.installPack({ store: s, manifest: m, getText: packText, shards: want, isStopped: () => stopped, onProgress: (p) => setPackBg(p) });
      if (!stopped) setPackBg(null);
    })().catch(() => setPackBg(null));
    return () => { stopped = true; };
  }, []);
  // the offline food pack answers while you type (when it is installed)
  const [packHits, setPackHits] = useState([]);
  useEffect(() => {
    const qq = q.trim(); if (qq.length < 2) { setPackHits([]); return; }
    let on = true; const t = setTimeout(() => { DB.packSearch(qq, 12).then((h) => on && setPackHits(h)); }, 120);
    return () => { on = false; clearTimeout(t); };
  }, [q, adding]);
  // v6.16c: and when the phone knows little, the big online databases are asked by themselves after a short pause (no button)
  useEffect(() => {
    const qq = q.trim(); if (!fetchJson || qq.length < 3 || /^\d{8,14}$/.test(qq) || (online && online.q === qq)) return;
    const t = setTimeout(() => { if (DB.searchOffline(qq, 12).length + packHits.length < 6) searchOnline(); }, 900);
    return () => clearTimeout(t);
  }, [q, packHits]);
  const results = useMemo(() => {
    if (q.trim().length < 2) return [];
    const base = online && online.q === q.trim() ? online.foods : DB.searchOffline(q, 12);
    const seen = new Set(base.map((f) => f.barcode || f.id));
    return [...base, ...packHits.filter((f) => !seen.has(f.barcode || f.id))];
  }, [q, online, packHits]);

  // v6.10 home — the log bar: Photo · Barcode · Say it · Search, each one tap from the home
  const autoRead = useRef(false);
  const [go, setGo] = useState(0);
  useEffect(() => { if (go && (photo || text.trim())) readMeal(); }, [go]);
  const [searchFocus, setSearchFocus] = useState(0);
  const [addTab, setAddTab] = useState("recent");   // v6.34 the minimal Add sheet (Yazio-like): Recent · Favourites · My meals
  const bar = {
    photo: () => { autoRead.current = true; fileRef.current && fileRef.current.click(); },
    barcode: () => { if (!scanBarcode) { setAdding((a) => a || mealNow()); setDraft(null); setSearchFocus((n) => n + 1); flash && flash(t("Type the barcode number in search")); return; } codeRef.current && codeRef.current.click(); },
    voice: async () => {
      setAdding((a) => a || mealNow()); setDraft(null);
      if (!listen) { setTimeout(() => { const el = document.querySelector("[data-testid=fit-log-text]"); el && el.focus(); }, 60); flash && flash(L("Voice input works in the Android app", "الإدخال الصوتي متاح في تطبيق أندرويد")); return; }
      if (listening) return;
      setListening("text");
      try { const said = await listen(ar ? "ar-EG" : "", (partial) => setText(partial)); if (said) { setText(said); setGo((n) => n + 1); } }
      catch (e) { flash && flash(String((e && e.message) || e).slice(0, 100)); }
      finally { setListening(""); }
    },
    search: () => { setAdding((a) => a || mealNow()); setDraft(null); setSearchFocus((n) => n + 1); },
  };
  const searchRef = useRef(null);
  useEffect(() => { if (searchFocus && searchRef.current) searchRef.current.focus(); }, [searchFocus, adding]);

  // ---- profile ----
  const [pf, setPf] = useState(st.profile || { sex: "m", age: "", cm: "", kg: "", activity: "light", goal: "lose", rate: 0.5, goalKg: "", diet: "balanced" });
  const [editProfile, setEditProfile] = useState(false);
  const [fullForm, setFullForm] = useState(false);     // v6.10: the first visit asks 3 questions; the full form stays one tap away
  useSubBack(fullForm && !st.profile, () => setFullForm(false));
  const quickSave = (a) => {
    const r = H.quickProfile(a);
    if (r.error) { flash && flash(r.error === "kcal" ? t("Enter a daily target between 800 and 6000 kcal") : L("Enter your age, height and weight", "اكتب عمرك وطولك ووزنك")); return false; }
    if (r.country) F.setCountry(r.country);
    upd((s) => ({ ...s, profile: r.profile, country: r.country || s.country, weights: s.weights.length || !(+r.profile.kg > 0) ? s.weights : [{ d: F.today(), kg: +r.profile.kg }] }));
    setPf(r.profile); setTab("today");
    return true;
  };
  useSubBack(editProfile, () => setEditProfile(false));
  const saveProfile = () => {
    const t = H.targetsOf(pf);
    if (!t) { flash && flash(L("Enter your age, height and weight", "اكتب عمرك وطولك ووزنك")); return; }
    upd((s) => ({ ...s, profile: { ...pf }, weights: s.weights.length || !(+pf.kg > 0) ? s.weights : [{ d: F.today(), kg: +pf.kg }] }));
    setEditProfile(false); setFullForm(false); setTab("today");
  };

  const Tabs = [["today", L("Today", "اليوم"), Apple], ["recipes", L("Recipes", "وصفات"), Star], ["move", L("Move", "رياضة"), Dumbbell], ["progress", L("Progress", "التقدم"), BarChart3]];

  // the first-visit screens hide Attune's bars too, so they get Fit's own way back
  const exitBar = onExit ? <div className="max-w-md mx-auto px-2" style={{ paddingTop: "env(safe-area-inset-top)" }}><button onClick={onExit} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-300" aria-label={L("Back to Attune", "رجوع إلى Attune")} data-testid="fit-exit"><span className="text-lg leading-none inline-block rtl:-scale-x-100">←</span></button></div> : null;
  // v6.18: Ali's three looks (Fresh by default), chosen in Fit's settings — every Fit screen takes it
  const look = LK.lookOf(st), lookCls = "fit-look-" + look;
  if (!st.profile && !fullForm) return <div className={lookCls}><LookStyle look={look} />{exitBar}<QuickSetup {...{ t, L, ar, save: quickSave }} full={() => setFullForm(true)} /></div>;
  if (!st.profile) return <div className={lookCls}><LookStyle look={look} />{exitBar}<ProfileForm pf={pf} setPf={setPf} save={saveProfile} L={L} cancel={null} extra={null} /></div>;
  if (editProfile) return <div className={lookCls}><LookStyle look={look} /><ProfileForm pf={pf} setPf={setPf} save={saveProfile} L={L} cancel={st.profile ? () => setEditProfile(false) : null} extra={st.profile ? <FitSettings {...{ L, ar, st, upd, native, flash, packText, photoClip }} onClip={setClipOn} /> : null} /></div>;

  return (
    <div className={"max-w-2xl mx-auto px-4 pt-2 pb-28 space-y-4 " + lookCls + (minimal ? " fit-min" : "")} data-testid="fit-app" data-look={look}>
      <LookStyle look={look} />
      {/* v6.16c (Ali picked look A): Fit & Food is its own app — its own top bar and bottom bar; Attune's are hidden while it's open */}
      <div className="sticky top-0 z-30 -mx-4 px-2 bg-slate-950/95 backdrop-blur flex items-center gap-1 min-h-[52px]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        {onExit ? <button onClick={onExit} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-300" aria-label={L("Back to Attune", "رجوع إلى Attune")} data-testid="fit-exit"><span className="text-lg leading-none inline-block rtl:-scale-x-100">←</span></button> : null}
        <h2 className="flex-1 min-w-0 truncate text-[17px] font-semibold text-white flex items-center gap-2"><Apple size={18} className="text-emerald-300 shrink-0" />{minimal ? L("Fit & Food", "الأكل والرياضة") : ({ today: L("Diary", "اليوميات"), recipes: L("Recipes", "الوصفات"), progress: L("Progress", "التقدم"), me: L("Me", "أنا"), move: L("Workouts", "التمارين") })[tab] || L("Fit & Food", "الأكل والرياضة")}</h2>
        {openEngine && !modelReady ? <button onClick={openEngine} className="min-h-[36px] rounded-full border border-slate-700 px-3 text-[12px] text-slate-300" data-testid="fit-engine">{L("No model", "لا يوجد نموذج")}</button> : null}
      </div>
      {minimal ? (<>
        {/* v6.32 (Ali picked B): no bottom bar — thin tabs on top like the rest of the app, and one "Log food" button */}
        <div role="tablist" className="att-hscroll sticky z-30 -mx-4 px-4 flex gap-6 overflow-x-auto border-b-2 border-slate-700 bg-slate-950" style={{ top: "calc(52px + env(safe-area-inset-top))" }} data-testid="fit-nav">
          {[["today", L("Diary", "اليوميات")], ["recipes", L("Recipes", "الوصفات")], ["progress", L("Progress", "التقدم")], ["me", L("Me", "أنا")]].map(([k, label]) => {
            const on = tab === k || (k === "me" && tab === "move");
            return <button key={k} role="tab" aria-selected={on} aria-current={on ? "page" : undefined} onClick={() => { setTab(k); setAdding(null); setDraft(null); }} data-testid={"fit-tab-" + k}
              className={"shrink-0 h-11 -mb-[2px] text-[15px] whitespace-nowrap " + (on ? "border-b-[3px] border-emerald-500 text-white font-bold" : "text-slate-300 font-medium")}>{label}</button>; })}
        </div>
        {!adding ? <button onClick={() => { setAdding((a) => a || mealNow()); setDraft(null); setText(""); setPhoto(null); }} data-testid="fit-add"
          className="att-shift fixed end-4 z-[60] h-14 ps-4 pe-5 rounded-full bg-emerald-700 text-white text-[16px] font-bold shadow-lg shadow-black/30 flex items-center gap-2 active:scale-95 motion-safe:transition-transform" style={{ bottom: "calc(20px + env(safe-area-inset-bottom))" }}>
          <Plus size={22} strokeWidth={2.8} />{L("Log food", "سجّل طعامًا")}</button> : null}
      </>) : (
      <nav className="att-shift fixed bottom-0 inset-x-0 z-[60] bg-slate-950 border-t border-slate-800" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} data-testid="fit-nav">
        <div className="max-w-2xl mx-auto grid grid-cols-5 items-end h-[62px]">
          {[["today", L("Diary", "اليوميات"), Apple], ["recipes", L("Recipes", "الوصفات"), Star], ["add"], ["progress", L("Progress", "التقدم"), BarChart3], ["me", L("Me", "أنا"), User]].map(([k, label, Ic]) => k === "add" ? (
            <div key={k} className="flex justify-center pb-2"><button onClick={() => { setAdding((a) => a || mealNow()); setDraft(null); setText(""); setPhoto(null); }} className="w-14 h-14 -mt-6 rounded-full bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-900/40 flex items-center justify-center active:scale-95 motion-safe:transition-transform" aria-label={L("Add food", "أضف طعامًا")} data-testid="fit-add"><Plus size={28} strokeWidth={2.6} /></button></div>
          ) : (
            <button key={k} onClick={() => { setTab(k); setAdding(null); setDraft(null); }} data-testid={"fit-tab-" + k} aria-current={tab === k || (k === "me" && tab === "move") ? "page" : undefined}
              className={"h-full flex flex-col items-center justify-center gap-0.5 text-[11px] " + (tab === k || (k === "me" && tab === "move") ? "text-emerald-300" : "text-slate-500")}><Ic size={21} />{label}</button>))}
        </div>
      </nav>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" data-testid="fit-photo-input" onChange={async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) { try { const ph = await readPhoto(f); setAdding((a) => a || mealNow()); setDraft(null); setPhoto(ph); if (autoRead.current) { autoRead.current = false; setGo((n) => n + 1); } } catch (x) { flash && flash(L("Couldn't open that picture", "تعذّر فتح الصورة")); } } }} />
      <input ref={codeRef} type="file" accept="image/*" capture="environment" className="hidden" data-testid="fit-barcode-input" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) { setAdding((a) => a || mealNow()); scanCode(f); } }} />
      {adding ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-3 space-y-3" data-testid="fit-log">
          <div className="flex items-center justify-between">
            <div className="text-white font-medium">{L("Add to", "أضف إلى")}{" "}
              <select value={adding} onChange={(e) => setAdding(e.target.value)} className="bg-slate-800 rounded px-1 text-white" data-testid="fit-log-meal">
                {F.MEALS.map((m) => <option key={m} value={m}>{L(MEAL_NAMES[m][0], MEAL_NAMES[m][1])}</option>)}
              </select>
            </div>
            <button onClick={() => { setAdding(null); setDraft(null); }} className="text-slate-400 min-h-[44px] min-w-[44px] -me-2 grid place-items-center" aria-label={L("Close", "إغلاق")} data-testid="fit-log-close"><X size={20} /></button>
          </div>
          {busy || hold ? (
            <div data-testid={photo ? "fit-photo-loading" : "fit-skeleton"}><PulseLoader url={photo && photo.url} stage={busy ? stage : draft && draft.length ? L(`Found ${draft.length} ${draft.length === 1 ? "food" : "foods"}`, `وُجد ${draft.length} ${draft.length === 1 ? "صنف" : draft.length === 2 ? "صنفان" : "أصناف"}`) : L("Reading your meal…", "جارٍ قراءة وجبتك…")} L={L} ar={ar} label={t("Recognising the food…")} /></div>
          ) : !draft && minimal ? (
            /* v6.34 (Ali: "it is cluttered, make it minimal — and take ideas from Yazio"; he picked A): ONE box with the camera,
               barcode and microphone inside it; what you type also searches the foods; Recent · Favourites · My meals as one list
               with a + on each row (one tap logs it); everything else under More. */
            <div className="space-y-3" data-testid="fit-add-min">
              <div className="rounded-2xl bg-slate-800 flex items-start gap-1 ps-3 pe-1 py-1.5">
                <textarea value={text} onChange={(e) => { const v = e.target.value; setText(v); const w = v.trim(); setQ(w && w.split(/\s+/).length <= 3 && !/\d/.test(w) ? w : ""); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && text.trim()) { e.preventDefault(); readMeal(); } }}
                  rows={text.length > 38 ? 3 : 1} data-testid="fit-log-text" placeholder={L("What did you eat?", "ماذا أكلت؟")}
                  className="flex-1 min-w-0 resize-none bg-transparent py-2 text-[15px] text-white placeholder:text-slate-400 focus:outline-none" />
                {[["photo", Camera, L("Photo", "صورة")], ["barcode", Barcode, t("Barcode")], ["voice", Mic, listening ? L("Listening…", "أستمع…") : L("Say it", "تحدّث")]].map(([k, Ic, lb]) => (
                  <button key={k} onClick={bar[k]} aria-label={lb} title={lb} data-testid={"fit-lb-" + k}
                    className={"w-10 h-10 shrink-0 rounded-full grid place-items-center " + (k === "voice" && listening ? "bg-rose-600 text-white" : "text-slate-300 active:bg-slate-700")}><Ic size={19} /></button>))}
              </div>
              {photo && !busy ? <div className="relative w-24"><img src={photo.url} className="rounded-lg w-24 h-24 object-cover" /><button onClick={() => setPhoto(null)} className="absolute top-1 right-1 rounded-full p-0.5" style={{ background: "rgba(0,0,0,.6)", color: "#fff" }} aria-label={L("Remove", "إزالة")}><X size={14} /></button></div> : null}
              {text.trim() || photo ? <button onClick={readMeal} disabled={busy} className="w-full min-h-[48px] rounded-xl bg-emerald-600 disabled:opacity-40 text-[14.5px] font-semibold text-white flex items-center justify-center gap-1.5" data-testid="fit-read">
                <Sparkles size={16} />{L("Add it", "أضفه")}</button> : null}
              {results.length ? <div className="rounded-xl bg-slate-900/60 divide-y divide-slate-800" data-testid="fit-min-results">
                {results.slice(0, 6).map((fd) => (
                  <button key={fd.id} onClick={() => pickFood(fd)} className="w-full flex items-center gap-2 text-start px-3 py-2.5" data-testid={"fit-food-" + fd.id}>
                    <span className="flex-1 min-w-0 truncate text-[14px] text-slate-100">{ar && fd.ar ? fd.ar : fd.en}</span><span className="text-[12px] text-slate-400 tabular-nums">{fd.kcal} kcal/100g</span></button>))}
              </div> : null}
              {!text.trim() && !photo ? (() => {
                const recent = H.frequentChips(st.days, { limit: 8 }).map((c) => ({ key: c.key, item: c.item }));
                const favs = (st.favFoods || []).map((e) => ({ key: e.id, item: e.item }));
                const meals = (st.myMeals || []).map((m) => ({ key: m.id, item: { name: m.name, kcal: m.kcal }, items: m.items }));
                const lists = { recent, favs, meals };
                const tabsHere = [["recent", L("Recent", "الأخيرة")], ["favs", L("Favourites", "المفضلة")], ["meals", L("My meals", "وجباتي")]].filter(([k]) => k === "recent" || lists[k].length);
                const cur = lists[tabsHere.some(([k]) => k === addTab) ? addTab : "recent"];
                const add = (x) => { const its = x.items || [x.item]; logNow(adding, its.map((y) => ({ ...y })), L(`Added ${x.item.name} · ${r0(x.item.kcal)} kcal`, `أُضيف ${x.item.ar || x.item.name} · ${r0(x.item.kcal)} سعر`)); setAdding(null); };
                return <div>
                  {tabsHere.length > 1 ? <div className="flex gap-4 border-b border-slate-800 mb-1" role="tablist">{tabsHere.map(([k, lb]) => (
                    <button key={k} role="tab" aria-selected={addTab === k} onClick={() => setAddTab(k)} data-testid={"fit-add-tab-" + k}
                      className={"h-9 -mb-px text-[13.5px] border-b-2 " + (addTab === k ? "border-emerald-500 text-white font-semibold" : "border-transparent text-slate-400")}>{lb}</button>))}</div> : null}
                  {cur.length ? cur.slice(0, 8).map((x) => (
                    <div key={x.key} className="flex items-center gap-2 py-1.5" data-testid="fit-add-row">
                      <span className="flex-1 min-w-0"><span className="block truncate text-[14px] text-slate-100">{ar && x.item.ar ? x.item.ar : x.item.name}</span>
                        <span className="block text-[12px] text-slate-400 tabular-nums">{r0(x.item.kcal)} kcal{x.item.grams ? ` · ${x.item.grams} g` : ""}</span></span>
                      <button onClick={() => add(x)} aria-label={L("Add", "إضافة")} className="w-10 h-10 shrink-0 rounded-full bg-emerald-600 text-white grid place-items-center" data-testid="fit-add-row-plus"><Plus size={18} /></button>
                    </div>)) : <p className="text-[13px] text-slate-400 py-2">{L("What you log shows here — one tap to add it again.", "ما تسجله يظهر هنا — بضغطة لإضافته مرة أخرى.")}</p>}
                </div>;
              })() : null}
              <details data-testid="fit-add-more">
                <summary className="cursor-pointer select-none text-[13px] text-slate-400 flex items-center gap-1"><ChevronDown size={14} />{L("More", "المزيد")}</summary>
                <div className="space-y-2 mt-2">
                  <QuickLog {...{ L, ar, st, upd, adding, dayKey, flash }} toolsOnly addToDraft={(items) => setDraft((d) => [...(d || []), ...items.map((x) => ({ ...x }))])} />
                  <div className="flex flex-wrap gap-1.5">
                    {fetchJson && q.trim().length >= 2 ? <button onClick={searchOnline} disabled={searching} className="rounded-lg bg-slate-800 px-2.5 py-1 text-[12px] text-sky-300 flex items-center gap-1" data-testid="fit-search-online">{searching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}{L("Search millions of foods", "دوّر في ملايين الأكلات")}</button> : null}
                    {photo && !clipOn && photoClip ? <button disabled={!!fastDl} onClick={async () => { setFastDl(L("Downloading…", "جارٍ التنزيل…")); try { await photoClip.install((pct) => setFastDl(Math.round(pct || 0) + "%")); setClipOn(true); flash && flash(L("Fast photo recognition is ready", "التعرّف السريع جاهز")); } catch (e) { flash && flash(String((e && e.message) || e).slice(0, 100)); } finally { setFastDl(""); } }}
                      className="rounded-lg bg-slate-800 px-2.5 py-1 text-[12px] text-sky-300" data-testid="fit-fast-get">{fastDl || L("Faster photos (≈200 MB)", "صور أسرع (نحو 200 ميجابايت)")}</button> : null}
                  </div>
                </div>
              </details>
              {packBg ? <p className="text-[11.5px] text-emerald-300 flex items-center gap-1.5" data-testid="fit-pack-bg"><Loader2 size={12} className="animate-spin" />{L(`Getting the food database on Wi-Fi… ${(packBg.count || 0).toLocaleString("en")} foods so far`, `جارٍ تنزيل قاعدة الأطعمة على الواي فاي… ${(packBg.count || 0).toLocaleString("en")} طعام حتى الآن`)}</p> : null}
            </div>
          ) : !draft ? (<>
            {!photo && !text.trim() ? <LogBar {...{ t, L, ar, bar, listening, st }} onAgain={(item) => { logNow(adding, [item], L(`Added ${item.name} · ${r0(item.kcal)} kcal`, `أُضيف ${item.ar || item.name} · ${r0(item.kcal)} سعر`)); setAdding(null); }} /> : null}
            <QuickLog {...{ L, ar, st, upd, adding, dayKey, flash }} addToDraft={(items) => setDraft((d) => [...(d || []), ...items.map((x) => ({ ...x }))])} />
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} data-testid="fit-log-text"
              placeholder={L("What did you eat? e.g. 2 eggs, a loaf of baladi bread and a plate of ful", "ماذا أكلت؟ مثلًا: ٢ بيض ورغيف عيش وطبق فول")}
              className="w-full rounded-xl bg-slate-800 p-2.5 text-[14px] text-white placeholder:text-slate-500" />
            {photo && !busy && <div className="relative w-28"><img src={photo.url} className="rounded-lg w-28 h-28 object-cover" /><button onClick={() => setPhoto(null)} className="absolute top-1 right-1 rounded-full p-0.5" style={{ background: "rgba(0,0,0,.6)", color: "#fff" }}><X size={14} /></button></div>}
            {text.trim() || photo || busy ? <div className="flex gap-2">
              <button onClick={() => speak("text")} className={"rounded-xl px-3 py-2 text-[13px] flex items-center gap-1.5 shrink-0 " + (listening === "text" ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-200")} data-testid="fit-mic"><Mic size={16} />{listening === "text" ? L("Listening…", "أستمع…") : L("Say it", "تحدّث")}</button>
              <button onClick={() => fileRef.current && fileRef.current.click()} className="rounded-xl bg-slate-800 px-3 py-2 text-[13px] text-slate-200 flex items-center gap-1.5 shrink-0" data-testid="fit-photo"><Camera size={16} />{L("Photo", "صورة")}</button>
              {photo && !clipOn && photoClip ? <div className="w-full basis-full rounded-xl border border-sky-800 bg-sky-500/10 p-2 text-[12px] text-sky-100" data-testid="fit-fast-offer">
                {L("Photos take 20–30 s with the chat model. Get “Fast photo recognition” (≈200 MB, once) and a photo is read in a few seconds.", "تستغرق الصور 20–30 ثانية مع نموذج المحادثة. نزّل «التعرّف السريع على الصور» (نحو 200 ميجابايت مرة واحدة) لتُقرأ الصورة في ثوانٍ قليلة.")}
                <button disabled={!!fastDl} onClick={async () => { setFastDl(L("Downloading…", "جارٍ التنزيل…")); try { await photoClip.install((pct) => setFastDl(Math.round(pct || 0) + "%")); setClipOn(true); flash && flash(L("Fast photo recognition is ready", "التعرّف السريع جاهز")); } catch (e) { flash && flash(String((e && e.message) || e).slice(0, 100)); } finally { setFastDl(""); } }}
                  className="ms-2 rounded-lg bg-sky-500 text-slate-950 px-2.5 py-1 font-semibold" data-testid="fit-fast-get">{fastDl || L("Get it", "تنزيل")}</button></div> : null}
              <button onClick={readMeal} disabled={busy || (!text.trim() && !photo)} className="flex-1 rounded-xl bg-emerald-600 disabled:opacity-40 py-2 text-[14px] font-medium text-white flex items-center justify-center gap-1.5" data-testid="fit-read">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}{busy ? stage || L("Reading…", "جارٍ القراءة…") : L("Read it", "قراءة")}
              </button>
            </div> : null}
            <div className="relative">
              <Search size={15} className="absolute top-2.5 start-2.5 text-slate-500" />
              <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") searchOnline(); }} data-testid="fit-search" placeholder={L("Or search foods, brands or a barcode…", "أو ابحث عن طعام أو علامة تجارية أو باركود…")} className="w-full rounded-xl bg-slate-800 py-2 ps-8 pe-2 text-[14px] text-white placeholder:text-slate-500" />
            </div>
            {packBg ? <p className="text-[11.5px] text-emerald-300 flex items-center gap-1.5" data-testid="fit-pack-bg"><Loader2 size={12} className="animate-spin" />{L(`Getting the food database on Wi-Fi… ${(packBg.count || 0).toLocaleString("en")} foods so far`, `جارٍ تنزيل قاعدة الأطعمة على الواي فاي… ${(packBg.count || 0).toLocaleString("en")} طعام حتى الآن`)}</p> : null}
            <div className="flex gap-2">
              {fetchJson && q.trim().length >= 2 ? <button onClick={searchOnline} disabled={searching} className="flex-1 rounded-lg bg-sky-700 py-1.5 text-[12.5px] text-white flex items-center justify-center gap-1" data-testid="fit-search-online">{searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}{L("Search millions of foods", "دوّر في ملايين الأكلات")}</button> : null}
              {scanBarcode ? <button onClick={() => codeRef.current && codeRef.current.click()} disabled={searching} className="flex-1 rounded-lg bg-slate-800 py-1.5 text-[12.5px] text-slate-200 flex items-center justify-center gap-1" data-testid="fit-barcode"><Camera size={14} />{L("Scan a barcode", "صوّر الباركود")}</button> : null}
            </div>
            {results.map((fd) => (
              <button key={fd.id} onClick={() => pickFood(fd)} className="w-full flex justify-between gap-2 text-start rounded-lg px-2 py-1.5 hover:bg-slate-800" data-testid={"fit-food-" + fd.id}>
                <span className="text-[13.5px] text-slate-200 truncate">{ar && fd.ar ? fd.ar : fd.en}{fd.src === "off" ? <span className="ms-1 text-[10px] text-sky-300">{fd.egypt ? "🇪🇬 " : ""}{L("product", "منتج")}</span> : fd.src === "usda" ? <span className="ms-1 text-[10px] text-violet-300">USDA</span> : null}{fd.check ? <span className="ms-1 text-[10px] text-amber-300">{L("label may be wrong", "الملصق ممكن يكون غلط")}</span> : null}<Grades x={fd} L={L} /></span><span className="text-[12px] text-slate-500 shrink-0 tabular-nums">{fd.kcal} kcal/100g</span>
              </button>
            ))}
          </>) : (
            <div className="space-y-2" data-testid="fit-draft">
              {photo && draft.length ? <PhotoMarks look={look} url={photo.url} items={draft} L={L} ar={ar} /> : null}
              <div className="text-[12.5px] text-slate-400">{L("Check the amounts — change the grams if needed, then save.", "راجع الكميات — غيّر الجرامات عند الحاجة، ثم احفظ.")}</div>
              {refining ? <div className="text-[12px] text-sky-300 flex items-center gap-1.5" data-testid="fit-refining"><span className="inline-block w-2 h-2 rounded-full bg-sky-400 animate-pulse" />{L("The AI is double-checking the photo — you can save now.", "يراجع الذكاء الاصطناعي الصورة — يمكنك الحفظ الآن.")}</div> : null}
              {aiAlt && aiAlt.length ? <div className="rounded-xl bg-sky-500/10 border border-sky-800 p-2 text-[12.5px] text-sky-100" data-testid="fit-ai-alt">
                {L("The AI sees: ", "الذكاء الاصطناعي شايف: ")}<b>{aiAlt.map((x) => (ar && x.ar) || x.name).join(" · ")}</b>
                <div className="flex gap-2 mt-1.5"><button onClick={() => { setDraft(aiAlt); setAiAlt(null); }} className="rounded-lg bg-sky-500 text-slate-950 px-2.5 py-1 font-semibold">{L("Use this", "استخدام هذا")}</button><button onClick={() => setAiAlt(null)} className="rounded-lg bg-slate-800 px-2.5 py-1">{L("Keep mine", "الإبقاء على اختياري")}</button></div></div> : null}
              {busy && stage ? <div className="text-[12px] text-sky-300 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" />{stage}</div> : null}
              {(() => { const ask = AQ.askFirst(draft); return ask.length ? <div className="text-[12.5px] text-amber-200" data-testid="fit-ask-note">{L(`One tap each: how much is on your plate? (${ask.length})`, `ضغطة واحدة لكل صنف: كم الكمية في طبقك؟ (${ask.length})`)}</div> : null; })()}
              {(() => { pinNo.current = look === "night" && photo ? Object.fromEntries(LK.placeMarks(draft).marks.map((m, k) => [m.i, k + 1])) : {}; return null; })()}
              {draft.map((x, i) => (
                <div key={i} className={"rounded-lg bg-slate-800/70 px-2 py-1.5 space-y-1.5 " + (AQ.askFirst(draft).includes(i) ? "ring-1 ring-amber-500/70" : "")} data-testid="fit-draft-item">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] text-white truncate">
                        {x.conf != null ? <span className={"inline-block w-2 h-2 rounded-full me-1.5 " + (x.conf >= 0.75 ? "bg-emerald-400" : x.conf >= 0.5 ? "bg-amber-400" : "bg-rose-400")} title={L("how sure", "درجة التأكد")} /> : null}
                        {pinNo.current[i] ? <span className="inline-flex w-5 h-5 me-1.5 rounded-full bg-emerald-500 text-slate-950 text-[11px] font-extrabold items-center justify-center align-middle" data-testid="fit-pin-no">{pinNo.current[i]}</span> : null}
                        {ar && x.ar ? x.ar : x.name}
                        {x.hidden ? <span className="ms-1 text-[10.5px] text-sky-300" data-testid="fit-hidden">{L("easy to miss", "سهل يتنسي")}</span> : null}
                        {x.learned ? <span className="ms-1 text-[10.5px] text-violet-300">{L("as you corrected it", "كما صحّحته")}</span> : null}
                        {x.flag ? <span className="ms-1 text-[10.5px] text-amber-300" data-testid="fit-flag">{x.flag === "amount" ? L(`check the amount (${x.was} g written)`, `راجع الكمية (المكتوب ${x.was} جم)`) : L("check the portion", "راجع الكمية")}</span> : null}
                        {x.zoomed ? <span className="ms-1 text-[10.5px] text-sky-300">{L("looked closer", "اتبص عليها أقرب")}</span> : null}
                        {x.from === "photo-text" ? <span className="ms-1 text-[10.5px] text-emerald-300" data-testid="fit-as-printed">{L("calories as printed in the photo", "السعرات كما هي مكتوبة في الصورة")}</span> : null}
                        {x.estimate && <span className="ms-1 text-[10.5px] text-amber-300">{x.unknown ? L("unknown", "غير معروف") : L("estimate", "تقدير")}</span>}
                        {x.check ? <span className="ms-1 text-[10.5px] text-amber-300">{L("label may be wrong", "الملصق ممكن يكون غلط")}</span> : null}
                        <Grades x={x} L={L} />
                      </div>
                      <Macros L={L} x={x} className="mt-0.5" />
                    </div>
                    {x.quick ? null : <><input type="number" inputMode="numeric" value={x.grams} onChange={(e) => setGrams(i, e.target.value)} className="w-16 min-h-[38px] rounded bg-slate-900 px-1.5 py-1 text-[14px] text-white text-end" data-testid="fit-draft-grams" />
                    <span className="text-[11px] text-slate-500">{L("g", "جم")}</span></>}
                    {x.id ? <button onClick={() => { const on = P.isFav(st.favFoods, x.id); upd((s) => ({ ...s, favFoods: P.toggleFav(s.favFoods, x) })); flash && flash(on ? L("Removed from favorites", "أُزيلت من المفضلة") : L(`★ ${x.name} — ${x.grams} g, one tap next time`, `★ ${x.ar || x.name} — ${x.grams} جم، ضغطة واحدة في المرة القادمة`)); }}
                      className={"min-h-[40px] min-w-[36px] grid place-items-center " + (P.isFav(st.favFoods, x.id) ? "text-amber-300" : "text-slate-500")} data-testid="fit-fav-toggle" aria-label={L("Favorite", "مفضلة")}><Star size={17} fill={P.isFav(st.favFoods, x.id) ? "currentColor" : "none"} /></button> : null}
                    <button onClick={() => setDraft((d) => d.filter((_, k) => k !== i))} className="text-slate-500 min-h-[40px] min-w-[36px] grid place-items-center" aria-label={L("Remove", "إزالة")} data-testid="fit-draft-remove"><Trash2 size={17} /></button>
                  </div>
                  {(x.alts && x.alts.length > 1) || x.from === "text" ? (
                    <div className="flex flex-wrap gap-1" data-testid="fit-alts">
                      <span className="text-[11px] text-slate-500 self-center">{L("Is it:", "هل هو:")}</span>
                      {(x.alts || []).map((a, k) => a.food ? <button key={k} onClick={() => chooseAt(i, a.food)} className={"rounded-full px-2 py-0.5 text-[11.5px] " + (a.food.id === x.id ? "bg-emerald-700 text-white" : "bg-slate-900 text-slate-300")} data-testid="fit-alt">{ar && a.food.ar ? a.food.ar : a.food.en}</button> : null)}
                      <button onClick={() => { setReplaceAt(i); setDraft((d) => d); }} className="rounded-full px-2 py-0.5 text-[11.5px] bg-slate-900 text-sky-300" data-testid="fit-alt-other">{L("something else…", "شيء آخر…")}</button>
                    </div>) : null}
                  {(() => { const aq = x.from === "text" ? null : AQ.amountQuestion(x); if (!aq) return null;
                    return <div className="flex flex-wrap gap-1 items-center" data-testid="fit-amount">
                      <span className="text-[11.5px] text-amber-200 me-0.5">{L(aq.en.replace(/ \(.*\)$/, ""), aq.ar.replace(/ \(.*\)$/, ""))}</span>
                      {aq.choices.map((c, k) => <button key={k} onClick={() => setDraft((d) => d.map((y, j) => (j === i ? AQ.answerAmount(y, c.grams) : y)))}
                        className={"rounded-full px-2.5 py-1 text-[12px] " + (x.answered && k === aq.at ? "bg-amber-500 text-slate-950 font-semibold" : k === aq.at ? "bg-slate-700 text-white" : "bg-slate-900 text-slate-300")} data-testid="fit-amount-choice">{L(c.en, c.ar)}</button>)}
                    </div>; })()}
                  {x.base && (x.from === "text" || !AQ.amountQuestion(x)) ? (
                    <div className="flex flex-wrap gap-1" data-testid="fit-portions">
                      {[0.5, 0.75, 1, 1.5, 2].map((k) => <button key={k} onClick={() => scaleAt(i, k)} className={"rounded min-w-[40px] min-h-[34px] px-2 py-0.5 text-[12px] " + ((x.k || 1) === k ? "bg-sky-700 text-white" : "bg-slate-900 text-slate-300")} data-testid={"fit-portion-" + k}>{k === 1 ? (x.from === "text" ? L("as written", "كما كتبت") : L("as seen", "كما في الصورة")) : "×" + k}</button>)}
                    </div>) : null}
                </div>
              ))}
              {replaceAt >= 0 ? (
                <div className="space-y-1" data-testid="fit-replace">
                  <div className="relative"><Search size={15} className="absolute top-2.5 start-2.5 text-slate-500" />
                    <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") searchOnline(); }} placeholder={L("What is it really?", "ما هو بالتحديد؟")} className="w-full rounded-xl bg-slate-900 py-2 ps-8 pe-2 text-[14px] text-white placeholder:text-slate-500" data-testid="fit-replace-q" /></div>
                  {results.map((fd) => <button key={fd.id} onClick={() => pickFood(fd)} className="w-full flex justify-between gap-2 text-start rounded-lg px-2 py-1.5 hover:bg-slate-800" data-testid={"fit-food-" + fd.id}><span className="text-[13px] text-slate-200 truncate">{ar && fd.ar ? fd.ar : fd.en}</span><span className="text-[11.5px] text-slate-500 shrink-0">{fd.kcal} kcal/100g</span></button>)}
                </div>) : null}
              <div className="flex gap-2" data-testid="fit-cmd-row">
                <input value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && cmd.trim()) runCmd(); }} placeholder={L("Change something: “remove the cola”, “rice 200 g”…", "عدّل شيئًا: «شيل البيبسي»، «الرز ٢٠٠ جرام»…")}
                  className="flex-1 min-w-0 rounded-lg bg-slate-900 px-2 py-1.5 text-[13px] text-white placeholder:text-slate-500" data-testid="fit-cmd" />
                <button onClick={() => speak("cmd")} aria-label={L("Say it", "قلها")} className={"rounded-lg min-w-[44px] grid place-items-center px-2.5 " + (listening === "cmd" ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-300")} data-testid="fit-cmd-mic"><Mic size={15} /></button>
                <button onClick={() => cmd.trim() && runCmd()} className="rounded-lg bg-sky-700 px-3 text-[12.5px] text-white" data-testid="fit-cmd-go">{L("Do it", "نفّذ")}</button>
              </div>
              {cmdNote ? <div className="text-[12px] text-sky-300" data-testid="fit-cmd-note">{cmdNote}</div> : null}
              {draft.length ? <SaveMyMeal {...{ L, draft, upd, flash }} /> : null}
              {/* the Save button stays in reach above Fit's bottom bar however long the list is */}
              <div className="flex gap-2 sticky z-10 -mx-3 px-3 py-2 bg-slate-900" style={{ bottom: minimal ? "env(safe-area-inset-bottom)" : "calc(92px + env(safe-area-inset-bottom))" }} data-testid="fit-save-bar">
                <button onClick={() => setDraft(null)} className="rounded-xl bg-slate-800 px-3 py-2.5 text-[13px] text-slate-300">{L("Back", "رجوع")}</button>
                <button onClick={confirm} disabled={!draft.length} className="flex-1 rounded-xl bg-emerald-600 disabled:opacity-40 py-2.5 text-[14px] font-medium text-white flex items-center justify-center gap-1.5" data-testid="fit-confirm"><Check size={16} />{L("Save", "حفظ")} · {F.sumN(draft.filter((x) => x.kcal != null)).kcal} {L("kcal", "سعرة")}</button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {tab === "today" && !adding && <Today {...{ L, t, ar, st, upd, tg: tg && st.profile.cycleExtra ? { ...tg, kcal: Y.dayGoal(tg.kcal, dayKey, st.profile.cycleExtra) } : tg, tot, day, dayKey, setDayKey, setDay, setAdding, addItems, logNow, setUndo, tick, flash, health, bar, listening, scanBarcode, minimal, openMove: () => setTab("move") }} />}
      {undo ? (
        <div role="status" aria-live="polite" className="att-shift fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 pointer-events-none" data-testid="fit-undo-bar">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-slate-800 border border-slate-700 ps-4 pe-1 py-1 shadow-xl max-w-md w-full motion-safe:animate-[fitup_.2s_ease-out]">
            <Check size={16} className="text-emerald-300 shrink-0" />
            <span className="flex-1 min-w-0 truncate text-[13.5px] text-white" data-testid="fit-undo-text">{undo.label}</span>
            <button onClick={() => { undo.revert(); setUndo(null); }} className="min-h-[48px]! px-4 rounded-xl text-[14px] font-semibold text-emerald-300 flex items-center gap-1.5" data-testid="fit-undo"><Undo2 size={16} />{t("Undo")}</button>
          </div>
        </div>) : null}
      {tab === "recipes" && !adding && <Recipes {...{ L, ar, st, upd, tg, addItems, llm, modelReady, openEngine, flash, share, pro, openPlan }} />}
      {tab === "move" && !adding && <><WatchCard {...{ L, ar, health, st, upd, dayKey }} /><Move {...{ L, ar, tg, setDay, llm, modelReady, openEngine, flash, kg: +st.profile.kg }} /></>}
      {tab === "progress" && !adding && (() => {
        const top = <>
          <DayQuality {...{ L, day, tg }} isToday={dayKey === F.today()} />
          <Micros {...{ L, ar, day, sex: (st.profile || {}).sex }} />
          {F.dayTips(tot, tg, ar ? "ar" : "en").map((tp, i) => <div key={i} className="rounded-xl bg-amber-500/10 border border-amber-800 px-3 py-2 text-[12.5px] text-amber-100">{tp}</div>)}
        </>;
        // v6.32 minimal: today's quality, vitamins and tips go under "More" with the rest
        return minimal ? <Progress {...{ L, ar, st, upd, tg, pro, openPlan, share, minimal }} extraTop={top} /> : <>{top}<Progress {...{ L, ar, st, upd, tg, pro, openPlan, share }} /></>;
      })()}
      {tab === "me" && !adding && <MeTab {...{ L, ar, st, tg, openPlanForm: () => setEditProfile(true), openMove: () => setTab("move") }} settings={<FitSettings {...{ L, ar, st, upd, native, flash, packText, photoClip }} onClip={setClipOn} />} />}
    </div>
  );
}

/* v6.16c (Ali picked look A, the diary app): every way of logging lives in the «+» panel — Photo · Barcode · Say it · Search,
   then the meals eaten before at their usual portion, one tap each. */
function LogBar({ t, L, ar, bar, listening, st, onAgain }) {
  const chips = useMemo(() => H.frequentChips(st.days, { limit: 8 }), [st.days]);
  const nm = (x) => (ar && x.ar ? x.ar : x.name);
  const Act = ({ k, Ic, label, primary }) => (
    <button onClick={bar[k]} data-testid={"fit-lb-" + k} aria-label={label}
      className={"min-h-[56px]! rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[12.5px] font-medium active:scale-[.97] motion-safe:transition-transform " + (primary ? "bg-emerald-600 text-white" : listening && k === "voice" ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-100")}>
      <Ic size={19} aria-hidden="true" /><span>{label}</span></button>);
  return (<>
    <div className="grid grid-cols-4 gap-2" data-testid="fit-logbar" role="group" aria-label={t("Log a meal")}>
      <Act k="photo" Ic={Camera} label={L("Photo", "صورة")} primary />
      <Act k="barcode" Ic={Barcode} label={t("Barcode")} />
      <Act k="voice" Ic={Mic} label={listening ? L("Listening…", "أستمع…") : L("Say it", "تحدّث")} />
      <Act k="search" Ic={Search} label={t("Search")} />
    </div>
    {chips.length ? (
      <section aria-labelledby="fit-chips-h">
        <h3 id="fit-chips-h" className="text-[11.5px] uppercase tracking-wide text-slate-500 mb-1.5">{t("One tap to add again")}</h3>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" data-testid="fit-chips">
          {chips.map((c) => (
            <button key={c.key} onClick={() => onAgain(c.item)} data-testid={"fit-chip-" + c.key.replace(/[^a-z0-9]+/gi, "_")}
              className="shrink-0 min-h-[48px]! rounded-full bg-slate-800 border border-slate-700 px-3.5 text-[13px] text-slate-100 flex items-center gap-1.5 active:scale-[.97] motion-safe:transition-transform"
              aria-label={L(`Add ${c.item.name}, ${c.item.grams} g, ${r0(c.item.kcal)} kcal`, `أضف ${c.item.ar || c.item.name}، ${c.item.grams} جم، ${r0(c.item.kcal)} سعر`)}>
              <Plus size={15} className="text-emerald-300" aria-hidden="true" /><span className="max-w-[10rem] truncate">{nm(c.item)}</span><span className="text-slate-400 tabular-nums">· {r0(c.item.kcal)}</span>
            </button>))}
        </div>
      </section>) : null}
  </>);
}

/** v6.16c — «Me»: your plan at a glance (change it), workouts, and the settings (food database, photo recognition, watch…). */
function MeTab({ L, ar, st, tg, openPlanForm, openMove, settings }) {
  const pf = st.profile || {};
  const goal = { lose: L("Lose weight", "إنقاص الوزن"), maintain: L("Keep my weight", "الحفاظ على وزني"), gain: L("Gain muscle", "بناء العضلات") }[pf.goal] || "";
  return (
    <div className="space-y-3 lg:space-y-0 lg:columns-2 lg:gap-6 lg:[&>*]:break-inside-avoid lg:[&>*]:mb-4" data-testid="fit-me">
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4 space-y-2">
        <div className="text-[12px] text-slate-400">{L("My plan", "خطتي")}{goal ? " · " + goal : ""}</div>
        {tg ? <div className="text-[22px] font-semibold text-white tabular-nums" data-testid="fit-me-kcal">{tg.kcal} <span className="text-[13px] font-normal text-slate-400">{L("kcal a day", "سعر في اليوم")}</span></div> : null}
        {tg ? <div className="text-[12.5px] text-slate-300 tabular-nums">{L("Protein", "بروتين")} {tg.protein} g · {L("Water", "ماء")} {(tg.water / 1000).toFixed(1)} L{pf.kg ? ` · ${pf.kg} kg` : ""}</div> : null}
        <button onClick={openPlanForm} className="w-full min-h-[48px] rounded-xl bg-emerald-600 text-white font-medium" data-testid="fit-edit-profile">{L("Change my plan", "تعديل خطتي")}</button>
      </div>
      <button onClick={openMove} className="w-full min-h-[52px] rounded-2xl bg-slate-900/70 border border-slate-800 px-4 text-start text-white flex items-center gap-2" data-testid="fit-me-move"><Dumbbell size={17} className="text-emerald-300" />{L("Workouts and steps", "التمارين والخطوات")}</button>
      <div className="text-[11.5px] uppercase tracking-wide text-slate-500 pt-1">{L("Settings", "الإعدادات")}</div>
      {settings}
    </div>
  );
}

function ProfileForm({ pf, setPf, save, L, cancel, extra }) {
  const set = (k, v) => setPf((p) => ({ ...p, [k]: v }));
  const tg = H.targetsOf(pf);
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
      <p className="text-[12.5px] text-slate-400">{L("Your daily calories and protein are worked out by the Mifflin-St Jeor formula — the one dietitians use. Everything stays on your phone.", "تُحسب السعرات والبروتين بمعادلة ميفلين-سان جيور التي يستخدمها أخصائيو التغذية. ويبقى كل شيء على هاتفك.")}</p>
      {Sel("sex", [["m", L("Male", "ذكر")], ["f", L("Female", "أنثى")]])}
      <div className="flex gap-2">{Num("age", L("Age", "العمر"))}{Num("cm", L("Height (cm)", "الطول (سم)"))}{Num("kg", L("Weight (kg)", "الوزن (كجم)"))}</div>
      <div className="text-[12px] text-slate-400">{L("How active are you?", "ما مستوى نشاطك؟")}</div>
      {Sel("activity", [["sedentary", L("Desk, little walking", "مكتب، مشي قليل")], ["light", L("Light", "خفيف")], ["moderate", L("Moderate", "متوسط")], ["active", L("Active", "نشيط")], ["very", L("Very active", "نشيط جداً")]])}
      <div className="text-[12px] text-slate-400">{L("Goal", "الهدف")}</div>
      {Sel("goal", [["lose", L("Lose weight", "إنقاص الوزن")], ["maintain", L("Keep my weight", "الحفاظ على وزني")], ["gain", L("Gain muscle", "بناء العضلات")]])}
      {pf.goal !== "maintain" && <div className="flex gap-2">{Num("goalKg", L("Goal weight (kg)", "الوزن المطلوب (كجم)"))}
        <label className="flex-1 text-[12px] text-slate-400">{L("Pace (kg a week)", "السرعة (كجم في الأسبوع)")}
          <select value={pf.rate} onChange={(e) => set("rate", +e.target.value)} className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-[14px] text-white">{[0.25, 0.5, 0.75, 1].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        </label></div>}
      <div className="text-[12px] text-slate-400">{L("Eating style", "نظام الأكل")}</div>
      {Sel("diet", Object.entries(F.DIETS).map(([k, en]) => [k, L(en, { balanced: "متوازن", "high-protein": "بروتين عالي", "low-carb": "كارب قليل", keto: "كيتو", vegetarian: "نباتي" }[k])]))}
      <label className="block text-[12px] text-slate-400">{L("My own daily calorie target (optional)", "هدفي اليومي من السعرات (اختياري)")}
        <input type="number" inputMode="numeric" value={pf.kcalGoal || ""} onChange={(e) => set("kcalGoal", e.target.value)} data-testid="fit-pf-kcalGoal" className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-[14px] text-white" /></label>
      {pf.sex === "f" && <label className="flex items-center gap-2 text-[13px] text-slate-300"><input type="checkbox" checked={!!pf.pregnant} onChange={(e) => set("pregnant", e.target.checked)} />{L("Pregnant or breastfeeding", "حامل أو مُرضِع")}</label>}
      {tg && (
        <div className="rounded-xl border border-emerald-800 bg-emerald-500/10 p-3 text-[13px] text-emerald-100 space-y-1" data-testid="fit-pf-result">
          <div className="text-[15px] font-semibold">{tg.kcal} kcal · {L("protein", "بروتين")} {tg.protein} g · {L("water", "ماء")} {(tg.water / 1000).toFixed(1)} L</div>
          {tg.bmi ? <div className="text-emerald-200/80">BMI {tg.bmi} · {L("burns", "تحرق")} ~{tg.tdee} kcal/{L("day", "يوم")}{tg.weeks ? ` · ${L("goal in", "الهدف خلال")} ~${tg.weeks} ${L("weeks", "أسبوع")}` : ""}</div> : null}
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

/* v6.10 (item 14) — the first visit: 3 questions instead of the long plan form (that stays under «My plan»). */
function QuickSetup({ t, L, ar, save, full }) {
  const [a, setA] = useState({ goal: "", mode: "body", sex: "m", age: "", cm: "", kg: "", kcal: "", country: F.getCountry() });
  const [step, setStep] = useState(0);
  const [intro, setIntro] = useState(true);    // v6.16c (Ali: "I want the introduction like any food app"): a welcome first…
  const [plan, setPlan] = useState(null);      // …and the plan it makes, shown before the diary opens
  const set = (k, v) => setA((p) => ({ ...p, [k]: v }));
  const Pick = ({ k, v, children, tid }) => (
    <button onClick={() => set(k, v)} aria-pressed={a[k] === v} data-testid={tid}
      className={"min-h-[48px]! rounded-xl px-4 text-[14px] text-start transition-colors " + (a[k] === v ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-200")}>{children}</button>);
  const Num = (k, label) => (
    <label key={k} className="flex-1 min-w-0 text-[12px] text-slate-400">{label}
      <input type="number" inputMode="decimal" value={a[k]} onChange={(e) => set(k, e.target.value)} data-testid={"fit-qs-" + k} className="mt-1 w-full min-h-[48px]! rounded-xl bg-slate-800 px-3 text-[15px] text-white" />
    </label>);
  const can = step === 0 ? !!a.goal : step === 1 ? (a.mode === "kcal" ? +a.kcal > 0 : +a.age > 0 && +a.cm > 0 && +a.kg > 0) : true;
  const next = () => { if (step < 2) { setStep(step + 1); return; } const r = H.quickProfile(a); if (r.error) { save(a); return; } setPlan(H.targetsOf(r.profile)); };
  const countries = useMemo(() => Object.entries(F.COUNTRIES).sort((x, y) => (ar ? x[1].ar.localeCompare(y[1].ar, "ar") : x[1].en.localeCompare(y[1].en))), [ar]);
  if (intro) return (
    <div className="max-w-md lg:max-w-xl att-keep mx-auto px-4 py-6 lg:py-10 space-y-5" data-testid="fit-qs-welcome">
      <div className="h-40 rounded-3xl bg-gradient-to-br from-emerald-700/50 via-slate-900 to-slate-950 border border-emerald-900 flex items-center justify-center" aria-hidden="true"><Apple size={64} className="text-emerald-300" /></div>
      <div className="space-y-2">
        <h2 className="text-[24px] leading-tight font-semibold text-white">{t("Welcome to Fit & Food")}</h2>
        <p className="text-[14px] text-slate-300">{L("Count what you eat without the work: snap your plate or a menu, scan a barcode, or just type “2 eggs and a loaf of bread”.", "احسب ما تأكله بلا تعب: صوّر طبقك أو قائمة الطعام، أو امسح الباركود، أو اكتب «بيضتان ورغيف خبز».")}</p>
      </div>
      <ul className="space-y-2 text-[13.5px] text-slate-200">
        <li className="flex gap-2.5 items-start"><Camera size={18} className="text-emerald-300 shrink-0 mt-0.5" />{L("Photos, barcodes and your voice — the calories are worked out for you", "الصور والباركود وصوتك — والسعرات تُحسب لك")}</li>
        <li className="flex gap-2.5 items-start"><Sparkles size={18} className="text-emerald-300 shrink-0 mt-0.5" />{L("A daily target made for your body and goal", "هدف يومي مصمَّم لجسمك وهدفك")}</li>
        <li className="flex gap-2.5 items-start"><Check size={18} className="text-emerald-300 shrink-0 mt-0.5" />{L("Everything stays on your phone", "كل شيء يبقى على هاتفك")}</li>
      </ul>
      <button onClick={() => setIntro(false)} className="w-full min-h-[52px]! rounded-2xl bg-emerald-600 text-[16px] font-semibold text-white" data-testid="fit-qs-start">{L("Get started", "ابدأ")}</button>
      <p className="text-center text-[12px] text-slate-500">{L("Takes under a minute · you can change it later in Me", "أقل من دقيقة · ويمكنك تغييره لاحقًا من «أنا»")}</p>
    </div>
  );
  if (plan) return (
    <div className="max-w-md lg:max-w-xl att-keep mx-auto px-4 py-6 lg:py-10 space-y-5" data-testid="fit-qs-plan">
      <h2 className="text-[22px] font-semibold text-white">{L("Your plan is ready", "خطتك جاهزة")}</h2>
      <div className="rounded-3xl bg-emerald-500/10 border border-emerald-800 p-5 text-center space-y-1">
        <div className="text-[13px] text-emerald-200">{L("Your daily target", "هدفك اليومي")}</div>
        <div className="text-[44px] leading-none font-bold text-white tabular-nums" data-testid="fit-qs-kcal">{plan.kcal}</div>
        <div className="text-[13px] text-slate-300">{L("calories a day", "سعرة في اليوم")}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3"><div className="text-[20px] font-semibold text-white tabular-nums">{plan.protein} g</div><div className="text-[12px] text-slate-400">{L("protein", "بروتين")}</div></div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3"><div className="text-[20px] font-semibold text-white tabular-nums">{(plan.water / 1000).toFixed(1)} L</div><div className="text-[12px] text-slate-400">{L("water", "ماء")}</div></div>
      </div>
      {plan.weeks ? <p className="text-[13px] text-slate-300 text-center">{L(`At this pace you reach your goal in about ${plan.weeks} weeks.`, `بهذا المعدل تصل إلى هدفك في نحو ${plan.weeks} أسبوعًا.`)}</p> : null}
      <div className="flex gap-2">
        <button onClick={() => setPlan(null)} className="min-h-[52px]! rounded-2xl bg-slate-800 px-4 text-slate-300" data-testid="fit-qs-back">{L("Back", "رجوع")}</button>
        <button onClick={() => save(a)} className="flex-1 min-h-[52px]! rounded-2xl bg-emerald-600 text-[16px] font-semibold text-white" data-testid="fit-qs-next">{t("Start logging")}</button>
      </div>
    </div>
  );
  return (
    <div className="max-w-md lg:max-w-xl att-keep mx-auto px-4 py-5 lg:py-10 space-y-4" data-testid="fit-qs">
      <div className="flex items-center gap-2">
        <Apple size={19} className="text-emerald-300" /><h2 className="text-lg font-semibold text-white flex-1">{t("Welcome to Fit & Food")}</h2>
        <span className="text-[12px] text-slate-400 tabular-nums" data-testid="fit-qs-step">{step + 1}/3</span>
      </div>
      <div className="flex gap-1" aria-hidden="true">{[0, 1, 2].map((i) => <div key={i} className={"h-1 flex-1 rounded-full " + (i <= step ? "bg-emerald-500" : "bg-slate-800")} />)}</div>
      {step === 0 ? (<section className="space-y-2" aria-labelledby="qs0">
        <h3 id="qs0" className="text-[16px] text-white font-medium">{t("What is your goal?")}</h3>
        <div className="grid gap-2">
          <Pick k="goal" v="lose" tid="fit-qs-goal-lose">{L("Lose weight", "إنقاص الوزن")}</Pick>
          <Pick k="goal" v="maintain" tid="fit-qs-goal-maintain">{L("Keep my weight", "الحفاظ على وزني")}</Pick>
          <Pick k="goal" v="gain" tid="fit-qs-goal-gain">{L("Gain muscle", "بناء العضلات")}</Pick>
        </div>
      </section>) : step === 1 ? (<section className="space-y-3" aria-labelledby="qs1">
        <h3 id="qs1" className="text-[16px] text-white font-medium">{t("About you")}</h3>
        <div className="grid grid-cols-2 gap-2">
          <Pick k="mode" v="body" tid="fit-qs-mode-body">{t("Height, weight, age")}</Pick>
          <Pick k="mode" v="kcal" tid="fit-qs-mode-kcal">{t("Just a calorie target")}</Pick>
        </div>
        {a.mode === "kcal" ? Num("kcal", t("Calories a day")) : (<>
          <div className="grid grid-cols-2 gap-2"><Pick k="sex" v="m" tid="fit-qs-sex-m">{L("Male", "ذكر")}</Pick><Pick k="sex" v="f" tid="fit-qs-sex-f">{L("Female", "أنثى")}</Pick></div>
          <div className="flex gap-2">{Num("age", L("Age", "العمر"))}{Num("cm", L("Height (cm)", "الطول (سم)"))}{Num("kg", L("Weight (kg)", "الوزن (كجم)"))}</div>
        </>)}
      </section>) : (<section className="space-y-2" aria-labelledby="qs2">
        <h3 id="qs2" className="text-[16px] text-white font-medium">{t("Whose food do you eat?")}</h3>
        <p className="text-[12.5px] text-slate-400">{L("Suggestions, food search, typed meals and photos use this country's dishes first.", "تبدأ الاقتراحات والبحث والوجبات المكتوبة والصور بأطعمة هذا البلد.")}</p>
        <select value={a.country} onChange={(e) => set("country", e.target.value)} data-testid="fit-qs-country" aria-labelledby="qs2" className="w-full min-h-[48px]! rounded-xl bg-slate-800 px-3 text-[15px] text-white">
          {countries.map(([k, c]) => <option key={k} value={k}>{c.flag} {ar ? c.ar : c.en}</option>)}
        </select>
      </section>)}
      <div className="flex gap-2 pt-1">
        {step > 0 ? <button onClick={() => setStep(step - 1)} className="min-h-[48px]! rounded-xl bg-slate-800 px-4 text-slate-300" data-testid="fit-qs-back">{L("Back", "رجوع")}</button> : null}
        <button onClick={next} disabled={!can} className="flex-1 min-h-[48px]! rounded-xl bg-emerald-600 disabled:opacity-40 font-medium text-white" data-testid="fit-qs-next">{t("Next")}</button>
      </div>
      <button onClick={full} className="w-full min-h-[48px]! text-[13px] text-slate-400 underline" data-testid="fit-qs-full">{t("Set up the full plan instead (activity, pace, eating style)")}</button>
    </div>
  );
}

/** One logged food on the timeline: swipe it sideways for Edit and Delete (the buttons are also reachable by keyboard). */
function LogRow({ t, ar, x, onDelete, onEdit, onCopy, testid }) {
  const [dx, setDx] = useState(0), [open, setOpen] = useState(false);
  const start = useRef(null);
  const dir = ar ? 1 : -1;   // the actions sit at the end side: left in English, right in Arabic
  const W = 168;             // v6.23: Copy · Edit · Delete
  const onDown = (e) => { start.current = { x: e.clientX, y: e.clientY, dx: open ? dir * W : 0, moved: false }; };
  const onMove = (e) => { const s = start.current; if (!s) return; const mx = e.clientX - s.x; if (!s.moved && Math.abs(mx) < 8) return; if (!s.moved && Math.abs(e.clientY - s.y) > Math.abs(mx)) { start.current = null; return; } if (!s.moved) { try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {} } s.moved = true; setDx(Math.max(-W, Math.min(W, s.dx + mx)) * (dir * Math.sign(s.dx + mx) >= 0 ? 1 : 0)); };
  const onUp = () => { const s = start.current; start.current = null; if (!s || !s.moved) return; const o = Math.abs(dx) > 50; setOpen(o); setDx(0); };
  const tm = x.t ? new Date(x.t) : null;
  const time = tm && x.t > 1e11 ? String(tm.getHours()).padStart(2, "0") + ":" + String(tm.getMinutes()).padStart(2, "0") : "";
  const shown = open ? dir * W : dx;
  const act = (fn) => () => { setOpen(false); fn(); };
  return (
    <div className="relative overflow-hidden rounded-lg" data-testid={testid}>
      <div className="absolute inset-y-0 end-0 flex" aria-hidden={!open} style={{ visibility: open || dx !== 0 ? "visible" : "hidden" }}>
        <button tabIndex={open ? 0 : -1} onClick={act(onCopy)} className="w-14 bg-slate-600 text-white flex items-center justify-center" aria-label={ar ? "نسخ" : "Copy"} data-testid="fit-row-copy"><Copy size={16} /></button>
        <button tabIndex={open ? 0 : -1} onClick={act(onEdit)} className="w-14 bg-sky-700 text-white flex items-center justify-center" aria-label={t("Edit")} data-testid="fit-row-edit"><Pencil size={16} /></button>
        <button tabIndex={open ? 0 : -1} onClick={act(onDelete)} className="w-14 bg-rose-600 text-white flex items-center justify-center" aria-label={t("Delete")} data-testid="fit-row-delete"><Trash2 size={16} /></button>
      </div>
      <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} style={{ transform: `translateX(${shown}px)`, touchAction: "pan-y" }}
        className={"relative bg-slate-900 flex items-center gap-2 min-h-[48px]! px-1 text-[13.5px] " + (start.current ? "" : "motion-safe:transition-transform motion-safe:duration-200")}>
        <span className="w-11 shrink-0 text-[11.5px] text-slate-500 tabular-nums">{time}</span>
        <span className="flex-1 min-w-0 truncate text-slate-200">{ar && x.ar ? x.ar : x.name} <span className="text-slate-500 tabular-nums">{x.grams} {ar ? "جم" : "g"}</span></span>
        <span className="text-slate-400 tabular-nums shrink-0">{r0(x.kcal)}</span>
        <button onClick={() => setOpen((o) => !o)} className="min-h-[44px] min-w-[36px] text-slate-500 flex items-center justify-center shrink-0" aria-label={t("Edit or delete")} aria-expanded={open} data-testid="fit-row-more"><ChevronLeft size={16} className={ar ? "rotate-180" : ""} /></button>
      </div>
    </div>
  );
}

/* v6.23 — edit everything about a logged food (Ali: "I can't edit anything after I press save except the grams"):
   name, grams (the numbers follow), calories and macros typed in, and which meal it is in. */
function EditFood({ L, ar, x, meal, onClose, onSave }) {
  const s1 = (v) => (v == null ? "" : String(Math.round(v * 10) / 10));
  const numsOf = (y) => ({ kcal: y.kcal == null ? "" : String(Math.round(y.kcal)), p: s1(y.p), c: s1(y.c), f: s1(y.f), fib: s1(y.fib) });
  const [name, setName] = useState(ar && x.ar ? x.ar : x.name);
  const [base, setBase] = useState(x);                    // what the grams scale from (typed numbers included)
  const [gs, setGs] = useState(String(x.grams || ""));
  const [nums, setNums] = useState(numsOf(x));
  const [to, setTo] = useState(meal);
  const onGrams = (v) => { setGs(v); if (+v > 0) setNums(numsOf(H.atGrams(base, +v))); };
  const onNum = (k, v) => {
    const n2 = { ...nums, [k]: v }; setNums(n2);
    if (+gs > 0) { const z = { ...base, grams: +gs }; for (const q of ["kcal", "p", "c", "f", "fib"]) if (n2[q] !== "" && isFinite(+n2[q])) z[q] = +n2[q]; setBase(z); }
  };
  const ok = +gs > 0 && String(name).trim();
  const Num = ({ k, label }) => (
    <label className="flex-1 min-w-0 text-[11.5px] text-slate-400">{label}
      <input type="number" inputMode="decimal" value={nums[k]} onChange={(e) => onNum(k, e.target.value)} className="mt-0.5 w-full min-h-[44px] rounded-lg bg-slate-800 border border-slate-700 px-2 text-end text-white tabular-nums" data-testid={"fit-edit-" + k} />
    </label>);
  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-end" onClick={onClose}>
      <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-2xl bg-slate-900 border-t border-slate-700 p-4 space-y-3" onClick={(e) => e.stopPropagation()} data-testid="fit-edit-sheet">
        <div className="flex items-center justify-between gap-2">
          <div className="text-white font-medium">{L("Edit food", "تعديل الطعام")}</div>
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400" aria-label={L("Close", "إغلاق")}><X size={18} /></button>
        </div>
        <label className="block text-[11.5px] text-slate-400">{L("Name", "الاسم")}
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-0.5 w-full min-h-[44px] rounded-lg bg-slate-800 border border-slate-700 px-2 text-white" data-testid="fit-edit-name" />
        </label>
        <div className="flex gap-2">
          <label className="flex-1 min-w-0 text-[11.5px] text-slate-400">{L("Amount (g)", "الكمية (جم)")}
            <input type="number" inputMode="numeric" value={gs} onChange={(e) => onGrams(e.target.value)} className="mt-0.5 w-full min-h-[44px] rounded-lg bg-slate-800 border border-slate-700 px-2 text-end text-white tabular-nums" data-testid="fit-row-grams" />
          </label>
          {Num({ k: "kcal", label: L("Calories", "السعرات") })}
        </div>
        <div className="flex gap-2">
          {Num({ k: "p", label: L("Protein g", "بروتين جم") })}
          {Num({ k: "c", label: L("Carbs g", "كربوهيدرات جم") })}
          {Num({ k: "f", label: L("Fat g", "دهون جم") })}
          {Num({ k: "fib", label: L("Fibre g", "ألياف جم") })}
        </div>
        <div className="text-[11.5px] text-slate-500">{L("Changing the amount changes the numbers with it. You can also type the numbers from the label.", "تغيير الكمية يغيّر الأرقام معها. ويمكنك كتابة الأرقام من الملصق.")}</div>
        <div>
          <div className="text-[11.5px] text-slate-400 mb-1">{L("Meal", "الوجبة")}</div>
          <div className="flex gap-1.5 flex-wrap">
            {F.MEALS.map((m) => <button key={m} onClick={() => setTo(m)} className={"rounded-lg px-2.5 py-1.5 text-[12.5px] border " + (to === m ? "border-emerald-500 bg-emerald-500/15 text-emerald-100" : "border-slate-700 text-slate-300")} data-testid={"fit-edit-meal-" + m}>{L(MEAL_NAMES[m][0], MEAL_NAMES[m][1])}</button>)}
          </div>
        </div>
        <button disabled={!ok} onClick={() => onSave(H.editedFood(x, base, { name, grams: gs, ...nums }), to)} className="w-full min-h-[48px] rounded-xl bg-emerald-600 text-white font-medium disabled:opacity-40" data-testid="fit-row-save">{L("Save", "حفظ")}</button>
      </div>
    </div>);
}

const DAY_LETTERS = { en: ["S", "M", "T", "W", "T", "F", "S"], ar: ["ح", "ن", "ث", "ر", "خ", "ج", "س"] };
function Today({ L, t, ar, st, upd, tg, tot, day, dayKey, setDayKey, setDay, setAdding, addItems, logNow, setUndo, tick, flash, health, bar, listening, scanBarcode, openMove, minimal = false }) {
  const [extra, setExtra] = useState(null);   // v6.32 minimal: which of water / move / fasting is open (small buttons, not three cards)
  const [copyOf, setCopyOf] = useState(null);           // v6.13: { slot } being copied to another day (slot null = the whole day); v6.23: { slot, item } = one food
  const [editing, setEditing] = useState(null);         // v6.23: { m, i } — the food in the edit sheet
  useSubBack(!!editing, () => setEditing(null));
  useSubBack(!!copyOf, () => setCopyOf(null));
  const left = tg.kcal - tot.kcal + tot.burned;
  const isToday = dayKey === F.today();
  const onInsulin = useMemo(() => { try { return CARE.insulinState(CARE.loadCare()).onInsulin; } catch (e) { return false; } }, [dayKey]);   // v6.28: carbs per meal for insulin users
  const shift = (n) => { const d = new Date(dayKey + "T12:00:00"); d.setDate(d.getDate() + n); const k = F.today(d); if (k <= F.today()) setDayKey(k); };
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!st.fast) return; const h = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(h); }, [st.fast]);
  const fs = F.fastState(st.fast, now);
  const country = F.getCountry();
  const plan = useMemo(() => F.mealPlan(tg, { diet: st.profile.diet, seed: Math.floor(Date.parse(dayKey) / 864e5), country }), [tg, dayKey, st.profile.diet, country]);
  const tips = F.dayTips(tot, tg, ar ? "ar" : "en");
  const hm = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"); };
  // only the stored log is read here (no food pack, no recipe book, no model): the home stays instant with 25k recipes and 1M foods installed
  const chips = useMemo(() => H.frequentChips(st.days, { limit: 8 }), [st.days]);
  const nowMeal = mealNow();
  const sugg = useMemo(() => H.countrySuggestions(country, nowMeal, 4, Math.floor(Date.parse(dayKey) / 864e5)), [country, nowMeal, dayKey]);
  const week = useMemo(() => H.weekKcal(st.days, new Date(dayKey + "T12:00:00")), [st.days, dayKey]);
  const wMax = Math.max(tg.kcal, ...week.map((w) => w.kcal)) || 1;
  const glasses = Math.max(4, Math.min(16, Math.round(tg.water / 250)));
  const drunk = Math.round((tot.water || 0) / 250);
  const nm = (x) => (ar && x.ar ? x.ar : x.name);
  const one = (meal, item, kcal) => logNow(meal, [item], L(`Added ${item.name} · ${kcal} kcal`, `أُضيف ${item.ar || item.name} · ${kcal} سعر`));
  const del = (m, i) => {
    const r = H.removeAt(day, m, i); setDay(() => r.day); tick();
    setUndo({ id: Date.now(), label: L(`Deleted ${r.removed.name}`, `حُذف ${r.removed.ar || r.removed.name}`), revert: () => setDay((d) => H.insertAt(d, m, i, r.removed)) });
  };
  const saveEdit = (m, i, x, to) => { setDay((d) => H.replaceAt(d, m, i, x, to)); setEditing(null); tick(); };
  const layout = LK.layoutOf(LK.lookOf(st));
  const [openTile, setOpenTile] = useState(null);
  const mealView = (m, variant) => {
    const items = (day.meals || {})[m] || [];
    const sum = F.sumN(items.filter((x) => x.kcal != null));
    const pm = !items.length && plan && plan.meals[m] && isToday ? plan.meals[m] : null;
    const ms = LK.MEAL_STYLE[m], vivid = variant === "meals" || variant === "tiles";
    return (
      <div key={m} className={variant === "classic" ? "p-3" : variant === "rings" ? "rounded-2xl bg-slate-900 p-3.5" : "rounded-2xl bg-slate-900 p-3.5 shadow-sm"} style={vivid ? { borderInlineStart: "6px solid " + ms.col } : undefined} data-testid={"fit-meal-" + m}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0"><div className="text-white font-medium">{variant !== "classic" && variant !== "rings" ? <span className="me-1.5" aria-hidden="true">{ms.em}</span> : null}{L(MEAL_NAMES[m][0], MEAL_NAMES[m][1])} <span className="text-[12px] text-slate-400 tabular-nums">{sum.kcal} {L("kcal", "سعرة")}{onInsulin && items.length ? <b className="ms-1.5 text-amber-200" data-testid="fit-meal-carbs">· {Math.round(sum.c || 0)} {L("g carbs", "جم كربوهيدرات")}</b> : null}</span></div></div>
          <span className="flex items-center gap-1.5 shrink-0">
            {items.length ? <button onClick={() => setCopyOf({ slot: m })} className="min-h-[48px]! min-w-[48px] rounded-full bg-slate-800 text-slate-300 flex items-center justify-center" aria-label={L("Copy to another day", "نسخ إلى يوم آخر")} data-testid={"fit-copy-" + m}><Copy size={17} /></button> : null}
            <button onClick={() => setAdding(m)} className={"min-h-[48px]! min-w-[48px] rounded-full flex items-center justify-center shrink-0 " + (vivid ? "text-white" : minimal ? "bg-emerald-600 text-white" : "bg-emerald-600/20 text-emerald-300")} style={vivid ? { background: ms.col } : undefined} data-testid={"fit-add-" + m} aria-label={L(`Add to ${MEAL_NAMES[m][0]}`, `أضف إلى ${MEAL_NAMES[m][1]}`)}><Plus size={20} /></button>
          </span>
        </div>
        {items.map((x, i) => <LogRow key={(x.t || 0) + ":" + i} {...{ t, ar, x }} testid={"fit-item-" + m} onDelete={() => del(m, i)} onEdit={() => setEditing({ m, i })} onCopy={() => setCopyOf({ slot: m, item: x })} />)}
        {pm && minimal ? (
          <button onClick={() => one(m, { name: pm.recipe.en, ar: pm.recipe.ar, grams: Math.round(F.recipeNutrients(pm.recipe).grams * pm.x), kcal: pm.kcal, p: pm.p, c: pm.c, f: pm.f, fib: 0, recipe: pm.recipe.id }, pm.kcal)}
            className="mt-0.5 w-full min-h-[44px]! text-start text-[13.5px] text-slate-400" data-testid={"fit-suggest-" + m}>
            {L("Try", "جرّب")}: {ar ? pm.recipe.ar : pm.recipe.en} · {pm.kcal} {L("kcal", "سعرة")}
          </button>) : pm ? (
          <button onClick={() => one(m, { name: pm.recipe.en, ar: pm.recipe.ar, grams: Math.round(F.recipeNutrients(pm.recipe).grams * pm.x), kcal: pm.kcal, p: pm.p, c: pm.c, f: pm.f, fib: 0, recipe: pm.recipe.id }, pm.kcal)}
            className="mt-1 w-full min-h-[48px]! text-start rounded-lg bg-slate-800/60 px-2.5 py-2 text-[12.5px] text-slate-300" data-testid={"fit-suggest-" + m}>
            <span className="text-emerald-300">{L("Suggested", "مقترح")}:</span> {ar ? pm.recipe.ar : pm.recipe.en}{pm.x !== 1 ? ` ×${pm.x}` : ""} · {pm.kcal} {L("kcal", "سعرة")} — <u>{L("I ate this", "أكلت هذا")}</u>
          </button>) : null}
      </div>);
  };
  const Act = ({ k, Ic, label, primary }) => (
    <button onClick={bar[k]} data-testid={"fit-lb-" + k} aria-label={label}
      className={"min-h-[56px]! rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[12.5px] font-medium active:scale-[.97] motion-safe:transition-transform " + (primary ? "bg-emerald-600 text-white" : listening && k === "voice" ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-100")}>
      <Ic size={19} aria-hidden="true" /><span>{label}</span></button>);
  return (
    <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)] lg:gap-x-6 lg:gap-y-3 lg:items-start" data-testid="fit-today">
      <div className="space-y-3 lg:col-start-1">
      <div className="flex items-center justify-between gap-2 text-[13px] text-slate-300">
        <button onClick={() => shift(-1)} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg" aria-label={t("Previous day")}><ChevronLeft size={18} className="rtl:rotate-180" /></button>
        <span data-testid="fit-day" className="font-medium text-white">{isToday ? L("Today", "اليوم") : dayKey}</span>
        <button onClick={() => shift(1)} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg disabled:opacity-30" disabled={isToday} aria-label={t("Next day")}><ChevronLeft size={18} className="rotate-180 rtl:rotate-0" /></button>
      </div>

      {/* v6.27: the summary and the meals, in the look's own layout (classic · colour per meal · rings · tiles) */}
      {layout === "rings" ? (<>
        <div className="rounded-3xl p-4 text-white" style={{ background: "linear-gradient(135deg,#0EA5E9,#8B5CF6)" }} data-testid="fit-ring">
          <div className="text-[13px] opacity-90">{left < 0 ? L("Over today", "زيادة اليوم") : L("Left today", "المتبقي اليوم")}</div>
          <div className="text-[34px] font-extrabold tabular-nums leading-tight"><span data-testid="fit-left">{Math.abs(left)}</span> <span className="text-[15px] font-semibold">{L("kcal", "سعرة")}</span></div>
          <div className="text-[12.5px] opacity-90 tabular-nums">{L("Eaten", "أكلت")} <b data-testid="fit-eaten">{tot.kcal}</b> · {L("Burned", "حرقت")} {tot.burned} · {L("Goal", "الهدف")} {tg.kcal}</div>
        </div>
        <div className="rounded-3xl bg-slate-900 p-4 grid grid-cols-4 gap-1" data-testid="fit-rings">
          {[["Protein", "بروتين", tot.p, tg.protein, "#38BDF8"], ["Carbs", "كربوهيدرات", tot.c, tg.carbs, "#FBBF24"], ["Fat", "دهون", tot.f, tg.fat, "#FB7185"], ["Fibre", "ألياف", tot.fib, tg.fibre, "#34D399"]].map(([en, a2, v, mx, col]) => {
            const pct = mx > 0 ? Math.min(100, Math.round(((v || 0) / mx) * 100)) : 0;
            return (<div key={en} className="flex flex-col items-center gap-1.5 text-[12px] text-slate-300">
              <div className="w-[66px] h-[66px] rounded-full grid place-items-center" style={{ background: `conic-gradient(${col} 0 ${pct}%, var(--color-slate-800) ${pct}% 100%)` }}>
                <div className="w-[52px] h-[52px] rounded-full bg-slate-900 grid place-items-center text-[13px] font-bold text-white tabular-nums">{Math.round(v || 0)}{L("g", "جم")}</div></div>
              <span>{L(en, a2)}</span><span className="text-[10.5px] text-slate-500 tabular-nums -mt-1">/ {mx} {L("g", "جم")}</span></div>);
          })}
        </div>
      </>) : layout === "tiles" ? (
        <div className="rounded-3xl p-4" style={{ background: "linear-gradient(160deg,#FFE7C2,#FFD1DC)", color: "#2A2420" }} data-testid="fit-ring">
          <div className="text-[44px] font-extrabold tabular-nums leading-none" data-testid="fit-left">{Math.abs(left)}</div>
          <div className="text-[13px] mt-1 tabular-nums">{left < 0 ? L("kcal over", "سعرة زيادة") : L("kcal left", "سعرة متبقية")} · {L("Goal", "الهدف")} {tg.kcal} · {L("Eaten", "أكلت")} <b data-testid="fit-eaten">{tot.kcal}</b></div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {[["Protein", "بروتين", tot.p, tg.protein, "#DBEAFE", "#1E40AF"], ["Carbs", "كربوهيدرات", tot.c, tg.carbs, "#FEF3C7", "#92400E"], ["Fat", "دهون", tot.f, tg.fat, "#FFE4E6", "#9F1239"], ["Fibre", "ألياف", tot.fib, tg.fibre, "#DCFCE7", "#166534"]].map(([en, a2, v, mx, bg, fg]) =>
              <span key={en} className="rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums" style={{ background: bg, color: fg }}>{L(en, a2)} {Math.round(v || 0)}/{mx} {L("g", "جم")}</span>)}
          </div>
        </div>
      ) : (
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4 flex items-center gap-4" data-testid="fit-ring">
        <Ring value={tot.kcal} max={tg.kcal + tot.burned}>
          <div className={"text-2xl font-bold tabular-nums " + (left < 0 ? "text-rose-300" : "text-white")} data-testid="fit-left">{Math.abs(left)}</div>
          <div className="text-[11px] text-slate-400">{left < 0 ? L("kcal over", "سعر زيادة") : L("kcal left", "سعر متبقٍ")}</div>
        </Ring>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="text-[12px] text-slate-400 tabular-nums">{L("Eaten", "أكلت")} <b className="text-white" data-testid="fit-eaten">{tot.kcal}</b> · {L("Burned", "حرقت")} <b className="text-white">{tot.burned}</b> · {L("Goal", "الهدف")} {tg.kcal}</div>
          <Bar label={L("Protein", "بروتين")} v={tot.p} max={tg.protein} cls="bg-sky-400" />
          <Bar label={L("Carbs", "كربوهيدرات")} v={tot.c} max={tg.carbs} cls="bg-amber-400" />
          <Bar label={L("Fat", "دهون")} v={tot.f} max={tg.fat} cls="bg-rose-400" />
          {minimal ? null : <Bar label={L("Fibre", "ألياف")} v={tot.fib} max={tg.fibre} cls="bg-emerald-400" />}
        </div>
      </div>
      )}

      {st.ramadan && st.ramadan.on && isToday ? <RamadanCard {...{ L, ar, tg, city: st.ramadan.city }} /> : null}
      {isToday ? <InsulinCard {...{ L, ar, day }} carbsToday={tot.c} /> : null}
      </div>

      <div className="space-y-3 lg:col-start-2 lg:row-start-1 lg:row-span-2 min-w-0" data-testid="fit-today-meals">
      {/* today's meals: a timeline by meal; swipe a food for Edit / Delete */}
      {layout === "tiles" ? (<>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3" data-testid="fit-meals">
          {F.MEALS.map((m) => { const ms = LK.MEAL_STYLE[m], items = (day.meals || {})[m] || [], sum = F.sumN(items.filter((x) => x.kcal != null));
            return (<button key={m} onClick={() => (items.length ? setOpenTile(openTile === m ? null : m) : setAdding(m))} aria-expanded={openTile === m} data-testid={"fit-tile-" + m}
              className="rounded-3xl p-3.5 min-h-[118px] flex flex-col text-start" style={{ background: ms.soft, color: "#2A2420", outline: openTile === m ? "2px solid " + ms.col : "none" }}>
              <b className="text-[15px]">{ms.em} {L(MEAL_NAMES[m][0], MEAL_NAMES[m][1])}</b>
              <span className="text-[12px] opacity-70 mt-0.5 line-clamp-2">{items.length ? items.map(nm).join(ar ? "، " : ", ") : L("Tap to add", "اضغط للإضافة")}</span>
              <span className="mt-auto text-[26px] font-extrabold tabular-nums" style={{ color: items.length ? "#2A2420" : ms.col }}>{items.length ? sum.kcal : "+"}</span></button>);
          })}
          <button onClick={() => { setDay((d) => ({ ...d, water: (d.water || 0) + 250 })); tick(); }} className="rounded-3xl p-3.5 min-h-[118px] flex flex-col text-start" style={{ background: "#DFF4FF", color: "#2A2420" }} data-testid="fit-tile-water">
            <b className="text-[15px]">💧 {L("Water", "ماء")}</b><span className="text-[12px] opacity-70 mt-0.5">{L("Tap for a glass", "اضغط لكوب")} · {drunk}/{glasses}</span>
            <span className="mt-auto text-[26px] font-extrabold tabular-nums" style={{ color: "#0284C7" }}>{(tot.water / 1000).toFixed(1)} L</span></button>
          <button onClick={() => openMove && openMove()} className="rounded-3xl p-3.5 min-h-[118px] flex flex-col text-start" style={{ background: "#F1EAFE", color: "#2A2420" }} data-testid="fit-tile-move">
            <b className="text-[15px]">🏃 {L("Move", "الحركة")}</b><span className="text-[12px] opacity-70 mt-0.5">{L("Workouts and steps", "التمارين والخطوات")}</span>
            <span className="mt-auto text-[26px] font-extrabold tabular-nums" style={{ color: "#7C3AED" }}>{tot.burned}</span></button>
        </div>
        {openTile ? mealView(openTile, "tiles") : null}
      </>) : layout === "classic" ? (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 divide-y divide-slate-800" data-testid="fit-meals">
          {F.MEALS.map((m) => mealView(m, "classic"))}
        </div>
      ) : (
        <div className="space-y-3" data-testid="fit-meals">{F.MEALS.map((m) => mealView(m, layout))}</div>
      )}

      {F.MEALS.some((m) => ((day.meals || {})[m] || []).length) ? (
        <button onClick={() => setCopyOf({ slot: null })} className="w-full min-h-[48px]! rounded-xl border border-slate-800 bg-slate-900/40 text-[13px] text-slate-300 flex items-center justify-center gap-1.5" data-testid="fit-copy-day">
          <Copy size={14} />{isToday ? L("Copy today's food to another day", "نسخ طعام اليوم إلى يوم آخر") : L("Copy this day's food to another day", "نسخ طعام هذا اليوم إلى يوم آخر")}</button>) : null}
      {editing && ((day.meals || {})[editing.m] || [])[editing.i] ? <EditFood key={editing.m + editing.i} {...{ L, ar, x: day.meals[editing.m][editing.i], meal: editing.m, onClose: () => setEditing(null), onSave: (x, to) => saveEdit(editing.m, editing.i, x, to) }} /> : null}
      {copyOf ? <CopySheet {...{ L, ar, from: dayKey, slot: copyOf.slot, item: copyOf.item, onClose: () => setCopyOf(null), onCopy: (toKey, toSlot) => {
          upd((s0) => ({ ...s0, days: copyOf.item ? P.copyItem(s0.days, toKey, toSlot, copyOf.item) : P.copyFood(s0.days, dayKey, toKey, copyOf.slot, toSlot) }));
          setCopyOf(null);
          flash && flash(toKey === F.today() ? L("Copied to today", "نُسخ إلى اليوم") : L("Copied to " + toKey, "نُسخ إلى " + toKey));
        } }} /> : null}
      </div>

      <div className="space-y-3 lg:col-start-1">
      {minimal ? (
        <div className="flex flex-wrap gap-2" data-testid="fit-extras">
          {[["water", Droplet, L("Water", "ماء") + " " + drunk + "/" + glasses], ["move", Dumbbell, L("Move", "الحركة") + (tot.burned ? " −" + tot.burned : "")], ["fast", Timer, fs ? hm(fs.done) : L("Fasting", "صيام")]].map(([k, Ic, label]) =>
            <button key={k} onClick={() => setExtra(extra === k ? null : k)} aria-expanded={extra === k} data-testid={"fit-chip-" + k}
              className={"min-h-[44px] px-4 rounded-full border-2 text-[14px] font-semibold flex items-center gap-1.5 tabular-nums " + (extra === k ? "border-emerald-600 bg-emerald-950 text-white" : "border-slate-600 bg-slate-900 text-white")}><Ic size={16} />{label}</button>)}
        </div>) : null}
      {/* water and the week */}
      {!minimal || extra === "water" ? <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3 space-y-3" data-testid="fit-water">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[13px] text-white flex items-center gap-1.5"><Droplet size={15} className="text-sky-300" />{L("Water", "ماء")} <span className="text-slate-400 tabular-nums">{(tot.water / 1000).toFixed(2)} / {(tg.water / 1000).toFixed(1)} L</span></div>
          <div className="flex gap-1.5">
            <button onClick={() => setDay((d) => ({ ...d, water: Math.max(0, (d.water || 0) - 250) }))} className="min-h-[44px] min-w-[44px] rounded-lg bg-slate-800 text-slate-300" aria-label={t("One glass less")}>−</button>
            <button onClick={() => { setDay((d) => ({ ...d, water: (d.water || 0) + 250 })); tick(); }} className="min-h-[44px] rounded-lg bg-sky-600 px-3 text-white" data-testid="fit-water-add">+ {L("glass", "كوب")}</button>
          </div>
        </div>
        <div className="flex gap-1" aria-hidden="true">{Array.from({ length: glasses }, (_, i) => <button key={i} tabIndex={-1} onClick={() => setDay((d) => ({ ...d, water: (i + 1) * 250 === (d.water || 0) ? i * 250 : (i + 1) * 250 }))} className={"flex-1 h-7 rounded-md motion-safe:transition-colors " + (i < drunk ? "bg-sky-400" : "bg-slate-800")} data-testid="fit-glass" />)}</div>
        <div data-testid="fit-week">
          <div className="text-[11.5px] text-slate-500 mb-1">{t("This week")}</div>
          <div className="flex items-end gap-1.5 h-14" role="img" aria-label={t("Calories in the last 7 days")}>
            {week.map((w) => (
              <div key={w.d} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
                <div className={"w-full rounded-sm " + (w.kcal > tg.kcal * 1.1 ? "bg-rose-400" : w.d === dayKey ? "bg-emerald-400" : "bg-emerald-700")} style={{ height: Math.max(2, Math.round((w.kcal / wMax) * 40)) + "px" }} />
                <span className="text-[11px] text-slate-500">{DAY_LETTERS[ar ? "ar" : "en"][w.day]}</span>
              </div>))}
          </div>
        </div>
      </div> : null}

      {/* exercise: steps and workouts from the watch, and the workouts page one tap away */}
      {!minimal || extra === "move" ? <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3 space-y-2" data-testid="fit-exercise">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[13px] text-white flex items-center gap-1.5"><Dumbbell size={15} className="text-emerald-300" />{L("Exercise", "الرياضة")} <span className="text-slate-400 tabular-nums">{tot.burned ? `−${tot.burned} kcal` : ""}</span></div>
          <button onClick={openMove} className="min-h-[44px] rounded-lg bg-slate-800 px-3 text-[12.5px] text-emerald-300" data-testid="fit-open-move">{L("Workouts", "التمارين")}</button>
        </div>
        <WatchCard {...{ L, ar, health, st, upd, dayKey }} compact />
      </div> : null}

      {!minimal || extra === "fast" ? <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3" data-testid="fit-fast">
        <div className="text-[13px] text-white flex items-center gap-1.5"><Timer size={15} className="text-violet-300" />{L("Fasting", "صيام")}</div>
        {fs ? (<>
          <div className={"text-xl font-semibold tabular-nums mt-1 " + (fs.reached ? "text-emerald-300" : "text-white")}>{hm(fs.done)} <span className="text-[12px] text-slate-400">/ {st.fast.hours}h</span></div>
          <div className="h-1.5 rounded-full bg-slate-800 mt-1"><div className="h-1.5 rounded-full bg-violet-400" style={{ width: fs.pct + "%" }} /></div>
          {(() => { const sg = Y.fastStage(fs.done / 3600e3); return <div className="text-[11.5px] text-violet-200 mt-1.5" data-testid="fit-fast-stage">{L(sg.now[1], sg.now[2])}{sg.next ? <span className="text-slate-500"> · {L(`next in ${sg.inH} h`, `التالي بعد ${sg.inH} ساعة`)}</span> : null}</div>; })()}
          <button onClick={() => upd((s) => ({ ...s, fast: null }))} className="mt-2 w-full min-h-[44px] rounded-lg bg-slate-800 text-[12.5px] text-slate-200">{L("End fast", "أنهِ الصيام")}</button>
        </>) : (
          <div className="flex flex-wrap gap-1.5 mt-2">{Object.entries({ ...F.FASTS, ...Y.MORE_FASTS }).map(([k, h]) => <button key={k} onClick={() => upd((s) => ({ ...s, fast: { start: Date.now(), hours: h } }))} className="min-h-[44px] rounded-lg bg-slate-800 px-3 text-[12.5px] text-slate-200" data-testid={"fit-fast-" + h}>{k}</button>)}</div>
        )}
      </div> : null}
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
      if (!rc) { flash && flash(L("Couldn't make a recipe from that — try listing a few ingredients", "تعذّر إنشاء وصفة — اكتب بعض المكونات")); return; }
      upd((s) => ({ ...s, myRecipes: [rc, ...s.myRecipes].slice(0, 40) }));
      setOpen(rc); setHave("");
    } catch (e) { flash && flash(L("Couldn't make a recipe", "تعذّر إعداد وصفة")); }
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
        <div className="text-[12.5px] text-slate-400">{open.mins ? <>{open.mins} {L("min", "دقيقة")} · </> : null}{open.dish ? <>{L("one serving", "حصة واحدة")} · </> : <>{L("serves", "يكفي")} {open.serves} · </>} <b className="text-white">{n.kcal} {L("kcal", "سعرة")}</b> {L("a serving", "للفرد")}</div>
        <Macros L={L} x={n} kcal={false} />
        <div className="rounded-xl bg-slate-900/60 p-3 space-y-1">
          {open.items.map(([id, g], i) => { const fd = F.food(id); return <div key={i} className="flex justify-between text-[13px]"><span className="text-slate-200">{fd ? (ar ? fd.ar : fd.en) : id}</span><span className="text-slate-400 tabular-nums">{g} g</span></div>; })}
          {(open.unknown || []).map((u, i) => <div key={"u" + i} className="flex justify-between text-[13px]"><span className="text-amber-200">{u.name}</span><span className="text-slate-500">{u.grams} g · {L("not counted", "غير محسوب")}</span></div>)}
        </div>
        <ol className="list-decimal ps-5 space-y-1 text-[13.5px] text-slate-200">{open.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        <button onClick={() => { addItems(mealNow(), [{ name: open.en, ar: open.ar, grams: n.grams, kcal: n.kcal, p: n.p, c: n.c, f: n.f, fib: n.fib, recipe: open.id }]); flash && flash(L("Logged one serving", "سُجّلت حصة")); }}
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
        <input value={have} onChange={(e) => setHave(e.target.value)} placeholder={L("What's in your fridge? AI makes a recipe", "ماذا لديك في الثلاجة؟ يُعدّ لك الذكاء الاصطناعي وصفة")} className="flex-1 min-w-0 bg-transparent text-[13px] text-white placeholder:text-slate-500" data-testid="fit-invent-text" />
        <button onClick={invent} disabled={busy} className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-[12.5px] text-white flex items-center gap-1" data-testid="fit-invent">{busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}{L("Create", "اعمل")}</button>
      </div>
      <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-3" data-testid="fit-recipe-grid">
      {list.map((rc) => { const n = F.recipeNutrients(rc); return (
        <button key={rc.id} onClick={() => setOpen(rc)} className="w-full text-start rounded-xl bg-slate-900/60 border border-slate-800 px-3 py-2.5" data-testid={"fit-rc-" + rc.id}>
          <div className="text-[14px] text-white">{ar && rc.ar ? rc.ar : rc.en}</div>
          <div className="text-[12px] text-slate-400 tabular-nums">{n.kcal} {L("kcal", "سعرة")} · <span className="inline-flex items-center gap-1"><i className="inline-block w-2 h-2 rounded-full" style={{ background: MACRO[0][3] }} />{L("Protein", "بروتين")} {n.p} {L("g", "جم")}</span>{rc.mins ? <> · {rc.mins} {L("min", "دقيقة")}</> : <> · {n.grams} {L("g", "جم")}</>}</div>
        </button>); })}
      </div>
      {!list.length && <div className="text-center text-[13px] text-slate-500 py-6">{L("No recipe matches", "لا توجد وصفة مطابقة")}</div>}
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
  const logIt = (name, minutes, kcal) => { setDay((d) => ({ ...d, workouts: [...(d.workouts || []), { name, min: minutes, kcal, t: Date.now() }] })); flash && flash(L(`Logged — ${kcal} kcal burned`, `سُجّل — حرقت ${kcal} سعرًا`)); };
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
          <button onClick={() => setSess((s) => next(s))} className="flex-1 rounded-xl bg-emerald-600 py-2.5 font-medium text-white" data-testid="fit-session-next">{sess.left > 0 ? L("Skip", "تخطّي") : L("Done — next", "انتهيت — التالي")}</button>
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
        {what.trim().length > 2 && !ex && <div className="text-[12px] text-slate-500">{L("Not in the list yet — try a simpler name", "غير موجود في القائمة — جرّب اسمًا أبسط")}</div>}
      </div>
      <div className="text-[13px] text-slate-400">{L("Guided workouts — the timer walks you through", "تمارين مع مدرب — المؤقّت يرافقك")}</div>
      {planList.map((p) => { const c = F.planCost(p.workout, kg); return (
        <div key={p.id} className="rounded-xl bg-slate-900/60 border border-slate-800 px-3 py-2.5 flex items-center gap-3">
          <div className="flex-1 min-w-0"><div className="text-[14px] text-white truncate">{ar ? p.ar : p.en}</div><div className="text-[12px] text-slate-400">~{c.minutes} {L("min", "دقيقة")} · ~{c.kcal} kcal</div></div>
          <button onClick={() => { const s = steps(p); const sec = secsOf(s[0]); setSess({ plan: p, steps: s, i: 0, left: sec, running: sec > 0 }); }} className="shrink-0 rounded-full bg-emerald-600 w-11 h-11 grid place-items-center text-white" aria-label={L("Start", "ابدأ")} data-testid={"fit-start-" + p.id}><Play size={17} /></button>
        </div>); })}
      <button disabled={busy} onClick={async () => {
        if (!modelReady) { openEngine && openEngine(); return; }
        setBusy(true);
        try { const p = F.parseWorkout(await llm(F.workoutMessages({ goal: tg.goal === "lose" ? "lose fat" : tg.goal === "gain" ? "build muscle" : "stay fit", level: "beginner", equipment: "none", minutes: 30, days: 3, lang: ar ? "ar" : "en" }), null, { json: true, maxTokens: 900, temperature: 0.3 })); if (p) setAiPlan(p); else flash && flash(L("Couldn't make a plan — try again", "تعذّر إعداد خطة — حاول مرة أخرى")); }
        catch (e) { flash && flash(L("Couldn't make a plan", "تعذّر إعداد خطة")); } finally { setBusy(false); }
      }} className="w-full rounded-xl bg-violet-600 py-2.5 text-[13.5px] text-white flex items-center justify-center gap-1.5" data-testid="fit-ai-plan">{busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}{L("Make me a weekly plan", "اعملّي خطة أسبوعية")}</button>
      {aiPlan && aiPlan.tips.map((t, i) => <div key={i} className="text-[12.5px] text-slate-400">• {t}</div>)}
    </div>
  );
}

function Progress({ L, ar, st, upd, tg, pro = true, openPlan, share, minimal = false, extraTop = null }) {
  const [w, setW] = useState("");
  const [more, setMore] = useState(!minimal);   // v6.32 minimal: weight first; the rest one tap away
  const tr = F.trend(st.weights);
  const wk = F.weekSummary(st.days, st.weights, tg);
  const strk = F.streak(st.days);
  const maxK = Math.max(tg.kcal * 1.2, ...wk.rows.map((r) => r.kcal));
  const pts = tr.slice(-30);
  const lo = Math.min(...pts.map((p) => p.kg), st.profile.goalKg ? +st.profile.goalKg : Infinity) - 1, hi = Math.max(...pts.map((p) => p.kg)) + 1;
  const X = (i) => (pts.length < 2 ? 150 : (i / (pts.length - 1)) * 290 + 5), Y = (v) => 110 - ((v - lo) / (hi - lo || 1)) * 100;
  const weightCard = (
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3 space-y-2" data-testid="fit-weight-card">
        <div className="text-[13px] text-white">{L("Weight", "الوزن")} {tr.length ? <span className="text-slate-400">· {L("trend", "الاتجاه")} {tr[tr.length - 1].avg} kg</span> : null}</div>
        {pts.length >= 2 && (
          <svg viewBox="0 0 300 120" className="w-full h-28" data-testid="fit-weight-chart">
            {st.profile.goalKg && <line x1="0" x2="300" y1={Y(+st.profile.goalKg)} y2={Y(+st.profile.goalKg)} stroke="#34d399" strokeDasharray="4 4" strokeWidth="1" />}
            <polyline fill="none" stroke="#64748b" strokeWidth="1" points={pts.map((p, i) => `${X(i)},${Y(p.kg)}`).join(" ")} />
            <polyline fill="none" stroke="#38bdf8" strokeWidth="2.5" points={pts.map((p, i) => `${X(i)},${Y(p.avg)}`).join(" ")} />
          </svg>
        )}
        <div className="flex gap-2">
          <input type="number" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} placeholder={L("Today's weight (kg)", "وزن اليوم (كجم)")} className="flex-1 min-w-0 rounded-lg bg-slate-800 px-2 py-2 text-[14px] text-white" data-testid="fit-weight" />
          <button onClick={() => { const kg = parseFloat(w); if (!(kg > 25 && kg < 400)) return; upd((s) => ({ ...s, weights: [...s.weights.filter((x) => x.d !== F.today()), { d: F.today(), kg }], profile: { ...s.profile, kg } })); setW(""); }} className="shrink-0 rounded-lg bg-sky-600 px-4 text-white" data-testid="fit-weight-save">{L("Save", "احفظ")}</button>
        </div>
        <div className="text-[11.5px] text-slate-500">{L("The blue line is the 7-entry average — daily weight jumps with water and salt; the average is the truth.", "الخط الأزرق هو المتوسط — يتغيّر الوزن اليومي بالماء والملح؛ والمتوسط هو المؤشر الحقيقي.")}</div>
      </div>
  );
  return (
    <div className="space-y-4 lg:space-y-0 lg:columns-2 lg:gap-6 lg:[&>*]:break-inside-avoid lg:[&>*]:mb-4" data-testid="fit-progress">
      {minimal ? weightCard : null}
      {minimal ? <button onClick={() => setMore((v) => !v)} aria-expanded={more} data-testid="fit-progress-more"
        className="w-full min-h-[48px] rounded-2xl border-2 border-slate-600 bg-slate-900 text-[14.5px] font-semibold text-white flex items-center justify-center gap-1.5">
        {more ? L("Less", "أقل") : L("More: week, measurements, photos, challenges", "المزيد: الأسبوع والقياسات والصور والتحديات")}<ChevronDown size={16} className={more ? "rotate-180" : ""} /></button> : null}
      {more ? <>{extraTop}<YazioPlus {...{ L, ar, st, upd, tg, share }} />
      {pro ? <WeekReport {...{ L, st, tg }} /> : <button onClick={() => openPlan && openPlan()} className="w-full rounded-2xl border border-amber-800 bg-amber-500/10 p-3 text-start text-[13px] text-amber-100" data-testid="fit-report-locked">📊 {L("Your week report — what went well, what to change — is in Pro.", "تقرير أسبوعك — ما يسير جيدًا وما يحتاج تغييرًا — في Pro.")}</button>}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-900/60 p-2.5"><div className="text-xl font-semibold text-white" data-testid="fit-streak">{strk}</div><div className="text-[11px] text-slate-400">{L("day streak", "يوم ورا بعض")}</div></div>
        <div className="rounded-xl bg-slate-900/60 p-2.5"><div className="text-xl font-semibold text-white">{wk.avg}</div><div className="text-[11px] text-slate-400">{L("avg kcal (7 d)", "متوسط السعرات")}</div></div>
        <div className="rounded-xl bg-slate-900/60 p-2.5"><div className="text-xl font-semibold text-white">{wk.change == null ? "—" : (wk.change > 0 ? "+" : "") + wk.change}</div><div className="text-[11px] text-slate-400">{L("kg this week", "كجم هذا الأسبوع")}</div></div>
      </div>
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3">
        <div className="text-[13px] text-white mb-2">{L("Last 7 days", "آخر 7 أيام")} <span className="text-slate-400">· {L("on target", "في الهدف")} {wk.onTarget}/{wk.logged}</span></div>
        <div className="flex items-end gap-1.5 h-24">{wk.rows.map((r) => (
          <div key={r.day} className="flex-1 flex flex-col items-center justify-end h-full">
            <div className={"w-full rounded-t " + (r.kcal > tg.kcal * 1.1 ? "bg-rose-400" : "bg-emerald-400")} style={{ height: (r.kcal / maxK) * 100 + "%" }} />
            <div className="text-[10px] text-slate-500 mt-1">{r.day.slice(8)}</div>
          </div>))}</div>
      </div>
      {minimal ? null : weightCard}
      <BodyCard {...{ L, st, upd }} /></> : null}
    </div>
  );
}


/* v6.13 — copy a meal or the whole day to another day (Ali: "copy food from day to day like Yazio"). */
function CopySheet({ L, ar, from, slot, item, onClose, onCopy }) {
  const t0 = F.today(), y = new Date(); y.setDate(y.getDate() + 1);
  const [to, setTo] = useState(item || from !== t0 ? t0 : F.today(y));   // one food: today first
  const [toSlot, setToSlot] = useState(slot);
  const quick = [[t0, L("Today", "اليوم")], [F.today(y), L("Tomorrow", "غدًا")]];
  const same = !item && from === to && (!slot || toSlot === slot);   // one food may be copied into the same meal (eaten twice)
  const nm = item ? (ar && item.ar ? item.ar : item.name) : "";
  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-end" onClick={onClose}>
      <div className="w-full rounded-t-2xl bg-slate-900 border-t border-slate-700 p-4 space-y-3" onClick={(e) => e.stopPropagation()} data-testid="fit-copy-sheet">
        <div className="text-white font-medium">{item ? L(`Copy ${nm} to…`, `نسخ ${nm} إلى…`) : slot ? L(`Copy ${MEAL_NAMES[slot][0]} to…`, `نسخ ${MEAL_NAMES[slot][1]} إلى…`) : L("Copy the whole day to…", "نسخ اليوم كاملًا إلى…")}</div>
        <div className="flex gap-2 flex-wrap">
          {quick.map(([k, lab]) => <button key={k} onClick={() => setTo(k)} className={"rounded-lg px-3 py-1.5 text-[13px] border " + (to === k ? "border-emerald-500 bg-emerald-500/15 text-emerald-100" : "border-slate-700 text-slate-300")}>{lab}</button>)}
          <input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-[13px] text-slate-200" data-testid="fit-copy-date" />
        </div>
        {slot ? (
          <div className="flex gap-1.5 flex-wrap">
            {F.MEALS.map((m) => <button key={m} onClick={() => setToSlot(m)} className={"rounded-lg px-2.5 py-1 text-[12.5px] border " + (toSlot === m ? "border-emerald-500 bg-emerald-500/15 text-emerald-100" : "border-slate-700 text-slate-300")} data-testid={"fit-copy-to-" + m}>{L(MEAL_NAMES[m][0], MEAL_NAMES[m][1])}</button>)}
          </div>) : <div className="text-[12px] text-slate-400">{L("Each meal goes into the same meal on that day, added to what is already there.", "تُضاف كل وجبة إلى الوجبة نفسها في ذلك اليوم، مع ما هو مسجّل فيه.")}</div>}
        <button disabled={same} onClick={() => onCopy(to, toSlot)} className="w-full rounded-xl bg-emerald-600 py-2.5 text-white font-medium disabled:opacity-40" data-testid="fit-copy-go">{L("Copy", "نسخ")}</button>
      </div>
    </div>);
}


/* v6.14 — what Yazio has that Fit lacked: averages, measurements over time, progress photos, a goal per weekday, export. */
const WD = [["Sun", "الأحد"], ["Mon", "الإثنين"], ["Tue", "الثلاثاء"], ["Wed", "الأربعاء"], ["Thu", "الخميس"], ["Fri", "الجمعة"], ["Sat", "السبت"]];
function loadPhotos() { try { return JSON.parse(localStorage.getItem("attune:fit:photos") || "[]"); } catch (e) { return []; } }
function YazioPlus({ L, ar, st, upd, tg, share }) {
  const avg = Y.nutritionAverages(st.days, 7);
  const [m, setM] = useState({}); const ch = Y.measureChange(st.measures || []);
  const [photos, setPhotos] = useState(loadPhotos); const fileRef = useRef(null);
  const extra = (st.profile && st.profile.cycleExtra) || {};
  const savePhotos = (p) => { setPhotos(p); try { localStorage.setItem("attune:fit:photos", JSON.stringify(p)); } catch (e) { alert(L("Not enough space for more photos — delete an old one.", "لا توجد مساحة لصور أخرى — احذف صورة قديمة.")); } };
  const addPhoto = (f) => { const r = new FileReader(); r.onload = async () => { try { const u = await Y.shrinkPhoto(String(r.result)); savePhotos([...photos, { d: F.today(), u }].slice(-24)); } catch (e) {} }; r.readAsDataURL(f); };
  const card = "rounded-2xl bg-slate-900/60 border border-slate-800 p-3";
  return (<>
    {avg ? <div className={card} data-testid="fit-averages">
      <div className="text-[13px] text-white mb-1">{L(`Average of the last ${avg.days} logged days`, `متوسط آخر ${avg.days} أيام مسجّلة`)}</div>
      <div className="grid grid-cols-4 gap-2 text-center text-[12px]">
        <div><div className="text-white font-semibold tabular-nums">{avg.kcal}</div><div className="text-slate-400">kcal</div></div>
        <div><div className="text-sky-300 font-semibold tabular-nums">{avg.p} g</div><div className="text-slate-400">{L("Protein", "بروتين")} {avg.split.p}%</div></div>
        <div><div className="text-amber-300 font-semibold tabular-nums">{avg.c} g</div><div className="text-slate-400">{L("Carbs", "كربوهيدرات")} {avg.split.c}%</div></div>
        <div><div className="text-rose-300 font-semibold tabular-nums">{avg.f} g</div><div className="text-slate-400">{L("Fat", "دهون")} {avg.split.f}%</div></div>
      </div></div> : null}
    <div className={card} data-testid="fit-measures">
      <div className="text-[13px] text-white mb-2">{L("Body measurements (cm)", "قياسات الجسم (سم)")}</div>
      <div className="grid grid-cols-3 gap-1.5">{Y.PARTS.map(([k, en, a]) => <input key={k} inputMode="decimal" value={m[k] || ""} onChange={(e) => setM({ ...m, [k]: e.target.value })} placeholder={L(en, a)} data-testid={"fit-m-" + k}
        className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-[13px] text-white min-w-0" />)}</div>
      <button onClick={() => { upd((s) => ({ ...s, measures: Y.addMeasure(s.measures || [], { ...m, d: F.today() }) })); setM({}); }} className="mt-2 w-full rounded-lg bg-emerald-600 py-1.5 text-[13px] text-white" data-testid="fit-m-save">{L("Save today's measurements", "حفظ قياسات اليوم")}</button>
      {Object.keys(ch).length ? <div className="mt-2 space-y-0.5 text-[12.5px]" data-testid="fit-m-change">{Y.PARTS.filter(([k]) => ch[k]).map(([k, en, a]) =>
        <div key={k} className="flex justify-between"><span className="text-slate-300">{L(en, a)}</span><span className="tabular-nums text-slate-200">{ch[k].last} cm <span className={ch[k].change < 0 ? "text-emerald-300" : ch[k].change > 0 ? "text-rose-300" : "text-slate-500"}>({ch[k].change > 0 ? "+" : ""}{ch[k].change} {L("since", "منذ")} {ch[k].since})</span></span></div>)}</div> : null}
    </div>
    <div className={card} data-testid="fit-photos">
      <div className="flex items-center justify-between"><span className="text-[13px] text-white">{L("Progress photos", "صور التقدم")}</span>
        <button onClick={() => fileRef.current && fileRef.current.click()} className="rounded-lg bg-slate-800 px-2.5 py-1 text-[12px] text-sky-300" data-testid="fit-photo-add">+ {L("Photo", "صورة")}</button></div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) addPhoto(f); }} data-testid="fit-progress-photo-input" />
      {photos.length >= 2 ? <div className="grid grid-cols-2 gap-2 mt-2">{[photos[0], photos[photos.length - 1]].map((x, i) => <figure key={i}><img src={x.u} className="w-full rounded-lg aspect-[3/4] object-cover" /><figcaption className="text-[11px] text-slate-400 text-center mt-0.5">{i ? L("Now", "الآن") : L("Before", "قبل")} · {x.d}</figcaption></figure>)}</div>
        : photos.length ? <img src={photos[0].u} className="mt-2 w-1/2 rounded-lg" /> : <div className="text-[12px] text-slate-500 mt-1">{L("Photos stay on this phone. Add one now and one in a few weeks to compare.", "تبقى الصور على هذا الهاتف. أضف صورة الآن وأخرى بعد أسابيع للمقارنة.")}</div>}
      {photos.length ? <button onClick={() => savePhotos(photos.slice(0, -1))} className="mt-1.5 text-[11.5px] text-slate-500">{L("Delete the latest photo", "حذف أحدث صورة")}</button> : null}
    </div>
    {tg ? <div className={card} data-testid="fit-cycle">
      <div className="text-[13px] text-white">{L("More calories on some days", "سعرات أكثر في أيام معيّنة")}</div>
      <div className="text-[11.5px] text-slate-400 mb-2">{L("Pick days to eat 300 kcal more (weekends, family dinners). The other days give a little back, so your week — and your weight plan — stays the same.", "اختر أيامًا تأكل فيها 300 سعر إضافية (الإجازات، عزومات العائلة). تتنازل الأيام الأخرى عن قليل، فيبقى أسبوعك — وخطة وزنك — كما هما.")}</div>
      <div className="flex flex-wrap gap-1.5">{WD.map(([en, a], i) => <button key={i} onClick={() => upd((s) => { const e = { ...((s.profile || {}).cycleExtra || {}) }; if (e[i]) delete e[i]; else e[i] = 300; return { ...s, profile: { ...s.profile, cycleExtra: e } }; })}
        className={"rounded-lg min-w-[44px] px-2 py-1 text-[12px] border " + (extra[i] ? "border-emerald-500 bg-emerald-500/15 text-emerald-100" : "border-slate-700 text-slate-300")} data-testid={"fit-cyc-" + i}>{L(en, a)} {extra[i] ? Y.dayGoal(tg.kcal, (() => { const d = new Date(); d.setDate(d.getDate() + ((i - d.getDay() + 7) % 7)); return F.today(d); })(), extra) : ""}</button>)}</div>
    </div> : null}
    <Challenges {...{ L, st, upd, tg }} />
    <button onClick={() => { const csv = Y.diaryCSV(st.days); if (share) share(csv); else { const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv); a.download = "fit-diary.csv"; a.click(); } }}
      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 py-2 text-[13px] text-slate-300" data-testid="fit-export">{L("Export my food diary (CSV for Excel)", "تصدير يوميات الطعام (CSV لإكسل)")}</button>
  </>);
}


/* v6.14 — vitamins & minerals for the day (Yazio Pro has them). */
function Micros({ L, ar, day, sex }) {
  const [open, setOpen] = useState(false);
  const m = MI.dayMicros(day, sex === "f" ? "f" : "m");
  if (!m.total) return null;
  return (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3" data-testid="fit-micros">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-[13px] text-white">
        <span>{L("Vitamins & minerals", "الفيتامينات والمعادن")}</span>
        <span className="text-[11.5px] text-slate-400">{m.low.length ? L(`${m.low.length} low`, `${m.low.length} منخفضة`) : L("all good so far", "جيدة حتى الآن")} · {open ? "▲" : "▼"}</span>
      </button>
      {open ? <div className="mt-2 space-y-1.5" data-testid="fit-micros-list">
        {m.rows.map((r) => (
          <div key={r.k}>
            <div className="flex justify-between text-[12px]"><span className="text-slate-300">{L(r.en, r.ar)}</span><span className="tabular-nums text-slate-400">{r.v} / {r.ref} {r.unit} · {r.pct}%</span></div>
            <div className="h-1.5 rounded-full bg-slate-800"><div className={"h-1.5 rounded-full " + (r.pct >= 100 ? "bg-emerald-400" : r.pct >= 50 ? "bg-sky-400" : "bg-amber-400")} style={{ width: Math.min(100, r.pct) + "%" }} /></div>
            {r.pct < 50 ? <div className="text-[11px] text-amber-200/80 mt-0.5">{L("Good sources: ", "مصادر جيدة: ")}{MI.bestSources(r.k, 4).map((id) => { const f = F.FOODS.find((x) => x.id === id); return f ? (ar ? f.ar : f.en) : id; }).join(ar ? "، " : ", ")}</div> : null}
          </div>))}
        <div className="text-[11px] text-slate-500">{L(`Counted from ${m.known} of ${m.total} foods (the ones with known values; USDA data and product labels). A guide, not a lab test.`, `محسوبة من ${m.known} من ${m.total} أطعمة (التي قيمها معروفة؛ بيانات USDA وملصقات المنتجات). دليل تقريبي، وليس تحليلًا مخبريًا.`)}</div>
      </div> : null}
    </div>);
}

/* v6.14 — challenges, checked automatically from the diary. */
function Challenges({ L, st, upd, tg }) {
  const run = (st.challenges || []).map((c) => ({ ...c, p: Y.challengeProgress(c, st.days, tg) })).filter((c) => c.p);
  const active = new Set(run.filter((c) => c.p.state === "on").map((c) => c.id));
  const start = (id) => upd((s) => ({ ...s, challenges: [...(s.challenges || []).filter((c) => c.id !== id), { id, start: F.today() }] }));
  return (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3" data-testid="fit-challenges">
      <div className="text-[13px] text-white mb-2">{L("Challenges", "التحديات")}</div>
      {run.map((c) => (
        <div key={c.id} className="mb-2" data-testid={"fit-ch-" + c.id}>
          <div className="flex justify-between text-[12.5px]"><span className="text-slate-200">{c.p.c.emoji} {L(c.p.c.en[0], c.p.c.ar[0])}</span>
            <span className={c.p.state === "won" ? "text-emerald-300" : "text-slate-400"}>{c.p.state === "won" ? L("Done! 🎉", "أُنجز! 🎉") : c.p.state === "ended" ? L(`Ended · ${c.p.done}/${c.p.days}`, `انتهى · ${c.p.done}/${c.p.days}`) : `${c.p.done}/${c.p.days}`}</span></div>
          <div className="flex gap-1 mt-1">{c.p.marks.map((m, i) => <span key={i} className={"h-2 flex-1 rounded-full " + (m === true ? "bg-emerald-400" : m === false ? "bg-rose-400/60" : "bg-slate-800")} />)}</div>
        </div>))}
      <div className="flex flex-wrap gap-1.5">{Y.CHALLENGES.filter((c) => !active.has(c.id)).map((c) => (
        <button key={c.id} onClick={() => start(c.id)} title={L(c.en[1], c.ar[1])} className="rounded-lg bg-slate-800 px-2.5 py-1 text-[12px] text-slate-200" data-testid={"fit-ch-start-" + c.id}>{c.emoji} {L(c.en[0], c.ar[0])}</button>))}</div>
      <div className="text-[11px] text-slate-500 mt-1.5">{L("Checked from your diary each day — nothing to tick.", "تُتابَع تلقائيًا من يومياتك — لا حاجة لتسجيل يدوي.")}</div>
    </div>);
}
