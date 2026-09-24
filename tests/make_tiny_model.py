# Builds a tiny random-weight llama-architecture GGUF for engine testing.
# Output is gibberish by design; the point is to exercise load/serve/stream.
import sys
import numpy as np
import gguf

out = sys.argv[1] if len(sys.argv) > 1 else "tiny.gguf"
rng = np.random.default_rng(0)

n_embd, n_head, n_head_kv, n_layer, n_ff, n_ctx = 256, 4, 2, 2, 512, 4096
head_dim = n_embd // n_head

# ---- vocab (SentencePiece-style "llama" tokenizer) ----
tokens, scores, types = [], [], []
def add(t, s, ty):
    tokens.append(t); scores.append(s); types.append(ty)
N, UNK, CTRL, BYTE = gguf.TokenType.NORMAL, gguf.TokenType.UNKNOWN, gguf.TokenType.CONTROL, gguf.TokenType.BYTE
add("<unk>", 0.0, UNK)
add("<s>", 0.0, CTRL)
add("</s>", 0.0, CTRL)
add("<|im_start|>", 0.0, CTRL)
add("<|im_end|>", 0.0, CTRL)
for b in range(256):
    add(f"<0x{b:02X}>", 0.0, BYTE)
words = list("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?")
for i, w in enumerate(words):
    add("▁" + w, -1.0 - i * 0.01, N)
    add(w, -2.0 - i * 0.01, N)
for i, w in enumerate(["the", "and", "model", "phone", "attune", "hello", "world", "test"]):
    add("▁" + w, -0.5 - i * 0.01, N)
n_vocab = len(tokens)

tmpl = ("{% for message in messages %}<|im_start|>{{ message['role'] }}\n"
        "{{ message['content'] }}<|im_end|>\n{% endfor %}"
        "{% if add_generation_prompt %}<|im_start|>assistant\n{% endif %}")

w = gguf.GGUFWriter(out, "llama")
w.add_name("attune-tiny-test")
w.add_context_length(n_ctx)
w.add_embedding_length(n_embd)
w.add_block_count(n_layer)
w.add_feed_forward_length(n_ff)
w.add_head_count(n_head)
w.add_head_count_kv(n_head_kv)
w.add_layer_norm_rms_eps(1e-5)
w.add_rope_dimension_count(head_dim)
w.add_rope_freq_base(10000.0)
w.add_vocab_size(n_vocab)
w.add_file_type(gguf.LlamaFileType.ALL_F32)

w.add_tokenizer_model("llama")
w.add_token_list(tokens)
w.add_token_scores(scores)
w.add_token_types(types)
w.add_bos_token_id(1)
w.add_eos_token_id(4)       # <|im_end|> ends a turn, as in ChatML models
w.add_unk_token_id(0)
w.add_add_bos_token(False)
w.add_chat_template(tmpl)

def t(name, *shape):
    w.add_tensor(name, (rng.standard_normal(shape) * 0.02).astype(np.float32))
def ones(name, n):
    w.add_tensor(name, np.ones(n, dtype=np.float32))

t("token_embd.weight", n_vocab, n_embd)
for i in range(n_layer):
    ones(f"blk.{i}.attn_norm.weight", n_embd)
    t(f"blk.{i}.attn_q.weight", n_head * head_dim, n_embd)
    t(f"blk.{i}.attn_k.weight", n_head_kv * head_dim, n_embd)
    t(f"blk.{i}.attn_v.weight", n_head_kv * head_dim, n_embd)
    t(f"blk.{i}.attn_output.weight", n_embd, n_head * head_dim)
    ones(f"blk.{i}.ffn_norm.weight", n_embd)
    t(f"blk.{i}.ffn_gate.weight", n_ff, n_embd)
    t(f"blk.{i}.ffn_up.weight", n_ff, n_embd)
    t(f"blk.{i}.ffn_down.weight", n_embd, n_ff)
ones("output_norm.weight", n_embd)
t("output.weight", n_vocab, n_embd)

w.write_header_to_file()
w.write_kv_data_to_file()
w.write_tensors_to_file()
w.close()
print(f"wrote {out}: vocab={n_vocab} embd={n_embd} layers={n_layer}")
