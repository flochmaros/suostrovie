// Modely rastlin vyrobene kodom (bez suborov). Kazda varianta druhu = { zaklad, plody }:
//   zaklad = vzdy viditelna cast rastliny,
//   plody  = cast, ktora zmizne po zbere (banany, bobule, kokosy...) a po case znova dorastie.
// Vsetko je low-poly s farbami vo vrcholoch; vietor hybe vrcholmi v shaderi (material()).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { uCas } from '../ocean.js';
import { rng } from '../nahoda.js';

const perlin = new ImprovedNoise();
const V3 = THREE.Vector3;
const C = h => new THREE.Color(h);
const PI2 = Math.PI * 2;

// ---------- pomocne funkcie na geometriu ----------
function farbi(geo, farba) {            // jedna farba pre vsetky vrcholy
  const n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([farba.r, farba.g, farba.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
function cista(geo) {                    // pre mergeGeometries: rovnake atributy vsade
  geo.deleteAttribute('uv');
  if (!geo.index) geo.setIndex([...Array(geo.attributes.position.count).keys()]);
  return geo;
}
function vlastna(poz, farby, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(poz, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(farby, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const spoj = geos => mergeGeometries(geos.map(cista));

// zbierka trojuholnikov s farbami vo vrcholoch (ploche tienovanie, vhodne na listy)
function tro() {
  const p = [], f = [];
  return {
    tri(a, b, c, fa, fb = fa, fc = fa) {
      p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      f.push(fa.r, fa.g, fa.b, fb.r, fb.g, fb.b, fc.r, fc.g, fc.b);
    },
    geo() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(f, 3));
      g.computeVertexNormals();
      return g;
    },
  };
}

// gula s nerovnym povrchom a tienovanim zospodu (koruny, kriky)
function chumac(r, farba, seed, detail = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position, c = new THREE.Color(), a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = perlin.noise(x * 1.3 + seed, y * 1.3, z * 1.3);
    const k = 1 + n * 0.35;
    p.setXYZ(i, x * k, y * k * 0.85, z * k);
    c.copy(farba).multiplyScalar(0.55 + 0.45 * (y / r * 0.5 + 0.5)).offsetHSL(n * 0.03, 0, n * 0.05);
    a.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.computeVertexNormals();
  return g;
}

// rura pozdlz krivky: prstence = [{p: V3, r, c: Color}], K stran
function rura(prstence, K = 6) {
  const poz = [], farby = [], idx = [], n = prstence.length;
  for (let i = 0; i < n; i++) {
    const a = prstence[Math.max(i - 1, 0)].p, b = prstence[Math.min(i + 1, n - 1)].p;
    const t = new V3().subVectors(b, a).normalize();
    const ref = Math.abs(t.z) < 0.9 ? new V3(0, 0, 1) : new V3(1, 0, 0);
    const n1 = new V3().crossVectors(t, ref).normalize(), n2 = new V3().crossVectors(t, n1);
    const { p, r, c } = prstence[i];
    for (let j = 0; j < K; j++) {
      const u = j / K * PI2, co = Math.cos(u) * r, si = Math.sin(u) * r;
      poz.push(p.x + n1.x * co + n2.x * si, p.y + n1.y * co + n2.y * si, p.z + n1.z * co + n2.z * si);
      farby.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < K; j++) {
    const a = i * K + j, b = i * K + (j + 1) % K;
    idx.push(a, a + K, b, b, a + K, b + K);
  }
  return vlastna(poz, farby, idx);
}

// jednoduchy list (2 trojuholniky), rastie pozdlz +x
function listek(L, W, fK, fS, pad = 0.15) {
  const T = tro(), fM = fK.clone().lerp(fS, 0.5);
  const a = new V3(0, 0, 0), m1 = new V3(L * 0.45, L * 0.04, -W), m2 = new V3(L * 0.45, L * 0.04, W), t = new V3(L, -pad * L, 0);
  T.tri(a, m1, m2, fK, fM, fM);
  T.tri(m1, t, m2, fM, fS, fM);
  return T.geo();
}

// list v tvare "V" s vrubmi (paprade, banan), rastie pozdlz +x
function list(dlzka, sirka, zdvih, pad, fKoren, fSpicka, seg = 14) {
  const poz = [], farby = [], idx = [], c = new THREE.Color();
  for (let i = 0; i <= seg; i++) {
    const s = i / seg, x = dlzka * s, y = zdvih * s - pad * s * s;
    const w = sirka * Math.pow(Math.sin(Math.PI * Math.min(s * 1.1, 1)), 0.7) * (i % 2 ? 1 : 0.6);
    c.copy(fKoren).lerp(fSpicka, s);
    poz.push(x, y, -w, x, y + w * 0.3, 0, x, y, w);
    for (let k = 0; k < 3; k++) farby.push(c.r, c.g, c.b);
    if (i < seg) {
      const a = i * 3;
      idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
    }
  }
  return vlastna(poz, farby, idx);
}

// palmovy list s jednotlivymi listkami (kazdy listok = trojuholnik), rastie pozdlz +x
function perje(L, W, zdvih, pad, fK, fS, seg = 13) {
  const T = tro(), c = new THREE.Color(), c2 = new THREE.Color(), ds = 1 / seg;
  const P = s => new V3(L * s, zdvih * s - pad * s * s, 0);
  for (let i = 0; i < seg; i++) {
    const s = i * ds, a = P(s), b = P(s + ds), m = P(s + ds * 0.5);
    const w = W * Math.sin(Math.PI * (0.1 + 0.8 * s));
    c.copy(fK).lerp(fS, s);
    c2.copy(c).offsetHSL(0, 0, 0.05);
    const dx = L * ds * (i % 2 ? 1.5 : 1.1);
    T.tri(a, b, new V3(m.x + dx, m.y - w * 0.55, -w), c, c, c2);
    T.tri(a, b, new V3(m.x + dx, m.y - w * 0.55, w), c, c, c2);
  }
  return T.geo();
}

// kvetna hlava: n lupienkov + stred, otvorena nahor
function hlava(R, farba, stred, n = 5) {
  const casti = [];
  for (let i = 0; i < n; i++)
    casti.push(listek(R, R * 0.42, farba.clone().multiplyScalar(0.8), farba, -0.1).rotateZ(0.35).rotateY(i / n * PI2));
  casti.push(farbi(new THREE.IcosahedronGeometry(R * 0.22, 0), stred));
  return spoj(casti);
}

// clankovane steblo (bambus, trstina): uzly = tmavsie zhrubnute prstence
function steblo(h, r0, lean, uhol, N, fT, fU, K = 5) {
  const pr = [];
  const P = s => new V3(Math.cos(uhol) * lean * s * s * h, h * s, Math.sin(uhol) * lean * s * s * h);
  for (let k = 0; k < N; k++) {
    const s0 = k / N, ds = 1 / N, tenk = 1 - 0.45 * s0;
    pr.push({ p: P(s0 + ds * 0.02), r: r0 * 1.28 * tenk, c: fU });
    pr.push({ p: P(s0 + ds * 0.08), r: r0 * tenk, c: fT });
    pr.push({ p: P(s0 + ds * 0.94), r: r0 * tenk, c: fT });
  }
  pr.push({ p: P(1), r: r0 * 0.5, c: fT });
  return { geo: rura(pr, K), P };
}

// ---------- druhy: kazda funkcia vrati { zaklad, plody } ----------
function palma(seed) {
  const r = rng(seed);
  const H = 7 + r() * 4.5, ohyb = 0.6 + r() * 2.6;
  const krivka = new THREE.QuadraticBezierCurve3(new V3(0, 0, 0), new V3(0, H * 0.55, 0), new V3(ohyb, H, 0));
  const S = 18, K = 8, poz = [], farby = [], idx = [];
  const c1 = C(0x7d5c3d), c2 = C(0x5c432c);
  for (let i = 0; i <= S; i++) {
    const t = i / S, p = krivka.getPoint(t), tan = krivka.getTangent(t);
    const n = new V3(tan.y, -tan.x, 0).normalize();
    const rr = (0.32 - 0.14 * t) * (i % 2 ? 1 : 1.09) * (i === 0 ? 1.35 : 1);
    for (let j = 0; j < K; j++) {
      const a = j / K * PI2;
      poz.push(p.x + n.x * Math.cos(a) * rr, p.y + n.y * Math.cos(a) * rr, Math.sin(a) * rr);
      const c = i % 2 ? c1 : c2;
      farby.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < S; i++) for (let j = 0; j < K; j++) {
    const a = i * K + j, b = i * K + (j + 1) % K;
    idx.push(a, a + K, b, b, a + K, b + K);
  }
  const casti = [vlastna(poz, farby, idx)];

  const vrch = krivka.getPoint(1);
  casti.push(chumac(0.36, C(0x5c432c), seed, 0).translate(vrch.x, vrch.y + 0.1, vrch.z));   // uzol pod korunou
  const n = 10 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const L = 3.0 + r() * 1.4;
    const l = perje(L, 0.55, 1.0 + r() * 0.6, 2.2 + r() * 1.2, C(0x2f6a26), C(0x8fbf4a).offsetHSL((r() - 0.5) * 0.04, 0, 0));
    l.rotateZ(0.15 + r() * 0.35).rotateY(i / n * PI2 + r() * 0.3).translate(vrch.x, vrch.y, vrch.z);
    casti.push(l);
  }
  for (let i = 0; i < 2; i++) {                      // suche ovisnute listy
    const l = perje(2.6, 0.4, 0.2, 3.2, C(0x7d6a3a), C(0xa88f55), 9);
    l.rotateZ(0.6).rotateY(r() * 6.28).translate(vrch.x, vrch.y - 0.2, vrch.z);
    casti.push(l);
  }
  const kokosy = [];
  for (let i = 0, k = 4 + Math.floor(r() * 3); i < k; i++) {   // kokosy visia pod korunou
    const g = farbi(new THREE.IcosahedronGeometry(0.19, 1).scale(1, 1.1, 1), C(r() < 0.45 ? 0x5a3c1d : 0x6f8a2a));
    const a = r() * 6.28;
    g.translate(vrch.x + Math.cos(a) * 0.3, vrch.y - 0.35 - r() * 0.2, vrch.z + Math.sin(a) * 0.3);
    kokosy.push(g);
  }
  return { zaklad: spoj(casti), plody: spoj(kokosy), vyska: H };
}

function strom(seed) {
  const r = rng(seed);
  const H = 4.5 + r() * 4;
  const kmen = farbi(new THREE.CylinderGeometry(0.2, 0.38, H, 8, 6), C(0x6a5038));
  kmen.translate(0, H / 2, 0);
  const p = kmen.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + Math.sin(p.getY(i) * 0.6 + seed) * 0.18);
  const casti = [kmen];
  for (let i = 0; i < 4; i++) {                       // korene (oporne)
    casti.push(farbi(new THREE.ConeGeometry(0.2, 1.0, 5), C(0x5a4430)).translate(0, 0.5, 0).rotateZ(1.1).rotateY(i * 1.57 + r()));
  }
  for (let i = 0; i < 3; i++) {                       // konare
    const k = farbi(new THREE.CylinderGeometry(0.06, 0.12, 2.2, 5), C(0x6a5038));
    k.translate(0, 1.1, 0).rotateZ(0.7 + r() * 0.4).rotateY(r() * 6.28).translate(0, H * (0.55 + r() * 0.25), 0);
    casti.push(k);
  }
  const zelene = [0x3d7a2c, 0x4f8c33, 0x2f6b2a, 0x5f9a3a];
  const farba = C(zelene[Math.floor(r() * zelene.length)]);
  const n = 6 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28, d = i === 0 ? 0 : 0.8 + r() * 1.4;
    const g = chumac(1.3 + r() * 1.0, farba, seed + i * 7);
    g.translate(Math.cos(a) * d, H + 0.4 + r() * 1.6 - d * 0.3, Math.sin(a) * d);
    casti.push(g);
  }
  const liany = [];                                   // liany (zber vlakna)
  for (let i = 0; i < 4; i++) {
    const L = 2.2 + r() * 1.6, a = r() * 6.28, d = 0.9 + r() * 0.8;
    liany.push(farbi(new THREE.CylinderGeometry(0.03, 0.02, L, 3).translate(0, -L / 2, 0), C(0x3a5a2a))
      .translate(Math.cos(a) * d, H + 0.7, Math.sin(a) * d));
  }
  return { zaklad: spoj(casti), plody: spoj(liany), vyska: H };
}

function mango(seed) {
  const r = rng(seed);
  const H = 2.2 + r() * 0.9;
  const kmen = farbi(new THREE.CylinderGeometry(0.22, 0.4, H, 7, 3), C(0x5e4632)).translate(0, H / 2, 0);
  const casti = [kmen];
  for (let i = 0; i < 3; i++)
    casti.push(farbi(new THREE.CylinderGeometry(0.07, 0.14, 1.8, 5), C(0x5e4632)).translate(0, 0.9, 0).rotateZ(0.8 + r() * 0.3).rotateY(i * 2.1 + r()).translate(0, H * 0.75, 0));
  const farba = C([0x2d6a2a, 0x347530][Math.floor(r() * 2)]);
  const bloby = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * PI2 + r(), d = i === 0 ? 0 : 0.9 + r() * 0.8, rad = 1.3 + r() * 0.7;
    const c = new V3(Math.cos(a) * d, H + 0.7 + r() * 0.6, Math.sin(a) * d);
    bloby.push({ c, rad });
    casti.push(chumac(rad, farba, seed + i * 5).translate(c.x, c.y, c.z));
  }
  const farbyM = [0xe9a526, 0xe2602f, 0xb5c23a];
  const plody = [];
  for (let i = 0; i < 9; i++) {
    const b = bloby[1 + Math.floor(r() * 5)], a = r() * PI2;
    const dir = new V3(Math.cos(a) * 0.8, -0.6, Math.sin(a) * 0.8).normalize().multiplyScalar(b.rad * 0.98);
    plody.push(farbi(new THREE.IcosahedronGeometry(0.13, 1).scale(1, 1.2, 0.9), C(farbyM[Math.floor(r() * 3)]))
      .rotateY(r() * 6).translate(b.c.x + dir.x, b.c.y + dir.y, b.c.z + dir.z));
  }
  return { zaklad: spoj(casti), plody: spoj(plody), vyska: H };
}

function akacia(seed) {
  const r = rng(seed);
  const H = 3.6 + r() * 1.6;
  const casti = [farbi(new THREE.CylinderGeometry(0.16, 0.3, H * 0.6, 6), C(0x6b5238)).translate(0, H * 0.3, 0)];
  for (let i = 0; i < 3; i++)
    casti.push(farbi(new THREE.CylinderGeometry(0.06, 0.13, H * 0.7, 5), C(0x6b5238)).translate(0, H * 0.35, 0).rotateZ(0.55 + r() * 0.3).rotateY(i * 2.1 + r() * 0.6).translate(0, H * 0.5, 0));
  const farba = C([0x6e8b3a, 0x7a9640, 0x62843a][Math.floor(r() * 3)]);
  const plody = [];
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * PI2 + r(), d = i === 0 ? 0.3 : 1.4 + r() * 0.8, rad = 1.9 + r() * 0.7;
    casti.push(chumac(rad, farba, seed + i * 3).scale(1, 0.42, 1).translate(Math.cos(a) * d, H + 0.5 + r() * 0.4, Math.sin(a) * d));
  }
  for (let i = 0; i < 8; i++) {                       // struky
    const a = r() * PI2, d = 0.5 + r() * 2.0;
    plody.push(farbi(new THREE.IcosahedronGeometry(0.1, 0).scale(0.3, 1.6, 0.12), C(0x8a5a2a))
      .translate(Math.cos(a) * d, H + 0.0 + r() * 0.2, Math.sin(a) * d));
  }
  return { zaklad: spoj(casti), plody: spoj(plody), vyska: H };
}

function mangrova(seed) {
  const r = rng(seed);
  const H = 1.9 + r() * 0.8;
  const casti = [farbi(new THREE.CylinderGeometry(0.2, 0.32, H, 7), C(0x5a4a38)).translate(0, H / 2 + 0.3, 0)];
  const n = 6 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {                       // oporne korene v oblukoch dole do vody
    const a = i / n * PI2 + r() * 0.4, d = 1.1 + r() * 0.9, hz = 0.9 + r() * 0.8;
    const pr = [];
    for (let k = 0; k <= 5; k++) {
      const s = k / 5;
      pr.push({ p: new V3(Math.cos(a) * d * Math.pow(s, 0.8), hz * (1 - s) * (1 - s) + 0.0 - 0.45 * s + 0.35, Math.sin(a) * d * Math.pow(s, 0.8)),
        r: 0.085 - 0.03 * s, c: s > 0.8 ? C(0x4a3a2c) : C(0x5a4a38) });
    }
    casti.push(rura(pr, 5));
  }
  const farba = C([0x2d6a35, 0x356f2a][Math.floor(r() * 2)]);
  const hrubky = [];
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * PI2 + r(), d = i === 0 ? 0 : 0.7 + r() * 0.8, rad = 1.0 + r() * 0.6;
    const c = new V3(Math.cos(a) * d, H + 0.9 + r() * 0.6, Math.sin(a) * d);
    hrubky.push({ c, rad });
    casti.push(chumac(rad, farba, seed + i * 11).translate(c.x, c.y, c.z));
  }
  const plody = [];
  for (let i = 0; i < 9; i++) {                       // visiace semienka
    const b = hrubky[Math.floor(r() * 5)], a = r() * PI2, L = 0.4 + r() * 0.25;
    plody.push(farbi(new THREE.CylinderGeometry(0.03, 0.018, L, 4).translate(0, -L / 2, 0), C(0x7a8a3a))
      .translate(b.c.x + Math.cos(a) * b.rad * 0.55, b.c.y - b.rad * 0.7, b.c.z + Math.sin(a) * b.rad * 0.55));
  }
  return { zaklad: spoj(casti), plody: spoj(plody), vyska: H + 2 };
}

function banan(seed, farbaPlodu) {
  const r = rng(seed);
  const H = 2.3 + r() * 0.9;
  const casti = [farbi(new THREE.CylinderGeometry(0.15, 0.24, H, 7, 2), C(0x8ab04a)).translate(0, H / 2, 0)];
  casti.push(farbi(new THREE.CylinderGeometry(0.26, 0.28, 0.12, 7), C(0x6a5a30)).translate(0, 0.06, 0));
  const n = 7 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const l = list(2.2 + r() * 0.5, 0.55, 0.7 + r() * 0.5, 1.7 + r() * 0.5, C(0x2f7a2a), C(0x8fc24a), 10);
    l.rotateZ(0.2 + r() * 0.55).rotateY(i / n * PI2 + r() * 0.3).translate(0, H, 0);
    casti.push(l);
  }
  const plody = [farbi(new THREE.CylinderGeometry(0.025, 0.03, 0.8, 4).translate(0, -0.4, 0), C(0x5a7a30)).translate(0.3, H - 0.1, 0)];
  const fp = C(farbaPlodu);
  for (let t = 0; t < 4; t++) {                        // "ruky" banánov
    const y = H - 0.3 - 0.17 * t;
    for (let j = 0; j < 5; j++) {
      const a = j / 5 * PI2 + t * 0.5;
      plody.push(farbi(new THREE.CylinderGeometry(0.04, 0.028, 0.27, 5).translate(0, -0.12, 0), fp.clone().offsetHSL(0, 0, (r() - 0.5) * 0.04))
        .rotateZ(0.35).rotateY(a).translate(0.3 + Math.cos(a) * 0.05, y, Math.sin(a) * 0.05));
    }
  }
  plody.push(farbi(new THREE.IcosahedronGeometry(0.1, 1).scale(0.8, 1.7, 0.8), C(0x7a2a4a)).translate(0.3, H - 1.05, 0));
  return { zaklad: spoj(casti), plody: spoj(plody), vyska: H };
}

function listovaKorunka(n, L, W, fK, fS, r, vyska, sklon) {   // zhluk uzkych listov (bambus, trstina)
  const out = [];
  for (let i = 0; i < n; i++)
    out.push(listek(L, W, fK, fS, 0.3).rotateZ(sklon + r() * 0.5).rotateY(i / n * PI2 + r() * 0.5).translate(0, vyska, 0));
  return out;
}

function bambus(seed) {
  const r = rng(seed);
  const casti = [], plody = [];
  const fT = C(0x7fa642), fU = C(0x4d6b28), fL1 = C(0x3f7a2c), fL2 = C(0x9cc450);
  const n = 5 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const h = 4.5 + r() * 3, uhol = i / n * PI2 + r() * 0.8, d = 0.1 + r() * 0.3;
    const { geo, P } = steblo(h, 0.06 + r() * 0.015, 0.06 + r() * 0.05, uhol, Math.round(h / 1.3), fT, fU);
    casti.push(geo.translate(Math.cos(uhol) * d, 0, Math.sin(uhol) * d));
    for (const s of [0.72, 0.88, 1.0]) {
      const top = P(s);
      for (const l of listovaKorunka(3, 0.8 + r() * 0.3, 0.09, fL1, fL2, r, 0, 0.1)) casti.push(l.translate(top.x + Math.cos(uhol) * d, top.y, top.z + Math.sin(uhol) * d));
    }
  }
  for (let i = 0; i < 2; i++) {                        // zrele (zlte) steblá na zber
    const h = 4.0 + r() * 2, uhol = i * 3.1 + r(), d = 0.35;
    const { geo, P } = steblo(h, 0.075, 0.05, uhol, Math.round(h / 1.3), C(0xc2b844), C(0x8a7a28));
    plody.push(geo.translate(Math.cos(uhol) * d, 0, Math.sin(uhol) * d));
    const top = P(1);
    for (const l of listovaKorunka(3, 0.7, 0.08, fL1, fL2, r, 0, 0.1)) plody.push(l.translate(top.x + Math.cos(uhol) * d, top.y, top.z + Math.sin(uhol) * d));
  }
  return { zaklad: spoj(casti), plody: spoj(plody), vyska: 7 };
}

function trstina(seed) {
  const r = rng(seed);
  const casti = [], plody = [];
  const fT = C(0xa8b94a), fU = C(0x6e7a2a), fL1 = C(0x4a7a2a), fL2 = C(0xa0c850);
  const n = 5 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const h = 1.8 + r() * 1.2, uhol = i / n * PI2 + r(), d = 0.1 + r() * 0.2;
    const { geo, P } = steblo(h, 0.035, 0.12, uhol, 5, fT, fU, 4);
    casti.push(geo.translate(Math.cos(uhol) * d, 0, Math.sin(uhol) * d));
    const top = P(1);
    for (const l of listovaKorunka(3, 1.1, 0.07, fL1, fL2, r, 0, 0.4)) casti.push(l.translate(top.x + Math.cos(uhol) * d, top.y, top.z + Math.sin(uhol) * d));
  }
  for (let i = 0; i < 2; i++) {                        // zrela purpurova trstina
    const h = 2.6 + r() * 0.7, uhol = i * 3.1 + 0.7, d = 0.3;
    const { geo, P } = steblo(h, 0.045, 0.1, uhol, 6, C(0x7a3a5a), C(0x4a2438), 4);
    plody.push(geo.translate(Math.cos(uhol) * d, 0, Math.sin(uhol) * d));
    const top = P(1);
    for (const l of listovaKorunka(3, 1.0, 0.07, fL1, fL2, r, 0, 0.4)) plody.push(l.translate(top.x + Math.cos(uhol) * d, top.y, top.z + Math.sin(uhol) * d));
  }
  return { zaklad: spoj(casti), plody: spoj(plody), vyska: 3 };
}

function ananas(seed) {
  const r = rng(seed);
  const casti = [];
  for (let i = 0; i < 13; i++) {
    casti.push(listek(0.85 + r() * 0.2, 0.08, C(0x3f7a35), C(0x8aa84a), 0.05).rotateZ(0.95 + r() * 0.2).rotateY(i / 13 * PI2 + r() * 0.2).translate(0, 0.05, 0));
  }
  for (let i = 0; i < 8; i++)
    casti.push(listek(0.6, 0.07, C(0x3f7a35), C(0xa0b050), 0.05).rotateZ(1.25).rotateY(i / 8 * PI2 + 0.3).translate(0, 0.08, 0));
  const plody = [farbi(new THREE.CylinderGeometry(0.025, 0.03, 0.3, 4).translate(0, 0.15, 0), C(0x4f7a35))];
  const telo = new THREE.IcosahedronGeometry(0.15, 1).scale(1, 1.5, 1);
  const p = telo.attributes.position, a = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const kosoc = Math.sin((Math.atan2(z, x) + y * 9) * 5) * Math.sin((Math.atan2(z, x) - y * 9) * 5);
    c.set(0xd9a21e).lerp(C(0xa86a14), kosoc > 0.2 ? 0.6 : 0).multiplyScalar(0.85 + 0.15 * (y + 0.2) / 0.4);
    a.set([c.r, c.g, c.b], i * 3);
  }
  telo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  telo.computeVertexNormals();
  plody.push(telo.translate(0, 0.5, 0));
  for (let i = 0; i < 8; i++)
    plody.push(listek(0.3, 0.045, C(0x3f7a35), C(0x8aa84a), 0.05).rotateZ(1.0 + r() * 0.3).rotateY(i / 8 * PI2).translate(0, 0.72, 0));
  return { zaklad: spoj(casti), plody: spoj(plody), vyska: 1.2 };
}

function aloe(seed) {
  const r = rng(seed);
  const casti = [];
  for (let i = 0; i < 11; i++) {
    const strmo = i < 5;
    casti.push(listek(0.65 + r() * 0.25, 0.13, C(0x557f5a), C(0x95b898), 0.12).rotateZ(strmo ? 1.15 : 0.7 + r() * 0.2).rotateY(i / 11 * PI2 * 1.1 + r() * 0.2).translate(0, 0.04, 0));
  }
  const plody = [farbi(new THREE.CylinderGeometry(0.012, 0.02, 1.0, 4).translate(0, 0.5, 0), C(0x6a8a4a))];
  for (let i = 0; i < 12; i++)
    plody.push(farbi(new THREE.IcosahedronGeometry(0.04, 0).scale(1, 1.9, 1), C(i % 2 ? 0xe8742a : 0xf0a030))
      .translate(Math.cos(i * 2.4) * 0.05, 0.62 + i * 0.035, Math.sin(i * 2.4) * 0.05));
  return { zaklad: spoj(casti), plody: spoj(plody), vyska: 1.1 };
}

function srdcovyList(ls, fK, fS) {                      // list taro: srdce, rastie pozdlz +x
  const T = tro(), N = new V3(0, 0, 0);
  const lL = new V3(-0.12 * ls, 0.02 * ls, -0.42 * ls), lR = new V3(-0.12 * ls, 0.02 * ls, 0.42 * ls);
  const mL = new V3(0.35 * ls, 0.07 * ls, -0.52 * ls), mR = new V3(0.35 * ls, 0.07 * ls, 0.52 * ls);
  const tip = new V3(ls, -0.28 * ls, 0), fM = fK.clone().lerp(fS, 0.5);
  T.tri(N, lL, mL, fK, fK, fM); T.tri(N, mL, tip, fK, fM, fS);
  T.tri(N, tip, mR, fK, fS, fM); T.tri(N, mR, lR, fK, fM, fK);
  return T.geo();
}

function taro(seed) {
  const r = rng(seed);
  const casti = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const th = i / n * PI2 + r() * 0.5, len = 0.7 + r() * 0.4, tilt = 0.25 + r() * 0.2;
    casti.push(farbi(new THREE.CylinderGeometry(0.018, 0.03, len, 4).translate(0, len / 2, 0), C(0x5a8a40)).rotateZ(-tilt).rotateY(-th));
    const top = new V3(Math.sin(tilt) * len, Math.cos(tilt) * len, 0).applyAxisAngle(new V3(0, 1, 0), -th);
    casti.push(srdcovyList(0.55 + r() * 0.2, C(0x1f6a35), C(0x5aa04a)).rotateY(-th).translate(top.x, top.y, top.z));
  }
  const plody = [];
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + r();
    plody.push(farbi(new THREE.IcosahedronGeometry(0.11, 1).scale(1, 0.8, 1), C(i % 2 ? 0x8a6a4e : 0x7a5a60)).translate(Math.cos(a) * 0.2, 0.05, Math.sin(a) * 0.2));
  }
  return { zaklad: spoj(casti), plody: spoj(plody), vyska: 1.2 };
}

function huba(seed, cervena) {
  const r = rng(seed);
  const casti = [farbi(new THREE.CircleGeometry(0.4, 8).rotateX(-Math.PI / 2).translate(0, 0.02, 0), C(0x2a5a2a))];
  const plody = [];
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const h = 0.1 + r() * 0.16, rc = 0.07 + r() * 0.07, a = r() * PI2, d = r() * 0.25;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    plody.push(farbi(new THREE.CylinderGeometry(rc * 0.3, rc * 0.4, h, 5).translate(0, h / 2, 0), C(0xe8dcc0)).translate(x, 0, z));
    plody.push(farbi(new THREE.SphereGeometry(rc, 7, 4, 0, PI2, 0, Math.PI / 2).scale(1, 0.65, 1), C(cervena ? 0xc23a2a : 0xb98d57)).translate(x, h, z));
    if (cervena) for (let k = 0; k < 3; k++) {
      const b = r() * PI2;
      plody.push(farbi(new THREE.IcosahedronGeometry(rc * 0.16, 0), C(0xf0ece0)).translate(x + Math.cos(b) * rc * 0.55, h + rc * 0.5, z + Math.sin(b) * rc * 0.55));
    }
  }
  return { zaklad: spoj(casti), plody: spoj(plody), vyska: 0.3 };
}

function ker(seed) {
  const r = rng(seed);
  const casti = [], plody = [];
  const farba = C([0x3f7f2e, 0x4c8a35, 0x2f6a2a][Math.floor(r() * 3)]);
  for (let i = 0; i < 3 + r() * 3; i++) {
    const g = chumac(0.45 + r() * 0.4, farba, seed + i * 3);
    g.translate((r() - 0.5) * 1.1, 0.35 + r() * 0.4, (r() - 0.5) * 1.1);
    casti.push(g);
  }
  for (let i = 0; i < 4; i++) {                        // suche paliky vytrcajuce z kra
    const a = r() * PI2, d = 0.2 + r() * 0.3;
    plody.push(farbi(new THREE.CylinderGeometry(0.012, 0.02, 0.75, 3).translate(0, 0.37, 0), C(0x6a5038)).rotateZ(0.5 + r() * 0.4).rotateY(r() * PI2)
      .translate(Math.cos(a) * d, 0.3, Math.sin(a) * d));
  }
  return { zaklad: spoj(casti), plody: spoj(plody), vyska: 1 };
}

function ibistek(seed, farbaKvetu) {
  const r = rng(seed);
  const casti = [], plody = [];
  const farba = C([0x3f7f2e, 0x4c8a35][Math.floor(r() * 2)]);
  const bloby = [];
  for (let i = 0; i < 4 + r() * 2; i++) {
    const rad = 0.45 + r() * 0.4, c = new V3((r() - 0.5) * 1.0, 0.4 + r() * 0.35, (r() - 0.5) * 1.0);
    bloby.push({ c, rad });
    casti.push(chumac(rad, farba, seed + i * 3).translate(c.x, c.y, c.z));
  }
  for (let i = 0; i < 8; i++) {
    const b = bloby[Math.floor(r() * bloby.length)], a = r() * PI2, e = 0.3 + r() * 0.8;
    const dir = new V3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)).multiplyScalar(b.rad * 0.92);
    plody.push(hlava(0.13, C(farbaKvetu), C(0xf5d040)).rotateY(r() * 6).translate(b.c.x + dir.x, b.c.y + dir.y, b.c.z + dir.z));
  }
  return { zaklad: spoj(casti), plody: spoj(plody), vyska: 1.2 };
}

function bobule(seed, farbaBobul) {
  const r = rng(seed);
  const casti = [], plody = [];
  const farba = C([0x2f6a33, 0x3a7234][Math.floor(r() * 2)]);
  const bloby = [];
  for (let i = 0; i < 4 + r() * 2; i++) {
    const rad = 0.4 + r() * 0.3, c = new V3((r() - 0.5) * 0.9, 0.35 + r() * 0.3, (r() - 0.5) * 0.9);
    bloby.push({ c, rad });
    casti.push(chumac(rad, farba, seed + i * 3).translate(c.x, c.y, c.z));
  }
  const fb = C(farbaBobul);
  for (let i = 0; i < 22; i++) {
    const b = bloby[Math.floor(r() * bloby.length)], a = r() * PI2, e = 0.1 + r() * 1.1;
    const dir = new V3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)).multiplyScalar(b.rad * 0.95);
    plody.push(farbi(new THREE.IcosahedronGeometry(0.05, 0), fb.clone().offsetHSL(0, 0, (r() - 0.5) * 0.08)).translate(b.c.x + dir.x, b.c.y + dir.y, b.c.z + dir.z));
  }
  return { zaklad: spoj(casti), plody: spoj(plody), vyska: 1 };
}

function papradie(seed) {
  const r = rng(seed), casti = [], plody = [];
  const n = 8 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const l = perje(1.1 + r() * 0.5, 0.17, 0.55, 0.9, C(0x2b5e22), C(0x5f9a3c), 8);
    l.rotateZ(0.5 + r() * 0.3).rotateY(i / n * PI2 + r() * 0.3);
    casti.push(l);
  }
  for (let i = 0; i < 3; i++) {                        // mlade zvinute listy
    const a = i * 2.1 + r(), d = 0.1 + r() * 0.15;
    plody.push(farbi(new THREE.CylinderGeometry(0.012, 0.018, 0.35, 3).translate(0, 0.17, 0), C(0x7ab04a)).translate(Math.cos(a) * d, 0, Math.sin(a) * d));
    plody.push(farbi(new THREE.IcosahedronGeometry(0.05, 0).scale(1, 0.8, 1), C(0xa8d060)).translate(Math.cos(a) * d, 0.37, Math.sin(a) * d));
  }
  return { zaklad: spoj(casti), plody: spoj(plody), vyska: 0.8 };
}

function trava(seed) {
  const r = rng(seed), poz = [], farby = [], idx = [];
  const ck = C(0x3d6e25), cs = C(0x9cc25a);
  for (let b = 0; b < 9; b++) {
    const a = r() * 6.28, dx = Math.cos(a), dz = Math.sin(a), h = 0.45 + r() * 0.5, ohyb = 0.15 + r() * 0.35;
    const ox = (r() - 0.5) * 0.35, oz = (r() - 0.5) * 0.35, w = 0.035 + r() * 0.02;
    const zac = poz.length / 3;
    for (let i = 0; i <= 3; i++) {
      const s = i / 3, ww = w * (1 - s);
      const x = ox + dx * ohyb * s * s, z = oz + dz * ohyb * s * s, y = h * s;
      poz.push(x - dz * ww, y, z + dx * ww, x + dz * ww, y, z - dx * ww);
      const c = ck.clone().lerp(cs, s);
      farby.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (i < 3) { const q = zac + i * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
    }
  }
  return vlastna(poz, farby, idx);
}

function kvet(seed, farba) {
  const r = rng(seed), casti = [], plody = [];
  const fk = C(farba), stred = C(0xf5d040);
  for (let i = 0; i < 4; i++) {
    const x = (r() - 0.5) * 0.5, z = (r() - 0.5) * 0.5, h = 0.28 + r() * 0.3;
    casti.push(farbi(new THREE.CylinderGeometry(0.012, 0.015, h, 3).translate(x, h / 2, z), C(0x4a7f2e)));
    casti.push(listek(0.2, 0.04, C(0x3f7a2a), C(0x6aa03a), 0.1).rotateZ(0.7).rotateY(r() * PI2).translate(x, 0.02, z));
    plody.push(hlava(0.1, fk.clone().offsetHSL((r() - 0.5) * 0.03, 0, 0), stred).translate(x, h, z));
  }
  return { zaklad: spoj(casti), plody: spoj(plody), vyska: 0.6 };
}

function kamen(seed, mach, zaklad = 0x8a867e) {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position, a = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = perlin.noise(x * 1.1 + seed, y * 1.1, z * 1.1) + 0.5 * perlin.noise(x * 2.7, y * 2.7 + seed, z * 2.7);
    const k = 1 + n * 0.3;
    p.setXYZ(i, x * k, Math.max(y * k * 0.65, -0.2), z * k);
    c.set(zaklad).offsetHSL(0, 0, n * 0.08);
    if (mach && y > 0.4) c.lerp(C(0x4f7a35), Math.min((y - 0.4) * 2, 0.8));
    a.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.computeVertexNormals();
  return g;
}

// obsidianova zila: zhluk ostrych cierno-modrych hranolov (vertex farby, lesky material)
function obsidianZila(seed) {
  const r = rng(seed), diely = [];
  const n = 5 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const h = (i === 0 ? 1.5 : 0.5 + r() * 0.9), w = (i === 0 ? 0.38 : 0.16 + r() * 0.16);
    const g = new THREE.ConeGeometry(w, h, 4 + Math.floor(r() * 2), 1).toNonIndexed();
    g.rotateY(r() * 3).rotateZ((r() - 0.5) * (i === 0 ? 0.25 : 0.9)).rotateX((r() - 0.5) * (i === 0 ? 0.25 : 0.9));
    const a = i === 0 ? 0 : 0.15 + r() * 0.35;
    g.translate(Math.cos(i * 2.4) * a * 1.4, h * 0.5 - 0.1, Math.sin(i * 2.4) * a * 1.4);
    const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let k = 0; k < p.count; k++) { c.set(0x15181c).offsetHSL(0.02, 0.1, (p.getY(k) / 2) * 0.12 + r() * 0.0); col.set([c.r, c.g, c.b], k * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    diely.push(g);
  }
  const g = spoj(diely); g.computeVertexNormals();
  return g;
}

// ---------- materialy s vetrom ----------
function material(vietor, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, envMapIntensity: 0.4, side: THREE.DoubleSide, ...opts });
  if (!vietor) return m;
  m.onBeforeCompile = sh => {
    sh.uniforms.uCas = uCas;
    sh.vertexShader = 'uniform float uCas;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      vec3 transformed = vec3(position);
      #ifdef USE_INSTANCING
        vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
      #else
        vec2 ip = vec2(0.0);
      #endif
      float vy = max(position.y, 0.0);
      float w = sin(uCas * 1.1 + ip.x * 0.05 + ip.y * 0.07) * 0.7 + sin(uCas * 2.7 + ip.x * 0.31 + ip.y * 0.17) * 0.3;
      transformed.xz += vec2(w, w * 0.6) * ${vietor.toFixed(5)} * vy * vy;`);
  };
  m.customProgramCacheKey = () => 'vietor' + vietor;
  return m;
}
const FS = { side: THREE.FrontSide };
export const M = {
  strom: material(0.0012),                 // kmen + koruna + plody stromov (rovnaky vietor, aby plody neodbiehali)
  banan: material(0.012),
  bambus: material(0.004),
  trstina: material(0.02),
  ker: material(0.05),
  papradie: material(0.08),
  trava: material(0.28),
  kvet: material(0.2),
  ananas: material(0.06),
  aloe: material(0.04),
  taro: material(0.08),
  huba: material(0),
  kamen: material(0, { roughness: 0.95, ...FS }),
  obsidian: material(0, { roughness: 0.12, metalness: 0.35, envMapIntensity: 1.4, ...FS }),
};

// ---------- varianty (vyrobia sa raz pri starte) ----------
const D = (mat, stin, varianty) => ({ mat, stin, varianty });
const len = g => ({ zaklad: g, plody: null });
export const DRUHY = {
  palma: D('strom', true, [1, 2, 3].map(palma)),
  strom: D('strom', true, [11, 12].map(strom)),
  mangrova: D('strom', true, [71, 72].map(mangrova)),
  mango: D('strom', true, [81, 82].map(mango)),
  akacia: D('strom', true, [91, 92].map(akacia)),
  banan: D('banan', false, [[101, 0xa9c43f], [102, 0xe8c32a]].map(([s, f]) => banan(s, f))),
  bambus: D('bambus', true, [111, 112].map(bambus)),
  bobule: D('ker', false, [[121, 0xd2283a], [122, 0x3b46c0]].map(([s, f]) => bobule(s, f))),
  ker: D('ker', false, [21, 22].map(ker)),
  ibistek: D('ker', false, [[24, 0xe0304a], [25, 0xf07ab0]].map(([s, f]) => ibistek(s, f))),
  papradie: D('papradie', false, [31, 32].map(papradie)),
  trstina: D('trstina', false, [131].map(trstina)),
  ananas: D('ananas', false, [141].map(ananas)),
  aloe: D('aloe', false, [151].map(aloe)),
  taro: D('taro', false, [161].map(taro)),
  huba: D('huba', false, [[171, false], [172, true]].map(([s, c]) => huba(s, c))),
  kvet: D('kvet', false, [[51, 0xe8343c], [52, 0xf4c430], [53, 0xf5f0e8], [54, 0xb05ad8]].map(([s, f]) => kvet(s, f))),
  trava: D('trava', false, [41, 42].map(s => len(trava(s)))),
  kamen: D('kamen', true, [61, 62, 63].map(s => len(kamen(s, false)))),
  kamenMach: D('kamen', true, [64, 65].map(s => len(kamen(s, true)))),
  obsidianZila: D('obsidian', true, [81, 82, 83].map(s => len(obsidianZila(s)))),
  kamenSopka: D('kamen', true, [66, 67].map(s => len(kamen(s, false, 0x3a3836)))),
};
