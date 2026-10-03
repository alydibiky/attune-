
### 4. Speculative decoding (the answer is identical; only the speed changes)
| Mode | code t/s | json t/s | Arabic t/s | edit t/s | Mean t/s | Guesses accepted |
|---|---|---|---|---|---|---|
| off | 5.5 | 5.9 | 6.0 | 6.1 | 5.9 | — |
| copy-ahead (ngram-mod) — the app's default | 6.2 | 6.1 | 6.1 | 6.0 | 6.1 | — |
| multi-token prediction (draft-mtp) | 9.0 | 10.3 | 4.1 | 8.0 | 7.8 | 68% |
| n-gram map (ngram-map-k) | 5.8 | 5.5 | 5.3 | 5.0 | 5.4 | — |
| MTP, 2 guesses (draft-mtp n-max 2) | 7.5 | 8.1 | 4.4 | 7.3 | 6.8 | 72% |
| MTP, 4 guesses (draft-mtp n-max 4) | 9.4 | 10.2 | 3.8 | 6.8 | 7.6 | 60% |
| MTP 2 + n-gram map | 8.2 | 8.2 | 4.5 | 7.2 | 7.0 | 72% |
| MTP 3 + copy-ahead | 8.9 | 10.5 | 4.2 | 7.2 | 7.7 | 68% |
| 0.8B draft model + copy-ahead (the app's opt-in) | 7.2 | 9.4 | 2.0 | 4.5 | 5.8 | 46% |

Best: **multi-token prediction** — +33% writing speed vs off (5.9 → 7.8 t/s).
