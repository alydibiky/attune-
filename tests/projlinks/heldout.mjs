// Held-out for tests/projlinks/gen.mjs — project names, payment notes, people and date forms written AFTER projlinks.js was fixed.
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const H = {
  fmt: [(d) => `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`, (d) => `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`, (d) => `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`],
  proj: [["Sahel chalet", "sahel", ["sahel deposit", "Sahel AC repair", "the Sahel furniture"]], ["Gouna trip", "gouna", ["Gouna hotel", "gouna boat"]],
    ["تشطيب شقة التجمع", "التجمع", ["سيراميك التجمع", "نقاش التجمع"]], ["Ramadan iftar", "iftar", ["iftar food", "the iftar chairs"]], ["Mazda service", "mazda", ["Mazda oil", "mazda tyres"]],
    ["Hurghada dive", "hurghada", ["hurghada flights", "Hurghada — dive course"]]],
  people: [["Tarek", "carpenter"], ["Yasmin", ""], ["Samy", "driver"], ["Dina", "accountant"], ["Waleed", "broker"]],
  twin: "Mohamed",
};
