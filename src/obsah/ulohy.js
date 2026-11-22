// Obsah Dennika uloh: kapitoly podla pasiem. Ulohy sa plnia same (logika v src/ulohy.js).
// uloha = { id, text, typ, ciel, pocet, odmena: [[predmet, n], ...] }
// typy:
//   'mat'    - maj v batohu `pocet` kusov predmetu `ciel`
//   'vyrob'  - vyrob predmet/recept `ciel` (id vysledku alebo receptu)
//   'postav' - postav stavbu typu `ciel` (podlaha, stena, kamenna_pec...)
//   'pasmo'  - dostan sa do pasma `ciel` (1..5)
//   'lod'    - nejaka tvoja lod ma uroven >= `ciel`
//   'ohen'   - poloz taborak (pocet kusov)
//   'upec'   - upec jedlo na ohni (pocet kusov)
//   'zabi'   - poraz `pocet` nepriatelov druhu `ciel` (id z obsah/nepriatelia.js)
//   'zjedz'  - zjedz/vypi `pocet` krat
//   'sprava' - najdi a precitaj `pocet` flias so spravou
//   'majak_blizko' - dostan sa do 30 m od majaka pasma `ciel`
//   'majak'  - zapal maják pasma `ciel`
// Nezname id predmetu v odmene sa preskoci (nespadne).
export const KAPITOLY = [
  { id: 'k1', meno: 'Stroskotanec', popis: 'Prežiť prvé dni na pustom ostrove.', ulohy: [
    { id: 'k1_drevo', text: 'Nazbieraj 10 kusov dreva (udieraj do stromov)', typ: 'mat', ciel: 'drevo', pocet: 10, odmena: [['vlakno', 3]] },
    { id: 'k1_kamen', text: 'Pozbieraj 5 kameňov zo zeme alebo z balvanov', typ: 'mat', ciel: 'kamen', pocet: 5, odmena: [['palica', 2]] },
    { id: 'k1_sekera', text: 'Vyrob si kamennú sekeru (Tab → Nástroje)', typ: 'vyrob', ciel: 'kamenna_sekera', pocet: 1, odmena: [['drevo', 4]] },
    { id: 'k1_ohen', text: 'Vyrob a polož táborák (vyber ho z lišty a stlač F)', typ: 'ohen', pocet: 1, odmena: [['drevo', 4]] },
    { id: 'k1_upec', text: 'Upeč niečo na táboráku (surové jedlo polož na oheň – E)', typ: 'upec', pocet: 1, odmena: [['kokos', 2]] },
    { id: 'k1_zjedz', text: 'Zjedz alebo vypi niečo (vyber jedlo a stlač F)', typ: 'zjedz', pocet: 1, odmena: [['banan', 2]] },
    { id: 'k1_podlaha', text: 'Postav podlahu (stavebné menu B)', typ: 'postav', ciel: 'podlaha', pocet: 1, odmena: [['list', 6]] },
    { id: 'k1_bambus', text: 'Doplávaj na Šumivý háj (severovýchod) a nazbieraj 10 bambusu – inde nerastie', typ: 'mat', ciel: 'bambus', pocet: 10, odmena: [['vlakno', 4]] },
    { id: 'k1_kanoe', text: 'Vylepši kanoe na úroveň 2 – plachta (lodenica)', typ: 'lod', ciel: 2, pocet: 1, odmena: [['vlakno', 6], ['musla', 2]] },
    { id: 'k1_sprava', text: 'Nájdi fľašu so správou (na pláži štartovacieho ostrova) a prečítaj ju', typ: 'sprava', pocet: 1, odmena: [['kokos', 2]] },
    { id: 'k1_majak', text: 'Nájdi prvý maják (priplávaj do 30 m od neho; smer je v správe z fľaše)', typ: 'majak_blizko', ciel: 1, pocet: 1, odmena: [['palica', 4]] },
    { id: 'k1_krab', text: 'Poraz Obrovského kraba – strážcu majáka (uhýbaj pred nápřahom, pri dupote odstúp)', typ: 'zabi', ciel: 'obrovsky_krab', pocet: 1, odmena: [['banan', 4]] },
    { id: 'k1_kyj', text: 'Z trofejí strážcu vyrob Klepetový kyj (Tab → Nástroje; Krabiu prilbu nájdeš vo Výstroji)', typ: 'vyrob', ciel: 'klepetovy_kyj', pocet: 1, odmena: [['vlakno', 4], ['drevo', 4]] },
    { id: 'k1_zapal', text: 'Zapáľ prvý maják (E pri päte: vlož 20 dreva, 15 kameňa, 10 vlákna a srdce strážcu)', typ: 'majak', ciel: 1, pocet: 1, odmena: [['vlakno', 8], ['kamen', 8]] },
  ] },
  { id: 'k2', meno: 'Ohnivé ostrovy', popis: 'Maják svieti a more je pokojnejšie. Za obzorom sa dymia sopky. Čierne sklo z nich ti dá lepšie nástroje.', ulohy: [
    { id: 'k2_pasmo', text: 'Doplávaj do pásma Sopečné ostrovy (cca 1200 m od štartu)', typ: 'pasmo', ciel: 2, pocet: 1, odmena: [['vlakno', 6]] },
    { id: 'k2_obsidian', text: 'Získaj 5 kusov obsidiánu (čierne sopečné sklo)', typ: 'mat', ciel: 'obsidian', pocet: 5, odmena: [['kamen', 6]] },
    { id: 'k2_hlina', text: 'Na Hlinisku (juh domovských ostrovov) vykop 6 hliny', typ: 'mat', ciel: 'hlina', pocet: 6, odmena: [['kamen', 4]] },
    { id: 'k2_pec', text: 'Postav kamennú pec z kameňa a hliny (stavebné menu B)', typ: 'postav', ciel: 'kamenna_pec', pocet: 1, odmena: [['drevo', 10]] },
    { id: 'k2_mec', text: 'Vyrob obsidiánový meč', typ: 'vyrob', ciel: 'obsidianovy_mec', pocet: 1, odmena: [['bambus', 6]] },
    { id: 'k2_jastery', text: 'Poraz 3 lávové jaštery (uhýbaj počas ich nápřahu, meč pomôže)', typ: 'zabi', ciel: 'lavovy_jaster', pocet: 3, odmena: [['jasterie_supiny', 2], ['kamen', 4]] },
    { id: 'k2_upec', text: 'Upeč na ohni ďalšie 2 jedlá', typ: 'upec', pocet: 3, odmena: [['vlakno', 8]] },
  ] },
];
