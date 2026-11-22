# Hra – inštrukcie pre Claude

Vlastná 3D hra v prehliadači (PC): **open world tropické súostrovie** – nekonečne veľa náhodne generovaných ostrovov, plavba na kanoe, neskôr zbieranie, výroba, stavanie. Inšpirácia žánrom „cozy survival“ – nekopírujeme žiadnu konkrétnu hru (názov, vzhľad, mapy).

## Používateľ (rovnaký režim ako Hydrofonic Farm)
- Píše po slovensky → odpovedaj po slovensky, stručne.
- Začiatočník (Arduino). **Ty píšeš kód a git, on hrá a testuje.** Krátko vysvetli, čo kód robí – chce sa učiť.
- **Automaticky, bez pýtania:**
  1. po každom dokončenom kroku zapíš do `dennik/RRRR-MM-DD.md` (čo sa robilo, čo som sa naučil),
  2. hneď commitni (a pushni, ak má repo `git remote`).
  Nepýtaj sa „mám commitnúť?“ – len povedz, čo si urobil.

## Šetrenie tokenov
- Používaj open-source knižnice (Three.js z CDN, `three/addons`) namiesto písania vlastných.
- Čítaj súbory cielene (Grep), nie celé, ak to nie je nutné.
- Testuj cez konzolu prehliadača / text; screenshot len keď treba vidieť grafiku (zmenšený).
- Jedna väčšia funkcia = jedna session.

## Technika
- Bez buildu: `index.html` + ES moduly v `src/`, Three.js 0.160.0 cez importmap z jsDelivr.
- **Web (verejný):** https://flochmaros.github.io/suostrovie/ – repo `flochmaros/suostrovie`, GitHub Pages z vetvy `main`; každý push sa do ~1 min objaví na webe.
- Spustenie lokálne: `python server.py` v tomto priečinku (server bez cache) → http://localhost:8125 (alebo `.claude/launch.json` „hra“).
- Repo: https://github.com/flochmaros/suostrovie (GitHub Pages) – po každom commite **push**.
- Svet je deterministický zo `SEED` (`src/svet.js`): rovnaký seed = rovnaké ostrovy.

## Štruktúra
| Cesta | Obsah |
|---|---|
| `src/menu.js`, `src/sloty.js` | hlavné menu + loading, 3 sloty ukladania (slot 1 = starý kľúč) |
| `src/main.js` | štart, hlavná slučka, HUD, udalosti (úder, zber), ukladanie, `window.hra.sim()` na testy |
| `src/grafika.js` | renderer, obloha, slnko + tiene, bloom; 2 prechody (svet bez vody → textúra pre vodu) |
| `src/ocean.js` | shader vody (vlny, lom, hĺbka, pena, odlesky) + `vyskaVody(x,z,t)` (rovnaký vzorec v JS aj GLSL), príliv |
| `src/svet.js` | bunky 520 m, ostrovy + biómy, terén (kaustiky, mokrý piesok), predmety na zemi |
| `src/vegetacia.js` | rozmiestnenie rastlín podľa biómu, uzly (hitbox, životy, pád), zber plodov + dorastanie (`najdiZber`, `stavRastlin`) |
| `src/svet/modely.js` | modely rastlín kódom + materiály s vetrom |
| `src/zivocichy.js` | kraby, ryby, vtáky, motýle, korytnačka, delfín (`najdiUlovok`) |
| `src/postava.js` | model postavy (kĺby `J` používa `hrac.js`) |
| `src/nastroje.js` | poškodenie podľa nástroja, opotrebenie |
| `src/preziti.js` | hlad, smäd, zdravie, jedenie (F), omdletie |
| `src/more.js` | morské dno, koraly, riasy, vraky s pokladom, žraloky, medúzy, sudy (`najdiMorskyZber`) |
| `src/pocasie.js` | deň/noc (24 min), mesiac, hviezdy, oblaky, dážď, búrka; nastavuje `uNoc` (plankton, medúzy) a nočné farby |
| `src/noc.js` | svetlušky (volá sa z pocasie.js); svietiaci plankton je v `ocean.js` (`porucha(x,z,r)`) |
| `src/dev.js` | dev režim (F2): lietanie, teleport na biom, predmety, úroveň kanoe, hustota vegetácie, FPS |
| `src/hrac.js` | postava s kĺbmi, procedurálne animácie, pohyb, kolízie, potápanie, úder |
| `src/kamera.js` | kamera tretej osoby (rýchla, kolízia s terénom) |
| `src/ohen.js` | táborák: položenie, palivo/pahreba, plamene+dym+svetlo, pečenie (`PECENIE` v `obsah/jedlo.js`), praskanie |
| `src/kanoe.js` | lode: `DRUHY` (kanoe 4 úrovne `STATY`, pretekárske, barža, katamaran), sklad, vylepšenia, fyzika, plachta + vietor, brázda; voda v lodi + trup (`VODA`, `maxTrup`, V = vylievať, G = oprava), potopenie → sudy s nákladom (`vypustNaklad` v more.js); `stat.maska` = voda pod palubou (ocean.js) |
| `src/lode_modely.js`, `src/lodenica.js` | 3D modely nových lodí; lodenica (stavba pri vode, spúšťanie lodí) |
| `src/stavba.js` | stavanie: podlaha/stena/strecha na mriežke 2 m (F), náhľad, kolízie (`odtlacOdStien`, `vyskaPodlahy` v hrac.js), rozobratie úderom, ukladanie |
| `src/castice.js`, `src/zvuk.js` | častice; zvuky generované Web Audio (bez súborov) |
| `src/ikony.js` | ikony: `ik(tvar, farba, ...vrstvy)` → SVG (game-icons.net CC BY 3.0 + vlastné), `UI` ikony HUD, `data-ik` v HTML |
| `src/inventar.js` | batoh 32 políčok (prvých 8 = lišta), ťahanie, Shift+klik, delenie stohu, zoradenie; výroba so záložkami (Tab); stavebné menu (B) |
| `src/obsah/` | **obsah hry**: `predmety.js`, `zdroje.js` (čo dáva/čo treba), `recepty.js`, `nastroje.js` (nástroje), `vylepsenia.js` (kanoe), `zivocichy.js`, `jedlo.js`, `more.js` |
| `server.py` | lokálny server bez cache |
| `dennik/` | denník vývoja |

## Ako pridávať obsah
- Nový predmet: `predmet('id', {...})` v `src/obsah/predmety.js` (ikona, model).
- Nový recept: `recept({...})` v `src/obsah/recepty.js` – zobrazí sa v batohu sám.
- Nový zdroj (strom, kameň…): `src/obsah/zdroje.js` + druh a hustota v `src/vegetacia.js` (`DRUHY`, `BIOMY`).
- Dev režim v hre: **F2**.
- Testovanie bez hrania: v konzole `hra.sim(sekundy, ['KeyW'], ['Mys0'])`, `hra.otoc(yaw, pitch)`.

## Pracovný štýl (spätná väzba 19. 11. 2026)
- Nezastavuj po malých úlohách – rob väčšie celky poriadne a sám ich vyskúšaj v hre (screenshot), kým to nevyzerá dobre.
- Cieľ: imerzívne, trochu realistické, „satisfying“ (voda, kanoe, pocit z ovládania).
