// Castice: body (Points), kazdy ma rychlost, gravitaciu, zivot; ako stracaju zivot, miznu (alfa).
import * as THREE from 'three';

export const MAPA_KRUH = (() => {               // makky biely kruh
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

export function vytvorCastice(scena, { pocet = 600, velkost = 0.3, aditivne = false, vrstva = 1, jas = 1, nepriehladnost = 1 } = {}) {
  const poz = new Float32Array(pocet * 3), farby = new Float32Array(pocet * 4);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(poz, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(farby, 4));
  const body = new THREE.Points(geo, new THREE.PointsMaterial({
    size: velkost, map: MAPA_KRUH, vertexColors: true, transparent: true, depthWrite: false, opacity: nepriehladnost,
    blending: aditivne ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));
  body.material.color.setScalar(jas);             // jas > 1 = HDR farba, ktoru zachyti bloom (ohen)
  body.frustumCulled = false;
  body.layers.set(vrstva);
  scena.add(body);
  const c = Array.from({ length: pocet }, () => ({ vx: 0, vy: 0, vz: 0, zivot: 0, max: 1, g: 9.8 }));
  const farba = new THREE.Color();
  let dalsia = 0;
  return {
    jas(k) { body.material.color.setScalar(jas * k); },     // stmavenie neosvetlenych castic (pena v noci)
    vypust(x, y, z, vx, vy, vz, hex = 0xffffff, zivot = 1, g = 9.8) {
      const i = dalsia; dalsia = (dalsia + 1) % pocet;
      Object.assign(c[i], { vx, vy, vz, zivot, max: zivot, g });
      poz.set([x, y, z], i * 3);
      farba.set(hex);
      farby.set([farba.r, farba.g, farba.b, 1], i * 4);
    },
    aktualizuj(dt) {
      for (let i = 0; i < pocet; i++) {
        const k = c[i];
        if (k.zivot <= 0) { farby[i * 4 + 3] = 0; continue; }
        k.zivot -= dt;
        k.vy -= k.g * dt;
        poz[i * 3] += k.vx * dt; poz[i * 3 + 1] += k.vy * dt; poz[i * 3 + 2] += k.vz * dt;
        farby[i * 4 + 3] = Math.max(k.zivot / k.max, 0);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}
