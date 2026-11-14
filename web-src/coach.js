/* ---- v9.9.35 GD-5 (Ali picked): one-time tips where they help — each tip shows ONCE ever, on its own page, at most one a day (the person
   can ask for more with "Show me more tips"); "Show the tips again" in Settings → Set up your life starts them over. Pure. */
export const TIPS = [
  { id: "home-say", mode: "home", text: "Type or say what happened in the box — “lunch 150”, “remind me tomorrow at 9”, “Ahmed owes me 500”. Attune puts it in the right place." },
  { id: "home-setup", mode: "home", text: "Set up your life on Home walks you through your salary, bills, people and papers — each step counts only when it's really saved." },
  { id: "chat-do", mode: "chat", text: "Chat does things, not only answers: “remind me…”, “open Money”, “watch the PS5 under 20,000”. Something wrong? Tap Undo." },
  { id: "chat-mind", mode: "chat", text: "Change your mind in the same sentence — “at 5, no wait, 6” — and Attune keeps only the last one." },
  { id: "money-bank", mode: "money", text: "Allow bank messages once, and the payments your bank and wallet report are read for you." },
  { id: "money-safe", mode: "money", text: "Add your salary as a repeating income, and “safe to spend” counts right up to payday." },
  { id: "agents-away", mode: "agents", text: "Agents check by themselves about every 4 hours and at night, and tell you only when something really changed." },
  { id: "agents-rules", mode: "agents", text: "Tell an agent your rules in words — “only 5 stars”, “under 40,000”, “near the Haram” — and it follows them." },
  { id: "rem-repeat", mode: "reminders", text: "Say the repeat in words: “every Saturday at 10”, “every weekday at 8”, “on the last day of the month”." },
  { id: "radar-photo", mode: "radar", text: "Take a photo of a passport or any paper with a date — Attune reads the end date and reminds you before it." },
  { id: "life-plan", mode: "life", text: "“Sheikh owes me 19,500, 2,500 a month” becomes 8 payments with a reminder before each one." },
];
export const COACH_KEY = "attune:coach:v1";
const day = (now) => { const d = new Date(now); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
/** The tip to show now on `mode`, or null. st = { seen: [ids], day } */
export function tipFor(mode, st = {}, now = Date.now(), more = false) {
  if (!more && st.day === day(now)) return null;   // one a day, unless the person asked for more
  const seen = new Set(st.seen || []);
  if (seen.has("*")) return null;   // every tip seen
  return TIPS.find((t) => t.mode === mode && !seen.has(t.id)) || null;
}
/** After a tip was shown → the new state. */
export const markSeen = (id, st = {}, now = Date.now()) => ({ seen: [...new Set([...(st.seen || []), id])], day: day(now) });
