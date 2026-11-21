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
6. Ďalšie pásma
