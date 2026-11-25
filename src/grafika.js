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
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export const VRSTVA_VODA = 1;
export const SLNKO = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(58), THREE.MathUtils.degToRad(150));
export const FARBA_HMLY = new THREE.Color(0x9fd6ea);

export function vytvorGrafiku() {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.info.autoReset = false;                // statistiky za cely snimok (dev rezim), nuluje sa vo vykresli()           // tiene pocitame raz za snimok (nie pri kazdom kresleni)
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.7;
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
  let envCiel = pmrem.fromScene(sc);
  scena.environment = envCiel.texture;
  scena.add(obloha);
  // prepocet prostredia (odrazov) z aktualnej oblohy; vola ho pocasie.js zriedka (denny cyklus)
  function obnovProstredie() {
    const poz = obloha.position.clone();
    obloha.position.set(0, 0, 0);
    sc.add(obloha);                                 // sky nesmie byt naraz v dvoch scenach
    const novy = pmrem.fromScene(sc);
    scena.add(obloha);
    obloha.position.copy(poz);
    scena.environment = novy.texture;
    envCiel.dispose();
    envCiel = novy;
  }

  const hemi = new THREE.HemisphereLight(0xa8d8ff, 0xc9a86a, 0.7);
  scena.add(hemi);
  const slnko = new THREE.DirectionalLight(0xffe6c0, 3.2);
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
  const bloom = new UnrealBloomPass(velkost.clone(), 0.4, 0.45, 2.2);   // makka ziara odleskov a svietiacich veci (jas > 2.2)
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  // farebne ladenie (po tone mappingu): sytost, kontrast, tiene do modra / svetla do tepla, vignetacia
  const uNocGrad = { value: 0 };   // 0 den .. 1 noc (nastavuje pocasie.js)
  const grad = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uNoc: uNocGrad },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uNoc; varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
        // noc: oko v tme nevidi farby (len modrosive odtiene), jasne svetla (ohen, plankton) si farbu nechaju
        // teple pixely (osvietene ohnom / faklou) ostanu teple aj v noci
        float teplo = smoothstep(0.015, 0.1, c.r - c.b);
        float sytost = mix(1.3, mix(0.28, 1.15, max(smoothstep(0.35, 0.8, l), teplo)), uNoc);
        c.rgb = mix(vec3(l), c.rgb, sytost);
        c.rgb = mix(c.rgb, c.rgb * vec3(0.72, 0.88, 1.25), uNoc * (1.0 - smoothstep(0.4, 0.9, l)) * (1.0 - teplo));
        c.rgb = (c.rgb - 0.5) * 1.1 + 0.5;
        c.rgb *= mix(vec3(0.96, 0.99, 1.05), vec3(1.05, 1.0, 0.94), smoothstep(0.25, 0.85, l));
        vec2 d = vUv - 0.5;
        c.rgb *= 1.0 - dot(d, d) * (0.5 + 0.7 * uNoc);
        gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
      }`,
  });
  composer.addPass(grad);   // ShaderPass si uniformy kopiruje -> uNocGrad ukazuje na jeho kopiu

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
    uNocGrad: grad.uniforms.uNoc,
    renderer, scena, kamera, slnko,
    obloha, hemi, obnovProstredie, bloom,
    podvod, uObrazovka,
    // slnko a tiene idu za hracom (po celych pixeloch tiena, aby tiene neblikali)
    sledujSlnkom(stred) {
      const x = Math.round(stred.x / krokTiena) * krokTiena, z = Math.round(stred.z / krokTiena) * krokTiena;
      slnko.target.position.set(x, stred.y, z);
      slnko.position.set(x, stred.y, z).addScaledVector(SLNKO, 250);
    },
    vykresli() {
      renderer.info.reset();
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
