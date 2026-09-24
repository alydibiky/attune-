# The on-device engine

## How it fits together

```
 Attune page (WebView, https://appassets.androidplatform.net/app/www/)
      │  window.AttuneNative  (NativeBridge.kt)
      ▼
 Kotlin: install models, web search, offline lock, network log, device facts
      │  HTTP to 127.0.0.1:<random port>, per-launch API key
      ▼
 llama.cpp's official server, running inside the app process (libattune-engine.so)
      │  best CPU backend for this chip, chosen at start-up
      ▼
 libggml-cpu-android_armv8.0 … armv9.2 (+ KleidiAI kernels)
```

- The page never talks to the network itself for the model: requests go
  through the bridge, so no browser security rule can get in the way.
- The server listens only on `127.0.0.1`, on a random port, and refuses any
  request without the key the app generates at each launch. Only the app's own
  page origin is allowed. Recent-prompt endpoints (`/slots`) are off.

## Speed

- **CPU variants**: the app ships one engine build per ARM generation and uses
  the fastest one the phone supports — dotprod (2018+), int8 matrix multiply
  (most 2021+ flagships), SVE2, SME. KleidiAI adds Arm's tuned kernels.
- **Flash attention + 8-bit KV cache**: half the memory per token of context,
  so the phone can hold longer conversations and documents.
- **Prompt reuse**: the fixed instructions Attune sends with every request are
  computed once and kept, so only the new part is processed.
- **Threads**: generation uses at most 4 fast cores (more only adds heat —
  generation is limited by memory speed); prompt reading leaves 2 cores free
  so the app never freezes. Hot phone or battery saver → fewer.
- **Context** is sized for comfort, not the maximum: 8K tokens (about 12
  pages) on most phones, 16K for small models on 12 GB+, 4K when the model
  itself fills much of memory.
- **Memory guard**: a model bigger than ~55% of the phone's RAM is refused —
  it would load, then swap, overheat and freeze the phone.
- **Heat guard**: at "critical" temperature the answer stops and keeps what
  was written.
- **Thinking** is capped (about 1,000–1,500 tokens) so the answer always
  starts; it is off by default and one tap ("Think") per question.
- The model stays loaded when you leave the app (Back sends it to the
  background), so reopening is instant.

## Quality

- The model's **own chat template** (Jinja), so Qwen 3.5 and Gemma 4 get the
  exact format they were trained on.
- **Think before answering** (Engine → How it answers): the model reasons first
  on questions and web answers. Its reasoning is kept apart from the answer.
- **Photos**: models marked 📷 install their photo reader (mmproj) too.
- **Standing instructions** apply to every answer; **Same question, same
  answer** fixes the randomness for workflows that must not drift.

## Models

Engine recommends one automatically from the phone's real memory. The list:

Speed-first on phones — a model that fills half the phone runs slowly and hot.

| Phone RAM | Recommended | Stronger option |
|---|---|---|
| 3 GB | Qwen 3.5 0.8B / 2B | — |
| 4 GB | Qwen 3.5 4B (IQ4_XS) | — |
| 6 GB | Qwen 3.5 4B (Q4_K_M) | — |
| 8 GB | Qwen 3.5 4B (Q5_K_M) | — |
| 12 GB+ | Qwen 3.5 4B (Q5_K_M) | Qwen 3.5 9B (slower, warmer) |

**Add any model**: any GGUF on Hugging Face as `owner/repo:QUANT` (e.g.
`unsloth/Qwen3.5-9B-GGUF:Q4_K_M`), or a direct `https://…/model.gguf` link.

Installed weights never change on their own. **Fingerprint** shows the SHA-256
of the file in use, as proof of exactly which model answered.

## Privacy

- The model never uses the network.
- **Offline lock** blocks every connection the app could make — web lookup,
  map tiles, downloads — at two levels (the bridge and the network code).
- **Network log** lists every connection made or refused this session, host
  and reason only.
- Nothing connects at start-up. Web lookup sends only the query and opens the
  result pages — never the conversation, files or memory.
- Plain http is allowed only to `127.0.0.1`.

## Not done yet

- Live translation of speech (voice input itself is done — the phone's own
  recogniser, on-device when available).
- Indexing large folders of your own documents for search.
- GPU/NPU acceleration (the CPU path with KleidiAI is currently the most
  reliable on Android; Qualcomm's NPU backend is still experimental in llama.cpp).
