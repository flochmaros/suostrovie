# Vlna 1 – skutočná tma a fakľa (25. 11. 2026)

Fáza 1 z `PLAN_HOROR.md`.

## Čo sa robilo
**Tmavá noc**
- Mesačné fázy: cyklus 8 nocí, prvá noc je spln. Fáza sa mení napoludní (celá noc má jednu) a počíta sa z času hry, takže sa ukladá sama. Mesiac na oblohe ukazuje správny tvar.
- Spln = modrastá noc s obrysmi a tieňmi, nov = takmer čierna (hviezdy, svetlušky, plankton, ohne). Oblaky a búrka tmu ešte zhoršia, blesky ostali.
- Nastavenia (Esc) majú posuvník **Jas noci**.
- Pena na vode, biele častice peny a odraz oblohy v noci nesvietia. Nočné svetielkovanie kríkov, papradí a tara je stlmené na 12 % (v tme z nich boli modré bubliny).
- Teplé svetlo ohňa a fakle ostáva v noci teplé (predtým ho nočné farebné ladenie spravilo sivomodrým).
- Deň sa nemení: všetky nočné hodnoty sa primiešavajú len podľa premennej `noc`.

**Fakľa** (`src/fakla.js`)
- Recept: 1 palica + 2 vlákna (Tab → Nástroje).
- V ruke: blikajúce teplé svetlo, plameň, iskry, dym, praskanie, teplý odlesk na vode. Postava drží ruku zdvihnutú.
- Horí 3 minúty, posledných 35 s slabne a vypadáva, potom zmizne. V lište je ukazovateľ.
- **Odložená nehorí** (pauza): hráč si ju môže šetriť a nepríde o ňu za to, že chcel chvíľu rúbať.
- Vo vode a po 3 s silného dažďa zhasne. Zapáli sa opätovným vybratím z lišty (v suchu) alebo pri horiacom ohni.
- **F** zapichne fakľu do zeme (horí ďalej), **E** ju zoberie späť. Zapichnuté sa ukladajú.
- Pahrebu bez dreva rozfúka horiaca fakľa (E): ohňu dá 45 s, fakľu stojí 20 s.
- Svetlo nevrhá tieň: tieň bodového svetla znamená 6 ďalších kreslení sveta za snímku.

**Dev režim (F2 → Svet):** fáza mesiaca, polnoc / poludnie / súmrak, počasie.

## Čo sa dá naučiť
- **Environment mapa:** takmer celé nočné svetlo nešlo z mesiaca, ale z „odrazov oblohy“. Bez nej mala zem jas 0, s ňou 70. Samotné stlmenie svetiel by nepomohlo, treba stlmiť aj oblohu, z ktorej sa mapa počíta.
- **Stály počet svetiel:** pri zmene počtu svetiel musí grafická karta prekompilovať shadery a hra sa sekne. Preto 3 svetlá fakieľ (1 v ruke, 2 zapichnuté) existujú od štartu a vypnuté majú intenzitu 0. Zapichnutých fakieľ môže byť viac, svietia len 2 najbližšie.
- **Vlastný shader vody** bodové svetlá nevidí, preto dostáva polohu a farbu fakle zvlášť.

## Pre toho, kto bude vetvy spájať
- `src/grafika.js`: zmenené len nočné farebné ladenie (premenná `teplo`). Vetva horor-zvuky upravuje ten istý shader.
- `src/hrac.js`: iba póza ruky s fakľou a `h.nesieFaklu`, logika útoku sa nemenila.
- `src/zvuk.js`: nový blok na konci súboru (`fakla`, `zvuky.faklaZapal/faklaZhasne`).
- Pre ďalšie fázy: `fazaMesiaca()` (0 nov … 0.5 spln), `svitMesiaca()` (0..1), `tmaNoci()` (0..1) v `pocasie.js`; `horiaceFakle()` (polohy a sila) a `horiVRuke()` vo `fakla.js`.

## Overené / neoverené
- Overené v prehliadači: deň, spln, štvrť, nov, nov s fakľou, nov pri táboráku, voda, dážď, dohorenie, zapichnutie a zobratie, pahreba, uloženie, Jas noci, konzola bez chýb, rovnaký počet svetiel (11) aj shaderov (72) bez fakle a s ňou.
- Neoverené: zvuk fakle (nepočul som ho), FPS na reálnom hraní, fakľa v sede v kanoe. Ďalšie testovanie som ukončil na žiadosť používateľa.
