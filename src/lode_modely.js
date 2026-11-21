// Vlastne 3D modely lodi (okrem kanoe, ktore ma 4 urovne priamo v kanoe.js):
//   pretekove = dlhe uzke kanoe s dvoma plavakmi, barza = plt z klad s nakladom, katamaran = velka dvojtrupova lod s palubou.
// Kazda funkcia vrati { objekty, plachta, padlo, K, S } rovnako ako postavModel v kanoe.js. z < 0 = predok lode.
import * as THREE from 'three';
import { DRUHY, trup, spoj, vazby, padloModel, plachtaModel, texturaTrupu } from './kanoe.js';

const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
const valec = (r, h, mat, x, y, z, seg = 8) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); m.position.set(x, y, z); return m; };

// okraj trupu ako trubka (lem)
function lem(S, x, mat, r = 0.035) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24, z = (u - 0.5) * S.dlzka, s = Math.abs(u - 0.5) * 2;
    pts.push(new THREE.Vector3(S.sirka * Math.pow(Math.max(1 - s * s, 0), 0.55), 0.32 + S.zdvih * s * s, z));
  }
  const krivka = new THREE.CatmullRomCurve3([...pts, ...pts.slice(1, -1).reverse().map(p => new THREE.Vector3(-p.x, p.y, p.z))], true);
  const m = new THREE.Mesh(new THREE.TubeGeometry(krivka, 96, r, 5, true), mat);
  m.position.x = x; return m;
}

// ---------- pretekarske kanoe: biely trup s cervenym pruhom, dva plavaky, tenky karbonovy stozar ----------
function pretekove(S) {
  const biela = M(0xf2efe6, { roughness: 0.35, side: THREE.DoubleSide }), cerv = M(0xc23b2e, { roughness: 0.5 }),
    karbon = M(0x2a2d33, { roughness: 0.4 }), lano = M(0xc9b07a, { roughness: 0.95 }), svetle = M(0xb98a58, { roughness: 0.7 });
  const o = [];
  const h = new THREE.Mesh(trup(S.dlzka, S.sirka, S.hlbka, S.zdvih), biela); h.position.y = 0.32; o.push(h, lem(S, 0, cerv, 0.032));
  for (const znak of [-1, 1]) {                                        // ostry predok a zad z cervenych kuzelov
    const k = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 6), cerv);
    k.rotation.x = znak * Math.PI / 2; k.position.set(0, 0.32 + S.zdvih + 0.02, znak * (S.dlzka / 2 + 0.1)); o.push(k);
  }
  for (const x of [-1.7, 1.7]) {                                       // dva plavaky na dvoch priecnych nosnikoch
    const pl = new THREE.Mesh(trup(4.4, 0.09, 0.09, 0.14, true), karbon); pl.position.set(x, 0.1, 0); o.push(pl);
  }
  for (const z of [-1.0, 0.9]) {
    o.push(box(3.5, 0.06, 0.1, karbon, 0, 0.42, z));
    for (const x of [-1.7, 1.7]) o.push(...vazby(new THREE.LineCurve3(new THREE.Vector3(x, 0.15, z), new THREE.Vector3(x, 0.42, z)), [0.3, 0.7], 0.06, lano));
  }
  o.push(box(0.5, 0.05, 0.34, karbon, 0, 0.27, 1.0), box(0.4, 0.04, 0.05, karbon, 0, 0.36, 0.3));   // sedadlo + opierka nohy
  const K = 1.3, vyska = 3.6 * K, mz = -1.3;
  o.push(valec(0.025 * K, vyska, karbon, 0, 0.3 + vyska / 2, mz, 8));
  o.push(spoj(new THREE.Vector3(0, 0.3 + vyska - 0.1, mz), new THREE.Vector3(0, 0.32 + S.zdvih + 0.05, -S.dlzka / 2 + 0.1), 0.01, lano, 4));
  const plachta = plachtaModel(null, 3, { lano });
  plachta.position.set(0, 0.3 + 0.25 * K, mz); o.push(plachta);
  const padlo = padloModel({ svetle: karbon, tmave: cerv, lano });
  padlo.position.z = 1.0; o.push(padlo);
  return { objekty: o, plachta, padlo, K, S };
}

// ---------- barza: 7 klad, paluba z dosiek, zabradlie, naklad (debny, sudy, vrecia), stvorcova plachta, kormidlo ----------
function barza(S) {
  const klada = M(0xd9c2a0, { map: texturaTrupu(), roughness: 0.8 }), tmave = M(0x5e3d22), lano = M(0xc9b07a, { roughness: 0.95 });
  const dosky = [0xa8784a, 0xb4845a, 0x9a6c40].map(c => M(c));
  const o = [];
  for (let i = -3; i <= 3; i++) {                                      // klady so zaoblenymi koncami
    const k = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, S.dlzka - 0.54, 4, 10).rotateX(Math.PI / 2), klada);
    k.position.set(i * 0.5, 0.2, (i % 2) * 0.12); o.push(k);
  }
  for (const z of [-2.7, 0, 2.7]) {                                    // priecne nosniky a lanove obvazy
    o.push(box(3.9, 0.12, 0.2, tmave, 0, 0.44, z));
    for (const x of [-1.5, -0.5, 0.5, 1.5]) o.push(...vazby(new THREE.LineCurve3(new THREE.Vector3(x, 0.44, z), new THREE.Vector3(x, 0.45, z)), [0.5], 0.14, lano));
  }
  for (let i = 0; i < 14; i++) o.push(box(3.4, 0.06, 0.45, dosky[i % 3], 0, 0.54, -3.0 + i * 0.46));
  for (const x of [-1.7, 1.7]) {                                       // zabradlie
    for (let z = -3; z <= 3; z += 1.5) o.push(valec(0.04, 0.65, tmave, x, 0.9, z, 6));
    o.push(spoj(new THREE.Vector3(x, 1.2, -3), new THREE.Vector3(x, 1.2, 3), 0.018, lano, 4));
  }
  // naklad: debny, sudy, vrecia
  const debna = M(0xb98a58), sud = M(0x7a4f2c);
  o.push(box(0.8, 0.6, 0.8, debna, -0.8, 0.87, -0.6), box(0.7, 0.5, 0.7, debna, -0.7, 1.4, -0.55), box(0.8, 0.55, 0.9, debna, 0.8, 0.85, -0.2));
  for (const [x, z] of [[0.75, 0.9], [1.1, 0.5], [-0.9, 0.7]]) o.push(valec(0.27, 0.7, sud, x, 0.92, z, 10));
  for (const [x, z] of [[-0.9, 1.7], [-0.3, 1.9], [0.2, 1.7]]) { const v = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6).scale(1, 0.7, 1.2), M(0xd8c8a0)); v.position.set(x, 0.72, z); o.push(v); }
  o.push(box(0.9, 0.04, 0.5, tmave, 0, 0.6, 2.4), ...[-0.4, 0.4].map(x => valec(0.04, 0.12, tmave, x, 0.58, 2.4)));   // lavicka pre kormidelnika
  // kormidlo (vesla vzadu)
  const ves = new THREE.Group();
  ves.add(valec(0.035, 2.4, tmave, 0, 0, 0, 6), box(0.4, 0.8, 0.04, M(0xb98a58), 0, -0.9, 0));
  ves.rotation.x = 0.5; ves.position.set(0, 0.9, 3.9); o.push(ves);
  // stozar + stvorcova plachta (skupina sa otaca podla vetra a pri zvinuti stiahne nadol)
  const vyska = 4.3, mz = -2.6;
  o.push(valec(0.07, vyska, tmave, 0, 0.5 + vyska / 2, mz));
  const plachta = new THREE.Group();
  const platno = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.7, 6, 4), M(0xefe2c0, { side: THREE.DoubleSide, roughness: 0.9 }));
  platno.position.y = 2.2;
  const pos = platno.geometry.attributes.position;                      // jemne vypuklenie plachty
  for (let i = 0; i < pos.count; i++) pos.setZ(i, 0.25 * (1 - (pos.getX(i) / 1.5) ** 2) * (1 - (pos.getY(i) / 1.35) ** 2));
  const ryha = M(0xb8452c, { side: THREE.DoubleSide });
  const pas = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.22), ryha); pas.position.set(0, 2.3, 0.27);
  plachta.add(platno, pas);
  plachta.position.set(0, 0.5, mz);
  o.push(plachta);
  // priecka (ruda) nad plachtou: valec otoceny po osi x
  const ruda = valec(0.05, 3.2, tmave, 0, 0.5 + 3.6, mz); ruda.rotation.z = Math.PI / 2; o.push(ruda);
  return { objekty: o, plachta, padlo: null, K: 1, S };
}

// ---------- katamaran: dva dlhe trupy, paluba, kabina, zabradlie, siet na prede, stozar s velkou plachtou a kormidlom ----------
function katamaran(S) {
  const drevo = M(0xf4e8d6, { map: texturaTrupu(), roughness: 0.6, side: THREE.DoubleSide }), tmave = M(0x4a3020), svetle = M(0xb98a58), lano = M(0xc9b07a, { roughness: 0.95 });
  const dosky = [0xb4845a, 0xa8784a, 0xbf9266].map(c => M(c)), biela = M(0xefe6d2, { roughness: 0.5 });
  const o = [], X = 1.8;
  for (const x of [-X, X]) {
    const h = new THREE.Mesh(trup(S.dlzka, S.sirka, S.hlbka, S.zdvih), drevo); h.position.set(x, 0.32, 0); o.push(h, lem(S, x, tmave, 0.04));
    const nos = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 6), tmave);        // ozdobny predok
    nos.rotation.x = -Math.PI / 2 - 0.3; nos.position.set(x, 0.32 + S.zdvih + 0.12, -S.dlzka / 2 - 0.12); o.push(nos);
  }
  for (const z of [-3.8, -1.3, 1.3, 3.8]) o.push(box(4.4, 0.14, 0.22, tmave, 0, 0.74, z));           // nosniky
  for (let i = 0; i < 20; i++) o.push(box(0.22, 0.06, 7.2, dosky[i % 3], -2.1 + i * 0.222, 0.83, 0.3)); // paluba
  const siet = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.0, 12, 6), M(0x6b5a3a, { side: THREE.DoubleSide, wireframe: true }));
  siet.rotation.x = -Math.PI / 2; siet.position.set(0, 0.8, -4.7); o.push(siet);                     // siet pred palubou
  // zabradlie po obvode
  for (const x of [-2.15, 2.15]) {
    for (let z = -3.4; z <= 4; z += 1.4) o.push(valec(0.035, 0.6, tmave, x, 1.13, z, 6));
    o.push(spoj(new THREE.Vector3(x, 1.4, -3.4), new THREE.Vector3(x, 1.4, 4), 0.016, lano, 4));
  }
  for (const x of [-1.2, 0, 1.2]) o.push(valec(0.035, 0.6, tmave, x, 1.13, 4.05, 6));
  o.push(spoj(new THREE.Vector3(-2.15, 1.4, 4.05), new THREE.Vector3(2.15, 1.4, 4.05), 0.016, lano, 4));
  // kabina so strechou a oknami
  o.push(box(2.6, 1.0, 2.2, dosky[1], 0, 1.36, 1.5), box(3.0, 0.1, 2.6, tmave, 0, 1.92, 1.5));
  for (const x of [-0.8, 0.8]) o.push(box(0.6, 0.4, 0.03, M(0x6fa8c8, { roughness: 0.2, metalness: 0.2 }), x, 1.5, 0.38));
  // kormidlo: stlpik + koleso, lavicka kormidelnika
  o.push(valec(0.06, 0.55, tmave, 0, 1.15, 2.85));
  const koleso = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 16), svetle); koleso.position.set(0, 1.5, 2.85); o.push(koleso);
  for (let i = 0; i < 4; i++) { const sp = box(0.44, 0.02, 0.02, svetle, 0, 1.5, 2.85); sp.rotation.z = i * Math.PI / 4; o.push(sp); }
  o.push(box(1.0, 0.06, 0.4, tmave, 0, 0.94, 3.0));
  // naklad na prede (palubu mozno neskor vyuzit na stavanie)
  o.push(box(0.7, 0.55, 0.7, svetle, -1.3, 1.15, -2.3), box(0.7, 0.55, 0.7, svetle, -0.55, 1.15, -2.3), valec(0.25, 0.65, M(0x7a4f2c), 1.2, 1.18, -2.4, 10));
  // stozar, velka plachta (animovana) + pevny kosatec (jib)
  const K = 1.7, vyska = 3.6 * K + 0.5, mz = -1.2, y0 = 0.86;
  o.push(valec(0.06 * K, vyska, tmave, 0, y0 + vyska / 2, mz));
  o.push(...vazby(new THREE.LineCurve3(new THREE.Vector3(0, y0, mz), new THREE.Vector3(0, y0 + vyska, mz)), [0.04, 0.07, 0.1], 0.065 * K, lano));
  o.push(spoj(new THREE.Vector3(0, y0 + vyska - 0.1, mz), new THREE.Vector3(0, 0.9, -4.6), 0.014, lano, 4));       // predna ztuha
  const jib = new THREE.Shape(); jib.moveTo(0, 0); jib.lineTo(3.2, 0); jib.lineTo(0.2, 4.3); jib.lineTo(0, 0);     // (z, y)
  const kos = new THREE.Mesh(new THREE.ShapeGeometry(jib).rotateY(-Math.PI / 2), M(0xf7ebd0, { side: THREE.DoubleSide, roughness: 0.9 }));
  kos.position.set(0, 1.0, -4.5); kos.rotation.y = Math.PI; kos.scale.set(1, 1, 0.9); o.push(kos);
  const plachta = plachtaModel(null, 3, { lano });
  plachta.position.set(0, y0 + 0.25 * K, mz); o.push(plachta);
  return { objekty: o, plachta, padlo: null, K, S };
}

const STAVBY = { pretekove, barza, katamaran };
export function postavDruh(druh) {
  const b = STAVBY[druh](DRUHY[druh].stat);
  b.objekty.forEach(m => m.traverse(c => { if (c.isMesh) c.castShadow = true; }));
  return b;
}
