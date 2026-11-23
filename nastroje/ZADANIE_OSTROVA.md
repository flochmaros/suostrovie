# Zadanie pre tvorcu ostrova (spoločné pre všetky ostrovy)

Hra: 3D prehliadačová hra (Three.js 0.160, bez buildu) – „cozy survival“ na tropickom súostroví, štýl teplý, sýty, trochu rozprávkový
(low-poly modely s farbami vo vrcholoch). Namiesto náhodných ostrovov má každé pásmo pár **ručne navrhnutých ostrovov**.
Celkový návrh, príbeh a ktorá surovina je kde: `SUOSTROVIE.md`. Rámec je hotový – ty píšeš **len súbory svojich ostrovov**.

## Čo smieš meniť
- **Iba** `src/ostrovy/<tvoj_id>.js` (súbor už existuje ako dočasný – celý ho prepíš). Žiadne iné súbory, žiadny git commit.
- API súboru je popísané v hlavičke `src/ostrovy/index.js` (prečítaj ju celú). Pomocné funkcie `P` sú v `src/ostrovy/pomoc.js`.
- `ext` musí byť ≤ `MAX_EXT[id]` v `index.js`. Súradnice v súbore sú lokálne (0,0 = stred), sever = −z, výška 0 = hladina.

## Terén – na čo dať pozor
- Príliv je ±0,6 m: pláž nech plynulo stúpa od −2 m do +1,5 m (široká pláž = pozvoľný sklon). Voda je globálna rovina na y≈0;
  vnútrozemské jazierka/vodopády musíš spraviť ako modely v `pamiatky` (priehľadná rovina).
- Na okraji štvorca (`ext`) nech je terén hlboko (< −12 m); rámec ho na posledných 18 % zmieša s morským dnom.
- Kanoe potrebuje hĺbku aspoň −0,8 m; prístupová zátoka/pláž smerom k štartu (stred štartu je vo svete (260, 260)) je dobrá vec.
- `vyska()` sa volá státisíce krát: max. ~6–8 volaní `noise` na bod (fbm s okt 3 = 3 volania). Náhľad ukazuje čas – cieľ < 1500 ms.
- Ostrov má mať **charakter**: jasná silueta (kopce, útesy, zátoky, kosy), rôzne časti (pláž, les, lúka, skaly…), nie len kopček.

## Vegetácia
- Zóny: `vegetacia: { zony: { plaz: {palma: 0.8, trava: 6}, les: {...} }, zona(x, z, h, P) { return 'les'; } }`.
  Hustota = pokusov na 100 m² (palma 0.9 = hustý háj, strom 0.9 = les, trava 15–35 = lúka, balvan 0.1–0.8, papradie do 1.6).
- Každý druh má aj vlastné limity výšky/sklonu (`PRAVIDLA` vo `src/vegetacia.js`, napr. palma 0,8–10 m, mangrova −0,9–1,1 m,
  trstina 0,15–2,2 m, taro 0,1–3 m, hlina 0,6–12 m so sklonom < 0,6, strom od 2,5 m) – zóny im daj tam, kde môžu rásť.
- Pod korunami sa automaticky pridá podrast (len druhy, ktoré daná zóna má) a liany.
- **Výhradné suroviny** – v pásmach 1–3 smú byť LEN na tomto ostrove (inde ich NEPOUŽI):
  bambus → sumivy_haj · mango, banan, ananas → zahrada · hlina → hlinisko · trstina → hlinisko a krokodili_mociar ·
  obsidian → ohniva_hora · sira → sirne_pramene · gumovnik → dzungla_predkov · mangrova → krokodili_mociar (pár aj hlinisko) ·
  predmet musla vo väčšom množstve → perlovy_atol (inde max. pár kusov v `predmety.pevne`) · taro → zahrada, hlinisko, mociar.
- Bežné všade: palma, strom, akacia, ker, bobule, ibistek, aloe, papradie, huba, kvet, monstera, hibiskus, spiral, svetlonos, trava,
  kamienky, balvan. Drevo, vlákno (tráva) a kameň musí byť na každom ostrove aspoň trochu.

## Pamiatky (3D modely)
- `pamiatky(P)` vráti `{ objekty: [...], kolizie: [[x, z, r], ...] }`. `P.THREE` = Three.js, `P.mat(farba, {…})` = materiál
  (cache), `P.vyska(x, z)` = výška terénu. Modely umiestňuj v lokálnych súradniciach (y = P.vyska + niečo).
- Low-poly, sýte teplé farby, žiadne textúry ani súbory. Max ~150 sietí na ostrov; opakované kusy (kmene, kamene, dosky) cez
  `THREE.InstancedMesh` alebo `mergeGeometries` (smieš importovať `import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';`
  a `import * as THREE from 'three';` – funguje v hre aj v náhľade).
- Kolízie: kruhy pre steny, stĺpy, veľké kamene (hráč ani loď cez ne neprejdú). Interiér chatrče nech je prístupný.
- Svetielkujúce veci: `emissive` + `emissiveIntensity` (scéna má bloom).
- Pamiatky musia sedieť do príbehu (pozri `SUOSTROVIE.md` a texty fliaš v `src/obsah/spravy.js`).

## Testovanie
- Server beží: náhľad zhora `http://localhost:8125/nastroje/ostrov.html?id=<id>` (mapa výšok, zóny ako farebné bodky, značky
  majáka/fliaš/štartu, pôdorys pamiatok, kolízie, plocha zón, čas výpočtu, chyby). Celé súostrovie: `?id=vsetky`.
- Používaj vstavaný prehliadač (nástroje `mcp__Claude_Browser__*`): **otvor si vlastnú kartu** (`tabs_create`, potom `navigate`
  s jej `tabId`) a pracuj len v nej – iní agenti pracujú v iných kartách. Na čítanie stačí `get_page_text`; screenshot zmenšený
  (`scale: 0.5`). Nespúšťaj celú hru (index.html) – 3D kontrolu v hre urobí hlavný agent.
- Iteruj, kým ostrov nevyzerá dobre: zaujímavý tvar, rozumná plocha súše, zóny pokrývajú čo majú, žiadne chyby, čas < 1500 ms.
- Na konci zatvor svoju kartu (`tabs_close`) a napíš krátku správu: čo je na ostrove, kde sú pamiatky, súradnice dôležitých miest.
