// Start hry a hlavna slucka: spaja grafiku, svet, hraca, kanoe, kameru, inventar, zvuk a HUD.
import * as THREE from 'three';
import { vytvorGrafiku, FARBA_HMLY } from './grafika.js';
import { initVstup, klavesy, mys, stlacene, stlac, koniecSnimku } from './vstup.js';
import { initSvet, aktualizujSvet, vyskaTerenu, ostrovPri, startovaciaPozicia, najblizsiPredmet, zober, zobrate, uzlyPri, BIOM_MENO } from './svet.js';
import { vytvorOcean, vyskaVody, priliv } from './ocean.js';
import { vytvorHraca } from './hrac.js';
import { vytvorKanoe, vietor, aktualizujVietor, DRUHY } from './kanoe.js';
import { vytvorKameru } from './kamera.js';
import { vytvorCastice } from './castice.js';
import { najdiCiel, poskod, aktualizujUzly, najdiZber, stavRastlin, nacitajStavRastlin } from './vegetacia.js';
import { poskodenie, opotrebuj } from './nastroje.js';
import { nastavLodenicu } from './obsah/vylepsenia.js';
import { initLodenice, polozLodenicu, najblizsiaLodenica, miestoSpustenia, ulozLodenice, nacitajLodenice } from './lodenica.js';
import { initZivocichy, aktualizujZivocichy, najdiUlovok, udalosti } from './zivocichy.js';
import './obsah/jedlo.js';
import { aktualizujPreziti, zjedz, zran, oziv, ulozPreziti, nacitajPreziti, vykresliPreziti, udalosti as udalostiPreziti, rychlostNasobok, stav as stavPreziti } from './preziti.js';
import { initMore, aktualizujMore, najdiMorskyZber, udalosti as moreUdalosti } from './more.js';
import { initPocasie, aktualizujPocasie, casText, ulozPocasie, nacitajPocasie, MLHA, POD_VODOU } from './pocasie.js';
import { dev, initDev, aktualizujDev } from './dev.js';
import { jeBujny } from './vegetacia.js';
import { initZvuk, aktualizujZvuk, zvuky } from './zvuk.js';
import { initOhen, polozOhen, najblizsiOhen, prilozDrevo, pec, daSaUpiect, hori, aktualizujOhne, ulozOhne, nacitajOhne } from './ohen.js';
import { initStavba, miesto, nahlad, poloz, najdiDiel, uderDiel, ulozStavby, nacitajStavby } from './stavba.js';
import { sloty, pocet, pridaj, odober, nacitaj, vyber, prepniBatoh, jeOtvoreny, rezimOkna, vykresli as vykresliInventar, initInventar, vybranyPredmet, vybranyIndex } from './inventar.js';
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
// lode: kanoe = aktivna lod (ta, v ktorej sedis, alebo najblizsia k hracovi)
const lode = [];
let kanoe = null;
const novaLod = (druh, x, z) => { const l = vytvorKanoe(scena, x, z, { pena, zvuky }, druh); lode.push(l); return l; };
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
initLodenice(scena);
initStavba(scena);
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
    // lode (stary format ulozenia: jedno kanoe v u.kanoe)
    const popisy = Array.isArray(u.lode) ? u.lode : [{ d: 'kanoe', x: u.kanoe[0], z: u.kanoe[1], s: u.kanoe[2], u: u.kanoeUroven, v: u.kanoeVyl }];
    for (const d of popisy) {
      if (!DRUHY[d.d]) continue;
      const l = novaLod(d.d, d.x, d.z); l.smer = d.s;
      if (d.u) l.nastavUroven(d.u);
      if (d.v) Object.assign(l.vyl, d.v);
      if (Array.isArray(d.sk)) d.sk.slice(0, l.sklad.length).forEach((p, i) => { l.sklad[i] = p && PREDMETY[p.typ] ? p : null; });
    }
    kanoe = lode[Math.max(0, Math.min(u.aktivna | 0, lode.length - 1))] || null;
    nacitajLodenice(u.lodenice);
    u.objavene.forEach(o => objavene.add(o));
    u.zobrate.forEach(id => zobrate.add(id));
    nacitaj(u.inventar);
    cas = u.cas || 0;
    nacitajStavRastlin(u.rastliny || {});
    nacitajPreziti(u.preziti);
    nacitajPocasie(u.pocasie);
    nacitajOhne(u.ohne);
    nacitajStavby(u.stavby);
    if (u.vKanoe && kanoe) nastup();
  }
} catch (e) { /* nova hra */ }
if (!lode.length) novaLod('kanoe', start.kanoe.x, start.kanoe.z);
if (!kanoe) kanoe = lode[0];
function uloz() {
  try {
    localStorage.setItem(KLUC, JSON.stringify({ hrac: hrac.poz.toArray(),
      lode: lode.map(l => ({ d: l.druh, x: +l.poz.x.toFixed(1), z: +l.poz.y.toFixed(1), s: +l.smer.toFixed(3), u: l.uroven, v: l.vyl, sk: l.sklad })), aktivna: lode.indexOf(kanoe), lodenice: ulozLodenice(),
      vKanoe, objavene: [...objavene], zobrate: [...zobrate], inventar: sloty, cas, rastliny: stavRastlin(), preziti: ulozPreziti(), pocasie: ulozPocasie(), ohne: ulozOhne(), stavby: ulozStavby() }));
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
  const diel = najdiDiel(hrac.poz.x, hrac.poz.z, fx, fz);             // stavba ma prednost (je blizko pred hracom)
  if (diel) {
    zvuky.uder('drevo'); kam.zatras(0.02);
    const vynos = uderDiel(diel);
    if (vynos) { zvuky.pad(); zoberVsetko(vynos); }
    return;
  }
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
// ---------- lodenica a lode ----------
const lodBlizko = (d = 30) => lode.reduce((n, l) => { const k = Math.hypot(l.poz.x - hrac.poz.x, l.poz.y - hrac.poz.z); return k < d && (!n || k < n.k) ? { l, k } : n; }, null)?.l ?? null;
nastavLodenicu({
  lod: () => lodBlizko(),
  postav(druh) {
    const L = najblizsiaLodenica(hrac.poz.x, hrac.poz.z, 14);
    if (!L) { oznam('Si ďaleko od lodenice'); return false; }
    const m = miestoSpustenia(L, (x, z) => lode.some(l => Math.hypot(l.poz.x - x, l.poz.y - z) < 9));
    if (!m) { oznam('Pri lodenici nie je voľné miesto na vode'); return false; }
    novaLod(druh, m.x, m.z).smer = m.smer;
    zvuky.pad(); oznam(`🛠️ Postavená loď: ${DRUHY[druh].nazov} – čaká na vode pri splave`);
    return true;
  },
});
// dev: lod na najblizsie vodne miesto pri hracovi
function spawnLod(druh) {
  const px = vKanoe ? kanoe.poz.x : hrac.poz.x, pz = vKanoe ? kanoe.poz.y : hrac.poz.z;
  for (let r = 6; r <= 80; r += 3) for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
    if (vyskaTerenu(x, z) < -1.8 && !lode.some(l => Math.hypot(l.poz.x - x, l.poz.y - z) < 10)) { novaLod(druh, x, z); oznam(`Dev: ${DRUHY[druh].nazov}`); return; }
  }
  oznam('Dev: v okolí nie je voda');
}
function otvorOkno(rezim, pole, nazov) { prepniBatoh(true, rezim, pole, nazov); document.exitPointerLock(); }

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
initDev({ hrac, get kanoe() { return kanoe; }, spawnLod, kam, jeVKanoe: () => vKanoe, vystup, oznam, posunCas: s => { cas += s; }, start: start.hrac, uloz });
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
  const stav = vKanoe ? `${kanoe.stat.nazov} · <b>${(kanoe.rychlost() * 1.944).toFixed(0)}</b> uzlov` + (kanoe.plachtaV > 0.5 ? ` · plachta ${Math.round(kanoe.ucinnost * 100)} %` : '')
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
  if (!vKanoe) kanoe = lodBlizko(1e9) || kanoe;                    // na brehu je aktivna najblizsia lod
  const lx = vKanoe ? kanoe.poz.x : hrac.poz.x, lz = vKanoe ? kanoe.poz.y : hrac.poz.z;
  for (const l of lode) if (!(vKanoe && l === kanoe) && Math.hypot(l.poz.x - lx, l.poz.y - lz) < 250) l.aktualizuj(dt, cas, false);
  const dosahLode = 4.5 + kanoe.stat.dlzka * 0.12;
  if (stlacene('Tab')) { if (prepniBatoh(!jeOtvoreny() || rezimOkna() === 'stavba', 'batoh')) document.exitPointerLock(); else zamkni(); }
  if (stlacene('KeyB') && !stavPreziti.mrtvy && !vKanoe) {   // stavebne menu
    if (jeOtvoreny() && rezimOkna() === 'stavba') { prepniBatoh(false); zamkni(); }
    else { prepniBatoh(true, 'stavba'); document.exitPointerLock(); }
  }
  if (stlacene('KeyR') && !stavPreziti.mrtvy && (vKanoe || Math.hypot(hrac.poz.x - kanoe.poz.x, hrac.poz.z - kanoe.poz.y) < dosahLode)) {
    if (jeOtvoreny()) { prepniBatoh(false); zamkni(); } else otvorOkno('sklad', kanoe.sklad, `Sklad: ${kanoe.stat.nazov}`);
  }
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
    } else if (d?.polozit === 'lodenica' && !vKanoe) {      // polozit lodenicu 5 m pred postavu (pri brehu)
      const r = polozLodenicu(hrac.poz.x - Math.sin(hrac.smer) * 5, hrac.poz.z - Math.cos(hrac.smer) * 5);
      if (r !== true) oznam(r);
      else { odober(d.id, 1); vykresliInventar(); hrac.drz(vybranyPredmet()); zvuky.pad(); oznam('🏗️ Lodenica postavená – E pri nej staviaš lode'); }
    } else if (d?.polozit === 'stavba' && !vKanoe) {       // polozit stavebny diel (nahlad ukazuje kam)
      const p = miesto(d.id, hrac.poz.x, hrac.poz.z, kam.yaw, cas);
      if (!p.ok) oznam(p.dovod);
      else { poloz(p); odober(d.id, 1); vykresliInventar(); hrac.drz(vybranyPredmet()); zvuky.pad(); }
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
    if (stlacene('Mys0') && zivy) hrac.uder();
    const blizko = Math.hypot(hrac.poz.x - kanoe.poz.x, hrac.poz.z - kanoe.poz.y) < dosahLode;
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
    else if (vybranyPredmet()?.polozit === 'stavba') napoveda = `<kbd>F</kbd> položiť: ${vybranyPredmet().meno.toLowerCase()} · otáčaš pohľadom · <kbd>klik</kbd> rozobrať`;
    const lodUk = !blizko && !predmet && !ohen && !ulovok && !zber && !more && najblizsiaLodenica(hrac.poz.x, hrac.poz.z, 7);
    if (blizko) napoveda = `<kbd>E</kbd> nastúpiť: ${kanoe.stat.nazov} · <kbd>R</kbd> sklad`;
    else if (lodUk) napoveda = '<kbd>E</kbd> lodenica – stavba a vylepšenie lodí';
    else if (ohen) { /* napoveda uz je */ }
    else if (predmet) napoveda = `<kbd>E</kbd> zdvihnúť: ${PREDMETY[predmet.userData.typ].meno}`;
    else if (ulovok) napoveda = `<kbd>E</kbd> ${ulovok.text}`;
    else if (zber) napoveda = `<kbd>E</kbd> ${zber.text}`;
    else if (more) napoveda = `<kbd>E</kbd> ${more.text}`;
    if ((ulovok || zber || more) && stlacene('KeyE')) { zoberVsetko((ulovok || zber || more).akcia()); hrac.zdvihni(); }
    if (blizko && stlacene('KeyE')) nastup();
    else if (lodUk && stlacene('KeyE')) otvorOkno('lodenica');
    else if (predmet && stlacene('KeyE')) {
      const typ = predmet.userData.typ;
      if (pridaj(typ) === 0) { zober(predmet); hrac.zdvihni(); zvuky.zober(); oznam(`+1 ${PREDMETY[typ].ikona} ${PREDMETY[typ].meno}`); vykresliInventar(); }
      else oznam('Batoh je plný');
    }
  }
  const dStavba = vybranyPredmet()?.polozit === 'stavba' && !vKanoe && vybranyPredmet().id;
  nahlad(dStavba ? miesto(dStavba, hrac.poz.x, hrac.poz.z, kam.yaw, cas) : null);   // ghost dielu
  $('napoveda').innerHTML = napoveda;

  const stred = vKanoe ? kanoe.model.position : hrac.poz;
  const cielKamery = vKanoe ? new THREE.Vector3(kanoe.poz.x, kanoe.y + 1.5, kanoe.poz.y) : new THREE.Vector3(hrac.poz.x, hrac.poz.y + 1.55, hrac.poz.z);
  kam.aktualizuj(dt, cas, cielKamery, { vKanoe, smerKanoe: kanoe.smer, extra: kanoe.stat.kam ?? 0, rychlost: vKanoe ? kanoe.rychlost() : 0, podVodu: hrac.potapa });

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
  g, hrac, get kanoe() { return kanoe; }, lode, kam, scena, zobrate, sloty,
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
