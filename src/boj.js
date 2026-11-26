// Boj hraca: definicie utokov podla zbrane (poziciie klbov, casovanie, dosah), zasah nepriatelov,
// "satisfying" efekty (hitstop, iskry, plavajuce cisla, stopa mece). Animaciu klbov robi hrac.js podla UTOKY.
import * as THREE from 'three';
import { zoznamNepriatelov, udriNepriatela } from './nepriatelia.js';
import { udriBledych } from './bledi.js';
import { zvuky } from './zvuk.js';
import { poskodenieNepriatela } from './nastroje.js';
import { vytvorCastice } from './castice.js';

export const stav = { hitstop: 0 };                 // sekundy, kym je hra spomalena (main.js ju spomali)

// Poza = cielove uhly klbov: rP/rPz = pravé rameno (dopredu / do strany), lP = pravy laket, chx/chy = chrbat (sklon / otocenie), tx = telo
const NAHOR = { rP: 2.9, rPz: 0.3, lP: 1.2, chy: 0.55, chx: 0.05 };          // napriahnutie nad hlavu
const ZHORA = { rP: -0.3, rPz: 0.1, lP: 0.1, chy: -0.35, chx: -0.35 };      // zvisly uder
const U = (dlzka, hit, wind, strike, extra = {}) => ({ dlzka, hit, wind, strike, mult: 1, knock: 1, dosah: 2, kuzel: 0.64, vsetkych: false, lunge: 0, ...extra });

const SILNY = (extra) => U(0.6, 0.12, { ...NAHOR, chx: 0.2, tx: 0.1 }, { ...ZHORA, tx: -0.2 }, { mult: 2, knock: 2.4, lunge: 3, ...extra });

export const UTOKY = {
  pest: { kombo: [U(0.36, 0.16, { rP: 1.3, rPz: 0.15, lP: 1.7, chy: 0.45 }, { rP: 1.55, rPz: 0.05, lP: 0.05, chy: -0.4, chx: -0.1, tx: -0.12 }, { dosah: 1.6, lunge: 1.5 })], silny: SILNY({ dosah: 1.8 }) },
  noz: { kombo: [U(0.34, 0.14, { rP: 1.0, rPz: 0.25, lP: 1.9, chy: 0.5, chx: 0.1 }, { rP: 1.5, rPz: 0.05, lP: 0.05, chy: -0.45, chx: -0.15, tx: -0.15 }, { dosah: 1.8, lunge: 2 })], silny: SILNY({ dosah: 2 }) },
  sekera: { kombo: [U(0.55, 0.22, NAHOR, ZHORA, { dosah: 2, lunge: 1 })], silny: SILNY({ dosah: 2.2 }) },
  // klepetovy kyj: velmi pomaly zvisly uder (dlhy napriah), obrovsky knockback a omracenie (stun = sekundy)
  klepeto: { kombo: [U(1.0, 0.55, { ...NAHOR, rP: 3.1, chx: 0.25, tx: 0.15 }, { ...ZHORA, tx: -0.25 }, { mult: 2.2, knock: 3, stun: 1.2, dosah: 2.4, lunge: 1, kuzel: 0.5 })],
    silny: SILNY({ dlzka: 0.95, hit: 0.45, mult: 3, knock: 4, stun: 1.6, dosah: 2.6 }) },
  mec: {
    kombo: [
      U(0.44, 0.16, { rP: 1.5, rPz: 1.5, lP: 0.5, chy: 1.0 }, { rP: 1.5, rPz: -0.2, lP: 0.1, chy: -1.05, tx: -0.08 }, { dosah: 2.6, vsetkych: true, lunge: 3, trail: true }),      // sek zlava
      U(0.44, 0.16, { rP: 1.5, rPz: -0.4, lP: 0.2, chy: -0.85 }, { rP: 1.5, rPz: 1.6, lP: 0.1, chy: 0.95, tx: -0.08 }, { dosah: 2.6, vsetkych: true, lunge: 3, trail: true }),    // sek sprava
      U(0.66, 0.3, NAHOR, ZHORA, { dosah: 2.6, vsetkych: true, lunge: 4, mult: 1.7, knock: 1.8, trail: true }),                                                                  // silny uder zhora
    ],
    silny: SILNY({ dosah: 2.8, vsetkych: true, trail: true }),
  },
};
export const typZbrane = p => { const t = p?.nastroj?.typ; return !t ? 'pest' : t === 'mec' ? 'mec' : t === 'noz' ? 'noz' : t === 'klepeto' ? 'klepeto' : 'sekera'; };

export const KOMBO_OKNO = 0.55;                      // za kolko sekund po seku sa dalsi klik berie ako kombo

// jemny auto-aim: najblizsi nepriatel v sirokom uhle pred kamerou -> smer postavy (alebo null)
export function autoUhol(hrac, yaw, dosah) {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  let naj = null, nd = dosah + 1.6;
  for (const e of zoznamNepriatelov()) {
    if (e.mrtvy) continue;
    const dx = e.x - hrac.poz.x, dz = e.z - hrac.poz.z, l = Math.hypot(dx, dz) || 0.001, d = l - 0.3 - (e.def.polomer || 0);
    if (d > nd || (dx * fx + dz * fz) / l < 0.26) continue;
    nd = d; naj = e;
  }
  return naj ? Math.atan2(-(naj.x - hrac.poz.x), -(naj.z - hrac.poz.z)) : null;
}

// ---------- efekty ----------
let iskry = null, kamera = null, kam = null, hracRef = null, cislaDiv = null;
const cisla = [], v3 = new THREE.Vector3();
let trail = null;

export function initBoj({ scena, kamera: k, kam: km, hrac }) {
  kamera = k; kam = km; hracRef = hrac;
  iskry = vytvorCastice(scena, { pocet: 300, velkost: 0.14, aditivne: true });
  cislaDiv = document.createElement('div');
  cislaDiv.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:5';
  document.body.appendChild(cislaDiv);
  trail = vytvorStopu(scena);
  hrac.autoCiel = (yaw, dosah) => autoUhol(hrac, yaw, dosah);
  hrac.priMachu = def => zvuky.mach(def.typ, def.silny);
}

function cislo(x, y, z, text, silne) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `position:absolute;font:800 ${silne ? 26 : 19}px system-ui,sans-serif;color:${silne ? '#ffd24a' : '#fff'};text-shadow:0 0 3px #000,0 2px 4px #000;transform:translate(-50%,-50%)`;
  cislaDiv.appendChild(el);
  cisla.push({ el, x: x + (Math.random() - 0.5) * 0.5, y, z, t: 0 });
}

// zasah: zavolat z hrac.priUdere. Vrati pocet zasiahnutych.
export function zasahni(hrac, info, nast, silaDev = 1) {
  const n = nast?.nastroj || {}, voda = n.vodaBonus && hrac.poz.y < 0.3 ? n.vodaBonus : 1;
  const dmg = poskodenieNepriatela(nast?.nastroj ? nast : null) * silaDev * info.mult * voda;
  const o = { ...info, dosah: (info.dosah ?? 2.3) + (n.dosah || 0), horenie: n.horenie || 0 };
  const hity = [...udriNepriatela(hrac.poz.x, hrac.poz.z, info.fx, info.fz, dmg, o), ...udriBledych(hrac.poz.x, hrac.poz.z, info.fx, info.fz, dmg, o)];   // + Bledi (bledi.js)
  if (!hity.length) return 0;
  const silne = info.silny || info.mult > 1;
  for (const e of hity) {
    const y = (e.g?.position.y ?? hrac.poz.y) + 0.9;
    cislo(e.x, y, e.z, Math.round(dmg * 10) / 10, silne);
    const n = silne ? 22 : 12;
    for (let i = 0; i < n; i++) iskry.vypust(e.x, y - 0.2, e.z, (Math.random() - 0.5) * 7 + info.fx * 3, 1 + Math.random() * 4, (Math.random() - 0.5) * 7 + info.fz * 3, i % 3 ? 0xffe9a0 : 0xff6a50, 0.35 + Math.random() * 0.25, 12);
  }
  zvuky.zasahZbran(info.typ, silne);
  stav.hitstop = silne ? 0.1 : 0.06;
  kam.zatras(silne ? 0.05 : 0.03);
  return hity.length;
}

export function aktualizujBoj(dt) {
  if (!kamera) return;
  iskry.aktualizuj(dt);
  for (let i = cisla.length - 1; i >= 0; i--) {
    const c = cisla[i]; c.t += dt;
    if (c.t > 0.9) { c.el.remove(); cisla.splice(i, 1); continue; }
    v3.set(c.x, c.y + c.t * 1.1, c.z).project(kamera);
    c.el.style.display = v3.z > 1 ? 'none' : '';
    c.el.style.left = (v3.x * 0.5 + 0.5) * innerWidth + 'px';
    c.el.style.top = (-v3.y * 0.5 + 0.5) * innerHeight + 'px';
    c.el.style.opacity = c.t < 0.6 ? 1 : 1 - (c.t - 0.6) / 0.3;
  }
  trail.aktualizuj(dt, hracRef);
}

// ---------- stopa za cepelou (ribbon, aditivny, mizne) ----------
function vytvorStopu(scena) {
  const N = 14, ZIVOT = 0.2;
  const poz = new Float32Array(N * 6), far = new Float32Array(N * 6), idx = [];
  for (let i = 0; i < N - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(poz, 3));
  g.setAttribute('color', new THREE.BufferAttribute(far, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.frustumCulled = false; m.visible = false;
  scena.add(m);
  const hist = [], a = new THREE.Vector3(), b = new THREE.Vector3();
  return {
    aktualizuj(dt, hrac) {
      for (const s of hist) s.vek += dt;
      while (hist.length && hist[hist.length - 1].vek > ZIVOT) hist.pop();
      const ruka = hrac.ruka;
      if (hrac.stopaAktivna && ruka) {
        if (!ruka.geometry.boundingBox) ruka.geometry.computeBoundingBox();
        const bb = ruka.geometry.boundingBox, ym = (bb.min.y + bb.max.y) / 2, zm = (bb.min.z + bb.max.z) / 2;
        hrac.model.updateMatrixWorld(true);
        a.set(bb.min.x * 0.3, ym, zm); b.set(bb.min.x, ym, zm);        // hrot a stred cepele (hlava na -x)
        ruka.localToWorld(a); ruka.localToWorld(b);
        hist.unshift({ a: a.clone(), b: b.clone(), vek: 0 });
        if (hist.length > N) hist.pop();
      }
      m.visible = hist.length > 1;
      if (!m.visible) return;
      for (let i = 0; i < N; i++) {
        const s = hist[Math.min(i, hist.length - 1)], k = i < hist.length ? Math.max(0, 1 - s.vek / ZIVOT) * 0.9 : 0;
        poz.set([s.a.x, s.a.y, s.a.z, s.b.x, s.b.y, s.b.z], i * 6);
        far.set([0.35 * k, 0.45 * k, 0.55 * k, 0.8 * k, 0.9 * k, 1 * k], i * 6);
      }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    },
  };
}
