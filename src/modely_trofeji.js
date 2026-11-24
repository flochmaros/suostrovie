// Modely vystroja z trofeji strazcov 2-5 (plast, cizmy, amulet, kompas) – low-poly, kodom, s animaciami.
//   modelPlasta()            -> J.chrbat   ohnivzdorny plast (3 segmenty, vlni sa podla behu/vetra/padu)
//   modelCizmy(strana)       -> J.kL (-1) / J.kP (1)   kozene cizmy z krokodilej koze
//   modelAmuletu({svetlo})   -> J.chrbat   amulet hlbin (perla v atramentovom kovani, hojda sa, pod vodou svieti)
//   modelKompasu()           -> J.telo     kompas hmly na opasku vpravo; smer ihly: nastavSmerKompasu / smerKompasuNa
//   modelyNaZem              -> { id: [geo, mat] } zlepene modely na zem / ikony v batohu
// Kontrakt animacie: root.userData.anim(s), s = { t, dt, rych, vpred, vy, vietor, vietorLok:{x,z}, podVodou, plava, nahlad }.
// Smery: predok postavy = -z, chrbat = +z. V anim sa nic nealokuje.
// Importuje LEN three a modely_vystroja.js (pozor na cyklicke importy s obsah/).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { zlepModel } from './modely_vystroja.js';

const PI = Math.PI;
const klamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------- cache geometrii a pomocne funkcie ----------
const CACHE = new Map();
const G = (kluc, fn) => { let g = CACHE.get(kluc); if (!g) { g = fn(); CACHE.set(kluc, g); } return g; };
function M(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true;
  return m;
}
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
// zlepi kopie zakladnej geometrie podla zoznamu [x,y,z, rx,ry,rz, sx,sy,sz]
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function rozmnoz(zaklad, zoznam) {
  const geo = zoznam.map(([x, y, z, rx, ry, rz, sx, sy, sz]) => {
    _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ'));
    _m4.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    return zaklad.clone().applyMatrix4(_m4);
  });
  return mergeGeometries(geo);
}

// =====================================================================
// OHNIVZDORNY PLAST (J.chrbat)
// =====================================================================
const PLAST = {
  koza: () => mat(0x3a2420, { roughness: 0.75, side: THREE.DoubleSide }),
  supina: () => mat(0x5a2a1a, { roughness: 0.45, metalness: 0.25, emissive: 0xff4a10, emissiveIntensity: 0.12 }),
  podsivka: () => mat(0x8a2a14, { roughness: 0.8 }),
  obsidian: () => mat(0x1a1418, { roughness: 0.25, metalness: 0.6 }),
  lem: () => mat(0x401008, { roughness: 0.5, emissive: 0xff5010, emissiveIntensity: 1.3, side: THREE.DoubleSide }),
  zera: () => mat(0xff7a20, { emissive: 0xff5a10, emissiveIntensity: 1.6 }),
};
let PLAST_M = null;
const plastMat = () => PLAST_M || (PLAST_M = Object.fromEntries(Object.entries(PLAST).map(([k, f]) => [k, f()])));

// segmenty: [horny polomer obluka, spodny polomer, vyska, pokojovy uhol (zaporny = dozadu)]
const SEGMENTY = [[0.32, 0.33, 0.31, 0], [0.33, 0.35, 0.31, -0.12], [0.35, 0.37, 0.33, -0.05]];
const OBLUK = 1.2;        // uhol oblucika plasta (rad), stred na +z
const SIRKA = 1.15;       // natiahnutie do sirky (x)
// diel plasta: otvoreny valcovy oblucik, horna hrana v y=0, zadna stred v z=0 (pivot na hornej hrane)
const geoSegmentu = i => G('plast_seg' + i, () => {
  const [rt, rb, h] = SEGMENTY[i];
  return new THREE.CylinderGeometry(rt, rb, h + 0.025, 12, 2, true, -OBLUK / 2, OBLUK).translate(0, -(h + 0.025) / 2, -rt);
});
// supiny na vonkajsej strane segmentu (rady prekryvajucich sa sploštených gulicok)
const geoSupin = i => G('plast_sup' + i, () => {
  const [rt, rb, h] = SEGMENTY[i], z = [];
  const rady = 4, stlpce = 7;
  for (let r = 0; r < rady; r++) {
    const v = (r + 0.6) / rady, rr = rt + (rb - rt) * v + 0.004, y = -h * v;
    for (let c = 0; c < stlpce; c++) {
      const a = (c + (r % 2 ? 0.5 : 0) + 0.5) / stlpce - 0.5;
      if (Math.abs(a) > 0.47) continue;
      const th = a * OBLUK * 0.92;
      z.push([rr * Math.sin(th), y, rr * Math.cos(th) - rt, -0.35, th, 0, 1, 1.25, 0.32]);
    }
  }
  return rozmnoz(new THREE.SphereGeometry(0.028, 6, 4), z);
});
const geoLemu = () => G('plast_lem', () => {
  const [, rb, h] = SEGMENTY[2], rt = SEGMENTY[2][0];
  return new THREE.CylinderGeometry(rb + 0.004, rb + 0.006, 0.04, 12, 1, true, -OBLUK / 2 - 0.02, OBLUK + 0.04).translate(0, -h + 0.005, -rt);
});

function stavPlast(m, prePostavu) {
  const g = new THREE.Group(), seg = [];
  const lem = m.lem;
  let rodic = g;
  SEGMENTY.forEach(([rt, rb, h, uhol], i) => {
    const s = new THREE.Group();
    if (i === 0) s.position.set(0, 0.44, 0.15);
    else { const p = SEGMENTY[i - 1]; s.position.set(0, -p[2], p[1] - p[0]); }
    s.rotation.x = uhol;
    const telo = M(geoSegmentu(i), m.koza, 0, 0, 0, SIRKA, 1, 1); s.add(telo);
    s.add(M(geoSupin(i), m.supina, 0, 0, 0, SIRKA, 1, 1));
    if (i === 2) s.add(M(geoLemu(), lem, 0, 0, 0, SIRKA, 1, 1));
    rodic.add(s); rodic = s; seg.push(s);
  });
  // golier okolo krku + zlozena kapucna vzadu + spona vpredu
  g.add(M(G('plast_golier', () => new THREE.TorusGeometry(0.088, 0.026, 6, 20).rotateX(PI / 2)), m.podsivka, 0, 0.5, 0.012, 1.3, 1, 1.05));
  g.add(M(G('plast_golier2', () => new THREE.TorusGeometry(0.094, 0.012, 5, 20).rotateX(PI / 2)), m.supina, 0, 0.52, 0.012, 1.3, 1, 1.05));
  g.add(M(G('plast_kapucna', () => new THREE.SphereGeometry(0.085, 12, 8, 0, PI * 2, 0, PI * 0.6)), m.koza, 0, 0.47, 0.13, 1.45, 0.75, 0.85));
  g.add(M(G('plast_kapucna_s', () => rozmnoz(new THREE.SphereGeometry(0.022, 6, 4), [[-0.05, 0, 0, -0.6, -0.4, 0, 1, 1.2, 0.35], [0, 0.01, 0.005, -0.6, 0, 0, 1, 1.2, 0.35], [0.05, 0, 0, -0.6, 0.4, 0, 1, 1.2, 0.35]])), m.supina, 0, 0.5, 0.195));
  g.add(M(G('plast_spona', () => new THREE.CylinderGeometry(0.019, 0.019, 0.01, 8).rotateX(PI / 2)), m.obsidian, 0, 0.5, -0.118));
  const zera = M(G('plast_zera', () => new THREE.OctahedronGeometry(0.01, 0)), m.zera, 0, 0.5, -0.126, 1, 1.2, 0.6);
  g.add(zera);
  if (!prePostavu) return g;

  // ---- animacia ----
  let zdvih = 0, bok = 0, faza = 0, amp = 0.02, lemSila = 1.3;
  const zaklad = SEGMENTY.map(s => s[3]), podiel = [0.5, 0.35, 0.28];
  g.userData.anim = s => {
    const dt = Math.min(s.dt || 0.016, 0.1), k = 1 - Math.exp(-dt * 4);
    const vz = s.vietorLok ? s.vietorLok.z : 0, vx = s.vietorLok ? s.vietorLok.x : 0;
    let cielZdvih, cielBok, cielAmp, frek;
    if (s.podVodou) {
      cielZdvih = 0.35; cielBok = 0; cielAmp = 0.14; frek = 0.9;
    } else {
      const r = Math.min(s.rych || 0, 9);
      cielZdvih = r * 0.09 + Math.max(0, vz) * 0.06 + klamp(-(s.vy || 0) * 0.08, 0, 0.7);
      if (s.plava) cielZdvih *= 0.3;
      cielZdvih = klamp(cielZdvih, 0, 1.15);
      cielBok = klamp(vx * 0.05, -0.3, 0.3);
      cielAmp = 0.02 + cielZdvih * 0.12 + Math.abs(vz) * 0.01;
      frek = 2.2 + r * 0.7 + Math.abs(vz) * 0.2;
    }
    zdvih += (cielZdvih - zdvih) * k; bok += (cielBok - bok) * k; amp += (cielAmp - amp) * k;
    faza += dt * frek;
    for (let i = 0; i < 3; i++) {
      const vlna = amp * Math.sin(faza * PI * 2 * 0.5 - i * 0.9) * (0.6 + 0.4 * i);
      let rx = zaklad[i] - zdvih * podiel[i] - vlna;
      if (rx > zaklad[i] + 0.04) rx = zaklad[i] + 0.04;      // nevojde do tela
      seg[i].rotation.x = rx;
      seg[i].rotation.z = bok * (i === 0 ? 1 : 0.5) + amp * 0.3 * Math.sin(faza * PI * 1.3 - i * 1.4);
    }
    // zeravy lem pulzuje (pod vodou slabne)
    const t = s.t || 0;
    const ciel = s.podVodou ? 0.6 : 1.3 + 0.45 * Math.sin(t * 2.2) + 0.1 * Math.sin(t * 7.3);
    lemSila += (ciel - lemSila) * Math.min(1, dt * 8);
    lem.emissiveIntensity = lemSila;
    zera.material.emissiveIntensity = 1.2 + lemSila * 0.4;
  };
  return g;
}
export function modelPlasta() {
  const z = plastMat();
  // lem a zeravy kamen su vlastne kopie (pulzuju pre tuto instanciu)
  return stavPlast({ ...z, lem: z.lem.clone(), zera: z.zera.clone() }, true);
}

// =====================================================================
// KOZENE CIZMY (J.kL / J.kP) – holen visi do -0.44, chodidlo okolo (0,-0.44,-0.05)
// =====================================================================
let CIZ_M = null;
const cizMat = () => CIZ_M || (CIZ_M = {
  koza: mat(0x4a5a30, { roughness: 0.85 }),
  tmava: mat(0x2c3a1c, { roughness: 0.9 }),
  hrb: mat(0x6a7a40, { roughness: 0.7 }),
  podrazka: mat(0x2a2018, { roughness: 0.95 }),
  remien: mat(0x3a2a1a, { roughness: 0.8 }),
  pracka: mat(0xc8a060, { roughness: 0.35, metalness: 0.65 }),
});
// polomer holene vo vyske y (valec od -0.145 do -0.415)
const rHolene = y => 0.068 + (0.077 - 0.068) * klamp((y + 0.415) / 0.27, 0, 1);
const geoHrbolcekov = () => G('ciz_hrb', () => {
  const z = [];
  for (let i = 0; i < 6; i++) {
    const y = -0.18 - i * 0.045;
    for (const x of [-0.018, 0.018]) z.push([x, y, rHolene(y) + 0.002, PI / 2 - 0.5, 0, 0, 1, 1, 1]);
  }
  return rozmnoz(new THREE.ConeGeometry(0.011, 0.024, 4), z);
});
const geoSupinCizmy = () => G('ciz_sup', () => {
  const z = [];
  for (let r = 0; r < 5; r++) {
    const y = -0.19 - r * 0.048;
    for (let c = 0; c < 9; c++) {
      const a = -PI * 0.75 + (c + (r % 2) * 0.5) / 9 * PI * 1.5 + PI;   // okolo predku a bokov (zadok ma hrbolceky)
      const rr = rHolene(y) + 0.001;
      z.push([rr * Math.sin(a), y, rr * Math.cos(a), 0, a, 0, 1, 0.8, 0.3]);
    }
  }
  return rozmnoz(new THREE.BoxGeometry(0.022, 0.03, 0.02), z);
});
function stavCizmu(strana, m, prePostavu) {
  const g = new THREE.Group();
  g.add(M(G('ciz_holen', () => new THREE.CylinderGeometry(0.077, 0.068, 0.27, 12)), m.koza, 0, -0.28, 0));
  g.add(M(geoSupinCizmy(), m.tmava));
  g.add(M(geoHrbolcekov(), m.hrb));
  // manzeta (prehnuta hore) + lemovka
  g.add(M(G('ciz_manz', () => new THREE.CylinderGeometry(0.091, 0.083, 0.055, 14)), m.tmava, 0, -0.152, 0));
  g.add(M(G('ciz_manz_l', () => new THREE.TorusGeometry(0.089, 0.007, 5, 16).rotateX(PI / 2)), m.remien, 0, -0.125, 0));
  // priehlavok, podrazka, opatok, spicka
  g.add(M(G('ciz_prieh', () => new THREE.CapsuleGeometry(0.058, 0.13, 6, 12).rotateX(PI / 2)), m.koza, 0, -0.445, -0.085, 1.12, 0.85, 1));
  g.add(M(G('ciz_prieh_s', () => rozmnoz(new THREE.SphereGeometry(0.016, 6, 4), [[0, 0.046, -0.12, 0, 0, 0, 1.2, 0.4, 1], [-0.028, 0.04, -0.09, 0, 0, 0, 1, 0.4, 1], [0.028, 0.04, -0.09, 0, 0, 0, 1, 0.4, 1], [0, 0.05, -0.065, 0, 0, 0, 1.2, 0.4, 1]])), m.tmava, 0, -0.445, 0));
  g.add(M(G('ciz_podr', () => new THREE.BoxGeometry(0.13, 0.026, 0.3)), m.podrazka, 0, -0.485, -0.07));
  g.add(M(G('ciz_opat', () => new THREE.BoxGeometry(0.11, 0.03, 0.07)), m.podrazka, 0, -0.47, 0.045));
  g.add(M(G('ciz_spic', () => new THREE.SphereGeometry(0.046, 10, 6)), m.koza, 0, -0.455, -0.2, 1.2, 0.8, 0.9));
  // remienok cez clenok s prackou na vonkajsej strane
  const rem = M(G('ciz_rem', () => new THREE.TorusGeometry(0.075, 0.009, 5, 18).rotateX(PI / 2)), m.remien, 0, -0.39, -0.01, 1.05, 1, 1.15);
  rem.rotation.x = 0.35; g.add(rem);
  const pr = new THREE.Group(); pr.position.set(0.079 * strana, -0.392, -0.012); pr.rotation.y = strana * PI / 2;
  pr.add(M(G('ciz_pracka', () => new THREE.TorusGeometry(0.013, 0.0035, 4, 4).rotateZ(PI / 4)), m.pracka, 0, 0, 0.004, 1, 1.15, 1));
  pr.add(M(G('ciz_trn', () => new THREE.BoxGeometry(0.003, 0.022, 0.003)), m.pracka, 0, 0, 0.006));
  // volny koniec remienka (jemne sa hompala)
  const koniec = new THREE.Group(); koniec.position.set(0.012, 0, 0.003); pr.add(koniec);
  koniec.add(M(G('ciz_koniec', () => new THREE.BoxGeometry(0.03, 0.016, 0.004).translate(0.015, 0, 0)), m.remien));
  g.add(pr);
  if (!prePostavu) return g;
  let uhol = 0, w = 0;
  g.userData.anim = s => {
    const dt = Math.min(s.dt || 0.016, 0.05), r = Math.min(s.rych || 0, 8);
    const sila = -0.5 * Math.sin((s.t || 0) * (3 + r * 1.6)) * r * 0.25;
    w += (sila - uhol * 60 - w * 6) * dt; uhol += w * dt;
    koniec.rotation.z = -0.35 + klamp(uhol, -0.4, 0.4);
  };
  return g;
}
export const modelCizmy = (strana = 1) => stavCizmu(strana, cizMat(), true);

// =====================================================================
// AMULET HLBIN (J.chrbat) – snurka okolo krku, privesok na hrudi (0, 0.39, -0.16)
// =====================================================================
let AM_M = null;
const amMat = () => AM_M || (AM_M = {
  snurka: mat(0x2a1a24, { roughness: 0.9 }),
  kov: mat(0x2a1838, { roughness: 0.35, metalness: 0.55 }),
  chapadlo: mat(0x4a2050, { roughness: 0.4, emissive: 0x200830, emissiveIntensity: 0.5 }),
  perla: mat(0xf0e8ff, { roughness: 0.15, metalness: 0.1, emissive: 0xa070ff, emissiveIntensity: 0.6 }),
});
const ZAVES = new THREE.Vector3(0, 0.392, -0.164);
// snurka: uzavreta krivka vpredu po hrudi (ako nahrdelnik postavy, trochu nizsie) a vzadu okolo krku
const geoSnurky = () => G('am_snurka', () => {
  const b = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, x = (t - 0.5) * 0.22, y = 0.515 - 0.123 * (1 - (2 * t - 1) ** 2);
    const z = -0.142 * Math.sqrt(Math.max(0, 1 - (x / 0.23) ** 2)) - 0.018;
    b.push(new THREE.Vector3(x, y, z));
  }
  b.push(new THREE.Vector3(0.1, 0.535, -0.01), new THREE.Vector3(0.068, 0.55, 0.05), new THREE.Vector3(0, 0.552, 0.068),
    new THREE.Vector3(-0.068, 0.55, 0.05), new THREE.Vector3(-0.1, 0.535, -0.01));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(b, true), 56, 0.0032, 5, true);
});
// tenke zahnute trubicky (kovanie okolo perly a chapadielka)
const trubka = (body, r, n = 8) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(body.map(p => new THREE.Vector3(...p))), n, r, 4, false);
const geoKovania = () => G('am_kovanie', () => {
  const g = [];
  for (let k = 0; k < 4; k++) {
    const a = k * PI / 2 + PI / 4, c = Math.cos(a), s = Math.sin(a);
    g.push(trubka([[0.008 * c, -0.014, 0.008 * s], [0.0125 * c, -0.022, 0.0125 * s], [0.009 * c, -0.031, 0.009 * s], [0.003 * c, -0.034, 0.003 * s]], 0.0015));
  }
  return mergeGeometries(g.map(x => x.index ? x.toNonIndexed() : x));
});
const geoChapadielok = () => G('am_chap', () => {
  const g = [];
  for (let k = 0; k < 3; k++) {
    const a = k * PI * 2 / 3, c = Math.cos(a), s = Math.sin(a);
    g.push(trubka([[0.002 * c, -0.033, 0.002 * s], [0.005 * c, -0.04, 0.005 * s], [0.004 * c, -0.047, 0.004 * s], [0.0075 * c, -0.051, 0.0075 * s], [0.009 * c, -0.048, 0.009 * s]], 0.0014));
    const kv = new THREE.SphereGeometry(0.0019, 5, 4).translate(0.009 * c, -0.048, 0.009 * s);
    g.push(kv.toNonIndexed());
  }
  g.forEach(x => x.deleteAttribute('uv'));
  return mergeGeometries(g.map(x => x.index ? x.toNonIndexed() : x));
});
function stavPrivesok(m) {
  const p = new THREE.Group();
  p.add(M(G('am_ocko', () => new THREE.TorusGeometry(0.0052, 0.0016, 4, 10).rotateY(PI / 2)), m.kov, 0, -0.004, 0));
  p.add(M(G('am_cap', () => new THREE.SphereGeometry(0.0115, 10, 6, 0, PI * 2, 0, PI * 0.45)), m.kov, 0, -0.0125, 0));
  p.add(M(G('am_hrot', () => new THREE.ConeGeometry(0.003, 0.008, 5)), m.kov, 0, -0.0055, 0));
  const perla = M(G('am_perla', () => new THREE.SphereGeometry(0.0095, 14, 10)), m.perla, 0, -0.0225, 0);
  p.add(perla);
  p.add(M(geoKovania(), m.kov));
  const chap = new THREE.Group(); chap.position.y = -0.03;
  chap.add(M(geoChapadielok(), m.chapadlo, 0, 0.03, 0));
  p.add(chap);
  return { p, perla, chap };
}
export function modelAmuletu(o = {}) {
  const z = amMat(), m = { ...z, perla: z.perla.clone() };
  const g = new THREE.Group();
  g.add(M(geoSnurky(), m.snurka));
  const { p, perla, chap } = stavPrivesok(m);
  p.position.copy(ZAVES); g.add(p);
  let svetlo = null;
  if (o.svetlo) {
    svetlo = new THREE.PointLight(0x9a70ff, 0, 2, 2);
    svetlo.position.set(0, -0.0225, -0.01); svetlo.castShadow = false;
    p.add(svetlo);
  }
  // kyvadlo: tx = dopredu/dozadu (kladne = od hrude), tz = do boku
  let tx = 0, wx = 0, tz = 0, wz = 0, predV = 0, svit = 0.6, sv = 0, vznos = 0, krok = 0;
  g.userData.anim = s => {
    const dt = Math.min(s.dt || 0.016, 0.05), t = s.t || 0;
    const v = s.vpred || 0, r = Math.min(s.rych || 0, 8);
    const zrych = klamp((v - predV) / Math.max(dt, 1e-3), -25, 25); predV = v;
    const voda = !!s.podVodou;
    const K = voda ? 7 : 32, C = voda ? 1.4 : 3.2;
    const cielX = voda ? 0.45 + 0.2 * Math.sin(t * 0.7) : 0.06;
    krok += dt * (2.4 + r * 1.9);
    let fx = -K * (tx - cielX) - C * wx - zrych * 0.08;
    if (!voda) fx += Math.sin(krok) * r * 0.9 + klamp(-(s.vy || 0), 0, 8) * 0.6;
    wx += fx * dt; tx += wx * dt;
    if (tx < -0.05) { tx = -0.05; if (wx < 0) wx *= -0.3; }   // hrud nepusti dnu
    if (tx > 1.2) { tx = 1.2; if (wx > 0) wx = 0; }
    const cielZ = voda ? 0.25 * Math.sin(t * 0.53) : 0;
    let fz = -K * (tz - cielZ) - C * wz;
    if (!voda) fz += Math.cos(krok * 0.5) * r * 0.5;
    wz += fz * dt; tz = klamp(tz + wz * dt, -0.8, 0.8);
    p.rotation.x = tx; p.rotation.z = tz;
    // pod vodou sa privesok pomaly vznasa (posun hore) a chapadielka sa vlnia
    vznos += ((voda ? 0.012 : 0) - vznos) * Math.min(1, dt * 2);
    p.position.y = ZAVES.y + vznos * (1 + 0.3 * Math.sin(t * 1.1));
    chap.rotation.x = (voda ? 0.35 : 0.12) * Math.sin(t * (voda ? 1.6 : 3.1));
    chap.rotation.z = (voda ? 0.3 : 0.1) * Math.sin(t * (voda ? 1.2 : 2.3) + 1);
    chap.rotation.y += dt * (voda ? 0.6 : 0.2);
    // perla svieti a pulzuje, pod vodou vyrazne silnejsie
    const ciel = voda ? 2.4 + 0.9 * Math.sin(t * 1.4) : 0.55 + 0.25 * Math.sin(t * 2.1);
    svit += (ciel - svit) * Math.min(1, dt * 3);
    perla.material.emissiveIntensity = svit;
    if (svetlo) {
      const cs = voda ? 0.8 * (1 + 0.2 * Math.sin(t * 1.4)) : 0;
      sv += (cs - sv) * Math.min(1, dt * 2);
      svetlo.intensity = sv;
      svetlo.visible = sv > 0.01;
    }
  };
  return g;
}

// =====================================================================
// KOMPAS HMLY (J.telo) – na opasku vpravo; ihla sa toci k model.userData.uhol (rad, null = blúdi)
//   uhol 0 = ihla miery na -z (predok), kladny = proti smeru hodin pri pohlade zhora (k -x).
//   Pre lokalny smer (dx, dz) v suradniciach puzdra: uhol = atan2(-dx, -dz).
// =====================================================================
let KOM_M = null;
const komMat = () => KOM_M || (KOM_M = {
  kamen: mat(0x7a8288, { roughness: 0.9 }),
  kamenT: mat(0x4e555c, { roughness: 0.95 }),
  runa: mat(0x0a3a48, { roughness: 0.4, emissive: 0x40e8ff, emissiveIntensity: 1.2 }),
  sklo: mat(0xbff4ff, { roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false }),
  ihla: mat(0x0a3a48, { roughness: 0.3, emissive: 0x40e8ff, emissiveIntensity: 1.6 }),
  chvost: mat(0x2a2a30, { roughness: 0.4, metalness: 0.6 }),
  remien: mat(0x3a2a1a, { roughness: 0.8 }),
});
const geoRun = () => G('kom_runy', () => {
  const z = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * PI * 2;
    z.push([0.0305 * Math.sin(a), 0, 0.0305 * Math.cos(a), 0, a, i % 2 ? 0.5 : 0, 0.004, i % 2 ? 0.01 : 0.013, 0.002]);
  }
  for (let i = 0; i < 4; i++) {   // ryhy na horcom okraji (svetove strany)
    const a = i / 4 * PI * 2;
    z.push([0.026 * Math.sin(a), 0.0095, 0.026 * Math.cos(a), 0, a, 0, 0.003, 0.001, 0.007]);
  }
  return rozmnoz(new THREE.BoxGeometry(1, 1, 1), z);
});
const geoIhly = () => G('kom_ihla', () => new THREE.ConeGeometry(0.0045, 0.022, 4).rotateX(-PI / 2).translate(0, 0, -0.011).scale(1, 0.35, 1));
const geoChvosta = () => G('kom_chvost', () => new THREE.ConeGeometry(0.0035, 0.014, 4).rotateX(PI / 2).translate(0, 0, 0.007).scale(1, 0.35, 1));
function stavKompas(m) {
  const puzdro = new THREE.Group();
  puzdro.add(M(G('kom_telo', () => new THREE.CylinderGeometry(0.031, 0.029, 0.018, 10)), m.kamen));
  puzdro.add(M(G('kom_okraj', () => new THREE.TorusGeometry(0.029, 0.0035, 4, 10).rotateX(PI / 2)), m.kamenT, 0, 0.009, 0));
  puzdro.add(M(G('kom_dno', () => new THREE.CylinderGeometry(0.024, 0.024, 0.002, 10)), m.kamenT, 0, 0.0095, 0));
  puzdro.add(M(geoRun(), m.runa));
  puzdro.add(M(G('kom_ucho', () => new THREE.TorusGeometry(0.007, 0.0025, 4, 8)), m.kamenT, 0, 0.004, -0.035));
  const ihla = new THREE.Group(); ihla.position.y = 0.0115; puzdro.add(ihla);
  ihla.add(M(geoIhly(), m.ihla), M(geoChvosta(), m.chvost));
  ihla.add(M(G('kom_os', () => new THREE.CylinderGeometry(0.0022, 0.0022, 0.004, 6)), m.chvost, 0, 0.001, 0));
  const sklo = M(G('kom_sklo', () => new THREE.SphereGeometry(0.026, 12, 4, 0, PI * 2, 0, PI * 0.22).translate(0, -0.026 * Math.cos(PI * 0.22), 0)), m.sklo, 0, 0.011, 0);
  sklo.castShadow = false; puzdro.add(sklo);
  return { puzdro, ihla };
}
export function modelKompasu() {
  const z = komMat(), m = { ...z, runa: z.runa.clone(), ihla: z.ihla.clone() };
  const g = new THREE.Group();
  // remienok cez opasok (opasok: torus r 0.152, scale x 1.28 -> bok x ~0.195, y 0.075)
  g.add(M(G('kom_slucka', () => new THREE.BoxGeometry(0.012, 0.045, 0.026)), m.remien, 0.205, 0.068, -0.045));
  const { puzdro, ihla } = stavKompas(m);
  puzdro.position.set(0.222, 0.038, -0.05);
  puzdro.rotation.set(0.15, 0, -0.35);       // mierne naklonene von, aby bolo vidiet sklicko
  g.add(puzdro);
  g.userData.puzdro = puzdro;
  g.userData.ihla = ihla;
  g.userData.uhol = null;
  let u = 0, w = 0, bl = 0;
  g.userData.anim = s => {
    const dt = Math.min(s.dt || 0.016, 0.05), t = s.t || 0;
    let ciel;
    if (g.userData.uhol == null) { bl += dt * 0.7; ciel = bl + 1.4 * Math.sin(t * 0.9) + 0.5 * Math.sin(t * 2.3); }
    else ciel = g.userData.uhol + 0.04 * Math.sin(t * 6.1);   // jemne chvenie
    let d = (ciel - u) % (PI * 2);
    if (d > PI) d -= PI * 2; else if (d < -PI) d += PI * 2;
    // pruzina s malym tlmenim -> prekmit a doznenie
    w += (d * 55 - w * 4.5) * dt; u += w * dt;
    if (u > PI * 4 || u < -PI * 4) { const o = Math.round(u / (PI * 2)) * PI * 2; u -= o; bl -= o; }
    ihla.rotation.y = u;
    const puls = 1.0 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2.4)) + (g.userData.uhol == null ? 0 : 0.3);
    m.runa.emissiveIntensity = puls;
    m.ihla.emissiveIntensity = 1.3 + 0.4 * Math.sin(t * 3.3);
  };
  return g;
}
// nastavi cielovy uhol ihly v lokalnych suradniciach puzdra (rad), null = ihla blúdi
export function nastavSmerKompasu(model, uhol) { model.userData.uhol = uhol; }
// pohodlne: nastavi ihlu na svetovy bod (x, z); volaj kazdy snimok (matrixWorld z minuleho snimku staci)
const _v = new THREE.Vector3();
export function smerKompasuNa(model, x, z) {
  const p = model.userData.puzdro;
  if (x == null || !p) { model.userData.uhol = null; return; }
  p.updateWorldMatrix(true, false);
  _v.setFromMatrixPosition(p.matrixWorld);
  _v.set(x, _v.y, z);
  p.worldToLocal(_v);
  model.userData.uhol = Math.atan2(-_v.x, -_v.z);
}

// =====================================================================
// MODELY NA ZEM / IKONY (zlepene geometrie s farbami vo vrcholoch)
// =====================================================================
function plastNaZem() {
  const m = plastMat(), g = new THREE.Group();
  // zlozeny plast: dve vrstvy, supiny navrchu, zeravy lem na okraji, golier a spona
  g.add(M(G('zem_pl1', () => new THREE.BoxGeometry(0.36, 0.035, 0.27)), m.koza, 0, 0.018, 0));
  g.add(M(G('zem_pl2', () => new THREE.BoxGeometry(0.33, 0.035, 0.2)), m.koza, 0.008, 0.05, -0.025));
  g.add(M(G('zem_lem1', () => new THREE.BoxGeometry(0.36, 0.022, 0.02)), m.lem, 0, 0.013, 0.137));
  g.add(M(G('zem_lem2', () => new THREE.BoxGeometry(0.02, 0.022, 0.26)), m.lem, 0.181, 0.013, 0));
  g.add(M(G('zem_sup', () => {
    const z = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) z.push([-0.135 + c * 0.054 + (r % 2) * 0.027, 0.07, -0.1 + r * 0.045, -1.25, 0, 0, 1.1, 1.3, 0.35]);
    return rozmnoz(new THREE.SphereGeometry(0.026, 6, 4), z);
  }), m.supina));
  g.add(M(G('plast_golier', () => new THREE.TorusGeometry(0.088, 0.026, 6, 20).rotateX(PI / 2)), m.podsivka, 0, 0.085, -0.06, 1.3, 0.8, 0.7));
  g.add(M(G('plast_spona', () => new THREE.CylinderGeometry(0.019, 0.019, 0.01, 8).rotateX(PI / 2)), m.obsidian, 0, 0.09, -0.125));
  g.add(M(G('plast_zera', () => new THREE.OctahedronGeometry(0.01, 0)), m.zera, 0, 0.09, -0.132, 1.3, 1.5, 0.8));
  return [{ o: g, bake: [0, 0, 0] }];
}
function cizmyNaZem() {
  const m = cizMat();
  const l = stavCizmu(-1, m, false), p = stavCizmu(1, m, false);
  p.rotation.y = -0.15; l.rotation.y = 0.1;
  return [{ o: l, bake: [-0.075, 0, 0.02] }, { o: p, bake: [0.075, 0, 0] }];
}
function amuletNaZem() {
  const m = amMat(), g = new THREE.Group();
  g.add(M(G('zem_am_snurka', () => new THREE.TorusGeometry(0.06, 0.0035, 5, 28).rotateX(PI / 2)), m.snurka, 0, 0.004, 0.005, 1, 1, 0.8));
  const { p } = stavPrivesok(m);
  p.rotation.x = -PI / 2 + 0.08; p.position.set(0, 0.012, -0.05);
  g.add(p);
  g.scale.setScalar(2.4);
  return [{ o: g, bake: [0, 0, 0] }];
}
function kompasNaZem() {
  const { puzdro, ihla } = stavKompas(komMat());
  ihla.rotation.y = 0.6;
  puzdro.scale.setScalar(4);
  return [{ o: puzdro, bake: [0, 0, 0] }];
}
export const modelyNaZem = {
  ohnivzdorny_plast: zlepModel(plastNaZem()),
  kozene_cizmy: zlepModel(cizmyNaZem()),
  amulet_hlbin: zlepModel(amuletNaZem()),
  kompas_hmly: zlepModel(kompasNaZem()),
};
