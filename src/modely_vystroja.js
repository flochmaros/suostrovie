// 3D modely brnenia: 5 sad (list, bambus, lastura, krab, supina) x 4 kusy (hlava, telo, nohy, cizmy).
// kusVystroje(slot, tier) vrati zoznam dielov { j: nazov klbu postavy, o: Object3D, bake?: [x,y,z] } – diely sa pripoja na klby J z postava.js.
//   hlava: J.hlava (suradnice lebky)   telo: J.chrbat + ramena J.rL/J.rP   nohy: J.telo (sukna) + stehna J.sL/J.sP + kolena J.kL/J.kP
//   cizmy: J.kL/J.kP (holen + chodidlo)
// modelKusu(slot, tier) -> [geometria, material] pre predmet na zemi / ikonu v batohu (diely spojene, farby vo vrcholoch).
//
// Charakter sad:
//   list    – prekryvajuce sa listy v radoch, viazane vlaknom, uzliky; listy na leme sa trepocu vo vetre a pri behu
//   bambus  – trubky s kolienkami, omotavky, platove chranice (sukna z panelov, ktore sa hojdaju)
//   lastura – rebrovane vejarovite musle s perletovym leskom (iridescence), sniurky perli sa hojdaju
//   krab    – clankovane platne s okrajmi, hroty, klepeto na pleciach (pohyblivy prst), ocne stopky na prilbe
//   supina  – supiny v radoch nad zeravou vrstvou (skary pulzuju), rohy
//
// Animacie: objekt moze mat userData.anim(s) – vystroj.js ho vola kazdy snimok
//   s = { t, dt, rych, vpred, vy, vietor:{smer,sila}, vietorLok:{x,z}, podVodou, plava, nahlad }  (vietorLok: +z = dozadu)
//   userData.ziva = true oznacuje pohyblive diely (zapec ich nezlepi do statickeho meshu).
// Staticke diely kazdeho kusu sa zlepia (zapec) do 1 meshu na material – malo draw callov aj pri vela detailoch.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PI = Math.PI;
export const TIERY = {
  list:    { f: 0x58b043, o: 0x2f7a2c, r: 0.8, m: 0 },
  bambus:  { f: 0xd2bd6a, o: 0x8a7330, r: 0.7, m: 0 },
  lastura: { f: 0xf0d3c2, o: 0xc8907e, r: 0.32, m: 0.15 },
  krab:    { f: 0xc8422c, o: 0x7a2414, r: 0.5, m: 0.15 },
  supina:  { f: 0x2f2420, o: 0xff5a10, r: 0.45, m: 0.35, zar: true },
};

// ---------- materialy (zdielane, jedna sada na tier) ----------
const MAT = {};
const std = (c, r, mt = 0, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: mt, side: THREE.DoubleSide, ...o });
const fyz = (c, r, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: r, side: THREE.DoubleSide, ...o });
function mat(t) {
  if (MAT[t]) return MAT[t];
  const T = {
    list: () => ({ a: std(0x5cb446, 0.72), b: std(0x3f9236, 0.74), c: std(0x8cc858, 0.7), z: std(0x2c6a28, 0.85), v: std(0xc8a46a, 0.92), u: std(0x7a5530, 0.88) }),
    bambus: () => ({ a: std(0xd8c271, 0.5), b: std(0xb59a4c, 0.75), c: std(0xa7b45a, 0.5), z: std(0x86702f, 0.6), v: std(0x5a3c22, 0.92), u: std(0x3e2a18, 0.9) }),
    lastura: () => {
      const per = { iridescence: 1, iridescenceIOR: 1.45, iridescenceThicknessRange: [180, 520], clearcoat: 0.6, clearcoatRoughness: 0.25 };
      return { a: fyz(0xf5e4d8, 0.28, per), b: fyz(0xe8957e, 0.35, { clearcoat: 0.5, clearcoatRoughness: 0.3, sheen: 0.4, sheenColor: 0xffd0c0 }),
        c: fyz(0xfff6ee, 0.18, { ...per, iridescence: 0.8 }), z: std(0xa9675a, 0.7), v: std(0x6a4a3a, 0.9) };
    },
    krab: () => ({ a: fyz(0xcc4430, 0.42, { clearcoat: 0.55, clearcoatRoughness: 0.35 }), b: std(0x86281a, 0.5, 0.05), c: std(0xf2dcb4, 0.45),
      z: std(0x5a1a10, 0.7), oko: std(0x0c0c0c, 0.12, 0.3), v: std(0x4a3020, 0.9) }),
    supina: () => ({ a: std(0x2e2522, 0.42, 0.45), b: std(0x4a3a33, 0.5, 0.3), c: std(0xd2bf9c, 0.55),
      zar: std(0x3a0e04, 0.6, 0, { emissive: 0xff5a10, emissiveIntensity: 1.0 }) }),
  };
  return (MAT[t] = T[t]());
}

// ---------- pomocne funkcie ----------
const GC = {};
const G = (k, f) => GC[k] || (GC[k] = f());          // cache geometrii (zdielaju sa medzi hracom, nahladom a modelom)
const M = (geo, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; return o; };
const skup = (...d) => { const g = new THREE.Group(); g.add(...d); return g; };
const kl = (x, a, b) => (x < a ? a : x > b ? b : x);
const wr = a => Math.atan2(Math.sin(a), Math.cos(a));
const hash = i => { const x = Math.sin(i * 12.9898 + 4.1414) * 43758.5453; return x - Math.floor(x); };
// n uhlov na obluku a0..a1 (0 = vpredu = -z); plny kruh bez zdvojenia
const uhly = (n, a0 = -PI, a1 = PI) => {
  const plny = Math.abs(a1 - a0 - 2 * PI) < 1e-4, k = plny ? n : Math.max(1, n - 1), r = [];
  for (let i = 0; i < n; i++) r.push(n === 1 ? (a0 + a1) / 2 : a0 + (a1 - a0) * i / k);
  return r;
};
const alt = (r, n) => [-PI + (r % 2) * PI / n, PI + (r % 2) * PI / n];   // kazdy druhy rad posunuty o pol kroku

// parametricka plocha: fn(u, v, ciel) pre u, v v <0,1>
const _p = new THREE.Vector3();
function povrch(nu, nv, fn) {
  const pos = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { fn(i / nu, j / nv, _p); pos.push(_p.x, _p.y, _p.z); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// plochy tvar visiaci z bodu (0,0,0) dole, vypukly von (-z): list, supina, platna
function platGeo(L, W, prof, fold, curl, ostry = true, nu = 4, nv = 6) {
  return povrch(nu, nv, (u, v, p) => {
    const s = 2 * u - 1, w = W * Math.max(0.03, prof(v)), h = ostry ? 1 - Math.abs(s) : 1 - s * s;
    p.set(s * w, -L * v, -fold * w * h - curl * L * v * v);
  });
}
const PL = v => Math.pow(Math.sin(PI * (0.06 + 0.94 * v)), 0.7);                                         // list
const PS = v => (v < 0.4 ? 0.8 + 0.2 * Math.sin(v / 0.4 * PI / 2) : Math.pow(Math.cos((v - 0.4) / 0.6 * PI / 2), 0.7));   // supina
// vejarovita musla: zamok v (0,0,0), vejar dole, rebra, vypukla von (-z)
function muslaGeo(R, rebra = 9, sp = 0.95) {
  return povrch(rebra * 4, 5, (u, v, p) => {
    const s = 2 * u - 1, a = s * sp, reb = Math.abs(Math.cos(u * rebra * PI)), bok = Math.sqrt(Math.max(0, Math.cos(s * PI / 2)));
    const r = R * (0.14 + 0.86 * v) * (1 + 0.04 * reb * v);
    p.set(r * Math.sin(a), -r * Math.cos(a), -R * (0.3 * Math.sin(PI * Math.min(1, v * 0.95)) * (0.35 + 0.65 * bok) + 0.045 * reb * v));
  });
}
// cast gule: theta t0..t1 (0 = vrch), uhol a0..a1 (0 = vpredu); mod(a, th) = nasobok polomeru (rebra, stupne platni)
function kupolaGeo(R, t0, t1, a0, a1, nu, nv, mod) {
  t0 = Math.max(t0, 0.01);
  return povrch(nu, nv, (u, v, p) => {
    const a = a0 + (a1 - a0) * u, th = t0 + (t1 - t0) * v, r = R * (mod ? mod(a, th) : 1);
    p.set(r * Math.sin(th) * Math.sin(a), r * Math.cos(th), -r * Math.sin(th) * Math.cos(a));
  });
}
// zahnuty kuzel (roh, hrot, prst klepeta): rastie v +y, ohyba sa k +z (ohyb = uhol v rad)
function rohGeo(L, r0, ohyb, r1 = 0.002, n = 6, m = 6) {
  return povrch(n, m, (u, v, p) => {
    const f = u * PI * 2, b = v * ohyb, r = r0 + (r1 - r0) * Math.pow(v, 0.9);
    const cy = ohyb ? L * Math.sin(b) / ohyb : L * v, cz = ohyb ? L * (1 - Math.cos(b)) / ohyb : 0;
    p.set(r * Math.cos(f), cy + r * Math.sin(f) * Math.sin(b), cz - r * Math.sin(f) * Math.cos(b));
  });
}
// pas okolo elipsy (opasok, okraj, sniura); hr = hrubka do strany, hy = vyska
const gPas = (rx, rz, hr, hy = hr, a0 = -PI, a1 = PI, nu = 32) => G('p' + [rx, rz, hr, hy, a0, a1, nu], () => povrch(nu, 4, (u, v, p) => {
  const a = a0 + (a1 - a0) * u, f = v * 2 * PI, o = hr * Math.cos(f);
  p.set((rx + o) * Math.sin(a), hy * Math.sin(f), -(rz + o) * Math.cos(a));
}));
// obruc (platna okolo tela): rFn(y, v) = polomer, y od y0 (hore) po y1 (dole)
function obrucGeo(rFn, y0, y1, SX = 1, SZ = 1, a0 = -PI, a1 = PI, nu = 28, nv = 3) {
  return povrch(nu, nv, (u, v, p) => {
    const a = a0 + (a1 - a0) * u, y = y0 + (y1 - y0) * v, r = rFn(y, v);
    p.set(r * SX * Math.sin(a), y, -r * SZ * Math.cos(a));
  });
}
const gList = L => G('l' + L, () => platGeo(L, L * 0.36, PL, 0.35, 0.22, true));
const gSup = L => G('s' + L, () => platGeo(L, L * 0.5, PS, 0.3, 0.1, false, 4, 5));
const gMus = (R, n = 9) => G('m' + R + '_' + n, () => muslaGeo(R, n));
const gGula = (r, w = 10, h = 8) => G('g' + [r, w, h], () => new THREE.SphereGeometry(r, w, h));
const gValec = (r0, r1, L, n = 7) => G('v' + [r0, r1, L, n], () => new THREE.CylinderGeometry(r0, r1, L, n));
const gVisi = (r, L, n = 6) => G('vi' + [r, L, n], () => new THREE.CylinderGeometry(r, r * 0.85, L, n).translate(0, -L / 2, 0));   // visi z bodu dole
const gRoh = (L, r0, ohyb, n = 6) => G('r' + [L, r0, ohyb, n], () => rohGeo(L, r0, ohyb, 0.002, n, 6));
const gTor = (R, t, n = 12) => G('t' + [R, t, n], () => new THREE.TorusGeometry(R, t, 4, n).rotateX(PI / 2));
const gRurka = (k, pts, r) => G('ru' + k, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 24, r, 4));
const gOstn = () => G('ostnV', () => rohGeo(0.04, 0.012, 0.4).rotateX(-PI / 2));    // hrot smerom von (-z)
const gOstnZ = () => G('ostnZ', () => rohGeo(0.045, 0.013, 0.5).rotateX(PI / 2));   // hrot dozadu (+z), zahnuty dole

// objekty okolo elipsy: drziak natoceny von (lokalne -z = von), fn(i, a) vrati objekt alebo null
function okolo(g, n, a0, a1, y, rx, rz, fn) {
  uhly(n, a0, a1).forEach((a, i) => {
    const o = fn(i, a); if (!o) return;
    const h = new THREE.Group(); h.position.set(rx * Math.sin(a), y, -rz * Math.cos(a)); h.rotation.y = -a; h.add(o); g.add(h);
  });
}
// objekt na povrch (skalovanej) gule: lokalne -y = dole po poludniku, -z = von; sklon = naklon spicky (+ von)
const _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3(), _B = new THREE.Matrix4();
function naGuli(o, c, R, sy, th, a, d = 0, sklon = 0) {
  const h = new THREE.Group(), st = Math.sin(th), ct = Math.cos(th), sa = Math.sin(a), ca = Math.cos(a), r = R + d;
  h.position.set(c[0] + r * st * sa, c[1] + r * ct * sy, c[2] - r * st * ca);
  _Y.set(-ct * sa, st, ct * ca); _Z.set(-st * sa, -ct, st * ca); _X.crossVectors(_Y, _Z);
  h.quaternion.setFromRotationMatrix(_B.makeBasis(_X, _Y, _Z));
  o.rotation.x += sklon; h.add(o); return h;
}
// valec medzi dvoma bodmi (geometria s vyskou 1)
const _A = new THREE.Vector3(), _C = new THREE.Vector3(), _HORE = new THREE.Vector3(0, 1, 0);
function medzi(o, p0, p1) {
  _A.set(...p0); _C.set(...p1); o.position.addVectors(_A, _C).multiplyScalar(0.5);
  _C.sub(_A); o.scale.y = _C.length(); o.quaternion.setFromUnitVectors(_HORE, _C.normalize()); return o;
}
const lerp3 = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f];
// visiace vlakno s predmetom na konci (pre kyvadlo)
function pramen(m, L, koniec) { const s = new THREE.Group(); s.add(M(gVisi(0.0045, L, 4), m)); if (koniec) { koniec.position.y -= L; s.add(koniec); } return s; }

// zlepi staticke meshe skupiny do jedneho meshu na material (pohyblive diely s userData.ziva necha)
const _inv = new THREE.Matrix4(), _m4 = new THREE.Matrix4();
function zapec(g) {
  g.updateMatrixWorld(true);
  _inv.copy(g.matrixWorld).invert();
  const st = [];
  g.traverse(o => {
    if (!o.isMesh) return;
    for (let p = o; p && p !== g; p = p.parent) if (p.userData.ziva) return;
    st.push(o);
  });
  const podla = new Map();
  for (const o of st) {
    _m4.multiplyMatrices(_inv, o.matrixWorld);
    const geo = o.geometry.clone().applyMatrix4(_m4);
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    geo.clearGroups();
    if (!podla.has(o.material)) podla.set(o.material, []);
    podla.get(o.material).push(geo);
  }
  for (const o of st) o.parent.remove(o);
  for (const [m, list] of podla) {
    const vsetkyIdx = list.every(x => x.index);                       // indexovane ostanu indexovane (menej vrcholov)
    const x = new THREE.Mesh(mergeGeometries(vsetkyIdx ? list : list.map(q => (q.index ? q.toNonIndexed() : q))), m); x.castShadow = true; g.add(x);
  }
  return g;
}

// ---------- animacie (bez alokacii za snimok) ----------
const NULA = { x: 0, z: 0 };
// list / supina / panel visiaci z hornej hrany (lokalne -z = von): vietor + protivietor z behu ho dviha von, trepot, kopnutie krokom
function trepot(o, a, faza = 0, amp = 1, fr = 1, krok = 0.06) {
  const sa = Math.sin(a), ca = Math.cos(a), rx = o.rotation.x, rz = o.rotation.z, strana = sa >= 0 ? 0 : PI;
  let lift = 0, ph = faza, phK = 0;
  o.userData.ziva = true;
  o.userData.anim = s => {
    const dt = Math.min(0.05, s.dt), vl = s.vietorLok || NULA, w = s.podVodou ? 0 : 1;
    const ax = vl.x * w, az = vl.z * w + kl(s.vpred || 0, -3, 8) * 0.14;
    const von = ax * sa - az * ca, sila = Math.min(1.5, Math.hypot(ax, az));
    const ciel = kl(von * 0.3, -0.06, 0.5) + (s.podVodou ? 0.15 : 0);
    lift += (ciel - lift) * Math.min(1, dt * 5);
    ph += dt * fr * (s.podVodou ? 2 : 5 + 8 * sila);
    phK += dt * (2 + Math.min(8, s.rych) * 1.2);
    const tr = (0.02 + 0.045 * sila) * (s.podVodou ? 1.5 : 1);
    const kr = krok * Math.min(1, s.rych / 5) * Math.sin(phK + strana) * Math.abs(ca);
    o.rotation.x = rx + amp * (lift + kr + tr * (Math.sin(ph) + 0.4 * Math.sin(ph * 2.3 + 1.1)));
    o.rotation.z = rz + amp * tr * 0.6 * Math.sin(ph * 0.7 + faza * 2);
  };
  return o;
}
// visiaci privesok / strapec: tlmena pruzina (zaostava pri behu, dobieha pri zastaveni, hojda sa krokmi); lo/hi = medze vychylky dopredu/dozadu
function kyvadlo(o, faza = 0, amp = 1, lo = -0.6, hi = 0.6) {
  const rx = o.rotation.x, rz = o.rotation.z;
  let ax = 0, vx = 0, az = 0, vz = 0, ph = faza;
  o.userData.ziva = true;
  o.userData.anim = s => {
    const dt = Math.min(0.05, s.dt), vl = s.vietorLok || NULA, voda = s.podVodou;
    ph += dt * (2.2 + Math.min(8, s.rych) * 1.25);
    const bob = Math.min(1, s.rych / 5) * 0.18 * Math.sin(ph);
    const tx = -kl(s.vpred || 0, -3, 8) * 0.06 - (voda ? 0 : vl.z * 0.15) + bob;
    const tz = (voda ? 0 : vl.x * 0.15) + bob * 0.6 * Math.sin(ph * 0.5 + faza);
    const k = voda ? 8 : 40, c = voda ? 5 : 3;
    vx += ((tx - ax) * k - vx * c) * dt; const nx = ax + vx * dt; if (nx < lo || nx > hi) vx = 0; ax = kl(nx, lo, hi);
    vz += ((tz - az) * k - vz * c) * dt; az = kl(az + vz * dt, -0.5, 0.5);
    const tr = voda ? 0 : 0.015 * Math.min(1.5, Math.hypot(vl.x, vl.z)) * Math.sin(s.t * 9 + faza);
    o.rotation.x = rx + amp * ax + tr; o.rotation.z = rz + amp * az;
  };
  return o;
}
// zeravy material dycha (pulz + jemne mihotanie, pri behu jasnejsi, pod vodou tlmeny); volanie viackrat za snimok nevadi
function pulz(o, m) {
  o.userData.anim = s => {
    const t = s.t, b = Math.min(1, s.rych / 6);
    m.emissiveIntensity = 0.5 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.5)) + 0.3 * b + 0.1 * Math.sin(t * 7.3) * Math.sin(t * 2.9) - (s.podVodou ? 0.25 : 0);
  };
  return o;
}
// krabie ocne stopky: pomale rozhliadanie, obcasne cuknutie, pri behu a pod vodou sa sklopia dozadu
function oko(o, k) {
  const rx = o.rotation.x, rz = o.rotation.z; let sk = 0;
  o.userData.ziva = true;
  o.userData.anim = s => {
    const ciel = (s.podVodou ? 0.6 : 0) + Math.min(1, s.rych / 6) * 0.35;
    sk += (ciel - sk) * Math.min(1, s.dt * 4);
    const t = s.t, cuk = Math.pow(Math.max(0, Math.sin(t * 0.43 + k * 2)), 30) * 0.35;
    o.rotation.x = rx + sk + 0.08 * Math.sin(t * 0.9 + k) + 0.04 * Math.sin(t * 2.3 + k * 2) + cuk;
    o.rotation.z = rz + 0.1 * Math.sin(t * 0.6 + k * 1.3) - k * 0.05 * Math.sin(t * 1.7);
  };
  return o;
}
// tykadlo: svizne kmitanie, rychlejsie pri behu
function tykadlo(o, k) {
  const rx = o.rotation.x, rz = o.rotation.z; let ph = k;
  o.userData.ziva = true;
  o.userData.anim = s => {
    const b = Math.min(1, s.rych / 6); ph += Math.min(0.05, s.dt) * (3 + s.rych * 1.5);
    o.rotation.x = rx + 0.12 * Math.sin(ph) + b * 0.3; o.rotation.z = rz + 0.1 * Math.sin(ph * 0.7 + k);
  };
  return o;
}
// pohyblivy prst klepeta: vacsinou zavrety, obcas cvakne (pri behu castejsie)
function klepeto(o, k) {
  const rx = o.rotation.x;
  o.userData.ziva = true;
  o.userData.anim = s => {
    const b = Math.min(1, s.rych / 6), sn = 0.5 + 0.5 * Math.sin(s.t * (0.8 + b * 2.5) + k * 1.7);
    o.rotation.x = rx - 0.38 * Math.pow(sn, 5 - b * 3);
  };
  return o;
}

// ---------- HLAVA (suradnice hlavy: lebka okolo (0, 0.11, 0); vlasy do r~0.23 okolo (0, 0.13, 0.03), vrch y~0.34) ----------
const HC = [0, 0.13, 0.04], HR = 0.215, HSY = 1.04, TH_P = 0.41 * PI;        // kupola helmy, TH_P = predny okraj (nad obocim)
const HY = th => HC[1] + HR * HSY * Math.cos(th), HRX = th => HR * Math.sin(th);
const Y_OKRAJ = HY(TH_P), R_OKRAJ = HRX(TH_P);
function bodHlavy(th, a, d, v) { const r = HR + d; return v.set(r * Math.sin(th) * Math.sin(a), HC[1] + r * HSY * Math.cos(th), HC[2] - r * Math.sin(th) * Math.cos(a)); }
const naHlavu = (o, th, a, d = 0.004, sklon = 0) => naGuli(o, HC, HR, HSY, th, a, d, sklon);
// kupola (cela okolo) + zatylok/bocnice (len vzadu a po bokoch, tvar zostava volna)
function kupolaHelmy(g, t, m, mZ, zadTh, zadA, mod, nu = 64, dR = 0) {
  g.add(M(G('hk' + t, () => kupolaGeo(HR + dR, 0, TH_P, -PI, PI, nu, 9, mod)), m, HC[0], HC[1], HC[2], 1, HSY, 1));
  g.add(M(G('hz' + t, () => kupolaGeo(HR + dR, TH_P - 0.03, zadTh, zadA, 2 * PI - zadA, Math.round(nu * 0.6), 5, mod)), mZ, HC[0], HC[1], HC[2], 1, HSY, 1));
}
const okrajHelmy = (g, m, hr, hy = hr, d = 0.004) => g.add(M(gPas(R_OKRAJ + d, R_OKRAJ + d, hr, hy), m, HC[0], Y_OKRAJ, HC[2]));
// rady (listov, supin) na kupole: [theta/PI, pocet, dlzka, zatylok od a/PI]; nad tvarou sa skracuju, aby nezakryvali oci
function radyHelmy(g, rady, fn) {
  rady.forEach(([thp, n, L, za], r) => {
    const th = thp * PI, a0 = za ? za * PI : -PI + (r % 2) * PI / n, a1 = za ? (2 - za) * PI : PI + (r % 2) * PI / n;
    uhly(n, a0, a1).forEach((a, i) => {
      let l = L;
      if (!za && Math.abs(wr(a)) < 0.62) { const max = (TH_P + 0.03 - th) * HR; if (max < 0.04) return; l = Math.min(L, max); }
      l = Math.round(l * 1000) / 1000;
      const o = fn(l, i, r, a);
      if (o) g.add(naHlavu(o, th, a, 0.004, -l / (2 * HR) + 0.06));
    });
  });
}

function helma(t) {
  const m = mat(t), g = new THREE.Group(), v = new THREE.Vector3();
  if (t === 'list') {
    kupolaHelmy(g, t, m.z, m.z, 0.62 * PI, 0.42 * PI);
    radyHelmy(g, [[0.06, 4, 0.09], [0.16, 8, 0.1], [0.26, 11, 0.11], [0.35, 14, 0.11], [0.47, 10, 0.1, 0.45], [0.56, 9, 0.09, 0.48]],
      (L, i, r) => { const l = M(gList(L), [m.a, m.b, m.c][(i + r) % 3]); l.rotation.z = (hash(i * 7 + r) - 0.5) * 0.5; return l; });
    okrajHelmy(g, m.v, 0.007, 0.007, 0.012);                       // celenka z vlakna
    bodHlavy(TH_P, -0.62 * PI, 0.022, v);                            // uzol nad lavym uchom + dve visiace vlakna s listkom
    g.add(M(gGula(0.019, 8, 6), m.u, v.x, v.y, v.z, 1, 0.8, 1));
    [[-0.012, 0.09, 0], [0.012, 0.075, 1.3]].forEach(([dz, L, f]) => {
      const s = pramen(m.v, L, M(gList(0.05), m.a)); s.position.set(v.x, v.y - 0.01, v.z + dz);
      g.add(kyvadlo(zapec(s), f, 1, -0.5, 0.5));
    });
    bodHlavy(0.07 * PI, PI, -0.006, v);                               // vyhonok navrchu: tri listky trcia hore a trepocu sa
    [[-0.8, 0.12, m.c], [0, 0.15, m.a], [0.8, 0.12, m.b]].forEach(([da, L, mm], j) => {
      const h = new THREE.Group(); h.position.copy(v); h.rotation.y = -(PI + da);
      const l = M(gList(L), mm); l.rotation.x = PI - 0.5; h.add(trepot(l, PI + da, j * 1.7, -0.7)); g.add(h);
    });
  } else if (t === 'bambus') {
    kupolaHelmy(g, t, m.a, m.a, 0.64 * PI, 0.62 * PI, (a, th) => 1 + 0.03 * Math.pow(Math.abs(Math.cos(a * 9)), 0.35) * Math.min(1, th * 5), 108);
    for (const th of [0.16 * PI, 0.29 * PI]) { const r = HRX(th) * 1.03 + 0.004; g.add(M(gPas(r, r, 0.006, 0.008), m.z, HC[0], HY(th), HC[2])); }   // kolienka
    okrajHelmy(g, m.b, 0.011, 0.014, 0.01);
    for (const a of uhly(10)) {                                       // omotavky okraja
      const h = new THREE.Group(); bodHlavy(TH_P, a, 0.012, h.position); h.rotation.y = -a;
      h.add(M(G('omot', () => new THREE.TorusGeometry(0.017, 0.005, 4, 10).rotateY(PI / 2)), m.v)); g.add(h);
    }
    const yT = HC[1] + HR * HSY;                                      // useknuty vrchol trubky
    g.add(M(gValec(0.024, 0.028, 0.05, 8), m.a, 0, yT + 0.02, HC[2]));
    g.add(M(gTor(0.029, 0.006, 10), m.z, 0, yT + 0.002, HC[2]));
    g.add(M(gValec(0.019, 0.019, 0.004, 8), m.u, 0, yT + 0.044, HC[2]));
    for (const k of [-1, 1]) {                                        // lícnice z troch trubiek, previazane
      const a0 = k * 0.5 * PI;
      for (const da of [-0.13, 0, 0.13]) {
        const tr = M(gVisi(0.013, 0.1, 6), m.a); tr.add(M(gTor(0.0155, 0.004, 8), m.z, 0, -0.055, 0));
        g.add(naHlavu(tr, TH_P - 0.01, a0 + da, 0.018, -0.2));
      }
      const th2 = TH_P + 0.26, r2 = HR + 0.034;
      g.add(M(gPas(r2 * Math.sin(th2), r2 * Math.sin(th2), 0.004, 0.004, a0 - 0.2, a0 + 0.2, 8), m.v, HC[0], HC[1] + r2 * HSY * Math.cos(th2), HC[2]));
    }
    bodHlavy(0.3 * PI, PI, 0.01, v);                                  // strapec vzadu
    g.add(M(gGula(0.016, 8, 6), m.v, v.x, v.y, v.z));
    const str = pramen(m.v, 0.06, M(G('strapec', () => new THREE.ConeGeometry(0.017, 0.06, 6).translate(0, -0.03, 0)), m.u));
    str.position.copy(v); str.rotation.x = -0.6; g.add(kyvadlo(zapec(str), 0.5, 1, -0.7, 0.1));
  } else if (t === 'lastura') {
    kupolaHelmy(g, t, m.a, m.z, 0.58 * PI, 0.45 * PI, (a, th) => 1 + 0.032 * Math.pow(Math.abs(Math.cos(a * 7)), 0.6) * Math.min(1, th * 3), 84);
    okrajHelmy(g, m.b, 0.01, 0.012, 0.012);
    for (const a of uhly(26)) { if (Math.abs(wr(a)) > 0.45 * PI) continue; bodHlavy(TH_P, a, 0.03, v); g.add(M(gGula(0.011, 8, 6), m.c, v.x, v.y - 0.004, v.z)); }   // perly na okraji
    uhly(7, 0.46 * PI, 1.54 * PI).forEach((a, i) => g.add(naHlavu(M(gMus(0.085, 9), i % 2 ? m.b : m.a), TH_P - 0.02, a, 0.012, -0.12)));   // zatylok z mušlí
    bodHlavy(0.2 * PI, 0, -0.004, v);                                 // tiara: vztycena musla vpredu navrchu
    const tia = M(gMus(0.08, 11), m.a, v.x, v.y, v.z); tia.rotation.set(0.35, 0, PI); g.add(tia);
    g.add(M(gGula(0.016, 10, 8), m.c, v.x, v.y, v.z - 0.012));
    for (const k of [-1, 1]) { bodHlavy(0.24 * PI, k * 0.42, 0, v); const o = M(gMus(0.05, 7), m.b, v.x, v.y, v.z); o.rotation.set(0.4, -k * 0.5, PI + k * 0.5); g.add(o); }
    for (const k of [-1, 1]) {                                        // nausnice: sniurka perli s mušličkou
      bodHlavy(TH_P, k * 0.4 * PI, 0.02, v);
      const s = new THREE.Group(); s.add(M(gVisi(0.003, 0.1, 4), m.v));
      for (let j = 0; j < 4; j++) s.add(M(gGula(0.011, 8, 6), m.c, 0, -0.018 - j * 0.022, 0));
      s.add(M(gMus(0.032, 5), m.b, 0, -0.1, 0));
      s.position.copy(v); g.add(kyvadlo(zapec(s), k, 0.8, -0.4, 0.4));
    }
  } else if (t === 'krab') {
    kupolaHelmy(g, t, m.a, m.b, 0.66 * PI, 0.4 * PI, (a, th) => 1 + 0.035 * ((th / (0.115 * PI)) % 1) + 0.006 * Math.sin(a * 14) * Math.sin(th * 9), 72);
    okrajHelmy(g, m.b, 0.01, 0.012, 0.01);
    for (const a of uhly(7, -0.33 * PI, 0.33 * PI)) { bodHlavy(TH_P, a, 0.012, v); g.add(M(G('zub', () => new THREE.ConeGeometry(0.008, 0.02, 4).rotateX(PI).translate(0, -0.01, 0)), m.c, v.x, v.y - 0.008, v.z)); }   // zubaty predny okraj
    for (const [th, a] of [[0.1, 0], [0.04, PI], [0.14, PI], [0.25, PI], [0.36, PI], [0.47, 0.62 * PI], [0.56, 0.62 * PI], [0.47, -0.62 * PI], [0.56, -0.62 * PI]])
      g.add(naHlavu(M(gOstn(), m.c), th * PI, a, -0.002));
    for (const k of [-1, 1]) {                                        // ocne stopky
      const st = new THREE.Group();
      st.add(M(G('stopka', () => new THREE.CylinderGeometry(0.008, 0.012, 0.07, 6).translate(0, 0.035, 0)), m.a));
      st.add(M(gGula(0.02, 10, 8), m.oko, 0, 0.078, 0));
      st.add(M(gGula(0.006, 6, 5), m.c, 0.005 * k, 0.085, -0.016));
      st.rotation.set(-0.9, 0, -k * 0.3);
      g.add(naHlavu(st, 0.26 * PI, k * 0.17, -0.006)); zapec(st); oko(st, k);
    }
    for (const k of [-1, 1]) {                                        // tykadla
      const an = M(G('tykadlo', () => rohGeo(0.11, 0.004, 1.1, 0.0015, 4, 6)), m.b); an.rotation.set(-1.0, 0, -k * 0.5);
      g.add(naHlavu(an, 0.3 * PI, k * 0.07, -0.004)); tykadlo(an, k);
    }
  } else {                                                            // supina: supiny nad zeravou vrstvou, rohy
    kupolaHelmy(g, t, m.zar, m.zar, 0.64 * PI, 0.4 * PI, null, 40, -0.004);
    radyHelmy(g, [[0.03, 5, 0.06], [0.11, 9, 0.07], [0.19, 12, 0.075], [0.27, 15, 0.075], [0.35, 17, 0.075], [0.46, 12, 0.075, 0.42], [0.55, 11, 0.075, 0.44]],
      (L, i, r) => M(gSup(L), r % 2 ? m.b : m.a));
    okrajHelmy(g, m.b, 0.012, 0.016, 0.008);
    for (const k of [-1, 1]) { bodHlavy(TH_P, k * 0.2, 0.024, v); g.add(M(G('drahokam', () => new THREE.OctahedronGeometry(0.014)), m.zar, v.x, v.y, v.z, 1, 0.8, 0.6)); }
    for (const k of [-1, 1]) {
      bodHlavy(0.27 * PI, k * 0.42 * PI, -0.012, v);
      const roh = M(gRoh(0.16, 0.025, 1.4, 7), m.c, v.x, v.y, v.z); roh.rotation.set(-0.25, 0, -k * 0.65);
      roh.add(M(gTor(0.027, 0.007, 10), m.b, 0, 0.012, 0)); g.add(roh);
    }
    const ostn = G('ostnS', () => rohGeo(0.05, 0.014, 0.5).rotateX(-PI / 2));
    for (const th of [0.12, 0.22, 0.32]) g.add(naHlavu(M(ostn, m.b), th * PI, PI, 0));
    pulz(g, m.zar);
  }
  return [{ j: 'hlava', o: zapec(g), bake: [0, 0, 0] }];
}

// ---------- TELO (J.chrbat: trup od pasa y=0 po krk y=0.5, vpredu = -z) ----------
const PROF_T = [[0.148, 0.0], [0.145, 0.1], [0.14, 0.18], [0.158, 0.3], [0.178, 0.38], [0.17, 0.455], [0.1, 0.5]];   // ako tricko v postava.js
const rT = y => { for (let i = 1; i < PROF_T.length; i++) if (y <= PROF_T[i][1]) { const [r0, y0] = PROF_T[i - 1], [r1, y1] = PROF_T[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return 0.1; };
const SX = 1.3, SZ = 0.78;
const gTrup = d => G('tr' + d, () => new THREE.LatheGeometry(PROF_T.map(([r, y]) => new THREE.Vector2(r + d, y)), 28).scale(SX, 1, SZ));
const okoloTrupu = (g, n, y, d, fn, a0 = -PI, a1 = PI) => okolo(g, n, a0, a1, y, (rT(y) + d) * SX, (rT(y) + d) * SZ, fn);
const pazy = a => Math.abs(Math.sin(a)) > 0.86;                    // miesto pre ruky (horne rady tam vynechame)
const elip = (a, y, r) => [r * SX * Math.sin(a), y, -r * SZ * Math.cos(a)];
const bodTrupu = (x, y, d) => [x, y, -SZ * Math.sqrt(Math.max(0, (rT(y) + d) ** 2 - (x / SX) ** 2))];

// naplecnik (J.rL / J.rP: rameno, ruka visi dole, von = k*x)
const RC = [0, 0.005, 0], RR = 0.105, RSY = 0.85;
function plece(t, k) {
  const m = mat(t), g = new THREE.Group(), ruka = k * PI / 2;
  const kup = (mm, mod) => g.add(M(G('ram' + t, () => kupolaGeo(0.1, 0, 0.58 * PI, -PI, PI, 32, 6, mod)), mm, 0, 0.005, 0, 1.05, RSY, 1.05));
  const naRam = (o, th, a, d = 0.003, sklon = 0) => naGuli(o, RC, RR, RSY, th, a, d, sklon);
  if (t === 'list') {
    kup(m.z);
    g.add(naRam(M(gList(0.12), m.b), 0.1 * PI, ruka, 0.004, -0.2));
    for (const s of [-1, 1]) { const l = M(gList(0.13), s > 0 ? m.a : m.c); l.rotation.z = s * 0.15; g.add(naRam(l, 0.3 * PI, ruka + s * 0.5, 0.006, 0.05)); trepot(l, ruka + s * 0.5, s + k, 0.8); }
    for (const s of [-1, 1]) g.add(naRam(M(gList(0.1), m.a), 0.28 * PI, ruka + s * 1.35, 0.004, -0.1));
    g.add(M(gPas(0.086, 0.086, 0.006, 0.006), m.v, 0, -0.065, 0));
    g.add(M(gGula(0.016, 8, 6), m.u, k * 0.09, -0.065, 0));
  } else if (t === 'bambus') {
    kup(m.b);
    for (let j = 0; j < 3; j++) {                                     // lamely z vodorovnych trubiek
      const x = k * (0.105 + j * 0.006), y = 0.02 - j * 0.044;
      g.add(M(G('btR', () => new THREE.CylinderGeometry(0.017, 0.017, 0.16, 7).rotateX(PI / 2)), m.a, x, y, 0));
      g.add(M(G('btRu', () => new THREE.TorusGeometry(0.0195, 0.005, 4, 8)), m.z, x, y, 0.02));
    }
    for (const z of [-0.05, 0.05]) { const c = M(gValec(0.0045, 0.0045, 0.15, 4), m.v, k * 0.126, -0.025, z); c.rotation.z = k * 0.12; g.add(c); }
  } else if (t === 'lastura') {
    kup(m.z);
    const h = new THREE.Group(); h.position.set(k * 0.04, 0.085, 0); h.rotation.y = -ruka;
    const s1 = M(gMus(0.12, 11), m.a); s1.rotation.x = 0.55;
    const s2 = M(gMus(0.1, 9), m.b, 0, -0.02, 0.018); s2.rotation.x = 0.35;
    h.add(s2, s1, M(gGula(0.016, 10, 8), m.c, 0, 0, -0.012)); g.add(h);
  } else if (t === 'krab') {
    kup(m.a, (a, th) => 1 + 0.04 * ((th / (0.16 * PI)) % 1));
    [[-0.005, -0.055], [-0.045, -0.1]].forEach(([y0, y1], j) => {
      g.add(M(G('kram' + j + '_' + k, () => obrucGeo((y, v) => 0.088 + j * 0.006 + 0.014 * v * v, y0, y1, 1, 1, ruka - 1.3, ruka + 1.3, 14, 3)), m.a));
      g.add(M(gPas(0.102 + j * 0.006, 0.102 + j * 0.006, 0.004, 0.004, ruka - 1.3, ruka + 1.3, 14), m.b, 0, y1, 0));
    });
    const kl = new THREE.Group();                                     // klepeto: dlan + pevny prst + pohyblivy prst
    kl.add(M(gGula(1, 10, 8), m.a, 0, 0, 0.012, 0.034, 0.03, 0.05));
    kl.add(M(G('prst1', () => rohGeo(0.085, 0.019, -0.9).rotateX(-PI / 2)), m.a, 0, 0.013, -0.025));
    const p2 = M(G('prst2', () => rohGeo(0.068, 0.015, 0.9).rotateX(-PI / 2)), m.b, 0, -0.013, -0.025);
    kl.add(p2); kl.position.set(k * 0.06, 0.085, -0.01); kl.rotation.set(0.25, 0, -k * 0.3); g.add(kl);
    klepeto(p2, k);
    for (const th of [0.2, 0.36]) g.add(naRam(M(gOstn(), m.c), th * PI, ruka + k * 0.9, -0.002));
  } else {
    kup(m.zar);
    [[0.05, 4], [0.19, 8], [0.33, 10], [0.47, 12]].forEach(([thp, n], r) => uhly(n, ...alt(r, n)).forEach((a, i) => {
      if (Math.cos(a - ruka) < -0.35) return;                         // nie na strane krku
      g.add(naRam(M(gSup(0.06), (r + i) % 2 ? m.a : m.b), thp * PI, a, 0.004, -0.14));
    }));
    okolo(g, 5, ruka - 1.1, ruka + 1.1, -0.035, 0.09, 0.09, () => { const s = M(gSup(0.085), m.b); s.rotation.x = 0.2; return s; });
    const roh = M(gRoh(0.09, 0.018, 0.6), m.c, k * 0.05, 0.075, 0.01); roh.rotation.set(0, 0, -k * 1.0); g.add(roh);
    pulz(g, m.zar);
  }
  return zapec(g);
}

function hrudnik(t) {
  const m = mat(t), g = new THREE.Group();
  const pas = (mm, y, d, hr, hy = hr) => g.add(M(gPas((rT(y) + d) * SX, (rT(y) + d) * SZ, hr, hy), mm, 0, y, 0));
  if (t === 'list') {
    g.add(M(gTrup(0.012), m.z));
    [[0.43, 15, 0.13], [0.33, 17, 0.135], [0.23, 17, 0.135], [0.13, 18, 0.13]].forEach(([y, n, L], r) => okoloTrupu(g, n, y, 0.022 + r * 0.003, (i, a) => {
      if (y > 0.3 && pazy(a)) return null;
      const l = M(gList(L), [m.a, m.b, m.c][(i + r) % 3]); l.rotation.set(0.14, 0, (hash(i * 3 + r) - 0.5) * 0.35);
      return r === 3 ? trepot(l, a, hash(i) * 6) : l;               // spodny rad sa trepoce
    }, ...alt(r, n)));
    okoloTrupu(g, 12, 0.47, 0.012, (i, a) => { if (pazy(a)) return null; const l = M(gList(0.08), i % 2 ? m.b : m.c); l.rotation.x = PI - 0.55; return l; });   // golier
    for (const k of [-1, 1]) g.add(M(gRurka('lpas' + k, [-0.15, -0.08, 0, 0.07, 0.13].map((x, j) => bodTrupu(k * x, 0.44 - j * 0.085, 0.045)), 0.007), m.v));   // krizom viazane vlakno
    g.add(M(gGula(0.017, 8, 6), m.u, ...bodTrupu(0, 0.27, 0.052)));
    pas(m.v, 0.074, 0.03, 0.007); pas(m.v, 0.06, 0.03, 0.007);       // opasok z dvoch skrutenych snur + uzol s vlaknami
    const ak = -0.35, rr = rT(0.067) + 0.04, kx = rr * SX * Math.sin(ak), kz = -rr * SZ * Math.cos(ak);
    g.add(M(gGula(0.019, 8, 6), m.u, kx, 0.067, kz));
    [[-0.01, 0.1, 0.4], [0.012, 0.08, 1.7]].forEach(([dx, L, f]) => {
      const s = pramen(m.v, L, M(gList(0.05), m.c)); s.position.set(kx + dx, 0.06, kz - 0.006); s.rotation.x = 0.15;
      g.add(kyvadlo(zapec(s), f, 1, -0.05, 0.6));
    });
  } else if (t === 'bambus') {
    g.add(M(gTrup(0.01), m.b));
    const D = 0.036, rLin = y => rT(0.445) + (rT(0.075) - rT(0.445)) * (0.445 - y) / 0.37 + D;
    for (const [a0, a1] of [[-0.3 * PI, 0.3 * PI], [0.7 * PI, 1.3 * PI]]) {   // predny a zadny plat zo zvislych trubiek
      for (const a of uhly(7, a0, a1)) {
        const p0 = elip(a, 0.445, rLin(0.445)), p1 = elip(a, 0.075, rLin(0.075));
        g.add(medzi(M(gValec(0.019, 0.019, 1, 7), m.a), p0, p1));
        for (const f of [0.3, 0.68]) g.add(M(gTor(0.0215, 0.005, 8), m.z, ...lerp3(p0, p1, f)));
      }
      for (const y of [0.2, 0.36]) { const r = rLin(y) + 0.02; g.add(M(gPas(r * SX, r * SZ, 0.006, 0.006, a0 - 0.1, a1 + 0.1, 14), m.v, 0, y, 0)); }
    }
    for (const k of [-1, 1]) g.add(M(gRurka('bram' + k, [[k * 0.1, 0.44, -0.158], [k * 0.11, 0.5, -0.09], [k * 0.115, 0.525, 0], [k * 0.11, 0.5, 0.09], [k * 0.1, 0.44, 0.158]], 0.008), m.v));
    pas(m.z, 0.067, 0.03, 0.01, 0.02);
    for (const k of [-1, 1]) {                                        // privesky z kusku bambusu na opasku
      const [x, , z] = elip(k * 0.28 * PI, 0.06, rT(0.06) + 0.045);
      const s = pramen(m.v, 0.035, skup(M(gValec(0.013, 0.013, 0.06, 6), m.c, 0, -0.03, 0), M(gTor(0.0145, 0.004, 8), m.z, 0, -0.02, 0)));
      s.position.set(x, 0.05, z); s.rotation.x = 0.1; g.add(kyvadlo(zapec(s), k, 1, -0.05, 0.6));
    }
  } else if (t === 'lastura') {
    g.add(M(gTrup(0.012), m.z));
    [[0.46, 10, 0.06], [0.38, 13, 0.075], [0.29, 14, 0.075], [0.2, 14, 0.075], [0.115, 15, 0.07]].forEach(([y, n, R], r) => okoloTrupu(g, n, y, 0.02, (i, a) => {
      if (y > 0.3 && pazy(a)) return null;
      const o = M(gMus(R, 9), (i + r) % 2 ? m.a : m.b); o.rotation.x = 0.15; return o;
    }, ...alt(r, n)));
    const md = new THREE.Group(); md.position.set(...elip(0, 0.41, rT(0.41) + 0.052));   // velka musla na hrudi
    const mm = M(gMus(0.09, 13), m.a); mm.rotation.x = 0.12; md.add(mm, M(gGula(0.017, 10, 8), m.c, 0, 0, -0.012)); g.add(md);
    okoloTrupu(g, 20, 0.488, 0.012, () => M(gGula(0.011, 8, 6), m.c));   // nahrdelnik z perli
    for (const k of [-1, 1]) {                                        // visiace sniurky perli
      const s = new THREE.Group(); s.add(M(gVisi(0.003, 0.09, 4), m.v));
      for (let j = 0; j < 3; j++) s.add(M(gGula(0.01, 8, 6), m.c, 0, -0.018 - j * 0.022, 0));
      s.add(M(gGula(0.015, 8, 6), m.b, 0, -0.09, 0, 1, 1.4, 0.7));
      s.position.set(...elip(k * 0.5, 0.44, rT(0.44) + 0.06)); s.rotation.x = 0.25; g.add(kyvadlo(zapec(s), k * 1.3, 1, 0, 0.5));
    }
    pas(m.b, 0.067, 0.028, 0.011, 0.016);
    okoloTrupu(g, 16, 0.067, 0.044, () => M(gGula(0.011, 8, 6), m.c, 0, 0, 0, 1, 1.3, 0.7));
  } else if (t === 'krab') {
    g.add(M(gTrup(0.01), m.z));
    [[0.455, 0.36], [0.36, 0.26], [0.26, 0.16], [0.16, 0.055]].forEach(([y0, y1], i) => {   // clankovane platne, spodny okraj vyhrnuty
      g.add(M(G('kpas' + i, () => obrucGeo((y, v) => rT(y) + 0.02 + 0.018 * v * v, y0, y1, SX, SZ, -PI, PI, 32, 4)), m.a));
      pas(m.b, y1, 0.038, 0.004);
    });
    g.add(M(G('kjarmo', () => obrucGeo((y, v) => rT(y) + 0.016 + 0.01 * v, 0.505, 0.45, SX, SZ, -PI, PI, 32, 3)), m.b));
    g.add(M(gGula(1, 16, 10), m.c, 0, 0.29, -(rT(0.29) + 0.04) * SZ, 0.085, 0.105, 0.022));   // svetly brusny stit
    for (const y of [0.25, 0.33]) g.add(M(gGula(1, 8, 6), m.b, 0, y, -(rT(y) + 0.058) * SZ, 0.07, 0.006, 0.01));
    for (const y of [0.13, 0.22, 0.31, 0.4]) g.add(M(gOstnZ(), m.c, 0, y, (rT(y) + 0.03) * SZ));   // hrbet: hroty
    pas(m.b, 0.062, 0.03, 0.009, 0.016);
    g.add(M(G('spona', () => new THREE.BoxGeometry(0.05, 0.036, 0.014)), m.c, 0, 0.062, -(rT(0.062) + 0.04) * SZ));
  } else {
    g.add(M(gTrup(0.006), m.zar));                                    // zeriava vrstva pod supinami
    for (let r = 0; r < 8; r++) {
      const y = 0.47 - r * 0.055;
      okoloTrupu(g, 21, y, 0.014, (i, a) => { if (y > 0.3 && pazy(a)) return null; const s = M(gSup(0.078), r % 2 ? m.a : m.b); s.rotation.x = 0.1; return s; }, ...alt(r, 21));
    }
    okoloTrupu(g, 12, 0.48, 0.008, (i, a) => { if (pazy(a)) return null; const s = M(gSup(0.06), m.b); s.rotation.x = PI - 0.45; return s; });   // golier
    for (const y of [0.16, 0.26, 0.36]) g.add(M(gOstnZ(), m.c, 0, y, (rT(y) + 0.03) * SZ));
    pas(m.b, 0.06, 0.028, 0.009, 0.018);
    g.add(M(G('spona2', () => new THREE.OctahedronGeometry(0.022)), m.zar, 0, 0.06, -(rT(0.06) + 0.044) * SZ, 1, 1, 0.5));
    pulz(g, m.zar);
  }
  return [{ j: 'chrbat', o: zapec(g), bake: [0, 0, 0] }, { j: 'rL', o: plece(t, -1), bake: [-0.23, 0.42, 0] }, { j: 'rP', o: plece(t, 1), bake: [0.23, 0.42, 0] }];
}

// ---------- NOHY: sukna (J.telo, y 0.085 .. -0.185) + stehna (J.sL/sP, noha visi do -0.46) + kolena (J.kL/kP) ----------
const SXs = 1.28, SZs = 0.84, rS = y => 0.162 + 0.075 * (0.085 - y) / 0.27;
const gSukna = d => G('su' + d, () => new THREE.CylinderGeometry(0.162 + d, 0.237 + d, 0.27, 28, 1, true));
const okoloSukne = (g, n, y, d, fn, a0 = -PI, a1 = PI) => okolo(g, n, a0, a1, y, (rS(y) + d) * SXs, (rS(y) + d) * SZs, fn);
const capa = mm => M(G('kolC', () => new THREE.SphereGeometry(0.078, 12, 8, 0, PI * 2, 0, PI * 0.55).rotateX(-PI / 2 + 0.2)), mm, 0, 0, -0.035);

function nohy(t) {
  const m = mat(t), g = new THREE.Group(), K = [-1, 1];
  const st = K.map(() => new THREE.Group()), kol = K.map(() => new THREE.Group());
  const zaklad = (mm, d = 0.004) => g.add(M(gSukna(d), mm, 0, -0.05, 0, SXs, 1, SZs));
  const pas = (mm, y, d, hr, hy = hr) => g.add(M(gPas((rS(y) + d) * SXs, (rS(y) + d) * SZs, hr, hy), mm, 0, y, 0));
  if (t === 'list') {
    zaklad(m.z);
    [[0.075, 15, 0.11], [-0.02, 17, 0.13], [-0.11, 19, 0.14]].forEach(([y, n, L], r) => okoloSukne(g, n, y, 0.012 + r * 0.004, (i, a) => {
      const l = M(gList(L), [m.a, m.b, m.c][(i + r) % 3]); l.rotation.set(0.3, 0, (hash(i * 5 + r) - 0.5) * 0.3);
      return r === 2 ? trepot(l, a, hash(i + 9) * 6, 1, 1, 0.1) : l;
    }, ...alt(r, n)));
    pas(m.v, 0.088, 0.014, 0.007); pas(m.v, 0.074, 0.014, 0.007);
    const a = 0.35, rr = rS(0.08) + 0.024, kx = rr * SXs * Math.sin(a), kz = -rr * SZs * Math.cos(a);
    g.add(M(gGula(0.018, 8, 6), m.u, kx, 0.08, kz));
    [[-0.01, 0.1, 0.2], [0.012, 0.08, 1.4]].forEach(([dx, L, f]) => {
      const s = pramen(m.v, L, M(gList(0.05), m.a)); s.position.set(kx + dx, 0.072, kz - 0.008); s.rotation.x = 0.35;
      g.add(kyvadlo(zapec(s), f, 1, -0.05, 0.5));
    });
    K.forEach((k, i) => {
      st[i].add(M(gValec(0.094, 0.086, 0.21, 12), m.z, 0, -0.3, 0));
      okolo(st[i], 6, -PI, PI, -0.19, 0.096, 0.096, j => { const l = M(gList(0.12), j % 2 ? m.a : m.b); l.rotation.x = 0.1; return l; });
      st[i].add(M(gPas(0.093, 0.093, 0.006, 0.006), m.v, 0, -0.385, 0));
      kol[i].add(capa(m.b));
      const l = M(gList(0.1), m.a, 0, 0.07, -0.1); l.rotation.x = 0.35; kol[i].add(l, M(gGula(0.014, 8, 6), m.u, 0, 0.072, -0.102));
    });
  } else if (t === 'bambus') {
    zaklad(m.b);
    uhly(10).forEach((a, i) => {                                      // panely zo styroch trubiek, hojdaju sa
      const r = rS(0.075) + 0.02, h = new THREE.Group(); h.position.set(r * SXs * Math.sin(a), 0.075, -r * SZs * Math.cos(a)); h.rotation.y = -a;
      const p = new THREE.Group(); p.rotation.x = 0.3;
      for (const x of [-0.039, -0.013, 0.013, 0.039]) { const tr = M(gVisi(0.014, 0.25 - Math.abs(x) * 0.6, 6), m.a, x, 0, 0); tr.add(M(gTor(0.0155, 0.004, 8), m.z, 0, -0.1, 0)); p.add(tr); }
      for (const y of [-0.025, -0.16]) p.add(M(G('bpc', () => new THREE.CylinderGeometry(0.005, 0.005, 0.105, 4).rotateZ(PI / 2)), m.v, 0, y, -0.016));
      zapec(p); h.add(trepot(p, a, i * 1.3, 0.5, 0.4, 0.14)); g.add(h);
    });
    pas(m.z, 0.08, 0.016, 0.01, 0.018);
    K.forEach((k, i) => {
      st[i].add(M(gValec(0.09, 0.086, 0.18, 10), m.b, 0, -0.29, 0));
      okolo(st[i], 12, -PI, PI, -0.2, 0.1, 0.1, () => { const tr = M(gVisi(0.012, 0.16, 6), m.a); tr.add(M(gTor(0.0135, 0.0035, 8), m.z, 0, -0.08, 0)); return tr; });
      for (const y of [-0.23, -0.33]) st[i].add(M(gPas(0.113, 0.113, 0.005, 0.005), m.v, 0, y, 0));
      kol[i].add(capa(m.b));
      kol[i].add(M(G('bdisk', () => new THREE.CylinderGeometry(0.058, 0.058, 0.022, 10).rotateX(PI / 2)), m.a, 0, 0, -0.12));
      kol[i].add(M(G('bdiskT', () => new THREE.TorusGeometry(0.044, 0.006, 4, 12)), m.z, 0, 0, -0.132));
    });
  } else if (t === 'lastura') {
    zaklad(m.z);
    okoloSukne(g, 22, 0.074, 0.012, () => M(gGula(0.012, 8, 6), m.c));
    okoloSukne(g, 13, 0.02, 0.012, i => { const o = M(gMus(0.08, 9), i % 2 ? m.a : m.b); o.rotation.x = 0.3; return o; });
    okoloSukne(g, 15, -0.1, 0.016, (i, a) => { const o = M(gMus(0.085, 9), i % 2 ? m.b : m.a); o.rotation.x = 0.3; return trepot(o, a, hash(i) * 6, 0.45, 0.5, 0.1); }, ...alt(1, 15));
    pas(m.b, 0.086, 0.012, 0.01, 0.012);
    K.forEach((k, i) => {
      st[i].add(M(gValec(0.094, 0.086, 0.21, 12), m.z, 0, -0.3, 0));
      okolo(st[i], 6, -PI, PI, -0.2, 0.097, 0.097, j => { const o = M(gMus(0.05, 7), j % 2 ? m.a : m.b); o.rotation.x = 0.1; return o; });
      st[i].add(M(gPas(0.096, 0.096, 0.007, 0.009), m.b, 0, -0.2, 0));
      kol[i].add(capa(m.z));
      const h = new THREE.Group(); h.position.set(0, 0.05, -0.1); const o = M(gMus(0.075, 11), m.a); o.rotation.x = 0.25;
      h.add(o, M(gGula(0.014, 8, 6), m.c, 0, 0, -0.01)); kol[i].add(h);
    });
  } else if (t === 'krab') {
    zaklad(m.z);
    [[0.085, -0.005], [0.0, -0.095], [-0.09, -0.19]].forEach(([y0, y1], j) => {
      g.add(M(G('ksu' + j, () => obrucGeo((y, v) => rS(y) + 0.012 + 0.018 * v * v, y0, y1, SXs, SZs, -PI, PI, 32, 3)), m.a));
      pas(m.b, y1, 0.03, 0.004);
    });
    for (const a of [0, PI]) {                                        // predna a zadna klapka z dvoch platni, hojda sa
      const r = rS(0) + 0.04, h = new THREE.Group(); h.position.set(0, 0, -r * SZs * Math.cos(a)); h.rotation.y = -a;
      const f = new THREE.Group(); f.rotation.x = 0.32;
      f.add(M(G('kflap', () => platGeo(0.1, 0.06, v => 1 - 0.35 * v * v, 0.25, 0.06, false, 4, 4)), m.a));
      f.add(M(G('kflap2', () => platGeo(0.08, 0.05, v => 1 - 0.4 * v * v, 0.25, 0.06, false, 4, 4)), m.b, 0, -0.075, -0.012));
      zapec(f); h.add(trepot(f, a, a, 0.4, 0.35, 0.16)); g.add(h);
    }
    for (const k of K) { const y = -0.03, o = M(gOstnZ(), m.c, k * (rS(y) + 0.035) * SXs, y, 0); o.rotation.y = k * PI / 2; g.add(o); }
    K.forEach((k, i) => {
      st[i].add(M(gValec(0.092, 0.086, 0.2, 10), m.z, 0, -0.3, 0));
      [[-0.18, -0.27], [-0.265, -0.36]].forEach(([y0, y1], j) => {
        st[i].add(M(G('kst' + j, () => obrucGeo((y, v) => 0.094 + 0.016 * v * v, y0, y1, 1, 1, -PI, PI, 16, 3)), m.a));
        st[i].add(M(gPas(0.11, 0.11, 0.004, 0.004), m.b, 0, y1, 0));
      });
      const o = M(gOstnZ(), m.c, k * 0.112, -0.24, 0); o.rotation.y = k * PI / 2; st[i].add(o);
      kol[i].add(capa(m.a));
      kol[i].add(M(G('kkol', () => obrucGeo((y, v) => 0.08 + 0.014 * v * v, 0.075, 0.025, 1, 1, -1.2, 1.2, 10, 3)), m.b));
      kol[i].add(M(gOstn(), m.c, 0, -0.005, -0.105));
    });
  } else {
    zaklad(m.zar, 0);
    [0.07, 0.015, -0.04, -0.095].forEach((y, r) => okoloSukne(g, 22 + r, y, 0.012, () => { const s = M(gSup(0.075), r % 2 ? m.a : m.b); s.rotation.x = 0.3; return s; }, ...alt(r, 22 + r)));
    okoloSukne(g, 18, -0.14, 0.016, (i, a) => { const s = M(gSup(0.09), i % 2 ? m.a : m.b); s.rotation.x = 0.3; return trepot(s, a, hash(i) * 6, 0.35, 0.5, 0.1); });
    pas(m.b, 0.083, 0.012, 0.009, 0.014);
    const rg = rS(0.083) + 0.024;
    for (const k of K) g.add(M(G('drahokam', () => new THREE.OctahedronGeometry(0.014)), m.zar, rg * SXs * Math.sin(k * 0.3), 0.083, -rg * SZs * Math.cos(0.3), 1, 0.8, 0.6));
    K.forEach((k, i) => {
      st[i].add(M(gValec(0.09, 0.085, 0.21, 10), m.zar, 0, -0.3, 0));
      [-0.2, -0.255, -0.31, -0.365].forEach((y, r) => okolo(st[i], 10, -PI + r * PI / 10, PI + r * PI / 10, y, 0.096, 0.096, j => { const s = M(gSup(0.07), (r + j) % 2 ? m.a : m.b); s.rotation.x = 0.08; return s; }));
      const o = M(gRoh(0.06, 0.014, 0.5), m.c, k * 0.1, -0.25, 0.02); o.rotation.set(0, 0, -k * 1.4); st[i].add(o);
      kol[i].add(capa(m.a));
      const h = new THREE.Group(); h.position.set(0, 0.07, -0.1); const s = M(gSup(0.1), m.b); s.rotation.x = 0.3; h.add(s); kol[i].add(h);
      kol[i].add(M(gOstn(), m.c, 0, -0.01, -0.11));
    });
    pulz(g, m.zar);
  }
  const out = [{ j: 'telo', o: zapec(g), bake: [0, 0, 0] }];
  K.forEach((k, i) => out.push({ j: k < 0 ? 'sL' : 'sP', o: zapec(st[i]), bake: [0.1 * k, -0.02, 0] }, { j: k < 0 ? 'kL' : 'kP', o: zapec(kol[i]), bake: [0.1 * k, -0.48, 0] }));
  return out;
}

// ---------- CIZMY (J.kL / J.kP: koleno; holen visi do -0.44, chodidlo v (0,-0.44,-0.05)) ----------
const rH = y => 0.077 - 0.009 * (-0.145 - y) / 0.27;                  // polomer holene cizmy
function cizma(t, k) {
  const m = mat(t), g = new THREE.Group();
  const zaklad = (holen, chodidlo, podrazka, spicka, lem) => {
    g.add(M(gValec(0.077, 0.068, 0.27, 12), holen, 0, -0.28, 0));
    if (lem) g.add(M(gValec(0.082, 0.082, 0.03, 12), lem, 0, -0.14, 0));
    g.add(M(G('noha', () => new THREE.CapsuleGeometry(0.058, 0.13, 6, 12).rotateX(PI / 2)), chodidlo, 0, -0.445, -0.085, 1.12, 0.85, 1));
    g.add(M(G('podr', () => new THREE.BoxGeometry(0.128, 0.026, 0.3)), podrazka, 0, -0.484, -0.07));
    g.add(M(gGula(0.045, 8, 6), spicka, 0, -0.455, -0.2, 1.2, 0.8, 0.9));
  };
  if (t === 'list') {
    zaklad(m.z, m.b, m.u, m.a, m.v);
    [[-0.17, 0], [-0.26, 1], [-0.34, 0]].forEach(([y, r], j) => okolo(g, 7, -PI + r * PI / 7, PI + r * PI / 7, y, rH(y) + 0.006, rH(y) + 0.006, i => {
      const l = M(gList(0.1), [m.a, m.b, m.c][(i + j) % 3]); l.rotation.x = 0.08; return l;
    }));
    g.add(M(G('lspir', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 17 }, (_, i) => {   // spiralove viazanie
      const a = i / 16 * PI * 4, y = -0.17 - i / 16 * 0.23; return new THREE.Vector3(Math.sin(a) * (rH(y) + 0.024), y, -Math.cos(a) * (rH(y) + 0.024));
    })), 48, 0.005, 4)), m.v));
    g.add(M(gPas(0.072, 0.072, 0.006, 0.006), m.v, 0, -0.41, 0));
    okolo(g, 6, -PI + 0.3, PI + 0.3, -0.135, 0.083, 0.083, (i, a) => { const l = M(gList(0.075), i % 2 ? m.a : m.c); l.rotation.x = PI - 0.5; return trepot(l, a, i * 1.9, -0.6); });
  } else if (t === 'bambus') {
    zaklad(m.b, m.b, m.a, m.a, m.z);
    okolo(g, 5, -0.6, 0.6, -0.15, 0.09, 0.09, () => {                // chranic holene z trubiek
      const tr = M(gVisi(0.013, 0.25, 6), m.a); tr.rotation.x = -0.03;
      tr.add(M(gTor(0.0152, 0.004, 8), m.z, 0, -0.09, 0), M(gTor(0.0152, 0.004, 8), m.z, 0, -0.18, 0)); return tr;
    });
    for (const y of [-0.2, -0.35]) { g.add(M(gPas(0.105, 0.105, 0.005, 0.005, -0.75, 0.75, 12), m.v, 0, y, 0)); g.add(M(gPas(0.079 - (y + 0.2) * 0.03, 0.079 - (y + 0.2) * 0.03, 0.005, 0.005), m.v, 0, y, 0)); }
    for (const z of [-0.05, -0.15]) g.add(M(G('bpasN', () => new THREE.BoxGeometry(0.14, 0.012, 0.02)), m.v, 0, -0.405, z));
  } else if (t === 'lastura') {
    zaklad(m.z, m.b, m.z, m.a, m.b);
    [-0.15, -0.22, -0.29].forEach((y, j) => { const o = M(gMus(0.07, 9), j % 2 ? m.b : m.a, 0, y, -(rH(y) + 0.01)); o.rotation.x = 0.1; g.add(o); });
    okolo(g, 10, -PI, PI, -0.405, 0.074, 0.074, () => M(gGula(0.01, 8, 6), m.c));
    const s = new THREE.Group(); s.add(M(gVisi(0.003, 0.05, 4), m.v), M(gMus(0.03, 5), m.b, 0, -0.05, 0));
    s.position.set(k * 0.082, -0.15, 0.01); g.add(kyvadlo(zapec(s), k, 1, -0.5, 0.5));
  } else if (t === 'krab') {
    zaklad(m.z, m.a, m.b, m.a, m.b);
    [[-0.15, -0.24], [-0.235, -0.325], [-0.32, -0.41]].forEach(([y0, y1], j) => {
      g.add(M(G('kciz' + j, () => obrucGeo((y, v) => rH(y) + 0.008 + 0.014 * v * v, y0, y1, 1, 1, -PI, PI, 16, 3)), m.a));
      g.add(M(gPas(rH(y1) + 0.022, rH(y1) + 0.022, 0.0035, 0.0035), m.b, 0, y1, 0));
    });
    for (const y of [-0.2, -0.29]) g.add(M(gOstn(), m.c, 0, y, -(rH(y) + 0.018)));
    for (const x of [-0.03, 0.03]) g.add(M(G('kprst', () => rohGeo(0.05, 0.012, -0.8).rotateX(-PI / 2)), m.c, x, -0.46, -0.225));
    g.add(M(gOstnZ(), m.c, 0, -0.44, 0.045));
  } else {
    zaklad(m.zar, m.a, m.b, m.b, m.b);
    [-0.15, -0.2, -0.25, -0.3, -0.35].forEach((y, r) => okolo(g, 10, -PI + r * PI / 10, PI + r * PI / 10, y, rH(y) + 0.006, rH(y) + 0.006, i => {
      const s = M(gSup(0.06), (i + r) % 2 ? m.a : m.b); s.rotation.x = 0.06; return s;
    }));
    g.add(M(gOstn(), m.c, 0, -0.46, -0.235));
    g.add(M(gOstnZ(), m.c, 0, -0.43, 0.045));
    pulz(g, m.zar);
  }
  return zapec(g);
}
function cizmy(t) { return [{ j: 'kL', o: cizma(t, -1), bake: [0, 0.47, 0] }, { j: 'kP', o: cizma(t, 1) }]; }

const STAVITELE = { hlava: helma, telo: hrudnik, nohy, cizmy };
export const kusVystroje = (slot, tier) => STAVITELE[slot](tier);

// ---------- model pre predmet (jedna geometria s farbami vo vrcholoch) ----------
export function zlepModel(diely) {
  const kor = new THREE.Group();
  for (const d of diely) if (d.bake) { const c = d.o; c.position.add(new THREE.Vector3(...d.bake)); kor.add(c); }
  kor.updateMatrixWorld(true);
  const geo = [];
  kor.traverse(m => {
    if (!m.isMesh) return;
    let g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    g = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.clearGroups();
    const c = m.material.color.clone(), e = m.material.emissive;
    if (e && e.r + e.g + e.b > 0.05 && m.material.emissiveIntensity > 0.2) c.lerp(e, 0.6);   // zeravy material -> farba ziary
    const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); geo.push(g);
  });
  const g = mergeGeometries(geo); g.computeBoundingBox();
  const b = g.boundingBox; g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  return [g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide })];
}
export const modelKusu = (slot, tier) => zlepModel(kusVystroje(slot, tier));
