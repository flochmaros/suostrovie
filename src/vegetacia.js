// Vegetacia: modely rastlin sa vyrobia kodom (niekolko variant kazdeho druhu), rozmiestnia sa podla biomu ostrova
// a kreslia sa ako InstancedMesh (tisice kusov = 1 kreslenie). Vietor hybe vrcholmi v shaderi.
// Stromy, kriky a balvany su "uzly": maju zivoty, hitbox a po zniceni davaju suroviny (obsah/zdroje.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { uCas } from './ocean.js';
import { rng } from './nahoda.js';
import { ZDROJE } from './obsah/zdroje.js';

const perlin = new ImprovedNoise();
const V3 = THREE.Vector3;
const C = h => new THREE.Color(h);

// ---------- pomocne funkcie na geometriu ----------
function farbi(geo, farba) {            // jedna farba pre vsetky vrcholy
  const n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([farba.r, farba.g, farba.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
function cista(geo) {                    // pre mergeGeometries: rovnake atributy vsade
  geo.deleteAttribute('uv');
  if (!geo.index) geo.setIndex([...Array(geo.attributes.position.count).keys()]);
  return geo;
}
function vlastna(poz, farby, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(poz, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(farby, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const spoj = geos => mergeGeometries(geos.map(cista));

// guľa s nerovnym povrchom a tienovanim zospodu (koruny, kriky)
function chumac(r, farba, seed, detail = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position, c = new THREE.Color(), a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = perlin.noise(x * 1.3 + seed, y * 1.3, z * 1.3);
    const k = 1 + n * 0.35;
    p.setXYZ(i, x * k, y * k * 0.85, z * k);
    c.copy(farba).multiplyScalar(0.55 + 0.45 * (y / r * 0.5 + 0.5)).offsetHSL(n * 0.03, 0, n * 0.05);
    a.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.computeVertexNormals();
  return g;
}

// list v tvare "V" s vrubmi (palmy, paprade), rastie pozdlz +x
function list(dlzka, sirka, zdvih, pad, fKoren, fSpicka, seg = 14) {
  const poz = [], farby = [], idx = [], c = new THREE.Color();
  for (let i = 0; i <= seg; i++) {
    const s = i / seg, x = dlzka * s, y = zdvih * s - pad * s * s;
    const w = sirka * Math.pow(Math.sin(Math.PI * Math.min(s * 1.1, 1)), 0.7) * (i % 2 ? 1 : 0.6);
    c.copy(fKoren).lerp(fSpicka, s);
    poz.push(x, y, -w, x, y + w * 0.3, 0, x, y, w);
    for (let k = 0; k < 3; k++) farby.push(c.r, c.g, c.b);
    if (i < seg) {
      const a = i * 3;
      idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
    }
  }
  return vlastna(poz, farby, idx);
}

// ---------- druhy ----------
function palma(seed) {
  const r = rng(seed);
  const H = 7 + r() * 4.5, ohyb = 0.6 + r() * 2.6;
  const krivka = new THREE.QuadraticBezierCurve3(new V3(0, 0, 0), new V3(0, H * 0.55, 0), new V3(ohyb, H, 0));
  const S = 18, K = 8, poz = [], farby = [], idx = [];
  const c1 = C(0x7d5c3d), c2 = C(0x5c432c);
  for (let i = 0; i <= S; i++) {
    const t = i / S, p = krivka.getPoint(t), tan = krivka.getTangent(t);
    const n = new V3(tan.y, -tan.x, 0).normalize();
    const rr = (0.32 - 0.14 * t) * (i % 2 ? 1 : 1.09) * (i === 0 ? 1.35 : 1);
    for (let j = 0; j < K; j++) {
      const a = j / K * Math.PI * 2;
      poz.push(p.x + n.x * Math.cos(a) * rr, p.y + n.y * Math.cos(a) * rr, Math.sin(a) * rr);
      const c = i % 2 ? c1 : c2;
      farby.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < S; i++) for (let j = 0; j < K; j++) {
    const a = i * K + j, b = i * K + (j + 1) % K;
    idx.push(a, a + K, b, b, a + K, b + K);
  }
  const kmen = vlastna(poz, farby, idx);

  const vrch = krivka.getPoint(1);
  const casti = [];
  const n = 9 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const L = 3.0 + r() * 1.4;
    const l = list(L, 0.5, 1.0 + r() * 0.6, 2.2 + r() * 1.2, C(0x3c7a2a), C(0x8fbf4a).offsetHSL((r() - 0.5) * 0.04, 0, 0));
    l.rotateZ(0.15 + r() * 0.35).rotateY(i / n * Math.PI * 2 + r() * 0.3).translate(vrch.x, vrch.y, vrch.z);
    casti.push(l);
  }
  for (let i = 0; i < 2; i++) {                      // suche ovisnute listy
    const l = list(2.6, 0.4, 0.2, 3.2, C(0x7d6a3a), C(0xa88f55));
    l.rotateZ(0.6).rotateY(r() * 6.28).translate(vrch.x, vrch.y - 0.2, vrch.z);
    casti.push(l);
  }
  for (let i = 0; i < 3 + r() * 3; i++) {             // kokosy
    const k = farbi(new THREE.IcosahedronGeometry(0.17, 1), C(r() < 0.5 ? 0x5a3c1d : 0x6f8a2a));
    const a = r() * 6.28;
    k.translate(vrch.x + Math.cos(a) * 0.28, vrch.y - 0.3 - r() * 0.2, vrch.z + Math.sin(a) * 0.28);
    casti.push(k);
  }
  return { kmen, koruna: spoj(casti), vyska: H };
}

function strom(seed) {
  const r = rng(seed);
  const H = 4.5 + r() * 4;
  const kmen = farbi(new THREE.CylinderGeometry(0.2, 0.38, H, 8, 6), C(0x6a5038));
  kmen.translate(0, H / 2, 0);
  const p = kmen.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + Math.sin(p.getY(i) * 0.6 + seed) * 0.18);
  const kmene = [kmen];
  for (let i = 0; i < 3; i++) {                       // konare
    const k = farbi(new THREE.CylinderGeometry(0.06, 0.12, 2.2, 5), C(0x6a5038));
    k.translate(0, 1.1, 0).rotateZ(0.7 + r() * 0.4).rotateY(r() * 6.28).translate(0, H * (0.55 + r() * 0.25), 0);
    kmene.push(k);
  }
  const zelene = [0x3d7a2c, 0x4f8c33, 0x2f6b2a, 0x5f9a3a];
  const farba = C(zelene[Math.floor(r() * zelene.length)]);
  const koruna = [];
  const n = 5 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28, d = i === 0 ? 0 : 0.8 + r() * 1.4;
    const g = chumac(1.3 + r() * 1.0, farba, seed + i * 7);
    g.translate(Math.cos(a) * d, H + 0.4 + r() * 1.6 - d * 0.3, Math.sin(a) * d);
    koruna.push(g);
  }
  return { kmen: spoj(kmene), koruna: spoj(koruna), vyska: H };
}

function ker(seed, kvety) {
  const r = rng(seed);
  const casti = [];
  const farba = C([0x3f7f2e, 0x4c8a35, 0x2f6a2a][Math.floor(r() * 3)]);
  for (let i = 0; i < 3 + r() * 3; i++) {
    const g = chumac(0.45 + r() * 0.4, farba, seed + i * 3);
    g.translate((r() - 0.5) * 1.1, 0.35 + r() * 0.4, (r() - 0.5) * 1.1);
    casti.push(g);
  }
  if (kvety) for (let i = 0; i < 14; i++) {           // ibistek
    const k = farbi(new THREE.IcosahedronGeometry(0.09, 0), C(kvety));
    const a = r() * 6.28, d = 0.4 + r() * 0.5;
    k.translate(Math.cos(a) * d, 0.5 + r() * 0.6, Math.sin(a) * d);
    casti.push(k);
  }
  return spoj(casti);
}

function papradie(seed) {
  const r = rng(seed), casti = [];
  const n = 8 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const l = list(1.1 + r() * 0.5, 0.17, 0.55, 0.9, C(0x2b5e22), C(0x5f9a3c), 10);
    l.rotateZ(0.5 + r() * 0.3).rotateY(i / n * 6.28 + r() * 0.3);
    casti.push(l);
  }
  return spoj(casti);
}

function trava(seed) {
  const r = rng(seed), poz = [], farby = [], idx = [];
  const ck = C(0x3d6e25), cs = C(0x9cc25a);
  for (let b = 0; b < 9; b++) {
    const a = r() * 6.28, dx = Math.cos(a), dz = Math.sin(a), h = 0.45 + r() * 0.5, ohyb = 0.15 + r() * 0.35;
    const ox = (r() - 0.5) * 0.35, oz = (r() - 0.5) * 0.35, w = 0.035 + r() * 0.02;
    const zac = poz.length / 3;
    for (let i = 0; i <= 3; i++) {
      const s = i / 3, ww = w * (1 - s);
      const x = ox + dx * ohyb * s * s, z = oz + dz * ohyb * s * s, y = h * s;
      poz.push(x - dz * ww, y, z + dx * ww, x + dz * ww, y, z - dx * ww);
      const c = ck.clone().lerp(cs, s);
      farby.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (i < 3) { const q = zac + i * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
    }
  }
  return vlastna(poz, farby, idx);
}

function kvetina(seed, farba) {
  const r = rng(seed), casti = [];
  for (let i = 0; i < 5; i++) {
    const x = (r() - 0.5) * 0.5, z = (r() - 0.5) * 0.5, h = 0.25 + r() * 0.3;
    casti.push(farbi(new THREE.CylinderGeometry(0.012, 0.015, h, 3).translate(x, h / 2, z), C(0x4a7f2e)));
    casti.push(farbi(new THREE.IcosahedronGeometry(0.06, 0).scale(1, 0.6, 1).translate(x, h, z), C(farba)));
  }
  return spoj(casti);
}

function kamen(seed, mach) {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position, a = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = perlin.noise(x * 1.1 + seed, y * 1.1, z * 1.1) + 0.5 * perlin.noise(x * 2.7, y * 2.7 + seed, z * 2.7);
    const k = 1 + n * 0.3;
    p.setXYZ(i, x * k, Math.max(y * k * 0.65, -0.2), z * k);
    c.set(0x8a867e).offsetHSL(0, 0, n * 0.08);
    if (mach && y > 0.4) c.lerp(C(0x4f7a35), Math.min((y - 0.4) * 2, 0.8));
    a.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.computeVertexNormals();
  return g;
}

// ---------- materialy s vetrom ----------
function material(vietor, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, envMapIntensity: 0.4, ...opts });
  if (!vietor) return m;
  m.onBeforeCompile = sh => {
    sh.uniforms.uCas = uCas;
    sh.vertexShader = 'uniform float uCas;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      vec3 transformed = vec3(position);
      #ifdef USE_INSTANCING
        vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
      #else
        vec2 ip = vec2(0.0);
      #endif
      float vy = max(position.y, 0.0);
      float w = sin(uCas * 1.1 + ip.x * 0.05 + ip.y * 0.07) * 0.7 + sin(uCas * 2.7 + ip.x * 0.31 + ip.y * 0.17) * 0.3;
      transformed.xz += vec2(w, w * 0.6) * ${vietor.toFixed(5)} * vy * vy;`);
  };
  m.customProgramCacheKey = () => 'vietor' + vietor;
  return m;
}
const M = {
  kmen: material(0.0012),
  listy: material(0.0012, { side: THREE.DoubleSide }),
  korunaStromu: material(0.0012),   // rovnako ako kmen, aby koruna neodbiehala
  ker: material(0.05),
  papradie: material(0.08, { side: THREE.DoubleSide }),
  trava: material(0.28, { side: THREE.DoubleSide }),
  kvety: material(0.2),
  kamen: material(0, { roughness: 0.95 }),
};

// ---------- varianty (vyrobia sa raz pri starte) ----------
const DRUHY = {
  palma: [1, 2, 3, 4].map(palma),
  strom: [11, 12, 13, 14].map(strom),
  ker: [21, 22, 23].map(s => ker(s)).concat([ker(24, 0xe0304a), ker(25, 0xf07ab0)]),
  papradie: [31, 32].map(papradie),
  trava: [41, 42, 43].map(trava),
  kvety: [[51, 0xe8343c], [52, 0xf4c430], [53, 0xf5f0e8], [54, 0xb05ad8]].map(([s, f]) => kvetina(s, f)),
  kamen: [61, 62, 63].map(s => kamen(s, false)),
  kamenMach: [64, 65].map(s => kamen(s, true)),
};

// hustota druhov na 100 m2 podla biomu
const BIOMY = {
  palmovy: { palma: 0.9, strom: 0.08, ker: 0.5, papradie: 0.25, trava: 22, kvety: 0.6, balvan: 0.12, kamienky: 0.4 },
  dzungla: { palma: 0.3, strom: 0.9, ker: 1.2, papradie: 1.6, trava: 16, kvety: 0.4, balvan: 0.18, kamienky: 0.3 },
  skalnaty: { palma: 0.25, strom: 0.12, ker: 0.3, papradie: 0.1, trava: 10, kvety: 0.25, balvan: 0.6, kamienky: 1.2 },
};

// ---------- rozmiestnenie na ostrove ----------
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s3 = new V3(), p3 = new V3(), farba = new THREE.Color();

export function postavVegetaciu(o, skupina, r, h, zobrate) {
  const B = BIOMY[o.biom];
  const plocha = Math.PI * o.R * o.R / 100;
  const obsadene = new Map();          // jednoducha mriezka 2 m, aby stromy neboli v sebe
  const volne = (x, z, d) => {
    const k = Math.ceil(d / 2), gx = Math.floor(x / 2), gz = Math.floor(z / 2);
    for (let i = -k; i <= k; i++) for (let j = -k; j <= k; j++) {
      const o2 = obsadene.get((gx + i) + ',' + (gz + j));
      if (o2 && Math.hypot(o2[0] - x, o2[1] - z) < d) return false;
    }
    return true;
  };
  const obsad = (x, z) => obsadene.set(Math.floor(x / 2) + ',' + Math.floor(z / 2), [x, z]);
  const bod = () => {
    const x = o.x + (r() * 2 - 1) * o.R * 1.15, z = o.z + (r() * 2 - 1) * o.R * 1.15, y = h(x, z);
    return { x, z, y, sklon: Math.abs(h(x + 1, z) - y) + Math.abs(h(x, z + 1) - y) };
  };

  const davky = new Map();             // "druh:varianta" -> [{x,y,z,rot,mierka,farba,uzol}]
  const pridaj = (druh, v, x, y, z, mierka, odtien, uzol, naklon = 0.1) => {
    const k = druh + ':' + v;
    if (!davky.has(k)) davky.set(k, []);
    davky.get(k).push({ x, y, z, rot: r() * 6.28, nx: (r() - 0.5) * naklon, nz: (r() - 0.5) * naklon, mierka, odtien, uzol });
  };
  const uzly = [];
  const pocty = {};
  const uzol = (typ, x, y, z, rKolizia, rZasah) => {
    pocty[typ] = (pocty[typ] || 0) + 1;
    const id = `${o.bx},${o.bz},${typ}${pocty[typ]}`;
    const u = { id, typ, x, y, z, rKolizia, rZasah, zivoty: ZDROJE[typ].zivoty, zniceny: zobrate.has(id), casti: [], tras: 0, pad: -1 };
    uzly.push(u);
    return u;
  };

  for (let i = 0; i < plocha * B.palma; i++) {
    const b = bod();
    if (b.y < 0.8 || b.y > 10 || b.sklon > 0.9 || !volne(b.x, b.z, 3.2)) continue;
    obsad(b.x, b.z);
    const mierka = 0.8 + r() * 0.45;
    pridaj('palma', Math.floor(r() * 4), b.x, b.y - 0.1, b.z, mierka, 0.12, uzol('palma', b.x, b.y, b.z, 0.32 * mierka, 0.5), 0.05);
  }
  for (let i = 0; i < plocha * B.strom; i++) {
    const b = bod();
    if (b.y < 2.5 || b.sklon > 1.3 || !volne(b.x, b.z, 4)) continue;
    obsad(b.x, b.z);
    const mierka = 0.8 + r() * 0.5;
    pridaj('strom', Math.floor(r() * 4), b.x, b.y - 0.2, b.z, mierka, 0.15, uzol('strom', b.x, b.y, b.z, 0.38 * mierka, 0.6), 0.06);
  }
  for (let i = 0; i < plocha * B.balvan; i++) {
    const b = bod();
    if (b.y < 0.4 || !volne(b.x, b.z, 2.5)) continue;
    obsad(b.x, b.z);
    const mierka = 0.8 + r() * 1.0;
    pridaj(o.biom === 'dzungla' ? 'kamenMach' : 'kamen', Math.floor(r() * 2), b.x, b.y - 0.15 * mierka, b.z, mierka, 0.1,
      uzol('balvan', b.x, b.y, b.z, 0.85 * mierka, 0.3), 0.4);
  }
  for (let i = 0; i < plocha * B.ker; i++) {
    const b = bod();
    if (b.y < 1.6 || b.sklon > 1.5 || !volne(b.x, b.z, 1.2)) continue;
    pridaj('ker', Math.floor(r() * 5), b.x, b.y - 0.1, b.z, 0.8 + r() * 0.6, 0.12, uzol('ker', b.x, b.y, b.z, 0, 0.9), 0.1);
  }
  for (let i = 0; i < plocha * B.papradie; i++) {
    const b = bod();
    if (b.y > 2 && b.sklon < 1.5) pridaj('papradie', Math.floor(r() * 2), b.x, b.y, b.z, 0.7 + r() * 0.7, 0.15);
  }
  for (let i = 0; i < Math.min(plocha * B.trava, 12000); i++) {
    const b = bod();
    if (b.y > 1.5 && b.sklon < 1.4 && perlin.noise(b.x * 0.05, b.z * 0.05, o.seed) > -0.2)
      pridaj('trava', Math.floor(r() * 3), b.x, b.y - 0.05, b.z, 0.9 + r() * 0.8, 0.25);
  }
  for (let i = 0; i < plocha * B.kvety; i++) {
    const b = bod();
    if (b.y > 1.7 && b.sklon < 1) pridaj('kvety', Math.floor(r() * 4), b.x, b.y, b.z, 0.8 + r() * 0.6, 0.05);
  }
  for (let i = 0; i < plocha * B.kamienky; i++) {
    const b = bod();
    if (b.y > -3) pridaj('kamen', 2, b.x, b.y - 0.05, b.z, 0.12 + r() * 0.35, 0.1, null, 1);
  }

  // davky -> InstancedMesh
  for (const [k, polozky] of davky) {
    const [druh, v] = k.split(':');
    const d = DRUHY[druh][v];
    const vrstvy = d.kmen ? [[d.kmen, M.kmen], [d.koruna, druh === 'palma' ? M.listy : M.korunaStromu]]
      : [[d, { ker: M.ker, papradie: M.papradie, trava: M.trava, kvety: M.kvety, kamen: M.kamen, kamenMach: M.kamen }[druh]]];
    const meshe = vrstvy.map(([geo, mat]) => {
      const im = new THREE.InstancedMesh(geo, mat, polozky.length);
      im.castShadow = druh !== 'trava' && druh !== 'kvety';
      im.receiveShadow = true;
      skupina.add(im);
      return im;
    });
    polozky.forEach((it, i) => {
      e.set(it.nx, it.rot, it.nz); q.setFromEuler(e);
      s3.setScalar(it.mierka);
      m4.compose(p3.set(it.x, it.y, it.z), q, s3);
      const t = (r() - 0.5) * it.odtien * 2, jas = 1 + (r() - 0.5) * it.odtien * 1.5;   // trochu zltsie/modrejsie + jas
      farba.setRGB((1 + t * 0.5) * jas, (1 + t * 0.15) * jas, (1 - t * 0.6) * jas);
      meshe.forEach(im => { im.setMatrixAt(i, it.uzol?.zniceny ? NULA : m4); im.setColorAt(i, farba); });
      if (it.uzol) it.uzol.casti = meshe.map(im => ({ im, i, poz: p3.clone(), q: q.clone(), s: s3.clone() }));
    });
  }
  return uzly;
}
const NULA = new THREE.Matrix4().makeScale(0, 0, 0);

// ---------- zasahy a animacie uzlov ----------
const aktivne = new Set();

// najblizsi uzol pred hracom (fx, fz = smer pohladu)
export function najdiCiel(uzly, x, z, fx, fz) {
  let naj = null, najD = Infinity;
  for (const u of uzly) {
    if (u.zniceny) continue;
    const dx = u.x - x, dz = u.z - z, d = Math.hypot(dx, dz);
    if (d < u.rZasah + 1.4 && d < najD && (d < 0.6 || (dx * fx + dz * fz) / d > 0.35)) { naj = u; najD = d; }
  }
  return naj;
}

// uder: vrati vynos (pole [predmet, pocet]) ak sa uzol znicil, inak null
export function poskod(u, fx, fz, r = Math.random) {
  u.zivoty--;
  u.tras = 0.35;
  u.osX = fz; u.osZ = -fx;            // os naklonu kolmo na smer uderu
  aktivne.add(u);
  if (u.zivoty > 0) return null;
  u.zniceny = true;
  u.pad = 0;
  return ZDROJE[u.typ].vynos.filter(v => v[2] === undefined || r() < v[2]).map(([id, n]) => [id, n]);
}

const qPad = new THREE.Quaternion(), os = new V3();
export function aktualizujUzly(dt) {
  for (const u of aktivne) {
    let uhol = 0, mierka = 1;
    if (u.pad >= 0) {                  // padanie (stromy) alebo zmiznutie (kriky, balvany)
      u.pad += dt;
      const strom = u.typ === 'palma' || u.typ === 'strom';
      if (strom) {
        uhol = Math.min(Math.pow(u.pad / 1.3, 2.2), 1) * 1.5;
        if (u.pad > 2) mierka = Math.max(0, 1 - (u.pad - 2) / 0.6);
        if (u.pad > 2.6) aktivne.delete(u);
      } else {
        mierka = Math.max(0, 1 - u.pad / 0.3);
        if (u.pad > 0.3) aktivne.delete(u);
      }
    } else {
      u.tras -= dt;
      uhol = Math.sin(u.tras * 45) * 0.05 * Math.max(u.tras / 0.35, 0);
      if (u.tras <= 0) { uhol = 0; aktivne.delete(u); }
    }
    os.set(u.osX, 0, u.osZ).normalize();
    qPad.setFromAxisAngle(os, uhol);
    for (const c of u.casti) {
      m4.compose(c.poz, q.copy(qPad).multiply(c.q), s3.copy(c.s).multiplyScalar(mierka));
      c.im.setMatrixAt(c.i, mierka > 0 ? m4 : NULA);
      c.im.instanceMatrix.needsUpdate = true;
    }
  }
}
