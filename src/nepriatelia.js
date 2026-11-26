// Nepriatelia: jednoduchy boj. Kazdy ma stavy tula -> honi -> napriah (viditelny telegraf) -> utok -> oddych, pri nizkom zdraví utek.
// Spawn len okolo hraca (nahodne), despawn ked su daleko; strop poctu. Data v obsah/nepriatelia.js.
import * as THREE from 'three';
import { NEPRIATELIA } from './obsah/nepriatelia.js';
import { vyskaTerenu, ostrovPri, pasmo, polozPredmet } from './svet.js';
import { hororovaZona } from './ostrovy/ticha_zatoka.js';
import { zran, stav as stavPreziti } from './preziti.js';
import { vytvorCastice } from './castice.js';
import { zvuky } from './zvuk.js';
import { modelKrab as modelKrabDetail } from './modely_nepriatelov.js';
import { modelLavovyObr, modelKrokodil, modelKraken, modelGolem, chapadloZoZeme, strelaModel } from './modely_bossov.js';

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
const modelKrab = () => modelKrabDetail(false);       // model je v modely_nepriatelov.js
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
const modelObrovskyKrab = () => modelKrabDetail(true);   // ten isty model, ine farby + machy/barnakle (skala podla def.scale)
const MODELY = { nocny_krab: modelKrab, lavovy_jaster: modelJaster, obrovsky_krab: modelObrovskyKrab,
  lavovy_obr: modelLavovyObr, obrovsky_krokodil: modelKrokodil, kraken: modelKraken, kamenny_golem: modelGolem };
const farbaCastic = e => e.def.farba ?? (e.id === 'lavovy_jaster' ? 0xff7a2a : 0xa89cf0);

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
  e.g.position.set(x, def.voda ? 0 : vyskaTerenu(x, z), z); e.g.scale.setScalar(e.sc); skupina.add(e.g);
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
export function odstranNepriatela(e) { zrusCiele(e); const i = nepr.indexOf(e); if (i >= 0) { skupina.remove(e.g); nepr.splice(i, 1); } }

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
  e.mrtvy = true; e.smrt = 0; e.bar.s.visible = false; if (e.kruh) e.kruh.material.opacity = 0; zrusCiele(e);
  zvuky.smrtNepr();
  pustCastice(e.x, e.g.position.y + 0.4 * e.sc, e.z, farbaCastic(e), e.def.boss ? 140 : 24, e.def.boss ? 10 : 4);
  for (const [id, min, max, sanca] of e.def.loot) {
    if (Math.random() > sanca) continue;
    const n = min + Math.floor(Math.random() * (max - min + 1));
    for (let i = 0; i < n; i++) polozPredmet(id, e.x + rnd(-0.7, 0.7), e.z + rnd(-0.7, 0.7));
  }
  udalosti.priZabiti?.(e.id, e.def);
}

// Zasah hraca: kuzel pred hracom. o = { dosah, kuzel (cos polovicneho uhla), vsetkych (meč: vsetci v kuzeli, inak najblizsi), knock (nasobok odhodenia) }.
// Vrati pole zasiahnutych nepriatelov (prazdne = netrafil).
export function udriNepriatela(x, z, fx, fz, dmg, o = {}) {
  const dosah = o.dosah ?? 2.3, kuzel = o.kuzel ?? 0.45, knock = o.knock ?? 1;
  const kandidati = [];
  for (const e of nepr) {
    if (e.mrtvy) continue;
    const dx = e.x - x, dz = e.z - z, l = Math.hypot(dx, dz) || 0.001, d = l - 0.3 - (e.def.polomer || 0);
    if (d > dosah || (d > 0.5 && (dx * fx + dz * fz) / l < kuzel)) continue;
    kandidati.push({ e, d });
  }
  kandidati.sort((a, b) => a.d - b.d);
  const ciele = (o.vsetkych ? kandidati : kandidati.slice(0, 1)).map(k => k.e);
  for (const e of ciele) { zasiahni(e, x, z, dmg, knock, o.stun || 0); if (o.horenie && !e.mrtvy && !e.def.ohnivzdorny) e.horenie = o.horenie; }
  return ciele;
}
function zasiahni(e, x, z, dmg, knock, stun = 0) {
  const dx = e.x - x, dz = e.z - z, l = Math.hypot(dx, dz) || 1;
  e.hp -= dmg; e.blik = 0.25; e.barT = 5; vykresliBar(e); e.bar.s.visible = true;
  const tz = e.def.boss ? 0.1 : 1; e.kx = dx / l * 6 * tz * knock; e.kz = dz / l * 6 * tz * knock;
  if (e.def.boss) { if (e.stav === 'tula') e.stav = 'honi'; }                        // boss sa nenecha prerusit
  else if (e.stav === 'napriah' || e.stav === 'utok') { e.stav = 'oddych'; e.t = 0.7; }     // zasah prerusi napriahnutie
  else if (e.stav !== 'utek') e.stav = 'honi';
  if (e.def.fazaHp && !e.faza2 && e.hp > 0 && e.hp <= e.def.zdravie * e.def.fazaHp) { e.faza2 = true; zvuky.napriah(); pustCastice(e.x, e.g.position.y + 1.5, e.z, 0xff5030, 40, 6); udalosti.priFaze?.(e, e.def); }
  pustCastice(e.x, e.g.position.y + 0.5 * e.sc, e.z, farbaCastic(e), e.def.boss ? 16 : 10, e.def.boss ? 5 : 3);
  if (stun && e.hp > 0) { e.omraceny = e.def.boss ? Math.min(stun, 0.5) : stun; if (!e.def.boss && (e.stav === 'napriah' || e.stav === 'utok')) { e.stav = 'oddych'; e.t = 0.3; } }   // omracenie
  if (e.hp <= 0) zabi(e);
  else if (!e.utek && e.def.utek && e.hp <= e.def.zdravie * e.def.utek) { e.utek = true; e.stav = 'utek'; }
}

// ---------- utoky bossov na dialku: vrh (lava, balvan, chapadlo zo zeme), lavove kaluze ----------
const strely = [], kaluze = [];
function zasahHraca(dmg, kn, dx, dz, d, hrac) {
  zran(dmg, 'nepriatel'); nezranitelny = 0.8;
  kHrac.x = dx / (d || 1) * kn; kHrac.z = dz / (d || 1) * kn;
  pustCastice(hrac.poz.x, hrac.poz.y + 1.1, hrac.poz.z, 0xd04030, 10, 2.5);
}
const vyskaPov = (x, z) => Math.max(vyskaTerenu(x, z), 0);
function kruhCiela(x, z, r, farba) {                 // telegraf na zemi: kruh + vypln, ktora pocas napriahu hustne
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.RingGeometry(r * 0.93, r, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: farba, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })));
  g.add(new THREE.Mesh(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: farba, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide })));
  g.position.set(x, vyskaPov(x, z) + 0.12, z); skupina.add(g);
  return g;
}
function zrusCiele(e) { for (const c of e.ciele || []) if (!c.vystrelene) skupina.remove(c.kruh); e.ciele = null; }
function zamier(e, hrac) {                           // pri zaciatku napriahu: kam pada (hrac + v 2. faze dalsie okolo neho)
  const v = e.def.vrh, n = e.faza2 ? v.pocet2 || 1 : v.pocet || 1, ciele = [];
  for (let i = 0; i < n; i++) {
    const a = rnd(0, 6.28), r = i ? rnd(3, 7) : 0, x = hrac.poz.x + Math.cos(a) * r, z = hrac.poz.z + Math.sin(a) * r;
    ciele.push({ x, z, kruh: kruhCiela(x, z, v.r, v.druh === 'chapadlo' ? 0xc040ff : 0xff3020) });
  }
  e.ciele = ciele;
}
function vystrel(e) {
  const v = e.def.vrh;
  for (const c of e.ciele || []) {
    c.vystrelene = true;
    const s = { druh: v.druh, x0: e.x, y0: e.g.position.y + (e.def.vyska || 2) * 0.8, z0: e.z, tx: c.x, tz: c.z, t: 0, kruh: c.kruh, dmg: v.dmg, r: v.r, hotovo: false };
    if (v.druh === 'chapadlo') {
      const ch = chapadloZoZeme(); s.g = ch.g; s.cl = ch.cl; s.T = 0.35 + Math.random() * 0.35;
      s.g.scale.setScalar(1.3); s.g.rotation.y = rnd(0, 6.28); s.g.position.set(c.x, -20, c.z); skupina.add(s.g);
    } else {
      s.g = strelaModel(v.druh); s.T = 0.6 + Math.hypot(c.x - e.x, c.z - e.z) / 30; s.g.position.set(s.x0, s.y0, s.z0); skupina.add(s.g);
    }
    strely.push(s);
  }
  e.ciele = null;
}
function aktualizujStrely(dt, hrac, zivy) {
  const hx = hrac.poz.x, hz = hrac.poz.z;
  for (let i = strely.length - 1; i >= 0; i--) {
    const s = strely[i]; s.t += dt;
    const k = Math.min(s.t / s.T, 1), yz = vyskaPov(s.tx, s.tz);
    if (s.kruh) s.kruh.children[1].material.opacity = 0.1 + 0.4 * k;
    let prec = false;
    if (s.druh === 'chapadlo') {                       // pod zemou bubliny, potom vystreli hore, krouti sa a zmizne
      if (!s.hotovo && Math.random() < 0.5) pustCastice(s.tx + rnd(-1, 1), yz + 0.2, s.tz + rnd(-1, 1), 0x9a7ab0, 1, 1.2);
      const u = s.t - s.T, vyska = u < 0 ? -20 : u < 0.15 ? -9 + u / 0.15 * 9 : u < 1.4 ? 0 : -(u - 1.4) * 14;
      s.g.position.y = yz + vyska;
      s.cl.forEach((c, j) => { c.rotation.x = u > 0 ? Math.sin(s.t * 5 + j) * 0.18 : 0; c.rotation.z = Math.cos(s.t * 4 + j * 0.7) * 0.15; });
      if (u > 2.2) prec = true;
    } else {
      const vysk = 5 + Math.hypot(s.tx - s.x0, s.tz - s.z0) * 0.25;
      s.g.position.set(s.x0 + (s.tx - s.x0) * k, s.y0 + (yz - s.y0) * k + vysk * 4 * k * (1 - k), s.z0 + (s.tz - s.z0) * k);
      s.g.rotation.x += dt * 5; s.g.rotation.z += dt * 3;
      if (s.druh === 'lava' && Math.random() < 0.7) pustCastice(s.g.position.x, s.g.position.y, s.g.position.z, 0xff6a20, 1, 0.6);
      if (k >= 1) prec = true;
    }
    if (!s.hotovo && s.t >= s.T) {                     // dopad
      s.hotovo = true; if (s.kruh) { skupina.remove(s.kruh); s.kruh = null; }
      zvuky.pad();
      pustCastice(s.tx, yz + 0.3, s.tz, s.druh === 'lava' ? 0xff6a20 : s.druh === 'chapadlo' ? 0xb8e0f0 : 0x9a958a, 40, 7);
      const dx = hx - s.tx, dz = hz - s.tz, d = Math.hypot(dx, dz);
      if (zivy && nezranitelny <= 0 && d < s.r + 0.3 && hrac.poz.y < yz + 3) zasahHraca(s.dmg, 11, dx, dz, d, hrac);
      if (s.druh === 'lava') {
        const geo = new THREE.CircleGeometry(s.r * 0.65, 20), p = geo.attributes.position, farby = [];   // nepravidelny okraj, zeravy stred, tmava kora
        for (let j = 0; j < p.count; j++) {
          const okraj = j > 0, k2 = 0.75 + Math.random() * 0.45;
          if (okraj) p.setXY(j, p.getX(j) * k2, p.getY(j) * k2);
          const c = new THREE.Color(okraj ? (Math.random() < 0.5 ? 0x2a0c06 : 0x8a2008) : 0xffb040); farby.push(c.r, c.g, c.b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(farby, 3)); geo.rotateX(-Math.PI / 2);
        const g = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
        g.position.set(s.tx, yz + 0.08, s.tz); skupina.add(g); kaluze.push({ x: s.tx, z: s.tz, r: s.r * 0.6, t: 5, g, tik: 0 });
      }
    }
    if (prec) { skupina.remove(s.g); strely.splice(i, 1); }
  }
  for (let i = kaluze.length - 1; i >= 0; i--) {     // lavova kaluz pali, kym nevychladne
    const k = kaluze[i]; k.t -= dt; k.tik -= dt;
    k.g.material.opacity = Math.min(1, k.t / 1.5);
    if (Math.random() < 0.3) pustCastice(k.x + rnd(-k.r, k.r) * 0.7, k.g.position.y, k.z + rnd(-k.r, k.r) * 0.7, 0xff7a20, 1, 0.8);
    if (zivy && k.tik <= 0 && Math.hypot(hx - k.x, hz - k.z) < k.r && hrac.poz.y < k.g.position.y + 1) { k.tik = 0.5; zran(5, 'lava'); }
    if (k.t <= 0) { skupina.remove(k.g); kaluze.splice(i, 1); }
  }
}

// ---------- hlavna aktualizacia ----------
export function aktualizujNepriatelov(dt, cas, hrac, { pesi = true, noc = false } = {}) {
  if (!skupina) return;
  dt = Math.min(dt, 0.1);
  const hx = hrac.poz.x, hz = hrac.poz.z, zivy = !stavPreziti.mrtvy && pesi;
  castice.aktualizuj(dt);
  aktualizujStrely(dt, hrac, zivy);
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
        return !f.boss && p >= f.pasmo && (!f.noc || (noc && hororovaZona(x, z) < 0.05)) /* Ticha zatoka: ziadne nocne kraby, tam su Bledi */ && (f.biom ? o.biom === f.biom && h > 0.8 : h < 2.2)
          && nepr.filter(e => e.id === k && !e.mrtvy).length < f.max;
      });
      if (vhodne.length) spawnNepriatela(vhodne[Math.floor(Math.random() * vhodne.length)], x, z);
    }
  }
  for (let i = nepr.length - 1; i >= 0; i--) {
    const e = nepr[i], def = e.def;
    const dx = hx - e.x, dz = hz - e.z, d = Math.hypot(dx, dz) || 0.001;
    const du = def.predok ? Math.hypot(hx - e.x - Math.sin(e.hd) * def.predok, hz - e.z - Math.cos(e.hd) * def.predok) : d;   // vzdialenost od tlamy/pasti (dlhi bossovia)
    if (e.mrtvy) {                                   // padne na bok a zmizne
      e.smrt += dt; const k = Math.min(e.smrt / 0.5, 1);
      e.g.rotation.z = k * 1.5; e.g.scale.setScalar(e.sc * (1 - Math.max(0, e.smrt - (def.boss ? 3 : 1.0))));
      if (e.smrt > (def.boss ? 4 : 2)) { skupina.remove(e.g); nepr.splice(i, 1); }
      continue;
    }
    if ((d > DESPAWN && !def.boss) || (def.noc && !noc && e.stav !== 'napriah' && d > 20) || (e.utek && d > 36)) { skupina.remove(e.g); nepr.splice(i, 1); continue; }
    if (e.horenie > 0) {                             // zeravy mec: nepriatel hori
      e.horenie -= dt;
      if ((e.horT = (e.horT || 0) - dt) <= 0) { e.horT = 0.5; e.hp -= 1.5; e.blik = 0.1; vykresliBar(e); pustCastice(e.x, e.g.position.y + 0.6 * e.sc, e.z, 0xff7a20, 5, 1.5); if (e.hp <= 0) { zabi(e); continue; } }
    }
    const [vTula, , vBeh0] = def.rychlost, vBeh = vBeh0 * (e.faza2 ? 1.35 : 1);
    let ciel = 0, smer = e.hd;                       // ciel = rychlost, smer = kam
    e.t -= dt;
    const vidi = zivy && d < def.zbadaj;
    if (e.omraceny > 0) {                           // omraceny: nehybe sa ani neutoci, nad hlavou mu krouzia hviezdicky
      e.omraceny -= dt; e.t += dt; if (!def.boss && (e.stav === 'napriah' || e.stav === 'utok')) e.stav = 'oddych';
      if ((e.hviezdT = (e.hviezdT || 0) - dt) <= 0) { e.hviezdT = 0.12; const a = cas * 9; pustCastice(e.x + Math.cos(a) * 0.5 * e.sc, e.g.position.y + (def.vyska || 1) + 0.4, e.z + Math.sin(a) * 0.5 * e.sc, 0xffe050, 1, 0.3); }
    } else switch (e.stav) {
      case 'tula':
        if (vidi) { e.stav = 'honi'; break; }
        if (e.t <= 0) { e.t = rnd(1.5, 4); e.hd = rnd(0, 6.28); e.v = Math.random() < 0.4 ? 0 : vTula; }
        ciel = e.v; smer = e.hd; break;
      case 'honi':
        if (!zivy || d > def.zbadaj * 1.8) { e.stav = 'tula'; e.t = 1; break; }
        smer = Math.atan2(dx, dz); ciel = def.staticky ? 0 : vBeh;
        if (def.staticky) e.hd = angLerp(e.hd, smer, 1.5 * dt);
        {
          const nap = (typ, t) => { e.typ = typ; e.stav = 'napriah'; e.napT = e.t = t * (e.faza2 ? 0.75 : 1); zvuky.napriah(); }, f2 = e.faza2 ? 1.7 : 1;
          if (def.dupot && d < def.dupot.dosah * 0.85 && (d < def.utok ? Math.random() < 0.3 : Math.random() < 0.5 * dt)) nap('dupot', def.dupot.napriah);   // boss: tlakovy dupot okolo seba
          else if (def.vypad && du > def.utok + 2 && d < def.vypad.dosah && Math.random() < def.vypad.sanca * f2 * dt) nap('vypad', def.vypad.napriah);     // vypad (krokodil)
          else if (def.vrh && d > (def.vrh.min || 0) && d < def.vrh.dosah && Math.random() < def.vrh.sanca * f2 * dt) { nap('vrh', def.vrh.napriah); zamier(e, hrac); }   // strela na hraca
          else if (du < def.utok) nap('klepeto', def.napriah);
        }
        break;
      case 'napriah':                                // telegraf: stoji, otaca sa k hracovi (len na zaciatku), pripravuje sa
        if (e.typ !== 'dupot' && e.t > e.napT * 0.35) e.hd = angLerp(e.hd, Math.atan2(dx, dz), 10 * dt);
        smer = e.hd;
        if (e.t <= 0) {
          e.stav = 'utok'; e.t = 0.2; zvuky.utokNepr();
          if (e.typ === 'vrh') { vystrel(e); e.t = 0.4; break; }
          if (e.typ === 'vypad') { e.t = Math.min(def.vypad.cas, (d + 4) / def.vypad.rychlost); e.zasiahol = false; break; }   // prebehne az za hraca
          const dup = e.typ === 'dupot' ? def.dupot : null, dosah = dup ? dup.dosah : def.utok + 0.5;
          if (dup) { pustCastice(e.x, e.g.position.y + 0.3, e.z, 0xd8c8a0, 60, 8); zvuky.pad(); e.otras = 0.5; }
          if (zivy && nezranitelny <= 0 && (dup ? d : du) < dosah && !(dup && hrac.poz.y > e.g.position.y + 1.6)) {       // kto sa pocas napriahnutia odtiahol (alebo na dupot vyskocil), uhol
            zran(dup ? dup.dmg : def.dmg, 'nepriatel');
            nezranitelny = 0.8;
            const kn = dup ? dup.knock : def.knock;
            kHrac.x = dx / d * kn; kHrac.z = dz / d * kn;
            pustCastice(hx, hrac.poz.y + 1.1, hz, 0xd04030, 8, 2.5);
          }
        }
        break;
      case 'utok':
        if (e.typ === 'vypad') {
          ciel = def.vypad.rychlost * (e.faza2 ? 1.2 : 1);
          if (Math.random() < 0.6) pustCastice(e.x, e.g.position.y + 0.2, e.z, 0xc8b890, 2, 2);
          if (!e.zasiahol && zivy && nezranitelny <= 0 && du < 3) { e.zasiahol = true; zasahHraca(def.vypad.dmg, def.vypad.knock, dx, dz, d, hrac); }
        } else ciel = e.typ === 'dupot' || e.typ === 'vrh' || def.staticky ? 0 : vBeh * 1.6;
        smer = e.hd; if (e.t <= 0) { e.stav = 'oddych'; e.t = def.oddych; } break;
      case 'oddych': if (e.t <= 0) e.stav = zivy ? 'honi' : 'tula'; break;
      case 'utek': smer = Math.atan2(-dx, -dz); ciel = vBeh * 0.9; break;
    }
    if (ciel > 0) {
      if (e.stav !== 'napriah' && e.stav !== 'utok') e.hd = angLerp(e.hd, smer, 8 * dt);
      const v = ciel * dt;
      if (!krok(e, Math.sin(e.hd) * v, Math.cos(e.hd) * v) && e.stav === 'tula') { e.hd += 2; e.t = 0.5; }
      e.rychl = ciel;
    } else e.rychl = 0;
    if (def.staticky) e.kx = e.kz = 0;
    if (e.kx || e.kz) { krok(e, e.kx * dt, e.kz * dt); const u = Math.exp(-8 * dt); e.kx *= u; e.kz *= u; if (Math.abs(e.kx) + Math.abs(e.kz) < 0.1) e.kx = e.kz = 0; }
    animuj(e, dt, cas);
    if (e.barT > 0) { e.barT -= dt; if (e.barT <= 0) e.bar.s.visible = false; }   // po zasahu 5 s viditelny, v boji zostane
    if (!def.boss && e.hp < def.zdravie && (e.stav === 'honi' || e.stav === 'napriah')) e.bar.s.visible = true;
  }
}
function angLerp(a, b, k) { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * Math.min(k, 1); }

// animacia: chodza (nohy), telegraf (zdvihnutie a ziara), blik pri zasahu
function animuj(e, dt, cas) {
  const def = e.def, y = def.voda ? -0.5 : vyskaTerenu(e.x, e.z);
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
    e.animKrab(e, dt, cas, wk, sk, dupK, pohyb);     // nohy, klepeta, oci, usta (modely_nepriatelov.js)
    e.trup.rotation.x = -wk * 0.4;
  } else if (e.anim) e.anim(e, dt, cas, wk, sk, pohyb);   // bossovia (modely_bossov.js)
  else {
    e.hlava.rotation.x = -wk * 0.7 + sk * 0.5 + Math.sin(e.ph * 0.5) * 0.05;
    e.trup.rotation.x = -wk * 0.22;
    e.chvost.rotation.y = Math.sin(e.ph * 0.9) * (0.25 + 0.2 * pohyb); e.koniec.rotation.y = Math.sin(e.ph * 0.9 - 1) * 0.35;
    e.pruh.emissiveIntensity = 2.2 + wk * 6 + Math.sin(cas * 3) * 0.3;               // pred utokom pruhy zaziaria
  }
  e.blik = Math.max(0, e.blik - dt);
  const b = e.blik > 0 ? 1 : wk > 0 ? 0.6 * Math.sin(wk * 20) ** 2 : 0;               // cervene bliknutie pri zasahu, pulz pri napriahu
  for (const m of e.tela) { m.emissive.setHex(e.blik > 0 ? 0xff2010 : 0xffa030); m.emissiveIntensity = b * 1.2; }
}
