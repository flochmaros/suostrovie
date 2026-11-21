// Dalsie jedlo a napoje + doladenie hodnot existujucich. Import tohto suboru staci (side effect).
import * as THREE from 'three';
import { PREDMETY, predmet } from './predmety.js';

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });

predmet('kokosova_voda', { meno: 'Kokosová voda', ikona: '🥥', popis: 'Čerstvá voda z otvoreného kokosu.', jedlo: { sytost: 3, voda: 40 },
  model: [new THREE.IcosahedronGeometry(0.13, 1).scale(1, 1.1, 1).translate(0, 0.14, 0), mat(0xd8c9a8)] });
predmet('vareny_krab', { meno: 'Pečený krab', ikona: '🦀', popis: 'Upečený na táboráku. Sýty a bezpečný.', vareny: true, jedlo: { sytost: 28, voda: 2 },
  model: [new THREE.SphereGeometry(0.12, 7, 5).scale(1.2, 0.5, 1).translate(0, 0.07, 0), mat(0xd24a2a)] });
predmet('vareny_ryba', { meno: 'Pečená ryba', ikona: '🍣', popis: 'Upečená na táboráku. Sýta a bezpečná.', vareny: true, jedlo: { sytost: 32, voda: 3, zdravie: 3 },
  model: [new THREE.SphereGeometry(0.14, 7, 5).scale(1.8, 0.45, 0.7).translate(0, 0.06, 0), mat(0xc58a52)] });
predmet('susene_ovocie', { meno: 'Sušené ovocie', ikona: '🍇', popis: 'Usušené na sušiaku. Sladké, dobre zasýti a hojí.', jedlo: { sytost: 24, voda: 2, zdravie: 4 },
  model: [new THREE.IcosahedronGeometry(0.08, 0).scale(1, 0.6, 1).translate(0, 0.05, 0), mat(0x6a3a4a)] });

predmet('pecene_taro', { meno: 'Pečené taro', ikona: '🍠', popis: 'Upečený koreň taro. Veľmi sýty.', vareny: true, jedlo: { sytost: 30, voda: 0, zdravie: 2 },
  model: [new THREE.IcosahedronGeometry(0.11, 1).scale(1, 0.85, 1).translate(0, 0.1, 0), mat(0x5a3a22)] });
predmet('pecena_huba', { meno: 'Pečená huba', ikona: '🍄', popis: 'Opečená na ohni, voňavá.', vareny: true, jedlo: { sytost: 16, voda: 1 },
  model: [new THREE.SphereGeometry(0.08, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1).translate(0, 0.08, 0), mat(0x6a4426)] });
predmet('peceny_banan', { meno: 'Pečený banán', ikona: '🍌', popis: 'Karamelovo sladký.', vareny: true, jedlo: { sytost: 24, voda: 2 },
  model: [new THREE.CylinderGeometry(0.035, 0.028, 0.24, 6).rotateZ(Math.PI / 2).translate(0, 0.04, 0), mat(0x5a3a1a)] });

predmet('susena_ryba', { meno: 'Sušená ryba', ikona: '🐠', popis: 'Vysušená na slnku. Sýta a ľahká, oheň netreba.', jedlo: { sytost: 30, voda: 0, zdravie: 2 },
  model: [new THREE.SphereGeometry(0.13, 7, 5).scale(1.8, 0.3, 0.7).translate(0, 0.05, 0), mat(0x9a6a3a)] });

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
