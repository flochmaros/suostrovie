// Nepriatelia: jednoduchy boj. Kazdy ma stavy tula -> honi -> napriah (viditelny telegraf) -> utok -> oddych, pri nizkom zdraví utek.
// Spawn len okolo hraca (nahodne), despawn ked su daleko; strop poctu. Data v obsah/nepriatelia.js.
import * as THREE from 'three';
import { NEPRIATELIA } from './obsah/nepriatelia.js';
import { vyskaTerenu, ostrovPri, pasmo, polozPredmet } from './svet.js';
import { zran, stav as stavPreziti } from './preziti.js';
import { vytvorCastice } from './castice.js';
import { zvuky } from './zvuk.js';

export const udalosti = { priZabiti: null, priFaze: null };       // priZabiti(id, def); priFaze(e, def) = boss zbesnel (50 % zivotov)
const MAX_SPOLU = 8, DESPAWN = 80, MIN_VZD = 15, MAX_VZD = 42, VODA = 0.25;
const nepr = [];
let skupina, castice, casSpawn = 2, nezranitelny = 0, uhol = 0;
const kHrac = { x: 0, z: 0 };                      // odhodenie hraca (m/s)
const rnd = (a, b) => a + Math.random() * (b - a);
const mM = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); k.position.set(x, y, z); k.castShadow = true; return k; };
const gul = (r, sx, sy, sz, m) => { const k = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8).scale(sx, sy, sz), m); k.castShadow = true; return k; };
const pivot = (x, y, z, ...deti) => { const p = new THREE.Group(); p.position.set(x, y, z); p.add(...deti); return p; };

// ---------- modely (predok smeruje na +Z) ----------
function modelKrab() {
  const g = new THREE.Group(), telo = mM(0x4a3f86), svetle = mM(0x8a7fd0), oko = mM(0x111111, { emissive: 0xffe066, emissiveIntensity: 1.5 });
  const trup = gul(0.3, 1, 0.5, 0.8, telo); trup.position.y = 0.22; g.add(trup);
  for (const s of [-1, 1]) g.add(pivot(s * 0.12, 0.38, 0.2, box(0.03, 0.12, 0.03, svetle, 0, 0.06, 0), gul(0.04, 1, 1, 1, oko)));
  const klieste = [], nohy = [];
  for (const s of [-1, 1]) {
    const k = gul(0.13, 0.8, 0.6, 1.1, svetle); k.position.set(0, 0, 0.3);
    const rameno = pivot(s * 0.3, 0.24, 0.12, box(0.05, 0.05, 0.3, telo, 0, 0, 0.14), k);
    rameno.rotation.y = -s * 0.35; g.add(rameno); klieste.push(rameno);
    for (let i = 0; i < 3; i++) {
      const n = pivot(s * 0.22, 0.2, -0.12 + i * 0.12, box(0.3, 0.035, 0.035, telo, s * 0.15, 0, 0));
      n.rotation.z = -s * 0.35; g.add(n); nohy.push({ n, s, i });
    }
  }
  return { g, tela: [telo, svetle], trup, nohy, klieste };
}
function modelJaster() {
  const g = new THREE.Group(), telo = mM(0x4a2820), brucho = mM(0x6b3a2a), oko = mM(0x111111, { emissive: 0xffaa22, emissiveIntensity: 2 });
  const pruh = mM(0x2a1008, { emissive: 0xff5a10, emissiveIntensity: 2.2, roughness: 0.4 });   // ziariace pruhy (bloom)
  const trup = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.9, 4, 10).rotateX(Math.PI / 2).scale(1, 0.75, 1), telo);
  trup.position.y = 0.55; trup.castShadow = true; g.add(trup);
  for (let i = 0; i < 5; i++) g.add(box(0.5 - Math.abs(i - 2) * 0.05, 0.05, 0.09, pruh, 0, 0.55 + 0.2 - Math.abs(i - 2) * 0.012, -0.5 + i * 0.28));
  const hlava = pivot(0, 0.62, 0.75, box(0.36, 0.24, 0.5, telo, 0, 0, 0.22), box(0.3, 0.08, 0.4, brucho, 0, -0.1, 0.2),
    box(0.06, 0.06, 0.06, oko, -0.14, 0.1, 0.3), box(0.06, 0.06, 0.06, oko, 0.14, 0.1, 0.3), box(0.2, 0.05, 0.05, pruh, 0, 0.13, 0.1));
  g.add(hlava);
  const chvost = pivot(0, 0.55, -0.85, box(0.34, 0.26, 0.6, telo, 0, 0, -0.25), box(0.4, 0.04, 0.1, pruh, 0, 0.15, -0.25));
  const koniec = pivot(0, 0, -0.55, box(0.2, 0.16, 0.6, telo, 0, 0, -0.3), box(0.25, 0.04, 0.1, pruh, 0, 0.1, -0.3));
  chvost.add(koniec); g.add(chvost);
  const nohy = [];
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const n = pivot(x * 0.34, 0.45, z * 0.45, box(0.14, 0.45, 0.14, telo, x * 0.05, -0.22, 0));
    g.add(n); nohy.push({ n, s: x, i: z });
  }
  return { g, tela: [telo, brucho], trup, hlava, chvost, koniec, pruh, nohy };
}
function modelObrovskyKrab() {            // ten isty krab, len iny odtien (skala sa nastavi podla def.scale)
  const m = modelKrab();
  const telo = mM(0x8a3a2a), svetle = mM(0xd4683a);
  m.g.traverse(k => { if (k.isMesh) k.material = k.material === m.tela[0] ? telo : k.material === m.tela[1] ? svetle : k.material; });
  m.tela = [telo, svetle];
  return m;
}
const MODELY = { nocny_krab: modelKrab, lavovy_jaster: modelJaster, obrovsky_krab: modelObrovskyKrab };

// ---------- HP pruh nad nepriatelom ----------
function pruhZdravia(e) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 10;
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(...(e.def.boss ? [0.001, 0.001] : e.def.bar)); s.position.y = e.def.vyska; s.visible = false;
  e.bar = { s, c, tex };
  e.g.add(s);
}
function vykresliBar(e) {
  const { c, tex } = e.bar, g = c.getContext('2d'), f = Math.max(0, e.hp / e.def.zdravie);
  g.clearRect(0, 0, 64, 10);
  g.fillStyle = 'rgba(20,10,10,.8)'; g.fillRect(0, 0, 64, 10);
  g.fillStyle = f > 0.5 ? '#6fd36b' : f > 0.25 ? '#e8c03a' : '#e0453a'; g.fillRect(2, 2, 60 * f, 6);
  tex.needsUpdate = true;
}

// ---------- vytvorenie ----------
export function initNepriatelia(scena) {
  skupina = new THREE.Group(); skupina.name = 'nepriatelia'; scena.add(skupina);
  castice = vytvorCastice(scena, { pocet: 300, velkost: 0.2 });
}
export function spawnNepriatela(druh, x, z) {
  const def = NEPRIATELIA[druh]; if (!def || !skupina) return null;
  const e = { id: druh, def, ...MODELY[druh](), x, z, hd: rnd(0, 6.28), hp: def.zdravie, stav: 'tula', t: rnd(0.5, 2), ph: rnd(0, 6), v: 0,
    kx: 0, kz: 0, blik: 0, barT: 0, utek: false, mrtvy: false, smrt: 0, rychl: 0,
    sc: def.scale || 1, krab: druh.endsWith('krab'), typ: 'klepeto', napT: def.napriah, faza2: false };
  e.g.position.set(x, vyskaTerenu(x, z), z); e.g.scale.setScalar(e.sc); skupina.add(e.g);
  if (def.dupot) {                                   // cerveny kruh na zemi: telegraf dupotu (zobrazi sa pocas napriahnutia)
    const r = def.dupot.dosah / e.sc;
    e.kruh = new THREE.Mesh(new THREE.RingGeometry(r * 0.96, r, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    e.kruh.position.y = 0.08 / e.sc; e.g.add(e.kruh);
  }
  pruhZdravia(e); vykresliBar(e);
  nepr.push(e);
  return e;
}
// dev: spawn par metrov od hraca (na suchu)
export function spawnPriHracovi(druh, hracPoz) {
  uhol += 0.9;
  for (let d = 7; d >= 3; d -= 1) for (let k = 0; k < 8; k++) {
    const x = hracPoz.x + Math.cos(uhol + k * 0.8) * d, z = hracPoz.z + Math.sin(uhol + k * 0.8) * d;
    if (vyskaTerenu(x, z) > VODA + 0.1) return spawnNepriatela(druh, x, z);
  }
  return null;
}
export const zoznamNepriatelov = () => nepr;
export function odstranNepriatela(e) { const i = nepr.indexOf(e); if (i >= 0) { skupina.remove(e.g); nepr.splice(i, 1); } }

// ---------- pomocne ----------
const sucho = (x, z) => vyskaTerenu(x, z) > VODA;
function krok(e, dx, dz) {                           // posun po zemi; do vody nejde (skusi aspon kĺzať po osi)
  if (sucho(e.x + dx, e.z + dz)) { e.x += dx; e.z += dz; return true; }
  if (dx && sucho(e.x + dx, e.z)) { e.x += dx; return true; }
  if (dz && sucho(e.x, e.z + dz)) { e.z += dz; return true; }
  return false;
}
function pustCastice(x, y, z, hex, n, sila = 3) {
  for (let i = 0; i < n; i++) castice.vypust(x, y, z, (Math.random() - 0.5) * sila, 1 + Math.random() * sila, (Math.random() - 0.5) * sila, hex, 0.6, 9);
}
function zabi(e) {
  e.mrtvy = true; e.smrt = 0; e.bar.s.visible = false; if (e.kruh) e.kruh.material.opacity = 0;
  zvuky.smrtNepr();
  pustCastice(e.x, e.g.position.y + 0.4, e.z, e.id === 'lavovy_jaster' ? 0xff7a2a : 0xa89cf0, e.def.boss ? 70 : 24, e.def.boss ? 7 : 4);
  for (const [id, min, max, sanca] of e.def.loot) {
    if (Math.random() > sanca) continue;
    const n = min + Math.floor(Math.random() * (max - min + 1));
    for (let i = 0; i < n; i++) polozPredmet(id, e.x + rnd(-0.7, 0.7), e.z + rnd(-0.7, 0.7));
  }
  udalosti.priZabiti?.(e.id, e.def);
}

// Zasah hraca: najblizsi nepriatel pred hracom (dosah, kuzel). Vrati nepriatela alebo null.
export function udriNepriatela(x, z, fx, fz, dmg, dosah = 2.3) {
  let naj = null, nd = dosah;
  for (const e of nepr) {
    if (e.mrtvy) continue;
    const dx = e.x - x, dz = e.z - z, l = Math.hypot(dx, dz) || 0.001, d = l - 0.3 - (e.def.polomer || 0);
    if (d > nd || (d > 0.4 && (dx * fx + dz * fz) / l < 0.45)) continue;
    nd = d; naj = e;
  }
  if (!naj) return null;
  const e = naj, dx = e.x - x, dz = e.z - z, l = Math.hypot(dx, dz) || 1;
  e.hp -= dmg; e.blik = 0.25; e.barT = 5; vykresliBar(e); e.bar.s.visible = true;
  const tz = e.def.boss ? 0.1 : 1; e.kx = dx / l * 6 * tz; e.kz = dz / l * 6 * tz;
  if (e.def.boss) { if (e.stav === 'tula') e.stav = 'honi'; }                        // boss sa nenecha prerusit
  else if (e.stav === 'napriah' || e.stav === 'utok') { e.stav = 'oddych'; e.t = 0.7; }     // zasah prerusi napriahnutie
  else if (e.stav !== 'utek') e.stav = 'honi';
  if (e.def.fazaHp && !e.faza2 && e.hp > 0 && e.hp <= e.def.zdravie * e.def.fazaHp) { e.faza2 = true; zvuky.napriah(); pustCastice(e.x, e.g.position.y + 1.5, e.z, 0xff5030, 40, 6); udalosti.priFaze?.(e, e.def); }
  pustCastice(e.x, e.g.position.y + 0.5, e.z, e.id === 'lavovy_jaster' ? 0xff9a3a : 0xc8c0ff, 10);
  zvuky.zasah();
  if (e.hp <= 0) zabi(e);
  else if (!e.utek && e.def.utek && e.hp <= e.def.zdravie * e.def.utek) { e.utek = true; e.stav = 'utek'; }
  return e;
}

// ---------- hlavna aktualizacia ----------
export function aktualizujNepriatelov(dt, cas, hrac, { pesi = true, noc = false } = {}) {
  if (!skupina) return;
  dt = Math.min(dt, 0.1);
  const hx = hrac.poz.x, hz = hrac.poz.z, zivy = !stavPreziti.mrtvy && pesi;
  castice.aktualizuj(dt);
  nezranitelny = Math.max(0, nezranitelny - dt);
  if (Math.hypot(kHrac.x, kHrac.z) > 0.2) {          // odhodenie hraca po zasahu (do vody ho neodhodi)
    const nx = hx + kHrac.x * dt, nz = hz + kHrac.z * dt;
    if (sucho(nx, nz)) { hrac.poz.x = nx; hrac.poz.z = nz; }
    const u = Math.exp(-7 * dt); kHrac.x *= u; kHrac.z *= u;
  }
  // spawn
  casSpawn -= dt;
  if (casSpawn <= 0 && nepr.length < MAX_SPOLU && pesi) {
    casSpawn = 1.2;
    const a = rnd(0, 6.283), d = rnd(MIN_VZD, MAX_VZD), x = hx + Math.cos(a) * d, z = hz + Math.sin(a) * d;
    const o = ostrovPri(x, z, 1.4), h = vyskaTerenu(x, z), p = pasmo(x, z);
    if (o && h > VODA + 0.1) {
      const vhodne = Object.keys(NEPRIATELIA).filter(k => {
        const f = NEPRIATELIA[k];
        return !f.boss && p >= f.pasmo && (!f.noc || noc) && (f.biom ? o.biom === f.biom && h > 0.8 : h < 2.2)
          && nepr.filter(e => e.id === k && !e.mrtvy).length < f.max;
      });
      if (vhodne.length) spawnNepriatela(vhodne[Math.floor(Math.random() * vhodne.length)], x, z);
    }
  }
  for (let i = nepr.length - 1; i >= 0; i--) {
    const e = nepr[i], def = e.def;
    const dx = hx - e.x, dz = hz - e.z, d = Math.hypot(dx, dz) || 0.001;
    if (e.mrtvy) {                                   // padne na bok a zmizne
      e.smrt += dt; const k = Math.min(e.smrt / 0.5, 1);
      e.g.rotation.z = k * 1.5; e.g.scale.setScalar(e.sc * (1 - Math.max(0, e.smrt - (def.boss ? 3 : 1.0))));
      if (e.smrt > (def.boss ? 4 : 2)) { skupina.remove(e.g); nepr.splice(i, 1); }
      continue;
    }
    if ((d > DESPAWN && !def.boss) || (def.noc && !noc && e.stav !== 'napriah' && d > 20) || (e.utek && d > 36)) { skupina.remove(e.g); nepr.splice(i, 1); continue; }
    const [vTula, , vBeh0] = def.rychlost, vBeh = vBeh0 * (e.faza2 ? 1.35 : 1);
    let ciel = 0, smer = e.hd;                       // ciel = rychlost, smer = kam
    e.t -= dt;
    const vidi = zivy && d < def.zbadaj;
    switch (e.stav) {
      case 'tula':
        if (vidi) { e.stav = 'honi'; break; }
        if (e.t <= 0) { e.t = rnd(1.5, 4); e.hd = rnd(0, 6.28); e.v = Math.random() < 0.4 ? 0 : vTula; }
        ciel = e.v; smer = e.hd; break;
      case 'honi':
        if (!zivy || d > def.zbadaj * 1.8) { e.stav = 'tula'; e.t = 1; break; }
        smer = Math.atan2(dx, dz); ciel = vBeh;
        if (def.dupot && d < def.dupot.dosah * 0.85 && (d < def.utok ? Math.random() < 0.3 : Math.random() < 0.5 * dt)) {   // boss: tlakovy dupot okolo seba
          e.typ = 'dupot'; e.stav = 'napriah'; e.napT = e.t = def.dupot.napriah * (e.faza2 ? 0.75 : 1); zvuky.napriah();
        } else if (d < def.utok) { e.typ = 'klepeto'; e.stav = 'napriah'; e.napT = e.t = def.napriah * (e.faza2 ? 0.75 : 1); zvuky.napriah(); }
        break;
      case 'napriah':                                // telegraf: stoji, otaca sa k hracovi (len na zaciatku), pripravuje sa
        if (e.typ !== 'dupot' && e.t > e.napT * 0.35) e.hd = angLerp(e.hd, Math.atan2(dx, dz), 10 * dt);
        smer = e.hd;
        if (e.t <= 0) {
          e.stav = 'utok'; e.t = 0.2; zvuky.utokNepr();
          const dup = e.typ === 'dupot' ? def.dupot : null, dosah = dup ? dup.dosah : def.utok + 0.5;
          if (dup) { pustCastice(e.x, e.g.position.y + 0.3, e.z, 0xd8c8a0, 60, 8); zvuky.pad(); e.otras = 0.5; }
          if (zivy && nezranitelny <= 0 && d < dosah && !(dup && hrac.poz.y > e.g.position.y + 1.6)) {       // kto sa pocas napriahnutia odtiahol (alebo na dupot vyskocil), uhol
            zran(dup ? dup.dmg : def.dmg, 'nepriatel');
            nezranitelny = 0.8;
            const kn = dup ? dup.knock : def.knock;
            kHrac.x = dx / d * kn; kHrac.z = dz / d * kn;
            pustCastice(hx, hrac.poz.y + 1.1, hz, 0xd04030, 8, 2.5);
          }
        }
        break;
      case 'utok': ciel = e.typ === 'dupot' ? 0 : vBeh * 1.6; smer = e.hd; if (e.t <= 0) { e.stav = 'oddych'; e.t = def.oddych; } break;
      case 'oddych': if (e.t <= 0) e.stav = zivy ? 'honi' : 'tula'; break;
      case 'utek': smer = Math.atan2(-dx, -dz); ciel = vBeh * 0.9; break;
    }
    if (ciel > 0) {
      if (e.stav !== 'napriah' && e.stav !== 'utok') e.hd = angLerp(e.hd, smer, 8 * dt);
      const v = ciel * dt;
      if (!krok(e, Math.sin(e.hd) * v, Math.cos(e.hd) * v) && e.stav === 'tula') { e.hd += 2; e.t = 0.5; }
      e.rychl = ciel;
    } else e.rychl = 0;
    if (e.kx || e.kz) { krok(e, e.kx * dt, e.kz * dt); const u = Math.exp(-8 * dt); e.kx *= u; e.kz *= u; if (Math.abs(e.kx) + Math.abs(e.kz) < 0.1) e.kx = e.kz = 0; }
    animuj(e, dt, cas);
    if (e.barT > 0) { e.barT -= dt; if (e.barT <= 0) e.bar.s.visible = false; }   // po zasahu 5 s viditelny, v boji zostane
    if (!def.boss && e.hp < def.zdravie && (e.stav === 'honi' || e.stav === 'napriah')) e.bar.s.visible = true;
  }
}
function angLerp(a, b, k) { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * Math.min(k, 1); }

// animacia: chodza (nohy), telegraf (zdvihnutie a ziara), blik pri zasahu
function animuj(e, dt, cas) {
  const y = vyskaTerenu(e.x, e.z), def = e.def;
  e.ph += dt * (2 + e.rychl * 2.4);
  const pohyb = Math.min(e.rychl / 2, 1);
  const wk = e.stav === 'napriah' ? 1 - Math.max(e.t, 0) / e.napT : 0;           // 0..1 pocas napriahnutia
  const sk = e.stav === 'utok' ? 1 : 0;
  const dupK = e.typ === 'dupot' ? wk : 0;
  e.g.position.set(e.x, y + (e.krab ? wk * 0.12 * e.sc * (e.typ === 'dupot' ? 3 : 1) : 0), e.z);
  if (e.kruh) e.kruh.material.opacity = e.stav === 'napriah' && dupK ? 0.15 + 0.45 * dupK : 0;
  if (e.otras > 0) { e.otras -= dt; e.g.position.x += Math.sin(cas * 90) * 0.12; }
  e.g.rotation.y = e.hd;
  for (const { n, s, i } of e.nohy) {
    if (e.krab) n.rotation.z = -s * (0.35 + Math.sin(e.ph + (s > 0 ? Math.PI : 0) + i * 1.4) * 0.35 * pohyb);
    else n.rotation.x = Math.sin(e.ph + (s * i > 0 ? Math.PI : 0)) * 0.6 * pohyb;
  }
  if (e.krab) {
    for (let k = 0; k < 2; k++) { const r = e.klieste[k]; r.rotation.x = -wk * (dupK ? 1.9 : 1.1) + sk * (dupK ? 1.4 : 0.6); r.rotation.y = (k ? 1 : -1) * (0.35 - wk * 0.3); }
    e.trup.rotation.x = -wk * 0.4;
  } else {
    e.hlava.rotation.x = -wk * 0.7 + sk * 0.5 + Math.sin(e.ph * 0.5) * 0.05;
    e.trup.rotation.x = -wk * 0.22;
    e.chvost.rotation.y = Math.sin(e.ph * 0.9) * (0.25 + 0.2 * pohyb); e.koniec.rotation.y = Math.sin(e.ph * 0.9 - 1) * 0.35;
    e.pruh.emissiveIntensity = 2.2 + wk * 6 + Math.sin(cas * 3) * 0.3;               // pred utokom pruhy zaziaria
  }
  e.blik = Math.max(0, e.blik - dt);
  const b = e.blik > 0 ? 1 : wk > 0 ? 0.6 * Math.sin(wk * 20) ** 2 : 0;               // cervene bliknutie pri zasahu, pulz pri napriahu
  for (const m of e.tela) { m.emissive.setHex(e.blik > 0 ? 0xff2010 : 0xffa030); m.emissiveIntensity = b * 1.2; }
}
