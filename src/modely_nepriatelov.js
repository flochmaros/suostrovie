// Detailny model kraba (nocny krab aj obrovsky krab-straz: boss = vacsi, ine farby, machy, barnakle, jazvy, ostne).
// Rozhranie pre nepriatelia.js: { g, tela, trup, klieste, nohy:[], animKrab(e, dt, cas, wk, sk, dupK, pohyb) }
// Geometrie su zdielane medzi instanciami; materialy tela (tela) su vlastne, aby blikali nezavisle.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const UP = new THREE.Vector3(0, 1, 0), FORWARD = new THREE.Vector3(0, 0, 1);
const H = { top: 0.17, bot: 0.08, X: 0.38, Z: 0.29 };                  // rozmery panciera
const FARBY = {
  noc:  { vrch: 0x3b3a96, brucho: 0xa596ee, bodka: 0x7a6fe0, ostn: 0xc9c0ff, oko: 0xffe066, kl: 0x4b3f9a, svetle: 0x9a8ce6 },
  boss: { vrch: 0x7c1d16, brucho: 0xe08a52, bodka: 0xb24a2a, ostn: 0xf0d4a8, oko: 0xff8a2a, kl: 0x8a2a1e, svetle: 0xe0763e },
};
const cache = {};

// ---- panciier: deformovana gula (siroky vpredu, vrubkovany okraj, ploche brucho) + ostne, bradavky, boss ozdoby v jednej geometrii s vertex farbami ----
function topY(x, z) { const q = 1 - (x / H.X) ** 2 - (z / H.Z) ** 2; return q > 0 ? H.top * Math.sqrt(q) : 0; }
function cast(geo, farba, poz = [0, 0, 0], q = null, sc = [1, 1, 1]) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...poz), q || new THREE.Quaternion(), new THREE.Vector3(...sc)));
  const c = new THREE.Color(farba), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return g;
}
function zostavPancier(boss) {
  const F = boss ? FARBY.boss : FARBY.noc, casti = [];
  const gs = new THREE.SphereGeometry(1, 36, 22), p = gs.attributes.position, nrm = new THREE.Vector3();
  const cv = new THREE.Color(F.vrch), cb = new THREE.Color(F.brucho), cd = new THREE.Color(F.bodka), tmp = new THREE.Color();
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    nrm.fromBufferAttribute(p, i); const { x, y, z } = nrm;
    const ang = Math.atan2(z, x), rim = 1 + 0.035 * Math.cos(ang * 18) * (1 - Math.abs(y)) ** 3;   // vrubkovany okraj
    const w = 1 + 0.18 * z;                                                                            // sirsi vpredu
    const bump = y > 0 ? 0.012 * Math.sin(x * 11) * Math.sin(z * 9 + 1) + 0.008 * Math.sin(x * 23 + z * 17) : 0;
    p.setXYZ(i, x * H.X * w * rim, (y > 0 ? y * H.top : y * H.bot) + bump, z * H.Z * rim * (z > 0 ? 1.06 : 0.92));
    const t = THREE.MathUtils.smoothstep(y, -0.02, 0.28);
    tmp.copy(cb).lerp(cv, t);
    const n = Math.sin(x * 14 + 1) * Math.sin(z * 12) + Math.sin(x * 6 - z * 9);                       // skvrny
    if (n > 0.9 && y > 0.1) tmp.lerp(cd, 0.6);
    if (boss && y > 0.2 && Math.abs(x) < 0.07) tmp.multiplyScalar(0.8);                                // tmavsi hrebeň
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  gs.setAttribute('color', new THREE.BufferAttribute(col, 3)); gs.deleteAttribute('uv'); gs.computeVertexNormals();
  casti.push(gs.toNonIndexed());
  // ostne po okraji
  const ostH = boss ? 0.14 : 0.08, ostR = boss ? 0.04 : 0.026, cone = new THREE.ConeGeometry(ostR, ostH, 6);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2, w = 1 + 0.18 * Math.sin(a), s = (i % 2 ? 0.7 : 1);
    const x = Math.cos(a) * H.X * w * 0.96, z = Math.sin(a) * H.Z * 0.96 * (Math.sin(a) > 0 ? 1.06 : 0.92);
    const d = new THREE.Vector3(Math.cos(a), 0.55, Math.sin(a)).normalize();
    casti.push(cast(cone, F.ostn, [x, 0.035, z], new THREE.Quaternion().setFromUnitVectors(UP, d), [s, s, s]));
  }
  // hrbolceky na chrbte
  const hrb = new THREE.SphereGeometry(0.028, 8, 6);
  for (const [x, z] of [[-0.14, 0.02], [0.14, 0.02], [-0.08, -0.12], [0.08, -0.12], [0, 0.08], [-0.2, -0.06], [0.2, -0.06]])
    casti.push(cast(hrb, F.bodka, [x, topY(x, z) - 0.004, z], null, [1, 0.7, 1]));
  // ostne na chrbte (iba boss), 3 rady
  if (boss) {
    const sp = new THREE.ConeGeometry(0.03, 0.12, 6);
    for (const [x, z, k] of [[0, 0.1, 1], [0, -0.02, 1.2], [0, -0.14, 0.9], [-0.15, -0.04, 0.8], [0.15, -0.04, 0.8]])
      casti.push(cast(sp, F.ostn, [x, topY(x, z) + 0.02, z], new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.25), [k, k, k]));
    // mach (ploche zelene machule), barnakle (biele zhluky), kamene, jazvy
    const moch = new THREE.IcosahedronGeometry(0.07, 1), zel = [0x3f6a2a, 0x567d34, 0x2f5a30];
    [[-0.17, 0.12, 1.3], [0.2, 0.1, 1], [-0.08, -0.15, 1.5], [0.12, -0.14, 1.2], [-0.26, -0.02, 0.9], [0.03, 0.0, 0.8]].forEach(([x, z, k], i) =>
      casti.push(cast(moch, zel[i % 3], [x, topY(x, z) + 0.005, z], null, [k, 0.35 * k, k])));
    const bar = new THREE.ConeGeometry(0.022, 0.045, 7);
    for (let i = 0; i < 16; i++) {
      const x = 0.08 + (i % 4) * 0.035 - (i > 7 ? 0.34 : 0) + (i > 7 ? (i % 3) * 0.02 : 0), z = -0.02 + Math.floor((i % 8) / 4) * 0.05 + (i > 7 ? 0.1 : -0.06), s = 0.7 + (i % 3) * 0.3;
      casti.push(cast(bar, i % 2 ? 0xe8e2d0 : 0xcfc8b0, [x, topY(x, z) + 0.01, z], null, [s, s, s]));
    }
    const rock = new THREE.DodecahedronGeometry(0.06, 0);
    casti.push(cast(rock, 0x6d6a66, [0.06, topY(0.06, -0.05) + 0.03, -0.05], new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 0.8, 0.2)), [1.3, 0.9, 1.1]));
    casti.push(cast(rock, 0x55524e, [-0.22, topY(-0.22, 0.05) + 0.02, 0.05], new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0.3, 0.7)), [0.9, 0.8, 0.9]));
    const jaz = new THREE.BoxGeometry(0.012, 0.008, 0.2);
    for (const [x, z, r] of [[0.13, 0.1, 0.5], [0.16, 0.06, 0.45], [-0.12, -0.02, -0.4]])
      casti.push(cast(jaz, 0xf0c8a8, [x, topY(x, z) + 0.002, z], new THREE.Quaternion().setFromAxisAngle(UP, r), [1, 1, 1]));
  }
  const g = mergeGeometries(casti, false); casti.forEach(c => c.dispose?.());
  return g;
}

function priprav(boss) {
  const F = boss ? FARBY.boss : FARBY.noc;
  const cyl = (r1, r2, l, os = 'x') => { const g = new THREE.CylinderGeometry(r1, r2, l, 7); return os === 'x' ? g.rotateZ(Math.PI / 2) : g.rotateX(Math.PI / 2); };
  const hrot = (r, l, d = 'x') => { const g = new THREE.ConeGeometry(r, l, 7); return d === 'x' ? g.rotateZ(-Math.PI / 2) : g.rotateX(Math.PI / 2); };
  return {
    pancier: zostavPancier(boss),
    femur: cyl(0.02, 0.028, 0.2), tibia: cyl(0.016, 0.022, 0.28), tars: hrot(0.02, 0.14), kb: new THREE.SphereGeometry(0.03, 8, 6),
    rameno: cyl(0.032, 0.04, 0.2, 'z'), predl: cyl(0.04, 0.034, 0.18, 'z'), dlan: new THREE.SphereGeometry(1, 14, 10),
    prst: hrot(0.05, 0.24, 'z'), zub: new THREE.ConeGeometry(0.014, 0.05, 5),
    stopka: new THREE.CylinderGeometry(0.014, 0.02, 0.14, 6), oko: new THREE.SphereGeometry(0.05, 12, 10), lesk: new THREE.SphereGeometry(0.014, 6, 5),
    celust: new THREE.ConeGeometry(0.018, 0.08, 5).rotateX(Math.PI / 2), bubl: new THREE.SphereGeometry(0.02, 8, 6),
    mOko: new THREE.MeshPhysicalMaterial({ color: F.oko, roughness: 0.12, metalness: 0, clearcoat: 1, emissive: F.oko, emissiveIntensity: 0.35 }),
    mZrenica: new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.05, clearcoat: 1 }),
    mLesk: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    mBubl: new THREE.MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.55, depthWrite: false }),
    mZub: new THREE.MeshStandardMaterial({ color: F.ostn, roughness: 0.5 }),
  };
}

export function modelKrab(boss = false) {
  const G = cache[boss ? 'boss' : 'noc'] ||= priprav(boss), F = boss ? FARBY.boss : FARBY.noc;
  const shell = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.38, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.35, flatShading: false });
  const telo = new THREE.MeshStandardMaterial({ color: F.kl, roughness: 0.5 }), svetle = new THREE.MeshStandardMaterial({ color: F.svetle, roughness: 0.45 });
  const mesh = (geo, m, x = 0, y = 0, z = 0) => { const k = new THREE.Mesh(geo, m); k.position.set(x, y, z); k.castShadow = true; return k; };
  const g = new THREE.Group();
  const trup = new THREE.Group(); trup.position.y = 0.27; g.add(trup);
  trup.add(mesh(G.pancier, shell));
  const hrub = boss ? 1.25 : 1;

  // oci na stopkach
  const oci = [];
  for (const s of [-1, 1]) {
    const o = new THREE.Group(); o.position.set(s * 0.1, topY(0.1, 0.2) - 0.015, 0.22); o.rotation.z = -s * 0.3; o.rotation.x = 0.25;
    const zr = mesh(G.lesk, G.mZrenica, 0, 0.155, 0.04); zr.scale.setScalar(2.1); zr.castShadow = false;
    o.add(mesh(G.stopka, svetle, 0, 0.07, 0), mesh(G.oko, G.mOko, 0, 0.15, 0.01), zr);
    const l = mesh(G.lesk, G.mLesk, s * -0.015, 0.175, 0.04); l.castShadow = false; o.add(l);
    trup.add(o); oci.push(o);
  }
  // usta: dve celuste + bubliny
  const celuste = [];
  for (const s of [-1, 1]) {
    const c = new THREE.Group(); c.position.set(s * 0.045, -0.04, 0.3); c.add(mesh(G.celust, G.mZub, 0, 0, 0.04)); c.rotation.x = 0.35; trup.add(c); celuste.push(c);
  }
  const bubliny = [];
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(G.bubl, G.mBubl); b.position.set(0, 0, 0.35); trup.add(b); bubliny.push(b); }

  // klepeta: [mensie vlavo, vacsie vpravo]; rameno -> predlaktie -> dlan + pevny prst + pohyblivy prst
  const klieste = [], prsty = [];
  for (const s of [-1, 1]) {
    const K = s > 0 ? 1.3 * hrub : 0.85 * hrub;
    const ram = new THREE.Group(); ram.position.set(s * 0.27, -0.02, 0.14); ram.add(mesh(G.rameno, telo, 0, 0, 0.1));
    const lakt = new THREE.Group(); lakt.position.z = 0.2; lakt.rotation.y = -s * 0.85; lakt.scale.setScalar(Math.min(K, 1.15));
    lakt.add(mesh(G.predl, telo, 0, 0, 0.09));
    const klepeto = new THREE.Group(); klepeto.position.z = 0.19; klepeto.scale.setScalar(K * 0.95); lakt.add(klepeto);
    const dlan = mesh(G.dlan, telo, 0, 0, 0.08); dlan.scale.set(0.095, 0.085, 0.15); klepeto.add(dlan);
    const pevny = mesh(G.prst, svetle, 0, -0.035, 0.34); pevny.rotation.x = -0.12; pevny.position.z = 0.17; klepeto.add(pevny);
    const hp = new THREE.Group(); hp.position.set(0, 0.03, 0.17); const pohyb = mesh(G.prst, svetle, 0, 0.0, 0.12); pohyb.rotation.x = 0.12; hp.add(pohyb); klepeto.add(hp);
    const zuby = boss ? 5 : 3;                                                     // zuby na prstoch; boss navyse ostne na dlani
    for (let i = 0; i < zuby; i++) { klepeto.add(mesh(G.zub, G.mZub, 0, -0.0, 0.2 + i * 0.03)); hp.add(mesh(G.zub, G.mZub, 0, -0.02, 0.06 + i * 0.03).rotateX(Math.PI)); }
    if (boss) for (let i = 0; i < 4; i++) { const sp = mesh(G.zub, G.mZub, (i - 1.5) * 0.04, 0.075, 0.05 + (i % 2) * 0.05); sp.scale.setScalar(1.6); klepeto.add(sp); }
    ram.add(lakt); trup.add(ram); klieste.push(ram); prsty.push({ hp, s, lakt });
  }

  // 8 nohy: 4 na kazdej strane, 3 clanky (stehno, holen, spicata chodidlova cast)
  const nohyK = [], zN = [0.16, 0.06, -0.05, -0.15];
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const hip = new THREE.Group(); hip.position.set(s * 0.29, 0.24, zN[i]);
    hip.add(mesh(G.femur, telo, s * 0.1, 0, 0).rotateY(0));
    const kno = new THREE.Group(); kno.position.x = s * 0.2; kno.add(mesh(G.kb, svetle), mesh(G.tibia, telo, s * 0.14, 0, 0));
    const ank = new THREE.Group(); ank.position.x = s * 0.28; ank.add(mesh(G.tars, svetle, s * 0.07, 0, 0));
    if (s < 0) ank.children[0].rotation.y = Math.PI;                                // kuzel smeruje na -x
    kno.add(ank); hip.add(kno); g.add(hip);
    if (hrub > 1) hip.children.forEach(c => c.isMesh && c.scale.set(1, 1.3, 1.3));
    nohyK.push({ hip, kno, ank, s, i });
  }

  function animKrab(e, dt, cas, wk, sk, dupK, pohyb) {
    const ph = e.ph;
    for (const { hip, kno, ank, s, i } of nohyK) {
      const p = ph + (((i + (s > 0 ? 1 : 0)) % 2) ? Math.PI : 0) + i * 0.4;
      const zdv = Math.max(0, Math.cos(p)) * pohyb;                                    // nadvihnutie nohy pocas kroku
      const splay = (1.5 - i) * 0.3 + Math.sin(p) * 0.32 * pohyb;                      // krok dopredu/dozadu
      hip.rotation.set(0, -s * splay, s * (0.62 + zdv * 0.35 + wk * 0.1));
      kno.rotation.z = -s * (1.62 - zdv * 0.4);
      ank.rotation.z = -s * (0.32 + zdv * 0.2);
    }
    for (let k = 0; k < 2; k++) {
      const s = k ? 1 : -1, big = k === 1, r = klieste[k], { hp, lakt } = prsty[k];
      r.rotation.x = -wk * (dupK ? 1.9 : (big ? 1.25 : 1.0)) + sk * (dupK ? 1.4 : 0.65) + Math.sin(cas * 1.1 + k) * 0.04 * (1 - wk);
      r.rotation.y = s * (0.4 - wk * 0.45) * 0.8;
      lakt.rotation.y = -s * (0.85 - wk * 0.5);
      const idle = (0.25 + 0.4 * (0.5 + 0.5 * Math.sin(cas * (big ? 1.3 : 1.9) + k * 2))) * (1 - wk) * (1 - sk);
      hp.rotation.x = -(idle + wk * 0.75) + sk * 0.12;                                 // otvorene pri napriahu, zaklapnutie pri utoku
    }
    const dych = Math.sin(cas * 2.2 + ph * 0.1);
    trup.scale.set(1 + dych * 0.012, 1 + dych * 0.035, 1 + dych * 0.012);
    oci[0].rotation.z = 0.3 + Math.sin(cas * 1.7) * 0.06; oci[1].rotation.z = -0.3 + Math.sin(cas * 1.4 + 1) * 0.06;
    oci[0].rotation.x = oci[1].rotation.x = 0.25 - wk * 0.2;
    for (let i = 0; i < 2; i++) celuste[i].rotation.y = (i ? 1 : -1) * (0.08 + (0.5 + 0.5 * Math.sin(cas * (8 + wk * 6) + i * 1.3)) * (0.22 + wk * 0.3));
    const tichy = wk === 0 && sk === 0;
    for (let i = 0; i < 3; i++) {
      const u = (cas * 0.5 + i / 3) % 1, v = tichy ? Math.sin(Math.PI * u) : 0;
      bubliny[i].position.set(Math.sin(i * 2.1 + u * 4) * 0.05, -0.03 + u * 0.2, 0.34 + u * 0.06);
      bubliny[i].scale.setScalar(Math.max(v * (0.6 + 0.6 * ((i * 7) % 3) / 2), 0.0001));
    }
  }
  return { g, tela: [shell, telo, svetle], trup, nohy: [], klieste, animKrab };
}
