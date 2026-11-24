// Detailne stylizovane modely predmetov (pomocne funkcie v styl.js).
// Kazda funkcia vrati [geometria, material] - rovnaky format ako `model` v predmet(...).
import * as THREE from 'three';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
import { hladka, tvar, naZem, ao, dokonci, fbm, sum, smooth, hash, lano, MAT_STYL, stylMat } from './styl.js';

const C = hex => new THREE.Color(hex);

// ---------- KOKOS: vajcovity, 3 pozdlzne hrany, vlaknita srst, 3 "ocka" ----------
export function modelKokos() {
  const R = 0.15;
  const tmava = C(0x3a200c), svetla = C(0xa8743f), hrany = C(0xb98552), ocko = C(0x1e1108);
  // smery 3 ociek (okolo spodneho polu, medzi hranami)
  const ocka = [0, 1, 2].map(k => { const b = k * 2.094 + 1.047, a = 0.3; return new THREE.Vector3(Math.sin(a) * Math.cos(b), -Math.cos(a), Math.sin(a) * Math.sin(b)); });
  const d = new THREE.Vector3();
  let g = hladka(new THREE.SphereGeometry(R, 44, 30));
  tvar(g, (v, c) => {
    d.copy(v).normalize();
    const y = d.y, phi = Math.atan2(d.z, d.x);
    const hrana = Math.pow(0.5 + 0.5 * Math.cos(3 * phi), 10) * (1 - y * y);
    let oko = 0; for (const e of ocka) oko = Math.max(oko, smooth(0.985, 0.996, d.dot(e)));
    const vlakna = fbm(v.x * 55, v.y * 6, v.z * 55, 3);
    const s = (1 + hrana * 0.1 - oko * 0.06 + (vlakna - 0.5) * 0.05) * (y > 0 ? 1 - 0.2 * y * y : 1);
    v.x *= s; v.z *= s; v.y *= 1.2 * (1 - oko * 0.04);
    c.copy(tmava).lerp(svetla, smooth(0.3, 0.75, vlakna)).lerp(hrany, hrana * 0.6);
    if (y > 0.75) c.multiplyScalar(0.75 + 0.25 * (1 - y));   // spicka tmavsia
    c.lerp(ocko, oko);
  });
  g.rotateZ(1.32).rotateY(0.4);
  g = naZem(g); ao(g, 0.07, 0.5);
  return [dokonci(g), MAT_STYL];
}

// ---------- KAMEN: oblucik z rieky, teply hore, chladnejsi dole, skvrny + trocha machu ----------
export function modelKamen() {
  const dole = C(0x55524f), stred = C(0x8a857d), hore = C(0xbdb4a4), mach = C(0x5f9a35);
  let g = hladka(new THREE.IcosahedronGeometry(1, 11));
  tvar(g, (v, c) => {
    const n1 = fbm(v.x * 1.4 + 3, v.y * 1.4, v.z * 1.4, 2), n2 = fbm(v.x * 6, v.y * 6, v.z * 6, 2);
    const s = 1 + (n1 - 0.5) * 0.45 + (n2 - 0.5) * 0.06;
    const ny = v.y;
    v.set(v.x * 0.18 * s, v.y * 0.1 * s, v.z * 0.13 * s);
    if (v.y < -0.055) v.y = -0.055 + (v.y + 0.055) * 0.25;           // splosteny spodok
    c.copy(dole).lerp(stred, smooth(-0.8, 0.1, ny)).lerp(hore, smooth(0.2, 1, ny) * 0.8);
    c.multiplyScalar(0.84 + n2 * 0.3);
    const m = smooth(0.35, 0.75, ny) * smooth(0.55, 0.68, fbm(v.x * 18, v.y * 18, v.z * 18, 3));
    c.lerp(mach, m * 0.8);
  });
  g.rotateY(0.3);
  g = naZem(g); ao(g, 0.04, 0.5);
  return [dokonci(g), MAT_STYL];
}

// ---------- MUSLA: spiralova ulita (logaritmicka spirala), pruhy, ruzove usti ----------
export function modelMusla() {
  const zavitov = 4.6, k = 0.6;
  const krem = C(0xfbead6), pruh = C(0xe0855a), tmavyPruh = C(0xa8502e), ruzova = C(0xf7a6a8);
  const geo = new ParametricGeometry((u, w, ciel) => {
    const t = u, th = t * zavitov * Math.PI * 2, g = Math.exp(k * zavitov * (t - 1));   // g = 1 pri usti
    const f = w * Math.PI * 2;
    const hrbol = Math.pow(Math.max(0, Math.sin(th * 4)), 10) * Math.max(0, Math.sin(f + 0.6)) * 0.35;   // hrbolceky na ramene
    const rt = 0.043 * g * (1 + 0.35 * smooth(0.88, 1, t) + hrbol);                    // usti sa rozsiruje
    const rc = 0.07 * g, y = 0.13 * (1 - g);
    const rx = Math.cos(th), rz = Math.sin(th);
    const r = rc + rt * Math.cos(f);
    ciel.set(rx * r, y + rt * Math.sin(f) * 1.1, rz * r);
  }, 160, 24);
  let g = hladka(geo);
  // farbu pocitame z polohy: pruhy idu po zavitoch (uhol + vyska), spodok (usti) ruzovkasty
  tvar(g, (v, c) => {
    const ang = Math.atan2(v.z, v.x);
    const p = Math.sin(ang * 2 + v.y * 70) * 0.5 + 0.5, p2 = Math.sin(ang * 9 + v.y * 25) * 0.5 + 0.5;
    c.copy(krem).lerp(pruh, smooth(0.55, 0.8, p) * 0.85).lerp(tmavyPruh, smooth(0.85, 0.95, p2) * 0.5);
    c.lerp(ruzova, smooth(0.0, -0.06, v.y) * 0.8);
    c.multiplyScalar(0.92 + fbm(v.x * 60, v.y * 60, v.z * 60, 2) * 0.12);
  });
  g.rotateX(-1.25).rotateZ(0.2);
  g = naZem(g); ao(g, 0.03, 0.4);
  return [dokonci(g), stylMat({ roughness: 0.35, side: THREE.DoubleSide }, 0.7)];
}

// ---------- RYBA: tropicka, sfarbena od tmavomodreho chrbta po strieborne brucho, zlty pruh, plutvy ----------
function plutva(body, hrubka, farbaKoren, farbaSpicka, lucov = 12) {
  const s = new THREE.Shape(); s.moveTo(body[0][0], body[0][1]);
  for (let i = 1; i < body.length; i += 2) s.quadraticCurveTo(body[i][0], body[i][1], body[i + 1][0], body[i + 1][1]);
  const g = new THREE.ExtrudeGeometry(s, { depth: hrubka, bevelEnabled: true, bevelThickness: hrubka * 0.6, bevelSize: hrubka * 0.8, bevelSegments: 2, curveSegments: 12 });
  g.translate(0, 0, -hrubka / 2);
  g.computeBoundingBox(); const b = g.boundingBox, dl = Math.max(b.max.x - b.min.x, b.max.y - b.min.y);
  const a = C(farbaKoren), z = C(farbaSpicka);
  return tvar(g, (v, c) => {
    const r = Math.hypot(v.x, v.y) / dl;
    c.copy(a).lerp(z, smooth(0.1, 0.9, r)).multiplyScalar(0.8 + 0.2 * Math.abs(Math.sin(Math.atan2(v.y, v.x) * lucov)));
  });
}
export function modelRyba(farby = {}) {
  const F = { chrbat: 0x0d4f7a, bok: 0x2fb3c8, brucho: 0xf4f1e2, pruh: 0xf6c22e, plutva: 0xf08a24, spicka: 0xffd86a, ...farby };
  const L = 0.5;
  const profil = [];
  for (let i = 0; i <= 30; i++) { const s = i / 30; profil.push(new THREE.Vector2(0.1 * Math.pow(Math.sin(Math.PI * Math.pow(s * 0.93, 0.68)), 0.8), s * L)); }
  let telo = hladka(new THREE.LatheGeometry(profil, 28));
  telo.rotateZ(-Math.PI / 2).translate(-L / 2, 0, 0);          // dlzka pozdlz x, hlava na -x
  const chrbat = C(F.chrbat), bok = C(F.bok), brucho = C(F.brucho), pruh = C(F.pruh), tmava = C(0x081c2a);
  tvar(telo, (v, c) => {
    const s = (v.x + L / 2) / L;                                   // 0 hlava .. 1 chvost
    v.z *= 0.42;
    if (v.y < 0) v.y *= 1 + 0.18 * Math.sin(Math.PI * s);          // bruchatejsia
    const h = v.y / 0.1;
    c.copy(brucho).lerp(bok, smooth(-0.55, 0.05, h)).lerp(chrbat, smooth(0.15, 0.75, h));
    const p = Math.abs(v.y - (0.012 - 0.04 * (s - 0.5)));          // pozdlzny zlty pruh
    c.lerp(pruh, smooth(0.016, 0.006, p) * smooth(0.12, 0.25, s) * smooth(0.95, 0.75, s));
    c.multiplyScalar(0.93 + 0.07 * Math.sin(v.x * 150 + v.y * 90) * Math.sin(v.x * 150 - v.y * 90));   // supiny
    c.lerp(tmava, smooth(0.6, 0.85, fbm(v.x * 30, v.y * 30, 1, 2)) * smooth(0.3, 0.8, h) * 0.6);         // skvrny na chrbte
    c.lerp(tmava, smooth(0.035, 0.02, s) * 0.7);                     // usta
  });
  const chvost = plutva([[0, 0], [0.04, 0.03], [0.13, 0.11], [0.09, 0.02], [0.08, 0], [0.09, -0.02], [0.13, -0.11], [0.04, -0.03], [0, 0]], 0.006, F.plutva, F.spicka, 16)
    .translate(L / 2 - 0.025, 0, 0);
  const chrbtova = plutva([[-0.1, 0], [-0.05, 0.08], [0.06, 0.075], [0.08, 0.04], [0.11, 0], [0, 0], [-0.1, 0]], 0.005, F.plutva, F.spicka, 14)
    .translate(0.02, 0.075, 0);
  const bocna = s => plutva([[0, 0], [0.02, 0.04], [0.07, 0.035], [0.05, 0.01], [0.075, -0.01], [0.03, -0.01], [0, 0]], 0.004, F.plutva, F.spicka, 8)
    .rotateY(s * 0.5).rotateX(s * 0.3).translate(-0.12, -0.03, s * 0.035);
  const brusna = plutva([[-0.05, 0], [0, -0.05], [0.06, -0.035], [0.04, -0.01], [0.06, 0], [0, 0], [-0.05, 0]], 0.004, F.plutva, F.spicka, 8)
    .translate(0.1, -0.07, 0);
  const oko = s => [
    tvar(hladka(new THREE.SphereGeometry(0.019, 14, 10)), (v, c) => c.set(0xfff4c8)).translate(-L / 2 + 0.07, 0.022, s * 0.026),
    tvar(hladka(new THREE.SphereGeometry(0.011, 12, 8)), (v, c) => c.set(0x05070a)).translate(-L / 2 + 0.068, 0.023, s * 0.04),
  ];
  let g = dokonci(telo, chvost, chrbtova, bocna(1), bocna(-1), brusna, ...oko(1), ...oko(-1));
  g.rotateX(Math.PI / 2);                                          // lezi na boku
  g = naZem(g); ao(g, 0.03, 0.35);
  return [g, stylMat({ roughness: 0.32, metalness: 0.12 }, 0.6)];
}

// =====================================================================================
// DALSIE PREDMETY: surovina, rastliny, jedlo, more. Spolocne pomocne funkcie nizsie.
// =====================================================================================
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const MAT_LIST = stylMat({ roughness: 0.6, side: THREE.DoubleSide }, 0.7);   // listy, riasy, lupienky (tenke plochy)
const MAT_LESK = stylMat({ roughness: 0.28 }, 0.6);                          // leskle (ovocie, sklo)
const MAT_MATNY = stylMat({ roughness: 0.9 }, 0.5);

// plynula krivka z bodov [[x,y,z],...] -> pole Vector3
export const krivka = (pts, n = 24, zavrena = false) => new THREE.CatmullRomCurve3(pts.map(p => V(p[0], p[1], p[2])), zavrena).getPoints(n);

// TUBA: trubica pozdlz krivky 'body' s polomerom rf(u), u = 0..1; fn(v, c, u, phi, koniec) = farba/deformacia;
// tv(phi, u) = tvar prierezu (cislo alebo [sx, sy]). Konce su uzavrete.
export function tuba(body, rf, radial, fn, tv, ref) {
  const n = body.length, pos = [], col = [], idx = [], c = new THREE.Color(), P = V(0, 0, 0), T = V(0, 0, 0), N = V(0, 0, 0), B = V(0, 0, 0);
  const ramce = []; let pN = null;
  for (let i = 0; i < n; i++) {
    T.subVectors(body[Math.min(n - 1, i + 1)], body[Math.max(0, i - 1)]).normalize();
    if (!pN) { if (ref) N.copy(ref).addScaledVector(T, -ref.dot(T)).normalize(); else N.crossVectors(Math.abs(T.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0), T).normalize(); }
    else N.copy(pN).addScaledVector(T, -pN.dot(T)).normalize();
    B.crossVectors(T, N); pN = N.clone(); ramce.push([N.clone(), B.clone()]);
  }
  const R = radial + 1;
  for (let k = 0; k < n + 2; k++) {
    const i = Math.min(n - 1, Math.max(0, k - 1)), u = i / (n - 1), koniec = k === 0 || k === n + 1;
    const [Nn, Bn] = ramce[i];
    for (let j = 0; j <= radial; j++) {
      const phi = j / radial * Math.PI * 2;
      let sx = 1, sy = 1;
      if (tv) { const t = tv(phi, u); if (Array.isArray(t)) { sx = t[0]; sy = t[1]; } else sx = sy = t; }
      const r = koniec ? 0 : rf(u);
      P.copy(body[i]).addScaledVector(Nn, Math.cos(phi) * r * sx).addScaledVector(Bn, Math.sin(phi) * r * sy);
      c.setRGB(1, 1, 1);
      if (fn) fn(P, c, u, phi, koniec);
      pos.push(P.x, P.y, P.z); col.push(c.r, c.g, c.b);
    }
  }
  for (let k = 0; k < n + 1; k++) for (let j = 0; j < radial; j++) { const a = k * R + j, b = a + R; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return hladka(g);
}

// PLOCHA: tenky pas (list, lupienok, riasa) pozdlz osi 'os'; sirka(u) = polovicna sirka; fn(P, c, u, e), e = -1..1 naprec;
// okraje sa zdvihnu o fold * sirka (V-profil). Pouziva sa s MAT_LIST (obojstranny).
export function plocha(os, sirka, fn, fold = 0.25, naprec = [-1, 0, 1], up = V(0, 1, 0)) {
  const n = os.length, m = naprec.length, pos = [], col = [], idx = [], c = new THREE.Color(), P = V(0, 0, 0), T = V(0, 0, 0), S = V(0, 0, 0), N = V(0, 0, 0);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    T.subVectors(os[Math.min(n - 1, i + 1)], os[Math.max(0, i - 1)]).normalize();
    S.crossVectors(T, up); if (S.lengthSq() < 1e-6) S.set(0, 0, 1); S.normalize();
    N.crossVectors(S, T).normalize();
    const w = sirka(u);
    for (const e of naprec) {
      P.copy(os[i]).addScaledVector(S, e * w).addScaledVector(N, e * e * fold * w);
      c.setRGB(1, 1, 1);
      if (fn) fn(P, c, u, e);
      pos.push(P.x, P.y, P.z); col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < m - 1; j++) { const a = i * m + j, b = a + m; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// hranaty povrch: kazda plocha jednou farbou podla normaly; fn(n, c, y, i)
export function fasety(geo, fn) {
  const g = geo.toNonIndexed(); g.computeVertexNormals();
  const p = g.attributes.position, nr = g.attributes.normal, col = new Float32Array(p.count * 3), c = new THREE.Color(), n = V(0, 0, 0);
  for (let i = 0; i < p.count; i += 3) {
    n.fromBufferAttribute(nr, i); c.setRGB(1, 1, 1);
    fn(n, c, (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, i / 3);
    for (let k = 0; k < 3; k++) c.toArray(col, (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
// zakulatena elipsoid s deformaciou: fn(v, c, d) kde d = jednotkovy smer (v je tiez jednotkovy, polomery sa aplikuju po fn)
export function blob(rx, ry, rz, fn, det = 4) {
  const d = V(0, 0, 0);
  return tvar(hladka(new THREE.IcosahedronGeometry(1, det)), (v, c) => { d.copy(v); fn(v, c, d); v.x *= rx; v.y *= ry; v.z *= rz; });
}

// VALEC: pozdlzne teleso okolo osi y (0..L) s polomerom rf(t); aj podstavy maju prstence => farba rezu (letokruhy).
// fn(v, c, t, phi, rr, rez): rr = pomer k polomeru, rez = vrchol na rezanej podstave
export function valec(L, rf, radial, kroky, fn) {
  const r0 = rf(0), r1 = rf(1), pr = [];
  for (const k of [0, 0.3, 0.6, 0.88]) pr.push(new THREE.Vector2(r0 * k, 0));
  pr.push(new THREE.Vector2(r0 * 0.985, 0.004));
  for (let i = 1; i < kroky; i++) { const t = i / kroky; pr.push(new THREE.Vector2(rf(t), L * t)); }
  pr.push(new THREE.Vector2(r1 * 0.985, L - 0.004));
  for (const k of [0.88, 0.6, 0.3, 0]) pr.push(new THREE.Vector2(r1 * k, L));
  return tvar(hladka(new THREE.LatheGeometry(pr, radial)), (v, c) => {
    const t = Math.min(1, Math.max(0, v.y / L)), rr = Math.hypot(v.x, v.z) / rf(t), phi = Math.atan2(v.z, v.x);
    fn(v, c, t, phi, rr, (v.y < 0.0021 || v.y > L - 0.0021) && rr < 0.92);
  });
}
// kora: spolocna funkcia farby/povrchu pre drevo, palicu
export function korFn(F) {
  const k1 = C(F.k1), k2 = C(F.k2), k3 = C(F.k3), lyko = C(F.lyko), srdce = C(F.srdce), mach = C(0x5f9a35);
  return (v, c, t, phi, rr, rez) => {
    const cx = Math.cos(phi), sz = Math.sin(phi);
    if (rez) {
      const k = Math.sin(rr * F.krouzky + sum(cx * 2 + 5, sz * 2, t) * 3) * 0.5 + 0.5;
      c.copy(lyko).lerp(srdce, smooth(0.2, 1, 1 - rr) * 0.5).multiplyScalar(0.86 + 0.14 * k);
      if (rr < 0.08) c.lerp(srdce, 0.7);
      return;
    }
    const n = fbm(cx * 2.2 + 4, sz * 2.2, v.y * F.z, 3), br = Math.sin(phi * F.hrany + n * 5), s = 1 + (n - 0.5) * F.hrb + br * 0.02;
    v.x *= s; v.z *= s;
    c.copy(k1).lerp(k2, smooth(0.35, 0.8, n)).lerp(k3, (br * 0.5 + 0.5) * 0.35);
    c.multiplyScalar(0.8 + 0.3 * fbm(v.x * 40, v.y * 10, v.z * 40, 2));
    if (F.mach) c.lerp(mach, smooth(0.62, 0.8, fbm(cx * 3 + 9, sz * 3, t * 5, 3)) * smooth(-0.2, 0.8, cx) * 0.65);
    if (F.zlupka) c.lerp(lyko, smooth(0.66, 0.8, fbm(cx * 4 + 3, sz * 4, t * 6, 3)) * 0.9);
  };
}

// ---------- DREVO: poleno s korou, letokruhmi na reze, machom a pahylom konara ----------
export function modelDrevo() {
  const F = { k1: 0x4a2f1c, k2: 0x9a6a3c, k3: 0x6e4829, lyko: 0xe2bd82, srdce: 0x9a6030, krouzky: 34, z: 3.2, hrany: 9, hrb: 0.18, mach: 1 };
  const L = 0.9, rf = t => 0.13 - 0.015 * t;
  const kmen = valec(L, rf, 26, 24, korFn(F));
  const pahyl = valec(0.1, t => 0.032 * (1 - 0.3 * t), 12, 4, korFn({ ...F, mach: 0, hrb: 0.1 })).rotateX(Math.PI / 2).translate(0, 0.55, 0.1);
  let g = dokonci(kmen, pahyl).rotateZ(Math.PI / 2);
  g = naZem(g); ao(g, 0.05, 0.4);
  return [g, MAT_STYL];
}

// ---------- PALICA: sucha, trochu kriva, olupena kora, mala vetvicka ----------
export function modelPalica() {
  const F = { k1: 0x7a5a38, k2: 0xb89460, k3: 0x5a4026, lyko: 0xe6cfa0, srdce: 0xb48850, krouzky: 30, z: 4, hrany: 7, hrb: 0.2, zlupka: 1 };
  const fk = korFn(F), L = 1.1;
  const hlavna = valec(L, t => 0.05 - 0.02 * t, 12, 30, (v, c, t, phi, rr, rez) => { fk(v, c, t, phi, rr, rez); v.x += 0.03 * Math.sin(t * 4.2); v.z += 0.015 * Math.sin(t * 7); });
  const vet = valec(0.22, t => 0.014 * (1 - 0.55 * t) + 0.004, 8, 8, fk).rotateZ(-0.95).translate(0.03 * Math.sin(0.45 * 4.2) + 0.03, 0.46, 0);
  let g = dokonci(hlavna, vet).rotateZ(Math.PI / 2);
  g = naZem(g); ao(g, 0.04, 0.35);
  return [g, MAT_STYL];
}

// ---------- OBSIDIAN: ostre sklenene ulomky (hranate plochy, fialovo-tyrkysove odlesky) ----------
function ulomok(h, w, sklon, sx, sz, rot, seed) {
  let g = tvar(hladka(new THREE.IcosahedronGeometry(1, 2)), (v) => {
    const t = (v.y + 1) / 2, j = 1 + (sum(v.x * 3 + seed, v.y * 3, v.z * 3) - 0.5) * 0.45;
    const zuz = (0.55 + 0.45 * smooth(0, 0.35, t)) * (1 - 0.9 * smooth(0.45, 1, t));
    v.set(v.x * w * zuz * j, t * h, v.z * w * 0.75 * zuz * j);
  });
  g.rotateZ(sklon).rotateY(rot).translate(sx, 0, sz);
  return fasety(g, (n, c, y) => {
    c.set(0x0b0b13).lerp(C(0x5b4a99), smooth(0.35, 0.9, n.y) * 0.7).lerp(C(0x1f7f86), smooth(0.45, 0.95, n.x) * 0.55);
    c.lerp(C(0xcfd0f0), smooth(0.9, 1, n.y) * 0.35);
    c.multiplyScalar(0.7 + 0.3 * smooth(0, 0.3, y));
  });
}
export function modelObsidian() {
  let g = dokonci(ulomok(0.3, 0.075, 0.28, 0, 0, 0.4, 1), ulomok(0.2, 0.06, -0.55, 0.075, 0.03, 1.4, 2), ulomok(0.13, 0.05, 0.7, -0.06, 0.07, 2.5, 3), ulomok(0.07, 0.04, 1.2, 0.03, -0.07, 0.8, 4));
  g = naZem(g);
  return [g, stylMat({ roughness: 0.1, metalness: 0.3 }, 0.9)];
}

// ---------- SIRA: zlta hrudka s krystalmi a oranzovymi skvrnami ----------
export function modelSira() {
  const zl = C(0xe3b820), sv = C(0xf6e44c), or = C(0xd98a1c);
  const zaklad = blob(0.11, 0.07, 0.09, (v, c, d) => {
    const n = fbm(d.x * 2 + 5, d.y * 2, d.z * 2, 3), n2 = fbm(d.x * 8, d.y * 8, d.z * 8, 2);
    v.multiplyScalar(1 + (n - 0.5) * 0.5 + (n2 - 0.5) * 0.12);
    c.copy(zl).lerp(sv, smooth(0.35, 0.75, n)).lerp(or, smooth(0.62, 0.8, n2) * 0.7); c.multiplyScalar(0.85 + n2 * 0.25);
  });
  const diely = [zaklad.translate(0, 0.01, 0)];
  const q = new THREE.Quaternion();
  for (let i = 0; i < 9; i++) {
    const a = hash(i, 1, 3) * 6.28, b = 0.15 + hash(i, 2, 5) * 0.95;
    const d = V(Math.cos(a) * Math.sin(b), Math.cos(b) * 0.9 + 0.1, Math.sin(a) * Math.sin(b)).normalize();
    const k = 0.035 + hash(i, 4, 7) * 0.04;
    const kr = new THREE.OctahedronGeometry(1, 0).scale(0.014 + k * 0.25, k, 0.012 + k * 0.2).translate(0, k * 0.8, 0);
    q.setFromUnitVectors(V(0, 1, 0), d); kr.applyQuaternion(q).translate(d.x * 0.095, d.y * 0.06, d.z * 0.08);
    diely.push(fasety(kr, (n, c, y) => c.set(0xf4d830).lerp(C(0xfff59a), smooth(0.2, 0.9, n.y) * 0.8).multiplyScalar(0.8 + 0.2 * smooth(0, 0.1, y))));
  }
  let g = dokonci(...diely); g = naZem(g); ao(g, 0.03, 0.35);
  return [g, stylMat({ roughness: 0.5 }, 0.6)];
}

// ---------- LIST: palmovy list, rebro + dva rady listkov (kazdy uzky list) ----------
export function modelList() {
  const L = 0.72;
  const rebro = krivka(Array.from({ length: 9 }, (_, i) => { const s = i / 8; return [-L / 2 + s * L, 0.06 * Math.sin(Math.PI * s * 0.95), 0.025 * Math.sin(s * 5)]; }), 16);
  const kr = new THREE.CatmullRomCurve3(rebro);
  const diely = [tuba(rebro, u => 0.011 * (1 - 0.7 * u) + 0.003, 6, (v, c, u) => c.set(0xcfe08a).lerp(C(0x86b648), u))];
  const dz = C(0x2c7428), sv = C(0x86c23e), zl = C(0xc9d860), st = C(0xe4f0a0);
  const N = 22;
  for (let k = 0; k < N; k++) for (const sg of [-1, 1]) {
    const s = 0.1 + 0.88 * (k + (sg > 0 ? 0.5 : 0)) / N, P = kr.getPointAt(s), T = kr.getTangentAt(s);
    const a = 1.05 - 0.3 * s, d = V(T.x * Math.cos(a), 0, T.z * Math.cos(a) + sg * Math.sin(a)).normalize();
    const len = 0.05 + 0.14 * Math.sin(Math.PI * Math.min(1, s * 0.93 + 0.07)), os = [];
    for (let i = 0; i <= 6; i++) { const u = i / 6; os.push(V(P.x + d.x * len * u, P.y + len * (0.16 * u - 0.55 * u * u), P.z + d.z * len * u)); }
    const t = hash(k, sg, 3);
    diely.push(plocha(os, u => 0.017 * Math.pow(Math.sin(Math.PI * (0.06 + 0.94 * u)), 0.7), (p, c, u, e) => {
      c.copy(dz).lerp(sv, smooth(0.0, 1, u) * 0.8).lerp(zl, smooth(0.8, 1, u) * 0.5 * t).lerp(st, (1 - Math.abs(e)) * 0.2 * (1 - u)).multiplyScalar(0.85 + t * 0.25);
    }, 0.45));
  }
  let g = dokonci(...diely); g = naZem(g);
  return [g, MAT_LIST];
}

// ---------- VLAKNO: previazany povrazok slucok zo stocenych vlakien + pramienky ----------
export function modelVlakno() {
  const farby = [0xd6c08a, 0xc4a868, 0xe4d2a0, 0xcdb27a];
  const diely = [];
  for (let k = 0; k < 4; k++) {
    const sklon = (k - 1.5) * 0.42, pts = [];
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; pts.push([Math.cos(a) * 0.11, Math.sin(a) * 0.05 * Math.cos(sklon), Math.sin(a) * 0.08 * Math.sin(sklon)]); }
    const bd = krivka(pts, 36, true), base = C(farby[k]), tm = base.clone().multiplyScalar(0.6);
    diely.push(tuba(bd, () => 0.0145, 6, (v, c, u, phi) => { const tw = Math.sin(phi * 2 + u * 230) * 0.5 + 0.5; c.copy(base).lerp(tm, smooth(0.3, 0.9, tw)); }));
  }
  diely.push(lano(0.034, 0.0095, 0x7a5a38, 16).rotateY(Math.PI / 2).translate(-0.095, 0.03, 0));
  for (let k = 0; k < 4; k++) {
    const a = (k - 1.5) * 0.45;
    diely.push(tuba(krivka([[0.1, 0.02, 0], [0.15, 0.035, a * 0.08], [0.2, 0.02, a * 0.12], [0.235, 0.005, a * 0.16]], 8), u => 0.0045 * (1 - 0.6 * u), 5, (v, c, u) => c.set(0xeadcb0).lerp(C(0xc4a868), u)));
  }
  let g = dokonci(...diely); g = naZem(g); ao(g, 0.04, 0.4);
  return [g, MAT_MATNY];
}

// ---------- BAMBUS: stonka so 4 uzlami (zosilnenie + tmavy kruh), pozdlzne pruhy, duty rez ----------
export function modelBambus() {
  const uzly = [0.2, 0.43, 0.66, 0.89], L = 1.2;
  const bump = t => uzly.reduce((s, u) => s + Math.exp(-Math.pow((t - u) / 0.016, 2)), 0);
  const rf = t => 0.05 * (1 + 0.17 * bump(t)) * (1 - 0.1 * t);
  const a = C(0xa3bd48), b = C(0xd2c85c), uzol = C(0x5f7e1e), kruh = C(0xe8e4be), tma = C(0x2e3414), stena = C(0xe3da8a);
  let g = valec(L, rf, 16, 64, (v, c, t, phi, rr, rez) => {
    if (rez) { if (rr < 0.78) c.copy(tma).lerp(C(0x5a6428), smooth(0.2, 0.78, rr)); else c.copy(stena); return; }
    const w = bump(t), n = fbm(Math.cos(phi) * 3 + 4, Math.sin(phi) * 3, t * 2.2, 3);
    c.copy(a).lerp(b, smooth(0.3, 0.8, n)).multiplyScalar(0.9 + 0.12 * Math.sin(phi * 11 + n * 4));
    c.lerp(uzol, smooth(0.25, 0.9, w) * 0.85);
    const nad = uzly.reduce((s, u) => s + smooth(0.0, 0.012, t - u - 0.025) * smooth(0.05, 0.02, t - u - 0.025), 0);
    c.lerp(kruh, Math.min(1, nad) * 0.55);
  });
  g.rotateZ(Math.PI / 2); g = naZem(g); ao(g, 0.04, 0.4);
  return [dokonci(g), MAT_STYL];
}

const MAT_BOBULE = stylMat({ roughness: 0.3, side: THREE.DoubleSide }, 0.7);
// ---------- BOBULE: zhluk lesklych bobulí s voskovym povlakom a hviezdickou kalicha + listok ----------
function bobula(R, tm, sv) {
  const a = C(tm), b = C(sv), kal = C(0x161a24), kvet = C(0xaab0e8);
  return tvar(hladka(new THREE.SphereGeometry(R, 18, 12)), (v, c) => {
    const y = v.y / R, phi = Math.atan2(v.z, v.x);
    v.y -= R * 0.18 * smooth(0.82, 1, y);
    c.copy(a).lerp(b, smooth(-0.6, 0.9, y) * 0.55 + (v.x > 0 ? 0.1 : 0));
    c.lerp(kvet, smooth(0.5, 0.85, sum(v.x * 40, v.y * 40, v.z * 40)) * 0.3);
    c.lerp(kal, smooth(0.9, 0.99, y) * (0.55 + 0.45 * Math.pow(Math.abs(Math.cos(2.5 * phi)), 3)));
  });
}
export function modelBobule() {
  const R = 0.05, poz = [[0, 0, 0], [0.085, 0.02, 0.01], [-0.045, 0.075, -0.01], [0.02, -0.08, 0.01], [-0.085, -0.035, 0.005], [0.07, -0.06, 0.015]];
  const diely = poz.map(([x, z, y], i) => bobula(R * (0.92 + hash(i, 1, 1) * 0.16), i === 2 || i === 5 ? 0xa8203a : 0x23288a, i === 2 || i === 5 ? 0xe85a6a : 0x5a62d8).translate(x, R + y, z));
  const list = plocha(krivka([[0.0, 0.03, 0.07], [-0.015, 0.05, 0.12], [-0.02, 0.05, 0.18], [0.0, 0.03, 0.23]], 8), u => 0.04 * Math.pow(Math.sin(Math.PI * (0.05 + 0.95 * u)), 0.7),
    (p, c, u, e) => c.set(0x2f7a2a).lerp(C(0x7fbf44), u * 0.5 + (1 - Math.abs(e)) * 0.2), 0.3);
  let g = dokonci(...diely, list); g = naZem(g); ao(g, 0.03, 0.4);
  return [g, MAT_BOBULE];
}

// ---------- BANAN: banan (alebo trs) - zahnute plody s patholcovym prierezom, zeleny krcok, hnede ostky ----------
function banan1(bd, pec) {
  const zel = C(0x7c9c3a), zl = C(0xf2cf2e), hn = C(0x8a5a1a), tip = C(0x33261a);
  const kora = C(0x5a3a1c), cierna = C(0x1c120a), flesh = C(0xeaa842), flesh2 = C(0xb8681c);
  return tuba(bd, u => (0.011 + 0.021 * smooth(0.02, 0.22, u)) * (1 - 0.32 * smooth(0.7, 1, u)), 10, (P, c, u, phi, koniec) => {
    const hr = Math.pow(Math.abs(Math.cos(2.5 * phi)), 6), n = sum(P.x * 70, P.y * 70, P.z * 70);
    if (pec) {
      c.copy(kora).lerp(cierna, smooth(0.45, 0.7, n) * 0.7).lerp(C(0x7a4a1c), hr * 0.3);
      const c0 = bd[Math.round(u * (bd.length - 1))], up = (P.y - c0.y) / 0.03;
      c.lerp(flesh, smooth(0.35, 0.6, up) * smooth(0.08, 0.2, u) * smooth(0.95, 0.85, u)).lerp(flesh2, smooth(0.75, 1, n) * 0.4 * smooth(0.35, 0.6, up));
    } else {
      c.copy(zl).lerp(zel, smooth(0.28, 0.06, u) + hr * 0.12).lerp(hn, smooth(0.78, 0.9, n) * 0.55 * smooth(0.2, 0.4, u));
      c.lerp(tip, smooth(0.94, 0.985, u));
    }
  }, phi => 1 + 0.07 * Math.cos(5 * phi));
}
export function modelBanan(n = 3, pec = false) {
  const diely = [];
  for (let i = 0; i < n; i++) {
    const s = n === 1 ? 0 : i - (n - 1) / 2, bd = krivka([[-0.12, 0.05, s * 0.01], [-0.07, 0.04, s * 0.025], [0.0, 0.035, s * 0.05], [0.09, 0.055, s * 0.075], [0.15, 0.095, s * 0.09]], 16);
    diely.push(banan1(bd, pec));
  }
  if (n > 1) diely.push(tuba(krivka([[-0.19, 0.035, 0], [-0.15, 0.045, 0], [-0.11, 0.05, 0]], 4), () => 0.02, 8, (P, c, u) => c.set(0x6a7a30).lerp(C(0x4a3a20), smooth(0.0, 0.2, 0.2 - u))));
  let g = dokonci(...diely); g = naZem(g); ao(g, 0.03, 0.35);
  return [g, MAT_LESK];
}

// ---------- MANGO: vajcovity plod s ruzovo-oranzovym rumencom, zelenou hornou casou, drobnymi bodkami, stonkou a listom ----------
export function modelMango() {
  const zel = C(0x7aa832), zlt = C(0xf2b82e), cerv = C(0xe2502a), oran = C(0xf08a2c), bod = C(0xfbe8a0);
  let plod = tvar(hladka(new THREE.SphereGeometry(1, 36, 26)), (v, c) => {
    const y = v.y, xs = v.x, rad = 0.085 * (1 + 0.1 * y - 0.17 * y * y) * (1 - 0.28 * smooth(-0.5, -1, y));
    v.x = xs * rad + 0.012 * smooth(0, 1, y); v.z = v.z * rad * 0.88; v.y = y * 0.115 - 0.025 * smooth(0.8, 1, y);
    const side = xs * 0.5 + 0.5;
    c.copy(zlt).lerp(zel, smooth(0.3, 0.95, y)).lerp(oran, smooth(0.2, 0.9, side) * 0.8).lerp(cerv, smooth(0.55, 1, side) * smooth(-1, 0.4, y) * 0.8);
    c.lerp(bod, smooth(0.8, 0.9, sum(v.x * 70, v.y * 70, v.z * 70)) * 0.45);
  });
  const stonka = tuba(krivka([[0.004, 0.085, 0], [0.01, 0.12, 0.002], [0.012, 0.15, 0]], 5), () => 0.0065, 6, (P, c) => c.set(0x5a6a2a));
  const list = plocha(krivka([[0.012, 0.148, 0], [0.06, 0.168, 0.01], [0.12, 0.158, 0.02], [0.18, 0.12, 0.025], [0.225, 0.07, 0.03]], 9), u => 0.028 * Math.pow(Math.sin(Math.PI * (0.06 + 0.94 * u)), 0.8),
    (p, c, u, e) => c.set(0x2c6a28).lerp(C(0x7fbf44), (1 - Math.abs(e)) * 0.3 + u * 0.25), 0.3);
  let g = dokonci(plod, stonka, list); g.rotateZ(0.22); g = naZem(g); ao(g, 0.03, 0.35);
  return [g, MAT_LIST];
}

// ---------- ANANAS: kosoštvorcovy vzor s hnedymi "ockami", koruna z ostrych listov ----------
export function modelAnanas() {
  const zl = C(0xe6a528), or = C(0xc86a1a), oko = C(0x5a3010), zel = C(0x7a9a30);
  let telo = tvar(hladka(new THREE.SphereGeometry(1, 36, 28)), (v, c) => {
    const y = v.y, phi = Math.atan2(v.z, v.x), g1 = Math.abs(Math.sin(phi * 7 + y * 14)), g2 = Math.abs(Math.sin(phi * 7 - y * 14));
    const bump = smooth(0, 0.8, g1 * g2), groove = 1 - smooth(0, 0.25, Math.min(g1, g2));
    const s = (1 + 0.045 * bump - 0.025 * groove) * (1 - 0.12 * smooth(0.5, 1, y));
    v.set(v.x * 0.125 * s, 0.19 + y * 0.175, v.z * 0.125 * s);
    c.copy(zl).lerp(or, groove * 0.8).lerp(zel, smooth(0.78, 1, y) * 0.8).lerp(oko, smooth(0.8, 0.95, g1 * g2) * 0.7);
    c.multiplyScalar(0.7 + 0.3 * smooth(-1, 0.1, y));
  });
  const diely = [telo], zak = V(0, 0.36, 0);
  for (let i = 0; i < 15; i++) {
    const a = i * 2.4, t = i / 14, tilt = 0.9 - 0.75 * t, len = 0.2 - 0.07 * t;
    const h = V(Math.cos(a), 0, Math.sin(a)), os = [], P = zak.clone().addScaledVector(h, 0.02 * (1 - t));
    for (let k = 0; k <= 6; k++) { const u = k / 6, th = tilt + 0.35 * u; os.push(P.clone()); P.addScaledVector(h, Math.sin(th) * len / 6).y += Math.cos(th) * len / 6; }
    diely.push(plocha(os, u => 0.022 * (1 - Math.pow(u, 1.3)) + 0.002, (p, c, u, e) => c.set(0x2f7a2c).lerp(C(0x62ac3a), u * 0.8).lerp(C(0xa86a2a), smooth(0.7, 1, u) * Math.abs(e) * 0.5).multiplyScalar(0.85 + 0.2 * hash(i, 3, 3)), 0.5));
  }
  let g = dokonci(...diely); g = naZem(g); ao(g, 0.04, 0.35);
  return [g, MAT_LIST];
}

// ---------- TRSTINA: clankovana stonka s fialovo-zelenymi pruhmi, bielymi prstencami, listom ----------
export function modelTrstina() {
  const uzly = [0.16, 0.34, 0.52, 0.71, 0.89], L = 1.1;
  const bump = t => uzly.reduce((s, u) => s + Math.exp(-Math.pow((t - u) / 0.015, 2)), 0);
  const rf = t => 0.04 * (1 + 0.14 * bump(t)) * (1 - 0.1 * t);
  const pur = C(0x6a2a40), olv = C(0xa8963a), bie = C(0xdcd2b0), tm = C(0x4a2230), vl = C(0xe9d8a0);
  let g = valec(L, rf, 14, 60, (v, c, t, phi, rr, rez) => {
    if (rez) { c.copy(vl).lerp(C(0xc9b878), smooth(0.2, 0.9, rr)).multiplyScalar(0.9 + 0.1 * Math.sin(rr * 40)); return; }
    const n = fbm(Math.cos(phi) * 2.5 + 1, Math.sin(phi) * 2.5, t * 3, 3), pas = Math.sin(phi * 6 + n * 6) * 0.5 + 0.5;
    c.copy(pur).lerp(olv, smooth(0.45, 0.75, pas) * 0.8).lerp(tm, smooth(0.6, 0.9, n) * 0.4);
    c.lerp(bie, uzly.reduce((s, u) => s + smooth(0.0, 0.012, t - u - 0.014) * smooth(0.05, 0.02, t - u - 0.014), 0) * 0.55);
    c.lerp(C(0x3a1c28), smooth(0.2, 0.9, bump(t)) * 0.6);
  });
  g.rotateZ(Math.PI / 2);
  const list = plocha(krivka([[0.0, 0, 0.0], [-0.08, 0.05, 0.0], [-0.2, 0.09, 0.02], [-0.34, 0.07, 0.04], [-0.44, 0.0, 0.05]], 10), u => 0.022 * (1 - Math.pow(u, 1.6)) + 0.002,
    (p, c, u, e) => c.set(0x4a8a2e).lerp(C(0x9cc84a), u * 0.6 + (1 - Math.abs(e)) * 0.2), 0.4).translate(-0.05, 0.03, 0);
  g = dokonci(g, list); g = naZem(g); ao(g, 0.04, 0.4);
  return [g, MAT_LIST];
}

// ---------- KVET: ibiskovy kvet - 5 prekryvajucich sa lupienkov s farebnym prechodom, tycinka, stonka, listy ----------
export function modelKvet() {
  const diely = [];
  diely.push(tuba(krivka([[0, 0, 0], [0.02, 0.12, 0], [0.01, 0.23, 0], [0, 0.3, 0]], 10), u => 0.011 - 0.003 * u, 7, (P, c, u) => c.set(0x3f8a2c).lerp(C(0x7ab040), u * 0.4)));
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 + 0.3, dx = Math.cos(a), dz = Math.sin(a), os = [];
    for (let k = 0; k <= 7; k++) { const u = k / 7; os.push(V(dx * 0.078 * u, 0.3 + 0.05 * u - 0.058 * u * u + i * 0.003, dz * 0.078 * u)); }
    diely.push(plocha(os, u => 0.043 * Math.pow(Math.sin(Math.PI * (0.12 + 0.88 * u)), 0.55), (p, c, u, e) => {
      c.set(0x78103a).lerp(C(0xe0283a), smooth(0.05, 0.4, u)).lerp(C(0xff6f84), smooth(0.45, 1, u) * 0.85);
      c.multiplyScalar(0.92 + 0.08 * Math.cos(e * 7));
    }, 0.4, [-1, -0.5, 0, 0.5, 1]));
  }
  diely.push(tuba(krivka([[0, 0.3, 0], [0.004, 0.34, 0], [0.02, 0.385, 0], [0.04, 0.405, 0]], 8), u => 0.0055, 6, (P, c, u) => c.set(0xe8b838).lerp(C(0xe0506a), u * 0.4)));
  for (let i = 0; i < 6; i++) { const a = i * 1.05; diely.push(tvar(hladka(new THREE.SphereGeometry(0.0085, 8, 6)), (v, c) => c.set(0xf2c81e)).translate(0.036 + Math.cos(a) * 0.008, 0.402 + Math.sin(a) * 0.006, Math.sin(a) * 0.008)); }
  for (const s of [-1, 1]) diely.push(plocha(krivka([[0.005, 0.1 + 0.03 * s, 0.0], [0.05, 0.12, s * 0.04], [0.1, 0.13, s * 0.08], [0.15, 0.1, s * 0.11]], 8), u => 0.03 * Math.pow(Math.sin(Math.PI * (0.06 + 0.94 * u)), 0.8),
    (p, c, u, e) => c.set(0x2c6a28).lerp(C(0x7fbf44), (1 - Math.abs(e)) * 0.3 + u * 0.2), 0.3));
  let g = dokonci(...diely); g.rotateZ(1.35); g = naZem(g); ao(g, 0.03, 0.3);
  return [g, MAT_LIST];
}

// ---------- HUBA: hriba s bochnikovym klobukom (bodky, lamely pod nim), stlpikom s cibulkou a mladou hubkou ----------
function hriba(pec, radial) {
  const pr = [[0, 0], [0.03, 0], [0.042, 0.008], [0.04, 0.02], [0.034, 0.04], [0.029, 0.065], [0.027, 0.088], [0.03, 0.1], [0.05, 0.101], [0.07, 0.105], [0.088, 0.112]];
  for (let k = 1; k <= 9; k++) { const th = k / 9 * Math.PI / 2; pr.push([0.09 * Math.cos(th), 0.112 + 0.06 * Math.sin(th)]); }
  const kl1 = C(pec ? 0x7a4520 : 0xb8742c), kl2 = C(pec ? 0x4e2a12 : 0x8a4e22), kl3 = C(pec ? 0xa8683a : 0xdc9c54), bod = C(pec ? 0x2a1a10 : 0xf6e8c8);
  const st = C(pec ? 0xd8b070 : 0xf0e4c8), st2 = C(pec ? 0xa8804a : 0xcfb890), lam = C(pec ? 0xb88850 : 0xecd0a0), lam2 = C(pec ? 0x8a5c30 : 0xb48858);
  return tvar(hladka(new THREE.LatheGeometry(pr.map(p => new THREE.Vector2(p[0], p[1])), radial)), (v, c) => {
    const r = Math.hypot(v.x, v.z), phi = Math.atan2(v.z, v.x), y = v.y;
    if (y <= 0.1125 && r > 0.032) { c.copy(lam).lerp(lam2, (Math.sin(phi * 44) * 0.5 + 0.5) * smooth(0.04, 0.08, r)); return; }
    if (y <= 0.1) { c.copy(st).lerp(st2, smooth(0.045, 0.0, y) * 0.8).multiplyScalar(0.92 + 0.08 * Math.sin(phi * 17 + y * 30)); return; }
    const n = fbm(v.x * 25, v.y * 25, v.z * 25, 2), s = 1 + (n - 0.5) * 0.09; v.x *= s; v.z *= s;
    c.copy(kl1).lerp(kl2, smooth(0.13, 0.17, y) * 0.85).lerp(kl3, smooth(0.04, 0.09, r) * smooth(0.14, 0.114, y) * 0.9);
    c.lerp(bod, smooth(0.75, 0.82, sum(v.x * 40 + 3, v.y * 40, v.z * 40)) * smooth(0.12, 0.135, y) * (pec ? 0.7 : 1));
  });
}
export function modelHuba(pec = false) {
  const mala = hriba(pec, 14).scale(0.55, 0.55, 0.55).rotateZ(-0.28).translate(0.125, 0, 0.045);
  let g = dokonci(hriba(pec, 22), mala); g = naZem(g); ao(g, 0.03, 0.3);
  return [g, pec ? MAT_LESK : MAT_STYL];
}

// ---------- ALOE: ruzica hrubych sucelentnych listov s oziubanym okrajom a svetlymi bodkami ----------
export function modelAloe() {
  const diely = [], zl = C(0x5f9a72), zs = C(0x8abfa0), bod = C(0xe4f2e2), hrot = C(0x8a6a3a), zub = C(0xd88a8a);
  for (let i = 0; i < 6; i++) {
    const a = i * 2.4, h = V(Math.cos(a), 0, Math.sin(a)), L = 0.3 - 0.015 * i, tilt = 0.85 - 0.12 * i, os = [], P = V(0, 0, 0);
    for (let k = 0; k <= 15; k++) { const u = k / 15, th = tilt + 0.5 * u; os.push(P.clone()); P.addScaledVector(h, Math.sin(th) * L / 15).y += Math.cos(th) * L / 15; }
    diely.push(tuba(os, u => 0.036 * Math.pow(1 - Math.pow(u, 1.5), 0.8) + 0.002, 8, (p, c, u, phi, konec) => {
      const n = sum(p.x * 60, p.y * 60, p.z * 60), e = Math.abs(Math.cos(phi));
      c.copy(zl).lerp(zs, smooth(0.2, 0.9, u) * 0.6 * (1 - e) + (1 - e) * 0.15).lerp(bod, smooth(0.82, 0.92, n) * 0.55).lerp(hrot, smooth(0.92, 1, u) * 0.8);
      c.lerp(zub, Math.pow(e, 8) * smooth(0.1, 0.4, u) * 0.5);
    }, (phi, u) => [1 + 0.4 * Math.pow(Math.abs(Math.cos(phi)), 10) * Math.pow(Math.abs(Math.sin(u * Math.PI * 7)), 1.5), 0.32], V(-Math.sin(a), 0, Math.cos(a))));
  }
  let g = dokonci(...diely); g = naZem(g); ao(g, 0.05, 0.4);
  return [g, MAT_STYL];
}

// ---------- HLINA: vlhka cervena hlina - hruda s vtlacenymi prstami, mokre tmave miesta, drobne hrudky ----------
export function modelHlina() {
  const sv = C(0xb4603a), st = C(0xa4532e), tm = C(0x7a3a20), och = C(0xc98a4c);
  const dent = [[0.4, 0.2], [-0.3, 0.45], [0.05, -0.5]];
  const hruda = blob(0.14, 0.07, 0.11, (v, c, d) => {
    const n = fbm(d.x * 1.6 + 7, d.y * 1.6, d.z * 1.6, 3), n2 = fbm(d.x * 7, d.y * 7, d.z * 7, 2);
    let s = 1 + (n - 0.5) * 0.35;
    let jam = 0; for (const [dx, dz] of dent) jam += Math.exp(-((d.x - dx) ** 2 + (d.z - dz) ** 2) * 14) * Math.max(0, d.y);
    v.multiplyScalar(s); v.y -= 0.55 * jam * 0.9;
    c.copy(st).lerp(sv, smooth(0.4, 0.8, n)).lerp(och, smooth(0.65, 0.82, n2) * 0.45).lerp(tm, Math.min(1, jam * 0.8) * 0.6 + smooth(0.6, 0.35, n2) * 0.2);
    if (d.y < -0.25) v.y = -0.25 + (d.y + 0.25) * 0.15;
  });
  const diely = [hruda.translate(0, 0, 0)];
  for (const [x, z, r, i] of [[0.165, 0.07, 0.04, 1], [-0.12, -0.11, 0.032, 2], [0.1, -0.12, 0.025, 3]]) {
    diely.push(blob(r, r * 0.7, r * 0.9, (v, c, d) => { v.multiplyScalar(1 + (fbm(d.x * 2 + i, d.y * 2, d.z * 2, 2) - 0.5) * 0.4); c.copy(st).lerp(tm, 0.3 * hash(i, 1, 2)); }, 2).translate(x, r * 0.35, z));
  }
  let g = dokonci(...diely); g = naZem(g); ao(g, 0.03, 0.4);
  return [g, stylMat({ roughness: 0.45 }, 0.5)];
}

// ---------- ZIVICA: jantarova kvapka so stekajucim hrotom, kalužou a odlesk ----------
export function modelZivica() {
  const hore = C(0xf3b83a), dole = C(0xa85a18), stred = C(0xdc8a22), odl = C(0xfff2b8);
  const farba = (v, c, d) => { c.copy(dole).lerp(stred, smooth(-0.6, 0.2, d.y)).lerp(hore, smooth(0.1, 0.9, d.y)); c.lerp(odl, smooth(0.86, 0.97, d.dot(V(-0.5, 0.65, 0.55).normalize()))); };
  const kvapka = blob(0.075, 0.075, 0.075, (v, c, d) => {
    const t = Math.max(0, d.y);
    v.x *= 1 - 0.85 * Math.pow(t, 1.3); v.z *= 1 - 0.85 * Math.pow(t, 1.3); v.y = d.y > 0 ? d.y * (1 + 1.1 * t * t) : d.y * 0.7;
    farba(v, c, d);
  }, 5).translate(0, 0.075, 0);
  const kaluz = blob(0.13, 0.022, 0.11, (v, c, d) => { v.multiplyScalar(1 + (fbm(d.x * 2 + 3, d.y, d.z * 2, 2) - 0.5) * 0.35); farba(v, c, V(d.x * 0.3, d.y * 0.4 - 0.2, d.z * 0.3)); }, 4).translate(0.0, 0.02, 0);
  const mala = blob(0.03, 0.03, 0.03, (v, c, d) => farba(v, c, d), 3).translate(0.12, 0.04, 0.05);
  let g = dokonci(kaluz, kvapka, mala); g = naZem(g);
  return [g, stylMat({ roughness: 0.12, transparent: true, opacity: 0.93 }, 0.8)];
}

// ---------- TARO: hluza s prstencami a jemnym chlpom, fialovy vrch, korienky; pecene = prasknute, ohorene ----------
export function modelTaro(pec = false) {
  const dole = C(pec ? 0x3a2414 : 0x6a4a3a), stred = C(pec ? 0x6a4228 : 0x8a6a58), hore = C(pec ? 0x8a5a38 : 0xa88aa0), ruz = C(0xe8c8d0), cierna = C(0x1e1410), krem = C(0xf0e2c8), krem2 = C(0xd8c8e0);
  const crack = V(0.65, 0.4, 0.55).normalize();
  const telo = blob(0.105, 0.095, 0.1, (v, c, d) => {
    const y = d.y, n = fbm(d.x * 3 + 2, d.y * 3, d.z * 3, 3), chlp = fbm(d.x * 40, d.y * 40, d.z * 40, 2);
    const ring = Math.sin(y * 18 + n * 3);
    v.multiplyScalar((1 + 0.03 * ring + (chlp - 0.5) * 0.05 + (n - 0.5) * 0.12) * (1 - 0.16 * smooth(0.2, 1, y)));
    c.copy(dole).lerp(stred, smooth(-0.9, -0.1, y)).lerp(hore, smooth(0.2, 0.95, y)).multiplyScalar(0.88 + 0.12 * ring * 0.5 + (chlp - 0.5) * 0.2);
    c.lerp(ruz, smooth(0.9, 0.98, y) * 0.7);
    if (pec) {
      const fl = smooth(0.88, 0.94, d.dot(crack) + (n - 0.5) * 0.1);
      v.multiplyScalar(1 + 0.07 * fl); c.lerp(cierna, smooth(0.62, 0.8, fbm(d.x * 6, d.y * 6, d.z * 6, 2)) * 0.6).lerp(Math.sin(d.x * 30) > 0 ? krem : krem2, fl);
    }
  }).translate(0, 0.095, 0);
  const diely = [telo];
  diely.push(tuba(krivka([[0, 0.17, 0], [0.005, 0.21, 0.002], [0.012, 0.24, 0]], 5), () => 0.012, 6, (P, c, u) => c.set(0x7a5a6a).lerp(C(0x4a7a3a), u)));
  for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.4; diely.push(tuba(krivka([[Math.cos(a) * 0.03, 0.01, Math.sin(a) * 0.03], [Math.cos(a) * 0.07, 0.0, Math.sin(a) * 0.07], [Math.cos(a) * 0.1, 0.012, Math.sin(a) * 0.1]], 6), u => 0.006 * (1 - 0.6 * u), 5, (P, c) => c.set(0x6a4a3a))); }
  let g = dokonci(...diely); g = naZem(g); ao(g, 0.04, 0.4);
  return [g, MAT_MATNY];
}

// ---------- TABORAK: kruh kamenov so sadzami, popolovy lôžko s zeravymi uhlikmi, tri polená opierajuce sa do stredu ----------
export function modelTaborak() {
  const diely = [];
  const sivy = C(0x8f8c86), svetly = C(0xb8b2a4), sadze = C(0x2c2622);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + 0.2, R = 0.068 + 0.012 * hash(i, 1, 2), px = Math.cos(a) * 0.19, pz = Math.sin(a) * 0.19;
    diely.push(blob(R * 1.15, R * 0.85, R, (v, c, d) => {
      const n = fbm(d.x * 1.6 + i * 7, d.y * 1.6, d.z * 1.6, 2), n2 = fbm(d.x * 9 + i, d.y * 9, d.z * 9, 2);
      v.multiplyScalar(1 + (n - 0.5) * 0.45);
      c.copy(sivy).lerp(svetly, smooth(0.4, 0.8, n2) * 0.6 + smooth(0.2, 1, d.y) * 0.25).multiplyScalar(0.8 + 0.3 * n);
      c.lerp(sadze, smooth(0.0, 0.8, -(Math.cos(a) * d.x + Math.sin(a) * d.z)) * 0.75);
      if (d.y < -0.3) v.y = -0.3 + (d.y + 0.3) * 0.2;
    }, 2).translate(px, R * 0.6, pz));
  }
  diely.push(blob(0.15, 0.02, 0.15, (v, c, d) => {
    const n = fbm(d.x * 6, d.y * 6, d.z * 6, 2);
    c.copy(sadze).lerp(C(0x5a524a), smooth(0.4, 0.7, n) * 0.5).lerp(C(0xff7a2a), smooth(0.72, 0.8, n) * 0.9 * smooth(0.0, 0.5, d.y));
  }, 3).translate(0, 0.02, 0));
  const kora = korFn({ k1: 0x4a2f1c, k2: 0x8a5a30, k3: 0x6e4829, lyko: 0xd9a868, srdce: 0x9a6030, krouzky: 26, z: 5, hrany: 8, hrb: 0.12 });
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + 0.7;
    const lg = valec(0.34, t => 0.03 * (1 - 0.1 * t), 9, 9, (v, c, t, phi, rr, rez) => {
      kora(v, c, t, phi, rr, rez);
      c.lerp(C(0x1a1512), smooth(0.55, 0.95, t) * 0.9);
      if (t > 0.6) c.lerp(C(0xff6a2a), smooth(0.72, 0.8, sum(v.x * 90, v.y * 90, v.z * 90)) * 0.7 * smooth(0.65, 0.9, t));
    });
    lg.rotateZ(-0.82).translate(-0.15, 0.03, 0).rotateY(a);
    diely.push(lg);
  }
  let g = dokonci(...diely); g = naZem(g); ao(g, 0.03, 0.3);
  return [g, MAT_STYL];
}

// ---------- LODENICA: mala maketa - dva klzaky, kanoe pod trstinovou strechou na 4 stlpoch ----------
export function modelLodenica() {
  const diely = [];
  const drevo = korFn({ k1: 0x5e3d22, k2: 0x9a6a3c, k3: 0x6e4829, lyko: 0xd9a868, srdce: 0x9a6030, krouzky: 26, z: 5, hrany: 8, hrb: 0.12 });
  for (const x of [-1, 1]) diely.push(valec(0.52, t => 0.026, 10, 6, drevo).rotateX(Math.PI / 2).translate(x * 0.06, 0.05, -0.26));
  for (const z of [-0.17, 0, 0.17]) diely.push(valec(0.42, t => 0.02, 8, 4, drevo).rotateZ(Math.PI / 2).translate(0.21, 0.018, z));
  const kan = blob(0.085, 0.06, 0.2, (v, c, d) => {
    const zn = d.z, y = d.y;
    v.x *= 1 - 0.6 * zn * zn; v.y += 0.4 * Math.pow(Math.abs(zn), 4);
    c.set(0x2f8a8a).lerp(C(0xc8a468), smooth(-0.1, 0.5, y)).lerp(C(0x8a5a30), smooth(0.85, 0.99, y) * 0.5);
    if (y > 0.26) { v.y = 0.26 + Math.pow(Math.abs(zn), 4) * 0.4; c.set(0x4a2e18); }
  }, 4).translate(0, 0.115, 0);
  diely.push(kan);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) diely.push(valec(0.27, t => 0.0155 * (1 - 0.15 * t), 8, 5, drevo).translate(x * 0.19, 0.02, z * 0.19));
  const strecha = tvar(hladka(new THREE.ConeGeometry(0.27, 0.19, 8, 10)), (v, c) => {
    const l = (v.y + 0.095) / 0.19, phi = Math.atan2(v.z, v.x), r = Math.hypot(v.x, v.z);
    const sc = 0.05 * Math.pow(Math.abs(Math.sin(phi * 4)), 1.2) * Math.pow(1 - l, 3);
    const k = 1 + 0.035 * Math.sin(l * 36) * (1 - l);
    v.x *= k; v.z *= k; v.y += 0.095 + 0.29 - sc;
    c.set(0xd8b858).lerp(C(0x8f7a32), smooth(0.0, 1, l) * 0.9).multiplyScalar(0.88 + 0.12 * Math.sin(phi * 14 + l * 8) + (r < 0.001 ? 0 : 0));
    c.multiplyScalar(0.9 + 0.1 * Math.sin(l * 36));
  });
  diely.push(strecha);
  let g = dokonci(...diely); g = naZem(g); ao(g, 0.03, 0.25);
  return [g, MAT_STYL];
}

// ---------- KRAB: oblá škrupina s hrebienkom, stopkové oči, dve klepetá s kliešťami, 6 nôh; farby parametrizovane (surový / pečený) ----------
const gulka = (R, hex) => tvar(hladka(new THREE.SphereGeometry(R, 10, 8)), (v, c) => c.set(hex));
export function modelKrab(F = {}) {
  const P = { telo: 0xc9622c, svetla: 0xe89a58, tmava: 0x8f3a1c, hrot: 0xf6d9b0, brucho: 0xe8c9a0, oko: 0xfff4d0, ...F };
  const telo = C(P.telo), sv = C(P.svetla), tm = C(P.tmava), hr = C(P.hrot), br = C(P.brucho);
  const diely = [];
  diely.push(blob(0.135, 0.06, 0.1, (v, c, d) => {
    const n = fbm(d.x * 3 + 1, d.y * 3, d.z * 3, 3), n2 = fbm(d.x * 20, d.y * 20, d.z * 20, 2), hrebien = Math.exp(-d.x * d.x * 6) * smooth(0, 1, d.y);
    v.multiplyScalar(1 + (n2 - 0.5) * 0.05 + hrebien * 0.04);
    c.copy(telo).lerp(tm, smooth(0.2, 0.9, d.y) * (0.35 + 0.4 * n)).lerp(sv, smooth(0.55, 1, Math.hypot(d.x, d.z)) * 0.55).lerp(sv, smooth(0.78, 0.9, n2) * 0.4);
    c.lerp(br, smooth(0.05, -0.4, d.y));
    if (d.y < -0.2) v.y = -0.2 + (d.y + 0.2) * 0.3;
  }, 4));
  for (const s of [-1, 1]) {
    diely.push(tuba(krivka([[s * 0.035, 0.01, -0.085], [s * 0.038, 0.035, -0.092], [s * 0.04, 0.05, -0.096]], 4), () => 0.0055, 6, (p, c) => c.copy(telo)));
    diely.push(gulka(0.015, P.oko).translate(s * 0.04, 0.056, -0.097), gulka(0.0085, 0x0a0a0a).translate(s * 0.04, 0.058, -0.109));
    diely.push(tuba(krivka([[s * 0.11, 0.025, -0.05], [s * 0.15, 0.05, -0.085], [s * 0.16, 0.055, -0.135]], 7), u => 0.017 + 0.006 * u, 7, (p, c, u) => c.copy(telo).lerp(sv, 0.2 + 0.3 * u)));
    diely.push(blob(0.036, 0.03, 0.045, (v, c, d) => { v.multiplyScalar(1 + (sum(d.x * 6, d.y * 6, d.z * 6) - 0.5) * 0.1); c.copy(telo).lerp(sv, smooth(0, 1, d.y) * 0.3 + 0.1); }, 3).translate(s * 0.158, 0.055, -0.17));
    const klieste = (pts, k) => tuba(krivka(pts, 7), u => 0.017 * (1 - 0.72 * u) + 0.003, 6, (p, c, u) => c.copy(telo).lerp(hr, smooth(0.5, 1, u) + k));
    diely.push(klieste([[s * 0.15, 0.045, -0.195], [s * 0.16, 0.04, -0.235], [s * 0.145, 0.04, -0.27]], 0));
    diely.push(klieste([[s * 0.168, 0.066, -0.19], [s * 0.182, 0.065, -0.232], [s * 0.157, 0.056, -0.268]], 0));
    for (let i = 0; i < 3; i++) {
      const z0 = -0.02 + i * 0.045;
      diely.push(tuba(krivka([[s * 0.11, 0.0, z0], [s * 0.17, 0.045, z0 + 0.01], [s * 0.215, 0.02, z0 + 0.02], [s * 0.245, -0.035, z0 + 0.03]], 7), u => 0.0095 * (1 - 0.55 * u), 5, (p, c, u) => c.copy(telo).lerp(tm, 0.25).lerp(hr, smooth(0.8, 1, u) * 0.6)));
    }
  }
  let g = dokonci(...diely); g.scale(0.85, 0.85, 0.85); g = naZem(g); ao(g, 0.02, 0.25);
  return [g, stylMat({ roughness: 0.42 }, 0.6)];
}

// ---------- KOKOSOVA VODA: otvoreny kokos (odrezany vrch, biela dužina, voda) so slamkou ----------
export function modelKokosovaVoda() {
  const cy = 0.17, a = 0.15, b = 0.17, cut = cy + 0.08, thc = Math.acos(-(cut - cy) / b);
  const pr = [];
  for (let k = 0; k <= 16; k++) { const th = k / 16 * thc; pr.push([a * Math.sin(th), cy - b * Math.cos(th)]); }
  pr.push([0.118, cut + 0.004], [0.105, cut + 0.004], [0.1, cut - 0.02], [0.098, cut - 0.032], [0.096, cut - 0.034], [0.06, cut - 0.034], [0.03, cut - 0.034], [0, cut - 0.034]);
  const tmava = C(0x3a200c), svetla = C(0xa8743f), hrany = C(0xb98552), flesh = C(0xf6f0e0), flesh2 = C(0xe4d6b8), vod = C(0x6fd0e8), vod2 = C(0xaaf0f4);
  let telo = tvar(hladka(new THREE.LatheGeometry(pr.map(p => new THREE.Vector2(p[0], p[1])), 30)), (v, c) => {
    const r = Math.hypot(v.x, v.z), phi = Math.atan2(v.z, v.x);
    if (Math.abs(v.y - (cut - 0.034)) < 0.002 && r < 0.097) { c.copy(vod).lerp(vod2, smooth(0.07, 0.0, r) * 0.7 + 0.1 * Math.sin(phi * 3)); return; }
    if (v.y > cut - 0.036 && r < 0.125) { c.copy(flesh).lerp(flesh2, smooth(cut + 0.004, cut - 0.03, v.y) * 0.8); return; }
    const hrana = Math.pow(0.5 + 0.5 * Math.cos(3 * phi), 10), vl = fbm(v.x * 55, v.y * 6, v.z * 55, 3), y = (v.y - cy) / b;
    const s = 1 + hrana * 0.08 + (vl - 0.5) * 0.05; v.x *= s; v.z *= s;
    c.copy(tmava).lerp(svetla, smooth(0.3, 0.75, vl)).lerp(hrany, hrana * 0.6);
    c.multiplyScalar(0.7 + 0.3 * smooth(-1, 0.3, y));
  });
  const slamka = tuba(krivka([[0.01, cut - 0.03, 0.0], [0.05, cut + 0.08, 0.02], [0.09, cut + 0.18, 0.03]], 8), () => 0.0075, 6, (p, c, u) => c.copy(Math.sin(u * 46) > 0 ? C(0xf2f0e0) : C(0xe85a7a)));
  let g = dokonci(telo, slamka); g = naZem(g); ao(g, 0.07, 0.4);
  return [g, MAT_STYL];
}

// ---------- pecena / susena ryba = modelRyba v inych farbach a trochu splostena ----------
export function modelRybaIna(farby, plocha = 0.8) {
  const [g0] = modelRyba(farby);
  g0.scale(1, plocha, 1); const g = naZem(g0);
  return [g, MAT_STYL];
}

// ---------- SUSENE OVOCIE: zvrasknute slivky s cukrom, platky sušeného manga, kolieska ananásu ----------
export function modelSusOvocie() {
  const diely = [];
  const sl = [[0, 0, 0.055, 1], [0.1, 0.035, 0.05, 2], [-0.075, 0.07, 0.045, 3]];
  for (const [x, z, R, i] of sl) diely.push(blob(R * 1.05, R * 0.85, R, (v, c, d) => {
    const n = fbm(d.x * 7 + i, d.y * 7, d.z * 7, 2), zv = Math.sin(d.x * 13 + n * 5) * Math.sin(d.y * 11 + d.z * 6 + n * 4);
    v.multiplyScalar(1 + 0.07 * zv + (n - 0.5) * 0.1);
    c.copy(C(0x5a2f3e)).lerp(C(0x8a4a58), smooth(0.2, 0.9, zv * 0.5 + 0.5) * 0.7).lerp(C(0xb87a4a), smooth(0.6, 0.9, n) * 0.4);
    c.lerp(C(0xe8d8c8), smooth(0.8, 0.9, sum(d.x * 30 + i, d.y * 30, d.z * 30)) * 0.5);
  }, 3).translate(x, R * 0.75, z));
  const platok = (x, z, ry, sklon, hex, hex2) => tvar(hladka(new THREE.CylinderGeometry(0.052, 0.052, 0.012, 20, 1)), (v, c) => {
    const r = Math.hypot(v.x, v.z), phi = Math.atan2(v.z, v.x), w = 1 + 0.08 * Math.sin(phi * 5 + ry) + 0.04 * Math.sin(phi * 9);
    v.x *= w; v.z *= w; v.y += 0.002 * Math.sin(phi * 3 + ry) * r * 20;
    c.set(hex).lerp(C(hex2), smooth(0.02, 0.055, r) * 0.7).multiplyScalar(0.88 + 0.12 * Math.sin(phi * 22) * Math.sin(r * 90));
  }).rotateZ(sklon).translate(x, 0.016, z);
  diely.push(platok(-0.1, -0.07, 0.5, 0.0, 0xe08a22, 0xf4bc4c), platok(0.07, -0.1, 1.6, 0.42, 0xd67a1c, 0xf0b040));
  diely.push(tvar(hladka(new THREE.TorusGeometry(0.048, 0.012, 8, 20)), (v, c) => c.set(0xe8c040).lerp(C(0xc8962a), smooth(0, 1, Math.sin(Math.atan2(v.y, v.x) * 6) * 0.5 + 0.5) * 0.4)).scale(1, 1, 0.8).rotateX(Math.PI / 2).translate(0.0, 0.012, 0.13));
  let g = dokonci(...diely); g = naZem(g); ao(g, 0.03, 0.4);
  return [g, MAT_MATNY];
}

// =====================================================================================
// MORE
// =====================================================================================
// ---------- KORAL: vetvovitý (jelení paroh) koral na podstavci, svetlejšie konce, drobné polypy ----------
export function modelKoral() {
  const diely = [], roz = C(0xf2678a), tip = C(0xffb4b0), bod = C(0xfff0e8), tm = C(0xc43a64);
  diely.push(blob(0.1, 0.03, 0.09, (v, c, d) => { v.multiplyScalar(1 + (fbm(d.x * 2 + 4, d.y, d.z * 2, 2) - 0.5) * 0.3); c.set(0xf0c8c4).lerp(C(0xd8a0a8), smooth(0.4, 0.8, fbm(d.x * 8, d.y * 8, d.z * 8, 2)) * 0.5); }, 3).translate(0, 0.02, 0));
  const vetva = (zac, smer, dl, r, h, id) => {
    const kon = zac.clone().addScaledVector(smer, dl), st = zac.clone().addScaledVector(smer, dl * 0.5).add(V((hash(id, 1, 5) - 0.5) * dl * 0.35, 0, (hash(id, 2, 5) - 0.5) * dl * 0.35));
    diely.push(tuba(krivka([[zac.x, zac.y, zac.z], [st.x, st.y, st.z], [kon.x, kon.y, kon.z]], 5), u => r * (1 - 0.5 * u), 6, (p, c, u) => {
      c.copy(roz).lerp(tip, Math.pow(u, 1.4) * (0.5 + 0.2 * (2 - h))).lerp(tm, smooth(0.0, 0.3, 0.3 - u) * 0.3);
      c.lerp(bod, smooth(0.8, 0.9, sum(p.x * 80, p.y * 80, p.z * 80)) * 0.5);
    }));
    if (h > 0) for (let i = 0; i < (h === 2 ? 2 : 2); i++) {
      const os = V(hash(id, i, 9) - 0.5, hash(id, i, 11) - 0.5, hash(id, i, 13) - 0.5).cross(smer).normalize();
      const d = smer.clone().applyAxisAngle(os, (i ? 1 : -1) * (0.5 + 0.3 * hash(id, i, 2))); d.y += 0.3; d.normalize();
      vetva(kon, d, dl * 0.76, r * 0.56, h - 1, id * 3 + i + 1);
    }
  };
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.4; vetva(V(Math.cos(a) * 0.035, 0.03, Math.sin(a) * 0.035), V(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35).normalize(), 0.13, 0.03, 2, i * 7 + 1); }
  let g = dokonci(...diely); g = naZem(g); ao(g, 0.04, 0.3);
  return [g, MAT_STYL];
}

// ---------- PERLA: perleťova guľa s ruzovo-tyrkysovym prelivom a odleskom ----------
export function modelPerla() {
  const R = 0.06, zakl = C(0xf4f0ee), ruz = C(0xf8c8de), tyr = C(0xbfe8f0), zlt = C(0xfff0c8);
  let g = tvar(hladka(new THREE.SphereGeometry(R, 28, 20)), (v, c) => {
    const d = v.clone().normalize(), n = fbm(d.x * 4, d.y * 4, d.z * 4, 2);
    c.copy(zakl).lerp(ruz, smooth(0.0, 0.9, d.dot(V(-0.6, 0.5, 0.6).normalize()) + n * 0.4) * 0.65).lerp(tyr, smooth(0.1, 0.9, d.dot(V(0.7, -0.4, -0.3).normalize()) + n * 0.3) * 0.6).lerp(zlt, smooth(0.3, 0.9, d.y) * 0.3);
    c.lerp(C(0xffffff), smooth(0.93, 0.99, d.dot(V(-0.45, 0.65, 0.6).normalize())) * 0.85);
  });
  g = naZem(g);
  return [dokonci(g), stylMat({ roughness: 0.14, metalness: 0.15 }, 0.9)];
}

// ---------- HVIEZDICA: morska hviezdica, 5 ramien s hrbolcami v radoch, zdvihnute spicky, svetly stred ----------
export function modelHviezdica() {
  const R0 = 0.16, ram = a => Math.pow(Math.abs(Math.cos(2.5 * a)), 2.4), Rst = a => 0.38 + 0.62 * ram(a);
  const geo = new ParametricGeometry((u, w, t) => {
    const a = w * Math.PI * 2, pol = u < 0.5, rho = pol ? u * 2 : (1 - u) * 2, sg = pol ? -1 : 1, am = ram(a), r = rho * R0 * Rst(a);
    const T = 0.03 * (0.55 + 0.45 * am) * Math.pow(Math.max(0, 1 - Math.pow(rho, 2.2)), 0.6) + 0.016 * Math.exp(-Math.pow(rho / 0.3, 2));
    t.set(Math.cos(a) * r, sg * T * (sg > 0 ? 1 : 0.55) + 0.022 * Math.pow(rho, 3) * am, Math.sin(a) * r);
  }, 22, 70);
  const vrch = C(0xe8742c), svet = C(0xf8a85a), stred = C(0xf8d49a), bodky = C(0xb83a1a), spod = C(0xf6c890), zil = C(0xd89a60);
  let g = tvar(hladka(geo), (v, c) => {
    const a = Math.atan2(v.z, v.x), r = Math.hypot(v.x, v.z), rho = Math.min(1, r / (R0 * Rst(a))), am = ram(a);
    if (v.y < 0.022 * Math.pow(rho, 3) * am - 0.0004 && rho > 0.01) { c.copy(spod).lerp(zil, smooth(0.9, 1, Math.abs(Math.sin(a * 2.5))) * smooth(0.1, 0.5, rho) * 0.6); return; }
    const bd = smooth(0.6, 0.9, Math.sin(rho * 34) * Math.sin(a * 22)) * smooth(0.12, 0.3, rho) * (0.4 + 0.6 * am);
    v.y += 0.004 * bd;
    c.copy(vrch).lerp(svet, smooth(0.2, 1, rho) * 0.5 + smooth(0.0, 0.5, am) * 0.2).lerp(bodky, bd * 0.75).lerp(stred, smooth(0.28, 0.06, rho) * 0.8);
    c.lerp(C(0xfff0d0), smooth(0.07, 0.04, Math.hypot(v.x - 0.03, v.z - 0.02)) * 0.8);
  });
  g = naZem(g); ao(g, 0.015, 0.3);
  return [dokonci(g), stylMat({ roughness: 0.55, side: THREE.DoubleSide }, 0.6)];
}

// ---------- RIASA: 4 vlnite, zvlnene pasy (kelp) s plavákmi a uchytkou ----------
export function modelRiasa() {
  const diely = [], dl = [0.34, 0.28, 0.31, 0.22], dz = C(0x2e6a24), sv = C(0x8ab83a), hn = C(0x9a8a2e);
  for (let i = 0; i < 4; i++) {
    const a = (i - 1.5) * 0.55 + 0.1, L = dl[i], os = [];
    for (let k = 0; k <= 23; k++) {
      const u = k / 23, w = Math.sin(u * 9 + i) * 0.014;
      os.push(V(Math.cos(a) * L * u - Math.sin(a) * w, 0.02 + 0.05 * Math.sin(Math.PI * u * 0.8) * (0.5 + 0.5 * hash(i, 2, 1)), Math.sin(a) * L * u + Math.cos(a) * w));
    }
    diely.push(plocha(os, u => 0.034 * Math.pow(Math.sin(Math.PI * (0.08 + 0.92 * u)), 0.5) + 0.004, (p, c, u, e) => {
      p.y += 0.007 * Math.sin(u * 26 + e * 2.5) * Math.abs(e);
      c.copy(dz).lerp(sv, u * 0.7 + (1 - Math.abs(e)) * 0.15).lerp(hn, smooth(0.8, 1, u) * 0.5).multiplyScalar(0.9 + 0.1 * Math.sin(u * 60 + i));
    }, 0.15, [-1, -0.5, 0, 0.5, 1]));
    if (i < 2) for (const u of [0.28, 0.5]) { const q = os[Math.round(u * 23)]; diely.push(blob(0.013, 0.013, 0.013, (v, c) => c.set(0xb8a43a).lerp(C(0xe0d070), smooth(0, 1, v.y) * 0.5), 2).translate(q.x, q.y + 0.017, q.z)); }
  }
  diely.push(blob(0.035, 0.02, 0.035, (v, c, d) => { v.multiplyScalar(1 + (sum(d.x * 6, d.y * 6, d.z * 6) - 0.5) * 0.3); c.set(0x5a4a2a).lerp(C(0x3a4a22), 0.3); }, 3).translate(0, 0.018, 0));
  let g = dokonci(...diely); g = naZem(g);
  return [g, MAT_LIST];
}

// ---------- USTRICA: otvorena ustrica - spodna misa, horna skrupina odklopena, perletovy vnutro, telo so zamatovym okrajom ----------
function skoralupa(vnutro, hore) {
  const sx = 0.12, sy = 0.045, sz = 0.09, sc = vnutro ? 0.9 : 1;
  const von = C(0x8c8579), sv = C(0xb7ae96), riasy = C(0x5a6a3a), tm = C(0x6a6458), okraj = C(0xd8d0b8), perla = C(0xe8e2d8), perla2 = C(0xb4c6cc);
  let g = tvar(hladka(new THREE.SphereGeometry(1, 22, 9, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), (v, c) => {
    const phi = Math.atan2(v.z, v.x), rho = Math.hypot(v.x, v.z), n = fbm(v.x * 2.5 + 3, v.y * 2.5, v.z * 2.5, 3);
    const e = smooth(-0.4, 0, v.y), s = (1 + 0.05 * e * Math.sin(phi * 13 + n * 4)) * (1 + 0.03 * Math.sin(-v.y * 22 + n * 3));
    const zf = 0.55 + 0.45 * smooth(-1, 0.5, v.x);
    if (vnutro) c.copy(perla).lerp(perla2, smooth(0.3, 0.8, n) * 0.7 + smooth(0, -1, v.y) * 0.2);
    else {
      c.copy(von).lerp(sv, (Math.sin(-v.y * 26 + n * 4) * 0.5 + 0.5) * 0.55).lerp(riasy, smooth(0.62, 0.8, n) * 0.5).lerp(tm, smooth(-0.5, -1, v.y) * 0.5).lerp(okraj, smooth(-0.1, 0, v.y) * 0.7);
    }
    v.set(v.x * sx * s * sc, v.y * sy * sc * (vnutro ? 0.85 : 1), v.z * sz * zf * s * sc);
  });
  if (hore) { g.rotateX(Math.PI); g.translate(sx, 0, 0).rotateZ(0.38).translate(-sx, 0.006, 0); }
  return g;
}
export function modelUstrica() {
  const telo = blob(0.1, 0.022, 0.062, (v, c, d) => {
    const n = fbm(d.x * 5, d.y * 5, d.z * 5, 2), r = Math.hypot(d.x, d.z);
    v.multiplyScalar(1 + (n - 0.5) * 0.15);
    c.set(0xe0d8c0).lerp(C(0xc4b8a0), n * 0.6).lerp(C(0x4a4a3a), smooth(0.78, 0.98, r) * 0.85);
  }, 3).translate(0.005, -0.016, 0);
  let g = dokonci(skoralupa(false, false), skoralupa(true, false).translate(0, 0.002, 0), telo, skoralupa(false, true), skoralupa(true, true));
  g = naZem(g);
  return [g, stylMat({ roughness: 0.45, side: THREE.DoubleSide }, 0.6)];
}

// ---------- ZLATA MINCA: dve mince (jedna naklonena) s reliefom slnka, zdvihnutym okrajom, patinou ----------
function minca() {
  const pr = [[0, 0], [0.07, 0], [0.079, 0.002], [0.08, 0.006], [0.08, 0.012], [0.077, 0.015], [0.071, 0.0155], [0.067, 0.0125], [0.058, 0.0118], [0.045, 0.0115], [0.03, 0.0115], [0.015, 0.0115], [0, 0.0116]];
  const zl = C(0xe3b81f), sv = C(0xf8dc66), tm = C(0xa07810), pat = C(0x7a8a3a);
  return tvar(hladka(new THREE.LatheGeometry(pr.map(p => new THREE.Vector2(p[0], p[1])), 44)), (v, c) => {
    const r = Math.hypot(v.x, v.z), phi = Math.atan2(v.z, v.x), n = fbm(v.x * 30, v.y * 30, v.z * 30, 3);
    c.copy(zl).lerp(sv, smooth(0.5, 0.9, n) * 0.6);
    if (v.y > 0.011 && r < 0.062) {
      const ray = Math.pow(Math.abs(Math.sin(phi * 4)), 3) * smooth(0.012, 0.03, r) * smooth(0.062, 0.05, r), disk = smooth(0.016, 0.012, r);
      v.y += 0.0012 * (ray + disk); c.lerp(sv, (ray + disk) * 0.6).lerp(tm, (1 - ray - disk) * 0.25 * smooth(0.02, 0.05, r));
    }
    if (r > 0.066 && v.y > 0.01) c.lerp(sv, 0.35).multiplyScalar(0.92 + 0.08 * Math.sin(phi * 60));
    c.lerp(pat, smooth(0.66, 0.78, fbm(v.x * 14, v.y * 14, v.z * 14, 3)) * 0.35);
  });
}
export function modelMinca() {
  let g = dokonci(minca(), minca().rotateZ(0.42).rotateY(0.7).translate(0.075, 0.012, 0.045));
  g = naZem(g);
  return [g, stylMat({ roughness: 0.32, metalness: 0.3 }, 0.8)];
}

// ---------- STARY KOMPAS: mosadzne puzdro s ciferníkom (znacky, ruza vetrov), cervena ihla, ouško na retiazku ----------
export function modelKompas() {
  const bras = C(0xb88a2c), bras2 = C(0xe8c060), pat = C(0x5a7a4a), kremy = C(0xe8dcc0), tm = C(0x3a2a1a), cerv = C(0x8a2a2a);
  const pr = [[0, 0], [0.08, 0], [0.094, 0.006], [0.1, 0.016], [0.1, 0.034], [0.095, 0.04], [0.084, 0.04], [0.081, 0.03]];
  for (let k = 0; k <= 8; k++) pr.push([0.078 * (1 - k / 8), 0.0285]);
  const puzdro = tvar(hladka(new THREE.LatheGeometry(pr.map(p => new THREE.Vector2(p[0], p[1])), 48)), (v, c) => {
    const r = Math.hypot(v.x, v.z), phi = Math.atan2(v.z, v.x), n = fbm(v.x * 14, v.y * 14, v.z * 14, 3);
    if (Math.abs(v.y - 0.0285) < 0.0006 && r < 0.0785) {
      const star = Math.pow(Math.abs(Math.cos(2 * phi)), 12), diag = Math.pow(Math.abs(Math.cos(2 * (phi - Math.PI / 4))), 12) * 0.55, hv = Math.max(star, diag);
      c.copy(kremy).multiplyScalar(0.92 + 0.08 * n);
      if (r > 0.062) c.lerp(tm, smooth(0.7, 0.85, Math.sin(phi * 36)) * 0.8);
      if (r > 0.0585 && r < 0.0645) c.lerp(tm, 0.5);
      if (r < 0.058) c.lerp(cerv, smooth(0.05, 0.4, hv) * smooth(0.058 * (0.15 + 0.85 * hv) + 0.004, 0.058 * (0.15 + 0.85 * hv) - 0.004, r) * 0.9);
      return;
    }
    c.copy(bras).lerp(bras2, smooth(0.5, 0.9, n) * 0.5 + smooth(0.015, 0.034, v.y) * 0.2).lerp(pat, smooth(0.62, 0.75, fbm(v.x * 9 + 2, v.y * 9, v.z * 9, 3)) * 0.45 * smooth(0.04, 0.0, v.y + 0.02));
  });
  const ihla = (sg, hex) => { const s = new THREE.Shape(); s.moveTo(-0.011, 0); s.lineTo(0, 0.062 * sg); s.lineTo(0.011, 0); s.closePath(); return jedn(new THREE.ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: false }).rotateX(-Math.PI / 2).rotateY(0.6).translate(0, 0.0295, 0), hex); };
  const os = tvar(hladka(new THREE.CylinderGeometry(0.008, 0.009, 0.012, 10)), (v, c) => c.copy(bras2)).translate(0, 0.0345, 0);
  const ucho = lano(0.024, 0.0065, 0xb88a2c, 14).translate(0.118, 0.026, 0);
  let g = dokonci(puzdro, ihla(1, 0xc82a22), ihla(-1, 0xe8e4d8), os, ucho); g = naZem(g);
  return [g, stylMat({ roughness: 0.35, metalness: 0.25 }, 0.8)];
}
const jedn = (g, hex) => { const c = C(hex); return tvar(g, (v, k) => k.copy(c)); };

// ---------- LANO: zvinute lano zo skrutenych prameňov (3 závity do špirály) s volnym koncom ----------
export function modelLano() {
  const pts = [];
  for (let i = 0; i <= 100; i++) { const t = i / 100, a = t * Math.PI * 2 * 3.1; pts.push([Math.cos(a) * (0.125 - 0.022 * t), 0.03 + 0.062 * t, Math.sin(a) * (0.125 - 0.022 * t)]); }
  const sv = C(0xc4a868), tm = C(0x7a6238), cc = C(0xa88a50);
  const farba = (p, c, u, phi) => { const tw = Math.sin(phi + u * 220) * 0.5 + 0.5; c.copy(sv).lerp(tm, smooth(0.35, 0.95, tw)).lerp(cc, 0.15 * Math.sin(u * 40)); };
  const telo = tuba(krivka(pts, 100), () => 0.026, 7, farba);
  const posl = pts[pts.length - 1], tail = tuba(krivka([posl, [posl[0] + 0.05, 0.1, posl[2] - 0.02], [0.2, 0.07, -0.03], [0.26, 0.035, 0.0]], 14), u => 0.026 * (1 - 0.35 * u), 7, (p, c, u, phi) => { farba(p, c, u * 0.3, phi); c.lerp(C(0xe6d2a0), smooth(0.85, 1, u) * 0.8); });
  let g = dokonci(telo, tail); g = naZem(g); ao(g, 0.04, 0.35);
  return [g, MAT_MATNY];
}
