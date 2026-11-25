// Ocean: vlastny shader.
//  - vlny (5 sinusov) posuvaju vrcholy; ten isty vzorec je v JS (vyskaVody) pre kanoe a plavanie
//  - Gerstner: vrcholy sa posuvaju aj do boku -> ostrejsie hrebene
//  - lom svetla: cez vodu vidno dno (textura sveta bez vody), skrivene vlnkami
//  - hlbka: cervena farba sa straca najskor -> plytcina tyrkysova, hlbka tmavomodra
//  - pena pri brehu (mala hrubka vody) a na hrebenoch vln, odlesky slnka, odraz oblohy (Fresnel)
import * as THREE from 'three';
import { SLNKO, VRSTVA_VODA } from './grafika.js';
import { pasmoPlynule } from './svet.js';

const VLNY = [
  { a: 0.42, l: 64, sx: 1.0, sz: 0.35 },
  { a: 0.26, l: 33, sx: -0.45, sz: 1.0 },
  { a: 0.15, l: 18, sx: 0.7, sz: -0.75 },
  { a: 0.07, l: 9.5, sx: -0.9, sz: -0.3 },
  { a: 0.04, l: 5.7, sx: 0.25, sz: 1.0 },
].map(v => {
  const d = Math.hypot(v.sx, v.sz);
  const k = 2 * Math.PI / v.l;               // vlnove cislo
  return { a: v.a, k, sx: v.sx / d, sz: v.sz / d, w: Math.sqrt(9.81 * k) }; // w: rychlost podla fyziky hlbokej vody
});
const STRMOST = 0.55;                        // Gerstner: kolko sa vrcholy posuvaju do boku

const PRILIV_A = 0.6, PRILIV_T = 300;        // priliv/odliv: +-0.6 m, perioda 5 min
// miestny priliv pri hororovom ostrove (nastavuje horor_zona.js): zona 0..1 tlmi priliv a vlny, pokles = nocny odliv v m
export const miestnyPriliv = { zona: 0, pokles: 0 };
export const priliv = t => PRILIV_A * Math.sin(t * 2 * Math.PI / PRILIV_T) * (1 - 0.8 * miestnyPriliv.zona) - miestnyPriliv.pokles;

// Vyska vody v bode (x, z) v case t
// globalny nasobok amplitudy vln podla pasma (tlmene sa nastavuje v aktualizuj; rovnaka hodnota ide do uniformu uVlnySila)
export const uVlnySila = { value: 1 };
const SILA_PASMA = [1, 1, 1.5, 1.8, 2.8, 2.2];    // index = pasmo 1..5
export const upokojenePasma = new Map();           // pasmo -> nasobok vln (zapaleny maják upokoji more v pasme, src/majak.js)
const sila = i => SILA_PASMA[i] * (upokojenePasma.get(i) ?? 1);
export function silaPasma(p) {                     // plynula interpolacia podla pasmoPlynule (1.0..5.0)
  const i = Math.max(1, Math.min(4, Math.floor(p))), q = Math.min(1, p - i);
  return sila(i) + (sila(i + 1) - sila(i)) * q;
}
export function vyskaVody(x, z, t) {
  let h = 0;
  for (const v of VLNY) h += v.a * Math.sin(v.k * (v.sx * x + v.sz * z) - v.w * t);
  return h * uVlnySila.value + priliv(t);
}

// ta ista funkcia v GLSL: vlny() -> (vyska bez prilivu, sklon x, sklon z); posun() -> Gerstner do boku
const f = n => n.toFixed(6);
let glsl = 'vec3 vlny(vec2 p, float t) {\n  vec3 r = vec3(0.0); float f;\n';
let glslPosun = 'vec2 posun(vec2 p, float t) {\n  vec2 r = vec2(0.0); float f;\n';
for (const v of VLNY) {
  const faza = `f = ${f(v.k)} * dot(vec2(${f(v.sx)}, ${f(v.sz)}), p) - ${f(v.w)} * t;\n`;
  glsl += '  ' + faza + `  r.x += ${f(v.a)} * sin(f);\n  r.yz += ${f(v.a * v.k)} * cos(f) * vec2(${f(v.sx)}, ${f(v.sz)});\n`;
  glslPosun += '  ' + faza + `  r -= ${f(STRMOST * v.a)} * cos(f) * vec2(${f(v.sx)}, ${f(v.sz)});\n`;
}
glsl += '  return r;\n}\n' + glslPosun + '  return r;\n}\n';

export const uCas = { value: 0 };
export const VODA = { u: null };           // uniformy materialu vody (plni sa vo vytvorOcean)
export const uPriliv = { value: 0 };
// noc 0..1 (nastavuje pocasie.js) - svietiaci plankton, meduzy
export const uNoc = { value: 0 };
export const uFaklaPoz = { value: new THREE.Vector3() };     // nastavuje fakla.js
export const uFaklaFarba = { value: new THREE.Color(0, 0, 0) };
// poruchy hladiny pre plankton: (x, z, cas vzniku, polomer) - kruhovy zasobnik, plni aktualizuj()
const N_PORUCH = 32;
const poruchy = Array.from({ length: N_PORUCH }, () => new THREE.Vector4(0, 0, -999, 1));
let iPor = 0;
export function porucha(x, z, r = 1) { poruchy[iPor].set(x, z, uCas.value, r); iPor = (iPor + 1) % N_PORUCH; }


// ---------- stopa lodi (brazda) ----------
// Textura STOPA_RES x STOPA_RES okolo hraca (STOPA_L metrov). Kazdy snimok sa do nej "opeciatkuju" vsetky zive castice stopy
// (aditivne): R = pena, G = vyska hladiny v metroch (+ hreben / - priehlbina), B = rozvirenie vody (svieti plankton v noci).
// Shader vody z nej cita: vrcholy sa zdvihnu o G, normala sa nakloni podla sklonu G, R prida penu.
// Castice pridavaju lode (kanoe.js -> stopaLode): typ 0 = rameno Kelvinovej vlny (V), 1 = turbulentna pena, 2 = obtekanie trupu.
export const STOPA_L = 192, STOPA_RES = 512;
const STOPA_N = 1600;
export const uStopaStred = { value: new THREE.Vector2() };

// maska vody pod lodami: lode sa zaregistruju (kanoe.js), shader v ich podoryse stiahne hladinu pod palubu.
// stat.maska = [polsirka, z od, z do, max. vyska vody] v lokalnych suradniciach modelu
const MAX_MASIEK = 4;
export const lodeMasky = [];
const uLodInv = { value: Array.from({ length: MAX_MASIEK }, () => new THREE.Matrix4()) };
const uLodR = { value: Array.from({ length: MAX_MASIEK }, () => new THREE.Vector4()) };
function obnovMasky(x, z) {
  const zoz = lodeMasky.filter(k => k.stat?.maska && k.model.parent && Math.abs(k.prevrUhol ?? 0) < 0.5)
    .sort((a, b) => Math.hypot(a.poz.x - x, a.poz.y - z) - Math.hypot(b.poz.x - x, b.poz.y - z));
  for (let i = 0; i < MAX_MASIEK; i++) {
    const k = zoz[i];
    if (!k) { uLodR.value[i].set(0, 0, 0, 0); continue; }
    k.model.updateMatrixWorld();
    uLodInv.value[i].copy(k.model.matrixWorld).invert();
    uLodR.value[i].set(...k.stat.maska);
  }
}
const uStopaTex = { value: null };
const castice = Array.from({ length: STOPA_N }, () => ({ typ: 0, x: 0, z: 0, uhol: 0, vx: 0, vz: 0, dlz: 1, sir: 1, amp: 0, pena: 0, zivot: -1, rast: 0, vek: 0, seed: 0 }));
let iCast = 0;
// x, z = stred; uhol = natocenie (ako smer lode); vx, vz = pohyb (m/s); dlz, sir = rozmer (m); amp = vyska (m); pena 0..1+;
// zivot (s; 0 = len tento snimok); rast = o kolko m/s sa rozsiruje
export function stopaLode(typ, x, z, uhol, vx, vz, dlz, sir, amp, pena, zivot, rast) {
  const c = castice[iCast]; iCast = (iCast + 1) % STOPA_N;
  c.typ = typ; c.x = x; c.z = z; c.uhol = uhol; c.vx = vx; c.vz = vz; c.dlz = dlz; c.sir = sir;
  c.amp = amp; c.pena = pena; c.zivot = zivot; c.rast = rast; c.vek = 0; c.seed = Math.random() * 100;
}
const PECIATKA_V = /* glsl */`
attribute vec4 a0;   // x, z, uhol, vek/zivot
attribute vec4 a1;   // dlzka, sirka, amp, pena
attribute vec2 a2;   // typ, seed
uniform vec2 uStred;
uniform float uL;
varying vec2 vUv;
varying vec2 vW;
varying vec4 vA;
varying vec3 vT;
void main() {
  float c = cos(a0.z), s = sin(a0.z);
  vec2 loc = vec2(position.x * a1.y, position.y * a1.x);           // x = napriec, y = pozdlz
  vec2 w = a0.xy + vec2(c, -s) * loc.x + vec2(-s, -c) * loc.y;      // vpravo = (cos, -sin), vpred = (-sin, -cos)
  vUv = position.xy * 2.0; vW = w; vA = a1; vT = vec3(a0.w, a2);
  gl_Position = vec4((w - uStred) / (uL * 0.5), 0.0, 1.0);
}`;
const PECIATKA_F = /* glsl */`
varying vec2 vUv;
varying vec2 vW;
varying vec4 vA;
varying vec3 vT;
float hS(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sumS(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hS(i), hS(i + vec2(1, 0)), f.x), mix(hS(i + vec2(0, 1)), hS(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  float u = vUv.x, v = vUv.y, t = vT.x, typ = vT.y, amp = vA.z, pena = vA.w;
  float zij = 1.0 - t;
  vec3 o = vec3(0.0);
  if (typ < 0.5) {
    // rameno V-vlny: hreben v strede, po bokoch priehlbiny a slabsie hrebene; makke konce, aby sa susedne prekryvali
    float okno = pow(max(1.0 - u * u, 0.0), 2.0) * max(1.0 - v * v, 0.0);
    float vlna = cos(u * 7.85);
    o.g = amp * vlna * okno * zij * zij;
    o.r = pena * smoothstep(0.55, 1.0, vlna) * okno * pow(zij, 6.0) * (0.6 + 0.8 * sumS(vW * 1.7 + vT.z));
    o.b = amp * 4.0 * okno * zij;
  } else if (typ < 1.5) {
    // turbulentna pena za kormou: bubliny (sum vo svetovych suradniciach -> pena "stoji" na vode a rozpada sa)
    float r = length(vUv);
    float okno = smoothstep(1.0, 0.25, r);
    float n = sumS(vW * 2.3 + vT.z) * 0.6 + sumS(vW * 6.1 - vT.z) * 0.4;
    o.r = pena * okno * smoothstep(0.25 + 0.5 * t, 0.75 + 0.2 * t, n + 0.35 * okno) * pow(zij, 1.5);
    o.g = amp * okno * (-0.6 + (n - 0.5) * 1.6) * zij;
    o.b = okno * zij * (0.5 + pena);
  } else {
    // obtekanie trupu: vyvyseny val a pena okolo boku, najviac pri pride (v > 0)
    float r = length(vUv);
    float val = exp(-pow((r - 0.82) / 0.16, 2.0)) * (0.35 + 0.65 * smoothstep(-0.4, 0.9, v));
    float n = sumS(vW * 3.0 + vT.z);
    o.g = amp * val;
    o.r = pena * val * (0.5 + n);
    o.b = val * (0.3 + pena);
  }
  gl_FragColor = vec4(o, 1.0);
}`;

const VERTEX = /* glsl */`
uniform float uCas;
uniform float uPriliv;
uniform float uVlnySila;
uniform sampler2D uStopa;
uniform vec2 uStopaStred;
uniform float uStopaL;
uniform mat4 uLodInv[${MAX_MASIEK}];   // svet -> lokalne suradnice lode
uniform vec4 uLodR[${MAX_MASIEK}];     // polsirka, z od, z do, max. vyska vody (lokalne); x = 0 -> prazdne
varying vec3 vSvet;
varying vec3 vNorm;
varying float vVyska;
#include <fog_pars_vertex>
${glsl}
void main() {
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 v = vlny(wp.xz, uCas);
  wp.xz += posun(wp.xz, uCas);
  vec2 su = (wp.xz - uStopaStred) / uStopaL + 0.5;
  vec2 ok = smoothstep(0.0, 0.08, su) * smoothstep(1.0, 0.92, su);
  float hStopa = texture2D(uStopa, su).g * ok.x * ok.y;     // brazda lodi (zdvih/priehlbina hladiny)
  wp.y = v.x + uPriliv + hStopa;
  // maska pod lodou: v pôdoryse lode stiahne hladinu pod palubu (voda nepresakuje cez dosky ani siet)
  for (int i = 0; i < ${MAX_MASIEK}; i++) {
    vec4 r = uLodR[i];
    if (r.x <= 0.0) continue;
    vec3 lp = (uLodInv[i] * vec4(wp, 1.0)).xyz;
    float m = smoothstep(r.x + 0.5, r.x, abs(lp.x)) * smoothstep(r.y - 0.5, r.y, lp.z) * smoothstep(r.z + 0.5, r.z, lp.z);
    wp.y -= max(0.0, lp.y - r.w) * m;
  }
  vVyska = v.x;
  vNorm = normalize(vec3(-v.y, 1.0, -v.z));
  vSvet = wp;
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAGMENT = /* glsl */`
#include <packing>
uniform float uCas;
uniform sampler2D uSvet;
uniform sampler2D uHlbka;
uniform sampler2D uVlnky;
uniform vec2 uObrazovka;
uniform float uNear;
uniform float uFar;
uniform vec3 uSlnko;
uniform vec3 uSlnkoFarba;
uniform vec3 uObzor;
uniform vec3 uZenit;
uniform float uSvetlo;
uniform float uNoc;
uniform vec3 uFaklaPoz;
uniform vec3 uFaklaFarba;
uniform vec4 uPoruchy[32];
uniform sampler2D uStopa;
uniform vec2 uStopaStred;
uniform float uStopaL;
varying vec3 vSvet;
varying vec3 vNorm;
varying float vVyska;
#include <fog_pars_fragment>

float vzdialenost(float d) { return -perspectiveDepthToViewZ(d, uNear, uFar); }

vec3 obloha(vec3 d) {
  float y = max(d.y, 0.0);
  vec3 c = mix(uObzor, uZenit, pow(y, 0.5));
  float s = max(dot(d, uSlnko), 0.0);
  return c + uSlnkoFarba * (pow(s, 12.0) * 0.3);
}

// ---------- svietiaci plankton (bioluminiscencia) ----------
float hashP(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sumP(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hashP(i), hashP(i + vec2(1, 0)), f.x), mix(hashP(i + vec2(0, 1)), hashP(i + vec2(1, 1)), f.x), f.y);
}
// hustota planktonu: velke svietiace polia (zatoky) + slaby zaklad vsade
float planktonZona(vec2 p) {
  float n = sumP(p / 230.0) * 0.65 + sumP(p / 70.0) * 0.35;
  return 0.4 + 0.6 * smoothstep(0.52, 0.68, n);
}
// iskricky: drobne body, ktore blikaju
float iskra1(vec2 p, float t, float sk) {
  vec2 c = floor(p * sk);
  float h = hashP(c);
  if (h < 0.45) return 0.0;                                  // nie v kazdej bunke
  float blik = 0.5 + 0.5 * sin(t * (2.0 + h * 6.0) + h * 40.0);
  vec2 f = fract(p * sk) - 0.5 - (vec2(hashP(c + 7.1), hashP(c + 3.3)) - 0.5) * 0.75;
  return smoothstep(0.13, 0.0, length(f)) * blik * blik;
}
float iskry(vec2 p, float t) {                               // dve vrstvy, druha otocena -> ziadna mriezka
  vec2 q = mat2(0.8, -0.6, 0.6, 0.8) * p;
  return iskra1(p, t, 2.3) + iskra1(q + 17.0, t * 1.3, 4.1) * 0.8;
}
// jas planktonu v bode: stopy za hracom/lodou + vlny pri brehu
float plankton(vec2 p, float pena, float rus) {
  float z = planktonZona(p), st = min(rus, 2.0) * 0.55;     // rus = rozvirenie z brazdy lodi
  for (int i = 0; i < 32; i++) {
    vec4 q = uPoruchy[i];
    float vek = uCas - q.z;
    if (vek < 0.0 || vek > 7.0) continue;
    float r = q.w * (0.7 + vek * 0.35);
    vec2 d = p - q.xy;
    st += exp(-dot(d, d) / (r * r)) * exp(-vek * 0.6) * (1.0 + 0.8 * exp(-vek * 3.0));
  }
  float spontanne = smoothstep(0.75, 1.0, sumP(p * 0.35 + uCas * 0.15)) * 0.25;
  float iskra = iskry(p, uCas);
  return z * (min(st, 1.8) * (0.35 + 1.6 * iskra) + smoothstep(0.45, 0.95, pena) * (0.15 + 1.1 * iskra) + spontanne * iskra);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uObrazovka;
  vec3 V = cameraPosition - vSvet;
  float dist = length(V);
  V /= dist;

  // drobne vlnky: 2 vrstvy textury normal, posuvaju sa proti sebe
  vec2 p = vSvet.xz;
  vec3 n1 = texture2D(uVlnky, p / 21.0 + uCas * vec2(0.016, 0.010)).xzy * 2.0 - 1.0;
  vec3 n2 = texture2D(uVlnky, p / 6.7 - uCas * vec2(0.012, 0.022)).xzy * 2.0 - 1.0;
  float sila = 0.45 * exp(-dist / 220.0);
  vec3 N = normalize(vNorm + vec3(n1.x + n2.x, 0.0, n1.z + n2.z) * sila);

  // brazda lodi: pena (r), vyska (g) -> sklon normaly, rozvirenie (b)
  vec2 su = (p - uStopaStred) / uStopaL + 0.5;
  vec2 ok2 = smoothstep(0.0, 0.08, su) * smoothstep(1.0, 0.92, su);
  float okS = ok2.x * ok2.y;
  vec4 stopa = vec4(0.0);
  if (okS > 0.0) {
    stopa = texture2D(uStopa, su) * okS;
    float e = 1.0 / ${STOPA_RES}.0;
    float hx = texture2D(uStopa, su + vec2(e, 0.0)).g - texture2D(uStopa, su - vec2(e, 0.0)).g;
    float hz = texture2D(uStopa, su + vec2(0.0, e)).g - texture2D(uStopa, su - vec2(0.0, e)).g;
    N = normalize(N - vec3(hx, 0.0, hz) * (okS * 1.6 / (2.0 * e * uStopaL)));
  }

  float pena1 = texture2D(uVlnky, p / 3.1 + uCas * vec2(0.03, -0.02)).r;
  float pena2 = texture2D(uVlnky, p / 9.0 - uCas * vec2(0.01, 0.025)).g;
  float sumPeny = pena1 * pena2;

  if (!gl_FrontFacing) {                 // pohlad zospodu (pod vodou)
    vec3 c = vec3(0.02, 0.30, 0.38) * (1.0 + sumPeny) * uSvetlo;
    if (uNoc > 0.01) c += vec3(0.1, 0.65, 1.0) * plankton(p, 0.0, stopa.b) * uNoc * 1.4;
    gl_FragColor = vec4(c, 1.0);
    #include <fog_fragment>
    return;
  }

  // hrubka vody pod tymto bodom (z hlbkovej textury sveta bez vody)
  float hVoda = vzdialenost(gl_FragCoord.z);
  float hrubka = max(vzdialenost(texture2D(uHlbka, uv).r) - hVoda, 0.0);
  // lom svetla: posun pohladu na dno podla vlniek
  vec2 uvL = uv + N.xz * 0.04 * clamp(hrubka / 2.5, 0.0, 1.0);
  float hL = vzdialenost(texture2D(uHlbka, uvL).r);
  if (hL < hVoda) uvL = uv; else hrubka = hL - hVoda;
  vec3 dno = min(texture2D(uSvet, uvL).rgb, vec3(20.0));   // obmedzit jas (slnko na oblohe je extremne jasne)

  // pohltenie svetla vo vode: cervena zmizne najskor
  vec3 prenos = exp(-hrubka * vec3(0.36, 0.07, 0.05));
  // farba vody: ciry tyrkys (plytko) -> tmavy tyrkys -> safirova modra (hlboko)
  float hl01 = smoothstep(0.6, 14.0, hrubka);
  vec3 hlbokaFarba = mix(vec3(0.02, 0.36, 0.36), vec3(0.004, 0.05, 0.20), smoothstep(0.15, 1.0, hl01)) * uSvetlo;
  vec3 tint = 1.0 - exp(-hrubka * vec3(0.5, 0.16, 0.12));
  vec3 farba = dno * prenos + hlbokaFarba * tint;
  // svetlo prechadzajuce hrebenmi vln (tyrkysovy nadych)
  float protiSlnku = pow(max(dot(-V, uSlnko) * 0.5 + 0.5, 0.0), 2.0);
  farba += vec3(0.0, 0.14, 0.12) * smoothstep(-0.1, 0.7, vVyska) * (0.4 + protiSlnku) * uSvetlo;

  // odraz oblohy (Fresnel: pri pohlade naplocho vacsi)
  vec3 R = reflect(-V, N); R.y = abs(R.y);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  farba = mix(farba, obloha(R), fres);

  // odlesky slnka
  vec3 H = normalize(uSlnko + V);
  farba += uSlnkoFarba * (pow(max(dot(N, H), 0.0), 900.0) * 18.0 + pow(max(dot(N, H), 0.0), 120.0) * 0.25);

  // pena: pri brehu (tenka voda) pulzuje s vlnami + na hrebenoch
  float breh = 1.0 - smoothstep(0.0, 0.55, hrubka);
  float vlnenie = 0.5 + 0.5 * sin(uCas * 1.6 - hrubka * 9.0 + pena2 * 3.0);
  float pena = breh * smoothstep(0.42, 0.52, sumPeny + vlnenie * 0.3 + breh * 0.3);
  pena += smoothstep(0.55, 0.85, vVyska) * smoothstep(0.3, 0.6, sumPeny) * 0.7;
  // brazda: prevzdusnena voda je svetlejsia (tyrkysova), pena sa trha podla textury
  float penaS = max(stopa.r, 0.0);
  farba += vec3(0.02, 0.09, 0.08) * clamp(penaS * 1.5 + stopa.b * 0.15, 0.0, 1.0) * uSvetlo;
  pena += smoothstep(0.12, 0.65, penaS * (0.45 + 1.1 * pena1)) + penaS * 0.12;
  // pena: minimum 0.06 plati len pri svetle (noc ma uSvetlo pod 0.07 -> pena v tme nesvieti)
  farba = mix(farba, vec3(0.96, 0.99, 1.0) * (0.06 * smoothstep(0.0, 0.07, uSvetlo) + 0.94 * uSvetlo), clamp(pena, 0.0, 1.0) * 0.95);
  // teply odlesk fakle na vode (voda ma vlastny shader, bodove svetla na nu neposobia)
  vec3 kF = uFaklaPoz - vSvet;
  float d2F = dot(kF, kF);
  if (d2F < 400.0) {
    vec3 LF = kF * inversesqrt(d2F + 0.001);
    float utlm = (1.0 - d2F / 400.0) / (1.0 + d2F * 0.12);
    farba += uFaklaFarba * utlm * (0.012 * (1.0 + sumPeny * 2.0 + clamp(pena, 0.0, 1.0) * 6.0) + pow(max(dot(N, normalize(LF + V)), 0.0), 160.0) * 2.0);
  }
  // v noci plankton svieti tam, kde sa voda pohne (stopa, vlny pri brehu); jas > 3 = bloom
  if (uNoc > 0.01) farba += vec3(0.08, 0.62, 1.0) * plankton(p, clamp(pena, 0.0, 1.0), stopa.b) * uNoc * 2.2;

  gl_FragColor = vec4(farba, 1.0);
  #include <fog_fragment>
}`;

// Mriezka: husta pri hracovi (0.6 m), riedka na obzore (do 3 km)
function mriezka(N = 320, R = 3000, c = 0.064) {
  const geo = new THREE.PlaneGeometry(2, 2, N, N).rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const m = s => R * (s * c + s * s * s * (1 - c));
  for (let i = 0; i < p.count; i++) { p.setX(i, m(p.getX(i))); p.setZ(i, m(p.getZ(i))); }
  return geo;
}

export function vytvorOcean(g) {
  const vlnky = new THREE.TextureLoader().load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/waternormals.jpg');
  vlnky.wrapS = vlnky.wrapT = THREE.RepeatWrapping;

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERTEX, fragmentShader: FRAGMENT, fog: true, side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uSvet: { value: null }, uHlbka: { value: null }, uVlnky: { value: null },
      uObrazovka: { value: null }, uNear: { value: g.kamera.near }, uFar: { value: g.kamera.far },
      uSvetlo: { value: 1 },
      uSlnko: { value: SLNKO }, uSlnkoFarba: { value: new THREE.Color(1.0, 0.92, 0.8) },
      uObzor: { value: new THREE.Color(0.62, 0.78, 0.9) }, uZenit: { value: new THREE.Color(0.16, 0.38, 0.72) },
    }]),
  });
  // spolocne objekty (merge ich kopiruje, preto ich priradime az teraz)
  mat.uniforms.uSlnko.value = SLNKO;       // merge vyssie vytvoril kopiu - vratime zdielany vektor
  VODA.u = mat.uniforms;                   // pre pocasie.js (farby oblohy, svetlo)
  mat.uniforms.uCas = uCas;
  mat.uniforms.uPriliv = uPriliv;
  mat.uniforms.uVlnySila = uVlnySila;
  mat.uniforms.uNoc = uNoc;
  mat.uniforms.uFaklaPoz = uFaklaPoz;
  mat.uniforms.uFaklaFarba = uFaklaFarba;
  mat.uniforms.uPoruchy = { value: poruchy };
  mat.uniforms.uSvet.value = g.podvod.texture;
  mat.uniforms.uHlbka.value = g.podvod.depthTexture;
  mat.uniforms.uVlnky.value = vlnky;
  mat.uniforms.uObrazovka = g.uObrazovka;

  // stopa lodi: render target + peciatky (instancie stvorca, poloha a tvar v atributoch)
  const rtStopa = new THREE.WebGLRenderTarget(STOPA_RES, STOPA_RES, { type: THREE.HalfFloatType, depthBuffer: false,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
  uStopaTex.value = rtStopa.texture;
  mat.uniforms.uStopa = uStopaTex;
  mat.uniforms.uStopaStred = uStopaStred;
  mat.uniforms.uStopaL = { value: STOPA_L };
  mat.uniforms.uLodInv = uLodInv;
  mat.uniforms.uLodR = uLodR;
  const geoP = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1));
  const a0 = new THREE.InstancedBufferAttribute(new Float32Array(STOPA_N * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const a1 = new THREE.InstancedBufferAttribute(new Float32Array(STOPA_N * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const a2 = new THREE.InstancedBufferAttribute(new Float32Array(STOPA_N * 2), 2).setUsage(THREE.DynamicDrawUsage);
  geoP.setAttribute('a0', a0); geoP.setAttribute('a1', a1); geoP.setAttribute('a2', a2);
  const peciatky = new THREE.Mesh(geoP, new THREE.ShaderMaterial({
    vertexShader: PECIATKA_V, fragmentShader: PECIATKA_F, depthTest: false, depthWrite: false, side: THREE.DoubleSide,   // zrkadlove otocenie -> inak by sa odrezali
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    uniforms: { uStred: uStopaStred, uL: { value: STOPA_L } },
  }));
  peciatky.frustumCulled = false;
  const scenaStopy = new THREE.Scene(); scenaStopy.add(peciatky);
  const kamStopy = new THREE.OrthographicCamera();
  const farbaPred = new THREE.Color();
  function kresliStopu(x, z, dt) {
    const tex = STOPA_L / STOPA_RES;
    uStopaStred.value.set(Math.round(x / tex) * tex, Math.round(z / tex) * tex);
    let n = 0;
    for (const c of castice) {
      if (c.vek > c.zivot) continue;
      const rast = c.rast * c.vek;
      a0.setXYZW(n, c.x, c.z, c.uhol, c.zivot > 0 ? c.vek / c.zivot : 0);
      a1.setXYZW(n, c.dlz + (c.typ === 1 ? rast : rast * 0.3), c.sir + rast, c.amp, c.pena);
      a2.setXY(n, c.typ, c.seed);
      n++;
      c.vek += dt;
      c.x += c.vx * dt; c.z += c.vz * dt;
      if (c.typ === 1) { const tl = Math.exp(-1.2 * dt); c.vx *= tl; c.vz *= tl; }
      if (c.zivot === 0) c.zivot = -1;
    }
    geoP.instanceCount = n;
    a0.needsUpdate = a1.needsUpdate = a2.needsUpdate = true;
    const r = g.renderer, pred = r.getRenderTarget(), alfa = r.getClearAlpha();
    r.getClearColor(farbaPred);
    r.setRenderTarget(rtStopa);
    r.setClearColor(0x000000, 0);
    r.clear();
    if (n) r.render(scenaStopy, kamStopy);
    r.setRenderTarget(pred);
    r.setClearColor(farbaPred, alfa);
  }

  const ocean = new THREE.Mesh(mriezka(), mat);
  ocean.frustumCulled = false;
  ocean.layers.set(VRSTVA_VODA);
  g.scena.add(ocean);

  const krok = 0.6;
  let tPred = null, px = null, pz = 0, lx = 0, lz = 0, rych = 0;
  return {
    mesh: ocean,
    aktualizuj(x, z, t) {
      const cil = silaPasma(pasmoPlynule(x, z)) * (1 - 0.82 * miestnyPriliv.zona), dt = tPred === null ? 99 : Math.max(0, Math.min(t - tPred, 0.5));
      tPred = t;
      uVlnySila.value = THREE.MathUtils.damp(uVlnySila.value, cil, 0.5, dt);   // ~niekolko sekund prechodu
      uCas.value = t;
      uPriliv.value = priliv(t);
      obnovMasky(x, z);
      // stopa v planktone: novy bod po kazdych ~0.8 m pohybu (lod = sirsia stopa po oboch bokoch)
      if (px === null) { px = lx = x; pz = lz = z; }
      if (dt > 0 && dt < 0.5) rych = THREE.MathUtils.damp(rych, Math.hypot(x - lx, z - lz) / dt, 4, dt);
      lx = x; lz = z;
      const dx = x - px, dz = z - pz, d = Math.hypot(dx, dz);
      if (d > 8) { px = x; pz = z; }
      else if (d > 0.8) {
        if (rych > 3.2) { const sx = -dz / d * 0.7, sz = dx / d * 0.7; porucha(x + sx, z + sz, 0.9); porucha(x - sx, z - sz, 0.9); }
        else porucha(x, z, 0.85);
        px = x; pz = z;
      }
      ocean.position.set(Math.round(x / krok) * krok, 0, Math.round(z / krok) * krok);
      kresliStopu(x, z, dt > 0.5 ? 0 : dt);
    },
  };
}
