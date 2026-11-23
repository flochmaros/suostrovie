// Hlinisko - nizky plochy savanovy ostrov J od startu (pasmo 1). Jedine miesto s hlinou a (v domovskych ostrovoch) trstinou.
// V strede plytka brakicka laguna otvorena kanalom na sever (k startu - kanoe vplavie), z vychodu do nej tecie potok s deltou.
// Brehy potoka a okolie pece su cervena hlina. Na zapadnom brehu laguny stoji stara pec strazcov, kopy tehal, susiak a molo.
// API: src/ostrovy/index.js
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const R = 95;
const LAG = [-4, 10, 28, 21, 0.25];      // laguna: stred x, z, polosi, uhol
const KAN = [-4, 10, -16, -112];         // kanal z laguny na sever do mora
const POT = [[72, -36], [62, -18], [50, -16], [40, -6]];                         // potok (od pramena po zaciatok delty)
const DELTA = [[40, -6, 21, 2], [40, -6, 26, 13], [40, -6, 22, -6]];   // ramena delty do laguny
const PEC = [-46, -2], MOLO = [-36.5, 9, 0.08], SUS = [-54, 9];           // molo: zaciatok na brehu, smer (rad, 0 = vychod)
const KOPY = [[-38, -9], [-49, -11], [-53, 1]];
const HRNCE = [-41, 4];

// vzdialenost od potoka (aj delty) v metroch
function dPotok(x, z, P) {
  let d = 99;
  for (let i = 1; i < POT.length; i++) d = Math.min(d, P.distUsecka(x, z, ...POT[i - 1], ...POT[i]));
  let dd = 99;
  for (const r of DELTA) dd = Math.min(dd, P.distUsecka(x, z, r[0], r[1], r[2], r[3]));
  return [d, dd];
}
// kolko je bod "hlinisko" 0..1 (brehy potoka, okolie pece, flaky)
function hlinaMaska(x, z, P, dp) {
  const a = 1 - P.smooth(4, 16, dp);
  const b = 1 - P.smooth(8, 26, Math.hypot(x - PEC[0], z - PEC[1]));
  const c = P.smooth(0.12, 0.3, P.noise(x * 0.028, z * 0.028, 913));
  return Math.max(a, b, c);
}

export default {
  meno: 'Hlinisko', podnadpis: 'Červené hlinisko', biom: 'savana', R, ext: 210, H: 7, seed: 895,
  farby: { tr: [0xb0aa52, 0x9c9244], piesok: 0xe8d2a8, hl: 0xb05a32, hlPrah: 0.25, plaz: 1.1 },

  vyska(x, z, P) {
    const n = P.fbm(x * 0.012, z * 0.012, this.seed);                   // 3x noise
    const t = 1 - Math.hypot(x / 1.1, z / 0.92) / R + 0.26 * n;
    let h = P.profil(t, 6.5, 0.75);
    if (t > 0) h += P.noise(x * 0.05, z * 0.05, this.seed + 3) * 0.8 * P.smooth(0, 0.3, t);   // jemne vlny savany
    if (h < -3) return h;
    // laguna: dno -1.9 v strede, plytke okraje
    const dl = P.elipsa(x - LAG[0], z - LAG[1], LAG[2], LAG[3], LAG[4]);
    h = Math.min(h, dl < 1 ? -1.9 + 1.5 * dl * dl : -0.4 + (dl - 1) * 6);
    // kanal do mora (sirka ~12 m, hlbka -1.6)
    const dk = P.distUsecka(x, z, ...KAN);
    h = Math.min(h, dk < 5 ? -1.6 : -1.6 + (dk - 5) * 0.32);
    // potok + delta (plytke koryta, mierne brehy)
    const [dp, dd] = dPotok(x, z, P);
    h = Math.min(h, dp < 2.4 ? -0.9 : -0.9 + (dp - 2.4) * 0.3);
    h = Math.min(h, dd < 1.6 ? -0.7 : -0.7 + (dd - 1.6) * 0.5);
    // pramen: male jazierko na zaciatku potoka
    const dj = Math.hypot(x - POT[0][0], z - POT[0][1]);
    h = Math.min(h, dj < 5 ? -1.0 : -1.0 + (dj - 5) * 0.4);
    return h;
  },

  farba(x, z, h, f, P) {
    if (h < 0.3) return;
    const [dp] = dPotok(x, z, P);
    const m = hlinaMaska(x, z, P, dp) * P.smooth(0.3, 1.2, h);
    if (m <= 0) return;
    const n = P.noise(x * 0.2, z * 0.2, 5) * 0.08;                     // flakatost
    const t = f.trava;
    t.r += (0.66 + n - t.r) * m * 0.85; t.g += (0.33 + n * 0.5 - t.g) * m * 0.85; t.b += (0.18 - t.b) * m * 0.85;
    const p = f.piesok;
    p.r += (0.74 - p.r) * m * 0.5; p.g += (0.5 - p.g) * m * 0.5; p.b += (0.34 - p.b) * m * 0.5;
  },

  vegetacia: {
    zony: {
      plaz:     { palma: 0.4, trava: 4, kamienky: 0.5, ker: 0.1 },
      breh:     { trstina: 1.3, taro: 0.4, trava: 12, kvet: 0.3 },
      mangrovy: { mangrova: 0.45, trstina: 0.4 },
      hlinisko: { hlina: 0.5, aloe: 0.3, ker: 0.12, trava: 6, kamienky: 0.6, balvan: 0.08 },
      savana:   { akacia: 0.16, strom: 0.04, trava: 36, kvet: 0.9, ker: 0.25, bobule: 0.1, aloe: 0.15, ibistek: 0.08, balvan: 0.1, kamienky: 0.3 },
    },
    zona(x, z, h, P) {
      const dl = P.elipsa(x - LAG[0], z - LAG[1], LAG[2], LAG[3], LAG[4]);
      // par mangrov na juznom plytkom brehu laguny
      if (h > -0.9 && h < 1.1 && dl > 0.8 && dl < 1.35 && z > LAG[1] + 8 && x > -20) return 'mangrovy';
      if (h < 0.1) return null;
      if (Math.hypot(x - PEC[0], z - PEC[1]) < 6 || Math.hypot(x - MOLO[0], z - MOLO[1]) < 4) return null;
      const [dp, dd] = dPotok(x, z, P);
      const dk = P.distUsecka(x, z, ...KAN);
      const voda = Math.min((dl - 1) * 24, dp - 2.4, dd - 1.6, dk - 5);   // priblizna vzdialenost od vody laguny/potoka
      if (h < 2.2 && voda < 10) return 'breh';
      if (hlinaMaska(x, z, P, dp) > 0.45 && h > 0.6) return 'hlinisko';
      if (h < 1.3) return 'plaz';
      return 'savana';
    },
  },

  predmety: { nahodne: ['palica', 'kamen', 'palica'], pocet: 45, pevne: [['kamen', -42, 6], ['palica', -35, 3]] },
  flase: [[-36, 14]],
  pamiatkyNahlad: [[PEC[0], PEC[1], 3, 'pec'], [MOLO[0], MOLO[1], 2, 'mólo'], [SUS[0], SUS[1], 2, 'sušiak'], [HRNCE[0], HRNCE[1], 1.5, 'hrnce'],
    [POT[0][0], POT[0][1], 5, 'prameň']],

  pamiatky(P) {
    const T = P.THREE;
    const K = new Map();                // material -> geometrie (na konci 1 siet na material)
    const M = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), E = new T.Euler();
    const daj = (mat, g, m4) => {
      if (m4) g.applyMatrix4(m4);
      g = g.index ? g.toNonIndexed() : g;
      if (g.attributes.uv) g.deleteAttribute('uv');
      if (!K.has(mat)) K.set(mat, []);
      K.get(mat).push(g);
    };
    const tyc = (mat, ax, ay, az, bx, by, bz, r, seg = 6) => {
      V.set(bx - ax, by - ay, bz - az);
      const l = V.length();
      const g = new T.CylinderGeometry(r, r * 1.05, l, seg, 1).translate(0, l / 2, 0);
      Q.setFromUnitVectors(new T.Vector3(0, 1, 0), V.normalize());
      daj(mat, g, M.compose(new T.Vector3(ax, ay, az), Q, new T.Vector3(1, 1, 1)));
    };
    const kus = (mat, g, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) =>
      daj(mat, g, M.compose(new T.Vector3(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), new T.Vector3(s, s, s)));
    const rnd = P.rng(4711);

    const TEHLA = P.mat(0xb4522e), TEHLA2 = P.mat(0x8c3c22), SUROVA = P.mat(0xcf9a68), HLINA = P.mat(0xc0703f),
      HLINA2 = P.mat(0x9a5432), DREVO = P.mat(0x7a5a38), DREVO2 = P.mat(0x5e4630), TMA = P.mat(0x1c1410),
      SLAMA = P.mat(0xb89a56, { side: T.DoubleSide }), ZERAV = P.mat(0xff7a2a, { emissive: 0xff4a10, emissiveIntensity: 1.2 });
    const kol = [];

    // ---------- stara pec (ulova pec z tehal) ----------
    const gP = P.vyska(...PEC);
    const profil = [[0, 0], [2.5, 0], [2.6, 0.7], [2.45, 1.6], [2.05, 2.4], [1.4, 3.0], [0.7, 3.3], [0, 3.38]].map(([a, b]) => new T.Vector2(a, b));
    kus(TEHLA, new T.LatheGeometry(profil, 12), PEC[0], gP - 0.3, PEC[1]);
    kus(TEHLA2, new T.CylinderGeometry(2.75, 2.85, 0.6, 12), PEC[0], gP - 0.05, PEC[1]);          // sokel
    for (let i = 0; i < 3; i++) kus(TEHLA2, new T.TorusGeometry(2.5 - i * 0.35, 0.07, 4, 12), PEC[0], gP + 0.9 + i * 0.75, PEC[1], Math.PI / 2);  // pasy tehal
    // komin
    tyc(TEHLA, PEC[0] - 0.9, gP + 2.2, PEC[1] - 0.6, PEC[0] - 0.9, gP + 5.6, PEC[1] - 0.6, 0.45, 8);
    kus(TEHLA2, new T.CylinderGeometry(0.58, 0.58, 0.3, 8), PEC[0] - 0.9, gP + 5.6, PEC[1] - 0.6);
    kus(TMA, new T.CylinderGeometry(0.34, 0.34, 0.05, 8), PEC[0] - 0.9, gP + 5.76, PEC[1] - 0.6);
    // otvor (k lagune na vychod): tmava diera + klenba z tehal + zvysky zeravej pahreby
    kus(TMA, new T.BoxGeometry(0.5, 1.2, 1.1), PEC[0] + 2.42, gP + 0.7, PEC[1], 0, 0, 0);
    kus(TEHLA2, new T.TorusGeometry(0.62, 0.14, 4, 8, Math.PI), PEC[0] + 2.55, gP + 1.25, PEC[1], 0, Math.PI / 2, 0);
    kus(ZERAV, new T.DodecahedronGeometry(0.25, 0), PEC[0] + 2.2, gP + 0.25, PEC[1], 0, 0, 0, 1);
    kol.push([PEC[0], PEC[1], 2.9]);
    // popol a uhlie pred otvorom
    for (let i = 0; i < 6; i++) kus(TMA, new T.DodecahedronGeometry(0.12, 0), PEC[0] + 3.1 + rnd() * 0.8, gP + 0.05, PEC[1] - 0.6 + rnd() * 1.2, rnd(), rnd(), 0, 1);

    // ---------- kopy tehal ----------
    const tehla = () => new T.BoxGeometry(0.42, 0.14, 0.2);
    for (const [kx, kz] of KOPY) {
      const g = P.vyska(kx, kz), ry = rnd() * 3;
      const c = Math.cos(ry), s = Math.sin(ry);
      for (let v = 0; v < 6; v++) {
        const n = 5 - Math.floor(v / 2);
        for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) {
          // striedave vrstvy (krizom), kazda vyssia uzsia
          let u = (i - (n - 1) / 2) * 0.44, w = (j - 1) * 0.22;
          if (v % 2) [u, w] = [w * 2, u / 2];
          if (rnd() < 0.08) continue;                              // chybajuca tehla
          kus(rnd() < 0.2 ? TEHLA2 : TEHLA, tehla(), kx + u * c + w * s, g + 0.07 + v * 0.145, kz - u * s + w * c, 0, ry + (v % 2) * Math.PI / 2 + (rnd() - 0.5) * 0.08, 0);
        }
      }
      kol.push([kx, kz, 1.3]);
      // rozsypane tehly okolo
      for (let i = 0; i < 5; i++) {
        const a = rnd() * 6.28, d = 1.4 + rnd() * 1.5;
        kus(TEHLA, tehla(), kx + Math.cos(a) * d, P.vyska(kx + Math.cos(a) * d, kz + Math.sin(a) * d) + 0.06, kz + Math.sin(a) * d, (rnd() - 0.5) * 0.5, rnd() * 3, (rnd() - 0.5) * 0.4);
      }
    }

    // ---------- hlinene hrnce a crepy ----------
    const hrnec = [[0.01, 0], [0.22, 0.02], [0.34, 0.18], [0.36, 0.36], [0.24, 0.58], [0.16, 0.66], [0.2, 0.72]].map(([a, b]) => new T.Vector2(a, b));
    const gH = P.vyska(...HRNCE);
    const hr = [[0, 0, 1.2, 0], [0.8, 0.3, 0.9, 0], [-0.5, 0.7, 1.0, 0], [0.4, -0.7, 0.8, 1.4], [1.3, -0.3, 1.3, 0], [-0.9, -0.3, 0.7, 0]];
    for (const [dx, dz, s, pad] of hr) kus(rnd() < 0.5 ? HLINA : HLINA2, new T.LatheGeometry(hrnec, 8), HRNCE[0] + dx, gH + (pad ? 0.25 * s : -0.02), HRNCE[1] + dz, pad, rnd() * 3, 0, s);
    kol.push([HRNCE[0] + 0.3, HRNCE[1], 1.0]);
    for (let i = 0; i < 16; i++) {                                     // crepy
      const a = rnd() * 6.28, d = 0.8 + rnd() * 3.5, x = HRNCE[0] + Math.cos(a) * d, z = HRNCE[1] + Math.sin(a) * d;
      kus(rnd() < 0.5 ? HLINA : HLINA2, new T.LatheGeometry(hrnec.slice(1, 5), 3, 0, 0.9 + rnd() * 0.6), x, P.vyska(x, z) + 0.02, z,
        (rnd() - 0.5) * 2.4, rnd() * 6, (rnd() - 0.5) * 2.4, 0.6 + rnd() * 0.5);
    }

    // ---------- dreveny susiak na tehly (pristresok s policami) ----------
    const gS = P.vyska(...SUS), SX = 2.2, SZ = 0.9;
    for (const [u, w] of [[-SX, -SZ], [SX, -SZ], [-SX, SZ], [SX, SZ]]) {
      tyc(DREVO2, SUS[0] + u, gS - 0.3, SUS[1] + w, SUS[0] + u, gS + 2.1 + (w < 0 ? 0.3 : 0), SUS[1] + w, 0.08, 6);
      kol.push([SUS[0] + u, SUS[1] + w, 0.25]);
    }
    for (const y of [0.45, 1.15]) {
      kus(DREVO, new T.BoxGeometry(SX * 2 + 0.2, 0.06, SZ * 2 + 0.1), SUS[0], gS + y, SUS[1]);
      for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++)                      // surove tehly na policiach
        kus(SUROVA, tehla(), SUS[0] - 1.9 + i * 0.47, gS + y + 0.1, SUS[1] - 0.55 + j * 0.55, 0, Math.PI / 2 + (rnd() - 0.5) * 0.1, 0);
    }
    // slamena strecha (sikma)
    kus(SLAMA, new T.BoxGeometry(SX * 2 + 0.9, 0.12, SZ * 2 + 1.0), SUS[0], gS + 2.35, SUS[1], -0.16);
    kus(SLAMA, new T.BoxGeometry(SX * 2 + 0.7, 0.1, SZ * 2 + 0.8), SUS[0], gS + 2.43, SUS[1], -0.16);

    // ---------- male molo do laguny ----------
    const ux = Math.cos(MOLO[2]), uz = Math.sin(MOLO[2]), DL = 10, DY = 0.85;
    for (let i = 0; i <= 5; i++) {
      const d = i * DL / 5;
      for (const s of [-0.75, 0.75]) {
        const x = MOLO[0] + ux * d - uz * s, z = MOLO[1] + uz * d + ux * s;
        tyc(DREVO2, x, Math.min(P.vyska(x, z), 0) - 0.6, z, x, DY + 0.25, z, 0.1, 6);
      }
      if (i > 0) kol.push([MOLO[0] + ux * d, MOLO[1] + uz * d, 0.9]);
    }
    for (const s of [-0.6, 0.6]) tyc(DREVO2, MOLO[0] - uz * s, DY - 0.1, MOLO[1] + ux * s, MOLO[0] + ux * DL - uz * s, DY - 0.1, MOLO[1] + uz * DL + ux * s, 0.08, 5);
    for (let i = 0; i < 34; i++) {                                     // dosky
      const d = 0.15 + i * 0.29, x = MOLO[0] + ux * d, z = MOLO[1] + uz * d;
      kus(rnd() < 0.3 ? DREVO2 : DREVO, new T.BoxGeometry(0.24, 0.06, 1.7 + rnd() * 0.15), x, DY + (rnd() - 0.5) * 0.03, z, 0, -MOLO[2] + (rnd() - 0.5) * 0.06, 0);
    }
    // stary hrnec a kus lana na mole
    kus(HLINA, new T.LatheGeometry(hrnec, 8), MOLO[0] + ux * 8.6, DY + 0.03, MOLO[1] + uz * 8.6 + 0.4, 0, 0, 0, 0.8);

    // ---------- zlucenie ----------
    const objekty = [];
    for (const [mat, geos] of K) {
      const g = mergeGeometries(geos);
      g.computeBoundingSphere();
      const m = new T.Mesh(g, mat);
      if (mat === ZERAV) m.castShadow = false;
      objekty.push(m);
    }
    return { objekty, kolizie: kol };
  },
};
