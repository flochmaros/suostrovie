// Model Bledeho (hororovy ostrov Ticha zatoka): vychudnuty, 2.6-3 m, dlhe ruky po kolena, dlhe prsty, bledá koza, maska z kosti bez tvare.
// Zostavene kodom (ziadne subory), klby podobne ako src/postava.js:
//   g (koren, kamera/AI ho posuva a otaca; Bledy hlada na +z), telo (panva), chrbat (hrudnik, nakloni sa dopredu), krk, hlava,
//   sL/sP (stehno) + kL/kP (koleno), rL/rP (rameno) + lL/lP (laket) + zL/zP (zapastie) + prstyL/prstyP ([{a, b}] clanky prstov).
// Kladne rotation.x hodi visiacu koncatinu DOZADU (model hlada na +z), preto "dopredu" = zaporne; pomocou animuj() sa o to netreba starat.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const koza = (c, e) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, emissive: e, emissiveIntensity: 0.55 });
const MAT = {
  bledy: koza(0xbdc0b8, 0x1b2430),             // slaba vlastna ziara: v tme je len slabo vidiet
  matka: koza(0x9c9f98, 0x1c2230),
  rebra: koza(0xd4d6cc, 0x202a38),
  kost: new THREE.MeshStandardMaterial({ color: 0xe9e3cf, roughness: 0.55, emissive: 0x2a2a30, emissiveIntensity: 0.4 }),
  diera: new THREE.MeshBasicMaterial({ color: 0x040404 }),
  pazur: new THREE.MeshStandardMaterial({ color: 0x3b362d, roughness: 0.5 }),
};
const merge = g => mergeGeometries(g.map(x => (x.index ? x.toNonIndexed() : x)));
const valec = (r1, r2, d, seg = 7) => new THREE.CylinderGeometry(r1, r2, d, seg).translate(0, -d / 2, 0);   // visi z klbu dole
const elipsa = (rx, ry, rz, x = 0, y = 0, z = 0) => new THREE.SphereGeometry(1, 10, 8).scale(rx, ry, rz).translate(x, y, z);
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };
const klb = (x, y, z, ...deti) => { const g = new THREE.Group(); g.position.set(x, y, z); deti.forEach(d => g.add(d)); return g; };

function prst(dlzka, M) {                         // 2 clanky + pazur; vrati { a, b } (klby), a je pripnuty k dlani
  const a = klb(0, 0, 0, mesh(valec(0.016, 0.012, dlzka), M));
  const claw = new THREE.ConeGeometry(0.011, 0.07, 5).rotateX(Math.PI).translate(0, -dlzka * 0.85 - 0.03, 0);
  const b = klb(0, -dlzka, 0, mesh(merge([valec(0.012, 0.008, dlzka * 0.85), claw]), M));
  b.children[0].material = M;
  a.add(b);
  return { a, b };
}
function postavRuku(strana, M) {                  // strana: -1 lava, 1 prava
  const prsty = [];
  const dlan = mesh(merge([elipsa(0.045, 0.07, 0.016, 0, -0.06, 0)]), M);
  const zap = klb(0, -0.9, 0, dlan);
  [-0.036, -0.012, 0.012, 0.036].forEach((x, i) => {
    const p = prst(i === 1 || i === 2 ? 0.2 : 0.17, M); p.a.position.set(x, -0.12, 0); zap.add(p.a); prsty.push(p);
  });
  const palec = prst(0.12, M); palec.a.position.set(strana * 0.045, -0.06, 0.012); palec.a.rotation.z = strana * 0.5; zap.add(palec.a); prsty.push(palec);
  const laket = klb(0, -0.86, 0, mesh(valec(0.036, 0.026, 0.9), M), zap);
  laket.add(mesh(new THREE.SphereGeometry(0.04, 7, 6), M));
  const rameno = klb(strana * 0.25, 0.84, 0, mesh(valec(0.05, 0.038, 0.86), M), mesh(new THREE.SphereGeometry(0.058, 8, 6), M), laket);
  return { rameno, laket, zap, prsty };
}
function postavNohu(strana, M) {
  const prsty = [-0.03, 0, 0.03].map(x => mesh(new THREE.ConeGeometry(0.014, 0.17, 5).rotateX(Math.PI / 2 + 0.1).translate(0, 0, 0.1), M, x, -0.76, 0.06));
  const chodidlo = mesh(merge([elipsa(0.045, 0.03, 0.12, 0, -0.77, 0.06)]), M);
  const koleno = klb(0, -0.72, 0, mesh(valec(0.05, 0.034, 0.74), M), mesh(new THREE.SphereGeometry(0.052, 8, 6), M), chodidlo, ...prsty);
  const stehno = klb(strana * 0.15, 0, 0, mesh(valec(0.078, 0.052, 0.74), M), koleno);
  return { stehno, koleno };
}

// typ: 'bledy' | 'matka' (Matka z jaskyne: tmavsia, s kostenym vencom rohov)
export function modelBledeho(typ = 'bledy') {
  const M = MAT[typ] || MAT.bledy;
  const ruky = [postavRuku(-1, M), postavRuku(1, M)], nohy = [postavNohu(-1, M), postavNohu(1, M)];

  // hrudnik: uzky trup + rebra (obluky) + chrbticove hrbole, spojene do jedneho mesha
  const casti = [elipsa(0.19, 0.46, 0.115, 0, 0.45, 0)];
  const rebra = [];
  for (let i = 0; i < 7; i++) {
    const y = 0.22 + i * 0.085, r = 0.17 - Math.abs(i - 3) * 0.006 - (i > 4 ? (i - 4) * 0.012 : 0);
    rebra.push(new THREE.TorusGeometry(r, 0.0085, 5, 14, Math.PI * 1.25).rotateZ(-Math.PI * 0.125).rotateX(Math.PI / 2).scale(1.12, 1, 0.7).translate(0, y, 0));
    casti.push(elipsa(0.016, 0.016, 0.016, 0, y, -0.105));
  }
  const trup = mesh(merge(casti), M);
  const reb = mesh(merge(rebra), MAT.rebra);
  const lopatky = mesh(merge([elipsa(0.08, 0.1, 0.012, -0.12, 0.72, -0.1), elipsa(0.08, 0.1, 0.012, 0.12, 0.72, -0.1)]), M);

  // hlava: predlzena maska z kosti, dve cierne diery namiesto oci, ziadne usta, tenky sev
  const lebka = mesh(merge([elipsa(0.115, 0.2, 0.125, 0, 0.12, 0.02), elipsa(0.07, 0.1, 0.09, 0, -0.04, 0.08)]), MAT.kost);
  const oci = [-0.045, 0.045].map(x => mesh(elipsa(0.027, 0.04, 0.02), MAT.diera, x, 0.15, 0.135));
  const sev = mesh(new THREE.BoxGeometry(0.004, 0.18, 0.004), MAT.diera, 0, 0.0, 0.142);
  const hlava = klb(0, 0.04, 0.05, lebka, ...oci, sev);
  if (typ === 'matka') {                          // vence rohov z kosti
    for (const s of [-1, 1]) {
      const roh = mesh(new THREE.TorusGeometry(0.16, 0.018, 5, 12, Math.PI * 0.8), MAT.kost, s * 0.07, 0.3, 0.0);
      roh.rotation.z = 0.3; roh.scale.x = s;
      hlava.add(roh);
    }
  }
  const krk = klb(0, 0.95, 0.02, mesh(valec(0.04, 0.03, 0.2).translate(0, 0.2, 0), M), hlava);
  hlava.position.set(0, 0.22, 0.04);

  const chrbat = klb(0, 0.06, 0, trup, reb, lopatky, krk, ruky[0].rameno, ruky[1].rameno);
  ruky[0].rameno.position.y = ruky[1].rameno.position.y = 0.84;
  const panva = mesh(merge([elipsa(0.15, 0.09, 0.1)]), M);
  const telo = klb(0, 1.46, 0, panva, chrbat, nohy[0].stehno, nohy[1].stehno);
  const g = new THREE.Group(); g.add(telo);
  const sc = typ === 'matka' ? 1.28 : 1;
  g.scale.setScalar(sc);
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = true; } });
  return { g, telo, chrbat, krk, hlava, sL: nohy[0].stehno, sP: nohy[1].stehno, kL: nohy[0].koleno, kP: nohy[1].koleno,
    rL: ruky[0].rameno, rP: ruky[1].rameno, lL: ruky[0].laket, lP: ruky[1].laket, zL: ruky[0].zap, zP: ruky[1].zap,
    prstyL: ruky[0].prsty, prstyP: ruky[1].prsty, vyska: 2.9 * sc, scale: sc, tw: { y: 0, z: 0, ciel: 0 } };
}

// ---------- animacie ----------
const lerp = (a, b, k) => a + (b - a) * k;
const KLBY = ['telo', 'chrbat', 'krk', 'hlava', 'sL', 'sP', 'kL', 'kP', 'rL', 'rP', 'lL', 'lP', 'zL', 'zP'];

// poza = { rot: {klb: [x, y, z]}, ty (vyska panvy), curl (prsty 0..1.4), rychlost nasledovania }; po animacii sa nastavi priamo na klby
function ciele(m, p, t, st) {
  const f = st.faza, s = Math.sin(f), c = Math.cos(f), amp = st.amp;      // f = faza kroku
  const dych = Math.sin(t * 1.7 + st.ph) * 0.02, tw = m.tw;
  const R = {};                                                                    // klb -> [rx, ry, rz]; rx kladne = dozadu (konc.)
  let ty = 1.46, curl = 0.5, hz = 0, rychl = 7;
  switch (p) {
    case 'chod': {
      R.telo = [0.04, Math.sin(f) * 0.1, 0]; R.chrbat = [0.55 + dych, -Math.sin(f) * 0.12, 0]; R.krk = [0.3, 0, 0]; R.hlava = [-0.35, tw.y, tw.z];
      R.sL = [-s * 0.55 * amp, 0, 0]; R.sP = [s * 0.55 * amp, 0, 0]; R.kL = [Math.max(0, c) * 0.7 * amp, 0, 0]; R.kP = [Math.max(0, -c) * 0.7 * amp, 0, 0];
      R.rL = [s * 0.3 * amp - 0.1, 0, 0.1]; R.rP = [-s * 0.3 * amp - 0.1, 0, -0.1]; R.lL = [-0.2, 0, 0]; R.lP = [-0.2, 0, 0];
      ty = 1.46 + Math.abs(c) * 0.03; break;
    }
    case 'plizi': {                                                                 // po styroch
      R.telo = [0.0, Math.sin(f) * 0.12, 0]; R.chrbat = [1.18 + dych, -Math.sin(f) * 0.14, 0]; R.krk = [-0.2, 0, 0]; R.hlava = [-0.65, tw.y, tw.z];
      R.sL = [-0.95 - s * 0.35 * amp, 0, 0.06]; R.sP = [-0.95 + s * 0.35 * amp, 0, -0.06]; R.kL = [1.7 + Math.max(0, c) * 0.4 * amp, 0, 0]; R.kP = [1.7 + Math.max(0, -c) * 0.4 * amp, 0, 0];
      R.rL = [-1.05 + s * 0.55 * amp, 0, 0.12]; R.rP = [-1.05 - s * 0.55 * amp, 0, -0.12]; R.lL = [-0.35, 0, 0]; R.lP = [-0.35, 0, 0];
      ty = 1.0; curl = 0.9; rychl = 9; break;
    }
    case 'sprint': {
      R.telo = [0.0, Math.sin(f) * 0.15, 0]; R.chrbat = [0.95, -Math.sin(f) * 0.2, 0]; R.krk = [-0.1, 0, 0]; R.hlava = [-0.7, 0, 0];
      R.sL = [-s * 1.0, 0, 0]; R.sP = [s * 1.0, 0, 0]; R.kL = [Math.max(0, c) * 1.6 + 0.3, 0, 0]; R.kP = [Math.max(0, -c) * 1.6 + 0.3, 0, 0];
      R.rL = [s * 0.9 + 0.2, 0, 0.35]; R.rP = [-s * 0.9 + 0.2, 0, -0.35]; R.lL = [-0.6, 0, 0]; R.lP = [-0.6, 0, 0];
      ty = 1.28 + Math.abs(c) * 0.08; curl = 0.2; rychl = 14; break;
    }
    case 'pazur': {                                                                 // st.u 0..1: 0-0.4 nahor, 0.4-0.6 sek, potom doznieva
      const u = st.u, nah = Math.min(1, u / 0.4), sek = u < 0.4 ? 0 : Math.min(1, (u - 0.4) / 0.2);
      R.telo = [0, 0, 0]; R.chrbat = [lerp(0.5, -0.1, nah) + sek * 0.9, lerp(0, 0.7, nah) - sek * 1.4, 0]; R.krk = [0.2, 0, 0]; R.hlava = [-0.2, 0, 0];
      R.sL = [-0.35, 0, 0]; R.sP = [0.3, 0, 0]; R.kL = [0.5, 0, 0]; R.kP = [0.3, 0, 0];
      R.rP = [-lerp(0.3, 2.6, nah) + sek * 2.7, 0, lerp(-0.1, -0.9, nah) + sek * 1.3]; R.lP = [-lerp(0.2, 0.4, nah) + sek * 0.3, 0, 0];
      R.rL = [-0.5, 0, 0.3]; R.lL = [-0.8, 0, 0]; ty = 1.38; curl = lerp(0.1, 0.0, nah); rychl = 26; break;
    }
    case 'cuva': {                                                                  // cuva pred ohnom, tvar si zakryva predlktim
      R.telo = [-0.05, 0, 0]; R.chrbat = [0.08 + dych, 0, 0]; R.krk = [0.25, 0, 0]; R.hlava = [0.1, 0.55 * Math.sin(f * 0.3 + 1) , 0];
      R.sL = [-s * 0.35 * amp, 0, 0]; R.sP = [s * 0.35 * amp, 0, 0]; R.kL = [Math.max(0, c) * 0.5 * amp, 0, 0]; R.kP = [Math.max(0, -c) * 0.5 * amp, 0, 0];
      R.rL = [-1.25, 0, 0.35]; R.rP = [-1.35, 0, -0.35]; R.lL = [-2.4, 0, 0]; R.lP = [-2.5, 0, 0]; curl = 0.9; rychl = 10; break;
    }
    case 'vykuk': {                                                                 // cez kmen vidno len hlavu a ruku
      R.telo = [0, 0.1, 0.12]; R.chrbat = [0.2 + dych, 0.2, 0.5]; R.krk = [0.1, 0, 0]; R.hlava = [-0.1, tw.y, -0.45 + tw.z];
      R.sL = [-0.1, 0, 0]; R.sP = [-0.15, 0, 0]; R.kL = [0.15, 0, 0]; R.kP = [0.25, 0, 0];
      R.rP = [-1.15, 0, -0.85]; R.lP = [-0.9, 0, 0.1]; R.rL = [-0.05, 0, 0.2]; R.lL = [-0.15, 0, 0]; curl = 0.2 + Math.sin(t * 6 + st.ph) * 0.08; rychl = 5; break;
    }
    case 'mrtvy': {
      R.telo = [0, 0, 0]; R.chrbat = [0.4, 0, 0]; R.krk = [0.3, 0, 0]; R.hlava = [0.2, 0.3, 0.3];
      R.sL = [-0.2, 0, 0]; R.sP = [-0.3, 0, 0]; R.kL = [0.4, 0, 0]; R.kP = [0.3, 0, 0]; R.rL = [0.2, 0, 0.5]; R.rP = [0.2, 0, -0.5]; R.lL = [-0.3, 0, 0]; R.lP = [-0.3, 0, 0];
      ty = 1.2; curl = 0.8; rychl = 4; break;
    }
    default: {                                                                      // stoj (a pozoruje): zhrbeny, ruky visia, trhane skubnutia hlavy
      R.telo = [0.02, 0, 0]; R.chrbat = [0.5 + dych, 0, 0]; R.krk = [0.32, 0, 0]; R.hlava = [-0.3, tw.y, tw.z];
      R.sL = [-0.06, 0, 0.03]; R.sP = [-0.04, 0, -0.03]; R.kL = [0.1, 0, 0]; R.kP = [0.14, 0, 0];
      R.rL = [-0.08 + Math.sin(t * 1.3 + st.ph) * 0.02, 0, 0.08]; R.rP = [-0.12 + Math.sin(t * 1.1 + st.ph) * 0.02, 0, -0.08]; R.lL = [-0.12, 0, 0]; R.lP = [-0.18, 0, 0];
      curl = 0.45 + Math.sin(t * 3 + st.ph) * 0.05; break;
    }
  }
  return { R, ty, curl, rychl, hz };
}

// st = { poza, faza, amp (0..1 sila kroku), u (cas utoku 0..1), ph (nahodna faza) }; dt v sekundach
export function animuj(m, st, dt, t) {
  const tw = m.tw;                                                                 // trhane skubnutia hlavy: nahle nastavi ciel a hned ho zahodi
  tw.t = (tw.t ?? 1) - dt;
  if (tw.t <= 0) { const silne = Math.random() < 0.3; tw.t = silne ? 0.08 : 1.2 + Math.random() * 3.5; tw.y = silne ? (Math.random() - 0.5) * 1.1 : tw.y * 0.4; tw.z = silne ? (Math.random() - 0.5) * 0.7 : 0; if (silne) tw.vrat = 0.15; }
  else if (tw.vrat != null && (tw.vrat -= dt) <= 0) { tw.vrat = null; tw.t = 1 + Math.random() * 3; }
  const { R, ty, curl, rychl } = ciele(m, st.poza, t, st);
  const k = 1 - Math.exp(-rychl * dt);
  for (const nm of KLBY) {
    const r = R[nm]; if (!r) continue;
    const o = m[nm].rotation;
    o.x = lerp(o.x, r[0], k); o.y = lerp(o.y, r[1], k); o.z = lerp(o.z, r[2], k);
  }
  // rotation.x kladne = dozadu pre visiace konc.; v poze je zapisane "dopredu zaporne", rovnake ako v tele: konvencia v ciele() je uz hotova
  m.telo.position.y = lerp(m.telo.position.y, ty, k);
  for (const pr of [m.prstyL, m.prstyP]) pr.forEach((p, i) => {
    const cc = curl * (1 + (i % 2) * 0.12);
    p.a.rotation.x = lerp(p.a.rotation.x, -cc, k); p.b.rotation.x = lerp(p.b.rotation.x, -cc * 1.25, k);
  });
}
