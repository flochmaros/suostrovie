// Start hry, hlavna slucka, kamera, HUD, ukladanie
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { initVstup, mys, stlacene, koniecSnimku } from './vstup.js';
import { initSvet, aktualizujSvet, vyskaTerenu, ostrovPri, startovaciaPozicia } from './svet.js';
import { vytvorOcean, vyskaVody } from './ocean.js';
import { vytvorHraca, tlmUhol } from './hrac.js';
import { vytvorKanoe } from './kanoe.js';

const tlm = THREE.MathUtils.damp;
const $ = id => document.getElementById(id);

// ---------- scena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
document.body.appendChild(renderer.domElement);

const scena = new THREE.Scene();
scena.fog = new THREE.Fog(0xa9d3e3, 250, 1000);
const kamera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 12000);

const slnkoSmer = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(55), THREE.MathUtils.degToRad(140));
const obloha = new Sky();
obloha.scale.setScalar(10000);
obloha.material.uniforms.turbidity.value = 4;
obloha.material.uniforms.rayleigh.value = 1.2;
obloha.material.uniforms.sunPosition.value.copy(slnkoSmer);
scena.add(obloha);

scena.add(new THREE.HemisphereLight(0xcfe8ff, 0x8a7a55, 1.1));
const slnko = new THREE.DirectionalLight(0xfff1d6, 2.6);
slnko.castShadow = true;
slnko.shadow.mapSize.set(2048, 2048);
Object.assign(slnko.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
slnko.shadow.bias = -0.0005;
scena.add(slnko, slnko.target);

initSvet(scena);
const ocean = vytvorOcean(scena);
const start = startovaciaPozicia();
const hrac = vytvorHraca(scena);
const kanoe = vytvorKanoe(scena, start.kanoe.x, start.kanoe.z);
hrac.poz.set(start.hrac.x, vyskaTerenu(start.hrac.x, start.hrac.z), start.hrac.z);

// ---------- stav hry + ukladanie ----------
let vKanoe = false;
const objavene = new Set();
const KLUC = 'suostrovie-ulozenie-v1';
try {
  const u = JSON.parse(localStorage.getItem(KLUC));
  if (u) {
    hrac.poz.set(u.hrac[0], u.hrac[1], u.hrac[2]);
    kanoe.poz.set(u.kanoe[0], u.kanoe[1]);
    kanoe.smer = u.kanoe[2];
    u.objavene.forEach(o => objavene.add(o));
    if (u.vKanoe) nastup();
  }
} catch (e) { /* bez ulozenia - nova hra */ }

function uloz() {
  try {
    localStorage.setItem(KLUC, JSON.stringify({
      hrac: hrac.poz.toArray(), kanoe: [kanoe.poz.x, kanoe.poz.y, kanoe.smer], vKanoe, objavene: [...objavene],
    }));
  } catch (e) { /* ukladanie nedostupne */ }
}
setInterval(uloz, 5000);
addEventListener('beforeunload', uloz);

function nastup() {
  vKanoe = true;
  kanoe.model.add(hrac.model);
  hrac.model.position.copy(kanoe.SEDADLO);
  hrac.model.rotation.set(0, 0, 0);
  hrac.telo.rotation.x = 0; hrac.telo.position.y = 0;
}

// hlada najblizsie suche miesto okolo kanoe
function miestoNaVystup(t) {
  for (let r = 1.5; r <= 10; r += 0.5) {
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2;
      const x = kanoe.poz.x + Math.cos(a) * r, z = kanoe.poz.y + Math.sin(a) * r;
      if (vyskaTerenu(x, z) > vyskaVody(x, z, t) + 0.15) return [x, z];
    }
  }
  return null;
}

function vystup(miesto) {
  vKanoe = false;
  scena.add(hrac.model);
  hrac.poz.set(miesto[0], vyskaTerenu(miesto[0], miesto[1]), miesto[1]);
  hrac.rych.set(0, 0, 0); hrac.vy = 0;
}

// ---------- kamera ----------
let yaw = -Math.PI / 2, pitch = 0.3, vzdialenost = 7;
const ciel = new THREE.Vector3().copy(hrac.poz);

function aktualizujKameru(dt, t) {
  yaw -= mys.dx * 0.0025;
  pitch = THREE.MathUtils.clamp(pitch + mys.dy * 0.0025, -0.25, 1.35);
  vzdialenost = THREE.MathUtils.clamp(vzdialenost + mys.koliesko * 1.2, 3, 30);

  const novyCiel = vKanoe
    ? new THREE.Vector3(kanoe.poz.x, kanoe.y + 1.4, kanoe.poz.y)
    : new THREE.Vector3(hrac.poz.x, hrac.poz.y + 1.6, hrac.poz.z);
  // v kanoe sa kamera sama pomaly otoci za kanoe, ked sa nehybe mysou
  if (vKanoe && performance.now() - mys.posledny > 1500) yaw = tlmUhol(yaw, kanoe.smer, 1.2, dt);
  ciel.x = tlm(ciel.x, novyCiel.x, 14, dt);
  ciel.y = tlm(ciel.y, novyCiel.y, 8, dt);
  ciel.z = tlm(ciel.z, novyCiel.z, 14, dt);

  const d = vKanoe ? vzdialenost + 3 : vzdialenost;
  kamera.position.set(
    ciel.x + Math.sin(yaw) * Math.cos(pitch) * d,
    ciel.y + Math.sin(pitch) * d,
    ciel.z + Math.cos(yaw) * Math.cos(pitch) * d);
  // kamera nesmie ist pod teren ani pod vodu
  const minY = Math.max(vyskaTerenu(kamera.position.x, kamera.position.z), vyskaVody(kamera.position.x, kamera.position.z, t)) + 0.5;
  if (kamera.position.y < minY) kamera.position.y = minY;
  kamera.lookAt(ciel);
}

// ---------- HUD ----------
let poslednyOstrov = null, casNapisu = 0;
function hud(dt) {
  const p = vKanoe ? { x: kanoe.poz.x, z: kanoe.poz.y } : hrac.poz;
  const o = ostrovPri(p.x, p.z, 1.3);
  if (o && o !== poslednyOstrov) {
    const kluc = o.bx + ',' + o.bz;
    const novy = !objavene.has(kluc);
    objavene.add(kluc);
    $('ostrov').innerHTML = o.meno + (novy ? '<div style="font-size:15px">Nový ostrov objavený!</div>' : '');
    $('ostrov').style.opacity = 1;
    casNapisu = 4;
  }
  poslednyOstrov = o;
  casNapisu -= dt;
  if (casNapisu < 0) $('ostrov').style.opacity = 0;

  const smer = ((Math.atan2(-Math.sin(yaw), Math.cos(yaw)) * 180 / Math.PI) + 360) % 360;
  const strany = ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ'];
  $('kompas').innerHTML = `${strany[Math.round(smer / 45) % 8]} ${Math.round(smer)}°<br>x ${Math.round(p.x)} · z ${Math.round(p.z)}`;
  $('info').innerHTML = (vKanoe ? `Kanoe · ${(kanoe.rychlost() * 1.944).toFixed(1)} uzlov` : (hrac.plava ? 'Plávaš' : 'Pešo'))
    + `<br>Objavené ostrovy: ${objavene.size}` + (o ? `<br>Ostrov: ${o.meno}` : '<br>Otvorené more');
}

// ---------- hlavna slucka ----------
initVstup(renderer.domElement, zamknuta => { $('start').style.display = zamknuta ? 'none' : 'flex'; });
$('start').addEventListener('click', () => renderer.domElement.requestPointerLock());

const hodiny = new THREE.Clock();
let cas = 0;
function slucka() {
  requestAnimationFrame(slucka);
  const dt = Math.min(hodiny.getDelta(), 0.05);
  cas += dt;

  let napoveda = '';
  if (vKanoe) {
    kanoe.aktualizuj(dt, cas, true);
    const miesto = miestoNaVystup(cas);
    if (miesto) napoveda = 'E – vystúpiť na breh';
    if (miesto && stlacene('KeyE')) vystup(miesto);
  } else {
    hrac.aktualizuj(dt, yaw, cas);
    kanoe.aktualizuj(dt, cas, false);
    const blizko = Math.hypot(hrac.poz.x - kanoe.poz.x, hrac.poz.z - kanoe.poz.y) < 4.5;
    if (blizko) napoveda = 'E – nastúpiť do kanoe';
    if (blizko && stlacene('KeyE')) nastup();
  }
  $('napoveda').textContent = napoveda;

  aktualizujKameru(dt, cas);
  const stred = vKanoe ? kanoe.model.position : hrac.poz;
  ocean.aktualizuj(stred.x, stred.z, cas);
  const nahrate = aktualizujSvet(stred.x, stred.z);
  $('nacitanie').textContent = nahrate < 25 ? 'Načítavam ostrovy…' : '';

  // slnko a tiene idu za hracom
  slnko.position.copy(stred).addScaledVector(slnkoSmer, 200);
  slnko.target.position.copy(stred);

  hud(dt);
  renderer.render(scena, kamera);
  koniecSnimku();
}
slucka();

addEventListener('resize', () => {
  kamera.aspect = innerWidth / innerHeight;
  kamera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

window.hra = { hrac, kanoe, kamera, vyskaTerenu };   // pre ladenie v konzole
