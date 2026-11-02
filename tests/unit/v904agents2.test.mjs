// v9.0 (Ali: "do the not done yet"): an Arabic product name is searched and matched in English; a research agent that keeps
// going ("keep me updated on X every week") in all 20 languages.
import { parseAgent, makeAgent, followQuestion, followDone, nextFollow, bestAcross } from "../../web-src/agents.js";
import { productEnglish } from "../../web-src/agent.js";
import { followOf } from "../../web-src/understand.js";
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } };
const now = Date.parse("2026-11-02T10:00:00");
ok(productEnglish("سماعة هواوي فري كليب 2").en === "Huawei FreeClip 2 earbuds", "«سماعة هواوي فري كليب 2» → Huawei FreeClip 2 earbuds");
ok(productEnglish("ايفون 16 برو ماكس ٢٥٦ جيجا").en === "iPhone 16 Pro Max 256 GB", "iPhone, Arabic digits");
ok(productEnglish("سامسونج جالكسي اس 24 الترا").en === "Samsung Galaxy S24 Ultra", "Galaxy S24 as the stores write it");
ok(productEnglish("شاشة سامسونج 55 بوصة").en === "Samsung 55 inch TV", "a TV");
const w = parseAgent("دورلي على سماعة هواوي فري كليب 2 بأقل من 8400", { country: "EG", now });
ok(w.kind === "watch" && w.what === "Huawei FreeClip 2" && w.said === "سماعة هواوي فري كليب 2" && /amazon\.eg\/s\?k=Huawei%20FreeClip%202%20earbuds/.test(w.tries[0].url), "the stores are searched in English, the card keeps his words: " + JSON.stringify([w.what, w.said, w.tries[0].url]));
const a = makeAgent(w, now);
ok(a.said && a.q, "the agent keeps both names");
ok(bestAcross([{ name: "HUAWEI FreeClip 2 Open-Ear", price: 8300, site: "Amazon", href: "https://a" }, { name: "سماعة هواوي فري كليب 2 جديدة", price: 8000, site: "facebook.com", href: "https://f" }], a).length === 2, "listings in English AND Arabic both count");
// follow agents, in several languages
const F = [["keep me updated on solar panels in Egypt every week", "solar panels in Egypt", "week"], ["تابعلي أخبار الطاقة الشمسية كل أسبوع", "الطاقة الشمسية", "week"], ["research electric cars every month", "electric cars", "month"],
  ["Mantenme al día sobre los coches eléctricos cada semana", "los coches eléctricos", "week"], ["Tiens-moi au courant des voitures électriques chaque jour", "voitures électriques", "day"], ["Halte mich über Elektroautos auf dem Laufenden jede Woche", null, "week"],
  ["Держи меня в курсе электромобилей каждую неделю", null, "week"], ["每周帮我关注电动汽车", "电动汽车", "week"], ["電気自動車の最新情報を教えて 毎週", null, "week"], ["전기차 소식 알려줘 매주", null, "week"], ["follow Liverpool news daily", "Liverpool news", "day"]];
for (const [s, topic, every] of F) { const f = followOf(s); ok(f && f.every === every && (topic == null || f.topic === topic), "follow: " + s + " → " + JSON.stringify(f)); }
ok(followOf("follow the recipe") === null && followOf("gather information on the Chery Tiggo 7 Pro") === null, "'follow the recipe' and a one-time research are not follow agents");
const fa = makeAgent(parseAgent("keep me updated on solar panels in Egypt every week", { country: "EG", now }), now);
ok(fa.kind === "follow" && fa.next === nextFollow("week", now) && new Date(fa.next).getDate() === 9 && new Date(fa.next).getHours() === 9, "next report in a week, at 9:00");
ok(/^Deep research: solar panels in Egypt/.test(followQuestion(fa)), "the first round is a full deep research");
const fa2 = followDone(fa, now);
ok(/^Deep research: what's new about solar panels in Egypt since 2026-11-02/.test(followQuestion(fa2)) && fa2.next > now, "the next rounds ask only what's new since the last report");
console.log(bad ? bad + " FAILED" : "PASS v904agents2: Arabic names in English, follow agents in every language");
