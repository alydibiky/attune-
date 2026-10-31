# python3 tools/i18n/make_gemini.py — one paste-ready text file per 3 missing chunks: tools/i18n/for-gemini/<lang>-<n>.txt
import json, os, glob, re
B = os.path.dirname(os.path.abspath(__file__)); O = os.path.join(B, "for-gemini"); os.makedirs(O, exist_ok=True)
for f in glob.glob(O + "/*.txt"): os.remove(f)
BUSY = {"arb": 3, "fa": 3, "th": 3, "sw": 3, "bn": 3}  # chunks Claude helpers are doing now (the lowest missing ones)
NAMES = {"arb": "Modern Standard Arabic (الفصحى) — NOT Egyptian: the `ar` hints are Egyptian, never copy dialect words like عايز، دلوقتي، بتاع، اللي، مش، إزاي", "es": "Spanish", "fr": "French", "pt": "Brazilian Portuguese", "hi": "Hindi", "id": "Indonesian", "tr": "Turkish", "de": "German", "ru": "Russian", "ur": "Urdu", "it": "Italian", "zh": "Simplified Chinese", "ja": "Japanese", "ko": "Korean", "fa": "Persian", "bn": "Bengali", "vi": "Vietnamese", "th": "Thai", "sw": "Kiswahili"}
brief = open(B + "/BRIEF.md").read().split("## Input / output")[0] + "## Rules" + open(B + "/BRIEF.md").read().split("## Rules")[1].split("## When done")[0]
brief = brief.replace("Folder: `/tmp/claude-0/-home-user-attune-/d16c3146-acf8-5fe9-b8a7-0bc728a06906/scratchpad/i18n/` (call it I18N below).\n", "")
total = 0
for lang in NAMES:
    miss = sorted(f for f in os.listdir(f"{B}/todo/{lang}") if re.match(r"^\d+\.json$", f) and not os.path.exists(f"{B}/out/{lang}/{f}"))[BUSY.get(lang, 0):]
    gl = open(f"{B}/glossary-{lang}-full.json").read()
    for i in range(0, len(miss), 3):
        lines = sum((json.load(open(f"{B}/todo/{lang}/{f}")) for f in miss[i:i + 3]), [])
        name = f"{lang}-{i // 3 + 1:02d}"
        txt = (f"You are translating the interface of Attune, a phone app, into {NAMES[lang]} (language code {lang}).\n\n{brief}\n"
               f"## Glossary — use these {NAMES[lang].split(' (')[0]} words for the app's feature names, always:\n{gl}\n\n"
               f"## Your answer\nReply with ONE JSON object only, inside a ```json code block, nothing else: every \"en\" below as a key, copied "
               f"byte-for-byte (same spaces, quotes, dashes, emoji, {{placeholders}}), mapped to its translation. {len(lines)} keys — do not skip any, do not stop early. "
               f"If you cannot fit all in one reply, stop at a complete line, close the JSON, and say CONTINUE; I will ask for the rest.\n\n## Lines ({name})\n"
               + json.dumps(lines, ensure_ascii=False, indent=0))
        open(f"{O}/{name}.txt", "w").write(txt); total += 1
print(total, "files")
