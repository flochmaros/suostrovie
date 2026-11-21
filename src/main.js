// Start hry a hlavna slucka: spaja grafiku, svet, hraca, kanoe, kameru, inventar, zvuk a HUD.
import * as THREE from 'three';
import { vytvorGrafiku, FARBA_HMLY } from './grafika.js';
import { initVstup, klavesy, mys, stlacene, stlac, koniecSnimku } from './vstup.js';
import { initSvet, aktualizujSvet, vyskaTerenu, ostrovPri, startovaciaPozicia, najblizsiPredmet, zober, zobrate, uzlyPri, BIOM_MENO } from './svet.js';
import { vytvorOcean, vyskaVody, priliv } from './ocean.js';
import { vytvorHraca } from './hrac.js';
import { vytvorKanoe, vietor, aktualizujVietor } from './kanoe.js';
import { vytvorKameru } from './kamera.js';
import { vytvorCastice } from './castice.js';
import { najdiCiel, poskod, aktualizujUzly, najdiZber, stavRastlin, nacitajStavRastlin } from './vegetacia.js';
import { poskodenie, opotrebuj } from './nastroje.js';
import { nastavKanoe } from './obsah/vylepsenia.js';
import { initZivocichy, aktualizujZivocichy, najdiUlovok, udalosti } from './zivocichy.js';
import './obsah/jedlo.js';
import { aktualizujPreziti, zjedz, zran, oziv, ulozPreziti, nacitajPreziti, vykresliPreziti, udalosti as udalostiPreziti, rychlostNasobok, stav as stavPreziti } from './preziti.js';
import { initMore, aktualizujMore, najdiMorskyZber, udalosti as moreUdalosti } from './more.js';
import { initPocasie, aktualizujPocasie, casText, ulozPocasie, nacitajPocasie, MLHA, POD_VODOU } from './pocasie.js';
import { dev, initDev, aktualizujDev } from './dev.js';
import { jeBujny } from './vegetacia.js';
import { initZvuk, aktualizujZvuk, zvuky } from './zvuk.js';
import { initOhen, polozOhen, najblizsiOhen, prilozDrevo, pec, daSaUpiect, hori, aktualizujOhne, ulozOhne, nacitajOhne } from './ohen.js';
import { sloty, pocet, pridaj, odober, nacitaj, vyber, prepniBatoh, jeOtvoreny, vykresli as vykresliInventar, initInventar, vybranyPredmet, vybranyIndex } from './inventar.js';
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
nastavKanoe(kanoe);
initZivocichy(scena);
udalosti.priSplachu = (x, y, z, s) => {
  zvuky.splach(Math.min(s, 1) * 0.6);
  for (let i = 0; i < 10 * s + 4; i++) pena.vypust(x, y + 0.1, z, (Math.random() - 0.5) * 3 * s, 2 + Math.random() * 3 * s, (Math.random() - 0.5) * 3 * s, 0xffffff, 0.8);
};
initMore(scena);
moreUdalosti.priSplachu = udalosti.priSplachu;
moreUdalosti.priZraneni = (dmg, pricina) => zran(dmg, pricina);
initPocasie(g);
initOhen(scena);
let poc = null;                                   // posledny stav pocasia (hodina, svetlo, dazd...)
const kam = vytvorKameru(kamera);
hrac.poz.set(start.hrac.x, vyskaTerenu(start.hrac.x, start.hrac.z), start.hrac.z);

// ---------- stav + ukladanie ----------
let vKanoe = false, cas = 0;
const objavene = new Set();
const KLUC = 'suostrovie-ulozenie-v3';
try {
  const u = JSON.parse(localStorage.getItem(KLUC));
  if (u) {
    hrac.poz.fromArray(u.hrac);
    kanoe.poz.set(u.kanoe[0], u.kanoe[1]); kanoe.smer = u.kanoe[2];
    u.objavene.forEach(o => objavene.add(o));
    u.zobrate.forEach(id => zobrate.add(id));
    nacitaj(u.inventar);
    cas = u.cas || 0;
    nacitajStavRastlin(u.rastliny || {});
    nacitajPreziti(u.preziti);
    nacitajPocasie(u.pocasie);
    if (u.kanoeUroven) kanoe.nastavUroven(u.kanoeUroven);
    if (u.kanoeTyp) kanoe.nastavTyp(u.kanoeTyp);
    if (u.kanoeVyl) Object.assign(kanoe.vyl, u.kanoeVyl);
    nacitajOhne(u.ohne);
    if (u.vKanoe) nastup();
  }
} catch (e) { /* nova hra */ }
function uloz() {
  try {
    localStorage.setItem(KLUC, JSON.stringify({ hrac: hrac.poz.toArray(), kanoe: [kanoe.poz.x, kanoe.poz.y, kanoe.smer],
      vKanoe, objavene: [...objavene], zobrate: [...zobrate], inventar: sloty, cas, rastliny: stavRastlin(), kanoeUroven: kanoe.uroven, kanoeTyp: kanoe.typ, kanoeVyl: kanoe.vyl, preziti: ulozPreziti(), pocasie: ulozPocasie(), ohne: ulozOhne() }));
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
  const zdroj = ZDROJE[u.typ], material = zdroj.material;
  const nastroj = vybranyPredmet();
  const dmg = poskodenie(nastroj?.nastroj ? nastroj : null, zdroj) * dev.silaUderu;
  zvuky.uder(material);
  if (dmg <= 0.01) { oznam(zdroj.nastroj === 'krompac' ? 'Potrebuješ krompáč' : 'Potrebuješ nástroj'); return; }
  if (nastroj?.nastroj && !dev.bezOpotrebenia && opotrebuj(vybranyIndex())) oznam(`${nastroj.ikona} ${nastroj.meno} sa zlomil(a)!`);
  kam.zatras(material === 'list' ? 0.012 : 0.03);
  const d = Math.max(u.rKolizia, 0.3);
  for (let i = 0; i < 14; i++) triesky.vypust(u.x - fx * d, hrac.poz.y + 1.1, u.z - fz * d,
    -fx * 2 + (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2.5, -fz * 2 + (Math.random() - 0.5) * 3, FARBA_TRIESOK[material], 0.9);
  const vynos = poskod(u, fx, fz, dmg);
  if (!vynos) { if (zdroj.nastroj && !nastroj?.nastroj) oznam('Rukami to pôjde pomaly – vyrob si nástroj (Tab)'); return; }
  zobrate.add(u.id);
  if (material === 'drevo' && u.rKolizia > 0.2) setTimeout(() => { zvuky.pad(); kam.zatras(0.05); }, 1100);
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
initVstup(platno, zamknuta => { $('start').style.display = zamknuta || jeOtvoreny() || dev.zapnuty || stavPreziti.mrtvy ? 'none' : 'flex'; });
udalostiPreziti.priVarovani = t => oznam(t);
udalostiPreziti.priSmrti = () => document.exitPointerLock();
udalostiPreziti.priZobudeni = () => {
  oziv();
  const s = start.hrac;
  if (vKanoe) vystup([s.x, s.z]);
  hrac.poz.set(s.x, vyskaTerenu(s.x, s.z), s.z); hrac.rych.set(0, 0, 0); hrac.vy = 0;
  zamkni();
};
initDev({ hrac, kanoe, kam, jeVKanoe: () => vKanoe, vystup, oznam, posunCas: s => { cas += s; }, start: start.hrac, uloz });
$('start').addEventListener('click', () => { initZvuk(); zamkni(); });
initInventar(() => hrac.drz(vybranyPredmet()));
vykresliInventar();
hrac.drz(vybranyPredmet());

// ---------- HUD ----------
let poslednyOstrov = null, casNapisu = 0;
const STRANY = ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ'];
const BIOM = BIOM_MENO;
const uhol = smer => ((Math.atan2(-Math.sin(smer), Math.cos(smer)) * 180 / Math.PI) + 360) % 360;
function hud(dt, p) {
  const o = ostrovPri(p.x, p.z, 1.3);
  if (o && o !== poslednyOstrov) {
    const kluc = o.bx + ',' + o.bz, novy = !objavene.has(kluc);
    objavene.add(kluc);
    $('ostrov').innerHTML = o.meno + `<small>${novy ? 'Nový ostrov objavený!' : BIOM[o.biom] + (jeBujny(o) ? ' · bujný' : '')}</small>`;
    $('ostrov').style.opacity = 1;
    casNapisu = 4;
  }
  poslednyOstrov = o;
  if ((casNapisu -= dt) < 0) $('ostrov').style.opacity = 0;

  const s = uhol(kam.yaw), v = uhol(vietor.smer), pr = priliv(cas);
  $('kompas').innerHTML = `<span class="smer">${STRANY[Math.round(s / 45) % 8]} ${Math.round(s)}°</span><br>`
    + `Vietor → ${STRANY[Math.round(v / 45) % 8]} ${'▮'.repeat(Math.round(vietor.sila * 5))}<br>`
    + `${Math.cos(cas * 2 * Math.PI / 300) > 0 ? 'Príliv ↑' : 'Odliv ↓'} ${pr >= 0 ? '+' : ''}${pr.toFixed(1)} m<br>${casText(poc)}${poc.burka ? ' · ⛈' : poc.dazd > 0.3 ? ' · 🌧' : ''}`;
  const stav = vKanoe ? `Kanoe · <b>${(kanoe.rychlost() * 1.944).toFixed(0)}</b> uzlov` + (kanoe.plachtaV > 0.5 ? ` · plachta ${Math.round(kanoe.ucinnost * 100)} %` : '')
    : hrac.potapa ? 'Potápaš sa' : hrac.plava ? 'Plávaš' : 'Pešo';
  $('info').innerHTML = `<b>${o ? o.meno : 'Otvorené more'}</b><br>${stav}<br>Objavené ostrovy: ${objavene.size}`;
  $('dych').style.display = hrac.dych < 1 && !vKanoe ? 'block' : 'none';
  $('dych').firstChild.style.width = hrac.dych * 100 + '%';
}

// pridanie viacerych predmetov do batohu + oznamy
function zoberVsetko(vynos) {
  for (const [id, n] of vynos) {
    const navyse = pridaj(id, n);
    if (n - navyse > 0) oznam(`+${n - navyse} ${PREDMETY[id].ikona} ${PREDMETY[id].meno}`);
    if (navyse) oznam('Batoh je plný');
  }
  zvuky.zober(); vykresliInventar();
}

// ---------- hlavna slucka ----------
function aktualizuj(dt) {
  cas += dt;
  aktualizujVietor(cas);
  if (poc) vietor.sila = 0.3 + 0.7 * poc.vietorSila;
  const letim = aktualizujDev(dt, g);
  if (stlacene('Tab')) { if (prepniBatoh()) document.exitPointerLock(); else zamkni(); }
  for (let i = 0; i < 8; i++) if (stlacene('Digit' + (i + 1))) vyber(i);
  if (stlacene('KeyF') && !stavPreziti.mrtvy) {           // zjest / vypit vybrany predmet
    const d = vybranyPredmet();
    if (d?.jedlo) {
      if (zjedz(d)) { odober(d.id, 1); vykresliInventar(); zvuky.zober(); oznam(`Zjedol si: ${d.ikona} ${d.meno}`); }
      else oznam('Nie si hladný ani smädný');
    } else if (d?.polozit === 'taborak') {                // polozit taborak pred postavu
      const x = hrac.poz.x - Math.sin(hrac.smer) * 1.9, z = hrac.poz.z - Math.cos(hrac.smer) * 1.9;
      if (vKanoe || hrac.plava) oznam('Oheň sa dá položiť len na súši');
      else if (vyskaTerenu(x, z) < vyskaVody(x, z, cas) + 0.15) oznam('Tu je voda – oheň polož na suchú zem');
      else if (!polozOhen(x, z)) oznam('Príliš blízko iného ohňa');
      else { odober(d.id, 1); vykresliInventar(); hrac.drz(vybranyPredmet()); zvuky.pad(); oznam('🔥 Táborák horí – prikladaj drevo (E)'); }
    }
  }
  const zivy = !stavPreziti.mrtvy;

  let napoveda = '';
  if (vKanoe) {
    kanoe.aktualizuj(dt, cas, true);
    hrac.animuj(dt, 'sedi', 0, kanoe.faza);
    const miesto = miestoNaVystup(cas);
    if (miesto) napoveda = '<kbd>E</kbd> vystúpiť na breh';
    const more = !miesto && najdiMorskyZber(hrac.poz.x, hrac.poz.y, hrac.poz.z);
    if (more) napoveda = `<kbd>E</kbd> ${more.text}`;
    if (miesto && stlacene('KeyE')) vystup(miesto);
    else if (more && stlacene('KeyE')) zoberVsetko(more.akcia());
  } else {
    hrac.nasobok = rychlostNasobok();
    if (!letim && zivy) hrac.aktualizuj(dt, kam.yaw, cas);
    kanoe.aktualizuj(dt, cas, false);
    if (stlacene('Mys0') && zivy) hrac.uder();
    const blizko = Math.hypot(hrac.poz.x - kanoe.poz.x, hrac.poz.z - kanoe.poz.y) < 4.5;
    const predmet = !blizko && najblizsiPredmet(hrac.poz.x, hrac.poz.z);
    const ohen = !blizko && !predmet && najblizsiOhen(hrac.poz.x, hrac.poz.z);   // taborak ma prednost pred zberom
    const ulovok = !blizko && !predmet && !ohen && najdiUlovok(hrac.poz.x, hrac.poz.z);
    const zber = !blizko && !predmet && !ohen && !ulovok && najdiZber(hrac.poz.x, hrac.poz.z, -Math.sin(hrac.smer), -Math.cos(hrac.smer));
    const more = !blizko && !predmet && !ohen && !ulovok && !zber && najdiMorskyZber(hrac.poz.x, hrac.poz.y, hrac.poz.z);
    if (ohen) {                                            // taborak: upiect vybrane jedlo, inak prilozit drevo
      const d = vybranyPredmet(), mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      const peci = hori(ohen) && d && daSaUpiect(d.id);
      napoveda = peci ? `<kbd>E</kbd> upiecť: ${d.ikona} ${d.meno}`
        : pocet('drevo') ? `<kbd>E</kbd> ${hori(ohen) ? 'priložiť drevo' : 'zapáliť (drevo)'}` : hori(ohen) ? 'Na priloženie treba 🪵 drevo' : 'Pahreba – zapáliš ju drevom';
      if (hori(ohen)) napoveda += ` · 🔥 ${mmss(ohen.palivo)}${ohen.pecie.length ? ` · pečie sa ${ohen.pecie.length}×` : ''}`;
      if (stlacene('KeyE')) {
        if (peci) { if (pec(ohen, d.id)) { odober(d.id, 1); vykresliInventar(); zvuky.syc(); } else oznam('Na ohni už nie je miesto'); }
        else if (pocet('drevo')) { if (prilozDrevo(ohen)) { odober('drevo', 1); vykresliInventar(); zvuky.uder('drevo'); hrac.zdvihni(); } else oznam('Oheň je plný dreva'); }
      }
    } else if (vybranyPredmet()?.polozit === 'taborak') napoveda = '<kbd>F</kbd> položiť táborák';
    if (blizko) napoveda = '<kbd>E</kbd> nastúpiť do kanoe';
    else if (ohen) { /* napoveda uz je */ }
    else if (predmet) napoveda = `<kbd>E</kbd> zdvihnúť: ${PREDMETY[predmet.userData.typ].meno}`;
    else if (ulovok) napoveda = `<kbd>E</kbd> ${ulovok.text}`;
    else if (zber) napoveda = `<kbd>E</kbd> ${zber.text}`;
    else if (more) napoveda = `<kbd>E</kbd> ${more.text}`;
    if ((ulovok || zber || more) && stlacene('KeyE')) { zoberVsetko((ulovok || zber || more).akcia()); hrac.zdvihni(); }
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

  poc = aktualizujPocasie(dt, cas, stred);
  // pod vodou: modra hmla nablizko
  const podVodou = kamera.position.y < vyskaVody(kamera.position.x, kamera.position.z, cas) - 0.05;
  scena.fog.color.set(podVodou ? POD_VODOU : FARBA_HMLY);
  scena.fog.near = podVodou ? 0.5 : MLHA.near;
  scena.fog.far = podVodou ? 40 : MLHA.far;

  ocean.aktualizuj(stred.x, stred.z, cas);
  const hotovo = aktualizujSvet(stred.x, stred.z);
  $('nacitanie').textContent = hotovo ? '' : 'Načítavam ostrovy…';
  aktualizujUzly(dt, cas);
  aktualizujZivocichy(dt, cas, hrac.poz, kanoe.poz, vKanoe);
  aktualizujMore(dt, cas, hrac.poz, podVodou, kanoe.poz, vKanoe);
  const ohne = aktualizujOhne(dt, cas, hrac.poz, vietor);
  for (const id of ohne.upecene) {
    const navyse = pridaj(id, 1);
    oznam(navyse ? 'Batoh je plný' : `Upečené: ${PREDMETY[id].ikona} ${PREDMETY[id].meno}`);
    zvuky.zober(); vykresliInventar();
  }
  if (zivy) aktualizujPreziti(dt, { priOhni: ohne.priOhni && !vKanoe, beh: !vKanoe && klavesy.has('ShiftLeft') && hrac.rych.length() > 5, plava: hrac.plava && !vKanoe,
    vKanoe, padluje: vKanoe && (klavesy.has('KeyW') || klavesy.has('KeyS')), teplo: 0.6 + 0.8 * poc.svetlo });
  vykresliPreziti();
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
  posunCas(s) { cas += s; },
  otoc(yaw, pitch) { kam.yaw = yaw; if (pitch !== undefined) kam.pitch = pitch; mys.posledny = performance.now(); },
};
