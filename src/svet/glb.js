// Modely z Blenderu (.glb) – nahradia procedurálne varianty v DRUHY (svet/modely.js).
// Postup: Blender -> File > Export > glTF 2.0 (.glb), farby vo vrcholoch, os Y hore.
// V subore: objekt 'zaklad' (kmen, listy...) a volitelne 'plody' (zbieratelne, dorastaju).
// Ked sa subor nenajde alebo zlyha, ostane povodny model z kodu – hra funguje dalej.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// druh -> zoznam suborov v modely/rastliny/ (kazdy subor = jedna varianta)
export const GLB = {
  palma: ['palma_1', 'palma_2', 'palma_3'],
};

const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
const loader = new GLTFLoader().setDRACOLoader(draco);
const URL_MODELOV = new URL('../../modely/rastliny/', import.meta.url);

// geometria z glTF -> rovnaky tvar ako z kodu: position, normal, color (3 floaty), index
function uprav(mesh) {
  mesh.updateWorldMatrix(true, false);
  const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
  const n = g.attributes.position.count, a = new Float32Array(n * 3), c = g.attributes.color;
  if (c) for (let i = 0; i < n; i++) a.set([c.getX(i), c.getY(i), c.getZ(i)], i * 3);   // vec4/normalizovane -> vec3 float
  else {                                                                                  // bez farieb: farba materialu
    const f = mesh.material?.color || new THREE.Color(1, 1, 1);
    for (let i = 0; i < n; i++) a.set([f.r, f.g, f.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.index) g.setIndex([...Array(n).keys()]);
  return g;
}

async function nacitaj(meno) {
  const gltf = await loader.loadAsync(new URL(meno + '.glb', URL_MODELOV).href);
  const zak = [], plody = [];
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    let p = o, jePlod = false;
    while (p) { if (/^plody/i.test(p.name)) jePlod = true; p = p.parent; }
    (jePlod ? plody : zak).push(uprav(o));
  });
  if (!zak.length) throw new Error('ziadny objekt zaklad');
  const zaklad = mergeGeometries(zak);
  zaklad.computeBoundingBox();
  return { zaklad, plody: plody.length ? mergeGeometries(plody) : null, vyska: zaklad.boundingBox.max.y, glb: meno };
}

// nahradi varianty v DRUHY (volane raz pri starte, pred rozmiestnenim vegetacie)
export async function nacitajGLB(DRUHY) {
  if (new URLSearchParams(location.search).has('bezglb')) return;   // ?bezglb = povodne modely z kodu (porovnanie)
  const t0 = performance.now();
  await Promise.all(Object.entries(GLB).map(async ([druh, subory]) => {
    try {
      const v = await Promise.all(subory.map(nacitaj));
      DRUHY[druh].varianty = v;
    } catch (e) {
      console.warn('GLB model', druh, 'sa nenacital, ostava model z kodu:', e.message);
    }
  }));
  console.log(`GLB modely nacitane za ${Math.round(performance.now() - t0)} ms`);
}
