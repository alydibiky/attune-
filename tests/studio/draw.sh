#!/bin/bash
# Studio lab 2: draw every prompt of a prompt file with one pipeline, time each picture.
# draw.sh <name> <kind: sd21|xl|dmd2> <steps> <side> <prompt file> <post: none|esrgan|refine> [extra sd-cli options]
set -u
NAME=$1 KIND=$2 N=$3 S=$4 PF=$5 POST=$6; shift 6; X="$*"
SD=~/sd/build/bin/sd-cli; M=~/m; O=$GITHUB_WORKSPACE/studio-out/$NAME; mkdir -p "$O"
T=$(nproc); i=0; : > "$O/times.txt"
while read -r P; do
  [ -z "$P" ] && continue
  t0=$(date +%s.%N)
  case $KIND in
    sd21) $SD -m $M/sd21.gguf --taesd $M/taesd.safetensors -p "$P" -o $O/$i.png -W $S -H $S --steps $N --cfg-scale 1 --sampling-method euler_a --prediction eps --scheduler sgm_uniform -s 7 -t $T $X > $O/log$i.txt 2>&1 ;;
    xl)   $SD -m $M/xl.gguf -p "$P" -o $O/$i.png -W $S -H $S --steps $N --cfg-scale 1 --sampling-method euler_a --prediction eps --scheduler sgm_uniform -s 7 -t $T $X > $O/log$i.txt 2>&1 ;;
    dmd2) $SD -m $M/xlbase.gguf --lora-model-dir $M -p "$P <lora:dmd2:1>" -o $O/$i.png -W $S -H $S --steps $N --cfg-scale 1 --sampling-method lcm -s 7 -t $T $X > $O/log$i.txt 2>&1 ;;
  esac
  case $POST in
    esrgan) $SD -M upscale --upscale-model $M/esrgan.pth -i $O/$i.png -o $O/$i.png -t $T --upscale-tile-size 128 >> $O/log$i.txt 2>&1 ;;
    refine) $SD -m $M/xl.gguf -M img_gen -i $O/$i.png --strength 0.35 -p "$P" -o $O/$i.png -W $S -H $S --steps 2 --cfg-scale 1 --sampling-method euler_a --prediction eps --scheduler sgm_uniform -s 8 -t $T --taesd $M/taesdxl.safetensors >> $O/log$i.txt 2>&1 ;;
  esac
  python3 -c "import time;print(round(time.time()-$t0,1))" >> "$O/times.txt"; tail -1 $O/log$i.txt; i=$((i+1))
done < "$PF"
python3 -c "import json;t=[float(x) for x in open('$O/times.txt')];json.dump({'mean':round(sum(t)/len(t),1),'all':t},open('$O/times.json','w'))"
