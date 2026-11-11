#!/bin/bash
# 10,000 nag timelines = 2,000 in each of 5 time zones (Cairo, Riyadh, London — DST, New York — DST, Tokyo). Writes report.md.
cd "$(dirname "$0")"; out=$(mktemp); rm -f "$out"
for z in Africa/Cairo Asia/Riyadh Europe/London America/New_York Asia/Tokyo; do TZ=$z NAG_OUT=$out node gen.mjs "${1:-2000}" 2>&1 | grep -v "MODULE_TYPELESS\|Reparsing\|eliminate\|trace-warnings"; done
node -e 'const l=require("fs").readFileSync(process.argv[1],"utf8").trim().split("\n").map(JSON.parse);const ok=l.reduce((a,x)=>a+x.ok,0),n=l.reduce((a,x)=>a+x.N,0);const s="# Nag run — "+n+" timelines, "+ok+" right ("+(100*ok/n).toFixed(2)+"%)\n\n"+l.map(x=>"- "+x.TZ+": "+x.ok+" / "+x.N).join("\n")+"\n";require("fs").writeFileSync("report.md",s);console.log(s)' "$out"; rm -f "$out"
