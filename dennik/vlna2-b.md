# Vlna 2 – úloha B: automatické zvuky strachu (2026-11-26)

## Čo je hotové
- `src/main.js`: zóna sa už neposiela ako 0, ale `hororovaZona(x, z)` z ostrova Tichá zátoka. Ďalej sa posiela `jaskyna` (`stavZony.jaskyna`) a `svetlo` (fakla v ruke +0,4, blízky ohen +0,3).
- `src/strach.js`:
  - nový nočný strach `nocny` (plynulo): v zóne po tme rastie sám (`zóna × tma × 0,4`), v jaskyni ešte viac (+0,3), svetlo ho tlmí.
  - cooldowny: prvých 60 s v noci na ostrove ticho, potom jeden zvuk; po 90 s sa udalosti spúšťajú podľa strachu (ako predtým).
  - nová exportovaná funkcia `udalostBledeho(druh, pozicia)`: `'vykuknutie'` = šok 0,3 + šepot, `'utok'` = šok 0,6 + výkrik.
- Svitanie a úľavná melódia zostali nezmenené (fungujú, keď nočný strach klesne).

## Test
- Náhľad na porte 8132, nový štart, `hra.naOstrov('ticha_zatoka')`, posun na noc: zóna = 1, ticho = 1, nočný strach ~0,40, strach ~0,40, mimo ostrova bez zmeny.
- Zvuky sa v headless prehliadači nespustili (audio kontext nebol odomknutý klikom), takže počet udalostí a dron treba overiť ručne v hre.

## Pre používateľa
- Na ostrove v noci (F2 → skok na polnoc) sa po ~1 min ozve prvý zvuk, potom hustejšie.
- Pri fakli v ruke alebo pri ohni je strach nižší.
