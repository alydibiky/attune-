# 1M part B — 40 feature generators with new cases (SEED_SHIFT=1): 404456 of 404893 right (99.892%)

| feature | cases | right | % | exit | seconds |
|---|---|---|---|---|---|
| agentedit | 10000 | 10000 | 100.00 | 0 | 0 |
| agents33 | 10000 | 10000 | 100.00 | 0 | 0 |
| ainight | ? | ? | ? | 0 | 5 |
| au4 | 10000 | 10000 | 100.00 | 0 | 3 |
| b4plan | 10000 | 10000 | 100.00 | 0 | 2 |
| b4time | 10000 | 10000 | 100.00 | 0 | 2 |
| b5 | 30000 | 30000 | 100.00 | 0 | 0 |
| bgmind | 10000 | 10000 | 100.00 | 0 | 8 |
| brain | 10000 | 10000 | 100.00 | 0 | 1 |
| braindump | 10000 | 10000 | 100.00 | 0 | 9 |
| catlearn | 10000 | 10000 | 100.00 | 0 | 1 |
| conds | 10000 | 10000 | 100.00 | 0 | 0 |
| docs | 10000 | 10000 | 100.00 | 0 | 1 |
| donelog | 10000 | 10000 | 100.00 | 0 | 0 |
| egid | 10000 | 10000 | 100.00 | 0 | 0 |
| groups | 10000 | 10000 | 100.00 | 0 | 0 |
| mrz | 10000 | 9671 | 96.71 | 0 | 0 |
| n1 | 10000 | 10000 | 100.00 | 0 | 2 |
| nag | 10000 | 10000 | 100.00 | 0 | 1 |
| notifmind | 10000 | 9896 | 98.96 | 0 | 3 |
| notifpay | 10000 | 10000 | 100.00 | 0 | 0 |
| notifs | 4893 | 4893 | 100.00 | 0 | 5 |
| p2 | 10000 | 10000 | 100.00 | 0 | 2 |
| phonerules | 10000 | 10000 | 100.00 | 0 | 0 |
| photoq | 10000 | 10000 | 100.00 | 0 | 379 |
| placering | 10000 | 10000 | 100.00 | 0 | 0 |
| plan | 10000 | 10000 | 100.00 | 0 | 0 |
| recipes | 10000 | 10000 | 100.00 | 0 | 8 |
| rules | 10000 | 9996 | 99.96 | 0 | 8 |
| salarysort | 10000 | 10000 | 100.00 | 0 | 0 |
| setup | 10000 | 10000 | 100.00 | 0 | 1 |
| suggest | 10000 | 10000 | 100.00 | 0 | 2 |
| tr1 | 10000 | 10000 | 100.00 | 0 | 1 |
| tr2 | 10000 | 10000 | 100.00 | 0 | 0 |
| tr3 | 10000 | 10000 | 100.00 | 0 | 0 |
| x1card | 10000 | 10000 | 100.00 | 0 | 0 |
| x2 | 10000 | 10000 | 100.00 | 0 | 0 |
| x3 | 10000 | 10000 | 100.00 | 0 | 1 |
| x4 | 10000 | 10000 | 100.00 | 0 | 0 |
| x6 | 10000 | 10000 | 100.00 | 0 | 4 |

## Generators with anything wrong (their own words)

### ainight
```
{
 "pass": 10000,
 "N": 10000,
 "rate": 1,
 "bad": []
}
(node:29491) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/attune-/web-src/aijobs.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/user/attune-/web-src/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

```

### mrz
```
# MRZ — 10000 documents

Passed: **9671 / 10000 (96.71%)**

- look-alike noise not fixed (not sure) — 306
- number marked OK but wrong — 23
(node:29598) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/attune-/web-src/mrz.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/user/attune-/web-src/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

```

### notifmind
```
notifications 10000 · all right 9896 (99.0%) · code sure of 9367 (93.7%) · right when sure 9367 (100.00%)
  en   right 99.5% sure 94.3%
  ar   right 98.1% sure 93.8%
  arb  right 99.5% sure 93.8%
  fr   right 100.0% sure 94.3%
  es   right 98.1% sure 92.5%
  de   right 98.1% sure 92.5%
  pt   right 98.1% sure 92.5%
  it   right 100.0% sure 94.3%
  tr   right 100.0% sure 94.3%
  id   right 98.1% sure 94.3%
(node:29619) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/attune-/web-src/notifmind.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/user/attune-/web-src/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

```

### rules
```
# Rules run — 10000 sentences, 9996 right (99.96%)

Wrong per language: ur 1 · bn 1 · ja 1 · ko 1

- **ur · before-hour check** × 1: «جب تنخواہ آئے 7 بجے سے پہلے 1000 سے زیادہ 10 منٹ کا ٹائمر چلاؤ»
- **bn · before-hour check** × 1: «যখন করিম টাকা পাঠালে 11 টার আগে 1000 এর বেশি 10 মিনিটের টাইমার চালাও»
- **ja · before-hour check** × 1: «カリムから振り込まれたら 7時前 2500以上、10分のタイマーをかけて»
- **ko · before-hour check** × 1: «모나가 입금하면 들어오면 평일 8시 전 500 이상 10분 타이머 맞춰»
(node:30298) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/attune-/web-src/rules.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/user/attune-/web-src/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

```
