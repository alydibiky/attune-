
### 4. Speculative decoding (the answer is identical; only the speed changes)
| Mode | code t/s | json t/s | Arabic t/s | edit t/s | Mean t/s | Guesses accepted |
|---|---|---|---|---|---|---|
| off | 11.3 | 10.6 | 10.2 | 10.3 | 10.6 | — |
| copy-ahead (ngram-mod) — the app's default | 10.9 | 10.5 | 10.5 | 11.5 | 10.8 | — |
| multi-token prediction (draft-mtp) | 13.4 | 15.9 | 7.9 | 11.7 | 12.2 | 67% |
| n-gram map (ngram-map-k) | 12.8 | 13.0 | 11.3 | 11.8 | 12.2 | 8% |
| 0.8B draft model + copy-ahead (the app's opt-in) | 10.0 | 9.5 | 4.0 | 6.7 | 7.6 | 49% |

Best: **multi-token prediction** — +15% writing speed vs off (10.6 → 12.2 t/s).
