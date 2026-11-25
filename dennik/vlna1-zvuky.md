# Vlna 1 – zvuk a strach (fáza 4 z PLAN_HOROR.md)

## Čo sa robilo
- **`src/strach.js`** – „mierka strachu“ 0 až 1. Rýchlo narastie, pomaly opadá. V hororovej zóne v noci
  stíchnu cvrčky, vlny, vietor aj veselá hudba a občas sa ozve konár, klopanie, kroky alebo šepot
  (čím väčší strach, tým častejšie a bližšie; to isté nikdy dvakrát po sebe). Pri strachu bije srdce,
  hrá dron, postava rýchlejšie dýcha. Po noci v zóne zaznie pri svitaní pokojná melódia a strach zmizne.
- **`src/strach_zvuky.js`** – 9 zvukov bez súborov: šepot, kroky, konár, klopanie, srdce, výkrik, dých, dron, svitanie.
- **`src/zvuk.js`** – `tlmProstredie(k)` a `zvukovyKontext()`.
- **`src/grafika.js`** – efekt obrazu: vinetácia, zrnenie, odfarbenie, rozmazané okraje, pulz so srdcom. Pri strachu 0 je vypnutý.
- **F2 → záložka Strach**, v konzole `hra.strach(0.7)`, `hra.zona(1)`, `hra.hororZvuk('sepot')`.
- Server: konfigurácia `hra-zvuky` (port 8128).

## API (pre Bledých a ostrov)
| Funkcia | Čo robí |
|---|---|
| `nastavStrach(0..1)` | trvalá úroveň (napr. podľa vzdialenosti Bledého); 0 zruší aj ľak |
| `pridajStrach(dx)` | ľak, sám vyprchá (0,04 za sekundu); záporné číslo ukľudní |
| `nastavZonu(0..1)` | ručná zóna (dev) |
| `aktualizujStrach(dt, {hracPoz, kamera, hrac, noc, zona})` | volá `main.js`; vráti `{strach, pulz}` pre `g.nastavStrachObrazu` |
| `hororZvuk(druh, pozicia?, sila?, {ciel, perioda, veta}?)` | prehrá zvuk; bez pozície si ju zvolí sám |
| `stavStrachu` | aktuálne hodnoty (`strach`, `zona`, `ticho`) |

**Napojenie:** v `src/main.js` nahradiť `zona: 0` za `zona: hororovaZona(stred.x, stred.z)`.
Útok Bledého: `hororZvuk('vykrik', poziciaBledeho); pridajStrach(0.4);`

## Overené
- Konzola bez chýb. Každý zvuk vykreslený cez `OfflineAudioContext`: bez chybných hodnôt, uzly po dohraní 0.
- V hre: všetkých 9 zvukov naživo 460 → 0 uzlov; po upokojení 0 hlasov a 0 uzlov, dron sa zruší.
- Za 120 s v tichu pri strachu 0 prišli 4 udalosti. Melódia pri svitaní sa spustila a vynulovala strach.
- Obraz pri 0 / 0,5 / 1 cez screenshot.
- Po vyladení hlasitostí sú špičky pod hranicou orezania: výkrik 0,75, šepot 0,65, konár 0,55, kroky 0,19.
- Opravené: ako „noc“ sa berie `uNoc` (blesk ho nemení), inak mohla búrka falošne spustiť melódiu svitania.
- **Neoverené:** ako zvuky naozaj znejú (treba počúvať, najlepšie so slúchadlami).
  Napojenie na ostrov a Bledých ešte neexistuje. Výkon efektu obrazu som nemeral.

## Čo som sa naučil
- Šepot sa dá vyrobiť zo šumu: tri úzke filtre (formanty) napodobnia tvar úst, krátke šumy sú spoluhlásky.
- `PannerNode` (HRTF) umiestni zvuk do priestoru; „poslucháča“ treba dať do hlavy postavy a otočiť podľa kamery.
- Aby nevznikali úniky pamäte, každý zvuk si pamätá svoje uzly a po dohraní ich odpojí.
- Prechod postprocessu sa dá vypnúť (`enabled = false`), potom nič nestojí.
