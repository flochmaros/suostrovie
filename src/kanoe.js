// Kanoe s vyvazovacim plavakom a plachtou, 4 urovne vylepsenia.
//   uroven 1 = jednoduche kanoe (len padlo), 2 = plachta, 3 = vacsi trup + silnejsi plavak + vacsia plachta,
//   4 = dvojtrupova plavidlo s palubou a velkou plachtou.
// Fyzika: tah padla + plachta (po vetre najviac), odpor vody rastie s rychlostou, kyl tlmi bocny smyk,
// otacanie so zotrvacnostou, poloha a naklon z vln pod lodou (vsetko vyhladene).
// Efekty: sprej z pridy, brazda (pena na hladine), splachnutie padla + zvuk.
// kanoe.model je jedna Group; pri zmene urovne sa vymenia len vlastne deti (hrac pripojeny k modelu ostava).
import * as THREE from 'three';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
import { klavesy } from './vstup.js';
import { vyskaTerenu } from './svet.js';
import { vyskaVody } from './ocean.js';
import { VRSTVA_VODA } from './grafika.js';
import { MAPA_KRUH } from './castice.js';

const tlm = THREE.MathUtils.damp;
const UP = new THREE.Vector3(0, 1, 0);

// staty urovni: pad = tah padla, plachta = sila plachty (po vetre), zat = obratnost
// (strop rychlosti vychadza z odporu: ~9 m/s padlom na ur. 1, ~16 m/s s plachtou po vetre na ur. 4)
export const STATY = [null,
  { dlzka: 5.0, sirka: 0.42, hlbka: 0.36, zdvih: 0.36, pad: 5.5, plachta: 0, zat: 1.0, nazov: 'Jednoduché kanoe' },
  { dlzka: 5.6, sirka: 0.46, hlbka: 0.42, zdvih: 0.42, pad: 6.2, plachta: 5.5, zat: 1.1, nazov: 'Kanoe s plachtou' },
  { dlzka: 6.4, sirka: 0.54, hlbka: 0.48, zdvih: 0.5, pad: 7.0, plachta: 6.8, zat: 1.35, nazov: 'Veľké kanoe' },
  { dlzka: 7.2, sirka: 0.5, hlbka: 0.5, zdvih: 0.55, pad: 7.6, plachta: 8.0, zat: 1.5, nazov: 'Dvojtrupová plachetnica' },
];

// typy kanoe (na rozny ucel): nasobice k zakladnym statom urovne; dlz/sir = zmena tvaru modelu, farba = odtien trupu
export const TYPY = {
  zakladne: { nazov: 'Základné', pad: 1, plachta: 1, zat: 1, odpor: 1, dlz: 1, sir: 1, roll: 1, farba: 0xffffff },
  pretekove: { nazov: 'Pretekárske (rýchle, menej obratné)', pad: 1.3, plachta: 1.15, zat: 0.75, odpor: 0.8, dlz: 1.18, sir: 0.8, roll: 1.5, farba: 0xffb08a },
  rybarske: { nazov: 'Rybárske (obratné, stabilné)', pad: 0.95, plachta: 0.9, zat: 1.6, odpor: 1.05, dlz: 0.88, sir: 1.12, roll: 0.5, farba: 0xb9d6a0 },
  nakladne: { nazov: 'Nákladné (pomalé, veľmi stabilné)', pad: 0.8, plachta: 1.25, zat: 0.7, odpor: 1.15, dlz: 1.1, sir: 1.45, roll: 0.25, farba: 0xc9b2a0 },
};
// vylepsenia (kazde 0..3): pad = silnejsie padlo, plachta = lepsia plachta, trup = hladsi trup (mensi odpor), kyl = obratnost
export const VYL_MAX = 3;

export const vietor = { smer: 0.8, sila: 0.8 };       // smer = kam fuka (rovnaky uhol ako smer kanoe)
export function aktualizujVietor(t) {
  vietor.smer = 0.8 + Math.sin(t / 97) * 1.4;
  vietor.sila = 0.65 + 0.35 * Math.sin(t / 41);
}

// ---------- textury (canvas, vytvoria sa raz) ----------
function nahoda(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
let texTrup = null, texPlatno = null;
function texturaTrupu() {                    // pruhy dosiek: v (okolo trupu) = os y platna
  if (texTrup) return texTrup;
  const c = document.createElement('canvas'); c.width = 128; c.height = 288;
  const g = c.getContext('2d'), r = nahoda(7), N = 9, ph = c.height / N;
  for (let i = 0; i < N; i++) {
    g.fillStyle = `hsl(${27 + r() * 5}, ${36 + r() * 10}%, ${40 + r() * 14}%)`;
    g.fillRect(0, i * ph, c.width, ph);
    for (let j = 0; j < 12; j++) {          // zrno dreva
      g.strokeStyle = `rgba(60,35,15,${0.08 + r() * 0.14})`; g.lineWidth = 0.6 + r();
      const y = i * ph + r() * ph, x = r() * c.width;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30 + r() * 80, y + (r() - 0.5) * 3); g.stroke();
    }
    g.fillStyle = 'rgba(30,16,8,0.55)'; g.fillRect(r() * c.width, i * ph + 2, 2, ph - 3);     // spoj dosiek
  }
  for (let i = 0; i <= N; i++) { g.fillStyle = 'rgba(28,14,6,0.8)'; g.fillRect(0, i * ph - 1.5, c.width, 3); }   // spary
  texTrup = new THREE.CanvasTexture(c);
  texTrup.colorSpace = THREE.SRGBColorSpace; texTrup.anisotropy = 4; texTrup.wrapS = THREE.RepeatWrapping; texTrup.repeat.set(2, 1);
  return texTrup;
}
function texturaPlatna() {                   // platno so vodorovnymi sevmi, uv = suradnice tvaru v metroch
  if (texPlatno) return texPlatno;
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d'), r = nahoda(11);
  g.fillStyle = '#f1e6cb'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 160; i++) {            // tkanina
    g.fillStyle = `rgba(${150 + r() * 40},${120 + r() * 40},80,${0.05 + r() * 0.07})`;
    g.fillRect(r() * 128, r() * 128, 1 + r() * 6, 1);
  }
  g.fillStyle = 'rgba(110,85,50,0.55)'; g.fillRect(0, 126, 128, 2); g.fillRect(0, 0, 128, 1);   // sev
  g.strokeStyle = 'rgba(110,85,50,0.5)'; g.setLineDash([4, 3]); g.lineWidth = 1;                 // stehy
  g.beginPath(); g.moveTo(0, 122.5); g.lineTo(128, 122.5); g.stroke();
  texPlatno = new THREE.CanvasTexture(c);
  texPlatno.colorSpace = THREE.SRGBColorSpace; texPlatno.anisotropy = 4;
  texPlatno.wrapS = texPlatno.wrapT = THREE.RepeatWrapping; texPlatno.repeat.set(0.5, 2.0);
  return texPlatno;
}

// ---------- geometria ----------
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
const polSirka = (S, z) => { const s = Math.abs(z) / (S.dlzka / 2); return S.sirka * Math.pow(Math.max(1 - s * s, 0), 0.55); };
const vyskaOkraja = (S, z) => { const s = Math.abs(z) / (S.dlzka / 2); return 0.32 + S.zdvih * s * s; };

function spoj(a, b, r, mat, seg = 6) {       // valec medzi dvoma bodmi (lano, ztuha)
  const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}
function vazby(krivka, tt, r, mat) {         // lanove obvazy: torusy kolmo na osu tyce
  return tt.map(t => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.3, 5, 10), mat);
    m.position.copy(krivka.getPoint(t));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), krivka.getTangent(t).normalize());
    return m;
  });
}

// jeden trup: plaste so zrnom dosiek, okraj, pridova a zadna ozdoba, lavice
function kadlub(uroven, S, x, mat) {
  const o = [];
  const h = new THREE.Mesh(trup(S.dlzka, S.sirka, S.hlbka, S.zdvih), mat.drevo);
  h.position.set(x, 0.32, 0); o.push(h);
  const okraj = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24, z = (u - 0.5) * S.dlzka;
    okraj.push(new THREE.Vector3(polSirka(S, z), vyskaOkraja(S, z), z));
  }
  const krivka = new THREE.CatmullRomCurve3([...okraj, ...okraj.slice(1, -1).reverse().map(p => new THREE.Vector3(-p.x, p.y, p.z))], true);
  const lem = new THREE.Mesh(new THREE.TubeGeometry(krivka, 96, 0.035, 5, true), mat.tmave);
  lem.position.x = x; o.push(lem);
  // lavice (priecne dosky) + vnutorne rebra
  const lavice = uroven >= 3 ? [-1.6, -0.5, 0.6, 1.7] : [-1.0, 0.6];
  for (const z of lavice) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(polSirka(S, z) * 1.96, 0.04, 0.2), mat.tmave);
    l.position.set(x, vyskaOkraja(S, z) - 0.07, z); o.push(l);
  }
  // pridova (z<0) a zadna ozdoba: vyhnuty, dole stocena tyc s prstencom
  for (const znak of [-1, 1]) {
    const zk = znak * S.dlzka / 2, y0 = 0.32 + S.zdvih, vel = znak < 0 ? 1 : 0.7;
    const pts = [[0, 0], [0.13, 0.1], [0.19, 0.3], [0.1, 0.45], [-0.02, 0.5]].map(([dz, dy]) =>
      new THREE.Vector3(x, y0 + dy * vel, zk + znak * dz * vel));
    const c = new THREE.CatmullRomCurve3(pts);
    o.push(new THREE.Mesh(new THREE.TubeGeometry(c, 14, 0.03 + 0.012 * (uroven > 1), 6), mat.tmave));
    const koniec = pts[pts.length - 1];
    const prst = new THREE.Mesh(new THREE.TorusGeometry(0.055 * vel, 0.014, 5, 10).rotateY(Math.PI / 2), mat.lano);
    prst.position.set(x, y0 + 0.42 * vel, zk + znak * 0.13 * vel);
    if (uroven >= 2) o.push(prst);
    if (uroven >= 3 && znak < 0) {               // vyrezavana vtacia hlava na prede
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat.tmave);
      hl.position.set(x, koniec.y + 0.04, koniec.z - 0.03);
      const zobak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 6), mat.svetle);
      zobak.rotation.x = -Math.PI / 2 - 0.4; zobak.position.set(x, koniec.y - 0.01, koniec.z - 0.14);
      o.push(hl, zobak);
      for (const s of [-1, 1]) {
        const oko = new THREE.Mesh(new THREE.SphereGeometry(0.014, 5, 4), mat.svetle);
        oko.position.set(x + 0.058 * s, koniec.y + 0.07, koniec.z - 0.06); o.push(oko);
      }
    }
    if (uroven >= 3 && znak > 0) {               // zadny vejar z pier
      for (let i = -1; i <= 1; i++) {
        const p = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.22, 5), mat.tmave);
        p.position.set(x + i * 0.06, koniec.y + 0.07, koniec.z + 0.06); p.rotation.set(-0.5, 0, -i * 0.5); o.push(p);
      }
    }
  }
  return o;
}

function padloModel(mat) {
  const padlo = new THREE.Group();
  padlo.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 1.7, 7), mat.svetle));
  const rukov = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 6).rotateZ(Math.PI / 2), mat.svetle);
  rukov.position.y = 0.86; padlo.add(rukov);
  for (const y of [0.55, 0.62]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 4, 8).rotateX(Math.PI / 2), mat.lano); t.position.y = y; padlo.add(t); }
  // list: listovity tvar s hrebenom
  const tv = new THREE.Shape();
  tv.moveTo(0, 0.32); tv.bezierCurveTo(0.14, 0.22, 0.14, -0.1, 0.05, -0.27); tv.lineTo(0, -0.31);
  tv.lineTo(-0.05, -0.27); tv.bezierCurveTo(-0.14, -0.1, -0.14, 0.22, 0, 0.32);
  const list = new THREE.Mesh(new THREE.ExtrudeGeometry(tv, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1 }).translate(0, 0, -0.01), mat.tmave);
  list.position.y = -0.95; padlo.add(list);
  const hreben = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.62, 0.045), mat.svetle);
  hreben.position.y = -0.95; padlo.add(hreben);
  padlo.position.set(0, 1.2, 0.35);
  return padlo;
}

function plachtaModel(k, uroven, mat) {
  const plachta = new THREE.Group();
  const tvar = new THREE.Shape();
  tvar.moveTo(0, 0); tvar.quadraticCurveTo(0.4, 1.8, 0.2, 3.4); tvar.quadraticCurveTo(1.3, 1.6, 2.5, 0.5); tvar.quadraticCurveTo(1.2, 0.1, 0, 0);
  const farba = [0, 0, 0xf1e5c8, 0xf7ebd0, 0xefd9ae][uroven];
  const platno = new THREE.Mesh(new THREE.ShapeGeometry(tvar, 14).rotateY(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: farba, map: texturaPlatna(), roughness: 0.9, side: THREE.DoubleSide }));
  plachta.add(platno);
  // pozdlzny hladky a zadne rameno (krabie klepeto)
  plachta.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 2.6, 6).rotateX(Math.PI / 2).translate(0, 0.05, 1.25), mat.lano));
  plachta.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 3.4, 0.2), new THREE.Vector3(0, 1.6, 1.3), new THREE.Vector3(0, 0.5, 2.5)), 14, 0.022, 5), mat.lano));
  if (uroven >= 3) {                          // farebny pas na plachte
    const pas = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.18), new THREE.MeshStandardMaterial({ color: 0xb8452c, roughness: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    pas.rotation.y = Math.PI / 2; pas.position.set(0, 1.55, 0.75); plachta.add(pas);
  }
  return plachta;
}

// postavi model pre danu uroven; vrati zoznam objektov pre model + plachtu + padlo
function postavModel(uroven) {
  const S = STATY[uroven];
  const mat = {
    drevo: new THREE.MeshStandardMaterial({ color: [0, 0xd9c2a0, 0xffffff, 0xf4dcc0, 0xffe6cc][uroven], map: texturaTrupu(), roughness: 0.75, side: THREE.DoubleSide }),
    tmave: new THREE.MeshStandardMaterial({ color: 0x5e3d22, roughness: 0.8 }),
    svetle: new THREE.MeshStandardMaterial({ color: 0xb98a58, roughness: 0.7 }),
    lano: new THREE.MeshStandardMaterial({ color: 0xc9b07a, roughness: 0.95 }),
  };
  const o = [];
  o.push(...kadlub(uroven, S, 0, mat));
  const sedadlo = new THREE.Mesh(new THREE.BoxGeometry(uroven === 1 ? 0.7 : 0.85, 0.05, 0.3), mat.tmave);
  sedadlo.position.set(0, 0.24, 0.6); o.push(sedadlo);

  let stoziar = null;                         // pozicia stoziara (x, z) a vyska
  if (uroven <= 3) {
    // vyvazovaci plavak + 2 (ur. 3: 3) ohnute priecky s lanovymi obvazmi
    const fx = [0, 1.9, 2.1, 2.4][uroven], fr = [0, 0.11, 0.13, 0.17][uroven], fd = [0, 3.0, 3.4, 4.2][uroven];
    const plavak = new THREE.Mesh(trup(fd, fr, fr, 0.12, true), mat.tmave);
    plavak.position.set(fx, 0.12, 0); o.push(plavak);
    const zs = uroven === 3 ? [-1.3, 0, 1.3] : [-1.0, 1.0];
    for (const z of zs) {
      const krivka = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-S.sirka * 0.8, 0.36, z), new THREE.Vector3(fx * 0.52, 0.95, z), new THREE.Vector3(fx, 0.12 + fr + 0.04, z));
      const tyc = new THREE.Mesh(new THREE.TubeGeometry(krivka, 16, uroven === 3 ? 0.06 : 0.045, 6), mat.tmave);
      o.push(tyc);
      let tG = 0.3;                           // kde tyc prechadza cez okraj trupu
      for (let i = 0; i <= 30; i++) if (krivka.getPoint(i / 30).x < polSirka(S, z)) tG = i / 30;
      o.push(...vazby(krivka, [tG - 0.03, tG, tG + 0.03, 0.9, 0.94, 0.98], uroven === 3 ? 0.07 : 0.056, mat.lano));
      // lano krizom k trupu (len ur. 3)
      if (uroven === 3) o.push(spoj(new THREE.Vector3(polSirka(S, z) * 0.9, 0.5, z - 0.12), new THREE.Vector3(fx * 0.8, 0.3, z + 0.12), 0.012, mat.lano, 4));
    }
    stoziar = uroven >= 2 ? { x: 0, z: uroven === 3 ? -1.2 : -0.9 } : null;
  } else {
    // druhy trup, tri priecne nosniky s obvazmi, paluba z dosiek, zabradlie, truhly
    const X2 = 2.7;
    o.push(...kadlub(uroven, S, X2, mat));
    for (const z of [-2.0, 0.1, 2.0]) {
      const nos = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 0.12), mat.tmave);
      nos.position.set(X2 / 2, 0.6, z); o.push(nos);
      for (const xr of [polSirka(S, z), X2 - polSirka(S, z), -polSirka(S, z) + 0.02, X2 + polSirka(S, z)]) for (const dx of [-0.04, 0.04]) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.016, 5, 10).rotateY(Math.PI / 2), mat.lano);
        r.position.set(xr + dx, 0.6, z); o.push(r);
      }
    }
    const doskyMat = [0xa8784a, 0xb4845a, 0x9a6c40].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
    for (let i = 0; i < 8; i++) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.05, 4.6), doskyMat[i % 3]);
      d.position.set(0.56 + i * 0.205, 0.68, -0.1); o.push(d);
    }
    for (const z of [-2.1, -0.7, 0.7, 2.1]) {        // zabradlie na paube
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.55, 6), mat.tmave);
      p.position.set(2.1, 0.95, z); o.push(p);
    }
    o.push(spoj(new THREE.Vector3(2.1, 1.2, -2.1), new THREE.Vector3(2.1, 1.2, 2.1), 0.016, mat.lano, 4));
    const truhla = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), mat.svetle); truhla.position.set(1.8, 0.93, 1.4); o.push(truhla);
    const sud = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.5, 10), mat.tmave); sud.position.set(1.0, 0.98, 1.6); o.push(sud);
    const zvitok = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 14).rotateX(Math.PI / 2), mat.lano); zvitok.position.set(1.4, 0.74, -1.5); o.push(zvitok);
    stoziar = { x: X2 / 2, z: -0.9 };
  }

  let plachta = null, K = 1;
  if (stoziar) {
    K = [0, 0, 0.85, 1.2, 1.5][uroven];
    const vyska = 3.6 * K + (uroven === 4 ? 0.5 : 0);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * K, 0.06 * K, vyska, 8), mat.tmave);
    const y0 = uroven === 4 ? 0.66 : 0.2;
    st.position.set(stoziar.x, y0 + vyska / 2, stoziar.z); o.push(st);
    o.push(...vazby(new THREE.LineCurve3(new THREE.Vector3(stoziar.x, y0, stoziar.z), new THREE.Vector3(stoziar.x, y0 + vyska, stoziar.z)), [0.04, 0.07, 0.1], 0.065 * K, mat.lano));
    // predna ztuha stoziara k pride
    o.push(spoj(new THREE.Vector3(stoziar.x, y0 + vyska - 0.1, stoziar.z), new THREE.Vector3(0, 0.32 + S.zdvih + 0.05, -S.dlzka / 2 + 0.1), 0.012, mat.lano, 4));
    plachta = plachtaModel(null, uroven, mat);
    plachta.position.set(stoziar.x, y0 + 0.25 * K, stoziar.z);
    o.push(plachta);
  }
  const padlo = padloModel(mat);
  o.push(padlo);
  o.forEach(m => m.traverse(c => { if (c.isMesh) c.castShadow = true; }));
  return { objekty: o, plachta, padlo, K, S };
}

export function vytvorKanoe(scena, x, z, { pena, zvuky }) {
  const model = new THREE.Group();
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
  let vlastne = [];

  // tvar a farba trupu podla typu (model sedadla/hraca sa nemeni)
  function aplikujTyp() {
    const T = TYPY[k.typ];
    for (const o of vlastne) {
      o.scale.set(T.sir, 1, T.dlz);
      o.traverse(m => { const mt = m.material; if (mt && !Array.isArray(mt) && mt.map === texTrup) mt.color.setHex(T.farba); });
    }
  }

  const k = {
    model, padlo: null, plachta: null,
    uroven: 1, stat: STATY[1], plachtaK: 1, typ: 'zakladne', vyl: { pad: 0, plachta: 0, trup: 0, kyl: 0 },
    poz: new THREE.Vector2(x, z), rych: new THREE.Vector2(),
    y: 0, smer: -Math.PI / 2, uhlRych: 0, pitch: 0, roll: 0, faza: 0, plachtaV: 0, ucinnost: 0,
    SEDADLO: new THREE.Vector3(0, 0.27, 0.6),
    rychlost: () => k.rych.length(),

    // prestavba modelu na inu uroven (1..4); model ostava ten isty, vymenia sa len vlastne deti
    nastavUroven(n) {
      n = Math.max(1, Math.min(4, Math.round(Number(n)) || 1));
      for (const o of vlastne) {
        model.remove(o);
        o.traverse(m => { m.geometry?.dispose(); if (m.material && !Array.isArray(m.material)) m.material.dispose(); });
      }
      const b = postavModel(n);
      vlastne = b.objekty;
      for (const o of vlastne) model.add(o);
      k.uroven = n; k.stat = b.S; k.plachta = b.plachta; k.padlo = b.padlo; k.plachtaK = b.K;
      for (const d of model.children) if (!vlastne.includes(d)) d.position.copy(k.SEDADLO);   // hrac ostava sediet
      aplikujTyp();
      return n;
    },
    nastavTyp(id) { if (TYPY[id]) { k.typ = id; aplikujTyp(); } return k.typ; },
    vylepsi(kluc, n) { if (kluc in k.vyl) k.vyl[kluc] = Math.max(0, Math.min(VYL_MAX, n)); },
    // aktualne staty = zaklad urovne x typ x vylepsenia (pouziva aj HUD/dev)
    efekt() {
      const T = TYPY[k.typ], V = k.vyl, S = k.stat;
      return { pad: S.pad * T.pad * (1 + 0.15 * V.pad), plachta: S.plachta * T.plachta * (1 + 0.2 * V.plachta),
        zat: S.zat * T.zat * (1 + 0.15 * V.kyl), odpor: T.odpor * (1 - 0.07 * V.trup), dlz: S.dlzka * T.dlz };
    },

    aktualizuj(dt, t, ovladane) {
      const S = k.efekt(), DLZKA = S.dlz;
      const fx = -Math.sin(k.smer), fz = -Math.cos(k.smer), rx = Math.cos(k.smer), rz = -Math.sin(k.smer);
      let tah = 0, zatacanie = 0;
      if (ovladane) {
        tah = (klavesy.has('KeyW') ? 1 : 0) - (klavesy.has('KeyS') ? 0.6 : 0);
        zatacanie = (klavesy.has('KeyA') ? 1 : 0) - (klavesy.has('KeyD') ? 1 : 0);
      }
      k.plachtaV = tlm(k.plachtaV, ovladane && k.uroven >= 2 && klavesy.has('ShiftLeft') ? 1 : 0, 2.5, dt);
      const rel = Math.atan2(Math.sin(vietor.smer - k.smer), Math.cos(vietor.smer - k.smer));
      k.ucinnost = (1 + Math.cos(rel)) / 2;

      let vf = k.rych.x * fx + k.rych.y * fz;
      let vr = k.rych.x * rx + k.rych.y * rz;
      vf += (tah * S.pad + S.plachta * vietor.sila * k.ucinnost * k.plachtaV) * dt;
      vf -= (vf * Math.abs(vf) * 0.055 * S.odpor + vf * 0.08) * dt;           // strop: ~9 m/s padlom (ur. 1), ~16 m/s s plachtou po vetre (ur. 4)
      vr *= Math.exp(-4 * dt);                                       // kyl

      k.uhlRych += zatacanie * (S.zat + 0.11 * Math.abs(vf)) * dt;
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
      const hP = v(nfx * DLZKA * 0.45, nfz * DLZKA * 0.45), hZ = v(-nfx * DLZKA * 0.45, -nfz * DLZKA * 0.45);
      const rozchod = k.uroven === 4 ? 2.2 : 1.5;
      const hR = v(nrx * rozchod, nrz * rozchod), hL = v(-nrx * 1.5, -nrz * 1.5);
      const hS = (hP + hZ + hR + hL + v(0, 0)) / 5;
      k.y = tlm(k.y, hS - 0.08, 7, dt);
      k.pitch = tlm(k.pitch, Math.atan2(hP - hZ, DLZKA * 0.9) + Math.min(Math.abs(vf), 14) * 0.004, 5, dt);   // pri rychlosti dvihne pridu
      k.roll = tlm(k.roll, Math.atan2(hR - hL, rozchod + 1.5) * (k.uroven === 4 ? 0.5 : 1) * TYPY[k.typ].roll + k.uhlRych * vf * 0.025, 5, dt);
      model.position.set(k.poz.x, k.y, k.poz.y);
      model.rotation.set(k.pitch, k.smer, k.roll, 'YXZ');

      // plachta po vetre
      const plachta = k.plachta, padlo = k.padlo, K = k.plachtaK;
      if (plachta) {
        plachta.visible = k.plachtaV > 0.01 || k.uroven >= 2;
        plachta.rotation.y = tlm(plachta.rotation.y, THREE.MathUtils.clamp(rel * 0.6, -1.2, 1.2), 3, dt);
        plachta.scale.set(K, K * (0.06 + 0.94 * k.plachtaV), K * (0.25 + 0.75 * k.plachtaV));
      }

      // brazda a sprej
      const rychl = k.rych.length();
      const bokyStop = k.uroven === 4 ? [-0.4, 0.4, 2.3, 3.1] : [-0.35, 0.35];
      casStopy -= dt;
      if (rychl > 0.8 && casStopy <= 0) {
        casStopy = THREE.MathUtils.clamp(0.4 / rychl, 0.02, 0.08);
        for (const bok of bokyStop) {
          const st = stopy[dalsia]; dalsia = (dalsia + 1) % POCET;
          st.x = k.poz.x - nfx * DLZKA * 0.42 + nrx * bok; st.z = k.poz.y - nfz * DLZKA * 0.42 + nrz * bok;
          st.vek = 0; st.r = 0.35 + rychl * 0.03; st.vx = nrx * Math.sign(bok) * 0.6; st.vz = nrz * Math.sign(bok) * 0.6;
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
  k.nastavUroven(1);
  return k;
}
