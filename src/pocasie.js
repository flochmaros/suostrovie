// Denny cyklus + pocasie: slnko/mesiac, hviezdy, oblaky, dazd, burka s bleskmi.
// Vsetko riadi aktualizujPocasie(dt, cas, stred) - vola sa raz za snimok z main.js.
// Menime zdielane objekty z grafika.js (SLNKO, FARBA_HMLY - na mieste) a uniformy vody (ocean.js).
import * as THREE from 'three';
import { SLNKO, FARBA_HMLY } from './grafika.js';
import { VODA, uNoc } from './ocean.js';
import { initNoc, aktualizujNoc } from './noc.js';
import { pasmoPlynule } from './svet.js';
import { dazd as zvukDazd, noc as zvukNoc, hrom } from './zvuk.js';

export const DEN_MINUT = 24;          // jeden herny den = 24 realnych minut
const START_HODINA = 9;               // hra zacina o 9:00

// Hmla pre main.js (nad vodou): scena.fog.near/far = MLHA.near/far; POD_VODOU = farba hmly pod hladinou
const PAS_T2 = new THREE.Color(), PAS_T3 = new THREE.Color(), PAS_T4 = new THREE.Color(), PAS_T5 = new THREE.Color();
export let pasmoVietor = 0, pasmoPopol = 0;   // doplnky pre vietor (main.js) a popol (castice)
export const MLHA = { near: 220, far: 1300 };
export const POD_VODOU = new THREE.Color(0x0d5468);

// ---------- pomocne ----------
const clamp01 = x => Math.min(1, Math.max(0, x));
const sm = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };   // smoothstep (aj opacne a>b)
const lerp = (a, b, t) => a + (b - a) * t;
const C = h => new THREE.Color(h);

// ---------- stav ----------
let G = null;
let hodinaEnv = -99;                                  // pri ktorej hodine sme naposledy prepocitali prostredie
const SUN = new THREE.Vector3(), MESIAC = new THREE.Vector3(), SMER = new THREE.Vector3();
const t1 = new THREE.Color(), t2 = new THREE.Color();

// pocasie: 0 jasno, 1 oblacno, 2 dazd, 3 burka
const CIELE = [{ c: 0.15, d: 0, b: 0 }, { c: 0.6, d: 0, b: 0 }, { c: 0.88, d: 0.65, b: 0 }, { c: 1, d: 1, b: 1 }];
const PRECHODY = [[0.35, 0.5, 0.12, 0.03], [0.4, 0.2, 0.3, 0.1], [0.1, 0.45, 0.2, 0.25], [0, 0.3, 0.7, 0]];
const DLZKY = [[150, 360], [90, 200], [90, 240], [60, 150]];   // trvanie v realnych sekundach
const W = { stav: 0, casovac: 240, cover: 0.15, dazd: 0, burka: 0, sila: 0.65 };
let blesk = 1e9, hromZa = -1, hromBlizko = 0.5, dalsiBlesk = 8, vietorOff = new THREE.Vector2();

function vyberStav(z) {
  let r = Math.random(); const p = PRECHODY[z];
  for (let i = 0; i < 4; i++) { r -= p[i]; if (r <= 0) return i; }
  return z;
}
function novyStav(s) {
  W.stav = s;
  const d = DLZKY[s];
  W.casovac = d[0] + Math.random() * (d[1] - d[0]);
  W.sila = s === 3 ? 1 : 0.45 + Math.random() * 0.4;           // intenzita dazda v tomto useku
}

export function ulozPocasie() {
  return { stav: W.stav, casovac: W.casovac, cover: W.cover, dazd: W.dazd, burka: W.burka, sila: W.sila };
}
export function nacitajPocasie(o) {
  if (!o || typeof o !== 'object') return;
  for (const k of ['stav', 'casovac', 'cover', 'dazd', 'burka', 'sila']) if (Number.isFinite(o[k])) W[k] = o[k];
  W.stav = Math.min(3, Math.max(0, W.stav | 0));
}

// ---------- obloha: oblaky (kupola so shaderom) ----------
const OBLAKY_VS = `
varying vec3 vSmer;
void main() { vSmer = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position * 7000.0, 1.0); }`;
const OBLAKY_FS = `
uniform vec2 uOff; uniform vec2 uSlnkoXZ;
uniform float uCover, uDark, uFlash;
uniform vec3 uAmb, uSlnkoF;
varying vec3 vSmer;
float hs(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float sum(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hs(i), hs(i + vec2(1, 0)), f.x), mix(hs(i + vec2(0, 1)), hs(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * sum(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
  return s;
}
void main() {
  vec3 d = normalize(vSmer);
  float h = d.y;
  if (h < 0.0) discard;
  vec2 uv = d.xz / (h + 0.14) * 0.9 + uOff;
  float n = fbm(uv);
  float prah = mix(0.78, 0.30, uCover);
  float hust = smoothstep(prah, prah + 0.22, n);
  hust = mix(hust, 1.0, smoothstep(0.75, 1.0, uCover) * 0.85);
  // osvetlenie: hrany obrate k slnku su svetlejsie (rozdiel hustoty smerom k slnku)
  float n2 = fbm(uv + uSlnkoXZ * 0.07);
  float lt = clamp((n - n2) * 4.0 + 0.55, 0.0, 1.0);
  vec3 col = uAmb * (1.0 - 0.45 * uDark * hust) + uSlnkoF * (0.35 + 0.9 * lt) * (1.0 - uDark * 0.8);
  col += vec3(0.8, 0.85, 1.0) * uFlash * (0.4 + 0.9 * hust);
  float a = hust * smoothstep(0.0, 0.14, h) * 0.95;
  gl_FragColor = vec4(col, a);
}`;

// ---------- hviezdy ----------
const HVIEZDY_VS = `
attribute float aVel; attribute float aFaza;
uniform float uCas;
varying float vJas; varying vec3 vFarba;
void main() {
  vJas = 0.65 + 0.35 * sin(uCas * (1.2 + aFaza * 2.0) + aFaza * 40.0);
  vFarba = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.88, 0.7), step(0.8, fract(aFaza * 7.0)));
  gl_PointSize = aVel * (0.8 + 0.4 * vJas);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const HVIEZDY_FS = `
uniform float uAlfa;
varying float vJas; varying vec3 vFarba;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d);
  gl_FragColor = vec4(vFarba * 1.6 * vJas, a * uAlfa);
}`;

// ---------- mesiac ----------
const MESIAC_VS = `
varying vec2 vUv;
void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const MESIAC_FS = `
uniform float uAlfa;
varying vec2 vUv;
void main() {
  float d = length(vUv);
  float disk = smoothstep(0.11, 0.1, d);
  float mora = 0.72 + 0.28 * sin(vUv.x * 80.0 + sin(vUv.y * 55.0) * 2.0) * sin(vUv.y * 70.0 + 1.3);
  float zar = exp(-d * d * 30.0) * 0.35 + exp(-d * d * 9.0) * 0.04;   // ziara plynule do nuly (inak bolo vidno hranu stvorca)
  vec3 col = vec3(1.0, 0.97, 0.88) * (disk * mora * 2.2 + zar) * smoothstep(0.95, 0.45, d);
  gl_FragColor = vec4(col * uAlfa, 1.0);
}`;

// ---------- dazd: ciary okolo kamery, pohyb pocita vertex shader ----------
const DAZD_VS = `
attribute float aKraj; attribute float aNah;
uniform vec3 uStred; uniform float uCas, uSila, uAlfa; uniform vec2 uVietor;
varying float vA;
void main() {
  const float B = 40.0; const float H = 24.0;
  vec3 w;
  w.x = uStred.x + mod(position.x * B - uStred.x, B) - B * 0.5;
  w.z = uStred.z + mod(position.z * B - uStred.z, B) - B * 0.5;
  float yy = mod(position.y * H - uCas * (15.0 + aNah * 6.0), H);
  w.y = uStred.y - 6.0 + yy;
  vec3 pad = normalize(vec3(uVietor.x * 0.3, -1.0, uVietor.y * 0.3));
  w -= pad * (0.9 * aKraj);                                   // druhy koniec ciary je nad prvym
  float dz = length(w.xz - uStred.xz);
  vA = uAlfa * (0.35 + 0.65 * (1.0 - aKraj)) * (1.0 - smoothstep(14.0, 20.0, dz));
  if (aNah > uSila) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }   // mimo zaberu = nevidno
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
const DAZD_FS = `
uniform vec3 uFarba;
varying float vA;
void main() { gl_FragColor = vec4(uFarba, vA); }`;

let oblaky, hviezdy, mesiac, dazdLinie, uObl, uHv, uMes, uDz, hviezdyHolder;

export function initPocasie(g) {
  G = g;
  const scena = g.scena;
  initNoc(scena);

  // oblaky
  uObl = {
    uOff: { value: new THREE.Vector2() }, uSlnkoXZ: { value: new THREE.Vector2(1, 0) },
    uCover: { value: 0.15 }, uDark: { value: 0 }, uFlash: { value: 0 },
    uAmb: { value: new THREE.Color(0.5, 0.56, 0.66) }, uSlnkoF: { value: new THREE.Color(1, 0.95, 0.85) },
  };
  oblaky = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.ShaderMaterial({
      vertexShader: OBLAKY_VS, fragmentShader: OBLAKY_FS, uniforms: uObl,
      transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
    }));
  oblaky.frustumCulled = false; oblaky.renderOrder = 3;

  // hviezdy
  const N = 1800, poz = new Float32Array(N * 3), vel = new Float32Array(N), faza = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 1.1 - 0.1, Math.random() * 2 - 1).normalize();
    poz.set([v.x * 6500, v.y * 6500, v.z * 6500], i * 3);
    vel[i] = 1.4 + Math.pow(Math.random(), 4) * 3.2;
    faza[i] = Math.random();
  }
  const hg = new THREE.BufferGeometry();
  hg.setAttribute('position', new THREE.BufferAttribute(poz, 3));
  hg.setAttribute('aVel', new THREE.BufferAttribute(vel, 1));
  hg.setAttribute('aFaza', new THREE.BufferAttribute(faza, 1));
  uHv = { uCas: { value: 0 }, uAlfa: { value: 0 } };
  hviezdy = new THREE.Points(hg, new THREE.ShaderMaterial({
    vertexShader: HVIEZDY_VS, fragmentShader: HVIEZDY_FS, uniforms: uHv,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  hviezdy.frustumCulled = false; hviezdy.renderOrder = 1;

  // mesiac (plocha otocena ku kamere)
  uMes = { uAlfa: { value: 0 } };
  mesiac = new THREE.Mesh(new THREE.PlaneGeometry(1700, 1700), new THREE.ShaderMaterial({
    vertexShader: MESIAC_VS, fragmentShader: MESIAC_FS, uniforms: uMes,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  mesiac.frustumCulled = false; mesiac.renderOrder = 2;

  // dazd
  const KAP = 3200, dp = new Float32Array(KAP * 6), dk = new Float32Array(KAP * 2), dn = new Float32Array(KAP * 2);
  for (let i = 0; i < KAP; i++) {
    const x = Math.random(), y = Math.random(), z = Math.random(), nh = Math.random();
    dp.set([x, y, z, x, y, z], i * 6);
    dk[i * 2] = 0; dk[i * 2 + 1] = 1; dn[i * 2] = dn[i * 2 + 1] = nh;
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  dg.setAttribute('aKraj', new THREE.BufferAttribute(dk, 1));
  dg.setAttribute('aNah', new THREE.BufferAttribute(dn, 1));
  uDz = {
    uStred: { value: new THREE.Vector3() }, uCas: { value: 0 }, uSila: { value: 0 }, uAlfa: { value: 0.3 },
    uVietor: { value: new THREE.Vector2(1, 0.3) }, uFarba: { value: new THREE.Color(0.55, 0.6, 0.68) },
  };
  dazdLinie = new THREE.LineSegments(dg, new THREE.ShaderMaterial({
    vertexShader: DAZD_VS, fragmentShader: DAZD_FS, uniforms: uDz,
    transparent: true, depthWrite: false, fog: false,
  }));
  dazdLinie.frustumCulled = false; dazdLinie.renderOrder = 4; dazdLinie.visible = false;

  scena.add(oblaky, hviezdy, mesiac, dazdLinie);
}

// ---------- farby (kluce pre denny cyklus) ----------
const H_DEN = C(0xa9cde0), H_SUM = C(0xf0a070), H_NOC = C(0x070c18);
const SED_DEN = C(0x8a9299), SED_BURKA = C(0x4a5058), SED_NOC = C(0x06080b);
const SL_DEN = C(0xfff0d8), SL_NIZKE = C(0xff8a40), SL_SEDE = C(0xb8c4d0), SL_MESIAC = C(0x8fa8e0);
const HS_DEN = C(0xbfdcff), HS_NOC = C(0x1b2a55), HS_SUM = C(0xffb08a), HS_SEDA = C(0x9aa4ae);
const HZ_DEN = C(0x9a8a63), HZ_NOC = C(0x0c0e14);
const AMB_DEN = new THREE.Color(0.5, 0.56, 0.66), AMB_NOC = new THREE.Color(0.012, 0.02, 0.045), AMB_SUM = new THREE.Color(0.55, 0.3, 0.28);
const ZEN_DEN = new THREE.Color(0.16, 0.38, 0.72), ZEN_NOC = new THREE.Color(0.004, 0.008, 0.025), ZEN_SUM = new THREE.Color(0.25, 0.22, 0.42), ZEN_SEDA = new THREE.Color(0.28, 0.31, 0.35);
const OB_DEN = new THREE.Color(0.62, 0.78, 0.9), OB_NOC = new THREE.Color(0.01, 0.015, 0.035), OB_SUM = new THREE.Color(0.9, 0.5, 0.35), OB_SEDA = new THREE.Color(0.4, 0.43, 0.47);
const SLF = new THREE.Color(), AMB = new THREE.Color();

// ---------- hlavna aktualizacia ----------
export function aktualizujPocasie(dt, cas, stred) {
  dt = Math.min(dt, 0.25);
  const g = G;

  // --- cas ---
  const hh = START_HODINA + cas / (DEN_MINUT * 60) * 24;
  const den = Math.floor(hh / 24) + 1, hodina = ((hh % 24) + 24) % 24;

  // --- pocasie: striedanie useku + plynule dobiehanie cielov ---
  W.casovac -= dt;
  if (W.casovac <= 0) novyStav(vyberStav(W.stav));
  const ciel = CIELE[W.stav];
  W.cover += (ciel.c - W.cover) * (1 - Math.exp(-dt / 18));
  W.dazd += (ciel.d * W.sila - W.dazd) * (1 - Math.exp(-dt / 20));
  W.burka += (ciel.b - W.burka) * (1 - Math.exp(-dt / 12));
  const cover = clamp01(W.cover), dazd = clamp01(W.dazd), burkaF = clamp01(W.burka);
  const burka = burkaF > 0.5;

  // --- blesk + hrom ---
  if (burkaF > 0.4) {
    dalsiBlesk -= dt * burkaF;
    if (dalsiBlesk <= 0) {
      blesk = 0; dalsiBlesk = 4 + Math.random() * 12;
      hromZa = 0.2 + Math.random() * 3.5; hromBlizko = 1 - hromZa / 4;
    }
  }
  blesk += dt;
  let flash = 0;
  if (blesk < 1.5) flash = Math.max(Math.exp(-blesk * 10), blesk > 0.16 ? 0.8 * Math.exp(-(blesk - 0.16) * 8) : 0);
  if (hromZa >= 0) { hromZa -= dt; if (hromZa < 0) { hrom(hromBlizko); hromZa = -1; } }

  // --- slnko / mesiac ---
  const a = (hodina - 6) / 24 * Math.PI * 2;
  SUN.set(Math.cos(a), Math.sin(a), 0.3).normalize();          // vychod = +X, zapad = -X
  MESIAC.copy(SUN).negate();
  const e = SUN.y;
  const den2 = sm(-0.12, 0.35, e);                              // 0 noc .. 1 den (plynulo)
  const slnkoK = sm(-0.04, 0.22, e);
  const noc = sm(0.02, -0.22, e);                               // 1 hlboka noc
  const twi = Math.exp(-Math.pow(e / 0.17, 2)) * (1 - cover * 0.6);
  const svetlo = sm(0.0, 0.3, e) * (1 - 0.7 * cover);

  // --- obloha (Sky) ---
  const u = g.obloha.material.uniforms;
  u.sunPosition.value.copy(SUN);
  u.turbidity.value = 1.3 + twi * 4.5 + cover * 2;
  u.rayleigh.value = 0.8 + twi * 1.8;
  u.mieCoefficient.value = 0.002 + twi * 0.008;
  g.obloha.position.copy(g.kamera.position);

  // --- hlavne svetlo: slnko, v noci mesiac ---
  let farbaSvetla, intenzita, smer;
  if (e > -0.04) {
    smer = SUN; intenzita = 3.2 * slnkoK * (1 - 0.78 * cover);
    SLF.copy(SL_NIZKE).lerp(SL_DEN, sm(0.02, 0.32, e)).lerp(SL_SEDE, cover * 0.6);
    farbaSvetla = SLF;
  } else {
    smer = MESIAC; intenzita = 0.5 * sm(-0.04, -0.25, e) * (1 - 0.7 * cover);
    farbaSvetla = SL_MESIAC;
  }
  SLNKO.copy(smer); if (SLNKO.y < 0.1) { SLNKO.y = 0.1; SLNKO.normalize(); }
  g.slnko.color.copy(farbaSvetla);
  g.slnko.intensity = intenzita;

  const hs = g.hemi;
  hs.color.copy(HS_NOC).lerp(HS_DEN, den2).lerp(HS_SUM, twi * 0.5).lerp(HS_SEDA, cover * 0.7);
  hs.groundColor.copy(HZ_NOC).lerp(HZ_DEN, den2);
  hs.intensity = lerp(0.42, 0.55, den2) * (1 - 0.2 * cover) + flash * 2.5;
  g.renderer.toneMappingExposure = lerp(0.5, 0.72, noc) * (1 + flash * 0.35);

  // --- hmla (farba sa meni na mieste; main.js ju kopiruje do scena.fog) ---
  const mokro = clamp01(Math.max(dazd * 0.7, burkaF, cover * 0.3));
  t1.copy(H_NOC).lerp(H_DEN, den2).lerp(H_SUM, twi * 0.75);
  t2.copy(SED_BURKA).lerp(SED_DEN, 1 - burkaF * 0.6).multiplyScalar(0.15 + 0.85 * den2);
  t2.lerp(SED_NOC, noc * 0.6);
  FARBA_HMLY.copy(t1).lerp(t2, clamp01(cover * 0.85));
  FARBA_HMLY.r += flash * 0.25; FARBA_HMLY.g += flash * 0.25; FARBA_HMLY.b += flash * 0.3;
  MLHA.near = 220 * (1 - 0.65 * mokro);
  MLHA.far = 1300 * (1 - 0.55 * mokro) * (1 - 0.2 * noc);
  // atmosfera podla pasma (plynule): 2 oranzovy opar, 3 zelenkava hustejsia hmla, 4 sivsie, 5 hustá biela hmla
  if (stred) {
    const pf = pasmoPlynule(stred.x, stred.z), w = i => Math.max(0, 1 - Math.abs(pf - i));   // vaha pasma i (1..5)
    const svetlo = 0.35 + 0.65 * den2;                      // v noci nech tinty nesvietia
    FARBA_HMLY.lerp(PAS_T2.set(1.0, 0.62, 0.38).multiplyScalar(svetlo), 0.35 * w(2));
    FARBA_HMLY.lerp(PAS_T3.set(0.42, 0.62, 0.38).multiplyScalar(svetlo), 0.45 * w(3));
    FARBA_HMLY.lerp(PAS_T4.set(0.52, 0.56, 0.62).multiplyScalar(svetlo), 0.5 * w(4));
    FARBA_HMLY.lerp(PAS_T5.set(0.9, 0.93, 0.96).multiplyScalar(0.25 + 0.75 * den2), 0.75 * w(5));
    const hustota = 1 + 0.25 * w(2) + 0.55 * w(3) + 0.35 * w(4) + 1.6 * w(5);   // vacsie = hustejsia hmla
    MLHA.near /= hustota; MLHA.far /= hustota;
    pasmoVietor = 0.18 * w(4) + 0.08 * w(3);
    pasmoPopol = w(2);
  }
  POD_VODOU.set(0x0d5468).multiplyScalar(0.1 + 0.9 * clamp01(den2 * (1 - 0.35 * cover)));

  // --- voda: farby oblohy pre odraz, farba slnka, celkove svetlo ---
  const vu = VODA.u;
  if (vu) {
    vu.uObzor.value.copy(OB_NOC).lerp(OB_DEN, den2).lerp(OB_SUM, twi * 0.7).lerp(OB_SEDA, cover * 0.75).multiplyScalar(1 + flash);
    vu.uZenit.value.copy(ZEN_NOC).lerp(ZEN_DEN, den2).lerp(ZEN_SUM, twi * 0.5).lerp(ZEN_SEDA, cover * 0.8).multiplyScalar(1 + flash);
    const k = e > -0.04 ? intenzita / 3.2 : intenzita / 3.2 * 0.5;   // mesiac sa v odleskoch ukaze o trochu viac
    vu.uSlnkoFarba.value.copy(farbaSvetla).multiplyScalar(k);
    vu.uSvetlo.value = lerp(0.07, 1, den2 * (1 - 0.45 * cover)) + flash * 0.5;
  }

  // --- oblaky ---
  vietorOff.x += dt * 0.004 * (1 + 2 * burkaF); vietorOff.y += dt * 0.0016;
  oblaky.position.copy(g.kamera.position);
  uObl.uOff.value.copy(vietorOff);
  uObl.uSlnkoXZ.value.set(SUN.x, SUN.z).normalize();
  uObl.uCover.value = cover;
  uObl.uDark.value = clamp01(dazd * 0.6 + burkaF * 0.5 + cover * 0.25);
  uObl.uFlash.value = flash;
  AMB.copy(AMB_NOC).lerp(AMB_DEN, den2).lerp(AMB_SUM, twi * 0.7).multiplyScalar(1 - 0.5 * Math.max(dazd, burkaF));
  uObl.uAmb.value.copy(AMB);
  uObl.uSlnkoF.value.copy(SL_NIZKE).lerp(SL_DEN, sm(0.02, 0.32, e)).multiplyScalar(0.9 * slnkoK * (1 - cover * 0.6));

  // --- hviezdy a mesiac (nasleduju kameru) ---
  const kp = g.kamera.position;
  const hviezdAlfa = sm(0.05, -0.15, e) * (1 - cover * 0.92);
  hviezdy.visible = hviezdAlfa > 0.01;
  if (hviezdy.visible) {
    hviezdy.position.copy(kp);
    hviezdy.rotation.set(0.6, hodina / 24 * Math.PI * 2, 0);   // pomaly otoc oblohy
    uHv.uAlfa.value = hviezdAlfa; uHv.uCas.value = cas;
  }
  const mesAlfa = sm(0.1, -0.12, e) * (1 - cover * 0.92);
  mesiac.visible = mesAlfa > 0.01 && MESIAC.y > -0.05;
  if (mesiac.visible) {
    mesiac.position.copy(kp).addScaledVector(MESIAC, 6000);
    mesiac.lookAt(kp);
    uMes.uAlfa.value = mesAlfa;
  }

  // --- dazd ---
  const podHladinou = g.kamera.position.y < -0.2;
  dazdLinie.visible = dazd > 0.02 && !podHladinou;
  if (dazdLinie.visible) {
    dazdLinie.position.set(0, 0, 0);
    uDz.uStred.value.copy(kp);
    uDz.uCas.value = cas;
    uDz.uSila.value = dazd;
    uDz.uAlfa.value = 0.22 + 0.18 * burkaF;
    const vs = 0.4 + 0.6 * burkaF;
    uDz.uVietor.value.set(Math.cos(0.8) * vs * 4, Math.sin(0.8) * vs * 4);
    uDz.uFarba.value.set(0.55, 0.6, 0.68).multiplyScalar(0.12 + 0.88 * clamp01(den2 + 0.2) + flash);
  }

  // --- zvuky ---
  const pod = stred ? stred.y < -0.3 : false;
  zvukDazd(dazd, pod);
  zvukNoc(noc * (1 - dazd), pod);
  // noc: farebne ladenie obrazu, svietiaci plankton + meduzy, svetlusky
  uNoc.value = noc;
  if (g.uNocGrad) g.uNocGrad.value = noc * (1 - flash);
  aktualizujNoc(cas, noc, dazd, stred);

  // --- vietor pre hru (0..1) ---
  const zaklad = 0.28 + 0.14 * Math.sin(cas / 53) + 0.1 * Math.sin(cas / 17.3 + 1);
  const vietorSila = clamp01(zaklad + cover * 0.2 + dazd * 0.15 + burkaF * 0.35);

  // --- prostredie (odrazy PBR) prepocitaj zriedka: pri posune casu o ~20 herných minut ---
  let dh = Math.abs(hodina - hodinaEnv); if (dh > 12) dh = 24 - dh;
  if (dh > 0.35) { hodinaEnv = hodina; g.obnovProstredie(); }

  return { hodina, den, svetlo, dazd, burka, vietorSila };
}

// text pre HUD: "Den 2 · 14:20"
export function casText(p) {
  const h = Math.floor(p.hodina), m = Math.floor((p.hodina - h) * 60);
  return `Deň ${p.den} · ${h}:${String(m).padStart(2, '0')}`;
}
