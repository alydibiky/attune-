# The Attune keyboard — removed 4 Nov 2026 (v9.1)

English/Arabic keys + Improve / Translate / Reply / Prompt with the loaded model, in every app (v6.32).
Removed by Ali's decision (FEATURES.md row 68): a keyboard that reads every word typed is a privacy and Google Play review risk, with
little gain for a life & work organiser.

## What was done
- `app/src/main/AndroidManifest.xml`: the `.AttuneKeyboard` service is commented out (the block is kept there) — the phone no longer
  lists the keyboard.
- `web-src/attune.jsx`: `KeyboardRow()` returns null (the settings row); `KeyboardRowIn` is kept.
- The code stays: `app/src/main/java/com/aldibiki/attune/AttuneKeyboard.kt`, `res/xml/method.xml`, `@string/kb_name`.

## To bring it back
Uncomment the service in the manifest and set `KeyboardRow()` back to `return PLAY_BUILD ? null : <KeyboardRowIn />;`.
