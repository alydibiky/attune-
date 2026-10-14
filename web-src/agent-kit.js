/* ---- v6.27 "Do it for me", level 2: the kit that runs INSIDE a booking / shop / delivery website, in the app's own browser ----
   (AgentBrowser.kt on Android injects it after every page load; tests: tests/e2e_v727agentkit.py on fake pages.)
   It can only do three things, each one checked:
     offers()   read the offers on a results page (price, stops, time) from what is visible;
     best(r)    mark the best one by the person's rules (cheapest / direct / morning…) and scroll to it — the PERSON taps it;
     fill(p)    fill the person's details (name, email, phone, birth date, passport…) into fields that clearly ask for them
                (autocomplete attributes first, then labels in many languages) — only empty fields, each one outlined to check;
   and it NEVER touches payment: card number / CVV / IBAN / passwords / one-time codes are refused, and when a payment form
   appears it says so ("Payment — your turn"). No network calls, no data leaves the page except the counts it reports.  */
(function () {
  if (window.__attuneAgent) return;
  const report = (o) => { try { window.AttuneAgentHost && window.AttuneAgentHost.report(JSON.stringify(o)); } catch (e) {} try { window.__attuneAgentLast = o; } catch (e) {} };
  const visible = (el) => { if (!el || !el.getBoundingClientRect) return false; const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && +s.opacity !== 0; };

  // ---- prices ------------------------------------------------------------------------------------------------------------
  const CUR = "(?:[$€£¥₹₺₽₩₦₱฿₫৳₪]|R\\$|US\\$|C\\$|A\\$|[A-Z]{3}|EGP|جنيه|ج\\.م|ريال|درهم|دينار|Rp|RM|Rs\\.?|kr|zł|Kč)";
  const NUM = "(\\d{1,3}(?:[,. '  ]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)";
  const PRICE = new RegExp("(" + CUR + ")\\s?" + NUM + "|" + NUM + "\\s?(" + CUR + ")", "u");
  const num = (raw) => {
    const s = String(raw).replace(/[ '  ]/g, ""); const last = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
    if (last < 0) return +s; const tail = s.length - last - 1;
    return tail <= 2 ? +(s.slice(0, last).replace(/[.,]/g, "") + "." + s.slice(last + 1)) : +s.replace(/[.,]/g, "");
  };
  const priceIn = (text) => { const m = PRICE.exec(text); if (!m) return null; const v = num(m[2] || m[3]); return v > 0 && v < 1e8 ? { price: v, currency: (m[1] || m[4] || "").trim() } : null; };

  // ---- offers: the smallest block that holds one price, and a time or a name ----------------------------------------------------
  function offers() {
    const found = [], seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const t = n.nodeValue; if (!t || t.length > 80 || !PRICE.test(t)) continue;
      const leaf = n.parentElement; if (!leaf || !visible(leaf)) continue;
      if (/total|subtotal|tax|fee|was|from$|old|strike|crossed|ancien|antes|vorher|prima/i.test(leaf.className + " " + (leaf.getAttribute("aria-label") || "")) || leaf.closest("s,del,strike")) continue;
      // climb to the card: the first ancestor that has other text (times, names) but only ONE price
      let card = leaf;
      for (let i = 0; i < 8 && card.parentElement && card.parentElement !== document.body; i++) {
        const up = card.parentElement, txt = up.innerText || "";
        if (txt.length > 900 || (txt.match(new RegExp(PRICE.source, "gu")) || []).length > 2) break;
        card = up;
      }
      if (seen.has(card)) continue; seen.add(card);
      const text = (card.innerText || "").replace(/\s+/g, " ").trim().slice(0, 300);
      const p = priceIn(t); if (!p) continue;
      const time = /(?:^|\D)([01]?\d|2[0-3]):([0-5]\d)(?:\s?([ap])\.?m\.?)?/i.exec(text);
      let hour = time ? +time[1] : null; if (time && time[3] && /p/i.test(time[3]) && hour < 12) hour += 12;
      const stops = /non-?stop|direct|sans escale|directo|direto|direkt|diretto|aktarmasız|langsung|مباشر/i.test(text) ? 0 : (/(\d)\s*(?:stops?|escales?|escalas?|stopps?|scali|aktarma|transit|توقف)/i.exec(text) || [])[1] ? +(/(\d)\s*(?:stops?|escales?|escalas?|stopps?|scali|aktarma|transit|توقف)/i.exec(text)[1]) : null;
      found.push({ el: card, price: p.price, currency: p.currency, hour, stops, text });
      if (found.length >= 80) break;
    }
    return found;
  }
  function rank(list, r) {
    r = r || {};
    const score = (o) => o.price * (r.direct && o.stops > 0 ? 1.6 : 1) * (r.time === "morning" && o.hour != null && (o.hour < 5 || o.hour > 12) ? 1.25 : 1) * (r.time === "evening" && o.hour != null && o.hour < 16 ? 1.25 : 1);
    return list.slice().sort((a, b) => score(a) - score(b));
  }
  let mark = null;
  function best(r) {
    const list = offers();
    if (!list.length) { report({ kind: "best", offers: 0 }); return { offers: 0 }; }
    const top = rank(list, r)[0];
    if (mark) { mark.style.outline = mark.__o || ""; }
    mark = top.el; mark.__o = mark.style.outline; mark.style.outline = "3px solid #0F7B6C"; mark.style.outlineOffset = "2px";
    try { mark.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {}
    const out = { kind: "best", offers: list.length, price: top.price, currency: top.currency, text: top.text.slice(0, 140), why: [r.cheapest !== false ? "cheapest" : "", r.direct ? "direct" : "", r.time || ""].filter(Boolean).join(", ") };
    report(out); return out;
  }

  // ---- forms: what a field asks for ---------------------------------------------------------------------------------------------
  // NEVER filled: payment, passwords, codes. Checked first, on every attribute and the label.
  const FORBID = /cc-|card|cvv|cvc|csc|security.?code|expir.*(card|cc)|iban|swift|bic|account.?num|routing|sort.?code|password|passwd|pwd|\bpin\b|otp|one.?time|verification|captcha|كلمة.?(السر|المرور)|رقم.?البطاقة|بطاقة|tarjeta|carte.?banc|numéro.?de.?carte|kartennummer|cartão|kart.?num|kartu/i;
  const KEYS = [
    ["email", /e-?mail|courriel|correo|البريد|ايميل|إيميل|eposta|e-posta|surel/i, "email"],
    ["first", /first.?name|given.?name|fname|forename|prénom|prenom|nombre(?!.*apellido)|vorname|nome(?!.*cognome)|\bad[ıi]\b|nama depan|الاسم الأول|الاسم الاول/i, "given-name"],
    ["last", /last.?name|family.?name|surname|lname|nom de famille|\bnom\b|apellidos?|nachname|cognome|soyad|nama belakang|اسم العائلة|اللقب/i, "family-name"],
    // a PERSON's whole name only: "Full name", "Guest name", or a field named just "name" — never "Hotel name", "Company name"
    ["full", /full.?name|your.?name|guest.?name|passenger.?name|travell?er.?name|contact.?name|customer.?name|lead.?name|nom complet|nombre completo|nome completo|vollständiger name|ad soyad|nama lengkap|الاسم الكامل/i, "name"],
    ["phone", /phone|mobile|cell|\btel\b|téléphone|teléfono|telefone|telefon|cellulare|هاتف|موبايل|جوال|رقم التليفون|ponsel/i, "tel"],
    ["birth", /birth|dob|date.?of.?birth|naissance|nacimiento|nascimento|geburt|nascita|doğum|lahir|الميلاد/i, "bday"],
    ["passport", /passport.?(no|num)|passport$|n(°|o)?.?passeport|pasaporte|passaporte|reisepass|pasaport|paspor|جواز/i, ""],
    ["passportExpiry", /passport.?(expir|valid)|expiration.?passeport|vencimiento.?pasaporte|ablauf.?pass|انتهاء.?الجواز/i, ""],
    ["nationality", /nationality|citizenship|nationalité|nacionalidad|nacionalidade|staatsangehörigkeit|nazionalità|uyruk|kewarganegaraan|الجنسية/i, ""],
    ["country", /country|pays|país|pais|\bland\b|paese|ülke|negara|الدولة|البلد/i, "country-name"],
    ["city", /city|town|ville|ciudad|cidade|stadt|città|şehir|kota|المدينة/i, "address-level2"],
    ["postcode", /post.?code|zip|postal|code postal|código postal|\bcep\b|plz|\bcap\b|posta kodu|kode pos|الرمز البريدي/i, "postal-code"],
    ["address", /address|street|adresse|dirección|endereço|straße|strasse|indirizzo|adres|alamat|العنوان/i, "address-line1"],
  ];
  const AC = { "given-name": "first", "family-name": "last", name: "full", email: "email", tel: "phone", "tel-national": "phone", bday: "birth", "country-name": "country", country: "country", "address-level2": "city", "postal-code": "postcode", "address-line1": "address", "street-address": "address" };
  const labelOf = (el) => {
    let t = [el.name, el.id, el.placeholder, el.getAttribute("aria-label"), el.getAttribute("data-testid")].filter(Boolean).join(" ");
    if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l) t += " " + l.innerText; }
    const wrap = el.closest("label"); if (wrap) t += " " + wrap.innerText;
    return t.slice(0, 200);
  };
  function keyOf(el) {
    const ac = (el.getAttribute("autocomplete") || "").toLowerCase().split(/\s+/).pop();
    const lab = labelOf(el);
    if (/^cc-/.test(ac) || FORBID.test(lab) || el.type === "password") return { key: "", forbid: true };
    if (AC[ac]) return { key: AC[ac] };
    if (el.type === "email") return { key: "email" };
    if (el.type === "tel") return { key: "phone" };
    // "Hotel name", "Company name", "Street name", "User name"… are not the person
    if (/(hotel|company|business|organi[sz]ation|firm|street|user|account|pet|bank|ship|vessel|property|event|group|team|file|product|store|shop|restaurant|card|holder|beneficiary|recipient)[\s_-]*name|nom (de l'hôtel|de la société|d'utilisateur)|nombre de (la empresa|usuario)|firmenname|benutzername|اسم (الفندق|الشركة|المستخدم)/i.test(lab)) return { key: "" };
    for (const [k, re] of KEYS) if (re.test(lab)) return { key: k };
    if ([el.name, el.id, el.placeholder, el.getAttribute("aria-label")].some((x) => /^\s*(full[\s_-]?name|name|fullname)\s*\*?\s*$/i.test(x || ""))) return { key: "full" };
    return { key: "" };
  }
  const setVal = (el, v) => {
    const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set; setter.call(el, v);
    for (const ev of ["input", "change", "blur"]) el.dispatchEvent(new Event(ev, { bubbles: true }));
  };
  const valueFor = (key, el, p) => {
    if (key === "full") return [p.first, p.last].filter(Boolean).join(" ");
    let v = p[key] || "";
    if (key === "birth" || key === "passportExpiry") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
      if (el.type === "date") return v;
      const [y, m, d] = v.split("-"); return /mm\W*dd/i.test(el.placeholder || "") ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
    }
    return v;
  };
  function fill(p) {
    p = p || {}; let filled = 0, refused = 0, skipped = 0;
    for (const el of document.querySelectorAll("input, select, textarea")) {
      if (!visible(el) || el.disabled || el.readOnly || /^(hidden|submit|button|checkbox|radio|file|image|reset|range|color)$/.test(el.type)) continue;
      const k = keyOf(el);
      if (k.forbid) { refused++; continue; }
      if (!k.key) continue;
      if (el.value && el.tagName !== "SELECT") { skipped++; continue; }   // never overwrite what is there
      const v = valueFor(k.key, el, p); if (!v) continue;
      if (el.tagName === "SELECT") {
        const want = String(v).toLowerCase();
        const opt = [...el.options].find((o) => o.value.toLowerCase() === want || o.text.trim().toLowerCase() === want);
        if (!opt || el.value === opt.value) continue;
        setVal(el, opt.value);
      } else setVal(el, v);
      el.style.outline = "2px solid #0F7B6C"; el.style.outlineOffset = "1px"; filled++;
    }
    const out = { kind: "fill", filled, refused, skipped, payment: payment() };
    report(out); return out;
  }
  // ---- payment: the person's turn ----
  function payment() {
    const f = [...document.querySelectorAll("input")].some((el) => visible(el) && (/^cc-/.test((el.getAttribute("autocomplete") || "").toLowerCase()) || /card.?num|cardnumber|cvv|cvc|security.?code/i.test(labelOf(el))));
    const fr = [...document.querySelectorAll("iframe")].some((x) => /stripe|adyen|braintree|checkout\.com|paypal|payfort|paymob|fawry|razorpay|mercadopago|klarna|worldpay|cybersource/i.test(x.src || "") && visible(x));
    return f || fr;
  }
  let lastPay = null, t = null;
  const watch = () => { clearTimeout(t); t = setTimeout(() => { const pay = payment(); if (pay !== lastPay) { lastPay = pay; report({ kind: "page", payment: pay, offers: offers().length }); } }, 500); };
  try { new MutationObserver(watch).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  window.__attuneAgent = { offers: () => offers().map((o) => ({ price: o.price, currency: o.currency, hour: o.hour, stops: o.stops, text: o.text })), best, fill, payment, rank };
  watch();
})();
