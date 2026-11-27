// Postava: stylizovany mlady prieskumnik ostrovov (proceduralne, bez stiahnutych assetov).
// API klbov je rovnake ako predtym: J = { telo, chrbat, hlava, sL, sP, kL, kP, rL, rP, lL, lP, drziak }.
// Animacie v hrac.js sa nemenia. Konvencia: postava pozera na -z, kladne rotation.x hodi visiacu koncatinu dopredu.
// Styl: velka hlava (1.25x), velke oci, bujne kucery, sukna so vzorom, jemne svietiace teal tetovanie.
import * as THREE from 'three';
import { mobGLB } from './moby_glb.js';

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o });
// koza: fyzikalny material so sheen (teply kozny lesk) a jemnym vlastnym teplom - "rim" pocit
const koza = c => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.55, sheen: 0.35, sheenRoughness: 0.5,
  sheenColor: new THREE.Color(0xffc08a), emissive: new THREE.Color(0x3a1808), emissiveIntensity: 0.18 });
const KOZA = koza(0xa86a45), KOZA_T = koza(0x92583a), KOZA_S = koza(0xbb7c5a), RUZ = M(0xb8605a, { roughness: 0.6 });
const TRIKO = M(0xe04a2a, { side: THREE.DoubleSide }), TRIKO_T = M(0xf4c04a, { roughness: 0.45, metalness: 0.1 });
const LEM = M(0xf3e6c8, { roughness: 0.5 }), ZELEN = M(0x3f8f4a, { roughness: 0.6 });
const OPASOK = M(0x5a3a22, { roughness: 0.6 }), SPONA = M(0xd8c070, { metalness: 0.4, roughness: 0.4 });
const VLASY = new THREE.MeshPhysicalMaterial({ color: 0x2a1a10, roughness: 0.5, sheen: 0.6, sheenRoughness: 0.4, sheenColor: new THREE.Color(0x6a4a30) });
const VLASY_S = new THREE.MeshPhysicalMaterial({ color: 0x3b2616, roughness: 0.5, sheen: 0.6, sheenRoughness: 0.4, sheenColor: new THREE.Color(0x6a4a30) });
const VLASY_H = M(0x5b3b22, { roughness: 0.45 });
const BIELKO = M(0xf6f0e6, { roughness: 0.3 }), DUHOVKA = M(0x7a4a1c, { roughness: 0.25 }), OCI = M(0x0d0a08, { roughness: 0.15 });
const OBOCIE = M(0x1d140c), USTA = M(0x8a3a34, { roughness: 0.5 });
const SANDAL = M(0x6b4a2c, { roughness: 0.9 }), REMIEN = M(0xe3c27a, { roughness: 0.8 });
// teal bioluminiscencia: slabo svieti, aby pôsobila ako tetovanie z vnutra
const TAT = new THREE.MeshStandardMaterial({ color: 0x0c4a46, emissive: 0x2ef5dc, emissiveIntensity: 1.5, roughness: 0.35 });

// vzor pre sukne: pasy, zigzag a bodky (canvas textura, bez suboru)
function vzorSuknie() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#b8381f'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#f2b93b'; g.fillRect(0, 6, 256, 6); g.fillRect(0, 116, 256, 6);
  g.strokeStyle = '#2fd1bf'; g.lineWidth = 7; g.beginPath(); g.moveTo(0, 40);
  for (let x = 32; x <= 256; x += 32) g.lineTo(x, (x / 32) % 2 ? 88 : 40);
  g.stroke();
  g.fillStyle = '#f7e7c0';
  for (let x = 16; x < 256; x += 32) { g.beginPath(); g.arc(x, 64, 4, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function klb(x, y, z, ...deti) { const g = new THREE.Group(); g.position.set(x, y, z); if (deti.length) g.add(...deti); return g; }
function kapsula(r, dlzka, mat, y0 = 0) {        // visi z klbu dole
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(dlzka - 2 * r, 0.01), 8, 16), mat);
  m.position.y = y0 - dlzka / 2;
  return m;
}
function mesh(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m;
}
// rotacne teleso z profilu [polomer, y]
function lathe(profil, mat, seg = 24) {
  return new THREE.Mesh(new THREE.LatheGeometry(profil.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat);
}
function otoc(m, x = 0, y = 0, z = 0) { m.rotation.set(x, y, z); return m; }

function postavNohu(s) {
  // chodidlo: koza + podrazka sandala + remienky
  const chodidlo = klb(0, -0.44, -0.05,
    mesh(new THREE.CapsuleGeometry(0.045, 0.12, 6, 12).rotateX(Math.PI / 2), KOZA_T, 0, 0.005, -0.015, 1.05, 0.7, 1),
    mesh(new THREE.BoxGeometry(0.105, 0.022, 0.27), SANDAL, 0, -0.03, -0.012),
    mesh(new THREE.BoxGeometry(0.112, 0.02, 0.03), REMIEN, 0, 0.02, -0.03),
    mesh(new THREE.BoxGeometry(0.112, 0.02, 0.025), REMIEN, 0, 0.012, 0.045),
    ...[-1, 0, 1].map(i => mesh(new THREE.SphereGeometry(0.016, 8, 6), KOZA_T, i * 0.03, -0.012, -0.145, 1, 0.8, 1.1)),
    mesh(new THREE.CylinderGeometry(0.058, 0.06, 0.025, 12), REMIEN, 0, 0.085, 0.04));     // remienok na clenku
  const listok = kapsula(0.062, 0.44, KOZA);
  listok.add(mesh(new THREE.SphereGeometry(0.067, 14, 10), KOZA, 0, 0.12, 0.012, 1, 1.5, 1.05));   // lyta
  const koleno = klb(0, -0.46, 0, listok, mesh(new THREE.SphereGeometry(0.066, 14, 10), KOZA_T, 0, 0, 0), chodidlo);
  // stehno: kapsula bez sortiek (sukna zakryva boky)
  const stehno = klb(0.1 * s, -0.02, 0, kapsula(0.083, 0.46, KOZA), koleno);
  return { stehno, koleno };
}

function postavRuku(s) {
  // ruka: dlan + palec
  const dlan = klb(0, -0.29, 0,
    mesh(new THREE.SphereGeometry(0.046, 12, 10), KOZA_S, 0, 0, 0, 0.9, 1.05, 0.6),
    mesh(new THREE.CapsuleGeometry(0.036, 0.04, 4, 10), KOZA_S, 0, -0.055, -0.004, 1.1, 1, 0.55),
    otoc(mesh(new THREE.CapsuleGeometry(0.014, 0.035, 4, 8), KOZA_S, -0.038 * s, -0.012, -0.02), 0, 0, 0.5 * s));   // palec
  const drziak = klb(0, -0.31, -0.02);
  const predlaktie = kapsula(0.045, 0.28, KOZA);
  predlaktie.add(mesh(new THREE.SphereGeometry(0.049, 12, 10), KOZA, 0, 0.06, 0, 1, 1.5, 1));    // sval predlaktia
  const laket = klb(0, -0.3, 0, predlaktie, mesh(new THREE.SphereGeometry(0.046, 10, 8), KOZA_T), dlan, drziak);
  // rukav: kratky kuzel + zlaty lem
  const rukav = mesh(new THREE.CylinderGeometry(0.068, 0.078, 0.17, 16, 1, true), TRIKO, 0, -0.07, 0);
  const lemRukava = mesh(new THREE.TorusGeometry(0.078, 0.007, 5, 16).rotateX(Math.PI / 2), TRIKO_T, 0, -0.155, 0);
  const rameno = klb(0.23 * s, 0.42, 0, kapsula(0.055, 0.3, KOZA), mesh(new THREE.SphereGeometry(0.074, 14, 12), TRIKO, 0, 0.01, 0), rukav, lemRukava, laket);
  // teal tetovanie na predlakti (dve bodky)
  for (const y of [-0.2, -0.25]) rameno.add(mesh(new THREE.SphereGeometry(0.0085, 6, 5), TAT, 0, y, -0.054));
  return { rameno, laket, drziak };
}

function postavHlavu() {
  // velka hlava: celu skupinu skalujeme 1.25x okolo krku (klb sa otaca v hrac.js)
  const h = klb(0, 0.58, 0);
  h.scale.setScalar(1.25);
  // lebka a celust
  h.add(mesh(new THREE.SphereGeometry(0.125, 32, 24), KOZA, 0, 0.11, 0, 0.93, 1.1, 1.0));
  h.add(mesh(new THREE.SphereGeometry(0.075, 18, 14), KOZA, 0, 0.045, -0.04, 1.05, 0.95, 0.9));
  // licka (jemny ruz)
  for (const s of [-1, 1]) h.add(mesh(new THREE.SphereGeometry(0.028, 10, 8), RUZ, 0.07 * s, 0.075, -0.1, 1, 0.7, 0.35));
  // velke oci: bielko, dúhovka, zrenica, odlesk, horne vieko (riasy)
  for (const s of [-1, 1]) {
    const x = 0.05 * s;
    h.add(mesh(new THREE.SphereGeometry(0.03, 16, 14), BIELKO, x, 0.125, -0.1, 1, 1.15, 0.6));
    h.add(mesh(new THREE.SphereGeometry(0.019, 14, 12), DUHOVKA, x, 0.125, -0.12, 1, 1, 0.5));
    h.add(mesh(new THREE.SphereGeometry(0.01, 10, 8), OCI, x, 0.125, -0.13, 1, 1, 0.5));
    h.add(mesh(new THREE.SphereGeometry(0.0045, 6, 5), BIELKO, x + 0.006 * s, 0.136, -0.138));
    h.add(mesh(new THREE.SphereGeometry(0.034, 14, 8), OBOCIE, x, 0.152, -0.097, 1.05, 0.3, 0.6));
    // obocie (mierne zdvihnute von)
    h.add(otoc(mesh(new THREE.BoxGeometry(0.044, 0.011, 0.012), OBOCIE, 0.048 * s, 0.182, -0.108), 0, 0, -0.12 * s));
    // ucho
    h.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), KOZA_T, 0.121 * s, 0.105, 0.005, 0.45, 1, 0.8));
    // teal tetovanie na licke (tri bodky)
    for (const [dx, dy, dz] of [[0.095, 0.095, -0.095], [0.11, 0.075, -0.075], [0.09, 0.058, -0.088]])
      h.add(mesh(new THREE.SphereGeometry(0.0058, 6, 5), TAT, dx * s, dy, dz));
  }
  // nos a usta
  h.add(otoc(mesh(new THREE.ConeGeometry(0.019, 0.05, 10), KOZA, 0, 0.098, -0.123), -Math.PI / 2 - 0.25, 0, 0));
  h.add(mesh(new THREE.SphereGeometry(0.018, 10, 8), KOZA_T, 0, 0.083, -0.119, 1.1, 0.8, 0.8));
  h.add(otoc(mesh(new THREE.TorusGeometry(0.025, 0.0042, 6, 12, Math.PI), USTA, 0, 0.062, -0.115, 1, 0.8, 0.5), 0, 0, Math.PI));
  // vlasy: pevna kapa + blobky (objem vzadu a po bokoch) + kucery
  h.add(mesh(new THREE.SphereGeometry(0.152, 32, 20, 0, Math.PI * 2, 0, 1.05), VLASY, 0, 0.128, 0.02, 1.02, 1, 1.04));
  const bloby = [[0, 0.25, -0.02, 0.085], [-0.14, 0.2, 0.0, 0.08], [0.14, 0.2, 0.0, 0.08], [-0.13, 0.1, 0.07, 0.075],
    [0.13, 0.1, 0.07, 0.075], [0, 0.2, 0.14, 0.095], [-0.085, 0.18, 0.12, 0.07], [0.085, 0.18, 0.12, 0.07],
    [-0.1, 0.03, 0.13, 0.065], [0.1, 0.03, 0.13, 0.065], [0, 0.02, 0.16, 0.07]];
  bloby.forEach(([x, y, z, r], i) => h.add(mesh(new THREE.SphereGeometry(r, 16, 12), i % 3 ? VLASY : VLASY_S, x, y, z)));
  // kucery: deterministicky rozlozene gulicky na zadnej a bocnej casti hlavy (bez predneho okraja)
  for (let i = 0; i < 16; i++) {
    const a = i * 2.399, phi = 0.4 + 0.75 * ((i * 0.618) % 1), R = 0.17;
    const x = R * Math.sin(phi) * Math.cos(a), y = 0.13 + R * Math.cos(phi) * 0.95, z = 0.02 + R * Math.sin(phi) * Math.sin(a);
    if (z < -0.02) continue;
    h.add(mesh(new THREE.SphereGeometry(0.042 + 0.01 * (i % 3), 12, 9), i % 2 ? VLASY : VLASY_S, x, y, z));
  }
  // svetle pramene (odlesk na vlasoch)
  h.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), VLASY_H, 0.03, 0.3, -0.03, 1.4, 0.6, 1));
  h.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), VLASY_H, -0.06, 0.28, 0.03, 1.3, 0.6, 1));
  return h;
}

// model z Blenderu (nastroje/blender/postava.py): pivoty maju rovnake polohy ako klby nizsie.
// Materialy z GLB sa podla mena nahradia nasimi (sheen koze, vzor sukne, svietiace tetovanie).
let MAT_GLB = null;
function postavZGLB() {
  const mob = mobGLB('postava');
  if (!mob) return null;
  if (!MAT_GLB) {
    const sukna = M(0xffffff, { map: vzorSuknie(), roughness: 0.7, side: THREE.DoubleSide });
    sukna.map.flipY = false;                                    // UV z glTF maju v = 0 hore
    MAT_GLB = { koza: KOZA, koza_t: KOZA_T, ruz: RUZ, usta: USTA, triko: TRIKO, zlta: TRIKO_T, lem: LEM, zelen: ZELEN,
      opasok: OPASOK, spona: SPONA, vlasy: VLASY, vlasy_s: VLASY_S, vlasy_h: VLASY_H, bielko: BIELKO, duhovka: DUHOVKA,
      oci: OCI, obocie: OBOCIE, sandal: SANDAL, remien: REMIEN, sukna, tetovanie: TAT };
  }
  mob.g.traverse(o => { if (o.isMesh) o.material = MAT_GLB[o.material.name] ?? o.material; });
  const u = mob.uzol, telo = u('telo');
  mob.g.remove(telo);                                           // hrac.js si pripina priamo panvu (ako doteraz)
  u('hlava').scale.setScalar(1.25);
  return { telo, chrbat: u('chrbat'), hlava: u('hlava'), sL: u('stehno_L'), sP: u('stehno_P'), kL: u('koleno_L'), kP: u('koleno_P'),
    rL: u('rameno_L'), rP: u('rameno_P'), lL: u('laket_L'), lP: u('laket_P'), drziak: u('drziak_P') };
}

export function postavModel() {
  const glb = postavZGLB();
  if (glb) return glb;
  const nohy = [-1, 1].map(postavNohu);
  const ruky = [-1, 1].map(postavRuku);
  const hlava = postavHlavu();

  // tricko: rotacny profil od pasa po plecia, splostene do tvaru trupu
  const tricko = lathe([[0.001, 0.0], [0.148, 0.0], [0.145, 0.1], [0.14, 0.18], [0.158, 0.3], [0.178, 0.38], [0.17, 0.455], [0.1, 0.5], [0.001, 0.515]], TRIKO, 28);
  tricko.scale.set(1.3, 1, 0.78);
  const lem2 = mesh(new THREE.TorusGeometry(0.15, 0.008, 5, 28).rotateX(Math.PI / 2), TRIKO_T, 0, 0.005, 0, 1.3, 1, 0.78);
  // golier (zlaty lem) a odhalena koza v V-vystrihu
  const golier = mesh(new THREE.TorusGeometry(0.07, 0.016, 6, 18).rotateX(Math.PI / 2), TRIKO_T, 0, 0.5, 0, 1, 1, 1);
  const vystrih = mesh(new THREE.SphereGeometry(0.052, 12, 10), KOZA_S, 0, 0.49, -0.04, 1, 0.9, 0.7);
  const krk = mesh(new THREE.CylinderGeometry(0.048, 0.058, 0.15, 16), KOZA, 0, 0.54, 0);
  // nahrdelnik z listov a mušlí, visi po hrudi; uprostred teal privesok
  const nahrdelnik = new THREE.Group();
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, x = (t - 0.5) * 0.24, y = 0.5 - 0.11 * (1 - (2 * t - 1) ** 2);
    const z = -0.135 * Math.sqrt(Math.max(0, 1 - (x / 0.23) ** 2)) - 0.012;
    if (i === 5) nahrdelnik.add(mesh(new THREE.SphereGeometry(0.022, 12, 10), TAT, x, y - 0.02, z - 0.004, 1, 1.1, 0.6));
    else if (i % 2) nahrdelnik.add(mesh(new THREE.SphereGeometry(0.012, 8, 6), LEM, x, y, z, 1, 0.8, 0.5));
    else nahrdelnik.add(mesh(new THREE.SphereGeometry(0.014, 8, 6), ZELEN, x, y, z, 0.7, 1.8, 0.35));
  }
  const chrbat = klb(0, 0.08, 0, tricko, lem2, vystrih, golier, krk, hlava, ruky[0].rameno, ruky[1].rameno, nahrdelnik);
  // gombiky na tricku (drobny detail)
  for (const y of [0.4, 0.3]) chrbat.add(mesh(new THREE.SphereGeometry(0.009, 6, 5), TRIKO_T, 0, y, -0.14));

  // sukna so vzorom (valec, siroky dole) + zlaty lem + opasok so sponou
  const sukna = mesh(new THREE.CylinderGeometry(0.15, 0.225, 0.25, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, map: vzorSuknie(), roughness: 0.7, side: THREE.DoubleSide }), 0, -0.05, 0, 1.28, 1, 0.84);
  const hem = mesh(new THREE.TorusGeometry(0.225, 0.01, 5, 32).rotateX(Math.PI / 2), TRIKO_T, 0, -0.175, 0, 1.28, 1, 0.84);
  const opasok = mesh(new THREE.TorusGeometry(0.152, 0.013, 5, 32).rotateX(Math.PI / 2), OPASOK, 0, 0.075, 0, 1.28, 1, 0.84);
  const spona = mesh(new THREE.BoxGeometry(0.04, 0.032, 0.012), SPONA, 0, 0.075, -0.132);
  const telo = klb(0, 0.95, 0, sukna, hem, opasok, spona, chrbat, nohy[0].stehno, nohy[1].stehno);
  telo.traverse(o => { if (o.isMesh) o.castShadow = true; });

  return { telo, chrbat, hlava, sL: nohy[0].stehno, sP: nohy[1].stehno, kL: nohy[0].koleno, kP: nohy[1].koleno,
    rL: ruky[0].rameno, rP: ruky[1].rameno, lL: ruky[0].laket, lP: ruky[1].laket, drziak: ruky[1].drziak };
}
