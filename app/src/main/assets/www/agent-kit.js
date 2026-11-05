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
  const CUR = "(?:[$€£¥₹₺₽₩₦₱฿₫৳₪]|R\\$|US\\$|C\\$|A\\$|(?:USD|EUR|GBP|EGP|SAR|AED|KWD|QAR|BHD|OMR|JOD|TRY|INR|PKR|IDR|MYR|PHP|THB|VND|NGN|KES|ZAR|MAD|DZD|TND|JPY|CNY|KRW|RUB|BRL|MXN|CAD|AUD|CHF|SEK|NOK|DKK|PLN|CZK|HUF|ILS|LBP|IQD)(?![A-Za-z])|جنيه|ج\\.م|ريال|درهم|دينار|Rp|RM|Rs\\.?|kr|zł|Kč)";
  const NUM = "(\\d{1,3}(?:[,. '  ]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)";
  const PRICE = new RegExp("(" + CUR + ")\\s?" + NUM + "|" + NUM + "\\s?(" + CUR + ")", "u");
  const num = (raw) => {
    const s = String(raw).replace(/[ '  ]/g, ""); const last = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
    if (last < 0) return +s; const tail = s.length - last - 1;
    return tail <= 2 ? +(s.slice(0, last).replace(/[.,]/g, "") + "." + s.slice(last + 1)) : +s.replace(/[.,]/g, "");
  };
  const priceIn = (text) => { const m = PRICE.exec(text); if (!m) return null; const v = num(m[2] || m[3]); return v > 0 && v < 1e8 ? { price: v, currency: (m[1] || m[4] || "").trim() } : null; };

  const TAXLINE = /tax|fee|charge|original price|was\b|save\b|off\b|discount|deposit|ضريب|رسوم|خصم|وفر|السعر الأصلي|impuesto|cargo|taxe|frais|steuer|gebühr|vergi|ücret|pajak|biaya/i;
  // the closest result card around a price, on any site: known sites' own markers, schema.org items, then the common class names
  // for a product / listing / result card (closest() picks the nearest one, so a whole list is never taken for one offer)
  const CARD_SEL = ['[data-testid="property-card"]', '[data-testid="property-card-container"]', '[data-component-type="s-search-result"]', '[data-testid="card-container"]', '[data-hotelid]', '.sr_item', '[data-testid="property-card-content"]',
    '[data-qa="product-block"]', '[itemprop="itemListElement"]', '[itemtype*="Product"]', '[itemtype*="Hotel"]', '[itemtype*="Offer"]', '[itemtype*="Place"]',
    '[data-testid*="product-card" i]', '[data-testid*="listing-card" i]', '[data-testid*="result-card" i]', '[class*="product-card" i]', '[class*="productcard" i]',
    '[class*="listing-card" i]', '[class*="result-card" i]', '[class*="hotel-card" i]', '[class*="offer-card" i]', '[class*="item-card" i]', 'article', '[role="listitem"]'].join(",");
  // a card's name: its own title first (Booking data-testid=title, schema.org name, a heading), else its longest line without a price
  const NAME_SEL = '[data-testid="title"],[itemprop="name"],[data-testid="listing-card-title"],[data-testid*="title" i],h2,h3,h4,[class*="title" i],[class*="name" i]';
  // ---- offers: the smallest block that holds one price, and a time or a name ----------------------------------------------------
  function offers() {
    const found = [], seen = new Set(), leaves = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    // pass 1: the text that is a real price (not a total / tax / old / crossed-out one)
    while ((n = walker.nextNode())) {
      const t = n.nodeValue; if (!t || t.length > 80 || !PRICE.test(t)) continue;
      const leaf = n.parentElement; if (!leaf || !visible(leaf)) continue;
      if (/total|subtotal|tax|fee|was|from$|old|strike|crossed|ancien|antes|vorher|prima/i.test(leaf.className + " " + (leaf.getAttribute("aria-label") || "")) || leaf.closest("s,del,strike")) continue;
      // v9.1 (Ali, 3 Nov: the hotel check didn't find the lowest price): "+EGP 1,234 taxes and charges", "Original price", "Save
      // EGP 500" and a crossed-out price (drawn with CSS, not <s>) are not an offer — they read as the cheapest one
      if (TAXLINE.test(t)) continue;
      try { if (/line-through/.test(getComputedStyle(leaf).textDecorationLine || getComputedStyle(leaf).textDecoration || "")) continue; } catch (e) {}
      leaves.push([leaf, t]);
      if (leaves.length >= 200) break;
    }
    const isLeaf = new Set(leaves.map((x) => x[0]));
    for (const [leaf, t] of leaves) {
      // climb to the card: the first ancestor that has other text (times, names) but only ONE real price (v9.1: tax lines and old
      // prices no longer count — a Booking card has three prices and stayed a bare number with no hotel name)
      let card = leaf;
      for (let i = 0; i < 8 && card.parentElement && card.parentElement !== document.body; i++) {
        const up = card.parentElement, txt = up.innerText || "";
        if (txt.length > 900) break;
        let k = 0; for (const el of up.querySelectorAll("*")) if (isLeaf.has(el) && ++k > 1) break;
        if (k > 1) break;
        card = up;
      }
      // v9.1 (Ali's 4 Nov screenshots: every hotel was named "Booking.com", no photo, "+0"): a site's own result card wins — Booking's
      // property card, Amazon's search result, Airbnb / schema.org list items, an <article> — so the name, photo, score and distance
      // come with the price (a Booking card has 3+ prices, so the climb above stopped at the bare price)
      const own = leaf.closest(CARD_SEL);
      if (own && own !== document.body && (own.innerText || "").length < 3000) card = own;
      // v9.4 (Ali, 5 Nov: "Offer 3", no photo, Book opened the search — "does not open on the specific listing"): a layout we don't
      // know (Booking's phone site, any shop) — climb until the block holds ONE listing's own link (its hotel / product page), so
      // the name, the photo and the exact page come with the price; stop before a block that holds two listings
      if (!listingLink(card)) { let c = card;
        for (let i = 0; i < 10 && c.parentElement && c.parentElement !== document.body; i++) {
          const up = c.parentElement; if ((up.innerText || "").length > 3000 || listingKeys(up) > 1) break;
          c = up; if (listingLink(c)) { card = c; break; } } }
      if (seen.has(card)) continue; seen.add(card);
      const text = (card.innerText || "").replace(/\s+/g, " ").trim().slice(0, 600);
      const p = priceIn(t); if (!p) continue;
      const time = /(?:^|\D)([01]?\d|2[0-3]):([0-5]\d)(?:\s?([ap])\.?m\.?)?/i.exec(text);
      let hour = time ? +time[1] : null; if (time && time[3] && /p/i.test(time[3]) && hour < 12) hour += 12;
      const stops = /non-?stop|direct|sans escale|directo|direto|direkt|diretto|aktarmasız|langsung|مباشر/i.test(text) ? 0 : (/(\d)\s*(?:stops?|escales?|escalas?|stopps?|scali|aktarma|transit|توقف)/i.exec(text) || [])[1] ? +(/(\d)\s*(?:stops?|escales?|escalas?|stopps?|scali|aktarma|transit|توقف)/i.exec(text)[1]) : null;
      found.push({ el: card, price: p.price, currency: p.currency, hour, stops, text });
      if (found.length >= 80) break;
    }
    return found;
  }
  // a listing's own page (not a search, a filter or a map link): hotels on Booking / Agoda / Expedia / Airbnb / Hotels.com, products on
  // Amazon / noon / Jumia / eBay / most shops
  const LISTING = /\/hotel\/[a-z]{2}\/|\/hotels?\/[^?]*\d|\/rooms\/\d|\.h\d+\.hotel|hotel-information|\/ho\d+|\/property\/|\/dp\/[a-z0-9]{6,}|\/itm\/|\/p\/?(?:$|[?#])|\/p\/[a-z0-9-]+|-p-\d|\/product\/|\/products\/|\/ip\/|\/item\//i;
  const listingLinks = (el) => [...(el.querySelectorAll ? el.querySelectorAll("a[href]") : [])].filter((a) => /^https:\/\//.test(a.href) && LISTING.test(a.href.split("#")[0]));
  const listingKey = (a) => { try { const u = new URL(a.href); return u.hostname + u.pathname; } catch (e) { return a.href; } };
  const listingKeys = (el) => new Set(listingLinks(el).map(listingKey)).size;
  function listingLink(el) { const t = el.querySelector && el.querySelector('a[data-testid="title-link"][href],a[data-testid="property-card-desktop-single-image"][href]');
    if (t && /^https:\/\//.test(t.href)) return t; const l = listingLinks(el); if (l.length) return l[0];
    const up = el.closest && el.closest("a[href]"); return up && /^https:\/\//.test(up.href) && LISTING.test(up.href) ? up : null; }
  // a photo, also a lazy one (data-src, srcset) or a background picture — never a 1-pixel placeholder or an icon
  function photoOf(el) {
    for (const im of el.querySelectorAll ? el.querySelectorAll("img,source") : []) {
      const set = (im.getAttribute("srcset") || im.getAttribute("data-srcset") || "").split(",").map((x) => x.trim().split(/\s+/)[0]).filter(Boolean);
      for (const u of [im.currentSrc, im.getAttribute("src"), im.getAttribute("data-src"), im.getAttribute("data-lazy-src"), im.getAttribute("data-lazy"), ...set]) {
        if (!u) continue; let abs = u; try { abs = new URL(u, location.href).href; } catch (e) {}
        if (!/^https:\/\//.test(abs) || /\.svg(\?|$)|sprite|icon|logo|pixel|blank|spacer/i.test(abs)) continue;
        if (im.tagName === "IMG" && im.naturalWidth && im.naturalWidth < 40 && !im.getAttribute("data-src")) continue;
        return abs; } }
    for (const d of el.querySelectorAll ? el.querySelectorAll("[style*='background']") : []) { const m = /url\(["']?(https:[^"')]+)/.exec(d.getAttribute("style") || ""); if (m) return m[1]; }
    return "";
  }
  // v9.6 (Ali's screenshot: every hotel was called "Price"): a site's own labels are never a name
  const GENERIC = /^(price|prices|total|total price|per night|a night|book|book now|reserve|select|choose|view deal|see availability|show prices|deal|deals|cheapest|best value|sponsored|ad|new|genius|free cancellation|السعر|احجز|احجز الآن|الإجمالي)$/i;
  const okName = (x) => x && !PRICE.test(x) && x.length > 2 && !GENERIC.test(x.replace(/[:·•\s]+$/, "").trim());
  function cardName(o) {
    // the listing link that carries words (the photo's link has none): its title, else its own text / label
    let ln = ""; for (const L of [listingLink(o.el), ...listingLinks(o.el)]) { if (!L) continue; const lt = (L.querySelector && L.querySelector(NAME_SEL)) || L;
      ln = (lt.innerText || lt.textContent || L.getAttribute("aria-label") || L.getAttribute("title") || "").replace(/\s+/g, " ").trim(); if (okName(ln)) break; ln = ""; }
    // every element that may hold the name, in order — the first that is a real name (not "Price", not an amount)
    let own = ""; for (const t of (o.el.querySelectorAll ? [...o.el.querySelectorAll(NAME_SEL)] : [])) { const x = (t.innerText || t.textContent || "").replace(/\s+/g, " ").trim(); if (okName(x) && x.length < 160) { own = x; break; } }
    if (own) return own.slice(0, 160);
    if (okName(ln) && ln.length < 160) return ln;
    return String((o.el.innerText || "").split("\n").map((x) => x.trim()).filter((x) => okName(x) && x.length > 3).sort((a, b) => b.length - a.length)[0] || "").slice(0, 160);
  }
  function rank(list, r) {
    r = r || {};
    const score = (o) => o.price * (r.direct && o.stops > 0 ? 1.6 : 1) * (r.time === "morning" && o.hour != null && (o.hour < 5 || o.hour > 12) ? 1.25 : 1) * (r.time === "evening" && o.hour != null && o.hour < 16 ? 1.25 : 1);
    return list.slice().sort((a, b) => score(a) - score(b));
  }
  let mark = null;
  function best(r, quiet) {
    const list = offers();
    if (!list.length) { report({ kind: "best", offers: 0 }); return { offers: 0 }; }
    const top = rank(list, r)[0];
    // v9.1: a quiet read (the hotel check reads a page several times while it loads) doesn't move the page under the person
    if (quiet) { const nameQ = cardName;
      const hrefQ = (o) => { const a = listingLink(o.el) || o.el.closest("a[href]") || o.el.querySelector("a[href]"); return a && /^https:\/\//.test(a.href) ? a.href : ""; };
      const imgQ = (o) => photoOf(o.el);
      const outQ = { kind: "best", quiet: true, offers: list.length, price: top.price, currency: top.currency, text: top.text.slice(0, 140), top: rank(list, r).slice(0, r && r.many ? 24 : 3).map((o) => ({ price: o.price, currency: o.currency, name: nameQ(o), text: o.text.slice(0, 400), href: hrefQ(o), img: imgQ(o) })) };
      report(outQ); return outQ; }
    if (mark) { mark.style.outline = mark.__o || ""; }
    mark = top.el; mark.__o = mark.style.outline; mark.style.outline = "3px solid #0F7B6C"; mark.style.outlineOffset = "2px";
    try { mark.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {}
    // v8.2 (Ali picked 2A: "it plans, then shows the best 3"): the three best offers by the same rules, each with its name (the card's
    // first line) and its text, so an agent can list them
    // v8.6: each with its own link (the product page a buy agent opens after the person says "Order it"); a buy round asks for
    // more than 3 (r.many) so the closest match — not only the cheapest — can be picked
    const nameOf = cardName;
    const imgOf = (o) => photoOf(o.el);
    const hrefOf = (o) => { const a = listingLink(o.el) || o.el.closest("a[href]") || o.el.querySelector("a[href]"); return a && /^https:\/\//.test(a.href) ? a.href : ""; };
    const top3 = rank(list, r).slice(0, r && r.many ? 24 : 3).map((o) => ({ price: o.price, currency: o.currency, name: nameOf(o), text: o.text.slice(0, 400), href: hrefOf(o), img: imgOf(o) }));
    const out = { kind: "best", offers: list.length, price: top.price, currency: top.currency, text: top.text.slice(0, 140), top: top3, why: [r.cheapest !== false ? "cheapest" : "", r.direct ? "direct" : "", r.time || ""].filter(Boolean).join(", ") };
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
  // ---- v8.6 buy: on a product page the person said "Order it" to — press Buy now (else Add to cart) ONCE. Never "Place order" / Pay.
  const BUY_NOW = /^\s*(buy now|buy it now|اشتري الآن|اشتر الآن|اشتري دلوقتي|شراء الآن|comprar ahora|acheter maintenant|jetzt kaufen|hemen al|beli sekarang)\s*$/i;
  const ADD_CART = /^\s*(add to (cart|basket|bag)|أضف إلى (العربة|عربة التسوق|السلة)|اضف الى (العربة|عربة التسوق|السلة)|أضف للسلة|اضف للعربة|añadir al carrito|ajouter au panier|in den warenkorb|sepete ekle|tambah ke keranjang)\s*$/i;
  const NEVER = /place (your )?order|pay|confirm (order|purchase)|complete (order|purchase)|submit order|تأكيد الطلب|ادفع|إتمام الشراء|اتمام الشراء/i;
  let bought = false;
  function buy() {
    if (bought) return { kind: "buy", clicked: "" };
    const els = [...document.querySelectorAll("button, input[type=submit], input[type=button], a[role=button], [role=button]")].filter(visible);
    const label = (el) => String(el.innerText || el.value || el.getAttribute("aria-label") || el.title || "").replace(/\s+/g, " ").trim().slice(0, 60);
    const pick = els.find((el) => BUY_NOW.test(label(el)) && !NEVER.test(label(el))) || els.find((el) => ADD_CART.test(label(el)) && !NEVER.test(label(el)));
    if (!pick) { const out = { kind: "buy", clicked: "" }; report(out); return out; }
    bought = true; const l = label(pick);
    pick.style.outline = "3px solid #0F7B6C"; try { pick.scrollIntoView({ block: "center" }); } catch (e) {}
    setTimeout(() => { try { pick.click(); } catch (e) {} }, 400);
    const out = { kind: "buy", clicked: l, cart: ADD_CART.test(l) }; report(out); return out;
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
  // v9.4 G2: an appointment page (visa, consulate, clinic) — its visible words go back to Attune, which decides what they mean
  const slot = () => { const t = String((document.body && document.body.innerText) || "").replace(/\s+/g, " ").trim().slice(0, 6000); const out = { kind: "slot", text: t, url: location.href }; report(out); return out; };
  window.__attuneAgent = { offers: () => offers().map((o) => ({ price: o.price, currency: o.currency, hour: o.hour, stops: o.stops, text: o.text })), best, fill, payment, rank, buy, slot };
  watch();
})();
