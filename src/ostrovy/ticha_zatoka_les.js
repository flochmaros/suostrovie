// Les a zivot Bledych na Tichej zatoke (vlna 2): hustý tmavý les, popadane kmene, vychodene chodniky, obetisko s kostami,
// hniezda, pozorovacie miesta, rozbite kanoe a svietiace huby, ktore v noci ukazuju cestu k jaskyni.
// Suradnice su LOKALNE na ostrove (x vychod, z juh); ticha_zatoka.js ich prevadza na svetove (+ STRED).
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, smooth, dist, distUsecka } from './pomoc.js';
import * as J from './ticha_zatoka_jaskyna.js';
import { MIESTA } from './ticha_zatoka_modely.js';

export const OBETISKO = [98, 74];
export const HNIEZDA = [[112, 40], [96, 98]];                 // lesne hniezda (obycajni Bledi)
export const VYHLIADKY = [[32, 40], [118, 22]];                // skalny vrchol nad plazou, krivy strom nad vychodnym chodnikom
export const ZNAKY_VCHOD = MIESTA.stopy.at(-1);                 // koniec stop = vchod do jaskyne

// Chodniky Bledych (ako chodia medzi jaskynou, obetiskom, hniezdami a plazami). Stopy chatka -> jaskyna su v MIESTA.stopy.
export const CESTY = [
  [[-6, 22], [10, 19], [28, 22], [50, 27], [72, 34], [84, 52], OBETISKO],       // jaskyna -> pod utesom na vychod -> obetisko
  [OBETISKO, [120, 62], [150, 42], [176, 22]],                        // obetisko -> vychodna plaz
  [OBETISKO, [88, 40], [82, 10], [78, -30], [74, -62]],               // obetisko -> severna plaz
  [[14, -19], [40, -10], [62, 2], [82, 10]],                          // lagunou -> k chodniku
  [OBETISKO, HNIEZDA[1]], [[120, 62], HNIEZDA[0]],                    // k hniezdam
];

// kde sa nema nic sadit (chodniky, jaskyna, chatka)
export function volneMiesto(x, z) {
  for (const c of [MIESTA.stopy, ...CESTY]) for (let i = 1; i < c.length; i++) if (distUsecka(x, z, c[i - 1][0], c[i - 1][1], c[i][0], c[i][1]) < 2.4) return false;
  if (dist(x, z, OBETISKO[0], OBETISKO[1]) < 9) return false;
  for (const [hx, hz] of HNIEZDA) if (dist(x, z, hx, hz) < 5) return false;
  return true;
}
export const naUtese = (x, z) => x > -66 && x < 30 && z > 20;      // strmy utes s jaskynou (na vychod od neho je lesna plosina)
// 0..1 ako hustý je les (cim vyssie nad plazou a cim dalej od laguny)
export const lesnost = (x, z, h) => naUtese(x, z) ? 0 : smooth(2, 3.6, h) * Math.max(smooth(10, 24, x), smooth(18, 34, z));

function vzdialenostOdChodnika(x, z) {
  let d = 1e9, sx = 0, sz = 0;
  for (const c of [MIESTA.stopy, ...CESTY]) for (let i = 1; i < c.length; i++) {
    const dd = distUsecka(x, z, c[i - 1][0], c[i - 1][1], c[i][0], c[i][1]);
    if (dd < d) { d = dd; sx = (c[i - 1][0] + c[i][0]) / 2; sz = (c[i - 1][1] + c[i][1]) / 2; }
  }
  return d;
}

// ---------- rozmiestnenie (cisto matematicke, bez THREE; pouziva aj horor_zona.js) ----------
let pamat = null;
export function lesData(h0) {
  if (pamat) return pamat;
  const r = rng(7771), stromy = [], klady = [], mriez = new Map();
  const volno = (x, z, od) => {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++)
      for (const [ax, az] of mriez.get(`${Math.floor(x / 6) + i},${Math.floor(z / 6) + j}`) || []) if (Math.hypot(ax - x, az - z) < od) return false;
    return true;
  };
  const zapis = (x, z) => { const k = `${Math.floor(x / 6)},${Math.floor(z / 6)}`; if (!mriez.has(k)) mriez.set(k, []); mriez.get(k).push([x, z]); };
  for (let i = 0; i < 6000 && stromy.length < 190; i++) {
    const x = -125 + r() * 325, z = -110 + r() * 260, h = h0(x, z);
    if (h < 2.3 || r() > lesnost(x, z, h) || !volneMiesto(x, z) || !volno(x, z, 5.5)) continue;
    if (dist(x, z, MIESTA.chatka[0], MIESTA.chatka[1]) < 16 || dist(x, z, MIESTA.siet[0], MIESTA.siet[1]) < 9) continue;
    zapis(x, z);
    stromy.push({ x, z, y: h, v: 12 + r() * 8, sk: (r() - 0.5) * 1.6, uhol: r() * 6.28, kr: 0.8 + r() * 0.5 });
  }
  // popadane kmene (hlavne pri chodnikoch, aby sa dalo skryt aj preskocit)
  for (let i = 0; i < 4000 && klady.length < 34; i++) {
    const x = -125 + r() * 325, z = -110 + r() * 260, h = h0(x, z), u = r() * 3.14, d = 2.6 + r() * 2.8, ux = Math.cos(u) * d, uz = Math.sin(u) * d;
    if (h < 2.3 || lesnost(x, z, h) < 0.6 || !volneMiesto(x, z) || !volneMiesto(x + ux, z + uz) || !volneMiesto(x - ux, z - uz)) continue;
    if (!volno(x, z, 3)) continue;
    zapis(x, z);
    klady.push({ x, z, ux, uz, r: 0.34 + r() * 0.3 });
  }
  // lesne ukryty: za kmenom 4-14 m od chodnika, odvratene od chodnika
  const ukryty = [];
  for (const s of stromy) {
    const d = vzdialenostOdChodnika(s.x, s.z);
    if (d < 4 || d > 14) continue;
    if (ukryty.some(u => Math.hypot(u.x - s.x, u.z - s.z) < 11)) continue;
    // smer od chodnika (priblizne od najblizsieho bodu): skusime posun "dalej od stredu ostrova k chodniku"
    let nx = 0, nz = 0;
    for (const c of [MIESTA.stopy, ...CESTY]) for (let i = 1; i < c.length; i++) {
      const ax = c[i - 1][0], az = c[i - 1][1], bx = c[i][0], bz = c[i][1], l2 = (bx - ax) ** 2 + (bz - az) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((s.x - ax) * (bx - ax) + (s.z - az) * (bz - az)) / l2));
      if (Math.hypot(s.x - ax - (bx - ax) * t, s.z - az - (bz - az) * t) <= d + 1e-6) { nx = s.x - ax - (bx - ax) * t; nz = s.z - az - (bz - az) * t; }
    }
    const l = Math.hypot(nx, nz) || 1;
    ukryty.push({ x: s.x + nx / l * 1.2, z: s.z + nz / l * 1.2 });
    if (ukryty.length >= 22) break;
  }
  return pamat = { stromy, klady, ukryty };
}

// ---------- modely ----------
export function pamiatkyLesa(P, h0) {
  const T = P.THREE, o3 = new T.Object3D(), r = rng(4412), kol = [], objekty = [], kopy = new Map();
  const daj = (mat, geo) => { const g = geo.index ? geo.toNonIndexed() : geo; if (!kopy.has(mat)) kopy.set(mat, []); kopy.get(mat).push(g); };
  const kus = (mat, geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => {
    o3.position.set(x, y, z); o3.rotation.set(rx, ry, rz, 'YXZ'); o3.scale.set(sx, sy, sz); o3.updateMatrix();
    daj(mat, geo.clone().applyMatrix4(o3.matrix));
  };
  const V = (x, y, z) => new T.Vector3(x, y, z), HORE = V(0, 1, 0);
  const tyc = (mat, a, b, ra, rb = ra, seg = 6) => {
    const A = V(...a), B = V(...b), d = B.clone().sub(A), l = d.length();
    const g = new T.CylinderGeometry(rb, ra, l, seg);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(HORE, d.normalize()));
    g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
    daj(mat, g);
  };
  const M = (c, o) => P.mat(c, o);
  const KMEN = M(0x33261a), KMEN2 = M(0x3d2e20), KORUNA = M(0x1d3f27, { flatShading: true }), KORUNA2 = M(0x15321f, { flatShading: true }),
    MACH = M(0x2f4a28), KOST = M(0xe2d9c0), KOST2 = M(0xc9bc98), TMA = M(0x120e0a), HLINA = M(0x2a2118, { roughness: 1 }),
    KAMEN = M(0x5d5a55, { flatShading: true }), KAMEN2 = M(0x4a4741, { flatShading: true }), TRAVA = M(0x3f5a2c, { side: T.DoubleSide }),
    DREVO = M(0x6e5334), DREVO2 = M(0x5a4228), LANO = M(0xa8966a),
    HUBA_S = M(0x1c5a52, { emissive: 0x40ffd6, emissiveIntensity: 2.2 }), HUBA_N = M(0x2c6a62, { emissive: 0x2aa890, emissiveIntensity: 0.8 }),
    OCKO = M(0xdfffee, { emissive: 0x9fffe0, emissiveIntensity: 2.6 });
  const IKO = new T.IcosahedronGeometry(1, 1), GULA = new T.SphereGeometry(1, 8, 6), KAMENG = new T.DodecahedronGeometry(1, 0);
  const KUZEL = new T.ConeGeometry(1, 1, 5), KOCKA = new T.BoxGeometry(1, 1, 1);
  const { stromy, klady, ukryty } = lesData(h0);
  const vys = (x, z) => P.vyska(x, z);

  // ---------- vysoke tmave stromy ----------
  for (const s of stromy) {
    const dx = Math.cos(s.uhol) * s.sk, dz = Math.sin(s.uhol) * s.sk, H = s.v;
    tyc(r() < 0.5 ? KMEN : KMEN2, [s.x, s.y - 0.5, s.z], [s.x + dx, s.y + H, s.z + dz], s.kr * 0.62, s.kr * 0.26, 7);
    kus(KMEN, new T.CylinderGeometry(s.kr * 0.9, s.kr * 1.5, 1.4, 7), s.x, s.y + 0.3, s.z);         // korene
    for (let k = 0; k < 4; k++) {                                                                       // niekolko vrstiev koruny
      const f = 0.52 + k * 0.16, w = (4.6 - k * 0.5) * (0.85 + r() * 0.35);
      kus(k % 2 ? KORUNA : KORUNA2, IKO, s.x + dx * f + (r() - 0.5) * 1.2, s.y + H * f + 1.2, s.z + dz * f + (r() - 0.5) * 1.2, 0, r() * 6, 0, w, w * 0.42, w);
    }
    // visiace suche konare
    for (let k = 0; k < 2; k++) { const a = r() * 6.28, y0 = s.y + 3 + r() * 4; tyc(KMEN2, [s.x, y0, s.z], [s.x + Math.cos(a) * 1.8, y0 - 0.6 + r() * 0.5, s.z + Math.sin(a) * 1.8], 0.08, 0.03, 4); }
    kol.push([s.x, s.z, s.kr * 0.85]);
  }

  // ---------- popadane kmene ----------
  for (const k of klady) {
    const a = [k.x - k.ux / 2, 0, k.z - k.uz / 2], b = [k.x + k.ux / 2, 0, k.z + k.uz / 2];
    a[1] = vys(a[0], a[2]) + k.r * 0.7; b[1] = vys(b[0], b[2]) + k.r * 0.7;
    tyc(r() < 0.5 ? KMEN : KMEN2, a, b, k.r, k.r * 0.85, 7);
    tyc(MACH, [a[0] * 0.7 + b[0] * 0.3, a[1] + k.r * 0.5, a[2] * 0.7 + b[2] * 0.3], [a[0] * 0.3 + b[0] * 0.7, b[1] + k.r * 0.5, a[2] * 0.3 + b[2] * 0.7], k.r * 0.55, k.r * 0.5, 5);
    kus(KMEN2, new T.CylinderGeometry(k.r * 1.1, k.r * 1.4, 0.7, 7), a[0], a[1] - k.r * 0.4, a[2], 0, 0, 0.3);       // koren
    const pocet = Math.ceil(Math.hypot(k.ux, k.uz) / 1.5);
    for (let i = 0; i <= pocet; i++) { const t = i / pocet; kol.push([a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t, k.r + 0.15, { yMax: 0.9 }]); }
  }

  // ---------- chodniky: vyslapana hlina + dlhe stopy ----------
  {
    const kruh = new T.CircleGeometry(1, 9).rotateX(-Math.PI / 2), chod = new T.CircleGeometry(1, 10).rotateX(-Math.PI / 2);
    for (const c of CESTY) for (let i = 1; i < c.length; i++) {
      const [ax, az] = c[i - 1], [bx, bz] = c[i], d = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / d, uz = (bz - az) / d;
      for (let s = 0; s < d; s += 1.6) {
        const x = ax + ux * s + (r() - 0.5) * 0.8, z = az + uz * s + (r() - 0.5) * 0.8, h = vys(x, z);
        if (h < 1.5) continue;
        kus(HLINA, kruh, x, Math.max(h, vys(x + 1, z), vys(x - 1, z), vys(x, z + 1), vys(x, z - 1)) + 0.035, z, 0, 0, 0, 1.25 + r() * 0.5, 1, 1.0 + r() * 0.5);
        if (r() < 0.45) {       // dlhe uzke chodidlo (ako na plazi pri chatke)
          const sx = x + uz * (r() < 0.5 ? 0.25 : -0.25), sz = z - ux * 0.25;
          kus(TMA, chod, sx, vys(sx, sz) + 0.05, sz, 0, Math.atan2(ux, uz), 0, 0.12, 1, 0.34);
        }
      }
    }
  }

  // ---------- obetisko: jama s kostami v lese ----------
  {
    const [ox, oz] = OBETISKO, oy = vys(ox, oz);
    kus(TMA, new T.CircleGeometry(1, 20).rotateX(-Math.PI / 2), ox, oy + 0.05, oz, 0, 0, 0, 3.6, 1, 3.1);       // tmava jama
    for (let i = 0; i < 16; i++) {                                                                               // kruh kamenov
      const a = i / 16 * 6.283 + (r() - 0.5) * 0.2, x = ox + Math.cos(a) * 4.4, z = oz + Math.sin(a) * 4.0;
      kus(i % 2 ? KAMEN : KAMEN2, KAMENG, x, vys(x, z) + 0.2, z, r(), r() * 6, r(), 0.55 + r() * 0.45, 0.4 + r() * 0.3, 0.5 + r() * 0.4);
      if (i % 4 === 0) kol.push([x, z, 0.7, { yMax: 1.2 }]);
    }
    for (let i = 0; i < 55; i++) {                                                                               // hromada kosti
      const a = r() * 6.283, d = Math.sqrt(r()) * 3.2, x = ox + Math.cos(a) * d, z = oz + Math.sin(a) * d * 0.85, y = vys(x, z) + 0.1 + r() * 0.15;
      const l = 0.5 + r() * 0.8, u = r() * 6.283;
      tyc(r() < 0.6 ? KOST : KOST2, [x, y, z], [x + Math.cos(u) * l, y + r() * 0.2, z + Math.sin(u) * l], 0.04 + r() * 0.03, 0.05 + r() * 0.03, 5);
    }
    for (let i = 0; i < 6; i++) {                                                                                // lebky na kolikoch okolo
      const a = i / 6 * 6.283 + 0.3, x = ox + Math.cos(a) * 6.2, z = oz + Math.sin(a) * 5.6, y = vys(x, z), vv = 1.5 + r() * 0.9;
      tyc(DREVO, [x, y - 0.2, z], [x + (r() - 0.5) * 0.15, y + vv, z], 0.05, 0.035, 5);
      kus(KOST, GULA, x, y + vv + 0.14, z, 0, a + 3.14, 0, 0.13, 0.17, 0.15);
      kus(TMA, GULA, x + Math.cos(a + 3.14) * 0.03, y + vv + 0.17, z + Math.sin(a + 3.14) * 0.03, 0, 0, 0, 0.032, 0.04, 0.04);
      kol.push([x, z, 0.2]);
    }
    for (let i = 0; i < 3; i++) {                                                                                // rebra = oblúky z kosti
      const a = i * 2.1 + 0.4, x = ox + Math.cos(a) * 2.2, z = oz + Math.sin(a) * 2.0, y = vys(x, z);
      const kr = new T.CatmullRomCurve3([V(x - 0.7, y, z), V(x - 0.55, y + 0.65, z), V(x, y + 0.85, z), V(x + 0.55, y + 0.65, z), V(x + 0.7, y, z)]);
      const g = new T.TubeGeometry(kr, 8, 0.045, 5); g.rotateY(0); kus(KOST, g, 0, 0, 0, 0, 0, 0);
    }
  }

  // ---------- lesne hniezda (obycajni Bledi): vencek z konarov a kosti pod popadanym stromom ----------
  for (const [hx, hz] of HNIEZDA) {
    const hy = vys(hx, hz);
    kus(HLINA, new T.CircleGeometry(1, 14).rotateX(-Math.PI / 2), hx, hy + 0.05, hz, 0, 0, 0, 3.2, 1, 2.8);
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * 6.283 + r() * 0.2, d = 2.4 + r() * 0.5, x = hx + Math.cos(a) * d, z = hz + Math.sin(a) * d;
      const y = vys(x, z);
      tyc(i % 2 ? DREVO : DREVO2, [x, y + 0.2, z], [x + Math.cos(a + 1.3) * 1.6, y + 0.55 + r() * 0.6, z + Math.sin(a + 1.3) * 1.6], 0.07, 0.05, 5);
    }
    for (let i = 0; i < 4; i++) {                                                                                 // sikmo oprete konare = "strecha"
      const a = i * 1.57 + 0.4, x = hx + Math.cos(a) * 3.1, z = hz + Math.sin(a) * 3.1;
      tyc(KMEN2, [x, vys(x, z), z], [hx + Math.cos(a) * 0.4, vys(hx, hz) + 3.2, hz + Math.sin(a) * 0.4], 0.14, 0.07, 5);
    }
    for (let i = 0; i < 9; i++) { const x = hx + (r() - 0.5) * 3, z = hz + (r() - 0.5) * 3; kus(KOST2, GULA, x, vys(x, z) + 0.06, z, 0, r() * 6, 0, 0.1, 0.06, 0.18); }
    kol.push([hx + 3.1, hz, 0.5, { yMax: 2 }], [hx - 3.1, hz, 0.5, { yMax: 2 }], [hx, hz + 3.1, 0.5, { yMax: 2 }], [hx, hz - 3.1, 0.5, { yMax: 2 }]);
  }

  // ---------- pozorovacie miesta ----------
  {
    const [sx, sz] = VYHLIADKY[0], sy = vys(sx, sz);                                                              // skalny prst nad plazou
    for (let i = 0; i < 6; i++) kus(i % 2 ? KAMEN : KAMEN2, KAMENG, sx + (r() - 0.5) * 0.6, sy + 0.8 + i * 1.5, sz + (r() - 0.5) * 0.6, r(), r() * 6, r(), 1.8 - i * 0.18, 1.3, 1.7 - i * 0.18);
    kol.push([sx, sz, 2.2]);
    const [kx, kz] = VYHLIADKY[1], ky = vys(kx, kz);                                                             // krivy strom
    const kr = new T.CatmullRomCurve3([V(kx, ky - 0.4, kz), V(kx + 0.4, ky + 3, kz), V(kx + 2.2, ky + 6, kz - 0.6), V(kx + 4.8, ky + 8.2, kz - 2.2), V(kx + 8, ky + 8.8, kz - 3.5)]);
    daj(KMEN, new T.TubeGeometry(kr, 14, 0.5, 7));
    for (let i = 0; i < 3; i++) kus(i % 2 ? KORUNA : KORUNA2, IKO, kx + 5 + i * 1.5, ky + 8.6 + i * 0.3, kz - 2.5 - i * 0.6, 0, r() * 6, 0, 3, 1.2, 3);
    kol.push([kx, kz, 0.9]);
  }

  // ---------- rozbite kanoe stroskotancov na severovychodnej plazi + ich veci ----------
  {
    let d = 200; const uhol = -0.62, ux = Math.cos(uhol), uz = Math.sin(uhol);
    while (d > 0 && h0(35 + ux * d, 15 + uz * d) < 1.25) d -= 1;
    const x = 35 + ux * (d + 0.5), z = 15 + uz * (d + 0.5), y = vys(x, z);
    const trup = new T.SphereGeometry(1, 12, 6, 0, 6.283, Math.PI / 2, Math.PI / 2);
    kus(M(0x7b5a38, { side: T.DoubleSide }), trup, x, y + 0.45, z, 0.18, 0.6, -0.12, 0.62, 0.55, 2.3);
    for (let i = -3; i <= 3; i++) {                                                                               // rebra, nektore zlomene
      const t = i * 0.55, rx = x + Math.sin(0.6) * t, rz = z + Math.cos(0.6) * t;
      tyc(DREVO2, [rx - Math.cos(0.6) * 0.55, y + 0.5, rz + Math.sin(0.6) * 0.55], [rx - Math.cos(0.6) * 0.2, y + 0.9 - (i % 2) * 0.35, rz + Math.sin(0.6) * 0.2], 0.04, 0.03, 4);
    }
    tyc(DREVO, [x + 1.5, y + 0.1, z - 0.6], [x + 3.4, y + 0.14, z + 0.9], 0.05, 0.05, 5);                         // zlomene padlo
    kus(M(0x9a7048), KOCKA, x - 2.2, y + 0.3, z + 1.8, 0, 0.5, 0.1, 0.8, 0.55, 0.55);                              // debna
    kus(M(0x86603c), KOCKA, x - 3.0, y + 0.22, z + 2.5, 0, 1.1, 0, 0.6, 0.4, 0.5);
    kus(LANO, new T.TorusGeometry(0.4, 0.05, 5, 12), x + 1.2, y + 0.07, z + 2.6, Math.PI / 2, 0, 0);
    for (let i = 0; i < 5; i++) { const a = x + 3 + r() * 2, b = z - 2 + r() * 3; tyc(KOST2, [a, vys(a, b) + 0.05, b], [a + 0.5, vys(a, b) + 0.1, b + 0.2], 0.04, 0.05, 5); }
    kol.push([x, z, 1.5, { yMax: 1.4 }], [x - 2.5, z + 2, 0.8, { yMax: 1 }]);
  }

  // ---------- svietiace huby: cesta k vchodu jaskyne v noci (bledy cyan svit, bloom) + kosti a totemy pri vchode ----------
  {
    const trs = (x, z, n, vel) => {
      const y0 = vys(x, z);
      if (y0 < -1.3) return;
      for (let i = 0; i < n; i++) {
        const a = r() * 6.283, d = r() * 0.9, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, py = vys(px, pz);
        if (py < -1.3) continue;
        const v = vel * (0.5 + r() * 0.9);
        tyc(HUBA_N, [px, py - 0.03, pz], [px, py + v * 1.3, pz], v * 0.16, v * 0.12, 5);
        kus(r() < 0.65 ? HUBA_S : HUBA_N, new T.SphereGeometry(1, 8, 4, 0, 6.29, 0, 1.6), px, py + v * 1.3, pz, 0, 0, 0, v * 0.55, v * 0.32, v * 0.55);
      }
    };
    // 1) pozdlz stop od plaze az k vchodu (posledne 2/3 trasy) - hustejsie bliz k jaskyni
    const st = MIESTA.stopy;
    for (let i = 4; i < st.length; i++) {
      const [ax, az] = st[i - 1], [bx, bz] = st[i], d = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / d, uz = (bz - az) / d;
      for (let s = 1; s < d; s += 3.4 - i * 0.2) { const bok = (r() < 0.5 ? -1 : 1) * (1.2 + r() * 1.3); trs(ax + ux * s - uz * bok, az + uz * s + ux * bok, 3 + (i > 6 ? 3 : 0), 0.22); }
    }
    // 2) okolo vchodu: veniec hub po oboch stranach obluka (mikrobreh pod utesom)
    for (let i = 0; i < 16; i++) {
      const s = i % 2 ? 1 : -1, u = 2.4 + r() * 8, z = J.JZ - 1.5 - r() * 4 + Math.max(0, u - 9);
      trs(J.JX + s * u, z, 6, 0.5);
    }
    for (let i = 0; i < 10; i++) trs(J.JX + (r() - 0.5) * 3.2, J.JZ - 2.5 - i * 1.3, 3, 0.4);                   // svietiaca cestička priamo do vody pred vchodom
    // 2b) zaciatok lesneho chodnika od jaskyne: hubky po stranach
    for (let i = 1; i < 4; i++) {
      const [ax, az] = CESTY[0][i - 1], [bx, bz] = CESTY[0][i], d = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / d, uz = (bz - az) / d;
      for (let s = 2; s < d; s += 5) { const bok = (r() < 0.5 ? -1 : 1) * (2 + r() * 1.5); trs(ax + ux * s - uz * bok, az + uz * s + ux * bok, 3, 0.3); }
    }
    // 3) kostene totemy a znaky pri vchode (v mesacnom svite vidiet bledu kost)
    for (const [du, dz, vv] of [[-5.2, -3.4, 2.6], [5.0, -3.0, 2.2], [-9.5, -6.5, 2.0], [9.8, -5.5, 2.4]]) {
      const x = J.JX + du, z = J.JZ + dz, y = vys(x, z);
      if (y < -0.8) continue;
      tyc(DREVO, [x, y - 0.2, z], [x, y + vv, z], 0.07, 0.05, 5);
      kus(KOST, GULA, x, y + vv + 0.17, z, 0, 3.14 + du * 0.05, 0, 0.15, 0.2, 0.17);
      kus(OCKO, GULA, x - 0.05, y + vv + 0.2, z - 0.1, 0, 0, 0, 0.03, 0.03, 0.03); kus(OCKO, GULA, x + 0.05, y + vv + 0.2, z - 0.1, 0, 0, 0, 0.03, 0.03, 0.03);
      for (let k = 0; k < 6; k++) { const a = r() * 6.28; tyc(KOST2, [x + Math.cos(a) * 0.5, y + 0.05, z + Math.sin(a) * 0.5], [x + Math.cos(a) * 0.9, y + 0.1, z + Math.sin(a) * 0.9], 0.04, 0.05, 5); }
      kol.push([x, z, 0.2]);
    }
    // 4) vyhlady lesa: dve svietiace "oci" v tme medzi kmenmi (len odlesk; Bledi sa tu ukazu v C)
  }

  // ---------- zlucenie ----------
  const NETIEN = new Set([HUBA_S, HUBA_N, OCKO, HLINA, TMA]);
  for (const [mat, geos] of kopy) {
    for (const g of geos) if (!g.attributes.uv) g.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const g = mergeGeometries(geos); g.computeBoundingSphere();
    const m = new T.Mesh(g, mat);
    if (NETIEN.has(mat)) m.castShadow = false;
    objekty.push(m);
  }
  return { objekty, kolizie: kol, ukryty };
}
