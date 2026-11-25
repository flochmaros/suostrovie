// Noc: svetlusky nad ostrovmi (blikaju, poletuju pri zemi, len na sushi).
// Aktualizuje sa z pocasie.js (aktualizujNoc), takze netreba menit main.js.
import * as THREE from 'three';
import { vyskaTerenu } from './svet.js';
import { hororovaZona } from './ostrovy/ticha_zatoka.js';

const N = 160, DOSAH = 38;                       // pocet a polomer okolo hraca
let body, poz, faza, kotvy;

export function initNoc(scena) {
  const geo = new THREE.BufferGeometry();
  poz = new Float32Array(N * 3); faza = new Float32Array(N);
  kotvy = Array.from({ length: N }, () => ({ x: 0, y: -999, z: 0, on: false }));
  for (let i = 0; i < N; i++) faza[i] = Math.random() * 100;
  geo.setAttribute('position', new THREE.BufferAttribute(poz, 3));
  geo.setAttribute('faza', new THREE.BufferAttribute(faza, 1));
  body = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: { uCas: { value: 0 }, uAlfa: { value: 0 } },
    vertexShader: `attribute float faza; uniform float uCas; varying float vJas;
      void main() {
        // blikanie: kratke zablesky s dlhou pauzou, kazda svetluska vlastny rytmus
        float b = sin(uCas * (0.9 + fract(faza) * 0.8) + faza);
        vJas = smoothstep(0.35, 0.95, b);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(170.0 / -mv.z, 2.0, 18.0) * (0.4 + 0.6 * vJas);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float uAlfa; varying float vJas;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(0.75, 1.0, 0.35) * (1.0 + 4.0 * a * a) * vJas, a * vJas * uAlfa);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  body.frustumCulled = false;
  body.visible = false;
  scena.add(body);
}

// nova kotva: nahodne miesto okolo hraca, len na sushi (nie na plazi tesne pri vode)
function novaKotva(k, sx, sz) {
  const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * (DOSAH - 6);
  k.x = sx + Math.cos(a) * r; k.z = sz + Math.sin(a) * r;
  const h = vyskaTerenu(k.x, k.z);
  k.on = h > 1.2 && hororovaZona(k.x, k.z) < 0.4;
  k.y = h + 0.4 + Math.random() * 2.2;
}

export function aktualizujNoc(cas, noc, dazd, stred) {
  if (!body) return;
  const alfa = noc * (1 - dazd) * (stred ? 1 - Math.min(1, hororovaZona(stred.x, stred.z) * 2.5) : 1);   // na Tichej zatoke nesvietia
  body.visible = alfa > 0.02 && !!stred;
  if (!body.visible) return;
  body.material.uniforms.uCas.value = cas;
  body.material.uniforms.uAlfa.value = alfa;
  const sx = stred.x, sz = stred.z;
  let zmen = 3;                                    // max par novych kotiev za snimok (vyskaTerenu nie je zadarmo)
  for (let i = 0; i < N; i++) {
    const k = kotvy[i], f = faza[i];
    if (zmen > 0 && (k.y < -100 || Math.hypot(k.x - sx, k.z - sz) > DOSAH)) { novaKotva(k, sx, sz); zmen--; }
    // pomale kruzenie okolo kotvy
    const t = cas * 0.35 + f;
    poz[i * 3] = k.x + Math.sin(t) * 1.3 + Math.sin(t * 2.3) * 0.4;
    poz[i * 3 + 1] = k.on ? k.y + Math.sin(t * 1.7) * 0.35 : -9999;
    poz[i * 3 + 2] = k.z + Math.cos(t * 0.8) * 1.3;
  }
  body.geometry.attributes.position.needsUpdate = true;
}
