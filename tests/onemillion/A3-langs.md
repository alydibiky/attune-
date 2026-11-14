# 1M part A3 — 74316 sentences in 20 languages + Franco, 74291 right (99.97%), 303 of them handed to the model with the right kind among its choices

| language | sentences | wrong | by code | left to the model | right % |
|---|---|---|---|---|---|
| id | 3378 | 25 | 3353 | 0 | 99.26 |
| en | 3378 | 0 | 3378 | 0 | 100.00 |
| ar | 3378 | 0 | 3363 | 15 | 100.00 |
| arb | 3378 | 0 | 3090 | 288 | 100.00 |
| fr | 3378 | 0 | 3378 | 0 | 100.00 |
| es | 3378 | 0 | 3378 | 0 | 100.00 |
| de | 3378 | 0 | 3378 | 0 | 100.00 |
| pt | 3378 | 0 | 3378 | 0 | 100.00 |
| it | 3378 | 0 | 3378 | 0 | 100.00 |
| tr | 3378 | 0 | 3378 | 0 | 100.00 |
| ru | 3378 | 0 | 3378 | 0 | 100.00 |
| hi | 3378 | 0 | 3378 | 0 | 100.00 |
| ur | 3378 | 0 | 3378 | 0 | 100.00 |
| fa | 3378 | 0 | 3378 | 0 | 100.00 |
| bn | 3378 | 0 | 3378 | 0 | 100.00 |
| sw | 3378 | 0 | 3378 | 0 | 100.00 |
| th | 3378 | 0 | 3378 | 0 | 100.00 |
| vi | 3378 | 0 | 3378 | 0 | 100.00 |
| zh | 3378 | 0 | 3378 | 0 | 100.00 |
| ja | 3378 | 0 | 3378 | 0 | 100.00 |
| ko | 3378 | 0 | 3378 | 0 | 100.00 |
| franco | 3378 | 0 | 3378 | 0 | 100.00 |

## What went wrong

### id
- **spend → chat** × 21: «tolong belanja 1800 ribu!» · «tolong kopi 1500 ribu!» · «taksi 25 ribu!» · «taksi 250 ribu!»
- **spend → money (amount 6000 ≠ 6000000)** × 1: «eh, gym 6000 ribu!»
- **spend → money (amount 180 ≠ 180000)** × 1: «gym 180 ribu!»
- **spend → money (amount 150 ≠ 150000)** × 1: «tolong gym 150 ribu!»
- **spend → money (amount 220 ≠ 220000)** × 1: «gym 220 ribu!»
