// Hrac: model s klbmi (boky, kolena, ramena, lakte, hlava) + proceduralne animacie + pohyb.
// Kazdy stav (stoj, chodza, beh, skok, plavanie, potapanie, sedenie, uder, zdvihanie) nastavi cielove uhly klbov,
// klby sa k nim plynulo priblizuju (damp) -> prechody medzi stavmi su hladke.
import * as THREE from 'three';
import { klavesy, stlacene } from './vstup.js';
import { vyskaTerenu, uzlyPri } from './svet.js';
import { vyskaVody } from './ocean.js';
import { postavModel } from './postava.js';
import { odtlacOdStien, vyskaPodlahy } from './stavba.js';
import { vyskaStrechy, odtlacOdJaskyne } from './horor_zona.js';
import { odtlacOdMajaka } from './majak.js';
import { drzNaPalube, naLokalne } from './kanoe.js';
import { UTOKY, KOMBO_OKNO, typZbrane } from './boj.js';

const tlm = THREE.MathUtils.damp;
export function tlmUhol(a, b, lambda, dt) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * (1 - Math.exp(-lambda * dt));
}

export function vytvorHraca(scena) {
  const model = new THREE.Group();
  const J = postavModel();
  model.add(J.telo);
  scena.add(model);

  // boj: nab = ako dlho drzis tlacidlo (nabijanie), utokT = cas v utoku, utokDef = definicia z boj.js
  let nab = -1, utokT = -1, utokDef = null, buf = false, koniecCas = -9, kombo = 0, smerU = null, trefene = false, lastYaw = 0;
  let faza = 0, cas = 0, zdvih = -1, vRuke = null, poslednySin = 0, bolVoVode = false, dalsiHit = 0, otocka = 0, salto = 0;

  const h = {
    model, J,
    poz: new THREE.Vector3(), rych: new THREE.Vector3(),
    vy: 0, naZemi: false, plava: false, potapa: false, dych: 1, smer: 0,
    priUdere: null, priKroku: null, priSplachu: null,      // udalosti pre zvuky a efekty

    zbran: 'pest', nabite: false, stopaAktivna: false, utok: null, nabijanie: 0,
    autoCiel: null, priMachu: null, priEfekte: null,
    get ruka() { return vRuke; },
    // klik: zacne nabijanie (utok sa odpali pri pusteni tlacidla); pocas seku sa klik ulozi do fronty (kombo)
    uder() {
      if (h.plava) return false;
      if (utokT >= 0) { buf = true; return true; }
      if (nab < 0) { nab = 0; smerU = null; return true; }
      return false;
    },
    zdvihni() { zdvih = 0; },
    // predmet v pravej ruke (model z registra predmetov alebo nic)
    drz(predmet) {
      h.zbran = typZbrane(predmet);
      if (vRuke) J.drziak.remove(vRuke);
      vRuke = null;
      h.nesieFaklu = !!predmet?.horenie;
      if (predmet?.model) {
        vRuke = new THREE.Mesh(predmet.model[0], predmet.model[1]);
        if (predmet.drzanie) { vRuke.position.set(...predmet.drzanie.poz); vRuke.rotation.set(...predmet.drzanie.rot); }
        else vRuke.rotation.set(Math.PI / 2, 0, Math.PI / 2);
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
        chx: 0, chy: 0, hx: 0, hy: 0, tx: 0, ty: 0.95, zx: 0 };
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
      // fakla: prava ruka ju drzi zdvihnutu pred telom (utoky a zdvihanie nizsie tuto pozu prepisu)
      if (vRuke && h.nesieFaklu && stav !== 'plavanie' && stav !== 'potapanie' && stav !== 'sedi') {
        t.rP = 0.72 + (stav === 'chodza' ? s * 0.07 : Math.sin(cas * 1.6) * 0.015); t.lP = 0.96; t.rPz = 0.55;
      }
      // ---- boj: nabijanie (drzanie tlacidla) a utoky podla zbrane (definicie v boj.js) ----
      if (stav === 'plavanie' || stav === 'potapanie' || stav === 'sedi') { nab = -1; utokT = -1; buf = false; h.utok = null; otocka = 0; salto = 0; h.nabijanie = 0; }
      const zacniUtok = silny => {
        const typ = h.zbran, T = UTOKY[typ];
        let def;
        if (silny) def = T.silny;
        else { kombo = typ === 'mec' && cas - koniecCas < KOMBO_OKNO ? (kombo + 1) % T.kombo.length : 0; def = T.kombo[kombo]; }
        utokDef = { ...def, typ, silny }; utokT = 0; trefene = false; buf = false; h.nabite = false; dalsiHit = 0; h.utok = utokDef;
        smerU = h.autoCiel?.(lastYaw, def.hity[def.hity.length - 1].dosah + (def.dash ? 2 : 0)) ?? null;
      };
      const pozaUtoku = (pose, vahaT) => { for (const k in pose) t[k] = pose[k]; };
      let rychlo = false;
      h.stopaAktivna = false;
      if (nab >= 0) {
        nab += dt;
        h.nabite = nab >= 0.6; h.nabijanie = Math.min(nab / 0.6, 1);
        if (!klavesy.has('Mys0')) { zacniUtok(nab >= 0.6); nab = -1; h.nabijanie = 0; }
        else {
          const T = UTOKY[h.zbran];
          pozaUtoku(T.nab ?? T.silny.kf[0][1]);
          if (h.nabite) { t.chx += Math.sin(cas * 60) * 0.04; t.rP += Math.sin(cas * 45) * 0.06; t.ty -= 0.05; }   // naplno nabity = trasie sa
        }
      }
      if (utokT >= 0) {
        utokT += dt;
        const D = utokDef, T = utokT, sm = smerU ?? lastYaw, fx = -Math.sin(sm), fz = -Math.cos(sm);
        // klucova poza: posledna, ktorej cas uz nastal (kratko pred casom sa uz klby rozbehnu)
        let kf = D.kf[0][1];
        for (const [kt, p] of D.kf) if (T >= kt - 0.04) kf = p;
        pozaUtoku(kf);
        rychlo = true;
        if (D.trail && T >= D.trail[0] && T < D.trail[1]) h.stopaAktivna = true;
        if (!D.machnute && T >= D.hity[0].t - 0.07) { D.machnute = true; h.priMachu?.(D); }
        // skok a prudky pad zo vzduchu (uder o zem)
        if (D.skok && !D.skocil && T >= D.skok[0]) { D.skocil = true; if (h.naZemi && !h.plava) { h.vy = D.skok[1]; h.naZemi = false; } }
        if (D.pad && !D.padol && T >= D.pad[0]) { D.padol = true; if (!h.naZemi) h.vy = D.pad[1]; }
        // zasahy (moze ich byt viac v jednom utoku)
        while (dalsiHit < D.hity.length && T >= D.hity[dalsiHit].t) {
          const H = D.hity[dalsiHit];
          const info = { ...D, ...H, efekt: H.efekt, fx, fz, dalsi: dalsiHit > 0, x: h.poz.x, y: h.poz.y, z: h.poz.z };
          h.priEfekte?.(info);
          h.priUdere?.(info);
          dalsiHit++;
        }
        // vypad: posun dopredu (m/s) v okne [od, do]; stary 'lunge' len na zemi
        if (D.dash && T >= D.dash[0] && T < D.dash[1] && !h.plava && (!D.dash[3] || h.naZemi)) {
          const nx = h.poz.x + fx * D.dash[2] * dt, nz = h.poz.z + fz * D.dash[2] * dt;
          if (vyskaTerenu(nx, nz) > 0.35 || !h.naZemi) { h.poz.x = nx; h.poz.z = nz; }
        }
        // otocka celeho tela a salto (uhly sa pricitaju k smeru postavy / sklonu tela)
        const ease = (od, d) => { const k = THREE.MathUtils.clamp((T - od) / (d - od), 0, 1); return k * k * (3 - 2 * k); };
        otocka = D.spin ? ease(D.spin[0], D.spin[1]) * D.spin[2] * Math.PI * 2 : 0;
        salto = D.flip ? ease(D.flip[0], D.flip[1]) * D.flip[2] * Math.PI * 2 : 0;
        if (T >= D.dlzka) {
          utokT = -1; koniecCas = cas; h.utok = null; otocka = 0; salto = 0;
          if (buf) zacniUtok(false);
        }
      }
      if (h.poza) { pozaUtoku(h.poza); rychlo = true; }              // ladenie: pevna poza z konzoly (hra.hrac.poza = {...})
      if (zdvih >= 0) {
        zdvih += dt;
        const k = Math.sin(Math.min(zdvih / 0.6, 1) * Math.PI);
        t.sL = t.sP = 1.1 * k; t.kL = t.kP = -1.6 * k; t.ty = 0.95 - 0.35 * k;
        t.chx = -0.7 * k; t.rL = t.rP = 1.2 * k; t.lL = t.lP = 0.3;
        if (zdvih > 0.6) zdvih = -1;
      }
      const L = rychlo ? 40 : 16;
      const N = rychlo ? 26 : 16;                                       // nohy a lava ruka pri utoku rychlejsie
      J.sL.rotation.x = tlm(J.sL.rotation.x, t.sL, N, dt); J.sP.rotation.x = tlm(J.sP.rotation.x, t.sP, N, dt);
      J.kL.rotation.x = tlm(J.kL.rotation.x, t.kL, N, dt); J.kP.rotation.x = tlm(J.kP.rotation.x, t.kP, N, dt);
      J.rL.rotation.x = tlm(J.rL.rotation.x, t.rL, N, dt); J.rP.rotation.x = tlm(J.rP.rotation.x, t.rP, L, dt);
      J.rL.rotation.z = tlm(J.rL.rotation.z, t.rLz, N, dt); J.rP.rotation.z = tlm(J.rP.rotation.z, t.rPz, L, dt);
      J.lL.rotation.x = tlm(J.lL.rotation.x, t.lL, N, dt); J.lP.rotation.x = tlm(J.lP.rotation.x, t.lP, L, dt);
      J.chrbat.rotation.x = tlm(J.chrbat.rotation.x, t.chx, L, dt); J.chrbat.rotation.y = tlm(J.chrbat.rotation.y, t.chy, L, dt);
      J.hlava.rotation.x = tlm(J.hlava.rotation.x, t.hx, 8, dt); J.hlava.rotation.y = tlm(J.hlava.rotation.y, t.hy, 4, dt);
      J.telo.rotation.x = tlm(J.telo.rotation.x, t.tx, rychlo ? 14 : 6, dt);
      J.drziak.rotation.x = tlm(J.drziak.rotation.x, -(t.zx ?? 0), rychlo ? 30 : 10, dt);  // zapastie (zx > 0 = hrot dopredu)
      if (salto) J.telo.rotation.x = t.tx - salto % (Math.PI * 2);          // salto (po dokonceni plynulo naspat bez odtocenia)
      if (otocka) model.rotation.y += otocka;
      J.telo.position.y = tlm(J.telo.position.y, t.ty, rychlo ? 20 : 12, dt);
      // kraul: ruky sa tocia dokola (bez tlmenia, inak by preskakovali)
      if (stav === 'plavanie' && v > 0.6) { J.rL.rotation.x = faza % 6.283; J.rP.rotation.x = (faza + Math.PI) % 6.283; J.rL.rotation.z = -0.25; J.rP.rotation.z = 0.25; }
    },

    // ---------- chodza po palube lode (model hraca je dietaom lode, suradnice su lokalne) ----------
    pal: { x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0 },
    // postavi hraca na palubu na najblizsie miesto k svetovej polohe (x, z)
    naPalubu(lod, x, z) {
      const P = lod.stat.paluba, [lx, lz] = naLokalne(lod, x, z), [px, pz] = drzNaPalube(P, lx, lz);
      Object.assign(h.pal, { x: px, y: P.y, z: pz, vx: 0, vz: 0, vy: 0 });
      lod.model.add(model);
      model.position.set(px, P.y, pz);
      h.naZemi = true; h.plava = false; h.potapa = false;
    },
    aktualizujNaPalube(dt, yaw, lod) {
      const P = lod.stat.paluba, pal = h.pal;
      const vpred = (klavesy.has('KeyW') ? 1 : 0) - (klavesy.has('KeyS') ? 1 : 0);
      const vbok = (klavesy.has('KeyD') ? 1 : 0) - (klavesy.has('KeyA') ? 1 : 0);
      let mx = -Math.sin(yaw) * vpred + Math.cos(yaw) * vbok, mz = -Math.cos(yaw) * vpred - Math.sin(yaw) * vbok;
      const dlzka = Math.hypot(mx, mz);
      if (dlzka > 0) { mx /= dlzka; mz /= dlzka; }
      const s = Math.sin(lod.smer), c = Math.cos(lod.smer);
      const rychlost = (klavesy.has('ShiftLeft') ? 6.5 : 4) * (h.nasobok ?? 1);
      pal.vx = tlm(pal.vx, (mx * c - mz * s) * rychlost, 12, dt);
      pal.vz = tlm(pal.vz, (mx * s + mz * c) * rychlost, 12, dt);
      [pal.x, pal.z] = drzNaPalube(P, pal.x + pal.vx * dt, pal.z + pal.vz * dt);
      pal.vy -= 24 * dt; pal.y += pal.vy * dt;
      h.naZemi = pal.y <= P.y + 0.02;
      if (pal.y < P.y) { pal.y = P.y; pal.vy = 0; }
      if (h.naZemi && stlacene('Space')) pal.vy = 7;
      lastYaw = yaw;
      if (utokT >= 0 || nab >= 0) h.smer = tlmUhol(h.smer, smerU ?? yaw, 22, dt);
      else if (dlzka > 0) h.smer = tlmUhol(h.smer, Math.atan2(-mx, -mz), 14, dt);
      model.position.set(pal.x, pal.y, pal.z);
      model.rotation.set(0, h.smer - lod.smer, 0);
      lod.model.updateMatrixWorld(true);
      model.getWorldPosition(h.poz);
      h.rych.set(pal.vx * c + pal.vz * s, 0, -pal.vx * s + pal.vz * c);   // svetova rychlost (pre zvuky a zvieratka)
      h.vy = pal.vy; h.plava = false; h.potapa = false;
      const v = Math.hypot(pal.vx, pal.vz);
      h.animuj(dt, !h.naZemi ? 'vzduch' : v > 0.5 ? 'chodza' : 'stoj', v);
    },

    aktualizuj(dt, yaw, t) {
      const vpred = (klavesy.has('KeyW') ? 1 : 0) - (klavesy.has('KeyS') ? 1 : 0);
      const vbok = (klavesy.has('KeyD') ? 1 : 0) - (klavesy.has('KeyA') ? 1 : 0);
      let mx = -Math.sin(yaw) * vpred + Math.cos(yaw) * vbok;
      let mz = -Math.cos(yaw) * vpred - Math.sin(yaw) * vbok;
      const dlzka = Math.hypot(mx, mz);
      if (dlzka > 0) { mx /= dlzka; mz /= dlzka; }

      const voda = vyskaVody(h.poz.x, h.poz.z, t);
      h.plava = Math.max(vyskaTerenu(h.poz.x, h.poz.z), vyskaStrechy(h.poz.x, h.poz.z, h.poz.y)) < voda - 1.3;
      if (h.plava && !bolVoVode && h.vy < -2) h.priSplachu?.(Math.min(-h.vy / 8, 1));
      bolVoVode = h.plava;
      const sprint = klavesy.has('ShiftLeft');
      const rychlost = (h.plava ? (sprint ? 4.5 : 3) : (sprint ? 8.5 : 4.6)) * (h.nasobok ?? 1);
      const zrychl = h.naZemi || h.plava ? 12 : 3;                    // vo vzduchu sa smer meni pomaly
      h.rych.x = tlm(h.rych.x, mx * rychlost, zrychl, dt);
      h.rych.z = tlm(h.rych.z, mz * rychlost, zrychl, dt);
      h.poz.x += h.rych.x * dt;
      h.poz.z += h.rych.z * dt;

      // kolizie so stromami a balvanmi (kruhove hitboxy)
      for (const u of uzlyPri(h.poz.x, h.poz.z)) {
        if (!u.rKolizia || u.zniceny || u.lenLode || h.poz.y > u.yMax) continue;
        const dx = h.poz.x - u.x, dz = h.poz.z - u.z, d = Math.hypot(dx, dz), min = u.rKolizia + 0.3;
        if (d < min && d > 1e-4) { h.poz.x = u.x + dx / d * min; h.poz.z = u.z + dz / d * min; }
      }

      odtlacOdStien(h.poz);                                            // steny zo stavania
      odtlacOdMajaka(h.poz);                                           // maják je pevny
      odtlacOdJaskyne(h.poz);                                          // steny jaskyne a zatopeny vchod
      const strecha = vyskaStrechy(h.poz.x, h.poz.z, h.poz.y);          // po streche jaskyne sa chodi ako po zemi
      const zem = Math.max(vyskaTerenu(h.poz.x, h.poz.z), vyskaPodlahy(h.poz.x, h.poz.z, h.poz.y), strecha);
      h.potapa = h.plava && klavesy.has('KeyC') && h.dych > 0;
      h.dych = THREE.MathUtils.clamp(h.dych + (h.potapa ? -dt / (20 * (h.dychNasobok ?? 1)) : dt / 4), 0, 1);
      if (h.plava && zem < voda - 1.15) {
        const ciel = h.potapa ? Math.max(zem + 0.8, voda - 40) : voda - 1.2;
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
      lastYaw = yaw;
      if (utokT >= 0 || nab >= 0) h.smer = tlmUhol(h.smer, smerU ?? yaw, 22, dt);
      else if (dlzka > 0) h.smer = tlmUhol(h.smer, Math.atan2(-mx, -mz), 14, dt);
      model.position.copy(h.poz);
      model.rotation.set(0, h.smer, 0);

      const v = Math.hypot(h.rych.x, h.rych.z);
      h.animuj(dt, h.potapa ? 'potapanie' : h.plava ? 'plavanie' : !h.naZemi ? 'vzduch' : v > 0.5 ? 'chodza' : 'stoj', v);
    },
  };
  return h;
}
