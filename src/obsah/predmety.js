// Register predmetov. Novy predmet = jedno volanie predmet('id', {...}).
// model: [geometria, material] pre predmet lezaci na zemi / v ruke (spodok na y = 0)
import * as THREE from 'three';

export const PREDMETY = {};
export function predmet(id, def) { PREDMETY[id] = { id, kopa: 20, popis: '', ...def }; }

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
const DREVO = mat(0x8a6240), KAMEN = mat(0x8f8c86), KOKOS = mat(0x5b3b1f), MUSLA = mat(0xf1d2bf, { roughness: 0.45 });

predmet('drevo', { meno: 'Drevo', ikona: '🪵', popis: 'Poleno zo zoťatého stromu.',
  model: [new THREE.CylinderGeometry(0.12, 0.14, 0.9, 7).rotateZ(Math.PI / 2).translate(0, 0.13, 0), DREVO] });
predmet('palica', { meno: 'Palica', ikona: '🥢', popis: 'Suchá palica.',
  model: [new THREE.CylinderGeometry(0.035, 0.05, 1.1, 5).rotateZ(Math.PI / 2).translate(0, 0.05, 0), DREVO] });
predmet('kamen', { meno: 'Kameň', ikona: '🪨', popis: 'Hodí sa na nástroje.',
  model: [new THREE.IcosahedronGeometry(0.16, 0).scale(1, 0.7, 1).translate(0, 0.1, 0), KAMEN] });
predmet('kokos', { meno: 'Kokos', ikona: '🥥', popis: 'Jedlo aj pitie.',
  model: [new THREE.IcosahedronGeometry(0.15, 1).scale(1, 1.15, 1).translate(0, 0.16, 0), KOKOS] });
predmet('musla', { meno: 'Mušľa', ikona: '🐚', popis: 'Pekná mušľa z pláže.',
  model: [new THREE.ConeGeometry(0.09, 0.15, 7).rotateX(-1.3).translate(0, 0.07, 0), MUSLA] });
predmet('list', { meno: 'Palmový list', ikona: '🌿', popis: 'Na strechy a vlákno.' });
predmet('vlakno', { meno: 'Vlákno', ikona: '🧶', popis: 'Z kríkov, na viazanie.' });
