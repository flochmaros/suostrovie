// Stavby a nabytok pre stavebne menu (B). Kazdy model = jeden Group s 1-4 zlucenymi meshmi (podla materialu).
// Geometrie sa vyrabaju raz na urovni modulu, model() len vytvori nove Mesh so zdielanou geometriou.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const M = 2;                                   // mriezka 2 m
const PI = Math.PI;

// ---------- materialy ----------
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...extra });
const DREVO = mat(0x8a6240);
const KMEN = mat(0x74512f, { roughness: 0.95 });
const SLAMA = mat(0xa8873f, { roughness: 1 });
const BAMBUS = mat(0xc4ad55);
const LANO = mat(0xb89a68, { roughness: 1 });
const KAMEN = mat(0x8c8a82, { roughness: 1 });
const SAZE = mat(0x2b2623, { roughness: 1 });
const LIST = mat(0x3f7f3c, { side: THREE.DoubleSide });
const HLINA = mat(0xa5593a);
const PLATNO = mat(0xd9c79a, { side: THREE.DoubleSide, roughness: 1 });
const CERVENA = mat(0xa8402f);
const VLAJKA = mat(0xb8442f, { side: THREE.DoubleSide, roughness: 1 });
const BIELA = mat(0xe8dcc0);
const TYRKYS = mat(0x2f7f7a);
const RYBA = mat(0xb4c2c8, { roughness: 0.5 });
const KOV = mat(0x4a4a4e, { roughness: 0.6, metalness: 0.3 });
const VODA = mat(0x3a86b8, { roughness: 0.2, transparent: true, opacity: 0.85 });
const PLAMEN = mat(0xff8a20, { emissive: 0xff7a10, emissiveIntensity: 1.6 });
const PLAMEN2 = mat(0xffd860, { emissive: 0xffc040, emissiveIntensity: 1.8 });
const LAMPION = mat(0xffe0a0, { emissive: 0xffb050, emissiveIntensity: 1.4 });
const UHLIK = mat(0x5a1a10, { emissive: 0xc03010, emissiveIntensity: 0.8 });
for (const m of [PLAMEN, PLAMEN2, LAMPION, UHLIK]) m.userData.bezTiena = true;

// ---------- pomocnici na geometriu ----------
const tr = (g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  return g.translate(x, y, z);
};
const B = (w, h, d, ...r) => tr(new THREE.BoxGeometry(w, h, d), ...r);
const C = (rt, rb, h, seg, ...r) => tr(new THREE.CylinderGeometry(rt, rb, h, seg), ...r);
const Sph = (sx, sy, sz, x, y, z) => new THREE.SphereGeometry(1, 6, 4).scale(sx, sy, sz).translate(x, y, z);

// zlozi model z dielov [[material, [geometrie]], ...] - zluci geometrie podla materialu
function zloz(casti) {
  const hotove = casti.map(([m, geos]) => [m, geos.length > 1 ? mergeGeometries(geos) : geos[0]]);
  return () => {
    const g = new THREE.Group();
    for (const [m, geo] of hotove) {
      const me = new THREE.Mesh(geo, m);
      me.castShadow = me.receiveShadow = !m.userData.bezTiena;
      g.add(me);
    }
    return g;
  };
}

// deterministicke nahodne cisla (aby kamene boli vzdy rovnake)
let semeno = 11;
const rnd = () => { semeno = (semeno * 16807) % 2147483647; return semeno / 2147483647; };

// rad kamenov od A po B (vo vodorovnej rovine) - steny pece
function kamene(ax, az, bx, bz, riadky, y0, v, hr) {
  const out = [];
  const dx = bx - ax, dz = bz - az, dlzka = Math.hypot(dx, dz), uhol = -Math.atan2(dz, dx);
  for (let r = 0; r < riadky; r++) {
    let t = 0, prvy = true;
    while (t < dlzka - 0.01) {
      let w = prvy && r % 2 ? 0.17 : 0.3 + rnd() * 0.12;
      prvy = false;
      w = Math.min(w, dlzka - t);
      const c = t + w / 2;
      out.push(B(w * 1.03, v * (0.92 + rnd() * 0.14), hr * (0.9 + rnd() * 0.2),
        ax + dx / dlzka * c, y0 + r * v, az + dz / dlzka * c, 0, uhol + (rnd() - 0.5) * 0.18, 0));
      t += w;
    }
  }
  return out;
}

// ---------- steny ----------
// zrubove kmene pozdlz X (ako stena v stavba.js); vynechaj[i] = [od, do] = medzera v i-tom rade
function kmeneSteny(vynechaj = {}) {
  const out = [];
  for (let i = 0; i < 5; i++) {
    const y = 0.2 + i * 0.4, m = vynechaj[i];
    if (!m) { out.push(C(0.2, 0.2, M + 0.15, 7, 0, y, 0, 0, 0, PI / 2)); continue; }
    for (const [a, b] of [[-1.075, m[0]], [m[1], 1.075]]) out.push(C(0.2, 0.2, b - a, 7, (a + b) / 2, y, 0, 0, 0, PI / 2));
  }
  return out;
}

// ---------- hamaka (latka s prehybom) ----------
function geoHamaka() {
  const g = new THREE.PlaneGeometry(2.5, 0.8, 10, 2).rotateX(-PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, 1.35 - 0.6 * (1 - (x / 1.25) ** 2) + 0.12 * (z / 0.4) ** 2);
  }
  g.computeVertexNormals();
  return g;
}

// vlajka s vlnenim
function geoVlajka() {
  const g = new THREE.PlaneGeometry(1, 0.6, 5, 1).translate(0.5, 0, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 6) * 0.06 * p.getX(i));
  g.computeVertexNormals();
  return g;
}

// ryba visiaca na snurke: [x, y stredu]
const ryby = (xs, yHore, dlzka) => {
  const telo = [], ocas = [], snurky = [];
  for (const x of xs) {
    const y = yHore - 0.1 - dlzka;
    telo.push(Sph(0.07, 0.2, 0.035, x, y, 0));
    ocas.push(B(0.12, 0.1, 0.015, x, y - 0.22, 0, 0, 0, 0.2));
    snurky.push(C(0.007, 0.007, dlzka, 4, x, yHore - 0.05 - dlzka / 2, 0));
  }
  return [[RYBA, [...telo, ...ocas]], [LANO, snurky]];
};

// ---------- definicie ----------
export const STAVBY = {
  stena_okno: {
    meno: 'Stena s oknom', ikona: '🪟', skupina: 'Stavba',
    suroviny: [['drevo', 4], ['vlakno', 1]],
    popis: 'Zrubová stena s oknom a bambusovými mrežami.',
    prichyt: 'stena', polomer: 0.5,
    model: zloz([
      [KMEN, kmeneSteny({ 2: [-0.4, 0.4], 3: [-0.4, 0.4] })],
      [DREVO, [B(0.1, 0.8, 0.46, -0.45, 1.2, 0), B(0.1, 0.8, 0.46, 0.45, 1.2, 0),
        B(1.0, 0.08, 0.54, 0, 0.8, 0), B(1.0, 0.08, 0.46, 0, 1.6, 0)]],
      [BAMBUS, [-0.2, 0, 0.2].map(x => C(0.022, 0.022, 0.8, 5, x, 1.2, 0))],
    ]),
  },

  stena_dvere: {
    meno: 'Stena s dverami', ikona: '🚪', skupina: 'Stavba',
    suroviny: [['drevo', 4], ['vlakno', 1]],
    popis: 'Zrubová stena s otvorom na dvere. Prejdeš cez ňu.',
    prichyt: 'stena', polomer: 0,
    model: zloz([
      [KMEN, kmeneSteny({ 0: [-0.5, 0.5], 1: [-0.5, 0.5], 2: [-0.5, 0.5], 3: [-0.5, 0.5], 4: [-0.5, 0.5] })],
      [DREVO, [B(0.1, 1.8, 0.46, -0.55, 0.9, 0), B(0.1, 1.8, 0.46, 0.55, 0.9, 0),
        B(1.2, 0.2, 0.46, 0, 1.9, 0)]],
      [LANO, [C(0.03, 0.03, 0.14, 5, 0.5, 1.0, 0.24, PI / 2)]],
    ]),
  },

  plot: {
    meno: 'Bambusový plot', ikona: '🎋', skupina: 'Stavba',
    suroviny: [['bambus', 3], ['vlakno', 1]],
    popis: 'Dvojmetrový plot z bambusu zviazaný lanom.',
    prichyt: 'volne', polomer: 0.5,
    model: zloz([
      [BAMBUS, [
        ...[-0.9, 0, 0.9].map(x => C(0.06, 0.06, 1.25, 6, x, 0.55, 0)),
        ...[0.35, 0.8].map(y => C(0.04, 0.04, 2.0, 6, 0, y, 0.07, 0, 0, PI / 2)),
        ...[-0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8].map((x, i) => C(0.03, 0.045, 0.95 + (i % 2) * 0.06, 5, x, 0.45, -0.05)),
      ]],
      [LANO, [-0.9, 0, 0.9].flatMap(x => [0.35, 0.8].map(y => C(0.07, 0.07, 0.05, 6, x, y, 0.03)))],
    ]),
  },

  lavica: {
    meno: 'Lavica', ikona: '🪑', skupina: 'Nábytok',
    suroviny: [['drevo', 3], ['vlakno', 1]],
    popis: 'Pevná drevená lavica pre dvoch.',
    prichyt: 'volne', polomer: 0.6,
    model: zloz([
      [DREVO, [
        ...[0, 1, 2].map(i => B(1.4, 0.06, 0.12, 0, 0.45, -0.14 + i * 0.14)),
        B(1.3, 0.05, 0.06, 0, 0.3, 0),
      ]],
      [KMEN, [-0.6, 0.6].flatMap(x => [-0.14, 0.14].map(z => B(0.09, 0.45, 0.09, x, 0.225, z)))],
    ]),
  },

  stol: {
    meno: 'Stôl', ikona: '🛋️', skupina: 'Nábytok',
    suroviny: [['drevo', 5], ['vlakno', 1]],
    popis: 'Jedálenský stôl z dosiek.',
    prichyt: 'volne', polomer: 0.7,
    model: zloz([
      [DREVO, [...[0, 1, 2, 3, 4].map(i => B(1.3, 0.06, 0.15, 0, 0.78, -0.32 + i * 0.16)),
        B(1.0, 0.06, 0.06, 0, 0.62, 0)]],
      [KMEN, [-0.55, 0.55].flatMap(x => [-0.3, 0.3].map(z => B(0.1, 0.78, 0.1, x, 0.39, z)))],
    ]),
  },

  stolicka: {
    meno: 'Stolička', ikona: '🪑', skupina: 'Nábytok',
    suroviny: [['drevo', 3], ['vlakno', 1]],
    popis: 'Jednoduchá stolička s opierkou. Predok je smerom od teba.',
    prichyt: 'volne', polomer: 0.3,
    model: zloz([
      [DREVO, [B(0.42, 0.06, 0.42, 0, 0.45, 0),
        B(0.42, 0.06, 0.05, 0, 0.85, 0.2), B(0.42, 0.06, 0.05, 0, 0.7, 0.2)]],
      [KMEN, [...[-0.17, 0.17].flatMap(x => [-0.17, 0.17].map(z => B(0.06, 0.45, 0.06, x, 0.225, z))),
        ...[-0.17, 0.17].map(x => B(0.05, 0.45, 0.05, x, 0.68, 0.2))]],
    ]),
  },

  hamaka: {
    meno: 'Hamaka', ikona: '🛏️', skupina: 'Nábytok',
    suroviny: [['drevo', 2], ['vlakno', 6], ['list', 3]],
    popis: 'Hojdacia sieť medzi dvoma kolmi.',
    prichyt: 'volne', polomer: 0.5,
    model: (() => {
      const gHam = geoHamaka();
      const lana = [1, -1].flatMap(s => [-0.3, 0, 0.3].map(z =>
        C(0.012, 0.012, 0.58, 4, s * 1.33, 1.62, z, 0, 0, -s * 0.28)));
      return zloz([
        [KMEN, [-1.4, 1.4].map(x => C(0.07, 0.09, 2.3, 6, x, 0.9, 0))],
        [PLATNO, [gHam]],
        [LANO, lana],
        [LIST, [B(0.45, 0.05, 0.3, 0.4, 0.82, 0)]],
      ]);
    })(),
  },

  truhlica: {
    meno: 'Truhlica', ikona: '🧰', skupina: 'Nábytok',
    suroviny: [['drevo', 6], ['vlakno', 2]],
    popis: 'Drevená truhlica s oblým vekom a kovaním.',
    prichyt: 'volne', polomer: 0.5,
    model: zloz([
      [DREVO, [B(0.9, 0.42, 0.56, 0, 0.21, 0),
        new THREE.CylinderGeometry(0.28, 0.28, 0.9, 8, 1, false, 0, PI).rotateZ(PI / 2).translate(0, 0.42, 0)]],
      [KOV, [-0.3, 0.3].map(x => B(0.06, 0.44, 0.6, x, 0.21, 0)).concat([B(0.1, 0.12, 0.04, 0, 0.42, -0.3)])],
    ]),
  },

  police: {
    meno: 'Polica', ikona: '📚', skupina: 'Nábytok',
    suroviny: [['drevo', 6], ['vlakno', 2]],
    popis: 'Regál s nádobami. Zadná strana je k stene.',
    prichyt: 'volne', polomer: 0.6,
    model: zloz([
      [DREVO, [
        B(0.07, 1.7, 0.4, -0.6, 0.85, 0), B(0.07, 1.7, 0.4, 0.6, 0.85, 0),
        ...[0.05, 0.55, 1.05, 1.55].map(y => B(1.25, 0.05, 0.4, 0, y, 0)),
        B(1.2, 1.6, 0.03, 0, 0.85, 0.185),
      ]],
      [HLINA, [
        C(0.1, 0.07, 0.26, 7, -0.35, 0.21, -0.02), C(0.07, 0.11, 0.2, 7, 0.1, 0.18, -0.02),
        C(0.09, 0.06, 0.24, 7, 0.4, 0.7, 0), C(0.08, 0.1, 0.18, 7, -0.3, 1.22, 0),
        C(0.06, 0.1, 0.3, 7, 0.3, 1.2, 0),
      ]],
      [BAMBUS, [C(0.06, 0.06, 0.12, 6, -0.05, 0.64, -0.03), C(0.06, 0.06, 0.12, 6, 0.05, 0.64, 0.06)]],
      [BIELA, [Sph(0.08, 0.05, 0.08, -0.35, 1.62, 0), Sph(0.06, 0.04, 0.06, 0.15, 1.6, 0.0), Sph(0.07, 0.04, 0.07, 0.4, 1.6, 0)]],
      [LANO, [C(0.15, 0.15, 0.03, 7, -0.05, 1.12, 0), C(0.01, 0.01, 0.2, 4, 0.0, 1.75, 0)]],
    ]),
  },

  pochoden: {
    meno: 'Tiki pochodeň', ikona: '🔥', skupina: 'Tábor', svetlo: true,
    suroviny: [['palica', 2], ['vlakno', 1], ['list', 1]],
    popis: 'Pochodeň zapichnutá v zemi. Svieti v noci.',
    prichyt: 'volne', polomer: 0.15,
    model: zloz([
      [BAMBUS, [C(0.045, 0.05, 2.1, 6, 0, 0.7, 0)]],
      [KMEN, [C(0.14, 0.09, 0.22, 7, 0, 1.76, 0)]],
      [LANO, [C(0.15, 0.15, 0.04, 7, 0, 1.68, 0), C(0.1, 0.1, 0.04, 6, 0, 1.2, 0)]],
      [PLAMEN, [new THREE.ConeGeometry(0.13, 0.42, 6).translate(0, 2.07, 0)]],
      [PLAMEN2, [new THREE.ConeGeometry(0.07, 0.26, 5).translate(0, 2.03, 0)]],
    ]),
  },

  zberac_vody: {
    meno: 'Zberač vody', ikona: '🪣', skupina: 'Tábor',
    suroviny: [['bambus', 3], ['list', 6], ['vlakno', 2], ['kokos', 1]],
    popis: 'Lievik z listov zachytáva dažďovú vodu do nádoby.',
    prichyt: 'volne', polomer: 0.7,
    model: zloz([
      [KMEN, [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].map(([x, z]) => C(0.05, 0.06, 1.8, 6, x, 0.9, z))],
      [LIST, [new THREE.CylinderGeometry(1.0, 0.14, 0.7, 8, 1, true).translate(0, 1.45, 0)]],
      [HLINA, [C(0.36, 0.3, 0.7, 10, 0, 0.35, 0)]],
      [BAMBUS, [C(0.035, 0.035, 0.7, 5, 0, 1.0, 0.0)]],
      [LANO, [C(0.38, 0.38, 0.05, 10, 0, 0.5, 0), C(0.33, 0.33, 0.05, 10, 0, 0.2, 0)]],
      [VODA, [C(0.3, 0.3, 0.02, 10, 0, 0.66, 0)]],
    ]),
  },

  susiak: {
    meno: 'Sušiak na ryby', ikona: '🐟', skupina: 'Tábor',
    suroviny: [['palica', 5], ['vlakno', 3]],
    popis: 'Rám, na ktorom sa sušia ryby.',
    prichyt: 'volne', polomer: 0.5,
    model: (() => {
      const [telo1, lano1] = ryby([-0.7, -0.35, 0, 0.35, 0.7], 1.7, 0.2);
      const [telo2, lano2] = ryby([-0.5, 0, 0.5], 1.2, 0.1);
      return zloz([
        [KMEN, [1, -1].flatMap(sx => [1, -1].map(s =>
          C(0.04, 0.05, 1.85, 6, sx * 0.95, 0.9, s * 0.2, -s * 0.2187)))
          .concat([C(0.045, 0.045, 2.2, 6, 0, 1.7, 0, 0, 0, PI / 2), C(0.04, 0.04, 2.0, 6, 0, 1.2, 0, 0, 0, PI / 2)])],
        [telo1[0], [...telo1[1], ...telo2[1]]],
        [LANO, [...lano1[1], ...lano2[1], ...[-0.95, 0.95].map(x => C(0.06, 0.06, 0.05, 6, x, 1.7, 0))]],
      ]);
    })(),
  },

  kamenna_pec: {
    meno: 'Kamenná pec', ikona: '🏺', skupina: 'Tábor',
    suroviny: [['kamen', 10], ['drevo', 2]],
    popis: 'Ohnisko z kameňov s komínom.',
    prichyt: 'volne', polomer: 0.9,
    model: zloz([
      [KAMEN, [
        ...kamene(-0.55, -0.5, -0.55, 0.5, 4, 0.13, 0.26, 0.3),
        ...kamene(0.55, -0.5, 0.55, 0.5, 4, 0.13, 0.26, 0.3),
        ...kamene(-0.55, 0.5, 0.55, 0.5, 4, 0.13, 0.26, 0.3),
        B(1.55, 0.16, 1.4, 0, 1.17, -0.02),
        ...kamene(-0.3, 0.1, 0.3, 0.1, 5, 1.37, 0.25, 0.2),
        ...kamene(-0.3, 0.6, 0.3, 0.6, 5, 1.37, 0.25, 0.2),
        ...kamene(-0.3, 0.1, -0.3, 0.6, 5, 1.37, 0.25, 0.2),
        ...kamene(0.3, 0.1, 0.3, 0.6, 5, 1.37, 0.25, 0.2),
        B(0.8, 0.1, 0.8, 0, 2.7, 0.35),
      ]],
      [SAZE, [B(1.0, 0.06, 0.95, 0, 0.03, -0.02), B(0.4, 0.02, 0.4, 0, 2.66, 0.35)]],
      [KMEN, [C(0.06, 0.06, 0.6, 6, -0.1, 0.1, -0.05, 0, 0.3, PI / 2), C(0.06, 0.06, 0.6, 6, 0.1, 0.1, 0.1, 0, -0.5, PI / 2)]],
      [UHLIK, [B(0.2, 0.06, 0.2, 0, 0.09, 0.05)]],
    ]),
  },

  molo: {
    meno: 'Drevené mólo', ikona: '⚓', skupina: 'Prístav',
    suroviny: [['drevo', 12], ['palica', 6], ['vlakno', 4]],
    popis: 'Mólo 2×4 m na nohách. Stavia sa pri brehu na plytčine.',
    prichyt: 'voda', polomer: 0,
    model: zloz([
      [DREVO, [
        ...Array.from({ length: 10 }, (_, i) => B(2.0, 0.1, 0.37, 0, -0.05, -1.8 + i * 0.4)),
        ...[-0.8, 0.8].map(x => B(0.16, 0.16, 4.0, x, -0.18, 0)),
        ...[-1.8, 0, 1.8].map(z => B(2.0, 0.12, 0.12, 0, -0.5, z)),
      ]],
      [KMEN, [
        ...[-1.8, 0, 1.8].flatMap(z => [-0.85, 0.85].map(x => C(0.1, 0.11, 3.1, 7, x, -1.55, z))),
        ...[-0.9, 0.9].flatMap(z => [-0.85, 0.85].map(x => B(0.07, 0.07, 1.8, x, -1.2, z))),
        ...[-1, 1].map(z => C(0.09, 0.09, 0.45, 7, 0.85, 0.2, z * 1.85)),
      ]],
      [LANO, [...[-1, 1].map(z => C(0.115, 0.115, 0.06, 7, 0.85, 0.32, z * 1.85)),
        ...[-1, 1].map(z => C(0.115, 0.115, 0.06, 7, 0.85, 0.1, z * 1.85))]],
    ]),
  },

  lampa: {
    meno: 'Bambusová lampa', ikona: '🏮', skupina: 'Tábor', svetlo: true,
    suroviny: [['bambus', 3], ['list', 2], ['vlakno', 1]],
    popis: 'Lampión na bambusovom stojane. Jemne svieti.',
    prichyt: 'volne', polomer: 0.2,
    model: zloz([
      [BAMBUS, [
        C(0.045, 0.05, 2.1, 6, 0, 1.0, 0),
        C(0.03, 0.03, 0.55, 5, 0.27, 2.05, 0, 0, 0, PI / 2),
        ...[0, 1, 2, 3].map(i => C(0.012, 0.012, 0.42, 4, 0.5 + Math.cos(i * PI / 2) * 0.17, 1.65, Math.sin(i * PI / 2) * 0.17)),
      ]],
      [KAMEN, [B(0.2, 0.12, 0.18, 0.15, 0.06, 0.12, 0, 0.3, 0), B(0.18, 0.1, 0.16, -0.14, 0.05, -0.1, 0, 0.8, 0), B(0.16, 0.1, 0.18, 0.1, 0.05, -0.18, 0, 0.1, 0)]],
      [LAMPION, [C(0.15, 0.15, 0.36, 8, 0.5, 1.65, 0)]],
      [SLAMA, [new THREE.ConeGeometry(0.25, 0.16, 8).translate(0.5, 1.93, 0), C(0.16, 0.16, 0.04, 8, 0.5, 1.45, 0)]],
      [LANO, [C(0.008, 0.008, 0.14, 4, 0.5, 2.02, 0), C(0.008, 0.008, 0.1, 4, 0.5, 2.02, 0)]],
    ]),
  },

  totem: {
    meno: 'Totem', ikona: '🗿', skupina: 'Tábor',
    suroviny: [['drevo', 6], ['kamen', 2], ['musla', 2]],
    popis: 'Vyrezávaný totem so strážcami ostrova.',
    prichyt: 'volne', polomer: 0.4,
    model: zloz([
      [DREVO, [
        C(0.3, 0.34, 0.9, 8, 0, 0.45, 0),
        C(0.27, 0.3, 0.75, 8, 0, 1.275, 0),
        C(0.22, 0.27, 0.65, 8, 0, 2.0, 0),
        
        B(1.0, 0.12, 0.2, 0, 1.65, -0.02),
        new THREE.ConeGeometry(0.1, 0.32, 5).rotateX(-PI / 2).translate(0, 2.55, -0.28),
      ]],
      [CERVENA, [B(0.3, 0.1, 0.06, 0, 0.62, -0.3), B(0.28, 0.1, 0.06, 0, 1.12, -0.27),
        B(0.7, 0.08, 0.05, 0, 1.45, -0.3), B(0.18, 0.1, 0.05, 0, 2.2, -0.25),
        B(0.9, 0.08, 0.05, 0, 1.68, -0.12, 0, 0, 0)]],
      [TYRKYS, [B(0.2, 0.2, 0.06, 0, 0.85, -0.3), B(0.14, 0.12, 0.05, 0, 1.35, -0.28),
        Sph(0.2, 0.2, 0.16, 0, 2.5, 0)]],
      [BIELA, [...[-0.1, 0.1].flatMap(x => [Sph(0.045, 0.045, 0.02, x, 2.0, -0.23), Sph(0.045, 0.045, 0.02, x, 0.97, -0.3),
        Sph(0.04, 0.04, 0.02, x * 0.8, 1.52, -0.28)]),
        Sph(0.1, 0.03, 0.02, 0, 0.7, -0.33)]],
      [KMEN, [B(0.7, 0.14, 0.5, 0, 0.07, 0), B(0.3, 0.05, 0.2, 0, 2.18, -0.22)]],
    ]),
  },

  lehatko: {
    meno: 'Lehátko', ikona: '🏖️', skupina: 'Nábytok',
    suroviny: [['drevo', 3], ['palica', 2], ['list', 3]],
    popis: 'Plážové lehátko. Hlavou k zadnej strane.',
    prichyt: 'volne', polomer: 0.7,
    model: zloz([
      [PLATNO, [B(0.6, 0.05, 0.95, 0, 0.32, -0.15), B(0.6, 0.05, 0.8, 0, 0.58, 0.58, -0.9, 0, 0)]],
      [DREVO, [
        ...[-0.32, 0.32].map(x => B(0.06, 0.06, 1.0, x, 0.28, -0.15)),
        ...[-0.32, 0.32].flatMap(x => [B(0.06, 0.3, 0.06, x, 0.15, -0.6), B(0.06, 0.3, 0.06, x, 0.15, 0.25)]),
        ...[-0.32, 0.32].map(x => B(0.06, 0.06, 0.82, x, 0.56, 0.58, -0.9, 0, 0)),
        B(0.6, 0.04, 0.04, 0, 0.5, 0.2),
      ]],
    ]),
  },

  vlajka: {
    meno: 'Vlajka', ikona: '🚩', skupina: 'Tábor',
    suroviny: [['bambus', 2], ['list', 2], ['vlakno', 1]],
    popis: 'Vlajka na bambusovom žrdi - označí tvoj tábor.',
    prichyt: 'volne', polomer: 0.15,
    model: (() => {
      const f = geoVlajka().translate(0.04, 2.7, 0);
      return zloz([
        [BAMBUS, [C(0.045, 0.055, 3.2, 6, 0, 1.4, 0), new THREE.SphereGeometry(0.07, 6, 4).translate(0, 3.05, 0)]],
        [VLAJKA, [f]],
        [KAMEN, [B(0.22, 0.14, 0.2, 0.2, 0.07, 0.1, 0, 0.4, 0), B(0.2, 0.12, 0.18, -0.18, 0.06, -0.1, 0, 1.0, 0)]],
      ]);
    })(),
  },
};
