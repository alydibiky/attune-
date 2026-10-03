import json, urllib.request, subprocess, time, os, sys
BIN=os.path.join(os.getcwd(),"tests/build-dl/bin"); env=dict(os.environ, LD_LIBRARY_PATH=BIN)
PROMPTS=[
"عميل بيقولي: الونش وصل متأخر ساعتين وعايز خصم. اكتبلي رد مهذب وحازم بالعربي المصري.",
"اشرح ببساطة إيه الفرق بين الونش المتحرك والونش البرجي، وامتى أستخدم كل واحد؟",
"لخص في 3 نقاط: الشركة اتفقت مع العميل على إيجار ونش 50 طن لمدة 3 أيام بمبلغ 9000 جنيه في اليوم، والدفع خلال 15 يوم من الاستلام، وفي حالة التأخير غرامة 2% شهرياً.",
"عايز أبدأ مشروع صغير أبيع فيه قطع غيار معدات ثقيلة. إيه أهم 5 حاجات لازم أفكر فيها؟",
"ترجم للعربي المصري: Please send the signed contract before Thursday so we can book the crane for next week.",
"أنا تعبان ومش عارف أنام بقالي أسبوع. ممكن تنصحني بشكل عملي من غير ما تكتبلي دواء؟",
"اكتب رسالة واتساب قصيرة أفكر فيها عميل إن فاتورته رقم 1042 بمبلغ 18,000 جنيه متأخرة عشرة أيام.",
"ايه هي أنواع الأوناش الشائعة في مصر وايه أهم احتياطات الأمان عند الرفع؟",
]
def run(model, label, extra):
    p=subprocess.Popen([BIN+"/llama-server","-m",model,"--host","127.0.0.1","--port","8150","-c","4096","-t","4","-np","1","--jinja","--no-ui","-fa","on","-ctk","q8_0","-ctv","q8_0"]+extra,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    for _ in range(300):
        try:
            if b"ok" in urllib.request.urlopen("http://127.0.0.1:8150/health",timeout=2).read(): break
        except Exception: time.sleep(1)
    out=[]; t0=time.time(); ntok=0
    for q in PROMPTS:
        body={"messages":[{"role":"system","content":"You are Attune, a helpful assistant on the user's phone. Answer in the user's language (Egyptian Arabic if they write it). Be concise."},{"role":"user","content":q}],"max_tokens":220,"temperature":0.3,"chat_template_kwargs":{"enable_thinking":False}}
        r=json.load(urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:8150/v1/chat/completions",data=json.dumps(body).encode(),headers={"content-type":"application/json"}),timeout=900))
        out.append(r["choices"][0]["message"]["content"]); ntok+=r["usage"]["completion_tokens"]
    dt=time.time()-t0; p.terminate(); p.wait(timeout=30)
    json.dump({"label":label,"answers":out,"tps":round(ntok/dt,1)},open(f"/tmp/arabic_{label}.json","w"),ensure_ascii=False,indent=1)
    print(label,"done",round(ntok/dt,1),"t/s",flush=True)
import sys
for label, path in [a.split("=",1) for a in sys.argv[1:]]:
    run(path, label, [])
    d=json.load(open(f"/tmp/arabic_{label}.json"))
    print("\n######## MODEL:", label, "—", d["tps"], "t/s", flush=True)
    for i,(q,a) in enumerate(zip(PROMPTS,d["answers"])):
        print(f"\n--- Q{i+1}: {q}\n{a}", flush=True)
