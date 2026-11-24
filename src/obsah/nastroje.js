// Nastroje: sekera, krompac, noz, kyj, ostep (+ vylepsene verzie).
// nastroj: { typ, sila, ucinnost: { drevo, kamen, list }, trvanlivost }  -> poskodenie = sila * ucinnost[material zdroja]
// drzanie: { poz, rot } - ako sa drzi v pravej ruke (pociatok skupiny = dlan, ruka dole -y, postava hlada -z)
// model: [geometria, material] - lezi na zemi (dlzka pozdlz x, hlava na -x), v ruke ho otoci drzanie.rot
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { predmet } from './predmety.js';
import { ik } from '../ikony.js';
import { hladka, tvar, dokonci, lano, fbm, sum, smooth, stylMat } from './styl.js';
import { krivka, tuba, valec, korFn, blob, fasety } from './modely_predmetov.js';

const C = { drevo: 0x7a5535, tmavy: 0x5a3d25, bambus: 0xc9b266, vlakno: 0xcfb87c, kamen: 0x8f8c86, kamen2: 0xb9b6ae, musla: 0xf1d2bf, ostrie: 0xd8d4c8, obsidian: 0x3d4248 };
const MAT = stylMat({ roughness: 0.75 });

// zafarbi geometriu (vertex colors) a pripravi ju na spojenie
const farba = (g, hex) => {
  g = g.index ? g.toNonIndexed() : g;
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
};
// zakladne diely (postavene na stojato: rukovat od y = 0 nahor, hlava navrchu)
const rukovat = (dlzka, r, hex, hore = r) => farba(new THREE.CylinderGeometry(hore, r, dlzka, 6).translate(0, dlzka / 2, 0), hex);
const omotaj = (y, r = 0.04) => farba(new THREE.TorusGeometry(r, 0.013, 5, 10).rotateX(Math.PI / 2).translate(0, y, 0), C.vlakno);
const kamenHlava = (x, y, rx, ry, rz, hex) => farba(new THREE.IcosahedronGeometry(1, 0).scale(rx, ry, rz).translate(x, y, 0), hex);

// hotovy model: spoji diely, polozi na bok (dlzka pozdlz x, hlava na -x) a zdvihne nad zem
const YZEM = 0.05;
function zloz(diely) {
  return [mergeGeometries(diely).rotateZ(Math.PI / 2).translate(0, YZEM, 0), MAT];
}
// drzanie: uchop v mieste g (vzdialenost od konca rukovate) sa ma dostat do dlane, hlava hore a mierne dopredu (-z), cepel dopredu
function drzanie(g, sklon = 0.5) {
  const rot = new THREE.Euler(-sklon, Math.PI / 2, -Math.PI / 2);
  const v = new THREE.Vector3(-g, YZEM, 0).applyEuler(rot);
  const z = x => Math.round(x * 1000) / 1000;
  return { poz: [z(-v.x), z(-v.y), z(-v.z)], rot: [rot.x, rot.y, rot.z] };
}

// ---------- modely ----------
function sekera(hlavaHex, ostrieHex, sirka = 1) {
  const L = 0.62, YH = L - 0.06;
  // rukovat: mierne prehnuta, s pozdlznymi letokruhmi a guľkou na konci
  const drevo = new THREE.Color(C.drevo), svetle = new THREE.Color(0xb98a55), tmave = new THREE.Color(0x4a2f1a);
  const ruk = tvar(hladka(new THREE.CylinderGeometry(0.023, 0.028, L, 12, 18).translate(0, L / 2, 0)), (v, c) => {
    v.x += 0.014 * Math.sin(Math.PI * v.y / L);   // rovnaky ohyb ako ohyb(y) nizsie
    const n = fbm(v.x * 90, v.y * 4, v.z * 90, 3);
    c.copy(drevo).lerp(svetle, smooth(0.45, 0.8, n)).lerp(tmave, smooth(0.35, 0.15, n) * 0.6);
  });
  const hlavicka = tvar(hladka(new THREE.SphereGeometry(0.032, 12, 8)).scale(1, 0.7, 1), (v, c) => c.copy(drevo).multiplyScalar(0.85));
  // kamenna hlava: klin (tenky k ostriu na +x), nerovny povrch, vybrusene svetlejsie ostrie
  const H = new THREE.Color(hlavaHex), O = new THREE.Color(ostrieHex);
  let hlava = tvar(hladka(new THREE.IcosahedronGeometry(1, 3)), (v, c) => {
    const x = v.x, n = fbm(v.x * 2.2 + 5, v.y * 2.2, v.z * 2.2, 3), n2 = fbm(v.x * 7, v.y * 7, v.z * 7, 2);
    const hrubka = 1 - 0.85 * smooth(-0.4, 1, x);                     // klin: tenky k ostriu
    const vejar = 0.4 + 0.8 * smooth(-1, 0.9, x);                     // ostrie vyssie ako tylo
    const s = 1 + (n - 0.5) * 0.25 + (n2 - 0.5) * 0.12;
    v.set(v.x * 0.13 * sirka * s, v.y * 0.09 * vejar * s, v.z * 0.04 * hrubka * s);
    v.x += 0.075 * sirka; v.y += YH;
    c.copy(H).multiplyScalar(0.62 + n * 0.5 + (n2 - 0.5) * 0.2).lerp(O, smooth(0.35, 0.8, x) * 0.9);
    c.lerp(new THREE.Color(0xffffff), smooth(0.8, 0.97, x) * 0.4);   // vybrusena hrana
  });
  hlava = hlava.toNonIndexed(); hlava.computeVertexNormals();      // ploche plosky = otlkany kamen
  // vlakno: dve krizom cez hlavu + omotavky pod hlavou a na uchope
  const vl = C.vlakno, ohyb = y => 0.014 * Math.sin(Math.PI * y / L);
  const dielyLana = [
    ...[-1, 1].map(i => lano(0.042, 0.009, vl).scale(1, 1, 1.25).rotateX(Math.PI / 2).rotateZ(i * 0.65).translate(0.01, YH, 0)),
    ...[0, 1, 2].map(i => lano(0.03, 0.0075, vl).rotateX(Math.PI / 2).translate(ohyb(YH - 0.075 - i * 0.016), YH - 0.075 - i * 0.016, 0)),
    ...[0, 1, 2, 3, 4, 5].map(i => lano(0.03, 0.007, 0x6a4a30, 18).rotateX(Math.PI / 2).translate(ohyb(0.1 + i * 0.014), 0.1 + i * 0.014, 0)),
  ];
  return [dokonci(ruk, hlavicka, hlava, ...dielyLana).rotateZ(Math.PI / 2).translate(0, YZEM, 0), MAT];
}
// ---- detailne diely nastrojov (vsetko stoji hlavou hore od y = 0; zlozD ich polozi na bok) ----
const zlozD = diely => [dokonci(...diely).rotateZ(Math.PI / 2).translate(0, YZEM, 0), MAT];
const Cc = hex => new THREE.Color(hex);
// rukovat: mierne prehnuta, s pozdlznymi letokruhmi (ako pri sekere)
function drevenaRuk(L, r0, r1, hex, ohyb = 0.012) {
  const d = Cc(hex), sv = d.clone().lerp(Cc(0xe0b878), 0.35), tm = d.clone().multiplyScalar(0.55);
  return tvar(hladka(new THREE.CylinderGeometry(r1, r0, L, 12, 18).translate(0, L / 2, 0)), (v, c) => {
    v.x += ohyb * Math.sin(Math.PI * v.y / L);
    const n = fbm(v.x * 90, v.y * 4, v.z * 90, 3);
    c.copy(d).lerp(sv, smooth(0.45, 0.8, n)).lerp(tm, smooth(0.35, 0.15, n) * 0.6);
  });
}
// omotavka z lana (vodorovny kruh okolo rukovate vo vyske y)
const ovin = (y, r, x = 0, hex = C.vlakno) => lano(r, 0.0085, hex).rotateX(Math.PI / 2).translate(x, y, 0);
// cepel / hrot: otlkany kamenny listovity tvar (hranate plochy), vybrusene svetlejsie ostrie; zakriv = ohnutie cepele do strany
function cepel(dl, sirka, hrub, hex, zakriv = 0) {
  const W = sirka, s = new THREE.Shape();
  s.moveTo(-0.4 * W, 0); s.quadraticCurveTo(-1.05 * W, 0.35 * dl, -0.5 * W, 0.8 * dl); s.quadraticCurveTo(-0.2 * W, 0.95 * dl, 0, dl);
  s.quadraticCurveTo(0.2 * W, 0.95 * dl, 0.5 * W, 0.8 * dl); s.quadraticCurveTo(1.05 * W, 0.35 * dl, 0.4 * W, 0); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: hrub, bevelEnabled: true, bevelThickness: hrub * 0.7, bevelSize: hrub * 0.7, bevelSegments: 2, curveSegments: 8 }).translate(0, 0, -hrub / 2);
  const H = Cc(hex), svetla = H.clone().lerp(Cc(0xffffff), 0.35), tm = H.clone().multiplyScalar(0.65);
  tvar(g, (v, c) => {
    const t = v.y / dl, n = fbm(v.x * 60, v.y * 40, 3, 2), n2 = fbm(v.x * 18 + 4, v.y * 18, 1, 2);
    v.z += (n - 0.5) * hrub * 0.8; v.x += zakriv * t * t;
    c.copy(H).multiplyScalar(0.7 + n2 * 0.5).lerp(tm, smooth(0.55, 0.3, n) * 0.5).lerp(svetla, smooth(0.45, 1, t) * 0.5 + smooth(0.5, 0.0, Math.abs(v.z) / hrub) * 0.15);
  });
  return g.rotateY(Math.PI / 2);
}

// ---------- krompac: zakriveny kamenny dvojhrot na prehnutej rukovati, previazany lanom ----------
function krompac(hlavaHex, rukovatHex) {
  const L = 0.7, Lr = L + 0.03, ohyb = 0.014, H = Cc(hlavaHex), svetla = H.clone().lerp(Cc(0xffffff), 0.3);
  const ruk = drevenaRuk(Lr, 0.03, 0.026, rukovatHex, ohyb), ox = y => ohyb * Math.sin(Math.PI * y / Lr);
  const bd = krivka(Array.from({ length: 9 }, (_, i) => { const s = i / 8; return [-0.34 + 0.68 * s, L + 0.02 - 0.11 * Math.pow(Math.abs(2 * s - 1), 1.8), 0]; }), 18);
  const hlava = tuba(bd, u => 0.006 + 0.04 * (1 - Math.pow(Math.abs(2 * u - 1), 1.3)), 5, (p, c, u) => {
    const n = fbm(p.x * 25, p.y * 25, p.z * 25, 2), d = Math.abs(2 * u - 1);
    c.copy(H).multiplyScalar(0.7 + n * 0.55).lerp(svetla, smooth(0.5, 1, d) * 0.55);
  }, () => [1.0, 0.85]).toNonIndexed();
  return zlozD([ruk, hlava, ovin(L - 0.045, 0.05, ox(L - 0.045)), ovin(L - 0.028, 0.05, ox(L - 0.028)), ovin(L + 0.06, 0.05, ox(L + 0.06)), ovin(L + 0.077, 0.05, ox(L + 0.077)),
    ...[0, 1, 2, 3].map(i => ovin(0.1 + i * 0.016, 0.036, ox(0.1 + i * 0.016), 0x6a4a30))]);
}
// ---------- noz / macheta / mec: otlkana cepel zasadena do prehnutej rukovati, previazana ----------
function noz(dlzkaCepele, cepelHex, rukovatHex) {
  const L = 0.26, ohyb = 0.006, ox = y => ohyb * Math.sin(Math.PI * y / L), sirka = dlzkaCepele < 0.3 ? 0.05 : 0.043, zakr = dlzkaCepele > 0.4 && dlzkaCepele < 0.6 ? 0.03 : 0;
  return zlozD([drevenaRuk(L, 0.028, 0.024, rukovatHex, ohyb), cepel(dlzkaCepele + 0.03, sirka, 0.012, cepelHex, zakr).translate(0, L - 0.03, 0),
    lano(0.014, 0.0075, 0x7a5a38, 12).rotateX(Math.PI / 2).translate(ox(0), 0.0, 0),
    ...[0, 1, 2].map(i => ovin(L - 0.04 + i * 0.016, 0.034, ox(L - 0.04 + i * 0.016))), ...[0, 1, 2, 3].map(i => ovin(0.04 + i * 0.015, 0.033, ox(0.04 + i * 0.015), 0x6a4a30))]);
}
// ---------- kyj: hrbolata drevena palica so zosilnenou hlavou, kamennymi hrotmi a omotanou rukovatou ----------
function kyj() {
  const L = 0.81, rf = t => (0.028 + 0.036 * smooth(0.4, 0.9, t)) * (1 - 0.45 * smooth(0.94, 1, t));
  const kor = korFn({ k1: 0x5a3a20, k2: 0x9a6a3c, k3: 0x6a4428, lyko: 0xd9a868, srdce: 0x9a6030, krouzky: 30, z: 3, hrany: 7, hrb: 0.22 });
  const telo = valec(L, rf, 16, 36, (v, c, t, phi, rr, rez) => { kor(v, c, t, phi, rr, rez); if (!rez && t > 0.5) { const b = fbm(v.x * 40, v.y * 40, v.z * 40, 2); v.x *= 1 + (b - 0.5) * 0.12; v.z *= 1 + (b - 0.5) * 0.12; c.multiplyScalar(0.85 + 0.2 * smooth(0.4, 0.8, b)); } });
  const diely = [telo];
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, y = 0.52 + 0.07 * (i % 3) + 0.02 * i / 3, r = rf(y / L) * 0.95;
    diely.push(blob(0.016, 0.02, 0.016, (v, c, d) => { c.set(0x8f8c86).lerp(Cc(0xc4bfb2), smooth(0, 1, d.y) * 0.6).multiplyScalar(0.8 + 0.3 * sum(d.x * 4, d.y * 4, d.z * 4)); }, 2)
      .rotateZ(-Math.PI / 2).rotateY(-a).translate(Math.cos(a) * (r + 0.004), y, Math.sin(a) * (r + 0.004)));
  }
  return zlozD([...diely, ...[0, 1, 2, 3, 4].map(i => ovin(0.08 + i * 0.016, 0.034))]);
}
// ---------- klepetovy kyj: rukovat + cerveno-krémove krabie klepeto (dlan + dva klieste so zubami) ----------
function klepetovyKyj() {
  const L = 0.7, R = Cc(0xc8422c), sv = Cc(0xe8765a), hrot = Cc(0xf6e0c0), tm = Cc(0x8e2a18);
  const palm = blob(0.1, 0.12, 0.085, (v, c, d) => {
    const n = fbm(d.x * 3 + 1, d.y * 3, d.z * 3, 3), b = smooth(0.7, 0.85, sum(d.x * 12, d.y * 12, d.z * 12));
    v.multiplyScalar(1 + (n - 0.5) * 0.18 + b * 0.04);
    c.copy(R).lerp(sv, smooth(0.0, 1, d.y) * 0.4 + b * 0.25).lerp(tm, smooth(0.2, -0.9, d.y) * 0.45);
  }, 4).translate(0, L + 0.08, 0);
  const klieste = (z0, z1, z2, tipHex, k) => tuba(krivka([[0, L + 0.1, z0], [0, L + 0.19, z1], [0, L + 0.28, z2 * 1.0], [0, L + 0.36, z2 * 0.3]], 12), u => 0.04 * (1 - 0.82 * Math.pow(u, 0.9)) + 0.006, 8, (p, c, u) => {
    const n = fbm(p.x * 30, p.y * 30, p.z * 30, 2);
    c.copy(R).lerp(sv, 0.2 + 0.3 * n).lerp(tm, smooth(0.0, 0.25, 0.25 - u) * 0.4).lerp(tipHex, smooth(0.68, 0.92, u));
  }, () => [1, 0.72]);
  const zuby = [];
  for (const sg of [-1, 1]) for (let i = 0; i < 3; i++) zuby.push(fasety(new THREE.ConeGeometry(0.009, 0.026, 4).rotateX(-sg * Math.PI / 2).translate(0, L + 0.2 + i * 0.045, sg * (0.027 - i * 0.008)), (n, c) => c.copy(hrot)));
  return zlozD([drevenaRuk(L + 0.02, 0.03, 0.045, C.tmavy, 0.01), palm, klieste(0.045, 0.075, 0.062, hrot, 0), klieste(-0.05, -0.08, -0.065, hrot, 0), ...zuby,
    ovin(0.1, 0.04, 0, C.vlakno), ovin(0.2, 0.04), ovin(L - 0.01, 0.052), ovin(L + 0.005, 0.052)]);
}
// ---------- oštep: bambusova tyc (uzly, pruhy) + hrot (zaostreny bambus alebo kamenny list) previazany lanom ----------
function ostep(hrotHex, dlzka = 1.45) {
  const uzly = [0.3, 0.75, 1.15, 1.55].filter(y => y < dlzka - 0.12), bump = y => uzly.reduce((s, u) => s + Math.exp(-Math.pow((y - u) / 0.014, 2)), 0);
  const a = Cc(0xd2c070), b = Cc(0xe6d890), uzol = Cc(0x6a5a22), bambusovy = hrotHex === C.bambus;
  const tyc = valec(dlzka, t => 0.02 * (1 - 0.15 * t) * (1 + 0.2 * bump(t * dlzka)), 12, Math.round(dlzka * 55), (v, c, t, phi, rr, rez) => {
    if (rez) { c.copy(rr < 0.7 ? Cc(0x3a3418) : Cc(0xe3da8a)); return; }
    const n = fbm(Math.cos(phi) * 3 + 2, Math.sin(phi) * 3, t * dlzka * 2, 3);
    c.copy(a).lerp(b, smooth(0.3, 0.8, n) * 0.7).multiplyScalar(0.92 + 0.1 * Math.sin(phi * 9 + n * 4)).lerp(uzol, smooth(0.25, 0.9, bump(t * dlzka)) * 0.8);
  });
  const diely = [tyc];
  if (bambusovy) {
    diely.push(valec(0.21, t => 0.0165 * Math.pow(1 - t, 0.8) + 0.002, 10, 14, (v, c, t) => { c.copy(a).lerp(Cc(0x7a5a2a), smooth(0.35, 1, t) * 0.9).multiplyScalar(0.95 + 0.1 * Math.sin(Math.atan2(v.z, v.x) * 7)); }).translate(0, dlzka - 0.02, 0));
    diely.push(ovin(dlzka - 0.03, 0.022), ovin(dlzka - 0.044, 0.022));
  } else {
    diely.push(cepel(0.23, 0.028, 0.012, hrotHex).translate(0, dlzka - 0.04, 0));
    diely.push(...[0, 1, 2, 3].map(i => ovin(dlzka - 0.035 + i * 0.015, 0.024)), ovin(dlzka - 0.07, 0.023, 0, 0x6a4a30));
  }
  diely.push(...[0, 1, 2].map(i => ovin(0.15 + i * 0.015, 0.0235, 0, 0x6a4a30)));
  return zlozD(diely);
}

// ---------- predmety ----------
const nastroj = (typ, sila, ucinnost, trvanlivost) => ({ typ, sila, ucinnost, trvanlivost });

predmet('kamenna_sekera', { kopa: 1, meno: 'Kamenná sekera', ikona: ik('stone-axe', '#a19d95'), popis: 'Seká stromy a palmy rýchlejšie.',
  nastroj: nastroj('sekera', 1, { drevo: 2, kamen: 0.25, list: 1.2 }, 40), drzanie: drzanie(0.15), model: sekera(C.kamen, C.kamen2) });
predmet('lasturova_sekera', { kopa: 1, meno: 'Mušľová sekera', ikona: ik('stone-axe', '#f0c8b0'), popis: 'Ostrá mušľová čepeľ, vydrží dlhšie.',
  nastroj: nastroj('sekera', 1.3, { drevo: 2, kamen: 0.25, list: 1.2 }, 80), drzanie: drzanie(0.15), model: sekera(C.musla, 0xffffff, 1.15) });

predmet('kamenny_krompac', { kopa: 1, meno: 'Kamenný krompáč', ikona: ik('war-pick', '#a19d95'), popis: 'Láme kamene a balvany.',
  nastroj: nastroj('krompac', 1, { drevo: 0.3, kamen: 2, list: 0.3 }, 40), drzanie: drzanie(0.15), model: krompac(C.kamen, C.drevo) });
predmet('spevneny_krompac', { kopa: 1, meno: 'Spevnený krompáč', ikona: ik('war-pick', '#6e6a64'), popis: 'Hroty z tmavého kameňa, pevná rukoväť.',
  nastroj: nastroj('krompac', 1.4, { drevo: 0.3, kamen: 2, list: 0.3 }, 90), drzanie: drzanie(0.15), model: krompac(C.obsidian, C.tmavy) });

predmet('kamenny_noz', { kopa: 1, meno: 'Kamenný nôž', ikona: ik('bone-knife', '#a19d95'), popis: 'Reže rastliny a vlákna.',
  nastroj: nastroj('noz', 1, { drevo: 0.4, kamen: 0, list: 3 }, 50), drzanie: drzanie(0.08, 0.7), model: noz(0.2, C.kamen2, C.drevo) });
predmet('macheta', { kopa: 1, meno: 'Mačeta', ikona: ik('machete', '#c4beb2'), popis: 'Dlhá čepeľ, kosí kroviny ako nič.',
  nastroj: nastroj('noz', 1.5, { drevo: 0.6, kamen: 0, list: 4 }, 100), drzanie: drzanie(0.08, 0.7), model: noz(0.46, C.obsidian, C.tmavy) });

// obsidian: silnejsi nez kamen, ale krehky (mala trvanlivost); 'zivocichy' = poskodenie zivocichom (pre buduci boj)
predmet('obsidianova_sekera', { kopa: 1, meno: 'Obsidiánová sekera', ikona: ik('stone-axe', '#56487e'), popis: 'Veľmi ostrá, ale krehká.',
  nastroj: nastroj('sekera', 1.7, { drevo: 2, kamen: 0.25, list: 1.4 }, 28), drzanie: drzanie(0.15), model: sekera(C.obsidian, 0x1a1d21) });
predmet('obsidianovy_krompac', { kopa: 1, meno: 'Obsidiánový krompáč', ikona: ik('war-pick', '#56487e'), popis: 'Láme kameň rýchlo, ale rýchlo sa opotrebuje.',
  nastroj: nastroj('krompac', 1.8, { drevo: 0.3, kamen: 2, list: 0.3 }, 30), drzanie: drzanie(0.15), model: krompac(0x1a1d21, C.drevo) });
predmet('obsidianovy_noz', { kopa: 1, meno: 'Obsidiánový nôž', ikona: ik('plain-dagger', '#56487e'), popis: 'Ostrejší ako oceľ, no krehký.',
  nastroj: nastroj('noz', 1.8, { drevo: 0.5, kamen: 0, list: 3.5 }, 35), drzanie: drzanie(0.08, 0.7), model: noz(0.26, 0x1a1d21, C.drevo) });
predmet('obsidianovy_mec', { kopa: 1, meno: 'Obsidiánový meč', ikona: ik('shard-sword', '#56487e'), popis: 'Zbraň s obrovským poškodením. Čepeľ je krehká.',
  nastroj: { ...nastroj('mec', 2.2, { drevo: 0.6, kamen: 0, list: 3 }, 35), zivocichy: 9 }, drzanie: drzanie(0.08, 0.7), model: noz(0.7, 0x1a1d21, C.tmavy) });

predmet('kyj', { kopa: 1, meno: 'Kyj', ikona: ik('wood-club', '#9a6638'), popis: 'Ťažká drevená palica.',
  nastroj: nastroj('kyj', 1.5, { drevo: 0.8, kamen: 0.1, list: 1.5 }, 60), drzanie: drzanie(0.15), model: kyj() });

predmet('klepetovy_kyj', { kopa: 1, meno: 'Klepetový kyj', ikona: ik('claw-hammer', '#d0452f'), popis: 'Pomalý, ale drtivý. Veľký odhod a omráči nepriateľa. Zdvihni ho nad hlavu a buchni.',
  nastroj: { ...nastroj('klepeto', 3, { drevo: 1, kamen: 0.15, list: 1.5 }, 90), zivocichy: 12 }, drzanie: drzanie(0.15), model: klepetovyKyj() });

predmet('bambusova_ostep', { kopa: 1, meno: 'Bambusový oštep', ikona: ik('stone-spear', '#a5c75a'), popis: 'Ľahký oštep na lov a ryby.',
  nastroj: nastroj('ostep', 1.2, { drevo: 0.3, kamen: 0.05, list: 1 }, 30), drzanie: drzanie(0.5, 0.35), model: ostep(C.bambus) });
predmet('kamenna_ostep', { kopa: 1, meno: 'Kamenný oštep', ikona: ik('stone-spear', '#a19d95'), popis: 'Oštep s kamenným hrotom, vydrží viac.',
  nastroj: nastroj('ostep', 1.8, { drevo: 0.3, kamen: 0.05, list: 1 }, 60), drzanie: drzanie(0.5, 0.35), model: ostep(C.kamen2) });

// ---- zbrane z trofeji strazcov 2-5 (horenie = s, kolko nepriatel hori; dosah = m navyse; vodaBonus = nasobok poskodenia, ked hrac stoji vo vode) ----
predmet('zeravy_mec', { kopa: 1, meno: 'Žeravý meč', ikona: ik('shard-sword', '#ff6a20'), popis: 'Čepeľ zo žeravého jadra. Zapáli nepriateľa – horí ešte 3 sekundy.',
  nastroj: { ...nastroj('mec', 2.4, { drevo: 0.8, kamen: 0, list: 3 }, 120), zivocichy: 13, horenie: 3 }, drzanie: drzanie(0.08, 0.7), model: noz(0.8, 0xff5a20, 0x1a1412) });
predmet('krokodilia_harpuna', { kopa: 1, meno: 'Krokodília harpúna', ikona: ik('stone-spear', '#f3ecd6'), popis: 'Hrot z krokodílieho zuba. Bodá rýchlo a ďaleko (+1,5 m dosahu).',
  nastroj: { ...nastroj('noz', 2, { drevo: 0.4, kamen: 0, list: 2 }, 120), zivocichy: 12, dosah: 1.5 }, drzanie: drzanie(0.5, 0.35), model: ostep(0xf3ecd6, 1.7) });
predmet('trojzubec', { kopa: 1, meno: 'Trojzubec hlbín', ikona: ik('stone-spear', '#3aa8a0'), popis: 'Zbraň krakena. Vo vode udiera o 60 % silnejšie.',
  nastroj: { ...nastroj('mec', 2.2, { drevo: 0.5, kamen: 0, list: 2 }, 140), zivocichy: 15, vodaBonus: 1.6 }, drzanie: drzanie(0.5, 0.35), model: ostep(0x3aa8a0, 1.6) });
predmet('runove_kladivo', { kopa: 1, meno: 'Runové kladivo', ikona: ik('claw-hammer', '#40d8ff'), popis: 'Kladivo s jadrom golema. Najťažší úder v súostroví – omráči a odhodí.',
  nastroj: { ...nastroj('klepeto', 3.5, { drevo: 1.2, kamen: 2.5, list: 1.5 }, 160), zivocichy: 24 }, drzanie: drzanie(0.15), model: kyj() });
