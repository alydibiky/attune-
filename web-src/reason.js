/* ---- making a small model reason like a big one ----------------------------------------
   Two proven tricks, done in code around the same model (no new weights):

   1. SELF-CONSISTENCY — ask the same question several times with a little
      randomness, and keep the final answer most of them agree on. A model
      that is right 60% of the time on its own is right far more often when
      three independent tries have to agree; wrong answers scatter, right
      ones cluster. (Wang et al., 2022: +17.9 points on GSM8K.)
   2. A STRICT CHECKER — the winning answer is re-read by the model acting
      as a reviewer who looks for the classic small-model mistakes: a
      condition ignored, physics reversed, a step that does not follow.

   Plus a third for files: 3. TOOLS — a spreadsheet question is answered by
   a pandas program the phone runs on the real file, not by the model
   "reading" a table (verify.js does the same for maths).                    */

import { programFrom, readAnswer } from "./verify.js";

/** Riddles, logic, physical reasoning, "explain your reasoning" questions. */
export function looksLikeReasoning(text) {
  const t = String(text || "");
  if (t.length < 30 || t.length > 2500) return false;
  if (/```/.test(t)) return false;
  return /\b(explain your reasoning|step[- ]by[- ]step|walk (me )?through|reason(ing)? (it )?out|riddle|puzzle|logic(al)?|trick question|where is the|which (one|is)|who is (lying|telling)|true or false|what happens (if|when)|would it|is it possible|paradox|deduce|infer|physical steps)\b|فكّر خطوة|خطوة بخطوة|لغز|منطق|فين ال|اشرح (السبب|تفكيرك)/i.test(t);
}

const SAMPLE_SYS = "Solve this carefully. Read every condition in the question literally and picture the physical situation. Reason in short numbered steps, check each step, then give the final answer on the last line exactly as: FINAL: <the answer in a few words>. Match the language of the question.";

export function sampleMessages(question, history = []) {
  return [{ role: "system", content: SAMPLE_SYS }, ...history, { role: "user", content: String(question).trim() }];
}

export function finalOf(text) {
  const m = String(text || "").match(/FINAL\s*[:：]\s*(.+?)\s*$/im);
  return m ? m[1].replace(/\*+/g, "").trim() : null;
}

const STOP = new Set("the a an it is are of on in at to and its it's will be was that this then".split(" "));
export function normFinal(f) {
  return String(f || "").toLowerCase().replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^\p{L}\p{N}.\s-]/gu, " ")
    .split(/\s+/).filter((w) => w && !STOP.has(w)).join(" ").trim();
}
function same(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const na = (a.match(/-?\d+(\.\d+)?/g) || []).join(","), nb = (b.match(/-?\d+(\.\d+)?/g) || []).join(",");
  if (na && nb) return na === nb;                         // numeric answers: the numbers decide
  const A = new Set(a.split(" ")), B = new Set(b.split(" "));
  let k = 0; for (const w of A) if (B.has(w)) k++;
  return k / Math.max(1, Math.min(A.size, B.size)) >= 0.6;
}

/** Group the finals; → { index of the winning sample, votes, total } */
export function vote(finals) {
  const norm = finals.map(normFinal);
  let best = -1, votes = 0;
  for (let i = 0; i < norm.length; i++) {
    if (!norm[i]) continue;
    const v = norm.filter((x) => same(norm[i], x)).length;
    if (v > votes) { votes = v; best = i; }
  }
  return { best, votes, total: finals.filter(Boolean).length };
}

export function checkMessages(question, answer) {
  return [
    { role: "system", content: "You are a strict reviewer. Check the answer below for mistakes: a condition of the question ignored, the physical situation pictured wrongly, a step that does not follow, an arithmetic error, or a final answer that contradicts the steps. If the answer is fully correct, reply with exactly: CORRECT. Otherwise reply with the complete corrected answer in short numbered steps, ending with: FINAL: <answer>." },
    { role: "user", content: `Question:\n${String(question).trim()}\n\nAnswer to check:\n${String(answer).trim()}` },
  ];
}

export function judgeMessages(question, answers) {
  return [
    { role: "system", content: "Several attempts answered the same question differently. Work out which is right by checking each against the question's conditions. Then write the correct answer in short numbered steps, ending with: FINAL: <answer>." },
    { role: "user", content: `Question:\n${String(question).trim()}\n\n` + answers.map((a, i) => `Attempt ${i + 1}:\n${String(a).trim()}`).join("\n\n") },
  ];
}

/** "…steps…\nFINAL: x" → the steps and a bold answer line (what the person sees). */
export function presentable(text) {
  const f = finalOf(text);
  const body = String(text || "").replace(/^\s*FINAL\s*[:：].*$/im, "").trim();
  return f ? `**${f}**\n\n${body}` : body;
}

/**
 * Self-consistency + checker. llm(messages, {maxTokens, temperature, onToken}) → text.
 * → { text, final, votes, total, checked: "agreed"|"corrected"|"judged" }
 */
export async function reasonVote({ question, history = [], llm, n = 3, onStep = () => {}, onToken, isStopped = () => false }) {
  const tries = [];
  for (let i = 0; i < n; i++) {
    if (isStopped()) throw new Error("Stopped");
    onStep(i === 0 ? "Thinking it through…" : `Checking another way (${i + 1} of ${n})…`);
    const t = await llm(sampleMessages(question, history), { maxTokens: 800, temperature: i === 0 ? 0.3 : 0.8, onToken: i === 0 ? onToken : undefined });
    tries.push(t);
    // Two early answers that already agree: a third try adds little.
    if (i === 1) { const v = vote(tries.map(finalOf)); if (v.votes === 2) break; }
  }
  const finals = tries.map(finalOf);
  const v = vote(finals);
  let text, checked;
  if (v.votes >= 2) {
    text = tries[v.best]; checked = "agreed";
    onStep("Answers agree — a strict check…");
    const c = await llm(checkMessages(question, text), { maxTokens: 700, temperature: 0.2 });
    if (!/^\s*CORRECT\b/i.test(c) && finalOf(c)) { text = c; checked = "corrected"; }
  } else {
    onStep("The tries disagree — weighing them…");
    text = await llm(judgeMessages(question, tries), { maxTokens: 900, temperature: 0.2 });
    checked = "judged";
  }
  return { text: presentable(text), final: finalOf(text), votes: v.votes, total: tries.length, checked };
}

// ---- files: answers computed from the real data -----------------------------------------
export const DATA_EXT = /\.(csv|tsv|xlsx|xlsm|xls|json|txt)$/i;

/* v5.13: files as they really come. Attendance machines, banks and old
   accounting programs save ".xls" files that are really an HTML page or a
   tab-separated text file; real old .xls needs xlrd. This loader, put in
   front of every program run on a file, reads all of them — and quietly
   rescues a plain pd.read_excel() / pd.read_csv() that would have failed. */
export const FILE_PRELUDE = `import pandas as pd, io as _io
from html.parser import HTMLParser as _HP
_orig_read_excel, _orig_read_csv = pd.read_excel, pd.read_csv
def _decode(raw):
    if raw[:2] in (b"\\xff\\xfe", b"\\xfe\\xff"): return raw.decode("utf-16", "replace")
    for enc in ("utf-8-sig", "cp1256"):
        try: return raw.decode(enc)
        except Exception: pass
    return raw.decode("latin-1", "replace")
class _Tables(_HP):
    def __init__(self):
        super().__init__(); self.tables = []; self._row = None; self._cell = None
    def handle_starttag(self, tag, a):
        if tag == "table": self.tables.append([])
        elif tag == "tr" and self.tables: self._row = []
        elif tag in ("td", "th") and self._row is not None: self._cell = []
        elif tag == "br" and self._cell is not None: self._cell.append(" ")
    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._cell is not None and self._row is not None:
            self._row.append(" ".join("".join(self._cell).split())); self._cell = None
        elif tag == "tr" and self._row is not None and self.tables:
            if any(c for c in self._row): self.tables[-1].append(self._row)
            self._row = None
    def handle_data(self, d):
        if self._cell is not None: self._cell.append(d)
def _frame(rows):
    rows = [r for r in rows if any(str(c).strip() for c in r)]
    if not rows: return pd.DataFrame()
    w = max(len(r) for r in rows); rows = [r + [""] * (w - len(r)) for r in rows]
    # the header is the first row that is mostly filled in (titles above it are skipped)
    h = next((i for i, r in enumerate(rows[:15]) if sum(1 for c in r if str(c).strip()) >= max(2, w * 0.6)), 0)
    head = [str(c).strip() or f"col{i+1}" for i, c in enumerate(rows[h])]
    seen = {}
    for i, c in enumerate(head):
        if c in seen: seen[c] += 1; head[i] = f"{c}.{seen[c]}"
        else: seen[c] = 0
    df = pd.DataFrame(rows[h + 1:], columns=head)
    for c in df.columns:
        s = pd.to_numeric(df[c].astype(str).str.replace(",", "").str.strip(), errors="coerce")
        if s.notna().sum() >= max(1, 0.8 * (df[c].astype(str).str.strip() != "").sum()): df[c] = s
    return df
def load_sheets(name):
    """Every table in the file → {sheet name: DataFrame}. Works for xlsx, xls, csv, tsv and 'xls' files that are really HTML or text."""
    raw = open(name, "rb").read()
    head = raw[:600].lstrip().lower()
    if head.startswith(b"<") or b"<table" in raw[:4000].lower():
        p = _Tables(); p.feed(_decode(raw))
        t = {f"Table{i+1}": _frame(r) for i, r in enumerate(p.tables) if r}
        if t: return t
    if raw[:4] == b"PK\\x03\\x04" or raw[:8] == b"\\xd0\\xcf\\x11\\xe0\\xa1\\xb1\\x1a\\xe1":
        eng = "openpyxl" if raw[:4] == b"PK\\x03\\x04" else "xlrd"
        return _orig_read_excel(name, sheet_name=None, engine=eng)
    text = _decode(raw)
    try: return {"Sheet1": _orig_read_csv(_io.StringIO(text), sep=None, engine="python")}
    except Exception:
        return {"Sheet1": _frame([l.split("\\t") for l in text.splitlines()])}
def _read_excel(io, sheet_name=0, *a, **k):
    try: return _orig_read_excel(io, sheet_name, *a, **k)
    except Exception:
        if not isinstance(io, str): raise
        t = load_sheets(io)
        if sheet_name is None: return t
        if isinstance(sheet_name, int): return list(t.values())[sheet_name]
        return t.get(sheet_name, list(t.values())[0])
def _read_csv(f, *a, **k):
    try: return _orig_read_csv(f, *a, **k)
    except Exception:
        if not isinstance(f, str): raise
        return list(load_sheets(f).values())[0]
pd.read_excel, pd.read_csv = _read_excel, _read_csv
`;

/** Python that describes a file so the model can write code for it. */
export function profileCode(name) {
  const n = JSON.stringify(name);
  return `import json
name = ${n}
low = name.lower()
if low.endswith((".json",)):
    d = json.load(open(name, encoding="utf-8"))
    print(type(d).__name__, (len(d) if hasattr(d, "__len__") else ""))
    print(json.dumps(d, ensure_ascii=False)[:1500])
elif low.endswith((".txt", ".md")):
    t = open(name, encoding="utf-8", errors="replace").read()
    print(len(t), "characters"); print(t[:1500])
else:
    sheets = load_sheets(name)
    for s, df in sheets.items():
        print(f"SHEET {s!r}: {df.shape[0]} rows x {df.shape[1]} columns")
        print(df.dtypes.to_string())
        print(df.head(8).to_string(max_colwidth=40))
        print()
`;
}

export function dataMessages(question, name, profile) {
  return [
    { role: "system", content: `You answer questions about a file by writing ONE Python 3 program that computes the answer from the file itself. The file is in the current folder as ${JSON.stringify(name)}. pandas and numpy are available; no internet. Read the file ONLY with \`sheets = load_sheets(${JSON.stringify(name)})\` (already defined: it returns {sheet name: DataFrame}, exactly as in the profile) and pick the sheet you need. Use the exact column and sheet names shown in the profile. Times like "08:30" are text: convert with pd.to_timedelta(col + ":00") or pd.to_datetime before adding them. Print the key numbers or a small table (df.to_string()), and make the LAST line printed exactly 'ANSWER: <short answer>'. Reply with the code block only.` },
    { role: "user", content: `File profile:\n${String(profile).slice(0, 3500)}\n\nQuestion: ${String(question).trim()}` },
  ];
}

export function dataExplainMessages(question, name, output, answer) {
  return [
    { role: "system", content: "You explain an answer that a program computed from the user's own file. The numbers are correct — use them as they are, do not invent others. Start with the answer in bold, then at most a few lines or a small Markdown table with the key figures. Match the language of the question. No code." },
    { role: "user", content: `File: ${name}\nQuestion: ${String(question).trim()}\n\nThe program printed:\n${String(output).trim().split("\n").slice(-40).join("\n")}\n\nResult: ${answer}` },
  ];
}

/** Answer a question about an attached file with a program run on it. runPy(code, files) → result. */
export async function analyzeFile({ question, file, llm, runPy, onStep = () => {}, onToken }) {
  onStep("Opening the file…");
  const lastLine = (e) => String(e || "").split("\n").map((l) => l.trim()).filter(Boolean).pop() || "unknown error";
  const withPrelude = (code) => FILE_PRELUDE + "\n" + code;
  const prof = await runPy(withPrelude(profileCode(file.name)), [file]);
  if (!prof.ok) return { ok: false, why: "Could not open the file: " + lastLine(prof.error) };
  onStep("Writing a program to work it out from your data…");
  let code = programFrom(await llm(dataMessages(question, file.name, prof.stdout), { maxTokens: 1000 }));
  if (!code) return { ok: false, why: "the model wrote no program", profile: prof.stdout };
  let res = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    onStep(attempt ? "Fixing the program and running it again…" : "Running it on your file…");
    res = await runPy(withPrelude(code), [file]);
    if (res.ok && readAnswer(res.stdout)) break;
    if (attempt === 2) return { ok: false, why: "The program couldn't finish: " + (res.error ? lastLine(res.error) : "no ANSWER line"), code, profile: prof.stdout };
    const why = res.ok ? "The program did not print a line starting with 'ANSWER:'." : res.error;
    const again = await llm([...dataMessages(question, file.name, prof.stdout), { role: "assistant", content: "```python\n" + code + "\n```" },
      { role: "user", content: "Running it failed:\n```\n" + String(why).slice(-1500) + "\n```\nSend the corrected full program, code block only." }], { maxTokens: 1000 });
    code = programFrom(again) || code;
  }
  const answer = readAnswer(res.stdout);
  onStep("Computed from your file — writing the answer…");
  const text = await llm(dataExplainMessages(question, file.name, res.stdout, answer), { maxTokens: 700, onToken });
  return { ok: true, text, code, output: res.stdout, answer };
}

// ---- checking the person's correction before learning it --------------------------------
/* 👎 → "the right answer is …". People can be wrong too, so a correction is
   not saved on trust: the model works the question out again from scratch
   (maths: as a program the phone runs) and compares. Only a correction that
   holds up — or one that is the person's own preference or fact (what their
   crews call a part) — is learned; otherwise the app explains why.        */

const CORR_SYS = "Someone says an AI assistant's answer was wrong and gives what they think is the right answer. Trust neither side: work the question out yourself from scratch, reading every condition literally, then compare. Reply in exactly this form:\nVERDICT: RIGHT or WRONG or PARTLY or PREFERENCE\nREASON: <one or two short sentences, in the language of the question>\nANSWER: <the correct answer in a few words>\nRIGHT = the person's correction is correct. WRONG = the correction is mistaken (for example the original answer was already right). PARTLY = part of the correction is right and part is not. PREFERENCE = it is about wording, naming, format or style, or about facts only the person can know (their company, their people, their own names for things) — those are theirs to decide.";

export function correctionMessages({ question, was, corrected, note }) {
  return [
    { role: "system", content: CORR_SYS },
    { role: "user", content: `Question:\n${String(question || "").trim()}\n\nThe assistant answered:\n${String(was || "").trim().slice(0, 2500)}\n\nThe person says the right answer is:\n${String(corrected || "").trim()}` + (note ? `\n\nTheir reason: ${String(note).trim()}` : "") },
  ];
}

export function readVerdict(text) {
  const t = String(text || "");
  const v = (t.match(/VERDICT\s*[:：]\s*\**\s*(RIGHT|WRONG|PARTLY|PREFERENCE)/i) || [])[1];
  const reason = ((t.match(/REASON\s*[:：]\s*(.+)/i) || [])[1] || "").replace(/\*+/g, "").trim();
  const answer = ((t.match(/ANSWER\s*[:：]\s*(.+)/i) || [])[1] || "").replace(/\*+/g, "").trim();
  return v ? { verdict: v.toLowerCase(), reason, answer } : null;
}

const nums = (s) => (String(s || "").replace(/(\d),(?=\d{3}\b)/g, "$1").match(/-?\d+(\.\d+)?/g) || []).map(Number);
/** Does a computed answer agree with the person's numbers? (within 0.5%) */
export function numbersAgree(computed, corrected) {
  const a = nums(computed), b = nums(corrected);
  if (!a.length || !b.length) return null;
  return b.some((x) => Math.abs(x - a[0]) <= Math.max(1e-9, Math.abs(a[0]) * 0.005));
}

/**
 * → { verdict: "right"|"wrong"|"partly"|"preference"|"unsure", reason, answer, how: "computed"|"checked"|"none", save: bool }
 * mathCheck(question) → { ok, answer, code } (optional: verifyMath without the explanation)
 */
export async function checkCorrection({ question, was, corrected, note = "", llm, mathCheck, onStep = () => {} }) {
  if (mathCheck) {
    onStep("Checking your correction by computing it…");
    try {
      const m = await mathCheck(question);
      const agree = m && m.ok ? numbersAgree(m.answer, corrected) : null;
      if (agree !== null) return agree
        ? { verdict: "right", reason: `Computed on the phone: ${m.answer}.`, answer: m.answer, how: "computed", code: m.code, save: true }
        : { verdict: "wrong", reason: `Computed on the phone: ${m.answer} — not what the correction says.`, answer: m.answer, how: "computed", code: m.code, save: false };
    } catch (e) { /* fall through to the model's own check */ }
  }
  onStep("Double-checking your correction…");
  const msgs = correctionMessages({ question, was, corrected, note });
  const verdicts = [];
  for (const temp of [0.2, 0.7, 0.5]) {
    let r = null;
    try { r = readVerdict(await llm(msgs, { maxTokens: 400, temperature: temp })); } catch (e) { if (/stopped/i.test(e.message)) throw e; }
    if (r) verdicts.push(r);
    if (verdicts.length === 2 && verdicts[0].verdict === verdicts[1].verdict) break;
    if (verdicts.length === 2) onStep("The checks disagree — one more look…");
  }
  if (!verdicts.length) return { verdict: "unsure", reason: "Could not check it (no answer from the model).", answer: "", how: "none", save: false };
  const count = {}; verdicts.forEach((v) => (count[v.verdict] = (count[v.verdict] || 0) + 1));
  const top = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
  if (count[top] < 2 && verdicts.length > 1) return { verdict: "unsure", reason: "The checks did not agree: " + verdicts.map((v) => v.verdict).join(", ") + ".", answer: "", how: "checked", save: false };
  const pick = verdicts.find((v) => v.verdict === top);
  return { ...pick, verdict: top, how: "checked", save: top === "right" || top === "preference" };
}
