// Krokodili mociar (pasmo 3, zapad): velky rozliaty nizky ostrov - bludisko klukatych kanalov medzi blatistymi ostrovcekmi,
// mangrovy na brehoch, v strede vyvysene suche miesto so zvyskami dediny na koloch. API: src/ostrovy/index.js
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// hlavne kanaly (lomene ciary): vychod-zapad cez cely ostrov (vychod = smer k startu) a severna vetva
const KANAL_VZ = [[-300, 20], [-200, 45], [-120, 95], [-40, 92], [40, 70], [110, 30], [190, 10], [300, -30]];
const KANAL_S = [[-40, -300], [-60, -190], [-110, -110], [-120, -30], [-120, 95]];
const KANAL_J = [[70, 300], [80, 190], [40, 140], [40, 70]];
const STRED = [10, -15];                   // suche centrum s dedinou

function dKanal(x, z, L, P) {
  let d = 1e9;
  for (let i = 1; i < L.length; i++) d = Math.min(d, P.distUsecka(x, z, L[i - 1][0], L[i - 1][1], L[i][0], L[i][1]));
  return d;
}

export default {
  meno: 'Krokodílí močiar', podnadpis: 'Bludisko kanálov', biom: 'mangrovy', R: 210, ext: 410, H: 4, seed: 16210,

  vyska(x, z, P) {
    const R = this.R, s = this.seed;
    const t = 1 - Math.hypot(x * 0.95, z * 1.08) / R + 0.3 * P.fbm(x * 0.009, z * 0.009, s);   // 3x noise
    let h;
    if (t >= 0) {
      // nizka blatista plan: okraj ~0, vnutri 0.4-1.2 m, kopcky (ostrovceky) do ~2.4 m
      const kop = P.noise(x * 0.028, z * 0.028, s + 3);                                   // 1x noise
      h = -0.6 + 1.5 * P.smooth(0, 0.22, t) + Math.max(0, kop + 0.12) * 3.2 * P.smooth(0.02, 0.2, t);
      // klukate bocne kanaly zo sumu (nulova vrstevnica = vinuca sa ciara)
      const n = P.noise(x * 0.0105, z * 0.0105, s + 9);                                   // 1x noise
      const kan = 1 - P.smooth(0.035, 0.075, Math.abs(n));
      // hlavne kanaly - zarucene splavne naprieč ostrovom
      const dk = Math.min(dKanal(x, z, KANAL_VZ, P), dKanal(x, z, KANAL_S, P), dKanal(x, z, KANAL_J, P));
      const hlavny = 1 - P.smooth(6, 13, dk);
      const k = Math.max(kan * P.smooth(0.03, 0.12, t), hlavny);
      h = P.lerp(h, -1.7 - (hlavny > 0.9 ? 0.3 : 0), k);
      // suche centrum (3-4 m) s dedinou - zaoblena vyvysenina, kanaly ho obtekaju
      const dc = P.dist(x, z, STRED[0], STRED[1]);
      const kopec = 6.3 * (1 - P.smooth(30, 88, dc)) - 2.6 + 0.25 * P.noise(x * 0.06, z * 0.06, s + 1);   // 1x noise
      h = P.hmax(h, kopec, 2);
    } else {
      h = -0.6 - (-t * 10 + t * t * 45);
      // hlavne kanaly pokracuju aj kusok do mora (ustia nie su zanesene)
      if (t > -0.12) {
        const dk = Math.min(dKanal(x, z, KANAL_VZ, P), dKanal(x, z, KANAL_S, P), dKanal(x, z, KANAL_J, P));
        h = Math.min(h, P.lerp(h, -2, 1 - P.smooth(6, 13, dk)));
      }
    }
    return h;
  },

  farby: { tr: [0x4a7a34, 0x58823a] },
  farba(x, z, h, f, P) {
    // vlhke blato pri vode tmavsie, suche centrum zltkastejsie
    if (h < 0.6) { const k = 0.82; f.trava.r *= k; f.trava.g *= k; f.trava.b *= k; }
    if (h > 2.6) { f.trava.r *= 1.12; f.trava.g *= 1.05; }
  },

  vegetacia: {
    zony: {
      mangrovy: { mangrova: 1.6, trstina: 0.3, kamienky: 0.1 },
      plytcina: { trstina: 1.4, taro: 0.6, mangrova: 0.3, trava: 4 },
      ostrovcek: { papradie: 0.9, ker: 0.5, palma: 0.25, taro: 0.3, trava: 10, bobule: 0.15, huba: 0.2, kvet: 0.2, kamienky: 0.2 },
      sucho: { strom: 0.35, palma: 0.4, trava: 22, ker: 0.3, kvet: 0.4, balvan: 0.25, kamienky: 0.8, aloe: 0.1, papradie: 0.3 },
      dedina: { trava: 12, kamienky: 0.6 },
    },
    zona(x, z, h, P) {
      const dc = P.dist(x, z, STRED[0], STRED[1]);
      if (dc < 24) return 'dedina';                      // volny priestor okolo kolov
      if (h > 2.3 && dc < 90) return 'sucho';
      if (h < -1.0) return null;
      if (h < 0.15) return 'mangrovy';
      if (h < 1.1) return P.noise(x * 0.02, z * 0.02, 77) > -0.12 ? 'plytcina' : 'mangrovy';
      return 'ostrovcek';
    },
  },

  predmety: { nahodne: ['palica', 'palica', 'kamen'], pocet: 50, pevne: [['musla', 186, 12], ['musla', 200, 18]] },

  pamiatkyNahlad: [[STRED[0], STRED[1], 20, 'dedina na koloch'], [-150, -40, 6, 'krokodilie hniezdo'], [-40, 101, 5, 'kanoe']],

  pamiatky(P) {
    const sk = stavebnica();
    const kolizie = [];
    const DREVO = 0x6b4a2e, DREVO_T = 0x4a3220, SLAMA = 0xb8964a, SLAMA_T = 0x8a7038;
    const r = P.rng(this.seed);

    // ---------- dedina na koloch ----------
    // [x, z, sirka, hlbka, vyska podlahy nad zemou, naklon x, naklon z, strecha: 0 nie, 1 cela, 2 rozpadnuta]
    const CHATY = [
      [-9, -7, 7, 6, 2.4, 0, 0, 1],
      [9, -10, 6, 6, 2.6, 0.03, -0.02, 1],
      [8, 8, 7, 5, 2.2, -0.12, 0.08, 2],
      [-11, 10, 6, 6, 2.3, 0.18, -0.1, 0],
    ];
    const podlahy = [];
    for (const [cx0, cz0, w, d, vys, nx, nz, strecha] of CHATY) {
      const cx = cx0 + STRED[0], cz = cz0 + STRED[1];
      const y0 = P.vyska(cx, cz) + vys;
      podlahy.push([cx, cz, y0, w, d]);
      const rot = new THREE.Euler(nx, r() * 0.4 - 0.2, nz);
      const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, y0, cz), new THREE.Quaternion().setFromEuler(rot), new THREE.Vector3(1, 1, 1));
      // koly (4 rohy + stred dlhych stran)
      for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]]) {
        const lx = px * (w / 2 - 0.3), lz = pz * (d / 2 - 0.3);
        const v = new THREE.Vector3(lx, 0, lz).applyMatrix4(m);
        const zem = P.vyska(v.x, v.z), l = v.y - zem + 0.6;
        if (strecha === 0 && px === 1 && pz === 1) continue;          // zlomeny kol -> chata sa naklonila
        sk.valec(DREVO_T, v.x, zem - 0.6 + l / 2, v.z, 0.16, l, 0.05 * (r() - 0.5), 0.05 * (r() - 0.5));
        kolizie.push([v.x, v.z, 0.35]);
      }
      // podlaha z dosiek (par chyba)
      const nDosiek = Math.round(w / 0.55);
      for (let i = 0; i < nDosiek; i++) {
        if (r() < (strecha === 0 ? 0.3 : 0.08)) continue;
        const lx = -w / 2 + (i + 0.5) * (w / nDosiek);
        sk.kvader(r() < 0.5 ? DREVO : DREVO_T, d * (0.9 + r() * 0.1), 0.1, w / nDosiek * 0.9, m, lx, 0.05, 0, 0, Math.PI / 2, 0);
      }
      // nosne tramy
      sk.kvader(DREVO_T, w, 0.2, 0.2, m, 0, -0.12, -d / 2 + 0.3);
      sk.kvader(DREVO_T, w, 0.2, 0.2, m, 0, -0.12, d / 2 - 0.3);
      // rohove stlpiky + nizke zabradlie
      for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
        sk.kvader(DREVO, 0.14, 2.1, 0.14, m, px * (w / 2 - 0.3), 1.05, pz * (d / 2 - 0.3));
      sk.kvader(DREVO, w - 0.6, 0.08, 0.08, m, 0, 0.9, -d / 2 + 0.3);
      if (strecha) {
        // strecha z listov: stvorboky ihlan (rozpadnuta = nizsia, posunuta a nakrivo)
        const zl = strecha === 2;
        sk.ihlan(zl ? SLAMA_T : SLAMA, w * 0.78, 1.9, m, zl ? 0.6 : 0, zl ? 2.2 : 2.95, zl ? 0.4 : 0, zl ? 0.35 : 0, zl ? -0.2 : 0);
        if (!zl) sk.ihlan(SLAMA_T, w * 0.82, 0.35, m, 0, 2.12, 0);
      } else {
        // zrutena strecha lezi vedla v blate
        sk.ihlan(SLAMA_T, w * 0.7, 1.4, null, cx - 6, P.vyska(cx - 6, cz + 3) + 0.4, cz + 3, 1.2, 0.3);
      }
    }
    // dreveny chodnik (lavka) medzi chatami - chybajuce a prepadnute dosky
    const SPOJE = [[0, 1], [0, 3], [2, 3], [1, 2]];
    for (const [a, b] of SPOJE) {
      const A = podlahy[a], B = podlahy[b];
      const dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz), uhol = Math.atan2(dx, dz);
      const n = Math.floor(L / 0.6);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        if (r() < 0.15 || (b === 2 && a === 1 && t > 0.4 && t < 0.7)) continue;     // diery v lavke
        const x = A[0] + dx * t, z = A[1] + dz * t, y = A[2] + (B[2] - A[2]) * t - 0.1 + Math.sin(t * Math.PI) * -0.3;
        sk.kvader(r() < 0.5 ? DREVO : DREVO_T, 1.3, 0.07, 0.45, null, x, y, z, (r() - 0.5) * 0.15, uhol, (r() - 0.5) * 0.1);
      }
      // laná po bokoch (2 tenke tramy) + podpery v strede
      for (const s of [-0.65, 0.65]) {
        const ox = Math.cos(uhol) * s, oz = -Math.sin(uhol) * s;
        sk.valecMedzi(DREVO_T, A[0] + ox, A[2] + 0.8, A[1] + oz, B[0] + ox, B[2] + 0.8, B[1] + oz, 0.03);
      }
      const mx = A[0] + dx / 2, mz = A[1] + dz / 2, zem = P.vyska(mx, mz);
      sk.valec(DREVO_T, mx, (zem + (A[2] + B[2]) / 2) / 2 - 0.3, mz, 0.12, (A[2] + B[2]) / 2 - zem + 0.4, 0, 0);
      kolizie.push([mx, mz, 0.3]);
    }
    // ohnisko dediny: kruh kamenov + stare hlinene hrnce
    const ox = STRED[0] - 1, oz = STRED[1] + 1, oy = P.vyska(ox, oz);
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; sk.kamen(0x6a655a, ox + Math.cos(a) * 1.1, oy + 0.1, oz + Math.sin(a) * 1.1, 0.28); }
    sk.valec(0x2a2420, ox, oy + 0.03, oz, 0.9, 0.06, 0, 0);
    for (const [hx, hz, rs] of [[3, -2.5, 0.35], [3.6, -1.8, 0.28], [-2.2, 3, 0.32]])
      sk.hrniec(0xa0603a, ox + hx, P.vyska(ox + hx, oz + hz), oz + hz, rs);

    // ---------- krokodilie hniezdo ----------
    const hn = najdi(P, -150, -40, 0.3, 1.0);
    const hy = P.vyska(hn[0], hn[1]);
    sk.gula(0x4e3e2a, hn[0], hy - 0.2, hn[1], 2.2, 0.55, 2.0);
    sk.gula(0x5d4a30, hn[0] + 0.3, hy + 0.15, hn[1] - 0.2, 1.4, 0.45, 1.3);
    for (let i = 0; i < 26; i++) {                     // trstina nahadzana na kope
      const a = r() * 6.28, d = 0.4 + r() * 1.8;
      sk.valec(r() < 0.5 ? 0xa89850 : 0x7d7a3c, hn[0] + Math.cos(a) * d, hy + 0.25, hn[1] + Math.sin(a) * d, 0.025, 1.4 + r(), 1.2 * (r() - 0.5) + 1.2, a);
    }
    for (let i = 0; i < 6; i++) {                      // biele vajcia v jamke
      const a = i / 6 * 6.28 + r() * 0.4, d = 0.25 + r() * 0.2;
      sk.gula(0xf2eee0, hn[0] + 0.3 + Math.cos(a) * d, hy + 0.55, hn[1] - 0.2 + Math.sin(a) * d, 0.16, 0.22, 0.16);
    }
    kolizie.push([hn[0], hn[1], 1.6]);

    // ---------- stare ukotvene kanoe v hlavnom kanali pri dedine ----------
    const kx = -40, kz = 101, ku = 1.68;
    const mk = new THREE.Matrix4().compose(new THREE.Vector3(kx, -0.05, kz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.04, ku, 0.12)), new THREE.Vector3(1, 1, 1));
    sk.gula(0x5a3c22, 0, 0, 0, 0.62, 0.36, 2.7, mk);           // trup
    sk.gula(0x2e2014, 0, 0.12, 0, 0.5, 0.26, 2.45, mk);        // vydlabany vnutrajsok (tmavy)
    sk.kvader(0x6b4a2e, 1.0, 0.06, 0.25, mk, 0, 0.22, -0.8);   // lavicky
    sk.kvader(0x6b4a2e, 1.0, 0.06, 0.25, mk, 0, 0.22, 0.9);
    sk.kvader(0x7a5a38, 0.12, 0.05, 1.6, mk, 0.3, 0.3, 0.2, 0.1, 0.3, 0);   // zlomene padlo
    // kotviaci kol a lano
    const kpx = kx - 2.0, kpz = kz + 2.6;
    sk.valec(DREVO_T, kpx, -0.5, kpz, 0.12, 2.6, 0.08, 0);
    const pr = new THREE.Vector3(0, 0.2, -2.4).applyMatrix4(mk);
    sk.valecMedzi(0x9a8a5a, kpx, 0.6, kpz, pr.x, pr.y, pr.z, 0.025);
    kolizie.push([kpx, kpz, 0.3]);

    return { objekty: sk.hotovo(P), kolizie };
  },
};

// najde miesto blizko (x, z) s vyskou v rozsahu (spirala)
function najdi(P, x, z, hmin, hmax) {
  for (let i = 0; i < 400; i++) {
    const a = i * 2.4, d = Math.sqrt(i) * 4, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, h = P.vyska(px, pz);
    if (h > hmin && h < hmax) return [px, pz];
  }
  return [x, z];
}

// stavebnica: geometrie sa zbieraju podla farby a na konci zlucia (1 siet = 1 farba -> malo draw callov)
function stavebnica() {
  const kusy = new Map();
  const o = new THREE.Object3D();
  const pridaj = (farba, g, m) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); g.applyMatrix4(m); if (!kusy.has(farba)) kusy.set(farba, []); kusy.get(farba).push(g); };
  const mat = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.updateMatrix(); return o.matrix.clone(); };
  const vRodicovi = (rodic, m) => rodic ? new THREE.Matrix4().multiplyMatrices(rodic, m) : m;
  return {
    // kvader w x h x d; s rodicom (Matrix4) su x, y, z lokalne
    kvader(f, w, h, d, rodic, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { pridaj(f, new THREE.BoxGeometry(w, h, d), vRodicovi(rodic, mat(x, y, z, rx, ry, rz))); },
    valec(f, x, y, z, r, l, rx = 0, ry = 0) { pridaj(f, new THREE.CylinderGeometry(r * 0.85, r, l, 6), mat(x, y, z, rx, ry, 0)); },
    valecMedzi(f, ax, ay, az, bx, by, bz, r) {
      const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz), l = a.distanceTo(b);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      pridaj(f, new THREE.CylinderGeometry(r, r, l, 4), new THREE.Matrix4().compose(a.add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
    },
    ihlan(f, w, h, rodic, x = 0, y = 0, z = 0, rx = 0, rz = 0) { pridaj(f, new THREE.ConeGeometry(w * 0.72, h, 4), vRodicovi(rodic, mat(x, y, z, rx, Math.PI / 4, rz))); },
    gula(f, x, y, z, sx, sy, sz, rodic) { pridaj(f, new THREE.SphereGeometry(1, 9, 6), vRodicovi(rodic, mat(x, y, z, 0, 0, 0, sx, sy, sz))); },
    kamen(f, x, y, z, r) { pridaj(f, new THREE.DodecahedronGeometry(r, 0), mat(x, y, z, x, z, 0, 1, 0.6, 1)); },
    hrniec(f, x, y, z, r) { pridaj(f, new THREE.CylinderGeometry(r * 0.6, r * 0.7, r * 1.4, 7), mat(x, y + r * 0.6, z)); pridaj(f, new THREE.SphereGeometry(r, 7, 5), mat(x, y + r * 0.5, z, 0, 0, 0, 1, 0.8, 1)); },
    hotovo(P) {
      const out = [];
      for (const [f, geo] of kusy) {
        const g = mergeGeometries(geo); g.computeVertexNormals();
        out.push(new THREE.Mesh(g, P.mat(f, { flatShading: true })));
      }
      return out;
    },
  };
}
