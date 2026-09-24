/* =========================================================================
   INVOICE DRAFTING — turn what a business owner typed into invoice lines
   ---------------------------------------------------------------------------
   The owner writes the job the way he'd say it on the phone:

     "فاتورة لشركة النور، 3 أيام ونش 50 طن بـ 12000 في اليوم، خصم 5%"
     "invoice Al Nour, 3 days 50t crane at 12000 a day, 5% discount"

   and gets an invoice he can edit line by line.

   THE RULE THAT MAKES THIS SAFE TO SHIP:

     EVERY NUMBER IN THE DRAFT MUST APPEAR VERBATIM IN WHAT HE TYPED.

   A model that turns 12,000 into 12,500 produces an invoice that looks
   right, gets sent to a client, and is wrong by 500 per day — and nobody
   catches it, because invoices are not proofread, they are signed. So the
   model's output is not trusted: it is CHECKED, digit by digit, against the
   source text. A line whose numbers cannot be found is dropped and reported,
   never rounded into place.

   The model is doing the one thing it is good at here and nothing else:
   deciding which words are the item name and which number is quantity versus
   price. It never does arithmetic — totals, tax and discount are computed by
   Yusr, as they always were.
   ========================================================================= */

// Arabic-Indic digits, and the separators that come with them.
const BD_DIGITS = { "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
                    "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9" };
function bdNormalize(s) {
  return String(s || "")
    .replace(/[٠-٩۰-۹]/g, (d) => BD_DIGITS[d])
    .replace(/٫/g, ".").replace(/٬/g, ",")
    .replace(/[‏‎]/g, "")
    .replace(/[  ]/g, " ");
}

// Every number the user actually wrote, as a set of canonical values. "12,000"
// and "12000" are the same number; "12.5" is not 125.
function bdNumbersIn(text) {
  const t = bdNormalize(text);
  const out = new Set();
  const re = /(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    const v = Number(m[0].replace(/,/g, ""));
    if (isFinite(v)) out.add(v);
  }
  return out;
}

// A number is allowed if the user wrote it. The one exception is a quantity
// of 1: "crane hire" with no quantity is one of them, and requiring the user
// to have typed "1" would reject the most ordinary line there is.
function bdAllows(nums, value, opts) {
  if (!isFinite(value)) return false;
  if ((opts && opts.oneIsFree) && value === 1) return true;
  if (nums.has(value)) return true;
  // A price written "12,000.00" and returned as 12000 is the same number.
  for (const n of nums) if (Math.abs(n - value) < 0.005) return true;
  return false;
}

// The prompt. Deliberately narrow: name the parts, do not compute anything.
function bdPrompt(text, opts) {
  const o = opts || {};
  return `You are reading one short job description from a business owner and splitting it into invoice lines.

RULES — these are absolute:
- Use ONLY numbers that appear in the text below. Never invent, round, adjust or convert a number.
- Do not calculate anything. No totals, no multiplication, no tax. Quantity and unit price only, exactly as written.
- If the text does not say a price for a line, use 0 and let the owner fill it in.
- If the text does not say a quantity, use 1.
- Keep the item wording in the language the owner used.
- The client name is the person or company being billed, if the text names one.

Reply with JSON and nothing else, in this exact shape:
{"client":"<name or empty>","items":[{"name":"<item>","qty":<number>,"price":<number>}],"discount":<number>,"taxPct":<number>,"note":"<anything you could not place, or empty>"}

discount and taxPct are 0 unless the text gives them.${o.currency ? `\nThe currency is ${o.currency}; do not write it into the numbers.` : ""}

THE OWNER WROTE:
${text}`;
}

// Parse the model's reply, then check it against the source. Everything that
// survives is something the owner actually typed.
function bdParseDraft(raw, sourceText, opts) {
  const o = opts || {};
  const nums = bdNumbersIn(sourceText);
  const warnings = [];

  let obj = null;
  try {
    // Models like to wrap JSON in prose or a fence. Take the outermost object.
    const s = String(raw || "");
    const a = s.indexOf("{"), b = s.lastIndexOf("}");
    if (a === -1 || b <= a) throw new Error("no JSON in the reply");
    obj = JSON.parse(s.slice(a, b + 1));
  } catch (e) {
    return { ok: false, why: "The model's reply could not be read as an invoice.", items: [], warnings: [] };
  }

  const items = [];
  const raws = Array.isArray(obj.items) ? obj.items : [];
  for (const it of raws) {
    const name = typeof it.name === "string" ? it.name.trim().slice(0, 120) : "";
    if (!name) { warnings.push("A line with no description was dropped."); continue; }
    const qty = Number(it.qty), price = Number(it.price);

    // The check. A quantity or price the owner never wrote is not a typo to
    // be tidied up — it is a number the model made up, and it is dropped.
    const qtyOk = bdAllows(nums, qty, { oneIsFree: true });
    const priceOk = price === 0 || bdAllows(nums, price);
    if (!qtyOk) { warnings.push(`“${name}”: quantity ${it.qty} is not in what you wrote, so the line was left out.`); continue; }
    if (!priceOk) { warnings.push(`“${name}”: price ${it.price} is not in what you wrote, so the line was left out.`); continue; }

    items.push({ name, qty: qty, price: price === 0 ? 0 : price });
  }

  let discount = Number(obj.discount) || 0;
  if (discount && !bdAllows(nums, discount)) { warnings.push(`The discount ${obj.discount} is not in what you wrote, so it was left at 0.`); discount = 0; }
  let taxPct = Number(obj.taxPct) || 0;
  if (taxPct && !bdAllows(nums, taxPct)) { warnings.push(`The tax ${obj.taxPct}% is not in what you wrote, so it was left at 0.`); taxPct = 0; }

  // The client name must also be the owner's words, not the model's guess.
  let client = typeof obj.client === "string" ? obj.client.trim().slice(0, 80) : "";
  if (client) {
    const hay = bdNormalize(sourceText).toLowerCase();
    const needle = bdNormalize(client).toLowerCase();
    if (!hay.includes(needle)) { warnings.push(`The client name “${client}” is not in what you wrote, so it was left blank.`); client = ""; }
  }

  const note = typeof obj.note === "string" ? obj.note.trim().slice(0, 300) : "";

  return {
    ok: items.length > 0,
    why: items.length ? "" : "Nothing in that could be read as an invoice line. Try naming the item, how many, and the price.",
    client, items, discount, taxPct, note, warnings,
    // What the draft was built from, so the owner can see it beside the form.
    source: String(sourceText || "").slice(0, 600),
  };
}

if (typeof module !== "undefined") module.exports = {
  bdPrompt, bdParseDraft, bdNumbersIn, bdAllows, bdNormalize,
};
