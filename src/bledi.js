// Bledi: nocni lovci hororoveho ostrova Ticha zatoka. Model: modely_bledych.js. Ostrov ich dodava v tichaZatoka.bledi / lesneUkryty
// (uloha A); ak tam nie su, pouzije sa docasne rozmiestnenie (docasne()).
//
// Stavovy automat (b.stav):
//   skryty   - cez den (a ked je hrac daleko) neviditelny "v jaskyni"
//   hliadka  - v noci chodi po trase; ked hraca zbadá, vyberie pozorovanie alebo vykuknutie spoza stromu
//   pozoruje - stoji na okraji svetla a pozera; ak sa na neho hrac dlho priamo pozera, ustupi (zmizne)
//   vykuk    - schova sa za strom, vidno len hlavu a ruku; po case zmizne alebo sa zacne plizit
//   plizi    - po styroch za hraca (zmrzne, ked sa naň pozeras); zblizi sa a zautoci
//   utok     - sprint, svih pazurmi (zran), hned ustup do tmy
//   ustup    - rychly utek do tmy (po utoku, po uderi hraca, pri rannom svitani)
//   cuva     - cuva pred fakľou (6-8 m) a tabork (12 m), zakryva si tvar
//   mrtvy    - porazeny; vrati sa az o par minut
// Matka (typ 'matka') zije v jaskyni: pomalsia, silnejsia, do jaskyne vstupuje len ked je tam hrac.
import * as THREE from 'three';
import { modelBledeho, animuj } from './modely_bledych.js';
import { tichaZatoka, hororovaZona, STRED, vyskaBezJaskyne } from './ostrovy/ticha_zatoka.js';
import * as J from './ostrovy/ticha_zatoka_jaskyna.js';
import { vyskaTerenu, uzlyPri } from './svet.js';
import { zran, stav as stavPreziti } from './preziti.js';
import { horiaceFakle } from './fakla.js';
import { najblizsiOhen, hori } from './ohen.js';
import * as strach from './strach.js';

// ---------- ADAPTER NA ZVUKY (uloha B) ----------
// Ked B dodá strach.udalostBledeho(druh, pozicia), pouzije sa automaticky. Inak docasne: hororZvuk + pridajStrach.
// druhy: 'vykuknutie' (Bledy vykukol), 'plizenie' (zacal sa plizit), 'utok' (svih pazurmi), 'zmiznutie', 'cuvanie' (pred ohnom)
// -> ak ma B ine nazvy druhov, uprav len tuto funkciu.
function udalost(druh, poz) {
  if (typeof strach.udalostBledeho === 'function') return strach.udalostBledeho(druh, poz);
  const A = { vykuknutie: ['sepot', 0.1], plizenie: ['kroky', 0.1], utok: ['vykrik', 0.45], zmiznutie: ['konar', 0.0], cuvanie: ['dych', 0.0] }[druh];
  if (!A) return;
  strach.hororZvuk(A[0], poz);
  if (A[1]) strach.pridajStrach(A[1]);
}

const TYPY = {
  bledy: { meno: 'Bledý', hp: 45, chod: 1.3, plizi: 2.1, sprint: 8.5, dmg: 16, dosah: 2.5, polomer: 0.55 },
  matka: { meno: 'Matka', hp: 150, chod: 0.95, plizi: 1.4, sprint: 6.2, dmg: 30, dosah: 3.2, polomer: 0.9 },
};
const ZBADAJ = 36, VODA = 0.25;
const rnd = (a, b) => a + Math.random() * (b - a);
const angLerp = (a, b, k) => { let d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * Math.min(1, k); };
const sucho = (x, z) => vyskaTerenu(x, z) > VODA;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const bledi = [];                         // vsetci Bledi (aj skryti)
export const nastavenia = { ai: true };          // dev: prepinac AI
let skupina = null;
const v3 = new THREE.Vector3(), v3b = new THREE.Vector3();
let pohlad = { x: 0, z: 1 }, kamPoz = { x: 0, z: 0 };   // smer kamery (rovina) a jej poloha
let nezranitelny = 0;
const kHrac = { x: 0, z: 0 };

// ---------- rozmiestnenie ----------
function sucheMiesto(cx, cz, r0, r1, pokusy = 40) {
  for (let i = 0; i < pokusy; i++) {
    const a = rnd(0, 6.283), d = rnd(r0, r1), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (vyskaTerenu(x, z) > 1.0 && hororovaZona(x, z) > 0.6) return { x, z };
  }
  return { x: cx, z: cz };
}
// DOCASNE: kym ostrov nema vlastny zoznam tichaZatoka.bledi. 4 Bledi po ostrove + Matka v jaskyni.
function docasne() {
  const s = tichaZatoka.stred, out = [];
  for (let i = 0; i < 4; i++) {
    const a = i * 1.57 + 0.4, d = 45 + (i % 2) * 18;
    const domov = sucheMiesto(s.x + Math.cos(a) * d, s.z + Math.sin(a) * d, 0, 12);
    const trasa = []; for (let k = 0; k < 4; k++) trasa.push(sucheMiesto(domov.x, domov.z, 8, 22));
    out.push({ id: 'b' + i, typ: 'bledy', domov, ukryt: tichaZatoka.jaskyna.vchod, trasa });
  }
  const k = tichaZatoka.jaskyna.komora, v = tichaZatoka.jaskyna.vchod;
  out.push({ id: 'matka', typ: 'matka', domov: { x: k.x, z: k.z }, ukryt: { x: k.x, z: k.z },
    trasa: [{ x: k.x, z: k.z }, { x: (k.x + v.x) / 2, z: (k.z + v.z) / 2 }, { x: k.x, z: k.z }] });
  return out;
}

export function initBledi(scena, renderer, kamera) {
  skupina = new THREE.Group(); skupina.name = 'bledi'; scena.add(skupina);
  for (const d of (tichaZatoka.bledi ?? docasne())) {
    const def = TYPY[d.typ] || TYPY.bledy, m = modelBledeho(d.typ === 'matka' ? 'matka' : 'bledy');
    m.g.visible = false; skupina.add(m.g);
    bledi.push({ id: d.id, typ: d.typ || 'bledy', def, m, g: m.g, x: d.domov.x, z: d.domov.z, hd: rnd(0, 6.28), hp: def.hp,
      domov: d.domov, trasa: d.trasa?.length ? d.trasa : [d.domov], bod: 0, ukryt: d.ukryt,
      stav: 'skryty', t: rnd(5, 35), cd: 0, videny: 0, pozT: 0, odvaha: 0, faza: rnd(0, 6), ph: rnd(0, 6), u: 0, amp: 0, poza: 'stoj',
      strom: null, kx: 0, kz: 0, vyp: 0 });
  }
  // zahriatie shaderov: inak by prve zjavenie Bledeho na ~0.1 s zasekalo hru
  if (renderer && bledi[0]) { bledi[0].g.visible = true; try { renderer.compile(scena, kamera); } catch (e) { /* ignoruj */ } bledi[0].g.visible = false; }
}

// ---------- pomocne ----------
function stromBlizko(hx, hz) {                      // vybrany strom pre vykuknutie: lesneUkryty (A) alebo najdeny v uzloch ostrova
  const zoz = tichaZatoka.lesneUkryty ?? uzlyPri(hx, hz).filter(u => !u.zniceny && (u.typ === 'strom' || u.typ === 'palma') && u.rKolizia >= 0.3).map(u => ({ x: u.x, z: u.z, r: u.rKolizia }));
  const c = zoz.filter(u => { const d = Math.hypot(u.x - hx, u.z - hz); return d > 9 && d < 30 && hororovaZona(u.x, u.z) > 0.3; });
  return c.length ? c[Math.floor(Math.random() * c.length)] : null;
}
function pozorovany(b, hrac) {                      // pozera sa hrac priamo na Bledeho?
  const dx = b.x - kamPoz.x, dz = b.z - kamPoz.z, d = Math.hypot(dx, dz) || 1;
  return d < 38 && (dx * pohlad.x + dz * pohlad.z) / d > 0.94;
}
function svetloBlizko(b) {                           // najblizsie svetlo, ktore Bledeho odpuzda: { x, z, d, r } alebo null
  let naj = null;
  const sl = 1 - 0.4 * b.odvaha;                     // casom sa osmeli
  for (const f of horiaceFakle()) {
    const r = (6 + 2 * Math.min(1, f.sila)) * sl, d = Math.hypot(f.x - b.x, f.z - b.z);
    if (d < r && (!naj || d / r < naj.d / naj.r)) naj = { x: f.x, z: f.z, d, r };
  }
  const o = najblizsiOhen(b.x, b.z, 12 * sl);
  if (o && hori(o)) { const d = Math.hypot(o.x - b.x, o.z - b.z), r = 12 * sl; if (!naj || d / r < naj.d / naj.r) naj = { x: o.x, z: o.z, d, r }; }
  return naj;
}
function krok(b, tx, tz, v, dt, otoc = true) {       // posun k cielu po suchu, otoci sa po smere pohybu
  const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
  if (d < 0.05) return d;
  if (otoc) b.hd = angLerp(b.hd, Math.atan2(dx, dz), 8 * dt);
  const s = Math.min(d, v * dt), nx = b.x + dx / d * s, nz = b.z + dz / d * s;
  if (sucho(nx, nz)) { b.x = nx; b.z = nz; } else if (sucho(nx, b.z)) b.x = nx; else if (sucho(b.x, nz)) b.z = nz;
  b.faza += dt * (3 + v * 1.6); b.amp = Math.min(1, v / 2.2);
  return d;
}
function pozaStoj(b, poza = 'stoj') { b.poza = poza; b.amp = 0; }
function schovaj(b, cd = 0) { b.g.visible = false; b.stav = 'skryty'; b.t = cd; }
function zmizni(b, hrac) {                           // ustupi: objavi sa na trase tam, kde je hrac najdalej
  udalost('zmiznutie', { x: b.x, y: b.g.position.y + 1.5, z: b.z });
  let naj = b.trasa[0], nd = -1;
  for (const p of [...b.trasa, b.domov]) { const d = Math.hypot(p.x - hrac.poz.x, p.z - hrac.poz.z); if (d > nd) { nd = d; naj = p; } }
  if (nd < 30) { schovaj(b, rnd(8, 18)); return; }  // trasa je pri hracovi: ostane skryty a vrati sa neskor
  b.x = naj.x; b.z = naj.z; b.stav = 'hliadka'; b.cd = rnd(8, 20); b.videny = 0; pozaStoj(b);
}
function ustup(b, sek, cd = 10) { b.stav = 'ustup'; b.t = sek; b.cd = Math.max(b.cd, cd); b.u = 0; }
function vyberCiel(b, hrac) {                        // hliadka -> co spravit, ked zbadal hraca
  const strom = Math.random() < 0.55 ? stromBlizko(hrac.poz.x, hrac.poz.z) : null;
  if (strom) { b.strom = strom; b.stav = 'vykuk'; b.t = 0; b.vyp = 0; b.pozT = 0; b.videny = 0; return; }
  b.stav = 'pozoruje'; b.pozT = 0; b.videny = 0; b.t = 0;
  const a = Math.atan2(b.x - hrac.poz.x, b.z - hrac.poz.z), d = rnd(15, 22);
  b.ciel = { x: hrac.poz.x + Math.sin(a) * d, z: hrac.poz.z + Math.cos(a) * d };
}

// ---------- hlavna aktualizacia ----------
// ctx: { hrac, kamera, noc (bool), cas, pesi }
export function aktualizujBledych(dt, { hrac, kamera, noc, cas, pesi = true }) {
  if (!skupina) return;
  dt = Math.min(dt, 0.1);
  kamera.getWorldDirection(v3); const l = Math.hypot(v3.x, v3.z) || 1; pohlad.x = v3.x / l; pohlad.z = v3.z / l; kamPoz.x = kamera.position.x; kamPoz.z = kamera.position.z;
  nezranitelny = Math.max(0, nezranitelny - dt);
  if (Math.hypot(kHrac.x, kHrac.z) > 0.2) {          // odhodenie hraca po zasahu
    const nx = hrac.poz.x + kHrac.x * dt, nz = hrac.poz.z + kHrac.z * dt;
    if (sucho(nx, nz)) { hrac.poz.x = nx; hrac.poz.z = nz; }
    const u = Math.exp(-7 * dt); kHrac.x *= u; kHrac.z *= u;
  }
  const zivy = !stavPreziti.mrtvy, zona = hororovaZona(hrac.poz.x, hrac.poz.z);
  const kJask = tichaZatoka.jaskyna.komora, hracVJask = J.hlbkaVJaskyni(hrac.poz.x - STRED[0], hrac.poz.y, hrac.poz.z - STRED[1]) > 0.1;
  const aktivna = nastavenia.ai && noc && zona > 0.15 && zivy;
  const t = cas;
  let strachK = 0;

  for (const b of bledi) {
    const def = b.def, matka = b.typ === 'matka';
    const dh = dist(b, hrac.poz);
    b.t -= dt; b.cd -= dt;
    if (b.stav === 'mrtvy') {                        // padne a zmizne, vrati sa o par minut
      b.u = Math.min(1, b.u + dt / 1.2); b.g.rotation.x = -b.u * 1.45;
      if (b.u >= 1) { b.g.rotation.x = 0; b.hp = def.hp; schovaj(b, matka ? 600 : 300); }
      animujB(b, dt, t); continue;
    }
    if (!b.g.visible) {                              // skryty: v noci sa moze objavit na domove (nie pred ocami hraca)
      if (b.stav === 'skryty' && aktivna && b.t <= 0 && (!matka || (hracVJask && dist(hrac.poz, kJask) < 50))) {
        const ciel = matka ? b.domov : b.domov;
        if (Math.hypot(ciel.x - hrac.poz.x, ciel.z - hrac.poz.z) > 28 || matka && !pozorovanyBod(ciel)) {
          b.x = ciel.x; b.z = ciel.z; b.g.visible = true; b.stav = 'hliadka'; b.bod = 0; b.cd = rnd(3, 10); b.odvaha = 0; b.hp = Math.max(b.hp, def.hp * 0.6);
        } else b.t = 3;
      }
      continue;
    }
    if (!nastavenia.ai) { if (b.vynutPoza) { b.poza = b.vynutPoza; b.faza += dt * 5; b.amp = 1; } else pozaStoj(b); animujB(b, dt, t); continue; }   // vynutPoza = dev/test

    // koniec noci / hrac odisiel: ustup domov a skry sa (nie pred ocami hraca)
    const ukonci = !noc || zona < 0.05 || !zivy || (matka && !hracVJask && dist(hrac.poz, kJask) > 60);
    if (ukonci && b.stav !== 'ustup') { b.stav = 'ustup'; b.t = 25; b.domov_ = true; }
    if (b.stav === 'ustup' && b.domov_ && !ukonci) b.domov_ = false;

    // svetlo: v dosahu fakle/taboraka cuva (okrem uz ustupujucich)
    const sv = (b.stav !== 'ustup' && b.stav !== 'cuva') ? svetloBlizko(b) : null;
    if (sv) { b.stav = 'cuva'; b.t = rnd(2.5, 4); b.sv = sv; b.cd = Math.max(b.cd, 5); b.videny = 0; udalost('cuvanie', { x: b.x, y: b.g.position.y + 1.5, z: b.z }); }
    // osmelovanie: kym je hrac blizko v noci, pomaly rastie odvaha (blizsie k svetlu)
    if (dh < 35 && zivy) b.odvaha = Math.min(1, b.odvaha + dt / 240);

    const sledujHraca = () => { b.hd = angLerp(b.hd, Math.atan2(hrac.poz.x - b.x, hrac.poz.z - b.z), 3 * dt); };
    switch (b.stav) {
      case 'hliadka': {
        const p = b.trasa[b.bod % b.trasa.length];
        if (b.pauza > 0) { b.pauza -= dt; pozaStoj(b); }
        else {
          b.poza = 'chod'; const px = b.x, pz = b.z;
          if (krok(b, p.x, p.z, def.chod, dt) < 1.5) { b.bod++; b.pauza = rnd(1, 4); b.zasek = 0; }
          else if (Math.hypot(b.x - px, b.z - pz) < def.chod * dt * 0.3 && (b.zasek = (b.zasek || 0) + dt) > 2) { b.bod++; b.zasek = 0; }   // zasekol sa (voda, skala): dalsi bod trasy
        }
        if (b.cd <= 0 && pesi && dh < ZBADAJ && (zona > 0.2) && (!matka || hracVJask)) vyberCiel(b, hrac);
        break;
      }
      case 'pozoruje': {
        if (b.ciel && dist(b, b.ciel) > 1.5 && b.pozT < 1) { b.poza = 'chod'; krok(b, b.ciel.x, b.ciel.z, def.chod * 1.4, dt); }
        else { pozaStoj(b); sledujHraca(); b.pozT += dt; }
        if (pozorovany(b, hrac)) b.videny += dt; else b.videny = Math.max(0, b.videny - dt * 0.5);
        if (b.videny > 2.2) { zmizni(b, hrac); break; }
        if ((b.pozT > rnd(7, 13) || dh < 9) && b.cd <= 0 && pesi) { b.stav = 'plizi'; b.t = 25; b.vyp = rnd(0, 1); udalost('plizenie', { x: b.x, y: 0.5, z: b.z }); }
        else if (b.pozT > 30) zmizni(b, hrac);
        break;
      }
      case 'vykuk': {
        if (!b.strom) { b.stav = 'hliadka'; break; }
        // miesto za kmenom (z pohladu hraca) + kusok bokom, aby bolo vidno hlavu a ruku
        const dx = b.strom.x - hrac.poz.x, dz = b.strom.z - hrac.poz.z, d = Math.hypot(dx, dz) || 1, r = (b.strom.r ?? 0.5) + 0.55;
        const tx = b.strom.x + dx / d * r - dz / d * 0.45, tz = b.strom.z + dz / d * r + dx / d * 0.45;
        const k = Math.hypot(tx - b.x, tz - b.z);
        if (!b.tam && k > 0.6) { b.poza = 'plizi'; krok(b, tx, tz, def.plizi * 1.2, dt); }
        else {
          if (!b.tam) { b.tam = true; b.pozT = 0; b.vyp = rnd(4, 8); udalost('vykuknutie', { x: b.x, y: 1.8, z: b.z }); }
          b.poza = 'vykuk'; b.amp = 0; krok(b, tx, tz, 1.5, dt, false);
          b.hd = angLerp(b.hd, Math.atan2(hrac.poz.x - b.x, hrac.poz.z - b.z) , 4 * dt);
          b.pozT += dt;
        }
        if (pozorovany(b, hrac) && b.tam) b.videny += dt; else b.videny = Math.max(0, b.videny - dt);
        if (b.videny > 1.3 || b.pozT > b.vyp) { b.tam = false; b.strom = null; if (b.videny > 1.3 || Math.random() < 0.5) zmizni(b, hrac); else { b.stav = 'plizi'; b.t = 25; udalost('plizenie', { x: b.x, y: 0.5, z: b.z }); } }
        else if (dh < 6) { b.tam = false; b.strom = null; b.stav = 'plizi'; }
        break;
      }
      case 'plizi': {
        const vidiMa = pozorovany(b, hrac);
        if (vidiMa) { b.videny += dt; pozaStoj(b, 'plizi'); b.amp = 0; sledujHraca(); }   // zmrzne, ked sa naň pozeras
        else {
          b.videny = Math.max(0, b.videny - dt * 0.5);
          // cielom je miesto za chrbtom hraca
          const tx = hrac.poz.x - pohlad.x * 6, tz = hrac.poz.z - pohlad.z * 6;
          b.poza = 'plizi'; krok(b, dh > 14 ? hrac.poz.x : tx, dh > 14 ? hrac.poz.z : tz, def.plizi, dt);
        }
        if (b.videny > 4) { zmizni(b, hrac); break; }
        if (b.t <= 0 || !pesi) { b.stav = 'pozoruje'; b.pozT = 0; b.ciel = null; b.cd = rnd(4, 10); break; }
        if (dh < 10 && b.cd <= 0 && (!vidiMa || b.vyp > 0.6)) { b.stav = 'utok'; b.t = 3.2; b.u = 0; b.trafil = false; }
        break;
      }
      case 'utok': {
        if (b.u > 0) {                                // svih pazurmi
          b.poza = 'pazur'; b.u += dt / 0.6; sledujHraca();
          if (!b.trafil && b.u > 0.5) {
            b.trafil = true;
            if (dh < def.dosah + 0.8 && nezranitelny <= 0 && zivy) {
              zran(def.dmg * rnd(0.85, 1.15), 'bledy'); nezranitelny = 1.5;
              const l = dh || 1; kHrac.x = (hrac.poz.x - b.x) / l * 7; kHrac.z = (hrac.poz.z - b.z) / l * 7;
              udalost('utok', { x: b.x, y: 1.6, z: b.z });
              strach.pridajStrach(0.2);
            } else udalost('utok', { x: b.x, y: 1.6, z: b.z });
          }
          if (b.u >= 1) ustup(b, rnd(2.5, 3.5), rnd(14, 26));
        } else {
          b.poza = 'sprint'; krok(b, hrac.poz.x, hrac.poz.z, def.sprint, dt); b.amp = 1;
          if (dh < def.dosah) b.u = 0.001;
          else if (b.t <= 0) ustup(b, 2.5, 10);
        }
        break;
      }
      case 'cuva': {
        const s = b.sv ?? { x: hrac.poz.x, z: hrac.poz.z };
        b.poza = 'cuva';
        const dx = b.x - s.x, dz = b.z - s.z, d = Math.hypot(dx, dz) || 1;
        const hd0 = b.hd; b.hd = angLerp(b.hd, Math.atan2(-dx, -dz), 6 * dt);   // hladi k svetlu, ide dozadu
        const nx = b.x + dx / d * 1.9 * dt, nz = b.z + dz / d * 1.9 * dt; if (sucho(nx, nz)) { b.x = nx; b.z = nz; }
        b.faza += dt * 4; b.amp = 0.8; void hd0;
        if (b.t <= 0 && !svetloBlizko(b)) { b.stav = 'pozoruje'; b.pozT = 0; b.ciel = null; b.sv = null; }
        else if (b.t <= 0) b.t = 0.6;
        break;
      }
      case 'ustup': {
        b.poza = 'sprint';
        let tx, tz;
        if (b.domov_) { tx = b.domov.x; tz = b.domov.z; } else { const l = dh || 1; tx = b.x + (b.x - hrac.poz.x) / l * 20; tz = b.z + (b.z - hrac.poz.z) / l * 20; }
        const k = krok(b, tx, tz, def.sprint * 0.75, dt); b.amp = 1;
        if (b.domov_) { if (k < 2 || b.t <= 0 || (dh > 22 && !pozorovany(b, hrac)) || dh > 60) schovaj(b, rnd(5, 20)); }
        else if (b.t <= 0 || dh > 26) { b.stav = 'hliadka'; b.pauza = 0; pozaStoj(b); }
        break;
      }
    }
    // jaskyna: Bledy nesmie prejst stenou
    if (hororovaZona(b.x, b.z) > 0.5 && Math.abs(b.z - STRED[1] - J.JZ) < 60) {
      const l = { x: b.x - STRED[0], y: b.g.position.y, z: b.z - STRED[1] }; if (J.drzVJaskyni(l, vyskaBezJaskyne)) { b.x = l.x + STRED[0]; b.z = l.z + STRED[1]; }
    }
    if (dh < 22 && b.g.visible && b.stav !== 'skryty') strachK = Math.max(strachK, 1 - dh / 22);
    animujB(b, dt, t);
  }
  if (strachK > 0 && zivy) strach.pridajStrach(dt * 0.1 * strachK);
}
const pozorovanyBod = p => { const dx = p.x - kamPoz.x, dz = p.z - kamPoz.z, d = Math.hypot(dx, dz) || 1; return (dx * pohlad.x + dz * pohlad.z) / d > 0.5; };

function animujB(b, dt, t) {
  b.g.position.set(b.x, b.stav === 'mrtvy' || !b.g.visible ? b.g.position.y : yTerenu(b), b.z);
  b.g.rotation.y = b.hd;
  animuj(b.m, { poza: b.stav === 'mrtvy' ? 'mrtvy' : b.poza, faza: b.faza, amp: b.amp, u: Math.min(1, b.u), ph: b.ph }, dt, t);
}
function yTerenu(b) { const y = vyskaTerenu(b.x, b.z); return Number.isFinite(y) ? y : 0; }

// ---------- zasah hraca (volane z boj.js vedla udriNepriatela) ----------
// vrati pole zasiahnutych Bledych (maju x, z, g ako nepriatelia -> boj.js im ukaze cislo a iskry)
export function udriBledych(x, z, fx, fz, dmg, o = {}) {
  const dosah = o.dosah ?? 2.3, kuzel = o.kuzel ?? 0.45, out = [];
  for (const b of bledi) {
    if (!b.g.visible || b.stav === 'mrtvy') continue;
    const dx = b.x - x, dz = b.z - z, l = Math.hypot(dx, dz) || 0.001, d = l - 0.3 - b.def.polomer;
    if (d > dosah || (d > 0.5 && (dx * fx + dz * fz) / l < kuzel)) continue;
    out.push({ b, d });
  }
  out.sort((a, c) => a.d - c.d);
  const vyber = (o.vsetkych ? out : out.slice(0, 1)).map(v => v.b);
  for (const b of vyber) {
    b.hp -= dmg; b.odvaha = 0;
    if (b.hp <= 0) { b.stav = 'mrtvy'; b.u = 0; b.poza = 'mrtvy'; continue; }
    ustup(b, rnd(2.5, 4), rnd(8, 14)); b.domov_ = false; b.tam = false; b.strom = null;     // uder ho odplasi
  }
  return vyber;
}

// ---------- dev / konzola ----------
export function bledySem(hrac) {                      // najblizsi neaktivny (alebo prvy) Bledy 14 m pred hraca, ide pozorovat
  const b = bledi.find(v => !v.g.visible && v.typ === 'bledy') ?? bledi.find(v => v.typ === 'bledy') ?? bledi[0];
  if (!b) return null;
  const a = Math.atan2(pohlad.x, pohlad.z);
  for (const d of [14, 11, 17, 8]) {
    const x = hrac.poz.x + Math.sin(a) * d, z = hrac.poz.z + Math.cos(a) * d;
    if (sucho(x, z)) { b.x = x; b.z = z; break; }
  }
  b.g.visible = true; b.hp = Math.max(b.hp, b.def.hp * 0.5); b.stav = 'pozoruje'; b.pozT = 0; b.videny = 0; b.cd = 0; b.ciel = null; b.hd = a + Math.PI; b.tam = false; b.domov_ = false;
  return b;
}
export function vykukniSem(hrac) {                    // dev: Bledy vykukne spoza najblizsieho stromu
  const b = bledySem(hrac); if (!b) return null;
  b.strom = stromBlizko(hrac.poz.x, hrac.poz.z);
  if (b.strom) { b.stav = 'vykuk'; b.tam = false; b.t = 0; b.x = b.strom.x + 5; b.z = b.strom.z + 5; }
  return b.strom ? b : null;
}
export const stavBledych = () => bledi.map(b => ({ id: b.id, stav: b.stav, viditelny: b.g.visible, hp: Math.round(b.hp), x: Math.round(b.x), z: Math.round(b.z), cd: Math.round(b.cd), odvaha: +b.odvaha.toFixed(2) }));
