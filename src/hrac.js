// Hrac pesi: chodza, beh, skok, plavanie. Pohyb je vzdy vzhladom na smer kamery.
import * as THREE from 'three';
import { klavesy, stlacene } from './vstup.js';
import { vyskaTerenu } from './svet.js';
import { vyskaVody } from './ocean.js';

const tlm = THREE.MathUtils.damp;   // plynule priblizovanie k cielu (nezavisle od FPS)

export function tlmUhol(a, b, lambda, dt) {   // to iste pre uhly (najkratsou cestou)
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * (1 - Math.exp(-lambda * dt));
}

export function vytvorHraca(scena) {
  const model = new THREE.Group();
  const telo = new THREE.Group();
  const triko = new THREE.MeshStandardMaterial({ color: 0xe8743b, flatShading: true });
  const koza = new THREE.MeshStandardMaterial({ color: 0xc99068, flatShading: true });
  const nohy = new THREE.MeshStandardMaterial({ color: 0x3b5b8a, flatShading: true });
  const trup = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.55, 4, 8), triko);
  trup.position.y = 1.0;
  const hlava = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), koza);
  hlava.position.y = 1.62;
  const spodok = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.6, 8), nohy);
  spodok.position.y = 0.35;
  telo.add(trup, hlava, spodok);
  telo.traverse(o => { o.castShadow = true; });
  model.add(telo);
  scena.add(model);

  const h = {
    model, telo,
    poz: new THREE.Vector3(),
    rych: new THREE.Vector3(),
    vy: 0, naZemi: false, plava: false, smer: 0,

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
      if (h.plava && zem < voda - 1.15) {
        h.poz.y = tlm(h.poz.y, voda - 1.15, 6, dt);   // hojdanie na vlnach
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
      telo.rotation.x = tlm(telo.rotation.x, h.plava ? -1.2 : 0, 6, dt);  // pri plavani lezi
      telo.position.y = tlm(telo.position.y, h.plava ? 0.9 : 0, 6, dt);
    },
  };
  return h;
}
