// Dalsie jedlo a napoje + doladenie hodnot existujucich. Import tohto suboru staci (side effect).
import * as THREE from 'three';
import { PREDMETY, predmet } from './predmety.js';

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });

predmet('kokosova_voda', { meno: 'Kokosová voda', ikona: '🥥', popis: 'Čerstvá voda z otvoreného kokosu.', jedlo: { sytost: 3, voda: 40 },
  model: [new THREE.IcosahedronGeometry(0.13, 1).scale(1, 1.1, 1).translate(0, 0.14, 0), mat(0xd8c9a8)] });
predmet('vareny_krab', { meno: 'Uvarený krab', ikona: '🦀', popis: 'Upečený na ohni. Sýty a bezpečný.', vareny: true, jedlo: { sytost: 28, voda: 2 },
  model: [new THREE.SphereGeometry(0.12, 7, 5).scale(1.2, 0.5, 1).translate(0, 0.07, 0), mat(0xd24a2a)] });
predmet('vareny_ryba', { meno: 'Uvarená ryba', ikona: '🍣', popis: 'Upečená ryba. Sýta a bezpečná.', vareny: true, jedlo: { sytost: 32, voda: 3, zdravie: 3 },
  model: [new THREE.SphereGeometry(0.14, 7, 5).scale(1.8, 0.45, 0.7).translate(0, 0.06, 0), mat(0xc58a52)] });
predmet('susene_ovocie', { meno: 'Sušené ovocie', ikona: '🍇', popis: 'Vydrží dlho a dobre zasýti.', jedlo: { sytost: 15, voda: 2 },
  model: [new THREE.IcosahedronGeometry(0.08, 0).scale(1, 0.6, 1).translate(0, 0.05, 0), mat(0x6a3a4a)] });

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
