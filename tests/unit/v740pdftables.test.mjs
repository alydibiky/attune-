// v6.40 (S3) — PDF tables by code. node tests/unit/v740pdftables.test.mjs
import assert from "node:assert/strict";
import { numOf, linesOf, tablesOf, tableAnswer, answerText } from "../../web-src/pdftables.js";
assert.equal(numOf("1,234.50"), 1234.5); assert.equal(numOf("(1,200)"), -1200); assert.equal(numOf("EGP 3,000"), 3000); assert.equal(numOf("١٢٣"), 123); assert.equal(numOf("Total"), null);
// a page: a heading, then a table Item | Qty | Amount, three rows; page 2 goes on with the same header
const W = (x, y, t) => [x, y, t.length * 0.012, 0.012, t];
const row = (y, a, b, c) => [W(0.08, y, a), W(0.45, y, b), W(0.7, y, c)];
const p1 = { n: 1, words: [W(0.08, 0.05, "Invoice"), W(0.17, 0.05, "list"), ...row(0.2, "Item", "Qty", "Amount"), ...row(0.23, "Crane", "2", "18,000"), ...row(0.26, "Trailer", "1", "4,500.50"), ...row(0.29, "Rigger", "3", "(500)")] };
const p2 = { n: 2, words: [...row(0.1, "Item", "Qty", "Amount"), ...row(0.13, "Fuel", "10", "2,000")] };
const L = linesOf(p1.words); assert.equal(L[1].cells.length, 3); assert.equal(L[0].cells[0].text, "Invoice list");
const T = tablesOf([p1, p2]);
assert.equal(T.length, 1, "one table over two pages"); assert.deepEqual(T[0].pages, [1, 2]);
assert.deepEqual(T[0].head, ["Item", "Qty", "Amount"]); assert.equal(T[0].rows.length, 4);
const s = tableAnswer("What is the total of the amount column over all pages?", T);
assert.equal(s.op, "sum"); assert.equal(s.column, "Amount"); assert.equal(s.value, 24000.5); assert.equal(s.rows, 4);
assert.match(answerText(s), /The total of “Amount”: \*\*24,000\.5\*\* — calculated by code from 4 rows on pages 1–2 \[p\. 1\]/);
assert.equal(tableAnswer("average qty", T).value, 4);
const mx = tableAnswer("highest amount", T); assert.equal(mx.value, 18000); assert.match(mx.row, /Crane/);
assert.equal(tableAnswer("إجمالي Amount", T).value, 24000.5);
assert.equal(tableAnswer("sum of column 2", T).value, 16);
assert.equal(tableAnswer("what is this contract about?", T), null, "not a table question");
assert.equal(tableAnswer("total of the weight", T), null, "a column that isn't there");
console.log("v740pdftables: all passed");
