// Taborak: polozeny ohen (kruh kamenov + polena), plamene a dym z castic, blikajuce svetlo,
// palivo (dohori -> pahreba, drevo ho znova zapali), pecenie jedla, praskanie (zvuk.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { vyskaTerenu } from './svet.js';
import { vytvorCastice } from './castice.js';
import { ohen as zvukOhna, sycanie, bublanie, zvuky } from './zvuk.js';
import { PREDMETY } from './obsah/predmety.js';
import { PECENIE, CASY, stavPecenia, dokonaly } from './obsah/jedlo.js';
import { modelHrniec, GEO_HLADINA } from './obsah/modely_varenia.js';

export const PALIVO_START = 240;     // sekund horenia po polozeni (4 minuty)
export const PALIVO_DREVO = 150;     // kolko prida jedno drevo
export const PALIVO_MAX = 600;
export const CAS_VARENIA = 7;        // sekund kym sa uvari jedlo v hrnci
const VYSKA_RAZNA = 0.92;            // razen je nad spickami plamenov, aby bolo kusy vidno
const MAX_SVETIEL = 4;               // svieti len najblizsich par ohnov (vykon)
const DOSAH_CASTIC = 90;             // dalej uz ohen castice nevypusta

const ohne = [];                     // { x, y, z, palivo, model, zeravie, polena, uhlie, pecie: [kus], hrniec, dym }
let scena = null, plamene = null, iskry = null, dym = null;
const svetla = [];

// ---------- modely (spolocne geometrie a materialy) ----------
const KAMEN = new THREE.MeshStandardMaterial({ color: 0x86827a, roughness: 0.95, flatShading: true });
const POLENO = new THREE.MeshStandardMaterial({ color: 0x5e3f26, roughness: 0.9 });
const UHLIE = new THREE.MeshStandardMaterial({ color: 0x1d1814, roughness: 1 });
const POPOL = new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 1, transparent: true, opacity: 0.85 });
let GEO_KAMENE = null, GEO_POLENA = null, GEO_POPOL = null, GEO_ZERAVIE = null, GEO_PALICA = null;
function geometrie() {
  if (GEO_KAMENE) return;
  const k = [];
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2, r = 0.62 + (i % 2) * 0.04;
    k.push(new THREE.IcosahedronGeometry(0.15 + (i * 37 % 5) * 0.012, 0).scale(1.2, 0.75, 1)
      .rotateY(a + i).translate(Math.cos(a) * r, 0.07, Math.sin(a) * r));
  }
  GEO_KAMENE = mergeGeometries(k);
  // polena do tvaru "teepee" (opreté o seba nad stredom)
  const p = [];
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + 0.3;
    p.push(new THREE.CylinderGeometry(0.045, 0.06, 0.8, 6).translate(0, 0.4, 0).rotateX(0.62).rotateY(a).translate(Math.sin(a) * -0.32, 0, Math.cos(a) * -0.32));
  }
  p.push(new THREE.CylinderGeometry(0.06, 0.06, 0.75, 6).rotateZ(Math.PI / 2).rotateY(0.4).translate(0, 0.07, 0));
  GEO_POLENA = mergeGeometries(p);
  GEO_POPOL = new THREE.CircleGeometry(0.55, 16).rotateX(-Math.PI / 2).translate(0, 0.02, 0);
  GEO_ZERAVIE = new THREE.SphereGeometry(0.3, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.28, 1);
  // razen: vodorovna palica na dvoch rozsochach
  const razen = [new THREE.CylinderGeometry(0.018, 0.018, 1.7, 5).rotateZ(Math.PI / 2).translate(0, VYSKA_RAZNA, 0)];
  for (const s of [-1, 1]) {
    razen.push(new THREE.CylinderGeometry(0.025, 0.032, VYSKA_RAZNA, 5).translate(s * 0.78, VYSKA_RAZNA / 2, 0));
    for (const v of [-1, 1]) razen.push(new THREE.CylinderGeometry(0.012, 0.018, 0.16, 4).translate(0, 0.07, 0).rotateX(v * 0.6).translate(s * 0.78, VYSKA_RAZNA - 0.03, 0));
  }
  GEO_PALICA = mergeGeometries(razen);
}

function vytvorModel(o) {
  geometrie();
  const g = new THREE.Group();
  const kamene = new THREE.Mesh(GEO_KAMENE, KAMEN); kamene.castShadow = kamene.receiveShadow = true;
  const popol = new THREE.Mesh(GEO_POPOL, POPOL);
  o.polena = new THREE.Mesh(GEO_POLENA, POLENO); o.polena.castShadow = true;
  // zeravie: zariaci (emissive) kopcek v strede, sila podla ohna
  o.zeravie = new THREE.Mesh(GEO_ZERAVIE, new THREE.MeshStandardMaterial({ color: 0x2a1408, emissive: 0xff5a10, emissiveIntensity: 0, roughness: 1 }));
  o.palica = new THREE.Mesh(GEO_PALICA, POLENO); o.palica.visible = false;   // raznik na pecenie
  g.add(kamene, popol, o.polena, o.zeravie, o.palica);
  g.position.set(o.x, o.y, o.z);
  g.rotation.y = (o.x * 13.7 + o.z * 7.1) % 6.28;
  scena.add(g);
  o.model = g;
}

// ---------- verejne funkcie ----------
export function initOhen(s) {
  scena = s;
  // plamene: aditivne, HDR jas (> prah bloomu), vrstva 0 = vidno ich aj v lome vody
  plamene = vytvorCastice(scena, { pocet: 1400, velkost: 0.85, aditivne: true, vrstva: 0, jas: 2.3 });
  iskry = vytvorCastice(scena, { pocet: 300, velkost: 0.07, aditivne: true, vrstva: 0, jas: 6 });
  dym = vytvorCastice(scena, { pocet: 700, velkost: 1.6, vrstva: 0, nepriehladnost: 0.28 });
  for (let i = 0; i < MAX_SVETIEL; i++) {
    // svetla su v scene stale (intenzita 0 ked nesvietia) -> pocet svetiel sa nemeni, shadery sa neprekompiluju
    const l = new THREE.PointLight(0xff7a30, 0, 20, 2);
    scena.add(l); svetla.push(l);
  }
}

// polozi ohen; vrati true ak sa podarilo
export function polozOhen(x, z, palivo = PALIVO_START) {
  if (ohne.some(o => Math.hypot(o.x - x, o.z - z) < 1.8)) return false;
  const o = { x, y: vyskaTerenu(x, z), z, palivo, pecie: [], hrniec: null, dym: 0, faza: Math.random() * 100 };
  vytvorModel(o);
  ohne.push(o);
  return true;
}

export const hori = o => o.palivo > 0;
export function najblizsiOhen(x, z, d = 2.6) {
  let naj = null;
  for (const o of ohne) { const v = Math.hypot(o.x - x, o.z - z); if (v < d) { d = v; naj = o; } }
  return naj;
}
export const zostava = o => o.palivo;   // sekund horenia

// prilozi jedno drevo (aj znova zapali pahrebu); vrati false ak je ohen plny
export function prilozDrevo(o) {
  if (o.palivo > PALIVO_MAX - PALIVO_DREVO * 0.5) return false;
  o.palivo = Math.min(PALIVO_MAX, o.palivo + PALIVO_DREVO);
  for (let i = 0; i < 18; i++) iskry.vypust(o.x, o.y + 0.3, o.z, (Math.random() - 0.5) * 2, 2 + Math.random() * 3, (Math.random() - 0.5) * 2, 0xffb050, 0.6 + Math.random() * 0.8, 3);
  return true;
}

// zapali pahrebu faklou (bez dreva): ohen chvilu hori, kym nan neprilozis
export function zapalFaklou(o, sekund = 45) {
  o.palivo = Math.max(o.palivo, sekund);
  for (let i = 0; i < 14; i++) iskry.vypust(o.x, o.y + 0.3, o.z, (Math.random() - 0.5) * 1.5, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 1.5, 0xffb050, 0.5 + Math.random() * 0.6, 3);
}

// ---------- razen: surove jedlo sa pecie, kym ho nezoberies (surove -> upecene -> dokonale -> spalene) ----------
export const daSaUpiect = typ => !!PECENIE[typ];
const MIESTA = [0, -0.36, 0.36];                     // polohy kusov na razni (prvy do stredu)
function pridajKus(o, typ, t = 0, miesto) {
  const [geo, mat] = PREDMETY[typ].model;
  const mesh = new THREE.Mesh(geo, mat.clone());
  geo.computeBoundingBox();
  mesh.position.y = -(geo.boundingBox.min.y + geo.boundingBox.max.y) / 2;   // stred modelu na os razna -> otaca sa okolo seba
  mesh.castShadow = true;
  mesh.scale.setScalar(1.25);
  mesh.position.y *= 1.25;
  const os = new THREE.Group();
  if (!(miesto in MIESTA) || o.pecie.some(p => p.miesto === miesto)) miesto = [0, 1, 2].find(i => !o.pecie.some(p => p.miesto === i));
  os.position.set(MIESTA[miesto], VYSKA_RAZNA, 0);
  os.rotation.x = Math.random() * 6.28;
  os.add(mesh);
  o.model.add(os);
  o.palica.visible = true;
  const kus = { typ, t, miesto, os, mesh, zaklad: mesh.material.color.clone(), stav: stavPecenia(t) };
  zafarbi(kus);
  o.pecie.push(kus);
}
export function pec(o, typ) {
  if (!hori(o) || !PECENIE[typ] || o.hrniec || o.pecie.length >= 3) return false;
  pridajKus(o, typ);
  return true;
}
// farba kusu: surova -> zlatista -> hneda -> cierna (nasobi farby modelu)
let FARBY_PECENIA = null;
const odtien = new THREE.Color();
function zafarbi(p) {
  FARBY_PECENIA ??= [[0, 0xffffff], [CASY.upecene, 0xe8a860], [CASY.dokonale + 1, 0xd8893a], [CASY.spalene, 0x6a3a1c], [CASY.koniec, 0x141009]]
    .map(([t, c]) => [t, new THREE.Color(c)]);
  let i = 1;
  while (i < FARBY_PECENIA.length - 1 && p.t > FARBY_PECENIA[i][0]) i++;
  const [t0, c0] = FARBY_PECENIA[i - 1], [t1, c1] = FARBY_PECENIA[i];
  odtien.copy(c0).lerp(c1, THREE.MathUtils.clamp((p.t - t0) / (t1 - t0), 0, 1));
  p.mesh.material.color.copy(p.zaklad).multiply(odtien);
}
// ktory kus zoberie E: dokonaly > upeceny (najdlhsie na ohni) > spaleny; surovy len ked ohen nehori
export function kusNaZobratie(o) {
  const poradie = [hori(o) ? 0 : 1, 3, 4, 2];
  let naj = null, nb = 0;
  for (const p of o.pecie) {
    const v = poradie[stavPecenia(p.t)], b = v * 1000 + p.t;
    if (v > 0 && b > nb) { naj = p; nb = b; }
  }
  return naj;
}
// co z kusu dostanes
export const vysledokKusu = p => [p.typ, PECENIE[p.typ], dokonaly(PECENIE[p.typ]), 'spalene'][stavPecenia(p.t)];
export function zoberKus(o, p) {
  o.pecie.splice(o.pecie.indexOf(p), 1);
  o.model.remove(p.os); p.mesh.material.dispose();
  o.palica.visible = o.pecie.length > 0;
}

// ---------- hrniec na ohni ----------
// o.hrniec = { var: { id, t } | null (prave sa vari), hotove: id | null (caka na vybratie), model }
function postavHrniec(o) {
  const [geo, mat] = modelHrniec();
  const g = new THREE.Group();
  const nadoba = new THREE.Mesh(geo, mat); nadoba.castShadow = true;
  const hladina = new THREE.Mesh(GEO_HLADINA, new THREE.MeshStandardMaterial({ color: 0x4a7a8a, roughness: 0.25 }));
  g.add(nadoba, hladina);
  g.position.y = 0.4; g.scale.setScalar(1.45);
  o.model.add(g);
  o.hrniec = { var: null, hotove: null, g, hladina };
}
export function dajHrniec(o) {
  if (!hori(o) || o.hrniec || o.pecie.length) return false;
  postavHrniec(o);
  return true;
}
export function zoberHrniec(o) {
  if (!o.hrniec || o.hrniec.var || o.hrniec.hotove) return false;
  o.model.remove(o.hrniec.g); o.hrniec.hladina.material.dispose();
  o.hrniec = null;
  return true;
}
export function zacniVarit(o, id) {
  if (!hori(o) || !o.hrniec || o.hrniec.var || o.hrniec.hotove) return false;
  o.hrniec.var = { id, t: 0 };
  return true;
}

// volat kazdy snimok; vrati { priOhni: bool (hrac je pri horiacom ohni), uvarene: [id jedal, ktore sa prave dovarili] }
const kde = new THREE.Vector3(), tmp = new THREE.Color(), FARBY = [0xffb347, 0xff7a1a, 0xff5208, 0xffd27a];
export function aktualizujOhne(dt, cas, hrac, vietor = { smer: 0, sila: 0 }) {
  const uvarene = [], zmeny = new Set();                 // zmeny = zvuky ('cink' dokonale, 'zhorelo', 'uvarene')
  let priOhni = false, najD = Infinity, sycStav = 0, sycSila = 0, bubSila = 0;
  const vx = Math.cos(vietor.smer) * vietor.sila * 0.6, vz = Math.sin(vietor.smer) * vietor.sila * 0.6;
  for (const o of ohne) {
    const d = Math.hypot(o.x - hrac.x, o.z - hrac.z);
    o.d = d;
    const bolo = o.palivo > 0;
    o.palivo = Math.max(0, o.palivo - dt);
    if (bolo && !o.palivo) o.dym = 40;                       // dohorel: este chvilu dymi
    const sila = hori(o) ? THREE.MathUtils.clamp(o.palivo / 45, 0.3, 1) : 0;
    o.sila = sila;
    if (sila && d < 4.2) priOhni = true;
    if (sila && d < najD) najD = d;
    // vzhlad: polena zuhoľnatia, ked dohori; zeravie blika
    o.polena.material = sila ? POLENO : UHLIE;
    o.polena.scale.setScalar(sila ? 0.75 + 0.25 * Math.min(1, o.palivo / 200) : 0.6);
    const blik = 0.8 + 0.2 * Math.sin(cas * 9 + o.faza) * Math.sin(cas * 23.7 + o.faza);
    o.dym = Math.max(0, o.dym - dt);
    o.zeravie.material.emissiveIntensity = sila ? (1.4 + sila * 1.6) * blik : o.dym / 40 * 0.9;
    // pecenie
    const blizko = Math.max(0, 1 - d / 12);
    for (const p of o.pecie) {
      if (!sila) continue;
      p.t += dt;
      p.os.rotation.x += dt * 1.1;                          // pomaly sa otaca nad ohnom
      zafarbi(p);
      const st = stavPecenia(p.t);
      if (st !== p.stav) { p.stav = st; if (st >= 2 && d < 12) zmeny.add(st === 2 ? 'cink' : 'zhorelo'); }
      // sycanie podla najpokrocilejsieho kusu; zuholnateny po chvili stichne
      const hlas = blizko * (p.t > CASY.koniec + 8 ? 0.25 : 1);
      if (hlas > 0 && (!sycSila || st > sycStav)) { sycStav = st; sycSila = hlas; }
      if (d > DOSAH_CASTIC) continue;
      // para z upeceneho, tmavy dym pri spalovani, zlate iskricky pri dokonalom
      p.os.getWorldPosition(kde);
      if (p.t > CASY.upecene * 0.6 && p.t < CASY.spalene - 1 && Math.random() < dt * 5)
        dym.vypust(kde.x, kde.y + 0.1, kde.z, vx * 0.5 + (Math.random() - 0.5) * 0.15, 0.5 + Math.random() * 0.3, vz * 0.5 + (Math.random() - 0.5) * 0.15, 0xf4f1ea, 0.8 + Math.random() * 0.6, -0.1);
      if (p.t > CASY.spalene - 1) {
        const k = Math.min(1, (p.t - CASY.spalene + 1) / 4) * (p.t > CASY.koniec + 15 ? 0.3 : 1);
        for (let n = Math.floor(dt * 22 * k + Math.random()); n > 0; n--)
          dym.vypust(kde.x + (Math.random() - 0.5) * 0.15, kde.y + 0.1, kde.z + (Math.random() - 0.5) * 0.15, vx + (Math.random() - 0.5) * 0.3, 0.7 + Math.random() * 0.6, vz + (Math.random() - 0.5) * 0.3, 0x1c1917, 1.4 + Math.random() * 1.4, -0.15);
      }
      if (st === 2 && Math.random() < dt * 9) iskry.vypust(kde.x + (Math.random() - 0.5) * 0.25, kde.y + (Math.random() - 0.3) * 0.2, kde.z + (Math.random() - 0.5) * 0.25, 0, 0.35, 0, 0xffe27a, 0.6, 0);
    }
    // hrniec: varenie ide len na horiacom ohni
    const h = o.hrniec;
    if (h) {
      if (h.var && sila) {
        h.var.t += dt;
        bubSila = Math.max(bubSila, blizko);
        if (h.var.t >= CAS_VARENIA) { h.hotove = h.var.id; h.var = null; uvarene.push(h.hotove); if (d < 12) zmeny.add('uvarene'); }
      }
      const jedlo = h.var?.id ?? h.hotove;
      h.hladina.material.color.lerp(tmp.set(PREDMETY[jedlo]?.farbaHladiny ?? '#4a7a8a'), Math.min(1, dt * (h.var ? 0.6 : 4)));
      h.hladina.position.y = h.var && sila ? Math.sin(cas * 17) * 0.004 : 0;
      if (sila && d < DOSAH_CASTIC && Math.random() < dt * (h.var ? 12 : h.hotove ? 4 : 0))
        dym.vypust(o.x + (Math.random() - 0.5) * 0.25, o.y + 0.78, o.z + (Math.random() - 0.5) * 0.25, vx * 0.4, 0.45 + Math.random() * 0.35, vz * 0.4, 0xf4f1ea, 0.9 + Math.random(), -0.08);
    }
    // castice len pre blizke ohne
    if (d > DOSAH_CASTIC) continue;
    const y = o.y;
    if (sila) {
      const podHrncom = o.hrniec || o.pecie.length ? 0.45 : 1;   // pod hrncom a raznom su plamene nizke, aby ich nezakryli
      for (let n = Math.floor(90 * sila * podHrncom * dt + Math.random()); n > 0; n--) {
        const a = Math.random() * 6.28, r = Math.random() ** 1.5 * 0.3 * (0.6 + 0.4 * sila);
        plamene.vypust(o.x + Math.cos(a) * r, y + 0.12, o.z + Math.sin(a) * r,
          -Math.cos(a) * r * 0.6 + vx * 0.3, 0.6 + Math.random() * 1.1 * sila, -Math.sin(a) * r * 0.6 + vz * 0.3,
          FARBY[Math.floor(Math.random() * 4)], (0.35 + Math.random() * 0.45 * sila) * podHrncom, -2.2);
      }
      if (Math.random() < dt * 6 * sila) iskry.vypust(o.x, y + 0.4, o.z, (Math.random() - 0.5) * 1.2 + vx, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 1.2 + vz, 0xffa040, 0.8 + Math.random() * 1.2, 0.6);
    }
    if ((sila || o.dym) && Math.random() < dt * (sila ? 7 : 3 * o.dym / 40)) {
      dym.vypust(o.x + (Math.random() - 0.5) * 0.3, y + (sila ? 1.1 : 0.3), o.z + (Math.random() - 0.5) * 0.3,
        vx + (Math.random() - 0.5) * 0.3, 0.7 + Math.random() * 0.5, vz + (Math.random() - 0.5) * 0.3, sila ? 0x6b6660 : 0x8a8580, 3.5 + Math.random() * 2, -0.08);
    }
  }
  plamene.aktualizuj(dt); iskry.aktualizuj(dt); dym.aktualizuj(dt);

  // svetla: najblizsie horiace ohne, blikanie (sucet sinusov + trochu sumu)
  const horiace = ohne.filter(o => o.sila > 0).sort((a, b) => a.d - b.d);
  svetla.forEach((l, i) => {
    const o = horiace[i];
    if (!o) { l.intensity = 0; return; }
    const f = 0.82 + 0.1 * Math.sin(cas * 11 + o.faza) + 0.06 * Math.sin(cas * 27.3 + o.faza * 2) + 0.05 * Math.random();
    l.intensity = 26 * o.sila * f;
    l.position.set(o.x + Math.sin(cas * 7 + o.faza) * 0.06, o.y + 0.9, o.z + Math.cos(cas * 6 + o.faza) * 0.06);
  });
  // zvuk: hlasitost podla vzdialenosti k najblizsiemu horiacemu ohnu
  zvukOhna(najD < 25 ? (1 - najD / 25) ** 2 : 0);
  sycanie(sycStav, sycSila);
  bublanie(bubSila);
  zmeny.forEach(z => zvuky[z]());
  return { priOhni, uvarene };
}

export function ulozOhne() {
  return ohne.map(o => ({ x: +o.x.toFixed(2), z: +o.z.toFixed(2), p: Math.round(o.palivo), pecie: o.pecie.map(p => ({ typ: p.typ, t: +p.t.toFixed(1), m: p.miesto })),
    hrniec: o.hrniec ? { var: o.hrniec.var, hotove: o.hrniec.hotove } : undefined }));
}
export function nacitajOhne(data) {
  if (!Array.isArray(data)) return;
  for (const d of data) {
    if (!Number.isFinite(d?.x) || !Number.isFinite(d?.z)) continue;
    polozOhen(d.x, d.z, Math.max(0, +d.p || 0));
    const o = ohne[ohne.length - 1];
    if (!o) continue;
    for (const k of Array.isArray(d.pecie) ? d.pecie.slice(0, 3) : []) {
      const typ = typeof k === 'string' ? k : k?.typ;       // stare ulozenie: len nazov suroviny
      if (PECENIE[typ]) pridajKus(o, typ, +k?.t || 0, k?.m);
    }
    if (d.hrniec) {
      postavHrniec(o);
      if (PREDMETY[d.hrniec.var?.id]) o.hrniec.var = { id: d.hrniec.var.id, t: +d.hrniec.var.t || 0 };
      if (PREDMETY[d.hrniec.hotove]) o.hrniec.hotove = d.hrniec.hotove;
    }
  }
}
export const pocetOhnov = () => ohne.length;
