// v6.32 Contract second opinion: risky terms flagged by code, with the sentence, plain words and what to ask.
import { looksLikeContract, reviewContract, changeRequest, kindOf } from "../../web-src/contract.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const RENT_AR = `عقد إيجار شقة
تحرر هذا العقد بين الطرف الأول (المؤجر) والطرف الثاني (المستأجر).
البند الأول: يتجدد العقد تلقائيا لمدة مماثلة.
البند الثاني: يوقع المستأجر على إيصال أمانة بمبلغ ٥٠٠٠٠ جنيه ضمانا للعين المؤجرة.
البند الثالث: يحق للمؤجر زيادة الإيجار بنسبة ٢٠٪ سنويا.
البند الرابع: في حالة التأخير يلتزم المستأجر بغرامة ٥٪ عن كل يوم تأخير.`;
ok(looksLikeContract(RENT_AR) && kindOf(RENT_AR) === "rent", "an Arabic rent contract is recognised");
const r = reviewContract(RENT_AR);
const ids = r.flags.map((f) => f.id);
ok(ids[0] === "blank-cheque" || ids[0] === "late-fee", "the most serious first: " + ids.join(","));
ok(ids.includes("blank-cheque") && ids.includes("auto-renew") && ids.includes("late-fee") && ids.includes("rent-rise") && ids.includes("unilateral-change"), "trust receipt, auto-renewal, 5 %/day late fee, 20 % rise, one-sided change");
ok(r.flags.find((f) => f.id === "blank-cheque").quote.includes("إيصال أمانة"), "each flag quotes the sentence as written");
ok(r.level === "serious" && r.missing.some((m) => /repairs/.test(m.en)), "missing: who pays repairs (" + r.missing.map((m) => m.en) + ")");
const JOB = `EMPLOYMENT AGREEMENT. This agreement is between the Employer and the Employee. The Employee shall serve a probation period of 6 months.
The Company may terminate this agreement at any time without notice. The Employee shall not work for any competitor for 3 years.
All inventions, whether or not made outside working hours, belong to the Company. Salary: 20,000 EGP a month.`;
const j = reviewContract(JOB);
ok(j.kind === "job" && ["one-sided-end", "non-compete", "ip-all", "probation"].every((x) => j.flags.some((f) => f.id === x)), "a job contract: one-sided end, non-compete, IP, 6-month probation (" + j.flags.map((f) => f.id) + ")");
ok(j.missing.some((m) => /paid leave/.test(m.en)) && !j.missing.some((m) => /salary/.test(m.en)), "missing paid leave, salary is there");
ok(!looksLikeContract("iPhone 15 Pro 256GB, like new, 38,000 EGP, deposit on Vodafone Cash to hold it"), "a seller's offer is not a contract");
const clean = reviewContract("Service agreement between the Client and the Contractor. Scope: a website. Fee 10,000 EGP paid on delivery within 30 days. Either party may end it with 30 days' written notice.");
ok(clean.level === "ok" && !clean.flags.length, "a fair short contract → no flags");
const msg = changeRequest(r, "ar");
ok(msg.startsWith("قبل التوقيع") && msg.split("\n").length >= 6, "a message asking for the changes, in Arabic");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
