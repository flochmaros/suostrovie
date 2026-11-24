// Dalsie jedlo a napoje + doladenie hodnot existujucich. Import tohto suboru staci (side effect).
import * as THREE from 'three';
import { PREDMETY, predmet } from './predmety.js';
import { ik, PECENE, SUSENE } from '../ikony.js';

import { modelKokosovaVoda, modelKrab, modelRybaIna, modelSusOvocie, modelTaro, modelHuba, modelBanan } from './modely_predmetov.js';

// farby upecenych / ususenych variantov (pouziva modelKrab a modelRybaIna)
const KRAB_PECENY = { telo: 0xdc3a22, svetla: 0xff6a44, tmava: 0xa8200f, hrot: 0xffd9b0, brucho: 0xffc89a, oko: 0xe8d8c0 };
const RYBA_PECENA = { chrbat: 0x7a4a1c, bok: 0xc2803a, brucho: 0xe8c78a, pruh: 0xd89a30, plutva: 0x8a5a24, spicka: 0xc0803a };
const RYBA_SUSENA = { chrbat: 0x8a7a54, bok: 0xb8a070, brucho: 0xd8c8a0, pruh: 0xb8a060, plutva: 0x9a8458, spicka: 0xc8b078 };

predmet('kokosova_voda', { meno: 'Kokosová voda', ikona: ik('coconuts', '#8a5a32', ['water-drop', '#4aa8ea', .46, 290, 290]), popis: 'Čerstvá voda z otvoreného kokosu.', jedlo: { sytost: 3, voda: 40 },
  model: modelKokosovaVoda() });
predmet('vareny_krab', { meno: 'Pečený krab', ikona: ik('crab', '#e0472c', PECENE), popis: 'Upečený na táboráku. Sýty a bezpečný.', vareny: true, jedlo: { sytost: 28, voda: 2 },
  model: modelKrab(KRAB_PECENY) });
predmet('vareny_ryba', { meno: 'Pečená ryba', ikona: ik('fish-cooked', '#c9813a', PECENE), popis: 'Upečená na táboráku. Sýta a bezpečná.', vareny: true, jedlo: { sytost: 32, voda: 3, zdravie: 3 },
  model: modelRybaIna(RYBA_PECENA, 0.8) });
predmet('susene_ovocie', { meno: 'Sušené ovocie', ikona: ik('fruit-bowl', '#b0603a', SUSENE), popis: 'Usušené na sušiaku. Sladké, dobre zasýti a hojí.', jedlo: { sytost: 24, voda: 2, zdravie: 4 },
  model: modelSusOvocie() });

predmet('pecene_taro', { meno: 'Pečené taro', ikona: ik('potato', '#8a5a3a', PECENE), popis: 'Upečený koreň taro. Veľmi sýty.', vareny: true, jedlo: { sytost: 30, voda: 0, zdravie: 2 },
  model: modelTaro(true) });
predmet('pecena_huba', { meno: 'Pečená huba', ikona: ik('sliced-mushroom', '#a8703e', PECENE), popis: 'Opečená na ohni, voňavá.', vareny: true, jedlo: { sytost: 16, voda: 1 },
  model: modelHuba(true) });
predmet('peceny_banan', { meno: 'Pečený banán', ikona: ik('banana-peeled', '#d99a3a', PECENE), popis: 'Karamelovo sladký.', vareny: true, jedlo: { sytost: 24, voda: 2 },
  model: modelBanan(1, true) });

predmet('susena_ryba', { meno: 'Sušená ryba', ikona: ik('fish-corpse', '#b08850', SUSENE), popis: 'Vysušená na slnku. Sýta a ľahká, oheň netreba.', jedlo: { sytost: 30, voda: 0, zdravie: 2 },
  model: modelRybaIna(RYBA_SUSENA, 0.6) });

// co sa da upiect na taboraku: surove -> pecene (pouziva ohen.js)
export const PECENIE = { krab: 'vareny_krab', ryba: 'vareny_ryba', taro: 'pecene_taro', huba: 'pecena_huba', banan: 'peceny_banan' };
// co sa da susit na susiaku (funkcne.js)
export const SUSENIE = { ryba: 'susena_ryba', banan: 'susene_ovocie', mango: 'susene_ovocie', ananas: 'susene_ovocie' };

// doladenie existujucich (mutacia, subory predmetov sa nemenia)
const uprav = (id, j) => { if (PREDMETY[id]) PREDMETY[id].jedlo = { ...(PREDMETY[id].jedlo || {}), ...j }; };
uprav('kokos', { sytost: 8, voda: 28 });   // hlavne voda
uprav('aloe', { zdravie: 6 });             // hoji
// surove zivocichy (ak su uz registrovane) - hodnoty, vareny variant je lepsi
uprav('krab', { sytost: 16, voda: 1 });
uprav('ryba', { sytost: 20, voda: 2 });
// kazde jedlo ma cele cisla sytost/voda
for (const id in PREDMETY) {
  const j = PREDMETY[id].jedlo;
  if (j) { j.sytost = j.sytost || 0; j.voda = j.voda || 0; }
}
