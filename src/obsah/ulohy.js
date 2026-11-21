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
//   'zjedz'  - zjedz/vypi `pocet` krat
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
    { id: 'k1_kanoe', text: 'Vylepši kanoe na úroveň 2 – plachta (lodenica)', typ: 'lod', ciel: 2, pocet: 1, odmena: [['vlakno', 6], ['bambus', 4]] },
  ] },
  { id: 'k2', meno: 'Ohnivé ostrovy', popis: 'Za obzorom sa dymia sopky. Čierne sklo z nich ti dá lepšie nástroje.', ulohy: [
    { id: 'k2_pasmo', text: 'Doplávaj do pásma Sopečné ostrovy (cca 1200 m od štartu)', typ: 'pasmo', ciel: 2, pocet: 1, odmena: [['vlakno', 6]] },
    { id: 'k2_obsidian', text: 'Získaj 5 kusov obsidiánu (čierne sopečné sklo)', typ: 'mat', ciel: 'obsidian', pocet: 5, odmena: [['kamen', 6]] },
    { id: 'k2_pec', text: 'Postav kamennú pec (stavebné menu B)', typ: 'postav', ciel: 'kamenna_pec', pocet: 1, odmena: [['drevo', 10]] },
    { id: 'k2_mec', text: 'Vyrob obsidiánový meč', typ: 'vyrob', ciel: 'obsidianovy_mec', pocet: 1, odmena: [['bambus', 6]] },
    { id: 'k2_upec', text: 'Upeč na ohni ďalšie 2 jedlá', typ: 'upec', pocet: 3, odmena: [['vlakno', 8]] },
  ] },
];
