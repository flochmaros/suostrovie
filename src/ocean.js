// Ocean: vlastny shader.
//  - vlny (5 sinusov) posuvaju vrcholy; ten isty vzorec je v JS (vyskaVody) pre kanoe a plavanie
//  - Gerstner: vrcholy sa posuvaju aj do boku -> ostrejsie hrebene
//  - lom svetla: cez vodu vidno dno (textura sveta bez vody), skrivene vlnkami
//  - hlbka: cervena farba sa straca najskor -> plytcina tyrkysova, hlbka tmavomodra
//  - pena pri brehu (mala hrubka vody) a na hrebenoch vln, odlesky slnka, odraz oblohy (Fresnel)
import * as THREE from 'three';
import { SLNKO, VRSTVA_VODA } from './grafika.js';

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
export const priliv = t => PRILIV_A * Math.sin(t * 2 * Math.PI / PRILIV_T);

// Vyska vody v bode (x, z) v case t
export function vyskaVody(x, z, t) {
  let h = priliv(t);
  for (const v of VLNY) h += v.a * Math.sin(v.k * (v.sx * x + v.sz * z) - v.w * t);
  return h;
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

const VERTEX = /* glsl */`
uniform float uCas;
uniform float uPriliv;
varying vec3 vSvet;
varying vec3 vNorm;
varying float vVyska;
#include <fog_pars_vertex>
${glsl}
void main() {
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 v = vlny(wp.xz, uCas);
  wp.xz += posun(wp.xz, uCas);
  wp.y = v.x + uPriliv;
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

  float pena1 = texture2D(uVlnky, p / 3.1 + uCas * vec2(0.03, -0.02)).r;
  float pena2 = texture2D(uVlnky, p / 9.0 - uCas * vec2(0.01, 0.025)).g;
  float sumPeny = pena1 * pena2;

  if (!gl_FrontFacing) {                 // pohlad zospodu (pod vodou)
    vec3 c = vec3(0.03, 0.28, 0.33) * (1.0 + sumPeny) * uSvetlo;
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
  vec3 prenos = exp(-hrubka * vec3(0.46, 0.085, 0.06));
  vec3 hlbokaFarba = vec3(0.006, 0.05, 0.085) * uSvetlo;
  vec3 farba = dno * prenos + hlbokaFarba * (1.0 - prenos);
  // svetlo prechadzajuce hrebenmi vln (tyrkysovy nadych)
  float protiSlnku = pow(max(dot(-V, uSlnko) * 0.5 + 0.5, 0.0), 2.0);
  farba += vec3(0.0, 0.11, 0.09) * smoothstep(-0.1, 0.7, vVyska) * (0.4 + protiSlnku) * uSvetlo;

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
  float pena = breh * smoothstep(0.35, 0.6, sumPeny + vlnenie * 0.3 + breh * 0.3);
  pena += smoothstep(0.55, 0.85, vVyska) * smoothstep(0.3, 0.6, sumPeny) * 0.7;
  farba = mix(farba, vec3(0.92, 0.96, 0.97) * (0.06 + 0.94 * uSvetlo), clamp(pena, 0.0, 1.0) * 0.85);

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
  mat.uniforms.uSvet.value = g.podvod.texture;
  mat.uniforms.uHlbka.value = g.podvod.depthTexture;
  mat.uniforms.uVlnky.value = vlnky;
  mat.uniforms.uObrazovka = g.uObrazovka;

  const ocean = new THREE.Mesh(mriezka(), mat);
  ocean.frustumCulled = false;
  ocean.layers.set(VRSTVA_VODA);
  g.scena.add(ocean);

  const krok = 0.6;
  return {
    mesh: ocean,
    aktualizuj(x, z, t) {
      uCas.value = t;
      uPriliv.value = priliv(t);
      ocean.position.set(Math.round(x / krok) * krok, 0, Math.round(z / krok) * krok);
    },
  };
}
