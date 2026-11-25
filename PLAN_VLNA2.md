# Horor – vlna 2 (spúšťa sa naplánovane 26. 11. 2026 o 12:40)

Spätná väzba používateľa po vlne 1: **zvuky sú výborné, veľmi strašidelné** – ale spúšťajú sa len ručne v F2.
Ostrov je asi **príliš malý**, chýba **les**, z ktorého by spoza stromu vykukla postava. **Hmla je divná**
(odstrániť alebo zmeniť). **V noci nie je vidieť vchod do jaskyne** – hráč by nevedel, kam ísť.
Bledí sa robia teraz, aj keď zbrane ešte nie sú hotové.

Spoločné pravidlá pre všetky úlohy:
- Prečítaj `CLAUDE.md`, `PLAN_HOROR.md` a túto úlohu. Čítaj cielene (Grep), nie celé súbory.
- Každá úloha = vlastný git worktree a vetva `horor2-<pismeno>`. Commituj na svoju vetvu, **nepushuj do main, nemerguj**.
- Denník píš do `dennik/vlna2-<pismeno>.md` (nie do denného súboru – konflikty).
- Vlastný port servera: A = 8131, B = 8132, C = 8133, D = 8134 (`PORT=<port> python server.py`, alebo konfigurácia v `.claude/launch.json`).
- Testuj konzolou (`hra.sim`, `hra.naOstrov('ticha_zatoka')`, dev F2 – „skok na polnoc“, fáza mesiaca). Screenshoty len zmenšené a len keď treba vidieť grafiku.
- Šetri tokeny: používateľ má málo týždenného limitu. Žiadne zbytočné prepisovanie fungujúceho kódu.
- Na konci krátka správa po slovensky: čo je hotové, súbory, čo má používateľ vyskúšať.

---

## A – Ostrov Bledých: väčší, s lesom, s logikou ich života (Sonnet)
Súbory: `src/ostrovy/ticha_zatoka*.js`, `src/horor_zona.js`, `src/ostrovy/index.js` (`MAX_EXT`, prípadne poloha), `SUOSTROVIE.md`.
- **Zväčši ostrov** (cca 2–3× plocha), nesmie sa prekrývať s ostatnými. Cez deň stále cozy pláž a lagúna, ale
  vnútrozemie = **hustý tmavý les** (vysoké stromy, kmene, popadané kmene, paprade), kde sa dá schovať za strom.
- **Logika života Bledých** (popíš v `SUOSTROVIE.md` pár vetami, nech to dáva zmysel):
  kde spia cez deň (jaskyňa pod útesom = hlavné hniezdo), kde jedia (skrytá jama/obetisko v lese s kosťami),
  kadiaľ chodia (vyšliapané chodníčky medzi jaskyňou, lesom a pláže – stopy), pozorovacie miesta (vysoké skaly, krivé stromy),
  zásoby/korisť (veci zo stroskotancov, rozbité kanoe). Prečo ostrov vyzerá cozy: lákajú stroskotancov (chatka je návnada).
- **Počet Bledých:** navrhni 5–7 (napr. 4 obyčajní + 1–2 „pozorovatelia“ + 1 veľký „matka/stará“ v jaskyni) a pre každého
  domovské miesto. Exportuj z `horor_zona.js` alebo ostrova: `tichaZatoka.bledi = [{ id, typ, domov:{x,z}, ukryt:{x,z}, trasa:[{x,z},...] }]`
  a `tichaZatoka.lesneUkryty = [{x,z}]` (miesta za stromami, odkiaľ môže postava vykuknúť). Bledých samotných NErob (úloha C).
- **Hmla:** zmeň nočnú hmlu tak, aby nebola „divná“ – skôr nízka plazivá hmla pri zemi a medzi stromami, nie plošná šedá stena;
  ak to nejde pekne, nahraď ju len tmou + hmlou v lese. Pláž a voda nech sú v noci čitateľné.
- **Vchod do jaskyne v noci:** hráč musí tušiť, kam ísť: napr. bledé svetielka/svietiace huby pri vchode, stopy vedúce k nemu,
  kosti a znaky na skale, slabý modrý odlesk vody pri odlive. Nie šípka – nech je to prirodzené a strašidelné.
- Test: ostrov cez deň (pekný), les v noci, vchod do jaskyne viditeľný z pláže v noci pri nove aj splne. `nastroje/ostrov.html?id=ticha_zatoka`.

## B – Automatické spúšťanie zvukov strachu (Haiku)
Súbory: `src/main.js` (riadok s `aktualizujStrach(dt, {... zona: 0 })`), `src/strach.js`.
- Za `zona: 0` dosaď `hororovaZona(stred.x, stred.z)` (export z `src/horor_zona.js`). Ticho, dron a náhodné zvuky
  (šepot, kroky, konár, klopanie) sa potom spúšťajú samé v zóne v noci – logika už je v `strach.js`, over, že funguje.
- Základný strach v zóne v noci nech rastie sám (napr. `zona × tma × 0,4`), v jaskyni viac; fakľa v ruke/táborák ho mierne znižuje
  (`horiVRuke()` z `src/fakla.js`, `najblizsiOhen` z `ohen.js`). Pri svitaní na ostrove prehrať úľavnú melódiu (zvuk už existuje).
- Cooldowny nech to nie je otravné: prvé 1–2 minúty na ostrove v noci len ticho a 1 zvuk, potom hustejšie.
- API pre Bledých: `strach.js` exportuj `udalostBledeho(druh, pozicia)` (napr. 'vykuknutie' → šok + šepot, 'utok' → výkrik + veľký šok).
- Test: konzola `hra.strachStav()` na ostrove v noci (dev skok na polnoc) – zona > 0, udalosti pribúdajú. Mimo ostrova nič.

## C – Bledí: model, animácie, správanie (Sonnet)
Súbory: nový `src/bledi.js` + `src/modely_bledych.js`, minimálne zásahy do `src/main.js` (init/update). **`hrac.js` a `nepriatelia.js`
neprepisuj** (rozrobená práca na zbraniach je v git stash a príde neskôr) – zásah hráča rob cez existujúce API zranenia
(pozri `zran` / `preziti.js`), nie cez nový bojový systém.
- **Model kódom, detailný:** 2,6–3 m, vychudnutý, dlhé ruky po kolená, dlhé prsty, biela/sivá koža (jemný subsurface/emisia v tme,
  nech je v tme len slabo viditeľný), zhrbený, bez tváre alebo s maskou z kosti, rebrá. Vlastné kĺby (vzor `src/postava.js`,
  úroveň detailu `src/modely_bossov.js`). Animácie: trhané státie (občas škubnutie hlavy), plíženie po štyroch, šprint, švih pazúrmi,
  cúvanie pred ohňom so zakrytím tváre, vykuknutie spoza stromu (len hlava a ruka na kmeni).
- **Správanie (stavový automat):** cez deň skrytí (neviditeľní v jaskyni); v noci v zóne: hliadka po trase → pozorovanie
  (stojí na okraji svetla/za stromom; keď ho hráč priamo pozoruje dlhšie, zmizne/ustúpi) → plíženie za hráčom → útok zo tmy
  (rýchly výpad, zásah, okamžitý ústup do tmy) → ústup pred fakľou (6–8 m) a táborákom (12 m). Matka v jaskyni je pomalšia a silnejšia.
- Počet a miesta: použi `tichaZatoka.bledi` / `lesneUkryty`, ak existujú (úloha A ich pridáva súbežne); inak dočasne rozmiestni
  5 Bledých v `hororovaZona > 0.6` a nech sa dajú ľahko prepojiť. Zvuky: ak existuje `udalostBledeho` (úloha B), volaj ju,
  inak `hororZvuk` + `pridajStrach` zo `strach.js`.
- Dajú sa poraziť, ale ťažko (veľa životov, úder ich odplaší) – hráč má skôr prežiť než bojovať. Žiadna krv.
- Na Tichej zátoke sa v noci nemajú rodiť obyčajné kraby: nájdi spawn a vynechaj zónu (ak je spawn v `nepriatelia.js`, pridaj len
  jednu podmienku s `hororovaZona`, nič iné tam nemeň).
- Dev F2: tlačidlo „Bledý sem“ a „Prepni AI Bledých“. Konzola `hra.bledi()` = stav.
- Test: noc na ostrove, Bledý vykukne spoza stromu, plíži sa, zaútočí, cúvne pred fakľou. FPS s 6 Bledými.

## D – Zbrane (po zlúčení A–C, Sonnet)
Rozrobená session „Animácie a modely zbraní“ bola zastavená; jej necommitnutá práca je v `git stash` s názvom
„zbrane - rozrobena session (zastavena)“ (`src/boj.js`, `src/hrac.js`, `src/main.js`, `src/obsah/nastroje.js`, `src/zvuk.js`, nový `src/obsah/modely_zbrani.js`).
- Vo vlastnom worktree z aktuálneho main: `git stash apply` toho stashu, vyrieš konflikty s hororom (zachovaj oboje), z diffu a
  denníka pochop zámer (modely zbraní, animácie útokov, kombo/silný úder) a dokonči to tak, aby to fungovalo a vyzeralo dobre.
- Over, že Bledí reagujú na zásah zbraňou (odplašenie) a fakľa v ruke funguje spolu so zbraňami.
- Stash na konci **nemaž** (zmaže ho až používateľ).

## Zlúčenie (orchestrátor)
Po A, B, C: zlúč vetvy do `main` (konflikty: zachovaj oboje; `.claude/launch.json` nech obsahuje len „hra“ a „hra-8129“; denníky
`dennik/vlna2-*.md` prilep do `dennik/2026-11-26.md` a zmaž), prepoj A↔C (pozície Bledých) a B↔C (`udalostBledeho`), over v hre,
že sa spustí bez chýb a funguje noc na ostrove, commitni a **pushni**. Potom D, znovu zlúčiť, overiť, pushnúť.
