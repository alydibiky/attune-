#!/bin/bash
# Studio "Draft then clear": total time of draft + final against final alone, and how soon a picture can be shown.
# preview_bench.sh <kind: sd21|xl> <steps> <prompt file> [limit]
# Per prompt (same seed): F = final 512 alone; P = final 512 with a tiny-decoder preview written each step
# (and the time the first preview file appears); D = draft 384; R = final 512 run after D (draft+final = D+R);
# I = img2img 512 from the draft (strength 0.6), the "refine from the draft" option.
set -u
KIND=$1 N=$2 PF=$3 LIMIT=${4:-5}
SD=~/sd/build/bin/sd-cli; M=~/m; O=$GITHUB_WORKSPACE/studio-out/preview-$KIND; mkdir -p "$O"; T=$(nproc)
if [ "$KIND" = sd21 ]; then MOD="-m $M/sd21.gguf --taesd $M/taesd.safetensors"; else MOD="-m $M/xl.gguf --taesd $M/taesdxl.safetensors"; fi
COMMON="--cfg-scale 1 --sampling-method euler_a --prediction eps --scheduler sgm_uniform -t $T"
now() { python3 -c 'import time;print(time.time())'; }
dt() { python3 -c "print(round($(now)-$1,1))"; }
echo "i,F,P,P_first_preview,Q,Q_first_preview,D,R,I" > $O/times.csv
i=0
while read -r P; do
  [ -z "$P" ] && continue; [ $i -ge $LIMIT ] && break; S=$((100+i))
  t=$(now); $SD $MOD -p "$P" -o $O/$i-F.png -W 512 -H 512 --steps $N $COMMON -s $S > $O/log$i-F.txt 2>&1; F=$(dt $t)
  rm -f $O/$i-prev.png $O/$i-first.txt; t=$(now)
  ( while [ ! -s $O/$i-prev.png ]; do sleep 0.2; done; dt $t > $O/$i-first.txt ) & W=$!
  $SD $MOD -p "$P" -o $O/$i-P.png -W 512 -H 512 --steps $N $COMMON -s $S --preview tae --preview-path $O/$i-prev.png --preview-interval 1 > $O/log$i-P.txt 2>&1; Pt=$(dt $t)
  sleep 0.5; kill $W 2>/dev/null; PF1=$(cat $O/$i-first.txt 2>/dev/null || echo NA)
  # Q = one preview only, after the first step (-1): the cheapest "free draft"
  rm -f $O/$i-q.png $O/$i-qfirst.txt; t=$(now)
  ( while [ ! -s $O/$i-q.png ]; do sleep 0.2; done; dt $t > $O/$i-qfirst.txt; cp $O/$i-q.png $O/$i-Q1.png ) & W=$!
  $SD $MOD -p "$P" -o $O/$i-Q.png -W 512 -H 512 --steps $N $COMMON -s $S --preview tae --preview-path $O/$i-q.png --preview-interval -1 > $O/log$i-Q.txt 2>&1; Qt=$(dt $t)
  sleep 0.5; kill $W 2>/dev/null; QF1=$(cat $O/$i-qfirst.txt 2>/dev/null || echo NA)
  t=$(now); $SD $MOD -p "$P" -o $O/$i-D.png -W 384 -H 384 --steps $N $COMMON -s $S > $O/log$i-D.txt 2>&1; D=$(dt $t)
  t=$(now); $SD $MOD -p "$P" -o $O/$i-R.png -W 512 -H 512 --steps $N $COMMON -s $S > $O/log$i-R.txt 2>&1; R=$(dt $t)
  python3 -c "from PIL import Image;Image.open('$O/$i-D.png').resize((512,512),Image.LANCZOS).save('$O/$i-Dup.png')"
  IS=$((N<2?2:N))
  t=$(now); $SD $MOD -M img_gen -i $O/$i-Dup.png --strength 0.6 -p "$P" -o $O/$i-I.png -W 512 -H 512 --steps $IS $COMMON -s $S > $O/log$i-I.txt 2>&1; I=$(dt $t)
  echo "$i,$F,$Pt,$PF1,$Qt,$QF1,$D,$R,$I" | tee -a $O/times.csv; tail -2 $O/log$i-P.txt; tail -1 $O/log$i-I.txt
  i=$((i+1))
done < "$PF"
