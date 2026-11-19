// Nekonecny svet: more je rozdelene na stvorce (bunky). Kazda bunka ma 0 alebo 1 ostrov.
// Ostrov sa vypocita z cisla SEED a suradnic bunky -> rovnaky seed = vzdy rovnaky svet.
// Do pamate grafiky nahravame len bunky okolo hraca, vzdialene mazeme.
import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const SEED = 1337;
export const BUNKA = 520;       // velkost bunky v metroch
export const DNO = -32;         // hlbka mora mimo ostrovov
const POLOMER_NAHRAVANIA = 2;   // kolko buniek okolo hraca nahrat (2 = 5x5)

const perlin = new ImprovedNoise();
const ostrovy = new Map();      // kluc "x,z" -> data ostrova (alebo null)
const nahrate = new Map();      // kluc "x,z" -> THREE.Group
let scena;

// ---------- nahodne cisla so seedom ----------
function hash(a, b, s) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(s, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
function rng(seed) {               // mulberry32: z jedneho cisla rad "nahodnych" cisel 0..1
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function fbm(x, z, s) {            // sum: 3 vrstvy Perlinovho sumu
  return perlin.noise(x, z, s) + 0.5 * perlin.noise(x * 2.1, z * 2.1, s + 3.3) + 0.25 * perlin.noise(x * 4.3, z * 4.3, s + 7.7);
}

// ---------- mena ostrovov ----------
const SLABIKY = ['ka', 'lo', 'ma', 'nu', 'te', 'ri', 'wa', 'po', 'le', 'hi', 'ko', 'mo', 'na', 'ta', 'vai', 'ru', 'ae', 'li'];
function meno(r) {
  let s = '';
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) s += SLABIKY[Math.floor(r() * SLABIKY.length)];
  return s[0].toUpperCase() + s.slice(1);
}

// ---------- data ostrova v bunke ----------
export function ostrovVBunke(bx, bz) {
  const kluc = bx + ',' + bz;
  if (ostrovy.has(kluc)) return ostrovy.get(kluc);
  const r = rng(hash(bx, bz, SEED));
  let o = null;
  const start = bx === 0 && bz === 0;            // startovaci ostrov je vzdy
  if (start || r() < 0.72) {
    const R = start ? 90 : 30 + 115 * r() * r();  // polomer, viac malych ostrovov
    const ext = R * 1.8;                          // kam az siaha podmorsky svah
    const volno = BUNKA - 2 * ext;
    o = {
      bx, bz, R, ext,
      x: bx * BUNKA + ext + (start ? volno / 2 : r() * volno),
      z: bz * BUNKA + ext + (start ? volno / 2 : r() * volno),
      H: 5 + R * (0.08 + r() * 0.2),             // vyska kopca
      seed: Math.floor(r() * 1000),
      meno: meno(r),
    };
  }
  ostrovy.set(kluc, o);
  return o;
}

function vyskaOstrova(o, x, z) {
  const d = Math.hypot(x - o.x, z - o.z) / o.R;
  if (d > 1.8) return DNO;
  const t = 1 - d + 0.28 * fbm(x * 0.012, z * 0.012, o.seed);   // t > 0 = sucho
  let h;
  if (t >= 0) h = o.H * Math.pow(t, 1.4) + fbm(x * 0.05, z * 0.05, o.seed + 7) * 1.5 * Math.min(1, t * 4);
  else h = -(-t * 14 + t * t * 80);                              // svah pod vodou (plytka lagúna, potom hlbka)
  return Math.max(h, DNO);
}

// Vyska terenu kdekolvek na svete (kazdy ostrov sa zmesti do svojej bunky)
export function vyskaTerenu(x, z) {
  const o = ostrovVBunke(Math.floor(x / BUNKA), Math.floor(z / BUNKA));
  return o ? vyskaOstrova(o, x, z) : DNO;
}

// Ostrov, na ktorom (alebo pri ktorom) hrac je
export function ostrovPri(x, z, faktor = 1.0) {
  const o = ostrovVBunke(Math.floor(x / BUNKA), Math.floor(z / BUNKA));
  return o && Math.hypot(x - o.x, z - o.z) < o.R * faktor ? o : null;
}

// ---------- 3D modely ----------
const matTeren = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, envMapIntensity: 0.35 });
const matKmen = new THREE.MeshStandardMaterial({ color: 0x8a6a45, flatShading: true });
const matListy = new THREE.MeshStandardMaterial({ color: 0x3f9a3a, flatShading: true, side: THREE.DoubleSide });
const matKamen = new THREE.MeshStandardMaterial({ color: 0x8d8d86, flatShading: true });

const geoKmen = new THREE.CylinderGeometry(0.18, 0.3, 6, 6).translate(0, 3, 0);
const geoKoruna = (() => {
  const listy = [];
  for (let i = 0; i < 7; i++) {
    const l = new THREE.BoxGeometry(0.6, 0.06, 3.2).translate(0, 0, 1.6);
    l.rotateX(0.45);                               // listy ovisnute dole
    l.rotateY(i / 7 * Math.PI * 2);
    listy.push(l);
  }
  return mergeGeometries(listy).translate(0, 6, 0);
})();
const geoKamen = new THREE.IcosahedronGeometry(1, 0);
const matKer = new THREE.MeshStandardMaterial({ color: 0x2f7a32, flatShading: true });
const geoKer = new THREE.IcosahedronGeometry(1, 1);
const matTrava = new THREE.MeshStandardMaterial({ color: 0x6cb84a, flatShading: true, side: THREE.DoubleSide });
const geoTrava = mergeGeometries([0, 1, 2].map(i =>
  new THREE.ConeGeometry(0.06, 0.7, 3).translate(0.12 * Math.cos(i * 2.1), 0.35, 0.12 * Math.sin(i * 2.1)).rotateZ((i - 1) * 0.25)));
const matKokos = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, flatShading: true });

// predmety na zbieranie (typ -> model)
const PREDMETY = {
  drevo: { geo: new THREE.CylinderGeometry(0.07, 0.09, 1.3, 5).rotateZ(Math.PI / 2).translate(0, 0.08, 0), mat: matKmen },
  kamen: { geo: new THREE.IcosahedronGeometry(0.2, 0).translate(0, 0.12, 0), mat: matKamen },
  kokos: { geo: new THREE.IcosahedronGeometry(0.17, 1).translate(0, 0.15, 0), mat: matKokos },
};
export const zobrate = new Set();   // id predmetov, ktore uz hrac zobral (uklada sa)

const FARBY = {
  hlbka: new THREE.Color(0xc9b27a), piesok: new THREE.Color(0xe6cf94),
  trava: new THREE.Color(0x5daa45), trava2: new THREE.Color(0x3f8a3a), skala: new THREE.Color(0x8a8378),
};

function postavOstrov(o) {
  const skupina = new THREE.Group();
  const seg = Math.round(THREE.MathUtils.clamp(o.R * 0.9, 60, 140));
  const geo = new THREE.PlaneGeometry(o.ext * 2, o.ext * 2, seg, seg).rotateX(-Math.PI / 2);
  const poz = geo.attributes.position;
  for (let i = 0; i < poz.count; i++) {
    poz.setY(i, vyskaOstrova(o, o.x + poz.getX(i), o.z + poz.getZ(i)));
  }
  geo.computeVertexNormals();

  // farby podla vysky a strmosti
  const nor = geo.attributes.normal;
  const farby = new Float32Array(poz.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < poz.count; i++) {
    const h = poz.getY(i), strmost = 1 - nor.getY(i);
    if (h < -0.4) c.copy(FARBY.hlbka);
    else if (h < 1.4) c.copy(FARBY.piesok);
    else c.copy(FARBY.trava).lerp(FARBY.trava2, THREE.MathUtils.clamp((h - 2) / (o.H + 2), 0, 1));
    if (h > 1 && strmost > 0.28) c.copy(FARBY.skala);
    c.offsetHSL(0, 0, perlin.noise(poz.getX(i) * 0.15, poz.getZ(i) * 0.15, o.seed) * 0.05);   // jemne flaky
    farby.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(farby, 3));

  const teren = new THREE.Mesh(geo, matTeren);
  teren.position.set(o.x, 0, o.z);
  teren.receiveShadow = true;
  teren.castShadow = true;
  skupina.add(teren);

  // palmy a kamene na nahodnych miestach
  const r = rng(o.seed * 7919 + 1);
  const palmy = [], kamene = [], kriky = [], trava = [];
  for (let i = 0; i < o.R * 0.6; i++) {
    const x = o.x + (r() * 2 - 1) * o.R * 1.1, z = o.z + (r() * 2 - 1) * o.R * 1.1;
    const h = vyskaOstrova(o, x, z);
    const sklon = Math.abs(vyskaOstrova(o, x + 1, z) - h) + Math.abs(vyskaOstrova(o, x, z + 1) - h);
    if (h > 0.7 && h < o.H * 0.8 && sklon < 0.8) palmy.push([x, h, z]);
    else if (h > 0.3 && r() < 0.3) kamene.push([x, h, z]);
  }
  for (let i = 0; i < o.R * 4; i++) {   // trava a kriky (len na trave, nie na piesku)
    const x = o.x + (r() * 2 - 1) * o.R * 1.1, z = o.z + (r() * 2 - 1) * o.R * 1.1;
    const h = vyskaOstrova(o, x, z);
    if (h > 1.6 && h < o.H * 0.9) (r() < 0.15 ? kriky : trava).push([x, h, z]);
  }

  // predmety: kokosy pod palmami, drevo a kamene na plazi
  const predmety = [];
  const pridaj = (typ, x, z) => {
    const id = `${o.bx},${o.bz},${predmety.length}`;
    predmety.push(id);                           // aj zobrate drzia poradie -> id ostanu stale
    const otocenie = r() * 6.28;                 // r() volat vzdy, inak by sa posunuli dalsie nahodne cisla
    if (zobrate.has(id)) return;
    const m = new THREE.Mesh(PREDMETY[typ].geo, PREDMETY[typ].mat);
    m.position.set(x, vyskaOstrova(o, x, z), z);
    m.rotation.y = otocenie;
    m.castShadow = true;
    m.userData = { id, typ };
    skupina.add(m);
  };
  palmy.forEach(([x, , z]) => { if (r() < 0.5) pridaj('kokos', x + r() * 2 - 1, z + r() * 2 - 1); });
  for (let i = 0; i < o.R * 0.5; i++) {
    const a = r() * 6.28, d = o.R * (0.5 + r() * 0.6);
    const x = o.x + Math.cos(a) * d, z = o.z + Math.sin(a) * d;
    const typ = r() < 0.6 ? 'drevo' : 'kamen';
    if (vyskaOstrova(o, x, z) > 0.3) pridaj(typ, x, z);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  if (palmy.length) {
    const kmene = new THREE.InstancedMesh(geoKmen, matKmen, palmy.length);
    const koruny = new THREE.InstancedMesh(geoKoruna, matListy, palmy.length);
    palmy.forEach(([x, h, z], i) => {
      e.set((r() - 0.5) * 0.35, r() * 6.28, (r() - 0.5) * 0.35);   // palmy su naklonene
      q.setFromEuler(e);
      s.setScalar(0.8 + r() * 0.6);
      m.compose(p.set(x, h - 0.2, z), q, s);
      kmene.setMatrixAt(i, m); koruny.setMatrixAt(i, m);
    });
    kmene.castShadow = koruny.castShadow = true;
    skupina.add(kmene, koruny);
  }
  if (kamene.length) {
    const km = new THREE.InstancedMesh(geoKamen, matKamen, kamene.length);
    kamene.forEach(([x, h, z], i) => {
      e.set(r() * 3, r() * 3, r() * 3); q.setFromEuler(e);
      s.set(0.5 + r() * 1.2, 0.4 + r() * 0.8, 0.5 + r() * 1.2);
      m.compose(p.set(x, h, z), q, s);
      km.setMatrixAt(i, m);
    });
    km.castShadow = true;
    skupina.add(km);
  }
  const instancie = (geo, mat, body, mierka) => {
    if (!body.length) return;
    const im = new THREE.InstancedMesh(geo, mat, body.length);
    body.forEach(([x, h, z], i) => {
      e.set(0, r() * 6.28, 0); q.setFromEuler(e);
      s.setScalar(mierka * (0.6 + r() * 0.8));
      m.compose(p.set(x, h, z), q, s);
      im.setMatrixAt(i, m);
    });
    im.castShadow = mat === matKer;
    skupina.add(im);
  };
  instancie(geoKer, matKer, kriky, 1.1);
  instancie(geoTrava, matTrava, trava, 1);
  return skupina;
}

// Najblizsi predmet do vzdialenosti d (hlada len v nahratych ostrovoch)
export function najblizsiPredmet(x, z, d = 2.2) {
  let naj = null;
  for (const g of nahrate.values()) {
    if (!g) continue;
    for (const m of g.children) {
      if (!m.userData.typ) continue;
      const v = Math.hypot(m.position.x - x, m.position.z - z);
      if (v < d) { d = v; naj = m; }
    }
  }
  return naj;
}

export function zober(m) {
  zobrate.add(m.userData.id);
  m.parent.remove(m);
}

export function initSvet(s) { scena = s; }

// Volat kazdy snimok: nahra najblizsiu chybajucu bunku (max 1 za snimok, aby hra nesekala)
export function aktualizujSvet(x, z) {
  const bx = Math.floor(x / BUNKA), bz = Math.floor(z / BUNKA);
  let najlepsia = null, najmenej = Infinity;
  for (let i = -POLOMER_NAHRAVANIA; i <= POLOMER_NAHRAVANIA; i++) {
    for (let j = -POLOMER_NAHRAVANIA; j <= POLOMER_NAHRAVANIA; j++) {
      const kluc = (bx + i) + ',' + (bz + j);
      if (nahrate.has(kluc)) continue;
      const d = i * i + j * j;
      if (d < najmenej) { najmenej = d; najlepsia = [bx + i, bz + j, kluc]; }
    }
  }
  if (najlepsia) {
    const o = ostrovVBunke(najlepsia[0], najlepsia[1]);
    const g = o ? postavOstrov(o) : null;
    if (g) scena.add(g);
    nahrate.set(najlepsia[2], g);
  }
  // vymaz vzdialene bunky
  for (const [kluc, g] of nahrate) {
    const [kx, kz] = kluc.split(',').map(Number);
    if (Math.abs(kx - bx) > POLOMER_NAHRAVANIA + 1 || Math.abs(kz - bz) > POLOMER_NAHRAVANIA + 1) {
      if (g) {
        scena.remove(g);
        g.traverse(o => { if (o.isMesh && !o.userData.typ && o.geometry !== geoKmen && o.geometry !== geoKoruna && o.geometry !== geoKamen && o.geometry !== geoKer && o.geometry !== geoTrava) o.geometry.dispose(); });
        g.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
      }
      nahrate.delete(kluc);
    }
  }
  return nahrate.size;
}

// Startovacie miesto: plaz na vychodnej strane startovacieho ostrova
export function startovaciaPozicia() {
  const o = ostrovVBunke(0, 0);
  let x = o.x;
  while (vyskaOstrova(o, x, o.z) > 0.8) x += 1;      // ide od stredu k plazi
  const plaz = { x: x - 4, z: o.z };
  while (vyskaOstrova(o, x, o.z) > -1.0) x += 1;     // dalej do vody pre kanoe
  return { hrac: plaz, kanoe: { x: x + 1.5, z: o.z } };
}
