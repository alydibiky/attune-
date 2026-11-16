// Held-out for tests/bankcard/gen.mjs — banks, networks, expiry wordings and non-card papers written AFTER bankcard.js was fixed.
let n = 7; const dig = (k) => Array.from({ length: k }, () => (n = (n * 7919 + 13) % 10007) % 10).join("");
export const H = {
  banks: [["ADIB", "ADIB Egypt"], ["Alex Bank", "ALEXBANK"], ["Banque du Caire", "Banque du Caire"], ["Emirates NBD", "Emirates NBD"], ["Al Rajhi", "مصرف الراجحي"], ["FAB", "FAB"], ["Telda", "telda"], ["Revolut", "Revolut"], ["", "PREMIUM BANKING"]],
  nets: [["American Express", "AMERICAN EXPRESS"], ["Visa", "Visa Signature"], ["Mastercard", "mastercard titanium"], ["UnionPay", "UnionPay"], ["Meeza", "ميزة"]],
  exp: [(m, y) => `VALID THRU\n${m}/${y}`, (m, y) => `THRU ${m} / ${y}`, (m, y) => `Expiry date: ${m}/20${y}`, (m, y) => `EXP. ${m}/${y}`, (m, y) => `تاريخ الانتهاء ${m}/${y}`, (m, y) => `VALID UNTIL END OF ${m}-20${y}`],
  not: [() => `Electricity bill ${dig(10)} due 25/11/2026 amount 432.50`, () => `Vodafone Cash: you received EGP 500 from 0101 ${dig(3)} ${dig(4)}`, () => `Tracking no ${dig(4)}-${dig(4)} arrives 18/11`, () => `Licence plate ${dig(4)} renewal 03/2027 traffic unit`, () => `Invoice INV-${dig(5)} total 12,400 EGP due in 30 days`, () => `Boarding pass MS${dig(3)} seat 14A gate B${dig(1)} 07:40`],
};
