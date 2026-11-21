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
  { pasmo: 1, meno: 'Maják Domovských ostrovov',
    ostrov: { minR: 42, minH: 5, bez: ['plytcina', 'atol', 'mangrovy'] },
    potreby: [['drevo', 20], ['kamen', 15], ['vlakno', 10], ['srdce_strazcu_1', 1]],
    strazca: 'obrovsky_krab', tlmenie: 0.4 },
  // sablony pre dalsie pasma (dopln, ked bude hotovy strazca a srdce):
  // { pasmo: 2, meno: 'Maják Sopečných ostrovov', ostrov: { minR: 40, minH: 8, bez: [] },
  //   potreby: [['obsidian', 20], ['kamen', 20], ['sira', 10], ['srdce_strazcu_2', 1]], strazca: 'lavovy_obr', tlmenie: 0.4 },
  // { pasmo: 3, ... krokodil },  { pasmo: 4, ... kraken },  { pasmo: 5, ... golem },
];
