# 1M part B — 40 feature generators with new cases (SEED_SHIFT=1): 242996 of 244893 right (99.225%)

| feature | cases | right | % | exit | seconds |
|---|---|---|---|---|---|
| agentedit | 10000 | 10000 | 100.00 | 0 | 0 |
| agents33 | ? | ? | ? | 0 | 0 |
| ainight | ? | ? | ? | 0 | 4 |
| au4 | 10000 | 10000 | 100.00 | 0 | 2 |
| b4plan | 10000 | 10000 | 100.00 | 0 | 2 |
| b4time | 10000 | 10000 | 100.00 | 0 | 2 |
| b5 | 10000 | 10000 | 100.00 | 0 | 0 |
| bgmind | ? | ? | ? | 0 | 8 |
| brain | ? | ? | ? | 0 | 1 |
| braindump | 10000 | 9906 | 99.06 | 0 | 7 |
| catlearn | ? | ? | ? | 0 | 1 |
| conds | 10000 | 10000 | 100.00 | 0 | 0 |
| docs | 10000 | 10000 | 100.00 | 0 | 1 |
| donelog | ? | ? | ? | 0 | 0 |
| egid | 10000 | 10000 | 100.00 | 0 | 0 |
| groups | ? | ? | ? | 0 | 0 |
| mrz | 10000 | 8197 | 81.97 | 0 | 0 |
| n1 | 10000 | 10000 | 100.00 | 0 | 2 |
| nag | 10000 | 10000 | 100.00 | 0 | 1 |
| notifmind | ? | ? | ? | 0 | 3 |
| notifpay | ? | ? | ? | 0 | 0 |
| notifs | 4893 | 4893 | 100.00 | 0 | 4 |
| p2 | 10000 | 10000 | 100.00 | 0 | 2 |
| phonerules | 10000 | 10000 | 100.00 | 0 | 0 |
| photoq | 10000 | 10000 | 100.00 | 0 | 369 |
| placering | 10000 | 10000 | 100.00 | 0 | 0 |
| plan | ? | ? | ? | 0 | 0 |
| recipes | ? | ? | ? | 0 | 8 |
| rules | ? | ? | ? | 0 | 7 |
| salarysort | ? | ? | ? | 0 | 0 |
| setup | ? | ? | ? | 0 | 0 |
| suggest | ? | ? | ? | 0 | 2 |
| tr1 | 10000 | 10000 | 100.00 | 0 | 1 |
| tr2 | 10000 | 10000 | 100.00 | 0 | 0 |
| tr3 | 10000 | 10000 | 100.00 | 0 | 0 |
| x1card | 10000 | 10000 | 100.00 | 0 | 0 |
| x2 | 10000 | 10000 | 100.00 | 0 | 0 |
| x3 | 10000 | 10000 | 100.00 | 0 | 1 |
| x4 | 10000 | 10000 | 100.00 | 0 | 0 |
| x6 | 10000 | 10000 | 100.00 | 0 | 3 |

## Generators with anything wrong (their own words)

### agents33
```
# Agents v9.9.33 — 10000 saved agents, 10000 without a fault (100.00%)
(node:8298) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/attune-/web-src/agents.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/user/attune-/web-src/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

```

### ainight
```
{
 "pass": 10000,
 "N": 10000,
 "rate": 1,
 "bad": []
}
(node:8311) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/attune-/web-src/aijobs.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/user/attune-/web-src/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

```

### bgmind
```
# Background thinking v9.9.36 — 10000 cases, 10000 right (100.00%)
(node:8359) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/attune-/web-src/notifmind.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/user/attune-/web-src/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

```

### brain
```
# The Attune brain v9.9.37 — 10000 people, 10000 right (100.00%)
(node:8382) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/attune-/web-src/lifefacts.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/user/attune-/web-src/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

```

### braindump
```
# Brain dump — 10000 paragraphs

Passed: **9906 / 10000 (99.06%)**

- ko: clauses N ≠ N — 32  e.g. «점심 440 냈다 / 3일 월세 12300 납부, 쌀 하고 우유 사기 그리고 우유, 쌀 하고 빵 사기 내일 그리고 부엌 청소 목요일»
- tr: items ekmek→ekmek/süt — 31  e.g. «ekmek satın al, süt, ekmek ve yumurta satın al / ayın 17'i kira 9950 öde / Cuma Ahmet'i saat 9 ara»
- de: items Milch→Milch/Reis — 31  e.g. «die Küche putzen Dienstag, bezahlen die Internetrechnung 3050 am 12., Mittwoch Milch besorgen, Reis, Brot und Eier kaufen Freitag»
(node:8389) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/attune-/web-src/braindump.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/user/attune-/web-src/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

```

### catlearn
```
# Categories-learn run — 10000 ledgers, 10000 right (100.00%)


(node:8415) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/attune-/web-src/catlearn.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/user/attune-/web-src/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

```

### donelog
```
# Done-for-you run — 10000 days, 10000 right (100.00%)


(node:8453) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/attune-/web-src/donelog.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/user/attune-/web-src/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

```

### groups
```
# Groups run — 10000 groups, 10000 right (100.00%)


(node:8467) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/attune-/web-src/groups.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/user/attune-/web-src/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

```

### mrz
```
# MRZ — 10000 documents

Passed: **8197 / 10000 (81.97%)**

- look-alike noise not fixed (not sure) — 139
- not found — 1108
- number marked OK but wrong — 556
(node:8474) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/attune-/web-src/mrz.js is not specified and it doesn't parse as CommonJS.
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
(node:8495) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/attune-/web-src/notifmind.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/user/attune-/web-src/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

```

### notifpay
```
# Notification buttons run — 10000 tap sequences, 10000 right (100.00%)


(node:8502) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/attune-/web-src/notifpay.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/user/attune-/web-src/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

```

### plan
```
# Free / Pro v9.9.34 — 10000 situations, 10000 right (100.00%)
(node:8567) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/attune-/web-src/plan.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/user/attune-/web-src/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

```

### recipes
```
# Recipes run — 10000 people, 10000 right (100.00%)


(node:8574) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/attune-/web-src/recipes.js is not specified and it doesn't parse as CommonJS.
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
(node:8581) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/attune-/web-src/rules.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/user/attune-/web-src/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

```

### salarysort
```
# Salary sorter run — 10000 salaries, 10000 right (100.00%)


(node:8589) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/attune-/web-src/salarysort.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/user/attune-/web-src/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

```

### setup
```
# Set up your life v9.9.35 — 10000 people, 10000 right (100.00%)
(node:8596) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/attune-/web-src/setup.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/user/attune-/web-src/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

```

### suggest
```
# Suggestions run — 10000 histories, 10000 right (100.00%)


(node:8603) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/user/attune-/web-src/suggest.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/user/attune-/web-src/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

```
