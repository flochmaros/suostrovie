// Hrac pesi: chodza, beh, skok, plavanie, potapanie + animacie postavy.
// Animacie su "proceduralne": ruky a nohy su skupiny s kĺbom (pivot) a ich uhol pocitame sinusom.
import * as THREE from 'three';
import { klavesy, stlacene } from './vstup.js';
import { vyskaTerenu } from './svet.js';
import { vyskaVody } from './ocean.js';

const tlm = THREE.MathUtils.damp;   // plynule priblizovanie k cielu (nezavisle od FPS)

export function tlmUhol(a, b, lambda, dt) {   // to iste pre uhly (najkratsou cestou)
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * (1 - Math.exp(-lambda * dt));
}

const mat = c => new THREE.MeshStandardMaterial({ color: c, flatShading: true });
const TRIKO = mat(0xe8743b), KOZA = mat(0xc99068), SORTKY = mat(0x3b5b8a), VLASY = mat(0x3a2a1a);

// koncatina: skupina s klbom hore, valec visi dole
function koncatina(dlzka, hrubka, material, x, y) {
  const klb = new THREE.Group();
  klb.position.set(x, y, 0);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(hrubka, dlzka - 2 * hrubka, 3, 6), material);
  m.position.y = -dlzka / 2;
  klb.add(m);
  return klb;
}

export function vytvorHraca(scena) {
  const model = new THREE.Group();
  const telo = new THREE.Group();          // cela postava (naklon pri plavani)
  const trup = new THREE.Group();          // horna cast od bokov (predklon pri zdvihani)
  trup.position.y = 0.85;
  const hrud = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.32, 4, 8), TRIKO);
  hrud.position.y = 0.32;
  const hlava = new THREE.Group();
  hlava.position.y = 0.78;
  const lebka = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), KOZA);
  const vlasy = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 6, 0, Math.PI * 2, 0, 1.3), VLASY);
  vlasy.position.set(0, 0.03, 0.02);
  hlava.add(lebka, vlasy);
  const rukaL = koncatina(0.62, 0.08, KOZA, -0.33, 0.6);
  const rukaP = koncatina(0.62, 0.08, KOZA, 0.33, 0.6);
  trup.add(hrud, hlava, rukaL, rukaP);
  const nohaL = koncatina(0.85, 0.1, SORTKY, -0.13, 0.85);
  const nohaP = koncatina(0.85, 0.1, SORTKY, 0.13, 0.85);
  telo.add(trup, nohaL, nohaP);
  telo.traverse(o => { o.castShadow = true; });
  model.add(telo);
  scena.add(model);

  let faza = 0, casZdvihania = 0;

  const h = {
    model, telo,
    poz: new THREE.Vector3(),
    rych: new THREE.Vector3(),
    vy: 0, naZemi: false, plava: false, potapa: false, dych: 1, smer: 0,

    zdvihni() { casZdvihania = 0.6; },

    // stav: 'stoj' | 'chodza' | 'plavanie' | 'vzduch' | 'sedi'; rychlost v m/s; padloFaza pre sedenie v kanoe
    animuj(dt, stav, rychlost, padloFaza = 0) {
      faza += dt * (stav === 'plavanie' ? 3 + rychlost : 2 + rychlost * 1.6);
      casZdvihania = Math.max(0, casZdvihania - dt);
      const amp = Math.min(1, rychlost / 5);        // pri behu vacsie kroky
      const s = Math.sin(faza);
      // cielove uhly klbov
      let nL = 0, nP = 0, rL = 0.05, rP = 0.05, rLz = 0.12, trupX = 0, teloX = 0, teloY = 0;
      if (stav === 'chodza') {
        nL = s * 0.8 * amp; nP = -nL; rL = -s * 0.7 * amp; rP = -rL;
        trupX = -0.12 * amp;                          // predklon pri behu
        teloY = Math.abs(Math.cos(faza)) * 0.06 * amp; // poskakovanie
      } else if (stav === 'stoj') {
        rLz = 0.12 + Math.sin(faza * 0.6) * 0.03;      // dychanie
      } else if (stav === 'vzduch') {
        nL = -0.6; nP = 0.3; rL = 2.4; rP = 2.4; rLz = 0.4;
      } else if (stav === 'plavanie') {
        teloX = -1.3; teloY = 0.9;
        rL = faza % (Math.PI * 2) - Math.PI; rP = (faza + Math.PI) % (Math.PI * 2) - Math.PI;  // kraul
        nL = Math.sin(faza * 2) * 0.35; nP = -nL; rLz = 0.2;
      } else if (stav === 'sedi') {
        nL = nP = 1.45;                               // nohy vpred (kladny uhol = dopredu)
        rL = rP = 0.9 + Math.sin(padloFaza) * 0.35;  // ruky drzia padlo
        trupX = Math.sin(padloFaza) * 0.12;
        teloY = -0.6;
      }
      if (casZdvihania > 0) {                         // predklon a ruky k zemi
        const k = Math.sin(casZdvihania / 0.6 * Math.PI);
        trupX = -1.1 * k; rL = rP = 1.0 * k;
      }
      const L = 18;
      nohaL.rotation.x = tlm(nohaL.rotation.x, nL, L, dt);
      nohaP.rotation.x = tlm(nohaP.rotation.x, nP, L, dt);
      rukaL.rotation.x = tlm(rukaL.rotation.x, rL, L, dt);
      rukaP.rotation.x = tlm(rukaP.rotation.x, rP, L, dt);
      rukaL.rotation.z = tlm(rukaL.rotation.z, -rLz, L, dt);
      rukaP.rotation.z = tlm(rukaP.rotation.z, rLz, L, dt);
      trup.rotation.x = tlm(trup.rotation.x, trupX, 12, dt);
      telo.rotation.x = tlm(telo.rotation.x, teloX, 6, dt);
      telo.position.y = tlm(telo.position.y, teloY, 10, dt);
    },

    aktualizuj(dt, yaw, t) {
      const vpred = (klavesy.has('KeyW') ? 1 : 0) - (klavesy.has('KeyS') ? 1 : 0);
      const vbok = (klavesy.has('KeyD') ? 1 : 0) - (klavesy.has('KeyA') ? 1 : 0);
      // smer vpred a vpravo podla kamery
      let mx = -Math.sin(yaw) * vpred + Math.cos(yaw) * vbok;
      let mz = -Math.cos(yaw) * vpred - Math.sin(yaw) * vbok;
      const dlzka = Math.hypot(mx, mz);
      if (dlzka > 0) { mx /= dlzka; mz /= dlzka; }

      const voda = vyskaVody(h.poz.x, h.poz.z, t);
      h.plava = vyskaTerenu(h.poz.x, h.poz.z) < voda - 1.3;
      const rychlost = h.plava ? 3 : (klavesy.has('ShiftLeft') ? 9 : 5);
      h.rych.x = tlm(h.rych.x, mx * rychlost, 10, dt);
      h.rych.z = tlm(h.rych.z, mz * rychlost, 10, dt);
      h.poz.x += h.rych.x * dt;
      h.poz.z += h.rych.z * dt;

      const zem = vyskaTerenu(h.poz.x, h.poz.z);
      // potapanie: drz C v hlbokej vode, kym mas dych
      h.potapa = h.plava && klavesy.has('KeyC') && h.dych > 0;
      h.dych = THREE.MathUtils.clamp(h.dych + (h.potapa ? -dt / 20 : dt / 4), 0, 1);  // 20 s pod vodou
      if (h.plava && zem < voda - 1.15) {
        const ciel = h.potapa ? Math.max(zem + 0.6, voda - 6) : voda - 1.15;
        h.poz.y = tlm(h.poz.y, ciel, h.potapa ? 2 : 6, dt);   // hojdanie na vlnach / ponor
        h.vy = 0; h.naZemi = false;
      } else {
        h.vy -= 22 * dt;                               // gravitacia
        h.poz.y += h.vy * dt;
        h.naZemi = h.poz.y <= zem;
        if (h.naZemi) { h.poz.y = zem; h.vy = 0; }
        if (h.naZemi && stlacene('Space')) h.vy = 7.5;
      }

      // otocenie postavy do smeru pohybu
      if (dlzka > 0) h.smer = tlmUhol(h.smer, Math.atan2(-mx, -mz), 12, dt);
      model.position.copy(h.poz);
      model.rotation.set(0, h.smer, 0);

      const v = Math.hypot(h.rych.x, h.rych.z);
      h.animuj(dt, h.plava ? 'plavanie' : !h.naZemi ? 'vzduch' : v > 0.5 ? 'chodza' : 'stoj', v);
    },
  };
  return h;
}
