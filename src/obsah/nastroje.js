// Nastroje: sekera, krompac, noz, kyj, ostep (+ vylepsene verzie).
// nastroj: { typ, sila, ucinnost: { drevo, kamen, list }, trvanlivost }  -> poskodenie = sila * ucinnost[material zdroja]
// drzanie: { poz, rot } - ako sa drzi v pravej ruke (pociatok skupiny = dlan, ruka dole -y, postava hlada -z)
// model: [geometria, material] - lezi na zemi (dlzka pozdlz x, hlava na -x), v ruke ho otoci drzanie.rot
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { predmet } from './predmety.js';

const C = { drevo: 0x7a5535, tmavy: 0x5a3d25, bambus: 0xc9b266, vlakno: 0xcfb87c, kamen: 0x8f8c86, kamen2: 0xb9b6ae, musla: 0xf1d2bf, ostrie: 0xd8d4c8, obsidian: 0x3d4248 };
const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 });

// zafarbi geometriu (vertex colors) a pripravi ju na spojenie
const farba = (g, hex) => {
  g = g.index ? g.toNonIndexed() : g;
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
};
// zakladne diely (postavene na stojato: rukovat od y = 0 nahor, hlava navrchu)
const rukovat = (dlzka, r, hex, hore = r) => farba(new THREE.CylinderGeometry(hore, r, dlzka, 6).translate(0, dlzka / 2, 0), hex);
const omotaj = (y, r = 0.04) => farba(new THREE.TorusGeometry(r, 0.013, 5, 10).rotateX(Math.PI / 2).translate(0, y, 0), C.vlakno);
const kamenHlava = (x, y, rx, ry, rz, hex) => farba(new THREE.IcosahedronGeometry(1, 0).scale(rx, ry, rz).translate(x, y, 0), hex);

// hotovy model: spoji diely, polozi na bok (dlzka pozdlz x, hlava na -x) a zdvihne nad zem
const YZEM = 0.05;
function zloz(diely) {
  return [mergeGeometries(diely).rotateZ(Math.PI / 2).translate(0, YZEM, 0), MAT];
}
// drzanie: uchop v mieste g (vzdialenost od konca rukovate) sa ma dostat do dlane, hlava hore a mierne dopredu (-z), cepel dopredu
function drzanie(g, sklon = 0.5) {
  const rot = new THREE.Euler(-sklon, Math.PI / 2, -Math.PI / 2);
  const v = new THREE.Vector3(-g, YZEM, 0).applyEuler(rot);
  const z = x => Math.round(x * 1000) / 1000;
  return { poz: [z(-v.x), z(-v.y), z(-v.z)], rot: [rot.x, rot.y, rot.z] };
}

// ---------- modely ----------
function sekera(hlavaHex, ostrieHex, sirka = 1) {
  const L = 0.62;
  return zloz([rukovat(L, 0.028, C.drevo, 0.024), kamenHlava(0.07, L - 0.06, 0.11 * sirka, 0.085, 0.032, hlavaHex),
    farba(new THREE.BoxGeometry(0.03, 0.15 * sirka, 0.014).translate(0.16 * sirka, L - 0.06, 0), ostrieHex), omotaj(L - 0.11), omotaj(L - 0.02)]);
}
function krompac(hlavaHex, rukovatHex) {
  const L = 0.7;
  return zloz([rukovat(L, 0.03, rukovatHex, 0.026), farba(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 5).rotateZ(Math.PI / 2).translate(0, L, 0), C.tmavy),
    farba(new THREE.ConeGeometry(0.05, 0.2, 5).rotateZ(-Math.PI / 2).translate(0.33, L, 0), hlavaHex),
    farba(new THREE.ConeGeometry(0.05, 0.2, 5).rotateZ(Math.PI / 2).translate(-0.33, L, 0), hlavaHex),
    kamenHlava(0, L, 0.06, 0.06, 0.05, hlavaHex), omotaj(L - 0.04, 0.045), omotaj(L + 0.04, 0.045)]);
}
function noz(dlzkaCepele, cepelHex, rukovatHex) {
  const L = 0.26;
  return zloz([rukovat(L, 0.026, rukovatHex), kamenHlava(0, L + dlzkaCepele * 0.45, 0.022, dlzkaCepele * 0.55, 0.055, cepelHex),
    omotaj(L - 0.03, 0.034), omotaj(L + 0.02, 0.034)]);
}
function kyj() {
  const L = 0.72;
  return zloz([rukovat(L, 0.028, C.drevo, 0.058), kamenHlava(0, L + 0.02, 0.075, 0.07, 0.075, C.drevo), omotaj(0.12, 0.034)]);
}
function ostep(hrotHex, dlzka = 1.45) {
  const parts = [rukovat(dlzka, 0.02, C.bambus, 0.017), farba(new THREE.ConeGeometry(0.036, 0.2, 5).translate(0, dlzka + 0.08, 0), hrotHex), omotaj(dlzka - 0.02, 0.026)];
  for (const y of [0.3, 0.75, 1.15]) parts.push(farba(new THREE.TorusGeometry(0.02, 0.008, 4, 8).rotateX(Math.PI / 2).translate(0, y, 0), C.tmavy));
  return zloz(parts);
}

// ---------- predmety ----------
const nastroj = (typ, sila, ucinnost, trvanlivost) => ({ typ, sila, ucinnost, trvanlivost });

predmet('kamenna_sekera', { kopa: 1, meno: 'Kamenná sekera', ikona: '🪓', popis: 'Seká stromy a palmy rýchlejšie.',
  nastroj: nastroj('sekera', 1, { drevo: 2, kamen: 0.25, list: 1.2 }, 40), drzanie: drzanie(0.15), model: sekera(C.kamen, C.kamen2) });
predmet('lasturova_sekera', { kopa: 1, meno: 'Mušľová sekera', ikona: '🪓', popis: 'Ostrá mušľová čepeľ, vydrží dlhšie.',
  nastroj: nastroj('sekera', 1.3, { drevo: 2, kamen: 0.25, list: 1.2 }, 80), drzanie: drzanie(0.15), model: sekera(C.musla, 0xffffff, 1.15) });

predmet('kamenny_krompac', { kopa: 1, meno: 'Kamenný krompáč', ikona: '⛏️', popis: 'Láme kamene a balvany.',
  nastroj: nastroj('krompac', 1, { drevo: 0.3, kamen: 2, list: 0.3 }, 40), drzanie: drzanie(0.15), model: krompac(C.kamen, C.drevo) });
predmet('spevneny_krompac', { kopa: 1, meno: 'Spevnený krompáč', ikona: '⛏️', popis: 'Hroty z tmavého kameňa, pevná rukoväť.',
  nastroj: nastroj('krompac', 1.4, { drevo: 0.3, kamen: 2, list: 0.3 }, 90), drzanie: drzanie(0.15), model: krompac(C.obsidian, C.tmavy) });

predmet('kamenny_noz', { kopa: 1, meno: 'Kamenný nôž', ikona: '🔪', popis: 'Reže rastliny a vlákna.',
  nastroj: nastroj('noz', 1, { drevo: 0.4, kamen: 0, list: 3 }, 50), drzanie: drzanie(0.08, 0.7), model: noz(0.2, C.kamen2, C.drevo) });
predmet('macheta', { kopa: 1, meno: 'Mačeta', ikona: '🔪', popis: 'Dlhá čepeľ, kosí kroviny ako nič.',
  nastroj: nastroj('noz', 1.5, { drevo: 0.6, kamen: 0, list: 4 }, 100), drzanie: drzanie(0.08, 0.7), model: noz(0.46, C.obsidian, C.tmavy) });

predmet('kyj', { kopa: 1, meno: 'Kyj', ikona: '🏏', popis: 'Ťažká drevená palica.',
  nastroj: nastroj('kyj', 1.5, { drevo: 0.8, kamen: 0.1, list: 1.5 }, 60), drzanie: drzanie(0.15), model: kyj() });

predmet('bambusova_ostep', { kopa: 1, meno: 'Bambusový oštep', ikona: '🔱', popis: 'Ľahký oštep na lov a ryby.',
  nastroj: nastroj('ostep', 1.2, { drevo: 0.3, kamen: 0.05, list: 1 }, 30), drzanie: drzanie(0.5, 0.35), model: ostep(C.bambus) });
predmet('kamenna_ostep', { kopa: 1, meno: 'Kamenný oštep', ikona: '🔱', popis: 'Oštep s kamenným hrotom, vydrží viac.',
  nastroj: nastroj('ostep', 1.8, { drevo: 0.3, kamen: 0.05, list: 1 }, 60), drzanie: drzanie(0.5, 0.35), model: ostep(C.kamen2) });
