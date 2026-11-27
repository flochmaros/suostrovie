// Mobky a bossovia z Blenderu (modely/moby/<meno>.glb).
// Model v Blenderi = diely (mesh) zavesene na pivotoch (prazdne objekty) s menami, ktore hra animuje
// (hlava, chvost, noha_LP...). Animacia ostava v kode (rotacie pivotov), Blender dava len tvar a materialy.
// Ked .glb chyba, mobGLB vrati null a model sa postavi postaru kodom.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// vsetky planovane moby (chybajuci subor nevadi -> model z kodu)
const MOBY = ['lavovy_jaster', 'krab', 'lavovy_obr', 'krokodil', 'kraken', 'chapadlo', 'golem'];

// mena pivotov 4 nôh: [meno, s (strana x), i (vpredu +1 / vzadu -1)] -> nohy: [{ n, s, i }] pre animaciu chodze
// P/L = prava (-x) / lava (+x) strana moba, druhe pismeno P/Z = predna/zadna
export const NOHY4 = [['noha_PP', -1, 1], ['noha_LP', 1, 1], ['noha_PZ', -1, -1], ['noha_LZ', 1, -1]];

const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
const loader = new GLTFLoader().setDRACOLoader(draco);
const URL_MOBOV = new URL('../modely/moby/', import.meta.url);
const VZORY = {};

const vypnute = typeof location !== 'undefined' && new URLSearchParams(location.search).has('bezglb');
if (!vypnute) await Promise.all(MOBY.map(async m => {
  try {
    VZORY[m] = (await loader.loadAsync(new URL(m + '.glb', URL_MOBOV).href)).scene;
  } catch { /* subor zatial nie je -> model z kodu */ }
}));
console.log('GLB moby:', Object.keys(VZORY).join(', ') || 'ziadne');

// kopia modelu pre jedneho nepriatela: geometria sa zdiela, materialy su vlastne (blikanie pri zasahu)
export function mobGLB(meno) {
  const vzor = VZORY[meno];
  if (!vzor) return null;
  const g = vzor.clone(true), mat = {}, uzly = {};
  g.traverse(o => {
    if (o.name) uzly[o.name] = o;
    if (!o.isMesh) return;
    o.castShadow = true;
    const m = o.material;
    o.material = mat[m.name] ??= m.clone();
  });
  return {
    g,
    uzol: meno => uzly[meno] || console.warn('mob: chyba uzol', meno),
    mat: meno => mat[meno] || console.warn('mob: chyba material', meno),
  };
}
