// Preziti: hlad, smad, zdravie. Cisto logika + HUD (ziadny import z ineho modulu hry).
// hlad/smad: 100 = sity/napity, 0 = prazdne. zdravie: 100 = plne.

export const stav = { hlad: 90, smad: 90, zdravie: 100, mrtvy: false };

// callbacky, ktore nastavi main.js
export const udalosti = { priSmrti: null, priVarovani: null, priZobudeni: null };

const HLAD_ZA_S = 100 / (25 * 60);   // prazdny za ~25 min
const SMAD_ZA_S = 100 / (15 * 60);   // prazdny za ~15 min
const UBYTOK_ZDRAVIA = 0.5;          // za sekundu pri hlade/smade 0 (kazde zvlast)
const OBNOVA_ZDRAVIA = 0.6;          // za sekundu pri hlade aj smade > 60
const TEPLO_OHNA = 0.5;              // za sekundu navyse pri horiacom ohni (ak nie si hladny/smadny)

let blesk = 0;            // cervene zablesnutie po zraneni (0..1)
let casVarovania = 0;     // rate-limit varovani
let posHlad = 100, posSmad = 100; // na detekciu prechodu pod prah

const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));

function varuj(text) {
  if (casVarovania > 0) return;
  casVarovania = 30; // sekund medzi varovaniami
  if (udalosti.priVarovani) udalosti.priVarovani(text);
}

// dt v sekundach; akcie: { beh, plava, vKanoe, padluje, teplo (nasobok smadu, 1 = normal, ~1.5 na slnku), priOhni (pri horiacom taboraku) }
export function aktualizujPreziti(dt, { beh = false, plava = false, vKanoe = false, padluje = false, teplo = 1, priOhni = false } = {}) {
  if (stav.mrtvy) return;
  dt = Math.min(dt, 0.25);
  let akt = 1;
  if (plava) akt = 1.8; else if (padluje) akt = 1.5; else if (beh) akt = 1.6; else if (vKanoe) akt = 1.1;
  stav.hlad = clamp(stav.hlad - HLAD_ZA_S * akt * dt);
  stav.smad = clamp(stav.smad - SMAD_ZA_S * akt * Math.max(0.5, teplo) * dt);

  if (stav.hlad <= 0) zranTichy(UBYTOK_ZDRAVIA * dt, 'hlad');
  if (stav.smad <= 0) zranTichy(UBYTOK_ZDRAVIA * dt, 'smad');
  if (!stav.mrtvy && stav.hlad > 60 && stav.smad > 60 && stav.zdravie < 100) {
    stav.zdravie = clamp(stav.zdravie + OBNOVA_ZDRAVIA * dt);
  }
  // teplo ohna: pomale hojenie, ak nie si hladny ani smadny
  if (!stav.mrtvy && priOhni && stav.hlad > 25 && stav.smad > 25 && stav.zdravie < 100) {
    stav.zdravie = clamp(stav.zdravie + TEPLO_OHNA * dt);
  }

  casVarovania = Math.max(0, casVarovania - dt);
  blesk = Math.max(0, blesk - dt * 1.5);
  if (posHlad > 20 && stav.hlad <= 20) varuj('Si hladný');
  if (posSmad > 20 && stav.smad <= 20) varuj('Máš smäd');
  if (stav.hlad <= 20 || stav.smad <= 20) { // opakovane pripomenutie
    if (stav.smad <= stav.hlad) varuj('Máš smäd'); else varuj('Si hladný');
  }
  posHlad = stav.hlad; posSmad = stav.smad;
}

// tiche poskodenie (bez blesku) pre hlad/smad
function zranTichy(n, pricina) {
  stav.zdravie = clamp(stav.zdravie - n);
  if (stav.zdravie <= 0) umri(pricina);
}

function umri(pricina) {
  if (stav.mrtvy) return;
  stav.zdravie = 0;
  stav.mrtvy = true;
  if (udalosti.priSmrti) udalosti.priSmrti(pricina);
}

// poskodenie od okolia (zralok, pad...). pricina: text/kod
// vystroj (src/vystroj.js): prilba = -25 % poskodenia, plast = lava nepali, cizmy = +25 % v mociari (mociar nastavuje vystroj.js), amulet = dych (hrac.js)
export const vystroj = { prilba: false, plast: false, cizmy: false, amulet: false, mociar: false, brnenie: null };
export const obranaBrnenia = {};   // naplni obsah/brnenie.js: id -> obrana 0-1
export function zran(n, pricina = 'zranenie') {
  if (stav.mrtvy || n <= 0) return;
  if (vystroj.plast && pricina === 'lava') return;    // ohnivzdorny plast
  if (vystroj.prilba) n *= 0.75;
  if (vystroj.brnenie) n *= 1 - (obranaBrnenia[vystroj.brnenie] ?? 0);   // brnenie na hrudi (src/brnenie.js)
  stav.zdravie = clamp(stav.zdravie - n);
  blesk = Math.min(1, blesk + 0.4 + n / 40);
  if (stav.zdravie <= 0) umri(pricina);
}

// zjedenie/vypitie predmetu; vrati true ak sa zjedol (main potom odober 1)
export function zjedz(def) {
  if (stav.mrtvy || !def || !def.jedlo) return false;
  const j = def.jedlo;
  const surove = (def.id === 'krab' || def.id === 'ryba') && !def.vareny;
  const ef = surove ? 0.7 : 1;
  const hladnyCo = (j.sytost || 0) > 0 && stav.hlad < 100;
  const smadnyCo = (j.voda || 0) > 0 && stav.smad < 100;
  const lieci = (j.zdravie || 0) > 0 && stav.zdravie < 100;
  if (!hladnyCo && !smadnyCo && !lieci) return false; // nic by to nezmenilo
  stav.hlad = clamp(stav.hlad + (j.sytost || 0) * ef);
  stav.smad = clamp(stav.smad + (j.voda || 0) * ef);
  if (j.zdravie) stav.zdravie = clamp(stav.zdravie + j.zdravie);
  if (surove && Math.random() < 0.2) {
    zran(6, 'surove jedlo');
    if (udalosti.priVarovani) udalosti.priVarovani('Surové jedlo ti nerobí dobre');
  }
  return true;
}

// nasobok rychlosti pohybu (hrac)
export function rychlostNasobok() {
  const cizmy = vystroj.cizmy && vystroj.mociar ? 1.25 : 1;   // kozene cizmy v mociari
  if (stav.hlad <= 0 || stav.smad <= 0) return 0.75 * cizmy;
  if (stav.hlad < 15 || stav.smad < 15) return 0.9 * cizmy;
  return cizmy;
}

// 0..1 sila rozmazania obrazu (nizke zdravie / vycerpanie)
export function rozmazanie() {
  const z = stav.zdravie < 30 ? (30 - stav.zdravie) / 30 : 0;
  const v = Math.min(stav.hlad, stav.smad) <= 0 ? 0.4 : 0;
  return clamp(Math.max(z * 0.8, v), 0, 1);
}

// po smrti: bezpecne hodnoty (inventar sa nemeni)
export function oziv() {
  stav.hlad = 50; stav.smad = 50; stav.zdravie = 60; stav.mrtvy = false;
  blesk = 0; casVarovania = 5; posHlad = 50; posSmad = 50;
}

export function ulozPreziti() {
  return { hlad: stav.hlad, smad: stav.smad, zdravie: stav.zdravie };
}

export function nacitajPreziti(o) {
  if (!o || typeof o !== 'object') return;
  const c = (v, d) => (typeof v === 'number' && isFinite(v) ? clamp(v) : d);
  stav.hlad = c(o.hlad, stav.hlad);
  stav.smad = c(o.smad, stav.smad);
  stav.zdravie = c(o.zdravie, stav.zdravie);
  if (stav.zdravie <= 0) stav.zdravie = 30;
  stav.mrtvy = false;
  posHlad = stav.hlad; posSmad = stav.smad;
}

// ---- HUD ----
let el = null;
function najdiElementy() {
  el = {
    z: document.querySelector('#bar-zdravie > div'),
    h: document.querySelector('#bar-hlad > div'),
    s: document.querySelector('#bar-smad > div'),
    zr: document.getElementById('zranenie'),
    smrt: document.getElementById('smrt'),
    znova: document.getElementById('smrt-znova'),
  };
  if (el.znova) el.znova.addEventListener('click', (e) => {
    e.stopPropagation();
    if (udalosti.priZobudeni) udalosti.priZobudeni();
  });
}

export function vykresliPreziti() {
  if (!el) najdiElementy();
  if (el.z) el.z.style.width = stav.zdravie.toFixed(1) + '%';
  if (el.h) el.h.style.width = stav.hlad.toFixed(1) + '%';
  if (el.s) el.s.style.width = stav.smad.toFixed(1) + '%';
  if (el.h) el.h.parentElement.classList.toggle('nizke', stav.hlad < 20);
  if (el.s) el.s.parentElement.classList.toggle('nizke', stav.smad < 20);
  if (el.z) el.z.parentElement.classList.toggle('nizke', stav.zdravie < 30);
  if (el.zr) {
    const nizke = stav.zdravie < 30 ? (30 - stav.zdravie) / 30 * 0.6 : 0;
    el.zr.style.opacity = Math.min(1, Math.max(blesk, nizke)).toFixed(2);
  }
  if (el.smrt) el.smrt.style.display = stav.mrtvy ? 'flex' : 'none';
}

// maly self-check
(() => {
  const ulozene = ulozPreziti();
  const mrtvyPred = stav.mrtvy, sm = udalosti.priSmrti;
  let spustene = 0; udalosti.priSmrti = () => { spustene++; };
  stav.zdravie = 10; stav.mrtvy = false;
  zran(20, 'test');
  console.assert(stav.mrtvy && spustene === 1, 'preziti: smrt sa nespustila');
  oziv();
  console.assert(!stav.mrtvy && stav.zdravie > 0, 'preziti: oziv zlyhalo');
  stav.hlad = 50; stav.smad = 50;
  console.assert(zjedz({ id: 'x', jedlo: { sytost: 10, voda: 10 } }) && stav.hlad === 60, 'preziti: zjedz zlyhalo');
  udalosti.priSmrti = sm; stav.mrtvy = mrtvyPred;
  stav.hlad = ulozene.hlad; stav.smad = ulozene.smad; stav.zdravie = ulozene.zdravie;
  blesk = 0; casVarovania = 0;
})();
