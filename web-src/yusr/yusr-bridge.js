/* =========================================================================
   YUSR ⇄ ATTUNE BRIDGE
   ---------------------------------------------------------------------------
   Yusr is not rewritten, ported, or refactored. Its index.html is bundled
   whole and runs inside Attune in a WebView (Android) or an iframe (web).
   Byte-identical. Every ruling, every calculator, every citation, the
   ledger.v3 store — untouched.

   Attune wraps it with the two things it cannot do for itself: AI and memory.
   They talk over this bridge and nothing else.

   WHY THIS SHAPE, AND NOT A PORT:
   Copying the Zakat engine into Attune's codebase means the fiqh now lives in
   a file that changes weekly, and every future edit risks it. Keeping it
   sealed means a scholar reviews ONE file, once, and that file is what ships.
   It is also the only version of this that fits in a month.

   THE RULES THIS PROTOCOL ENFORCES:

   1. ZAKAT FLOWS OUT, NEVER IN. Attune may ASK Yusr for Zakat figures to
      display and explain. It may never send a Zakat number in. There is no
      message type for it, so there is no code path for it to happen by
      mistake later.

   2. MONEY MOVES ONLY ON CONFIRMATION. Attune proposes a transaction; Yusr
      shows it to the user; the user confirms inside Yusr, where the ledger
      lives. Attune cannot write a transaction directly.

   3. NEITHER SIDE TRUSTS THE OTHER'S DATA. Every message is validated on
      arrival. A malformed message is dropped and reported, never applied.
   ========================================================================= */

const BRIDGE_VERSION = 1;
const BRIDGE_NS = "yusr-bridge";

// ---- the message contract ------------------------------------------------
// Attune → Yusr
//   propose-txn   a transaction for the user to confirm. Yusr renders its own
//                 sheet, prefilled. Yusr decides. Attune never writes.
//   request       ask for a snapshot: "summary" | "zakat" | "accounts"
//   ai-result     the answer to an ai-request, already validated by Attune
// Yusr → Attune
//   ready         Yusr has booted and migrate() has run
//   snapshot      the answer to a request
//   txn-added     the user confirmed something; Attune can remember it
//   zakat-paid    a Zakat payment was recorded (for memory, never for maths)
//   ai-request    Yusr asks Attune to run the on-device model for it. Yusr
//                 holds no model and never will: inference lives in exactly
//                 one place, so there is one prompt to audit, not two.
const OUT_TYPES = new Set(["propose-txn", "request", "ai-result"]);
const IN_TYPES  = new Set(["ready", "snapshot", "txn-added", "zakat-paid", "error", "ai-request"]);

// What Yusr is allowed to ask the model for. A closed list, because "run this
// arbitrary prompt" would let a future screen quietly route a fiqh question
// through a model — the exact thing rule 1 exists to prevent.
const AI_KINDS = new Set(["invoice-draft", "note-tidy"]);

const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
const str = (v, n) => (typeof v === "string" ? v.slice(0, n || 200) : null);

// Validation is deliberately strict and boring. Anything unexpected is
// dropped with a reason rather than coerced into something plausible.
function validateIn(msg) {
  if (!msg || typeof msg !== "object") return { ok: false, why: "not an object" };
  if (msg.ns !== BRIDGE_NS) return { ok: false, why: "not ours" };
  if (msg.v !== BRIDGE_VERSION) return { ok: false, why: "version " + msg.v + ", expected " + BRIDGE_VERSION };
  if (!IN_TYPES.has(msg.type)) return { ok: false, why: "unknown type " + msg.type };

  if (msg.type === "ai-request") {
    const d = msg.data || {};
    if (!AI_KINDS.has(d.kind)) return { ok: false, why: "ai kind not allowed: " + d.kind };
    if (typeof d.text !== "string" || !d.text.trim()) return { ok: false, why: "ai-request needs text" };
    if (d.text.length > 4000) return { ok: false, why: "ai-request text too long" };
    // Every other branch returns the whole message; returning a bare `data`
    // here left receive() dereferencing undefined.
    return { ok: true, msg: { ...msg, data: { kind: d.kind, text: d.text,
      id: str(d.id, 40) || "", currency: str(d.currency, 8) || "" } } };
  }

  if (msg.type === "snapshot") {
    const d = msg.data || {};
    const clean = {
      kind: str(d.kind, 20),
      currency: str(d.currency, 8),
      // Money figures are numbers or they are absent. A string "1,500" would
      // silently become NaN later, so it is rejected here instead.
      //
      // NOTE the deliberate absence of a "net worth". Yusr's accounts hold
      // money, GRAMS of gold and HEAD of livestock. Adding those into one
      // number would be meaningless and wrong, so each account carries its own
      // unit and only cash is totalled.
      cashTotal: num(d.cashTotal), income: num(d.income), expense: num(d.expense),
      // The user's answer to "link this to Attune's memory?", decided in
      // Yusr where the money lives. Attune obeys it; it does not own it.
      share: ["on","off","unset"].includes(d.share) ? d.share : "unset",
      accounts: Array.isArray(d.accounts) ? d.accounts.slice(0, 60).map((a) => ({
        id: str(a.id, 40), name: str(a.name, 60), balance: num(a.balance),
        unit: str(a.unit, 12), kind: str(a.kind, 20), currency: str(a.currency, 8),
      })).filter((a) => a.id && a.balance !== null) : [],
      // Zakat comes across as already-computed, already-cited TEXT and
      // NUMBERS. Attune displays and explains. It never recomputes.
      zakat: d.zakat ? {
        noPrice: !!d.zakat.noPrice,
        due: !!d.zakat.due, amount: num(d.zakat.amount), nisab: num(d.zakat.nisab),
        base: num(d.zakat.base), hawlEndsISO: str(d.zakat.hawlEndsISO, 30),
        madhhab: str(d.zakat.madhhab, 30), basis: str(d.zakat.basis, 1200),
        sources: Array.isArray(d.zakat.sources) ? d.zakat.sources.slice(0, 12).map((x) => str(x, 200)).filter(Boolean) : [],
      } : null,
    };
    if (!clean.kind) return { ok: false, why: "snapshot has no kind" };
    return { ok: true, msg: { ...msg, data: clean } };
  }

  if (msg.type === "txn-added") {
    const d = msg.data || {};
    if (num(d.amount) === null) return { ok: false, why: "txn has no numeric amount" };
    if (!["income", "expense", "transfer", "debt", "zakat"].includes(d.type))
      return { ok: false, why: "unknown txn type " + d.type };
    return { ok: true, msg: { ...msg, data: {
      id: str(d.id, 40), type: d.type, amount: num(d.amount), currency: str(d.currency, 8),
      account: str(d.account, 40), party: str(d.party, 80), note: str(d.note, 300),
      ts: num(d.ts) || Date.now(), ref: str(d.ref, 60),
    } } };
  }
  return { ok: true, msg };
}

function validateOut(type, data) {
  if (!OUT_TYPES.has(type)) return { ok: false, why: "Attune may not send " + type };
  if (type === "propose-txn") {
    const d = data || {};
    if (num(d.amount) === null || d.amount <= 0) return { ok: false, why: "a proposal needs a positive amount" };
    if (!["in", "out"].includes(d.direction)) return { ok: false, why: "direction must be in or out" };
    // No account. Yusr asks the user. A guessed account is two wrong balances.
    if (d.account) return { ok: false, why: "Attune must not choose the account" };
    // Structurally impossible to propose a Zakat payment from outside.
    if (d.type === "zakat") return { ok: false, why: "Zakat is recorded in Yusr only" };
  }
  if (type === "ai-result") {
    const d = data || {};
    if (!AI_KINDS.has(d.kind)) return { ok: false, why: "ai kind not allowed: " + d.kind };
    // An answer with no request behind it would let Attune push content into
    // Yusr's screens unasked. Every result carries the id it is replying to.
    if (!d.id) return { ok: false, why: "an ai-result must name the request it answers" };
    // A draft is a PROPOSAL for a form, exactly like propose-txn. It may not
    // carry an account, and it may not be a zakat anything.
    if (d.draft && d.draft.account) return { ok: false, why: "Attune must not choose the account" };
  }
  return { ok: true };
}

// ---- the Attune side -----------------------------------------------------
function createBridge(post, opts) {
  const o = opts || {};
  const handlers = {};
  const log = [];
  let ready = false;
  let lastSnapshot = null;

  function send(type, data) {
    const v = validateOut(type, data);
    if (!v.ok) { log.push({ dir: "blocked", type, why: v.why }); return { ok: false, why: v.why }; }
    const msg = { ns: BRIDGE_NS, v: BRIDGE_VERSION, type, data: data || {}, id: "m" + (log.length + 1) };
    log.push({ dir: "out", type });
    post(msg);
    return { ok: true, id: msg.id };
  }

  function receive(raw) {
    const v = validateIn(raw);
    if (!v.ok) { log.push({ dir: "dropped", why: v.why }); return { ok: false, why: v.why }; }
    const msg = v.msg;
    log.push({ dir: "in", type: msg.type });
    if (msg.type === "ready") ready = true;
    if (msg.type === "snapshot") lastSnapshot = msg.data;
    (handlers[msg.type] || []).forEach((fn) => { try { fn(msg.data, msg); } catch (e) { /* a handler must not break the bridge */ } });
    return { ok: true, msg };
  }

  return {
    on(type, fn) { (handlers[type] = handlers[type] || []).push(fn); return this; },
    send, receive,
    proposeTransaction(parsed) {
      // Straight from paytext.js. Note what is NOT carried across: no account,
      // and no category guess. Yusr owns those decisions.
      return send("propose-txn", {
        amount: parsed.amount, direction: parsed.direction, currency: parsed.currency,
        party: parsed.party, ref: parsed.ref, ts: parsed.date,
        source: (parsed.source || "").slice(0, 600),
        confidence: parsed.confidence,
      });
    },
    request(kind) { return send("request", { kind }); },
    // Handshake, not hope. The child can finish loading and announce itself
    // before the parent has attached its listener — a race that shows up
    // exactly once in ten launches and is miserable to debug. So the parent
    // asks, repeatedly, until it gets an answer, instead of waiting for one.
    connect(everyMs, tries) {
      let n = 0;
      const gap = everyMs || 250, max = tries || 12;
      const tick = () => {
        if (ready || n >= max) return;
        n++; send("request", { kind: "ready" });
        (o.setTimeout || setTimeout)(tick, gap);
      };
      tick();
      return this;
    },
    get isReady() { return ready; },
    get snapshot() { return lastSnapshot; },
    get log() { return log.slice(); },
  };
}

// ---- what the AI is allowed to see --------------------------------------
// The Zakat wall, expressed as a function rather than a promise in a document.
// The model receives figures that Yusr already computed and text Yusr already
// cites. It is told, in the prompt, that deriving is not its job.
// The rules travel WITH the figures. An earlier version returned facts and
// left it to the caller to remember to prepend ZAKAT_AI_RULES — which means
// one forgetful call site anywhere in the app silently hands a model raw Zakat
// numbers with no instruction not to recompute them. There is no way to obtain
// the numbers from this function without the rule that governs them, and
// `prompt` is the whole block already assembled so the correct thing is also
// the easiest thing.
function zakatExplainContext(snapshot) {
  const z = snapshot && snapshot.zakat;
  if (!z) return null;
  // Unknown is not "no". Without a gold or silver price there is no niṣāb, so
  // the engine cannot say whether zakat is due — and "Zakat is not currently
  // due" would be a false reassurance about an obligation. The one honest
  // answer is that the app does not know yet, and what to do about it.
  if (z.noPrice) {
    const ctx0 = {
      rules: ZAKAT_AI_RULES,
      facts: [
        "The app cannot tell whether zakat is due: there is no gold or silver price, so the niṣāb is unknown.",
        "This is NOT the same as zakat not being due. Do not tell the user they owe nothing.",
        "Tell the user to open the Zakāt tab and set or refresh the metal price.",
      ],
      basis: z.basis || "",
      sources: z.sources || [],
    };
    ctx0.prompt = [ctx0.rules, "", ctx0.facts.join("\n"), ctx0.basis].filter(Boolean).join("\n");
    return ctx0;
  }
  const ctx = {
    rules: ZAKAT_AI_RULES,
    facts: [
      z.due ? "Zakat is currently due." : "Zakat is not currently due.",
      z.amount !== null ? "Amount calculated by Yusr: " + z.amount : null,
      z.base !== null ? "Zakatable base: " + z.base : null,
      z.nisab !== null ? "Niṣāb threshold: " + z.nisab : null,
      z.hawlEndsISO ? "Ḥawl completes: " + z.hawlEndsISO : null,
      z.madhhab ? "Setting in use: " + z.madhhab : null,
    ].filter(Boolean),
    basis: z.basis || "",
    sources: z.sources || [],
  };
  // One string, in the order a model should read it: the constraint, then the
  // figures, then the wording the app is willing to stand behind.
  ctx.prompt = [
    ctx.rules,
    "",
    ctx.facts.join("\n"),
    ctx.basis ? "\nStored basis (quote this, do not paraphrase the ruling):\n" + ctx.basis : "",
    ctx.sources.length ? "Sources: " + ctx.sources.join("; ") : "",
  ].filter(Boolean).join("\n");
  return ctx;
}

const ZAKAT_AI_RULES =
`ZAKAT — READ THIS BEFORE ANSWERING:
- Every figure below was calculated by the app's own Zakat engine, which is audited and scholar-reviewed. You did NOT calculate them and you must not recalculate, adjust, round, or estimate any of them.
- Your only job is to explain, in plain language, what the app has already determined, and to quote the stored basis and sources.
- You must not issue a ruling, choose between scholarly positions, or answer a fiqh question that the stored basis below does not already answer.
- If the question goes beyond what is written below, say exactly: "The app doesn't cover that — it's a question for a scholar." Then stop.
- Never say a number the app did not give you.`;

if (typeof module !== "undefined") module.exports = {
  createBridge, validateIn, validateOut, zakatExplainContext,
  ZAKAT_AI_RULES, BRIDGE_VERSION, BRIDGE_NS,
};
