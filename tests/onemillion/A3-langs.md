# 1M part A3 — 100000 sentences in 20 languages + Franco, 99952 right (99.95%), 303 of them handed to the model with the right kind among its choices

| language | sentences | wrong | by code | left to the model | right % |
|---|---|---|---|---|---|
| id | 4546 | 48 | 4498 | 0 | 98.94 |
| en | 4546 | 0 | 4546 | 0 | 100.00 |
| ar | 4546 | 0 | 4531 | 15 | 100.00 |
| arb | 4546 | 0 | 4258 | 288 | 100.00 |
| fr | 4546 | 0 | 4546 | 0 | 100.00 |
| es | 4546 | 0 | 4546 | 0 | 100.00 |
| de | 4546 | 0 | 4546 | 0 | 100.00 |
| pt | 4546 | 0 | 4546 | 0 | 100.00 |
| it | 4546 | 0 | 4546 | 0 | 100.00 |
| tr | 4546 | 0 | 4546 | 0 | 100.00 |
| ru | 4545 | 0 | 4545 | 0 | 100.00 |
| hi | 4545 | 0 | 4545 | 0 | 100.00 |
| ur | 4545 | 0 | 4545 | 0 | 100.00 |
| fa | 4545 | 0 | 4545 | 0 | 100.00 |
| bn | 4545 | 0 | 4545 | 0 | 100.00 |
| sw | 4545 | 0 | 4545 | 0 | 100.00 |
| th | 4545 | 0 | 4545 | 0 | 100.00 |
| vi | 4545 | 0 | 4545 | 0 | 100.00 |
| zh | 4545 | 0 | 4545 | 0 | 100.00 |
| ja | 4545 | 0 | 4545 | 0 | 100.00 |
| ko | 4545 | 0 | 4545 | 0 | 100.00 |
| franco | 4545 | 0 | 4545 | 0 | 100.00 |

## What went wrong

### id
- **spend → chat** × 45: «bensin 550 ribu!» · «taksi 1200 ribu!» · «makan siang 350 ribu!» · «tolong belanja 250 ribu!»
- **spend → money (amount 75 ≠ 75000)** × 1: «gym 75 ribu!»
- **spend → money (amount 480 ≠ 480000)** × 1: «eh, gym 480 ribu!»
- **spend → money (amount 25 ≠ 25000)** × 1: «tolong gym 25 ribu!»
