# Vlna 1 – ostrov Tichá zátoka (fáza 2 z PLAN_HOROR.md)

## Čo sa robilo
- Nový ručný ostrov **Tichá zátoka** (pásmo 2, juhovýchod): tyrkysová lagúna s prieplavom na severozápad, biely piesok, palmy,
  bobule, kvety, na juhu útes (cca 20 m). Žiadna výhradná surovina.
- Pamiatky (všetko kódom): chatka s verandou a vnútrom, prestretý stôl (šálky, kanvica, para, horiaca sviečka, rozjedené jedlo,
  otvorený denník), prevrhnutá stolička, šnúra s bielizňou, kvitnúce stromčeky, hojdacia sieť, dlhé trojprsté stopy od stola
  po jaskyňu, vyrezané znaky na palmách, kostra a kosti v plytčine, topánka, rozbitá lampa, batoh, detská loďka.
- Jaskyňa pod útesom: chodba (cca 22 m) a komora so šálkami v kruhu, hromadou topánok, tromi dlhými lôžkami, kostenými
  zvonkohrami, znakmi na stenách, svietiacimi hubami a truhlicou vo výklenku (miesto pre kľúč od majáka 2).
- Nočný odliv: pri ostrove voda cez deň skoro nekolíše (vchod je pod hladinou), 20:00–21:30 klesne o 1,9 m, 4:30–5:45 sa vráti.
- Noc v zóne: nízka hmla, hustejšia a tmavšia hmla, tmavšie svetlo; žiadne svetlušky, kraby, vtáky, motýle (cez deň bez krabov a vtákov).
- Dev režim F2 → Teleport → „Tichá zátoka“.

## Súbory
- nové: `src/ostrovy/ticha_zatoka.js`, `ticha_zatoka_jaskyna.js`, `ticha_zatoka_modely.js`, `src/horor_zona.js`
- malé úpravy: `ostrovy/index.js`, `svet.js`, `ocean.js`, `hrac.js` (len pohyb/kolízie), `kamera.js`, `main.js`, `noc.js`,
  `zivocichy.js`, `dev.js`, `.claude/launch.json`

## Čo som sa naučil
- **Výšková mapa nevie dutinu**: terén má v každom bode len jednu výšku. Jaskyňa je preto trik z 3 vrstiev: terén sa vyreže,
  nad zárez sa položí skalná „strecha“ (dá sa po nej chodiť) a dnu je vlastný tunel s kolíziami.
- **Miestny príliv**: stačí, aby funkcia `priliv(t)` brala do úvahy, či je hráč pri ostrove. Vodu, loď aj postavu to zmení naraz.
- Rovnaký materiál = spojiť do jednej siete (`mergeGeometries`), potom sa stovky kúskov kreslia lacno.

## Otestované (v prehliadači)
- Konzola bez chýb. Náhľad zhora: bez chýb, výpočet cca 1 s.
- Skutočným ovládaním: v noci sa dá dôjsť od pláže až do komory; cez deň postava zastane pred vchodom; po streche jaskyne sa dá
  prejsť pozdĺž aj naprieč a z hrany útesu sa normálne spadne dole.
- Neotestované: plavba na kanoe do lagúny a správanie lode pri odlive, výkon počas reálneho hrania.

## Otvorené
- V noci sa na ostrove stále rodia **nepriateľské** nočné kraby (`nepriatelia.js` som nemenil).
