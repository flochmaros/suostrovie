// Modely strazcov majakov 2-5 (bossovia): pradavny lavovy jaster, krokodil, kraken, kamenny golem.
// Rozhranie pre nepriatelia.js: { g, tela:[materialy na blikanie], trup, nohy:[{n,s,i}], anim(e, dt, cas, wk, sk, pohyb) }
//   wk = 0..1 napriahnutie (telegraf), sk = 1 pocas utoku, e.typ = 'klepeto' | 'dupot' | 'vrh' | 'vypad'.
// Modely su v "prirodzenej" velkosti ~1-2 m, zvacsi ich def.scale (obsah/nepriatelia.js). Predok smeruje na +Z.
import * as THREE from 'three';
import { mobGLB, NOHY4 } from './moby_glb.js';   // modely z Blenderu (modely/moby/*.glb), chybajuci -> model z kodu nizsie

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o });
const sh = k => { k.castShadow = true; return k; };
const mesh = (geo, m, x = 0, y = 0, z = 0) => { const k = sh(new THREE.Mesh(geo, m)); k.position.set(x, y, z); return k; };
const pivot = (x, y, z, ...deti) => { const p = new THREE.Group(); p.position.set(x, y, z); if (deti.length) p.add(...deti); return p; };
const gula = (r, sx, sy, sz, m, x, y, z, seg = 12) => mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.7 | 0)).scale(sx, sy, sz), m, x, y, z);
const kuzel = (r, h, m, x, y, z, rx = 0, rz = 0, seg = 6) => { const k = mesh(new THREE.ConeGeometry(r, h, seg), m, x, y, z); k.rotation.set(rx, 0, rz); return k; };
const kvader = (w, h, d, m, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z);
const kamen = (r, m, x, y, z, sx = 1, sy = 1, sz = 1) => mesh(new THREE.DodecahedronGeometry(r, 0).scale(sx, sy, sz), m, x, y, z);

// ================= PRADAVNY LAVOVY JASTER =================
export function modelLavovyObr() {
  const g = new THREE.Group();
  const telo = M(0x2e1a16, { roughness: 0.6 }), brucho = M(0x5a2e22), roh = M(0x1a1412, { roughness: 0.4, metalness: 0.2 });
  const lava = M(0x301008, { emissive: 0xff5410, emissiveIntensity: 2.4, roughness: 0.4 });
  const oko = M(0x111111, { emissive: 0xffd040, emissiveIntensity: 3 });
  const trup = pivot(0, 0.62, 0);
  trup.add(mesh(new THREE.CapsuleGeometry(0.36, 1.0, 6, 14).rotateX(Math.PI / 2).scale(1.1, 0.8, 1), telo));
  trup.add(gula(0.34, 1.05, 0.55, 1.5, brucho, 0, -0.16, 0));
  for (let i = 0; i < 7; i++) {                              // ziariace trhliny + ostne na chrbte
    const z = -0.6 + i * 0.2, s = 1 - Math.abs(i - 3) * 0.12;
    trup.add(kvader(0.52 * s, 0.04, 0.06, lava, 0, 0.27 * s + 0.02, z));
    trup.add(kuzel(0.07 * s, 0.32 * s, roh, 0, 0.3 * s + 0.14, z, -0.35));
    trup.add(kuzel(0.035, 0.09, lava, 0, 0.3 * s + 0.31, z - 0.04, -0.35));
  }
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) trup.add(kvader(0.04, 0.05, 0.22, lava, s * 0.38, 0.05 + (i % 2) * 0.06, -0.45 + i * 0.3));
  g.add(trup);
  const hlava = pivot(0, 0.74, 0.86);                        // hlava so spodnou celustou
  hlava.add(kvader(0.46, 0.28, 0.6, telo, 0, 0.04, 0.26), kvader(0.38, 0.12, 0.34, telo, 0, 0.05, 0.66));
  hlava.add(mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), oko, -0.19, 0.13, 0.38), mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), oko, 0.19, 0.13, 0.38));
  hlava.add(kvader(0.3, 0.04, 0.5, lava, 0, 0.19, 0.25));
  for (const s of [-1, 1]) {                                 // rohy dozadu
    hlava.add(kuzel(0.07, 0.5, roh, s * 0.2, 0.25, 0.0, -1.1, -s * 0.35));
    hlava.add(kuzel(0.05, 0.3, roh, s * 0.26, 0.12, 0.04, -1.3, -s * 0.9));
  }
  const zub = M(0xf0e0c0);
  const celust = pivot(0, -0.08, 0.05, kvader(0.4, 0.1, 0.72, brucho, 0, -0.04, 0.34), kvader(0.32, 0.03, 0.6, lava, 0, 0.02, 0.36));
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) celust.add(kuzel(0.025, 0.08, zub, s * 0.15, 0.05, 0.15 + i * 0.12));
  hlava.add(celust);
  g.add(hlava);
  const chv = []; let rodic = g;                             // chvost z 3 clankov
  for (let i = 0; i < 3; i++) {
    const s = 1 - i * 0.25, c = pivot(0, i ? 0 : 0.6, i ? -0.62 : -0.95);
    c.add(kvader(0.42 * s, 0.32 * s, 0.68, telo, 0, 0, -0.3), kvader(0.3 * s, 0.04, 0.5, lava, 0, 0.17 * s, -0.3), kuzel(0.05, 0.22, roh, 0, 0.26 * s, -0.3, -0.4));
    rodic.add(c); chv.push(c); rodic = c;
  }
  const nohy = [];
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const n = pivot(x * 0.42, 0.55, z * 0.5, kvader(0.2, 0.4, 0.22, telo, x * 0.06, -0.2, 0), kvader(0.24, 0.1, 0.32, telo, x * 0.08, -0.48, 0.06));
    for (let k = -1; k <= 1; k++) n.add(kuzel(0.03, 0.12, roh, x * 0.08 + k * 0.07, -0.52, 0.25, Math.PI / 2));
    g.add(n); nohy.push({ n, s: x, i: z });
  }
  function anim(e, dt, cas, wk, sk, pohyb) {
    const dup = e.typ === 'dupot', vrh = e.typ === 'vrh';
    trup.rotation.x = dup ? wk * 0.35 - sk * 0.2 : -wk * 0.15;
    trup.position.y = 0.62 + (dup ? wk * 0.25 : 0);
    hlava.rotation.x = (vrh ? -wk * 0.9 + sk * 0.6 : -wk * 0.5 + sk * 0.4) + Math.sin(e.ph * 0.5) * 0.05;
    celust.rotation.x = Math.max(wk * (vrh ? 0.9 : 0.6), sk * 0.7) + Math.sin(cas * 2) * 0.03;
    chv.forEach((c, i) => { c.rotation.y = Math.sin(e.ph * 0.8 - i * 0.9) * (0.2 + 0.15 * pohyb) * (1 + i * 0.3); });
    lava.emissiveIntensity = 2.4 + wk * 7 + (e.faza2 ? 2 + Math.sin(cas * 12) : Math.sin(cas * 3) * 0.4);
  }
  return { g, tela: [telo, brucho], trup, nohy, anim };
}

// ================= PRASTARY KROKODIL =================
export function modelKrokodil() {
  const g = new THREE.Group();
  const telo = M(0x4d4a30, { roughness: 0.85 }), tmave = M(0x23251a), brucho = M(0xb8a877), zub = M(0xf3ecd6, { roughness: 0.4 });
  const oko = M(0x221a00, { emissive: 0xd8c020, emissiveIntensity: 1.8 }), mach = M(0x5d7a32);
  const trup = pivot(0, 0.5, 0);
  trup.add(gula(0.4, 1.2, 0.8, 2.4, telo, 0, 0, 0, 16), gula(0.38, 1.1, 0.6, 2.2, brucho, 0, -0.1, 0, 12));
  for (let i = 0; i < 9; i++) for (const s of [-0.5, 0, 0.5]) {                        // pancierove stitky
    const z = -0.75 + i * 0.19, sirka = 1 - Math.abs(z) * 0.35;
    trup.add(kuzel(0.07, 0.14, tmave, s * 0.38 * sirka, 0.3 - Math.abs(s) * 0.07, z, 0, 0, 4));
  }
  trup.add(gula(0.18, 1.4, 0.35, 1.2, mach, 0.1, 0.29, -0.2), gula(0.12, 1.2, 0.3, 1.4, mach, -0.15, 0.28, 0.4));
  g.add(trup);
  const hlava = pivot(0, 0.56, 0.92);                         // horna celust sa otvara
  const horna = pivot(0, 0, 0, kvader(0.42, 0.16, 0.5, telo, 0, 0.02, 0.2), kvader(0.3, 0.11, 0.6, telo, 0, 0.0, 0.72), kvader(0.32, 0.05, 0.08, tmave, 0, 0.05, 1.02));
  horna.add(gula(0.07, 1, 0.9, 1, oko, -0.15, 0.13, 0.14, 8), gula(0.07, 1, 0.9, 1, oko, 0.15, 0.13, 0.14, 8));
  horna.add(gula(0.05, 1, 0.8, 1, tmave, -0.08, 0.07, 0.98, 6), gula(0.05, 1, 0.8, 1, tmave, 0.08, 0.07, 0.98, 6));
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) horna.add(kuzel(0.022, 0.09 + (i === 2 ? 0.06 : 0), zub, s * (0.14 - i * 0.004), -0.08, 0.08 + i * 0.12, Math.PI));
  const dolna = pivot(0, -0.06, 0.02, kvader(0.38, 0.09, 1.0, brucho, 0, -0.04, 0.48));
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) dolna.add(kuzel(0.02, 0.08, zub, s * 0.13, 0.04, 0.1 + i * 0.12));
  hlava.add(horna, dolna);
  g.add(hlava);
  const chv = []; let rodic = g;                             // chvost: 4 clanky s hrebenom
  for (let i = 0; i < 4; i++) {
    const s = 1 - i * 0.2, c = pivot(0, i ? 0 : 0.5, i ? -0.55 : -0.92);
    c.add(gula(0.28 * s, 1.1, 0.75, 1.9, telo, 0, 0, -0.27));
    for (const zz of [-0.12, -0.32]) for (const x of [-1, 1]) c.add(kuzel(0.045 * s, 0.14 * s, tmave, x * 0.06 * s, 0.2 * s, zz, 0, 0, 4));
    rodic.add(c); chv.push(c); rodic = c;
  }
  const nohy = [];
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const n = pivot(x * 0.42, 0.5, z * 0.55);
    n.add(kvader(0.36, 0.18, 0.2, telo, x * 0.18, -0.06, 0), kvader(0.17, 0.42, 0.17, telo, x * 0.34, -0.26, 0), kvader(0.24, 0.07, 0.3, tmave, x * 0.36, -0.47, 0.06));
    g.add(n); nohy.push({ n, s: x, i: z });
  }
  function anim(e, dt, cas, wk, sk, pohyb) {
    const vyp = e.typ === 'vypad', dup = e.typ === 'dupot';
    const otvor = vyp ? Math.max(wk * 0.9, sk * (0.8 + Math.sin(cas * 25) * 0.3)) : e.typ === 'klepeto' ? Math.max(wk * 1.0, sk * 0.2) : 0.05 + Math.sin(cas * 0.7) * 0.04;
    horna.rotation.x = -otvor * 0.7; dolna.rotation.x = otvor * 0.25;
    hlava.rotation.y = Math.sin(e.ph * 0.6) * 0.1 * pohyb + (dup ? Math.sin(cas * 6) * 0.2 * wk : 0);
    trup.position.y = 0.5 - (vyp ? wk * 0.15 : 0);
    chv.forEach((c, i) => {                                   // dupot = svihnutie chvostom dookola
      const sw = dup ? (sk ? -1.1 : wk * 1.0) : Math.sin(e.ph * 0.9 - i * 0.8) * (0.15 + 0.25 * pohyb + (vyp && sk ? 0.4 : 0));
      c.rotation.y = sw * (i ? 0.7 : 1);
    });
  }
  return { g, tela: [telo, brucho], trup, nohy, anim };
}

// ================= KRAKEN (sedi vo vode pri brehu) =================
export function modelKraken() {
  const mob = mobGLB('kraken');                              // model z Blenderu (nastroje/blender/moby_kraken.py)
  if (mob) {
    const trup = mob.uzol('trup'), celust = mob.uzol('celust'), oko = mob.mat('oko'), biolum = mob.mat('biolum');
    const chap = [];
    for (let k = 0; k < 8; k++) {
      const root = mob.uzol('chapadlo_' + k);
      root.rotation.order = 'YXZ';                           // najprv natocit do smeru, potom zdvihat (vsetky chapadla hore)
      root.rotation.y = (k / 8) * Math.PI * 2 + 0.2;
      chap.push({ root, cl: [0, 1, 2, 3, 4, 5].map(i => mob.uzol('chapadlo_' + k + '_' + i)), f: k * 0.9 });
    }
    function anim(e, dt, cas, wk, sk, pohyb) {
      trup.position.y = 0.9 + Math.sin(cas * 1.1) * 0.12 + (e.typ === 'dupot' ? wk * 0.6 - sk * 0.4 : 0);
      trup.rotation.x = Math.sin(cas * 0.7) * 0.06;
      const dup = e.typ === 'dupot', mel = e.typ === 'klepeto';
      chap.forEach(({ root, cl, f }, k) => {
        const predne = k === 0 || k === 7 || k === 1;
        const vpredu = Math.max(0, Math.cos((k / 8) * Math.PI * 2 + 0.2));   // predne lezia nizsie, aby bolo vidno tvar
        root.rotation.x = -0.35 + 0.42 * vpredu - (dup ? wk * 1.1 - sk * 1.5 : 0) - (mel && predne ? wk * 1.6 - sk * 2.2 : 0);
        cl.forEach((c, i) => {
          c.rotation.x = Math.sin(cas * 1.6 + f + i * 0.7) * 0.22 + 0.12 + (dup ? sk * 0.15 : 0) - (i > 3 ? 0.35 : 0);   // spicky sa dvihaju z vody
          c.rotation.y = Math.sin(cas * 1.1 + f * 1.3 + i * 0.5) * 0.18;
        });
      });
      celust.rotation.x = Math.max(wk, sk) * 0.6 + Math.max(0, Math.sin(cas * 1.7)) * 0.08;   // zobak sa otvara
      oko.emissiveIntensity = 1.6 + wk * 3 + (e.faza2 ? 1.2 + Math.sin(cas * 9) * 0.6 : 0);
      biolum.emissiveIntensity = 1.2 + Math.sin(cas * 2.2) * 0.5 + wk * 4 + (e.faza2 ? 1.5 : 0);
    }
    return { g: mob.g, tela: [mob.mat('kuza'), mob.mat('svetla')], trup, nohy: [], anim };
  }
  const g = new THREE.Group();
  const kuza = M(0x6a2a4a, { roughness: 0.45, metalness: 0.05 }), svetla = M(0xc06080, { roughness: 0.5 });
  const prisavka = M(0xe8b8c0), oko = M(0x0a0a0a, { emissive: 0xffc030, emissiveIntensity: 2.4 }), zrenica = M(0x000000);
  const trup = pivot(0, 0.9, 0);
  const plast = gula(1, 0.95, 1.35, 1.0, kuza, 0, 0.9, -0.15, 20); plast.rotation.x = -0.35; trup.add(plast);
  for (let i = 0; i < 14; i++) { const a = i * 2.4, r = 0.4 + (i % 4) * 0.12; trup.add(gula(0.09, 1, 0.6, 1, svetla, Math.cos(a) * r, 1.2 + (i % 3) * 0.35, Math.sin(a) * r - 0.4)); }
  for (const s of [-1, 1]) {
    trup.add(gula(0.26, 1, 1, 0.7, oko, s * 0.62, 0.15, 0.62, 14));
    trup.add(gula(0.12, 0.4, 1.3, 0.5, zrenica, s * 0.66, 0.15, 0.8, 8));
    trup.add(gula(0.3, 1.2, 0.5, 0.9, kuza, s * 0.6, 0.38, 0.55, 10));          // obocie
  }
  g.add(trup);
  const chap = [];                                           // 8 chapadiel: retaz 6 clankov
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2, root = pivot(Math.sin(a) * 0.7, 0.4, Math.cos(a) * 0.7);
    root.rotation.y = a;
    let rodic = root; const cl = [];
    for (let i = 0; i < 6; i++) {
      const r = 0.24 * (1 - i * 0.14), c = pivot(0, 0, i ? 0.5 : 0);
      c.add(mesh(new THREE.CylinderGeometry(r * 0.82, r, 0.54, 8).rotateX(Math.PI / 2).translate(0, 0, 0.26), kuza));
      c.add(gula(r * 0.4, 1, 0.5, 1, prisavka, 0, -r * 0.8, 0.26, 6));
      rodic.add(c); cl.push(c); rodic = c;
    }
    g.add(root); chap.push({ root, cl, f: k * 0.9 });
  }
  function anim(e, dt, cas, wk, sk, pohyb) {
    trup.position.y = 0.9 + Math.sin(cas * 1.1) * 0.12 + (e.typ === 'dupot' ? wk * 0.6 - sk * 0.4 : 0);
    trup.rotation.x = Math.sin(cas * 0.7) * 0.06;
    const dup = e.typ === 'dupot', mel = e.typ === 'klepeto';
    chap.forEach(({ root, cl, f }, k) => {
      const predne = k === 0 || k === 7 || k === 1;                     // predne chapadla robia uder
      root.rotation.x = -0.35 - (dup ? wk * 1.1 - sk * 1.5 : 0) - (mel && predne ? wk * 1.6 - sk * 2.2 : 0);
      cl.forEach((c, i) => {
        c.rotation.x = Math.sin(cas * 1.6 + f + i * 0.7) * 0.22 + 0.12 + (dup ? sk * 0.15 : 0);
        c.rotation.y = Math.sin(cas * 1.1 + f * 1.3 + i * 0.5) * 0.18;
      });
    });
  }
  return { g, tela: [kuza, svetla], trup, nohy: [], anim };
}

// chapadlo, ktore sa vynori zo zeme/vody v mieste uderu (vrh krakena); vrati { g, cl }
export function chapadloZoZeme() {
  const mob = mobGLB('chapadlo');
  if (mob) return { g: mob.g, cl: [0, 1, 2, 3, 4, 5, 6].map(i => mob.uzol('zem_' + i)) };
  const g = new THREE.Group(), kuza = M(0x6a2a4a, { roughness: 0.45 }), pr = M(0xe8b8c0), cl = [];
  let rodic = g;
  for (let i = 0; i < 7; i++) {
    const r = 0.55 * (1 - i * 0.12), c = pivot(0, i ? 1.1 : 0, 0);
    c.add(mesh(new THREE.CylinderGeometry(r * 0.85, r, 1.15, 9).translate(0, 0.55, 0), kuza), gula(r * 0.35, 0.5, 1, 1, pr, 0, 0.55, r * 0.85, 6));
    rodic.add(c); cl.push(c); rodic = c;
  }
  return { g, cl };
}

// ================= KAMENNY GOLEM =================
export function modelGolem() {
  const mob = mobGLB('golem');                               // model z Blenderu (nastroje/blender/moby_golem.py)
  if (mob) {
    const trup = mob.uzol('trup'), hlava = mob.uzol('hlava'), runa = mob.mat('runa');
    const ruky = [mob.uzol('ruka_P'), mob.uzol('ruka_L')];
    const nohy = [['noha_P', -1], ['noha_L', 1]].map(([m, s]) => ({ n: mob.uzol(m), s, i: 1 }));
    function anim(e, dt, cas, wk, sk, pohyb) {
      const t = e.typ, buch = t === 'klepeto' || t === 'dupot';
      const rx = buch ? -wk * 2.8 + sk * 3.2 : Math.sin(e.ph) * 0.3 * pohyb, rz = 0.15 + (buch ? wk * 0.2 : 0);
      const hod = -wk * 2.9 + sk * 2.6;
      ruky[0].rotation.set(t === 'vrh' ? hod : rx, 0, -rz);
      ruky[1].rotation.set(t === 'vrh' ? hod : buch ? rx : -rx, 0, rz);
      trup.rotation.x = buch ? -wk * 0.25 + sk * 0.45 : t === 'vrh' ? -wk * 0.3 + sk * 0.4 : 0.04;
      trup.position.y = 1.15 + Math.abs(Math.sin(e.ph)) * 0.05 * pohyb;
      hlava.rotation.y = Math.sin(cas * 0.4) * 0.2;
      runa.emissiveIntensity = 1.3 + wk * 4 + (e.faza2 ? 1.5 + Math.sin(cas * 10) : Math.sin(cas * 2) * 0.35);
    }
    return { g: mob.g, tela: [mob.mat('kam'), mob.mat('kam2')], trup, nohy, anim };
  }
  const g = new THREE.Group();
  const kam = M(0x7d7a72, { roughness: 0.95 }), kam2 = M(0x5e5b55, { roughness: 0.95 }), mach = M(0x4f6e3a);
  const runa = M(0x10303a, { emissive: 0x40e8ff, emissiveIntensity: 2.6, roughness: 0.3 });
  const trup = pivot(0, 1.15, 0);
  trup.add(kamen(0.55, kam, 0, 0.25, 0, 1.25, 1.0, 0.9), kamen(0.4, kam2, 0, -0.25, 0, 1.1, 0.8, 0.9));
  trup.add(gula(0.14, 1, 1, 0.5, runa, 0, 0.3, 0.46, 10));                                // jadro v hrudi
  for (const [x, y] of [[-0.25, 0.5], [0.3, 0.1], [-0.1, -0.15], [0.2, 0.55]]) trup.add(kvader(0.18, 0.03, 0.02, runa, x, y, 0.47));
  trup.add(kamen(0.3, mach, 0.2, 0.68, -0.1, 1.4, 0.35, 1.1), kamen(0.18, mach, -0.4, 0.55, 0.1, 1, 0.4, 1));
  for (const s of [-1, 1]) trup.add(kamen(0.32, kam2, s * 0.68, 0.55, 0, 1, 0.8, 1));     // ramena
  const hlava = pivot(0, 0.78, 0.08, kamen(0.26, kam, 0, 0.12, 0, 1, 0.9, 1));
  hlava.add(kvader(0.08, 0.05, 0.04, runa, -0.1, 0.14, 0.24), kvader(0.08, 0.05, 0.04, runa, 0.1, 0.14, 0.24), kamen(0.12, mach, 0, 0.32, -0.05, 1.4, 0.4, 1.2));
  trup.add(hlava);
  const ruky = [];
  for (const s of [-1, 1]) {
    const r = pivot(s * 0.72, 0.5, 0);
    r.add(kamen(0.22, kam, 0, -0.3, 0, 0.9, 1.3, 0.9), kamen(0.2, kam2, 0, -0.72, 0.02, 0.9, 1.2, 0.9), kamen(0.3, kam, 0, -1.08, 0.04, 1.1, 0.95, 1.1));
    r.add(kvader(0.03, 0.2, 0.02, runa, s * 0.1, -0.7, 0.18));
    trup.add(r); ruky.push(r);
  }
  g.add(trup);
  const nohy = [];
  for (const s of [-1, 1]) {
    const n = pivot(s * 0.3, 0.85, 0, kamen(0.24, kam2, 0, -0.3, 0, 1, 1.3, 1), kamen(0.26, kam, 0, -0.68, 0.05, 1.1, 0.7, 1.3));
    g.add(n); nohy.push({ n, s, i: 1 });
  }
  function anim(e, dt, cas, wk, sk, pohyb) {
    const t = e.typ, buch = t === 'klepeto' || t === 'dupot';
    const rx = buch ? -wk * 2.8 + sk * 3.2 : Math.sin(e.ph) * 0.3 * pohyb, rz = 0.15 + (buch ? wk * 0.2 : 0);
    const hod = -wk * 2.9 + sk * 2.6;
    ruky[0].rotation.set(t === 'vrh' ? hod : rx, 0, -rz);
    ruky[1].rotation.set(t === 'vrh' ? hod : buch ? rx : -rx, 0, rz);
    trup.rotation.x = buch ? -wk * 0.25 + sk * 0.45 : t === 'vrh' ? -wk * 0.3 + sk * 0.4 : 0.04;
    trup.position.y = 1.15 + Math.abs(Math.sin(e.ph)) * 0.05 * pohyb;
    hlava.rotation.y = Math.sin(cas * 0.4) * 0.2;
    runa.emissiveIntensity = 2.6 + wk * 6 + (e.faza2 ? 2.5 + Math.sin(cas * 10) * 1.5 : Math.sin(cas * 2) * 0.5);
  }
  return { g, tela: [kam, kam2], trup, nohy, anim };
}

// lavova gula / balvan, ktory boss hodi (strela)
export function strelaModel(druh) {
  if (druh === 'lava') return mesh(new THREE.IcosahedronGeometry(0.7, 1), M(0x401008, { emissive: 0xff5a10, emissiveIntensity: 3 }));
  return kamen(0.9, M(0x6f6c66, { roughness: 0.95 }));
}
