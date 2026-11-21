// Register predmetov. Novy predmet = jedno volanie predmet('id', {...}).
// model: [geometria, material] pre predmet lezaci na zemi / v ruke (spodok na y = 0)
// jedlo: { sytost, voda } - o kolko predmet zasyti / zavlazi pri zjedeni
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ik } from '../ikony.js';

export const PREDMETY = {};
export function predmet(id, def) { PREDMETY[id] = { id, kopa: 20, popis: '', ...def }; }

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
const matV = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, ...o });
const DREVO = mat(0x8a6240), KAMEN = mat(0x8f8c86), KOKOS = mat(0x5b3b1f), MUSLA = mat(0xf1d2bf, { roughness: 0.45 });
const MAT_V = matV();

// geometria s jednou farbou vo vrcholoch (kvoli spajaniu viac farieb do jedneho modelu)
function fv(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const spoj = (...g) => mergeGeometries(g);

predmet('drevo', { meno: 'Drevo', ikona: ik('log', '#b07a45'), popis: 'Poleno zo zoťatého stromu.',
  model: [new THREE.CylinderGeometry(0.12, 0.14, 0.9, 7).rotateZ(Math.PI / 2).translate(0, 0.13, 0), DREVO] });
predmet('palica', { meno: 'Palica', ikona: ik('wood-stick', '#c9a06a'), popis: 'Suchá palica.',
  model: [new THREE.CylinderGeometry(0.035, 0.05, 1.1, 5).rotateZ(Math.PI / 2).translate(0, 0.05, 0), DREVO] });
predmet('kamen', { meno: 'Kameň', ikona: ik('rock', '#a19d95'), popis: 'Hodí sa na nástroje.',
  model: [new THREE.IcosahedronGeometry(0.16, 0).scale(1, 0.7, 1).translate(0, 0.1, 0), KAMEN] });
predmet('obsidian', { meno: 'Obsidián', ikona: ik('crystal-growth', '#56487e'), popis: 'Čierne sopečné sklo, ostré ako britva.',
  model: [spoj(fv(new THREE.ConeGeometry(0.09, 0.3, 5).rotateZ(0.5).translate(0, 0.14, 0), 0x15181c), fv(new THREE.ConeGeometry(0.07, 0.2, 4).rotateZ(-0.6).translate(0.08, 0.08, 0.03), 0x1d2228)), matV({ roughness: 0.1, metalness: 0.35 })] });
predmet('sira', { meno: 'Síra', ikona: ik('ore', '#e8d040'), popis: 'Žltá hrudka z kráteru.',
  model: [new THREE.IcosahedronGeometry(0.11, 0).scale(1, 0.7, 1).translate(0, 0.08, 0), mat(0xe3c92a, { roughness: 0.6 })] });
predmet('kokos', { meno: 'Kokos', ikona: ik('coconuts', '#8a5a32'), popis: 'Jedlo aj pitie.', jedlo: { sytost: 10, voda: 30 },
  model: [new THREE.IcosahedronGeometry(0.15, 1).scale(1, 1.15, 1).translate(0, 0.16, 0), KOKOS] });
predmet('musla', { meno: 'Mušľa', ikona: ik('spiral-shell', '#f2cdb5'), popis: 'Pekná mušľa z pláže.',
  model: [new THREE.ConeGeometry(0.09, 0.15, 7).rotateX(-1.3).translate(0, 0.07, 0), MUSLA] });
predmet('list', { meno: 'Palmový list', ikona: ik('monstera-leaf', '#5fae4c'), popis: 'Na strechy a vlákno.',
  model: [new THREE.SphereGeometry(0.1, 6, 3).scale(3.2, 0.12, 1).translate(0, 0.03, 0), mat(0x4f8a35, { side: THREE.DoubleSide })] });
predmet('vlakno', { meno: 'Vlákno', ikona: ik('herbs-bundle', '#d6c08a'), popis: 'Z kríkov a trávy, na viazanie.',
  model: [new THREE.TorusGeometry(0.1, 0.03, 5, 10).rotateX(Math.PI / 2).translate(0, 0.04, 0), mat(0xc2ae6a)] });

// ---- nove suroviny a jedlo z rastlin ----
predmet('bambus', { meno: 'Bambus', ikona: ik('bamboo', '#a5c75a'), popis: 'Pevný a ľahký. Na stavbu a nástroje.',
  model: [spoj(fv(new THREE.CylinderGeometry(0.05, 0.055, 1.2, 6), 0xb8b84a), fv(new THREE.CylinderGeometry(0.062, 0.062, 0.04, 6).translate(0, 0.2, 0), 0x6f8a2e),
    fv(new THREE.CylinderGeometry(0.062, 0.062, 0.04, 6).translate(0, -0.3, 0), 0x6f8a2e)).rotateZ(Math.PI / 2).translate(0, 0.06, 0), MAT_V] });
predmet('bobule', { meno: 'Bobule', ikona: ik('elderberry', '#6a6ad0'), popis: 'Sladké lesné bobule.', jedlo: { sytost: 6, voda: 8 },
  model: [spoj(...[[0, 0], [0.07, 0.03], [-0.04, 0.07], [0.02, -0.07], [-0.07, -0.03]].map(([x, z], i) =>
    fv(new THREE.IcosahedronGeometry(0.05, 0).translate(x, 0.05, z), i % 2 ? 0x3b46c0 : 0xc2283a))), MAT_V] });
predmet('banan', { meno: 'Banán', ikona: ik('banana', '#f2d34a'), popis: 'Sýty a sladký.', jedlo: { sytost: 18, voda: 4 },
  model: [spoj(...[-0.06, 0, 0.06].map(z => fv(new THREE.CylinderGeometry(0.035, 0.028, 0.24, 6).rotateZ(Math.PI / 2 - 0.15).translate(0, 0.04, z), 0xe8c52a))), MAT_V] });
predmet('mango', { meno: 'Mango', ikona: ik('kiwi-fruit', '#f5a742'), popis: 'Šťavnaté tropické ovocie.', jedlo: { sytost: 16, voda: 12 },
  model: [new THREE.IcosahedronGeometry(0.1, 1).scale(1, 1.2, 0.9).translate(0, 0.12, 0), mat(0xe0852a, { roughness: 0.5 })] });
predmet('ananas', { meno: 'Ananás', ikona: ik('pineapple', '#e8b13a'), popis: 'Sladký, osviežujúci.', jedlo: { sytost: 20, voda: 14 },
  model: [spoj(fv(new THREE.IcosahedronGeometry(0.13, 1).scale(1, 1.4, 1).translate(0, 0.19, 0), 0xd9a21e),
    fv(new THREE.ConeGeometry(0.09, 0.2, 5).translate(0, 0.46, 0), 0x3f7a35)), MAT_V] });
predmet('trstina', { meno: 'Cukrová trstina', ikona: ik('sugar-cane', '#b5c46a'), popis: 'Sladká šťava, dá sa žuť.', jedlo: { sytost: 4, voda: 12 },
  model: [spoj(fv(new THREE.CylinderGeometry(0.04, 0.045, 1.1, 5), 0x8f6a45), fv(new THREE.CylinderGeometry(0.048, 0.048, 0.03, 5).translate(0, 0.15, 0), 0x4a3225)).rotateZ(Math.PI / 2).translate(0, 0.05, 0), MAT_V] });
predmet('kvet', { meno: 'Kvet', ikona: ik('lotus-flower', '#e8507a'), popis: 'Voňavý kvet.',
  model: [spoj(fv(new THREE.CylinderGeometry(0.01, 0.012, 0.3, 4).translate(0, 0.15, 0), 0x4a7f2e),
    fv(new THREE.IcosahedronGeometry(0.07, 0).scale(1, 0.55, 1).translate(0, 0.3, 0), 0xe8343c)).rotateZ(Math.PI / 2.2), MAT_V] });
predmet('huba', { meno: 'Huba', ikona: ik('mushroom', '#c9a27a'), popis: 'Lesná huba.', jedlo: { sytost: 10, voda: 2 },
  model: [spoj(fv(new THREE.CylinderGeometry(0.025, 0.035, 0.12, 6).translate(0, 0.06, 0), 0xe8dcc0),
    fv(new THREE.SphereGeometry(0.08, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1).translate(0, 0.12, 0), 0xb98d57)), MAT_V] });
predmet('aloe', { meno: 'Aloe', ikona: ik('agave', '#6fae7a'), popis: 'Šťava z aloe hojí a osviežuje.', jedlo: { sytost: 1, voda: 6 },
  model: [new THREE.ConeGeometry(0.06, 0.5, 4).rotateZ(Math.PI / 2).translate(0, 0.05, 0), mat(0x6f9a6a)] });
predmet('taro', { meno: 'Taro', ikona: ik('potato', '#a07a8a'), popis: 'Škrobový koreň, treba ho uvariť.', jedlo: { sytost: 12, voda: 0 },
  model: [new THREE.IcosahedronGeometry(0.11, 1).scale(1, 0.85, 1).translate(0, 0.1, 0), mat(0x8a6a58)] });

// ---- tabor ----
// polozit: 'taborak' = klavesa F polozi predmet pred postavu (spracuva main.js + ohen.js)
predmet('taborak', { meno: 'Táborák', ikona: ik('campfire', '#ef7a2f'), kopa: 5, polozit: 'taborak', popis: 'Kruh kameňov s drevom. Polož (F), prikladaj drevo (E), pečie jedlo a hreje.',
  model: [spoj(...[0, 1, 2, 3, 4, 5].map(i => fv(new THREE.IcosahedronGeometry(0.07, 0).translate(Math.cos(i) * 0.16, 0.05, Math.sin(i) * 0.16), 0x8f8c86)),
    fv(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 5).rotateZ(1.2).translate(0, 0.08, 0), 0x6a4a2e),
    fv(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 5).rotateZ(-1.2).rotateY(1.5).translate(0, 0.08, 0), 0x6a4a2e)), MAT_V] });

// ---- lodenica (polozit: 'lodenica' = klavesa F polozi lodenicu pri brehu, spracuva main.js + lodenica.js) ----
predmet('lodenica', { meno: 'Lodenica', ikona: ik('wood-canoe', '#b07a45', ['claw-hammer', '#b8b2a6', .55, 250, -20]), kopa: 2, polozit: 'lodenica', popis: 'Stavba pri vode. Polož (F) na breh do 40 m od vody; v nej staviaš a vylepšuješ lode (E).',
  model: [spoj(...[-1, 1].map(x => fv(new THREE.BoxGeometry(0.05, 0.05, 0.5).translate(x * 0.15, 0.04, 0), 0x6a4a2e)),
    fv(new THREE.ConeGeometry(0.22, 0.14, 4).rotateY(Math.PI / 4).translate(0, 0.32, 0), 0x6f8a3a),
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => fv(new THREE.CylinderGeometry(0.014, 0.014, 0.26, 5).translate(x * 0.16, 0.14, z * 0.16), 0x5e3d22))), MAT_V] });
