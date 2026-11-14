// The HELD-OUT phrasings for tests/countgoals/gen.mjs — written after the code, never used to write it.
export const G = {
  goalEn: [(n, u, d) => `my goal is to read ${n} ${u} before ${d}`, (n, u, d) => `I'll read ${n} ${u} by ${d}`, (n, u, d) => `target: ${n} ${u} read before ${d}`, (n, u, d) => `let's read ${n} ${u} until ${d}`],
  goalAr: [(n, u, d) => `نفسي اقرا ${n} ${u} قبل ${d}`, (n, u, d) => `لازم اخلص ${n} ${u} قبل ${d}`, (n, u, d) => `هقرا ${n} ${u} لحد ${d}`],
  doneEn: [(t) => `just finished another book${t ? " — " + t : ""}`, (t) => (t ? `I finished reading ${t}` : `I finished the book`), (t) => `completed a book${t ? ": " + t : ""}`, () => `done with another book`],
  doneAr: [(t) => `انا خلصت كتاب${t ? ": " + t : ""}`, (t) => `قريت كتاب${t ? " " + t : ""} النهارده`, () => `لسه خالص كتاب`],
  doneMany: [(n) => `I read ${n} more books`, (n) => `just finished ${n} books`, (n) => (n === 2 ? `خلصت كتابين` : `قريت ${n} كتب`)],
  other: [["just went to the gym", "gym"], ["I worked out", "workout"], ["I ran today", "run"], ["روحت الجيم", "gym"], ["completed a course", "course"], ["5alast ketab", "book"], ["finished a workout", "workout"]],
  notDone: ["have I finished a book this month?", "I need to read the book before Monday", "reading a book now", "finished it", "how many books are left?", "خلصت الشغل", "خلص العيش", "read me a book", "order a book", "finished the meeting", "I read your message"],
  notGoal: ["save 10000 by May", "lose 3 kg by June", "how many books did I read?", "spend under 2000 on coffee this month", "bought 2 books for 300", "remind me to read at 10 pm"],
};
