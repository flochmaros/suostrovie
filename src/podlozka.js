// 3D vyrobna podlozka: mala vlastna Three.js scena v okne vyroby.
// Vie len zobrazovat: kusy na rohozi (pad a odraz), ziaru pri zhode, priesvitneho "ducha" vysledku a animaciu vyroby.
// Co lezi na podlozke a ci je z toho recept riesi vyroba.js.
// Renderer vznikne az pri prvom otvoreni a kresli sa len, kym je okno vyroby otvorene.
import * as THREE from 'three';
import { PREDMETY } from './obsah/predmety.js';

const SIRKA = 620, VYSKA = 350;
export const MAX_KUSOV = 6;                  // viac kusov jedneho druhu uz len pribuda na stitku
// miesta pre jednotlive druhy surovin na rohozi (x, z)
const MIESTA = [[-1.35, -0.25], [1.35, -0.25], [0, 0.65], [0, -0.85], [-2.25, 0.75], [2.25, 0.75], [-2.3, -0.9], [2.3, -0.9]];
const ROZLOZ = [[0, 0], [0.42, 0.3], [-0.4, 0.34], [0.34, -0.36], [-0.44, -0.26], [0.02, 0.62]];   // kusy v jednej kopke

let r3 = null;                               // { renderer, scena, kamera, ... } – vytvori sa pri prvom otvoreni
let bezi = false, snimok = 0, cas = 0, posledny = 0;
const druhy = new Map();                     // id -> { miesto, x, z, kusy: [], pocet }
let duch = null, duchId = null, ziari = false, anim = null, naZmenu = () => {};

const nahodne = (a, b) => a + Math.random() * (b - a);
const hladko = k => k * k * (3 - 2 * k);

// ---------- rohoz z palmovych listov (textura kreslena kodom) ----------
function texturaRohoze() {
  const c = document.createElement('canvas'); c.width = 768; c.height = 512;
  const g = c.getContext('2d'), P = 40;
  g.beginPath(); g.roundRect(0, 0, 768, 512, 36); g.clip();
  g.fillStyle = '#6f7a38'; g.fillRect(0, 0, 768, 512);
  for (let y = 0, j = 0; y < 512; y += P, j++) {
    for (let x = 0, i = 0; x < 768; x += P, i++) {
      const vodorovny = (i + j) % 2 === 0, ton = nahodne(-7, 7);
      const gr = vodorovny ? g.createLinearGradient(x, y, x, y + P) : g.createLinearGradient(x, y, x + P, y);
      const h = vodorovny ? 54 : 70, s = vodorovny ? 44 : 40, l = (vodorovny ? 52 : 42) + ton;
      gr.addColorStop(0, `hsl(${h} ${s}% ${l - 16}%)`); gr.addColorStop(0.45, `hsl(${h} ${s}% ${l + 6}%)`); gr.addColorStop(1, `hsl(${h} ${s}% ${l - 13}%)`);
      g.fillStyle = gr; g.fillRect(x + 1, y + 1, P - 2, P - 2);
      g.strokeStyle = 'rgba(255,248,200,.20)'; g.lineWidth = 1;      // zilky listu
      for (const q of [0.3, 0.55, 0.75]) {
        g.beginPath();
        if (vodorovny) { g.moveTo(x + 2, y + P * q); g.lineTo(x + P - 2, y + P * q + nahodne(-2, 2)); }
        else { g.moveTo(x + P * q, y + 2); g.lineTo(x + P * q + nahodne(-2, 2), y + P - 2); }
        g.stroke();
      }
    }
  }
  // tien k okrajom, lem a stehy
  const t = g.createRadialGradient(384, 256, 120, 384, 256, 470);
  t.addColorStop(0, 'rgba(255,240,180,.10)'); t.addColorStop(1, 'rgba(20,24,0,.45)');
  g.fillStyle = t; g.fillRect(0, 0, 768, 512);
  g.lineWidth = 26; g.strokeStyle = '#5a4a22'; g.beginPath(); g.roundRect(13, 13, 742, 486, 26); g.stroke();
  g.lineWidth = 5; g.strokeStyle = '#f0dca4'; g.setLineDash([16, 12]); g.beginPath(); g.roundRect(14, 14, 740, 484, 26); g.stroke();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

function vytvor(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(SIRKA, VYSKA, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scena = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(32, SIRKA / VYSKA, 0.1, 60);
  scena.add(new THREE.HemisphereLight(0xeafcff, 0x8a7a52, 1.35));
  const slnko = new THREE.DirectionalLight(0xfff2d8, 2.4); slnko.position.set(-3, 7, 3.5);
  slnko.castShadow = true; slnko.shadow.mapSize.set(1024, 1024); slnko.shadow.bias = -0.0008;
  Object.assign(slnko.shadow.camera, { left: -4.5, right: 4.5, top: 3.5, bottom: -3.5, near: 1, far: 16 });
  scena.add(slnko);
  const zablesk = new THREE.PointLight(0xffe2a0, 0, 9, 1.4); zablesk.position.set(0, 1.5, 0); scena.add(zablesk);

  const geo = new THREE.PlaneGeometry(6.3, 3.9, 40, 26); geo.rotateX(-Math.PI / 2);
  const poz = geo.attributes.position;
  for (let i = 0; i < poz.count; i++) {                 // jemne zvlnena, na okrajoch mierne zdvihnuta
    const x = poz.getX(i), z = poz.getZ(i);
    poz.setY(i, Math.sin(x * 2.3 + z) * 0.012 + Math.max(0, Math.abs(x) - 2.7) * 0.12 - 0.015);
  }
  geo.computeVertexNormals();
  const rohoz = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: texturaRohoze(), roughness: 0.95, alphaTest: 0.5 }));
  rohoz.receiveShadow = true; scena.add(rohoz);
  // strapce na kratsich stranach
  const strapec = new THREE.BoxGeometry(0.26, 0.015, 0.035), matS = new THREE.MeshStandardMaterial({ color: 0xcdb46a, roughness: 1 });
  for (const s of [-1, 1]) for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(strapec, matS);
    m.position.set(s * (3.24 + nahodne(0, 0.05)), 0.03, -1.8 + i * 0.144); m.rotation.y = nahodne(-0.3, 0.3); scena.add(m);
  }
  // iskry
  const N = 260, ig = new THREE.BufferGeometry();
  ig.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3).fill(-99), 3));
  ig.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const iskry = new THREE.Points(ig, new THREE.PointsMaterial({ size: 0.11, map: texturaBodky(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  iskry.frustumCulled = false; scena.add(iskry);
  const castice = Array.from({ length: N }, () => ({ z: 0, max: 1, v: new THREE.Vector3(), farba: new THREE.Color() }));
  return { canvas, renderer, scena, kamera, zablesk, iskry, castice, dalsia: 0, otras: 0, ray: new THREE.Raycaster() };
}

function texturaBodky() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function vybuch(x, y, z, farba = 0xffd45e, n = 22, sila = 2.2) {
  if (!r3) return;
  for (let i = 0; i < n; i++) {
    const k = r3.dalsia = (r3.dalsia + 1) % r3.castice.length, c = r3.castice[k];
    const a = nahodne(0, 6.283), v = nahodne(0.4, 1) * sila;
    c.v.set(Math.cos(a) * v, nahodne(0.4, 1.6) * sila * 0.8, Math.sin(a) * v);
    c.z = c.max = nahodne(0.4, 0.9); c.farba.set(farba);
    r3.iskry.geometry.attributes.position.setXYZ(k, x, y, z);
  }
}
function tikIskier(dt) {
  const p = r3.iskry.geometry.attributes.position, f = r3.iskry.geometry.attributes.color;
  r3.castice.forEach((c, i) => {
    if (c.z <= 0) { f.setXYZ(i, 0, 0, 0); return; }
    c.z -= dt; c.v.y -= 6 * dt;
    p.setXYZ(i, p.getX(i) + c.v.x * dt, Math.max(0.03, p.getY(i) + c.v.y * dt), p.getZ(i) + c.v.z * dt);
    const s = Math.max(0, c.z / c.max);
    f.setXYZ(i, c.farba.r * s, c.farba.g * s, c.farba.b * s);
  });
  p.needsUpdate = f.needsUpdate = true;
}

// ---------- model predmetu na rohozi ----------
const kopieMat = new Map();     // id -> vlastne kopie materialov (hra ich pouziva tiez, nesmieme ich menit)
function materialPre(id) {
  if (!kopieMat.has(id)) {
    const m = PREDMETY[id].model[1];
    kopieMat.set(id, Array.isArray(m) ? m.map(x => x.clone()) : m.clone());
  }
  return kopieMat.get(id);
}
const zoznamMat = m => (Array.isArray(m) ? m : [m]);

// skupina s modelom: stred v (0, 0), spodok na y = 0, najdlhsia strana = velkost
function postavModel(id, velkost, mat) {
  const p = PREDMETY[id];
  let geo = p?.model?.[0];
  if (!geo) { geo = new THREE.DodecahedronGeometry(0.2); mat = new THREE.MeshStandardMaterial({ color: 0xd8c08a, roughness: 0.9 }); }
  const mesh = new THREE.Mesh(geo, mat ?? materialPre(id));
  mesh.castShadow = true;
  geo.computeBoundingBox();
  const roz = geo.boundingBox.getSize(new THREE.Vector3());
  const vnutro = new THREE.Group(); vnutro.add(mesh);
  if (roz.y > 1.6 * Math.max(roz.x, roz.z)) vnutro.rotation.z = Math.PI / 2;      // stojace dlhe veci polozime
  const dlhy = Math.max(roz.x, roz.y, roz.z) > 2 * [roz.x, roz.y, roz.z].sort((a, b) => a - b)[1];
  const s = velkost * (dlhy ? 1.4 : 1) / (Math.max(roz.x, roz.y, roz.z) || 1);
  vnutro.scale.setScalar(s);
  vnutro.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(vnutro), stred = box.getCenter(new THREE.Vector3());
  vnutro.position.set(-stred.x, -box.min.y, -stred.z);
  const g = new THREE.Group(); g.add(vnutro);
  g.userData = { vyska: box.max.y - box.min.y, dlhy };
  return g;
}

// ---------- kusy na rohozi ----------
function volneMiesto() {
  const obsadene = new Set([...druhy.values()].map(d => d.miesto));
  const i = MIESTA.findIndex((_, k) => !obsadene.has(k));
  return i < 0 ? druhy.size % MIESTA.length : i;
}

// nastavi, kolko kusov druhu id lezi na rohozi. bod = kam spadol (tahanie), oneskorenie v sekundach, naDopad = zvuk
export function nastavKusy(id, pocet, { bod = null, oneskorenie = 0, naDopad = null } = {}) {
  if (!r3) return;
  let d = druhy.get(id);
  if (!d) {
    if (!pocet) return;
    const miesto = volneMiesto();
    d = { miesto, x: bod?.x ?? MIESTA[miesto][0], z: bod?.z ?? MIESTA[miesto][1], kusy: [], pocet: 0 };
    druhy.set(id, d);
  }
  const bolo = d.pocet; d.pocet = pocet;
  const chce = Math.min(pocet, MAX_KUSOV);
  while (d.kusy.length > chce) r3.scena.remove(d.kusy.pop().g);
  let k = 0;
  while (d.kusy.length < chce) {
    const i = d.kusy.length, g = postavModel(id, 0.8);
    const cx = d.x + ROZLOZ[i][0] * (g.userData.dlhy ? 0.55 : 1), cz = d.z + ROZLOZ[i][1] * (g.userData.dlhy ? 0.85 : 1);
    g.userData.id = id;
    const kus = { g, x: cx + nahodne(-0.05, 0.05), z: cz + nahodne(-0.05, 0.05), y: 0.02, otoc: g.userData.dlhy ? nahodne(-0.5, 0.5) : nahodne(0, 6.28),
      h: 2.1, v: 0, caka: oneskorenie + k * 0.09, dopady: 0, tocenie: nahodne(-5, 5), naklon: nahodne(-0.8, 0.8), naDopad };
    g.visible = false;
    r3.scena.add(g); d.kusy.push(kus); k++;
  }
  if (pocet > bolo && !k && d.kusy.length) {                    // uz je plna kopka: horny kus poskoci
    const kus = d.kusy[d.kusy.length - 1]; kus.h = 0.6; kus.v = 0; kus.dopady = 0; kus.caka = oneskorenie; kus.naDopad = naDopad;
  }
  if (!pocet) druhy.delete(id);
}
export function vycisti() { for (const id of [...druhy.keys()]) nastavKusy(id, 0); nastavDucha(null); ziari = false; }

function tikKusov(dt) {
  if (anim) return;                             // pocas vyroby hybe kusmi tikAnimacie
  for (const d of druhy.values()) for (const k of d.kusy) {
    if (k.caka > 0) { k.caka -= dt; continue; }
    k.g.visible = true;
    if (k.h > 0 || k.v > 0) {
      k.v -= 17 * dt; k.h += k.v * dt;
      if (k.h <= 0) {                                           // dopad a odraz
        k.h = 0; k.dopady++;
        if (k.dopady === 1) { k.naDopad?.(); vybuch(k.x, 0.05, k.z, 0xb8a060, 5, 0.7); }
        k.v = k.dopady < 3 ? -k.v * 0.32 : 0;
        if (k.v < 0.5) k.v = 0;
      }
    }
    const q = Math.min(1, k.h / 2);
    k.g.position.set(k.x, k.y + k.h, k.z);
    k.g.rotation.set(k.naklon * q, k.otoc + k.tocenie * q, k.naklon * q * 0.6);
    const mackanie = k.dopady && k.h < 0.06 && k.v ? 0.9 : 1;
    k.g.scale.set(2 - mackanie, mackanie, 2 - mackanie);
  }
}

// ---------- duch vysledku a ziara pri zhode ----------
export function nastavDucha(id) {
  if (!r3 || id === duchId) return;
  duchId = id;
  if (duch) { r3.scena.remove(duch); zoznamMat(duch.userData.mat).forEach(m => m.dispose()); duch = null; }
  if (!id || !PREDMETY[id]?.model) return;
  const povodny = PREDMETY[id].model[1];
  const kopie = zoznamMat(povodny).map(m => {
    const k = m.clone();
    k.transparent = true; k.opacity = 0.65; k.depthWrite = false;
    if (k.emissive) { k.emissive.set(0x35d6c3); k.emissiveIntensity = 0.45; }
    return k;
  });
  const mat = Array.isArray(povodny) ? kopie : kopie[0];
  duch = postavModel(id, 1.25, mat);
  duch.userData.mat = mat;
  duch.traverse(o => { o.renderOrder = 2; });
  duch.traverse(o => { o.castShadow = false; });
  r3.scena.add(duch);
}
export function nastavZiaru(ano) {
  if (ano && !ziari) for (const d of druhy.values()) vybuch(d.x, 0.25, d.z, 0xffd45e, 10, 1.1);
  ziari = ano;
}
function tikZiary() {
  const sila = ziari ? 0.22 + Math.sin(cas * 5) * 0.14 : 0;
  for (const id of druhy.keys()) for (const m of zoznamMat(materialPre(id))) {
    if (!m.emissive) continue;
    m.userData.povodna ??= { farba: m.emissive.getHex(), sila: m.emissiveIntensity };
    if (sila) { m.emissive.set(0xffb830); m.emissiveIntensity = sila; }
    else { m.emissive.setHex(m.userData.povodna.farba); m.emissiveIntensity = m.userData.povodna.sila; }
  }
  if (duch) {
    duch.visible = !anim;
    duch.position.set(0, 0.45 + Math.sin(cas * 2) * 0.07, -0.15);
    duch.rotation.set(0.35, Math.sin(cas * 0.9) * 0.7, duch.userData.dlhy ? -0.35 : 0);   // dlhe veci nasikmo, aby ich bolo vidno zo vsetkych stran
  }
}

// ---------- animacia vyroby ----------
const UDERY = [0.75, 1.1, 1.45], ZABLESK = 1.75, LET = 2.85, KONIEC = 3.35;
export const jeAnimacia = () => !!anim;
// volby: { vysledok: id | null, naUder(i), naZablesk(), naLet(), naKoniec() }
export function spustiVyrobu(volby) {
  if (!r3 || anim) return false;
  const kusy = [...druhy.values()].flatMap(d => d.kusy);
  for (const k of kusy) { k.caka = 0; k.h = 0; k.v = 0; k.g.visible = true; k.start = k.g.position.clone(); }
  anim = { ...volby, t: 0, kusy, udery: 0, blesk: false, let: false, model: null };
  // poistka: ked prehliadac nekresli (skryta karta), vyroba sa aj tak dokonci
  anim.poistka = setTimeout(dokonci, KONIEC * 1000 + 600);
  return true;
}
function upratAnimaciu() {
  if (!anim) return null;
  const a = anim; anim = null;
  clearTimeout(a.poistka);
  if (a.model) r3.scena.remove(a.model);
  r3.zablesk.intensity = 0; r3.otras = 0;
  return a;
}
function dokonci() { const a = upratAnimaciu(); if (a) { vycisti(); a.naKoniec?.(); } }
export function zrusVyrobu() { if (upratAnimaciu()) vycisti(); }

function tikAnimacie(dt) {
  const a = anim; if (!a) return;
  a.t += dt;
  const t = a.t;
  if (t < ZABLESK) {
    const zlet = hladko(Math.min(1, t / 0.6)), stlac = Math.max(0, (t - 0.6) / (ZABLESK - 0.6));
    let punc = 0;
    for (const u of UDERY) if (t > u && t < u + 0.22) punc = 1 - (t - u) / 0.22;
    a.kusy.forEach((k, i) => {
      const uhol = i / a.kusy.length * 6.283 + t * (2.5 + stlac * 9), r = (0.75 - stlac * 0.55) * (1 + punc * 0.7);
      const cx = Math.cos(uhol) * r, cz = Math.sin(uhol) * r * 0.75, cy = 0.7 + Math.sin(uhol * 2 + i) * 0.14 - punc * 0.22;
      k.g.position.set(k.start.x + (cx - k.start.x) * zlet, k.start.y + (cy - k.start.y) * zlet + Math.sin(zlet * Math.PI) * 0.7, k.start.z + (cz - k.start.z) * zlet);
      k.g.rotation.x += dt * (2 + stlac * 9); k.g.rotation.y += dt * (3 + stlac * 11);
      k.g.scale.setScalar(1 - stlac * 0.5 + punc * 0.12);
    });
    if (a.udery < UDERY.length && t >= UDERY[a.udery]) {
      vybuch(0, 0.7, 0, a.udery === 2 ? 0xfff0b0 : 0xffb347, 26 + a.udery * 10, 2 + a.udery * 0.5);
      r3.otras = 0.06 + a.udery * 0.025;
      a.naUder?.(a.udery); a.udery++;
    }
    r3.zablesk.intensity = punc * 14;
  } else {
    if (!a.blesk) {
      a.blesk = true;
      a.kusy.forEach(k => { k.g.visible = false; });
      if (a.vysledok && PREDMETY[a.vysledok]?.model) { a.model = postavModel(a.vysledok, 1.5, PREDMETY[a.vysledok].model[1]); r3.scena.add(a.model); }
      vybuch(0, 0.9, 0, 0xffd45e, 90, 3.4); vybuch(0, 0.9, 0, 0x8ffff0, 50, 2.2);
      r3.otras = 0.1;
      a.naZablesk?.();
    }
    const u = t - ZABLESK;
    r3.zablesk.intensity = Math.max(0, 22 * (1 - u * 2.2));
    if (a.model) {
      const nabeh = Math.min(1, u / 0.45), pruzina = 1 + Math.sin(nabeh * Math.PI * 2.2) * (1 - nabeh) * 0.45;
      const odlet = hladko(Math.max(0, Math.min(1, (t - LET) / (KONIEC - LET))));       // do batohu: dole dolava
      a.model.position.set(-2.9 * odlet, 0.65 + nabeh * 0.2 + Math.sin(u * 3) * 0.05 + Math.sin(odlet * Math.PI) * 0.8 - odlet * 0.7, odlet * 2.6);
      a.model.rotation.set(0.12, u * 3.2, a.model.userData.dlhy ? 0.5 : 0);
      a.model.scale.setScalar(Math.max(0.01, nabeh * pruzina * (1 - odlet * 0.82)));
      if (Math.random() < dt * 22) vybuch(a.model.position.x + nahodne(-0.7, 0.7), a.model.position.y + nahodne(0, 0.8), a.model.position.z, 0xffe9a0, 1, 0.3);
    }
    if (!a.let && t >= LET) { a.let = true; a.naLet?.(); }
    if (t >= KONIEC) dokonci();
  }
}

// ---------- slucka ----------
function tik(dt) {
  cas += dt;
  tikKusov(dt); tikZiary(); tikAnimacie(dt); tikIskier(dt);
  const o = r3.otras; r3.otras = Math.max(0, o - dt * 0.4);
  r3.kamera.position.set(nahodne(-o, o), 5.35 + nahodne(-o, o), 4.5);
  r3.kamera.lookAt(0, 0.3, 0.05);
  r3.renderer.render(r3.scena, r3.kamera);
}
function slucka(teraz) {
  if (!bezi) return;
  tik(Math.min(0.05, (teraz - posledny) / 1000 || 0.016));
  posledny = teraz;
  snimok = requestAnimationFrame(slucka);
}
// na testy z konzoly: posunie scenu o dany cas
export function posunCas(s) { for (let t = 0; r3 && t < s; t += 1 / 60) tik(1 / 60); }

export function otvorPodlozku(canvas) {
  if (!r3) {
    try { r3 = vytvor(canvas); } catch (e) { console.warn('Podlozka: WebGL nie je k dispozicii', e); return false; }
    tik(0);
  }
  if (!bezi) { bezi = true; posledny = performance.now(); snimok = requestAnimationFrame(slucka); }
  return true;
}
export function zavriPodlozku() {
  if (!bezi) return;
  zrusVyrobu(); vycisti();
  bezi = false; cancelAnimationFrame(snimok);
}

// ---------- mys ----------
function luc(klientX, klientY) {
  const o = r3.canvas.getBoundingClientRect();
  r3.ray.setFromCamera({ x: (klientX - o.left) / o.width * 2 - 1, y: -((klientY - o.top) / o.height) * 2 + 1 }, r3.kamera);
  return r3.ray;
}
// id predmetu pod mysou (alebo null)
export function kusPodMysou(x, y) {
  if (!r3) return null;
  const skupiny = [...druhy.values()].flatMap(d => d.kusy.map(k => k.g));
  r3.scena.updateMatrixWorld();
  let o = luc(x, y).intersectObjects(skupiny, true)[0]?.object;
  while (o && !o.userData.id) o = o.parent;
  return o?.userData.id ?? null;
}
// bod na rohozi pod mysou (na polozenie tahanim)
export function bodNaRohozi(x, y) {
  if (!r3) return null;
  const b = luc(x, y).ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  return b && { x: Math.max(-2.4, Math.min(2.4, b.x)), z: Math.max(-1.2, Math.min(1.1, b.z)) };
}
// kde na obrazovke (v pixeloch platna 620x350) maju byt stitky s poctami
export function stitky() {
  if (!r3) return [];
  r3.kamera.position.set(0, 5.35, 4.5); r3.kamera.lookAt(0, 0.3, 0.05); r3.kamera.updateMatrixWorld();
  return [...druhy].map(([id, d]) => {
    const v = new THREE.Vector3(d.x, 0, d.z + 0.55).project(r3.kamera);
    return { id, pocet: d.pocet, x: (v.x + 1) / 2 * SIRKA, y: (1 - v.y) / 2 * VYSKA };
  });
}
