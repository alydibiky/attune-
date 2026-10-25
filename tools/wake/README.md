# «يا أتيون» — how the wake model is made (voice phase 3)

The phone runs three small ONNX models every 80 ms (`app/src/main/assets/wake/`, used by `WakeWord.kt`):

| file | what | licence |
|---|---|---|
| `melspectrogram.onnx` | sound → 32 mel bands | Apache-2.0 (openWakeWord's front end, from `littlebearlabs/openwakeword-features` on Hugging Face) |
| `embedding_model.onnx` | 76 mel frames → 96 numbers (Google's speech_embedding) | Apache-2.0 (same) |
| `attune_wake.onnx` | the last 16 embeddings (≈2 s) → "«يا أتيون» just ended" 0..1 | Attune's own (trained here) |
| `config.json` | threshold + patience picked from the evaluation | — |

openWakeWord's own pretrained wake words are CC BY-NC-SA, so none of them is used: only the two feature models.

## Data (all commercial-safe for training)
- **Positives**: Piper voices fed the phonemes of how people say it — `jˈaː ʔatjˈuːn` (Egyptian), `jˈa ʔatjˈuːn`, `jatjˈuːn` (fast),
  `hˈeɪ ɐtˈuːn` (Hey Attune) … (`gen_tts.py` WAKE_PH). Voices: `en_US-libritts_r-medium` (CC BY 4.0, 904 speakers — 0–799
  train, 800–903 test), `es_ES-davefx`, `de_DE-thorsten`, `fa_IR-amir` (CC0), `fr_FR-siwis` (CC BY 4.0). Then augmented: room echo,
  phone-mic band, babble / noise / car hum at 0–25 dB SNR, loudness. Half are followed by a command ("ابعت رسالة لأحمد").
- **Sound-alike negatives**: «يا أستاذ»، «يا اتنين»، «يا مأمون»، «يا بتول»، «يا عطية»، "a tune", "attend", "at noon", "Hey Siri" …
- **Real speech negatives**: Google FLEURS (CC BY 4.0) — Egyptian Arabic, English, Turkish, French, Spanish.
- **Test only** (never trained on): `ar_JO-kareem` (an Arabic voice, licence unclear → only used to measure), FLEURS Egyptian test
  split (false wakes per hour), held-out LibriTTS speakers.

## Run it again
```
pip install piper-tts sherpa-onnx onnxruntime onnx pyarrow soundfile scipy
# voices → /tmp/claude-0/kws/voices, FLEURS parquet → /tmp/claude-0/wake/data, the two feature models → /tmp/claude-0/wake
python3 gen_fleurs.py ar_eg_validation en_us_validation tr_tr_validation fr_fr_validation es_419_validation ar_eg_test
python3 gen_tts.py pos test 600 900000; python3 gen_tts.py pos test_ar 300 910000; python3 gen_tts.py neg test 600 920000
for s in 0 1 2 3; do python3 gen_tts.py pos train 2000 $((100000*(s+1))); python3 gen_tts.py neg train 2000 $((100000*(s+1)+50000)); done
python3 train.py      # → attune_wake.onnx + eval.json (recall / false wakes per hour for each threshold)
```
`common.embed` computes the features exactly as the phone streams them (mel on the last 1760 samples every 1280, 8 frames
appended; embedding on the last 76 frames) — change one, change both.

## Making it better
Real recordings beat synthetic ones: «يا أتيون» said by real people (Egyptian, Gulf, Levantine, Maghrebi; men, women, kids; in a
car, a kitchen, a street) → add them as positives and train again. Same for false wakes reported from phones.
