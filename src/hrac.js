// Hrac: model s klbmi (boky, kolena, ramena, lakte, hlava) + proceduralne animacie + pohyb.
// Kazdy stav (stoj, chodza, beh, skok, plavanie, potapanie, sedenie, uder, zdvihanie) nastavi cielove uhly klbov,
// klby sa k nim plynulo priblizuju (damp) -> prechody medzi stavmi su hladke.
import * as THREE from 'three';
import { klavesy, stlacene } from './vstup.js';
import { vyskaTerenu, uzlyPri } from './svet.js';
import { vyskaVody } from './ocean.js';

const tlm = THREE.MathUtils.damp;
export function tlmUhol(a, b, lambda, dt) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * (1 - Math.exp(-lambda * dt));
}

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o });
const KOZA = M(0xc68a62), TRIKO = M(0xd9573b), SORTKY = M(0xcbb488), VLASY = M(0x2b1d12, { roughness: 0.55 }), OCI = M(0x15110e, { roughness: 0.2 });

function klb(x, y, z, ...deti) { const g = new THREE.Group(); g.position.set(x, y, z); if (deti.length) g.add(...deti); return g; }
function kapsula(r, dlzka, mat, y0 = 0) {        // visi z klbu dole
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(dlzka - 2 * r, 0.01), 4, 10), mat);
  m.position.y = y0 - dlzka / 2;
  return m;
}
function mesh(geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m;
}

function postavModel() {
  const J = {};
  const nohy = [-1, 1].map(s => {
    const chodidlo = mesh(new THREE.BoxGeometry(0.1, 0.07, 0.25), KOZA, 0, -0.44, -0.05);
    const koleno = klb(0, -0.46, 0, kapsula(0.066, 0.44, KOZA), chodidlo);
    const stehno = klb(0.1 * s, -0.02, 0, kapsula(0.082, 0.46, KOZA), kapsula(0.096, 0.27, SORTKY, 0.02), koleno);
    return { stehno, koleno };
  });
  const ruky = [-1, 1].map(s => {
    const dlan = mesh(new THREE.SphereGeometry(0.052, 8, 6), KOZA, 0, -0.29, 0, 0.9, 1.1, 0.8);
    const drziak = klb(0, -0.31, -0.02);
    const laket = klb(0, -0.3, 0, kapsula(0.047, 0.28, KOZA), dlan, drziak);
    const rameno = klb(0.23 * s, 0.42, 0, kapsula(0.054, 0.3, KOZA), kapsula(0.066, 0.15, TRIKO, 0.03), laket);
    return { rameno, laket, drziak };
  });
  const hlava = klb(0, 0.58, 0,
    mesh(new THREE.SphereGeometry(0.125, 18, 14), KOZA, 0, 0.11, 0, 0.95, 1.1, 1),
    mesh(new THREE.SphereGeometry(0.133, 18, 10, 0, Math.PI * 2, 0, 1.5), VLASY, 0, 0.13, 0.012),
    mesh(new THREE.SphereGeometry(0.018, 8, 6), OCI, -0.045, 0.125, -0.112),
    mesh(new THREE.SphereGeometry(0.018, 8, 6), OCI, 0.045, 0.125, -0.112),
    mesh(new THREE.ConeGeometry(0.022, 0.05, 6).rotateX(-Math.PI / 2), KOZA, 0, 0.09, -0.13),
    mesh(new THREE.SphereGeometry(0.03, 6, 6), KOZA, -0.122, 0.11, 0, 0.5, 1, 0.8),
    mesh(new THREE.SphereGeometry(0.03, 6, 6), KOZA, 0.122, 0.11, 0, 0.5, 1, 0.8));
  const chrbat = klb(0, 0.08, 0,
    mesh(new THREE.CapsuleGeometry(0.17, 0.24, 4, 12), TRIKO, 0, 0.26, 0, 1.3, 1, 0.78),
    mesh(new THREE.CylinderGeometry(0.052, 0.06, 0.14, 8), KOZA, 0, 0.52, 0),
    hlava, ruky[0].rameno, ruky[1].rameno);
  const telo = klb(0, 0.95, 0,
    mesh(new THREE.CapsuleGeometry(0.15, 0.08, 4, 12), SORTKY, 0, 0.0, 0, 1.25, 1, 0.82),
    chrbat, nohy[0].stehno, nohy[1].stehno);
  telo.traverse(o => { if (o.isMesh) o.castShadow = true; });
  Object.assign(J, { telo, chrbat, hlava, sL: nohy[0].stehno, sP: nohy[1].stehno, kL: nohy[0].koleno, kP: nohy[1].koleno,
    rL: ruky[0].rameno, rP: ruky[1].rameno, lL: ruky[0].laket, lP: ruky[1].laket, drziak: ruky[1].drziak });
  return J;
}

export function vytvorHraca(scena) {
  const model = new THREE.Group();
  const J = postavModel();
  model.add(J.telo);
  scena.add(model);

  let faza = 0, cas = 0, uder = -1, zdvih = -1, vRuke = null, poslednySin = 0, bolVoVode = false;

  const h = {
    model, J,
    poz: new THREE.Vector3(), rych: new THREE.Vector3(),
    vy: 0, naZemi: false, plava: false, potapa: false, dych: 1, smer: 0,
    priUdere: null, priKroku: null, priSplachu: null,      // udalosti pre zvuky a efekty

    uder() { if (uder < 0 && !h.plava) { uder = 0; return true; } return false; },
    zdvihni() { zdvih = 0; },
    // predmet v pravej ruke (model z registra predmetov alebo nic)
    drz(predmet) {
      if (vRuke) J.drziak.remove(vRuke);
      vRuke = null;
      if (predmet?.model) {
        vRuke = new THREE.Mesh(predmet.model[0], predmet.model[1]);
        vRuke.rotation.set(Math.PI / 2, 0, Math.PI / 2);
        vRuke.castShadow = true;
        J.drziak.add(vRuke);
      }
    },

    animuj(dt, stav, v, padloFaza = 0) {
      cas += dt;
      const beh = THREE.MathUtils.clamp((v - 4) / 4, 0, 1);           // 0 = chodza, 1 = beh
      faza += dt * (stav === 'plavanie' || stav === 'potapanie' ? 2.2 + v * 0.6 : 1.6 + v * 1.25);
      const s = Math.sin(faza), c = Math.cos(faza);
      // cielove uhly (kladne x = koncatina dopredu; koleno zaporne = ohnutie)
      const t = { sL: 0, sP: 0, kL: -0.05, kP: -0.05, rL: 0.05, rP: 0.05, rLz: -0.1, rPz: 0.1, lL: 0.15, lP: 0.15,
        chx: 0, chy: 0, hx: 0, hy: 0, tx: 0, ty: 0.95 };
      if (stav === 'chodza') {
        const A = 0.5 + beh * 0.35;
        t.sL = s * A; t.sP = -s * A;
        t.kL = -(0.1 + Math.max(0, c) * (0.8 + beh * 0.9)); t.kP = -(0.1 + Math.max(0, -c) * (0.8 + beh * 0.9));
        t.rL = -s * (0.4 + beh * 0.5); t.rP = s * (0.4 + beh * 0.5);
        t.lL = t.lP = 0.25 + beh * 1.1;
        t.chx = -0.05 - beh * 0.22; t.chy = s * 0.12;
        t.ty = 0.95 + Math.abs(c) * 0.04 - beh * 0.04;
        // kroky (zvuk): pri zmene znamienka sinusu
        if (Math.sign(s) !== poslednySin) { poslednySin = Math.sign(s); h.priKroku?.(); }
      } else if (stav === 'stoj') {
        t.chx = Math.sin(cas * 1.6) * 0.015;                          // dychanie
        t.hy = Math.sin(cas * 0.37) * 0.35 * Math.max(0, Math.sin(cas * 0.13));   // obcas sa rozhliadne
        t.rLz = -0.1 - Math.sin(cas * 1.6) * 0.02; t.rPz = -t.rLz;
      } else if (stav === 'vzduch') {
        t.sL = 0.8; t.kL = -1.1; t.sP = -0.15; t.kP = -0.4;
        t.rL = t.rP = 0.6; t.rLz = -0.7; t.rPz = 0.7; t.lL = t.lP = 0.6;
      } else if (stav === 'plavanie') {
        if (v > 0.6) {                                                // kraul
          t.tx = -1.35; t.hx = 0.7;
          t.sL = Math.sin(faza * 2) * 0.3; t.sP = -t.sL; t.kL = t.kP = -0.25;
        } else {                                                      // slapanie vody
          t.tx = -0.15; t.sL = s * 0.5; t.sP = -s * 0.5; t.kL = t.kP = -0.7;
          t.rLz = -1.1 - s * 0.3; t.rPz = 1.1 + s * 0.3; t.rL = t.rP = 0.4;
        }
        t.ty = 0.95;
      } else if (stav === 'potapanie') {                              // prsia
        t.tx = -1.55; t.hx = 0.8;
        t.rL = t.rP = 2.6 + s * 0.5; t.rLz = -0.3 - c * 0.6; t.rPz = -t.rLz; t.lL = t.lP = 0.3 + Math.max(0, c);
        t.sL = t.sP = 0.3 + Math.max(0, -c) * 0.6; t.kL = t.kP = -0.2 - Math.max(0, -c) * 1.4;
      } else if (stav === 'sedi') {
        t.sL = t.sP = 1.45; t.kL = t.kP = -1.35; t.ty = 0.2;
        t.chy = Math.sin(padloFaza) * 0.35;
        t.rL = 1.0 + Math.sin(padloFaza) * 0.45; t.rP = 1.0 - Math.sin(padloFaza) * 0.45; t.lL = t.lP = 0.7;
        t.rLz = -0.25; t.rPz = 0.25; t.chx = -0.1 + Math.cos(padloFaza) * 0.08;
      }
      // uder (0.5 s): napriahnutie, sek, navrat
      let rychlo = false;
      if (uder >= 0) {
        uder += dt;
        const u = uder / 0.5;
        if (u < 0.4) { t.rP = 2.7; t.rPz = 0.3; t.lP = 1.2; t.chy = 0.55; t.chx = 0.05; }
        else if (u < 0.65) { t.rP = -0.3; t.rPz = 0.1; t.lP = 0.1; t.chy = -0.35; t.chx = -0.3; rychlo = true; }
        if (uder >= 0.22 && uder - dt < 0.22) h.priUdere?.();
        if (u >= 1) uder = -1;
      }
      if (zdvih >= 0) {
        zdvih += dt;
        const k = Math.sin(Math.min(zdvih / 0.6, 1) * Math.PI);
        t.sL = t.sP = 1.1 * k; t.kL = t.kP = -1.6 * k; t.ty = 0.95 - 0.35 * k;
        t.chx = -0.7 * k; t.rL = t.rP = 1.2 * k; t.lL = t.lP = 0.3;
        if (zdvih > 0.6) zdvih = -1;
      }
      const L = rychlo ? 40 : 16;
      J.sL.rotation.x = tlm(J.sL.rotation.x, t.sL, 16, dt); J.sP.rotation.x = tlm(J.sP.rotation.x, t.sP, 16, dt);
      J.kL.rotation.x = tlm(J.kL.rotation.x, t.kL, 16, dt); J.kP.rotation.x = tlm(J.kP.rotation.x, t.kP, 16, dt);
      J.rL.rotation.x = tlm(J.rL.rotation.x, t.rL, 16, dt); J.rP.rotation.x = tlm(J.rP.rotation.x, t.rP, L, dt);
      J.rL.rotation.z = tlm(J.rL.rotation.z, t.rLz, 16, dt); J.rP.rotation.z = tlm(J.rP.rotation.z, t.rPz, L, dt);
      J.lL.rotation.x = tlm(J.lL.rotation.x, t.lL, 16, dt); J.lP.rotation.x = tlm(J.lP.rotation.x, t.lP, L, dt);
      J.chrbat.rotation.x = tlm(J.chrbat.rotation.x, t.chx, L, dt); J.chrbat.rotation.y = tlm(J.chrbat.rotation.y, t.chy, L, dt);
      J.hlava.rotation.x = tlm(J.hlava.rotation.x, t.hx, 8, dt); J.hlava.rotation.y = tlm(J.hlava.rotation.y, t.hy, 4, dt);
      J.telo.rotation.x = tlm(J.telo.rotation.x, t.tx, 6, dt);
      J.telo.position.y = tlm(J.telo.position.y, t.ty, 12, dt);
      // kraul: ruky sa tocia dokola (bez tlmenia, inak by preskakovali)
      if (stav === 'plavanie' && v > 0.6) { J.rL.rotation.x = faza % 6.283; J.rP.rotation.x = (faza + Math.PI) % 6.283; J.rL.rotation.z = -0.25; J.rP.rotation.z = 0.25; }
    },

    aktualizuj(dt, yaw, t) {
      const vpred = (klavesy.has('KeyW') ? 1 : 0) - (klavesy.has('KeyS') ? 1 : 0);
      const vbok = (klavesy.has('KeyD') ? 1 : 0) - (klavesy.has('KeyA') ? 1 : 0);
      let mx = -Math.sin(yaw) * vpred + Math.cos(yaw) * vbok;
      let mz = -Math.cos(yaw) * vpred - Math.sin(yaw) * vbok;
      const dlzka = Math.hypot(mx, mz);
      if (dlzka > 0) { mx /= dlzka; mz /= dlzka; }

      const voda = vyskaVody(h.poz.x, h.poz.z, t);
      h.plava = vyskaTerenu(h.poz.x, h.poz.z) < voda - 1.3;
      if (h.plava && !bolVoVode && h.vy < -2) h.priSplachu?.(Math.min(-h.vy / 8, 1));
      bolVoVode = h.plava;
      const sprint = klavesy.has('ShiftLeft');
      const rychlost = h.plava ? (sprint ? 4.5 : 3) : (sprint ? 8.5 : 4.6);
      const zrychl = h.naZemi || h.plava ? 12 : 3;                    // vo vzduchu sa smer meni pomaly
      h.rych.x = tlm(h.rych.x, mx * rychlost, zrychl, dt);
      h.rych.z = tlm(h.rych.z, mz * rychlost, zrychl, dt);
      h.poz.x += h.rych.x * dt;
      h.poz.z += h.rych.z * dt;

      // kolizie so stromami a balvanmi (kruhove hitboxy)
      for (const u of uzlyPri(h.poz.x, h.poz.z)) {
        if (!u.rKolizia || u.zniceny) continue;
        const dx = h.poz.x - u.x, dz = h.poz.z - u.z, d = Math.hypot(dx, dz), min = u.rKolizia + 0.3;
        if (d < min && d > 1e-4) { h.poz.x = u.x + dx / d * min; h.poz.z = u.z + dz / d * min; }
      }

      const zem = vyskaTerenu(h.poz.x, h.poz.z);
      h.potapa = h.plava && klavesy.has('KeyC') && h.dych > 0;
      h.dych = THREE.MathUtils.clamp(h.dych + (h.potapa ? -dt / 20 : dt / 4), 0, 1);
      if (h.plava && zem < voda - 1.15) {
        const ciel = h.potapa ? Math.max(zem + 0.8, voda - 7) : voda - 1.2;
        h.poz.y = tlm(h.poz.y, ciel, h.potapa ? 1.5 : 5, dt);
        h.vy = 0; h.naZemi = false;
      } else {
        const bolNaZemi = h.naZemi;
        h.vy -= 24 * dt;
        h.poz.y += h.vy * dt;
        if (bolNaZemi && h.vy <= 0 && h.poz.y - zem < 0.4) h.poz.y = zem;   // drz sa zeme aj z kopca
        h.naZemi = h.poz.y <= zem + 0.02;
        if (h.poz.y < zem) { h.poz.y = zem; h.vy = 0; }
        if (h.naZemi && stlacene('Space')) h.vy = 8;
      }

      // smer postavy: pri udere sa otoci tam, kam pozera kamera
      if (uder >= 0) h.smer = tlmUhol(h.smer, yaw, 20, dt);
      else if (dlzka > 0) h.smer = tlmUhol(h.smer, Math.atan2(-mx, -mz), 14, dt);
      model.position.copy(h.poz);
      model.rotation.set(0, h.smer, 0);

      const v = Math.hypot(h.rych.x, h.rych.z);
      h.animuj(dt, h.potapa ? 'potapanie' : h.plava ? 'plavanie' : !h.naZemi ? 'vzduch' : v > 0.5 ? 'chodza' : 'stoj', v);
    },
  };
  return h;
}
