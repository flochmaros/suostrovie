// Nekonecny svet: more je rozdelene na stvorce (bunky) 520 x 520 m. Kazda bunka ma 0 alebo 1 ostrov.
// Ostrov sa vypocita zo SEED a suradnic bunky -> rovnaky seed = vzdy rovnaky svet.
// Do grafiky nahravame len bunky okolo hraca, vzdialene mazeme.
import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { hash, rng } from './nahoda.js';
import { uCas, uPriliv } from './ocean.js';
import { postavVegetaciu } from './vegetacia.js';
import { PREDMETY } from './obsah/predmety.js';

export const SEED = 1337;
export const BUNKA = 520;
export const DNO = -32;
const POLOMER_NAHRAVANIA = 2;          // 5 x 5 buniek okolo hraca

const perlin = new ImprovedNoise();
const ostrovy = new Map();             // "x,z" -> data ostrova alebo null
const nahrate = new Map();             // "x,z" -> { skupina, teren, uzly } alebo null
export const zobrate = new Set();      // id zobratych predmetov a znicenych uzlov (uklada sa)
let scena;

function fbm(x, z, s) {
  return perlin.noise(x, z, s) + 0.5 * perlin.noise(x * 2.1, z * 2.1, s + 3.3) + 0.25 * perlin.noise(x * 4.3, z * 4.3, s + 7.7);
}

const SLABIKY = ['ka', 'lo', 'ma', 'nu', 'te', 'ri', 'wa', 'po', 'le', 'hi', 'ko', 'mo', 'na', 'ta', 'vai', 'ru', 'ae', 'li'];
function meno(r) {
  let s = '';
  for (let i = 0, n = 2 + Math.floor(r() * 2); i < n; i++) s += SLABIKY[Math.floor(r() * SLABIKY.length)];
  return s[0].toUpperCase() + s.slice(1);
}

// ---------- data ostrova ----------
export function ostrovVBunke(bx, bz) {
  const kluc = bx + ',' + bz;
  if (ostrovy.has(kluc)) return ostrovy.get(kluc);
  const r = rng(hash(bx, bz, SEED));
  let o = null;
  const start = bx === 0 && bz === 0;
  if (start || r() < 0.72) {
    const R = start ? 95 : 30 + 115 * r() * r();
    const ext = R * 1.8;
    const volno = BUNKA - 2 * ext;
    const b = r();
    const biom = start ? 'palmovy' : b < 0.45 ? 'palmovy' : b < 0.8 ? 'dzungla' : 'skalnaty';
    o = {
      bx, bz, R, ext, biom,
      x: bx * BUNKA + ext + (start ? volno / 2 : r() * volno),
      z: bz * BUNKA + ext + (start ? volno / 2 : r() * volno),
      H: (5 + R * (0.08 + r() * 0.2)) * (biom === 'skalnaty' ? 1.6 : 1),
      seed: Math.floor(r() * 1000),
      meno: meno(r),
    };
  }
  ostrovy.set(kluc, o);
  return o;
}

function vyskaOstrova(o, x, z) {
  const d = Math.hypot(x - o.x, z - o.z) / o.R;
  if (d > 1.8) return DNO;
  const t = 1 - d + 0.28 * fbm(x * 0.012, z * 0.012, o.seed);   // t > 0 = sucho
  let h;
  if (t >= 0) h = o.H * Math.pow(t, 1.4) + fbm(x * 0.05, z * 0.05, o.seed + 7) * 1.5 * Math.min(1, t * 4);
  else h = -(-t * 14 + t * t * 80);                              // plytka laguna, potom hlbka
  return Math.max(h, DNO);
}

export function vyskaTerenu(x, z) {
  const o = ostrovVBunke(Math.floor(x / BUNKA), Math.floor(z / BUNKA));
  return o ? vyskaOstrova(o, x, z) : DNO;
}

export function ostrovPri(x, z, faktor = 1.0) {
  const o = ostrovVBunke(Math.floor(x / BUNKA), Math.floor(z / BUNKA));
  return o && Math.hypot(x - o.x, z - o.z) < o.R * faktor ? o : null;
}

// ---------- teren: farby vo vrcholoch + shader (mokry piesok, jemna struktura, kaustiky pod vodou) ----------
const KAUSTIKA = /* glsl */`
float kaustika(vec2 p, float t) {
  p *= 0.45;
  vec2 w = p + vec2(sin(p.y * 1.3 + t * 0.8), cos(p.x * 1.1 - t * 0.6));
  float a = abs(sin(w.x * 2.0 + t) + sin(w.y * 2.0 - t * 0.7));
  vec2 w2 = p * 1.7 + vec2(cos(p.y * 0.9 - t * 0.5), sin(p.x * 1.4 + t * 0.7));
  float b = abs(sin(w2.x * 2.0 - t * 0.8) + sin(w2.y * 2.0 + t * 0.6));
  return pow(1.0 - min(a, 1.0), 6.0) + pow(1.0 - min(b, 1.0), 6.0) * 0.6;
}
`;
const matTeren = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, envMapIntensity: 0.3 });
matTeren.onBeforeCompile = sh => {
  sh.uniforms.uCas = uCas;
  sh.uniforms.uPriliv = uPriliv;
  sh.vertexShader = 'varying vec3 vSvetP;\n' + sh.vertexShader.replace('#include <begin_vertex>',
    '#include <begin_vertex>\nvSvetP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = 'uniform float uCas;\nuniform float uPriliv;\nvarying vec3 vSvetP;\n' + KAUSTIKA + sh.fragmentShader
    .replace('#include <color_fragment>', `#include <color_fragment>
      float nadVodou = vSvetP.y - uPriliv;
      float jemny = sin(vSvetP.x * 2.3 + sin(vSvetP.z * 1.7)) * sin(vSvetP.z * 2.1 + sin(vSvetP.x * 1.3))
                  + 0.5 * sin(vSvetP.x * 7.1 + vSvetP.z * 3.3) * sin(vSvetP.z * 6.3 - vSvetP.x * 2.9);
      diffuseColor.rgb *= 1.0 + jemny * 0.045;
      diffuseColor.rgb *= 1.0 - 0.32 * (1.0 - smoothstep(-0.1, 1.0, nadVodou)) * step(-0.6, nadVodou);`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float hl = uPriliv - vSvetP.y;
      totalEmissiveRadiance += vec3(0.8, 0.95, 1.0) * kaustika(vSvetP.xz, uCas * 1.3) * diffuseColor.rgb
        * smoothstep(0.0, 0.5, hl) * (1.0 - smoothstep(3.0, 12.0, hl)) * 1.6;`);
};

const FARBY = {
  dno: C(0xcfb383), piesok: C(0xe0c48e), hlina: C(0x8a6c48), skala: C(0x87827a),
  palmovy: [C(0x6aa83a), C(0x4f8f2e)], dzungla: [C(0x3f8a28), C(0x2a6320)], skalnaty: [C(0x7f9a48), C(0x63783e)],
};
function C(h) { return new THREE.Color(h); }

function postavTeren(o) {
  const seg = Math.round(THREE.MathUtils.clamp(o.R * 1.15, 70, 170));
  const geo = new THREE.PlaneGeometry(o.ext * 2, o.ext * 2, seg, seg).rotateX(-Math.PI / 2);
  geo.deleteAttribute('uv');
  const poz = geo.attributes.position;
  for (let i = 0; i < poz.count; i++) poz.setY(i, vyskaOstrova(o, o.x + poz.getX(i), o.z + poz.getZ(i)));
  geo.computeVertexNormals();

  const nor = geo.attributes.normal, farby = new Float32Array(poz.count * 3), c = new THREE.Color(), t2 = new THREE.Color();
  const [tr1, tr2] = FARBY[o.biom];
  for (let i = 0; i < poz.count; i++) {
    const x = poz.getX(i) + o.x, z = poz.getZ(i) + o.z, h = poz.getY(i), strmost = 1 - nor.getY(i);
    const n = perlin.noise(x * 0.08, z * 0.08, o.seed + 1);
    const hranica = 1.4 + n * 0.6;                       // kde konci plaz (nerovno)
    t2.copy(tr1).lerp(tr2, THREE.MathUtils.clamp((h - 2) / (o.H * 0.8) + n * 0.4, 0, 1));
    if (perlin.noise(x * 0.04, z * 0.04, o.seed + 5) > 0.35) t2.lerp(FARBY.hlina, 0.5);   // flaky hliny
    c.copy(FARBY.dno).lerp(FARBY.piesok, THREE.MathUtils.smoothstep(h, -2, 0.3));
    c.lerp(t2, THREE.MathUtils.smoothstep(h, hranica, hranica + 0.8));
    c.lerp(FARBY.skala, THREE.MathUtils.smoothstep(strmost, 0.22, 0.38) * (h > 0.5 ? 1 : 0.3));
    c.offsetHSL(0, 0, n * 0.03);
    farby.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(farby, 3));
  const teren = new THREE.Mesh(geo, matTeren);
  teren.position.set(o.x, 0, o.z);
  teren.receiveShadow = true;
  return teren;
}

// predmety lezace na zemi (zdvihnu sa na E)
function postavPredmety(o, skupina, r) {
  let i = 0;
  const pridaj = (typ, x, z) => {
    const id = `${o.bx},${o.bz},p${i++}`;
    const otocenie = r() * 6.28;                         // r() volat vzdy, aby sa neposunuli dalsie nahodne cisla
    if (zobrate.has(id)) return;
    const [geo, mat] = PREDMETY[typ].model;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, vyskaOstrova(o, x, z), z);
    m.rotation.y = otocenie;
    m.castShadow = true;
    m.userData = { id, typ };
    skupina.add(m);
  };
  for (let k = 0; k < o.R * 0.6; k++) {
    const a = r() * 6.28, d = o.R * (0.45 + r() * 0.7);
    const x = o.x + Math.cos(a) * d, z = o.z + Math.sin(a) * d, h = vyskaOstrova(o, x, z);
    const typ = h < 1.5 ? (r() < 0.4 ? 'musla' : r() < 0.6 ? 'palica' : 'kamen') : (r() < 0.5 ? 'palica' : r() < 0.6 ? 'kamen' : 'kokos');
    if (h > 0.25) pridaj(typ, x, z);
  }
}

function postavOstrov(o) {
  const skupina = new THREE.Group();
  const teren = postavTeren(o);
  skupina.add(teren);
  const uzly = postavVegetaciu(o, skupina, rng(o.seed * 7919 + 1), (x, z) => vyskaOstrova(o, x, z), zobrate);
  postavPredmety(o, skupina, rng(o.seed * 104729 + 3));
  return { skupina, teren, uzly };
}

export function initSvet(s) { scena = s; }

// Volat kazdy snimok: nahra najblizsiu chybajucu bunku (max 1 za snimok, aby hra nesekala)
export function aktualizujSvet(x, z) {
  const bx = Math.floor(x / BUNKA), bz = Math.floor(z / BUNKA);
  let najlepsia = null, najmenej = Infinity;
  for (let i = -POLOMER_NAHRAVANIA; i <= POLOMER_NAHRAVANIA; i++) {
    for (let j = -POLOMER_NAHRAVANIA; j <= POLOMER_NAHRAVANIA; j++) {
      const kluc = (bx + i) + ',' + (bz + j);
      if (nahrate.has(kluc)) continue;
      const d = i * i + j * j;
      if (d < najmenej) { najmenej = d; najlepsia = [bx + i, bz + j, kluc]; }
    }
  }
  if (najlepsia) {
    const o = ostrovVBunke(najlepsia[0], najlepsia[1]);
    const zaznam = o ? postavOstrov(o) : null;
    if (zaznam) scena.add(zaznam.skupina);
    nahrate.set(najlepsia[2], zaznam);
  }
  for (const [kluc, z] of nahrate) {
    const [kx, kz] = kluc.split(',').map(Number);
    if (Math.abs(kx - bx) > POLOMER_NAHRAVANIA + 1 || Math.abs(kz - bz) > POLOMER_NAHRAVANIA + 1) {
      if (z) {
        scena.remove(z.skupina);
        z.teren.geometry.dispose();                      // ostatne geometrie su zdielane
        z.skupina.traverse(m => { if (m.isInstancedMesh) m.dispose(); });
      }
      nahrate.delete(kluc);
    }
  }
  return najlepsia === null;                             // true = vsetko okolo je nahrate
}

// uzly (stromy, kriky, balvany) ostrova v bunke, kde je bod
export function uzlyPri(x, z) {
  return nahrate.get(Math.floor(x / BUNKA) + ',' + Math.floor(z / BUNKA))?.uzly ?? [];
}

export function najblizsiPredmet(x, z, d = 2.0) {
  let naj = null;
  const zaznam = nahrate.get(Math.floor(x / BUNKA) + ',' + Math.floor(z / BUNKA));
  if (!zaznam) return null;
  for (const m of zaznam.skupina.children) {
    if (!m.userData.typ) continue;
    const v = Math.hypot(m.position.x - x, m.position.z - z);
    if (v < d) { d = v; naj = m; }
  }
  return naj;
}

export function zober(m) {
  zobrate.add(m.userData.id);
  m.parent.remove(m);
}

// Startovacie miesto: plaz na vychodnej strane startovacieho ostrova
export function startovaciaPozicia() {
  const o = ostrovVBunke(0, 0);
  let x = o.x;
  while (vyskaOstrova(o, x, o.z) > 0.8) x += 1;
  const plaz = { x: x - 5, z: o.z };
  while (vyskaOstrova(o, x, o.z) > -1.0) x += 1;
  return { hrac: plaz, kanoe: { x: x + 2, z: o.z } };
}
