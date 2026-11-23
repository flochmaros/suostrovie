// Dzungla predkov (pasmo 3, daleko na severe): velky dzunglovy ostrov so strmymi krasovymi vezami, hlboka dolina s riekou,
// ktora ustie do zalivu na juhu (da sa vplavat kanoe), a ruiny chramu predkov na plosine v doline.
// Jedine miesto s gumovnikom (zivica). API: src/ostrovy/index.js
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// krasove veze [x, z, vyska, polomer]
const VEZE = [
  [-95, -85, 66, 46], [-25, -128, 54, 36], [78, -92, 70, 48], [118, 8, 46, 34],
  [-112, 18, 52, 40], [-78, 102, 40, 30], [92, 98, 42, 30], [-30, -60, 30, 18],
];
// rieka: od pramena na severe dolinou az do zalivu na juhu (prvy bod = pramen)
const RIEKA = [[8, -95], [10, -45], [-6, 0], [-14, 50], [6, 100], [6, 150], [0, 215]];
const CHRAM = [42, 34];                     // stred plosiny chramu (vychodny breh rieky)
const ZALIV = [4, 178];

function dRieka(x, z, P) {
  let d = 1e9, ti = 0;
  for (let i = 1; i < RIEKA.length; i++) {
    const di = P.distUsecka(x, z, RIEKA[i - 1][0], RIEKA[i - 1][1], RIEKA[i][0], RIEKA[i][1]);
    if (di < d) { d = di; ti = i; }
  }
  return [d, ti];
}

export default {
  meno: 'Džungľa predkov', podnadpis: 'Ruiny v džungli', biom: 'dzungla', R: 195, ext: 390, H: 70, seed: 15195, bujny: true,

  vyska(x, z, P) {
    const s = this.seed;
    const t = 1 - Math.hypot(x, z * 0.95) / this.R + 0.22 * P.fbm(x * 0.008, z * 0.008, s);    // 3x noise
    if (t < -0.25) return -(-t * 14 + t * t * 80);
    // zakladna dzunglova plan 0-12 m (pozvolna plaz na okraji)
    let h = t >= 0 ? 13 * Math.pow(P.smooth(0, 0.4, t), 1.15) - 0.15 + 0.3 * t : -(-t * 14 + t * t * 80);
    const det = P.noise(x * 0.05, z * 0.05, s + 2);                                              // 1x noise
    h += det * 1.6 * P.smooth(0.05, 0.3, t);
    // dolina pozdlz rieky (siroka ~45 m) - nizsie dno 3-5 m
    const [dr, ti] = dRieka(x, z, P);
    const vnutro = P.smooth(0.02, 0.25, t);
    h = P.lerp(h, Math.min(h, 3.2 + det * 0.8), (1 - P.smooth(14, 48, dr)) * vnutro);
    // krasove veze: zaoblene kuzele so strmymi stenami
    const drsnost = P.noise(x * 0.09, z * 0.09, s + 5);                                          // 1x noise
    for (const [vx, vz, vh, vr] of VEZE) {
      const dx = x - vx, dz = z - vz, d2 = dx * dx + dz * dz, rr = vr * vr;
      if (d2 > rr * 1.4) continue;
      const u = Math.sqrt(d2) / (vr * (1 + drsnost * 0.12));
      if (u >= 1) continue;
      const v = vh * Math.pow(1 - u * u * u, 0.55) * (1 + drsnost * 0.06);
      h = P.hmax(h, v, 5);
    }
    // plosina chramu (8 m, zarovnana)
    const dc = P.dist(x, z, CHRAM[0], CHRAM[1]);
    h = P.lerp(h, 7.5, 1 - P.smooth(30, 44, dc));
    // koryto rieky: dolny tok pod hladinou (more vchadza az k chramu), horny tok plytka ryha
    const hlbka = P.lerp(1.8, -1.7, P.smooth(-75, 5, z));
    const sirka = ti >= 4 ? 11 : 8;
    h = P.lerp(h, Math.min(h, hlbka), (1 - P.smooth(sirka * 0.55, sirka, dr)) * P.smooth(-0.05, 0.05, t));
    // zaliv na juhu
    const ez = P.elipsa(x - ZALIV[0], z - ZALIV[1], 34, 46);
    h = P.lerp(h, Math.min(h, -2.6), 1 - P.smooth(0.7, 1.05, ez));
    return h;
  },

  farba(x, z, h, f, P) {
    // strme vapencove steny veži: sivozelene (mach na skale)
    if (h > 16) { const k = P.smooth(16, 30, h); f.trava.r = P.lerp(f.trava.r, 0.42, k * 0.6); f.trava.g = P.lerp(f.trava.g, 0.5, k * 0.5); f.trava.b = P.lerp(f.trava.b, 0.36, k * 0.6); }
  },

  vegetacia: {
    zony: {
      plaz: { palma: 0.7, trava: 10, kamienky: 0.4, ker: 0.2 },
      dzungla: { strom: 0.9, papradie: 1.4, monstera: 0.5, svetlonos: 0.15, spiral: 0.3, huba: 0.5, ker: 0.5, bobule: 0.3, hibiskus: 0.25, ibistek: 0.1, kvet: 0.2, trava: 5, balvan: 0.05 },
      gumovy: { gumovnik: 0.25, papradie: 1.2, strom: 0.2, monstera: 0.4, huba: 0.4, svetlonos: 0.2, trava: 6 },
      kras: { balvan: 0.4, papradie: 0.9, strom: 0.25, kamienky: 0.6, spiral: 0.15 },
      chram: { trava: 14, kamienky: 0.8, kvet: 0.3 },
    },
    zona(x, z, h, P) {
      if (h < -0.5) return null;
      const dc = P.dist(x, z, CHRAM[0], CHRAM[1]);
      if (dc < 36) return 'chram';
      if (h > 17) return 'kras';
      if (h < 2 && Math.hypot(x, z) > 110) return 'plaz';
      const [dr, ti] = dRieka(x, z, P);
      if (dr < 42 && ti <= 4 && h < 12) return 'gumovy';
      return 'dzungla';
    },
  },

  predmety: { nahodne: ['palica', 'palica', 'kamen'], pocet: 50 },

  pamiatkyNahlad: [[CHRAM[0], CHRAM[1], 30, 'chram predkov'], [ZALIV[0], ZALIV[1], 10, 'zaliv'], [8, -95, 6, 'pramen']],

  pamiatky(P) {
    const sk = stavebnica();
    const kolizie = [];
    const r = P.rng(this.seed);
    const KAMEN = 0x8a8d6a, KAMEN_T = 0x6c7354, MACH = 0x5f8a3a, RUNA = 0x48c8ff;
    const [cx, cz] = CHRAM, y0 = P.vyska(cx, cz) - 0.3;

    // ---------- stupnovita pyramida (5 stupnov), schody na zapad k rieke ----------
    const STUPNE = [[20, 2.2], [16, 2.0], [12.4, 1.9], [9, 1.8], [6, 1.7]];
    let y = y0;
    for (let i = 0; i < STUPNE.length; i++) {
      const [w, vh] = STUPNE[i];
      sk.kvader(i % 2 ? KAMEN : KAMEN_T, w, vh, w, cx, y + vh / 2, cz);
      // mach prerasta okraje stupna
      sk.kvader(MACH, w + 0.1, 0.25, w * 0.6, cx + (r() - 0.5) * w * 0.3, y + vh - 0.05, cz + (r() - 0.5) * w * 0.3, 0, r() * 3);
      // obcas vypadnuty kamen pri pate stupna
      for (let k = 0; k < 3; k++) { const a = r() * 6.28; sk.kamen(KAMEN_T, cx + Math.cos(a) * (w / 2 + 1), y0 + 0.3, cz + Math.sin(a) * (w / 2 + 1), 0.5 + r() * 0.4); }
      y += vh;
    }
    // svatynka na vrchole: 4 stlpiky + kamenna strecha
    for (const [px, pz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) sk.kvader(KAMEN, 0.7, 2.4, 0.7, cx + px, y + 1.2, cz + pz);
    sk.kvader(KAMEN_T, 5.2, 0.6, 5.2, cx, y + 2.7, cz);
    sk.kvader(MACH, 4.4, 0.3, 4.4, cx, y + 3.1, cz);
    // svietiaca runa v svatynke (kamen s modrym znakom)
    sk.kvader(KAMEN_T, 1.2, 1.0, 1.2, cx, y + 0.5, cz);
    sk.runa(RUNA, cx - 0.62, y + 0.55, cz, 0.7, Math.PI / 2);
    const vrch = y;
    // schody na zapadnej strane (od paty po vrchol)
    const nSch = 22;
    for (let i = 0; i < nSch; i++) {
      const t = i / nSch, sy = y0 + (vrch - y0) * t, sx = cx - 10.6 + 7.5 * t;
      sk.kvader(i % 3 ? KAMEN : KAMEN_T, 1.2, (vrch - y0) / nSch + 0.05, 3.6, sx + 0.3, sy + (vrch - y0) / nSch / 2, cz);
    }
    // runy na celnej strane stupnov
    for (const i of [0, 2]) {
      const w = STUPNE[i][0], hy = y0 + STUPNE.slice(0, i).reduce((a, b) => a + b[1], 0) + STUPNE[i][1] / 2;
      sk.runa(RUNA, cx - w / 2 - 0.05, hy, cz - 4.2, 0.8, Math.PI / 2);
      sk.runa(RUNA, cx - w / 2 - 0.05, hy, cz + 4.2, 0.8, Math.PI / 2);
    }
    // kolizie pyramidy: kruhy po obvode spodneho stupna + stred
    for (let i = -2; i <= 2; i++) for (const [ax, az] of [[i * 4.5, -9], [i * 4.5, 9], [-9, i * 4.5], [9, i * 4.5]]) kolizie.push([cx + ax, cz + az, 2.6]);
    kolizie.push([cx, cz, 8]);

    // ---------- alej stlpov od brany k pyramide (niektore zlomene, jeden lezi) ----------
    const bx = cx - 30, bz = cz;                        // brana pri rieke
    for (let i = 0; i < 4; i++) {
      for (const sz of [-4.5, 4.5]) {
        const px = bx + 5 + i * 4.5, pz = cz + sz, py = P.vyska(px, pz);
        const zlom = r();
        if (zlom < 0.2) {                                // spadnuty stlp lezi v trave
          sk.valec(KAMEN, px + 2, py + 0.5, pz + sz * 0.3, 0.55, 4.5, Math.PI / 2, r() * 3, 8);
          sk.valec(KAMEN_T, px, py + 0.4, pz, 0.6, 0.8, 0, 0, 8);
        } else {
          const vy = zlom < 0.55 ? 1.5 + r() * 1.5 : 4.5;
          sk.valec(KAMEN, px, py + vy / 2, pz, 0.5, vy, (r() - 0.5) * 0.06, 0, 8);
          sk.kvader(KAMEN_T, 1.3, 0.4, 1.3, px, py + 0.2, pz);
          if (vy > 4) { sk.kvader(KAMEN_T, 1.3, 0.4, 1.3, px, py + vy + 0.2, pz); sk.kvader(MACH, 1.35, 0.15, 1.0, px, py + vy + 0.45, pz); }
          else sk.kamen(KAMEN, px + 1, py + 0.3, pz + 0.6, 0.45);
        }
        kolizie.push([px, pz, 0.7]);
      }
    }
    // ---------- kamenna brana (dva piliere + preklad s runou) ----------
    const by = P.vyska(bx, bz);
    for (const sz of [-3.2, 3.2]) { sk.kvader(KAMEN_T, 1.6, 6, 1.6, bx, by + 3, bz + sz); kolizie.push([bx, bz + sz, 1.2]); }
    sk.kvader(KAMEN, 2, 1.2, 8.6, bx, by + 6.6, bz);
    sk.kvader(MACH, 2.1, 0.3, 6, bx, by + 7.3, bz + 0.8);
    sk.runa(RUNA, bx - 1.02, by + 6.6, bz, 0.8, Math.PI / 2);
    sk.runa(RUNA, bx - 0.82, by + 4.2, bz - 3.2, 0.6, Math.PI / 2);
    sk.runa(RUNA, bx - 0.82, by + 4.2, bz + 3.2, 0.6, Math.PI / 2);

    // ---------- kamenne hlavy predkov (hladia na zapad k rieke) ----------
    const HLAVY = [[cx - 18, cz - 16, 1.0, 0.15], [cx - 18, cz + 16, 1.1, -0.1], [cx + 6, cz - 22, 0.9, -1.2], [cx + 4, cz + 23, 0.85, 1.3]];
    for (const [hx, hz, m, rot] of HLAVY) {
      const hy = P.vyska(hx, hz) - 0.4;
      const M = new THREE.Matrix4().compose(new THREE.Vector3(hx, hy, hz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2 + rot, (r() - 0.5) * 0.08)), new THREE.Vector3(m, m, m));
      sk.kvader(KAMEN_T, 2.2, 3.6, 2.0, cx, 0, 0, 0, 0, 0, M, 0, 1.8, 0);         // hlava
      sk.kvader(KAMEN, 2.5, 0.6, 2.3, cx, 0, 0, 0, 0, 0, M, 0, 3.5, 0);           // celenka
      sk.kvader(KAMEN, 2.3, 0.35, 0.5, cx, 0, 0, 0, 0, 0, M, 0, 2.55, 1.05);      // obocie
      sk.kvader(KAMEN_T, 0.5, 1.1, 0.6, cx, 0, 0, 0, 0, 0, M, 0, 1.85, 1.15);     // nos
      sk.kvader(KAMEN, 1.2, 0.25, 0.3, cx, 0, 0, 0, 0, 0, M, 0, 0.95, 1.02);      // usta
      sk.kvader(KAMEN_T, 0.4, 1.4, 0.8, cx, 0, 0, 0, 0, 0, M, -1.25, 1.9, 0);     // usi
      sk.kvader(KAMEN_T, 0.4, 1.4, 0.8, cx, 0, 0, 0, 0, 0, M, 1.25, 1.9, 0);
      sk.kvader(MACH, 2.3, 0.4, 1.6, cx, 0, 0, 0, 0, 0, M, 0, 3.85, -0.2);       // mach na temene
      // svietiace oci
      sk.kvader(RUNA, 0.45, 0.22, 0.1, cx, 0, 0, 0, 0, 0, M, -0.55, 2.2, 1.02);
      sk.kvader(RUNA, 0.45, 0.22, 0.1, cx, 0, 0, 0, 0, 0, M, 0.55, 2.2, 1.02);
      kolizie.push([hx, hz, 1.6 * m]);
    }
    // ---------- runove kamene pri rieke a pri pramene ----------
    for (const [rx, rz] of [[cx - 38, cz - 9], [cx - 38, cz + 9], [14, -88]]) {
      const ry = P.vyska(rx, rz);
      sk.kvader(KAMEN_T, 1.2, 2.4, 0.6, rx, ry + 1.0, rz, 0, Math.PI / 2 + (r() - 0.5) * 0.3, (r() - 0.5) * 0.15);
      sk.runa(RUNA, rx - 0.33, ry + 1.4, rz, 0.55, Math.PI / 2);
      kolizie.push([rx, rz, 0.8]);
    }
    // rozhadzane kamenne bloky okolo plosiny
    for (let i = 0; i < 18; i++) {
      const a = r() * 6.28, d = 14 + r() * 18, px = cx + Math.cos(a) * d, pz = cz + Math.sin(a) * d;
      if (Math.abs(pz - cz) < 6 && px < cx) continue;      // volna cesta od brany
      sk.kvader(r() < 0.5 ? KAMEN : KAMEN_T, 1.2 + r(), 0.8 + r() * 0.6, 1.0 + r() * 0.6, px, P.vyska(px, pz) + 0.3, pz, r() * 0.3, r() * 3, r() * 0.3);
    }

    // ---------- horny tok potoka (nad hladinou mora): priehladna stuha vody po dne koryta ----------
    const poz = [], idx = [];
    const N = 40;
    for (let i = 0; i <= N; i++) {
      const z = -95 + 70 * i / N;                         // od pramena (-95) po z = -25, kde uz je more
      const seg = z < -45 ? 0 : 1, a = RIEKA[seg], b = RIEKA[seg + 1], t = (z - a[1]) / (b[1] - a[1]), x = a[0] + (b[0] - a[0]) * t;
      const yv = P.vyska(x, z) + 0.3;
      poz.push(x - 2.6, yv, z, x + 2.6, yv, z);
      if (i) idx.push(2 * i - 2, 2 * i, 2 * i - 1, 2 * i - 1, 2 * i, 2 * i + 1);
    }
    const gv = new THREE.BufferGeometry();
    gv.setAttribute('position', new THREE.Float32BufferAttribute(poz, 3)); gv.setIndex(idx); gv.computeVertexNormals();
    const potok = new THREE.Mesh(gv, P.mat(0x3f9fbf, { transparent: true, opacity: 0.72, roughness: 0.15, side: THREE.DoubleSide }));
    potok.castShadow = false;
    // pramen: male jazierko pod runovym kamenom
    const jaz = new THREE.Mesh(new THREE.CircleGeometry(4.5, 14).rotateX(-Math.PI / 2), potok.material);
    jaz.position.set(8, P.vyska(8, -95) + 0.35, -95); jaz.castShadow = false;

    return { objekty: [...sk.hotovo(P), potok, jaz], kolizie };
  },
};

// stavebnica: geometrie sa zbieraju podla farby a na konci zlucia (1 siet = 1 farba -> malo draw callov)
function stavebnica() {
  const kusy = new Map();
  const o = new THREE.Object3D();
  const pridaj = (farba, g, m) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); g.applyMatrix4(m); if (!kusy.has(farba)) kusy.set(farba, []); kusy.get(farba).push(g); };
  const mat = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.updateMatrix(); return o.matrix.clone(); };
  return {
    // kvader w x h x d na (x, y, z); s rodicom M su suradnice (lx, ly, lz) lokalne v M
    kvader(f, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0, M = null, lx = 0, ly = 0, lz = 0) {
      const m = M ? new THREE.Matrix4().multiplyMatrices(M, mat(lx, ly, lz)) : mat(x, y, z, rx, ry, rz);
      pridaj(f, new THREE.BoxGeometry(w, h, d), m);
    },
    valec(f, x, y, z, r, l, rx = 0, ry = 0, seg = 6) { pridaj(f, new THREE.CylinderGeometry(r * 0.9, r, l, seg), mat(x, y, z, rx, ry, 0)); },
    kamen(f, x, y, z, r) { pridaj(f, new THREE.DodecahedronGeometry(r, 0), mat(x, y, z, x, z, 0, 1, 0.7, 1)); },
    // svietiaci znak: kruh + kriz (plochy na stene, uhol = natocenie okolo y)
    runa(f, x, y, z, v, uhol) {
      pridaj(f, new THREE.TorusGeometry(v * 0.35, v * 0.06, 4, 10), mat(x, y, z, 0, uhol, 0));
      pridaj(f, new THREE.BoxGeometry(v * 0.08, v * 0.9, 0.06), mat(x, y, z, 0, uhol, 0));
      pridaj(f, new THREE.BoxGeometry(v * 0.5, v * 0.08, 0.06), mat(x, y + v * 0.15, z, 0, uhol, 0));
    },
    hotovo(P) {
      const out = [];
      for (const [f, geo] of kusy) {
        const g = mergeGeometries(geo); g.computeVertexNormals();
        const svieti = f === 0x48c8ff;
        out.push(new THREE.Mesh(g, P.mat(f, svieti ? { flatShading: true, emissive: f, emissiveIntensity: 2.2 } : { flatShading: true })));
      }
      return out;
    },
  };
}
