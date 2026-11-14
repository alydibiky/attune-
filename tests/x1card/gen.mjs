// v9.9.24 X1 business card → People card: exactly 10,000 cards — English, Arabic (Arabic-Indic digits), French; name with or without an
// honorific (Dr., Eng., «م.», «د.»), job title, company, mobile / landline / fax labelled or not (Egypt, Saudi, UAE formats), email,
// website, in shuffled orders (cards put the company on top or the name on top). Checked: the name exactly (never the company or the
// title), the title, the company, the phone saved is the MOBILE (never the fax), the email, the website.
const B = await import(process.env.BC || "../../web-src/bizcard.js");
function rng(seed) { let s = (seed + 7919 * +(process.env.SEED_SHIFT || 0)) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const AR = (s) => String(s).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
const N = { en: [["Ahmed", "Kamal"], ["Sara", "Fawzy"], ["Omar", "Hamdy"], ["Mona", "Lotfy"], ["Karim", "Zaki"], ["Laila", "Ragab"]], ar: [["أحمد", "كمال"], ["سارة", "فوزي"], ["عمر", "حمدي"], ["منى", "لطفي"], ["كريم", "زكي"], ["ليلى", "رجب"]], fr: [["Jean", "Martin"], ["Claire", "Dubois"], ["Hugo", "Bernard"], ["Léa", "Moreau"]] };
const T = { en: ["Sales Manager", "Senior Engineer", "Marketing Director", "Chief Accountant", "Legal Consultant", "Project Coordinator"], ar: ["مدير المبيعات", "مهندس أول", "مدير التسويق", "محاسب", "مستشار قانوني", "منسق مشروعات"], fr: ["Directeur commercial", "Ingénieur", "Responsable marketing", "Comptable"] };
const C = { en: ["Raya Trading Co.", "Nile Solutions LLC", "Cairo Heart Clinic", "Delta Motors", "Orascom Group"], ar: ["شركة النيل للمقاولات", "مجموعة دلتا", "بنك مصر", "مستشفى السلام", "شركة راية للتجارة"], fr: ["Société Générale", "Atlas Consulting SARL", "Groupe Lumière"] };
const HON = { en: ["Dr. ", "Eng. ", "", "", ""], ar: ["م. ", "د. ", "", "", ""], fr: ["Dr ", "", "", ""] };
export function make(i) {
  const r = rng(i * 97 + 1), pick = (a) => a[Math.floor(r() * a.length)], lang = ["en", "en", "ar", "ar", "fr"][i % 5], ar = lang === "ar";
  const [f, l] = pick(N[lang]), name = f + " " + l, hon = pick(HON[lang]), title = pick(T[lang]), company = pick(C[lang]);
  const cc = pick(["eg", "sa", "ae"]);
  const mob = cc === "eg" ? "01" + pick(["0", "1", "2", "5"]) + String(Math.floor(1e7 + r() * 9e7)) : "05" + String(Math.floor(1e7 + r() * 9e7));
  const land = cc === "eg" ? "02" + String(Math.floor(2e7 + r() * 7e7)) : "01" + String(Math.floor(1e6 + r() * 8e6)) + "1";
  const fax = land.slice(0, -1) + ((+land.slice(-1) + 1) % 10);
  const fmt = (n) => { const s = r() < 0.3 ? (cc === "eg" ? "+20 " : cc === "sa" ? "+966 " : "+971 ") + n.slice(1).replace(/(\d{2,3})(\d{3})(\d{4})$/, "$1 $2 $3") : n.replace(/(\d{3,4})(\d{3})(\d{4})$/, "$1 $2 $3"); return ar && r() < 0.6 ? AR(s) : s; };
  const ML = ar ? pick(["موبايل: ", "محمول ", "جوال: "]) : lang === "fr" ? pick(["Mobile : ", "Port. ", "M "]) : pick(["Mob: ", "Mobile ", "M ", "Cell: "]);
  const TL = ar ? pick(["تليفون: ", "ت: "]) : pick(["Tel: ", "T ", "Phone "]), FL = ar ? "فاكس: " : pick(["Fax: ", "F: "]);
  const email = (f.normalize("NFD").replace(/[^\w]/g, "") || "info").toLowerCase() + "@" + pick(["raya.com", "nile.com.eg", "atlas.fr", "delta.ae"]);
  const site = pick(["www.raya.com", "nile.com.eg", "https://atlas.fr", "www.delta.ae"]);
  const lines = [hon + name, title, company, ML + fmt(mob)];
  if (r() < 0.7) lines.push(TL + fmt(land)); if (r() < 0.5) lines.push(FL + fmt(fax)); if (r() < 0.8) lines.push(email); const hasSite = r() < 0.6; if (hasSite) lines.push(site);
  if (r() < 0.4) { const top = lines.splice(2, 1); lines.unshift(top[0]); }   // the company on top
  return { text: lines.join("\n"), name, title, company, mob, email: lines.includes(email) ? email : "", site: hasSite ? site : "" };
}
export function run(Nn = 10000, from = 0) {
  let pass = 0; const bad = [];
  for (let i = from; i < from + Nn; i++) {
    const c = make(i), x = B.readCard(c.text), why = [];
    if (!(x.name === c.name && x.sure.name)) why.push("name " + JSON.stringify(x.name) + " ≠ " + c.name);
    if (x.title !== c.title) why.push("title " + JSON.stringify(x.title));
    if (x.company !== c.company) why.push("company " + JSON.stringify(x.company));
    const digits = (s) => String(s).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/\D/g, "").replace(/^(20|966|971)/, "0");
    if (digits(x.phone) !== c.mob) why.push("phone " + x.phone + " ≠ " + c.mob);
    if (x.email !== c.email) why.push("email " + x.email);
    if (c.site && !String(x.website).includes(c.site.replace(/^https?:\/\//, ""))) why.push("site " + x.website);
    if (why.length) { if (bad.length < 6) bad.push({ i, why, text: c.text }); } else pass++;
  }
  return { pass, N: Nn, rate: pass / Nn, bad };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) console.log(JSON.stringify(run(+(process.argv[2] || 10000), +(process.argv[3] || 0))));
