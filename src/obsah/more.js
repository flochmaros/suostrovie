// Predmety z mora: koral, perla, hviezdica, riasa, ustrica, zlata minca, stary kompas, lano.
// (musla a drevo uz existuju v predmety.js)
import * as THREE from 'three';
import { predmet } from './predmety.js';
import { ik } from '../ikony.js';
import { modelKoral, modelPerla, modelHviezdica, modelRiasa, modelUstrica, modelMinca, modelKompas, modelLano } from './modely_predmetov.js';

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });

predmet('koral', { meno: 'Koral', ikona: ik('coral', '#ef7a6a'), popis: 'Kúsok koralu z útesu. Pekná dekorácia.',
  model: modelKoral() });
predmet('perla', { meno: 'Perla', ikona: ik('glass-ball', '#f4f0e8'), popis: 'Vzácna perla z ustrice.',
  model: modelPerla() });
predmet('hviezdica', { meno: 'Hviezdica', ikona: ik('sea-star', '#f08a3c'), popis: 'Sušená morská hviezdica.',
  model: modelHviezdica() });
predmet('riasa', { meno: 'Morská riasa', ikona: ik('algae', '#3f9a5a'), popis: 'Jedlá riasa. Slaná, ale zasýti.', jedlo: { sytost: 7, voda: 3 },
  model: modelRiasa() });
predmet('ustrica', { meno: 'Ustrica', ikona: ik('oyster', '#a7a091'), popis: 'Surová ustrica. Dá sa zjesť, niekedy skrýva perlu.', jedlo: { sytost: 9, voda: 5 },
  model: modelUstrica() });
predmet('zlata_minca', { meno: 'Zlatá minca', ikona: ik('two-coins', '#e8c43a'), popis: 'Stará minca z vraku.',
  model: modelMinca() });
predmet('stary_kompas', { meno: 'Starý kompas', ikona: ik('compass', '#c8a050'), popis: 'Mosadzný kompas z potopenej lode.', kopa: 5,
  model: modelKompas() });
predmet('lano', { meno: 'Lano', ikona: ik('rope-coil', '#c9a36a'), popis: 'Pevné lano z plávajúceho suda. Na viazanie a stavbu.',
  model: modelLano() });
