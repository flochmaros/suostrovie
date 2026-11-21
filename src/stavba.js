// Stavanie. Z menu (B) si vyberies stavbu -> rezim umiestnovania: polopriehladny nahlad ide tam, kam mieris
// kamerou (zeleny = da sa, cerveny = neda), koliesko / Q otaca, lavy klik postavi (az vtedy sa minu suroviny),
// pravy klik zrusi. Podlaha/stena/strecha sa prichytavaju na mriezku 2 m, nabytok a ine stavby su volne,
// molo sa stavia na vodu. Kolizie (hrac.js), rozobratie uderom, ukladanie, svetla pochodni.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { vyskaTerenu } from './svet.js';
import { vyskaVody } from './ocean.js';
import { RECEPTY, recept } from './obsah/recepty.js';
import { STAVBY } from './obsah/stavby.js';
import { pocet, odober, vykresli as vykresliInventar } from './inventar.js';
import { mys, stlacene } from './vstup.js';

const M = 2;                                   // velkost mriezky (m)
const ZIVOTY = 3;                              // pocet uderov na rozobratie
const MOLO_Y = 1.0;                            // vyska paluby mola nad strednou hladinou (priliv je +-0.6)
const diely = [];                              // { typ, x, y, z, r (stvrtotacky, mriezka), u (uhol), model, zivoty }
let scena = null, sluzby = {};

// ---------- modely zakladnych dielov ----------
const DREVO = new THREE.MeshStandardMaterial({ color: 0x8a6240, roughness: 0.9, flatShading: true });
const KMEN = new THREE.MeshStandardMaterial({ color: 0x74512f, roughness: 0.95, flatShading: true });
const SLAMA = new THREE.MeshStandardMaterial({ color: 0xa8873f, roughness: 1, flatShading: true });
const SKLON = Math.atan2(0.9, M);              // strecha stupa o 0.9 m na 2 m
const GEO = {
  podlaha: mergeGeometries([
    ...[0, 1, 2, 3, 4].map(i => new THREE.BoxGeometry(M, 0.1, 0.37).translate(0, -0.05, -0.8 + i * 0.4)),
    ...[-0.85, 0.85].map(x => new THREE.BoxGeometry(0.16, 0.16, M).translate(x, -0.18, 0))]),
  stena: mergeGeometries([0, 1, 2, 3, 4].map(i => new THREE.CylinderGeometry(0.2, 0.2, M + 0.15, 7).rotateZ(Math.PI / 2).translate(0, 0.2 + i * 0.4, 0))),
  strecha: mergeGeometries([0, 1, 2, 3].map(i => new THREE.BoxGeometry(M + 0.5, 0.16, 0.75).translate(0, i * 0.03, -0.9 + i * 0.6)))
    .rotateX(SKLON).translate(0, M + 0.5, 0),
};
const MAT = { podlaha: DREVO, stena: KMEN, strecha: SLAMA };
const GEO_NOHA = new THREE.CylinderGeometry(0.09, 0.11, 1, 6).translate(0, -0.5, 0);   // vrch na y = 0, dlzka 1 (skaluje sa)

// typy: prichyt 'podlaha' | 'stena' | 'strecha' (mriezka) | 'volne' | 'voda'; specialne = polozi main.js (taborak, lodenica)
const ZAKLAD = { podlaha: { prichyt: 'podlaha' }, stena: { prichyt: 'stena' }, strecha: { prichyt: 'strecha' } };
const SPECIALNE = {
  taborak: { prichyt: 'volne', polomer: 0.8, specialne: true, ghost: new THREE.CylinderGeometry(0.8, 0.9, 0.35, 10).translate(0, 0.17, 0) },
  lodenica: { prichyt: 'volne', polomer: 0, specialne: true, ghost: new THREE.BoxGeometry(5, 3, 9).translate(0, 1.5, 0) },
};
const info = typ => ZAKLAD[typ] ?? STAVBY[typ] ?? SPECIALNE[typ];
const jeStena = typ => info(typ)?.prichyt === 'stena';

// recepty pre nove stavby (menu B ich ukaze samo; vysledok sa nevyraba, stavba sa polozi priamo)
for (const [id, s] of Object.entries(STAVBY)) recept({ id, stavba: id, skupina: s.skupina, meno: s.meno, ikona: s.ikona, popis: s.popis, suroviny: s.suroviny });
for (const r of RECEPTY) if (ZAKLAD[r.id] || SPECIALNE[r.id]) r.stavba = r.id;

function vytvorModel(d) {
  let g;
  if (ZAKLAD[d.typ]) {
    g = new THREE.Group();
    const m = new THREE.Mesh(GEO[d.typ], MAT[d.typ]);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    if (d.typ === 'podlaha') {                 // nohy az do terenu (nerovny teren = dlhsie nohy)
      for (const [ox, oz] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) {
        const n = new THREE.Mesh(GEO_NOHA, KMEN);
        n.scale.y = Math.max(0.05, d.y - 0.26 - vyskaTerenu(d.x + ox, d.z + oz) + 0.3);
        n.position.set(ox, -0.26, oz);
        n.castShadow = true;
        g.add(n);
      }
    }
  } else g = STAVBY[d.typ].model();
  g.position.set(d.x, d.y, d.z);
  g.rotation.y = d.u;
  scena.add(g);
  d.model = g;
}

// ---------- nahlad (ghost) ----------
const NAHLAD_MAT = new THREE.MeshBasicMaterial({ color: 0x6dff8a, transparent: true, opacity: 0.45, depthWrite: false });
const duchovia = {};                           // typ -> Object3D (cache)
let duch = null;
function duchPre(typ) {
  if (duchovia[typ]) return duchovia[typ];
  let o;
  if (GEO[typ]) o = new THREE.Mesh(GEO[typ], NAHLAD_MAT);
  else if (SPECIALNE[typ]) o = new THREE.Mesh(SPECIALNE[typ].ghost, NAHLAD_MAT);
  else { o = STAVBY[typ].model(); o.traverse(c => { if (c.isMesh) { c.material = NAHLAD_MAT; c.castShadow = false; } }); }
  o.visible = false;
  scena.add(o);
  return (duchovia[typ] = o);
}
function ukazNahlad(p) {
  if (duch && (!p || duch !== duchovia[p.typ])) duch.visible = false;
  if (!p) { duch = null; return; }
  duch = duchPre(p.typ);
  duch.visible = true;
  duch.position.set(p.x, p.y, p.z);
  duch.rotation.y = p.u;
  NAHLAD_MAT.color.set(p.ok ? 0x6dff8a : 0xff5a4a);
}

// ---------- svetla (pochodne): stale 4 svetla, priradia sa najblizsim -> ziadna rekompilacia shaderov ----------
const svetla = [];
export function initStavba(s, o = {}) {
  scena = s; sluzby = o;
  for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffa040, 0, 14, 2); svetla.push(l); scena.add(l); }
}

// ---------- kde diel pristane ----------
const podlahy = () => diely.filter(d => d.typ === 'podlaha');
function najblizsiaPodlaha(x, z, max = 2.4) {
  let naj = null;
  for (const p of podlahy()) { const v = Math.hypot(p.x - x, p.z - z); if (v < max) { max = v; naj = p; } }
  return naj;
}
const obsadene = (test, x, z, y) => diely.some(d => test(d.typ) && Math.abs(d.x - x) < 0.1 && Math.abs(d.z - z) < 0.1 && Math.abs(d.y - y) < 0.5);
const otacka = yaw => ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;
const zle = (p, dovod) => Object.assign(p, { ok: false, dovod });

// p = { typ, x, y, z, r, u, ok, dovod } pre stavbu mierenu na bod (ax, az); yaw kamery, otoc = otocenie hraca (kroky)
function miesto(typ, ax, az, yaw, otoc, t, hx, hz) {
  const s = info(typ);
  if (s.prichyt === 'podlaha') {
    const x = Math.floor(ax / M) * M + M / 2, z = Math.floor(az / M) * M + M / 2;
    const rohy = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].map(([a, b]) => vyskaTerenu(x + a, z + b));
    const sused = najblizsiaPodlaha(x, z, M + 0.01);           // susedna podlaha -> rovnaka vyska
    const y = sused ? sused.y : Math.max(...rohy) + 0.15;
    const p = { typ, x, y, z, r: 0, u: 0, ok: true, dovod: '' };
    if (vyskaTerenu(x, z) < vyskaVody(x, z, t) + 0.15) zle(p, 'Podlaha sa dá postaviť len na súši');
    else if (y - Math.min(...rohy) > 3) zle(p, 'Príliš strmý terén');
    else if (obsadene(t => t === 'podlaha', x, z, y)) zle(p, 'Tu už podlaha je');
    return p;
  }
  if (s.prichyt === 'stena' || s.prichyt === 'strecha') {
    const pod = najblizsiaPodlaha(ax, az);
    if (!pod) return { typ, x: ax, y: vyskaTerenu(ax, az), z: az, r: 0, u: 0, ok: false, dovod: 'Najprv polož podlahu' };
    if (s.prichyt === 'stena') {                // na hranu podlahy najblizsie k mierenemu bodu
      const hrany = [[0, -1, 0], [1, 0, 1], [0, 1, 0], [-1, 0, 1]].map(([a, b, r]) => ({ x: pod.x + a, z: pod.z + b, r }));
      hrany.sort((a, b) => Math.hypot(a.x - ax, a.z - az) - Math.hypot(b.x - ax, b.z - az));
      const h = hrany[0], r = (h.r + (otoc & 1) * 2) % 4;     // otocenie = otoc stenu "zvnutra von"
      const p = { typ, x: h.x, y: pod.y, z: h.z, r, u: r * Math.PI / 2, ok: true, dovod: '' };
      if (obsadene(jeStena, h.x, h.z, pod.y)) zle(p, 'Tu už stena je');
      return p;
    }
    const r = (otacka(yaw) + otoc) % 4;
    const p = { typ, x: pod.x, y: pod.y, z: pod.z, r, u: r * Math.PI / 2, ok: true, dovod: '' };
    if (obsadene(t => t === 'strecha', pod.x, pod.z, pod.y)) zle(p, 'Tu už strecha je');
    return p;
  }
  const pol = s.polomer ?? 0.5;
  if (s.prichyt === 'voda') {                   // molo: na plytcinu pri brehu, nadvazuje na ine molo
    let x = ax, z = az, u = yaw + otoc * Math.PI / 12;
    for (const d of diely) {
      if (d.typ !== typ) continue;
      for (const k of [1, -1]) {
        const cx = d.x - Math.sin(d.u) * 4 * k, cz = d.z - Math.cos(d.u) * 4 * k;
        if (Math.hypot(cx - ax, cz - az) < 2.2) { x = cx; z = cz; u = d.u; }
      }
    }
    const p = { typ, x, y: MOLO_Y, z, r: 0, u, ok: true, dovod: '' };
    const dno = vyskaTerenu(x, z);
    const breh = [0, 1, 2, 3, 4, 5, 6, 7].some(i => { const a = i * Math.PI / 4; return vyskaTerenu(x + Math.cos(a) * 6, z + Math.sin(a) * 6) > 0.2; })
      || diely.some(d => d.typ === typ && Math.hypot(d.x - x, d.z - z) < 4.5);
    if (dno > -0.1) zle(p, 'Mólo sa stavia do vody pri brehu');
    else if (dno < -4) zle(p, 'Príliš hlboko');
    else if (!breh) zle(p, 'Príliš ďaleko od brehu');
    else if (diely.some(d => d.typ === typ && Math.hypot(d.x - x, d.z - z) < 2)) zle(p, 'Tu už mólo je');
    return p;
  }
  // volne: na zem alebo na podlahu / molo, otocene k hracovi
  const u = s.specialne ? 0 : yaw + Math.PI + otoc * Math.PI / 12;
  const vp = vyskaPodlahy(ax, az, Infinity), ter = vyskaTerenu(ax, az);
  const naPodlahe = vp > ter;
  const p = { typ, x: ax, y: naPodlahe ? vp : ter, z: az, r: 0, u, ok: true, dovod: '' };
  if (s.specialne) return p;                   // taborak/lodenica si kontroluje main.js
  const okolie = [0, 1, 2, 3].map(i => vyskaTerenu(ax + Math.cos(i * 1.57) * pol, az + Math.sin(i * 1.57) * pol));
  if (!naPodlahe && ter < vyskaVody(ax, az, t) + 0.1) zle(p, 'Tu je voda');
  else if (!naPodlahe && Math.max(...okolie) - Math.min(...okolie) > 0.9) zle(p, 'Príliš strmý terén');
  else if (Math.hypot(ax - hx, az - hz) < pol + 0.35) zle(p, 'Stojíš v ceste');
  else if (diely.some(d => !ZAKLAD[d.typ] && !jeStena(d.typ) && Math.hypot(d.x - ax, d.z - az) < Math.max(0.5, ((STAVBY[d.typ]?.polomer ?? 0) + pol) * 0.85) && Math.abs(d.y - p.y) < 1.5))
    zle(p, 'Príliš blízko inej stavby');
  return p;
}

export function poloz(p) {
  const d = { typ: p.typ, x: p.x, y: p.y, z: p.z, r: p.r ?? 0, u: p.u ?? (p.r ?? 0) * Math.PI / 2, zivoty: ZIVOTY };
  vytvorModel(d);
  diely.push(d);
}

// ---------- rezim umiestnovania ----------
let rezim = null;                              // { typ, rec, otoc }
const surovinyRec = typ => RECEPTY.find(r => r.stavba === typ || r.vysledok?.[0] === typ);
const vyrobny = rec => rec.vysledok && pocet(rec.vysledok[0]) > 0;   // uz vyrobeny diel v batohu (stare ulozenia)
const mozeZaplatit = rec => vyrobny(rec) || rec.suroviny.every(([id, n]) => pocet(id) >= n);
function zaplat(rec) {
  if (vyrobny(rec)) odober(rec.vysledok[0], 1);
  else if (rec.suroviny.every(([id, n]) => pocet(id) >= n)) rec.suroviny.forEach(([id, n]) => odober(id, n));
  else return false;
  vykresliInventar();
  return true;
}
export function zacniStavat(typ) {
  const rec = typeof typ === 'string' ? surovinyRec(typ) : typ;
  if (!rec || !info(rec.stavba ?? rec.id)) return false;
  rezim = { typ: rec.stavba ?? rec.id, rec, otoc: 0 };
  return true;
}
export const stavim = () => !!rezim;
export function zrusStavanie() { rezim = null; ukazNahlad(null); }

// bod na zemi (podlahe / vode pri mole), kam mieri stred obrazovky; kamera sa pozera cez hlavu postavy
const SMER = new THREE.Vector3();
function mierenie(kamera, hlava, voda, yaw) {
  kamera.getWorldDirection(SMER);
  for (let s = 0.6; s < 12; s += 0.1) {
    const x = hlava.x + SMER.x * s, y = hlava.y + SMER.y * s, z = hlava.z + SMER.z * s;
    const zem = voda ? Math.max(vyskaTerenu(x, z), 0) : Math.max(vyskaTerenu(x, z), vyskaPodlahy(x, z, y));
    if (y <= zem) {
      const d = Math.hypot(x - hlava.x, z - hlava.z);
      if (d >= 1.2) return [x, z];
      break;
    }
  }
  const d = voda ? 5 : 3.5;                    // pozera do neba / pod seba -> kus pred postavu
  return [hlava.x - Math.sin(yaw) * d, hlava.z - Math.cos(yaw) * d];
}

// vola sa kazdy snimok; vrati text napovedy (alebo '') a obsluzi klik/otacanie
export function aktualizujStavby(o) {
  aktualizujSvetla(o.hrac, o.t);
  if (!rezim) return '';
  if (!o.aktivne || stlacene('Mys2')) { zrusStavanie(); return ''; }
  const s = info(rezim.typ);
  if (mys.koliesko) { rezim.otoc += Math.sign(mys.koliesko); mys.koliesko = 0; }   // koliesko otaca (nie zoom)
  if (stlacene('KeyQ')) rezim.otoc++;
  const [ax, az] = mierenie(o.kamera, o.hlava, s.prichyt === 'voda', o.yaw);
  const p = miesto(rezim.typ, ax, az, o.yaw, ((rezim.otoc % 24) + 24) % 24, o.t, o.hrac.x, o.hrac.z);
  if (!mozeZaplatit(rezim.rec)) zle(p, 'Chýbajú suroviny');
  ukazNahlad(p);
  if (stlacene('Mys0')) {
    if (!p.ok) sluzby.oznam?.(p.dovod);
    else {
      const sp = s.specialne && sluzby.specialne?.[rezim.typ];
      const vysl = sp ? sp(p.x, p.z) : true;
      if (vysl !== true) sluzby.oznam?.(vysl || 'Sem sa to nedá postaviť');
      else if (zaplat(rezim.rec)) {
        if (!s.specialne) poloz(p);
        sluzby.pad?.();
        if (!mozeZaplatit(rezim.rec) || s.specialne) { sluzby.oznam?.(`${rezim.rec.ikona ?? ''} ${rezim.rec.meno ?? rezim.typ} postavené`); zrusStavanie(); return ''; }
      }
    }
  }
  const meno = (rezim.rec.meno ?? rezim.typ).toLowerCase();
  const ot = s.prichyt === 'podlaha' || s.specialne ? '' : ' · <kbd>koliesko</kbd>/<kbd>Q</kbd> otočiť';
  return `Staviaš: ${meno}${p.ok ? '' : ` – <span style="color:#ff8a7a">${p.dovod}</span>`} · <kbd>klik</kbd> postaviť${ot} · <kbd>pravý klik</kbd> zrušiť`;
}

function aktualizujSvetla(h, t) {
  const zdroje = diely.filter(d => STAVBY[d.typ]?.svetlo).sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z));
  svetla.forEach((l, i) => {
    const d = zdroje[i];
    if (!d || Math.hypot(d.x - h.x, d.z - h.z) > 80) { l.intensity = 0; return; }
    l.position.set(d.x, d.y + (STAVBY[d.typ].vyskaSvetla ?? 1.6), d.z);
    l.intensity = 4 * (0.85 + 0.15 * Math.sin(t * 13 + i * 2) * Math.sin(t * 7.3 + i));
  });
}

// ---------- kolizie (vola hrac.js) ----------
// steny: obdlznik 2 m x 0.4 m (dvere maju v strede otvor), volne stavby: valec s polomerom
export function odtlacOdStien(poz) {
  for (const d of diely) {
    if (jeStena(d.typ)) {
      if (poz.y > d.y + M || poz.y < d.y - 1.7) continue;
      const pozdlz = d.r % 2 ? poz.z - d.z : poz.x - d.x;
      const kolmo = d.r % 2 ? poz.x - d.x : poz.z - d.z;
      const min = 0.2 + 0.3;
      if (Math.abs(pozdlz) > M / 2 + 0.3 || Math.abs(kolmo) > min) continue;
      if (d.typ === 'stena_dvere' && Math.abs(pozdlz) < 0.35) continue;
      const novy = (kolmo >= 0 ? 1 : -1) * min;
      if (d.r % 2) poz.x = d.x + novy; else poz.z = d.z + novy;
      continue;
    }
    const pol = STAVBY[d.typ]?.polomer;
    if (!pol || STAVBY[d.typ].prichyt === 'voda' || poz.y > d.y + 1.8 || poz.y < d.y - 1.7) continue;
    const dx = poz.x - d.x, dz = poz.z - d.z, v = Math.hypot(dx, dz), min = pol + 0.3;
    if (v >= min || v < 1e-4) continue;
    poz.x = d.x + dx / v * min; poz.z = d.z + dz / v * min;
  }
}
// vyska podlahy / mola pod bodom (alebo -Infinity); plati len ked bod nie je hlboko pod nou
export function vyskaPodlahy(x, z, y) {
  let v = -Infinity;
  for (const d of diely) {
    if (y < d.y - 0.7) continue;
    if (d.typ === 'podlaha') { if (Math.abs(x - d.x) > M / 2 || Math.abs(z - d.z) > M / 2) continue; }
    else if (STAVBY[d.typ]?.prichyt === 'voda') {
      const dx = x - d.x, dz = z - d.z, c = Math.cos(d.u), s = Math.sin(d.u);
      if (Math.abs(dx * c - dz * s) > 1 || Math.abs(dx * s + dz * c) > 2) continue;   // lokalne 2 x 4 m
    } else continue;
    v = Math.max(v, d.y);
  }
  return v;
}

// ---------- rozobratie uderom ----------
// diel pred hracom (steny a ine stavby; podlaha/molo len ked na nich hrac nestoji)
export function najdiDiel(x, z, fx, fz) {
  let naj = null, najD = 2.2;
  for (const d of diely) {
    const dx = d.x - x, dz = d.z - z, v = Math.hypot(dx, dz);
    if (d.typ === 'podlaha' && Math.abs(dx) < M / 2 && Math.abs(dz) < M / 2) continue;
    if (STAVBY[d.typ]?.prichyt === 'voda' && vyskaPodlahy(x, z, d.y) === d.y) continue;
    if (d.typ === 'strecha' && v < 0.8) continue;                        // zvnutra chatrce ciel na steny
    const vpredu = v > 1e-3 && (dx * fx + dz * fz) / v > 0.35;
    if (!(vpredu || (jeStena(d.typ) && v < 0.6))) continue;
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
  const r = surovinyRec(d.typ);
  return r ? r.suroviny.map(([id, n]) => [id, Math.ceil(n / 2)]) : [];
}

// ---------- ukladanie ----------
export const ulozStavby = () => diely.map(d => ({ t: d.typ, x: +d.x.toFixed(3), y: +d.y.toFixed(3), z: +d.z.toFixed(3), r: d.r, u: +d.u.toFixed(4) }));
export function nacitajStavby(data) {
  if (!Array.isArray(data)) return;
  for (const d of data) if ((GEO[d?.t] || STAVBY[d?.t]) && [d.x, d.y, d.z].every(Number.isFinite))
    poloz({ typ: d.t, x: d.x, y: d.y, z: d.z, r: d.r ?? 0, u: Number.isFinite(d.u) ? d.u : (d.r ?? 0) * Math.PI / 2 });
}
export const pocetDielov = () => diely.length;
