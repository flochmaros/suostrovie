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
- Spustenie: `python -m http.server 8125` v tomto priečinku → http://localhost:8125 (alebo `.claude/launch.json` „hra“).
- Komentáre v kóde po slovensky bez diakritiky; názvy premenných môžu byť slovensky.
- Svet je deterministický zo `SEED` (`src/svet.js`): rovnaký seed = rovnaké ostrovy.

## Štruktúra
| Cesta | Obsah |
|---|---|
| `src/main.js` | štart, hlavná slučka, kamera, HUD |
| `src/svet.js` | generovanie ostrovov po bunkách (nekonečný svet), `vyskaTerenu(x,z)` |
| `src/ocean.js` | oceán s vlnami (shader) + `vyskaVody(x,z,t)` – rovnaký vzorec v JS aj GLSL |
| `src/hrac.js` | hráč pešo (chôdza, skok, plávanie, potápanie) + procedurálne animácie |
| `src/kanoe.js` | fyzika kanoe, plachta + vietor, brázda |
| `src/vstup.js` | klávesnica a myš |
| `src/inventar.js` | batoh 24 políčok, lišta 1–8 (Tab) |
| `dennik/` | denník vývoja |
