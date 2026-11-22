// Vegetacia: modely rastlin su v svet/modely.js, tu je rozmiestnenie podla biomu ostrova, vykreslenie ako InstancedMesh
// (tisice kusov = 1 kreslenie), "uzly" (rastliny s hitboxom a zivotmi), zber plodov a dorastanie (ekosystem).
//
// Kazda rastlina je uzol a da sa:
//  (a) ZBIERAT na E bez znicenia (najdiZber): plody zmiznu a po case dorastu (stavRastlin / nacitajStavRastlin ukladaju cakanie),
//  (b) NICIT udieranim (poskod): po zniceni padne vynos zo ZDROJE[typ].vynos.
// Trava nie je uzol: na E sa trha po 3 m polickach s cooldownom.
import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { ZDROJE, hodVynos } from './obsah/zdroje.js';
import { DRUHY, M } from './svet/modely.js';
import { BUNKA } from './svet.js';

const perlin = new ImprovedNoise();
const V3 = THREE.Vector3;
const NULA = new THREE.Matrix4().makeScale(0, 0, 0);
const BUNKA_TRAVY = 3;                 // velkost policka na trhanie travy (m)

// ---------- pravidla rozmiestnenia druhov (druh = typ uzla = kluc v ZDROJE) ----------
// ymin/ymax: vyska terenu, sklon: max sklon, odstup: min vzdialenost od ostatnych (m), m: rozsah mierky,
// rK: polomer hitboxu (0 = da sa prejst), rZ: dosah zasahu/zberu, odtien: nahodne zafarbenie, naklon, dy: posun do zeme
const PRAVIDLA = {
  palma:    { ymin: 0.8, ymax: 10, sklon: 0.9, odstup: 3.2, m: [0.8, 1.25], rK: 0.32, rZ: 0.5, odtien: 0.12, naklon: 0.05, dy: -0.1 },
  mangrova: { ymin: -0.9, ymax: 1.1, sklon: 1.2, odstup: 3.6, m: [0.8, 1.2], rK: 0.45, rZ: 0.9, odtien: 0.1, naklon: 0.02, dy: -0.15 },
  strom:    { ymin: 2.5, sklon: 1.3, odstup: 4, m: [0.8, 1.3], rK: 0.38, rZ: 0.6, odtien: 0.15, naklon: 0.06, dy: -0.2 },
  mango:    { ymin: 1.5, ymax: 9, sklon: 1.0, odstup: 4.5, m: [0.8, 1.2], rK: 0.35, rZ: 0.7, odtien: 0.12, naklon: 0.04, dy: -0.15 },
  akacia:   { ymin: 1.2, ymax: 9, sklon: 0.8, odstup: 6, m: [0.8, 1.3], rK: 0.3, rZ: 0.7, odtien: 0.12, naklon: 0.06, dy: -0.15 },
  bambus:   { ymin: 1.0, ymax: 9, sklon: 1.2, odstup: 1.8, m: [0.8, 1.3], rK: 0.3, rZ: 0.7, odtien: 0.1, naklon: 0.04, dy: -0.1 },
  banan:    { ymin: 1.5, ymax: 9, sklon: 1.2, odstup: 2.4, m: [0.8, 1.25], rK: 0, rZ: 0.9, odtien: 0.1, naklon: 0.08, dy: -0.1 },
  bobule:   { ymin: 1.3, sklon: 1.5, odstup: 1.4, m: [0.8, 1.2], rK: 0, rZ: 0.9, odtien: 0.12, naklon: 0.1, dy: -0.1 },
  ker:      { ymin: 1.6, sklon: 1.5, odstup: 1.2, m: [0.8, 1.4], rK: 0, rZ: 0.9, odtien: 0.12, naklon: 0.1, dy: -0.1 },
  ibistek:  { ymin: 1.6, sklon: 1.5, odstup: 1.2, m: [0.8, 1.3], rK: 0, rZ: 0.9, odtien: 0.08, naklon: 0.1, dy: -0.1 },
  ananas:   { ymin: 1.3, ymax: 6, sklon: 1.0, odstup: 1.2, m: [0.9, 1.3], rK: 0, rZ: 0.6, odtien: 0.08, naklon: 0.05, dy: -0.02 },
  aloe:     { ymin: 1.0, ymax: 7, sklon: 1.3, odstup: 1.0, m: [0.8, 1.4], rK: 0, rZ: 0.6, odtien: 0.08, naklon: 0.05, dy: -0.02 },
  taro:     { ymin: 0.1, ymax: 3, sklon: 1.0, odstup: 1.4, m: [0.9, 1.3], rK: 0, rZ: 0.7, odtien: 0.1, naklon: 0.05, dy: -0.03 },
  trstina:  { ymin: 0.15, ymax: 2.2, sklon: 1.2, odstup: 1.0, m: [0.9, 1.4], rK: 0, rZ: 0.7, odtien: 0.1, naklon: 0.08, dy: -0.05 },
  papradie: { ymin: 1.8, sklon: 1.5, odstup: 0, m: [0.7, 1.4], rK: 0, rZ: 0.7, odtien: 0.15, naklon: 0.1, dy: 0 },
  huba:     { ymin: 2.0, sklon: 1.2, odstup: 0, m: [0.8, 1.4], rK: 0, rZ: 0.5, odtien: 0.1, naklon: 0.1, dy: 0 },
  kvet:     { ymin: 1.7, sklon: 1.0, odstup: 0, m: [0.8, 1.4], rK: 0, rZ: 0.6, odtien: 0.05, naklon: 0.1, dy: 0 },
};
const PORADIE = ['palma', 'mangrova', 'strom', 'mango', 'akacia', 'bambus', 'balvan', 'obsidian', 'banan', 'bobule', 'ker', 'ibistek', 'ananas',
  'aloe', 'taro', 'trstina', 'papradie', 'huba', 'kvet', 'trava', 'kamienky'];

// hustota = pokusov na 100 m2 ostrova (k = nasobok poctu pokusov pre biomy, kde je sucho malo)
const HUSTOTY = {
  palmovy:  { palma: 0.9, strom: 0.08, ker: 0.5, ibistek: 0.25, papradie: 0.2, trava: 22, kvet: 0.6, balvan: 0.12, kamienky: 0.4, aloe: 0.15, bobule: 0.12, banan: 0.08, trstina: 0.2, taro: 0.1 },
  dzungla:  { palma: 0.3, strom: 0.9, mango: 0.12, banan: 0.5, ker: 0.6, ibistek: 0.15, bobule: 0.35, papradie: 1.6, trava: 14, kvet: 0.4, huba: 0.6, taro: 0.3, balvan: 0.18, kamienky: 0.3, bambus: 0.1 },
  skalnaty: { palma: 0.2, strom: 0.1, ker: 0.3, aloe: 0.35, papradie: 0.1, trava: 8, kvet: 0.2, balvan: 0.7, kamienky: 1.2, bobule: 0.1 },
  atol:     { k: 1.8, palma: 1.4, ker: 0.3, trava: 8, aloe: 0.15, kvet: 0.15, kamienky: 1, trstina: 0.2, ibistek: 0.2 },
  sopecny:  { palma: 0.06, papradie: 0.15, aloe: 0.1, balvan: 0.8, obsidian: 0.22, kamienky: 1.5, trava: 1.5 },
  mangrovy: { k: 1.2, mangrova: 1.6, palma: 0.1, trstina: 0.6, taro: 0.3, papradie: 0.2, kamienky: 0.3 },
  bambusovy: { bambus: 1.0, strom: 0.15, papradie: 0.5, ker: 0.3, banan: 0.1, trava: 8, kvet: 0.2, huba: 0.15, balvan: 0.1, trstina: 0.05, kamienky: 0.2 },
  savana:   { akacia: 0.12, strom: 0.05, mango: 0.05, ker: 0.3, bobule: 0.15, ibistek: 0.15, aloe: 0.2, ananas: 0.05, trava: 38, kvet: 1.2, balvan: 0.1, kamienky: 0.4 },
  plytcina: { k: 1.6, palma: 0.5, ker: 0.2, trava: 3, kamienky: 0.6, trstina: 0.05 },
  ovocny:   { mango: 0.6, banan: 0.7, palma: 0.3, ananas: 0.6, bobule: 0.5, ker: 0.3, ibistek: 0.2, kvet: 0.5, trava: 14, taro: 0.1, papradie: 0.2, strom: 0.1 },
};

// ---------- stav rastlin: zber a dorastanie ----------
let cas = 0;                           // herny cas (sekundy), nastavuje aktualizujUzly
const zber = new Map();                // id uzla / policka travy -> cas, kedy dorastie (uklada sa)
const cakajuce = new Map();            // id -> { koniec, isl, obnov } len pre nahrate ostrovy
const ostrovy = new Map();             // "bx,bz" -> { uzly, travaBunky, trava, kl }
const aktivne = new Set();             // uzly s animaciou (trasenie, padanie)

export function stavRastlin() {
  const o = {};
  for (const [k, v] of zber) if (v > cas) o[k] = Math.round(v);
  return o;
}
export function nacitajStavRastlin(obj) {
  zber.clear();
  if (obj) for (const k of Object.keys(obj)) zber.set(k, Number(obj[k]));
}

const mScr = new THREE.Matrix4(), qScr = new THREE.Quaternion(), pScr = new V3(), sScr = new V3();
const zapisCast = c => {
  mScr.compose(c.poz, c.q, c.s);
  c.im.setMatrixAt(c.i, mScr);
  c.im.instanceMatrix.needsUpdate = true;
};
function skryPlod(u) {
  u.skryty = true;
  for (const c of u.casti) if (c.plod) { c.im.setMatrixAt(c.i, NULA); c.im.instanceMatrix.needsUpdate = true; }
}
function zobrazPlod(u) {
  u.skryty = false;
  if (u.zniceny) return;
  for (const c of u.casti) if (c.plod) zapisCast(c);
}

// ---------- rozmiestnenie na ostrove ----------
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s3 = new V3(), p3 = new V3(), farba = new THREE.Color();

// asi 40 % ostrovov je "bujnych" - vegetacia 2.5x hustejsia (nie sopky a plytciny)
export const jeBujny = o => o.biom !== 'sopecny' && o.biom !== 'plytcina' && (o.seed % 100) < 40;
export let nasobokHustoty = 1;                      // dev rezim: globalny nasobok hustoty
export function nastavHustotu(n) { nasobokHustoty = n; }

export function postavVegetaciu(o, skupina, r, h, zobrate) {
  const B = HUSTOTY[o.biom] || HUSTOTY.palmovy;
  const kl = o.bx + ',' + o.bz;
  const bujnost = (jeBujny(o) ? 2.5 : 1) * nasobokHustoty;
  const plocha = Math.PI * o.R * o.R / 100 * 1.18 * (B.k || 1) * bujnost;
  const rozsah = o.R * 1.25;
  const obsadene = new Map();          // jednoducha mriezka 2 m, aby stromy neboli v sebe
  const volne = (x, z, d) => {
    const k = Math.ceil(d / 2), gx = Math.floor(x / 2), gz = Math.floor(z / 2);
    for (let i = -k; i <= k; i++) for (let j = -k; j <= k; j++) {
      const o2 = obsadene.get((gx + i) + ',' + (gz + j));
      if (o2 && Math.hypot(o2[0] - x, o2[1] - z) < d) return false;
    }
    return true;
  };
  const obsad = (x, z) => obsadene.set(Math.floor(x / 2) + ',' + Math.floor(z / 2), [x, z]);
  const bod = () => {
    const x = o.x + (r() * 2 - 1) * rozsah, z = o.z + (r() * 2 - 1) * rozsah;
    return { x, z, y: h(x, z) };
  };
  const sklon = b => Math.abs(h(b.x + 1, b.z) - b.y) + Math.abs(h(b.x, b.z + 1) - b.y);

  const davky = new Map();             // "druh:varianta" -> [{x,y,z,rot,nx,nz,mierka,odtien,uzol}]
  const pridaj = (druh, v, x, y, z, mierka, odtien, uzol, naklon = 0.1) => {
    const k = druh + ':' + v;
    if (!davky.has(k)) davky.set(k, []);
    davky.get(k).push({ x, y, z, rot: r() * 6.28, nx: (r() - 0.5) * naklon, nz: (r() - 0.5) * naklon, mierka, odtien, uzol });
  };
  const uzly = [];
  const pocty = {};
  const travaBunky = new Set();
  const uzol = (typ, x, y, z, rKolizia, rZasah) => {
    pocty[typ] = (pocty[typ] || 0) + 1;
    const id = `${kl},${typ}${pocty[typ]}`;
    const zdroj = ZDROJE[typ];
    const u = { id, kl, typ, x, y, z, rKolizia, rZasah, zivoty: zdroj.zivoty, zdroj, zber: zdroj.zber || null,
      zniceny: zobrate.has(id), skryty: false, casti: [], tras: 0, pad: -1, osX: 1, osZ: 0 };
    uzly.push(u);
    return u;
  };
  const druhBalvanu = o.biom === 'dzungla' ? 'kamenMach' : o.biom === 'sopecny' ? 'kamenSopka' : 'kamen';

  for (const druh of PORADIE) {
    const hustota = B[druh];
    if (!hustota) continue;
    const pokusov = Math.min(plocha * hustota, druh === 'trava' ? (bujnost > 1 ? 18000 : 12000) : 9000);
    for (let i = 0; i < pokusov; i++) {
      const b = bod();
      if (druh === 'trava') {
        const maska = o.biom === 'savana' ? -0.7 : -0.2;
        if (b.y > (o.plazH ? Math.max(0.6, o.plazH(b.x, b.z) - 0.3) : 1.5) && perlin.noise(b.x * 0.05, b.z * 0.05, o.seed) > maska && sklon(b) < 1.4) {
          pridaj('trava', Math.floor(r() * 2), b.x, b.y - 0.05, b.z, 0.9 + r() * 0.8, 0.25);
          travaBunky.add(Math.floor(b.x / BUNKA_TRAVY) + ',' + Math.floor(b.z / BUNKA_TRAVY));
        }
        continue;
      }
      if (druh === 'kamienky') {
        if (b.y > -3) pridaj(druhBalvanu, 0, b.x, b.y - 0.05, b.z, 0.12 + r() * 0.35, 0.1, null, 1);
        continue;
      }
      if (druh === 'balvan') {
        if (b.y < 0.4 || !volne(b.x, b.z, 2.5)) continue;
        obsad(b.x, b.z);
        const mierka = 0.8 + r() * 1.0;
        pridaj(druhBalvanu, Math.floor(r() * DRUHY[druhBalvanu].varianty.length), b.x, b.y - 0.15 * mierka, b.z, mierka, 0.1,
          uzol('balvan', b.x, b.y, b.z, 0.85 * mierka, 0.3), 0.4);
        continue;
      }
      if (druh === 'obsidian') {                       // obsidianova zila (len sopecny ostrov), ostra, treba krompac
        if (b.y < 1 || !volne(b.x, b.z, 2.5)) continue;
        obsad(b.x, b.z);
        const mierka = 0.8 + r() * 0.7;
        pridaj('obsidianZila', Math.floor(r() * DRUHY.obsidianZila.varianty.length), b.x, b.y - 0.1 * mierka, b.z, mierka, 0.05,
          uzol('obsidian', b.x, b.y, b.z, 0.7 * mierka, 0.3), 0.15);
        continue;
      }
      const P = PRAVIDLA[druh];
      if (b.y < P.ymin || b.y > (P.ymax ?? 99)) continue;
      if (P.sklon !== undefined && sklon(b) > P.sklon) continue;
      if (P.odstup && !volne(b.x, b.z, P.odstup)) continue;
      if (P.odstup >= 2.5) obsad(b.x, b.z);
      const mierka = P.m[0] + r() * (P.m[1] - P.m[0]);
      const v = Math.floor(r() * DRUHY[druh].varianty.length);
      pridaj(druh, v, b.x, b.y + P.dy, b.z, mierka, P.odtien, uzol(druh, b.x, b.y, b.z, P.rK * mierka, P.rZ), P.naklon);
    }
  }

  // davky -> InstancedMesh (zaklad + volitelne plody ako samostatna vrstva)
  const trava = [];
  for (const [k, polozky] of davky) {
    const [druh, v] = k.split(':');
    const D = DRUHY[druh], va = D.varianty[v], mat = M[D.mat];
    const vyrob = geo => {
      const im = new THREE.InstancedMesh(geo, mat, polozky.length);
      im.receiveShadow = true;
      skupina.add(im);
      return im;
    };
    const zak = vyrob(va.zaklad);
    zak.castShadow = D.stin;
    const plod = va.plody ? vyrob(va.plody) : null;
    if (druh === 'trava') trava.push({ im: zak, polozky });
    polozky.forEach((it, i) => {
      e.set(it.nx, it.rot, it.nz); q.setFromEuler(e);
      s3.setScalar(it.mierka);
      m4.compose(p3.set(it.x, it.y, it.z), q, s3);
      const t = (r() - 0.5) * it.odtien * 2, jas = 1 + (r() - 0.5) * it.odtien * 1.5;   // trochu zltsie/modrejsie + jas
      farba.setRGB((1 + t * 0.5) * jas, (1 + t * 0.15) * jas, (1 - t * 0.6) * jas);
      const skry = it.uzol && it.uzol.zniceny;
      zak.setMatrixAt(i, skry ? NULA : m4); zak.setColorAt(i, farba);
      if (plod) { plod.setMatrixAt(i, skry ? NULA : m4); plod.setColorAt(i, farba); }
      if (it.uzol) {
        const cast = (im, plodova) => ({ im, i, poz: p3.clone(), q: q.clone(), s: s3.clone(), plod: plodova });
        it.uzol.casti = plod ? [cast(zak, false), cast(plod, true)] : [cast(zak, false)];
      }
    });
  }

  const data = { uzly, travaBunky, trava, kl };
  ostrovy.set(kl, data);

  // obnovenie ulozeneho stavu: plody, ktore este dorastaju, ostanu skryte
  for (const u of uzly) {
    if (!u.zber || u.zniceny) continue;
    const koniec = zber.get(u.id);
    if (koniec === undefined) continue;
    if (koniec <= cas) { zber.delete(u.id); continue; }
    skryPlod(u);
    cakajuce.set(u.id, { koniec, isl: kl, obnov: () => zobrazPlod(u) });
  }
  const predpona = kl + ',T';
  for (const [k, koniec] of zber) {
    if (!k.startsWith(predpona)) continue;
    if (koniec <= cas) { zber.delete(k); continue; }
    const [gx, gz] = k.slice(predpona.length).split('_').map(Number);
    skryTravu(data, gx, gz, k, koniec);
  }
  return uzly;
}

// ostrov sa uvolnil z pamate (volat zo svet.js)
export function uvolniVegetaciu(kl) {
  ostrovy.delete(kl);
  for (const [k, v] of cakajuce) if (v.isl === kl) cakajuce.delete(k);
  for (const u of aktivne) if (u.kl === kl) aktivne.delete(u);
}

// ---------- trava: zber po policku 3 x 3 m ----------
function skryTravu(d, gx, gz, kluc, koniec) {
  const povodne = [], m = new THREE.Matrix4(), p = new V3(), qq = new THREE.Quaternion(), s = new V3();
  for (const { im, polozky } of d.trava) {
    polozky.forEach((it, i) => {
      if (Math.floor(it.x / BUNKA_TRAVY) !== gx || Math.floor(it.z / BUNKA_TRAVY) !== gz) return;
      im.getMatrixAt(i, m);
      povodne.push([im, i, m.clone()]);
      m.decompose(p, qq, s);
      s.y *= 0.15;
      im.setMatrixAt(i, m.compose(p, qq, s));
      im.instanceMatrix.needsUpdate = true;
    });
  }
  cakajuce.set(kluc, { koniec, isl: d.kl, obnov: () => {
    for (const [im, i, mat] of povodne) { im.setMatrixAt(i, mat); im.instanceMatrix.needsUpdate = true; }
  } });
}

// ---------- zber (E) ----------
// Najblizsia zberatelna rastlina pred hracom do ~2 m (fx, fz = smer pohladu), inak travne policko.
// Vrati null alebo { text, akcia }; akcia() vykona zber a vrati pole [[predmet, pocet], ...].
export function najdiZber(x, z, fx, fz) {
  const d = ostrovy.get(Math.floor(x / BUNKA) + ',' + Math.floor(z / BUNKA));
  if (!d) return null;
  let naj = null, najD = Infinity;
  for (const u of d.uzly) {
    if (!u.zber || u.zniceny || u.skryty) continue;
    const dx = u.x - x, dz = u.z - z, dd = Math.hypot(dx, dz);
    if (dd > Math.min(u.rZasah + 1.0, 2.2) || dd >= najD) continue;
    if (dd > 0.7 && (dx * fx + dz * fz) / dd < 0.3) continue;
    naj = u; najD = dd;
  }
  if (naj) {
    const u = naj;
    return { text: u.zber.text, akcia: () => zberUzla(u, fx, fz) };
  }
  for (const [px, pz] of [[x + fx * 0.9, z + fz * 0.9], [x, z]]) {
    const gx = Math.floor(px / BUNKA_TRAVY), gz = Math.floor(pz / BUNKA_TRAVY);
    if (!d.travaBunky.has(gx + ',' + gz)) continue;
    const kluc = `${d.kl},T${gx}_${gz}`;
    if (zber.has(kluc)) continue;
    return { text: ZDROJE.trava.zber.text, akcia: () => zberTravy(d, gx, gz, kluc) };
  }
  return null;
}

const nahodnyCas = minuty => cas + minuty * 60 * (0.85 + Math.random() * 0.3);

function zberUzla(u, fx, fz) {
  if (u.zniceny || u.skryty) return [];
  const vynos = hodVynos(u.zber.vynos);
  const koniec = nahodnyCas(u.zber.cas);
  skryPlod(u);
  zber.set(u.id, koniec);
  cakajuce.set(u.id, { koniec, isl: u.kl, obnov: () => zobrazPlod(u) });
  u.tras = 0.35; u.osX = fz; u.osZ = -fx;           // zatrasie sa
  aktivne.add(u);
  return vynos;
}

function zberTravy(d, gx, gz, kluc) {
  const koniec = nahodnyCas(ZDROJE.trava.zber.cas);
  zber.set(kluc, koniec);
  skryTravu(d, gx, gz, kluc, koniec);
  return hodVynos(ZDROJE.trava.zber.vynos);
}

// ---------- zasahy (uder) ----------
// najblizsi uzol pred hracom (fx, fz = smer pohladu)
export function najdiCiel(uzly, x, z, fx, fz) {
  let naj = null, najD = Infinity;
  for (const u of uzly) {
    if (u.zniceny) continue;
    const dx = u.x - x, dz = u.z - z, d = Math.hypot(dx, dz);
    if (d < u.rZasah + 1.4 && d < najD && (d < 0.6 || (dx * fx + dz * fz) / d > 0.35)) { naj = u; najD = d; }
  }
  return naj;
}

// uder: poskodenie = kolko zivota ubudne (nastroj; 0 = ziadny efekt). Vrati vynos [[predmet, pocet], ...] ak sa uzol znicil, inak null
export function poskod(u, fx, fz, poskodenie = 1) {
  if (u.zniceny || !(poskodenie > 0)) return null;
  u.zivoty -= poskodenie;
  u.tras = 0.35;
  u.osX = fz; u.osZ = -fx;            // os naklonu kolmo na smer uderu
  aktivne.add(u);
  if (u.zivoty > 0) return null;
  u.zniceny = true;
  u.pad = 0;
  zber.delete(u.id);
  cakajuce.delete(u.id);
  const vynos = hodVynos(u.zdroj.vynos);
  if (u.zber && !u.skryty) vynos.push(...hodVynos(u.zber.vynos));   // nezobrane plody padnu tiez
  return vynos;
}

// ---------- animacie a dorastanie ----------
const PADA = new Set(['palma', 'strom', 'mangrova', 'mango', 'akacia', 'bambus', 'banan']);
const qPad = new THREE.Quaternion(), os = new V3();

// volat kazdy snimok; casHry = herny cas v sekundach (ak sa nezada, pocita sa z dt)
export function aktualizujUzly(dt, casHry) {
  cas = casHry === undefined ? cas + dt : casHry;
  for (const [k, v] of cakajuce) {
    if (v.koniec > cas) continue;
    v.obnov();
    zber.delete(k);
    cakajuce.delete(k);
  }
  for (const u of aktivne) {
    let uhol = 0, mierka = 1;
    if (u.pad >= 0) {                  // padanie (stromy) alebo zmiznutie (kriky, balvany)
      u.pad += dt;
      if (PADA.has(u.typ)) {
        uhol = Math.min(Math.pow(u.pad / 1.3, 2.2), 1) * 1.5;
        if (u.pad > 2) mierka = Math.max(0, 1 - (u.pad - 2) / 0.6);
        if (u.pad > 2.6) aktivne.delete(u);
      } else {
        mierka = Math.max(0, 1 - u.pad / 0.3);
        if (u.pad > 0.3) aktivne.delete(u);
      }
    } else {
      u.tras -= dt;
      uhol = Math.sin(u.tras * 45) * 0.05 * Math.max(u.tras / 0.35, 0);
      if (u.tras <= 0) { uhol = 0; aktivne.delete(u); }
    }
    os.set(u.osX, 0, u.osZ).normalize();
    qPad.setFromAxisAngle(os, uhol);
    for (const c of u.casti) {
      if (c.plod && u.skryty) continue;
      mScr.compose(c.poz, qScr.copy(qPad).multiply(c.q), sScr.copy(c.s).multiplyScalar(mierka));
      c.im.setMatrixAt(c.i, mierka > 0 ? mScr : NULA);
      c.im.instanceMatrix.needsUpdate = true;
    }
  }
}
export const aktualizujRastliny = aktualizujUzly;
