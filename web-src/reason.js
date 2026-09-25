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

/** Python that describes a file so the model can write code for it. */
export function profileCode(name) {
  const n = JSON.stringify(name);
  return `import pandas as pd, json
name = ${n}
low = name.lower()
if low.endswith((".xlsx", ".xlsm", ".xls")):
    sheets = pd.read_excel(name, sheet_name=None)
    for s, df in sheets.items():
        print(f"SHEET {s!r}: {df.shape[0]} rows x {df.shape[1]} columns")
        print(df.dtypes.to_string())
        print(df.head(6).to_string(max_colwidth=40))
        print()
elif low.endswith((".csv", ".tsv")):
    df = pd.read_csv(name, sep=None, engine="python")
    print(f"{df.shape[0]} rows x {df.shape[1]} columns")
    print(df.dtypes.to_string())
    print(df.head(6).to_string(max_colwidth=40))
elif low.endswith(".json"):
    d = json.load(open(name))
    print(type(d).__name__, (len(d) if hasattr(d, "__len__") else ""))
    print(json.dumps(d, ensure_ascii=False)[:1500])
else:
    t = open(name, encoding="utf-8", errors="replace").read()
    print(len(t), "characters"); print(t[:1500])
`;
}

export function dataMessages(question, name, profile) {
  return [
    { role: "system", content: `You answer questions about a file by writing ONE Python 3 program that computes the answer from the file itself. The file is in the current folder as ${JSON.stringify(name)}. pandas, numpy and openpyxl are available; no internet. Use the exact column and sheet names shown in the profile. Print the key numbers or a small table (df.to_string()), and make the LAST line printed exactly 'ANSWER: <short answer>'. Reply with the code block only.` },
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
  const prof = await runPy(profileCode(file.name), [file]);
  if (!prof.ok) return { ok: false, why: "Could not open the file: " + (prof.error || "").split("\n").pop() };
  onStep("Writing a program to work it out from your data…");
  let code = programFrom(await llm(dataMessages(question, file.name, prof.stdout), { maxTokens: 1000 }));
  if (!code) return { ok: false, why: "no program" };
  let res = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    onStep(attempt ? "Fixing the program and running it again…" : "Running it on your file…");
    res = await runPy(code, [file]);
    if (res.ok && readAnswer(res.stdout)) break;
    if (attempt === 2) return { ok: false, why: res.error || "no ANSWER line", code, profile: prof.stdout };
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
