// v10.2 (Ali, 17 Nov 2026: "there was a sign-in link email from Claude, it was saved in Dates like it was a subscription") — EXACTLY
// 10,000 messages: sign-in links, login codes, "verify your email", password resets (in many languages, from many services, with
// "expires in 15 minutes" or a real date) AND real deadlines that also say "sign in to manage" (renewals, trials, passports,
// warranties, cards). Truth written HERE: a sign-in message gives NO date in Dates, no subscription in the Overpaying check, and
// is read as a login code (nothing to do); a real deadline is still read, with its kind.
//     node tests/signin/gen.mjs [n]      HELDOUT=1 → other services / wordings written after the code (heldout.mjs)
const D = await import("../../web-src/deadlines.js");
const M = await import("../../web-src/notifmind.js");
const O = await import("../../web-src/overpay.js");
const H = process.env.HELDOUT ? (await import("./heldout.mjs")).H : null;
const N = +(process.argv[2] || 10000);
let seed = 4242 + (H ? 31 : 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const NOW = Date.UTC(2026, 10, 17, 10);
const SVC = H ? H.svc : ["Claude", "Claude.ai", "Anthropic", "Notion", "Slack", "Figma", "Canva", "Netflix", "Spotify", "Amazon", "noon", "Talabat", "Instagram", "LinkedIn", "Dropbox", "Zoom", "Uber", "Careem", "Vodafone Cash", "InstaPay", "Fawry", "GitHub", "Medium", "Substack", "Duolingo"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const date = () => { const d = int(18, 28), m = pick([10, 11, 0, 1, 2]), y = m < 10 ? 2027 : 2026; return pick([`${d} ${MON[m]} ${y}`, `${MON[m]} ${d}, ${y}`, `${String(d).padStart(2, "0")}/${String(m + 1).padStart(2, "0")}/${y}`]); };
const mins = () => pick([`${int(5, 60)} minutes`, `${int(1, 24)} hours`, "1 hour", "24 hours", "10 min"]);
const code = () => String(int(100000, 999999));
const SIGNIN = H ? H.signin : [
  (s) => `Secure link to log in to ${s}\nClick the link below to log in to ${s}. This link will expire in ${mins()} and can only be used once.`,
  (s) => `Sign in to ${s}\nUse the secure link below to sign in. The link expires on ${date()}.`,
  (s) => `Your sign-in link for ${s}. This link expires in ${mins()}.`,
  (s) => `${s}: your login code is ${code()}. This code will expire in ${mins()}.`,
  (s) => `Verify your email for ${s}. Click the button to confirm your address — valid until ${date()}.`,
  (s) => `Reset your password — ${s}\nWe received a request to reset your password. This link is valid for ${mins()}.`,
  (s) => `${s} magic link: tap to sign in. Expires ${date()}.`,
  (s) => `Confirm your email address to finish creating your ${s} account. The link expires on ${date()}.`,
  (s) => `Password reset requested for your ${s} account. The link expires in ${mins()}.`,
  (s) => `رابط تسجيل الدخول إلى ${s} — الرابط صالح لمدة ${int(10, 60)} دقيقة`,
  (s) => `كود تسجيل الدخول لـ ${s}: ${code()} — الكود بينتهي بعد ${int(5, 15)} دقايق`,
  (s) => `${s}: enlace de inicio de sesión. El enlace caduca el ${date()}.`,
  (s) => `${s} — lien de connexion. Ce lien expire le ${date()}.`,
  (s) => `${s}: Ihr Anmeldelink. Der Link ist gültig bis ${date()}.`,
  (s) => `${s}: link de acesso. O link expira em ${mins()}.`,
  (s) => `${s}: ссылка для входа. Ссылка истекает через 15 минут.`,
  (s) => `${s} giriş bağlantısı. Bağlantı ${int(10, 30)} dakika geçerli.`,
  (s) => `${s} 登录链接，链接将在 15 分钟后过期。`,
  (s) => `${s} ログインリンク：このリンクの有効期限は ${date()} です。`,
  (s) => `${s} 로그인 링크 — 링크는 15분 후 만료됩니다.`,
  (s) => `${s}: लॉगिन लिंक — यह लिंक 15 मिनट में समाप्त हो जाएगा।`,
  (s) => `${s}: liên kết đăng nhập, hết hạn sau 15 phút.`,
];
// real deadlines (some with "sign in to manage") — they must still be read
const REAL = H ? H.real : [
  [(s) => `Your ${s} membership renews on ${date()}. Sign in to manage your plan.`, "renewal"],
  [(s) => `Your ${s} free trial ends on ${date()}. Log in to cancel anytime.`, "trial"],
  [(s) => `Your ${s} subscription will renew on ${date()} for EGP ${int(50, 500)}.`, "renewal"],
  [() => `Your passport expires on ${date()}. Log in to the portal to book a renewal appointment.`, "expiry"],
  [() => `Visa card ending 4412 expires on ${date()}. Sign in to your bank app to order a new one.`, "expiry"],
  [(s) => `${s} order: return by ${date()}. Sign in to start a return.`, "return"],
  [(s) => `Warranty for your ${s} purchase valid until ${date()}.`, "warranty"],
];
const bad = {}; let pass = 0, made = 0; const seen = new Set(), kinds = { signin: 0, real: 0 };
while (made < N) {
  const s = pick(SVC); let text, want;
  if (rnd() < 0.7) { text = pick(SIGNIN)(s); want = "signin"; } else { const [f, k] = pick(REAL); text = f(s); want = k; }
  if (seen.has(text)) continue; seen.add(text); made++; kinds[want === "signin" ? "signin" : "real"]++;
  const dl = D.readDeadlines(text, { now: NOW });
  const mind = M.comprehend({ app: "Gmail", pkg: "com.google.android.gm", title: s, text }, { now: NOW });
  const op = O.readSource({ id: "e" + made, kind: "email", title: s, text, at: NOW }, { now: NOW });
  let why = "";
  if (want === "signin") {
    if (dl.length) why = "sign-in → Dates (" + dl[0].kind + ")";
    else if (op.length) why = "sign-in → Overpaying (" + op[0].type + ")";
    else if (!mind || mind.cat !== "code" || mind.action !== "none" || mind.due) why = "sign-in not read as a login code (" + (mind && mind.cat) + ")";
  } else if (!dl.some((x) => x.kind === want)) why = "real " + want + " missed";
  if (why) { (bad[why] = bad[why] || []).push(text.slice(0, 120)); } else pass++;
}
const pct = (pass / N * 100).toFixed(2);
console.log(`${H ? "held-out" : "generated"}: ${N} (${kinds.signin} sign-in, ${kinds.real} real) — right: ${pass} (${pct}%)`);
for (const [k, v] of Object.entries(bad)) console.log(" ", v.length, k, "e.g.", JSON.stringify(v[0]));
if (process.env.REPORT) (await import("fs")).writeFileSync(new URL(H ? "./report-heldout.md" : "./report.md", import.meta.url), `# Sign-in messages — ${H ? "held-out" : "10,000"}\n\n${N} cases (${kinds.signin} sign-in, ${kinds.real} real deadlines): **${pct}%** right.\n\n` + Object.entries(bad).map(([k, v]) => `- ${v.length} × ${k} — e.g. ${JSON.stringify(v[0])}`).join("\n") + "\n");
export const result = { pass, N, pct: +pct };
