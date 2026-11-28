# 2026-11-27 – štýl „tyrkysové more“ a 3D výrobná podložka

## Čo sa urobilo
- **Nový štýl UI**: namiesto hnedého dreva priesvitné morské sklo (tyrkys, hlboká modrá, piesok), zaoblené rohy, rozmazané pozadie,
  koralové hlavné tlačidlá, biele ikony HUD. Nadpisy sú v písme Baloo 2. Papierová mapa ostala, zmenil sa rám, titul a legenda.
  Staré mená premenných (`--drevo`, `--pergamen`…) ostali a majú nové farby.
- **Manuálna výroba** (batoh → Výroba): rohož z palmových listov v 3D.
  - Klik alebo ťahanie položí surovinu (padne, odrazí sa, ťukne). `Shift`+klik položí všetky. Klik na položený kus ho vráti.
  - Podložka pozná recept podľa presných množstiev: ukáže názov, priesvitný „duch“ výsledku a kúsky žiaria. Inak napíše, čo pridať.
  - Podržanie „Vyrobiť“: kúsky sa zletia, točia, tri údery s iskrami, záblesk, výsledok vyskočí a odletí. Suroviny sa minú **až na konci**
    (keď okno zavrieš skôr, nič sa nestratí).
  - Kniha receptov vpravo: klik na recept suroviny poskladá sám. Fungujú ×1 / ×5 / max a funguje aj v lodenici.
  - **Objavovanie**: kyj, bambusový a kamenný oštep, lastúrová sekera a obsidiánový meč sa už neodomknú samy (`objav: true`
    v `obsah/recepty.js`). Objavíš ich správnou kombináciou na podložke, príde oslava s lúčmi a zvukom.
    Čo už máš odomknuté v uloženej hre, ostáva.
- Stavebné menu (B) je zladené so štýlom, minimapa sa pod otvoreným oknom skryje.

## Súbory
- `src/podlozka.js` – len 3D scéna a animácie. `src/vyroba.js` – suroviny, rozpoznanie receptu, kniha, podržanie tlačidla.
- `src/ui/tema.css`, `vyroba.css`, `pauza.css`, `mapa.css`, štýly HUD v `index.html`.

## Čo som sa naučil
- Druhá malá Three.js scéna môže kresliť modely z hry. Materiály treba **skopírovať**, inak by žiara svietila aj vo svete.
- Rozpoznanie receptu je porovnanie dvoch zoznamov „surovina → počet“.
- Dve animácie nesmú naraz hýbať tým istým kusom (pád prepisoval animáciu výroby, po záblesku kusy ostávali na rohoži).

## Neoverené
- Skúšané v náhľadovom paneli, ktorý beží na ~2 FPS (animáciu som posúval ručne cez `posunCas`). Plynulosť, pocit z animácie
  a zvuky treba vyskúšať v bežnom prehliadači.
- Postavenie lode v lodenici cez podložku (okno sa otvorí, loď som nestaval).
