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
import { vyskaTerenu, uzlyPri, pasmoPlynule } from './svet.js';
import { vyskaVody, stopaLode, porucha, lodeMasky } from './ocean.js';
import { postavDruh } from './lode_modely.js';

const tlm = THREE.MathUtils.damp;
const UP = new THREE.Vector3(0, 1, 0);

// staty urovni: pad = tah padla, plachta = sila plachty (po vetre), zat = obratnost
// (strop rychlosti vychadza z odporu: ~9 m/s padlom na ur. 1, ~16 m/s s plachtou po vetre na ur. 4)
export const STATY = [null,
  { dlzka: 5.0, sirka: 0.42, hlbka: 0.36, zdvih: 0.36, pad: 5.5, plachta: 0, zat: 1.0, hit: 0.55, nazov: 'Jednoduché kanoe' },
  { dlzka: 5.6, sirka: 0.46, hlbka: 0.42, zdvih: 0.42, pad: 6.2, plachta: 5.5, zat: 1.1, hit: 0.6, nazov: 'Kanoe s plachtou' },
  { dlzka: 6.4, sirka: 0.54, hlbka: 0.48, zdvih: 0.5, pad: 7.0, plachta: 6.8, zat: 1.35, hit: 0.7, nazov: 'Veľké kanoe' },
  { dlzka: 7.2, sirka: 0.5, hlbka: 0.5, zdvih: 0.55, pad: 7.6, plachta: 8.0, zat: 1.5, nazov: 'Dvojtrupová plachetnica', rozchod: 2.2, boky: [-0.4, 0.4, 2.3, 3.1], rollK: 0.5, hit: 2.6 },
];

// vylepsenia (kazde 0..3): pad = silnejsie padlo, plachta = lepsia plachta, trup = hladsi trup (mensi odpor), kyl = obratnost
export const VYL_MAX = 3;
// vylepsenia: pad, plachta, trup, kyl (vsetky lode), sklad (+4 policka za stupen), tr = vylepsenie konkretnej lode (len lode okrem kanoe)
export const SKLAD_PRIRASTOK = 4;

// druhy lodi: kanoe (4 urovne, STATY) + lode s vlastnym modelom (lode_modely.js). sklad = pocet policok ulozneho priestoru.
// sedadlo = kde sedi hrac, boky = kde sa kresli brazda, sym = trup symetricky (naklon z vln z oboch bokov), kam = dalsia vzdialenost kamery
export const DRUHY = {
  kanoe: { nazov: 'Kanoe', sklad: 6 },
  pretekove: { nazov: 'Pretekárske kanoe', sklad: 4, stat: { dlzka: 7.4, sirka: 0.3, hlbka: 0.3, zdvih: 0.45, pad: 9, plachta: 7, zat: 1.25, odpor: 0.8,
    rozchod: 1.7, boky: [-0.3, 0.3], rollK: 1, sym: true, sedadlo: [0, 0.3, 1.0], kam: 1, hit: 1.9, nazov: 'Pretekárske kanoe' } },
  barza: { nazov: 'Nákladná pltť (barža)', sklad: 36, stat: { dlzka: 7.4, sirka: 1.0, hlbka: 0.4, zdvih: 0.3, pad: 5, plachta: 5.5, zat: 0.8, odpor: 1.7,
    rozchod: 1.4, boky: [-1.3, 1.3], rollK: 0.3, sym: true, sedadlo: [0, 0.6, 2.4], kam: 3, hit: 1.8, nazov: 'Nákladná pltť (barža)',
    maska: [1.75, -3.7, 3.7, 0.36],   // voda v podoryse plte najvyssie 0.36 m (pod nosnikmi a doskami), ocean.js
    // paluba, po ktorej sa da chodit: x, z = hranice, y = vyska, boxy = prekazky [x0, x1, z0, z1] (naklad, stozar)
    paluba: { x: [-1.55, 1.55], z: [-3.0, 3.0], y: 0.57, boxy: [[-1.3, -0.3, -1.0, -0.15], [0.35, 1.25, -0.6, 0.2], [0.45, 1.4, 0.2, 1.3], [-1.25, -0.55, 0.3, 1.1], [-0.15, 0.15, -2.75, -2.45]] } } },
  katamaran: { nazov: 'Veľký katamarán', sklad: 40, stat: { dlzka: 9.6, sirka: 0.45, hlbka: 0.55, zdvih: 0.7, pad: 6.5, plachta: 12, zat: 1.3, odpor: 0.7,
    rozchod: 3.2, boky: [-2.3, -1.4, 1.4, 2.3], rollK: 0.35, sym: true, sedadlo: [0, 0.98, 3.0], kam: 5, hit: 2.3, nazov: 'Veľký katamarán',
    maska: [2.2, -5.75, 4.8, 0.55],   // voda medzi trupmi najvyssie 0.55 m (pod nosnikmi, palubou aj sietou), ocean.js
    paluba: { x: [-2.0, 2.0], z: [-3.3, 3.8], y: 0.89, boxy: [[-1.35, 1.35, 0.35, 2.65], [-1.7, -0.15, -2.7, -1.9], [0.95, 1.5, -2.7, -2.1], [-0.2, 0.2, -1.4, -1.0]] } } },
};

// charakter lode na vode (pruzina + tlmic pre vysku, predklon a naklon):
//  w = tuhost (vlastna frekvencia, 1/s: velka = lod rychlo kopiruje vlny), z = tlmenie (1 = bez dokmitavania, malo = hojda sa)
//  bok = bocny odpor kyla (1/s), zatR = ako rychlo prestane tocit, nakZat = naklon v zakrute (+ do zakruty, - von)
//  klz = dvihnutie pridy s rychlostou, hojd = rozkyvanie pri zabere padlom, surf = ako lod zrychli dole vlnou
//  vietorN = naklon od plachty, sprej = mnozstvo spreju z pridy
const FYZ = {
  kanoe:     { wy: 5.5, zy: 0.35, wp: 5.0, zp: 0.3, wr: 5.0, zr: 0.22, bok: 3.5, zatR: 2.8, nakZat: 0.035, klz: 0.004, hojd: 0.12, surf: 0.9, vietorN: 0.012, sprej: 1 },
  pretekove: { wy: 7.0, zy: 0.25, wp: 6.5, zp: 0.22, wr: 6.5, zr: 0.14, bok: 5.5, zatR: 3.6, nakZat: 0.05, klz: 0.007, hojd: 0.18, surf: 1.15, vietorN: 0.016, sprej: 1.3 },
  barza:     { wy: 2.2, zy: 0.7, wp: 1.8, zp: 0.65, wr: 1.7, zr: 0.65, bok: 2.4, zatR: 1.6, nakZat: -0.006, klz: 0.001, hojd: 0, surf: 0.35, vietorN: 0.004, sprej: 0.6 },
  katamaran: { wy: 3.6, zy: 0.55, wp: 3.0, zp: 0.55, wr: 3.2, zr: 0.8, bok: 4.5, zatR: 2.2, nakZat: -0.01, klz: 0.003, hojd: 0, surf: 0.8, vietorN: 0.003, sprej: 1.2 },
};
const KELVIN = 19.47 * Math.PI / 180;                // uhol ramien brazdy (rovnaky pre kazdu lod v hlbokej vode)
const TAN_K = Math.tan(KELVIN);
// trupy lode z S.boky (dvojice = jeden trup): [stred (m vpravo), polsirka]
function trupy(S) {
  const b = S.boky ?? [-0.35, 0.35], t = [];
  for (let i = 0; i + 1 < b.length; i += 2) t.push([(b[i] + b[i + 1]) / 2, Math.max(0.2, (b[i + 1] - b[i]) / 2)]);
  return t;
}

// najvyssie pasmo mora, ktore lod zvladne (pasmo 5 zvladne ur. 4 a katamaran)
export function maxPasmo(k) {
  if (k.druh === 'kanoe') return [1, 1, 2, 3, 4][k.uroven] ?? 1;
  return { pretekove: 2, barza: 2, katamaran: 4 }[k.druh] ?? 1;
}
const dovolenePasmo = k => { const m = maxPasmo(k); return m >= 4 ? 5 : m; };
const CAS_DO_PREVRATENIA = 9, CAS_PREVRATENA = 6;   // s v prilis divokom mori / s kym je lod prevratena

export const vietor = { smer: 0.8, sila: 0.8 };       // smer = kam fuka (rovnaky uhol ako smer kanoe)
export function aktualizujVietor(t) {
  vietor.smer = 0.8 + Math.sin(t / 97) * 1.4;
  vietor.sila = 0.65 + 0.35 * Math.sin(t / 41);
}

// ---------- textury (canvas, vytvoria sa raz) ----------
function nahoda(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
let texTrup = null, texPlatno = null;
export function texturaTrupu() {                    // pruhy dosiek: v (okolo trupu) = os y platna
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
export function texturaPlatna() {                   // platno so vodorovnymi sevmi, uv = suradnice tvaru v metroch
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
export function trup(dlzka, sirka, hlbka, zdvih, plny = false) {
  return new ParametricGeometry((u, v, ciel) => {
    const z = (u - 0.5) * dlzka, s = Math.abs(u - 0.5) * 2;
    const w = Math.max(sirka * Math.pow(Math.max(1 - s * s, 0), 0.55), 0.015);   // nie 0: nulova normala = NaN v shaderi
    const d = Math.max(hlbka * Math.pow(Math.max(1 - s ** 4, 0), 0.5), 0.015);
    const a = (plny ? 2 : 1) * Math.PI * v;
    ciel.set(Math.cos(a) * w, -Math.sin(a) * d + zdvih * s * s, z);
  }, 28, plny ? 12 : 10);
}
export const polSirka = (S, z) => { const s = Math.abs(z) / (S.dlzka / 2); return S.sirka * Math.pow(Math.max(1 - s * s, 0), 0.55); };
const vyskaOkraja = (S, z) => { const s = Math.abs(z) / (S.dlzka / 2); return 0.32 + S.zdvih * s * s; };

export function spoj(a, b, r, mat, seg = 6) {       // valec medzi dvoma bodmi (lano, ztuha)
  const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}
export function vazby(krivka, tt, r, mat) {         // lanove obvazy: torusy kolmo na osu tyce
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

export function padloModel(mat) {
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

export function plachtaModel(k, uroven, mat) {
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

// ---------- hitboxy lodi ----------
// Trup = obdlznik (polovica dlzky hl, polovica sirky hw). Lode sa navzajom odtlacaju, hrac sa neprebija cez trup,
// breh a stromy kontroluje aktualizuj(). Lokalne suradnice lode: x = vpravo, z = dozadu (predok je -z).
const BODY = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];   // body hitboxu (x: -hw..hw, z: -hl..hl)

function kruhy(k, S = k.stat) {                  // retaz kruhov pozdlz trupu (kolizie lod-lod a lod-strom)
  const hw = S.hit ?? 0.6, hl = S.dlzka / 2, n = Math.max(2, Math.round(hl / hw)), out = [];
  const fx = -Math.sin(k.smer), fz = -Math.cos(k.smer);
  for (let i = 0; i <= n; i++) { const d = (i / n * 2 - 1) * Math.max(hl - hw * 0.6, 0); out.push([k.poz.x + fx * d, k.poz.y + fz * d, hw]); }
  return out;
}

export function naLokalne(k, x, z) {              // svetove -> lokalne suradnice lode
  const dx = x - k.poz.x, dz = z - k.poz.y, s = Math.sin(k.smer), c = Math.cos(k.smer);
  return [dx * c - dz * s, dx * s + dz * c];
}
export function zLokalnych(k, lx, lz) {           // lokalne -> svetove
  const s = Math.sin(k.smer), c = Math.cos(k.smer);
  return [k.poz.x + lx * c + lz * s, k.poz.y - lx * s + lz * c];
}

// odtlaci bod (hraca) von z trupu lode; vrati true, ak sa posunul
export function odtlacOdLode(k, p, rHraca = 0.3) {
  const { hl, hw } = k.hitbox(), [lx, lz] = naLokalne(k, p.x, p.z);
  const ex = hw + rHraca, ez = hl + rHraca;
  if (Math.abs(lx) >= ex || Math.abs(lz) >= ez) return false;
  let nlx = lx, nlz = lz;
  if (ex - Math.abs(lx) < ez - Math.abs(lz)) nlx = Math.sign(lx || 1) * ex; else nlz = Math.sign(lz || 1) * ez;
  [p.x, p.z] = zLokalnych(k, nlx, nlz);
  return true;
}

// lode sa navzajom odtlacaju (kruhy pozdlz trupu) a stratia rychlost v smere narazu
export function kolizieLodi(lode) {
  for (let i = 0; i < lode.length; i++) for (let j = i + 1; j < lode.length; j++) {
    const a = lode[i], b = lode[j];
    if (Math.hypot(a.poz.x - b.poz.x, a.poz.y - b.poz.y) > (a.stat.dlzka + b.stat.dlzka) / 2 + 4) continue;
    const ka = kruhy(a), kb = kruhy(b);
    let px = 0, pz = 0, n = 0;
    for (const [ax, az, ar] of ka) for (const [bx, bz, br] of kb) {
      const dx = ax - bx, dz = az - bz, d = Math.hypot(dx, dz), min = ar + br;
      if (d < min && d > 1e-4) { px += dx / d * (min - d); pz += dz / d * (min - d); n++; }
    }
    if (!n) continue;
    px /= n; pz /= n;
    const ha = a.stat.hit ?? 1, hb = b.stat.hit ?? 1, wa = hb / (ha + hb), wb = 1 - wa;   // tazsia lod sa hybe menej
    a.poz.x += px * wa; a.poz.y += pz * wa; b.poz.x -= px * wb; b.poz.y -= pz * wb;
    const l = Math.hypot(px, pz) || 1, nx = px / l, nz = pz / l;
    const vrel = (a.rych.x - b.rych.x) * nx + (a.rych.y - b.rych.y) * nz;
    if (vrel < 0) { a.rych.x -= nx * vrel * wa * 1.4; a.rych.y -= nz * vrel * wa * 1.4; b.rych.x += nx * vrel * wb * 1.4; b.rych.y += nz * vrel * wb * 1.4; }
  }
}

// pohyb hraca po palube (lokalne suradnice): vrati opravene [x, z]; P = paluba, boxy = prekazky
export function drzNaPalube(P, lx, lz) {
  lx = Math.max(P.x[0], Math.min(P.x[1], lx)); lz = Math.max(P.z[0], Math.min(P.z[1], lz));
  const r = 0.28;
  for (const [x0, x1, z0, z1] of P.boxy) {
    if (lx > x0 - r && lx < x1 + r && lz > z0 - r && lz < z1 + r) {
      const dl = lx - (x0 - r), dr = x1 + r - lx, dp = lz - (z0 - r), dz = z1 + r - lz, m = Math.min(dl, dr, dp, dz);
      if (m === dl) lx = x0 - r; else if (m === dr) lx = x1 + r; else if (m === dp) lz = z0 - r; else lz = z1 + r;
    }
  }
  return [lx, lz];
}

export function vytvorKanoe(scena, x, z, { pena, zvuky }, druh = 'kanoe') {
  const model = new THREE.Group();
  scena.add(model);

  let dStopy = 0, casPorucha = 0, casSpr = 0;
  let vlastne = [];

  // vymeni vlastne deti modelu (hrac pripojeny k modelu ostava a presunie sa na sedadlo)
  function zamen(b) {
    for (const o of vlastne) {
      model.remove(o);
      o.traverse(m => { m.geometry?.dispose(); if (m.material && !Array.isArray(m.material)) m.material.dispose(); });
    }
    vlastne = b.objekty;
    for (const o of vlastne) model.add(o);
    k.stat = b.S; k.plachta = b.plachta; k.padlo = b.padlo; k.plachtaK = b.K;
    k.SEDADLO.set(...(b.S.sedadlo || [0, 0.27, 0.6]));
    for (const d of model.children) if (!vlastne.includes(d)) d.position.copy(k.SEDADLO);
  }

  const k = {
    model, padlo: null, plachta: null,
    uroven: 1, stat: DRUHY[druh].stat || STATY[1], plachtaK: 1, druh, sklad: Array(DRUHY[druh].sklad).fill(null), vyl: { pad: 0, plachta: 0, trup: 0, kyl: 0, sklad: 0, tr: 0 },
    poz: new THREE.Vector2(x, z), rych: new THREE.Vector2(),
    y: 0, smer: -Math.PI / 2, uhlRych: 0, pitch: 0, roll: 0, faza: 0, plachtaV: 0, ucinnost: 0,
    vy: 0, vPitch: 0, vRoll: 0, ponorPrid: 0, casSpreju: 0, prvy: true,
    SEDADLO: new THREE.Vector3(0, 0.27, 0.6),
    rychlost: () => k.rych.length(),
    // divoke more: riziko 0..1, hlaska (text pre HUD, main ju vyzdvihne), prevrat (true = hrac ma vypadnut)
    riziko: 0, hlaska: null, prevrat: false, prevratCas: 0, prevrUhol: 0, hlaskaCas: 0,

    // prestavba modelu na inu uroven kanoe (1..4); ostatne druhy maju jeden model
    nastavUroven(n) {
      if (k.druh !== 'kanoe') return k.uroven;
      n = Math.max(1, Math.min(4, Math.round(Number(n)) || 1));
      zamen(postavModel(n));
      k.uroven = n;
      return n;
    },
    vylepsi(kluc, n) {
      if (!(kluc in k.vyl)) return;
      k.vyl[kluc] = n = Math.max(0, Math.min(VYL_MAX, n));
      if (kluc === 'sklad') while (k.sklad.length < DRUHY[k.druh].sklad + n * SKLAD_PRIRASTOK) k.sklad.push(null);   // sklad len rastie
    },
    hitbox: () => ({ hl: k.stat.dlzka / 2, hw: k.stat.hit ?? 0.6 }),
    // aktualne staty = zaklad lode x vylepsenia
    efekt() {
      const V = k.vyl, S = k.stat;
      return { ...S, pad: S.pad * (1 + 0.15 * V.pad) * (1 + 0.1 * V.tr), plachta: S.plachta * (1 + 0.2 * V.plachta) * (1 + 0.15 * V.tr),
        zat: S.zat * (1 + 0.15 * V.kyl) * (1 + 0.08 * V.tr), odpor: (S.odpor ?? 1) * (1 - 0.07 * V.trup) * (1 - 0.06 * V.tr), dlz: S.dlzka };
    },

    aktualizuj(dt, t, ovladane) {
      const S = k.efekt(), DLZKA = S.dlz;
      k.prevrat = false; k.hlaska = null;            // udalosti plati jeden snimok (main ich cita pred aktualizuj)
      const fx = -Math.sin(k.smer), fz = -Math.cos(k.smer), rx = Math.cos(k.smer), rz = -Math.sin(k.smer);
      let tah = 0, zatacanie = 0;
      if (ovladane) {
        tah = (klavesy.has('KeyW') ? 1 : 0) - (klavesy.has('KeyS') ? 0.6 : 0);
        zatacanie = (klavesy.has('KeyA') ? 1 : 0) - (klavesy.has('KeyD') ? 1 : 0);
      }
      k.plachtaV = tlm(k.plachtaV, ovladane && k.plachta && klavesy.has('ShiftLeft') ? 1 : 0, 2.5, dt);
      const rel = Math.atan2(Math.sin(vietor.smer - k.smer), Math.cos(vietor.smer - k.smer));
      k.ucinnost = (1 + Math.cos(rel)) / 2;

      const F = FYZ[k.druh] ?? FYZ.kanoe;
      let vf = k.rych.x * fx + k.rych.y * fz;
      let vr = k.rych.x * rx + k.rych.y * rz;
      // zaber padla: tah pulzuje v rytme padla (priemer ostava rovnaky) - lod "skace" dopredu po kazdom zabere
      const pulz = k.padlo ? 0.45 + 1.1 * Math.sin(k.faza) ** 2 : 1;
      vf += (tah * S.pad * pulz + S.plachta * vietor.sila * k.ucinnost * k.plachtaV) * dt;
      vf -= (vf * Math.abs(vf) * 0.055 * S.odpor + vf * 0.08) * dt;           // strop: ~9 m/s padlom (ur. 1), ~16 m/s s plachtou po vetre (ur. 4)
      vf -= vf * Math.min(Math.abs(k.uhlRych), 1.5) * 0.22 * dt;     // v zakrute trup brzdi
      vf -= 9.81 * (k.sklonP ?? 0) * F.surf * dt;                      // gravitacia na svahu vlny: dole vlnou zrychli, do vlny spomali
      vr -= 9.81 * (k.sklonR ?? 0) * F.surf * 0.4 * dt;                // vlna tlaci lod aj do boku
      // kyl: bocny pohyb sa rychlo utlmi, cast sa premeni na pohyb vpred (lod "zakusne" do vody)
      const vrPred = vr;
      vr *= Math.exp(-F.bok * dt);
      vf += Math.sign(vf) * Math.abs(vrPred - vr) * 0.15;

      k.uhlRych += zatacanie * (S.zat + 0.11 * Math.abs(vf)) * dt;
      k.uhlRych *= Math.exp(-F.zatR * dt);
      k.smer += k.uhlRych * dt;
      const nfx = -Math.sin(k.smer), nfz = -Math.cos(k.smer), nrx = Math.cos(k.smer), nrz = -Math.sin(k.smer);
      k.rych.set(nfx * vf + nrx * vr, nfz * vf + nrz * vr);

      // narazenie na breh a stromy: kontroluju sa len body hitboxu, ktore smeruju dopredu (z pasce sa da vzdy vycouvat)
      const voda = vyskaVody(k.poz.x, k.poz.y, t);
      const hw = S.hit ?? 0.6, hl = DLZKA / 2;
      const nx = k.poz.x + k.rych.x * dt, nz = k.poz.y + k.rych.y * dt;
      let narazil = false;
      for (const [bx, bz] of BODY) {
        const ox = rx * bx * hw - nfx * bz * hl * 0.95, oz = rz * bx * hw - nfz * bz * hl * 0.95;
        if (ox * k.rych.x + oz * k.rych.y <= 0) continue;
        if (vyskaTerenu(nx + ox, nz + oz) > voda - 0.3) { narazil = true; break; }
      }
      if (narazil) {
        if (Math.abs(vf) > 3) zvuky.uder('drevo');
        k.rych.multiplyScalar(-0.15);
      } else k.poz.set(nx, nz);
      for (const [cx, cz, r] of kruhy(k, S)) for (const u of uzlyPri(cx, cz)) {     // stromy a balvany v plytkej vode
        if (!u.rKolizia || u.zniceny) continue;
        const dx = cx - u.x, dz = cz - u.z, d = Math.hypot(dx, dz), min = u.rKolizia + r;
        if (d < min && d > 1e-4) { k.poz.x += dx / d * (min - d); k.poz.y += dz / d * (min - d); k.rych.multiplyScalar(0.7); }
      }

      // vlny pod lodou: vztlak v 8 bodoch trupu (4 pozdlz x 2 boky), z nich rovina hladiny pod lodou
      const v = (dx, dz) => vyskaVody(k.poz.x + dx, k.poz.y + dz, t);
      const rozchod = S.rozchod ?? 1.5, rozL = S.sym ? rozchod : 1.5, L2 = DLZKA * 0.45;
      let sum = 0, sumP = 0, sumPr = 0, sumL = 0, hPrid = 0;
      for (const a of [L2, L2 / 3, -L2 / 3, -L2]) {
        const hR = v(nfx * a + nrx * rozchod, nfz * a + nrz * rozchod), hL = v(nfx * a - nrx * rozL, nfz * a - nrz * rozL);
        sum += hR + hL; sumP += (hR + hL) * a; sumPr += hR; sumL += hL;
        if (a === L2) hPrid = (hR + hL) / 2;
      }
      const hS = sum / 8;
      k.sklonP = sumP / (2 * (2 * L2 * L2 + 2 * L2 * L2 / 9));       // sklon hladiny pozdlz lode (+ = prida vyssie)
      k.sklonR = (sumPr - sumL) / 4 / (rozchod + rozL);               // sklon naprieč (+ = pravy bok vyssie)
      // ciele: kam by sa lod ustalila; pruzina s tlmicom k nim dotiahne vysku, predklon aj naklon (zotrvacnost = dokmitavanie)
      const plachtaSila = S.plachta * vietor.sila * k.plachtaV;
      const cY = hS - 0.08;
      const cP = Math.atan(k.sklonP) + Math.min(Math.abs(vf), 14) * F.klz;   // pri rychlosti dvihne pridu
      const cR = Math.atan(k.sklonR) * (S.rollK ?? 1) + F.nakZat * k.uhlRych * vf + Math.sin(rel) * plachtaSila * F.vietorN;
      if (k.prvy) { k.y = cY; k.pitch = cP; k.roll = cR; k.prvy = false; }
      const kroky = Math.ceil(dt / 0.02), h = dt / kroky;
      for (let i = 0; i < kroky; i++) {
        k.vy += (F.wy * F.wy * (cY - k.y) - 2 * F.zy * F.wy * k.vy) * h; k.y += k.vy * h;
        k.vPitch += (F.wp * F.wp * (cP - k.pitch) - 2 * F.zp * F.wp * k.vPitch) * h; k.pitch += k.vPitch * h;
        k.vRoll += (F.wr * F.wr * (cR - k.roll) - 2 * F.zr * F.wr * k.vRoll) * h; k.roll += k.vRoll * h;
      }
      // prida narazi do vlny: ak voda pri pride rychlo stupa voci pride -> prida sa zdvihne, sprej, lod trochu spomali
      const ponor = hPrid - (k.y + 0.08 + Math.sin(k.pitch) * L2);
      const rychlostPonoru = (ponor - k.ponorPrid) / Math.max(dt, 1e-3);
      k.ponorPrid = ponor;
      k.casSpreju -= dt;
      const rychlVpred = Math.abs(vf);
      if (ponor > 0.05 && rychlostPonoru > 0.45 && rychlVpred > 2.5 && k.casSpreju <= 0 && dt < 0.1) {
        const sila = Math.min(rychlostPonoru, 2.5) * Math.min(rychlVpred / 8, 1.5);
        k.casSpreju = 0.3;
        k.vPitch += sila * 0.22;
        vf *= 1 - 0.025 * sila;
        k.rych.set(nfx * vf + nrx * vr, nfz * vf + nrz * vr);
        const bx = k.poz.x + nfx * L2, bz = k.poz.y + nfz * L2, n = Math.round(Math.min(26, sila * 9 * F.sprej));
        for (let i = 0; i < n; i++) {
          const str = i % 2 ? 1 : -1, bok = (Math.random() * 0.6 + 0.4) * str;
          pena.vypust(bx + nrx * bok * 0.4, k.y + 0.25, bz + nrz * bok * 0.4,
            nrx * bok * (1.5 + Math.random() * 2.5) + nfx * rychlVpred * 0.55, 1.5 + Math.random() * (1.5 + sila * 1.5),
            nrz * bok * (1.5 + Math.random() * 2.5) + nfz * rychlVpred * 0.55, 0xffffff, 0.5 + Math.random() * 0.4);
        }
        for (const [cx, hw] of trupy(S)) stopaLode(1, bx + nrx * cx, bz + nrz * cx, 0, 0, 0, hw * 3 + 1, hw * 3 + 1, 0.05, 1.1, 2.5, 0.8);
        if (sila > 1.2) zvuky.padlo();
      }
      // prilis divoke more pre tuto lod: kolisanie, varovanie, nakoniec prevratenie
      const nad = pasmoPlynule(k.poz.x, k.poz.y) - dovolenePasmo(k);
      let kolis = 0;
      k.hlaskaCas -= dt;
      if (k.prevratCas > 0) {
        k.prevratCas -= dt;
        k.riziko = 0;
        if (k.prevratCas <= 0) k.hlaskaCas = 0;
      } else if (nad > 0.3) {
        k.riziko += dt * (1 + Math.min(nad, 2) * 0.5) / CAS_DO_PREVRATENIA;
        const sila = Math.min(1, k.riziko * 1.5);
        kolis = Math.sin(t * 1.7) * (0.07 + 0.2 * sila) + Math.sin(t * 2.9 + 1) * 0.05 * sila;
        if (k.riziko > 0.1 && k.hlaskaCas <= 0) { k.hlaska = 'More je na túto loď príliš divoké!'; k.hlaskaCas = 6; }
        if (k.riziko >= 1) { k.prevrat = true; k.prevratCas = CAS_PREVRATENA; k.riziko = 0; k.hlaska = 'Loď sa prevrátila!'; zvuky.uder?.('drevo'); }
      } else k.riziko = Math.max(0, k.riziko - dt / 4);
      k.prevrUhol = tlm(k.prevrUhol, k.prevratCas > 0 ? 2.9 : 0, k.prevratCas > 0 ? 3 : 1.2, dt);
      model.position.set(k.poz.x, k.y - Math.sin(Math.min(k.prevrUhol, 3)) * 0.15, k.poz.y);
      model.rotation.set(k.pitch, k.smer, k.roll + kolis + k.prevrUhol, 'YXZ');

      // plachta po vetre
      const plachta = k.plachta, padlo = k.padlo, K = k.plachtaK;
      if (plachta) {
        plachta.visible = k.plachtaV > 0.01 || k.uroven >= 2 || k.druh !== 'kanoe';
        plachta.rotation.y = tlm(plachta.rotation.y, THREE.MathUtils.clamp(rel * 0.6, -1.2, 1.2), 3, dt);
        const KK = K * (k.druh === 'kanoe' ? 1 : 1 + 0.1 * k.vyl.tr);
        plachta.scale.set(KK, KK * (0.06 + 0.94 * k.plachtaV), KK * (0.25 + 0.75 * k.plachtaV));
      }

      // brazda: castice stopy do textury vody (ocean.js). Kazdy trup ma vlastnu stopu (katamaran = dve V).
      //  - ramena V: vznikaju pri pride a odplavaju do boku rychlostou v*tan(19.5 st.) -> za lodou vznikne V s Kelvinovym uhlom
      //  - turbulentna pena za kormou, val vody okolo trupu (len tento snimok)
      const rychl = k.rych.length();
      const tr = trupy(S), velkost = DLZKA / 6;
      const A = Math.min(rychl / 8, 1.3);                        // intenzita podla rychlosti
      for (const [cx, hw] of tr) {
        if (rychl > 0.4) stopaLode(2, k.poz.x + nrx * cx - nfx * 0.1, k.poz.y + nrz * cx - nfz * 0.1, k.smer, 0, 0,
          DLZKA * 1.08, hw * 2 + 0.45, 0.02 + A * (0.05 + hw * 0.03), Math.max(0, (rychl - 1.5) / 7) * (0.6 + hw * 0.4), 0, 0);
      }
      const krok = THREE.MathUtils.clamp(0.35 + rychl * 0.07, 0.4, 1.3);
      dStopy += rychl * dt;
      if (rychl < 0.6) dStopy = 0;
      let vydaj = 0;
      while (dStopy > krok && vydaj++ < 6) {
        dStopy -= krok;
        const spat = (dStopy / Math.max(rychl, 0.1));             // kolko s dozadu mala castica vzniknut (rovnomerne rozostupy)
        const ox = -k.rych.x * spat, oz = -k.rych.y * spat;
        for (const [cx, hw] of tr) {
          const amp = A * (0.05 + hw * 0.07 + velkost * 0.05), zivot = 4 + DLZKA * 0.45 + rychl * 0.35;
          const penaV = Math.max(0, (rychl - 3) / 10) * (0.25 + velkost * 0.15);
          for (const s of [-1, 1]) {
            const px = k.poz.x + nfx * DLZKA * 0.42 + nrx * (cx + s * hw) + ox, pz = k.poz.y + nfz * DLZKA * 0.42 + nrz * (cx + s * hw) + oz;
            const von = rychl * TAN_K;
            stopaLode(0, px, pz, k.smer + s * KELVIN, nrx * s * von, nrz * s * von,
              krok / Math.cos(KELVIN) * 3, 0.9 + hw * 1.4 + velkost * 0.4, amp, penaV, zivot, 0.25 + rychl * 0.05);
          }
          const kx = k.poz.x - nfx * DLZKA * 0.47 + nrx * cx + ox, kz = k.poz.y - nfz * DLZKA * 0.47 + nrz * cx + oz;
          const r0 = hw * 2.2 + 0.4;
          stopaLode(1, kx + (Math.random() - 0.5) * hw, kz + (Math.random() - 0.5) * hw, 0,
            nfx * rychl * 0.25 + (Math.random() - 0.5) * 0.4, nfz * rychl * 0.25 + (Math.random() - 0.5) * 0.4,
            r0, r0, 0.02 + A * 0.05, Math.min(0.25 + rychl / 10, 1.2) * (0.6 + hw * 0.4), 1.8 + rychl * 0.25 + hw * 2, 0.35 + rychl * 0.06);
        }
      }
      // nocny plankton: kratke iskrenie po bokoch kormy (ostatok stopy svieti z textury brazdy)
      casPorucha -= dt;
      if (rychl > 2 && casPorucha <= 0) {
        casPorucha = 0.35;
        const [cx, hw] = tr[Math.floor(Math.random() * tr.length)], s = Math.random() < 0.5 ? -1 : 1;
        porucha(k.poz.x - nfx * DLZKA * 0.4 + nrx * (cx + s * hw * 1.3), k.poz.y - nfz * DLZKA * 0.4 + nrz * (cx + s * hw * 1.3), 0.6 + hw);
      }
      // jemny sprej z pridy pri rychlej plavbe
      casSpr -= dt;
      if (rychl > 3.5 && casSpr <= 0) {
        casSpr = THREE.MathUtils.clamp(0.4 / rychl, 0.03, 0.08);
        for (const [cx] of tr) for (let i = 0; i < Math.min(rychl / 4, 3) * F.sprej; i++) {
          const strana = Math.random() < 0.5 ? -1 : 1, bx = k.poz.x + nfx * DLZKA * 0.45 + nrx * cx, bz = k.poz.y + nfz * DLZKA * 0.45 + nrz * cx;
          pena.vypust(bx + nrx * strana * 0.2, k.y + 0.15, bz + nrz * strana * 0.2,
            nrx * strana * (1 + Math.random() * 1.5) + nfx * rychl * 0.4, 1 + Math.random() * rychl * 0.2,
            nrz * strana * (1 + Math.random() * 1.5) + nfz * rychl * 0.4, 0xffffff, 0.45 + Math.random() * 0.3);
        }
      }

      // padlo: striedanie stran, pri prechode do vody splach + zvuk
      if (padlo) padlo.visible = ovladane;
      if (padlo && ovladane) {
        const aktivne = tah !== 0 || zatacanie !== 0;
        const stara = Math.sin(k.faza * 0.5) > 0;
        k.faza += dt * (aktivne ? 5 : 0);
        const strana = Math.sin(k.faza * 0.5) > 0 ? 1 : -1;
        if (aktivne && (strana > 0) !== stara) {
          zvuky.padlo();
          const px = k.poz.x + nrx * strana * 0.8, pz = k.poz.y + nrz * strana * 0.8;
          const F2 = FYZ[k.druh] ?? FYZ.kanoe;
          k.vRoll += strana * F2.hojd;                              // zaber z boku lod rozkyve
          k.uhlRych -= strana * F2.hojd * 0.35 * Math.sign(tah || 1);   // a trochu stoci na opacnu stranu
          stopaLode(1, px, pz, 0, -nfx * 0.5, -nfz * 0.5, 0.7, 0.7, 0.03, 0.5, 2.2, 0.5);
          porucha(px, pz, 0.6);
          for (let i = 0; i < 6; i++) pena.vypust(px, k.y + 0.1, pz, (Math.random() - 0.5) * 1.5, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 1.5, 0xffffff, 0.5);
        }
        padlo.rotation.z = tlm(padlo.rotation.z, strana * 0.85, 7, dt);
        padlo.rotation.x = aktivne ? Math.sin(k.faza) * 0.65 * Math.sign(tah || 1) : tlm(padlo.rotation.x, 0, 4, dt);
      }
    },
  };
  if (druh === 'kanoe') k.nastavUroven(1); else zamen(postavDruh(druh));
  lodeMasky.push(k);                                 // voda pod palubou (ocean.js) - len lode so stat.maska
  return k;
}
