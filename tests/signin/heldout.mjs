// Held-out for tests/signin/gen.mjs — services and wordings written AFTER the fix, never tuned on.
const int = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const d = () => `${int(18, 28)} December 2026`;
export const H = {
  svc: ["ChatGPT", "Perplexity", "Airbnb", "Booking.com", "Shahid", "Watch It", "Jumia", "Swvl", "Microsoft", "Pinterest", "Trello", "Coursera", "Udemy", "Binance", "Paymob"],
  signin: [
    (s) => `Here's your one-time sign in link for ${s}. For your security it only works once and expires in 20 minutes.`,
    (s) => `Log in to ${s} with this link: https://${s.toLowerCase().replace(/\W/g, "")}.com/auth/abc — the link is valid for 1 hour.`,
    (s) => `${s} verification: please verify your email address. This link expires on ${d()}.`,
    (s) => `Forgot your password? Reset it here for ${s}. The reset link expires in 30 minutes.`,
    (s) => `${s} — use code ${int(1000, 9999)} to log in. It expires in 10 minutes.`,
    (s) => `سجل دخولك على ${s} من الرابط ده — الرابط صالح لمرة واحدة بس`,
    (s) => `${s}: Tu código de inicio de sesión es ${int(100000, 999999)}. Vence en 10 minutos.`,
    (s) => `${s} : vérifiez votre adresse e-mail. Le lien est valable jusqu'au ${d()}.`,
    (s) => `${s}: Bestätigen Sie Ihre E-Mail. Der Link läuft am ${d()} ab.`,
    (s) => `${s} 验证码 ${int(100000, 999999)}，10分钟内有效。`,
  ],
  real: [
    [(s) => `Reminder: your ${s} plan renews on ${d()}. Manage it any time after you sign in.`, "renewal"],
    [(s) => `Your ${s} trial ends on ${d()} — log in to keep your projects.`, "trial"],
    [() => `Your driving licence expires on ${d()}. Sign in to the traffic portal to renew.`, "expiry"],
  ],
};
