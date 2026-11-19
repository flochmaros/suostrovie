// Postava: proceduralny model s klbmi (bez stiahnutych assetov).
// API klbov: J = { telo, chrbat, hlava, sL, sP, kL, kP, rL, rP, lL, lP, drziak } - rovnaka ako predtym, animacie v hrac.js sa nemenia.
// Konvencia: postava pozera na -z, kladne rotation.x hodi visiacu koncatinu dopredu, koleno sa ohyba zapornym x.
import * as THREE from 'three';

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o });
const KOZA = M(0xc68a62), KOZA_T = M(0xb97b55), KOZA_S = M(0xd49a72), RUZ = M(0xb8605a, { roughness: 0.6 });
const TRIKO = M(0xd9573b), TRIKO_T = M(0xb8452c), LEM = M(0xf0e4cc);
const SORTKY = M(0xcbb488), SORTKY_T = M(0xa89468), OPASOK = M(0x5a3a22, { roughness: 0.6 }), SPONA = M(0xd8c070, { metalness: 0.4, roughness: 0.4 });
const VLASY = M(0x2b1d12, { roughness: 0.55 }), VLASY_S = M(0x3d2a1a, { roughness: 0.55 });
const BIELKO = M(0xf4f1ea, { roughness: 0.3 }), DUHOVKA = M(0x4a2f1a, { roughness: 0.25 }), OCI = M(0x0d0a08, { roughness: 0.15 });
const OBOCIE = M(0x1d140c), USTA = M(0x8a3a34, { roughness: 0.5 });
const SANDAL = M(0x6b4a2c, { roughness: 0.9 }), REMIEN = M(0xe3c27a, { roughness: 0.8 });

function klb(x, y, z, ...deti) { const g = new THREE.Group(); g.position.set(x, y, z); if (deti.length) g.add(...deti); return g; }
function kapsula(r, dlzka, mat, y0 = 0) {        // visi z klbu dole
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(dlzka - 2 * r, 0.01), 5, 12), mat);
  m.position.y = y0 - dlzka / 2;
  return m;
}
function mesh(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m;
}
// rotacne teleso z profilu [polomer, y]
function lathe(profil, mat, seg = 20) {
  return new THREE.Mesh(new THREE.LatheGeometry(profil.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat);
}
function otoc(m, x = 0, y = 0, z = 0) { m.rotation.set(x, y, z); return m; }

function postavNohu(s) {
  // chodidlo: koza + podrazka sandala + remienky
  const chodidlo = klb(0, -0.44, -0.05,
    mesh(new THREE.CapsuleGeometry(0.045, 0.12, 4, 8).rotateX(Math.PI / 2), KOZA_T, 0, 0.005, -0.015, 1.05, 0.7, 1),
    mesh(new THREE.BoxGeometry(0.105, 0.022, 0.27), SANDAL, 0, -0.03, -0.012),
    mesh(new THREE.BoxGeometry(0.112, 0.02, 0.03), REMIEN, 0, 0.02, -0.03),
    mesh(new THREE.BoxGeometry(0.112, 0.02, 0.025), REMIEN, 0, 0.012, 0.045),
    ...[-1, 0, 1].map(i => mesh(new THREE.SphereGeometry(0.016, 6, 5), KOZA_T, i * 0.03, -0.012, -0.145, 1, 0.8, 1.1)),
    mesh(new THREE.CylinderGeometry(0.058, 0.06, 0.025, 8), REMIEN, 0, 0.085, 0.04));     // remienok na clenku
  const listok = kapsula(0.062, 0.44, KOZA);
  listok.add(mesh(new THREE.SphereGeometry(0.067, 10, 8), KOZA, 0, 0.12, 0.012, 1, 1.5, 1.05));   // lyta
  const koleno = klb(0, -0.46, 0, listok, mesh(new THREE.SphereGeometry(0.066, 10, 8), KOZA_T, 0, 0, 0), chodidlo);
  // stehno + nohavica sortiek (kuzel)
  const nohavica = mesh(new THREE.CylinderGeometry(0.1, 0.116, 0.27, 12, 1, true), SORTKY, 0, -0.125, 0);
  nohavica.material = SORTKY_T.clone(); nohavica.material.side = THREE.DoubleSide; nohavica.material.color.set(0xcbb488);
  const lem = mesh(new THREE.TorusGeometry(0.115, 0.007, 5, 14).rotateX(Math.PI / 2), SORTKY_T, 0, -0.26, 0);
  const stehno = klb(0.1 * s, -0.02, 0, kapsula(0.083, 0.46, KOZA), nohavica, lem, koleno);
  return { stehno, koleno };
}

function postavRuku(s) {
  // ruka: dlan + 4 prsty + palec
  const dlan = klb(0, -0.29, 0,
    mesh(new THREE.SphereGeometry(0.046, 10, 8), KOZA_S, 0, 0, 0, 0.9, 1.05, 0.6),
    mesh(new THREE.CapsuleGeometry(0.036, 0.04, 3, 8), KOZA_S, 0, -0.055, -0.004, 1.1, 1, 0.55),
    otoc(mesh(new THREE.CapsuleGeometry(0.014, 0.035, 3, 6), KOZA_S, -0.038 * s, -0.012, -0.02), 0, 0, 0.5 * s));   // palec
  const drziak = klb(0, -0.31, -0.02);
  const predlaktie = kapsula(0.045, 0.28, KOZA);
  predlaktie.add(mesh(new THREE.SphereGeometry(0.049, 10, 8), KOZA, 0, 0.06, 0, 1, 1.5, 1));    // sval predlaktia
  const laket = klb(0, -0.3, 0, predlaktie, mesh(new THREE.SphereGeometry(0.046, 8, 6), KOZA_T), dlan, drziak);
  // rukav: kratky kuzel + lem
  const rukav = mesh(new THREE.CylinderGeometry(0.068, 0.078, 0.17, 12, 1, true), TRIKO, 0, -0.07, 0);
  rukav.material = M(0xd9573b, { side: THREE.DoubleSide });
  const lemRukava = mesh(new THREE.TorusGeometry(0.078, 0.007, 5, 14).rotateX(Math.PI / 2), TRIKO_T, 0, -0.155, 0);
  const rameno = klb(0.23 * s, 0.42, 0, kapsula(0.055, 0.3, KOZA), mesh(new THREE.SphereGeometry(0.074, 12, 10), TRIKO, 0, 0.01, 0), rukav, lemRukava, laket);
  return { rameno, laket, drziak };
}

function postavHlavu() {
  const h = klb(0, 0.58, 0);
  // lebka a celust
  h.add(mesh(new THREE.SphereGeometry(0.125, 24, 18), KOZA, 0, 0.11, 0, 0.93, 1.1, 1.0));
  h.add(mesh(new THREE.SphereGeometry(0.075, 14, 10), KOZA, 0, 0.045, -0.04, 1.05, 0.95, 0.9));    // celusť
  // licka (jemny ruz)
  for (const s of [-1, 1]) h.add(mesh(new THREE.SphereGeometry(0.028, 8, 6), RUZ, 0.07 * s, 0.075, -0.1, 1, 0.7, 0.35));
  // oci: bielko + dúhovka + zrenicka + odlesk
  for (const s of [-1, 1]) {
    const x = 0.046 * s;
    h.add(mesh(new THREE.SphereGeometry(0.022, 10, 8), BIELKO, x, 0.125, -0.103, 1.1, 0.85, 0.6));
    h.add(mesh(new THREE.SphereGeometry(0.0125, 8, 6), DUHOVKA, x, 0.125, -0.114, 1, 1, 0.5));
    h.add(mesh(new THREE.SphereGeometry(0.0072, 6, 5), OCI, x, 0.125, -0.1185, 1, 1, 0.5));
    h.add(mesh(new THREE.SphereGeometry(0.003, 4, 4), BIELKO, x + 0.004 * s, 0.13, -0.1215));
    // obocie
    h.add(otoc(mesh(new THREE.BoxGeometry(0.044, 0.01, 0.012), OBOCIE, 0.046 * s, 0.158, -0.104), 0, 0.15 * s, -0.12 * s));
    // ucho
    h.add(mesh(new THREE.SphereGeometry(0.03, 8, 6), KOZA_T, 0.121 * s, 0.105, 0.005, 0.45, 1, 0.8));
  }
  // nos, nosne dierky, usta
  h.add(otoc(mesh(new THREE.ConeGeometry(0.019, 0.05, 8), KOZA, 0, 0.098, -0.123), -Math.PI / 2 - 0.25, 0, 0));
  h.add(mesh(new THREE.SphereGeometry(0.018, 8, 6), KOZA_T, 0, 0.083, -0.119, 1.1, 0.8, 0.8));
  h.add(otoc(mesh(new THREE.TorusGeometry(0.025, 0.0042, 5, 10, Math.PI), USTA, 0, 0.062, -0.115, 1, 0.8, 0.5), 0, 0, Math.PI));
  // vlasy: kapa + prameny + chvost vzadu
  h.add(mesh(new THREE.SphereGeometry(0.136, 20, 12, 0, Math.PI * 2, 0, 1.45), VLASY, 0, 0.125, 0.015, 1.0, 1.0, 1.02));
  const prameny = [[-0.08, 0.2, -0.06, 0.9], [0.0, 0.22, -0.08, 1.1], [0.08, 0.2, -0.06, 0.9], [-0.115, 0.15, 0.0, 0.8], [0.115, 0.15, 0.0, 0.8],
    [-0.06, 0.2, 0.07, 0.9], [0.06, 0.2, 0.07, 0.9], [0.0, 0.17, 0.11, 1.0]];
  prameny.forEach(([x, y, z, k], i) => {
    const p = mesh(new THREE.ConeGeometry(0.03, 0.09 * k, 6), i % 2 ? VLASY_S : VLASY, x, y, z);
    p.rotation.set(Math.atan2(z, 0.12) * 0.6, 0, -Math.atan2(x, 0.2));
    h.add(p);
  });
  // ofina
  h.add(otoc(mesh(new THREE.ConeGeometry(0.05, 0.09, 6), VLASY_S, 0.04, 0.215, -0.09), -1.1, 0, -0.5));
  // gumicka a chvost
  h.add(mesh(new THREE.TorusGeometry(0.022, 0.006, 5, 8), TRIKO_T, 0, 0.17, 0.125, 1, 1, 1));
  const chvost = klb(0, 0.17, 0.13,
    otoc(mesh(new THREE.CapsuleGeometry(0.03, 0.12, 4, 8), VLASY, 0, -0.07, 0.05), 0.5, 0, 0),
    otoc(mesh(new THREE.ConeGeometry(0.03, 0.1, 6), VLASY_S, 0, -0.18, 0.1), Math.PI - 0.5, 0, 0));
  h.add(chvost);
  return h;
}

export function postavModel() {
  const nohy = [-1, 1].map(postavNohu);
  const ruky = [-1, 1].map(postavRuku);
  const hlava = postavHlavu();

  // tricko: rotacny profil (polomer, y) od pasa po plecia, potom sploštene do tvaru trupu
  const tricko = lathe([[0.001, 0.0], [0.148, 0.0], [0.145, 0.1], [0.14, 0.18], [0.158, 0.3], [0.178, 0.38], [0.17, 0.455], [0.1, 0.5], [0.001, 0.515]], TRIKO, 24);
  tricko.scale.set(1.3, 1, 0.78);
  const lem2 = mesh(new THREE.TorusGeometry(0.15, 0.008, 5, 24).rotateX(Math.PI / 2), TRIKO_T, 0, 0.005, 0, 1.3, 1, 0.78);
  // golier (V-vystrih: torus + odhalena koza)
  const golier = mesh(new THREE.TorusGeometry(0.07, 0.016, 6, 16).rotateX(Math.PI / 2), LEM, 0, 0.5, 0, 1, 1, 1);
  const vystrih = mesh(new THREE.SphereGeometry(0.052, 10, 8), KOZA_S, 0, 0.49, -0.04, 1, 0.9, 0.7);
  const krk = mesh(new THREE.CylinderGeometry(0.048, 0.058, 0.15, 12), KOZA, 0, 0.54, 0);
  const chrbat = klb(0, 0.08, 0, tricko, lem2, vystrih, golier, krk, hlava, ruky[0].rameno, ruky[1].rameno);
  // gombiky na tricku (drobny detail)
  for (const y of [0.4, 0.3]) chrbat.add(mesh(new THREE.SphereGeometry(0.009, 5, 4), LEM, 0, y, -0.14));

  // panva + opasok so sponou
  const panva = mesh(new THREE.CapsuleGeometry(0.15, 0.08, 5, 14), SORTKY, 0, -0.01, 0, 1.28, 1, 0.84);
  const opasok = mesh(new THREE.TorusGeometry(0.152, 0.013, 5, 28).rotateX(Math.PI / 2), OPASOK, 0, 0.075, 0, 1.28, 1, 0.84);
  const spona = mesh(new THREE.BoxGeometry(0.04, 0.032, 0.012), SPONA, 0, 0.075, -0.132);
  const telo = klb(0, 0.95, 0, panva, opasok, spona, chrbat, nohy[0].stehno, nohy[1].stehno);
  telo.traverse(o => { if (o.isMesh) o.castShadow = true; });

  return { telo, chrbat, hlava, sL: nohy[0].stehno, sP: nohy[1].stehno, kL: nohy[0].koleno, kP: nohy[1].koleno,
    rL: ruky[0].rameno, rP: ruky[1].rameno, lL: ruky[0].laket, lP: ruky[1].laket, drziak: ruky[1].drziak };
}
