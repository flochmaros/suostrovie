// Strazna skala - ostrov prveho majaka (pasmo 1). API: src/ostrovy/index.js
// Tvar: skalny ostrov naklonený od vychodu (navetrne utesy 20-35 m) na zapad, kde je zatoka s plazou na pristatie.
// Na juhozapadnej plosine stoji majak (model prida hra) a okolo neho je otvorena arena pre suboj s obrovskym krabom.
// Od zatoky vedu k plosine stare kamenne schody strazcu; v zatoke su zvysky dreveneho mola, na juhu skalna polica
// s prilivovymi jazierkami, okolo ostrova skalne ihly (sea stacks).
const MAJAK = [-18, 24];                 // stred majaka (plosina 3.5 m, rovna v polomere ~10 m)
const ARENA = 30;                        // polomer otvorenej areny okolo majaka
const ZATOKA = [-72, -30];               // stred zatoky (otvorena na zapad)
const IHLY = [[96, -34, 6, 17], [104, 22, 5, 12], [72, 74, 6, 21], [-8, -92, 5, 10], [44, -86, 4, 14], [-82, 52, 4, 8]];   // x, z, r, vyska
const POLICA = [22, 70];                 // skalna polica s jazierkami
const JAZIERKA = [[12, 70, 3.2], [22, 75, 2.4], [30, 68, 2.8], [18, 64, 1.8]];
// cesta schodov: od plaze v zatoke hore na plosinu (lokalne body)
const SCHODY = [[-41, -22], [-27, -10]];

export default {
  meno: 'Strážna skala', podnadpis: 'Ostrov prvého majáka', biom: 'skalnaty', R: 80, ext: 190, H: 32, seed: 1380,

  vyska(x, z, P) {
    const n = P.fbm(x * 0.016, z * 0.016, 1380);                 // 3x noise
    const t = 1 - P.elipsa(x - 6, z + 2, 86, 70, 0.3) + 0.16 * n;
    // ev = 0 na zapade (nizko, plaze) .. 1 na vychode (vysoke utesy)
    const ev = P.smooth(-30, 55, x + 14 * n);
    let h;
    if (t >= 0) {
      const top = 4.5 + 28 * ev + 3 * P.ridge(x * 0.05, z * 0.05, 9) * (0.3 + ev);   // 1x noise
      // na vychode utes (plna vyska hned pri brehu), na zapade pozvolny svah
      h = top * P.smooth(0, P.lerp(0.3, 0.035, ev), t);
    } else {
      const s = -t, k = 1 + 2.5 * ev;                          // pod utesmi strmo do hlbky
      h = -(s * 14 * k + s * s * 80 * k);
    }
    // plosina majaka: rovna 3.5 m do 10 m, dalej mierne stupa (arena), na pobrezi nizky skalny zraz
    const dm = P.dist(x, z, MAJAK[0], MAJAK[1]);
    if (dm < ARENA + 14 && t > -0.05) {
      const ph = 3.5 + Math.max(0, dm - 10) * 0.06 + Math.max(0, dm - 10) * 0.025 * n;
      const w = P.smooth(ARENA + 14, ARENA - 2, dm) * P.smooth(-0.02, 0.05, t);
      h = P.lerp(h, ph, w);
    }
    // zatoka: dno stupa k vychodu (parabolicky tvar otvoreny na zapad), za plazou 2-3 m skalny stupen
    const zx = x - ZATOKA[0], zz = z - ZATOKA[1];
    const wb = P.smooth(36, 20, Math.abs(zz)) * P.smooth(-45, -25, zx);
    if (wb > 0) {
      const u = zx + zz * zz / 36 + 3 * n;
      const g = u < 36 ? -3 + u * 0.125 : 1.5 + (u - 36) * 0.45;
      h = P.lerp(h, Math.min(h, g), wb);
    }
    // skalna polica na juhu (~0.9 m) s prilivovymi jazierkami
    const dp = P.elipsa(x - POLICA[0], z - POLICA[1], 30, 15, 0.2);
    if (dp < 1.6) {
      let pol = 0.9 + 0.25 * n - Math.max(0, dp - 1) * 6;
      for (const [jx, jz, jr] of JAZIERKA) {
        const d = Math.hypot(x - jx, z - jz);
        if (d < jr) pol = Math.min(pol, -0.45 + (d / jr) ** 2 * 1.3);
      }
      h = P.hmax(h, pol, 1.2);
    }
    // skalne ihly vo vode
    for (const [ix, iz, r, hv] of IHLY) {
      const d = Math.hypot(x - ix, z - iz) + n * 1.5;
      if (d < r * 2) h = P.hmax(h, hv * (1 - (d / r) ** 5) - d * 0.3, 1.5);
    }
    return h;
  },

  vegetacia: {
    zony: {
      arena: { trava: 9, kamienky: 0.8 },
      plaz: { palma: 0.35, trava: 3, kamienky: 0.5 },
      zatoka: { palma: 0.5, ker: 0.25, trava: 10, aloe: 0.2, kvet: 0.3, kamienky: 0.4 },
      skaly: { balvan: 0.85, kamienky: 1.6, aloe: 0.4, trava: 6, ker: 0.15, kvet: 0.1, bobule: 0.06 },
      plosina: { trava: 16, kvet: 0.5, aloe: 0.25, ker: 0.12, balvan: 0.15, kamienky: 0.6, palma: 0.05 },
      polica: { kamienky: 1.2, balvan: 0.1 },
    },
    zona(x, z, h, P) {
      if (h < -0.3) return null;
      if (P.dist(x, z, MAJAK[0], MAJAK[1]) < ARENA + 2) return 'arena';
      if (P.dist(x, z, SCHODY[0][0], SCHODY[0][1]) < 7 || P.distUsecka(x, z, SCHODY[0][0], SCHODY[0][1], SCHODY[1][0], SCHODY[1][1]) < 3) return 'plaz';
      if (P.elipsa(x - POLICA[0], z - POLICA[1], 30, 15, 0.2) < 1.15 && h < 2) return 'polica';
      if (h < 1.8) return 'plaz';
      if (x < -38 && Math.abs(z - ZATOKA[1]) < 40 && h < 8) return 'zatoka';
      // ploche miesta na vrchu: trava a kvety, strme svahy a utesy: balvany
      if (h > 14 && P.noise(x * 0.04, z * 0.04, 4) > 0.1) return 'plosina';
      return 'skaly';
    },
  },

  predmety: { nahodne: ['kamen', 'kamen', 'palica'], pocet: 30 },
  majak: MAJAK,
  pamiatkyNahlad: [[MAJAK[0], MAJAK[1], ARENA, 'arena'], [-34, -16, 9, 'schody'], [ZATOKA[0] + 10, ZATOKA[1] - 9, 8, 'molo'],
    [56, 2, 9, 'mur hliadky'], [POLICA[0], POLICA[1], 10, 'jazierka']],

  pamiatky(P) {
    const T = P.THREE, objekty = [], kolizie = [], o3 = new T.Object3D(), r = P.rng(1380);
    const KAMEN = P.mat(0x9a948a), KAMEN2 = P.mat(0x7d786f), MACH = P.mat(0x6f8a4a), DREVO = P.mat(0x6e5236), TMAVE = P.mat(0x4a3826);
    // InstancedMesh z poloziek [x, y, z, rotY, sx, sy, sz, rotX, rotZ] (y je absolutna vyska)
    const instancie = (geo, mat, kusy) => {
      const im = new T.InstancedMesh(geo, mat, kusy.length);
      kusy.forEach(([x, y, z, ry, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0], i) => {
        o3.position.set(x, y, z); o3.rotation.set(rx, ry, rz, 'YXZ'); o3.scale.set(sx, sy, sz); o3.updateMatrix();
        im.setMatrixAt(i, o3.matrix);
      });
      objekty.push(im);
    };
    const kocka = new T.BoxGeometry(1, 1, 1);

    // ===== kamenne schody strazcu: od plaze v zatoke hore na plosinu =====
    const cesta = [[-49, -28], SCHODY[0], SCHODY[1], [-22, -3]];
    const schody = [], kraje = [];
    let yMax = -1;
    for (let k = 0; k < cesta.length - 1; k++) {
      const [ax, az] = cesta[k], [bx, bz] = cesta[k + 1], dl = Math.hypot(bx - ax, bz - az), uhol = Math.atan2(-(bz - az), bx - ax);
      for (let s = 0; s < dl; s += 0.9) {
        const x = ax + (bx - ax) * s / dl, z = az + (bz - az) * s / dl;
        const y = Math.max(yMax, P.vyska(x, z) + 0.12);            // schody nikdy neklesaju
        yMax = y;
        // stary kamen: obcas posunuty a naklonený
        schody.push([x, y - 0.6, z, uhol + (r() - 0.5) * 0.12, 0.85, 1.2, 2.6 - r() * 0.5, (r() - 0.5) * 0.05, (r() - 0.5) * 0.06]);
        if (r() < 0.35) kraje.push([x + (r() - 0.5) * 0.6, y + 0.1, z + (r() - 0.5) * 0.6 + (r() < 0.5 ? 1.6 : -1.6), r() * 3, 0.5, 0.4, 0.5]);
      }
    }
    instancie(kocka, KAMEN, schody);
    instancie(new T.DodecahedronGeometry(0.6, 0), MACH, kraje);

    // ===== rozpadnuty murik: zvysky strazcovej hliadky na vrchu utesu (mimo areny) =====
    const MX = 56, MZ = 2, sx = 7, sz = 5;
    const steny = [[-sx, -sz, sx, -sz], [sx, -sz, sx, sz], [sx, sz, -1, sz], [-sx, sz, -sx, -1]];   // juzna a zapadna stena maju vylom
    const kamene = [];
    const y0 = P.vyska(MX, MZ);
    for (const [ax, az, bx, bz] of steny) {
      const dl = Math.hypot(bx - ax, bz - az), uhol = Math.atan2(-(bz - az), bx - ax);
      for (let s = 0.5; s < dl; s += 1.0) {
        const x = MX + ax + (bx - ax) * s / dl, z = MZ + az + (bz - az) * s / dl;
        const vys = Math.max(1, Math.round(3 - r() * 3 + Math.sin(s * 0.9) * 0.8));   // nerovnako rozpadnute
        const yz = Math.min(P.vyska(x, z), y0 + 0.5);
        for (let v = 0; v < vys; v++)
          kamene.push([x + (r() - 0.5) * 0.15, yz + 0.25 + v * 0.48, z + (r() - 0.5) * 0.15, uhol + (r() - 0.5) * 0.15, 0.95, 0.5, 0.75]);
        if (s % 2 < 1) kolizie.push([x, z, 0.75]);
      }
    }
    // vypadnute kamene na zemi
    for (let i = 0; i < 9; i++) {
      const x = MX + (r() - 0.5) * 20, z = MZ + (r() < 0.5 ? -1 : 1) * (sz + 1 + r() * 3);
      kamene.push([x, P.vyska(x, z) + 0.15, z, r() * 3, 0.9, 0.45, 0.7, r() * 0.4, r() * 0.4]);
    }
    instancie(kocka, KAMEN2, kamene);
    // zhnite tramy strechy vo vnutri
    instancie(new T.CylinderGeometry(0.12, 0.14, 7, 6).rotateZ(Math.PI / 2), TMAVE, [[MX, y0 + 0.2, MZ - 1, 0.2, 1, 1, 1, 0, 0.08], [MX + 1, y0 + 0.6, MZ + 1.5, -0.4, 0.8, 1, 1, 0, 0.25]]);

    // ===== kamenne muziky na utesoch a pri ceste =====
    const muziky = [];
    for (const [x, z] of [[48, -30], [44, 36], [-2, -52], [-30, -14], [20, -8], [84, 20]]) {
      let y = P.vyska(x, z);
      for (let v = 0; v < 5; v++) {
        const s = 0.75 - v * 0.12;
        muziky.push([x + (r() - 0.5) * 0.1, y + s * 0.3, z + (r() - 0.5) * 0.1, r() * 3, s, s * 0.6, s]);
        y += s * 0.55;
      }
    }
    instancie(new T.DodecahedronGeometry(0.55, 0), KAMEN, muziky);

    // ===== zvysky dreveneho mola v zatoke: kolovy rad, na brehu este par dosiek =====
    const koly = [], dosky = [];
    for (let i = 0; i < 9; i++) {
      const x = -48 - i * 3, zz = -38;
      for (const dz of [-1.3, 1.3]) {
        if (i > 5 && r() < 0.4) continue;                          // niektore koly chybaju
        const h = P.vyska(x, zz + dz), dlz = 1.6 - h;
        koly.push([x, h + dlz / 2 - 0.3, zz + dz, r() * 3, 1, dlz, 1, (r() - 0.5) * 0.15, (r() - 0.5) * 0.15]);
      }
      if (i < 4) dosky.push([x, 1.62, zz, 0, 1, 1, 1, 0, (r() - 0.5) * 0.08]);   // ucelena cast pri brehu
    }
    dosky.push([-64, 0.2, -36, 0.4, 1, 1, 0.4, 0.5, 0.3]);                // spadnute dosky v plytcine
    dosky.push([-58, -0.1, -40.5, 1.1, 1, 1, 0.4, -0.3, 0.1]);
    instancie(new T.CylinderGeometry(0.16, 0.2, 1, 6), TMAVE, koly);
    instancie(new T.BoxGeometry(3.1, 0.12, 3.0), DREVO, dosky);

    // skalne ihly: kolizie pre lode
    for (const [x, z, rr] of IHLY) kolizie.push([x, z, rr * 0.8]);
    return { objekty, kolizie };
  },
};
