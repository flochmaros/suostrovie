// Ohniva hora (pasmo 2): velka sopka s kraterom zeravej lavy, ryhy a hrebene na svahoch, tri siroke lavove polia
// (jedine miesto s obsidianom), cierne piesocne plaze a starsi zarastený vybezok na ZJZ (smerom k startu) - pristanie a tabor.
// Biom 'sopecny' musi zostat (podla neho sa spawnuju lavove jastery).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const R = 185, SEED = 11190;
const CX = 25, CZ = -15;                 // stred kuzela (krater)
const RK = 30;                           // polomer krateru (okraj)
const KUZEL_R = 165, KUZEL_H = 128;      // kuzel: na KUZEL_R klesne na 0
// smer od ostrova k startu: svet (260,260) - (1850,-540) -> ZJZ
const UX = -0.893, UZ = 0.449, UHOL = Math.atan2(UZ, UX);
const PX = UX * 185, PZ = UZ * 185;      // stred zeleneho vybezku
// lavove prudy (od upatia kuzela k moru, na konci sa rozsiruju do vejara): [ax, az, bx, bz, sirka]
const PRUDY = [[55, -58, 150, -150, 40], [55, 45, 100, 175, 38], [-15, -75, -45, -195, 34], [80, 105, 165, 95, 22]];
// zatoky: [x, z, polomer, hlbka]
const ZATOKY = [[-92, 172, 55, 0.32], [60, -196, 45, 0.25], [-205, -40, 50, 0.22]];

// vyska kuzela bez krateru; za KUZEL_R strmo klesa pod more (aby hmax nevytvoril plytcinu)
function kuzel(rc) {
  const u = 1 - rc / KUZEL_R;
  return u > 0 ? KUZEL_H * Math.pow(u, 1.45) : u * 100;
}
const DNO = kuzel(RK) - 24;              // dno krateru (~72 m) - hladina lavy

// maska lavovych prudov 0..1 (cf = nizkofrekvencny sum -> prudy sa vlnia a rozlievaju)
function lava(x, z, P, cf) {
  const wx = x + cf * 26, wz = z - cf * 20;
  let m = 0;
  for (const [ax, az, bx, bz, w] of PRUDY) {
    const dx = bx - ax, dz = bz - az, u = P.clamp(((wx - ax) * dx + (wz - az) * dz) / (dx * dx + dz * dz), 0, 1);
    const d = Math.hypot(wx - ax - dx * u, wz - az - dz * u), ww = w * (0.55 + 0.8 * u) * (1 + cf * 0.3);
    m = Math.max(m, P.smooth(ww, ww * 0.6, d));
  }
  return m;
}
const mix = (c, hex, k) => {                 // c = {r,g,b}, zmiesa s farbou hex v pomere k
  if (k <= 0) return;
  k = Math.min(1, k);
  c.r += (((hex >> 16) & 255) / 255 - c.r) * k; c.g += (((hex >> 8) & 255) / 255 - c.g) * k; c.b += ((hex & 255) / 255 - c.b) * k;
};

export default {
  meno: 'Ohnivá hora', podnadpis: 'Sopka čierneho skla', biom: 'sopecny', R, ext: 385, H: 100, seed: SEED,

  vyska(x, z, P) {
    const cf = P.fbm(x * 0.007, z * 0.007, SEED, 2);        // tvar brehu (2 volania sumu)
    const m = lava(x, z, P, cf);
    let zat = 0;
    for (const [zx, zz, zr, zh] of ZATOKY) zat += zh * P.smooth(zr, zr * 0.3, Math.hypot(x - zx, z - zz));
    // hlavny ostrov: plaz + nizke svahy (s = vzdialenost od brehu do vnutra)
    const t = 1 - P.elipsa(x, z, R * 1.08, R * 0.94, 0.5) + 0.22 * cf + 0.18 * m - zat;
    let h;
    if (t >= 0) { const s = t * R; h = s < 18 ? s * 0.09 : 1.62 + (s - 18) * 0.075; }
    else h = -(-t * 14 + t * t * 80);
    // kuzel: ryhy a hrebene od krateru dolu (sum po kruznici okolo krateru -> radialne ryhy)
    const dx = x - CX, dz = z - CZ, rc = Math.hypot(dx, dz) || 1e-6;
    let hk = kuzel(rc), rk = RK;
    if (rc < KUZEL_R) {                                        // sum len na kuzeli (za nim netreba)
      const rr = P.noise(dx / rc * 5.5, dz / rc * 5.5, rc * 0.013 + 3.1);
      rk = RK + rr * 6;                                        // nepravidelny okraj krateru
      hk += (1 - Math.abs(rr) * 2 - 0.55) * 9 * P.smooth(RK, RK + 25, rc) * P.smooth(KUZEL_R, 95, rc);
      hk += 3 * Math.max(0, 1 - Math.abs(rc - rk) / 6);        // ostry hreben okraja
      if (rc < rk + 2) hk = P.lerp(hk, DNO, P.smooth(rk - 1, rk - 11, rc));   // strma stena dolu na rovne dno
    }
    h = P.hmax(h, hk, 8);
    // lavove pole: nadvihnuty prud s ostrym celom a hrubym povrchom (aa lava), pri mori nizky utes
    if (m > 0 && t > -0.04) h += m * (2.5 + 1.2 * P.ridge(x * 0.09, z * 0.09, 7)) * P.smooth(-0.04, 0.03, t);
    // zeleny vybezok (starsi, zvetrany): siroka plaz a oble kopceky
    const tp = 1 - P.elipsa(x - PX, z - PZ, 85, 55, UHOL) + 0.18 * cf - zat * 0.6;
    const hp = tp >= 0 ? (tp < 0.3 ? tp * 5.5 : 1.65 + 12 * Math.pow((tp - 0.3) / 0.7, 1.2)) : -(-tp * 9 + tp * tp * 50);
    h = P.hmax(h, hp, 6);
    // drobne nerovnosti (v krateri skoro ziadne - rovna hladina lavy)
    const nad = P.smooth(0, 0.12, Math.max(t, tp));
    if (nad > 0) h += P.fbm(x * 0.045, z * 0.045, SEED + 7, 2) * (1.3 + 1.5 * P.smooth(0.2, 0.5, tp)) * nad * (rc < rk - 8 ? 0.1 : 1);
    return Math.max(h, -45);
  },

  // cierna lava, popol na vrchu, cervenkasty krater, zeleny vybezok
  farba(x, z, h, f, P) {
    const rc = Math.hypot(x - CX, z - CZ);
    const cf = P.fbm(x * 0.007, z * 0.007, SEED, 2);
    const m = lava(x, z, P, cf);
    const tp = 1 - P.elipsa(x - PX, z - PZ, 85, 55, UHOL);
    const n = P.noise(x * 0.07, z * 0.07, 5);
    if (m > 0) {                                                // lavove pole: takmer cierne, miestami hrdzave
      mix(f.trava, n > 0.15 ? 0x3a2018 : 0x161414, m * 0.9);
      mix(f.piesok, 0x1c1a19, m * 0.6);
    }
    mix(f.trava, 0x4d4743, P.smooth(110, 60, rc) * 0.7);       // popol okolo vrcholu
    mix(f.trava, 0x6a3324, P.smooth(RK + 2, RK - 6, rc) * 0.8); // vnutro krateru do cervena
    mix(f.trava, 0x9a8a3a, P.smooth(0.25, 0.45, n) * P.smooth(RK + 10, RK, rc) * P.smooth(RK - 10, RK - 2, rc) * 0.6); // siricne povlaky na okraji
    if (tp > -0.1) {                                            // zelen na vybezku
      const k = P.smooth(-0.1, 0.35, tp);
      mix(f.trava, n > 0 ? 0x4f9236 : 0x3f8030, k * 0.85);
    }
  },

  vegetacia: {
    zony: {
      lava: { obsidian: 0.3, balvan: 0.35, kamienky: 1.6 },
      breh: { palma: 0.1, aloe: 0.18, papradie: 0.15, trava: 3, kamienky: 0.8, balvan: 0.1 },
      svah: { balvan: 0.35, kamienky: 1.3, trava: 1.5, aloe: 0.06, papradie: 0.05 },
      vrch: { kamienky: 1.1, balvan: 0.12 },
      vybezok: { palma: 0.6, strom: 0.25, ker: 0.5, papradie: 0.6, trava: 20, kvet: 0.3, bobule: 0.1, ibistek: 0.15,
        monstera: 0.15, hibiskus: 0.1, aloe: 0.08, balvan: 0.1, kamienky: 0.4 },
    },
    zona(x, z, h, P) {
      if (h < 0) return null;
      const rc = Math.hypot(x - CX, z - CZ);
      if (1 - P.elipsa(x - PX, z - PZ, 85, 55, UHOL) > -0.06 && rc > 120) return 'vybezok';
      if (rc < 75) return 'vrch';
      if (lava(x, z, P, P.fbm(x * 0.007, z * 0.007, SEED, 2)) > 0.45) return 'lava';
      if (h < 7) return 'breh';
      return 'svah';
    },
  },

  predmety: { nahodne: ['kamen', 'kamen', 'palica'], pocet: 45 },

  pamiatky(P) {
    const r = P.rng(SEED + 1), objekty = [], kolizie = [];
    const yDno = P.vyska(CX, CZ);

    // --- zeravé jazero lavy v krateri (nepravidelny disk) ---
    const jg = new THREE.CircleGeometry(16, 30);
    const pos = jg.attributes.position;
    for (let i = 1; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), a = Math.atan2(vy, vx);
      const k = 1 + 0.14 * Math.sin(a * 3 + 1) + 0.08 * Math.sin(a * 7 + 2);
      pos.setXY(i, vx * k, vy * k);
    }
    jg.rotateX(-Math.PI / 2);
    const jazero = new THREE.Mesh(jg, P.mat(0xff6a1a, { emissive: 0xff4810, emissiveIntensity: 2.2, roughness: 0.5 }));
    jazero.position.set(CX, yDno + 0.45, CZ);
    objekty.push(jazero);
    // stuhnuta kora na lave (tmave platne)
    const platne = [];
    for (let i = 0; i < 9; i++) {
      const a = r() * 6.28, d = 3 + r() * 9, g = new THREE.CircleGeometry(1.2 + r() * 2, 5);
      g.scale(1, 0.5 + r() * 0.5, 1).rotateZ(r() * 6.28).rotateX(-Math.PI / 2).translate(CX + Math.cos(a) * d, yDno + 0.52, CZ + Math.sin(a) * d);
      platne.push(g);
    }
    objekty.push(new THREE.Mesh(mergeGeometries(platne), P.mat(0x2a1c18, { emissive: 0x401008, emissiveIntensity: 0.6 })));

    // --- zeravé pukliny: lomene ciary tenkych kvadrov po terene ---
    const pukliny = [];
    function puklina(x, z, uhol, dlzka, sirka) {
      for (let s = 0; s < dlzka; s += 2) {
        uhol += (r() - 0.5) * 0.7;
        const nx = x + Math.cos(uhol) * 2, nz = z + Math.sin(uhol) * 2;
        const y0 = P.vyska(x, z), y1 = P.vyska(nx, nz);
        const g = new THREE.BoxGeometry(2.3, 0.3, sirka * (1 - s / dlzka * 0.6));
        g.rotateZ(Math.atan2(y1 - y0, 2)).rotateY(-uhol).translate((x + nx) / 2, (y0 + y1) / 2 + 0.06, (z + nz) / 2);
        pukliny.push(g);
        x = nx; z = nz;
      }
    }
    for (let i = 0; i < 6; i++) {                               // v krateri okolo jazera
      const a = i * 1.05 + r() * 0.4;
      puklina(CX + Math.cos(a) * 15, CZ + Math.sin(a) * 15, a, 6 + r() * 5, 0.7);
    }
    const PUKLINY = [[88, -82, -0.75], [80, 88, 1.1], [-26, -112, -1.7], [62, -38, -0.5], [-8, 58, 1.9]];
    for (const [x, z, u] of PUKLINY) { puklina(x, z, u, 14 + r() * 8, 0.9); puklina(x + 3, z + 2, u + 0.6, 8, 0.6); }
    objekty.push(new THREE.Mesh(mergeGeometries(pukliny), P.mat(0xff5a14, { emissive: 0xff4a0a, emissiveIntensity: 2.6 })));

    // --- stlpy dymu z krateru (gule nad sebou, vietor ich unasa na vychod) ---
    const DYM = [[CX, CZ, 11, 1], [CX - 9, CZ + 6, 7, 0.7], [62, -38, 5, 0.45]];
    let pocet = 0;
    for (const d of DYM) pocet += d[2];
    const dym = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8),
      P.mat(0x8c8682, { transparent: true, opacity: 0.32, depthWrite: false, roughness: 1 }), pocet);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), S = new THREE.Vector3(), V = new THREE.Vector3(), farba = new THREE.Color();
    let i = 0;
    for (const [x, z, n, k] of DYM) {
      const y0 = P.vyska(x, z);
      for (let j = 0; j < n; j++) {
        const u = j / n, rad = (4 + j * 2.1 + r() * 2) * k;
        V.set(x + u * u * 45 * k + (r() - 0.5) * 3, y0 + 6 + j * 8 * k + rad * 0.4, z - u * 10 * k + (r() - 0.5) * 3);
        S.set(rad, rad * 0.85, rad);
        dym.setMatrixAt(i, M.compose(V, q, S));
        dym.setColorAt(i, farba.setHex(j < 2 && k > 0.6 ? 0xc0866a : 0x9a9894));   // spodok podsvieteny lavou
        i++;
      }
    }
    dym.castShadow = false;
    objekty.push(dym);

    // --- obsidianove ihly pri lavovych poliach (leskle cierne) ---
    const ihly = [];
    const SKUPINY = [[108, -98], [118, -118], [80, 112], [92, 138], [-30, -140], [-24, -118]];
    for (const [sx, sz] of SKUPINY) {
      const n = 4 + Math.floor(r() * 4);
      for (let j = 0; j < n; j++) {
        const a = r() * 6.28, d = j === 0 ? 0 : 1.5 + r() * 4, x = sx + Math.cos(a) * d, z = sz + Math.sin(a) * d;
        const v = (j === 0 ? 5.5 : 1.8 + r() * 3.5) * (0.8 + r() * 0.4), rb = v * 0.22;
        const g = new THREE.ConeGeometry(rb, v, 5);
        g.translate(0, v / 2 - 0.3, 0).rotateY(r() * 6).rotateX((r() - 0.5) * 0.5).rotateZ((r() - 0.5) * 0.5);
        g.translate(x, P.vyska(x, z), z);
        ihly.push(g);
        if (v > 3) kolizie.push([x, z, rb * 0.9]);
      }
    }
    const obs = new THREE.Mesh(mergeGeometries(ihly), P.mat(0x16121c, { roughness: 0.12, metalness: 0.35, flatShading: true }));
    obs.castShadow = true;
    objekty.push(obs);

    return { objekty, kolizie };
  },

  pamiatkyNahlad: [[CX, CZ, 18, 'krater s lavou + dym'], [108, -105, 12, 'obsidianove ihly'], [86, 125, 12, 'obsidianove ihly'],
    [-27, -130, 12, 'obsidianove ihly'], [88, -82, 8, 'puklina'], [-160, 80, 10, 'zeleny vybezok (pristanie)']],
};
