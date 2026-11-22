// Ikony predmetov z 3D modelov: kazdy predmet, ktory ma model [geometria, material], sa raz
// vyrenderuje (Three.js, priehladne pozadie) do malého obrazka a `ikona` sa zmeni na <img>.
// Predmety bez modelu ostavaju s kreslenou SVG ikonou. Novy predmet s modelom dostane ikonu sam.
import * as THREE from 'three';
import { PREDMETY } from './obsah/predmety.js';
import './obsah/nastroje.js';
import './obsah/jedlo.js';
import './obsah/more.js';
import './obsah/nepriatelia.js';

const VELKOST = 128;

function vytvorRenderer() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = VELKOST;
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setSize(VELKOST, VELKOST, false); r.setClearColor(0x000000, 0);
    return r;
  } catch (e) { console.warn('Ikony z 3D modelov: WebGL nie je k dispozicii', e); return null; }
}

const dir = new THREE.Vector3(0.55, 0.62, 1).normalize();   // pohlad zhora spredu-zboku

function scena() {
  const s = new THREE.Scene();
  s.add(new THREE.HemisphereLight(0xfff4e0, 0x6a6a7a, 1.5));
  const k = new THREE.DirectionalLight(0xffffff, 2.6); k.position.set(-1.2, 2, 1.6); s.add(k);
  const o = new THREE.DirectionalLight(0xbfd8ff, 0.8); o.position.set(2, 0.5, -1); s.add(o);   // chladne svetlo zboku
  return s;
}

// Vycentruje a priblizi kameru tak, aby sa model zmestil do stvorca s malym okrajom
function zaber(kam, skupina, orez = 1) {
  const box = new THREE.Box3().setFromObject(skupina);
  const stred = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2 || 0.1;
  const cil = stred.clone();
  let d = r * 3.2;
  const rohy = [];
  for (let i = 0; i < 8; i++) rohy.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
  if (orez < 1) {   // dlhe nastroje: zaberieme len hlavu (koniec na -x), rukovat odide z obrazka
    const g = skupina.children[0].geometry; g.computeBoundingBox(); const lok = g.boundingBox;
    const mx = lok.min.x + (lok.max.x - lok.min.x) * orez;
    rohy.length = 0;
    for (let i = 0; i < 8; i++) rohy.push(new THREE.Vector3(i & 1 ? mx : lok.min.x, i & 2 ? lok.max.y : lok.min.y, i & 4 ? lok.max.z : lok.min.z).applyMatrix4(skupina.matrixWorld));
    box.setFromPoints(rohy); box.getCenter(cil);
  }
  for (let it = 0; it < 6; it++) {
    kam.position.copy(cil).addScaledVector(dir, d); kam.lookAt(cil); kam.updateMatrixWorld(true);
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const p of rohy) { const n = p.clone().project(kam); x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y); }
    const sirka = Math.max(x1 - x0, y1 - y0) / 2;                    // 1 = cely obraz
    const pol = Math.tan(THREE.MathUtils.degToRad(kam.fov / 2)) * d; // polovica vysky pohladu na vzdialenosti d
    const pravo = new THREE.Vector3().setFromMatrixColumn(kam.matrixWorld, 0), hore = new THREE.Vector3().setFromMatrixColumn(kam.matrixWorld, 1);
    cil.addScaledVector(pravo, (x0 + x1) / 2 * pol).addScaledVector(hore, (y0 + y1) / 2 * pol);
    d *= Math.max(sirka, 0.05) / 0.86;
  }
  kam.position.copy(cil).addScaledVector(dir, d); kam.lookAt(cil);
}

function vyrenderuj(renderer, s, kam, p) {
  const [geo, mat] = p.model;
  const mesh = new THREE.Mesh(geo, mat);
  const skupina = new THREE.Group(); skupina.add(mesh);
  mesh.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
  // dlhe predmety (nastroje, palice) polozime uhlopriecne, ako byva zvykom v inventaroch
  const dlhy = b.x > 1.7 * Math.max(b.y, b.z);
  if (dlhy) { skupina.rotation.set(0, 0.5, 0.75); }
  else skupina.rotation.y = -0.5;
  s.add(skupina); skupina.updateMatrixWorld(true);
  zaber(kam, skupina, dlhy && p.nastroj ? 0.62 : 1);   // orez len u nastrojov
  renderer.render(s, kam);
  const url = renderer.domElement.toDataURL('image/png');
  s.remove(skupina);
  return url;
}

export function naplnIkony() {
  const renderer = vytvorRenderer();
  if (!renderer) return;
  const s = scena(), kam = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  for (const p of Object.values(PREDMETY)) {
    if (!p.model || p.ikona3d) continue;
    try {
      p.ikona3d = vyrenderuj(renderer, s, kam, p);
      p.ikonaSvg = p.ikona;
      p.ikona = `<img class="ik3" src="${p.ikona3d}" alt="">`;
    } catch (e) { console.warn('Ikona z modelu zlyhala:', p.id, e); }
  }
  renderer.dispose();
}

naplnIkony();
