// Kanoe s vyvazovacim plavakom. Plynulost robi:
//  - zrychlenie postupne (ziadne skoky), odpor vody rastie s rychlostou,
//  - kyl: bocny pohyb sa tlmi silno, dopredny slabo -> kanoe "zarezava" do zakrut,
//  - otacanie cez uhlovu rychlost so zotrvacnostou,
//  - vlny: vyska, naklon dopredu/dozadu a do boku z vln pod kanoe, vsetko vyhladene.
import * as THREE from 'three';
import { klavesy } from './vstup.js';
import { vyskaTerenu } from './svet.js';
import { vyskaVody } from './ocean.js';

const tlm = THREE.MathUtils.damp;
const DLZKA = 5.2;

export function vytvorKanoe(scena, x, z) {
  const model = new THREE.Group();
  const drevo = new THREE.MeshStandardMaterial({ color: 0x9a6538, flatShading: true, side: THREE.DoubleSide });
  const tmave = new THREE.MeshStandardMaterial({ color: 0x6b4426, flatShading: true });
  // trup = spodna polgula natiahnuta do dlzky
  const trup = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), drevo);
  trup.scale.set(0.55, 0.5, DLZKA / 2);
  trup.position.y = 0.25;
  // plavak na boku + dve priecky
  const plavak = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 2.6, 4, 8), tmave);
  plavak.rotation.x = Math.PI / 2;
  plavak.position.set(2.0, 0.0, 0);
  const priecky = [-0.9, 0.9].map(zz => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.1), tmave);
    p.position.set(1.05, 0.28, zz);
    return p;
  });
  model.add(trup, plavak, ...priecky);

  // padlo (otaca sa okolo ramien hraca)
  const padlo = new THREE.Group();
  const drzadlo = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 6), tmave);
  const list = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.45, 0.03), tmave);
  list.position.y = -0.95;
  padlo.add(drzadlo, list);
  padlo.position.set(0, 1.25, 0.3);
  padlo.visible = false;
  model.add(padlo);

  model.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scena.add(model);

  const k = {
    model, padlo,
    poz: new THREE.Vector2(x, z),
    rych: new THREE.Vector2(),
    y: 0, smer: -Math.PI / 2, uhlRych: 0, pitch: 0, roll: 0, faza: 0,
    SEDADLO: new THREE.Vector3(0, -0.05, 0.3),

    rychlost() { return k.rych.length(); },

    aktualizuj(dt, t, ovladane) {
      const fx = -Math.sin(k.smer), fz = -Math.cos(k.smer);   // dopredu
      const rx = Math.cos(k.smer), rz = -Math.sin(k.smer);    // doprava

      let tah = 0, zatacanie = 0;
      if (ovladane) {
        tah = (klavesy.has('KeyW') ? 1 : 0) - (klavesy.has('KeyS') ? 0.5 : 0);
        if (klavesy.has('ShiftLeft') && tah > 0) tah *= 1.6;
        zatacanie = (klavesy.has('KeyA') ? 1 : 0) - (klavesy.has('KeyD') ? 1 : 0);
      }

      // rychlost rozlozena na dopredu (vf) a do boku (vr)
      let vf = k.rych.x * fx + k.rych.y * fz;
      let vr = k.rych.x * rx + k.rych.y * rz;
      vf += tah * 4.5 * dt;
      vf -= (vf * Math.abs(vf) * 0.065 + vf * 0.12) * dt;     // odpor vody (max ~7 m/s, s Shift ~9.5), dlho dobieha
      vr *= Math.exp(-3.5 * dt);                              // kyl: bocny smyk rychlo zanikne

      // otacanie: zotrvacnost + ide lepsie v pohybe
      k.uhlRych += zatacanie * (0.9 + 0.12 * Math.abs(vf)) * dt;
      k.uhlRych *= Math.exp(-2.6 * dt);
      k.smer += k.uhlRych * dt;

      const nfx = -Math.sin(k.smer), nfz = -Math.cos(k.smer);
      const nrx = Math.cos(k.smer), nrz = -Math.sin(k.smer);
      k.rych.set(nfx * vf + nrx * vr, nfz * vf + nrz * vr);

      // narazenie na breh: kontrola pred pridou (alebo zadou pri cuvani)
      const voda = vyskaVody(k.poz.x, k.poz.y, t);
      const smerPohybu = Math.sign(vf) || 1;
      const nx = k.poz.x + k.rych.x * dt, nz = k.poz.y + k.rych.y * dt;
      const predok = vyskaTerenu(nx + nfx * DLZKA / 2 * smerPohybu, nz + nfz * DLZKA / 2 * smerPohybu);
      if (predok > voda - 0.35) {
        k.rych.multiplyScalar(-0.2);                          // jemny odraz
      } else {
        k.poz.set(nx, nz);
      }

      // vlny: vyska a naklony z 5 bodov pod kanoe
      const v = (dx, dz) => vyskaVody(k.poz.x + dx, k.poz.y + dz, t);
      const hP = v(nfx * 2.4, nfz * 2.4), hZ = v(-nfx * 2.4, -nfz * 2.4);
      const hR = v(nrx * 1.2, nrz * 1.2), hL = v(-nrx * 1.2, -nrz * 1.2);
      const hS = (hP + hZ + hR + hL + v(0, 0)) / 5;
      k.y = tlm(k.y, hS + 0.05, 6, dt);
      k.pitch = tlm(k.pitch, Math.atan2(hP - hZ, 4.8), 5, dt);
      k.roll = tlm(k.roll, Math.atan2(hR - hL, 2.4) + k.uhlRych * vf * 0.03, 5, dt);

      model.position.set(k.poz.x, k.y, k.poz.y);
      model.rotation.set(k.pitch, k.smer, k.roll, 'YXZ');

      // animacia padla
      padlo.visible = ovladane;
      if (ovladane) {
        const aktivne = Math.abs(tah) > 0 || zatacanie !== 0;
        k.faza += dt * (aktivne ? 4 + Math.abs(tah) * 1.5 : 0);
        const strana = Math.sin(k.faza * 0.5) > 0 ? 1 : -1;  // strieda strany
        padlo.rotation.z = tlm(padlo.rotation.z, strana * 0.9, 6, dt);
        padlo.rotation.x = aktivne ? Math.sin(k.faza) * 0.6 * Math.sign(tah || 1) : tlm(padlo.rotation.x, 0, 4, dt);
      }
    },
  };
  return k;
}
