// Sumivy haj - kopcovity bambusovy ostrov SV od startu (pasmo 1). Jedine miesto s bambusom v domovskych ostrovoch.
// Dva zaoblene kopce (vyssi na SZ s vyhliadkou, nizsi na JV), medzi nimi dolina s bambusovym hajom, ktora sa otvara
// do zatoky s plazou na JZ (smer k startu). Pri zatoke stoji moreplavcova bambusova chatrc na kolach.
// API: src/ostrovy/index.js
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const R = 115;
const KA = [-30, -44, 60, 24];          // vyssi kopec: x, z, polomer, vyska (vyhliadka)
const KB = [44, 24, 50, 20];            // nizsi kopec
const ZAT = [-54, 60];                  // stred zatoky (JZ, ustie doliny medzi kopcami)
// chatrc: stred, natocenie (predok = +z lokalne chatrce smeruje k zatoke), vyska podlahy
const CH = { x: -66, z: 20, rot: -0.53, y: 2.6 };
const OHEN = [-57, 29], SUSIAK = [-76, 31], VYHL = [KA[0], KA[1]];
const cR = Math.cos(CH.rot), sR = Math.sin(CH.rot);

// zaobleny kopec: (1 - u^2)^2 -> hladky vrch aj upatie
function kopec(x, z, k) {
  const u2 = ((x - k[0]) ** 2 + (z - k[1]) ** 2) / (k[2] * k[2]);
  return u2 < 1 ? k[3] * (1 - u2) * (1 - u2) : 0;
}

export default {
  meno: 'Šumivý háj', podnadpis: 'Bambusový háj', biom: 'bambusovy', R, ext: 235, H: 30, seed: 10115,
  farby: { tr: [0x5fb03a, 0x3f8a2e], plaz: 1.3 },

  vyska(x, z, P) {
    const n = P.fbm(x * 0.011, z * 0.011, this.seed);                  // 3x noise
    // pretiahnuty pozdlz osi kopcov (SZ-JV), okraj zvlneny sumom
    let t = 1 - P.elipsa(x, z, 1.22, 0.84, 0.74) / R + 0.26 * n;
    const dz = P.elipsa(x - ZAT[0], z - ZAT[1], 34, 30, 0.74);            // zatoka vykrojena do brehu
    if (dz < 1.7) t -= 0.5 * (1 - P.smooth(0.2, 1.7, dz));
    let h = P.profil(t, 9, 0.95);
    if (t > -0.12) {
      const m = P.smooth(-0.04, 0.3, t);
      const a = kopec(x, z, KA), b = kopec(x, z, KB);
      if (a + b > 0) {
        const det = P.noise(x * 0.045, z * 0.045, this.seed + 7);        // hrbole a ryhy na kopcoch
        const vrch = P.smooth(3, 11, Math.hypot(x - VYHL[0], z - VYHL[1]));   // pri vyhliadke rovnejsie
        h += (P.hmax(a, b, 5) + det * 2.5 * Math.min(1, (a + b) / 8) * vrch) * m;
      }
    }
    // policka pod chatrcou: rovna plocha vo vyske podlahy (vzadu plynule, vpredu k zatoke strmsie -> vidno koly)
    const dx = x - CH.x, dzz = z - CH.z;
    if (dx * dx + dzz * dzz < 120) {
      const u = dx * cR - dzz * sR, v = dx * sR + dzz * cR;              // suradnice v ramci chatrce
      const d = Math.max(Math.abs(u) - 3, v < 0 ? -v - 3.2 : v - 2.3, 0);
      const w = 1 - P.smooth(0, v > 0 ? 1.6 : 4, d);
      h += (CH.y - h) * w;
    }
    return h;
  },

  vegetacia: {
    zony: {
      plaz:   { palma: 0.3, trava: 5, kamienky: 0.5, ker: 0.1 },
      lucka:  { trava: 30, kvet: 1.2, ker: 0.25, bobule: 0.2, hibiskus: 0.1, kamienky: 0.2 },
      haj:    { bambus: 1.0, papradie: 0.35, huba: 0.15, spiral: 0.22, svetlonos: 0.12, monstera: 0.18, trava: 6, balvan: 0.04, kamienky: 0.15 },
      papradie: { papradie: 1.4, spiral: 0.4, svetlonos: 0.2, huba: 0.45, monstera: 0.3, bambus: 0.2, trava: 4, balvan: 0.08 },
      les:    { strom: 0.75, papradie: 0.9, huba: 0.35, spiral: 0.2, svetlonos: 0.12, ker: 0.3, bobule: 0.12, balvan: 0.18, kamienky: 0.3, trava: 8 },
      vrch:   { strom: 0.2, trava: 18, kvet: 0.6, ker: 0.3, balvan: 0.3, kamienky: 0.6 },
    },
    zona(x, z, h, P) {
      if (h < 0.4) return null;
      const dCh = Math.hypot(x - CH.x - 4, z - CH.z + 2);
      if (dCh < 7) return null;                                         // policko chatrce bez rastlin
      if (dCh < 22 && h < 9) return 'lucka';
      if (Math.hypot(x - VYHL[0], z - VYHL[1]) < 9) return null;
      if (h < 1.7) return 'plaz';
      const n = P.noise(x * 0.03, z * 0.03, 44);
      if (h > 25 + n * 3) return 'vrch';
      if (h > 9.5 + n * 4) return n > 0.22 ? 'papradie' : 'les';
      return n < -0.25 ? 'papradie' : 'haj';
    },
  },

  predmety: { nahodne: ['bambus', 'palica', 'kamen'], pocet: 50, pevne: [['palica', -59, 26], ['kamen', -55, 26]] },
  flase: [[-74, 32]],
  pamiatkyNahlad: [[CH.x, CH.z, 4, 'chatrč'], [OHEN[0], OHEN[1], 1.5, 'ohnisko'], [SUSIAK[0], SUSIAK[1], 1.5, 'sušiak'], [VYHL[0], VYHL[1], 2, 'vyhliadka']],

  pamiatky(P) {
    const T = P.THREE;
    const K = new Map();                // material -> geometrie (na konci sa zlucia: 1 siet na material)
    const M = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), S = new T.Vector3(1, 1, 1), E = new T.Euler();
    const daj = (mat, g, mat4) => {
      if (mat4) g.applyMatrix4(mat4);
      g = g.index ? g.toNonIndexed() : g;
      if (g.attributes.uv) g.deleteAttribute('uv');
      if (!K.has(mat)) K.set(mat, []);
      K.get(mat).push(g);
    };
    // tyc (bambus, kol, latka) z bodu a do bodu b
    const tyc = (mat, ax, ay, az, bx, by, bz, r, seg = 6) => {
      V.set(bx - ax, by - ay, bz - az);
      const l = V.length();
      const g = new T.CylinderGeometry(r, r * 1.05, l, seg, 1).translate(0, l / 2, 0);
      Q.setFromUnitVectors(new T.Vector3(0, 1, 0), V.normalize());
      daj(mat, g, M.compose(new T.Vector3(ax, ay, az), Q, S));
    };
    const kus = (mat, g, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) =>
      daj(mat, g, M.compose(new T.Vector3(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), new T.Vector3(s, s, s)));

    const BAM = P.mat(0xcdb766), BAM2 = P.mat(0x9e8a44), DOSKY = P.mat(0x7a5a38), SLAMA = P.mat(0xa48c4a, { side: T.DoubleSide }),
      SLAMA2 = P.mat(0x8a7a3c, { side: T.DoubleSide }), KAMEN = P.mat(0x8a857c), UHLIE = P.mat(0x2a2420),
      ZERAV = P.mat(0xff7a2a, { emissive: 0xff5a10, emissiveIntensity: 1.6 }), RYBA = P.mat(0xb9c6cc, { roughness: 0.5 }),
      LANO = P.mat(0xd8c89a), SVETLO = P.mat(0xffd27a, { emissive: 0xffb040, emissiveIntensity: 2.2 });
    const kol = [];

    // ---------- chatrc na kolach ----------
    // lokalne suradnice chatrce (u = do boku, v = dopredu k zatoke) -> suradnice ostrova
    const cx = (u, v) => CH.x + u * cR + v * sR, cz = (u, v) => CH.z - u * sR + v * cR;
    const Y = CH.y + 0.08;                                              // horna plocha podlahy
    const tycC = (mat, au, ay, av, bu, by, bv, r, seg) => tyc(mat, cx(au, av), ay, cz(au, av), cx(bu, bv), by, cz(bu, bv), r, seg);
    const W = 2.2, VER = 3.9;                                           // polovica sirky, kam siaha veranda
    // podlaha + veranda: bambusove tyce napriec
    for (let v = -W; v <= VER; v += 0.13) tycC(v > W ? BAM2 : BAM, -W - 0.15, Y - 0.04, v, W + 0.15, Y - 0.04, v, 0.065, 5);
    // nosne tramy pod podlahou
    for (const u of [-W, 0, W]) tycC(DOSKY, u, Y - 0.16, -W - 0.2, u, Y - 0.16, VER + 0.1, 0.09, 5);
    // koly: rohy + pod verandou az na zem
    for (const [u, v] of [[-W, -W], [W, -W], [-W, W], [W, W], [-W, VER], [W, VER], [0, VER], [-W, 0], [W, 0]]) {
      const g = P.vyska(cx(u, v), cz(u, v));
      tycC(DOSKY, u, Math.min(g, CH.y) - 0.5, v, u, v <= W ? Y + 2.35 : Y + 0.9, v, 0.12, 6);
    }
    // steny: zvisle bambusy, dvere vzadu (do kopca), okno vpredu k zatoke a v bokoch
    const stena = (au, av, bu, bv, dvere, okno) => {
      const l = Math.hypot(bu - au, bv - av), n = Math.round(l / 0.12);
      for (let i = 0; i <= n; i++) {
        const t = i / n, u = au + (bu - au) * t, v = av + (bv - av) * t, s = (t - 0.5) * l;
        if (dvere && Math.abs(s) < 0.55) continue;
        if (okno && Math.abs(s) < 0.7) { tycC(BAM, u, Y, v, u, Y + 0.85, v, 0.05, 5); tycC(BAM, u, Y + 1.75, v, u, Y + 2.25, v, 0.05, 5); continue; }
        tycC(i % 5 === 0 ? BAM2 : BAM, u, Y, v, u, Y + 2.2 + (i % 3) * 0.04, v, 0.055, 5);
      }
      // vodorovne vazby
      for (const yy of [0.45, 1.9]) tycC(BAM2, au, Y + yy, av, bu, Y + yy, bv, 0.04, 5);
      // kolizie po stene (bez dveri)
      const k = Math.round(l / 0.7);
      for (let i = 0; i <= k; i++) {
        const t = i / k, s = (t - 0.5) * l;
        if (dvere && Math.abs(s) < 0.75) continue;
        kol.push([cx(au + (bu - au) * t, av + (bv - av) * t), cz(au + (bu - au) * t, av + (bv - av) * t), 0.35]);
      }
    };
    stena(-W, -W, W, -W, true, false);
    stena(-W, W, W, W, false, true);
    stena(-W, -W, -W, W, false, true);
    stena(W, -W, W, W, false, false);
    // strecha z palmovych listov: dva zlozene ihlany (valbova strecha) + hreben
    const roof = (r, h, y, mat) => kus(mat, new T.ConeGeometry(r, h, 4, 1, true), cx(0, 0.3), y, cz(0, 0.3), 0, Math.PI / 4 - CH.rot, 0);
    roof(4.6, 1.9, Y + 3.15, SLAMA);
    roof(4.3, 1.75, Y + 3.3, SLAMA2);
    // trapene na okraji strechy (listy visiace dolu)
    for (let i = 0; i < 28; i++) {
      const a = i / 28 * Math.PI * 2, rr = 3.2 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
      const u = Math.cos(a) * Math.min(rr, 3.3), v = 0.3 + Math.sin(a) * Math.min(rr, 3.3);
      kus(i % 2 ? SLAMA : SLAMA2, new T.ConeGeometry(0.28, 0.9, 3, 1, true), cx(u, v), Y + 1.95, cz(u, v), Math.PI, a, 0);
    }
    // vnutro: lehatko, truhlica, lampa
    for (let i = 0; i < 6; i++) tycC(BAM, 1.1 + i * 0.16, Y + 0.5, -1.9, 1.1 + i * 0.16, Y + 0.5, 0.2, 0.06, 5);
    for (const [u, v] of [[1.1, -1.9], [1.9, -1.9], [1.1, 0.2], [1.9, 0.2]]) tycC(BAM2, u, Y, v, u, Y + 0.5, v, 0.05, 5);
    kus(DOSKY, new T.BoxGeometry(0.9, 0.55, 0.55), cx(-1.5, 1.4), Y + 0.28, cz(-1.5, 1.4), 0, -CH.rot, 0);
    kus(SVETLO, new T.SphereGeometry(0.13, 6, 4), cx(0, 0), Y + 2.35, cz(0, 0));
    tycC(LANO, 0, Y + 2.48, 0, 0, Y + 3.1, 0, 0.012, 3);
    // rebrik z verandy dolu k zatoke
    const gR = P.vyska(cx(0, VER + 1.4), cz(0, VER + 1.4));
    for (const u of [-0.32, 0.32]) tycC(BAM2, u, gR - 0.1, VER + 1.4, u, Y + 0.9, VER, 0.05, 5);
    for (let i = 1; i < 6; i++) { const t = i / 6, v = VER + 1.4 * (1 - t), y = gR + (Y - gR) * t; tycC(BAM, -0.32, y, v, 0.32, y, v, 0.035, 4); }
    // zabradlie verandy
    for (const [au, av, bu, bv] of [[-W, W, -W, VER], [W, W, W, VER], [-W, VER, -0.5, VER], [0.5, VER, W, VER]]) tycC(BAM2, au, Y + 0.9, av, bu, Y + 0.9, bv, 0.04, 5);
    // pod verandu sa nevojde
    for (const u of [-1.4, 0, 1.4]) kol.push([cx(u, 3.1), cz(u, 3.1), 0.75]);

    // ---------- bambusovy plot okolo lucky (obluk za chatrcou) ----------
    for (let i = 0; i <= 44; i++) {
      const a = -0.4 + i / 44 * 2.7, rr = 13;
      if (i > 19 && i < 24) continue;                                   // branka
      const x = CH.x + 4 + Math.cos(a) * rr, z = CH.z - 2 + Math.sin(a) * rr * -1, g = P.vyska(x, z);
      tyc(i % 4 ? BAM : BAM2, x, g - 0.3, z, x, g + 1.15 + (i % 3) * 0.08, z, 0.05, 5);
      if (i < 44 && !(i >= 19 && i < 24)) {
        const a2 = -0.4 + (i + 1) / 44 * 2.7, x2 = CH.x + 4 + Math.cos(a2) * rr, z2 = CH.z - 2 - Math.sin(a2) * rr, g2 = P.vyska(x2, z2);
        tyc(BAM2, x, g + 0.4, z, x2, g2 + 0.4, z2, 0.03, 4);
        tyc(BAM2, x, g + 0.9, z, x2, g2 + 0.9, z2, 0.03, 4);
      }
      if (i % 3 === 0) kol.push([x, z, 0.4]);
    }

    // ---------- ohnisko z kamenov ----------
    const gO = P.vyska(...OHEN);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      kus(KAMEN, new T.DodecahedronGeometry(0.24 + (i % 3) * 0.04, 0), OHEN[0] + Math.cos(a) * 0.75, gO + 0.08, OHEN[1] + Math.sin(a) * 0.75, i, i * 2, 0, 1);
    }
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1;
      tyc(UHLIE, OHEN[0] + Math.cos(a) * 0.5, gO + 0.05, OHEN[1] + Math.sin(a) * 0.5, OHEN[0] - Math.cos(a) * 0.3, gO + 0.28, OHEN[1] - Math.sin(a) * 0.3, 0.07, 5);
    }
    kus(ZERAV, new T.DodecahedronGeometry(0.2, 0), OHEN[0], gO + 0.05, OHEN[1], 0, 0, 0, 1);
    // sedenie: dve klady
    tyc(DOSKY, OHEN[0] - 1.6, gO + 0.2, OHEN[1] - 1, OHEN[0] - 1.5, gO + 0.2, OHEN[1] + 1, 0.2, 7);
    tyc(DOSKY, OHEN[0] + 0.8, gO + 0.2, OHEN[1] + 1.7, OHEN[0] + 2.2, gO + 0.2, OHEN[1] + 0.6, 0.2, 7);
    kol.push([OHEN[0], OHEN[1], 0.9]);

    // ---------- susiak na ryby ----------
    const gS = P.vyska(...SUSIAK);
    for (const s of [-1, 1]) {
      const x = SUSIAK[0] + s * 1.5, z = SUSIAK[1];
      tyc(BAM2, x - 0.5, gS - 0.2, z, x, gS + 1.8, z, 0.05, 5);
      tyc(BAM2, x + 0.5, gS - 0.2, z, x, gS + 1.8, z, 0.05, 5);
      kol.push([x, z, 0.35]);
    }
    tyc(BAM, SUSIAK[0] - 1.7, gS + 1.75, SUSIAK[1], SUSIAK[0] + 1.7, gS + 1.75, SUSIAK[1], 0.045, 5);
    for (let i = 0; i < 7; i++) {
      const x = SUSIAK[0] - 1.2 + i * 0.4;
      tyc(LANO, x, gS + 1.45, SUSIAK[1], x, gS + 1.75, SUSIAK[1], 0.01, 3);
      const g = new T.ConeGeometry(0.09, 0.5, 5).scale(1, 1, 0.35);
      kus(RYBA, g, x, gS + 1.2, SUSIAK[1], Math.PI, 0, 0, 0.8 + (i % 3) * 0.15);
    }

    // ---------- vyhliadkova plosina na vrchu vyssieho kopca ----------
    const gV = P.vyska(...VYHL), HP = 4.2;
    for (const [u, v] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) {
      tyc(DOSKY, VYHL[0] + u * 1.15, gV - 0.4, VYHL[1] + v * 1.15, VYHL[0] + u, gV + HP + 1.1, VYHL[1] + v, 0.12, 6);
      kol.push([VYHL[0] + u * 1.1, VYHL[1] + v * 1.1, 0.35]);
    }
    // krizove vystuze
    for (const [a, b] of [[[-1.3, -1.3], [1.3, -1.3]], [[1.3, -1.3], [1.3, 1.3]], [[1.3, 1.3], [-1.3, 1.3]], [[-1.3, 1.3], [-1.3, -1.3]]]) {
      tyc(BAM2, VYHL[0] + a[0] * 1.13, gV + 0.4, VYHL[1] + a[1] * 1.13, VYHL[0] + b[0] * 1.05, gV + HP - 0.3, VYHL[1] + b[1] * 1.05, 0.05, 5);
    }
    for (let i = 0; i < 13; i++) {                                     // podlaha plosiny
      const z = VYHL[1] - 1.5 + i * 0.25;
      tyc(BAM, VYHL[0] - 1.55, gV + HP, z, VYHL[0] + 1.55, gV + HP, z, 0.07, 5);
    }
    for (const [ax, az, bx, bz] of [[-1.3, -1.3, 1.3, -1.3], [1.3, -1.3, 1.3, 1.3], [1.3, 1.3, -1.3, 1.3], [-1.3, 1.3, -1.3, -1.3]]) {
      tyc(BAM2, VYHL[0] + ax, gV + HP + 1, VYHL[1] + az, VYHL[0] + bx, gV + HP + 1, VYHL[1] + bz, 0.045, 5);
    }
    // rebrik na plosinu (z juhu)
    for (const u of [-0.3, 0.3]) tyc(BAM2, VYHL[0] + u, gV - 0.2, VYHL[1] + 2.8, VYHL[0] + u, gV + HP + 0.9, VYHL[1] + 1.3, 0.05, 5);
    for (let i = 1; i < 10; i++) { const t = i / 10; tyc(BAM, VYHL[0] - 0.3, gV + (HP + 0.4) * t, VYHL[1] + 2.75 - 1.4 * t, VYHL[0] + 0.3, gV + (HP + 0.4) * t, VYHL[1] + 2.75 - 1.4 * t, 0.035, 4); }
    // vlajka (kus plachty) na stlpe
    kus(LANO, new T.BoxGeometry(0.02, 0.5, 0.8), VYHL[0] + 1.3, gV + HP + 0.85, VYHL[1] - 1.3 - 0.42, 0, 0, 0);

    // ---------- zlucenie: 1 siet na material ----------
    const objekty = [];
    for (const [mat, geos] of K) {
      const g = mergeGeometries(geos);
      g.computeBoundingSphere();
      const m = new T.Mesh(g, mat);
      if (mat === SVETLO || mat === ZERAV) m.castShadow = false;
      objekty.push(m);
    }
    return { objekty, kolizie: kol };
  },
};
