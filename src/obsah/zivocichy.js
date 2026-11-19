// Predmety, ktore davaju zivocichy (krab, ryba). Importuje sa zo src/zivocichy.js.
import * as THREE from 'three';
import { predmet } from './predmety.js';

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
const KRAB = mat(0xd9532b), RYBA = mat(0x8fb0c8, { roughness: 0.4, metalness: 0.2 });

predmet('krab', { meno: 'Krab', ikona: '🦀', popis: 'Chytený na pláži. Sýty, ale treba sa predrať cez škrupinu.',
  jedlo: { sytost: 18, voda: 2 },
  model: [new THREE.SphereGeometry(0.18, 8, 6).scale(1, 0.5, 0.75).translate(0, 0.1, 0), KRAB] });
predmet('ryba', { meno: 'Ryba', ikona: '🐟', popis: 'Čerstvá ryba z laguny.',
  jedlo: { sytost: 28, voda: 4 },
  model: [new THREE.SphereGeometry(0.5, 8, 6).scale(0.12, 0.17, 0.5).translate(0, 0.08, 0), RYBA] });
