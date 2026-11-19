// Start hry a hlavna slucka: spaja grafiku, svet, hraca, kanoe, kameru, inventar, zvuk a HUD.
import * as THREE from 'three';
import { vytvorGrafiku, FARBA_HMLY } from './grafika.js';
import { initVstup, klavesy, mys, stlacene, stlac, koniecSnimku } from './vstup.js';
import { initSvet, aktualizujSvet, vyskaTerenu, ostrovPri, startovaciaPozicia, najblizsiPredmet, zober, zobrate, uzlyPri } from './svet.js';
import { vytvorOcean, vyskaVody, priliv } from './ocean.js';
import { vytvorHraca } from './hrac.js';
import { vytvorKanoe, vietor, aktualizujVietor } from './kanoe.js';
import { vytvorKameru } from './kamera.js';
import { vytvorCastice } from './castice.js';
import { najdiCiel, poskod, aktualizujUzly } from './vegetacia.js';
import { initZvuk, aktualizujZvuk, zvuky } from './zvuk.js';
import { sloty, pridaj, nacitaj, vyber, prepniBatoh, jeOtvoreny, vykresli as vykresliInventar, initInventar, vybranyPredmet } from './inventar.js';
import { PREDMETY } from './obsah/predmety.js';
import { ZDROJE } from './obsah/zdroje.js';

const $ = id => document.getElementById(id);
const g = vytvorGrafiku();
const { scena, kamera } = g;

initSvet(scena);
const ocean = vytvorOcean(g);
const pena = vytvorCastice(scena, { pocet: 700, velkost: 0.28, aditivne: true });
const triesky = vytvorCastice(scena, { pocet: 300, velkost: 0.11 });
const start = startovaciaPozicia();
const hrac = vytvorHraca(scena);
const kanoe = vytvorKanoe(scena, start.kanoe.x, start.kanoe.z, { pena, zvuky });
const kam = vytvorKameru(kamera);
hrac.poz.set(start.hrac.x, vyskaTerenu(start.hrac.x, start.hrac.z), start.hrac.z);

// ---------- stav + ukladanie ----------
let vKanoe = false, cas = 0;
const objavene = new Set();
const KLUC = 'suostrovie-ulozenie-v2';
try {
  const u = JSON.parse(localStorage.getItem(KLUC));
  if (u) {
    hrac.poz.fromArray(u.hrac);
    kanoe.poz.set(u.kanoe[0], u.kanoe[1]); kanoe.smer = u.kanoe[2];
    u.objavene.forEach(o => objavene.add(o));
    u.zobrate.forEach(id => zobrate.add(id));
    nacitaj(u.inventar);
    cas = u.cas || 0;
    if (u.vKanoe) nastup();
  }
} catch (e) { /* nova hra */ }
function uloz() {
  try {
    localStorage.setItem(KLUC, JSON.stringify({ hrac: hrac.poz.toArray(), kanoe: [kanoe.poz.x, kanoe.poz.y, kanoe.smer],
      vKanoe, objavene: [...objavene], zobrate: [...zobrate], inventar: sloty, cas }));
  } catch (e) { /* ukladanie nedostupne */ }
}
setInterval(uloz, 5000);
addEventListener('beforeunload', uloz);

function oznam(text) {
  const d = document.createElement('div');
  d.className = 'oznam panel'; d.textContent = text;
  $('oznamy').appendChild(d);
  setTimeout(() => d.remove(), 2700);
}

// ---------- kanoe: nastup / vystup ----------
function nastup() {
  vKanoe = true;
  kanoe.model.add(hrac.model);
  hrac.model.position.copy(kanoe.SEDADLO);
  hrac.model.rotation.set(0, 0, 0);
}
function miestoNaVystup(t) {
  for (let r = 1.5; r <= 9; r += 0.5) for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, x = kanoe.poz.x + Math.cos(a) * r, z = kanoe.poz.y + Math.sin(a) * r;
    if (vyskaTerenu(x, z) > vyskaVody(x, z, t) + 0.15) return [x, z];
  }
  return null;
}
function vystup([x, z]) {
  vKanoe = false;
  scena.add(hrac.model);
  hrac.poz.set(x, vyskaTerenu(x, z), z);
  hrac.rych.set(0, 0, 0); hrac.vy = 0;
}

// ---------- udalosti hraca ----------
const FARBA_TRIESOK = { drevo: 0x8a6240, kamen: 0x9a978f, list: 0x4f8a35 };
hrac.priUdere = () => {
  const fx = -Math.sin(hrac.smer), fz = -Math.cos(hrac.smer);
  const u = najdiCiel(uzlyPri(hrac.poz.x, hrac.poz.z), hrac.poz.x, hrac.poz.z, fx, fz);
  if (!u) return;
  const material = ZDROJE[u.typ].material;
  zvuky.uder(material);
  const d = Math.max(u.rKolizia, 0.3);
  for (let i = 0; i < 14; i++) triesky.vypust(u.x - fx * d, hrac.poz.y + 1.1, u.z - fz * d,
    -fx * 2 + (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2.5, -fz * 2 + (Math.random() - 0.5) * 3, FARBA_TRIESOK[material], 0.9);
  const vynos = poskod(u, fx, fz);
  if (!vynos) return;
  zobrate.add(u.id);
  if (u.typ === 'palma' || u.typ === 'strom') setTimeout(() => zvuky.pad(), 1100);
  for (const [id, n] of vynos) {
    const navyse = pridaj(id, n);
    if (n - navyse > 0) oznam(`+${n - navyse} ${PREDMETY[id].ikona} ${PREDMETY[id].meno}`);
    if (navyse) oznam('Batoh je plný');
  }
  vykresliInventar();
};
hrac.priKroku = () => zvuky.krok(vyskaTerenu(hrac.poz.x, hrac.poz.z) < 1.6);
hrac.priSplachu = sila => {
  zvuky.splach(sila);
  const y = vyskaVody(hrac.poz.x, hrac.poz.z, cas);
  for (let i = 0; i < 30 * sila + 8; i++) pena.vypust(hrac.poz.x, y, hrac.poz.z, (Math.random() - 0.5) * 4, 2 + Math.random() * 4 * sila, (Math.random() - 0.5) * 4, 0xffffff, 0.8);
};

// ---------- vstup, inventar ----------
const platno = g.renderer.domElement;
const zamkni = () => platno.requestPointerLock()?.catch?.(() => {});
initVstup(platno, zamknuta => { $('start').style.display = zamknuta || jeOtvoreny() ? 'none' : 'flex'; });
$('start').addEventListener('click', () => { initZvuk(); zamkni(); });
initInventar(() => hrac.drz(vybranyPredmet()));
vykresliInventar();
hrac.drz(vybranyPredmet());

// ---------- HUD ----------
let poslednyOstrov = null, casNapisu = 0;
const STRANY = ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ'];
const BIOM = { palmovy: 'palmový ostrov', dzungla: 'džungľa', skalnaty: 'skalnatý ostrov' };
const uhol = smer => ((Math.atan2(-Math.sin(smer), Math.cos(smer)) * 180 / Math.PI) + 360) % 360;
function hud(dt, p) {
  const o = ostrovPri(p.x, p.z, 1.3);
  if (o && o !== poslednyOstrov) {
    const kluc = o.bx + ',' + o.bz, novy = !objavene.has(kluc);
    objavene.add(kluc);
    $('ostrov').innerHTML = o.meno + `<small>${novy ? 'Nový ostrov objavený!' : BIOM[o.biom]}</small>`;
    $('ostrov').style.opacity = 1;
    casNapisu = 4;
  }
  poslednyOstrov = o;
  if ((casNapisu -= dt) < 0) $('ostrov').style.opacity = 0;

  const s = uhol(kam.yaw), v = uhol(vietor.smer), pr = priliv(cas);
  $('kompas').innerHTML = `<span class="smer">${STRANY[Math.round(s / 45) % 8]} ${Math.round(s)}°</span><br>`
    + `Vietor → ${STRANY[Math.round(v / 45) % 8]} ${'▮'.repeat(Math.round(vietor.sila * 5))}<br>`
    + `${Math.cos(cas * 2 * Math.PI / 300) > 0 ? 'Príliv ↑' : 'Odliv ↓'} ${pr >= 0 ? '+' : ''}${pr.toFixed(1)} m`;
  const stav = vKanoe ? `Kanoe · <b>${(kanoe.rychlost() * 1.944).toFixed(0)}</b> uzlov` + (kanoe.plachtaV > 0.5 ? ` · plachta ${Math.round(kanoe.ucinnost * 100)} %` : '')
    : hrac.potapa ? 'Potápaš sa' : hrac.plava ? 'Plávaš' : 'Pešo';
  $('info').innerHTML = `<b>${o ? o.meno : 'Otvorené more'}</b><br>${stav}<br>Objavené ostrovy: ${objavene.size}`;
  $('dych').style.display = hrac.dych < 1 && !vKanoe ? 'block' : 'none';
  $('dych').firstChild.style.width = hrac.dych * 100 + '%';
}

// ---------- hlavna slucka ----------
function aktualizuj(dt) {
  cas += dt;
  aktualizujVietor(cas);
  if (stlacene('Tab')) { if (prepniBatoh()) document.exitPointerLock(); else zamkni(); }
  for (let i = 0; i < 8; i++) if (stlacene('Digit' + (i + 1))) vyber(i);

  let napoveda = '';
  if (vKanoe) {
    kanoe.aktualizuj(dt, cas, true);
    hrac.animuj(dt, 'sedi', 0, kanoe.faza);
    const miesto = miestoNaVystup(cas);
    if (miesto) napoveda = '<kbd>E</kbd> vystúpiť na breh';
    if (miesto && stlacene('KeyE')) vystup(miesto);
  } else {
    hrac.aktualizuj(dt, kam.yaw, cas);
    kanoe.aktualizuj(dt, cas, false);
    if (stlacene('Mys0')) hrac.uder();
    const blizko = Math.hypot(hrac.poz.x - kanoe.poz.x, hrac.poz.z - kanoe.poz.y) < 4.5;
    const predmet = !blizko && najblizsiPredmet(hrac.poz.x, hrac.poz.z);
    if (blizko) napoveda = '<kbd>E</kbd> nastúpiť do kanoe';
    else if (predmet) napoveda = `<kbd>E</kbd> zdvihnúť: ${PREDMETY[predmet.userData.typ].meno}`;
    if (blizko && stlacene('KeyE')) nastup();
    else if (predmet && stlacene('KeyE')) {
      const typ = predmet.userData.typ;
      if (pridaj(typ) === 0) { zober(predmet); hrac.zdvihni(); zvuky.zober(); oznam(`+1 ${PREDMETY[typ].ikona} ${PREDMETY[typ].meno}`); vykresliInventar(); }
      else oznam('Batoh je plný');
    }
  }
  $('napoveda').innerHTML = napoveda;

  const stred = vKanoe ? kanoe.model.position : hrac.poz;
  const cielKamery = vKanoe ? new THREE.Vector3(kanoe.poz.x, kanoe.y + 1.5, kanoe.poz.y) : new THREE.Vector3(hrac.poz.x, hrac.poz.y + 1.55, hrac.poz.z);
  kam.aktualizuj(dt, cas, cielKamery, { vKanoe, smerKanoe: kanoe.smer, rychlost: vKanoe ? kanoe.rychlost() : 0, podVodu: hrac.potapa });

  // pod vodou: modra hmla nablizko
  const podVodou = kamera.position.y < vyskaVody(kamera.position.x, kamera.position.z, cas) - 0.05;
  scena.fog.color.set(podVodou ? 0x0d5468 : FARBA_HMLY);
  scena.fog.near = podVodou ? 0.5 : 220;
  scena.fog.far = podVodou ? 40 : 1300;

  ocean.aktualizuj(stred.x, stred.z, cas);
  const hotovo = aktualizujSvet(stred.x, stred.z);
  $('nacitanie').textContent = hotovo ? '' : 'Načítavam ostrovy…';
  aktualizujUzly(dt);
  pena.aktualizuj(dt);
  triesky.aktualizuj(dt);
  g.sledujSlnkom(stred);
  const zem = vyskaTerenu(stred.x, stred.z);
  aktualizujZvuk(cas, { silaVetra: vietor.sila, rychlost: vKanoe ? kanoe.rychlost() : 0, pobrezie: THREE.MathUtils.clamp(1 - Math.abs(zem + 1) / 5, 0, 1), podVodou });
  hud(dt, stred);
}

const hodiny = new THREE.Clock();
function snimok() {
  requestAnimationFrame(snimok);
  aktualizuj(Math.min(hodiny.getDelta(), 0.05));
  g.vykresli();
  koniecSnimku();
}
snimok();

// ---------- ladenie z konzoly: hra.sim(sekundy, ['KeyW'], ['Mys0']) odohra cas bez cakania na snimky ----------
window.hra = {
  g, hrac, kanoe, kam, scena, zobrate, sloty,
  get vKanoe() { return vKanoe; },
  sim(sekundy, drz = [], stlac1 = []) {
    drz.forEach(k => klavesy.add(k));
    stlac1.forEach(stlac);
    for (let i = 0; i < sekundy * 60; i++) { aktualizuj(1 / 60); koniecSnimku(); }
    drz.forEach(k => klavesy.delete(k));
    g.vykresli();
  },
  otoc(yaw, pitch) { kam.yaw = yaw; if (pitch !== undefined) kam.pitch = pitch; mys.posledny = performance.now(); },
};
