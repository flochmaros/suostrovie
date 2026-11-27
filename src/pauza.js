// Pauzove menu (Esc): tlacidla vlavo, nastavenia, Dennik vypravy so statistikami a pomale otacanie kamery.
// Okno je #start v index.html. Ked je viditelne, hra stoji (main.js namiesto aktualizuj() vola len pauzovy snimok).
import * as THREE from 'three';
import { vyskaTerenu } from './svet.js';

const $ = id => document.getElementById(id);
const RADY = [
  'Smäd prichádza rýchlejšie ako hlad – kokos vyrieši oboje.',
  'Pred dlhou plavbou si pozri kompas: vietor v chrbte ušetrí veľa pádlovania.',
  'V noci je tma naozaj tma. Fakľa alebo táborák ti ju spríjemnia.',
  'Do ďalších pásiem sa oplatí ísť až s lepšou loďou.',
  'Útok nepriateľa je vidno vopred – počkaj na nápriah a uhni.',
  'V hamake prespíš noc a zobudíš sa pri nej, aj keď omdlieš.',
  'Poškodený trup oprav (G) skôr, než sa vydáš na šíre more.',
  'Fľaše na plážach skrývajú správy. Nájdeš ich potom v denníku (J).',
  'Truhlica na brehu pomôže, keď je batoh plný.',
  'Každý ostrov si môžeš pomenovať po svojom.',
];

// statistiky vypravy, ukladaju sa so slotom (kluc "staty" v ulozeni)
const staty = { hrane: 0, vyrobene: 0, porazeni: 0, kraby: 0, stromy: 0, jedla: 0 };
export const pocitaj = (k, n = 1) => { staty[k] += n; };
export const ulozStaty = () => ({ ...staty, hrane: Math.round(staty.hrane) });
export function nacitajStaty(d) { if (d) for (const k in staty) staty[k] = +d[k] || 0; }
addEventListener('vyrobene', () => pocitaj('vyrobene'));

let ctx, otvorene = false, odkedy = 0, cakaKlik = false;
export const jePauza = () => $('start').style.display === 'flex';

// ---------- pomale otacanie kamery okolo postavy ----------
let pohlad = null;                                    // povodny pohlad + parametre obehu
const rozdiel = new THREE.Vector3();
export function otacajKameru(dt, kamera, stred, uzly = []) {
  if (!pohlad) {
    rozdiel.copy(kamera.position).sub(stred);
    const r = Math.hypot(rozdiel.x, rozdiel.z);
    pohlad = { poz: kamera.position.clone(), q: kamera.quaternion.clone(), t: 0, uhol: Math.atan2(rozdiel.x, rozdiel.z), r, y: rozdiel.y };
  }
  pohlad.t += dt;
  const p = 1 - Math.exp(-pohlad.t * 0.8);            // plynuly prechod od povodnej vzdialenosti k "foto" zaberu
  const a = pohlad.uhol + 0.09 * Math.max(0, pohlad.t - 1 + Math.exp(-pohlad.t));   // rozbeh od nuly
  let r = THREE.MathUtils.lerp(pohlad.r, THREE.MathUtils.clamp(pohlad.r, 4.5, 7), p);
  // strom alebo skala medzi postavou a kamerou -> kamera sa pritiahne pred nu (inak by obraz zakryl kmen)
  const sx = Math.sin(a), sz = Math.cos(a);
  for (const u of uzly) {
    if (!(u.rKolizia > 0)) continue;
    const dx = u.x - stred.x, dz = u.z - stred.z, pozdlz = dx * sx + dz * sz;
    if (pozdlz > 1 && pozdlz < r + 1.5 && Math.abs(dx * sz - dz * sx) < u.rKolizia + 1.1) r = Math.max(2.4, Math.min(r, pozdlz - 1.4));
  }
  pohlad.d = pohlad.d === undefined ? pohlad.r : THREE.MathUtils.damp(pohlad.d, r, r < pohlad.d ? 4 : 1.2, dt);
  r = pohlad.d;
  const y = THREE.MathUtils.lerp(pohlad.y, THREE.MathUtils.clamp(pohlad.y, 2, 3.8), p);
  const x = stred.x + Math.sin(a) * r, z = stred.z + Math.cos(a) * r;
  kamera.position.set(x, Math.max(stred.y + y, vyskaTerenu(x, z) + 0.8, 0.9), z);
  kamera.lookAt(stred);
}
export function vratKameru(kamera) {                  // po navrate presne povodny pohlad
  if (!pohlad) return;
  kamera.position.copy(pohlad.poz); kamera.quaternion.copy(pohlad.q);
  pohlad = null;
}

// ---------- dennik vypravy ----------
function casHrania(s) {
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
function vykresliDennik() {
  const i = ctx.info();                               // { den, ostrovy, strazcovia, majaky, spolu, ulohy }
  $('pz-den').textContent = `Deň ${i.den}`;
  $('pz-staty').innerHTML = [
    ['Čas na výprave', casHrania(staty.hrane)],
    ['Navštívené ostrovy', i.ostrovy],
    ['Porazení strážcovia', `${i.strazcovia} / ${i.spolu}`],
    ['Rozsvietené majáky', `${i.majaky} / ${i.spolu}`],
    ['Splnené úlohy', i.ulohy],
    ['Vyrobené veci', staty.vyrobene],
    ['Zoťaté stromy', staty.stromy],
    ['Chytené kraby', staty.kraby],
    ['Zjedené jedlá', staty.jedla],
    ['Porazení nepriatelia', staty.porazeni],
  ].map(([n, h]) => `<li><span>${n}</span><b>${h}</b></li>`).join('');
}

// ---------- otvorenie / zatvorenie ----------
function nastavNastavenia(zap) {
  $('start').classList.toggle('pz-s-nastaveniami', zap);
  $('pz-nast').classList.toggle('aktivne', zap);
}
function zmenaStavu() {
  const teraz = jePauza();
  if (teraz === otvorene) return;
  otvorene = teraz;
  document.body.classList.toggle('v-pauze', teraz);
  if (!teraz) return;
  odkedy = performance.now();
  cakaKlik = false; $('pz-klikni').style.display = 'none';
  nastavNastavenia(false);
  $('pz-uloz').innerHTML = 'Uložiť hru';
  $('zal-hlaska').textContent = '';
  vykresliDennik();
  $('pz-rada').textContent = RADY[Math.floor(Math.random() * RADY.length)];
}
function uzNehra() {                                  // po prvom spusteni sa z "Hrat" stane "Pokracovat"
  $('pz-hrat').textContent = 'Pokračovať';
  $('start').querySelector('.pz-pod').textContent = 'Pauza';
}
// prehliadac po Esc nedovoli hned zamknut mys (Esc sa nerata ako "klik") -> menu zavrieme a pockame na klik do hry
function bezZamku() {
  if (!jePauza()) return;
  cakaKlik = true;
  $('start').style.display = 'none';
  $('pz-klikni').style.display = 'block';
}

// c = { platno, uloz, info }
export function initPauza(c) {
  ctx = c;
  let zEsc = false;
  const zamkni = esc => {
    zEsc = esc;
    const r = c.platno.requestPointerLock();
    r?.catch?.(() => { if (esc) bezZamku(); });       // pri kliku menu ostane, staci kliknut este raz
  };
  document.addEventListener('pointerlockerror', () => { if (zEsc) bezZamku(); });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== c.platno) return;
    cakaKlik = false; $('pz-klikni').style.display = 'none'; uzNehra();
  });
  c.platno.addEventListener('click', () => { if (cakaKlik) zamkni(false); });
  $('pz-hrat').addEventListener('click', () => zamkni(false));
  $('pz-nast').addEventListener('click', () => nastavNastavenia(!$('start').classList.contains('pz-s-nastaveniami')));
  $('pz-nast-zavri').addEventListener('click', () => nastavNastavenia(false));
  $('pz-uloz').addEventListener('click', () => {
    const ok = c.uloz();
    $('pz-uloz').innerHTML = ok ? '✔ Uložené' : '✖ Nepodarilo sa';
    clearTimeout($('pz-uloz').casovac);
    $('pz-uloz').casovac = setTimeout(() => { $('pz-uloz').innerHTML = 'Uložiť hru'; }, 2200);
  });
  addEventListener('keydown', e => {
    if (e.code !== 'Escape' || e.repeat) return;
    if (jePauza()) {
      if (performance.now() - odkedy < 350) return;   // to iste stlacenie, ktore pauzu otvorilo
      if ($('start').classList.contains('pz-s-nastaveniami')) nastavNastavenia(false);
      else { uzNehra(); zamkni(true); }
    } else if (cakaKlik) $('start').style.display = 'flex';
  });
  new MutationObserver(zmenaStavu).observe($('start'), { attributes: true, attributeFilter: ['style'] });
  zmenaStavu();
}
