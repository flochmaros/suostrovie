// Sirne pramene (pasmo 2): ostrov z cadicovych stlpov - teren je sestuholnikova mriezka (kazdy stlp ma rovny vrch a trochu inu
// vysku), plosiny a schodovite utesy 10-25 m, terasove teple pramene (stupnovite jazierka) na vychode, sirove pole so zltou
// krustou na zapade (jedine miesto so sirou) a zelena uzlabina na juhozapade. Plaz na severe (smerom k startu).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const R = 118, SEED = 13115;
const HS = 5;                               // polomer sestuholnikovej bunky (stred -> roh), stlp ~8.7 m siroky
const S3 = Math.sqrt(3);
// teple pramene: os teras od horneho prameňa k moru, 6 jazierok
const PR_A = [38, -8], PR_B = [90, -62], PR_N = 6, PR_HORE = 13.5, PR_KROK = 2.1;
const JAZIERKA = [];
for (let i = 0; i < PR_N; i++) {
  const u = (i + 0.5) / PR_N;
  JAZIERKA.push({ x: PR_A[0] + (PR_B[0] - PR_A[0]) * u, z: PR_A[1] + (PR_B[1] - PR_A[1]) * u, r: 8.5 - i * 0.5, L: PR_HORE - i * PR_KROK });
}
const SIRA = [-58, -22, 34];                // sirove pole: stred a polomer
const UZ = [[-5, 35], [-45, 62], [-92, 98]];   // zelena uzlabina (lomena ciara k moru na JZ)

// hash bunky -> 0..1 (bez sumu, rychle)
const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
// zakladne pole vysky (spojite) - z neho sa robia terasy a stlpy
function pole(x, z, P, cf, mz) {
  const t = 1 - P.elipsa(x, z, R * 1.1, R * 0.92, 0.2) + 0.3 * cf
    - 0.3 * P.smooth(48, 10, Math.hypot(x - 15, z + 122))         // severna zatoka s plazou (k startu)
    + 0.18 * P.smooth(40, 10, P.distUsecka(x, z, 60, 60, 125, 95));   // cadicovy mys na JV
  if (t < 0) return { t, F: -(-t * 14 + t * t * 80) };
  const s = t * R;
  const sever = P.smooth(-25, -70, z);                         // na severe pozvolna plaz, inde utesy
  const lev = 6 + 15 * P.smooth(-20, 75, z - 0.25 * x) + 3 * cf + 9 * P.smooth(0.05, 0.3, mz);   // mz = stolove hory (mesy)
  const F = lev * P.smooth(0, 9 + 40 * sever, s);
  return { t, F: Math.max(F, s * 0.1 * sever) };
}
// terasy: rovne plosiny po 4 m s ostrymi stupnami
const terasa = F => { const k = F / 4, fl = Math.floor(k); return (fl + Math.min(1, Math.max(0, (k - fl - 0.72) / 0.28))) * 4; };
// sestuholnikova bunka (pointy-top, axialne suradnice) -> stred bunky
function bunka(x, z) {
  const rx = (S3 / 3 * x - z / 3) / HS, rz = (2 / 3 * z) / HS, ry = -rx - rz;
  let ix = Math.round(rx), iy = Math.round(ry), iz = Math.round(rz);
  const dx = Math.abs(ix - rx), dy = Math.abs(iy - ry), dz = Math.abs(iz - rz);
  if (dx > dy && dx > dz) ix = -iy - iz; else if (dy > dz) iy = -ix - iz; else iz = -ix - iy;
  return [ix, iz, HS * S3 * (ix + iz / 2), HS * 1.5 * iz];
}
// masky oblasti
function maskaPramenov(x, z, P) {
  return P.smooth(22, 15, P.distUsecka(x, z, PR_A[0], PR_A[1], PR_B[0], PR_B[1]));
}
const maskaSiry = (x, z, P) => P.smooth(SIRA[2], SIRA[2] * 0.45, Math.hypot(x - SIRA[0], z - SIRA[1]));
function uzlabina(x, z, P) {                     // -> [vzdialenost od osi, 0..1 pozdlz]
  const d1 = P.distUsecka(x, z, ...UZ[0], ...UZ[1]), d2 = P.distUsecka(x, z, ...UZ[1], ...UZ[2]);
  if (d1 < d2) return [d1, 0.45 * P.clamp(Math.hypot(x - UZ[0][0], z - UZ[0][1]) / 48, 0, 1)];
  return [d2, 0.45 + 0.55 * P.clamp(Math.hypot(x - UZ[1][0], z - UZ[1][1]) / 58, 0, 1)];
}
const mix = (c, hex, k) => {
  if (k <= 0) return;
  k = Math.min(1, k);
  c.r += (((hex >> 16) & 255) / 255 - c.r) * k; c.g += (((hex >> 8) & 255) / 255 - c.g) * k; c.b += ((hex & 255) / 255 - c.b) * k;
};

export default {
  meno: 'Sírne pramene', podnadpis: 'Čadičové stĺpy a teplé pramene', biom: 'skalnaty', R, ext: 245, H: 24, seed: SEED,
  farby: { tr: [0x6c9a42, 0x5c7f3a], skala: 0x45464b, hl: 0x6a5e4c, hlPrah: 0.25, plaz: 1.2 },

  vyska(x, z, P) {
    const cf = P.fbm(x * 0.011, z * 0.011, SEED, 2);
    const { t, F } = pole(x, z, P, cf, P.noise(x * 0.028, z * 0.028, SEED + 5));
    const mb = P.smooth(72, 38, Math.hypot(x - 15, z + 112));      // severna zatoka
    if (t < 0 && F < -3 && mb <= 0) return Math.max(F, -40);
    let h = F;
    // cadicove stlpy: vyska z bunky (rovny vrch), kazdy stlp trochu iny
    const q = P.smooth(1.8, 3.4, F);
    if (q > 0) {
      const [ix, iz, cx, cz] = bunka(x, z);
      const c = pole(cx, cz, P, P.fbm(cx * 0.011, cz * 0.011, SEED, 2), P.noise(cx * 0.028, cz * 0.028, SEED + 5));
      const hs = terasa(c.F) + (hash(ix, iz) - 0.35) * 1.4;
      h = P.lerp(F, Math.max(hs, F < 3 ? F : 0.5), q);
    }
    // severna zatoka: pozvolna plaz od -2 m do +2 m (kanoe, pristanie)
    if (mb > 0) { const hb = P.clamp((z + 97) * 0.09, -9, 2.6); h = P.lerp(h, z < -88 ? hb : Math.min(h, hb), mb); }
    // sirove pole: kotlina s hladkou krustou, mierne zvlnenou
    const ms = maskaSiry(x, z, P);
    if (ms > 0) h = P.lerp(h, 6.5 + 1.2 * cf + 0.6 * Math.sin(x * 0.3) * Math.sin(z * 0.27), ms);
    // terasove pramene: stupne jazierok od hora k moru
    const mp = maskaPramenov(x, z, P);
    if (mp > 0) {
      const dx = PR_B[0] - PR_A[0], dz = PR_B[1] - PR_A[1];
      const u = P.clamp(((x - PR_A[0]) * dx + (z - PR_A[1]) * dz) / (dx * dx + dz * dz), 0, 0.999);
      const i = Math.floor(u * PR_N), j = JAZIERKA[i];
      let hp = j.L + 0.35;
      for (let k = Math.max(0, i - 1); k <= Math.min(PR_N - 1, i + 1); k++) {
        const jk = JAZIERKA[k], d = Math.hypot(x - jk.x, z - jk.z);
        if (d < jk.r) hp = Math.min(hp, jk.L + 0.35 - 0.85 * P.smooth(jk.r, jk.r - 2.5, d));
      }
      h = P.lerp(h, hp, mp);
    }
    // zelena uzlabina: zarez s rovnym dnom, klesa k moru
    const [du, uu] = uzlabina(x, z, P);
    if (du < 30) {
      const dno = 9 - 9.6 * uu, sten = dno + Math.max(0, du - 6) * 1.5;
      if (sten < h) h = P.lerp(h, sten, P.smooth(30, 18, du));
    }
    return Math.max(h, -40);
  },

  // sirova krusta (zlta, oranzova), travertin pri prameňoch (smotanovo-biely s hrdzavymi pasmi)
  farba(x, z, h, f, P) {
    const n = P.noise(x * 0.09, z * 0.09, 3);
    const ms = maskaSiry(x, z, P);
    if (ms > 0) {
      const k = P.smooth(0, 0.6, ms + n * 0.4);
      mix(f.trava, n > 0.1 ? 0xe0c83a : n > -0.15 ? 0xd8a040 : 0xece2b8, k * 0.9);
      mix(f.piesok, 0xd8c24a, k * 0.6);
    }
    const mp = maskaPramenov(x, z, P);
    if (mp > 0) {
      mix(f.trava, n > 0.2 ? 0xd88a48 : 0xeee6d0, mp * 0.95);
      mix(f.piesok, 0xe8dcc0, mp * 0.8);
    }
    const [du] = uzlabina(x, z, P);
    if (du < 16 && h > 1) mix(f.trava, 0x3f8a30, P.smooth(16, 6, du) * 0.6);   // sviezo zelena uzlabina
  },

  vegetacia: {
    zony: {
      sira: { sira: 0.22, kamienky: 1.4, balvan: 0.05 },
      plosina: { balvan: 0.35, trava: 12, aloe: 0.3, ker: 0.15, kamienky: 0.8, strom: 0.05, kvet: 0.15 },
      pobrezie: { palma: 0.5, papradie: 0.35, ker: 0.4, trava: 10, balvan: 0.1, kamienky: 0.4, aloe: 0.1 },
      uzlabina: { strom: 0.55, papradie: 1.3, monstera: 0.4, ker: 0.3, trava: 10, spiral: 0.15, palma: 0.1, bobule: 0.1 },
    },
    zona(x, z, h, P) {
      if (h < 0) return null;
      if (maskaPramenov(x, z, P) > 0.3) return null;           // travertin a jazierka - holo
      if (maskaSiry(x, z, P) > 0.4) return 'sira';
      if (uzlabina(x, z, P)[0] < 14) return 'uzlabina';
      if (h < 5) return 'pobrezie';
      return 'plosina';
    },
  },

  predmety: { nahodne: ['kamen', 'kamen', 'palica'], pocet: 35 },

  pamiatky(P) {
    const r = P.rng(SEED + 1), objekty = [], kolizie = [];
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), S = new THREE.Vector3(), V = new THREE.Vector3();

    // --- hladiny teplych prameňov (tyrkysovo-mliecne, jemne svietia) ---
    const hladiny = JAZIERKA.map(j => new THREE.CircleGeometry(j.r - 0.8, 20).rotateX(-Math.PI / 2).translate(j.x, j.L + 0.25, j.z));
    objekty.push(new THREE.Mesh(mergeGeometries(hladiny), P.mat(0x9fe3da, { transparent: true, opacity: 0.85, roughness: 0.08,
      emissive: 0x46bdb4, emissiveIntensity: 0.35 })));

    // --- para nad prameňmi a nad sirovym polom ---
    const para = [];
    for (const j of JAZIERKA) for (let k = 0; k < 3; k++) para.push([j.x + (r() - 0.5) * j.r, j.L + 1.2 + k * 2.2, j.z + (r() - 0.5) * j.r, 1.6 + k * 0.9]);
    for (let k = 0; k < 7; k++) {
      const a = r() * 6.28, d = r() * SIRA[2] * 0.6, x = SIRA[0] + Math.cos(a) * d, z = SIRA[1] + Math.sin(a) * d, y = P.vyska(x, z);
      for (let l = 0; l < 3; l++) para.push([x + l * 0.8, y + 1 + l * 2, z - l * 0.4, 0.9 + l * 0.7]);
    }
    const pm = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8),
      P.mat(0xf4f4f0, { transparent: true, opacity: 0.22, depthWrite: false, roughness: 1 }), para.length);
    para.forEach(([x, y, z, s], i) => pm.setMatrixAt(i, M.compose(V.set(x, y, z), q, S.set(s, s * 0.8, s))));
    objekty.push(pm);

    // --- samostatne cadicove stlpy na pobrezi a vo vode (hladame breh po luci zo stredu) ---
    const stlpy = [];
    const breh = a => {
      const cx = Math.cos(a), cz = Math.sin(a);
      for (let d = 60; d < 190; d += 2) if (P.vyska(cx * d, cz * d) < 0) return [cx * d, cz * d];
      return [cx * 150, cz * 150];
    };
    for (const [a, von, n] of [[1.75, 6, 9], [0.9, 10, 7], [2.9, 4, 8], [-2.4, 8, 6], [-0.3, 12, 5]]) {
      const [bx, bz] = breh(a), sx = bx + Math.cos(a) * von, sz = bz + Math.sin(a) * von;
      for (let k = 0; k < n; k++) {
        const u = k === 0 ? 0 : 1 + (k - 1) % 6, ua = ((k - 1) % 6) * Math.PI / 3 + 0.3 + (k > 6 ? 0.5 : 0);
        const x = sx + (u ? Math.cos(ua) * (k > 6 ? 4.6 : 2.4) : 0), z = sz + (u ? Math.sin(ua) * (k > 6 ? 4.6 : 2.4) : 0);
        const rb = 1.15 + r() * 0.2, dno = Math.min(P.vyska(x, z), 0) - 1;
        const vrch = 1.5 + r() * (k === 0 ? 7 : 5);
        stlpy.push([x, dno, z, rb, vrch - dno]);
        if (vrch > 0.5) kolizie.push([x, z, rb]);
      }
    }
    const sm = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0),
      P.mat(0x3c3d43, { roughness: 0.75, flatShading: true }), stlpy.length);
    stlpy.forEach(([x, y, z, rb, v], i) => sm.setMatrixAt(i, M.compose(V.set(x, y, z), q, S.set(rb, v, rb))));
    sm.castShadow = true;
    objekty.push(sm);
    return { objekty, kolizie };
  },

  pamiatkyNahlad: [[JAZIERKA[0].x, JAZIERKA[0].z, 9, 'teple pramene (terasy)'], [SIRA[0], SIRA[1], SIRA[2], 'sirove pole'],
    [-45, 62, 10, 'zelena uzlabina']],
};
