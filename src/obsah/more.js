// Predmety z mora: koral, perla, hviezdica, riasa, ustrica, zlata minca, stary kompas, lano.
// (musla a drevo uz existuju v predmety.js)
import * as THREE from 'three';
import { predmet } from './predmety.js';

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });

predmet('koral', { meno: 'Koral', ikona: '🪸', popis: 'Kúsok koralu z útesu. Pekná dekorácia.',
  model: [new THREE.ConeGeometry(0.1, 0.3, 5).translate(0, 0.15, 0), mat(0xf2678a)] });
predmet('perla', { meno: 'Perla', ikona: '⚪', popis: 'Vzácna perla z ustrice.',
  model: [new THREE.SphereGeometry(0.06, 10, 8).translate(0, 0.06, 0), mat(0xf4f0ee, { roughness: 0.2, metalness: 0.2 })] });
predmet('hviezdica', { meno: 'Hviezdica', ikona: '⭐', popis: 'Sušená morská hviezdica.',
  model: [new THREE.CylinderGeometry(0.14, 0.14, 0.03, 5).translate(0, 0.02, 0), mat(0xe8742c)] });
predmet('riasa', { meno: 'Morská riasa', ikona: '🌿', popis: 'Jedlá riasa. Slaná, ale zasýti.', jedlo: { sytost: 7, voda: 3 },
  model: [new THREE.SphereGeometry(0.1, 6, 3).scale(2.2, 0.15, 1).translate(0, 0.03, 0), mat(0x4f7a2a, { side: THREE.DoubleSide })] });
predmet('ustrica', { meno: 'Ustrica', ikona: '🦪', popis: 'Surová ustrica. Dá sa zjesť, niekedy skrýva perlu.', jedlo: { sytost: 9, voda: 5 },
  model: [new THREE.SphereGeometry(0.12, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 0.8), mat(0x8c8579)] });
predmet('zlata_minca', { meno: 'Zlatá minca', ikona: '🪙', popis: 'Stará minca z vraku.',
  model: [new THREE.CylinderGeometry(0.08, 0.08, 0.015, 14).translate(0, 0.01, 0), mat(0xe3b81f, { metalness: 0.8, roughness: 0.3 })] });
predmet('stary_kompas', { meno: 'Starý kompas', ikona: '🧭', popis: 'Mosadzný kompas z potopenej lode.', kopa: 5,
  model: [new THREE.CylinderGeometry(0.1, 0.1, 0.04, 14).translate(0, 0.03, 0), mat(0xb88a2c, { metalness: 0.7, roughness: 0.35 })] });
predmet('lano', { meno: 'Lano', ikona: '🪢', popis: 'Pevné lano z plávajúceho suda. Na viazanie a stavbu.',
  model: [new THREE.TorusGeometry(0.12, 0.035, 5, 12).rotateX(Math.PI / 2).translate(0, 0.04, 0), mat(0xb59a62)] });
