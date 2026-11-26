# Vlna 2 – úloha C: Bledí (model, animácie, správanie)

Vetva `horor2-c`. Nové súbory: `src/modely_bledych.js` (model + animácie), `src/bledi.js` (stavový automat, zásah, dev).

## Čo je hotové
- **Model kódom** (2,9 m, Matka 1,28× väčšia a tmavšia s rohmi z kosti): vychudnutý trup s rebrami a chrbticou, ruky po kolená,
  5 prstov s pazúrmi, maska z kosti s dvoma čiernymi dierami a bez úst, slabá vlastná žiara (emissive), aby bol v tme len slabo vidieť.
  Kĺby ako v `postava.js` (`telo, chrbat, krk, hlava, sL/sP, kL/kP, rL/rP, lL/lP, zL/zP, prsty`). 53 meshov, bez tieňov.
- **Animácie** (`animuj()`): státie s trhanými šklbnutiami hlavy, chôdza, plíženie po štyroch, šprint, švih pazúrmi, cúvanie so zakrytou
  tvárou (`cuva`), vykuknutie (hlava + ruka na kmeni). Poza sa plynule nasleduje (`rychl`).
- **Správanie** (`src/bledi.js`, stavy `skryty → hliadka → pozoruje | vykuk → plizi → utok → ustup`, `cuva`, `mrtvy`):
  - cez deň skrytí; v noci sa objavia na domove (nie pred očami hráča), chodia po trase, keď hráča zbadajú (36 m), pozorujú alebo vykukujú spoza stromu;
  - ak sa naň hráč priamo pozerá > 2,2 s, zmizne (objaví sa na najvzdialenejšom bode trasy); pri plížení pred pohľadom zmrzne;
  - plíženie za chrbát hráča, útok = šprint 8,5 m/s + švih (`zran` z `preziti.js`, 16 dmg, Matka 30), odhodenie, hneď ústup do tmy a 14–26 s pauza;
  - fakľa (6–8 m) a táborák (12 m) ich odpudia (`cuva`); časom sa osmelia (odvaha až -40 % dosahu), úder hráča odvahu vynuluje;
  - ráno / keď hráč odíde z ostrova utekajú domov a skryjú sa (nie pred očami hráča);
  - Matka je len v jaskyni (aktívna keď je hráč v jaskyni alebo do 50 m od komory), 150 HP, pomalšia, 30 dmg.
- **Boj**: Bledí sa dajú udrieť cez existujúce zbrane – v `boj.js` sa k `udriNepriatela` pridalo `udriBledych` (jeden riadok). 45 HP (Matka 150), úder ich odplaší
  na 2,5–4 s a 8–14 s sa nevracajú. Po smrti padnú a vrátia sa po 5 (Matka 10) minútach. Žiadna krv.
- **Kraby**: v `nepriatelia.js` jedna podmienka – nočné kraby (`noc: true`) sa nerodia tam, kde `hororovaZona > 0.05`.
- **Dev (F2 → Strach)**: „Bledý sem“, „Vykukne spoza stromu“, „Prepni AI Bledých“. Konzola: `hra.bledi()` (stav), `hra.bledySem()`, `hra.vykuk()`, `hra.bledyAI(true/false)`,
  `hra.bledyZoz` (surové objekty; `b.vynutPoza='plizi'` pri vypnutej AI vynúti pózu), `hra.hodina()`.
- **FPS**: 5 Bledých naraz ≈ +1,2 ms na vykreslenie (3,6 → 4,8 ms), shadery sa zahrejú pri štarte (`renderer.compile` v `initBledi`), takže prvé zjavenie nezasekne.

## Napojenie na súbežné úlohy (kde to prepnúť)
- **Úloha A (ostrov):** `bledi.js → initBledi()` používa `tichaZatoka.bledi ?? docasne()`; trasy/domov/ukryt z A sa použijú automaticky (formát
  `{ id, typ, domov:{x,z}, ukryt:{x,z}, trasa:[{x,z}] }`, `typ: 'matka'` = Matka). Stromy na vykúkanie: `tichaZatoka.lesneUkryty` (`{x,z,r?}`), inak sa
  nájdu uzly `strom`/`palma` cez `uzlyPri()` v `stromBlizko()`. Dočasné rozmiestnenie je funkcia `docasne()` (4 Bledí + Matka) – po dodaní A sa nepoužije.
- **Úloha B (zvuky):** adaptér je funkcia `udalost(druh, poz)` hore v `src/bledi.js`. Ak `strach.js` exportuje `udalostBledeho`, volá sa ona
  (druhy: `vykuknutie`, `plizenie`, `utok`, `zmiznutie`, `cuvanie`). Ak B pomenuje druhy inak, uprav len mapu v tej funkcii.
  Bez nej: `hororZvuk('sepot'|'kroky'|'vykrik'|'konar'|'dych')` + `pridajStrach`. Plynulý strach pri blízkom Bledom: `pridajStrach(dt*0.1*k)` v hlavnej slučke.

## Čo som sa naučil / poznámky
- `mergeGeometries` spojí viac tvarov do 1 meshu (rebrá, chrbtica, články prstov) → menej draw callov.
- Hlavná slučka je v `main.js` – Bledí sa volajú hneď za `aktualizujNepriatelov`; `noc` = 20:00–5:00 alebo dev „vynúť noc“.
- Hodina hry po načítaní závisí od uloženia – v testoch používať `hra.hodina()` a `posunCas`.
- Nevyskúšané očami: Matka v jaskyni (kód je, ale nebol pozorovaný), vykuknutie ako screenshot (v tme sa nedalo nasnímať, logika vo logu prebehla).
