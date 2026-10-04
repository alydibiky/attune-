# Fills design/src/studio.html's <!--OPTS--> with the 3 options x 4 states.
P = "design/src/studio.html"
SC = '<div class="scene"></div><div class="sun"></div><div class="jib"></div><div class="crane"></div><div class="cable"></div><div class="beam"></div>'
def img(cls, badge, inner=None):
    return f'<div class="img {cls}">{inner if inner is not None else SC}<span class="badge">{badge}</span></div>'
def ph(body, cap):
    return f'<div><div class="ph"><div class="top">Studio</div>{body}</div><div class="st">{cap}</div></div>'
def bar(pct, l, r):
    return f'<div class="bar"><i style="width:{pct}%"></i></div><div class="row"><span>{l}</span><span>{r}</span></div>'
STOP = '<div class="btns"><div class="b">Stop</div></div>'
DONE = '<div class="btns"><div class="b">Again</div><div class="b">Edit</div><div class="b p">Save</div></div>'
SK = '<div class="sk"></div>'

A = [ph(img("", "Queued", SK) + bar(2, "Waiting for the chip…", "") + STOP, "1 Queued: a shimmer skeleton, no spinner"),
     ph(img("blur", "Draft · 384 px · 9 s") + bar(35, "Draft ready, you can already Save", "~40 s left") + '<div class="btns"><div class="b">Stop</div><div class="b p">Keep draft</div></div>', "2 Draft: a usable picture after about 10 s"),
     ph(img("half", "Making it clear…") + bar(75, "Refining to 768 px", "~12 s left") + STOP, "3 Refining: the same picture gets sharper"),
     ph(img("", "Done · 768 px") + bar(100, "Done in 52 s", "") + DONE, "4 Done: a cross-fade swaps it in, with a haptic tick")]
B = [ph(f'<div class="two"><div class="img">{SK}</div><div class="img">{SK}</div></div>' + bar(2, "Queued · best of 2", "") + STOP, "1 Queued: two skeletons"),
     ph(f'<div class="two"><div class="img blur">{SC}<span class="badge">Draft 1</span></div><div class="img blur" style="filter:hue-rotate(20deg)">{SC}<span class="badge">Draft 2</span></div></div>' + bar(40, "Tap the one you like", "both in 18 s") + STOP, "2 Drafts: 2 quick 384 px drafts; you pick one"),
     ph(f'<div class="two"><div class="img half sel">{SC}<span class="badge">Refining ✓</span></div><div class="img blur" style="opacity:.35">{SC}</div></div>' + bar(75, "Refining your pick", "~12 s left") + STOP, "3 Refining: only your pick is sharpened"),
     ph(img("", "Done · best of 2") + bar(100, "Done in 64 s", "") + DONE, "4 Done")]
def steps(n):
    return '<div class="steps">' + "".join(f'<div class="{"noise" if i<2 else "half" if i<3 else ""}">{SC if i<n else ""}</div>' for i in range(4)) + '</div>'
C = [ph(img("", "Step 0 / 8", SK) + bar(2, "Queued", "") + steps(0) + STOP, "1 Queued"),
     ph(img("noise", "Step 3 / 8") + bar(38, "Each step shows live", "~30 s left") + steps(2), "2 Step previews: noise slowly turns into the picture"),
     ph(img("half", "Step 6 / 8") + bar(75, "Almost there", "~10 s left") + steps(3), "3 Refining: the strip shows the history"),
     ph(img("", "Done · 8 steps") + bar(100, "Done in 48 s", "") + steps(4) + DONE, "4 Done")]
D = [ph(img("", "", SK) + bar(2, "Queued", "") + STOP, "1 Queued"),
     ph(img("", "", SK) + bar(30, "Drawing… 30%", "~35 s left") + STOP, "2 Drawing: only a bar, no picture yet"),
     ph(img("", "", SK) + bar(80, "Sharpening… 80%", "~10 s left") + STOP, "3 Sharpening"),
     ph(img("", "Done") + bar(100, "Done in 50 s", "") + DONE, "4 Done: the picture appears once")]
def opt(title, txt, phs):
    return f'<div class="opt"><div class="desc">{title}{txt}</div>{"".join(phs)}</div>'
html = opt('<h2>A · Draft then clear <span class="tag">recommended</span></h2>', 'You see a real picture in <b>about 10 s</b> and can keep it straight away. The clear version swaps in on the same spot, so nothing jumps. This works best with a distilled model that needs few steps. It costs about 10 s more than a single pass.', A) + \
       opt('<h2>B · Best of 2</h2>', 'It makes two drafts at once and you tap the better one. Only that one is sharpened. It gives the <b>best results for prompts like the crane one</b>, which go wrong half the time. It needs about 1.3× the memory and time of A. It could be a switch in A ("Best of 2").', B) + \
       opt('<h2>C · Per-step previews</h2>', 'It decodes the latent at every step with a tiny preview decoder, so it feels very "alive". However the first steps are only noise, so it does not show <b>sooner</b> whether the picture is right. It also costs about 5–8 % in speed.', C) + \
       opt('<h2>D · Simple progress (today, roughly)</h2>', 'A bar and a time estimate only. It is the cheapest, but you wait about 50 s before learning that the crane came out over the sea. It is kept here as the baseline.', D)
s = open(P, encoding="utf-8").read().replace("<!--OPTS-->", html)
open("design/src/studio.out.html", "w", encoding="utf-8").write(s)
