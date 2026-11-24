// Start hry a hlavna slucka: spaja grafiku, svet, hraca, kanoe, kameru, inventar, zvuk a HUD.
import * as THREE from 'three';
import { vytvorGrafiku, FARBA_HMLY } from './grafika.js';
import { zasahni, aktualizujBoj, initBoj, stav as bojStav } from './boj.js';
import { initVstup, klavesy, mys, stlacene, stlac, koniecSnimku } from './vstup.js';
import { initSvet, aktualizujSvet, vyskaTerenu, ostrovPri, startovaciaPozicia, najblizsiPredmet, zober, zobrate, uzlyPri, BIOM_MENO, pasmo, PASMA, MENOVANE_OSTROVY } from './svet.js';
import { vytvorOcean, vyskaVody, priliv } from './ocean.js';
import { vytvorHraca } from './hrac.js';
import { vytvorKanoe, vietor, aktualizujVietor, DRUHY, maxPasmo, kolizieLodi, odtlacOdLode, naLokalne, zLokalnych, maxTrup, priPotopeni } from './kanoe.js';
import { vytvorKameru } from './kamera.js';
import { vytvorCastice } from './castice.js';
import { najdiCiel, poskod, aktualizujUzly, najdiZber, stavRastlin, nacitajStavRastlin } from './vegetacia.js';
import { poskodenie, opotrebuj } from './nastroje.js';
import { menoOstrova, jePomenovany, pomenujOstrov, dialogOtvoreny, ulozZnacky, nacitajZnacky } from './znacky.js';
import { initMajaky, aktualizujMajak, ulozMajaky, nacitajMajaky, majaky } from './majak.js';
import { initNepriatelia, aktualizujNepriatelov, udalosti as nepUdalosti, zoznamNepriatelov, spawnPriHracovi } from './nepriatelia.js';
import { nastavLodenicu } from './obsah/vylepsenia.js';
import { initLodenice, polozLodenicu, najblizsiaLodenica, miestoSpustenia, ulozLodenice, nacitajLodenice } from './lodenica.js';
import { initZivocichy, aktualizujZivocichy, najdiUlovok, udalosti } from './zivocichy.js';
import './obsah/jedlo.js';
import { aktualizujPreziti, zjedz, zran, oziv, ulozPreziti, nacitajPreziti, vykresliPreziti, udalosti as udalostiPreziti, rychlostNasobok, stav as stavPreziti } from './preziti.js';
import { initMore, aktualizujMore, najdiMorskyZber, udalosti as moreUdalosti, vypustNaklad } from './more.js';
import { initPocasie, aktualizujPocasie, casText, ulozPocasie, nacitajPocasie, MLHA, POD_VODOU, pasmoVietor } from './pocasie.js';
import { initNastavenia } from './nastavenia.js';
import { dev, initDev, aktualizujDev } from './dev.js';
import { jeBujny } from './vegetacia.js';
import { initZvuk, aktualizujZvuk, zvuky } from './zvuk.js';
import { initOhen, polozOhen, najblizsiOhen, prilozDrevo, pec, daSaUpiect, hori, aktualizujOhne, ulozOhne, nacitajOhne } from './ohen.js';
import { initStavba, aktualizujStavby, zacniStavat, zrusStavanie, stavim, najdiDiel, uderDiel, ulozStavby, nacitajStavby } from './stavba.js';
import { sloty, pocet, pridaj, odober, nacitaj, vyber, prepniBatoh, jeOtvoreny, rezimOkna, vykresli as vykresliInventar, initInventar, vybranyPredmet, vybranyIndex } from './inventar.js';
import { PREDMETY } from './obsah/predmety.js';
import { UI } from './ikony.js';
import { initVystroj } from './vystroj.js';
import { aktualizujFunkcne, najdiFunkcnu, obsluha, nastavDym } from './funkcne.js';
import { ZDROJE } from './obsah/zdroje.js';
import { aktivnySlot, klucSlotu } from './sloty.js';
import { initUlohy, hlas as hlasUlohy, aktualizujUlohy, prepniOkno as prepniDennik, jeOknoOtvorene as jeDennik, ulozUlohy, nacitajUlohy, stavUloh } from './ulohy.js';

const $ = id => document.getElementById(id);
const g = vytvorGrafiku();
const { scena, kamera } = g;

initSvet(scena);
const ocean = vytvorOcean(g);
const pena = vytvorCastice(scena, { pocet: 700, velkost: 0.28, aditivne: true });
const triesky = vytvorCastice(scena, { pocet: 300, velkost: 0.11 });
const dymPece = vytvorCastice(scena, { pocet: 120, velkost: 0.7, nepriehladnost: 0.35 });
nastavDym(dymPece);
const start = startovaciaPozicia();
const hrac = vytvorHraca(scena);
// lode: kanoe = aktivna lod (ta, v ktorej sedis, alebo najblizsia k hracovi)
const lode = [];
let kanoe = null;
const novaLod = (druh, x, z) => { const l = vytvorKanoe(scena, x, z, { pena, zvuky }, druh); lode.push(l); return l; };
initZivocichy(scena);
initNepriatelia(scena);
initMajaky(scena, { oznam: t => oznam(t), nastavPostel: p => { postel = p; } });   // majaky, strazca, flase so spravami (src/majak.js)
nepUdalosti.priZabiti = (id, def) => { hlasUlohy('zabi', id); oznam(`☠ ${def.meno} porazený`); if (def.boss) setTimeout(() => oznam('🏆 Z trofejí strážcu sa dá vyrobiť niečo výnimočné…'), 600); };
udalosti.priSplachu = (x, y, z, s) => {
  zvuky.splach(Math.min(s, 1) * 0.6);
  for (let i = 0; i < 10 * s + 4; i++) pena.vypust(x, y + 0.1, z, (Math.random() - 0.5) * 3 * s, 2 + Math.random() * 3 * s, (Math.random() - 0.5) * 3 * s, 0xffffff, 0.8);
};
initMore(scena);
priPotopeni(vypustNaklad);                           // potopena lod: naklad vyplava v sudoch (more.js)
moreUdalosti.priSplachu = udalosti.priSplachu;
moreUdalosti.priZraneni = (dmg, pricina) => zran(dmg, pricina);
initPocasie(g);
initOhen(scena);
initLodenice(scena);
initStavba(scena, { oznam: t => oznam(t), pad: () => zvuky.pad(),   // stavanie: taborak a lodenicu polozi ich vlastny kod
  specialne: { taborak: (x, z) => polozOhen(x, z) || 'Príliš blízko iného ohňa', lodenica: (x, z) => polozLodenicu(x, z) } });
let poc = null;                                   // posledny stav pocasia (hodina, svetlo, dazd...)
const kam = vytvorKameru(kamera);
hrac.poz.set(start.hrac.x, vyskaTerenu(start.hrac.x, start.hrac.z), start.hrac.z);

// ---------- stav + ukladanie ----------
let vKanoe = false, naPalube = false, cas = 0;   // vKanoe = sedi pri kormidle/padle, naPalube = chodi po palube (barza, katamaran)
const objavene = new Set();
let postel = null;                                  // [x, z] hamaky, kde si naposledy spal (miesto prebudenia)
const KLUC = klucSlotu(aktivnySlot());
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
      if (d.v) for (const [kl, n] of Object.entries(d.v)) l.vylepsi(kl, n);
      if (Array.isArray(d.sk)) d.sk.slice(0, l.sklad.length).forEach((p, i) => { l.sklad[i] = p && PREDMETY[p.typ] ? p : null; });
      l.trup = Math.min(d.tr ?? Infinity, maxTrup(l)); l.voda = d.vo ?? 0;     // stav trupu a voda v lodi
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
    nacitajUlohy(u.ulohy);
    nacitajMajaky(u.majaky);
    nacitajZnacky(u.znacky);
    if (Array.isArray(u.postel)) postel = u.postel;
    if ((u.vKanoe || u.naPalube) && kanoe) nastup();
  }
} catch (e) { /* nova hra */ }
if (!lode.length) novaLod('kanoe', start.kanoe.x, start.kanoe.z);
if (!kanoe) kanoe = lode[0];
function uloz() {
  try {
    localStorage.setItem(KLUC, JSON.stringify({ hrac: hrac.poz.toArray(),
      lode: lode.map(l => ({ d: l.druh, x: +l.poz.x.toFixed(1), z: +l.poz.y.toFixed(1), s: +l.smer.toFixed(3), u: l.uroven, v: l.vyl, sk: l.sklad, tr: Math.round(l.trup), vo: +l.voda.toFixed(2) })), aktivna: lode.indexOf(kanoe), lodenice: ulozLodenice(),
      ts: Date.now(), vKanoe, naPalube, objavene: [...objavene], zobrate: [...zobrate], inventar: sloty, cas, rastliny: stavRastlin(), preziti: ulozPreziti(), pocasie: ulozPocasie(), ohne: ulozOhne(), stavby: ulozStavby(), ulohy: ulozUlohy(), majaky: ulozMajaky(), znacky: ulozZnacky(), postel }));
  } catch (e) { /* ukladanie nedostupne */ }
}
setInterval(uloz, 5000);
addEventListener('beforeunload', uloz);

function oznam(text) {
  const d = document.createElement('div');
  d.className = 'oznam panel'; d.innerHTML = text;
  $('oznamy').appendChild(d);
  setTimeout(() => d.remove(), 2700);
}

// ---------- kanoe: nastup / vystup ----------
// nastup: kanoe a pretekove = sadnes si; barza a katamaran = vstupis na palubu (kormidlo: E pri kormidle)
function sadniSa() {
  vKanoe = true; naPalube = false;
  kanoe.model.add(hrac.model);
  hrac.model.position.copy(kanoe.SEDADLO);
  hrac.model.rotation.set(0, 0, 0);
}
function nastup() {
  if (kanoe.stat.paluba) { naPalube = true; vKanoe = false; hrac.naPalubu(kanoe, hrac.poz.x, hrac.poz.z); }
  else sadniSa();
}
function vstan() {                                  // od kormidla na palubu (vedla sedadla)
  const [x, z] = zLokalnych(kanoe, kanoe.SEDADLO.x + 0.9, kanoe.SEDADLO.z);
  vKanoe = false; naPalube = true;
  hrac.naPalubu(kanoe, x, z);
  hrac.poz.set(x, hrac.pal.y, z);
}
function miestoNaVystup(t) {
  const { hl, hw } = kanoe.hitbox();
  for (let r = 1.5; r <= 12; r += 0.5) for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, x = kanoe.poz.x + Math.cos(a) * r, z = kanoe.poz.y + Math.sin(a) * r;
    const [lx, lz] = naLokalne(kanoe, x, z);
    if (Math.abs(lx) < hw + 0.5 && Math.abs(lz) < hl + 0.5) continue;     // musi byt mimo trupu
    if (vyskaTerenu(x, z) > vyskaVody(x, z, t) + 0.15) return [x, z];
  }
  return null;
}
function zlez() { vKanoe = false; naPalube = false; scena.add(hrac.model); hrac.rych.set(0, 0, 0); }
function vystup([x, z]) {
  zlez();
  hrac.poz.set(x, vyskaTerenu(x, z), z);
  hrac.vy = 0;
}
function vystupDoVody() {                             // skok z lode do vody (na pravom boku, mimo trupu)
  const { hw } = kanoe.hitbox();
  const [x, z] = zLokalnych(kanoe, hw + 0.9, naPalube ? hrac.pal.z : kanoe.SEDADLO.z);
  zlez();
  hrac.poz.set(x, vyskaVody(x, z, cas) - 0.3, z);
  hrac.vy = -3;                                       // splach pri dopade
}

// ---------- udalosti hraca ----------
const FARBA_TRIESOK = { drevo: 0x8a6240, kamen: 0x9a978f, list: 0x4f8a35 };
hrac.priUdere = info => {
  const fx = info.fx, fz = info.fz;
  const diel = najdiDiel(hrac.poz.x, hrac.poz.z, fx, fz);             // stavba ma prednost (je blizko pred hracom)
  if (diel) {
    zvuky.uder('drevo'); kam.zatras(0.02);
    const vynos = uderDiel(diel);
    if (vynos) { zvuky.pad(); zoberVsetko(vynos); }
    return;
  }
  const nast0 = vybranyPredmet();                  // najprv nepriatel (kuzel pred hracom, vid boj.js)
  if (zasahni(hrac, info, nast0, dev.silaUderu)) {
    if (nast0?.nastroj && !dev.bezOpotrebenia && opotrebuj(vybranyIndex())) oznam(`${nast0.ikona} ${nast0.meno} sa zlomil(a)!`);
    return;
  }
  const u = najdiCiel(uzlyPri(hrac.poz.x, hrac.poz.z), hrac.poz.x, hrac.poz.z, fx, fz);
  if (!u) return;
  const zdroj = ZDROJE[u.typ], material = zdroj.material;
  const nastroj = vybranyPredmet();
  const dmg = poskodenie(nastroj?.nastroj ? nastroj : null, zdroj) * dev.silaUderu * Math.min(info.mult, 2);
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
    zvuky.pad(); oznam(`${UI.lod} Postavená loď: ${DRUHY[druh].nazov} – čaká na vode pri splave`);
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
initVstup(platno, zamknuta => { $('start').style.display = zamknuta || jeOtvoreny() || jeDennik() || dialogOtvoreny() || dev.zapnuty || stavPreziti.mrtvy ? 'none' : 'flex'; });
udalostiPreziti.priVarovani = t => oznam(t);
udalostiPreziti.priSmrti = () => document.exitPointerLock();
udalostiPreziti.priZobudeni = () => {
  oziv();
  const s = postel ? { x: postel[0], z: postel[1] } : start.hrac;   // zobudis sa pri hamake, ak si v nej spal
  if (vKanoe || naPalube) vystup([s.x, s.z]);
  hrac.poz.set(s.x, vyskaTerenu(s.x, s.z), s.z); hrac.rych.set(0, 0, 0); hrac.vy = 0;
  zamkni();
};
initDev({ hrac, get kanoe() { return kanoe; }, spawnLod, kam, jeVKanoe: () => vKanoe, vystup, oznam, posunCas: s => { cas += s; }, start: start.hrac, uloz, kluc: KLUC });
const menu = initNastavenia(g, $('start'), { kluc: KLUC, uloz, menu: () => { uloz(); removeEventListener('beforeunload', uloz); location.reload(); } });
$('start').addEventListener('click', () => { initZvuk(); zamkni(); });
initBoj({ scena, kamera, kam, hrac });
initVystroj(hrac, t => oznam(t), kam, triesky);
let napovedaZbrane = false;
initInventar(() => { hrac.drz(vybranyPredmet()); if (!napovedaZbrane && hrac.zbran !== 'pest') { napovedaZbrane = true; oznam('⚔ Ľavé tlačidlo = sek, klikaj rýchlo = kombo, podrž = silný úder'); } });
initUlohy({ poz: () => (vKanoe || naPalube ? { x: kanoe.poz.x, z: kanoe.poz.y } : hrac.poz), lodUroven: () => Math.max(0, ...lode.filter(l => l.druh === 'kanoe').map(l => l.uroven || 1)), oznam, zvuk: () => zvuky.zober() });
addEventListener('vyrobene', e => { const r = e.detail; if (r.vysledok) hlasUlohy('vyrob', r.vysledok[0]); if (r.id) hlasUlohy('vyrob', r.id); });
addEventListener('stavaj', e => { if (stavPreziti.mrtvy || vKanoe) return; prepniBatoh(false); zamkni(); zacniStavat(e.detail); });   // klik na stavbu v menu B
vykresliInventar();
hrac.drz(vybranyPredmet());

// ---------- funkcne stavby: sluzby pre funkcne.js + spanok v hamake ----------
const hodinaHry = () => ((9 + cas / (24 * 60) * 24) % 24 + 24) % 24;   // 9 = START_HODINA v pocasie.js, den = 24 min
function sluzbyStavieb() {
  return { vybrany: vybranyPredmet(), pocet, odober, pridaj, zjedz, smad: stavPreziti.smad, hodina: hodinaHry(), oznam,
    otvorSklad: (pole, nazov) => otvorOkno('sklad', pole, nazov), spi };
}
let spim = false;
function spi(d, noc) {
  if (spim) return;
  if (stavPreziti.hlad < 15 || stavPreziti.smad < 15) return oznam('Si príliš hladný alebo smädný na spánok');
  spim = true;
  postel = [d.x - Math.sin(d.u) * 1.2, d.z - Math.cos(d.u) * 1.2];
  const z = $('zatmenie'); z.style.opacity = 1;
  setTimeout(() => {
    const h = hodinaHry(), dalej = noc ? ((6 - h + 24) % 24) : 1;   // noc -> do 6:00, cez den 1 hodina
    cas += dalej * 60;                                                // 1 herna hodina = 60 s
    stavPreziti.hlad = Math.max(5, stavPreziti.hlad - dalej * 2.5);
    stavPreziti.smad = Math.max(5, stavPreziti.smad - dalej * 3);
    stavPreziti.zdravie = Math.min(100, stavPreziti.zdravie + dalej * 8);
    hrac.poz.set(postel[0], vyskaTerenu(postel[0], postel[1]), postel[1]);
    oznam(noc ? '☀️ Dobré ráno! Vyspal si sa do rána' : '😴 Zdriemol si si hodinku');
    oznam(`${UI.hamaka} Tu sa zobudíš, ak omdlieš`);
    setTimeout(() => { z.style.opacity = 0; spim = false; }, 700);
  }, 1300);
}

// ---------- HUD ----------
let poslednyOstrov = null, casNapisu = 0, caka = null;   // caka = ostrov, ktory ma hrac pomenovat
const STRANY = ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ'];
const BIOM = BIOM_MENO;
const uhol = smer => ((Math.atan2(-Math.sin(smer), Math.cos(smer)) * 180 / Math.PI) + 360) % 360;
// pasmo: hlaska pri prechode (hysteria 1.5 s, aby neblikala na hranici)
let pasmoAkt = 0, pasmoNove = 0, pasmoCas = 0, pasmoNapis = 0;
const PAS_FARBY_HUD = ['#30d5c8', '#ff7a3c', '#8fbf4a', '#8fa6c0', '#c2a8e8'];
function hlaskaPasma(dt, p) {
  const n = pasmo(p.x, p.z);
  if (n !== pasmoNove) { pasmoNove = n; pasmoCas = 0; } else pasmoCas += dt;
  if (n !== pasmoAkt && (pasmoCas > 1.5 || !pasmoAkt)) {
    pasmoAkt = n;
    const lod = vKanoe || naPalube ? kanoe : null;
    const slaba = lod && n > (maxPasmo(lod) >= 4 ? 5 : maxPasmo(lod));
    $('pasmo').style.setProperty('--pasmo-farba', PAS_FARBY_HUD[n - 1]);
    $('pasmo').innerHTML = `Pásmo ${n} · ${PASMA[n].meno}` + (slaba ? `<small>Tvoja loď tu neobstojí – odporúčame: ${PASMA[n].lod}</small>` : n > 1 ? `<small>Odporúčaná loď: ${PASMA[n].lod}</small>` : '');
    $('pasmo').style.opacity = 1; pasmoNapis = 4;
  }
  if ((pasmoNapis -= dt) < 0) $('pasmo').style.opacity = 0;
}
function hud(dt, p) {
  hlaskaPasma(dt, p);
  const o = ostrovPri(p.x, p.z, 1.3);
  if (o && o !== poslednyOstrov) {
    const kluc = o.bx + ',' + o.bz, novy = !objavene.has(kluc);
    objavene.add(kluc);
    $('ostrov').innerHTML = menoOstrova(o) + `<small>${novy ? 'Nový ostrov objavený!' : (o.podnadpis || BIOM[o.biom]) + (jeBujny(o) ? ' · bujný' : '')}</small>`;
    if (!jePomenovany(o)) caka = o;                      // este nema meno -> opytame sa hraca (ked sa lod spomali)
    $('ostrov').style.opacity = 1;
    casNapisu = 4;
  }
  poslednyOstrov = o;
  if (caka && document.pointerLockElement === platno && !dialogOtvoreny() && !stavPreziti.mrtvy && !(vKanoe && kanoe.rychlost() > 1.5)) {
    const ost = caka; caka = null;
    pomenujOstrov(ost, { nove: true, navrh: ost.meno, hotovo: m => { $('ostrov').firstChild.textContent = m; oznam(`🏝 Ostrov pomenovaný: ${m}`); }, zatvorene: () => { if (!document.pointerLockElement) zamkni(); } });
  }
  if ((casNapisu -= dt) < 0) $('ostrov').style.opacity = 0;

  const s = uhol(kam.yaw), v = uhol(vietor.smer), pr = priliv(cas);
  $('kompas').innerHTML = `<span class="smer">${STRANY[Math.round(s / 45) % 8]} ${Math.round(s)}°</span><br>`
    + `Vietor → ${STRANY[Math.round(v / 45) % 8]} ${'▮'.repeat(Math.round(vietor.sila * 5))}<br>`
    + `${Math.cos(cas * 2 * Math.PI / 300) > 0 ? 'Príliv ↑' : 'Odliv ↓'} ${pr >= 0 ? '+' : ''}${pr.toFixed(1)} m<br>${casText(poc)}${poc.burka ? ' · ⛈' : poc.dazd > 0.3 ? ' · 🌧' : ''}`;
  const stav = vKanoe ? `${kanoe.stat.nazov} · <b>${(kanoe.rychlost() * 1.944).toFixed(0)}</b> uzlov` + (kanoe.plachtaV > 0.5 ? ` · plachta ${Math.round(kanoe.ucinnost * 100)} %` : '')
    : hrac.potapa ? 'Potápaš sa' : hrac.plava ? 'Plávaš' : 'Pešo';
  // stav lode: trup a voda v lodi (cervene, ked hrozi potopenie)
  const lodStav = vKanoe || naPalube ? (() => {
    const tr = Math.round(kanoe.trup / maxTrup(kanoe) * 100), vo = Math.round(kanoe.voda * 100);
    const f = (txt, zle) => zle ? `<b style="color:#ff8a6a">${txt}</b>` : txt;
    return `<br>${f(`Trup ${tr} %`, tr < 30)} · ${f(`Voda v lodi ${vo} %`, vo > 50)}${vo > 5 ? ' <span style="opacity:.7">(drž V)</span>' : ''}`;
  })() : '';
  $('info').innerHTML = `<b>${o ? menoOstrova(o) : 'Otvorené more'}</b> <span style="opacity:.75">· pásmo ${pasmoAkt}</span><br>${stav}${lodStav}<br>Objavené ostrovy: ${objavene.size}`;
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
  aktualizujBoj(dt);
  if (bojStav.hitstop > 0) { bojStav.hitstop -= dt; dt *= 0.08; }     // hitstop: kratke spomalenie pri zasahu
  cas += dt;
  aktualizujVietor(cas);
  if (poc) vietor.sila = Math.min(1.2, 0.3 + 0.7 * poc.vietorSila + pasmoVietor);
  const letim = aktualizujDev(dt, g);
  if (!vKanoe && !naPalube) kanoe = lodBlizko(1e9) || kanoe;                    // na brehu je aktivna najblizsia lod
  const lx = vKanoe || naPalube ? kanoe.poz.x : hrac.poz.x, lz = vKanoe || naPalube ? kanoe.poz.y : hrac.poz.z;
  for (const l of lode) l.posadka = (vKanoe || naPalube) && l === kanoe;          // len posadka moze vylievat vodu (V)
  for (const l of lode) if (!(vKanoe && l === kanoe) && Math.hypot(l.poz.x - lx, l.poz.y - lz) < 250) l.aktualizuj(dt, cas, false);
  kolizieLodi(lode);
  const dosahLode = 4.5 + kanoe.stat.dlzka * 0.12;
  if (stlacene('Tab')) { if (prepniBatoh(!jeOtvoreny() || rezimOkna() === 'stavba', 'batoh')) document.exitPointerLock(); else zamkni(); }
  if (stlacene('KeyJ') && !stavPreziti.mrtvy) { if (prepniDennik()) { if (jeOtvoreny()) prepniBatoh(false); document.exitPointerLock(); } else zamkni(); }   // dennik uloh
  if (stlacene('KeyM')) oznam(menu.prepniTicho() ? '🔇 Zvuk vypnutý (M)' : '🔊 Zvuk zapnutý (M)');
  if (stlacene('KeyB') && !stavPreziti.mrtvy && !vKanoe) {   // stavebne menu
    zrusStavanie();
    if (jeOtvoreny() && rezimOkna() === 'stavba') { prepniBatoh(false); zamkni(); }
    else { prepniBatoh(true, 'stavba'); document.exitPointerLock(); }
  }
  if (stlacene('KeyR') && !stavPreziti.mrtvy && (vKanoe || naPalube || Math.hypot(hrac.poz.x - kanoe.poz.x, hrac.poz.z - kanoe.poz.y) < dosahLode)) {
    if (jeOtvoreny()) { prepniBatoh(false); zamkni(); } else otvorOkno('sklad', kanoe.sklad, `Sklad: ${kanoe.stat.nazov}`);
  }
  if (stlacene('KeyG') && !stavPreziti.mrtvy && (vKanoe || naPalube || Math.hypot(hrac.poz.x - kanoe.poz.x, hrac.poz.z - kanoe.poz.y) < dosahLode)) {   // oprava trupu
    if (kanoe.trup >= maxTrup(kanoe)) oznam('Trup je v poriadku');
    else if (pocet('drevo') < 2 || pocet('vlakno') < 1) oznam(`Na opravu treba 2 ${PREDMETY.drevo.ikona} drevo a 1 ${PREDMETY.vlakno.ikona} vlákno`);
    else { kanoe.opravTrup(); odober('drevo', 2); odober('vlakno', 1); vykresliInventar(); zvuky.uder('drevo'); oznam(`🔨 Trup opravený: ${Math.round(kanoe.trup / maxTrup(kanoe) * 100)} %`); }
  }
  for (let i = 0; i < 8; i++) if (stlacene('Digit' + (i + 1))) vyber(i);
  if (stlacene('KeyF') && !stavPreziti.mrtvy) {           // zjest / vypit vybrany predmet
    const d = vybranyPredmet();
    if (d?.jedlo) {
      if (zjedz(d)) { hlasUlohy('zjedz'); odober(d.id, 1); vykresliInventar(); zvuky.zober(); oznam(`Zjedol si: ${d.ikona} ${d.meno}`); }
      else oznam('Nie si hladný ani smädný');
    } else if (d?.polozit === 'taborak') {                // polozit taborak pred postavu
      const x = hrac.poz.x - Math.sin(hrac.smer) * 1.9, z = hrac.poz.z - Math.cos(hrac.smer) * 1.9;
      if (vKanoe || hrac.plava) oznam('Oheň sa dá položiť len na súši');
      else if (vyskaTerenu(x, z) < vyskaVody(x, z, cas) + 0.15) oznam('Tu je voda – oheň polož na suchú zem');
      else if (!polozOhen(x, z)) oznam('Príliš blízko iného ohňa');
      else { hlasUlohy('ohen'); odober(d.id, 1); vykresliInventar(); hrac.drz(vybranyPredmet()); zvuky.pad(); oznam(`${UI.ohen} Táborák horí – prikladaj drevo (E)`); }
    } else if (d?.polozit === 'lodenica' && !vKanoe) {      // polozit lodenicu 5 m pred postavu (pri brehu)
      const r = polozLodenicu(hrac.poz.x - Math.sin(hrac.smer) * 5, hrac.poz.z - Math.cos(hrac.smer) * 5);
      if (r !== true) oznam(r);
      else { odober(d.id, 1); vykresliInventar(); hrac.drz(vybranyPredmet()); zvuky.pad(); oznam(`${PREDMETY.lodenica.ikona} Lodenica postavená – E pri nej staviaš lode`); }
    }
  }
  const zivy = !stavPreziti.mrtvy;

  if (kanoe.hlaska) { if (vKanoe || naPalube) oznam(kanoe.hlaska); kanoe.hlaska = null; }      // divoke more (kanoe.js)
  if (kanoe.prevrat) { kanoe.prevrat = false; if (vKanoe || naPalube) vystupDoVody(); }
  let napoveda = '';
  if (vKanoe) {
    kanoe.aktualizuj(dt, cas, true);
    hrac.animuj(dt, 'sedi', 0, kanoe.faza);
    hrac.poz.set(kanoe.poz.x, kanoe.y, kanoe.poz.y);
    const palubna = !!kanoe.stat.paluba;
    const miesto = palubna ? null : miestoNaVystup(cas);
    const more = !miesto && najdiMorskyZber(hrac.poz.x, hrac.poz.y, hrac.poz.z);
    napoveda = miesto ? '<kbd>E</kbd> vystúpiť na breh' : more ? `<kbd>E</kbd> ${more.text}` : palubna ? '<kbd>E</kbd> vstať a chodiť po palube' : '<kbd>E</kbd> skočiť do vody';
    if (stlacene('KeyE')) {
      if (miesto) vystup(miesto);
      else if (more) zoberVsetko(more.akcia());
      else if (palubna) vstan();
      else vystupDoVody();
    }
  } else if (naPalube) {
    hrac.nasobok = rychlostNasobok();
    if (!letim && zivy) hrac.aktualizujNaPalube(dt, kam.yaw, kanoe);
    if (stlacene('Mys0') && zivy) hrac.uder();
    const [lx2, lz2] = [hrac.pal.x, hrac.pal.z], sed = kanoe.SEDADLO;
    const uKormidla = Math.hypot(lx2 - sed.x, lz2 - sed.z) < 1.9;
    const more = najdiMorskyZber(hrac.poz.x, hrac.poz.y, hrac.poz.z);
    napoveda = uKormidla ? '<kbd>E</kbd> sadnúť si ku kormidlu · <kbd>R</kbd> sklad' : more ? `<kbd>E</kbd> ${more.text}` : '<kbd>E</kbd> zísť z lode · <kbd>R</kbd> sklad';
    if (stlacene('KeyE')) {
      if (uKormidla) sadniSa();
      else if (more) zoberVsetko(more.akcia());
      else { const m = miestoNaVystup(cas); if (m) vystup(m); else vystupDoVody(); }
    }
  } else {
    hrac.nasobok = rychlostNasobok();
    if (!letim && zivy) hrac.aktualizuj(dt, kam.yaw, cas);
    for (const l of lode) if (Math.hypot(l.poz.x - hrac.poz.x, l.poz.y - hrac.poz.z) < 25) odtlacOdLode(l, hrac.poz);   // trup lode je pevny
    if (stlacene('Mys0') && zivy && !stavim()) hrac.uder();
    const blizko = Math.hypot(hrac.poz.x - kanoe.poz.x, hrac.poz.z - kanoe.poz.y) < dosahLode;
    const predmet = !blizko && najblizsiPredmet(hrac.poz.x, hrac.poz.z);
    const ohen = !blizko && !predmet && najblizsiOhen(hrac.poz.x, hrac.poz.z);   // taborak ma prednost pred zberom
    const funk = !blizko && !predmet && !ohen && najdiFunkcnu(hrac.poz.x, hrac.poz.z, -Math.sin(hrac.smer), -Math.cos(hrac.smer));   // truhlica, pec, hamaka...
    const obs = funk && obsluha(funk, sluzbyStavieb());
    const ulovok = !blizko && !predmet && !ohen && !funk && najdiUlovok(hrac.poz.x, hrac.poz.z);
    const zber = !blizko && !predmet && !ohen && !funk && !ulovok && najdiZber(hrac.poz.x, hrac.poz.z, -Math.sin(hrac.smer), -Math.cos(hrac.smer));
    const more = !blizko && !predmet && !ohen && !funk && !ulovok && !zber && najdiMorskyZber(hrac.poz.x, hrac.poz.y, hrac.poz.z);
    if (ohen) {                                            // taborak: upiect vybrane jedlo, inak prilozit drevo
      const d = vybranyPredmet(), mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      const peci = hori(ohen) && d && daSaUpiect(d.id);
      napoveda = peci ? `<kbd>E</kbd> upiecť: ${d.ikona} ${d.meno}`
        : pocet('drevo') ? `<kbd>E</kbd> ${hori(ohen) ? 'priložiť drevo' : 'zapáliť (drevo)'}` : hori(ohen) ? `Na priloženie treba ${UI.drevo} drevo` : 'Pahreba – zapáliš ju drevom';
      if (hori(ohen)) napoveda += ` · ${UI.ohen} ${mmss(ohen.palivo)}${ohen.pecie.length ? ` · pečie sa ${ohen.pecie.length}×` : ''}`;
      if (stlacene('KeyE')) {
        if (peci) { if (pec(ohen, d.id)) { odober(d.id, 1); vykresliInventar(); zvuky.syc(); } else oznam('Na ohni už nie je miesto'); }
        else if (pocet('drevo')) { if (prilozDrevo(ohen)) { odober('drevo', 1); vykresliInventar(); zvuky.uder('drevo'); hrac.zdvihni(); } else oznam('Oheň je plný dreva'); }
      }
    } else if (vybranyPredmet()?.polozit === 'taborak') napoveda = '<kbd>F</kbd> položiť táborák';
    const lodUk = !blizko && !predmet && !ohen && !funk && !ulovok && !zber && !more && najblizsiaLodenica(hrac.poz.x, hrac.poz.z, 7);
    if (blizko) napoveda = `<kbd>E</kbd> nastúpiť: ${kanoe.stat.nazov} · <kbd>R</kbd> sklad`;
    else if (lodUk) napoveda = '<kbd>E</kbd> lodenica – stavba a vylepšenie lodí';
    else if (ohen) { /* napoveda uz je */ }
    else if (obs) napoveda = obs.text;
    else if (predmet) napoveda = `<kbd>E</kbd> zdvihnúť: ${PREDMETY[predmet.userData.typ].meno}`;
    else if (ulovok) napoveda = `<kbd>E</kbd> ${ulovok.text}`;
    else if (zber) napoveda = `<kbd>E</kbd> ${zber.text}`;
    else if (more) napoveda = `<kbd>E</kbd> ${more.text}`;
    if (obs?.akcia && stlacene('KeyE')) { obs.akcia(); vykresliInventar(); hrac.drz(vybranyPredmet()); zvuky.zober(); }
    if ((ulovok || zber || more) && stlacene('KeyE')) { zoberVsetko((ulovok || zber || more).akcia()); hrac.zdvihni(); }
    if (blizko && stlacene('KeyE')) nastup();
    else if (lodUk && stlacene('KeyE')) otvorOkno('lodenica');
    else if (predmet && stlacene('KeyE')) {
      const typ = predmet.userData.typ;
      if (pridaj(typ) === 0) { zober(predmet); hrac.zdvihni(); zvuky.zober(); oznam(`+1 ${PREDMETY[typ].ikona} ${PREDMETY[typ].meno}`); vykresliInventar(); }
      else oznam('Batoh je plný');
    }
  }
  const tStavba = aktualizujStavby({ kamera, hlava: new THREE.Vector3(hrac.poz.x, hrac.poz.y + 1.55, hrac.poz.z), yaw: kam.yaw, t: cas, hrac: hrac.poz, aktivne: !vKanoe && !naPalube && zivy && !jeOtvoreny() });
  { const mj = aktualizujMajak(dt, cas, { hrac, tma: 1 - Math.min(1, poc?.svetlo ?? 1), pesi: !vKanoe && !naPalube && zivy && !jeOtvoreny() }); if (mj && !tStavba) napoveda = mj; }
  if (tStavba) napoveda = tStavba;                       // rezim umiestnovania stavby (nahlad, klik, otacanie)
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
  { const h = hodinaHry(); aktualizujNepriatelov(dt, cas, hrac, { pesi: !vKanoe && !naPalube, noc: h >= 19.5 || h < 5.5 }); }
  aktualizujMore(dt, cas, hrac.poz, podVodou, kanoe.poz, vKanoe);
  const ohne = aktualizujOhne(dt, cas, hrac.poz, vietor);
  aktualizujFunkcne(dt, { dazd: poc.dazd, svetlo: poc.svetlo });
  dymPece.aktualizuj(dt);
  aktualizujUlohy(dt);
  for (const id of ohne.upecene) {
    hlasUlohy('upec');
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
  g, hrac, kamera, objavene, oznam, get kanoe() { return kanoe; }, lode, kam, scena, zobrate, sloty, stavPreziti,
  nepriatelia: zoznamNepriatelov, spawn: druh => spawnPriHracovi(druh, hrac.poz),
  get vKanoe() { return vKanoe; },
  sim(sekundy, drz = [], stlac1 = []) {
    drz.forEach(k => klavesy.add(k));
    stlac1.forEach(stlac);
    for (let i = 0; i < sekundy * 60; i++) { aktualizuj(1 / 60); koniecSnimku(); }
    drz.forEach(k => klavesy.delete(k));
    g.vykresli();
  },
  posunCas(s) { cas += s; },
  ulohy: stavUloh, hlasUlohy, majaky,
  // teleport na rucne navrhnuty ostrov (id zo src/ostrovy/index.js), na suche miesto pri brehu; dx,dz = presny lokalny bod
  naOstrov(id, dx, dz) {
    const o = MENOVANE_OSTROVY.find(o => o.id === id);
    if (!o) return 'nezname id: ' + MENOVANE_OSTROVY.map(o => o.id).join(', ');
    let x = o.x + (dx ?? 0), z = o.z + (dz ?? 0);
    if (dx === undefined) for (let d = o.R * 1.5; d > 0; d -= 1) { x = o.x + d * 0.7; z = o.z + d * 0.7; if (vyskaTerenu(x, z) > 1) break; }
    if (vKanoe || naPalube) vystup([x, z]);
    hrac.poz.set(x, vyskaTerenu(x, z) + 1, z);
    return o.meno;
  },
  otoc(yaw, pitch) { kam.yaw = yaw; if (pitch !== undefined) kam.pitch = pitch; mys.posledny = performance.now(); },
};
