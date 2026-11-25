// Kamera tretej osoby: mys otaca okamzite (bez oneskorenia), ciel sleduje rychlo,
// nevojde do terenu, v kanoe sa sama otoci za lodou, pri rychlosti sa rozsiri zorny uhol.
import * as THREE from 'three';
import { mys } from './vstup.js';
import { vyskaTerenu } from './svet.js';
import { vzdialenostKStavbe } from './stavba.js';
import { vyskaVody } from './ocean.js';
import { vzdialenostKJaskyni } from './horor_zona.js';
import { tlmUhol } from './hrac.js';
import { nastavenia } from './nastavenia.js';

const tlm = THREE.MathUtils.damp;
const SMER = new THREE.Vector3();
export const CITLIVOST = 0.0032;

export function vytvorKameru(kamera) {
  const k = { yaw: -Math.PI / 2, pitch: 0.28, vzdialenost: 6, akt: 6, ciel: new THREE.Vector3(), prvy: true, otras: 0 };
  k.zatras = sila => { k.otras = Math.max(k.otras, sila); };
  const p = new THREE.Vector3();

  k.aktualizuj = (dt, t, cielPoz, { vKanoe = false, smerKanoe = 0, rychlost = 0, podVodu = false, extra = 0 } = {}) => {
    k.yaw -= mys.dx * CITLIVOST * nastavenia.citlivost;
    k.pitch = THREE.MathUtils.clamp(k.pitch + mys.dy * CITLIVOST * nastavenia.citlivost, -0.6, 1.35);
    k.vzdialenost = THREE.MathUtils.clamp(k.vzdialenost + mys.koliesko * 1.0, 2.5, 25);
    if (vKanoe && performance.now() - mys.posledny > 1200) k.yaw = tlmUhol(k.yaw, smerKanoe, 2.2, dt);

    if (k.prvy) { k.ciel.copy(cielPoz); k.prvy = false; }
    k.ciel.x = tlm(k.ciel.x, cielPoz.x, 25, dt);
    k.ciel.z = tlm(k.ciel.z, cielPoz.z, 25, dt);
    k.ciel.y = tlm(k.ciel.y, cielPoz.y, 14, dt);

    const ciel = vKanoe ? k.vzdialenost + 3.5 + extra : k.vzdialenost;
    // kolizia s terenom: skrat vzdialenost, ak by medzi hracom a kamerou bol kopec
    let d = ciel;
    for (let i = 1; i <= 10; i++) {
      const s = ciel * i / 10;
      p.set(k.ciel.x + Math.sin(k.yaw) * Math.cos(k.pitch) * s, k.ciel.y + Math.sin(k.pitch) * s, k.ciel.z + Math.cos(k.yaw) * Math.cos(k.pitch) * s);
      if (vyskaTerenu(p.x, p.z) + 0.35 > p.y) { d = Math.max(ciel * (i - 1) / 10, 1.2); break; }
    }
    // kolizia so stavbami: kamera nesmie byt za stenou -> priblizi sa pred nu
    SMER.set(Math.sin(k.yaw) * Math.cos(k.pitch), Math.sin(k.pitch), Math.cos(k.yaw) * Math.cos(k.pitch));
    d = Math.min(d, Math.max(vzdialenostKStavbe(k.ciel, SMER, d + 0.3) - 0.3, 0.6));
    d = Math.min(d, Math.max(vzdialenostKJaskyni(k.ciel, SMER, d), 0.6));
    k.akt = d < k.akt ? d : tlm(k.akt, d, 5, dt);           // priblizenie hned, oddialenie plynule
    kamera.position.set(
      k.ciel.x + Math.sin(k.yaw) * Math.cos(k.pitch) * k.akt,
      k.ciel.y + Math.sin(k.pitch) * k.akt,
      k.ciel.z + Math.cos(k.yaw) * Math.cos(k.pitch) * k.akt);
    if (!podVodu) {                                         // kamera nad hladinou (okrem potapania)
      const min = vyskaVody(kamera.position.x, kamera.position.z, t) + 0.35;
      if (kamera.position.y < min) kamera.position.y = min;
    }
    kamera.lookAt(k.ciel);
    if (k.otras > 0.001) {                                  // zatrasenie pri udere / pade stromu, rychlo dozneje
      kamera.rotation.x += (Math.random() - 0.5) * k.otras;
      kamera.rotation.y += (Math.random() - 0.5) * k.otras;
      k.otras *= Math.exp(-dt * 14);
    }
    const fov = 70 + Math.min(rychlost, 16) * 0.9;
    if (Math.abs(kamera.fov - fov) > 0.05) { kamera.fov = tlm(kamera.fov, fov, 3, dt); kamera.updateProjectionMatrix(); }
  };
  return k;
}
