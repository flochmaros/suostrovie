// Nekonecny svet: more je rozdelene na stvorce (bunky) 520 x 520 m. Kazda bunka ma 0 alebo 1 ostrov.
// Ostrov sa vypocita zo SEED a suradnic bunky -> rovnaky seed = vzdy rovnaky svet.
// Do grafiky nahravame len bunky okolo hraca, vzdialene mazeme.
import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { hash, rng } from './nahoda.js';
import { uCas, uPriliv } from './ocean.js';
import { postavVegetaciu, uvolniVegetaciu } from './vegetacia.js';
import { PREDMETY } from './obsah/predmety.js';

export const SEED = 1337;
export const BUNKA = 520;
export const DNO = -32;
const POLOMER_NAHRAVANIA = 2;          // 5 x 5 buniek okolo hraca

// ---------- pasma (cim dalej od startu, tym drsnejsie more a vzacnejsie ostrovy) ----------
// hranice v metroch od stredu startovej bunky; pasmo 1..5
export const PASMA = [null,
  { meno: 'Domovské ostrovy', do: 1200, lod: 'kanoe I' },
  { meno: 'Sopečné ostrovy', do: 2400, lod: 'kanoe II' },
  { meno: 'Mangrovové močiare', do: 3800, lod: 'kanoe III + lano' },
  { meno: 'Búrkové útesy', do: 5400, lod: 'katamarán / plachta' },
  { meno: 'Hmlisté ostrovy', do: Infinity, lod: 'kompas + mapa' },
];
// vzdialenost od startu so setrvacnym sumom podla uhla (+-12 %): hranice pasiem nie su dokonale kruhy, ale maju zalivy a vyspy
export function vzdialenostOdStartu(x, z) {
  const dx = x - BUNKA / 2, dz = z - BUNKA / 2, d = Math.hypot(dx, dz);
  if (d < 1) return d;
  const a = Math.atan2(dz, dx);
  return d / (1 + 0.12 * sumUhol(a));
}
const sumUhol = a => 0.5 * Math.sin(2 * a + 1.3) + 0.3 * Math.sin(3 * a + 4.1) + 0.2 * Math.sin(5 * a + 0.7);
// presny polomer hranice pasma i (vonkajsia hranica) v smere uhla a od stredu startovej bunky (na kreslenie mapy)
export function polomerPasma(i, a) { return PASMA[i].do * (1 + 0.12 * sumUhol(a)); }
export function pasmo(x, z) {
  const d = vzdialenostOdStartu(x, z);
  for (let i = 1; i < PASMA.length; i++) if (d < PASMA[i].do) return i;
  return 5;
}
// plynula hodnota 1.0..5.0 (na prechody vln medzi pasmami)
export function pasmoPlynule(x, z) {
  const d = vzdialenostOdStartu(x, z);
  for (let i = 1; i < PASMA.length; i++) {
    if (d < PASMA[i].do) return i + (isFinite(PASMA[i].do) ? Math.max(0, (d - (PASMA[i].do - 200)) / 200) : 0);
  }
  return 5;
}

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
// Typy ostrovov (biomy) a ich pravdepodobnost; kazdy ma vlastny tvar terenu (vyskaOstrova) a farby (TEREN)
const TYPY = [['palmovy', 0.17], ['dzungla', 0.12], ['skalnaty', 0.08], ['atol', 0.11], ['sopecny', 0.07],
  ['mangrovy', 0.09], ['bambusovy', 0.09], ['savana', 0.10], ['plytcina', 0.08], ['ovocny', 0.09]];
export const BIOM_MENO = {
  palmovy: 'Palmový ostrov', dzungla: 'Džungľa', skalnaty: 'Skalnatý ostrov', atol: 'Atol s lagúnou', sopecny: 'Sopečný ostrov',
  mangrovy: 'Mangrovový močiar', bambusovy: 'Bambusový ostrov', savana: 'Savana', plytcina: 'Piesočná plytčina', ovocny: 'Ovocný ostrov',
};

// vahy biomov podla pasma (poradie = TYPY); chybajuci biom = 0
const VAHY_PASMA = [null,
  { palmovy: 0.22, dzungla: 0.14, atol: 0.14, plytcina: 0.1, savana: 0.12, ovocny: 0.1, bambusovy: 0.1, skalnaty: 0.08 },
  { sopecny: 0.45, skalnaty: 0.2, plytcina: 0.15, palmovy: 0.2 },
  { mangrovy: 0.5, dzungla: 0.28, bambusovy: 0.22 },
  { skalnaty: 0.4, atol: 0.3, plytcina: 0.3 },
  null,                                                   // pasmo 5: zmes vsetkeho (TYPY)
];
function vyberBiom(b, p) {
  const tab = VAHY_PASMA[p];
  if (!tab) { let suma = 0; for (const [biom, vaha] of TYPY) { suma += vaha; if (b < suma) return biom; } return 'palmovy'; }
  let suma = 0, posledny = 'palmovy';
  const celkom = Object.values(tab).reduce((a, v) => a + v, 0);
  for (const biom in tab) { suma += tab[biom] / celkom; posledny = biom; if (b < suma) return biom; }
  return posledny;
}

export function ostrovVBunke(bx, bz) {
  const kluc = bx + ',' + bz;
  if (ostrovy.has(kluc)) return ostrovy.get(kluc);
  const r = rng(hash(bx, bz, SEED));
  let o = null;
  const start = bx === 0 && bz === 0;
  if (start || r() < 0.72) {
    const b = r();
    const pas = pasmo(bx * BUNKA + BUNKA / 2, bz * BUNKA + BUNKA / 2);
    const biom = start ? 'palmovy' : vyberBiom(b, pas);
    let R;
    if (start) R = 95;
    else if (biom === 'plytcina') R = 14 + 16 * r();
    else if (biom === 'atol') R = 55 + 70 * r();
    else if (biom === 'sopecny') R = 35 + 75 * r();
    else if (biom === 'mangrovy') R = 40 + 80 * r();
    else R = 30 + 115 * r() * r();
    const ext = R * 1.8;
    const volno = BUNKA - 2 * ext;
    const v = r();                                        // nahodne cislo na vysku (volat vzdy)
    const H = {
      sopecny: 12 + R * (0.3 + 0.2 * v), atol: 2.6 + v, mangrovy: 3, plytcina: 2.2 + v, savana: 3.5 + R * 0.04 * (1 + v),
      skalnaty: (5 + R * (0.08 + v * 0.2)) * 1.6, bambusovy: 6 + R * (0.08 + v * 0.15), ovocny: 5 + R * (0.06 + v * 0.1),
    }[biom] ?? (5 + R * (0.08 + v * 0.2));
    o = {
      bx, bz, R, ext, biom, pasmo: pas,
      x: bx * BUNKA + ext + (start ? volno / 2 : r() * volno),
      z: bz * BUNKA + ext + (start ? volno / 2 : r() * volno),
      H,
      seed: Math.floor(r() * 1000),
      meno: meno(r),
    };
  }
  ostrovy.set(kluc, o);
  return o;
}

// zakladny tvar: kopec s plazou, za okrajom plytka laguna a hlbka
function tvarZaklad(o, x, z, d) {
  const t = 1 - d + 0.28 * fbm(x * 0.012, z * 0.012, o.seed);   // t > 0 = sucho
  if (t >= 0) return o.H * Math.pow(t, 1.4) + fbm(x * 0.05, z * 0.05, o.seed + 7) * 1.5 * Math.min(1, t * 4);
  return -(-t * 14 + t * t * 80);
}

function surovaVyska(o, x, z) {
  const dx = x - o.x, dz = z - o.z;
  let d = Math.hypot(dx, dz) / o.R;
  let h;
  switch (o.biom) {
    case 'plytcina': {                                    // pretiahnuta piesocna kosa
      const a = o.seed * 0.0063, u = dx * Math.cos(a) + dz * Math.sin(a), v = -dx * Math.sin(a) + dz * Math.cos(a);
      d = Math.hypot(u / 1.2, v * 1.15) / o.R;
      if (d > 1.8) return NIC;
      const t = 1 - d + 0.28 * fbm(x * 0.02, z * 0.02, o.seed);
      h = t >= 0 ? o.H * Math.pow(Math.min(t * 2.2, 1), 0.9) + fbm(x * 0.08, z * 0.08, o.seed + 7) * 0.25 : -(-t * 12 + t * t * 80);
      break;
    }
    case 'atol': {                                        // prstenec okolo plytkej lagúny
      if (d > 1.8) return NIC;
      const t = 1 - Math.abs(d - 0.72) / 0.26 + 0.22 * fbm(x * 0.012, z * 0.012, o.seed);
      if (t >= 0) h = o.H * Math.pow(t, 1.1) + fbm(x * 0.05, z * 0.05, o.seed + 7) * 0.5 * Math.min(1, t * 4);
      else if (d < 0.72) h = -Math.min(-t * 7, 1.7) + fbm(x * 0.04, z * 0.04, o.seed + 3) * 0.12;
      else h = -(-t * 14 + t * t * 80);
      break;
    }
    case 'sopecny': {                                     // kuzel s kraterom a ryhami po lave
      if (d > 1.8) return NIC;
      const t = 1 - d + 0.12 * fbm(x * 0.012, z * 0.012, o.seed);
      if (t >= 0) {
        const c = Math.max(0, 1 - d / 0.2);
        const ryha = Math.max(0, 1 - Math.abs(perlin.noise(x * 0.03, z * 0.03, o.seed + 5)) * 5);
        h = o.H * Math.pow(t, 1.5) - o.H * 0.5 * c * c - ryha * 2.0 * Math.min(1, t * 2) * t
          + fbm(x * 0.06, z * 0.06, o.seed + 7) * 1.1 * Math.min(1, t * 4);
      } else h = -(-t * 16 + t * t * 80);
      break;
    }
    case 'mangrovy': {                                    // plocha blatnata zem s kanalmi
      if (d > 1.8) return NIC;
      const t = 1 - d + 0.3 * fbm(x * 0.012, z * 0.012, o.seed);
      if (t >= 0) {
        const kanal = Math.max(0, 1 - Math.abs(perlin.noise(x * 0.03, z * 0.03, o.seed + 9)) * 6) * Math.min(1, t * 3);
        h = -0.7 + o.H * Math.pow(t, 0.9) + fbm(x * 0.06, z * 0.06, o.seed + 7) * 0.35 - kanal * 0.9;
      } else h = -0.7 - (-t * 14 + t * t * 80);
      break;
    }
    case 'savana': {                                      // siroka nizka plan s jemnymi kopcami
      if (d > 1.8) return NIC;
      const t = 1 - d + 0.22 * fbm(x * 0.01, z * 0.01, o.seed);
      if (t >= 0) {
        const p = Math.min(1, t * 3);
        h = o.H * 0.8 * p * p * (3 - 2 * p) + fbm(x * 0.02, z * 0.02, o.seed + 9) * 0.9 * p;
      } else h = -(-t * 14 + t * t * 80);
      break;
    }
    default:
      if (d > 1.8) return NIC;
      h = tvarZaklad(o, x, z, d);
  }
  _d = d;
  return h;
}

// ---------- morske dno: duny, hlbka -12..-45 m, plytke lavice (-4..-9 m) ----------
const NIC = -9999;                                       // znacka "mimo ostrova"
let _d = 2;                                              // vzdialenost (v polomeroch) z poslednej surovaVyska
function hladkyMax(a, b, k) {
  const d = Math.abs(a - b), m = Math.max(a, b);
  if (d >= k) return m;
  const t = (k - d) / k;
  return m + t * t * k * 0.25;
}
export function dnoMorske(x, z) {
  const a = perlin.noise(x * 0.0042, z * 0.0042, 11.3);   // siroke panvy a vyvysenia
  const b = perlin.noise(x * 0.017, z * 0.017, 4.1);      // duny
  const c = perlin.noise(x * 0.06 + 13, z * 0.06, 9.9);   // drobne vlnenie
  let h = THREE.MathUtils.clamp(-29 + a * 15 + b * 5 + c * 1.2, -46, -11);
  const s = THREE.MathUtils.smoothstep(perlin.noise(x * 0.0065 + 50, z * 0.0065, 21.7), 0.22, 0.5);   // lavice
  if (s > 0) h += (-5.2 - 3.6 * (0.5 + 0.5 * b) + c * 0.5 - h) * s;
  return h;
}
const FD1 = C(0xdcc995), FD2 = C(0x7d8a86), FD3 = C(0x3e5260), FD4 = C(0x4f7048);
// farba morskeho dna podla hlbky (+ tmavsie trávne laky); pouziva aj morske dno v more.js
export function farbaDna(h, x, z, out) {
  const g = perlin.noise(x * 0.03 + 7, z * 0.03, 2.2);
  out.copy(FD1).lerp(FD2, 1 - THREE.MathUtils.smoothstep(h, -22, -4));
  out.lerp(FD3, 1 - THREE.MathUtils.smoothstep(h, -46, -20));
  if (g > 0.12) out.lerp(FD4, Math.min((g - 0.12) * 3, 0.7) * THREE.MathUtils.smoothstep(h, -20, -8));
  const r = perlin.noise(x * 0.4, z * 0.4, 1.1);
  out.multiplyScalar(0.94 + r * 0.08);
  return out;
}

function vyskaOstrova(o, x, z) {
  const f = dnoMorske(x, z);
  const h = surovaVyska(o, x, z);
  if (h <= NIC + 1) return f;
  const w = THREE.MathUtils.smoothstep(_d, 1.3, 1.8);   // svah ostrova plynule prejde do dna
  const m = hladkyMax(h, f, 6);
  return m + (f - m) * w;
}

export function vyskaTerenu(x, z) {
  const o = ostrovVBunke(Math.floor(x / BUNKA), Math.floor(z / BUNKA));
  return o ? vyskaOstrova(o, x, z) : dnoMorske(x, z);
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
export const KAUSTIKA_GLSL = KAUSTIKA;
// hodnotovy sum 0..1 pre farbu terenu
const SUM_T = `
float hashT(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sumT(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hashT(i), hashT(i + vec2(1, 0)), f.x), mix(hashT(i + vec2(0, 1)), hashT(i + 1.0), f.x), f.y);
}
`;
export const matTeren = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, envMapIntensity: 0.3,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });   // ostrov vyhra nad morskym dnom (z-fighting)
matTeren.onBeforeCompile = sh => {
  sh.uniforms.uCas = uCas;
  sh.uniforms.uPriliv = uPriliv;
  sh.vertexShader = 'varying vec3 vSvetP;\n' + sh.vertexShader.replace('#include <begin_vertex>',
    '#include <begin_vertex>\nvSvetP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = 'uniform float uCas;\nuniform float uPriliv;\nvarying vec3 vSvetP;\n' + KAUSTIKA + SUM_T + sh.fragmentShader
    .replace('#include <color_fragment>', `#include <color_fragment>
      float nadVodou = vSvetP.y - uPriliv;
      float jemny = sin(vSvetP.x * 2.3 + sin(vSvetP.z * 1.7)) * sin(vSvetP.z * 2.1 + sin(vSvetP.x * 1.3))
                  + 0.5 * sin(vSvetP.x * 7.1 + vSvetP.z * 3.3) * sin(vSvetP.z * 6.3 - vSvetP.x * 2.9);
      diffuseColor.rgb *= 1.0 + jemny * 0.045;
      // trava nie je jednoliata: suchsie zltkave a sviezejsie tmave flaky + drobna zrnitost (aj piesok)
      float zelen = smoothstep(0.0, 0.06, diffuseColor.g - diffuseColor.r) * step(0.0, nadVodou);
      float flak = sumT(vSvetP.xz * 0.07) * 0.7 + sumT(vSvetP.xz * 0.21) * 0.3;
      float zrno = sumT(vSvetP.xz * 1.3) * 0.6 + sumT(vSvetP.xz * 4.7) * 0.4;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.4, 1.18, 0.55), smoothstep(0.55, 0.78, flak) * zelen * 0.75);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.7, 0.92, 0.68), smoothstep(0.42, 0.2, flak) * zelen);
      diffuseColor.rgb *= 1.0 + (zrno - 0.5) * (0.1 + 0.3 * zelen);
      diffuseColor.rgb *= 1.0 - 0.32 * (1.0 - smoothstep(-0.1, 1.0, nadVodou)) * step(-0.6, nadVodou);`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float hl = uPriliv - vSvetP.y;
      totalEmissiveRadiance += vec3(0.8, 0.95, 1.0) * kaustika(vSvetP.xz, uCas * 1.3) * diffuseColor.rgb
        * smoothstep(0.0, 0.5, hl) * (1.0 - smoothstep(3.0, 12.0, hl)) * 1.6;`);
};

const FARBY = {
  dno: C(0xcfb383), piesok: C(0xe0c48e), hlina: C(0x8a6c48), skala: C(0x87827a),
};
function C(h) { return new THREE.Color(h); }
// farby terenu podla biomu: tr = [nizsia, vyssia] trava, piesok (plaz), dno, skala (strme svahy), hl (flaky), hlPrah (kolko flakov),
// plaz = vyska, od ktorej zacina vegetacia
const TEREN = {
  palmovy:   { tr: [0x6aa83a, 0x4f8f2e], plaz: 1.4 },
  dzungla:   { tr: [0x3f8a28, 0x2a6320], plaz: 1.4 },
  skalnaty:  { tr: [0x7f9a48, 0x63783e], plaz: 1.4 },
  atol:      { tr: [0x86bf4e, 0x6aa83a], piesok: 0xf2e2b4, dno: 0xe6d6a6, skala: 0xa6a094, hl: 0xc9b27a, hlPrah: 0.2, plaz: 0.9 },
  sopecny:   { tr: [0x4a5a38, 0x2e2a28], piesok: 0x2b2927, dno: 0x3a3835, skala: 0x34302e, hl: 0x5a3226, hlPrah: -0.15, plaz: 0.7 },
  mangrovy:  { tr: [0x4d6b34, 0x3b5a2c], piesok: 0x6e5f45, dno: 0x5a5040, skala: 0x5f5a4c, hl: 0x4a4030, hlPrah: 0.1, plaz: 0.3 },
  bambusovy: { tr: [0x79a83a, 0x5c8c2e], plaz: 1.4 },
  savana:    { tr: [0xb2ad5c, 0x8fa23f], piesok: 0xe6cf98, hl: 0xa3834d, hlPrah: 0.0, plaz: 1.0 },
  plytcina:  { tr: [0x7ab548, 0x5f9a37], piesok: 0xf0dcaa, dno: 0xe0cc9a, plaz: 1.5 },
  ovocny:    { tr: [0x7cb842, 0x5ea330], plaz: 1.4 },
};
for (const t of Object.values(TEREN)) {
  t.tr = t.tr.map(C);
  for (const k of ['piesok', 'dno', 'skala', 'hl']) t[k] = t[k] === undefined ? FARBY[k === 'hl' ? 'hlina' : k] : C(t[k]);
  t.hlPrah ??= 0.35;
}

function postavTeren(o) {
  const seg = Math.round(THREE.MathUtils.clamp(o.R * 1.15, 70, 170));
  const geo = new THREE.PlaneGeometry(o.ext * 2, o.ext * 2, seg, seg).rotateX(-Math.PI / 2);
  geo.deleteAttribute('uv');
  const poz = geo.attributes.position;
  for (let i = 0; i < poz.count; i++) poz.setY(i, vyskaOstrova(o, o.x + poz.getX(i), o.z + poz.getZ(i)));
  geo.computeVertexNormals();

  const nor = geo.attributes.normal, farby = new Float32Array(poz.count * 3), c = new THREE.Color(), t2 = new THREE.Color(), t3 = new THREE.Color();
  const T = TEREN[o.biom], [tr1, tr2] = T.tr;
  for (let i = 0; i < poz.count; i++) {
    const x = poz.getX(i) + o.x, z = poz.getZ(i) + o.z, h = poz.getY(i), strmost = 1 - nor.getY(i);
    const n = perlin.noise(x * 0.08, z * 0.08, o.seed + 1);
    const hranica = T.plaz + n * 0.6;                       // kde konci plaz (nerovno)
    t2.copy(tr1).lerp(tr2, THREE.MathUtils.clamp((h - 2) / (o.H * 0.8) + n * 0.4, 0, 1));
    if (perlin.noise(x * 0.04, z * 0.04, o.seed + 5) > T.hlPrah) t2.lerp(T.hl, 0.5);   // flaky hliny
    farbaDna(h, x, z, t3);
    c.copy(T.dno).lerp(t3, 1 - THREE.MathUtils.smoothstep(h, -9, -4)).lerp(T.piesok, THREE.MathUtils.smoothstep(h, -2, 0.3));
    c.lerp(t2, THREE.MathUtils.smoothstep(h, hranica, hranica + 0.8));
    c.lerp(T.skala, THREE.MathUtils.smoothstep(strmost, 0.22, 0.38) * (h > 0.5 ? 1 : 0.3));
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
  const inland = { palmovy: ['palica', 'kamen', 'kokos'], atol: ['palica', 'kokos', 'kamen'], plytcina: ['palica', 'kokos'],
    bambusovy: ['bambus', 'palica', 'kamen'], sopecny: ['kamen', 'kamen', 'palica'], skalnaty: ['kamen', 'kamen', 'palica'] }[o.biom]
    || ['palica', 'palica', 'kamen'];
  for (let k = 0; k < o.R * 0.6; k++) {
    const a = r() * 6.28, d = o.R * (0.45 + r() * 0.7);
    const x = o.x + Math.cos(a) * d, z = o.z + Math.sin(a) * d, h = vyskaOstrova(o, x, z);
    const typ = h < 1.5 ? (r() < 0.4 ? 'musla' : r() < 0.6 ? 'palica' : 'kamen') : inland[Math.floor(r() * inland.length)];
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
function uvolni(kluc, z) {
  if (z) {
    scena.remove(z.skupina);
    uvolniVegetaciu(kluc);
    z.teren.geometry.dispose();                      // ostatne geometrie su zdielane
    z.skupina.traverse(m => { if (m.isInstancedMesh) m.dispose(); });
  }
  nahrate.delete(kluc);
}

// dev rezim: zahodi vsetky nahrate ostrovy, postupne sa postavia znova (napr. po zmene hustoty vegetacie)
export function prestavSvet() { for (const [kluc, z] of [...nahrate]) uvolni(kluc, z); }

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
    if (Math.abs(kx - bx) > POLOMER_NAHRAVANIA + 1 || Math.abs(kz - bz) > POLOMER_NAHRAVANIA + 1) uvolni(kluc, z);
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

// polozi predmet na zem (napr. loot z nepriatela); vrati false, ak tam nie je nahrata bunka
let dropId = 0;
export function polozPredmet(typ, x, z) {
  const zaznam = nahrate.get(Math.floor(x / BUNKA) + ',' + Math.floor(z / BUNKA));
  if (!zaznam || !PREDMETY[typ]) return false;
  const [geo, mat] = PREDMETY[typ].model;
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, Math.max(vyskaTerenu(x, z), 0.05), z);
  m.rotation.y = Math.random() * 6.28;
  m.castShadow = true;
  m.userData = { id: `d${Date.now().toString(36)}_${dropId++}`, typ };
  zaznam.skupina.add(m);
  return true;
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
