// Kanoe s vyvazovacim plavakom a plachtou.
// Fyzika: tah padla + plachta (po vetre najviac), odpor vody rastie s rychlostou, kyl tlmi bocny smyk,
// otacanie so zotrvacnostou, poloha a naklon z vln pod lodou (vsetko vyhladene).
// Efekty: sprej z pridy, brazda (pena na hladine), splachnutie padla + zvuk.
import * as THREE from 'three';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
import { klavesy } from './vstup.js';
import { vyskaTerenu } from './svet.js';
import { vyskaVody } from './ocean.js';
import { VRSTVA_VODA } from './grafika.js';
import { MAPA_KRUH } from './castice.js';

const tlm = THREE.MathUtils.damp;
const DLZKA = 5.6;

export const vietor = { smer: 0.8, sila: 0.8 };       // smer = kam fuka (rovnaky uhol ako smer kanoe)
export function aktualizujVietor(t) {
  vietor.smer = 0.8 + Math.sin(t / 97) * 1.4;
  vietor.sila = 0.65 + 0.35 * Math.sin(t / 41);
}

// trup: polovica elipsy v priereze, uzsi a vyssi na koncoch
function trup(dlzka, sirka, hlbka, zdvih, plny = false) {
  return new ParametricGeometry((u, v, ciel) => {
    const z = (u - 0.5) * dlzka, s = Math.abs(u - 0.5) * 2;
    const w = Math.max(sirka * Math.pow(Math.max(1 - s * s, 0), 0.55), 0.015);   // nie 0: nulova normala = NaN v shaderi
    const d = Math.max(hlbka * Math.pow(Math.max(1 - s ** 4, 0), 0.5), 0.015);
    const a = (plny ? 2 : 1) * Math.PI * v;
    ciel.set(Math.cos(a) * w, -Math.sin(a) * d + zdvih * s * s, z);
  }, 28, plny ? 12 : 10);
}

function postavModel() {
  const model = new THREE.Group();
  const drevo = new THREE.MeshStandardMaterial({ color: 0x9a6a3e, roughness: 0.75, side: THREE.DoubleSide });
  const tmave = new THREE.MeshStandardMaterial({ color: 0x5e3d22, roughness: 0.8 });
  const lano = new THREE.MeshStandardMaterial({ color: 0xc9b07a, roughness: 0.9 });
  const h = new THREE.Mesh(trup(DLZKA, 0.46, 0.42, 0.42), drevo);
  h.position.y = 0.32;
  // okraj trupu
  const okraj = [];
  for (let i = 0; i <= 20; i++) {
    const u = i / 20, s = Math.abs(u - 0.5) * 2;
    okraj.push(new THREE.Vector3(0.46 * Math.pow(Math.max(1 - s * s, 0), 0.55), 0.32 + 0.42 * s * s, (u - 0.5) * DLZKA));
  }
  const krivkaOkraja = new THREE.CatmullRomCurve3([...okraj, ...okraj.slice(1, -1).reverse().map(p => new THREE.Vector3(-p.x, p.y, p.z))], true);
  const lem = new THREE.Mesh(new THREE.TubeGeometry(krivkaOkraja, 80, 0.035, 5, true), tmave);
  // plavak a dve ohnute priecky
  const plavak = new THREE.Mesh(trup(3.4, 0.13, 0.13, 0.12, true), tmave);
  plavak.position.set(2.1, 0.12, 0);
  const priecky = [-1.0, 1.0].map(z => new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.35, 0.36, z), new THREE.Vector3(1.1, 0.95, z), new THREE.Vector3(2.1, 0.22, z)), 12, 0.045, 6), tmave));
  const sedadlo = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.05, 0.3), tmave);
  sedadlo.position.set(0, 0.24, 0.6);
  // stloznik a plachta (krabie klepeto)
  const stloznik = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 3.6, 7), tmave);
  stloznik.position.set(0, 2.0, -0.9);
  const plachta = new THREE.Group();
  plachta.position.set(0, 0.45, -0.9);
  const tvar = new THREE.Shape();
  tvar.moveTo(0, 0); tvar.quadraticCurveTo(0.4, 1.8, 0.2, 3.4); tvar.quadraticCurveTo(1.3, 1.6, 2.5, 0.5); tvar.quadraticCurveTo(1.2, 0.1, 0, 0);
  const platno = new THREE.Mesh(new THREE.ShapeGeometry(tvar, 12).rotateY(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xeedfc0, roughness: 0.9, side: THREE.DoubleSide }));
  const ratna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 5).rotateX(Math.PI / 2).translate(0, 0.05, 1.25), lano);
  plachta.add(platno, ratna);
  // padlo
  const padlo = new THREE.Group();
  padlo.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 6), tmave));
  const list = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.3, 2, 8), tmave);
  list.scale.set(1, 1, 0.25); list.position.y = -0.95;
  padlo.add(list);
  padlo.position.set(0, 1.2, 0.35);
  model.add(h, lem, plavak, ...priecky, sedadlo, stloznik, plachta, padlo);
  model.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { model, plachta, padlo };
}

export function vytvorKanoe(scena, x, z, { pena, zvuky }) {
  const { model, plachta, padlo } = postavModel();
  scena.add(model);

  // brazda: kruhy peny na hladine, rastu a miznu (farba instancie = jas, aditivne miesanie)
  const POCET = 300;
  const brazda = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: MAPA_KRUH, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), POCET);
  brazda.frustumCulled = false;
  brazda.layers.set(VRSTVA_VODA);
  scena.add(brazda);
  const stopy = Array.from({ length: POCET }, () => ({ x: 0, z: 0, vx: 0, vz: 0, vek: 99, r: 1 }));
  let dalsia = 0, casStopy = 0;
  const m4 = new THREE.Matrix4(), c = new THREE.Color();

  const k = {
    model, padlo,
    poz: new THREE.Vector2(x, z), rych: new THREE.Vector2(),
    y: 0, smer: -Math.PI / 2, uhlRych: 0, pitch: 0, roll: 0, faza: 0, plachtaV: 0, ucinnost: 0,
    SEDADLO: new THREE.Vector3(0, 0.27, 0.6),
    rychlost: () => k.rych.length(),

    aktualizuj(dt, t, ovladane) {
      const fx = -Math.sin(k.smer), fz = -Math.cos(k.smer), rx = Math.cos(k.smer), rz = -Math.sin(k.smer);
      let tah = 0, zatacanie = 0;
      if (ovladane) {
        tah = (klavesy.has('KeyW') ? 1 : 0) - (klavesy.has('KeyS') ? 0.6 : 0);
        zatacanie = (klavesy.has('KeyA') ? 1 : 0) - (klavesy.has('KeyD') ? 1 : 0);
      }
      k.plachtaV = tlm(k.plachtaV, ovladane && klavesy.has('ShiftLeft') ? 1 : 0, 2.5, dt);
      const rel = Math.atan2(Math.sin(vietor.smer - k.smer), Math.cos(vietor.smer - k.smer));
      k.ucinnost = (1 + Math.cos(rel)) / 2;

      let vf = k.rych.x * fx + k.rych.y * fz;
      let vr = k.rych.x * rx + k.rych.y * rz;
      vf += (tah * 8 + 7 * vietor.sila * k.ucinnost * k.plachtaV) * dt;
      vf -= (vf * Math.abs(vf) * 0.055 + vf * 0.08) * dt;           // max ~11 m/s padlom, ~15 s plachtou po vetre
      vr *= Math.exp(-4 * dt);                                       // kyl

      k.uhlRych += zatacanie * (1.1 + 0.11 * Math.abs(vf)) * dt;
      k.uhlRych *= Math.exp(-2.8 * dt);
      k.smer += k.uhlRych * dt;
      const nfx = -Math.sin(k.smer), nfz = -Math.cos(k.smer), nrx = Math.cos(k.smer), nrz = -Math.sin(k.smer);
      k.rych.set(nfx * vf + nrx * vr, nfz * vf + nrz * vr);

      // narazenie na breh (kontrola pred pridou / zadou)
      const voda = vyskaVody(k.poz.x, k.poz.y, t);
      const sm = Math.sign(vf) || 1;
      const nx = k.poz.x + k.rych.x * dt, nz = k.poz.y + k.rych.y * dt;
      if (vyskaTerenu(nx + nfx * DLZKA / 2 * sm, nz + nfz * DLZKA / 2 * sm) > voda - 0.3) {
        if (Math.abs(vf) > 3) zvuky.uder('drevo');
        k.rych.multiplyScalar(-0.15);
      } else k.poz.set(nx, nz);

      // vlny pod lodou
      const v = (dx, dz) => vyskaVody(k.poz.x + dx, k.poz.y + dz, t);
      const hP = v(nfx * 2.5, nfz * 2.5), hZ = v(-nfx * 2.5, -nfz * 2.5), hR = v(nrx * 1.5, nrz * 1.5), hL = v(-nrx * 1.5, -nrz * 1.5);
      const hS = (hP + hZ + hR + hL + v(0, 0)) / 5;
      k.y = tlm(k.y, hS - 0.08, 7, dt);
      k.pitch = tlm(k.pitch, Math.atan2(hP - hZ, 5) + Math.min(Math.abs(vf), 14) * 0.004, 5, dt);   // pri rychlosti dvihne pridu
      k.roll = tlm(k.roll, Math.atan2(hR - hL, 3) + k.uhlRych * vf * 0.025, 5, dt);
      model.position.set(k.poz.x, k.y, k.poz.y);
      model.rotation.set(k.pitch, k.smer, k.roll, 'YXZ');

      // plachta po vetre
      plachta.rotation.y = tlm(plachta.rotation.y, THREE.MathUtils.clamp(rel * 0.6, -1.2, 1.2), 3, dt);
      plachta.scale.set(1, 0.06 + 0.94 * k.plachtaV, 0.25 + 0.75 * k.plachtaV);

      // brazda a sprej
      const rychl = k.rych.length();
      casStopy -= dt;
      if (rychl > 0.8 && casStopy <= 0) {
        casStopy = THREE.MathUtils.clamp(0.4 / rychl, 0.02, 0.08);
        for (const strana of [-1, 1]) {
          const st = stopy[dalsia]; dalsia = (dalsia + 1) % POCET;
          st.x = k.poz.x - nfx * DLZKA * 0.42 + nrx * strana * 0.35; st.z = k.poz.y - nfz * DLZKA * 0.42 + nrz * strana * 0.35;
          st.vek = 0; st.r = 0.35 + rychl * 0.03; st.vx = nrx * strana * 0.6; st.vz = nrz * strana * 0.6;
        }
        if (rychl > 3.5) for (let i = 0; i < Math.min(rychl / 3, 4); i++) {
          const strana = Math.random() < 0.5 ? -1 : 1, bx = k.poz.x + nfx * DLZKA * 0.45, bz = k.poz.y + nfz * DLZKA * 0.45;
          pena.vypust(bx + nrx * strana * 0.2, k.y + 0.15, bz + nrz * strana * 0.2,
            nrx * strana * (1 + Math.random() * 1.5) + nfx * rychl * 0.4, 1 + Math.random() * rychl * 0.25,
            nrz * strana * (1 + Math.random() * 1.5) + nfz * rychl * 0.4, 0xffffff, 0.5 + Math.random() * 0.3);
        }
      }
      for (let i = 0; i < POCET; i++) {
        const st = stopy[i];
        st.vek += dt;
        if (st.vek > 3) { m4.makeScale(0, 0, 0); brazda.setMatrixAt(i, m4); continue; }
        st.x += st.vx * dt; st.z += st.vz * dt;
        const m = st.r * (1 + st.vek * 0.9);
        m4.makeScale(m, 1, m).setPosition(st.x, vyskaVody(st.x, st.z, t) + 0.05, st.z);
        brazda.setMatrixAt(i, m4);
        brazda.setColorAt(i, c.setScalar(0.2 * (1 - st.vek / 3) ** 2));
      }
      brazda.instanceMatrix.needsUpdate = true;
      if (brazda.instanceColor) brazda.instanceColor.needsUpdate = true;

      // padlo: striedanie stran, pri prechode do vody splach + zvuk
      padlo.visible = ovladane;
      if (ovladane) {
        const aktivne = tah !== 0 || zatacanie !== 0;
        const stara = Math.sin(k.faza * 0.5) > 0;
        k.faza += dt * (aktivne ? 5 : 0);
        const strana = Math.sin(k.faza * 0.5) > 0 ? 1 : -1;
        if (aktivne && (strana > 0) !== stara) {
          zvuky.padlo();
          const px = k.poz.x + nrx * strana * 0.8, pz = k.poz.y + nrz * strana * 0.8;
          for (let i = 0; i < 6; i++) pena.vypust(px, k.y + 0.1, pz, (Math.random() - 0.5) * 1.5, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 1.5, 0xffffff, 0.5);
        }
        padlo.rotation.z = tlm(padlo.rotation.z, strana * 0.85, 7, dt);
        padlo.rotation.x = aktivne ? Math.sin(k.faza) * 0.65 * Math.sign(tah || 1) : tlm(padlo.rotation.x, 0, 4, dt);
      }
    },
  };
  return k;
}
