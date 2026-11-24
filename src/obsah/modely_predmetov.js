// Detailne stylizovane modely predmetov (pomocne funkcie v styl.js).
// Kazda funkcia vrati [geometria, material] - rovnaky format ako `model` v predmet(...).
import * as THREE from 'three';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
import { hladka, tvar, naZem, ao, dokonci, fbm, sum, smooth, MAT_STYL, stylMat } from './styl.js';

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
