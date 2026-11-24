// Stylizovane modely predmetov ("cozy tropicky" vzhlad: oble tvary, syte farby, jemne prechody).
// Vsetko je kod - ziadne textury. Farba je vo vrcholoch (vertex colors), takze 1 predmet = 1 geometria + 1 material.
//
// Postup pri novom modeli:
//   let g = hladka(new THREE.SphereGeometry(...));     // jemna siet, spojene vrcholy => hladke tienovanie
//   tvar(g, (v, c) => { ...posun v (Vector3)...; c.set(...)  });  // deformacia + farba v jednom cykle
//   g = naZem(g); ao(g, 0.05);                         // spodok na y = 0, tmavsie pri zemi
//   model: [dokonci(g, dalsiDiel...), MAT_STYL]
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- sum (deterministicky, bez kniznic) ----------
const fract = x => x - Math.floor(x);
const hash = (x, y, z) => fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);
const hl = t => t * t * (3 - 2 * t);
export function sum(x, y, z) {   // hodnotovy sum 0..1, plynuly
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = hl(x - xi), v = hl(y - yi), w = hl(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  const k = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
  return l(l(l(k(0, 0, 0), k(1, 0, 0), u), l(k(0, 1, 0), k(1, 1, 0), u), v),
           l(l(k(0, 0, 1), k(1, 0, 1), u), l(k(0, 1, 1), k(1, 1, 1), u), v), w);
}
export function fbm(x, y, z, oktavy = 3) {   // viac vrstiev sumu (velke + male nerovnosti), 0..1
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oktavy; i++) { s += a * sum(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
export { hash };
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- praca s geometriou ----------
// odstrani uv/normaly a spoji rovnake vrcholy => po deformacii zostane povrch hladky (bez svov)
export function hladka(geo) {
  geo.deleteAttribute('uv'); geo.deleteAttribute('normal');
  return mergeVertices(geo);
}
// prejde vsetky vrcholy: fn(v, c, i) moze posunut v a nastavit farbu c (THREE.Color, na zaciatku biela)
const _v = new THREE.Vector3(), _c = new THREE.Color();
export function tvar(geo, fn) {
  const p = geo.attributes.position, n = p.count;
  const col = geo.attributes.color?.array || new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    _v.fromBufferAttribute(p, i);
    if (geo.attributes.color) _c.fromArray(col, i * 3); else _c.setRGB(1, 1, 1);
    fn(_v, _c, i);
    p.setXYZ(i, _v.x, _v.y, _v.z);
    _c.toArray(col, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.deleteAttribute('normal');
  return geo;
}
// cela geometria jednou farbou
export const jednofarebna = (geo, hex) => { const c = new THREE.Color(hex); return tvar(geo, (v, k) => k.copy(c)); };
// posunie geometriu tak, aby spodok bol na y = 0 (a stred v x/z na 0)
export function naZem(geo) {
  geo.computeBoundingBox(); const b = geo.boundingBox;
  return geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
}
// "ambient occlusion" nalacno: vrcholy pri zemi stmavne (predmet nevyzera, ze levituje)
export function ao(geo, vyska = 0.05, sila = 0.45) {
  const p = geo.attributes.position, c = geo.attributes.color;
  for (let i = 0; i < p.count; i++) {
    const k = 1 - sila * (1 - smooth(0, vyska, p.getY(i)));
    c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
  }
  return geo;
}
// spoji diely do jednej geometrie (kazdy diel: normaly, farba; bez indexu a uv)
export function dokonci(...diely) {
  return mergeGeometries(diely.map(g => {
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.color) jednofarebna(g, 0xffffff).computeVertexNormals();
    g = g.index ? g.toNonIndexed() : g;
    g.deleteAttribute('uv');
    return g;
  }));
}
// lano/vlakno: torus so skrutkovicovym pruhovanim (vyzera ako stocene vlakna)
export function lano(R, r, hex, zavity = 22) {
  const g = hladka(new THREE.TorusGeometry(R, r, 6, 20));
  const a = new THREE.Color(hex), b = new THREE.Color(hex).multiplyScalar(0.62);
  return tvar(g, (v, c) => {
    const u = Math.atan2(v.y, v.x), d = Math.hypot(v.x, v.y), w = Math.atan2(v.z, d - R);
    c.copy(a).lerp(b, smooth(0.2, 0.9, Math.sin(u * zavity + w * 2) * 0.5 + 0.5));
  });
}

// ---------- material ----------
// MeshStandardMaterial + jemny "rim" (okraje proti kamere sa prisvietia) - typicky rozpravkovy vzhlad.
// Rim zosilnuje len uz osvetlenu farbu, takze v noci predmety nesvietia.
export function stylMat(o = {}, rim = 0.55) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, ...o });
  m.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      { float rim = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 2.5);
        reflectedLight.directDiffuse *= 1.0 + rim * ${rim.toFixed(3)};
        reflectedLight.indirectDiffuse *= 1.0 + rim * ${(rim * 1.6).toFixed(3)}; }`);
  };
  m.customProgramCacheKey = () => 'styl' + rim;
  return m;
}
export const MAT_STYL = stylMat();
