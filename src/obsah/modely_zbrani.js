// Detailne modely zbrani (legendarne zbrane zo strazcov majakov + obsidianovy mec).
// Kazdy model stoji "na stojato" (rukovat od y = 0 nahor, hlava navrchu), na konci ho zloz() polozi na bok
// (dlzka pozdlz x, hlava na -x) rovnako ako ostatne nastroje. Svietiace casti (lava, perla, runy) idu do
// druhej skupiny geometrie s vlastnym materialom ZIAR -> bloom ich rozziari a boj.js ich nechava pulzovat.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hladka, tvar, dokonci, lano, fbm, sum, smooth, stylMat } from './styl.js';
import { krivka, tuba, valec, blob, fasety } from './modely_predmetov.js';

const YZEM = 0.05;
const Cc = hex => new THREE.Color(hex);
const KOV = stylMat({ roughness: 0.38, metalness: 0.35 }, 0.6);
// svietiaci material: farba vrcholov * jas (jas > 1 -> bloom); pulzuje v boj.js (ZIARE)
const ziar = jas => { const m = new THREE.MeshBasicMaterial({ vertexColors: true }); m.color.setScalar(jas); m.userData.jas = jas; return m; };
export const ZIARE = [];

// spoji obycajne a svietiace diely do jednej geometrie s 2 skupinami (2 materialy) a polozi ju na zem
function zloz(diely, svietiace, jas = 4) {
  const a = dokonci(...diely);
  if (!svietiace.length) return [a.rotateZ(Math.PI / 2).translate(0, YZEM, 0), KOV];
  const m = ziar(jas); ZIARE.push(m);
  const g = mergeGeometries([a, dokonci(...svietiace)], true).rotateZ(Math.PI / 2).translate(0, YZEM, 0);
  return [g, [KOV, m]];
}

// CEPEL: dvojsecna plocha (horna + dolna strana sa stretnu na ostri), sirka w(v), hrubka h(v), v = 0..1 pozdlz cepele.
// fn(p, c, u, v, strana) = farba (a pripadne posun bodu); u = -1..1 naprec cepelou.
function cepel(L, w, h, nU, nV, fn) {
  const pos = [], col = [], idx = [], c = new THREE.Color(), p = new THREE.Vector3(), row = nU + 1, pol = (nV + 1) * row;
  for (const s of [1, -1]) for (let j = 0; j <= nV; j++) for (let i = 0; i <= nU; i++) {
    const v = j / nV, u = i / nU * 2 - 1;
    p.set(u * w(v), v * L, s * h(v) * (1 - Math.pow(Math.abs(u), 1.6)));
    c.setRGB(1, 1, 1); fn(p, c, u, v, s);
    pos.push(p.x, p.y, p.z); col.push(c.r, c.g, c.b);
  }
  for (const [s, o] of [[1, 0], [-1, pol]]) for (let j = 0; j < nV; j++) for (let i = 0; i < nU; i++) {
    const a = o + j * row + i, b = a + 1, d = a + row, e = d + 1;
    if (s > 0) idx.push(a, b, d, b, e, d); else idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// rukovat ovinuta kozenym pasikom (spirala), polomer r, dlzka L
function omotanaRuk(L, r, hex, hex2) {
  const a = Cc(hex), b = Cc(hex2);
  return valec(L, t => r * (1 + 0.06 * Math.sin(t * Math.PI)), 10, Math.round(L * 120), (v, c, t, phi) => {
    const pas = Math.sin(phi + t * L * 110);
    c.copy(a).lerp(b, smooth(0.2, 0.9, pas)).multiplyScalar(0.85 + 0.25 * fbm(v.x * 80, v.y * 80, v.z * 80, 2));
  });
}
// gula / drahokam
const gula = (r, hex, hex2 = hex, det = 2) => tvar(hladka(new THREE.IcosahedronGeometry(r, det)), (v, c) => c.copy(Cc(hex)).lerp(Cc(hex2), smooth(-r, r, v.y)));
// kovovy prstenec (hladky torus)
const prsten = (R, r, y, hex, hex2 = hex) => tvar(hladka(new THREE.TorusGeometry(R, r, 6, 18)), (v, c) => c.copy(Cc(hex)).lerp(Cc(hex2), smooth(-r, r, v.z))).rotateX(Math.PI / 2).translate(0, y, 0);

// =====================================================================================
// MEC: rukovat + zastita + dlha cepel. o = { L (cepel), W (polsirka), hrub, telo, ostrie, lava (praskliny), jadro (svietiaci stred), zastita, ziarHex }
// =====================================================================================
export function mec(o) {
  const Lr = 0.24, Lb = o.L, W = o.W, yB = Lr + 0.03;
  const diely = [], svietiace = [];
  // rukovat + hlavica
  diely.push(omotanaRuk(Lr, 0.017, 0x2a1a12, 0x5a3a22));
  diely.push(blob(0.032, 0.038, 0.032, (v, c, d) => c.copy(Cc(o.zastita)).multiplyScalar(0.7 + 0.4 * smooth(-1, 1, d.y)), 2).translate(0, -0.02, 0));
  // cepel: vlnite ostrie (plamen), na konci spicka
  const T = Cc(o.telo), O = Cc(o.ostrie), Lv = Cc(o.lava ?? o.telo), sv = T.clone().lerp(Cc(0xffffff), 0.25);
  const w = v => W * (1 - 0.22 * v) * Math.pow(1 - Math.pow(v, 5), 0.55) * (1 + (o.vlny ?? 0) * Math.sin(v * 30) * (1 - v)) * (1 + 0.25 * smooth(0.08, 0, v));
  const h = v => o.hrub * (1 - 0.6 * v);
  diely.push(cepel(Lb, w, h, 10, 64, (p, c, u, v) => {
    const n = fbm(p.x * 40 + 3, p.y * 9, 1, 3), r = 1 - Math.abs(2 * fbm(p.x * 26, p.y * 7, 5, 3) - 1);
    c.copy(T).multiplyScalar(0.75 + 0.45 * n).lerp(sv, smooth(0.15, 0, Math.abs(u)) * 0.35);
    c.lerp(O, smooth(0.62, 0.98, Math.abs(u)) * 0.9);                           // vybrusene / zhavé ostrie
    if (o.lava) c.lerp(Lv, smooth(0.86, 0.96, r) * smooth(0.95, 0.5, Math.abs(u)));   // lavove praskliny
    p.y += yB;
  }));
  // jadro: uzky svietiaci pas v strede (trochu hrubsi, presvita na oboch stranach)
  if (o.jadro) svietiace.push(cepel(Lb * 0.86, v => w(v) * 0.16 * (1 - 0.5 * v) + 0.002, v => h(v) * 1.35, 4, 40, (p, c, u, v) => {
    c.copy(Cc(o.jadro)).lerp(Cc(0xfff2b0), smooth(0.6, 0, Math.abs(u)) * 0.7 * (1 - v)); p.y += yB + 0.02;
  }));
  // zastita: rohy zahnute k cepeli (plamene), uprostred drahokam
  const Z = Cc(o.zastita), Zs = Z.clone().lerp(Cc(o.ostrie), 0.5);
  diely.push(tuba(krivka([[-0.15, yB + 0.07, 0], [-0.1, yB + 0.01, 0], [-0.04, yB - 0.012, 0], [0, yB - 0.014, 0], [0.04, yB - 0.012, 0], [0.1, yB + 0.01, 0], [0.15, yB + 0.07, 0]], 30),
    u => 0.008 + 0.017 * Math.sin(Math.PI * u), 8, (p, c, u) => c.copy(Z).multiplyScalar(0.75 + 0.4 * fbm(p.x * 50, p.y * 50, p.z * 50, 2)).lerp(Zs, smooth(0.3, 0.05, Math.abs(u - 0.5) * 2 - 0.65 + 0.3)), () => [1, 1.5]));
  diely.push(blob(0.032, 0.03, 0.026, (v, c, d) => c.copy(Z).multiplyScalar(0.8 + 0.3 * d.y), 2).translate(0, yB - 0.01, 0));
  if (o.ziarHex) {
    svietiace.push(gula(0.014, o.ziarHex, 0xffffff).scale(1, 1.3, 0.6).translate(0, yB - 0.008, 0.024), gula(0.014, o.ziarHex, 0xffffff).scale(1, 1.3, 0.6).translate(0, yB - 0.008, -0.024));
    svietiace.push(gula(0.012, o.ziarHex, 0xffffff).translate(0, -0.06, 0));
  }
  return zloz(diely, svietiace, o.jas ?? 4.5);
}

// =====================================================================================
// HARPUNA: dlha tmava tyc, golier z krokodilich supin, hrot z velkeho zubu s dvoma spatnymi hacikmi
// =====================================================================================
export function harpuna() {
  const L = 1.72, diely = [], svietiace = [];
  const D = Cc(0x3b2a1c), D2 = Cc(0x6a4a2e);
  diely.push(valec(L, t => 0.021 * (1 - 0.12 * t), 10, 90, (v, c, t, phi) => {
    const n = fbm(Math.cos(phi) * 2, t * 60, Math.sin(phi) * 2, 3);
    c.copy(D).lerp(D2, smooth(0.35, 0.8, n)).multiplyScalar(0.9 + 0.2 * Math.sin(t * 380 + phi) * smooth(0.22, 0.2, Math.abs(t - 0.3)));   // omotavka na uchope
  }));
  // golier zo supin (zelenohnede platnicky v 3 radoch)
  const S1 = Cc(0x3f5a2a), S2 = Cc(0x8a9a4a);
  for (let rad = 0; rad < 3; rad++) for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + rad * 0.4, y = L - 0.13 + rad * 0.035, r = 0.026 + rad * 0.002;
    diely.push(fasety(new THREE.ConeGeometry(0.016, 0.05, 4).scale(1, 1, 0.45).translate(0, 0.02, 0).rotateX(-0.35).rotateY(-a + Math.PI / 2).translate(Math.cos(a) * r, y, Math.sin(a) * r),
      (n, c) => c.copy(S1).lerp(S2, 0.3 + 0.4 * Math.max(0, n.y)).multiplyScalar(0.8 + 0.3 * Math.random())));
  }
  diely.push(prsten(0.026, 0.006, L - 0.15, 0xb08a50, 0xe8c888), prsten(0.024, 0.005, L + 0.005, 0xb08a50, 0xe8c888));
  // zub: zahnuty kuzel slonovinovej farby, korenovita cast tmavsia
  const IV = Cc(0xf1e6c8), KO = Cc(0x8a6a3a);
  const zub = (bod, dl, r, zahn) => tuba(krivka([[0, 0, 0], [zahn * 0.3, dl * 0.4, 0], [zahn, dl, 0]], 16), u => r * Math.pow(1 - u, 0.8) + 0.0015, 10,
    (p, c, u) => c.copy(KO).lerp(IV, smooth(0.0, 0.35, u)).multiplyScalar(0.88 + 0.2 * fbm(p.x * 90, p.y * 30, p.z * 90, 2)).lerp(Cc(0xffffff), smooth(0.8, 1, u) * 0.3), () => [1, 0.8]);
  diely.push(zub(0, 0.32, 0.024, 0.03).translate(0, L, 0));
  for (const s of [-1, 1]) diely.push(zub(0, 0.1, 0.011, s * 0.04).rotateZ(s * 2.5).translate(s * 0.012, L + 0.08, 0));   // spatne haciky
  diely.push(...[0, 1, 2].map(i => lano(0.025, 0.006, 0xcfb87c).rotateX(Math.PI / 2).translate(0, L - 0.02 + i * 0.012, 0)));
  // jantarove oci v goliere (svietia)
  for (const s of [-1, 1]) svietiace.push(gula(0.008, 0xffb020, 0xfff0a0).scale(1.4, 0.8, 0.8).translate(0, L - 0.08, s * 0.03));
  return zloz(diely, svietiace, 3.5);
}

// =====================================================================================
// TROJZUBEC HLBIN: bronzova tyc s chapadlom ovinutym okolo, polmesiacova zakladna, 3 hroty s hacikmi, svietiaca perla
// =====================================================================================
export function trojzubec() {
  const L = 1.55, diely = [], svietiace = [];
  const B = Cc(0x2f7d74), B2 = Cc(0x7fd8c0), Bt = Cc(0x1c4a48);
  diely.push(valec(L, t => 0.021 * (1 - 0.1 * t), 10, 80, (v, c, t, phi) => {
    const sp = Math.sin(phi * 2 + t * 70), n = fbm(v.x * 60, v.y * 20, v.z * 60, 3);
    c.copy(Bt).lerp(B, 0.5 + 0.3 * sp).lerp(B2, smooth(0.7, 0.95, n) * 0.5);   // spiralove ryhy + zelenkasta patina
  }));
  // chapadlo ovinute okolo hornej casti tyce (fialove, s prisavkami)
  const P1 = Cc(0x6a2a5a), P2 = Cc(0xd890b8);
  const ch = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * Math.PI * 2 * 3.2; ch.push([Math.cos(a) * 0.026, L * 0.55 + t * L * 0.38, Math.sin(a) * 0.026]); }
  diely.push(tuba(krivka(ch, 90), u => 0.011 * (1 - 0.6 * u) + 0.002, 7, (p, c, u, phi) => c.copy(P1).lerp(P2, smooth(0.3, 0.9, Math.cos(phi)) * 0.7 * (0.6 + 0.4 * Math.sin(u * 160)))));
  // polmesiac (zakladna hrotov) a hroty
  const Y = L + 0.02;
  diely.push(tuba(krivka([[-0.11, Y + 0.08, 0], [-0.08, Y + 0.015, 0], [0, Y - 0.01, 0], [0.08, Y + 0.015, 0], [0.11, Y + 0.08, 0]], 30), u => 0.012 + 0.012 * Math.sin(Math.PI * u), 8,
    (p, c, u) => c.copy(B).lerp(B2, 0.3 + 0.4 * fbm(p.x * 60, p.y * 60, p.z * 60, 2)), () => [1, 1.4]));
  const hrot = (pts, r) => tuba(krivka(pts, 24), u => r * (1 - 0.92 * Math.pow(u, 1.2)) + 0.001, 6,
    (p, c, u) => c.copy(B).lerp(B2, 0.25 + 0.3 * fbm(p.x * 70, p.y * 70, p.z * 70, 2)).lerp(Cc(0xe8fff8), smooth(0.75, 1, u) * 0.6), () => [1, 0.7]);
  diely.push(hrot([[0, Y, 0], [0, Y + 0.2, 0], [0, Y + 0.4, 0]], 0.014));
  for (const s of [-1, 1]) {
    diely.push(hrot([[s * 0.11, Y + 0.075, 0], [s * 0.115, Y + 0.18, 0], [s * 0.095, Y + 0.3, 0]], 0.011));
    // haciky
    diely.push(hrot([[s * 0.006, Y + 0.33, 0], [s * 0.022, Y + 0.3, 0], [s * 0.026, Y + 0.27, 0]], 0.005));
    diely.push(hrot([[s * 0.095 + s * 0.004, Y + 0.25, 0], [s * 0.112, Y + 0.225, 0], [s * 0.118, Y + 0.2, 0]], 0.004));
  }
  // svietiace: perla v strede polmesiaca, prstence pod hlavou, hroty spiciek
  svietiace.push(gula(0.022, 0x40e8ff, 0xf0ffff, 3).translate(0, Y + 0.03, 0));
  svietiace.push(prsten(0.026, 0.0045, L - 0.06, 0x30d0ff, 0xc0ffff), prsten(0.026, 0.0045, L - 0.035, 0x30d0ff, 0xc0ffff));
  return zloz(diely, svietiace, 4);
}

// =====================================================================================
// RUNOVE KLADIVO: kamenna hlava s kovovymi kovaniami, svietiace runy a kristal golema, dlha rukovat
// =====================================================================================
export function kladivo() {
  const L = 0.88, diely = [], svietiace = [];
  diely.push(omotanaRuk(0.32, 0.024, 0x2a1d14, 0x5c4030));
  diely.push(valec(L - 0.32, t => 0.023 * (1 + 0.15 * t), 10, 40, (v, c, t) => c.copy(Cc(0x4a3424)).multiplyScalar(0.8 + 0.35 * fbm(v.x * 90, v.y * 5, v.z * 90, 3))).translate(0, 0.32, 0));
  diely.push(prsten(0.027, 0.007, 0.32, 0x6a6e78, 0xb8c0cc), prsten(0.03, 0.007, L - 0.15, 0x6a6e78, 0xb8c0cc), prsten(0.03, 0.007, L - 0.12, 0x6a6e78, 0xb8c0cc));
  diely.push(fasety(new THREE.OctahedronGeometry(0.035, 0).scale(1, 1.4, 1).translate(0, -0.03, 0), (n, c) => c.set(0x7a808c).multiplyScalar(0.7 + 0.4 * Math.max(0, n.y))));
  // hlava: kamenny kvader (dlhsia os = x), nerovny, otlkane hrany
  const HX = 0.2, HY = 0.12, HZ = 0.12, yH = L + 0.04, K = Cc(0x6f7680), K2 = Cc(0xa8b0b8);
  const hlava = tvar(new THREE.BoxGeometry(2 * HX, 2 * HY, 2 * HZ, 10, 6, 6), (v, c) => {
    const n = fbm(v.x * 18 + 2, v.y * 18, v.z * 18, 3), hrana = Math.max(Math.abs(v.y) / HY, Math.abs(v.z) / HZ);
    const s = 1 - 0.08 * smooth(0.82, 1, hrana) - (n - 0.5) * 0.08;
    v.y *= s; v.z *= s;
    c.copy(K).multiplyScalar(0.7 + 0.5 * n).lerp(K2, smooth(0.85, 1, hrana) * 0.4);
  }).toNonIndexed();
  hlava.computeVertexNormals();
  diely.push(hlava.translate(0, yH, 0));
  // kovanie na oboch koncoch hlavy (tmavy kov, nity)
  for (const s of [-1, 1]) {
    const kov = tvar(new THREE.BoxGeometry(0.05, 2 * HY + 0.025, 2 * HZ + 0.025, 2, 3, 3), (v, c) => c.set(0x3e424a).multiplyScalar(0.8 + 0.4 * fbm(v.x * 30, v.y * 30, v.z * 30, 2))).toNonIndexed();
    kov.computeVertexNormals();
    diely.push(kov.translate(s * (HX - 0.02), yH, 0));
    diely.push(fasety(new THREE.ConeGeometry(0.04, 0.07, 5).rotateZ(-s * Math.PI / 2).translate(s * (HX + 0.035), yH, 0), (n, c) => c.set(0x5a5e68).multiplyScalar(0.7 + 0.5 * Math.abs(n.x))));
    for (const a of [-1, 1]) for (const b of [-1, 1]) diely.push(gula(0.009, 0x9aa0aa).translate(s * (HX - 0.02), yH + a * (HY - 0.02), b * (HZ + 0.013)));
  }
  // spic navrchu
  diely.push(fasety(new THREE.ConeGeometry(0.03, 0.1, 5).translate(0, yH + HY + 0.045, 0), (n, c) => c.set(0x5a5e68).multiplyScalar(0.7 + 0.5 * n.y)));
  // runy na prednej a zadnej strane hlavy (tenke svietiace hranoly) + kristal golema v strede
  const RUNY = [[-0.11, -0.06, -0.11, 0.06], [-0.11, 0.06, -0.06, 0], [-0.06, 0, -0.11, -0.06], [0.06, 0.06, 0.12, 0.06], [0.09, 0.06, 0.09, -0.06], [0.06, -0.03, 0.12, -0.03], [-0.03, 0.085, 0.03, 0.085], [-0.03, -0.085, 0.03, -0.085]];
  for (const z of [-1, 1]) {
    for (const [x1, y1, x2, y2] of RUNY) {
      const dl = Math.hypot(x2 - x1, y2 - y1);
      svietiace.push(tvar(new THREE.BoxGeometry(dl + 0.008, 0.008, 0.006), (v, c) => c.set(0x40d8ff)).rotateZ(Math.atan2(y2 - y1, x2 - x1)).translate((x1 + x2) / 2, yH + (y1 + y2) / 2, z * (HZ + 0.001)));
    }
    svietiace.push(fasety(new THREE.OctahedronGeometry(0.04, 0).scale(1, 1.3, 0.5).translate(0, yH, z * HZ), (n, c) => c.set(0x60e8ff).lerp(Cc(0xffffff), Math.max(0, n.y) * 0.6)));
  }
  return zloz(diely, svietiace, 4);
}
