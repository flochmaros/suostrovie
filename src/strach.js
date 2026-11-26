// System strachu: skryta "mierka strachu" 0..1 a vsetko, co s nou suvisi - ticho prostredia, nahodne zvuky v zone,
// tlkot srdca, dych, dron a efekty obrazu (grafika.js ich cita z navratovej hodnoty aktualizujStrach).
// Nevie nic o Bledych ani o ostrove - ti ho len volaju:
//   nastavStrach(0..1)   trvala uroven strachu (napr. podla vzdialenosti Bledeho), 0 = pokoj
//   pridajStrach(+0.3)   naraz vyskoci (lak) a sam pomaly vyprchne; zaporne cislo ukludni
//   nastavZonu(0..1)     hororova zona (alebo parameter `zona` v aktualizujStrach, napr. hororovaZona(x, z))
//   hororZvuk(druh, pozicia?, sila?)   druhy: sepot kroky konar klopanie srdce vykrik dych dron svitanie
import * as THREE from 'three';
import { initZvuk, zvukovyKontext, tlmProstredie } from './zvuk.js';
import { ZVUKY_HOROR, vytvorProstredie, vytvorDron, pocitadlo } from './strach_zvuky.js';

export const DRUHY_ZVUKOV = Object.keys(ZVUKY_HOROR);

const medzi = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const mix = (a, b, k) => a + (b - a) * k;
const hladko = (a, b, x) => { const t = medzi((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const nah = (a, b) => a + Math.random() * (b - a);

export const stavStrachu = {
  strach: 0,          // aktualna (plynula) hodnota
  zaklad: 0,          // nastavStrach
  sok: 0,             // pridajStrach (vyprcha)
  zona: 0,            // plynula hodnota zony
  zonaCiel: 0,        // nastavZonu
  vynutNoc: false,    // dev: spravaj sa ako v noci aj cez den
  ticho: 0,           // zona * noc
  nocny: 0,           // strach z tmy v zone (plynule, pridava sa k zakladu)
  udalosti: true,     // nahodne zvuky v zone
};

export function nastavStrach(cielovy) { stavStrachu.zaklad = medzi(cielovy); if (cielovy <= 0) stavStrachu.sok = 0; }
export function pridajStrach(dx) {
  const s = stavStrachu;
  if (dx >= 0) { s.sok = Math.min(1, s.sok + dx); return; }
  const zoSoku = Math.min(s.sok, -dx);
  s.sok -= zoSoku; s.zaklad = medzi(s.zaklad + dx + zoSoku);
}
export function nastavZonu(k) { stavStrachu.zonaCiel = medzi(+k); }

// ---------- zvuk ----------
let prostredie = null;
function zvukoveProstredie() {
  const z = zvukovyKontext();
  if (!z || z.ctx.state !== 'running') return null;     // bez kliknutia v hre by sa zvuky len hromadili
  if (prostredie?.ctx !== z.ctx) prostredie = vytvorProstredie(z.ctx, z.sum, z.efekty, z.hudba);
  return prostredie;
}

// poslucha = hlava hraca + smer kamery (kamera je za chrbtom, "za mnou" ma byt za postavou)
const poslucha = new THREE.Vector3(), vpred = new THREE.Vector3(0, 0, -1);
function nastavPosluchaca(ctx) {
  const l = ctx.listener, n = ctx.currentTime;
  if (l.positionX) {
    for (const [p, v] of [[l.positionX, poslucha.x], [l.positionY, poslucha.y], [l.positionZ, poslucha.z],
      [l.forwardX, vpred.x], [l.forwardY, 0], [l.forwardZ, vpred.z]]) p.setTargetAtTime(v, n, 0.03);
    l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
  } else { l.setPosition(poslucha.x, poslucha.y, poslucha.z); l.setOrientation(vpred.x, 0, vpred.z, 0, 1, 0); }
}

// bod okolo posluchaca: uhol 0 = pred nim, PI = za chrbtom, +-PI/2 = zboku
function okolo(uhol, vzdialenost, vyska = 0) {
  const a = Math.atan2(vpred.x, vpred.z) + uhol;
  return { x: poslucha.x + Math.sin(a) * vzdialenost, y: poslucha.y + vyska, z: poslucha.z + Math.cos(a) * vzdialenost };
}
const strana = () => (Math.random() < 0.5 ? -1 : 1);

// odkial zvuk prichadza, ked volajuci neda poziciu
function predvolene(druh) {
  if (druh === 'sepot') return { pozicia: okolo(strana() * nah(1.2, 2), nah(1.5, 3), 0.1) };
  if (druh === 'kroky') { const a = Math.PI + nah(-0.6, 0.6); return { pozicia: okolo(a, nah(7, 10), -1.4), ciel: okolo(a + nah(-0.2, 0.2), nah(2.5, 3.5), -1.4) }; }
  if (druh === 'konar') return { pozicia: okolo(nah(-Math.PI, Math.PI), nah(8, 20), -1) };
  if (druh === 'klopanie') return { pozicia: okolo(nah(-Math.PI, Math.PI), nah(35, 60)) };
  if (druh === 'vykrik') return { pozicia: okolo(nah(-0.7, 0.7), 4, 0.8) };
  return {};                                             // srdce, dych, dron, svitanie znie "v hlave"
}

// Prehra hororovy zvuk. pozicia {x,y,z} vo svete (volitelna), sila 1 = normalna. extra: { ciel, perioda, veta }
// Vrati dlzku v sekundach (0 = zvuk nie je zapnuty).
export function hororZvuk(druh, pozicia, sila = 1, extra = {}) {
  if (!ZVUKY_HOROR[druh]) { console.warn('Neznamy zvuk:', druh, 'mozne:', DRUHY_ZVUKOV.join(', ')); return 0; }
  const A = zvukoveProstredie();
  if (!A) return 0;
  const miesto = pozicia ? { pozicia: { x: pozicia.x, y: pozicia.y, z: pozicia.z } } : predvolene(druh);
  return ZVUKY_HOROR[druh](A, { ...miesto, ...extra, sila }, A.ctx.currentTime + 0.02);
}
// dev / konzola: najprv zapne zvuk (kliknutie alebo klaves musi uz prebehnut)
export function skusZvuk(druh) {
  initZvuk();
  const hned = hororZvuk(druh);
  return hned || new Promise(ok => setTimeout(() => ok(hororZvuk(druh)), 150));   // kontext sa prave prebudza
}

// ---------- nahodne "udalosti ticha" ----------
let doUdalosti = 8, poslednaUdalost = '';
let ciasVZone = 0, prvyZvuk = false;   // ako dlho si v tichu zony (noc) a ci uz zaznel prvy zvuk
function udalostTicha(s) {
  // vahy podla strachu: pri malom strachu vzdialene zvuky, pri velkom blizke
  const vahy = { konar: 1.2 - 0.5 * s, klopanie: 1 - 0.7 * s, kroky: 0.25 + 1.1 * s, sepot: 0.15 + 1.2 * s };
  delete vahy[poslednaUdalost];                        // nie dvakrat to iste po sebe
  let r = Math.random() * Object.values(vahy).reduce((a, b) => a + b, 0), druh;
  for (druh in vahy) if ((r -= vahy[druh]) <= 0) break;
  poslednaUdalost = druh;
  hororZvuk(druh, null, 0.65 + 0.35 * s);
}

// ---------- tlkot srdca, dych, dron ----------
let odUderu = 9, doNadychu = 1, fazaDychu = 0, periodaDychu = 3, dron = null, dronTicho = 0;
let boliVNoci = 0, nocPredtym = 0;
const obraz = { strach: 0, pulz: 0 };

// volat kazdy snimok. hracPoz = pozicia hraca, kamera = THREE kamera, hrac = (volitelne) postava pre dychanie,
// noc = 0..1, zona = 0..1 (volitelne; plati vacsia z nej a nastavZonu). Vrati { strach, pulz } pre grafiku.
// jaskyna = 0..1 (vnutri jaskyne), svetlo = 0..1 (fakla v ruke, blizky ohen) tlmi nocny strach
export function aktualizujStrach(dt, { hracPoz, kamera, hrac, noc = 0, zona = 0, jaskyna = 0, svetlo = 0 } = {}) {
  const s = stavStrachu;
  // strach: rychlo narastie, pomaly opada
  s.sok = Math.max(0, s.sok - dt * 0.04);
  const tmaK = s.vynutNoc ? 1 : medzi(noc);
  // nocny strach sam rastie v zone po tme (v jaskyni viac), svetlo ho tlmi
  const nocnyCiel = (s.zona * tmaK * 0.4 + s.zona * medzi(jaskyna) * 0.3 * tmaK) * (1 - medzi(svetlo));
  s.nocny += (nocnyCiel - s.nocny) * Math.min(1, dt / 4);
  if (nocnyCiel === 0 && s.nocny < 0.004) s.nocny = 0;
  const ciel = medzi(s.zaklad + s.sok + s.nocny);
  s.strach += (ciel - s.strach) * Math.min(1, dt / (ciel > s.strach ? 0.7 : 3.5));
  if (ciel === 0 && s.strach < 0.004) s.strach = 0;
  const cielZony = Math.max(s.zonaCiel, medzi(zona));
  s.zona += (cielZony - s.zona) * Math.min(1, dt / 1.5);
  if (cielZony === 0 && s.zona < 0.01) s.zona = 0;
  const k = s.strach, tma = s.vynutNoc ? 1 : medzi(noc);
  s.ticho = s.zona * hladko(0.35, 0.8, tma);

  // ticho v zone; pri velkom strachu je aj inde horsie pocut okolie
  tlmProstredie(Math.max(s.ticho, hladko(0.35, 1, k) * 0.7));

  // svitanie: bol si v noci v zone a prave sa rozvidnieva -> ulava
  if (s.ticho > 0.5) boliVNoci = Math.min(30, boliVNoci + dt);
  if (!s.vynutNoc && nocPredtym >= 0.5 && tma < 0.5 && boliVNoci > 20 && s.zona > 0.3) {
    hororZvuk('svitanie'); nastavStrach(0); boliVNoci = 0;
  }
  if (tma < 0.2) boliVNoci = 0;
  nocPredtym = tma;

  if (kamera) {
    kamera.getWorldDirection(vpred); vpred.y = 0;
    if (vpred.lengthSq() < 1e-4) vpred.set(0, 0, -1);
    vpred.normalize();
    poslucha.copy(hracPoz ?? kamera.position); if (hracPoz) poslucha.y += 1.6;
  }
  const A = zvukoveProstredie();
  if (A) nastavPosluchaca(A.ctx);

  // nahodne zvuky v tichu
  // prvych ~90 s v noci na ostrove je ticho s jednym zvukom (po 60 s), potom hustejsie
  if (s.ticho > 0.6) ciasVZone += dt;
  if (s.zona < 0.05) { ciasVZone = 0; prvyZvuk = false; }
  if (s.ticho > 0.6 && s.udalosti) {
    doUdalosti -= dt;
    if (ciasVZone >= 60 && !prvyZvuk) { udalostTicha(k); prvyZvuk = true; doUdalosti = mix(26, 9, k) * nah(0.7, 1.4); }
    else if (ciasVZone >= 90 && doUdalosti <= 0) { udalostTicha(k); doUdalosti = mix(26, 9, k) * nah(0.7, 1.4); }
  } else doUdalosti = Math.max(doUdalosti, nah(6, 11));

  // tlkot srdca: cim vacsi strach, tym rychlejsie a hlasnejsie
  odUderu += dt;
  if (k > 0.22 && odUderu >= 60 / mix(56, 138, hladko(0.22, 1, k))) {
    odUderu = 0;
    hororZvuk('srdce', null, 0.25 + 0.75 * hladko(0.22, 1, k));
  }
  obraz.strach = k;
  obraz.pulz = k > 0.22 ? Math.exp(-odUderu * 11) + (odUderu > 0.21 ? 0.55 * Math.exp(-(odUderu - 0.21) * 11) : 0) : 0;

  // dych: od polovice mierky pocut a vidiet rychlejsie dychanie
  const silaDychu = hladko(0.45, 0.9, k);
  if (silaDychu > 0) {
    doNadychu -= dt; fazaDychu += dt;
    if (doNadychu <= 0 && !hrac?.potapa) {
      periodaDychu = mix(2.9, 1.35, silaDychu) * nah(0.92, 1.1);
      doNadychu = periodaDychu; fazaDychu = 0;
      hororZvuk('dych', null, 0.25 + 0.55 * silaDychu, { perioda: periodaDychu });
    }
  } else doNadychu = 0.5;
  if (hrac?.J) {                                        // hrudnik sa dviha (meni len mierku, animacie v hrac.js ostavaju)
    const nadych = silaDychu * Math.max(0, Math.sin(Math.min(1, fazaDychu / (periodaDychu * 0.85)) * Math.PI));
    hrac.J.chrbat.scale.set(1 + nadych * 0.035, 1 + nadych * 0.02, 1 + nadych * 0.09);
  }

  // dron: vytvori sa az pri strachu a po utichnuti sa cely zrusi
  const silaDronu = hladko(0.12, 1, k);
  if (silaDronu > 0 && A) { dron ??= vytvorDron(A); dron.nastav(silaDronu); dronTicho = 0; }
  else if (dron && (dronTicho += dt) > 2) { dron.zrus(); dron = null; }
  else if (dron) dron.nastav(0);

  return obraz;
}

// Bledy (src/bledi.js) volaju toto. druh: 'vykuknutie' (sok + sepot), 'utok' (vykrik + velky sok)
export function udalostBledeho(druh, pozicia = null) {
  if (druh === 'utok') { pridajStrach(0.6); hororZvuk('vykrik', pozicia, 1); }
  else if (druh === 'vykuknutie') { pridajStrach(0.3); hororZvuk('sepot', pozicia, 0.9); }
}

// na ladenie: hra.strachStav()
export const diagnostika = () => ({ ...stavStrachu, dron: !!dron, zvukBezi: !!zvukoveProstredie(), ...pocitadlo });
