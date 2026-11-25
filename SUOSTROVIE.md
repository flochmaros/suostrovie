# Súostrovie – ručne navrhnuté ostrovy

Namiesto stoviek podobných náhodných ostrovov má každé pásmo **pár ručne navrhnutých ostrovov**, každý s vlastným tvarom,
príbehom a **surovinou, ktorá je len tam**. Medzi nimi sú už len malé **ostrovčeky** (palmy, kokosy, palice – miesto na oddych).
Za 4. pásmom (Búrkové útesy) zostáva nekonečný náhodný svet.

## Príbeh v skratke
Stroskotáš na pláži. Starý moreplavec (fľaše so správami) tu kedysi žil a pomáhal **strážcom majákov**. Jeho listy ťa vedú
ostrov po ostrove: kde si postavil chatrč (bambus), kde strážcovia pestovali ovocie, kde pálili hlinu na pece a lampy,
kde stojí prvý maják a kde stroskotala jeho loď. Každý ostrov teda **existuje z dôvodu** – v hre aj v príbehu.

## Mapa (stred štartu = 260, 260; sever = −z)
```
                       Džungľa predkov (P3, ďaleko na S)
          Perlový atol (SZ)        Šumivý háj (SV)
                   Ostrov Stroskotanca (štart)      Strážna skala (V, maják 1)        Ohnivá hora (P2, V)
          Záhrada strážcov (JZ)      Hlinisko (J)
 Krokodílí močiar (P3, Z)                       Sírne pramene (P2, J)          Tichá zátoka (P2, JV, bokom)
```

| # | Ostrov | Pásmo | Veľkosť | Len tu (výhradná surovina) | Ďalej | Príbeh / účel |
|---|---|---|---|---|---|---|
| 1 | **Ostrov Stroskotanca** | 1 | stredný | – | palmy, kokosy, palice, kamene, vlákno, pár mušlí | štart, vrak tvojej lode, 2 fľaše |
| 2 | **Šumivý háj** | 1 | stredný, kopcovitý | **bambus** | huby, papraď, svetlonosy | moreplavcova bambusová chatrč, fľaša → maják |
| 3 | **Záhrada strážcov** | 1 | veľký, hora + vodopád | **mango, banány, ananás** | bobule, taro, kvety | zarastené terasy strážcov, jedlo |
| 4 | **Hlinisko** | 1 | malý, plochý | **hlina, trstina** | akácie, taro, aloe | hlinené jamy a pec strážcov |
| 5 | **Strážna skala** | 1 | malý, vysoké útesy | veľa kameňa | aloe, prílivové jazierka | **maják 1** + Obrovský krab |
| 6 | **Perlový atol** | 1 | veľký prstenec | **mušle** (veľa) | palmy, koraly v lagúne | vrak moreplavcovej lode, poklad |
| 7 | **Ohnivá hora** | 2 | veľmi veľký | **obsidián** | lávové jaštery | sopka, (maják 2 neskôr) |
| 8 | **Sírne pramene** | 2 | stredný | **síra** | čadičové stĺpy, teplé pramene | |
| 9 | **Krokodílí močiar** | 3 | veľký, rozliaty | mangrovy | trstina, taro | kanály, (krokodíl neskôr) |
| 10 | **Džungľa predkov** | 3 | veľký | **živica** (gumovník) | obrie stromy, liany | ruiny predkov |
| 11 | **Tichá zátoka** | 2 | stredný, lagúna + útes | – (žiadna výhradná) | palmy, kokosy, bobule, kvety | cez deň najmilší ostrovček, v noci horor: pri nočnom odlive sa otvorí jaskyňa (`PLAN_HOROR.md`) |

## Postup hráča (prečo plávať ďalej)
1. Štart: sekera, oheň, kanoe I (drevo, listy, vlákno).
2. **Bambus** je len na Šumivom háji → lodenica, plachta (kanoe II), lepšie pádlo.
3. **Jedlo** pestrejšie v Záhrade (mango, banány, ananás).
4. **Hlina** z Hliniska → kamenná pec, utesnenie trupu (kanoe III).
5. **Mušle** z atolu → lastúrová sekera, rýchle lode.
6. Strážna skala → maják 1 → more sa upokojí → pásmo 2: **obsidián** a **síra**.
7. Pásmo 3: **živica** (kanoe IV – dvojtrup), mangrovy.

## Technika
- Každý ostrov = jeden súbor `src/ostrovy/<id>.js` (tvar terénu, farby, zóny vegetácie, predmety, pamiatky).
- Poloha ostrova je v `src/ostrovy/index.js` (zoznam `OSTROVY`). Rámec je v `svet.js`.
- Náhľad ostrova bez hry: `http://localhost:8125/nastroje/ostrov.html?id=<id>` (mapa zhora).
- V hre: konzola `hra.naOstrov('<id>')` = teleport.
