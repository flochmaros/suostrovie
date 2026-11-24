// Nastroje: sekera, krompac, noz, kyj, ostep (+ vylepsene verzie).
// nastroj: { typ, sila, ucinnost: { drevo, kamen, list }, trvanlivost }  -> poskodenie = sila * ucinnost[material zdroja]
// drzanie: { poz, rot } - ako sa drzi v pravej ruke (pociatok skupiny = dlan, ruka dole -y, postava hlada -z)
// model: [geometria, material] - lezi na zemi (dlzka pozdlz x, hlava na -x), v ruke ho otoci drzanie.rot
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { predmet } from './predmety.js';
import { ik } from '../ikony.js';
import { hladka, tvar, dokonci, lano, fbm, smooth, stylMat } from './styl.js';

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
function krompac(hlavaHex, rukovatHex) {
  const L = 0.7;
  return zloz([rukovat(L, 0.03, rukovatHex, 0.026), farba(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 5).rotateZ(Math.PI / 2).translate(0, L, 0), C.tmavy),
    farba(new THREE.ConeGeometry(0.05, 0.2, 5).rotateZ(-Math.PI / 2).translate(0.33, L, 0), hlavaHex),
    farba(new THREE.ConeGeometry(0.05, 0.2, 5).rotateZ(Math.PI / 2).translate(-0.33, L, 0), hlavaHex),
    kamenHlava(0, L, 0.06, 0.06, 0.05, hlavaHex), omotaj(L - 0.04, 0.045), omotaj(L + 0.04, 0.045)]);
}
function noz(dlzkaCepele, cepelHex, rukovatHex) {
  const L = 0.26;
  return zloz([rukovat(L, 0.026, rukovatHex), kamenHlava(0, L + dlzkaCepele * 0.45, 0.022, dlzkaCepele * 0.55, 0.055, cepelHex),
    omotaj(L - 0.03, 0.034), omotaj(L + 0.02, 0.034)]);
}
function kyj() {
  const L = 0.72;
  return zloz([rukovat(L, 0.028, C.drevo, 0.058), kamenHlava(0, L + 0.02, 0.075, 0.07, 0.075, C.drevo), omotaj(0.12, 0.034)]);
}
// klepetovy kyj: rukovat + cervene klepeto (dva hroty) na konci
function klepetovyKyj() {
  const L = 0.7, R = 0xc8422c;
  return zloz([rukovat(L, 0.03, C.tmavy, 0.045), omotaj(0.1, 0.04), omotaj(0.2, 0.04),
    kamenHlava(0, L + 0.08, 0.1, 0.12, 0.085, R),
    farba(new THREE.ConeGeometry(0.05, 0.2, 5).translate(0, L + 0.27, 0.045).rotateX(0.0), R),
    farba(new THREE.ConeGeometry(0.045, 0.2, 5).translate(0, L + 0.25, -0.05), 0xa8321e)]);
}
function ostep(hrotHex, dlzka = 1.45) {
  const parts = [rukovat(dlzka, 0.02, C.bambus, 0.017), farba(new THREE.ConeGeometry(0.036, 0.2, 5).translate(0, dlzka + 0.08, 0), hrotHex), omotaj(dlzka - 0.02, 0.026)];
  for (const y of [0.3, 0.75, 1.15]) parts.push(farba(new THREE.TorusGeometry(0.02, 0.008, 4, 8).rotateX(Math.PI / 2).translate(0, y, 0), C.tmavy));
  return zloz(parts);
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
