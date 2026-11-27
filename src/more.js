// More: morske dno, koraly, riasy, vraky, plavajuce predmety, zraloky, meduzy, raje a morske korytnacky.
// Vsetko je procedurálne (low-poly, vertex farby), deterministicke podla SEED a bunky, a drzi sa len v okoli hraca.
//  - dno: dlazdice 256 m (33 x 33 vrcholov) okolo hraca; vysky z dnoMorske() v svet.js (rovnake ako fyzika)
//  - dekoracie: chunky 80 m -> InstancedMesh na kazdy druh (matice sa kopiruju z chunkov len pri zmene)
//  - zbery: pole zb v chunku; zobrane id ide do zobrate (uklada sa spolu s ostatnymi)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { vyskaTerenu, dnoMorske, farbaDna, zobrate, SEED, KAUSTIKA_GLSL } from './svet.js';
import { vyskaVody, uCas, uPriliv, uNoc } from './ocean.js';
import { rng, hash } from './nahoda.js';
import './obsah/more.js';

// callbacky pre main.js: priZraneni(dmg, pricina), priSplachu(x, y, z, sila)
export const udalosti = { priZraneni: null, priSplachu: null };
const splach = (x, y, z, s) => { if (udalosti.priSplachu) udalosti.priSplachu(x, y, z, s); };
const zrani = (d, p) => { if (udalosti.priZraneni) udalosti.priZraneni(d, p); };

let scena = null;
const uT = { value: 0 };
let _cas = 0, _vKanoe = false, _kanoe = new THREE.Vector2(), _hrac = new THREE.Vector3();
let vVode = false, hlbokaVoda = false, cdZranenie = 0, dirty = false, prvy = true;

// ---------- material: vertex farby + kaustiky + volitelne hojdanie vo vertex shaderi ----------
// sway: 'y' (riasy, rastliny: hojda sa vrch), 'z' (chvost ryby), 'x' (plutvy, kridla)
const f3 = n => n.toFixed(3);
function matMore(o = {}) {
  const { sway = '', amp = 0, freq = 1, dvojity = false, hrub = 0.8, priesvit = 0, emis = 0, ripple = false } = o;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: hrub, side: dvojity ? THREE.DoubleSide : THREE.FrontSide });
  if (priesvit) { m.transparent = true; m.opacity = priesvit; m.depthWrite = false; }
  const A = f3(amp), F = f3(freq);
  const kod = {
    y: `float swk = max(position.y, 0.0); transformed.x += sin(uT * ${F} + ph + position.y * 1.3) * ${A} * swk * swk;
        transformed.z += cos(uT * ${F} * 0.8 + ph * 1.3 + position.y) * ${A} * 0.6 * swk * swk;`,
    z: `float swk = clamp(-position.z * 0.5, 0.0, 1.5); transformed.x += sin(uT * ${F} + ph - position.z * 1.6) * ${A} * swk * swk;`,
    x: `float swk = abs(position.x); transformed.y += sin(uT * ${F} + ph - swk * 0.9) * ${A} * swk;`,
  }[sway] || '';
  m.customProgramCacheKey = () => `more|${sway}|${A}|${F}|${emis}|${ripple}|${dvojity}`;
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = uT; sh.uniforms.uCas = uCas; sh.uniforms.uPriliv = uPriliv; sh.uniforms.uNoc = uNoc;
    sh.vertexShader = 'uniform float uT;\nvarying vec3 vSvetP;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.53;
        #else
          float ph = modelMatrix[3].x * 0.37 + modelMatrix[3].z * 0.53;
        #endif
        ${kod}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wp_ = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp_ = instanceMatrix * wp_;
        #endif
        vSvetP = (modelMatrix * wp_).xyz;`);
    sh.fragmentShader = 'uniform float uCas;\nuniform float uPriliv;\nuniform float uNoc;\nvarying vec3 vSvetP;\n' + KAUSTIKA_GLSL + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${ripple ? `float rp = sin(dot(vSvetP.xz, vec2(0.8, 0.6)) * 3.1 + sin(vSvetP.x * 0.21 + vSvetP.z * 0.17) * 3.0)
                  + 0.5 * sin(dot(vSvetP.xz, vec2(-0.5, 0.86)) * 7.3);
        diffuseColor.rgb *= 1.0 + rp * 0.05 * smoothstep(-16.0, -3.0, vSvetP.y);` : ''}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float hl = uPriliv - vSvetP.y;
        totalEmissiveRadiance += vec3(0.8, 0.95, 1.0) * kaustika(vSvetP.xz, uCas * 1.3) * diffuseColor.rgb * (1.0 - 0.995 * uNoc)
          * smoothstep(0.0, 0.5, hl) * (1.0 - smoothstep(3.0, 12.0, hl)) * 1.3;
        ${emis ? `totalEmissiveRadiance += diffuseColor.rgb * ${f3(emis)} * (1.0 + uNoc * (5.0 + 3.0 * sin(uCas * 1.7 + vSvetP.x * 0.7)));` : ''}`);
  };
  return m;
}

// ---------- pomocnici na geometriu ----------
// jedna farba (c1 nevyplnene) alebo prechod c0 -> c1 pozdlz osi os (0 x, 1 y, 2 z); geometria sa spravi neindexovana bez uv
function vg(g, c0, c1, os = 1) {
  g = g.index ? g.toNonIndexed() : g;
  g.deleteAttribute('uv');
  if (!g.attributes.normal) g.computeVertexNormals();
  const p = g.attributes.position, n = p.count, a = new Float32Array(n * 3);
  const v = i => (os === 0 ? p.getX(i) : os === 1 ? p.getY(i) : p.getZ(i));
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < n; i++) { const q = v(i); if (q < mn) mn = q; if (q > mx) mx = q; }
  const A = new THREE.Color(c0), B = new THREE.Color(c1 === undefined ? c0 : c1), t = new THREE.Color();
  for (let i = 0; i < n; i++) {
    t.copy(A).lerp(B, mx > mn ? (v(i) - mn) / (mx - mn) : 0);
    a[i * 3] = t.r; a[i * 3 + 1] = t.g; a[i * 3 + 2] = t.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const spoj = gs => mergeGeometries(gs);
const OSY = new THREE.Vector3(0, 1, 0);

function geoVetva() {                                  // vetvovity koral: kmen + 3 + 6 vetiev
  const r = rng(77), dily = [];
  const rec = (p, d, dlzka, rad, lvl) => {
    const g = lvl === 2 ? new THREE.ConeGeometry(rad, dlzka, 5, 1, true) : new THREE.CylinderGeometry(rad * 0.7, rad, dlzka, 5, 1, true);
    const q = new THREE.Quaternion().setFromUnitVectors(OSY, d);
    g.translate(0, dlzka / 2, 0).applyQuaternion(q).translate(p.x, p.y, p.z);
    dily.push(vg(g, 0xa8a8a8, 0xffffff));
    if (lvl === 2) return;
    const top = p.clone().addScaledVector(d, dlzka), n = lvl === 0 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const az = i * 6.283 / n + r() * 1.2, tilt = 0.45 + r() * 0.4;
      const nd = new THREE.Vector3(Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)).applyQuaternion(q);
      rec(top, nd.normalize(), dlzka * 0.78, rad * 0.7, lvl + 1);
    }
  };
  rec(new THREE.Vector3(), OSY.clone(), 0.5, 0.1, 0);
  return spoj(dily);
}
function geoMozg() {                                   // mozgovy koral: pukliny kopec
  const g = new THREE.IcosahedronGeometry(0.42, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), w = 1 + 0.09 * Math.sin(x * 19 + z * 5) * Math.sin(z * 17 - y * 7);
    p.setXYZ(i, x * w, Math.max(y * 0.62, -0.08), z * w);
  }
  g.computeVertexNormals();
  return vg(g.translate(0, 0.05, 0), 0x9a9a9a, 0xffffff);
}
function geoVejar() {                                  // koralovy vejar: vyseč kruhu s rebrami + stonka
  const g = new THREE.CircleGeometry(0.55, 14, Math.PI * 0.1, Math.PI * 0.8), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, Math.sin(Math.atan2(y, x) * 14) * 0.025 * Math.hypot(x, y) / 0.55);
  }
  g.computeVertexNormals();
  g.translate(0, 0.1, 0);
  return spoj([vg(g, 0xaaaaaa, 0xffffff), vg(new THREE.CylinderGeometry(0.03, 0.04, 0.14, 5, 1, true).translate(0, 0.07, 0), 0x9a9a9a)]);
}
function geoAnemona() {
  const r = rng(91), d = [vg(new THREE.CylinderGeometry(0.13, 0.16, 0.12, 7, 1, true).translate(0, 0.06, 0), 0x8a7a70)];
  for (let i = 0; i < 14; i++) {
    const g = new THREE.ConeGeometry(0.022, 0.42, 4).translate(0, 0.21, 0).rotateZ(0.25 + r() * 0.5).rotateY(i * 0.449 + r() * 0.3).translate(0, 0.1, 0);
    d.push(vg(g, 0xb8a8c0, 0xffffff));
  }
  return spoj(d);
}
function geoKelp() {                                   // 3 stuhy zvisle pásy vysky 1 (skaluje sa instanciou)
  const d = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.PlaneGeometry(0.4, 1, 1, 8).translate(0, 0.5, 0), p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k);
      p.setX(k, p.getX(k) * (1 - 0.65 * y));
      p.setZ(k, 0.12 * Math.sin(y * 6 + i));
    }
    g.computeVertexNormals();
    g.rotateY(i * 2.1 + 0.3).translate(Math.cos(i * 2.1) * 0.12, 0, Math.sin(i * 2.1) * 0.12);
    d.push(vg(g, 0x4e6b25, 0xa6c24a));
  }
  return spoj(d);
}
function geoTrava() {
  const r = rng(33), d = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.ConeGeometry(0.03, 0.55 + r() * 0.2, 3, 1, true).translate(0, 0.3, 0).rotateZ((r() - 0.5) * 0.5).rotateX((r() - 0.5) * 0.5)
      .translate((r() - 0.5) * 0.18, 0, (r() - 0.5) * 0.18);
    d.push(vg(g, 0x2b5f27, 0x9cc85a));
  }
  return spoj(d);
}
function geoHviezda() {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5, rr = i % 2 ? 0.07 : 0.22;
    if (i) sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return vg(new THREE.ExtrudeGeometry(sh, { depth: 0.045, bevelEnabled: false }).rotateX(-Math.PI / 2), 0xe6e6e6, 0xffffff);
}
function geoMusla() {
  const g = new THREE.SphereGeometry(0.11, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), w = 1 + 0.12 * Math.sin(Math.atan2(z, x) * 8);
    p.setXYZ(i, x * w, y * 0.45, z * w * 0.85);
  }
  g.computeVertexNormals();
  return vg(g, 0xe0cdbd, 0xffffff);
}
function geoUstrica() {
  const dolna = new THREE.SphereGeometry(0.16, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.4, 0.8);
  const horna = dolna.clone().rotateX(Math.PI).translate(0, 0.075, 0);
  return spoj([vg(dolna, 0x77716a, 0x9a9488), vg(horna, 0x6a655c, 0x8a8478)]);
}
function geoSkala() {
  const g = new THREE.IcosahedronGeometry(0.5, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), w = 1 + 0.22 * Math.sin(x * 9 + z * 5) * Math.cos(y * 7 + x * 3);
    p.setXYZ(i, x * w, y * w * 0.7, z * w);
  }
  g.computeVertexNormals();
  return vg(g.translate(0, 0.12, 0), 0x4a4743, 0x8d887e);
}
const geoDoska = () => vg(new THREE.BoxGeometry(2.3, 0.06, 0.26), 0x3e2f20, 0x6a5238, 0);
const geoRebro = () => vg(new THREE.TorusGeometry(2.0, 0.07, 4, 10, Math.PI).rotateZ(Math.PI).translate(0, 2.0, 0), 0x3a2c1e, 0x5a4630);
const geoKiel = () => vg(new THREE.BoxGeometry(0.25, 0.22, 9.2).translate(0, 0.11, 0), 0x2e2217);
const geoStozar = () => vg(new THREE.CylinderGeometry(0.11, 0.17, 7, 6, 1, true), 0x4a3a28, 0x6b5a42);
function geoTruhla() {
  const lid = new THREE.CylinderGeometry(0.25, 0.25, 0.8, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(0, 0.38, 0);
  return spoj([
    vg(new THREE.BoxGeometry(0.8, 0.38, 0.5).translate(0, 0.19, 0), 0x6a4423), vg(lid, 0x7a5129),
    vg(new THREE.BoxGeometry(0.06, 0.4, 0.52).translate(0.25, 0.2, 0), 0xc9a227), vg(new THREE.BoxGeometry(0.06, 0.4, 0.52).translate(-0.25, 0.2, 0), 0xc9a227),
    vg(new THREE.BoxGeometry(0.1, 0.13, 0.04).translate(0, 0.33, 0.26), 0xd9b72f),
  ]);
}
function geoBarel() {                                  // sud lezi na boku
  const pts = [[0.27, -0.4], [0.32, -0.2], [0.34, 0], [0.32, 0.2], [0.27, 0.4]].map(([x, y]) => new THREE.Vector2(x, y));
  const dily = [
    vg(new THREE.LatheGeometry(pts, 10), 0x8b5a2b, 0xa06a35),
    vg(new THREE.CircleGeometry(0.27, 10).rotateX(-Math.PI / 2).translate(0, 0.4, 0), 0x6f4723),
    vg(new THREE.CircleGeometry(0.27, 10).rotateX(Math.PI / 2).translate(0, -0.4, 0), 0x6f4723),
    vg(new THREE.CylinderGeometry(0.335, 0.335, 0.05, 10, 1, true).translate(0, 0.22, 0), 0x333333),
    vg(new THREE.CylinderGeometry(0.335, 0.335, 0.05, 10, 1, true).translate(0, -0.22, 0), 0x333333),
  ];
  return spoj(dily).rotateZ(Math.PI / 2);
}
function geoNaplavene() {
  return spoj([
    vg(new THREE.CylinderGeometry(0.1, 0.16, 2.6, 6).rotateZ(Math.PI / 2), 0x8f806a, 0xb3a58c, 0),
    vg(new THREE.CylinderGeometry(0.05, 0.08, 0.7, 5).translate(0, 0.35, 0).rotateZ(-0.9).translate(0.3, 0.1, 0), 0x8f806a, 0xb3a58c),
  ]);
}
function geoMeduza() {
  const d = [vg(new THREE.SphereGeometry(0.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1), 0xd8e4ff, 0xffffff)];
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    d.push(vg(new THREE.ConeGeometry(0.015, 1.0, 3).rotateX(Math.PI).translate(Math.cos(a) * 0.26, -0.5, Math.sin(a) * 0.26), 0xd0b0ff, 0xffffff));
  }
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.4;
    d.push(vg(new THREE.ConeGeometry(0.05, 0.7, 4).rotateX(Math.PI).translate(Math.cos(a) * 0.1, -0.35, Math.sin(a) * 0.1), 0xe8c0ff, 0xffffff));
  }
  return spoj(d);
}
function geoZralok() {                                 // nos +z, chvost -z, dlzka cca 3.2
  const T = 0x4b5963, sf = (r, ws, hs) => new THREE.SphereGeometry(r, ws, hs);
  return spoj([
    vg(sf(1, 10, 7).scale(0.32, 0.3, 1.5), 0xe6eaec, 0x56646f),
    vg(new THREE.ConeGeometry(0.28, 0.7, 4).rotateX(-0.35).translate(0, 0.55, 0.1), T),
    vg(new THREE.ConeGeometry(0.2, 0.75, 3).rotateZ(-1.3).translate(0.42, -0.12, 0.4), T),
    vg(new THREE.ConeGeometry(0.2, 0.75, 3).rotateZ(1.3).translate(-0.42, -0.12, 0.4), T),
    vg(new THREE.ConeGeometry(0.2, 0.9, 3).translate(0, 0.45, 0).rotateX(-Math.PI / 2 + 0.5).translate(0, 0.05, -1.4), T),
    vg(new THREE.ConeGeometry(0.16, 0.6, 3).translate(0, 0.3, 0).rotateX(-Math.PI / 2 - 0.5).translate(0, -0.05, -1.4), T),
    vg(sf(0.04, 4, 3).translate(0.2, 0.08, 1.15), 0x111111), vg(sf(0.04, 4, 3).translate(-0.2, 0.08, 1.15), 0x111111),
  ]);
}
function geoRaja() {                                   // kridla pozdlz x, hlava +z, dlhy chvost -z
  return spoj([
    vg(new THREE.SphereGeometry(1, 12, 6).scale(2.2, 0.09, 0.85), 0xe8ecf0, 0x2a3646),
    vg(new THREE.ConeGeometry(0.1, 0.5, 4).rotateX(Math.PI / 2).translate(0.3, 0, 0.9), 0x2a3646),
    vg(new THREE.ConeGeometry(0.1, 0.5, 4).rotateX(Math.PI / 2).translate(-0.3, 0, 0.9), 0x2a3646),
    vg(new THREE.ConeGeometry(0.04, 2.2, 4).rotateX(-Math.PI / 2).translate(0, 0, -1.8), 0x2a3646),
  ]);
}
function geoKorytnacka() {
  const sk = new THREE.SphereGeometry(0.5, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.9, 0.55, 1.1);
  const pl = (x, z, sx, rz) => vg(new THREE.SphereGeometry(0.2, 6, 4).scale(sx, 0.08, 0.6).rotateY(rz).translate(x, -0.02, z), 0x7a8a4a, 0x9aa05a);
  return spoj([
    vg(sk, 0x4a3d22, 0x7b6a35), vg(new THREE.CircleGeometry(0.45, 8).rotateX(Math.PI / 2).scale(0.9, 1, 1.1), 0xd8d0a8),
    vg(new THREE.SphereGeometry(0.13, 6, 4).translate(0, 0.02, 0.62), 0x9aa05a),
    pl(0.55, 0.3, 1.8, 0.3), pl(-0.55, 0.3, 1.8, -0.3), pl(0.3, -0.5, 1.0, -0.3), pl(-0.3, -0.5, 1.0, 0.3),
  ]);
}

// ---------- druhy instancii (InstancedMesh, kapacita sa nesmie prekrocit) ----------
const mDef = matMore({ hrub: 0.75 });
const TYP = {
  vetva: { geo: geoVetva(), mat: mDef, cap: 2500 },
  mozg: { geo: geoMozg(), mat: mDef, cap: 2000 },
  vejar: { geo: geoVejar(), mat: matMore({ sway: 'y', amp: 0.06, freq: 1.1, dvojity: true }), cap: 1500 },
  ane: { geo: geoAnemona(), mat: matMore({ sway: 'y', amp: 0.5, freq: 1.9 }), cap: 1000 },
  kelp: { geo: geoKelp(), mat: matMore({ sway: 'y', amp: 0.9, freq: 1.2, dvojity: true }), cap: 1500 },
  trava: { geo: geoTrava(), mat: matMore({ sway: 'y', amp: 0.22, freq: 1.7, dvojity: true }), cap: 4000 },
  hviezda: { geo: geoHviezda(), mat: mDef, cap: 600 },
  musla: { geo: geoMusla(), mat: mDef, cap: 600 },
  ustrica: { geo: geoUstrica(), mat: mDef, cap: 400 },
  skala: { geo: geoSkala(), mat: mDef, cap: 1500 },
  doska: { geo: geoDoska(), mat: mDef, cap: 700 },
  rebro: { geo: geoRebro(), mat: mDef, cap: 200 },
  kiel: { geo: geoKiel(), mat: mDef, cap: 30 },
  stozar: { geo: geoStozar(), mat: mDef, cap: 30 },
  truhla: { geo: geoTruhla(), mat: mDef, cap: 30 },
};
const KORAL = [0xff7a45, 0xf25c8a, 0x9a5cd0, 0xf2d04a, 0x35c0b0, 0xd9333f, 0xe8e0d0, 0xff9bd2, 0x6aa4ff];

// ---------- chunky dekoracii ----------
const CH = 80, RCH = 2;
const chunky = new Map();                              // "cx,cz" -> { d, zb, med, plav }
const dummy = new THREE.Object3D(), tmpM = new THREE.Matrix4(), tmpC = new THREE.Color();

function pushMat(ch, typ, m, farba) {
  const d = ch.d[typ] ??= { m: [], c: [] };
  for (let i = 0; i < 16; i++) d.m.push(m.elements[i]);
  tmpC.set(farba ?? 0xffffff);
  d.c.push(tmpC.r, tmpC.g, tmpC.b);
  return d.c.length / 3 - 1;
}
function pridaj(ch, typ, x, y, z, o = {}) {
  const s = o.s ?? 1;
  dummy.position.set(x, y, z);
  dummy.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0, 'XYZ');
  dummy.scale.set(s, o.sy ?? s, s);
  dummy.updateMatrix();
  return pushMat(ch, typ, dummy.matrix, o.col);
}
const jit = (hex, r) => new THREE.Color(hex).offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * 0.1, (r() - 0.5) * 0.14);
const sivaSkala = r => new THREE.Color().setHSL(0.06 * r(), 0.04 + 0.1 * r(), 0.22 + 0.2 * r());

function generujChunk(cx, cz) {
  const r = rng(hash(cx, cz, SEED + 4242));
  const ch = { cx, cz, d: {}, zb: [], med: [], plav: [], n: 0 };
  const x0 = cx * CH, z0 = cz * CH;
  const nid = () => `m,${cx},${cz},${ch.n++}`;
  const zber = (druh, typ, x, y, z, rozmer = 1) => {          // pridaj zberny kus (ak este nie je zobrany)
    const id = nid();
    return { id, druh, typ, x, y, z, rozmer, hotovo: zobrate.has(id) };
  };
  // vlozi instanciu a (volitelne) ju zaregistruje ako zber; zobrane kusy sa nevykreslia
  const dajZber = (druh, typ, x, y, z, o) => {
    const q = zber(druh, typ, x, y, z);
    if (q.hotovo) return;
    q.i = pridaj(ch, typ, x, y, z, o);
    ch.zb.push(q);
  };

  for (let k = 0; k < 8; k++) {
    const px = x0 + r() * CH, pz = z0 + r() * CH, h = vyskaTerenu(px, pz);
    const rad = 5 + r() * 11, pal = [KORAL[Math.floor(r() * KORAL.length)], KORAL[Math.floor(r() * KORAL.length)]];
    const mies = () => {
      const a = r() * 6.283, d = rad * Math.sqrt(r()), x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d;
      return [x, z, vyskaTerenu(x, z)];
    };
    const hlina = r() < 0.5;
    if (h > -0.6) continue;
    if (h > -2.4) {                                    // plytka laguna: morska trava, mušle, hviezdice
      for (let i = 0, n = 20 + Math.floor(r() * 25); i < n; i++) {
        const [x, z, y] = mies();
        if (y > -0.3 || y < -3.5) continue;
        const s = 0.8 + r() * 0.8;
        pridaj(ch, 'trava', x, y - 0.02, z, { s, sy: s * (0.8 + r() * 0.8), ry: r() * 6.28, col: jit(0xffffff, r) });
      }
      for (let i = 0; i < 4; i++) {
        const [x, z, y] = mies();
        if (y > -0.3 || y < -3.5) continue;
        dajZber('musla', 'musla', x, y, z, { s: 0.8 + r() * 0.6, ry: r() * 6.28, col: jit(r() < 0.5 ? 0xf0dccc : 0xf0b8b8, r) });
      }
      for (let i = 0; i < 2; i++) {
        const [x, z, y] = mies();
        if (y > -0.3 || y < -3.5) continue;
        dajZber('hviezdica', 'hviezda', x, y, z, { s: 0.7 + r() * 0.7, ry: r() * 6.28, col: jit(r() < 0.5 ? 0xe8742c : 0xf09a5a, r) });
      }
      if (r() < 0.4) { const [x, z, y] = mies(); if (y < -0.3 && y > -3.5) dajZber('ustrica', 'ustrica', x, y, z, { s: 0.9 + r() * 0.4, ry: r() * 6.28 }); }
    } else if (h > -14) {                              // koralovy utes
      if (r() < 0.22) continue;
      for (let i = 0, n = 18 + Math.floor(r() * 34); i < n; i++) {
        const [x, z, y] = mies();
        if (y > -0.8 || y < -16) continue;
        const u = r(), col = jit(pal[r() < 0.6 ? 0 : 1], r), ry = r() * 6.28, zbierat = r() < 0.35;
        if (u < 0.38) {
          const o = { s: 0.7 + r() * 1.0, ry, col };
          if (zbierat) dajZber('koral', 'vetva', x, y - 0.03, z, o); else pridaj(ch, 'vetva', x, y - 0.03, z, o);
        } else if (u < 0.64) {
          const o = { s: 0.6 + r() * 1.0, ry, col };
          if (zbierat) dajZber('koral', 'mozg', x, y - 0.03, z, o); else pridaj(ch, 'mozg', x, y - 0.03, z, o);
        } else if (u < 0.82) {
          const o = { s: 0.8 + r() * 0.8, ry, col };
          if (zbierat) dajZber('koral', 'vejar', x, y - 0.02, z, o); else pridaj(ch, 'vejar', x, y - 0.02, z, o);
        } else pridaj(ch, 'ane', x, y - 0.02, z, { s: 0.7 + r() * 0.6, ry, col: jit(hlina ? 0xd060d0 : 0xe08040, r) });
      }
      for (let i = 0; i < 3; i++) {
        const [x, z, y] = mies();
        if (y > -0.8 || y < -16) continue;
        dajZber('hviezdica', 'hviezda', x, y, z, { s: 0.8 + r() * 0.8, ry: r() * 6.28, col: jit(r() < 0.5 ? 0xe8742c : 0xd9333f, r) });
      }
      for (let i = 0; i < 2; i++) {
        const [x, z, y] = mies();
        if (y > -0.8 || y < -16) continue;
        if (r() < 0.6) dajZber('ustrica', 'ustrica', x, y, z, { s: 0.9 + r() * 0.5, ry: r() * 6.28 });
        else dajZber('musla', 'musla', x, y, z, { s: 0.9 + r() * 0.6, ry: r() * 6.28, col: jit(0xf0dccc, r) });
      }
      for (let i = 0; i < 3; i++) {
        const [x, z, y] = mies();
        if (y > -0.8 || y < -16) continue;
        const s = 0.4 + r() * 1.1;
        pridaj(ch, 'skala', x, y - 0.05, z, { s, sy: s * (0.6 + r() * 0.6), ry: r() * 6.28, col: sivaSkala(r) });
      }
    } else if (h > -28) {                              // riasove lesy
      if (r() < 0.5) {
        for (let i = 0, n = 8 + Math.floor(r() * 14); i < n; i++) {
          const [x, z, y] = mies();
          if (y > -6 || y < -30) continue;
          const vyska = Math.max(1.5, Math.min(2 + r() * 5.5, -y - 2.5)), o = { s: 0.8 + r() * 0.6, sy: vyska, ry: r() * 6.28, col: jit(0xffffff, r) };
          if (r() < 0.4) dajZber('riasa', 'kelp', x, y - 0.05, z, o); else pridaj(ch, 'kelp', x, y - 0.05, z, o);
        }
      }
      for (let i = 0; i < 3; i++) {
        const [x, z, y] = mies();
        if (y > -6) continue;
        const s = 0.5 + r() * 1.3;
        pridaj(ch, 'skala', x, y - 0.05, z, { s, sy: s * (0.6 + r() * 0.6), ry: r() * 6.28, col: sivaSkala(r) });
      }
      if (r() < 0.4) { const [x, z, y] = mies(); if (y < -6) pridaj(ch, 'ane', x, y - 0.02, z, { s: 1 + r() * 0.6, ry: r() * 6.28, col: jit(0xd060d0, r) }); }
    } else if (r() < 0.5) {                            // hlbina: osamele balvany
      for (let i = 0, n = 2 + Math.floor(r() * 3); i < n; i++) {
        const [x, z, y] = mies();
        const s = 0.8 + r() * 2.0;
        pridaj(ch, 'skala', x, y - 0.1, z, { s, sy: s * (0.6 + r() * 0.6), ry: r() * 6.28, col: sivaSkala(r) });
      }
    }
  }

  // vrak (zriedkavy): zlomeny trup z rebier a dosiek, stozar, rozhadzane dosky, truhla s pokladom
  if (r() < 0.02) {
    for (let t = 0; t < 8; t++) {
      const wx = x0 + r() * CH, wz = z0 + r() * CH, h = vyskaTerenu(wx, wz);
      if (h < -28 || h > -4) { r(); continue; }
      postavVrak(ch, r, nid, wx, wz);
      break;
    }
  }
  // plavajuce sudy a naplavene drevo nad hlbsou vodou
  if (r() < 0.1) {
    for (let t = 0; t < 3; t++) {
      const x = x0 + r() * CH, z = z0 + r() * CH, typ = r() < 0.5 ? 'barel' : 'drevo', ph = r() * 6.28, R = 3 + r() * 5, w = (r() - 0.5) * 0.06, ry = r() * 6.28;
      if (vyskaTerenu(x, z) > -4) continue;
      const id = nid();
      if (!zobrate.has(id)) ch.plav.push({ id, typ, x0: x, z0: z, ph, R, w, ry, x, z, y: 0, hotovo: false });
      break;
    }
  }
  // meduzy: skupinka pod hladinou
  if (r() < 0.5) {
    const mx = x0 + r() * CH, mz = z0 + r() * CH;
    for (let i = 0, n = 2 + Math.floor(r() * 4); i < n; i++) {
      const x = mx + (r() - 0.5) * 14, z = mz + (r() - 0.5) * 14, h = vyskaTerenu(x, z), yMin = Math.max(h + 2.5, -14);
      const ph = r() * 6.28, s = 0.6 + r() * 0.9, yy = -1.8 - r() * 10, farba = jit([0xff8fd0, 0xa0b8ff, 0xffd88a, 0x9ff0e0][Math.floor(r() * 4)], r);
      if (yMin > -2) continue;
      ch.med.push({ x0: x, z0: z, y0: Math.max(yy, yMin), ph, s, farba, x, y: 0, z, pulz: 0 });
    }
  }

  // matice -> Float32Array (kopiruju sa do InstancedMesh)
  for (const d of Object.values(ch.d)) { d.m = Float32Array.from(d.m); d.c = Float32Array.from(d.c); }
  return ch;
}

function postavVrak(ch, r, nid, wx, wz) {
  const ry = r() * 6.283, roll = (r() - 0.5) * 0.5, pitch = (r() - 0.5) * 0.25, c = Math.cos(ry), s = Math.sin(ry);
  let hy = -1e9;
  for (const [lx, lz] of [[0, -4.5], [0, 4.5], [1.5, 0], [-1.5, 0], [0, 0]]) hy = Math.max(hy, vyskaTerenu(wx + c * lx + s * lz, wz - s * lx + c * lz));
  const kv = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, ry, roll, 'YXZ'));
  const zaklad = new THREE.Matrix4().compose(new THREE.Vector3(wx, hy - 0.5, wz), kv, new THREE.Vector3(1, 1, 1));
  const lok = (typ, lx, ly, lz, eu, sc, col) => {               // instancia v suradniciach vraku
    tmpM.compose(new THREE.Vector3(lx, ly, lz), new THREE.Quaternion().setFromEuler(new THREE.Euler(eu[0], eu[1], eu[2], eu[3] || 'XYZ')), new THREE.Vector3(sc[0], sc[1], sc[2]));
    pushMat(ch, typ, tmpM.premultiply(zaklad), col);
  };
  const drevo = () => new THREE.Color().setHSL(0.07 + r() * 0.03, 0.35, 0.18 + r() * 0.12);
  lok('kiel', 0, 0, 0, [0, 0, 0], [1, 1, 1], 0xffffff);
  const rad = z => 2.0 * Math.sqrt(Math.max(0.15, 1 - (z / 5.2) * (z / 5.2)));
  for (let i = 0; i < 7; i++) {
    const z = -4.2 + i * 1.4;
    if (r() < 0.85) lok('rebro', 0, 0, z, [0, 0, 0], [rad(z) / 2, rad(z) / 2, 1], 0xffffff);
  }
  for (let sg = 0; sg < 6; sg++) {
    const zm = -3.5 + sg * 1.4, R = rad(zm);
    for (let a = -1.4; a < 1.5; a += 0.45) {
      if (r() > (Math.abs(a) < 0.6 ? 0.85 : 0.45)) continue;
      lok('doska', R * Math.sin(a), R - R * Math.cos(a), zm, [0, Math.PI / 2, a, 'ZYX'], [0.6, 1, 3.4], drevo());
    }
  }
  lok('stozar', 2.8, 0.6, 1.0, [0, 0.5, 1.4], [1, 1, 1], 0xffffff);
  // rozhadzane dosky a truhla vo svete
  for (let i = 0; i < 8; i++) {
    const a = r() * 6.283, d = 3 + r() * 6, x = wx + Math.cos(a) * d, z = wz + Math.sin(a) * d, y = vyskaTerenu(x, z);
    pridaj(ch, 'doska', x, y + 0.05, z, { s: 0.5 + r() * 0.5, ry: r() * 6.28, rz: (r() - 0.5) * 0.3, col: drevo() });
  }
  const tx = wx + c * -2.6 + s * 0.8, tz = wz - s * -2.6 + c * 0.8, ty = vyskaTerenu(tx, tz), id = nid();
  if (!zobrate.has(id)) {
    const q = { id, druh: 'truhla', typ: 'truhla', x: tx, y: ty, z: tz, rozmer: 1, hotovo: false };
    q.i = pridaj(ch, 'truhla', tx, ty - 0.05, tz, { ry: r() * 6.28, rz: (r() - 0.5) * 0.15 });
    ch.zb.push(q);
  }
  const idb = nid();                                            // sud, ktory sa utrhol z vraku
  if (!zobrate.has(idb)) ch.plav.push({ id: idb, typ: 'barel', x0: wx + 6, z0: wz - 5, ph: r() * 6.28, R: 4, w: 0.05, ry: r() * 6.28, x: wx + 6, z: wz - 5, y: 0, hotovo: false });
}

let instMeshe = null;
function prestavInst() {
  for (const [t, T] of Object.entries(TYP)) {
    let n = 0;
    const dm = T.mesh.instanceMatrix.array, dc = T.mesh.instanceColor.array;
    for (const ch of chunky.values()) {
      const d = ch.d[t];
      if (!d) continue;
      const k = d.m.length / 16;
      if (n + k > T.cap) break;
      dm.set(d.m, n * 16); dc.set(d.c, n * 3); n += k;
    }
    T.mesh.count = n;
    T.mesh.instanceMatrix.needsUpdate = true;
    T.mesh.instanceColor.needsUpdate = true;
  }
  dirty = false;
}
function aktualizujChunky(px, pz) {
  const cx = Math.floor(px / CH), cz = Math.floor(pz / CH), chyba = [];
  for (let i = -RCH; i <= RCH; i++) for (let j = -RCH; j <= RCH; j++) {
    const k = (cx + i) + ',' + (cz + j);
    if (!chunky.has(k)) chyba.push([i * i + j * j, cx + i, cz + j, k]);
  }
  chyba.sort((a, b) => a[0] - b[0]);
  for (const [, x, z, k] of chyba.slice(0, prvy ? 99 : 2)) { chunky.set(k, generujChunk(x, z)); dirty = true; }
  for (const [k, ch] of chunky) if (Math.abs(ch.cx - cx) > RCH + 1 || Math.abs(ch.cz - cz) > RCH + 1) { chunky.delete(k); dirty = true; }
  if (dirty) prestavInst();
}

// ---------- morske dno ----------
const DNO_CH = 256, DNO_SEG = 32, DNO_R = 2;
const matDno = matMore({ hrub: 0.97, ripple: true });
const dnoChunky = new Map();
const dnoIdx = (() => {
  const N = DNO_SEG + 1, a = new Uint16Array(DNO_SEG * DNO_SEG * 6);
  let o = 0;
  for (let j = 0; j < DNO_SEG; j++) for (let i = 0; i < DNO_SEG; i++) {
    const p = j * N + i;
    a[o++] = p; a[o++] = p + N; a[o++] = p + 1;
    a[o++] = p + 1; a[o++] = p + N; a[o++] = p + N + 1;
  }
  return a;
})();
function postavDno(cx, cz) {
  const S = DNO_CH / DNO_SEG, N = DNO_SEG + 1, M = N + 2, H = new Float32Array(M * M);
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) H[j * M + i] = dnoMorske(cx * DNO_CH + (i - 1) * S, cz * DNO_CH + (j - 1) * S);
  const poz = new Float32Array(N * N * 3), nor = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3), c = new THREE.Color();
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = (j + 1) * M + i + 1, h = H[k], o = (j * N + i) * 3;
    const nx = (H[k - 1] - H[k + 1]) / (2 * S), nz = (H[k - M] - H[k + M]) / (2 * S), l = Math.hypot(nx, 1, nz);
    poz[o] = i * S; poz[o + 1] = h; poz[o + 2] = j * S;
    nor[o] = nx / l; nor[o + 1] = 1 / l; nor[o + 2] = nz / l;
    farbaDna(h, cx * DNO_CH + i * S, cz * DNO_CH + j * S, c);
    col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(poz, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(dnoIdx, 1));
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, matDno);
  m.position.set(cx * DNO_CH, 0, cz * DNO_CH);
  return m;
}
function aktualizujDno(px, pz) {
  const cx = Math.floor(px / DNO_CH), cz = Math.floor(pz / DNO_CH), chyba = [];
  for (let i = -DNO_R; i <= DNO_R; i++) for (let j = -DNO_R; j <= DNO_R; j++) {
    const k = (cx + i) + ',' + (cz + j);
    if (!dnoChunky.has(k)) chyba.push([i * i + j * j, cx + i, cz + j, k]);
  }
  chyba.sort((a, b) => a[0] - b[0]);
  for (const [, x, z, k] of chyba.slice(0, prvy ? 99 : 1)) {
    const m = postavDno(x, z);
    m.userData.k = [x, z];
    dnoChunky.set(k, m);
    scena.add(m);
  }
  for (const [k, m] of dnoChunky) {
    if (Math.abs(m.userData.k[0] - cx) > DNO_R + 1 || Math.abs(m.userData.k[1] - cz) > DNO_R + 1) {
      scena.remove(m); m.geometry.dispose(); dnoChunky.delete(k);
    }
  }
}

// ---------- plavajuce predmety (sudy, drevo) ----------
let meshBarel, meshDrevo, cisloNakladu = 0;
// naklad z potopenej lode: kazda polozka = jeden sud, ktory pomaly krazi okolo miesta potopenia (neuklada sa)
export function vypustNaklad(x, z, polozky) {
  const ch = chunky.get(Math.floor(x / CH) + ',' + Math.floor(z / CH));
  if (!ch) return;
  polozky.forEach((obsah, i) => {
    const a = i * 2.4 + Math.random(), r = 2.5 + i * 0.8, x0 = x + Math.cos(a) * r, z0 = z + Math.sin(a) * r;
    ch.plav.push({ id: 'naklad' + cisloNakladu++, typ: 'barel', obsah: [obsah], x0, z0, ph: Math.random() * 6.28, R: 1.5, w: 0.04, ry: Math.random() * 6.28, x: x0, z: z0, y: 0, hotovo: false });
  });
}
function aktualizujPlavajuce(cas) {
  let nb = 0, nd = 0;
  for (const ch of chunky.values()) for (const p of ch.plav) {
    if (p.hotovo) continue;
    const a = p.w * cas + p.ph;
    p.x = p.x0 + Math.cos(a) * p.R; p.z = p.z0 + Math.sin(a) * p.R;
    const h0 = vyskaVody(p.x, p.z, cas), hx = vyskaVody(p.x + 0.7, p.z, cas), hz = vyskaVody(p.x, p.z + 0.7, cas);
    p.y = h0;
    dummy.position.set(p.x, h0 - 0.02, p.z);
    dummy.rotation.set(-Math.atan((hz - h0) / 0.7), p.ry + a * 0.3, Math.atan((hx - h0) / 0.7), 'YXZ');
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    if (p.typ === 'barel') { if (nb < 40) meshBarel.setMatrixAt(nb++, dummy.matrix); }
    else if (nd < 40) meshDrevo.setMatrixAt(nd++, dummy.matrix);
  }
  meshBarel.count = nb; meshDrevo.count = nd;
  meshBarel.instanceMatrix.needsUpdate = true; meshDrevo.instanceMatrix.needsUpdate = true;
}

// ---------- meduzy ----------
let meshMeduza;
function aktualizujMeduzy(cas) {
  let n = 0;
  for (const ch of chunky.values()) for (const m of ch.med) {
    if (n >= 150) break;
    m.x = m.x0 + Math.sin(cas * 0.11 + m.ph) * 5; m.z = m.z0 + Math.cos(cas * 0.09 + m.ph * 1.7) * 5;
    m.y = m.y0 + Math.sin(cas * 0.35 + m.ph * 2) * 0.8;
    m.pulz = 0.5 + 0.5 * Math.sin(cas * 2.4 + m.ph * 3);
    dummy.position.set(m.x, m.y, m.z);
    dummy.rotation.set(0, cas * 0.2 + m.ph, 0, 'XYZ');
    dummy.scale.set(m.s * (1 + 0.2 * (0.5 - m.pulz)), m.s * (1 - 0.3 * (0.5 - m.pulz)), m.s * (1 + 0.2 * (0.5 - m.pulz)));
    dummy.updateMatrix();
    meshMeduza.setMatrixAt(n, dummy.matrix);
    meshMeduza.setColorAt(n, m.farba);
    n++;
    // poleptanie pri dotyku
    if (vVode && cdZranenie <= 0 && Math.hypot(_hrac.x - m.x, _hrac.z - m.z) < 0.7 * m.s + 0.3 && Math.abs(_hrac.y + 0.6 - m.y) < 1.1 * m.s + 0.3) {
      cdZranenie = 1.5;
      zrani(4, 'Medúza');
    }
  }
  meshMeduza.count = n;
  meshMeduza.instanceMatrix.needsUpdate = true;
  meshMeduza.instanceColor.needsUpdate = true;
}

// ---------- zraloky, raje, morske korytnacky: patrolovanie po kruhu v bunke 320 m ----------
const CT = 320;
const tvory = new Map();                               // "druh,bx,bz" -> tvor alebo false
let casRozhodnutia = 0;
const geoTvor = {}, matTvor = {};
function definujTvora(druh, sx, sz) {
  const r = rng(hash(sx, sz, SEED + { zralok: 501, raja: 502, korytnacka: 503 }[druh]));
  if (r() > { zralok: 0.6, raja: 0.3, korytnacka: 0.4 }[druh]) return null;
  const minH = { zralok: -9, raja: -6, korytnacka: -2.5 }[druh];
  for (let t = 0; t < 8; t++) {
    const cx = (sx + r()) * CT, cz = (sz + r()) * CT, h = vyskaTerenu(cx, cz);
    const R = { zralok: 35 + r() * 60, raja: 50 + r() * 60, korytnacka: 12 + r() * 25 }[druh];
    const rychlost = { zralok: 4.2, raja: 3.0, korytnacka: 1.2 }[druh] * (0.85 + r() * 0.3), smer = r() < 0.5 ? 1 : -1, ph = r() * 6.28, sc = { zralok: 1.1 + r() * 0.4, raja: 1.6 + r() * 0.8, korytnacka: 0.9 + r() * 0.5 }[druh];
    if (druh === 'zralok' && h > -14) continue;
    if (druh === 'raja' && h > -10) continue;
    if (druh === 'korytnacka' && (h > -3.5 || h < -24)) continue;
    let ok = true;
    for (let k = 0; k < 14 && ok; k++) if (vyskaTerenu(cx + Math.cos(k * 0.449) * R, cz + Math.sin(k * 0.449) * R) > minH) ok = false;
    if (ok) return { druh, cx, cz, R, w: smer * rychlost / R, rychlost, ph, sc };
  }
  return null;
}
function vytvorTvora(def) {
  const m = new THREE.Mesh(geoTvor[def.druh], matTvor[def.druh]);
  m.rotation.order = 'YXZ';
  m.scale.setScalar(def.sc);
  const a = def.ph;
  const t = { ...def, mesh: m, x: def.cx + Math.cos(a) * def.R, z: def.cz + Math.sin(a) * def.R, y: -3, yaw: 0, mod: 'patrola', cd: 0, tm: 0 };
  t.y = Math.min(-1.5, Math.max(-3, vyskaTerenu(t.x, t.z) + 1.2));
  m.position.set(t.x, t.y, t.z);
  scena.add(m);
  return t;
}
const zalom = a => Math.atan2(Math.sin(a), Math.cos(a));
function aktualizujTvora(t, dt, cas) {
  const ang = t.ph + t.w * cas;
  let tx = t.cx + Math.cos(ang) * t.R, tz = t.cz + Math.sin(ang) * t.R, vmax = t.rychlost * 1.4;
  let yT;
  if (t.druh === 'zralok') {
    yT = -0.5 - 3.0 * (0.5 + 0.5 * Math.sin(cas * 0.11 + t.ph * 3));
    t.cd -= dt;
    const dP = Math.hypot(_hrac.x - t.x, _hrac.y - t.y, _hrac.z - t.z);
    if (t.mod === 'patrola' && hlbokaVoda && dP < 55) t.mod = 'utok';
    if (t.mod === 'utok') {
      tx = _hrac.x; tz = _hrac.z; vmax = t.rychlost * 2.0; yT = Math.min(_hrac.y - 0.2, -0.4);
      if (!hlbokaVoda || dP > 100) t.mod = 'patrola';
      else if (dP < 2.6 && t.cd <= 0) {
        t.cd = 3.0; t.mod = 'ustup'; t.tm = 3.5;
        zrani(12, 'Žralok');
        splach(_hrac.x, vyskaVody(_hrac.x, _hrac.z, cas), _hrac.z, 1.0);
      }
    } else if (t.mod === 'ustup') {
      const dx = t.x - _hrac.x, dz = t.z - _hrac.z, l = Math.hypot(dx, dz) || 1;
      tx = t.x + dx / l * 30; tz = t.z + dz / l * 30; vmax = t.rychlost * 1.6;
      t.tm -= dt;
      if (t.tm <= 0) t.mod = 'patrola';
    }
  } else if (t.druh === 'raja') yT = -4 - 3 * (0.5 + 0.5 * Math.sin(cas * 0.07 + t.ph * 2));
  else yT = -3.5 - 2 * Math.sin(cas * 0.09 + t.ph);
  const dx = tx - t.x, dz = tz - t.z, d = Math.hypot(dx, dz), krok = Math.min(d, vmax * dt);
  let rychl = 0;
  if (d > 0.01) {
    const nx = t.x + dx / d * krok, nz = t.z + dz / d * krok;
    if (vyskaTerenu(nx, nz) < (t.druh === 'korytnacka' ? -2 : -3.5)) { t.x = nx; t.z = nz; rychl = krok / dt; }
    t.yaw += zalom(Math.atan2(dx, dz) - t.yaw) * Math.min(1, dt * (t.mod === 'utok' ? 4 : 2.2));
  }
  const dno = vyskaTerenu(t.x, t.z), yMin = dno + (t.druh === 'korytnacka' ? 1.2 : 1.0);
  const cielY = Math.max(yT, yMin), dy = THREE.MathUtils.clamp(cielY - t.y, -1.5 * dt, 1.5 * dt);
  t.y += dy;
  t.mesh.position.set(t.x, t.y, t.z);
  t.mesh.rotation.set(-Math.atan2(dy / dt, Math.max(rychl, 1.5)), t.yaw, Math.sin(cas * 0.4 + t.ph) * 0.06, 'YXZ');
}
function aktualizujTvory(dt, cas, px, pz) {
  casRozhodnutia -= dt;
  if (casRozhodnutia <= 0 || prvy) {
    casRozhodnutia = 0.5;
    const bx = Math.floor(px / CT), bz = Math.floor(pz / CT);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const druh of ['zralok', 'raja', 'korytnacka']) {
      const k = `${druh},${bx + i},${bz + j}`;
      if (tvory.has(k)) continue;
      const def = definujTvora(druh, bx + i, bz + j);
      tvory.set(k, def ? vytvorTvora(def) : false);
    }
    for (const [k, t] of tvory) {
      const p = k.split(',');
      if (Math.abs(+p[1] - bx) > 2 || Math.abs(+p[2] - bz) > 2) { if (t) scena.remove(t.mesh); tvory.delete(k); }
    }
  }
  for (const t of tvory.values()) if (t) aktualizujTvora(t, dt, cas);
}

// ---------- verejne API ----------
export function initMore(s) {
  scena = s;
  for (const T of Object.values(TYP)) {
    T.mesh = new THREE.InstancedMesh(T.geo, T.mat, T.cap);
    T.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(T.cap * 3), 3);
    T.mesh.frustumCulled = false;
    T.mesh.count = 0;
    scena.add(T.mesh);
  }
  const mB = matMore({ hrub: 0.8 });
  meshBarel = new THREE.InstancedMesh(geoBarel(), mB, 40);
  meshDrevo = new THREE.InstancedMesh(geoNaplavene(), mB, 40);
  meshMeduza = new THREE.InstancedMesh(geoMeduza(), matMore({ priesvit: 0.7, emis: 0.5, dvojity: true, hrub: 0.3 }), 150);
  meshMeduza.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(150 * 3), 3);
  for (const m of [meshBarel, meshDrevo, meshMeduza]) { m.frustumCulled = false; m.count = 0; scena.add(m); }
  geoTvor.zralok = geoZralok(); geoTvor.raja = geoRaja(); geoTvor.korytnacka = geoKorytnacka();
  matTvor.zralok = matMore({ sway: 'z', amp: 0.5, freq: 4.4, hrub: 0.5 });
  matTvor.raja = matMore({ sway: 'x', amp: 0.4, freq: 1.7, hrub: 0.6 });
  matTvor.korytnacka = matMore({ sway: 'x', amp: 0.25, freq: 2.0, hrub: 0.7 });
  instMeshe = true;
}

// Kazdy snimok. hracPoz: poloha hraca; podVodou: kamera pod hladinou; kanoePoz: Vector2 (x, z); vKanoe: hrac sedi v kanoe.
export function aktualizujMore(dt, cas, hracPoz, podVodou, kanoePoz, vKanoe) {
  if (!scena || !instMeshe) return;
  dt = Math.min(dt, 0.1);
  uT.value = cas; _cas = cas; _vKanoe = vKanoe; _kanoe = kanoePoz; _hrac = hracPoz;
  const px = vKanoe ? kanoePoz.x : hracPoz.x, pz = vKanoe ? kanoePoz.y : hracPoz.z;
  const voda = vyskaVody(hracPoz.x, hracPoz.z, cas), dnoH = vyskaTerenu(hracPoz.x, hracPoz.z);
  vVode = !vKanoe && (podVodou || hracPoz.y < voda - 0.3) && dnoH < voda - 1.0;
  hlbokaVoda = vVode && dnoH < voda - 7;
  cdZranenie -= dt;
  aktualizujDno(px, pz);
  aktualizujChunky(px, pz);
  aktualizujPlavajuce(cas);
  aktualizujMeduzy(cas);
  aktualizujTvory(dt, cas, px, pz);
  prvy = false;
}

const TEXTY = {
  musla: 'zobrať mušľu', hviezdica: 'zobrať hviezdicu', koral: 'odlomiť koral', ustrica: 'otvoriť ustricu',
  riasa: 'odtrhnúť morskú riasu', truhla: 'otvoriť truhlicu', barel: 'chytiť plávajúci sud', drevo: 'chytiť naplavené drevo',
};
const AKCIE = {
  musla: () => [['musla', 1]],
  hviezdica: () => [['hviezdica', 1]],
  koral: () => [['koral', 1]],
  ustrica: () => (Math.random() < 0.3 ? [['ustrica', 1], ['perla', 1]] : [['ustrica', 1]]),
  riasa: () => [['riasa', Math.random() < 0.5 ? 2 : 1]],
  truhla: () => {
    const v = [['zlata_minca', 4 + Math.floor(Math.random() * 8)], ['nacrt', 1]];   // nacrt = vzacny recept
    if (Math.random() < 0.5) v.push(['stary_kompas', 1]);
    if (Math.random() < 0.6) v.push(['perla', 1 + Math.floor(Math.random() * 2)]);
    if (Math.random() < 0.7) v.push(['utrzok_mapy', 1]);       // utrzok mapy (obsah/mapy.js)
    return v;
  },
  barel: () => [['lano', 1 + Math.floor(Math.random() * 2)], ['drevo', 1], ...(Math.random() < 0.15 ? [['utrzok_mapy', 1]] : [])],
  drevo: () => (Math.random() < 0.5 ? [['drevo', 2], ['vlakno', 1]] : [['drevo', 2]]),
};

// E-pickup na morskom dne / hladine: null alebo { text, akcia }. x, y, z = poloha hraca.
export function najdiMorskyZber(x, y, z) {
  if (!scena || !instMeshe) return null;
  let naj = null, dn = Infinity;
  const px = _vKanoe ? _kanoe.x : x, pz = _vKanoe ? _kanoe.y : z, dosah = _vKanoe ? 4.5 : 1.8;
  for (const ch of chunky.values()) {
    for (const p of ch.plav) {
      if (p.hotovo) continue;
      const d = Math.hypot(p.x - px, p.z - pz);
      if (d < dosah && d < dn && (_vKanoe || Math.abs(y - p.y) < 2.5)) { dn = d; naj = { druh: p.typ, ch, p }; }
    }
  }
  if (!_vKanoe) {
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const ch = chunky.get((cx + i) + ',' + (cz + j));
      if (!ch) continue;
      for (const q of ch.zb) {
        if (q.hotovo) continue;
        const d = Math.hypot(q.x - x, q.y + 0.25 - (y + 0.6), q.z - z);
        if (d < 1.8 && d < dn) { dn = d; naj = { druh: q.druh, ch, q }; }
      }
    }
  }
  if (!naj) return null;
  return {
    text: TEXTY[naj.druh],
    akcia: () => {
      if (naj.p) {
        if (naj.p.hotovo) return [];
        naj.p.hotovo = true;
        if (naj.p.obsah) return naj.p.obsah;           // sud s nakladom z potopenej lode
        zobrate.add(naj.p.id);
      } else {
        const q = naj.q;
        if (q.hotovo) return [];
        q.hotovo = true; zobrate.add(q.id);
        const d = naj.ch.d[q.typ];
        d.m.fill(0, q.i * 16, q.i * 16 + 16); d.m[q.i * 16 + 15] = 1;       // nulova velkost = zmizne
        dirty = true; prestavInst();
      }
      return AKCIE[naj.druh]();
    },
  };
}
