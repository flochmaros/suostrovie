# Návrh: cieľ hry – Päť majákov

Stroskotanec na súostroví. Fľaše so správami od starého moreplavca: kedysi v každom pásme svietil **maják**, ktorý krotil búrky. Majáky zhasli, more sa rozbúrilo. Cieľ: opraviť a zapáliť 5 majákov. Potom záverečná scéna (loď na obzore) – hráč môže odplávať alebo hrať ďalej (open world).

## Pásma (`pasmo(x,z)` v `src/svet.js`, vzdialenosť od štartu)
| # | Pásmo | do (m) | Materiál | Loď | Nepriatelia | Strážca majáka |
|---|---|---|---|---|---|---|
| 1 | Domovské ostrovy | 1200 | drevo, kameň, vlákno | — | nočné kraby | obrovský krab |
| 2 | Sopečné ostrovy | 2400 | **obsidián**, síra, čadič | kanoe II | lávové jaštery | lávový jašter |
| 3 | Mangrovové močiare | 3800 | živica, jedové liany | kanoe III + lano | hady, krokodíl | krokodíl |
| 4 | Búrkové útesy | 5400 | železo z vrakov, perly | katamarán / plachta | žraloky, chobotnica | kraken |
| 5 | Hmlisté ostrovy | ∞ | srdce súostrovia | kompas + mapa | kamenní strážcovia | golem |

- Vlny rastú s pásmom; slabá loď sa vo vyššom pásme prevráti.
- Zapálený maják: upokojí more v pásme, odkryje mapu, miesto prebudenia.

## Denník úloh (questbook)
Kniha s kapitolami podľa pásiem, úlohy sa plnia samy (`src/obsah/ulohy.js`), odmeny/recepty. Prvá kapitola = návod.

## Poradie práce
1. ✅ Pásma + biomy podľa vzdialenosti + obsidián a obsidiánové nástroje
2. ✅ Vlny podľa pásma + prevrátenie slabej lode
3. ✅ Denník úloh (kapitola 1–2)
4. ✅ Boj + prví nepriatelia (nočné kraby, lávový jašter)
5. ✅ Prvý maják + strážca + fľaše so správami
5b. ✅ Strážcovia 2–5 (lávový jašter, krokodíl, kraken, golem) + majáky 2–5 + zbrane z trofejí (24. 11.)
6. Ďalšie pásma

## Trofeje bossov (nápad 21. 11.)
Každý strážca dá okrem srdca (na maják) aj **trofejný materiál**, z ktorého sa vyrobí unikátna zbraň a predmet:
| Strážca | Trofej | Zbraň | Predmet |
|---|---|---|---|
| Obrovský krab | krabí pancier, obrie klepeto | **Klepetový kyj** (pomalý, veľký knockback, omráči) | **Krabia prilba** (−25 % poškodenia) |
| Lávový jašter | lávová šupina, žeravé jadro | **Žeravý meč** (podpáli nepriateľa) | **Ohnivzdorný plášť** (láva, sopka) |
| Krokodíl | krokodílí zub, koža | **Harpúna** (zatiaľ: dlhý dosah; hádzanie neskôr) | **Kožené čižmy** (rýchlejší beh v močiari) |
| Kraken | atrament, chápadlo | **Trojzubec** (bonus vo vode) | **Amulet hlbín** (dlhšie pod vodou) |
| Golem | kamenné jadro | **Runové kladivo** | **Kompas hmly** (ukáže cestu v hmle) |
