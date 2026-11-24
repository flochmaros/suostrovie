// 3D modely brnenia: 5 sad (list, bambus, lastura, krab, supina) x 4 kusy (hlava, telo, nohy, cizmy).
// kusVystroje(slot, tier) vrati zoznam dielov { j: nazov klbu postavy, o: Object3D, bake?: [x,y,z] } – diely sa pripoja na klby J z postava.js.
//   hlava: J.hlava (suradnice lebky)   telo: J.chrbat + ramena J.rL/J.rP   nohy: J.telo (sukna) + stehna J.sL/J.sP + kolena J.kL/J.kP
//   cizmy: J.kL/J.kP (holen + chodidlo)
// modelKusu(slot, tier) -> [geometria, material] pre predmet na zemi / ikonu v batohu (diely spojene, farby vo vrcholoch).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PI = Math.PI;
export const TIERY = {
  list:    { f: 0x58b043, o: 0x2f7a2c, r: 0.8, m: 0 },
  bambus:  { f: 0xd2bd6a, o: 0x8a7330, r: 0.7, m: 0 },
  lastura: { f: 0xf0d3c2, o: 0xc8907e, r: 0.32, m: 0.15 },
  krab:    { f: 0xc8422c, o: 0x7a2414, r: 0.5, m: 0.15 },
  supina:  { f: 0x2f2420, o: 0xff5a10, r: 0.45, m: 0.35, zar: true },
};

const mat = {};
function sada(t) {
  if (mat[t]) return mat[t];
  const s = TIERY[t], mk = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: s.r, metalness: s.m, side: THREE.DoubleSide, ...o });
  return (mat[t] = { f: mk(s.f), o: mk(s.o, s.zar ? { emissive: s.o, emissiveIntensity: 1.0, metalness: 0.1 } : {}), tm: mk(new THREE.Color(s.f).multiplyScalar(0.6)) });
}

// ---------- pomocne funkcie ----------
const M = (geo, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; return o; };
const skup = (...d) => { const g = new THREE.Group(); g.add(...d); return g; };
const prsten = (r, t, m, y, sx = 1, sz = 1) => M(new THREE.TorusGeometry(r, t, 6, 28).rotateX(PI / 2), m, 0, y, 0, sx, 1, sz);
const dole = (dlzka, w) => new THREE.ConeGeometry(w, dlzka, 4).rotateX(PI).translate(0, -dlzka / 2, 0);   // hrot dole (list, strapec)
const hore = (dlzka, w, n = 5) => new THREE.ConeGeometry(w, dlzka, n).translate(0, dlzka / 2, 0);          // hrot hore (tren)
// n kusov na obluku elipsy (a0..a1 rad, 0 = vpredu = -z); fn(x, z, uhol) vrati Mesh, natoci sa smerom von
function naElipse(g, n, a0, a1, rx, rz, y, fn) {
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? (a0 + a1) / 2 : a0 + (a1 - a0) * i / (n - 1);
    const o = fn(rx * Math.sin(a), rz * Math.cos(a) * -1, a, i);
    o.position.set(rx * Math.sin(a), y, -rz * Math.cos(a)); o.rotation.y = -a; g.add(o);
  }
}
const PROF_T = [[0.148, 0.0], [0.145, 0.1], [0.14, 0.18], [0.158, 0.3], [0.178, 0.38], [0.17, 0.455], [0.1, 0.5]];   // ako tricko v postava.js
const rT = y => { for (let i = 1; i < PROF_T.length; i++) if (y <= PROF_T[i][1]) { const [r0, y0] = PROF_T[i - 1], [r1, y1] = PROF_T[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return 0.1; };

// ---------- HLAVA (suradnice hlavy: lebka okolo (0, 0.11, 0)) ----------
function helma(t) {
  const s = sada(t), g = new THREE.Group();
  const kopula = M(new THREE.SphereGeometry(0.172, 22, 12, 0, PI * 2, 0, PI * 0.55), s.f, 0, 0.12, 0.012, 0.98, 1.0, 1.08); g.add(kopula);
  g.add(M(new THREE.TorusGeometry(0.168, 0.012, 6, 28).rotateX(PI / 2), s.o, 0, 0.148, 0.012, 0.98, 1, 1.08));
  if (t === 'list') {
    for (let i = 0; i < 7; i++) {                                  // veniec listov okolo hlavy + tri velke listy navrchu
      const a = i / 7 * PI * 2, l = M(hore(0.13, 0.04, 4), s.f, 0.12 * Math.sin(a), 0.285, 0.012 + 0.12 * Math.cos(a), 1, 1, 0.28);
      l.rotation.set(0.5 * Math.cos(a), -a, -0.55 * Math.sin(a)); g.add(l);
    }
    g.add(M(hore(0.2, 0.05, 4), s.o, 0, 0.29, 0, 1, 1, 0.3));
  } else if (t === 'bambus') {
    for (const y of [0.2, 0.25]) g.add(M(new THREE.TorusGeometry(0.15 - (y - 0.2) * 1.4, 0.01, 5, 24).rotateX(PI / 2), s.o, 0, y, 0.012, 0.98, 1, 1.08));
    g.add(M(new THREE.CylinderGeometry(0.03, 0.036, 0.1, 8), s.f, 0, 0.32, 0)); g.add(M(new THREE.TorusGeometry(0.034, 0.008, 5, 12).rotateX(PI / 2), s.o, 0, 0.32, 0));
  } else if (t === 'lastura') {
    for (let i = 0; i < 5; i++) {                                  // vejar zo skoljiek vzadu a navrchu
      const a = (i - 2) * 0.5, o = M(new THREE.SphereGeometry(0.085, 12, 8), i % 2 ? s.f : s.o, 0.17 * Math.sin(a), 0.25 + 0.04 * Math.cos(a), 0.08 + 0.03 * Math.cos(a), 1, 1.25, 0.22);
      o.rotation.z = -a * 0.8; o.rotation.x = -0.45; g.add(o);
    }
  } else if (t === 'krab') {
    g.add(M(new THREE.BoxGeometry(0.02, 0.025, 0.25), s.o, 0, 0.275, 0));
    for (const k of [-1, 1]) { const o = M(new THREE.ConeGeometry(0.018, 0.1, 6), s.o, 0.05 * k, 0.27, -0.12); o.rotation.set(-0.5, 0, -0.25 * k); g.add(o);
      g.add(M(new THREE.SphereGeometry(0.02, 8, 6), s.f, 0.062 * k, 0.318, -0.145)); }
  } else {                                                          // supina: dva rohy + ziariaci okraj
    for (const k of [-1, 1]) { const o = M(hore(0.2, 0.034, 6), s.o, 0.13 * k, 0.24, 0.0); o.rotation.z = -0.75 * k; o.rotation.x = -0.15; g.add(o); }
    g.add(M(hore(0.07, 0.03, 4), s.o, 0, 0.3, -0.07));
  }
  return [{ j: 'hlava', o: g, bake: [0, 0, 0] }];
}

// ---------- TELO ----------
function plece(t) {
  const s = sada(t), g = new THREE.Group();
  g.add(M(new THREE.SphereGeometry(0.1, 14, 8, 0, PI * 2, 0, PI * 0.6), s.f, 0, 0.005, 0, 1.05, 0.85, 1.05));
  g.add(M(new THREE.TorusGeometry(0.095, 0.01, 5, 18).rotateX(PI / 2), s.o, 0, -0.045, 0));
  if (t === 'list') { const l = M(dole(0.14, 0.05), s.f, 0.07, -0.02, 0, 1, 1, 0.3); l.rotation.z = -0.5; g.add(l); }
  if (t === 'lastura') for (const a of [-0.6, 0, 0.6]) { const o = M(new THREE.SphereGeometry(0.04, 8, 6), s.o, 0.06 * Math.sin(a), 0.06, 0.06 * Math.cos(a), 1, 0.9, 0.3); o.rotation.y = a; g.add(o); }
  if (t === 'krab' || t === 'supina') for (const [x, z, h] of [[0, 0, 0.14], [0.05, -0.05, 0.1], [-0.05, 0.05, 0.1]]) { const o = M(hore(h, 0.028), s.o, x, 0.07, z); o.rotation.z = x * -3; g.add(o); }
  return g;
}
function hrudnik(t) {
  const s = sada(t), g = new THREE.Group(), SX = 1.3, SZ = 0.78;
  g.add(M(new THREE.LatheGeometry(PROF_T.map(([r, y]) => new THREE.Vector2(r + 0.014, y)), 28), s.f, 0, 0, 0, SX, 1, SZ));
  g.add(prsten(0.162, 0.014, s.o, 0.065, SX, SZ));                                 // opasok
  g.add(prsten(0.115, 0.012, s.o, 0.495, SX, SZ));                                 // golier
  const ry = (y, d = 0.024) => [(rT(y) + d) * SX, (rT(y) + d) * SZ];
  if (t === 'list') {                                                              // listove pasy: rady visiacich listov
    for (const y of [0.4, 0.28, 0.16]) { const [rx, rz] = ry(y, 0.016); naElipse(g, 13, -2.3, 2.3, rx, rz, y, () => M(dole(0.13, 0.05), sada(t).f, 0, 0, 0, 1, 1, 0.3)); }
  } else if (t === 'bambus') {                                                     // zvisle bambusove kmene + uzly
    const [rx, rz] = ry(0.24, 0.02);
    naElipse(g, 15, -2.4, 2.4, rx * 1.02, rz * 1.02, 0.24, () => M(new THREE.CylinderGeometry(0.026, 0.026, 0.4, 7), sada(t).f));
    for (const y of [0.1, 0.24, 0.38]) g.add(prsten(rT(y) + 0.034, 0.011, s.o, y, SX, SZ));
  } else if (t === 'lastura' || t === 'supina') {                                  // sklovite skoljky / supiny v troch radoch
    [0.1, 0.19, 0.28, 0.37].forEach((y, r) => { const [rx, rz] = ry(y, 0.02);
      naElipse(g, r % 2 ? 11 : 12, -2.35, 2.35, rx, rz, y, (x, z, a, i) => M(new THREE.SphereGeometry(0.055, 9, 7), (i + r) % 2 ? sada(t).f : sada(t).o, 0, 0, 0, 1, 0.8, 0.32)); });
  } else {                                                                         // krab: brusne platne + chrbtovy hrebien
    for (const y of [0.15, 0.25, 0.35]) g.add(prsten(rT(y) + 0.032, 0.02, y === 0.25 ? s.o : s.f, y, SX, SZ));
    g.add(M(new THREE.BoxGeometry(0.035, 0.38, 0.03), s.o, 0, 0.25, -rT(0.25) * SZ - 0.03));
  }
  const dalsie = [{ j: 'rL', o: plece(t), bake: [-0.23, 0.42, 0] }, { j: 'rP', o: plece(t), bake: [0.23, 0.42, 0] }];
  return [{ j: 'chrbat', o: g, bake: [0, 0, 0] }, ...dalsie];
}

// ---------- NOHY: sukna (J.telo) + stehna + kolena ----------
function nohy(t) {
  const s = sada(t), g = new THREE.Group(), SX = 1.28, SZ = 0.84;
  g.add(M(new THREE.CylinderGeometry(0.162, 0.237, 0.27, 28, 1, true), s.f, 0, -0.05, 0, SX, 1, SZ));
  g.add(prsten(0.236, 0.011, s.o, -0.183, SX, SZ));
  g.add(prsten(0.165, 0.011, s.o, 0.082, SX, SZ));
  const hem = (n, fn) => naElipse(g, n, -PI, PI * (n - 1) / n, 0.233 * SX * 0.99, 0.233 * SZ * 0.99, -0.18, fn);
  if (t === 'list') hem(20, () => M(dole(0.16, 0.05), s.f, 0, 0, 0, 1, 1, 0.3));
  else if (t === 'bambus') { for (let i = 0; i < 22; i++) { const a = i / 22 * PI * 2, o = M(new THREE.CylinderGeometry(0.022, 0.022, 0.27, 6), s.f, 0.222 * SX * 0.97 * Math.sin(a), -0.05, 0.222 * SZ * 0.97 * Math.cos(a)); g.add(o); } }
  else if (t === 'lastura') hem(22, (x, z, a, i) => M(new THREE.SphereGeometry(0.055, 8, 6), i % 2 ? s.f : s.o, 0, 0.02, 0, 1, 0.9, 0.3));
  else { hem(16, () => M(dole(0.1, 0.035), s.o, 0, 0, 0, 1, 1, 0.5)); g.add(prsten(0.2, 0.012, s.o, -0.1, SX, SZ)); }
  const out = [{ j: 'telo', o: g, bake: [0, 0, 0] }];
  for (const [jm, jk, k] of [['sL', 'kL', -1], ['sP', 'kP', 1]]) {
    const st = skup(M(new THREE.CylinderGeometry(0.094, 0.086, 0.21, 12), s.f, 0, -0.3, 0), M(new THREE.TorusGeometry(0.09, 0.012, 5, 14).rotateX(PI / 2), s.o, 0, -0.19, 0));
    if (t === 'krab' || t === 'supina') st.add(M(hore(0.07, 0.025), s.o, 0.09 * k, -0.28, 0)), st.children.at(-1).rotation.z = -k * 1.2;
    const kol = skup(M(new THREE.SphereGeometry(0.078, 10, 8, 0, PI * 2, 0, PI * 0.55), s.o, 0, 0.0, -0.035, 1, 1, 1.0));
    kol.children[0].rotation.x = -PI / 2 + 0.2;
    out.push({ j: jm, o: st, bake: [0.1 * k, -0.02, 0] }, { j: jk, o: kol, bake: [0.1 * k, -0.48, 0] });
  }
  return out;
}

// ---------- CIZMY (J.kL / J.kP: koleno; holen visi do -0.44, chodidlo v (0,-0.44,-0.05)) ----------
function cizma(t) {
  const s = sada(t), g = new THREE.Group();
  g.add(M(new THREE.CylinderGeometry(0.077, 0.068, 0.27, 12), s.f, 0, -0.28, 0));                  // holen
  g.add(M(new THREE.CylinderGeometry(0.082, 0.082, 0.03, 12), s.o, 0, -0.14, 0));                  // lem hore
  g.add(M(new THREE.CapsuleGeometry(0.058, 0.13, 6, 12).rotateX(PI / 2), s.f, 0, -0.445, -0.085, 1.12, 0.85, 1));   // priehlavok
  g.add(M(new THREE.BoxGeometry(0.128, 0.026, 0.3), s.o, 0, -0.484, -0.07));                       // podrazka
  g.add(M(new THREE.SphereGeometry(0.045, 8, 6), s.o, 0, -0.455, -0.2, 1.2, 0.8, 0.9));             // spicka
  if (t === 'list') for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2, l = M(dole(0.09, 0.03), s.f, 0.085 * Math.sin(a), -0.14, 0.085 * Math.cos(a), 1, 1, 0.3); l.rotation.y = a; g.add(l); }
  else if (t === 'bambus') for (const y of [-0.2, -0.28, -0.36]) g.add(M(new THREE.TorusGeometry(0.073, 0.009, 5, 14).rotateX(PI / 2), s.o, 0, y, 0));
  else if (t === 'lastura') for (const y of [-0.2, -0.28, -0.36]) g.add(M(new THREE.SphereGeometry(0.04, 8, 6), s.o, 0, y, -0.068, 1, 0.9, 0.3));
  else for (const y of [-0.22, -0.32]) { const o = M(hore(0.08, 0.022), s.o, 0, y, 0.07); o.rotation.x = 1.15; g.add(o); }
  return g;
}
function cizmy(t) { return [{ j: 'kL', o: cizma(t), bake: [0, 0.47, 0] }, { j: 'kP', o: cizma(t) }]; }

const STAVITELE = { hlava: helma, telo: hrudnik, nohy, cizmy };
export const kusVystroje = (slot, tier) => STAVITELE[slot](tier);

// ---------- model pre predmet (jedna geometria s farbami vo vrcholoch) ----------
export function zlepModel(diely) {
  const kor = new THREE.Group();
  for (const d of diely) if (d.bake) { const c = d.o; c.position.add(new THREE.Vector3(...d.bake)); kor.add(c); }
  kor.updateMatrixWorld(true);
  const geo = [];
  kor.traverse(m => {
    if (!m.isMesh) return;
    let g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv');
    const c = m.material.color.clone();
    if (m.material.emissiveIntensity > 0.2) c.lerp(m.material.emissive, 0.6);
    const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); geo.push(g);
  });
  const g = mergeGeometries(geo); g.computeBoundingBox();
  const b = g.boundingBox; g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  return [g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide })];
}
export const modelKusu = (slot, tier) => zlepModel(kusVystroje(slot, tier));
