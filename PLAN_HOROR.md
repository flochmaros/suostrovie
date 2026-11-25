# Plán: Hororový ostrov + skutočná tma

Cieľ: hra ostáva cozy, ale jeden ostrov (neskôr 2–3) je **pasca**. Cez deň vyzerá ako najmilší ostrovček v súostroví,
v noci je to horor. Kontrast je celý trik – hráč nečaká, že sa bude báť.

---

## 1. Ostrov „Tichá zátoka“ (pracovný názov)
- **Zvonka cozy:** malá tyrkysová lagúna, biely piesok, ovocné stromy, hojdacia sieť, opustená chatka s rozloženým
  stolom a šálkami („niekto tu bol pred chvíľou“). Najkrajší západ slnka v hre.
- **Cez deň nič nebezpečné**, len drobnosti, ktoré si pozorný hráč všimne: žiadne vtáky ani kraby, ticho bez cvrčkov,
  dlhé úzke stopy v piesku, ktoré končia pri útese, kosti pod pieskom pri odlive, vyrezané znaky na palmách,
  zablúdené hračky/drobnosti z iných stroskotancov.
- **Jaskyne pod útesom** – tam sú cez deň Bledí. Vchod je pod vodou cez deň, **pri nočnom odlive sa otvorí**
  (máme príliv v `ocean.js` – využijeme ho).
- Poloha: pásmo 2, trochu bokom od trasy (súbor `src/ostrovy/ticha_zatoka.js` + riadok v `index.js`).

## 2. Prečo tam musíš ísť v noci (príbeh)
- Fľaša od moreplavca: *„Kľúč od majáka 2 som ukryl v jaskyni na Tichej zátoke. Vchod je otvorený len pri nočnom
  odlive. Nezostávaj tam po zotmení dlhšie, než musíš. Nezapaľuj oheň na pláži. Oni nemajú radi oheň, ale…“* (list je odtrhnutý).
- **Úloha v Denníku** (nová kapitola v `src/obsah/ulohy.js`): *„Dopláv na Tichú zátoku“* → *„Počkaj na nočný odliv“* → *„Nájdi kľúč v jaskyni“* → *„Prežij do svitania“*.
- **Zvrat:** keď vylezieš z jaskyne, **tvoje kanoe je preč** (odviazané, unášané na vode alebo rozbité na skalách).
  Musíš prežiť do rána alebo sa k nemu prebiť → hlavná hororová časť.

## 3. Bledí (ľudožrúti / mátohy)
- **Vzhľad:** neprirodzene vysokí (2,6–3 m), vychudnutí, dlhé ruky po kolená, biela/sivá koža, bez tváre alebo
  s maľovanou maskou z kosti, zhrbení. Model kódom – natiahnutá kostra z `postava.js` (dlhšie kĺby `J`), trhané animácie.
- **Správanie (stavový automat):**
  | Stav | Čo robí |
  |---|---|
  | Skrytý | deň – v jaskyni, nie sú vidieť |
  | Pozoruje | stojí na okraji tvojho svetla, nehýbe sa; keď sa otočíš, **zmizne** |
  | Plíži sa | ide za tebou mimo svetla, počuť len kroky a šepot |
  | Útok | rýchly šprint zo tmy, švihnutie pazúrmi, potom znova ustúpi do tmy |
  | Ústup | od ohňa a fakle cúvajú, zakrývajú si tvár |
- **Oheň = bezpečie, ale len dočasne:** fakľa ich drží na 6–8 m, táborák na 12 m. Palivo dochádza.
  Pri dlhom zdržaní sa začnú približovať aj ku svetlu.
- **Dajú sa zabiť?** Návrh: dajú, ale ťažko a sú ich viac – hráč by mal skôr utekať a prežiť než bojovať.
- **Žiadna krv a gore** – strach robí tma, zvuk a nečakané momenty, nie násilie.

## 4. Skutočná tma v celej hre (najdôležitejší základ)
Dnes je noc dosť svetlá (`pocasie.js`: mesiac 0,5, hemi 0,42). Zmena:
- **Mesačné fázy:** spln = vidieť obrysy (modrastá noc), nov = **takmer čierna tma**.
  Fáza sa posúva každú noc (cyklus napr. 8 nocí).
- Utlmiť `hemi` v noci na ~0,05–0,12, mesiac 0,05–0,35 podľa fázy, tmavšia hmla.
- Oblaky/búrka v noci → úplná tma, len blesky.
- **Svetlá, ktoré budú v tme vidieť:** táborák, tiki pochodne (už sú), fakľa v ruke, svetlušky, plankton, hviezdy.
- **Nastavenie v menu:** „Jas noci“ (pre ľudí s tmavým monitorom), aby to nebolo frustrujúce.
- Technicky: počet svetiel v scéne ostáva stály (ako pochodne v `stavba.js`), aby sa shadery neprekompilovávali → žiadne zaseknutia.

## 5. Fakľa do ruky
- Recept: palica + vlákno + živica/kokosové vlákno (lacná). Drží sa v ruke ako nástroj (lišta).
- **Svetlo pripevnené k ruke** + plamienok, iskry, blikanie, praskanie (Web Audio).
- **Horí ~3 min**, potom dohasína (svetlo slabne → napätie). Zhasne vo vode a v silnom daždi.
- Dá sa **zapichnúť do zeme** (dočasné svetlo) a zapáliť od nej táborák.
- Neskôr: olejová lampa (z Hliniska – hlina), svieti dlhšie.

## 6. Atmosféra a strach (to, čo robí horor)
- **Zvuk:** na ostrove v noci zmiznú cvrčky a vlny stíchnu → ticho. Potom: šepot zboku (3D zvuk), kroky v piesku,
  praskanie konárov, vzdialené klopanie na drevo, tlkot srdca pri blízkom Bledom, výkrik pri útoku. Všetko Web Audio.
- **Obraz:** hmla pri zemi, tmavšie farby, jemná vinetácia a zrnenie pri strachu, mierne rozmazanie okrajov.
- **Naskriptované momenty (jump scares, striedmo):** postava stojí v diaľke a pri ďalšom blesku je bližšie;
  fakľa začne blikať a na sekundu zhasne; niečo prebehne za tvojím chrbtom v odraze vody; dvere chatky sa zabuchnú.
- **Mierka strachu** (skrytá): rastie v tme a pri Bledých → rýchlejší dych postavy, ťažšie počuť okolie.
- **Ráno:** pri svitaní Bledí utečú do jaskýň, vtáky sa vrátia, hrá pokojná melódia → úľava. Ostrov je cez deň opäť „milý“.

## 7. Odmena
- Kľúč od majáka 2 (príbeh pokračuje), **Kostená maska** (výstroj: v tme vidíš ďalej), recept na olejovú lampu.
- Úloha v Denníku „Prežil si noc na Tichej zátoke“.

---

## Poradie práce (každá fáza = jedna session, po každej sa dá hrať a testovať)
1. **Tma + fakľa** – mesačné fázy, tmavá noc, fakľa v ruke, nastavenie jasu. *(Zmení celú hru – samostatne otestovať.)*
2. **Ostrov Tichá zátoka** – tvar, cozy vzhľad cez deň, chatka, jaskyňa s odlivom, nočná atmosféra (hmla, ticho).
3. **Bledí** – model, animácie, stavový automat, strach z ohňa, útoky.
4. **Zvuk a strach** – šepot, kroky, srdce, mierka strachu, efekty obrazu.
5. **Príbeh** – fľaša, kapitola v Denníku, zmiznuté kanoe, naskriptované momenty, odmeny, svitanie.
6. **Doladenie** – vyskúšať celú noc od začiatku do konca, upraviť strach a obtiažnosť.

## Otvorené otázky
- Môžu Bledí hráča zabiť (omdlenie → zobudíš sa na pláži bez časti vecí), alebo len vystrašiť?
- Budú sa Bledí objavovať aj inde (napr. pri nove na iných ostrovoch), alebo len na hororových ostrovoch?
- Viac hororových ostrovov neskôr (napr. hmlistý cintorín lodí, opustená dedina)?
