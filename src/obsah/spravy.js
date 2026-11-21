// Obsah: flase so spravami od stareho moreplavca (zbierajú sa na plazach, citaju sa v Denniku - J).
// Poradie = poradie flias (index 0 lezi na plazi startovacieho ostrova). Text moze obsahovat:
//   {{smer1}} {{vzd1}} - svetova strana a vzdialenost prveho majaka od startu (dosadi majak.js)
// odhal: cislo pasma, ktorého maják sa po precitani objavi na mape
export const SPRAVY = [
  { nadpis: 'Prvý list', text: 'Tretí deň na pustom ostrove. Loď sa rozbila o útesy a ja som prežil len vďaka sudu a kúsku šťastia. Píšem do fliaš a púšťam ich do mora. Ak toto čítaš, si na tom rovnako ako ja. Nazbieraj drevo a kamene, vyrob si sekeru a zapáľ oheň – noci tu bývajú dlhé a plné klepetiek.' },
  { nadpis: 'O majákoch', text: 'Starí ľudia hovorili, že v každom pásme súostrovia svietil jeden maják. Svetlo krotilo búrky – kým horelo, more bolo milosrdné. Potom lampy zhasli a vlny začali rásť. Päť majákov, päť pásiem. Ak ich zapálim všetky, možno ma ktorýsi kapitán konečne zbadá.' },
  { nadpis: 'Prvý maják', odhal: 1, text: 'Videl som ho! Prvý maják stojí na ostrove {{smer1}} od môjho tábora, asi {{vzd1}} m ďaleko. Je z neho ruina, vrch sa zrútil a okolo je lešenie. Kedysi ho udržiaval strážca. Zaznačil som ho do mapy – kreslí sa sivo, kým je zhasnutý.' },
  { nadpis: 'Strážca', text: 'Pri majáku som sa neodvážil prísť bližšie. Žije tam obrovský krab, veľký ako chata. Klepetom udiera ako kladivo, ale pred každým úderom sa zdvihne – vtedy uhni! Keď dupne, zem sa trasie okolo neho, vtedy treba odskočiť ďalej, alebo vyskočiť. Keď ho zraníš, zbesnie. Jeho srdce je jediné, čo dokáže zažať lampu.' },
  { nadpis: 'Oprava', text: 'Na opravu majáka treba 20 kusov dreva, 15 kameňov a 10 zväzkov vlákna, nad to srdce strážcu. Všetko treba vložiť priamo pri päte veže (E). Keď lampa zažne, more v tomto pásme sa upokojí a pri majáku sa budeš budiť, ak omdlieš.' },
  { nadpis: 'Čierne sklo', text: 'Ak sa ti podarí zažať prvý maják, dívaj sa na juh a východ za hranicu domovských ostrovov. Tam dymia sopky a z lávy tuhne čierne sklo – obsidián. Je tvrdšie než kameň a vyrobíš z neho meč aj sekeru. Pozor na lávové jašterice, ale ich šupiny sú cenné. Zabudni na kanoe s jednou plachtou – budeš potrebovať lepšiu loď.' },
];
