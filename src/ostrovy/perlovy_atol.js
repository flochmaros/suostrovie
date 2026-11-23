// Perlovy atol (pasmo 1): nepravidelny prstenec nizkych piesocnych ostrovcekov (motu) okolo plytkej tyrkysovej laguny.
// Hlbsi priechod na zapade (kanoe sa dostane dnu), v lagune vrak moreplavcovej lode, truhlica a koralove balvany.
// Hlavne miesto musli (predmet musla) - nahodne po motu aj na plazach v lagune.
import { noise, smooth, clamp, hmin, hmax, dist, rng } from './pomoc.js';

const SEED = 12140, TAU = Math.PI * 2;
const RR = 106;                         // priemerny polomer prstenca
const A_HAJ = -0.8;                     // smer velkeho motu s hustym palmovym hajom (SV)
const A_VRAK = 2.55;                    // smer motu pri vraku (JZ)
// koralove hlavy tesne pod hladinou [x, z, polomer]
const KORALY = [[22, -32, 6], [-18, -52, 5], [46, 34, 7], [-28, 62, 5], [60, -12, 5], [6, 52, 6], [-62, -22, 5], [32, -62, 5], [-8, 10, 4]];

const uhol = (a, b) => { let d = a - b; d -= TAU * Math.round(d / TAU); return Math.abs(d); };
function teren(x, z) {
  const r = Math.hypot(x, z) + 1e-6, cx = x / r, cz = z / r, a = Math.atan2(z, x);
  // sum po obvode (body na kruznici -> bez svu na 180 st.)
  const n1 = noise(cx * 1.3 + 5, cz * 1.3 + 2, SEED), n2 = noise(cx * 3.3 + 1, cz * 3.3 + 9, SEED + 11), n3 = noise(cx * 7 + 3, cz * 7 + 4, SEED + 23);
  const big = 1 - smooth(0.25, 0.75, uhol(a, A_HAJ));
  const vr = 1 - smooth(0.12, 0.3, uhol(a, A_VRAK));
  const pas = 1 - smooth(0.07, 0.16, uhol(a, Math.PI));       // zapadny hlboky priechod
  const Rr = RR + 20 * n1 + 5 * n3;                            // stred prstenca
  const w = 19 + 9 * n2 + 4 * n3 + 20 * big;                   // sirka prstenca
  const dr = r - Rr, u = Math.abs(dr) / w;
  const maska = n2 * 1.6 + n3 * 0.5 + 0.3 + 1.2 * big + 1.0 * vr - 2 * pas;   // > 0 = motu, inak plytky kanal
  let h = -1.5 + smooth(0, 0.3, maska) * 4.4 * smooth(0, 0.6, 1 - u);
  if (dr < 0) h += (-2 + 0.9 * noise(x * 0.03, z * 0.03, SEED + 31) - h) * smooth(0.9, 1.6, u);   // dno laguny -1..-3 m
  else { const o = Math.max(0, dr - w * 0.85); h = hmin(h, -1.5 - o * 0.75 - o * o * 0.01, 2); }  // vonku prudko do hlbky
  if (pas > 0 && r > 50) h += (Math.min(h, -3.4) - h) * pas * smooth(50, 70, r);
  for (const [kx, kz, kr] of KORALY) { const d = dist(x, z, kx, kz); if (d < kr) h = hmax(h, -0.35 - (d / kr) * (d / kr) * 2.2, 0.8); }
  return h;
}

// bod na plazi v lagune (zvnutra von) v danom smere s vyskou hMin..hMax
function plazLaguny(a, hMin, hMax) {
  const c = Math.cos(a), s = Math.sin(a);
  for (let r = 55; r < 150; r += 0.4) { const h = teren(c * r, s * r); if (h > hMin) return h < hMax ? [c * r, s * r, r] : null; }
  return null;
}
// musle na plazach v lagune
const r0 = rng(SEED + 7), PEVNE = [];
for (let a = 0; a < TAU; a += 0.045) {
  if (r0() < 0.3) continue;
  const b = plazLaguny(a + r0() * 0.03, 0.3, 1.2);
  if (b) PEVNE.push(['musla', +(b[0] + (r0() - 0.5)).toFixed(1), +(b[1] + (r0() - 0.5)).toFixed(1)]);
}
// motu pri vraku: flasa, truhlica, vrak v lagune pred nim
const FLASA = (plazLaguny(A_VRAK + 0.07, 0.6, 1.0) || [-90, 50]).slice(0, 2).map(v => +v.toFixed(1));
const TRUH = plazLaguny(A_VRAK - 0.05, 0.8, 1.6) || [-88, 58, 104];
const VRAK = [Math.cos(A_VRAK) * (TRUH[2] - 22), Math.sin(A_VRAK) * (TRUH[2] - 22)];

export default {
  meno: 'Perlový atol', podnadpis: 'Lagúna s vrakom', biom: 'atol', R: 140, ext: 280, H: 3, seed: SEED,
  vyska: (x, z) => teren(x, z),
  vegetacia: {
    zony: {
      haj: { palma: 1.7, ker: 0.3, trava: 8, kvet: 0.2, ibistek: 0.15, hibiskus: 0.1 },
      motu: { palma: 0.5, ker: 0.45, trava: 10, aloe: 0.15, ibistek: 0.15, kvet: 0.15, kamienky: 1, balvan: 0.05 },
      piesok: { kamienky: 1.2, trava: 1 },
    },
    zona(x, z, h) {
      if (h < 0.3) return null;
      if (dist(x, z, TRUH[0], TRUH[1]) < 3) return null;
      if (uhol(Math.atan2(z, x), A_HAJ) < 0.5 && h > 1.0) return 'haj';
      return h > 1.1 ? 'motu' : 'piesok';
    },
  },
  // nahodne predmety padnu len na sus (h > 0.3) - atol ma malo suse, preto vela pokusov (~120 skutocne lezi)
  predmety: { nahodne: ['musla', 'musla', 'kokos', 'palica', 'kamen'], pocet: 1800, pevne: PEVNE },
  flase: [FLASA],
  pamiatkyNahlad: [[VRAK[0], VRAK[1], 7, 'vrak'], [TRUH[0], TRUH[1], 2, 'truhlica'], [-RR, 0, 12, 'priechod']],

  pamiatky(P) {
    const T = P.THREE, obj = [], kol = [], r = rng(SEED + 3), d = new T.Object3D(), col = new T.Color();
    const drevo = P.mat(0x6b4a2e, { flatShading: true, side: T.DoubleSide }), drevoS = P.mat(0x8a6440, { flatShading: true });
    const instancie = (geo, mat, zoznam, farby) => {
      const im = new T.InstancedMesh(geo, mat, zoznam.length);
      zoznam.forEach((v, i) => {
        d.position.set(v[0], v[1], v[2]); d.rotation.set(v[7] || 0, v[3], v[8] || 0, 'YXZ'); d.scale.set(v[4], v[5], v[6]);
        d.updateMatrix(); im.setMatrixAt(i, d.matrix);
        if (farby) im.setColorAt(i, col.setHex(farby[Math.floor(r() * farby.length)]).multiplyScalar(0.85 + r() * 0.3));
      });
      im.castShadow = im.receiveShadow = true; return im;
    };

    // --- vrak: trup lezi na boku, napoly ponoreny; odhalene rebra, zlomeny staznen ---
    const L = 12, Rh = 2.1, zuz = x => 1 - 0.8 * Math.pow(x / (L / 2), 2);
    const vrak = new T.Group();
    const tg = new T.CylinderGeometry(Rh, Rh, L, 12, 8, true, 0, Math.PI * 0.82).rotateZ(-Math.PI / 2);   // os pozdlz x, otvor hore
    const p = tg.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = zuz(p.getX(i)); p.setY(i, p.getY(i) * k * 1.1); p.setZ(i, p.getZ(i) * k); }
    tg.computeVertexNormals();
    vrak.add(new T.Mesh(tg, drevo));
    const rebro = new T.TorusGeometry(Rh, 0.1, 4, 10, Math.PI).rotateZ(Math.PI).rotateY(Math.PI / 2);
    const rebra = [];
    for (let x = -4.8; x <= 4.9; x += 1.2) rebra.push([x, 0, 0, 0, 1, zuz(x) * 1.1 + 0.04, zuz(x) + 0.04]);
    vrak.add(instancie(rebro, drevoS, rebra));
    const kyl = new T.Mesh(new T.BoxGeometry(L * 1.02, 0.3, 0.3), drevoS); kyl.position.y = -Rh * 1.12; vrak.add(kyl);
    const lavice = [];
    for (const x of [-3, 0.6, 3.4]) lavice.push([x, -0.25, 0, (r() - 0.5) * 0.2, 0.3, 0.12, 2 * Rh * zuz(x) * 0.95]);
    vrak.add(instancie(new T.BoxGeometry(1, 1, 1), drevoS, lavice));
    const stazen = new T.Mesh(new T.CylinderGeometry(0.15, 0.18, 3.4, 7), drevoS);       // zlomeny pahyl stazna
    stazen.position.set(0.8, -0.2, 0); stazen.rotation.z = 0.08; vrak.add(stazen);
    vrak.position.set(VRAK[0], -0.55, VRAK[1]);
    const smer = A_VRAK + Math.PI / 2 + 0.3;                     // trup priblizne rovnobezne s brehom
    vrak.rotation.set(1.1, smer, 0, 'YXZ');
    obj.push(vrak);
    const dx = Math.cos(smer), dz = -Math.sin(smer);
    for (const k of [-4.6, -1.6, 1.4, 4.2]) kol.push([+(VRAK[0] + dx * k).toFixed(1), +(VRAK[1] + dz * k).toFixed(1), 1.9 * Math.max(0.6, zuz(k))]);
    // odlomeny vrch stazna s kusom plachty pri vraku (plava / lezi v plytcine)
    const ax = VRAK[0] - dz * 4, az = VRAK[1] + dx * 4;
    const kus = new T.Mesh(new T.CylinderGeometry(0.12, 0.15, 5.5, 7), drevoS);
    kus.position.set(ax, -0.05, az); kus.rotation.set(Math.PI / 2 - 0.06, smer + 0.7, 0, 'YXZ'); obj.push(kus);
    const pg = new T.PlaneGeometry(3.6, 2.6, 7, 5).rotateX(-Math.PI / 2), pp = pg.attributes.position;
    for (let i = 0; i < pp.count; i++) pp.setY(i, 0.18 * Math.sin(pp.getX(i) * 2.1) + 0.14 * Math.cos(pp.getZ(i) * 2.7) + (pp.getX(i) > 1 ? -0.4 : 0));
    pg.computeVertexNormals();
    const plachta = new T.Mesh(pg, P.mat(0xe9dfc6, { flatShading: true, side: T.DoubleSide }));
    plachta.position.set(ax + 0.6, 0.1, az + 0.4); plachta.rotation.y = smer + 0.5; obj.push(plachta);

    // --- truhlica na piesku + menovka lode vyplavena na doske ---
    const tr = new T.Group(), ty = P.vyska(TRUH[0], TRUH[1]);
    tr.position.set(TRUH[0], ty - 0.12, TRUH[1]); tr.rotation.set(0.05, A_VRAK + 0.4, -0.06);
    const telo = new T.Mesh(new T.BoxGeometry(1.0, 0.55, 0.62), P.mat(0x7a4a26, { flatShading: true })); telo.position.y = 0.28; tr.add(telo);
    const zlato = P.mat(0xd4a640, { metalness: 0.7, roughness: 0.35 });
    for (const x of [-0.32, 0.32]) { const b = new T.Mesh(new T.BoxGeometry(0.07, 0.57, 0.64), zlato); b.position.set(x, 0.28, 0); tr.add(b); }
    const poklad = new T.Mesh(new T.BoxGeometry(0.9, 0.08, 0.52), P.mat(0xffcf4a, { emissive: 0xffb020, emissiveIntensity: 0.7, metalness: 0.6, roughness: 0.3 }));
    poklad.position.y = 0.52; tr.add(poklad);
    const veko = new T.Group(); veko.position.set(0, 0.55, -0.31); veko.rotation.x = -1.15; tr.add(veko);
    const vg = new T.CylinderGeometry(0.31, 0.31, 1.0, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2);
    const vm = new T.Mesh(vg, P.mat(0x6a3e20, { flatShading: true })); vm.position.z = 0.31; veko.add(vm);
    obj.push(tr); kol.push([TRUH[0], TRUH[1], 0.7]);
    const men = new T.Group();
    const mx = TRUH[0] + Math.cos(A_VRAK + 1.6) * 1.6, mz = TRUH[1] + Math.sin(A_VRAK + 1.6) * 1.6;
    men.position.set(mx, P.vyska(mx, mz) + 0.03, mz); men.rotation.set(-1.45, A_VRAK + 0.9, 0, 'YXZ');
    men.add(new T.Mesh(new T.BoxGeometry(1.6, 0.36, 0.06), P.mat(0xa77b4f, { flatShading: true })));
    const pis = [];                                              // vyrezane "pismena" mena lode
    for (let i = 0; i < 7; i++) pis.push([-0.6 + i * 0.2, (r() - 0.5) * 0.03, 0.035, 0, 0.09, 0.16 + r() * 0.06, 0.02, 0, (r() - 0.5) * 0.5]);
    men.add(instancie(new T.BoxGeometry(1, 1, 1), P.mat(0x3a2414), pis));
    obj.push(men);

    // --- koralove balvany v lagune (ruzove, oranzove) ---
    const kg = new T.IcosahedronGeometry(1, 0), kp = kg.attributes.position, posun = new Map();
    for (let i = 0; i < kp.count; i++) {
      const k = [kp.getX(i), kp.getY(i), kp.getZ(i)].map(v => v.toFixed(3)).join();
      if (!posun.has(k)) posun.set(k, 0.75 + r() * 0.5);
      const s = posun.get(k); kp.setXYZ(i, kp.getX(i) * s, kp.getY(i) * s, kp.getZ(i) * s);
    }
    kg.computeVertexNormals();
    const bal = [];
    for (const [kx, kz, kr] of KORALY) for (let j = 0; j < 2; j++) {
      const x = kx + (r() - 0.5) * kr * 0.8, z = kz + (r() - 0.5) * kr * 0.8, s = 0.7 + r() * 0.9;
      bal.push([x, P.vyska(x, z) + s * 0.35, z, r() * 6, s * 1.2, s * 0.8, s, (r() - 0.5) * 0.4, (r() - 0.5) * 0.4]);
      kol.push([+x.toFixed(1), +z.toFixed(1), +(s * 1.0).toFixed(2)]);
    }
    obj.push(instancie(kg, P.mat(0xffffff, { flatShading: true }), bal, [0xf07aa0, 0xf59a4a, 0xff7f6a, 0xe86a8a]));

    return { objekty: obj, kolizie: kol };
  },
};
