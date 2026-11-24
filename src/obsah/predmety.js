// Register predmetov. Novy predmet = jedno volanie predmet('id', {...}).
// model: [geometria, material] pre predmet lezaci na zemi / v ruke (spodok na y = 0)
// jedlo: { sytost, voda } - o kolko predmet zasyti / zavlazi pri zjedeni
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ik } from '../ikony.js';
import { modelKokos, modelKamen, modelMusla, modelDrevo, modelPalica, modelObsidian, modelSira, modelList, modelVlakno, modelBambus, modelBobule, modelBanan, modelMango, modelAnanas, modelTrstina, modelKvet, modelHuba, modelAloe, modelHlina, modelZivica, modelTaro, modelTaborak, modelLodenica } from './modely_predmetov.js';

export const PREDMETY = {};
export function predmet(id, def) { PREDMETY[id] = { id, kopa: 20, popis: '', ...def }; }

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
const matV = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, ...o });
const DREVO = mat(0x8a6240);
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
  model: modelDrevo() });
predmet('palica', { meno: 'Palica', ikona: ik('wood-stick', '#c9a06a'), popis: 'Suchá palica.',
  model: modelPalica() });
predmet('kamen', { meno: 'Kameň', ikona: ik('rock', '#a19d95'), popis: 'Hodí sa na nástroje.',
  model: modelKamen() });
predmet('obsidian', { meno: 'Obsidián', ikona: ik('crystal-growth', '#56487e'), popis: 'Čierne sopečné sklo, ostré ako britva.',
  model: modelObsidian() });
predmet('sira', { meno: 'Síra', ikona: ik('ore', '#e8d040'), popis: 'Žltá hrudka z kráteru.',
  model: modelSira() });
predmet('kokos', { meno: 'Kokos', ikona: ik('coconuts', '#8a5a32'), popis: 'Jedlo aj pitie.', jedlo: { sytost: 10, voda: 30 },
  model: modelKokos() });
predmet('musla', { meno: 'Mušľa', ikona: ik('spiral-shell', '#f2cdb5'), popis: 'Pekná mušľa z pláže.',
  model: modelMusla() });
predmet('list', { meno: 'Palmový list', ikona: ik('monstera-leaf', '#5fae4c'), popis: 'Na strechy a vlákno.',
  model: modelList() });
predmet('vlakno', { meno: 'Vlákno', ikona: ik('herbs-bundle', '#d6c08a'), popis: 'Z kríkov a trávy, na viazanie.',
  model: modelVlakno() });

// ---- nove suroviny a jedlo z rastlin ----
predmet('bambus', { meno: 'Bambus', ikona: ik('bamboo', '#a5c75a'), popis: 'Pevný a ľahký. Na stavbu a nástroje.',
  model: modelBambus() });
predmet('bobule', { meno: 'Bobule', ikona: ik('elderberry', '#6a6ad0'), popis: 'Sladké lesné bobule.', jedlo: { sytost: 6, voda: 8 },
  model: modelBobule() });
predmet('banan', { meno: 'Banán', ikona: ik('banana', '#f2d34a'), popis: 'Sýty a sladký.', jedlo: { sytost: 18, voda: 4 },
  model: modelBanan() });
predmet('mango', { meno: 'Mango', ikona: ik('kiwi-fruit', '#f5a742'), popis: 'Šťavnaté tropické ovocie.', jedlo: { sytost: 16, voda: 12 },
  model: modelMango() });
predmet('ananas', { meno: 'Ananás', ikona: ik('pineapple', '#e8b13a'), popis: 'Sladký, osviežujúci.', jedlo: { sytost: 20, voda: 14 },
  model: modelAnanas() });
predmet('trstina', { meno: 'Cukrová trstina', ikona: ik('sugar-cane', '#b5c46a'), popis: 'Sladká šťava, dá sa žuť.', jedlo: { sytost: 4, voda: 12 },
  model: modelTrstina() });
predmet('kvet', { meno: 'Kvet', ikona: ik('lotus-flower', '#e8507a'), popis: 'Voňavý kvet.',
  model: modelKvet() });
predmet('huba', { meno: 'Huba', ikona: ik('mushroom', '#c9a27a'), popis: 'Lesná huba.', jedlo: { sytost: 10, voda: 2 },
  model: modelHuba() });
predmet('aloe', { meno: 'Aloe', ikona: ik('agave', '#6fae7a'), popis: 'Šťava z aloe hojí a osviežuje.', jedlo: { sytost: 1, voda: 6 },
  model: modelAloe() });
predmet('hlina', { meno: 'Hlina', ikona: ik('rock', '#b5703a'), popis: 'Lepkavá červená hlina z Hliniska. Na pece a utesnenie trupu.',
  model: modelHlina() });
predmet('zivica', { meno: 'Živica', ikona: ik('water-drop', '#d89a30'), popis: 'Lepkavá šťava gumovníka z Džungle predkov. Spája a utesňuje.',
  model: modelZivica() });
predmet('taro', { meno: 'Taro', ikona: ik('potato', '#a07a8a'), popis: 'Škrobový koreň, treba ho uvariť.', jedlo: { sytost: 12, voda: 0 },
  model: modelTaro() });

// ---- tabor ----
// polozit: 'taborak' = klavesa F polozi predmet pred postavu (spracuva main.js + ohen.js)
predmet('taborak', { meno: 'Táborák', ikona: ik('campfire', '#ef7a2f'), kopa: 5, polozit: 'taborak', popis: 'Kruh kameňov s drevom. Polož (F), prikladaj drevo (E), pečie jedlo a hreje.',
  model: modelTaborak() });

// ---- lodenica (polozit: 'lodenica' = klavesa F polozi lodenicu pri brehu, spracuva main.js + lodenica.js) ----
predmet('lodenica', { meno: 'Lodenica', ikona: ik('wood-canoe', '#b07a45', ['claw-hammer', '#b8b2a6', .55, 250, -20]), kopa: 2, polozit: 'lodenica', popis: 'Stavba pri vode. Polož (F) na breh do 40 m od vody; v nej staviaš a vylepšuješ lode (E).',
  model: modelLodenica() });
