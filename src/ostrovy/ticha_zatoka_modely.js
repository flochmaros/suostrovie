// Pamiatky Tichej zatoky (vsetky modely kodom): opustena chatka s prestretym stolom, hojdacia siet, dlhe stopy
// k utesu, vyrezane znaky, kosti v piesku, veci stroskotancov a vnutro jaskyne.
// Rovnaky material = 1 spojena siet (malo kresliacich volani). Pohybliva je len para zo salok a hojdacia siet.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as J from './ticha_zatoka_jaskyna.js';

// lokalne suradnice dolezitych miest (x vychod, z juh)
export const MIESTA = {
  chatka: [-14, -63],
  stol: [-17.2, -56.2],
  siet: [10, -42],
  // stopy: od stola popri lagune az do vody pod utesom (konci pri vchode do jaskyne)
  stopy: [[-18.6, -53.4], [-8, -49], [3, -45.5], [11, -34], [14, -19], [9, -5], [2, 9], [-3.5, 18], [-6.6, 23.2]],
  kostra: [-46, 5],
};
const ROT = 0.3;                         // natocenie chatky (predok smerom na juhozapad k lagune)

export function pamiatkyZatoky(P, h0) {
  const T = P.THREE, o3 = new T.Object3D(), r = P.rng(612), kol = [], objekty = [];
  const kopy = new Map();                // material -> geometrie
  const daj = (mat, geo) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!kopy.has(mat)) kopy.set(mat, []);
    kopy.get(mat).push(g);
  };
  // kus(material, geometria, poloha, otocenie, mierka)
  const kus = (mat, geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => {
    o3.position.set(x, y, z); o3.rotation.set(rx, ry, rz, 'YXZ'); o3.scale.set(sx, sy, sz); o3.updateMatrix();
    daj(mat, geo.clone().applyMatrix4(o3.matrix));
  };
  const V = (x, y, z) => new T.Vector3(x, y, z), HORE = V(0, 1, 0);
  // tyc medzi dvoma bodmi
  const tyc = (mat, a, b, ra, rb = ra, seg = 6) => {
    const A = V(...a), B = V(...b), d = B.clone().sub(A), l = d.length();
    const g = new T.CylinderGeometry(rb, ra, l, seg);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(HORE, d.normalize()));
    g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
    daj(mat, g);
  };
  // ohybana rura cez body
  const rura = (mat, body, r1, seg = 16, rad = 5) => daj(mat, new T.TubeGeometry(new T.CatmullRomCurve3(body.map(p => V(...p))), seg, r1, rad, false));

  // ---------- zakladne geometrie ----------
  const KOCKA = new T.BoxGeometry(1, 1, 1);
  const kvader = (mat, x, y, z, w, h, d, ry = 0, rx = 0, rz = 0) => kus(mat, KOCKA, x, y, z, rx, ry, rz, w, h, d);
  const GULA = new T.SphereGeometry(1, 10, 7), KAMENG = new T.DodecahedronGeometry(1, 0);
  const lathe = (body, seg = 14) => new T.LatheGeometry(body.map(([x, y]) => new T.Vector2(x, y)), seg);

  // ---------- materialy ----------
  const M = (c, o) => P.mat(c, o);
  const DOSKA = M(0x9a7048), DOSKA2 = M(0x86603c), DOSKA3 = M(0xab8256), TMAVE = M(0x553a24),
    SLAMA = M(0xc29a48, { side: T.DoubleSide }), SLAMA2 = M(0x96742e, { side: T.DoubleSide }), SLAMA3 = M(0x7a5c24, { side: T.DoubleSide }),
    LANO = M(0xd9c79c), LATKA = M(0xf4ecd8, { side: T.DoubleSide }), CERVENA = M(0xc9503c, { side: T.DoubleSide }),
    MODRA = M(0x3f78a8, { side: T.DoubleSide }), ZELENA = M(0x5f8a52, { side: T.DoubleSide }),
    PORCELAN = M(0xfaf7ee, { roughness: 0.3, side: T.DoubleSide }), PORC_MODRA = M(0x3a5fa8, { roughness: 0.35 }),
    CAJ = M(0x7a3e14, { roughness: 0.2 }), CHLIEB = M(0xd09a52), CHLIEB2 = M(0xecca8c), OVOCIE = M(0xc22f3f, { roughness: 0.5 }),
    RYBA = M(0xaebdc4, { roughness: 0.45 }), KOV = M(0x6b6a66, { roughness: 0.45, metalness: 0.6 }),
    SKLO = M(0xcfe8e4, { roughness: 0.1, transparent: true, opacity: 0.5 }), KNIHA = M(0x7a3128), PAPIER = M(0xeee2c2, { side: T.DoubleSide }),
    PLAMEN = M(0xffd58a, { emissive: 0xffa030, emissiveIntensity: 3 }), VOSK = M(0xf3e8c6),
    KMEN = M(0x8a6a45), KMEN2 = M(0x77593a), LIST = M(0x4f9c34, { side: T.DoubleSide }), LIST2 = M(0x6cb83e, { side: T.DoubleSide }),
    KOKOS = M(0x6e4c28), KVET = M(0xfff6e6, { side: T.DoubleSide }), KVET_Z = M(0xffc83c), KVET_R = M(0xf2648c, { side: T.DoubleSide }),
    VETVA = M(0x9c8a74),
    STOPA = M(0xb89c6c, { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    STOPA_D = M(0x8f7650, { polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }),
    REZBA = M(0xd8b882), REZBA_T = M(0x3a2514), KOST = M(0xe9e0c8), KOST2 = M(0xd3c6a4), TMA = M(0x14100c),
    KOZA = M(0x7c4a26), KOZA2 = M(0x5e371c), BATOH = M(0x76703e), BATOH2 = M(0x5d5830),
    // jaskyna
    KAMEN_J = M(0x5a544c, { flatShading: true, envMapIntensity: 0.05 }), KAMEN_J2 = M(0x766c5e, { flatShading: true, envMapIntensity: 0.05 }),
    HUBA_S = M(0x1c5a52, { emissive: 0x30e0c0, emissiveIntensity: 1.3 }), HUBA_N = M(0x2c6a62, { emissive: 0x2aa890, emissiveIntensity: 0.5 }),
    ZNAK_J = M(0xcfd8c0, { emissive: 0x9ab8a0, emissiveIntensity: 0.35 }), SUCHE = M(0x6e6038, { side: T.DoubleSide, envMapIntensity: 0.05 }),
    SUCHE2 = M(0x857446, { side: T.DoubleSide, envMapIntensity: 0.05 }), MLAKA = M(0x0e1816, { roughness: 0.12, envMapIntensity: 0.1 }),
    TRUHLA = M(0x4a2f1c), ZLATO = M(0xd8a83c, { metalness: 0.7, roughness: 0.35, emissive: 0x806010, emissiveIntensity: 0.6 });

  // ---------- palma s vlastnym tvarom (pre siet a vyrezane znaky) ----------
  function palma(x, z, vyska, nax, naz, r0 = 0.26, listy = true) {
    const y = P.vyska(x, z) - 0.7, bod = t => [x + nax * t * t, y + (vyska + 0.45) * t, z + naz * t * t];
    const N = 9;
    for (let i = 0; i < N; i++) {
      const a = bod(i / N), b = bod((i + 1) / N), rr = r0 * (1 - 0.45 * i / N);
      tyc(i % 2 ? KMEN : KMEN2, a, b, rr * 1.07, rr * 0.9, 8);
    }
    kol.push([x, z, r0 + 0.08]);
    if (!listy) return bod;
    const [tx, ty, tz] = bod(1);
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 + r() * 0.4, dl = 2.8 + r() * 1.1, hore = 0.5 + r() * 0.9;
      // list = pas trojuholnikov pozdlz obluka so zubatymi okrajmi
      const poz = [], S = 12;
      const stred = t => V(tx + Math.cos(a) * dl * t, ty + hore * Math.sin(t * Math.PI * 0.75) - 1.7 * t * t, tz + Math.sin(a) * dl * t);
      const bok = V(-Math.sin(a), 0, Math.cos(a));
      for (let s = 0; s < S; s++) {
        const t0 = s / S, t1 = (s + 1) / S, p0 = stred(t0), p1 = stred(t1);
        for (const zn of [-1, 1]) {
          const w = 0.75 * Math.sin(Math.min(1, t0 * 0.9 + 0.1) * Math.PI);
          const q = stred(Math.min(1, t0 + 0.13)).addScaledVector(bok, zn * w).add(V(0, -w * 0.35, 0));
          poz.push(p0.x, p0.y, p0.z, q.x, q.y, q.z, p1.x, p1.y, p1.z);
        }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(poz, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(poz.length / 3 * 2), 2));
      g.computeVertexNormals();
      daj(i % 2 ? LIST : LIST2, g);
    }
    for (let i = 0; i < 4; i++) kus(KOKOS, GULA, tx + Math.cos(i * 1.7) * 0.26, ty - 0.25, tz + Math.sin(i * 1.7) * 0.26, 0, 0, 0, 0.2);
    return bod;
  }

  // =====================================================================================
  // CHATKA: a = doprava, b = dopredu (k lagune); drevena, slamena strecha, otvorene dvere
  // =====================================================================================
  const [CX, CZ] = MIESTA.chatka, cR = Math.cos(ROT), sR = Math.sin(ROT), GY = P.vyska(CX, CZ), Y = GY + 0.14;
  const ch = (a, y, b) => [CX + a * cR - b * sR, y, CZ + a * sR + b * cR];       // lokalne chatky -> ostrov
  const chRy = -ROT;
  const cbox = (mat, a, y, b, w, h, d, ry = 0, rx = 0, rz = 0) => { const [x, , z] = ch(a, 0, b); kvader(mat, x, y, z, w, h, d, chRy + ry, rx, rz); };
  const ctyc = (mat, a, b, ra, rb = ra, seg = 6) => tyc(mat, ch(...a), ch(...b), ra, rb, seg);
  const chKol = (a, b, rr) => { const [x, , z] = ch(a, 0, b); kol.push([x, z, rr]); };
  const SW = 2.6, SD = 1.9, VS = 2.35;                                             // polsirka, polhlbka, vyska stien

  // podlaha + veranda z dosiek
  for (let a = -SW, i = 0; a < SW + 0.01; a += 0.34, i++) cbox([DOSKA, DOSKA2, DOSKA3][i % 3], a, Y - 0.07, 0.7 + (r() - 0.5) * 0.06, 0.31, 0.12, SD * 2 + 1.5);
  cbox(TMAVE, 0, Y - 0.13, SD + 1.5, SW * 2 + 0.4, 0.14, 0.16);
  // stlpy
  for (const [a, b] of [[-SW, -SD], [SW, -SD], [-SW, SD], [SW, SD]]) ctyc(TMAVE, [a, GY - 0.3, b], [a, Y + VS + 0.1, b], 0.13, 0.12);
  for (const a of [-SW, SW]) { ctyc(TMAVE, [a, GY - 0.3, SD + 1.4], [a, Y + 2.06, SD + 1.4], 0.1, 0.09); chKol(a, SD + 1.4, 0.2); }
  // steny zo zvislych dosiek; otvory: [od, do, spodok, vrch]
  const stena = (a0, b0, a1, b1, otvory = []) => {
    const l = Math.hypot(a1 - a0, b1 - b0), n = Math.round(l / 0.24), uh = Math.atan2(b1 - b0, a1 - a0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, a = a0 + (a1 - a0) * t, b = b0 + (b1 - b0) * t, s = t * l;
      const mat = [DOSKA, DOSKA2, DOSKA3, DOSKA][Math.floor(r() * 4)];
      const vrch = VS + (r() - 0.5) * 0.07;
      const o = otvory.find(o => s > o[0] && s < o[1]);
      const pas = (y0, y1) => { if (y1 - y0 > 0.05) cbox(mat, a, Y + (y0 + y1) / 2, b, l / n - 0.025, y1 - y0, 0.09, -uh); };
      if (!o) pas(0, vrch); else { pas(0, o[2]); pas(o[3], vrch); }
      if (!o || o[2] > 0) { if (i % 2 === 0) chKol(a, b, 0.3); }
    }
    ctyc(TMAVE, [a0, Y + VS, b0], [a1, Y + VS, b1], 0.08);
    // ramy okien
    for (const o of otvory) {
      if (o[2] === 0) continue;
      const bod = (s, y) => [a0 + (a1 - a0) * s / l, Y + y, b0 + (b1 - b0) * s / l];
      for (const [p, q] of [[bod(o[0], o[2]), bod(o[1], o[2])], [bod(o[0], o[3]), bod(o[1], o[3])], [bod(o[0], o[2]), bod(o[0], o[3])],
        [bod(o[1], o[2]), bod(o[1], o[3])], [bod((o[0] + o[1]) / 2, o[2]), bod((o[0] + o[1]) / 2, o[3])]]) ctyc(TMAVE, p, q, 0.045);
    }
  };
  stena(-SW, -SD, SW, -SD, [[1.9, 3.3, 1.0, 1.75]]);                       // zadna s oknom
  stena(-SW, -SD, -SW, SD, [[1.2, 2.5, 1.0, 1.75]]);                       // lava
  stena(SW, -SD, SW, SD);                                                  // prava
  stena(-SW, SD, SW, SD, [[0.65, 1.85, 1.0, 1.8], [2.7, 4.2, 0, 2.05]]);   // predna: okno + dvere
  // otvorene dvere (pootvorene dovnutra)
  for (let i = 0; i < 5; i++) cbox(i % 2 ? DOSKA2 : DOSKA3, 0.12 + 0.06 + i * 0.12, Y + 1.0, SD - 0.05 - i * 0.235, 0.26, 1.98, 0.06, 1.1);
  cbox(TMAVE, 0.45, Y + 1.5, SD - 0.6, 1.25, 0.09, 0.1, 1.1);
  // okenice
  for (const a of [-2.08, -0.62]) cbox(MODRA, a, Y + 1.4, SD + 0.1, 0.4, 0.86, 0.06, a < -1.35 ? -0.35 : 0.35);
  // strecha: dve sikme plochy z vrstiev slamenych pasov + trsy na okraji
  const HRY = Y + VS + 1.55;
  for (const zn of [-1, 1]) {
    const okrajB = zn > 0 ? SD + 1.65 : -SD - 0.7, okrajY = zn > 0 ? Y + 2.0 : Y + VS - 0.12;
    const sklon = Math.atan2(HRY - okrajY, Math.abs(okrajB));
    const dl = Math.hypot(HRY - okrajY, okrajB), RADY = 9;
    for (let i = 0; i < RADY; i++) {
      const t = (i + 0.5) / RADY, b = okrajB * (1 - t), y = okrajY + (HRY - okrajY) * t;
      cbox([SLAMA, SLAMA2, SLAMA][i % 3], 0, y + 0.06 + (i % 2) * 0.015, b, SW * 2 + 0.9 - (i % 2) * 0.1, 0.09, dl / RADY * 1.35, 0, zn * (sklon + 0.07));
      for (let a = -SW - 0.4; a <= SW + 0.4; a += 0.17) {
        if (r() < 0.45 && i > 0) continue;
        const [x, , z] = ch(a + (r() - 0.5) * 0.1, 0, b + zn * dl / RADY * 0.62 * Math.cos(sklon));
        kus([SLAMA, SLAMA2, SLAMA3][Math.floor(r() * 3)], new T.ConeGeometry(0.07, i === 0 ? 0.5 : 0.3, 3, 1, true),
          x, y - dl / RADY * 0.5 * Math.sin(sklon) + 0.03, z, -zn * (Math.PI / 2 - sklon) + Math.PI, chRy, (r() - 0.5) * 0.3);
      }
    }
    for (const a of [-SW - 0.2, SW + 0.2]) ctyc(TMAVE, [a, okrajY - 0.02, okrajB * 0.98], [a, HRY - 0.02, 0], 0.07);
  }
  ctyc(SLAMA3, [-SW - 0.5, HRY + 0.12, 0], [SW + 0.5, HRY + 0.12, 0], 0.17, 0.17, 8);
  // stity (trojuholniky z dosiek)
  for (const a of [-SW, SW]) for (let b = -SD + 0.12; b < SD; b += 0.24) {
    const vys = (HRY - Y - VS - 0.15) * (1 - Math.abs(b) / (SD + 0.15));
    if (vys > 0.1) cbox(b % 0.48 > 0 ? DOSKA : DOSKA2, a, Y + VS + vys / 2, b, 0.07, vys, 0.22);
  }
  // vnutro: postel so zhrnutou dekou, polica s pohármi, klobuk, stolik so sviečkou
  cbox(TMAVE, -1.7, Y + 0.28, -0.75, 1.0, 0.2, 2.05);
  cbox(LATKA, -1.7, Y + 0.45, -0.75, 0.94, 0.15, 1.95);
  { const [x, , z] = ch(-1.7, 0, -1.55); kus(LATKA, GULA, x, Y + 0.58, z, 0, chRy, 0, 0.36, 0.13, 0.22); }
  cbox(CERVENA, -1.72, Y + 0.55, -0.2, 1.02, 0.07, 0.9, 0.12, 0, 0.04);
  cbox(CERVENA, -1.2, Y + 0.38, 0.05, 0.07, 0.4, 0.7, 0.25, 0, 0.18);
  cbox(DOSKA2, 1.2, Y + 1.45, -SD + 0.22, 1.9, 0.07, 0.32);
  cbox(DOSKA2, 1.2, Y + 1.9, -SD + 0.2, 1.5, 0.06, 0.28);
  for (let i = 0; i < 6; i++) {
    const [x, , z] = ch(0.45 + i * 0.3, 0, -SD + 0.24), hh = 0.18 + r() * 0.16;
    kus(i % 3 ? SKLO : DOSKA3, new T.CylinderGeometry(0.09, 0.09, hh, 8), x, Y + 1.49 + hh / 2, z);
    if (i % 3) kus([OVOCIE, CHLIEB2, ZELENA][i % 3], new T.CylinderGeometry(0.075, 0.075, hh * 0.6, 8), x, Y + 1.49 + hh * 0.31, z);
  }
  cbox(DOSKA3, 1.9, Y + 0.5, 0.4, 0.7, 0.07, 0.7);
  for (const [a, b] of [[1.62, 0.12], [2.18, 0.12], [1.62, 0.68], [2.18, 0.68]]) ctyc(TMAVE, [a, Y, b], [a, Y + 0.48, b], 0.04);
  chKol(1.9, 0.4, 0.4); chKol(-1.7, -1.2, 0.5); chKol(-1.7, -0.3, 0.5);
  { const [x, , z] = ch(SW - 0.12, 0, -0.9);
    kus(SLAMA, new T.CylinderGeometry(0.36, 0.36, 0.03, 14), x, Y + 1.55, z, 0, chRy, Math.PI / 2);
    kus(SLAMA2, new T.CylinderGeometry(0.17, 0.2, 0.18, 12), x - 0.09 * cR, Y + 1.55, z - 0.09 * sR, 0, chRy, Math.PI / 2); }
  // lampas na verande
  { const [x, , z] = ch(SW - 0.35, 0, SD + 1.38), ly = Y + 1.55;
    tyc(LANO, [x, ly + 0.2, z], [x, Y + 1.98, z], 0.012);
    kus(KOV, new T.CylinderGeometry(0.13, 0.15, 0.06, 8), x, ly - 0.13, z);
    kus(SKLO, new T.CylinderGeometry(0.1, 0.1, 0.22, 8), x, ly, z);
    kus(KOV, new T.ConeGeometry(0.15, 0.12, 8), x, ly + 0.17, z); }
  // gula z mušlí na šnúrkach (zvonkohra)
  for (let i = 0; i < 6; i++) {
    const a = -SW + 0.35 + i * 0.13, dl = 0.35 + (i % 3) * 0.14;
    ctyc(LANO, [a, Y + 2.0, SD + 1.42], [a, Y + 2.0 - dl, SD + 1.42], 0.006);
    const [x, , z] = ch(a, 0, SD + 1.42);
    kus(i % 2 ? PORCELAN : KVET_R, new T.ConeGeometry(0.05, 0.11, 6), x, Y + 1.96 - dl, z, Math.PI);
  }
  // sud, bedna a metla pri stene
  { const [x, , z] = ch(SW + 0.6, 0, SD - 0.3), g = P.vyska(x, z);
    kus(DOSKA2, lathe([[0, 0], [0.34, 0], [0.43, 0.45], [0.34, 0.9], [0, 0.9]], 12), x, g - 0.03, z);
    for (const yy of [0.22, 0.68]) kus(KOV, new T.TorusGeometry(0.41, 0.025, 5, 16), x, g + yy, z, Math.PI / 2);
    kol.push([x, z, 0.45]);
    ctyc(DOSKA3, [SW + 0.12, GY, 0.2], [SW + 0.1, Y + 1.5, -0.1], 0.03);
    ctyc(SLAMA2, [SW + 0.13, GY, 0.2], [SW + 0.12, GY + 0.35, 0.14], 0.17, 0.04, 8); }

  // šnúra na prádlo: od chatky k suchemu stlpu
  { const A = ch(-SW, Y + 2.0, SD + 1.4), B = ch(-SW - 3.4, 0, SD + 0.6); const g = P.vyska(B[0], B[2]);
    tyc(TMAVE, [B[0], g - 0.2, B[2]], [B[0], g + 2.1, B[2]], 0.08, 0.06);
    kol.push([B[0], B[2], 0.2]);
    const bod = t => [A[0] + (B[0] - A[0]) * t, A[1] + (g + 2.0 - A[1]) * t - Math.sin(t * Math.PI) * 0.18, A[2] + (B[2] - A[2]) * t];
    rura(LANO, [0, 0.25, 0.5, 0.75, 1].map(bod), 0.012, 12, 4);
    const uh = -Math.atan2(B[2] - A[2], B[0] - A[0]);
    const [kx, ky, kz] = bod(0.32);                                    // kosela s rukavmi
    kvader(LATKA, kx, ky - 0.42, kz, 0.56, 0.8, 0.03, uh);
    for (const s of [-1, 1]) kvader(LATKA, kx + s * 0.37 * Math.cos(uh), ky - 0.28, kz - s * 0.37 * Math.sin(uh), 0.17, 0.58, 0.025, uh, 0, s * 0.45);
    const [nx, ny, nz] = bod(0.68);                                    // nohavice
    kvader(MODRA, nx, ny - 0.18, nz, 0.48, 0.3, 0.035, uh);
    for (const s of [-1, 1]) kvader(MODRA, nx + s * 0.13 * Math.cos(uh), ny - 0.62, nz - s * 0.13 * Math.sin(uh), 0.2, 0.62, 0.03, uh);
  }

  // =====================================================================================
  // PRESTRETY STOL - "niekto tu bol pred chvilou"
  // =====================================================================================
  const [SX, SZ] = MIESTA.stol, SY = P.vyska(SX, SZ), TY = SY + 0.8, uS = chRy;
  const st = (a, b) => [SX + a * cR - b * sR, SZ + a * sR + b * cR];
  const sbox = (mat, a, y, b, w, h, d, ry = 0, rx = 0, rz = 0) => { const [x, z] = st(a, b); kvader(mat, x, y, z, w, h, d, uS + ry, rx, rz); };
  const spol = (mat, geo, a, y, b, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => { const [x, z] = st(a, b); kus(mat, geo, x, y, z, rx, uS + ry, rz, sx, sy, sz); };
  sbox(DOSKA2, 0, TY - 0.05, 0, 1.85, 0.08, 1.05);
  for (const [a, b] of [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]]) { const [x, z] = st(a, b); tyc(TMAVE, [x, SY - 0.1, z], [x, TY - 0.08, z], 0.055, 0.07); }
  // obrus s cervenym lemom
  sbox(LATKA, 0, TY + 0.001, 0, 1.55, 0.012, 1.12);
  for (const b of [-0.565, 0.565]) { sbox(LATKA, 0, TY - 0.1, b, 1.55, 0.22, 0.012); sbox(CERVENA, 0, TY - 0.17, b * 1.012, 1.55, 0.045, 0.01); }
  for (const a of [-0.58, 0.58]) sbox(CERVENA, a, TY + 0.009, 0, 0.05, 0.004, 1.12);
  const SALKA = lathe([[0, 0.008], [0.036, 0.008], [0.058, 0.05], [0.064, 0.1], [0.057, 0.098], [0.05, 0.055], [0, 0.03]]);
  const TANIERIK = lathe([[0, 0.004], [0.07, 0.006], [0.1, 0.022], [0.097, 0.027], [0.065, 0.014], [0, 0.012]]);
  const TANIER = lathe([[0, 0.004], [0.13, 0.008], [0.175, 0.034], [0.17, 0.038], [0.12, 0.018], [0, 0.016]], 18);
  const salka = (a, b, uhol, plna = true) => {
    spol(PORCELAN, TANIERIK, a, TY + 0.006, b);
    spol(PORCELAN, SALKA, a, TY + 0.014, b);
    spol(PORC_MODRA, new T.TorusGeometry(0.062, 0.006, 4, 18), a, TY + 0.112, b, Math.PI / 2);
    spol(PORCELAN, new T.TorusGeometry(0.032, 0.01, 5, 12), a + Math.cos(uhol) * 0.074, TY + 0.07, b + Math.sin(uhol) * 0.074, 0, -uhol);
    if (plna) spol(CAJ, new T.CylinderGeometry(0.052, 0.052, 0.006, 14), a, TY + 0.09, b);
  };
  salka(-0.42, 0.3, 0.5); salka(0.5, 0.26, 2.4); salka(0.1, -0.34, -0.7);
  for (const [a, b] of [[-0.6, 0.04], [0.62, -0.08], [-0.18, -0.2]]) { spol(PORCELAN, TANIER, a, TY + 0.006, b); spol(PORC_MODRA, new T.TorusGeometry(0.168, 0.006, 4, 24), a, TY + 0.042, b, Math.PI / 2); }
  // rozjedene jedlo
  spol(CHLIEB, GULA, -0.6, TY + 0.075, 0.03, 0, 0.4, 0, 0.11, 0.065, 0.075);
  spol(CHLIEB2, new T.CylinderGeometry(0.062, 0.062, 0.012, 12), -0.5, TY + 0.07, 0.06, 0, 0.4, Math.PI / 2);
  spol(CHLIEB, new T.CylinderGeometry(0.06, 0.06, 0.025, 12), -0.4, TY + 0.025, -0.06);
  spol(RYBA, GULA, 0.62, TY + 0.05, -0.08, 0, 0.6, 0, 0.13, 0.03, 0.05);
  spol(RYBA, new T.ConeGeometry(0.045, 0.07, 3), 0.5, TY + 0.045, 0.0, 0, 0.6, -Math.PI / 2, 1, 1, 0.3);
  for (let i = 0; i < 11; i++) spol(OVOCIE, GULA, -0.18 + (r() - 0.5) * 0.17, TY + 0.045 + (i > 7 ? 0.04 : 0), -0.2 + (r() - 0.5) * 0.17, 0, 0, 0, 0.032);
  // lyzicky a vidlicka
  for (const [a, b, u] of [[-0.31, 0.36, 0.9], [0.34, 0.33, -0.3], [0.62, -0.27, 1.9], [0.27, -0.36, 0.2]]) {
    spol(KOV, KOCKA, a, TY + 0.015, b, 0, u, 0, 0.15, 0.008, 0.014); spol(KOV, GULA, a + Math.cos(u) * 0.085, TY + 0.016, b - Math.sin(u) * 0.085, 0, u, 0, 0.026, 0.007, 0.018);
  }
  // kanvica
  spol(PORCELAN, lathe([[0, 0], [0.09, 0], [0.145, 0.08], [0.13, 0.17], [0.07, 0.215], [0, 0.22]], 18), 0.15, TY + 0.006, 0.08);
  spol(PORC_MODRA, new T.TorusGeometry(0.147, 0.011, 4, 22), 0.15, TY + 0.093, 0.08, Math.PI / 2);
  spol(PORC_MODRA, GULA, 0.15, TY + 0.25, 0.08, 0, 0, 0, 0.026);
  { const [x, z] = st(0.15, 0.08), dx = cR, dz = sR;
    rura(PORCELAN, [[x + dx * 0.11, TY + 0.07, z + dz * 0.11], [x + dx * 0.2, TY + 0.13, z + dz * 0.2], [x + dx * 0.25, TY + 0.21, z + dz * 0.25]], 0.024, 8, 6);
    rura(PORCELAN, [[x - dx * 0.11, TY + 0.17, z - dz * 0.11], [x - dx * 0.22, TY + 0.13, z - dz * 0.22], [x - dx * 0.11, TY + 0.05, z - dz * 0.11]], 0.018, 10, 6); }
  // vaza s ibistekom
  spol(PORC_MODRA, lathe([[0, 0], [0.06, 0], [0.085, 0.09], [0.04, 0.19], [0.055, 0.22]]), -0.02, TY + 0.006, 0.31);
  for (const [da, db, dh] of [[-0.09, 0.02, 0.38], [0.07, -0.05, 0.44], [0.03, 0.08, 0.34]]) {
    const [x, z] = st(-0.02, 0.31), [x2, z2] = st(-0.02 + da, 0.31 + db);
    tyc(ZELENA, [x, TY + 0.18, z], [x2, TY + dh, z2], 0.008);
    for (let i = 0; i < 5; i++) { const a = i * 1.256; kus(da > 0 ? KVET : KVET_R, GULA, x2 + Math.cos(a) * 0.045, TY + dh, z2 + Math.sin(a) * 0.045, 0, -a, 0, 0.05, 0.012, 0.035); }
    kus(KVET_Z, GULA, x2, TY + dh + 0.012, z2, 0, 0, 0, 0.02);
  }
  // horiaca sviecka (stale!)
  spol(KOV, new T.CylinderGeometry(0.06, 0.075, 0.03, 10), -0.74, TY + 0.02, 0.33);
  spol(VOSK, new T.CylinderGeometry(0.028, 0.034, 0.11, 8), -0.74, TY + 0.09, 0.33);
  spol(PLAMEN, new T.ConeGeometry(0.018, 0.065, 7), -0.74, TY + 0.178, 0.33);
  // otvoreny dennik s perom
  for (const s of [-1, 1]) {
    spol(KNIHA, KOCKA, 0.36 + s * 0.11, TY + 0.016, -0.08, 0, -0.25, s * 0.07, 0.23, 0.012, 0.29);
    spol(PAPIER, KOCKA, 0.36 + s * 0.105, TY + 0.03, -0.08, 0, -0.25, s * 0.09, 0.2, 0.018, 0.26);
    for (let i = 0; i < (s < 0 ? 6 : 3); i++) spol(REZBA_T, KOCKA, 0.36 + s * 0.105 + i * 0.002, TY + 0.0415 + s * 0.0, -0.17 + i * 0.036, 0, -0.25, s * 0.09, 0.15 - (i % 3) * 0.02, 0.002, 0.007);
  }
  spol(PAPIER, new T.CylinderGeometry(0.005, 0.012, 0.2, 5), 0.52, TY + 0.05, -0.02, 0, 0.9, Math.PI / 2.1);
  kol.push([...st(-0.45, 0), 0.62], [...st(0.45, 0), 0.62]);

  // stolicky: odsunutá, prevrhnutá a jedna s prehodeným šálom
  function stolicka(a, b, otoc, spadnuta = false) {
    const [x, z] = st(a, b), g = P.vyska(x, z), zaklad = new T.Matrix4();
    const q = new T.Quaternion().setFromEuler(new T.Euler(spadnuta ? -Math.PI / 2 : 0, uS + otoc, 0, 'YXZ'));
    zaklad.compose(V(x, g + (spadnuta ? 0.25 : 0), z), q, V(1, 1, 1));
    const diel = (mat, px, py, pz, w, h, d) => {
      const geo = new T.BoxGeometry(w, h, d).translate(px, py, pz).applyMatrix4(zaklad);
      daj(mat, geo);
    };
    for (const [px, pz] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) diel(TMAVE, px, 0.23, pz, 0.06, 0.48, 0.06);
    for (let i = 0; i < 4; i++) diel(i % 2 ? DOSKA : DOSKA3, -0.18 + i * 0.12, 0.48, 0, 0.11, 0.05, 0.5);
    for (const px of [-0.22, 0.22]) diel(TMAVE, px, 0.77, -0.22, 0.06, 0.58, 0.05);
    for (const py of [0.78, 0.98]) diel(DOSKA, 0, py, -0.22, 0.44, 0.1, 0.035);
    if (!spadnuta) kol.push([x, z, 0.34]);
    return zaklad;
  }
  stolicka(-0.55, -0.86, 0.12);
  stolicka(1.55, 0.35, -1.1);                                   // odsunuta od stola a pootocena
  const lezi = stolicka(0.55, 1.35, 2.7, true);                 // prevrhnuta
  void lezi;
  { const z = stolicka(-1.28, 0.1, Math.PI / 2 + 0.2);
    for (const g of [new T.BoxGeometry(0.34, 0.06, 0.16).translate(0.04, 1.06, -0.22), new T.BoxGeometry(0.34, 0.62, 0.025).translate(0.04, 0.76, -0.27),
      new T.BoxGeometry(0.34, 0.34, 0.025).translate(0.04, 0.9, -0.17)]) daj(ZELENA, g.applyMatrix4(z)); }
  // spadnuta salka pod stolom + rozliaty caj
  { const [x, z] = st(0.95, 0.85), g = P.vyska(x, z);
    kus(PORCELAN, SALKA, x, g + 0.055, z, 0, 0.7, Math.PI / 2 + 0.12);
    kus(STOPA_D, GULA, x + 0.16, g + 0.012, z + 0.05, 0, 0.7, 0, 0.24, 0.006, 0.12); }

  // para zo salok a kanvice (jemne stupa) - "este je teply"
  {
    const geo = new T.SphereGeometry(1, 7, 5);
    [[-0.42, 0.3, 0.13], [0.5, 0.26, 0.13], [0.1, -0.34, 0.13], [0.42, 0.1, 0.24]].forEach(([a, b, hy], k) => {
      const [x, z] = st(a + (k === 3 ? -0.02 : 0), b);
      for (let i = 0; i < 4; i++) {
        const mat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
        const m = new T.Mesh(geo, mat);
        m.position.set(x, TY + hy, z); m.scale.setScalar(0.02); m.castShadow = false; m.frustumCulled = false;
        m.onBeforeRender = () => {
          const t = (performance.now() / 2600 + i / 4 + k * 0.17) % 1;
          m.position.set(x + Math.sin(t * 7 + k) * 0.035 * t, TY + hy + t * 0.34, z + Math.cos(t * 5 + i) * 0.025 * t);
          m.scale.set(0.016 + t * 0.035, 0.03 + t * 0.05, 0.016 + t * 0.035);
          m.updateMatrixWorld();
          mat.opacity = Math.sin(t * Math.PI) * 0.16;
        };
        objekty.push(m);
      }
    });
  }

  // =====================================================================================
  // kvitnuce stromceky (plumérie) a kvety okolo chatky - cez den ma byt vsetko rozkosne
  // =====================================================================================
  function plumeria(x, z, s) {
    const g = P.vyska(x, z) - 0.15;
    const vetva = (a, dlz, smer, naklon, hl) => {
      const b = [a[0] + Math.cos(smer) * Math.sin(naklon) * dlz, a[1] + Math.cos(naklon) * dlz, a[2] + Math.sin(smer) * Math.sin(naklon) * dlz];
      tyc(VETVA, a, b, 0.05 * s * (hl + 1), 0.035 * s * (hl + 1), 6);
      if (hl > 0) { for (let i = 0; i < 3; i++) vetva(b, dlz * 0.75, smer + i * 2.1 + r(), 0.45 + r() * 0.45, hl - 1); return; }
      for (let i = 0; i < 7; i++) { const u = i * 0.9 + r(); kus(i % 2 ? LIST : LIST2, GULA, b[0] + Math.cos(u) * 0.28 * s, b[1] - 0.05 + r() * 0.12, b[2] + Math.sin(u) * 0.28 * s, 0.2 - r() * 0.4, -u, 0, 0.3 * s, 0.03, 0.11 * s); }
      for (let k = 0; k < 5; k++) {
        const fx = b[0] + (r() - 0.5) * 0.42 * s, fy = b[1] + 0.08 + r() * 0.16, fz = b[2] + (r() - 0.5) * 0.42 * s, uk = r() * 6;
        for (let i = 0; i < 5; i++) { const u = uk + i * 1.256; kus(KVET, GULA, fx + Math.cos(u) * 0.055, fy, fz + Math.sin(u) * 0.055, 0, -u, 0.25, 0.06, 0.012, 0.038); }
        kus(KVET_Z, GULA, fx, fy + 0.012, fz, 0, 0, 0, 0.025);
      }
    };
    vetva([x, g, z], 1.35 * s, r() * 6, 0.12, 2);
    kol.push([x, z, 0.3]);
    for (let i = 0; i < 14; i++) {                                   // opadnute kvety na zemi
      const fx = x + (r() - 0.5) * 3.4, fz = z + (r() - 0.5) * 3.4;
      kus(KVET, GULA, fx, P.vyska(fx, fz) + 0.03, fz, 0, r() * 3, 0, 0.065, 0.012, 0.05);
    }
  }
  plumeria(CX + 5.4, CZ + 0.6, 1.05);
  plumeria(CX - 6.6, CZ + 1.5, 0.9);
  plumeria(MIESTA.siet[0] + 3.2, MIESTA.siet[1] - 4.2, 1.1);
  // kamienkovy chodnik s lemom z musli od verandy k stolu
  for (let i = 0; i < 26; i++) {
    const t = i / 25, [ax, , az] = ch(0.9, 0, SD + 1.8), x = ax + (SX + 1.7 - ax) * t + (r() - 0.5) * 0.2, z = az + (SZ + 1.7 - az) * t;
    for (const s of [-1, 1]) kus(i % 3 ? PORCELAN : KVET_R, new T.ConeGeometry(0.07, 0.09, 6), x + s * 0.62, P.vyska(x + s * 0.62, z) + 0.03, z, 0, r() * 6, 0.7);
  }
  // dve fakle (zhasnute) pri verande
  for (const a of [-1.6, 2.0]) {
    const [x, , z] = ch(a, 0, SD + 2.3), g = P.vyska(x, z);
    tyc(KMEN2, [x, g - 0.2, z], [x, g + 1.5, z], 0.045, 0.04);
    tyc(SLAMA3, [x, g + 1.45, z], [x, g + 1.72, z], 0.07, 0.11, 7);
    kus(TMA, GULA, x, g + 1.72, z, 0, 0, 0, 0.09, 0.05, 0.09);
    kol.push([x, z, 0.15]);
  }

  // =====================================================================================
  // HOJDACIA SIET medzi palmami
  // =====================================================================================
  {
    const [hx, hz] = MIESTA.siet;
    const A = palma(hx - 2.9, hz + 0.3, 6.2, -1.7, 0.3), B = palma(hx + 2.9, hz - 0.3, 5.6, 1.6, -0.5);
    palma(hx + 5.2, hz + 2.4, 4.6, 0.9, 1.1, 0.2);
    const g = P.vyska(hx, hz), uy = g + 1.55;
    const bodNaKmeni = bod => { for (let t = 0; t <= 1; t += 0.01) { const p = bod(t); if (p[1] >= uy) return p; } return bod(0.3); };
    const L = V(...bodNaKmeni(A)), R2 = V(...bodNaKmeni(B));
    for (const p of [L, R2]) kus(LANO, new T.TorusGeometry(0.25, 0.035, 5, 14), p.x, p.y, p.z, Math.PI / 2);
    // siet je vo vlastnej skupine s osou medzi uzlami -> jemne sa hojda
    const stredS = L.clone().add(R2).multiplyScalar(0.5);
    const dl = L.distanceTo(R2), os = R2.clone().sub(L).normalize(), kolmo = V(-os.z, 0, os.x).normalize();
    const lana = [], latka = [];
    const bod = (t, w) => {                                            // t 0..1 pozdlz, w -1..1 napriec
      const jadro = P.smooth(0.08, 0.24, t) * P.smooth(0.92, 0.76, t), pre = Math.sin(t * Math.PI);
      return L.clone().lerp(R2, t).sub(stredS).addScaledVector(kolmo, w * 0.62 * jadro)
        .add(V(0, -pre * 0.78 - jadro * 0.1 + Math.abs(w) ** 2 * jadro * 0.24, 0));
    };
    const trubka = (pole, body, rr) => pole.push(new T.TubeGeometry(new T.CatmullRomCurve3(body), 24, rr, 4, false).toNonIndexed());
    for (let j = -4; j <= 4; j++) trubka(Math.abs(j) === 4 ? latka : lana, Array.from({ length: 17 }, (_, i) => bod(i / 16, j / 4)), Math.abs(j) === 4 ? 0.03 : 0.014);
    for (let i = 4; i <= 20; i++) trubka(i % 5 === 0 ? latka : lana, Array.from({ length: 9 }, (_, j) => bod(i / 24, j / 4 - 1)), 0.012);
    for (const t of [0.2, 0.8]) { const a = bod(t, -1.12), b = bod(t, 1.12); const s = new T.CylinderGeometry(0.035, 0.035, a.distanceTo(b), 6);
      s.applyQuaternion(new T.Quaternion().setFromUnitVectors(HORE, b.clone().sub(a).normalize())); s.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); lana.push(s.toNonIndexed()); }
    const vank = new T.SphereGeometry(1, 10, 7).scale(0.27, 0.11, 0.4).applyQuaternion(new T.Quaternion().setFromUnitVectors(V(1, 0, 0), os));
    const pv = bod(0.28, 0); vank.translate(pv.x, pv.y + 0.1, pv.z); latka.push(vank.toNonIndexed());
    const kyv = new T.Group(); kyv.position.copy(stredS);
    const mesh = new T.Mesh(mergeGeometries(lana), LANO), mesh2 = new T.Mesh(mergeGeometries(latka), CERVENA);
    kyv.add(mesh, mesh2);
    mesh.frustumCulled = false;
    mesh.onBeforeRender = () => { const t = performance.now() / 1000; kyv.quaternion.setFromAxisAngle(os, Math.sin(t * 1.25) * 0.09 + Math.sin(t * 0.53) * 0.04); kyv.updateMatrixWorld(true); };
    objekty.push(kyv);
    // klobuk, kokosovy pohar so slamkou a otvorena kniha pod sietou
    const gk = P.vyska(hx - 0.6, hz + 1.1);
    kus(SLAMA, new T.CylinderGeometry(0.37, 0.4, 0.035, 16), hx - 0.6, gk + 0.05, hz + 1.1, 0.12, 0, 0.08);
    kus(SLAMA2, new T.CylinderGeometry(0.17, 0.21, 0.19, 14), hx - 0.6, gk + 0.15, hz + 1.1, 0.12, 0, 0.08);
    kus(CERVENA, new T.CylinderGeometry(0.208, 0.214, 0.05, 14), hx - 0.6, gk + 0.095, hz + 1.1, 0.12, 0, 0.08);
    const gp = P.vyska(hx + 0.7, hz + 0.9);
    kus(KOKOS, new T.SphereGeometry(0.15, 10, 7, 0, 6.29, 1.1, 2.04), hx + 0.7, gp + 0.13, hz + 0.9);
    kus(LATKA, new T.CylinderGeometry(0.12, 0.12, 0.01, 12), hx + 0.7, gp + 0.18, hz + 0.9);
    tyc(CERVENA, [hx + 0.7, gp + 0.16, hz + 0.9], [hx + 0.84, gp + 0.42, hz + 0.92], 0.012);
  }

  // =====================================================================================
  // DLHE UZKE STOPY - od stola popri lagune az pod utes
  // =====================================================================================
  {
    const chodidlo = new T.CircleGeometry(1, 12).rotateX(-Math.PI / 2);
    const body = MIESTA.stopy;
    let zvysok = 0, strana = 1;
    for (let i = 1; i < body.length; i++) {
      const [ax, az] = body[i - 1], [bx, bz] = body[i], d = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / d, uz = (bz - az) / d;
      let s = zvysok;
      for (; s < d; s += 1.25 + r() * 0.2) {                          // dlhy krok = vysoky "niekto"
        strana = -strana;
        const x = ax + ux * s - uz * strana * 0.24, z = az + uz * s + ux * strana * 0.24;
        const uhol = Math.atan2(ux, uz) + strana * 0.07;
        const ciast = (mat, dopredu, bok, w, dlz, nat = 0) => {
          const px = x + Math.sin(uhol) * dopredu + Math.cos(uhol) * bok, pz = z + Math.cos(uhol) * dopredu - Math.sin(uhol) * bok;
          const y = P.vyska(px, pz);
          const n = V(P.vyska(px - 0.2, pz) - P.vyska(px + 0.2, pz), 0.4, P.vyska(px, pz - 0.2) - P.vyska(px, pz + 0.2)).normalize();
          const q = new T.Quaternion().setFromUnitVectors(HORE, n).multiply(new T.Quaternion().setFromAxisAngle(HORE, uhol + nat));
          daj(mat, chodidlo.clone().applyMatrix4(new T.Matrix4().compose(V(px, y + 0.045, pz), q, V(w, 1, dlz))));
        };
        ciast(STOPA, 0, 0, 0.135, 0.31);                              // dlhe uzke chodidlo
        ciast(STOPA_D, -0.17, 0, 0.08, 0.11);                         // hlbsie miesta: pata a bruska
        ciast(STOPA_D, 0.13, 0, 0.105, 0.09);
        for (let p = -1; p <= 1; p++) ciast(STOPA_D, 0.41 - Math.abs(p) * 0.04, p * 0.085, 0.028, 0.15, p * 0.22);   // tri dlhe prsty
      }
      zvysok = s - d;
    }
  }

  // =====================================================================================
  // VYREZANE ZNAKY na kmenoch popri stopach
  // =====================================================================================
  {
    // znak sa kresli v rovine [bok, hore]; ciary = [x1, y1, x2, y2]
    const POSTAVA = [[0, -0.1, 0, 0.24], [0, 0.18, -0.09, 0.08], [-0.09, 0.08, -0.12, -0.24], [0, 0.18, 0.09, 0.08], [0.09, 0.08, 0.12, -0.24],
      [0, -0.1, -0.05, -0.38], [0, -0.1, 0.05, -0.38], [-0.045, 0.28, 0, 0.35], [0, 0.35, 0.045, 0.28], [0.045, 0.28, 0, 0.23], [0, 0.23, -0.045, 0.28]];
    const CIARKY = [[-0.13, 0.14, -0.13, -0.14], [-0.065, 0.15, -0.065, -0.13], [0, 0.14, 0, -0.14], [0.065, 0.15, 0.065, -0.13], [-0.17, -0.09, 0.11, 0.09]];
    const OKO = [[-0.16, 0, -0.07, 0.08], [-0.07, 0.08, 0.07, 0.08], [0.07, 0.08, 0.16, 0], [0.16, 0, 0.07, -0.08], [0.07, -0.08, -0.07, -0.08], [-0.07, -0.08, -0.16, 0],
      [-0.03, 0, 0.03, 0], [0, -0.03, 0, 0.03], [0, -0.1, 0, -0.28]];
    const DOLE = [[0, 0.22, 0, -0.2], [0, -0.2, -0.1, -0.07], [0, -0.2, 0.1, -0.07], [-0.14, -0.28, -0.05, -0.24], [-0.05, -0.24, 0.05, -0.29], [0.05, -0.29, 0.14, -0.25]];
    for (const [x, z, smerX, smerZ, znaky] of [[-4.2, -51.8, -0.5, 1, [OKO]], [14.6, -35.2, -1, -0.2, [CIARKY, CIARKY]], [17.4, -17, -1, 0.1, [POSTAVA]],
      [5.4, 10.6, -0.9, -0.5, [POSTAVA, CIARKY]], [2.6, 19, -1, -0.3, [DOLE, POSTAVA]]]) {
      const bod = palma(x, z, 4.8 + r(), -smerX * 0.7, -smerZ * 0.7, 0.3);
      const l = Math.hypot(smerX, smerZ), nx = smerX / l, nz = smerZ / l;
      znaky.forEach((znak, k) => {
        const yz = P.vyska(x, z) + 1.55 - k * 0.72;
        let t = 0; while (bod(t)[1] < yz && t < 1) t += 0.01;
        const [px, , pz] = bod(t), rr = 0.3 * (1 - 0.45 * t) * 1.08 + 0.012;
        // ošúpaná kôra = svetlejšie drevo, do neho tmavé ryhy
        const uh = Math.atan2(nx, nz);
        daj(REZBA, new T.CylinderGeometry(rr, rr * 1.02, 0.76, 10, 1, true, uh - 0.78, 1.56).translate(px, yz, pz));
        for (const [x1, y1, x2, y2] of znak) {
          const na = (bx, by) => { const a = uh + bx / rr, q = rr + 0.012; return [px + Math.sin(a) * q, yz + by, pz + Math.cos(a) * q]; };
          tyc(REZBA_T, na(x1, y1), na(x2, y2), 0.017, 0.012, 4);
        }
      });
    }
  }

  // =====================================================================================
  // KOSTI napoly v piesku (cez den pod plytkou vodou, pri odlive na suchu)
  // =====================================================================================
  {
    const kost = (x, z, uhol, dl, hr, naklon = 0.12) => {
      const y = P.vyska(x, z) + hr * 0.4, dx = Math.cos(uhol) * dl / 2, dz = Math.sin(uhol) * dl / 2;
      const a = [x - dx, y - naklon * dl * 0.5, z - dz], b = [x + dx, y + naklon * dl * 0.5, z + dz];
      tyc(KOST, a, b, hr, hr * 0.8, 7);
      for (const p of [a, b]) for (const s of [-1, 1]) kus(KOST2, GULA, p[0] - Math.sin(uhol) * s * hr * 0.8, p[1], p[2] + Math.cos(uhol) * s * hr * 0.8, 0, 0, 0, hr * 1.25);
    };
    // velky hrudny kos neznameho zvierata
    const [kx, kz] = MIESTA.kostra, U = 0.7, du = [Math.cos(U), Math.sin(U)], db = [-Math.sin(U), Math.cos(U)];
    for (let i = 0; i < 12; i++) {
      const s = -2 + i * 0.36, x = kx + du[0] * s, z = kz + du[1] * s, y = P.vyska(x, z);
      kus(KOST2, GULA, x, y + 0.14, z, 0, -U, 0, 0.17, 0.12, 0.12);
      kus(KOST, new T.ConeGeometry(0.045, 0.24, 5), x, y + 0.3, z, 0, -U, -0.4);
      if (i < 1 || i > 9) continue;
      const vel = 0.55 + 0.55 * Math.sin((i - 0.5) / 10 * Math.PI);
      for (const zn of [-1, 1]) {
        if (r() < 0.18) continue;
        const b = (o, hr) => [x + db[0] * zn * o + du[0] * 0.12 * hr, y + hr, z + db[1] * zn * o + du[1] * 0.12 * hr];
        rura(KOST, [b(0.08, 0.14), b(0.6 * vel, 0.62 * vel), b(0.98 * vel, 0.42 * vel), b(1.06 * vel, -0.2)], 0.055, 10, 5);
      }
    }
    // lebka s dlhym cenichom a prazdnymi jamkami
    { const x = kx + du[0] * 2.75, z = kz + du[1] * 2.75, y = P.vyska(x, z);
      kus(KOST, GULA, x, y + 0.2, z, 0, -U, -0.18, 0.4, 0.27, 0.32);
      kus(KOST, new T.CylinderGeometry(0.09, 0.19, 0.72, 8), x + du[0] * 0.55, y + 0.13, z + du[1] * 0.55, 0, -U, -Math.PI / 2 - 0.12);
      for (const zn of [-1, 1]) {
        kus(TMA, GULA, x + du[0] * 0.2 + db[0] * zn * 0.23, y + 0.28, z + du[1] * 0.2 + db[1] * zn * 0.23, 0, -U, 0, 0.1, 0.085, 0.095);
        for (let i = 0; i < 5; i++) kus(KOST2, new T.ConeGeometry(0.022, 0.09, 4), x + du[0] * (0.45 + i * 0.1) + db[0] * zn * (0.14 - i * 0.016), y + 0.03, z + du[1] * (0.45 + i * 0.1) + db[1] * zn * (0.14 - i * 0.016), Math.PI);
      } }
    // roztrusene kosti popri brehoch laguny
    for (const [x, z] of [[-49.5, 6.5], [-42, 9.4], [-22, 4], [-17.5, 8], [-11, 17], [-55, -34], [-2, -22], [-27, -43.5], [3, 3], [-62, -8]]) {
      kost(x, z, r() * 6, 0.5 + r() * 0.55, 0.045 + r() * 0.025);
      if (r() < 0.6) kost(x + (r() - 0.5) * 1.2, z + (r() - 0.5) * 1.2, r() * 6, 0.28 + r() * 0.3, 0.032);
    }
  }

  // =====================================================================================
  // VECI Z INYCH STROSKOTANCOV: topanka, rozbita lampa, batoh, detska lodka
  // =====================================================================================
  {
    // kozena topanka na boku
    { const x = 12.2, z = -27, y = P.vyska(x, z);
      kus(KOZA, GULA, x, y + 0.1, z, 0.3, 0.6, 0, 0.13, 0.12, 0.25);
      kus(KOZA, new T.CylinderGeometry(0.1, 0.12, 0.3, 10, 1, true), x - 0.09, y + 0.24, z - 0.12, 0.2, 0.6, 0.35);
      kus(TMA, new T.CircleGeometry(0.095, 10), x - 0.135, y + 0.375, z - 0.11, -Math.PI / 2 + 0.2, 0.6, 0.35);
      kus(KOZA2, GULA, x + 0.015, y + 0.045, z + 0.02, 0.3, 0.6, 0, 0.14, 0.045, 0.27);
      for (let i = 0; i < 3; i++) tyc(LANO, [x - 0.06, y + 0.2 - i * 0.012, z + 0.02 + i * 0.06], [x + 0.06, y + 0.215 - i * 0.012, z - 0.02 + i * 0.06], 0.008);
      tyc(LANO, [x + 0.05, y + 0.2, z + 0.12], [x + 0.3, y + 0.02, z + 0.3], 0.008); }
    // rozbita lampa so crepmi
    { const x = 7.6, z = 3.2, y = P.vyska(x, z);
      kus(KOV, new T.CylinderGeometry(0.17, 0.2, 0.09, 10), x, y + 0.13, z, 0, 0.4, 1.25);
      kus(SKLO, new T.CylinderGeometry(0.14, 0.14, 0.28, 10, 1, true, 0, 3.9), x + 0.17, y + 0.16, z - 0.07, 0, 0.4, 1.25);
      for (const o of [-0.13, 0.13]) tyc(KOV, [x + 0.02, y + 0.14 + o, z], [x + 0.36, y + 0.12 + o * 0.8, z - 0.15], 0.012);
      kus(KOV, new T.ConeGeometry(0.19, 0.15, 10), x + 0.43, y + 0.1, z - 0.18, 0, 0.4, -1.75);
      kus(KOV, new T.TorusGeometry(0.12, 0.014, 5, 14), x + 0.6, y + 0.03, z - 0.2, Math.PI / 2 - 0.1, 0.3, 0);
      for (let i = 0; i < 9; i++) kus(SKLO, new T.ConeGeometry(0.04 + r() * 0.04, 0.014, 3), x + (r() - 0.4) * 0.9, y + 0.04, z + (r() - 0.5) * 0.7, (r() - 0.5) * 0.5, r() * 6, (r() - 0.5) * 0.5); }
    // batoh s otvorenym vekom a vysypanymi vecami
    { const x = 13.4, z = -11, y = P.vyska(x, z);
      kus(BATOH, new T.CapsuleGeometry(0.24, 0.22, 4, 10), x, y + 0.3, z, -0.25, -0.9, 0.12, 1.1, 1, 0.75);
      kus(BATOH2, KOCKA, x - 0.02, y + 0.67, z - 0.16, -0.95, -0.9, 0.12, 0.5, 0.05, 0.34);
      kus(BATOH2, KOCKA, x - 0.14, y + 0.24, z + 0.11, -0.25, -0.9, 0.12, 0.3, 0.24, 0.1);
      for (const s of [-1, 1]) rura(KOZA2, [[x + 0.12, y + 0.55, z + s * 0.12], [x + 0.36, y + 0.35, z + s * 0.19], [x + 0.2, y + 0.1, z + s * 0.14]], 0.022, 10, 5);
      kus(CERVENA, KOCKA, x - 0.55, y + 0.06, z + 0.35, 0, 0.5, 0.05, 0.45, 0.07, 0.3);
      kus(PAPIER, KOCKA, x - 0.62, y + 0.11, z + 0.35, 0, 0.9, 0, 0.26, 0.012, 0.34);
      kus(KOV, new T.CylinderGeometry(0.09, 0.09, 0.28, 10), x - 0.35, y + 0.09, z + 0.62, 0, 0.2, Math.PI / 2);
      kus(KOZA, new T.TorusGeometry(0.075, 0.016, 5, 14), x - 0.8, y + 0.035, z + 0.1, Math.PI / 2); }
    // detska drevena lodka s plachtickou
    { const x = -30.5, z = -46, y = P.vyska(x, z);
      kus(DOSKA3, GULA, x, y + 0.09, z, 0.1, 1.9, 0.22, 0.14, 0.09, 0.38);
      tyc(DOSKA2, [x, y + 0.13, z], [x + 0.08, y + 0.55, z], 0.016);
      kus(CERVENA, new T.ConeGeometry(0.17, 0.32, 3), x + 0.07, y + 0.38, z, 0, 1.9, 0.18, 1, 1, 0.06);
      rura(LANO, [[x - 0.3, y + 0.12, z + 0.1], [x - 0.6, y + 0.03, z + 0.02], [x - 0.9, y + 0.03, z + 0.3]], 0.008, 12, 4); }
  }

  // =====================================================================================
  // VNUTRO JASKYNE
  // =====================================================================================
  {
    const { JX, JZ, os, sirka, podlaha, povrch } = J;
    const naPodlahe = (v, du) => [JX + os(v) + du, podlaha(v) + 0.06, JZ + v];
    // stalaktity (zo stropu) a stalagmity (pri stenach)
    for (let i = 0; i < 90; i++) {
      const v = 2 + r() * 36.5, a = 0.75 + r() * 1.65, [x, y, z] = povrch(v, a, 1.02);
      const dl = 0.2 + r() * r() * (v > 23 ? 1.5 : 0.7);
      if (v < 23 && y - dl < podlaha(v) + 2.15) continue;             // v chodbe nesmu visiet do hlavy
      kus(r() < 0.5 ? KAMEN_J : KAMEN_J2, new T.ConeGeometry(0.06 + dl * 0.14, dl, 5), x, y - dl / 2 + 0.06, z, Math.PI + (r() - 0.5) * 0.15, r() * 3, (r() - 0.5) * 0.15);
    }
    for (let i = 0; i < 46; i++) {
      const v = 3 + r() * 35.5, s = r() < 0.5 ? -1 : 1, [x, y, z] = naPodlahe(v, s * sirka(v) * (0.86 + r() * 0.16));
      const dl = 0.25 + r() * r() * 1.3;
      kus(r() < 0.5 ? KAMEN_J : KAMEN_J2, new T.ConeGeometry(0.12 + dl * 0.17, dl, 6), x, y + dl / 2 - 0.08, z, (r() - 0.5) * 0.12, r() * 3, (r() - 0.5) * 0.12);
      if (r() < 0.6) kus(KAMEN_J, KAMENG, x + (r() - 0.5) * 0.7, y + 0.05, z + (r() - 0.5) * 0.7, r(), r() * 3, r(), 0.14 + r() * 0.2);
    }
    // svetielkujuce huby: trsy pri stenach (jedine svetlo, ktore ukazuje cestu)
    for (const [v, s, n] of [[3.5, 1, 5], [7, -1, 8], [11.5, 1, 6], [15, -1, 4], [19, 1, 9], [22.5, -1, 7], [25.5, 1, 10], [28, -1, 7], [31, 1, 8], [33.5, -1, 11], [36, 1, 7], [37.5, -1, 6]]) {
      for (let i = 0; i < n; i++) {
        const vv = v + (r() - 0.5) * 1.5, vys = r() < 0.5, mat = r() < 0.6 ? HUBA_S : HUBA_N;
        const [x, y, z] = vys ? povrch(vv, s > 0 ? 0.12 + r() * 0.4 : Math.PI - 0.12 - r() * 0.4, 0.97) : naPodlahe(vv, s * sirka(vv) * (0.72 + r() * 0.2));
        const vel = 0.035 + r() * 0.07;
        tyc(HUBA_N, [x, y - 0.03, z], [x, y + vel * 1.4, z], vel * 0.18, vel * 0.14, 5);
        kus(mat, new T.SphereGeometry(1, 8, 4, 0, 6.29, 0, 1.6), x, y + vel * 1.4, z, 0, 0, 0, vel, vel * 0.65, vel);
      }
    }
    // mlaky na dne
    for (const [v, du, a] of [[6, 0.5, 0.9], [13, -0.6, 0.7], [20, 0.3, 1.1], [27, -2.6, 1.5], [34, 2.8, 1.2]]) {
      const [x, y, z] = naPodlahe(v, du);
      kus(MLAKA, new T.CircleGeometry(1, 18), x, y + 0.05, z, -Math.PI / 2, 0, 0, a, a * 0.7, 1);
    }
    // vyryte znaky na stenach (slabo svetielkuju)
    const znakNaStene = (v, a, vel, druh) => {
      const CARY = druh === 0 ? [[0, -0.1, 0, 0.3], [0, 0.22, -0.13, 0.05], [-0.13, 0.05, -0.15, -0.34], [0, 0.22, 0.13, 0.05], [0.13, 0.05, 0.15, -0.34], [0, -0.1, -0.06, -0.45], [0, -0.1, 0.06, -0.45], [-0.06, 0.35, 0, 0.45], [0, 0.45, 0.06, 0.35], [0.06, 0.35, -0.06, 0.35]]
        : druh === 1 ? [[-0.15, 0.2, -0.15, -0.2], [-0.07, 0.21, -0.07, -0.19], [0.01, 0.2, 0.01, -0.2], [0.09, 0.21, 0.09, -0.19], [-0.2, -0.12, 0.15, 0.12]]
          : [[-0.22, 0, -0.1, 0.12], [-0.1, 0.12, 0.1, 0.12], [0.1, 0.12, 0.22, 0], [0.22, 0, 0.1, -0.12], [0.1, -0.12, -0.1, -0.12], [-0.1, -0.12, -0.22, 0], [0, -0.06, 0, 0.06]];
      // bod na stene: vodorovne po hlbke, zvisle po uhle prierezu
      const na = (bx, by) => povrch(v + bx * vel * (a < 1.57 ? 1 : -1), a + (a < 1.57 ? 1 : -1) * by * vel * 0.34, 0.955);
      for (const [x1, y1, x2, y2] of CARY) tyc(ZNAK_J, na(x1, y1), na((x1 + x2) / 2, (y1 + y2) / 2), 0.017, 0.015, 4), tyc(ZNAK_J, na((x1 + x2) / 2, (y1 + y2) / 2), na(x2, y2), 0.015, 0.012, 4);
    };
    znakNaStene(9, 0.42, 1.0, 1); znakNaStene(17.5, 2.75, 1.0, 2); znakNaStene(27.5, 0.45, 1.5, 0); znakNaStene(29.2, 0.42, 1.2, 0);
    znakNaStene(30.6, 0.46, 0.9, 0); znakNaStene(30, 2.7, 1.3, 2); znakNaStene(32.5, 2.68, 1.4, 1); znakNaStene(34, 2.72, 1.4, 1); znakNaStene(34.5, 0.5, 1.6, 0);

    // kruh z plochych kamenov a na nich salky (z toho isteho servisu ako na stole!)
    const [mx, my, mz] = naPodlahe(30.5, 0);
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2, x = mx + Math.cos(a) * 2.1, z = mz + Math.sin(a) * 2.1;
      kus(KAMEN_J2, KAMENG, x, my + 0.06, z, 0, a, 0, 0.42, 0.17, 0.34);
      if (i % 2 === 0) { kus(PORCELAN, TANIERIK, x, my + 0.21, z); kus(PORCELAN, SALKA, x, my + 0.215, z, 0, a, i === 4 ? 1.4 : 0); kus(PORC_MODRA, new T.TorusGeometry(0.062, 0.006, 4, 16), x, my + 0.313, z, Math.PI / 2, 0, 0); }
    }
    // uprostred kopa topanok, klobukov a handier (zbierka veci po navstevnikoch)
    for (let i = 0; i < 14; i++) {
      const x = mx + (r() - 0.5) * 1.5, z = mz + (r() - 0.5) * 1.5, y = my + 0.06 + r() * 0.2, u = r() * 6;
      kus([KOZA, KOZA2, KOZA][i % 3], GULA, x, y, z, r() - 0.5, u, r() - 0.5, 0.11, 0.08, 0.2);
      kus(KOZA2, new T.CylinderGeometry(0.085, 0.1, 0.2, 8, 1, true), x - Math.sin(u) * 0.09, y + 0.11, z - Math.cos(u) * 0.09, r() - 0.5, u, r() - 0.5);
    }
    for (let i = 0; i < 7; i++) kus([BATOH, SUCHE, KOZA2][i % 3], KOCKA, mx + (r() - 0.5) * 2, my + 0.04 + i * 0.012, mz + (r() - 0.5) * 2, 0, r() * 3, (r() - 0.5) * 0.2, 0.5 + r() * 0.4, 0.04, 0.3 + r() * 0.2);
    // tri lozka zo suchych listov - priliz dlhe na cloveka (3 m)
    for (const [v, du, u] of [[28.5, -4.6, 0.25], [32.5, -4.4, -0.2], [30.5, 4.7, -0.1]]) {
      const [x, y, z] = naPodlahe(v, du);
      kus(SUCHE, GULA, x, y, z, 0, u, 0, 0.7, 0.12, 1.6);
      for (let i = 0; i < 60; i++) {
        const a = r() * 6.28, d = 0.65 + r() * 0.4;
        kus(i % 2 ? SUCHE : SUCHE2, GULA, x + Math.cos(a) * d * 0.75, y + 0.06 + r() * 0.12, z + Math.sin(a) * d * 1.65, (r() - 0.5) * 0.5, r() * 6, 0, 0.34, 0.016, 0.06);
      }
    }
    // povesene zvonkohry z kosticiek
    for (const [v, du] of [[23.5, 0.6], [27, -1.8], [29, 2.4], [33, -2.6], [34.5, 1.5], [12, -0.5]]) {
      const [x, , z] = naPodlahe(v, du), strop = podlaha(v) + J.vyskaStropu(v), dolny = podlaha(v) + 2.15 + r() * 0.5;
      tyc(LANO, [x, strop + 0.2, z], [x, dolny + 0.3, z], 0.006, 0.006, 3);
      tyc(KOST2, [x - 0.2, dolny + 0.3, z], [x + 0.2, dolny + 0.3, z], 0.018);
      for (let i = 0; i < 5; i++) {
        const bx = x - 0.18 + i * 0.09, d = 0.1 + r() * 0.18;
        tyc(LANO, [bx, dolny + 0.3, z], [bx, dolny + 0.3 - d, z], 0.003, 0.003, 3);
        tyc(KOST, [bx, dolny + 0.3 - d, z], [bx + (r() - 0.5) * 0.03, dolny + 0.12 - d, z], 0.016, 0.01, 5);
      }
    }
    // VYKLENOK vzadu: kamenny stupen a stara truhlica so zlatym kovanim (tu bude kluc od majaka 2)
    {
      const [x, y, z] = naPodlahe(37.1, 0);
      kvader(KAMEN_J2, x, y + 0.18, z + 0.1, 2.1, 0.4, 1.0, 0.05);
      kvader(KAMEN_J, x, y + 0.06, z - 0.5, 2.6, 0.16, 0.5, -0.04);
      kvader(TRUHLA, x, y + 0.62, z, 0.9, 0.46, 0.56);
      kus(TRUHLA, new T.CylinderGeometry(0.28, 0.28, 0.9, 12, 1, false, 0, Math.PI), x, y + 0.85, z, 0, 0, Math.PI / 2);
      for (const dx of [-0.34, 0.34]) {
        kvader(ZLATO, x + dx, y + 0.62, z, 0.07, 0.47, 0.58);
        kus(ZLATO, new T.TorusGeometry(0.285, 0.03, 5, 14, Math.PI), x + dx, y + 0.85, z, 0, Math.PI / 2, 0);
      }
      kvader(ZLATO, x, y + 0.76, z - 0.29, 0.17, 0.2, 0.03);
      kvader(TMA, x, y + 0.74, z - 0.309, 0.025, 0.07, 0.01);
      // dve sviecky po stranach (zhasnute) a velka maska z kosti nad truhlicou
      for (const dx of [-0.8, 0.8]) { kus(VOSK, new T.CylinderGeometry(0.05, 0.07, 0.34, 8), x + dx, y + 0.55, z); tyc(TMA, [x + dx, y + 0.72, z], [x + dx + 0.01, y + 0.77, z], 0.006); }
      const mY = y + 2.15, mZ = z + 0.75;
      kus(KOST, GULA, x, mY, mZ, 0, 0, 0, 0.34, 0.6, 0.12);
      for (const s of [-1, 1]) { kus(TMA, GULA, x + s * 0.13, mY + 0.1, mZ - 0.11, 0, 0, s * 0.35, 0.065, 0.12, 0.04); rura(KOST2, [[x + s * 0.25, mY + 0.4, mZ], [x + s * 0.55, mY + 0.7, mZ - 0.05], [x + s * 0.5, mY + 1.05, mZ - 0.1]], 0.04, 8, 5); }
      for (let i = -3; i <= 3; i++) tyc(TMA, [x + i * 0.045, mY - 0.26, mZ - 0.115], [x + i * 0.045, mY - 0.38 + Math.abs(i) * 0.012, mZ - 0.105], 0.008, 0.008, 4);
      kol.push([x - 0.5, z + 0.1, 0.55, { yMax: 2 }], [x + 0.5, z + 0.1, 0.55, { yMax: 2 }]);
    }
  }

  // ---------- zlucenie: 1 siet na material ----------
  const NETIEN = new Set([PLAMEN, SKLO, STOPA, STOPA_D, MLAKA, HUBA_S]);
  for (const [mat, geos] of kopy) {
    for (const g of geos) { if (!g.attributes.uv) g.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); }
    const g = mergeGeometries(geos);
    g.computeBoundingSphere();
    const m = new T.Mesh(g, mat);
    if (NETIEN.has(mat)) m.castShadow = false;
    objekty.push(m);
  }
  // skaly jaskyne a utesu
  objekty.push(...J.postavSkalu(T, P, h0));
  // do vchodu sa nezmesti lod (hrac prejde - pri odlive)
  for (const du of [-1.1, 1.1]) kol.push([J.JX + du, J.JZ - 0.9, 1.3, { lenLode: true }]);
  // balvany a stena utesu po stranach vchodu
  for (let u = 3.4; u <= 19; u += 1.3) for (const s of [-1, 1]) kol.push([J.JX + s * u, J.JZ - 0.1 + Math.max(0, u - 14) * 0.45, 0.8, { yMax: 2.5 }]);
  return { objekty, kolizie: kol };
}
