# Vlna 2 – úloha A: Ostrov Bledých (vetva horor2-a)

## Čo sa robilo
- Ostrov Tichá zátoka je ~2,5× väčší (elipsa `OS` v `ticha_zatoka.js`, `ext` 300, `MAX_EXT` 300; v okolí nie je iný ostrov).
- Nový súbor `src/ostrovy/ticha_zatoka_les.js`: 190 vysokých tmavých stromov, 34 popadaných kmeňov (dá sa preskočiť), chodníky + stopy,
  obetisko s kosťami, 2 lesné hniezda, 2 pozorovacie miesta, rozbité kanoe, svietiace huby a kostené totemy pri vchode do jaskyne.
  Rozmiestnenie je čisto matematické (`lesData`), preto ho vie použiť aj `horor_zona.js` a úloha C.
- Export pre C: `tichaZatoka.bledi` (7 Bledých: domov, ukryt, trasa), `lesneUkryty`, `obetisko`, `hniezda`, `vyhliadky`, `chodniky` – svetové x,z.
- Hmla: zrušená plošná hmla; sprity sú len v lese, nízke a plochšie. Globálna hmla pri pláži/vode len jemne stmavuje, v hustom lese je bližšia a tmavšia (`lesnost`).
- Vchod do jaskyne v noci: žiariace huby (emisívne, bloom), totemy, cesta z lesa.

## Čo som sa naučil
- Terén (výšková mapa) sa dá lokálne upraviť `lerp` k pevnej výške (plošiny pod obetiskom a hniezdami).
- Emisívny materiál + bloom stačí na „svetlo“ bez ďalšieho PointLight (počet svetiel ostáva stály).
- `hra.zona()` bez argumentu nastaví NaN a spôsobí chybu v `tlmProstredie` (len ladiaca vec).
