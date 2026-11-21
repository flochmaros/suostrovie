// Lodenica: stavba na brehu so splavom k vode. Tu sa stavaju lode a vylepsuje sa najblizsia lod (recepty skupiny 'Lodenica').
// Polozi sa klavesou F (predmet 'lodenica'), musi stat na suchu do 40 m od vody; splav smeruje k najblizsej vode.
import * as THREE from 'three';
import { vyskaTerenu } from './svet.js';
import { trup, texturaTrupu } from './kanoe.js';

const lodenice = [];                 // { x, z, smer (uhol k vode), model }
let scena = null;
export const initLodenice = s => { scena = s; };

const DREVO = new THREE.MeshStandardMaterial({ color: 0x9a6c40, roughness: 0.85 });
const TMAVE = new THREE.MeshStandardMaterial({ color: 0x5e3d22, roughness: 0.85 });
const LISTY = new THREE.MeshStandardMaterial({ color: 0x6f8a3a, roughness: 0.95, side: THREE.DoubleSide });
const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return o; };

// lokalne +z = smer k vode; y = 0 je zem pod stredom
function model() {
  const g = new THREE.Group();
  for (const x of [-1.2, 1.2]) g.add(box(0.22, 0.16, 9, DREVO, x, 0.2, 4.5));                       // koľajnice splavu
  for (let z = 0.5; z < 9; z += 0.9) g.add(box(3.0, 0.1, 0.22, TMAVE, 0, 0.1, z));                  // pražce
  const trupLode = new THREE.Mesh(trup(5.2, 0.5, 0.4, 0.4), new THREE.MeshStandardMaterial({ color: 0xd9c2a0, map: texturaTrupu(), roughness: 0.8, side: THREE.DoubleSide }));
  trupLode.position.set(0, 0.85, 2.2); trupLode.castShadow = true; g.add(trupLode);                  // rozostavany trup na podperach
  for (const z of [0.4, 2.2, 4.0]) for (const x of [-0.7, 0.7]) g.add(box(0.12, 0.5, 0.12, TMAVE, x, 0.5, z));
  for (const [x, z] of [[-2.4, -1.6], [2.4, -1.6], [-2.4, 3.2], [2.4, 3.2]]) {                      // stlpy strechy
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 3.2, 6), TMAVE); s.position.set(x, 1.6, z); s.castShadow = true; g.add(s);
  }
  const strecha = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 5.6, 4, 4).rotateX(-Math.PI / 2), LISTY);
  strecha.position.set(0, 3.25, 0.8); strecha.rotation.x = 0.06; strecha.castShadow = true; g.add(strecha);
  g.add(box(1.8, 0.8, 0.7, DREVO, -3.4, 0.4, -0.5), box(1.9, 0.08, 0.8, TMAVE, -3.4, 0.84, -0.5));  // dielnicky stol
  for (let i = 0; i < 5; i++) g.add(box(2.2, 0.07, 0.35, i % 2 ? DREVO : TMAVE, 3.5, 0.1 + i * 0.08, -1.2));   // kopa dosiek
  return g;
}

function vyskaDna(x, z) { return vyskaTerenu(x, z); }
const jeVoda = (x, z) => vyskaDna(x, z) < -1.6;

// smer k najblizsej hlbokej vode (uhol), alebo null ked je dalej ako 40 m
function smerKVode(x, z) {
  let naj = null;
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    for (let d = 4; d <= 40; d += 2) if (jeVoda(x + Math.sin(a) * d, z + Math.cos(a) * d)) { if (!naj || d < naj.d) naj = { a, d }; break; }
  }
  return naj && naj.a;
}

export function polozLodenicu(x, z, smer = null) {
  if (lodenice.some(l => Math.hypot(l.x - x, l.z - z) < 9)) return 'Príliš blízko inej lodenice';
  if (!scena) return 'Lodenica nie je pripravená';
  if (vyskaTerenu(x, z) < 0.3) return 'Lodenicu polož na suchú zem';
  smer ??= smerKVode(x, z);
  if (smer === null) return 'Lodenica musí stáť do 40 m od hlbokej vody';
  const m = model();
  m.position.set(x, vyskaTerenu(x, z), z); m.rotation.y = smer;
  scena.add(m);
  lodenice.push({ x, z, smer, model: m });
  return true;
}

export function najblizsiaLodenica(x, z, d = 8) {
  let naj = null, nd = d;
  for (const l of lodenice) { const k = Math.hypot(l.x - x, l.z - z); if (k < nd) { nd = k; naj = l; } }
  return naj;
}

// volne miesto na vode pri splave; obsadene(x, z) = true ked tam uz stoji ina lod; vrati { x, z, smer } alebo null
export function miestoSpustenia(l, obsadene) {
  const fx = Math.sin(l.smer), fz = Math.cos(l.smer), rx = fz, rz = -fx;
  let d = 6;
  while (d < 60 && !jeVoda(l.x + fx * d, l.z + fz * d)) d += 1;
  if (d >= 60) return null;
  for (const bok of [0, 7, -7, 14, -14]) for (const extra of [4, 10]) {
    const x = l.x + fx * (d + extra) + rx * bok, z = l.z + fz * (d + extra) + rz * bok;
    if (jeVoda(x, z) && !obsadene(x, z)) return { x, z, smer: l.smer + Math.PI };   // lodny predok (-z) smeruje od brehu
  }
  return null;
}

export const ulozLodenice = () => lodenice.map(l => [+l.x.toFixed(1), +l.z.toFixed(1), +l.smer.toFixed(3)]);
export function nacitajLodenice(data) {
  if (Array.isArray(data)) for (const [x, z, s] of data) if (Number.isFinite(x) && Number.isFinite(z)) polozLodenicu(x, z, s);
}
