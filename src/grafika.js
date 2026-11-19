// Grafika: renderer, obloha, svetla, tiene, post-processing (bloom).
// Kazdy snimok kreslime 2x:
//   1) svet BEZ vody do textury (farba + hlbka) -> voda z nej vie, co je pod nou (lom svetla, hlbka, pena pri brehu)
//   2) cely svet aj s vodou na obrazovku cez EffectComposer (bloom + tone mapping)
// Vrstva 1 = veci, ktore v kroku 1 nechceme (voda, brazda, castice).
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const VRSTVA_VODA = 1;
export const SLNKO = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(58), THREE.MathUtils.degToRad(150));
export const FARBA_HMLY = new THREE.Color(0xa9cde0);

export function vytvorGrafiku() {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;           // tiene pocitame raz za snimok (nie pri kazdom kresleni)
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.5;
  document.body.appendChild(renderer.domElement);

  const scena = new THREE.Scene();
  scena.fog = new THREE.Fog(FARBA_HMLY, 300, 1400);
  const kamera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.2, 20000);
  kamera.layers.enable(VRSTVA_VODA);

  // obloha (fyzikalny model atmosfery z three.js)
  const obloha = new Sky();
  obloha.scale.setScalar(15000);
  const u = obloha.material.uniforms;
  u.turbidity.value = 2.2; u.rayleigh.value = 1.8; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.85;
  u.sunPosition.value.copy(SLNKO);
  // odrazy pre materialy: obloha prevedena na "prostredie"
  const pmrem = new THREE.PMREMGenerator(renderer);
  const sc = new THREE.Scene(); sc.add(obloha);
  scena.environment = pmrem.fromScene(sc).texture;
  scena.add(obloha);

  scena.add(new THREE.HemisphereLight(0xbfdcff, 0x9a8a63, 0.55));
  const slnko = new THREE.DirectionalLight(0xfff0d8, 3.2);
  slnko.castShadow = true;
  slnko.shadow.mapSize.set(4096, 4096);
  const S = 75;
  Object.assign(slnko.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 500 });
  slnko.shadow.bias = -0.0004;
  slnko.shadow.normalBias = 0.04;
  scena.add(slnko, slnko.target);

  // textura sveta bez vody (polovicne rozlisenie staci)
  const velkost = new THREE.Vector2();
  renderer.getDrawingBufferSize(velkost);
  const podvod = new THREE.WebGLRenderTarget(velkost.x / 2, velkost.y / 2, {
    type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(velkost.x / 2, velkost.y / 2),
  });

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(velkost.x, velkost.y, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scena, kamera));
  const bloom = new UnrealBloomPass(velkost.clone(), 0.45, 0.3, 3.0);   // ziaria len odlesky slnka (jas > 3)
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const uObrazovka = { value: velkost.clone() };

  function zmenVelkost() {
    kamera.aspect = innerWidth / innerHeight;
    kamera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    renderer.getDrawingBufferSize(velkost);
    composer.setSize(innerWidth, innerHeight);
    podvod.setSize(velkost.x / 2, velkost.y / 2);
    uObrazovka.value.copy(velkost);
  }
  addEventListener('resize', zmenVelkost);

  const krokTiena = (2 * S) / 4096;
  return {
    renderer, scena, kamera, slnko,
    podvod, uObrazovka,
    // slnko a tiene idu za hracom (po celych pixeloch tiena, aby tiene neblikali)
    sledujSlnkom(stred) {
      const x = Math.round(stred.x / krokTiena) * krokTiena, z = Math.round(stred.z / krokTiena) * krokTiena;
      slnko.target.position.set(x, stred.y, z);
      slnko.position.set(x, stred.y, z).addScaledVector(SLNKO, 250);
    },
    vykresli() {
      renderer.shadowMap.needsUpdate = true;
      kamera.layers.disable(VRSTVA_VODA);
      renderer.setRenderTarget(podvod);
      renderer.render(scena, kamera);
      kamera.layers.enable(VRSTVA_VODA);
      renderer.setRenderTarget(null);
      composer.render();
    },
  };
}
