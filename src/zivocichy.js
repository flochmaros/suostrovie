// Zivocichy: kraby, ryby, delfiny, vtaky, motyle, korytnacka. Vsetko len v okoli hraca (spawn/despawn podla vzdialenosti).
// Modely su procedurálne (low-poly, vertex farby), animacie jednoduche, bez fyziky.
import * as THREE from 'three';
import { vyskaTerenu, ostrovPri } from './svet.js';
import { vyskaVody, priliv } from './ocean.js';
import { rng, hash } from './nahoda.js';
import './obsah/zivocichy.js';

// Callbacky, ktore moze nastavit main.js (castice / zvuk). Vsetky mozu byt null.
export const udalosti = { priSplachu: null };   // priSplachu(x, y, z, sila)
const splash = (x, y, z, s) => { if (udalosti.priSplachu) udalosti.priSplachu(x, y, z, s); };

const R = rng(hash(7, 11, 2026));               // vlastny prud nahodnych cisel
const rnd = (a, b) => a + (b - a) * R();

// ---------- pomocnici na geometriu: farby vo vrcholoch + spojenie do jednej siete ----------
function farba(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return g;
}
function spoj(gs) {
  const out = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'color']) {
    const n = gs.reduce((s, g) => s + g.attributes[k].array.length, 0), a = new Float32Array(n);
    let o = 0;
    for (const g of gs) { a.set(g.attributes[k].array, o); o += g.attributes[k].array.length; }
    out.setAttribute(k, new THREE.BufferAttribute(a, 3));
  }
  return out;
}
const M = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, ...o });
const matZ = M(), matZ2 = M({ side: THREE.DoubleSide });
const sf = (r, ws = 8, hs = 6) => new THREE.SphereGeometry(r, ws, hs);
const kuzel = (r, h, ws = 5) => new THREE.ConeGeometry(r, h, ws);

// ---------- modely (nos / predok smeruje do +z) ----------
const geoKrabTelo = spoj([
  farba(sf(0.18).scale(1, 0.5, 0.75).translate(0, 0.1, 0), 0xd9532b),
  farba(sf(0.07, 6, 5).translate(-0.24, 0.11, 0.2), 0xe8683a), farba(sf(0.07, 6, 5).translate(0.24, 0.11, 0.2), 0xe8683a),
  farba(sf(0.03, 5, 4).translate(-0.06, 0.22, 0.12), 0x111111), farba(sf(0.03, 5, 4).translate(0.06, 0.22, 0.12), 0x111111),
]);
function nohyKraba(zn) {
  const a = [];
  for (let i = 0; i < 3; i++) {
    a.push(farba(new THREE.BoxGeometry(0.22, 0.025, 0.025).rotateZ(zn * -0.4).translate(zn * 0.27, 0.07, -0.08 + i * 0.07), 0xb8401f));
  }
  return spoj(a);
}
const geoKrabL = nohyKraba(-1), geoKrabP = nohyKraba(1);

const geoRyba = spoj([
  farba(sf(0.5).scale(0.22, 0.32, 1.0), 0xffffff),
  farba(kuzel(0.25, 0.4).rotateX(Math.PI / 2).scale(0.15, 1, 1).translate(0, 0, -0.55), 0xdddddd),
  farba(kuzel(0.1, 0.25, 4).scale(0.3, 1, 1).translate(0, 0.28, 0.05), 0xdddddd),
]);
const geoDelfin = spoj([
  farba(sf(0.5, 10, 8).scale(0.4, 0.4, 1.7), 0x5b7186),
  farba(sf(0.4, 8, 6).scale(0.8, 0.5, 1.5).translate(0, -0.12, 0.05), 0xd2dce3),
  farba(kuzel(0.07, 0.4).rotateX(Math.PI / 2).translate(0, -0.03, 0.95), 0x5b7186),
  farba(kuzel(0.25, 0.35).rotateX(Math.PI / 2).scale(1.9, 0.2, 1).translate(0, 0, -0.95), 0x4c6073),
  farba(kuzel(0.12, 0.35, 4).scale(0.5, 1, 1).translate(0, 0.42, -0.05), 0x4c6073),
]);
const geoKorytnacka = spoj([
  farba(sf(0.5, 9, 6).scale(1, 0.45, 1.2).translate(0, 0.22, 0), 0x5f6f3a),
  farba(sf(0.5, 8, 5).scale(0.85, 0.2, 1.0).translate(0, 0.12, 0), 0xcdbf8a),
  farba(sf(0.12, 6, 5).translate(0, 0.2, 0.72), 0x8f9a5a),
  farba(sf(0.3, 6, 4).scale(1.4, 0.14, 0.5).translate(-0.6, 0.15, 0.3), 0x8f9a5a),
  farba(sf(0.3, 6, 4).scale(1.4, 0.14, 0.5).translate(0.6, 0.15, 0.3), 0x8f9a5a),
  farba(sf(0.2, 6, 4).scale(1.2, 0.14, 0.5).translate(-0.4, 0.15, -0.55), 0x8f9a5a),
  farba(sf(0.2, 6, 4).scale(1.2, 0.14, 0.5).translate(0.4, 0.15, -0.55), 0x8f9a5a),
]);
function geoKridlo(zakl, hrot, L = 0.9, S = 0.3) {   // jedno (prave) krídlo, koren v x = 0, kvôli vrcholovým farbám bez indexu
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, 0, S * 0.5, 0, 0, -S * 0.5, L, 0, -S * 0.1,
    0, 0, S * 0.5, L, 0, -S * 0.1, L * 0.95, 0, S * 0.15]), 3));
  g.computeVertexNormals();
  const c = new THREE.Color(zakl), t = new THREE.Color(hrot), a = [];
  for (const k of [0, 0, 1, 0, 1, 1]) a.push(...(k ? t : c).toArray());
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(a), 3));
  return g;
}
function vtak(telo, kridlo, hrot, mierka, chvost) {
  const g = new THREE.Group(), pivot = new THREE.Group();
  g.add(new THREE.Mesh(spoj([
    farba(sf(0.12, 7, 5).scale(0.8, 0.8, 1.7), telo), farba(sf(0.07, 6, 5).translate(0, 0.04, 0.2), telo),
    farba(kuzel(0.025, 0.07, 4).rotateX(Math.PI / 2).translate(0, 0.03, 0.29), 0xe8a020),
    farba(kuzel(0.05, chvost, 4).rotateX(-Math.PI / 2).scale(1.4, 0.3, 1).translate(0, 0, -0.2 - chvost / 2), kridlo)]), matZ));
  const gk = geoKridlo(kridlo, hrot);
  const kp = new THREE.Mesh(gk, matZ2), kl = new THREE.Mesh(gk, matZ2);
  kl.scale.x = -1;
  pivot.add(kp, kl); pivot.position.y = 0.05;
  g.add(pivot); g.scale.setScalar(mierka);
  g.rotation.order = 'YXZ';
  g.userData = { kp, kl };
  return g;
}

let skupina = null;
const tmp = new THREE.Object3D();

// ---------- stav ----------
const kraby = [], schody = [], jumpery = [], vtaky = [], papagaje = [], motyle = [];
let ryby = null, motylMesh = null, korytnacka = null, casSpawn = 0, hrZ = 0, vidMevy = false;
const MAX_KRAB = 14, MAX_SKOLA = 4, V_SKOLE = 9, MAX_MOTYL = 22;

export function initZivocichy(scena) {
  skupina = new THREE.Group();
  skupina.name = 'zivocichy';
  scena.add(skupina);
  // ryby: jeden InstancedMesh pre vsetky skoly
  ryby = new THREE.InstancedMesh(geoRyba, M({ roughness: 0.4 }), MAX_SKOLA * V_SKOLE);
  ryby.count = 0; ryby.frustumCulled = false;
  ryby.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SKOLA * V_SKOLE * 3).fill(1), 3);
  skupina.add(ryby);
  // motyle: plochy motyl v rovine XZ, trepot cez scale.x
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, 0, 0, 0.09, 0, 0.07, 0.09, 0, -0.05, 0, 0, 0, -0.09, 0, -0.05, -0.09, 0, 0.07]), 3));
  mg.computeVertexNormals();
  motylMesh = new THREE.InstancedMesh(mg, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7 }), MAX_MOTYL);
  motylMesh.count = 0; motylMesh.frustumCulled = false;
  const fm = [0xf2a33a, 0xf2ee5a, 0xe85aa0, 0x6aa8f0, 0xffffff, 0xb07be0];
  for (let i = 0; i < MAX_MOTYL; i++) motylMesh.setColorAt(i, new THREE.Color(fm[i % fm.length]));
  skupina.add(motylMesh);
  // mevy
  for (let i = 0; i < 7; i++) {
    const g = vtak(0xf4f4f0, 0xe6e8ea, 0x45484d, 1.5, 0.2);
    g.visible = false;
    g.userData.o = { r: rnd(14, 34), alt: rnd(13, 26), w: rnd(0.18, 0.34) * (i % 2 ? 1 : -1), a: rnd(0, 6.28), ph: rnd(0, 6.28), cx: 0, cz: 0, kanoe: i < 4, init: false };
    skupina.add(g); vtaky.push(g);
  }
  // papagaje
  for (let i = 0; i < 3; i++) {
    const g = vtak(i % 2 ? 0xd8362a : 0x2f9e44, i % 2 ? 0x2a5fd0 : 0xf0c020, 0xd8362a, 1.4, 0.45);
    g.visible = false; g.userData.o = { akt: false };
    skupina.add(g); papagaje.push(g);
  }
  // skokani: 3 velke ryby + delfin
  for (let i = 0; i < 4; i++) {
    const del = i === 3, m = new THREE.Mesh(del ? geoDelfin : geoRyba, M({ roughness: 0.35 }));
    m.rotation.order = 'YXZ'; m.visible = false; m.frustumCulled = false;
    m.scale.setScalar(del ? 1.3 : 0.7);
    m.userData.j = { akt: false, delfin: del };
    skupina.add(m); jumpery.push(m);
  }
}

// ---------- pomocne ----------
const hlbka = (x, z, cas) => vyskaVody(x, z, cas) - vyskaTerenu(x, z);
const dist2 = (ax, az, bx, bz) => (ax - bx) ** 2 + (az - bz) ** 2;

// ---------- kraby ----------
function novyKrab(x, z) {
  const g = new THREE.Group();
  const l = new THREE.Mesh(geoKrabL, matZ), p = new THREE.Mesh(geoKrabP, matZ);
  g.add(new THREE.Mesh(geoKrabTelo, matZ), l, p);
  g.scale.setScalar(rnd(0.8, 1.25));
  g.position.set(x, vyskaTerenu(x, z), z);
  skupina.add(g);
  kraby.push({ g, l, p, x, z, hd: rnd(0, 6.28), stav: 'stoj', t: rnd(0.5, 2), ph: rnd(0, 6), pad: 0, mrtvy: false, s0: g.scale.x });
}
function zrusKraba(i) { skupina.remove(kraby[i].g); kraby.splice(i, 1); }

function aktKraby(dt, cas, hx, hz) {
  const pr = priliv(cas);
  casSpawn -= dt;
  if (kraby.length < MAX_KRAB && casSpawn <= 0) {
    casSpawn = 0.25;
    for (let t = 0; t < 3; t++) {
      const a = rnd(0, 6.283), d = rnd(9, 42), x = hx + Math.cos(a) * d, z = hz + Math.sin(a) * d;
      if (!ostrovPri(x, z, 1.35)) continue;
      const h = vyskaTerenu(x, z);
      if (h > pr + 0.2 && h < pr + 1.1) { novyKrab(x, z); break; }
    }
  }
  for (let i = kraby.length - 1; i >= 0; i--) {
    const k = kraby[i], d2 = dist2(k.x, k.z, hx, hz);
    if (d2 > 3600) { zrusKraba(i); continue; }
    if (k.mrtvy) {                                   // potapa sa v mori
      k.pad += dt * 2.2; k.g.position.y -= dt * 0.35;
      k.g.scale.setScalar(Math.max(0.01, k.s0 * (1 - k.pad)));
      if (k.pad >= 1) zrusKraba(i);
      continue;
    }
    let dx = 0, dz = 0, rychlost = 0;
    if (d2 < 11) {                                   // utek pred hracom (smerom od neho)
      k.stav = 'utek';
      const d = Math.sqrt(d2) || 1;
      dx = (k.x - hx) / d; dz = (k.z - hz) / d; rychlost = 2.4;
    } else {
      if (k.stav === 'utek') k.stav = 'stoj';
      k.t -= dt;
      if (k.t <= 0) {
        if (k.stav === 'stoj') { k.stav = 'chod'; k.t = rnd(0.8, 2.4); k.hd += rnd(-1.2, 1.2); }
        else { k.stav = 'stoj'; k.t = rnd(1, 3.5); }
      }
      if (k.stav === 'chod') { dx = Math.cos(k.hd); dz = Math.sin(k.hd); rychlost = 0.55; }
    }
    if (rychlost > 0) {
      const nx = k.x + dx * rychlost * dt, nz = k.z + dz * rychlost * dt, nh = vyskaTerenu(nx, nz);
      if (k.stav !== 'utek' && (nh < pr + 0.12 || nh > pr + 2.2 || !ostrovPri(nx, nz, 1.4))) k.hd += Math.PI * 0.7;
      else { k.x = nx; k.z = nz; }
      k.ph += dt * rychlost * 14;
      k.g.rotation.y = Math.atan2(-dz, dx);          // krab ide bokom: lokalna os x = smer pohybu
      k.l.rotation.z = Math.sin(k.ph) * 0.35; k.p.rotation.z = -Math.sin(k.ph + 1.5) * 0.35;
    }
    const h = vyskaTerenu(k.x, k.z);
    k.g.position.set(k.x, h, k.z);
    if (h < pr - 0.05 && k.stav === 'utek') { k.mrtvy = true; splash(k.x, pr, k.z, 0.3); }
  }
}

// ---------- ryby (skoly) a skokani ----------
function novaSkola(x, z) {
  const s = { x, z, hd: rnd(0, 6.28), ryby: [], farba: new THREE.Color().setHSL(rnd(0.05, 0.62), 0.7, 0.58) };
  for (let i = 0; i < V_SKOLE; i++) s.ryby.push({ ox: rnd(-1.4, 1.4), oz: rnd(-1.4, 1.4), oy: R(), ph: rnd(0, 6.28), sc: rnd(0.2, 0.34) });
  schody.push(s);
}
function aktRyby(dt, cas, hx, hz, kx, kz) {
  if (schody.length < MAX_SKOLA && R() < dt * 1.5) {
    const a = rnd(0, 6.283), d = rnd(10, 45), x = hx + Math.cos(a) * d, z = hz + Math.sin(a) * d;
    if (ostrovPri(x, z, 1.9)) { const dh = hlbka(x, z, cas); if (dh > 1.2 && dh < 5.5) novaSkola(x, z); }
  }
  let n = 0;
  for (let i = schody.length - 1; i >= 0; i--) {
    const s = schody[i];
    if (dist2(s.x, s.z, hx, hz) > 4900) { schody.splice(i, 1); continue; }
    let rychl = 0.9, ciel = null;
    if (dist2(s.x, s.z, hx, hz) < 36) ciel = Math.atan2(s.z - hz, s.x - hx);         // plasi sa hraca
    else if (dist2(s.x, s.z, kx, kz) < 64) ciel = Math.atan2(s.z - kz, s.x - kx);    // aj kanoe
    if (ciel !== null) { rychl = 4.2; let r = ciel - s.hd; r = Math.atan2(Math.sin(r), Math.cos(r)); s.hd += r * Math.min(1, dt * 6); }
    else s.hd += Math.sin(cas * 0.4 + i * 2.1) * dt * 0.5;
    // pozri dopredu: voda hlbsia ako ~0.9 m a plytsia ako 8 m
    const probe = a => { const d = hlbka(s.x + Math.cos(a) * 4, s.z + Math.sin(a) * 4, cas); return d > 0.9 && d < 8; };
    if (!probe(s.hd)) { for (const o of [0.7, -0.7, 1.4, -1.4, 2.2, -2.2, 3.1]) if (probe(s.hd + o)) { s.hd += o * Math.min(1, dt * 3); break; } }
    s.x += Math.cos(s.hd) * rychl * dt; s.z += Math.sin(s.hd) * rychl * dt;
    const dno = hlbka(s.x, s.z, cas), wl = vyskaVody(s.x, s.z, cas);
    if (dno < 0.5) s.hd += Math.PI * dt * 2;
    const c = Math.cos(s.hd), sn = Math.sin(s.hd), maxD = Math.max(0, dno - 0.5);
    for (const f of s.ryby) {
      const wx = f.ox + Math.sin(cas * 0.9 + f.ph) * 0.4, wz = f.oz + Math.cos(cas * 0.7 + f.ph) * 0.4;
      tmp.position.set(s.x + wx * sn + wz * c, wl - 0.35 - Math.min(f.oy * 1.4, maxD * 0.8), s.z - wx * c + wz * sn);
      tmp.rotation.set(0, Math.atan2(c, sn) + Math.sin(cas * (rychl > 2 ? 14 : 6) + f.ph) * 0.18, 0);
      tmp.scale.setScalar(f.sc);
      tmp.updateMatrix();
      ryby.setMatrixAt(n, tmp.matrix); ryby.setColorAt(n, s.farba); n++;
    }
  }
  ryby.count = n;
  ryby.instanceMatrix.needsUpdate = true;
  if (ryby.instanceColor) ryby.instanceColor.needsUpdate = true;
}

function spustiSkok(m, x, z, dx, dz) {
  const j = m.userData.j;
  Object.assign(j, { akt: true, t: 0, sx: x, sz: z, dx, dz, s1: false, s2: false });
  j.T = j.delfin ? 1.5 : 0.9; j.L = j.delfin ? 9 : 3.2; j.H = j.delfin ? rnd(2.2, 3.2) : rnd(0.8, 1.4);
  m.visible = true;
}
let casSkok = 6, casDelfin = 20;
function aktSkokani(dt, cas, hx, hz, kx, kz, vKanoe) {
  casSkok -= dt; casDelfin -= dt;
  const fm = jumpery.find(m => !m.userData.j.delfin && !m.userData.j.akt), dm = jumpery[3];
  if (casSkok <= 0 && fm) {
    casSkok = rnd(6, 14);
    const a = rnd(0, 6.283), d = rnd(9, 30), x = hx + Math.cos(a) * d, z = hz + Math.sin(a) * d;
    if (hlbka(x, z, cas) > 3.5) { const b = rnd(0, 6.28); spustiSkok(fm, x, z, Math.cos(b), Math.sin(b)); }
  }
  if (casDelfin <= 0 && vKanoe && !dm.userData.j.akt) {
    casDelfin = rnd(25, 50);
    const a = rnd(0, 6.283), d = rnd(16, 32), x = kx + Math.cos(a) * d, z = kz + Math.sin(a) * d;
    if (hlbka(x, z, cas) > 7) { const b = a + Math.PI / 2 + rnd(-0.5, 0.5); spustiSkok(dm, x, z, Math.cos(b), Math.sin(b)); }
  }
  for (const m of jumpery) {
    const j = m.userData.j; if (!j.akt) continue;
    j.t += dt; const s = j.t / j.T;
    if (s >= 1) { j.akt = false; m.visible = false; continue; }
    const x = j.sx + j.dx * j.L * s, z = j.sz + j.dz * j.L * s, wl = vyskaVody(x, z, cas);
    const y = j.H * (1 - (2 * s - 1) ** 2) - 0.35;      // parabola, na koncoch tesne pod hladinou
    m.position.set(x, wl + y, z);
    m.rotation.set(-Math.atan(4 * j.H * (1 - 2 * s) / j.L), Math.atan2(j.dx, j.dz), 0);
    if (!j.s1 && y > -0.1) { j.s1 = true; splash(x, wl, z, j.delfin ? 1.2 : 0.7); }
    if (!j.s2 && s > 0.5 && y < -0.1) { j.s2 = true; splash(x, wl, z, j.delfin ? 1.2 : 0.7); }
  }
}

// ---------- vtaky ----------
function aktMevy(dt, cas, hx, hz, kx, kz, vKanoe) {
  if (cas - hrZ > 1) {                               // raz za sekundu: je blizko ostrov?
    hrZ = cas;
    vidMevy = !!ostrovPri(vKanoe ? kx : hx, vKanoe ? kz : hz, 2.6);
  }
  for (const g of vtaky) {
    g.visible = vidMevy; if (!vidMevy) continue;
    const o = g.userData.o, ax = o.kanoe && vKanoe ? kx : hx, az = o.kanoe && vKanoe ? kz : hz;
    if (!o.init) { o.cx = ax; o.cz = az; o.init = true; }
    o.cx += (ax - o.cx) * Math.min(1, dt * 0.4); o.cz += (az - o.cz) * Math.min(1, dt * 0.4);
    o.a += o.w * dt;
    const sg = Math.sign(o.w);
    g.position.set(o.cx + Math.cos(o.a) * o.r, o.alt + Math.sin(cas * 0.5 + o.ph) * 1.5, o.cz + Math.sin(o.a) * o.r);
    g.rotation.y = Math.atan2(-Math.sin(o.a) * sg, Math.cos(o.a) * sg);   // smer letu = dotycnica kruhu
    g.rotation.z = -sg * 0.35;                                             // naklon v zakrute
    const mach = 0.5 + 0.5 * Math.sin(cas * 0.35 + o.ph);                  // striedanie plachtenia a mavania
    const f = Math.sin(cas * 7 + o.ph) * 0.5 * mach + 0.12;
    g.userData.kp.rotation.z = f; g.userData.kl.rotation.z = -f;
  }
}
let casPap = 6;
function aktPapagaje(dt, cas, hx, hz) {
  casPap -= dt;
  if (casPap <= 0) {
    casPap = rnd(14, 30);
    const o = ostrovPri(hx, hz, 1.3), g = papagaje.find(p => !p.userData.o.akt);
    if (o && o.biom !== 'skalnaty' && g) {
      const a = rnd(0, 6.283), sx = hx + Math.cos(a) * 55, sz = hz + Math.sin(a) * 55, b = a + Math.PI + rnd(-0.5, 0.5);
      Object.assign(g.userData.o, { akt: true, t: 0, dx: Math.cos(b), dz: Math.sin(b), ph: rnd(0, 6), y: vyskaTerenu(sx, sz) + 10 });
      g.position.set(sx, g.userData.o.y, sz); g.visible = true;
    }
  }
  for (const g of papagaje) {
    const o = g.userData.o; if (!o.akt) continue;
    o.t += dt;
    g.position.x += o.dx * 9 * dt; g.position.z += o.dz * 9 * dt;
    const ty = Math.max(10, vyskaTerenu(g.position.x, g.position.z) + 8);   // leti nad korunami
    o.y += (ty - o.y) * Math.min(1, dt * 0.8);
    g.position.y = o.y + Math.sin(cas * 2 + o.ph) * 0.4;
    g.rotation.y = Math.atan2(o.dx, o.dz);
    g.rotation.z = Math.sin(cas * 1.3 + o.ph) * 0.1;
    const f = Math.sin(cas * 16 + o.ph) * 0.7;
    g.userData.kp.rotation.z = f; g.userData.kl.rotation.z = -f;
    if (o.t > 16 || dist2(g.position.x, g.position.z, hx, hz) > 12000) { o.akt = false; g.visible = false; }
  }
}

// ---------- motyle ----------
function aktMotyle(dt, cas, hx, hz) {
  const pr = priliv(cas);
  if (motyle.length < MAX_MOTYL) {
    for (let t = 0; t < 2; t++) {
      const a = rnd(0, 6.283), d = rnd(4, 22), x = hx + Math.cos(a) * d, z = hz + Math.sin(a) * d, o = ostrovPri(x, z, 0.85);
      if (o && o.biom !== 'skalnaty' && vyskaTerenu(x, z) > pr + 1.2) motyle.push({ x, z, hd: rnd(0, 6.28), ph: rnd(0, 6.28), v: rnd(0.7, 1.4), vy: rnd(0.5, 1.6) });
    }
  }
  for (let i = motyle.length - 1; i >= 0; i--) {
    const m = motyle[i];
    if (dist2(m.x, m.z, hx, hz) > 700) { motyle.splice(i, 1); continue; }
    m.hd += Math.sin(cas * 2.3 + m.ph) * 2.2 * dt;
    const nx = m.x + Math.cos(m.hd) * m.v * dt, nz = m.z + Math.sin(m.hd) * m.v * dt;
    if (vyskaTerenu(nx, nz) < pr + 1.0) m.hd += Math.PI * 0.6; else { m.x = nx; m.z = nz; }
  }
  let n = 0;
  for (const m of motyle) {
    tmp.position.set(m.x, vyskaTerenu(m.x, m.z) + m.vy + Math.sin(cas * 2.1 + m.ph) * 0.3, m.z);
    tmp.rotation.set(Math.sin(cas * 1.7 + m.ph) * 0.3, -m.hd, 0);
    tmp.scale.set(0.25 + 0.85 * Math.abs(Math.cos(cas * 17 + m.ph)), 1, 1);   // trepot kridel
    tmp.updateMatrix(); motylMesh.setMatrixAt(n++, tmp.matrix);
  }
  motylMesh.count = n; motylMesh.instanceMatrix.needsUpdate = true;
}

// ---------- korytnacka ----------
let casKor = 8;
function aktKorytnacku(dt, cas, hx, hz) {
  const pr = priliv(cas);
  casKor -= dt;
  if (!korytnacka && casKor <= 0) {
    casKor = rnd(20, 40);
    const a = rnd(0, 6.283), d = rnd(14, 40), x = hx + Math.cos(a) * d, z = hz + Math.sin(a) * d;
    const h = ostrovPri(x, z, 1.35) ? vyskaTerenu(x, z) : -9;
    if (h > pr + 0.3 && h < pr + 1.0) {
      let best = 0, bh = 1e9;                         // smer k moru = klesajuci teren
      for (let k = 0; k < 16; k++) { const b = k * Math.PI / 8, hh = vyskaTerenu(x + Math.cos(b) * 8, z + Math.sin(b) * 8); if (hh < bh) { bh = hh; best = b; } }
      const g = new THREE.Mesh(geoKorytnacka, matZ);
      g.scale.setScalar(rnd(0.7, 1.0)); g.rotation.order = 'YXZ'; skupina.add(g);
      korytnacka = { g, x, z, hd: best, t: 0 };
    }
  }
  const k = korytnacka; if (!k) return;
  const vode = vyskaTerenu(k.x, k.z) < pr - 0.1, v = vode ? 0.9 : 0.35;
  k.x += Math.cos(k.hd) * v * dt; k.z += Math.sin(k.hd) * v * dt; k.t += dt;
  const nh = vyskaTerenu(k.x, k.z), wl = vyskaVody(k.x, k.z, cas);
  k.g.position.set(k.x, vode ? Math.max(nh + 0.1, wl - 0.28) : nh, k.z);
  k.g.rotation.y = Math.atan2(Math.cos(k.hd), Math.sin(k.hd));
  k.g.rotation.z = Math.sin(k.t * (vode ? 3 : 2.2)) * 0.08;
  if ((vode && k.t > 8 && nh < pr - 1.2) || dist2(k.x, k.z, hx, hz) > 6400) { skupina.remove(k.g); korytnacka = null; }
}

// ---------- hlavna aktualizacia ----------
export function aktualizujZivocichy(dt, cas, hracPoz, kanoePoz, vKanoe) {
  if (!skupina) return;
  dt = Math.min(dt, 0.1);
  const hx = hracPoz.x, hz = hracPoz.z, kx = kanoePoz.x, kz = kanoePoz.y;
  aktKraby(dt, cas, hx, hz);
  aktRyby(dt, cas, hx, hz, kx, kz);
  aktSkokani(dt, cas, hx, hz, kx, kz, vKanoe);
  aktMevy(dt, cas, hx, hz, kx, kz, vKanoe);
  aktPapagaje(dt, cas, hx, hz);
  aktMotyle(dt, cas, hx, hz);
  aktKorytnacku(dt, cas, hx, hz);
}

// Interakcia klavesou E: najblizsi chytitelny zivocich do 1.8 m od (x, z)
export function najdiUlovok(x, z) {
  let best = -1, bd = 1.8 * 1.8;
  for (let i = 0; i < kraby.length; i++) {
    if (kraby[i].mrtvy) continue;
    const d = dist2(kraby[i].x, kraby[i].z, x, z);
    if (d < bd) { bd = d; best = i; }
  }
  if (best < 0) return null;
  const k = kraby[best];
  return { text: 'Chytiť kraba', x: k.x, z: k.z, akcia: () => { const i = kraby.indexOf(k); if (i >= 0) zrusKraba(i); return [['krab', 1]]; } };
}
