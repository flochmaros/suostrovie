// Obsah: majaky (cil hry - opravit a zapalit vsetkych 5). Logika a model su v src/majak.js.
// Novy maják = jeden zaznam; ostrov sa vyberie sam (deterministicky) podla pasma a `ostrov`.
//   pasmo   - pasmo (1..5), v ktorom maják stoji
//   meno    - nazov majaka
//   ostrov  - pravidlo vyberu: { minR: min. polomer ostrova, minH: min. vyska ostrova (sucho), bez: [biomy, ktore sa nehodia] };
//             vyberie sa ostrov najblizsie k startu (okrem startoveho), ktory pravidlo splna
//   potreby - [[predmet, pocet]] - co treba vlozit do majaka (E pri pate); posledny je srdce strazcu
//   strazca - id nepriatela z obsah/nepriatelia.js (boss); spawne sa, ked hrac pride k majaku
//   tlmenie - o kolko sa po zapaleni znizia vlny v pasme (nasobok, 0.4 = 40 % povodnych)
export const MAJAKY = [
  { pasmo: 1, meno: 'Maják na Strážnej skale', ostrovId: 'strazna_skala',
    ostrov: { minR: 42, minH: 5, bez: ['plytcina', 'atol', 'mangrovy'] },
    potreby: [['drevo', 20], ['kamen', 15], ['vlakno', 10], ['srdce_strazcu_1', 1]],
    strazca: 'obrovsky_krab', tlmenie: 0.4 },
  { pasmo: 2, meno: 'Maják Ohnivej hory', ostrovId: 'ohniva_hora',
    potreby: [['obsidian', 20], ['kamen', 20], ['sira', 10], ['srdce_strazcu_2', 1]], strazca: 'lavovy_obr', tlmenie: 0.4 },
  { pasmo: 3, meno: 'Maják v močiari', ostrovId: 'krokodili_mociar',
    potreby: [['drevo', 30], ['zivica', 10], ['hlina', 10], ['srdce_strazcu_3', 1]], strazca: 'obrovsky_krokodil', tlmenie: 0.4 },
  { pasmo: 4, meno: 'Maják Búrkových útesov', ostrov: { minR: 40, minH: 6, bez: ['plytcina', 'atol', 'mangrovy'] },
    potreby: [['kamen', 30], ['drevo', 30], ['perla', 5], ['srdce_strazcu_4', 1]], strazca: 'kraken', tlmenie: 0.4 },
  { pasmo: 5, meno: 'Maják v hmle', ostrov: { minR: 40, minH: 6, bez: ['plytcina', 'atol', 'mangrovy'] },
    potreby: [['kamen', 30], ['obsidian', 15], ['zivica', 10], ['perla', 5], ['srdce_strazcu_5', 1]], strazca: 'kamenny_golem', tlmenie: 0.4 },
];
