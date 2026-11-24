// Predmety, ktore davaju zivocichy (krab, ryba). Importuje sa zo src/zivocichy.js.
import * as THREE from 'three';
import { predmet } from './predmety.js';
import { ik } from '../ikony.js';
import { modelRyba } from './modely_predmetov.js';

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
const KRAB = mat(0xd9532b);

predmet('krab', { meno: 'Krab', ikona: ik('crab', '#d08a4a'), popis: 'Chytený na pláži. Sýty, ale treba sa predrať cez škrupinu.',
  jedlo: { sytost: 18, voda: 2 },
  model: [new THREE.SphereGeometry(0.18, 8, 6).scale(1, 0.5, 0.75).translate(0, 0.1, 0), KRAB] });
predmet('ryba', { meno: 'Ryba', ikona: ik('flatfish', '#7fa7c4'), popis: 'Čerstvá ryba z laguny.',
  jedlo: { sytost: 28, voda: 4 },
  model: modelRyba() });
