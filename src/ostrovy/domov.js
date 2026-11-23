// Ostrov Stroskotanca - startovaci ostrov (pasmo 1). API: src/ostrovy/index.js
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
// Tvar: nepravidelne telo s kopcom (vyhliadka) v strede, na severe skalny vybezok, na juhu lagúna s plytcinou a koralovym
// utesom, na zapade dlha piesocna kosa. Na vychodnej plazi zacina hrac, na utese pri nej lezi vrak jeho lode.
const KOPEC = [-8, -28];                 // vrchol kopca (vyhliadka)
const LAGUNA = [-12, 80, 62, 42];        // stred a polosi laguny (x, z, a, b)
const KOSA = [-92, -8, -188, -46];       // piesocna kosa: od korena po spicku
const VYBEZOK = [-20, -70, -42, -128];   // skalny vybezok na severe
const VRAK = [104, -34];                 // utes pri starte (vrak na nom lezi)
const VRAK_X = 118, VRAK_Z = -36, VRAK_UHOL = Math.PI - 0.45;   // stred vraku a otocenie (provou k plazi na zapad)
const OHEN = [88, -2];                   // kamenny kruh na ohnisko

export default {
  meno: 'Ostrov Stroskotanca', podnadpis: 'Pláž stroskotanca', biom: 'palmovy', R: 110, ext: 240, H: 15, seed: 5110,

  vyska(x, z, P) {
    const n = P.fbm(x * 0.011, z * 0.011, 5110);                 // 3x noise: nepravidelny breh
    // telo ostrova: mierne pretiahnuta elipsa
    let t = 1 - P.elipsa(x, z, 114, 98, 0.2) + 0.2 * n;
    // skalny vybezok na severe (predlzi zem, ku spicke sa zuzi)
    const vx = VYBEZOK[2] - VYBEZOK[0], vz = VYBEZOK[3] - VYBEZOK[1];
    const uv = P.clamp(((x - VYBEZOK[0]) * vx + (z - VYBEZOK[1]) * vz) / (vx * vx + vz * vz), 0, 1);
    const dv = Math.hypot(x - VYBEZOK[0] - vx * uv, z - VYBEZOK[1] - vz * uv) + n * 8;
    t = P.hmax(t, 0.5 - dv / 60 - uv * 0.28, 0.08);
    let h = t >= 0 ? 8 * Math.pow(t, 0.8) : -(-t * 14 + t * t * 80);
    if (t > 0) {
      // kopec s plochym vrcholom (vyhliadka)
      const dk = P.dist(x, z, KOPEC[0], KOPEC[1]);
      h += 9.5 * P.smooth(62, 6, dk) * P.smooth(0, 0.25, t);
      h = P.hmin(h, 15.2, 3);
      // vlnky terenu (lúka, haj)
      const v = P.noise(x * 0.045, z * 0.045, 7);                  // 1x noise
      h += v * 1.4 * P.smooth(0.05, 0.3, t);
      // skaly na vybezku: hrbolaty hreben
      if (dv < 40) h += Math.max(0, 1 - dv / 40) * (2.2 + 2.5 * Math.abs(v)) * P.smooth(0.02, 0.15, t);
    }
    // piesocna kosa na zapade (nizka, siroka 20-30 m, na konci sa zuzi)
    const ax = KOSA[2] - KOSA[0], az = KOSA[3] - KOSA[1];
    const u = P.clamp(((x - KOSA[0]) * ax + (z - KOSA[1]) * az) / (ax * ax + az * az), 0, 1);
    const ds = Math.hypot(x - KOSA[0] - ax * u, z - KOSA[1] - az * u) + n * 5;
    let hs = 1.25 - u * 0.55 - ds * (0.075 + u * 0.05);
    if (hs < 0) hs *= 2.4;
    h = P.hmax(h, hs, 3);
    // laguna na juhu: plytcina -0.6 az -1.8 m, okolo nej pozvolna plaz, na vonkajsom okraji koralovy utes
    const e = P.elipsa(x - LAGUNA[0], z - LAGUNA[1], LAGUNA[2], LAGUNA[3], -0.25) + 0.12 * n;
    if (e < 1.25) {
      const g = -1.8 + 1.4 * e * e + 0.25 * n;                      // dno laguny
      h = P.lerp(h, g, P.smooth(1.22, 0.86, e));
      // utes: len na juznej (morskej) strane, s priechodom pre kanoe na juhovychode
      if (z > LAGUNA[1] - 5) {
        const r = 1 - Math.abs(e - 1.06) / 0.1;
        if (r > 0) {
          const rn = P.noise(x * 0.09, z * 0.09, 21);             // 1x noise
          let crest = -2.4 + 2.6 * r + 0.7 * rn;
          crest -= 3 * P.smooth(16, 4, Math.abs(x - 32));         // priechod
          h = Math.max(h, crest);
        }
      }
    }
    // utes pod vrakom (plocha skala pri vychodnom brehu)
    const dw = P.dist(x, z, VRAK[0] + 8, VRAK[1]);
    if (dw < 22) h = P.hmax(h, 0.35 - dw * 0.06 + 0.35 * n, 2);
    return h;
  },

  vegetacia: {
    zony: {
      plaz: { palma: 0.55, trava: 3, kamienky: 0.3, aloe: 0.05 },
      haj: { palma: 1.0, ker: 0.5, papradie: 0.6, ibistek: 0.3, monstera: 0.3, hibiskus: 0.25, bobule: 0.12, trava: 6, kvet: 0.2, strom: 0.05, spiral: 0.06 },
      luka: { trava: 30, kvet: 1.2, ker: 0.12, palma: 0.08, aloe: 0.15, bobule: 0.15, kamienky: 0.3 },
      skaly: { balvan: 0.7, kamienky: 1.2, aloe: 0.3, trava: 7, ker: 0.12, palma: 0.06 },
      kosa: { palma: 0.3, trava: 2, kamienky: 0.4 },
    },
    zona(x, z, h, P) {
      if (h < -0.4) return null;
      if (x < -95) return 'kosa';
      const dv = P.distUsecka(x, z, VYBEZOK[0], VYBEZOK[1], VYBEZOK[2], VYBEZOK[3]);
      if (dv < 26 && z < -78) return 'skaly';
      if (h > 13.5) return 'skaly';                                // vrchol kopca: skaly a kamienky
      if (h < 2.2) return 'plaz';
      // luka na severozapade a na severnom svahu kopca
      if (x < -18 && z < 25 + 0.25 * x + 18 * P.noise(x * 0.03, z * 0.03, 3)) return 'luka';
      return 'haj';
    },
  },

  predmety: {
    nahodne: ['palica', 'kamen', 'kokos', 'palica'],
    pevne: [['musla', 88, 30], ['musla', 95, 40], ['musla', 100, 24], ['musla', -150, -24]],
  },
  start: { hrac: [102, 8], kanoe: [131, 10] },
  flase: [[90, 52], [-165, -37]],
  pamiatkyNahlad: [[VRAK_X, VRAK_Z, 9, 'vrak lode'], [OHEN[0], OHEN[1], 2, 'ohnisko'], [KOPEC[0], KOPEC[1], 8, 'vyhliadka']],

  pamiatky(P) {
    const T = P.THREE, objekty = [], kolizie = [];
    const DREVO = P.mat(0x7a5232), TMAVE = P.mat(0x5a3a22), SUD = P.mat(0x8a5a30), OBRUC = P.mat(0x3c3a36, { metalness: 0.4, roughness: 0.6 });
    const BEDNA = P.mat(0xa8763e), PLACHTA = P.mat(0xe8dcbc, { side: T.DoubleSide }), NAPLAV = P.mat(0xc9b896), KAMEN = P.mat(0x8c867c);
    const UHLIE = P.mat(0x2a2420);
    const o3 = new T.Object3D();
    // InstancedMesh z poloziek [x, z, dy, rotY, rotX, rotZ, mierka] (x, z lokalne na ostrove, y = teren + dy)
    const instancie = (geo, mat, kusy) => {
      const im = new T.InstancedMesh(geo, mat, kusy.length);
      kusy.forEach(([x, z, dy, ry, rx = 0, rz = 0, s = 1], i) => {
        o3.position.set(x, P.vyska(x, z) + dy, z);
        o3.rotation.set(rx, ry, rz, 'YXZ');
        o3.scale.setScalar(s);
        o3.updateMatrix();
        im.setMatrixAt(i, o3.matrix);
      });
      objekty.push(im);
      return im;
    };

    // ===== vrak lode: trup lezi naklonený na utese, bok k moru je vylomeny (vidno rebra) =====
    const lod = new T.Group();
    const L = 7;                                          // polovica dlzky trupu
    const sirka = xi => Math.sqrt(Math.max(0.08, 1 - (xi / (L + 0.6)) ** 2));
    // kyl + stavne (predna a zadna)
    const kyl = new T.Mesh(new T.BoxGeometry(2 * L + 0.6, 0.4, 0.4), TMAVE);
    kyl.position.y = 0.2; lod.add(kyl);
    const stevn = new T.CylinderGeometry(0.18, 0.22, 3.2, 6);
    for (const sx of [-1, 1]) {
      const m = new T.Mesh(stevn, TMAVE);
      m.position.set(sx * (L + 0.5), 1.6, 0); m.rotation.z = -sx * 0.35; lod.add(m);
    }
    // rebra: polovicne prstence (U), mensie ku koncom
    const RB = 2.4, OBLUK = Math.PI + 0.5;                  // polomer a obluk rebra (konce sa mierne stacaju dnu)
    const rebroGeo = new T.TorusGeometry(RB, 0.14, 4, 10, OBLUK).rotateZ(1.5 * Math.PI - OBLUK / 2).rotateY(Math.PI / 2).translate(0, RB, 0);
    const xs = [-5.6, -4.2, -2.8, -1.4, 0, 1.4, 2.8, 4.2, 5.6];
    const rebra = new T.InstancedMesh(rebroGeo, DREVO, xs.length);
    xs.forEach((x, i) => {
      const s = sirka(x);
      o3.position.set(x, RB * (1 - s), 0); o3.rotation.set(0, 0, 0); o3.scale.set(1, s, s); o3.updateMatrix();
      rebra.setMatrixAt(i, o3.matrix);
    });
    lod.add(rebra);
    // dosky trupu: bok k plazi (-z) s dierami, bok k moru zaryty v piesku len zvysky
    const doskaGeo = new T.BoxGeometry(1, 0.1, 0.5);
    const dosky = [];
    for (const [th, strana, od, po] of [[0.25, -1, -6.2, 6.2], [0.6, -1, -6, 6], [0.95, -1, -5.6, -0.8], [0.95, -1, 2.6, 5.4], [1.3, -1, -5, -2.2],
      [1.3, -1, 3.2, 4.8], [1.65, -1, -4.4, -3], [0.25, 1, -6, 6], [0.6, 1, -5.6, -1.6], [0.6, 1, 2.4, 5.2], [0.95, 1, -5, -3.2]]) {
      const xm = (od + po) / 2, s = sirka(xm), a = th * strana;
      dosky.push([xm, RB - RB * Math.cos(th) * s, RB * Math.sin(th) * s * strana, po - od, a]);
    }
    const dIm = new T.InstancedMesh(doskaGeo, DREVO, dosky.length);
    dosky.forEach(([x, y, z, d, a], i) => {
      o3.position.set(x, y, z); o3.rotation.set(-a, 0, 0); o3.scale.set(d, 1, 1); o3.updateMatrix();
      dIm.setMatrixAt(i, o3.matrix);
    });
    lod.add(dIm);
    // zvysky paluby a zlomeny peň stazna
    const paluba = new T.Mesh(new T.BoxGeometry(3.2, 0.12, 3.4), DREVO);
    paluba.position.set(-3.6, 2.5, -0.3); paluba.rotation.z = 0.05; lod.add(paluba);
    const pen = new T.Mesh(new T.CylinderGeometry(0.2, 0.24, 3.6, 7), TMAVE);
    pen.position.set(0.8, 2.0, 0); lod.add(pen);
    // umiestnenie: kyl sa zaryl do utesu, lod je naklonena smerom k moru
    lod.position.set(VRAK_X, P.vyska(VRAK_X, VRAK_Z) - 0.35, VRAK_Z);
    lod.rotation.set(0.45, VRAK_UHOL, 0.07, 'YXZ');
    objekty.push(lod);
    const cx = Math.cos(VRAK_UHOL), cz = -Math.sin(VRAK_UHOL);
    for (const k of [-4.5, -1.5, 1.5, 4.5]) kolizie.push([VRAK_X + cx * k, VRAK_Z + cz * k, Math.abs(k) > 3 ? 1.6 : 2.2]);

    // zlomeny stazen s rahnom lezi na plazi, roztrhana plachta prehodena cez piesok
    const [mx, mz] = [107, -20];
    const stazen = new T.Mesh(new T.CylinderGeometry(0.16, 0.2, 8.5, 7).rotateZ(Math.PI / 2), TMAVE);
    stazen.position.set(mx, P.vyska(mx, mz) + 0.15, mz); stazen.rotation.y = 0.5; objekty.push(stazen);
    const rahno = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 5, 6).rotateX(Math.PI / 2), DREVO);
    rahno.position.set(mx - 2.4, P.vyska(mx - 2.4, mz - 1) + 0.25, mz - 1); rahno.rotation.set(0.15, 0.3, 0); objekty.push(rahno);
    const plGeo = new T.PlaneGeometry(4.6, 3.6, 7, 6).rotateX(-Math.PI / 2);
    const pp = plGeo.attributes.position, rr = P.rng(77);
    for (let i = 0; i < pp.count; i++) {
      const px = pp.getX(i), pz = pp.getZ(i);
      // plachta je na jednej strane zdvihnuta cez rahno, inde v zahyboch na piesku; okraj je roztrhany
      pp.setY(i, Math.max(0, 0.9 - Math.abs(pz + 1.2) * 0.8) + Math.sin(px * 2.3) * 0.12 + rr() * 0.1);
      if (Math.abs(px) > 2 || pz > 1.5) { pp.setX(i, px + (rr() - 0.5) * 0.7); pp.setZ(i, pz + (rr() - 0.5) * 0.7); }
    }
    plGeo.computeVertexNormals();
    const plachta = new T.Mesh(plGeo, PLACHTA);
    plachta.position.set(mx - 2.6, P.vyska(mx - 2.6, mz + 0.6) + 0.06, mz + 0.6); plachta.rotation.y = 0.3; objekty.push(plachta);
    kolizie.push([mx, mz, 0.5]);

    // sudy (niektore lezia) a debny rozhadzane po plazi medzi vrakom a startom
    const sudGeo = new T.LatheGeometry([[0, -0.5], [0.34, -0.5], [0.42, -0.25], [0.44, 0], [0.42, 0.25], [0.34, 0.5], [0, 0.5]].map(([a, b]) => new T.Vector2(a, b)), 10);
    const obrGeo = mergeGeometries([new T.TorusGeometry(0.42, 0.035, 4, 12).rotateX(Math.PI / 2).translate(0, 0.27, 0),
      new T.TorusGeometry(0.42, 0.035, 4, 12).rotateX(Math.PI / 2).translate(0, -0.27, 0)]);
    const sudy = [[104, -27, 0.45, 0.3], [110, -24, 0.35, 1.2, 0, Math.PI / 2], [99, -14, 0.45, 2], [113, -12, 0.3, 0.4, 0, Math.PI / 2],
      [96, -22, 0.35, 2.4, 0, Math.PI / 2], [108, 16, 0.3, 0.9, 0, Math.PI / 2], [121, -30, 0.3, 0.2, 0, 1.4]];
    instancie(sudGeo, SUD, sudy);
    instancie(obrGeo, OBRUC, sudy);
    instancie(new T.BoxGeometry(0.8, 0.7, 0.8), BEDNA, [[102, -23, 0.3, 0.4], [102.9, -22.4, 0.3, 1.1, 0, 0, 0.8], [111, -16, 0.2, 0.7, 0.25, 0.1],
      [94, -8, 0.3, 2.2], [115, -27, 0.1, 0.5, 0.4, 0.3, 1.1], [100, 22, 0.25, 1.7, 0, 0.2, 0.9]]);
    // ulomky dosiek a naplavene drevo (vybielene) po plaziach ostrova
    instancie(new T.BoxGeometry(2.2, 0.08, 0.38), DREVO, [[105, -30, 0.08, 0.9], [112, -21, 0.08, 2.4, 0, 0.2], [98, -18, 0.06, 0.2],
      [116, -8, 0.06, 1.4], [108, -3, 0.06, 2.9, 0, 0.1], [92, -26, 0.06, 0.6]]);
    instancie(new T.CylinderGeometry(0.2, 0.26, 4, 6).rotateZ(Math.PI / 2), NAPLAV, [[88, 46, 0.15, 0.8], [-20, 50, 0.15, 2.1],
      [-60, 52, 0.15, 0.3, 0, 0, 0.8], [-130, -12, 0.15, 1.2], [-175, -42, 0.12, 2.6, 0, 0, 0.7], [40, -88, 0.15, 0.4], [70, 70, 0.15, 1.9, 0, 0, 1.2]]);

    // kamenny kruh na ohnisko (sem hrac moze polozit taborak)
    const kruh = [];
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; kruh.push([OHEN[0] + Math.cos(a) * 1.05, OHEN[1] + Math.sin(a) * 1.05, 0.08, a * 2, a, 0, 0.8 + (i % 3) * 0.15]); }
    instancie(new T.DodecahedronGeometry(0.26, 0), KAMEN, kruh);
    instancie(new T.CylinderGeometry(0.06, 0.07, 1.1, 5).rotateZ(Math.PI / 2), UHLIE, [[OHEN[0], OHEN[1], 0.06, 0.3], [OHEN[0] + 0.1, OHEN[1], 0.1, 1.5], [OHEN[0], OHEN[1] + 0.1, 0.14, 2.6]]);
    // zvalene polena ako lavicky pri ohnisku
    instancie(new T.CylinderGeometry(0.22, 0.24, 2.2, 7).rotateZ(Math.PI / 2), NAPLAV, [[OHEN[0] - 2.6, OHEN[1] + 0.4, 0.18, 1.7], [OHEN[0] + 0.6, OHEN[1] - 2.6, 0.18, 0.2]]);

    return { objekty, kolizie };
  },
};
