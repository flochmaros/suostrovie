// Stavanie: podlaha, stena, strecha na mriezke 2 m. Polozenie klavesou F (ako taborak),
// polopriehladny nahlad (zeleny = da sa, cerveny = neda), kolizie (hrac.js), rozobratie uderom, ukladanie.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { vyskaTerenu } from './svet.js';
import { vyskaVody } from './ocean.js';
import { RECEPTY } from './obsah/recepty.js';

const M = 2;                                   // velkost mriezky (m)
const ZIVOTY = 3;                              // pocet uderov na rozobratie
const diely = [];                              // { typ, x, y, z, r, model, zivoty }
let scena = null;

// ---------- modely ----------
const DREVO = new THREE.MeshStandardMaterial({ color: 0x8a6240, roughness: 0.9, flatShading: true });
const KMEN = new THREE.MeshStandardMaterial({ color: 0x74512f, roughness: 0.95, flatShading: true });
const SLAMA = new THREE.MeshStandardMaterial({ color: 0xa8873f, roughness: 1, flatShading: true });
const SKLON = Math.atan2(0.9, M);              // strecha stupa o 0.9 m na 2 m
const GEO = {
  // dosky (vrch na y = 0) + 2 tramy pod nimi
  podlaha: mergeGeometries([
    ...[0, 1, 2, 3, 4].map(i => new THREE.BoxGeometry(M, 0.1, 0.37).translate(0, -0.05, -0.8 + i * 0.4)),
    ...[-0.85, 0.85].map(x => new THREE.BoxGeometry(0.16, 0.16, M).translate(x, -0.18, 0))]),
  // 5 zrubovych kmenov nad sebou pozdlz osi X
  stena: mergeGeometries([0, 1, 2, 3, 4].map(i => new THREE.CylinderGeometry(0.2, 0.2, M + 0.15, 7).rotateZ(Math.PI / 2).translate(0, 0.2 + i * 0.4, 0))),
  // 4 rady slamy, sikmo (spodna hrana nad jednou stenou, horna nad protilahlou)
  strecha: mergeGeometries([0, 1, 2, 3].map(i => new THREE.BoxGeometry(M + 0.5, 0.16, 0.75).translate(0, i * 0.03, -0.9 + i * 0.6)))
    .rotateX(SKLON).translate(0, M + 0.5, 0),
};
const MAT = { podlaha: DREVO, stena: KMEN, strecha: SLAMA };
const GEO_NOHA = new THREE.CylinderGeometry(0.09, 0.11, 1, 6).translate(0, -0.5, 0);   // vrch na y = 0, dlzka 1 (skaluje sa)

function vytvorModel(d) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(GEO[d.typ], MAT[d.typ]);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  if (d.typ === 'podlaha') {                   // nohy az do terenu (nerovny teren = dlhsie nohy)
    for (const [ox, oz] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) {
      const n = new THREE.Mesh(GEO_NOHA, KMEN);
      const dlzka = d.y - 0.26 - vyskaTerenu(d.x + ox, d.z + oz) + 0.3;
      n.scale.y = Math.max(0.05, dlzka);
      n.position.set(ox, -0.26, oz);
      n.castShadow = true;
      g.add(n);
    }
  }
  g.position.set(d.x, d.y, d.z);
  g.rotation.y = d.r * Math.PI / 2;
  scena.add(g);
  d.model = g;
}

// ---------- nahlad (ghost) ----------
const NAHLAD_MAT = new THREE.MeshBasicMaterial({ color: 0x6dff8a, transparent: true, opacity: 0.45, depthWrite: false });
let nahladMesh = null;

export function initStavba(s) {
  scena = s;
  nahladMesh = new THREE.Mesh(GEO.podlaha, NAHLAD_MAT);
  nahladMesh.visible = false;
  scena.add(nahladMesh);
}

// ---------- kde diel pristane ----------
const podlahy = () => diely.filter(d => d.typ === 'podlaha');
function najblizsiaPodlaha(x, z, max = 2.4) {
  let naj = null;
  for (const p of podlahy()) { const v = Math.hypot(p.x - x, p.z - z); if (v < max) { max = v; naj = p; } }
  return naj;
}
const obsadene = (typ, x, z, y) => diely.some(d => d.typ === typ && Math.abs(d.x - x) < 0.1 && Math.abs(d.z - z) < 0.1 && Math.abs(d.y - y) < 0.5);

// vrati { typ, x, y, z, r, ok, dovod } pre diel mierenim z (px, pz) smerom yaw
export function miesto(typ, px, pz, yaw, t) {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const r = ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;
  if (typ === 'podlaha') {
    const tx = px + fx * 2.2, tz = pz + fz * 2.2;
    const x = Math.floor(tx / M) * M + M / 2, z = Math.floor(tz / M) * M + M / 2;
    const rohy = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].map(([a, b]) => vyskaTerenu(x + a, z + b));
    const sused = najblizsiaPodlaha(x, z, M + 0.01);           // susedna podlaha -> rovnaka vyska
    const y = sused ? sused.y : Math.max(...rohy) + 0.15;
    const p = { typ, x, y, z, r, ok: true, dovod: '' };
    if (vyskaTerenu(x, z) < vyskaVody(x, z, t) + 0.15) Object.assign(p, { ok: false, dovod: 'Podlaha sa dá postaviť len na súši' });
    else if (y - Math.min(...rohy) > 3) Object.assign(p, { ok: false, dovod: 'Príliš strmý terén' });
    else if (obsadene('podlaha', x, z, y)) Object.assign(p, { ok: false, dovod: 'Tu už podlaha je' });
    return p;
  }
  const tx = px + fx * 1.6, tz = pz + fz * 1.6;
  const pod = najblizsiaPodlaha(tx, tz);
  if (!pod) return { typ, x: tx, y: vyskaTerenu(tx, tz), z: tz, r, ok: false, dovod: 'Najprv polož podlahu' };
  if (typ === 'stena') {                       // na najblizsiu hranu podlahy
    const hrany = [[0, -1, 0], [1, 0, 1], [0, 1, 0], [-1, 0, 1]].map(([a, b, rr]) => ({ x: pod.x + a, z: pod.z + b, r: rr }));
    hrany.sort((a, b) => Math.hypot(a.x - tx, a.z - tz) - Math.hypot(b.x - tx, b.z - tz));
    const h = hrany[0];
    const p = { typ, x: h.x, y: pod.y, z: h.z, r: h.r, ok: true, dovod: '' };
    if (obsadene('stena', h.x, h.z, pod.y)) Object.assign(p, { ok: false, dovod: 'Tu už stena je' });
    return p;
  }
  // strecha: nad podlahou, na vrchu stien
  const p = { typ, x: pod.x, y: pod.y, z: pod.z, r, ok: true, dovod: '' };
  if (obsadene('strecha', pod.x, pod.z, pod.y)) Object.assign(p, { ok: false, dovod: 'Tu už strecha je' });
  return p;
}

// zobrazi/skryje nahlad; typ = null -> skryt
export function nahlad(p) {
  nahladMesh.visible = !!p;
  if (!p) return;
  nahladMesh.geometry = GEO[p.typ];
  nahladMesh.position.set(p.x, p.y, p.z);
  nahladMesh.rotation.y = p.r * Math.PI / 2;
  NAHLAD_MAT.color.set(p.ok ? 0x6dff8a : 0xff5a4a);
}

export function poloz(p) {
  const d = { typ: p.typ, x: p.x, y: p.y, z: p.z, r: p.r, zivoty: ZIVOTY };
  vytvorModel(d);
  diely.push(d);
}

// ---------- kolizie (vola hrac.js) ----------
// steny: obdlznik 2 m x 0.4 m, hraca (polomer 0.3) odtlaci kolmo od steny
export function odtlacOdStien(poz) {
  for (const d of diely) {
    if (d.typ !== 'stena' || poz.y > d.y + M || poz.y < d.y - 1.7) continue;
    const pozdlz = d.r % 2 ? poz.z - d.z : poz.x - d.x;
    const kolmo = d.r % 2 ? poz.x - d.x : poz.z - d.z;
    const min = 0.2 + 0.3;
    if (Math.abs(pozdlz) > M / 2 + 0.3 || Math.abs(kolmo) > min) continue;
    const novy = (kolmo >= 0 ? 1 : -1) * min;
    if (d.r % 2) poz.x = d.x + novy; else poz.z = d.z + novy;
  }
}
// vyska podlahy pod hracom (alebo -Infinity); podlaha plati len ked hrac nie je hlboko pod nou
export function vyskaPodlahy(x, z, y) {
  let v = -Infinity;
  for (const d of diely) {
    if (d.typ !== 'podlaha' || Math.abs(x - d.x) > M / 2 || Math.abs(z - d.z) > M / 2 || y < d.y - 0.7) continue;
    v = Math.max(v, d.y);
  }
  return v;
}

// ---------- rozobratie uderom ----------
// diel pred hracom (steny a strechy; podlaha len ked na nej hrac nestoji)
export function najdiDiel(x, z, fx, fz) {
  let naj = null, najD = 2.2;
  for (const d of diely) {
    const dx = d.x - x, dz = d.z - z, v = Math.hypot(dx, dz);
    if (d.typ === 'podlaha' && Math.abs(dx) < M / 2 && Math.abs(dz) < M / 2) continue;
    if (d.typ === 'strecha' && v < 0.8) continue;                        // zvnutra chatrce ciel na steny
    const vpredu = v > 1e-3 && (dx * fx + dz * fz) / v > 0.35;
    if (!(vpredu || (d.typ === 'stena' && v < 0.6))) continue;
    const vaha = v + (d.typ === 'podlaha' ? 0.5 : d.typ === 'strecha' ? 0.25 : 0);   // steny maju prednost
    if (vaha < najD) { najD = vaha; naj = d; }
  }
  return naj;
}
// uder do dielu; ak sa rozpadne, vrati polovicu surovin [[id, n]...], inak null
export function uderDiel(d) {
  d.model.position.y = d.y - 0.03;
  setTimeout(() => d.model && (d.model.position.y = d.y), 90);
  if (--d.zivoty > 0) return null;
  scena.remove(d.model); d.model = null;
  diely.splice(diely.indexOf(d), 1);
  const r = RECEPTY.find(r => r.vysledok[0] === d.typ);
  return r ? r.suroviny.map(([id, n]) => [id, Math.ceil(n / 2)]) : [];
}

// ---------- ukladanie ----------
export const ulozStavby = () => diely.map(d => ({ t: d.typ, x: d.x, y: +d.y.toFixed(3), z: d.z, r: d.r }));
export function nacitajStavby(data) {
  if (!Array.isArray(data)) return;
  for (const d of data) if (GEO[d?.t] && [d.x, d.y, d.z, d.r].every(Number.isFinite)) poloz({ typ: d.t, x: d.x, y: d.y, z: d.z, r: d.r });
}
export const pocetDielov = () => diely.length;
