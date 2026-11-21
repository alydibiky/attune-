# v10.8: thousands written the way each language writes them — "12,000" in a German / Spanish / … line reads as twelve there.
# dot languages: 12.000 · French: 12 000 (narrow no-break space) · Russian: 12 000 (no-break space). Only Latin digits in the TRANSLATION are
# changed; a number with English decimals ("2,983.250") or inside an English-only example is left alone. python3 tools/i18n/thousands.py
import re, json, sys
DOT = {"de","es","pt","it","tr","id","vi"}; SP = {"fr": " ", "ru": " "}
NUM = re.compile(r'(?<![\d.,])(\d{1,3}(?:,\d{3})+)(?![\d]|[.,]\d)')
total = 0
for l in sorted(DOT | set(SP)):
    p = f"web-src/i18n-{l}.js"; src = open(p, encoding="utf8").read()
    sep = "." if l in DOT else SP[l]
    # each entry is  "english": "translation",  — change only the translation (the value after the colon)
    def fix(m):
        global total
        val = m.group(2)
        new = NUM.sub(lambda n: n.group(1).replace(",", sep), val)
        if new != val: total += 1
        return m.group(1) + new + m.group(3)
    out = re.sub(r'^(\s*"(?:[^"\\]|\\.)*":\s*")((?:[^"\\]|\\.)*)(",?\s*)$', fix, src, flags=re.M)
    open(p, "w", encoding="utf8").write(out)
print(total, "lines changed")
