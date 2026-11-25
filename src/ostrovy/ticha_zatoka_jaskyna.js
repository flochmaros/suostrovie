// Jaskyna pod utesom Tichej zatoky - tvar, kolizie a modely skaly.
// Teren hry je vyskova mapa (neda sa v nom urobit dutina), preto 3 vrstvy:
//   1) teren sa v mieste jaskyne VYREZE az po podlahu (rez()),
//   2) nad zarez sa polozi skalna "skrupina" vo vyske povodneho utesu (strecha, da sa po nej chodit),
//   3) vnutri je skalna chodba (tunel z prstencov) + komora; vpredu stena utesu s obluk. vchodom.
// Suradnice: u = do boku (x - X), v = hlbka od vchodu na juh (z - Z). Vsetko lokalne na ostrove.
import { noise, smooth, clamp, lerp } from './pomoc.js';

export const JX = -8, JZ = 24;          // stred vchodu (lokalne suradnice ostrova)
export const DLZKA = 39.5;              // dlzka jaskyne (m)

// tabulky [v, hodnota] -> plynula interpolacia
const tab = t => v => {
  if (v <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (v < t[i][0]) {
    const [a, x] = t[i - 1], [b, y] = t[i];
    return lerp(x, y, smooth(a, b, v));
  }
  return t[t.length - 1][1];
};
export const sirka = tab([[0, 2.1], [4, 1.8], [10, 2.3], [16, 1.7], [21, 2.0], [25, 4.6], [30, 7.0], [35, 6.2], [38, 3.8], [39.5, 2.4]]);   // polovica sirky
export const vyskaStropu = tab([[0, 2.2], [4, 2.7], [10, 3.4], [16, 2.8], [21, 3.0], [25, 4.6], [30, 5.8], [35, 5.0], [39.5, 3.0]]);
export const podlaha = tab([[0, -2.12], [8, -1.9], [18, -1.4], [24, -1.2], [40, -1.2]]);
export const os = v => 2.8 * Math.sin(v * 0.17) * smooth(0, 6, v);         // stred chodby (kluka sa)

// miesta v komore (lokalne x, z ostrova) - pre pribeh
const bod = (v, du) => [JX + os(v) + du, JZ + v];
export const KOMORA = bod(31, 0);
export const VYKLENOK = bod(37.2, 0);   // truhlica pre buduci "kluc od majaka 2"
export const VCHOD = [JX, JZ];

// ---------- zarez do terenu ----------
const OKRAJ = 3.2;                      // rovna podlaha aj za stenou (teren ma bunky 2.5 m, nesmie trcat dnu)
export function rez(x, z, h) {
  const u = x - JX, v = z - JZ;
  if (v < -7 || v > DLZKA + 8 || u < -16 || u > 16) return h;
  const vv = clamp(v, 0, DLZKA);
  const bok = v < 0 ? Math.abs(u) - (sirka(0) + OKRAJ + 1) : Math.abs(u - os(vv)) - (sirka(vv) + OKRAJ);
  const d = Math.max(bok, v - (DLZKA + OKRAJ), -7 - v);
  if (d > 1.5) return h;
  const dno = podlaha(vv);
  return Math.min(h, lerp(dno, Math.max(h, dno), smooth(0, 1.5, d)));
}

// ---------- strecha (skrupina nad zarezom) ----------
// vzdialenost k okraju skrupiny (kladna = vnutri)
function rezerva(u, v) {
  const vv = clamp(v, 0, DLZKA);
  return Math.min(sirka(vv) + OKRAJ + 6.5 - Math.abs(u - os(vv)), DLZKA + 10 - v);
}
// vyska strechy; h0(x, z) = povodny utes bez zarezu
export function vyskaSkrupiny(u, v, h0) {
  const zaklad = h0(JX + u, JZ + Math.max(v, 3.4));
  const e = smooth(0, 3, rezerva(u, v));
  return zaklad + lerp(-0.8, 0.25 + 0.55 * noise(u * 0.28, v * 0.28, 31), e);
}

// ---------- kolizie pre hraca a kameru ----------
// vyska strechy ako "podlaha", ak je hrac nad nou (inak -Infinity)
export function strechaPre(x, z, y, h0) {
  const u = x - JX, v = z - JZ;
  if (v < 0.4 || rezerva(u, v) < 0.6) return -Infinity;
  const s = vyskaSkrupiny(u, v, h0);
  return y > s - 1.6 ? s : -Infinity;
}
// je bod vnutri dutiny? m = rezerva od steny (m)
export function vnutri(x, y, z, m = 0) {
  const v = z - JZ;
  if (v < -0.4 || v > DLZKA - m) return false;
  const vv = Math.max(v, 0), du = (x - JX - os(vv)) / Math.max(sirka(vv) - m, 0.2),
    dy = (y - podlaha(vv)) / Math.max(vyskaStropu(vv) - m, 0.2);
  return dy > -0.6 && du * du + Math.max(dy, 0) ** 2 < 1;
}
// 0 = vonku, 1 = hlboko v jaskyni (na stmavenie)
export function hlbkaVJaskyni(x, y, z) {
  const v = z - JZ;
  if (v < 0 || v > DLZKA + 1) return 0;
  if (Math.abs(x - JX - os(v)) > sirka(v) + 1 || y > podlaha(v) + vyskaStropu(v) + 0.8) return 0;
  return smooth(0, 9, v);
}
// pre kameru: je bod v plnej skale?
export function vSkale(x, y, z, h0) {
  const u = x - JX, v = z - JZ;
  if (v < -0.1 || rezerva(u, v) < 0.3) return false;
  return !vnutri(x, y, z, 0.2) && y < vyskaSkrupiny(u, v, h0) + 0.35;
}
// drz hraca vnutri chodby (meni poz; poz = lokalne {x, y, z}); vonku/na streche nic nerobi
export function drzVJaskyni(poz, h0) {
  const u = poz.x - JX, v = poz.z - JZ;
  if (v < 0.15 || rezerva(u, v) < 0) return false;
  if (poz.y > vyskaSkrupiny(u, v, h0) - 1.6) return false;           // stoji na streche
  const vv = Math.min(v, DLZKA - 0.9);
  const c = JX + os(vv), pol = sirka(vv) * 0.84 - 0.25;
  // v prvom metri: kto je mimo obluka, narazi do steny utesu (nevtiahne ho dnu zboku)
  if (v < 1.2 && Math.abs(poz.x - c) > pol + 0.5) { poz.z = JZ + 0.15; return true; }
  poz.x = clamp(poz.x, c - pol, c + pol);
  poz.z = JZ + vv;
  return true;
}

// bod na povrchu steny: v = hlbka, a = uhol 0 (vychod) .. PI (zapad), PI/2 = strop; k < 1 = kusok pred stenou
export function povrch(v, a, k = 1) {
  const j = a / Math.PI * 22, nab = smooth(0, 2.5, v), ca = Math.cos(a), sa = Math.sin(a);
  // hruby povrch: len smerom VON, aby sa hrac nikdy neprepadol cez stenu
  const hr = (1 + (Math.abs(noise(v * 0.45, j * 0.55, 5)) * 0.34 + Math.abs(noise(v * 1.3, j * 1.4, 15)) * 0.12) * nab) * k;
  return [JX + os(v) + Math.sign(ca) * Math.pow(Math.abs(ca), 0.8) * sirka(v) * hr,
    podlaha(v) + Math.pow(Math.max(sa, 0), 0.85) * vyskaStropu(v) * hr, JZ + v];
}

// farba travy na vrchu utesu (linearne RGB) - pouziva ju teren aj strecha jaskyne, aby nebolo vidno spoj
export function travaUtesu(x, z) {
  const a = smooth(-0.25, 0.35, noise(x * 0.07, z * 0.07, 41)), b = noise(x * 0.35, z * 0.35, 43) * 0.12;
  return [lerp(0.085, 0.2, a) * (1 + b), lerp(0.27, 0.36, a) * (1 + b), lerp(0.03, 0.055, a) * (1 + b)];
}

// ---------- modely skaly ----------
export function postavSkalu(T, P, h0) {
  const objekty = [];
  const mat = P.mat(0xffffff, { vertexColors: true, flatShading: true, roughness: 0.95, side: T.DoubleSide, envMapIntensity: 0.55 });
  const matVnutri = P.mat(0xfefefe, { vertexColors: true, flatShading: true, roughness: 1, side: T.DoubleSide, envMapIntensity: 0.05 });
  const C = h => new T.Color(h);
  const SKALA = C(0x928a7a), SKALA2 = C(0xb09c78), TMAVA = C(0x686055), MACH = C(0x538a34), TRAVA = C(0x4a9c2e),
    MOKRA = C(0x3f4a44), RIASA = C(0x3f5c34), DNU = C(0x4a4642), DNU2 = C(0x665a4e), c = new T.Color();

  // siet z mriezky bodov [riadok][stlpec] -> Vector3; farba(p, i, j) -> Color; plati(i, j) vynecha stvorce
  const siet = (body, farba, material, plati) => {
    const R = body.length, S = body[0].length, poz = [], col = [], idx = [];
    for (let i = 0; i < R; i++) for (let j = 0; j < S; j++) {
      const p = body[i][j];
      poz.push(p.x, p.y, p.z);
      const f = farba(p, i, j);
      col.push(f.r, f.g, f.b);
    }
    for (let i = 0; i < R - 1; i++) for (let j = 0; j < S - 1; j++) {
      if (plati && !plati(i, j)) continue;
      const a = i * S + j, b = a + 1, d = a + S, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(poz, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new T.Mesh(g, material);
    objekty.push(m);
    return m;
  };
  // farba vonkajsej skaly: vrstvy + mach/trava na rovnych miestach, mokre a obrastene pri hladine
  const farbaVonku = (p, rovina) => {
    const vrstva = noise(p.x * 0.06, p.y * 0.75, p.z * 0.06);
    c.copy(SKALA).lerp(vrstva > 0 ? SKALA2 : TMAVA, Math.min(1, Math.abs(vrstva) * 2.2));
    c.lerp(MACH, smooth(0.15, 0.4, noise(p.x * 0.13, p.y * 0.1, p.z * 0.13)) * 0.7 * smooth(1, 4, p.y));
    if (rovina > 0) c.lerp(noise(p.x * 0.1, 3, p.z * 0.1) > 0.05 ? TRAVA : MACH, rovina);
    c.lerp(RIASA, smooth(1.1, 0.3, p.y) * 0.75);
    c.lerp(MOKRA, smooth(0.2, -0.8, p.y) * 0.8);
    return c.offsetHSL(0, 0, noise(p.x * 0.9, p.y * 0.9, p.z * 0.9) * 0.05);
  };

  // --- 1) strecha ---
  const KROK = 0.9, U0 = -20, U1 = 20, V1 = DLZKA + 10;
  const nu = Math.round((U1 - U0) / KROK), nv = Math.round(V1 / KROK);
  const strecha = [];
  for (let i = 0; i <= nv; i++) {
    const v = i / nv * V1, rad = [];
    for (let j = 0; j <= nu; j++) {
      const u = U0 + (U1 - U0) * j / nu;
      rad.push(new T.Vector3(JX + u, vyskaSkrupiny(u, v, h0), JZ + v));
    }
    strecha.push(rad);
  }
  const rovina = p => {
    const z = Math.max(p.z, JZ + 3.4), sklon = Math.abs(h0(p.x + 1.2, z) - h0(p.x - 1.2, z));
    return smooth(2.6, 1.2, sklon) * smooth(1.5, 4.5, p.z - JZ + noise(p.x * 0.3, 0, p.z * 0.3) * 3);
  };
  const travnata = new T.Color();
  // v hre pouzije material terenu (rovnake trsy a flaky travy ako okolo)
  const strechaSiet = siet(strecha, p => {
    const k = rovina(p);
    farbaVonku(p, 0);
    return c.lerp(travnata.setRGB(...travaUtesu(p.x, p.z)), k);
  }, P.matTeren || mat, (i, j) => rezerva(U0 + (U1 - U0) * (j + 0.5) / nu, (i + 0.5) / nv * V1) > 0);
  {
    // shader terenu chce aj farbu plaze (aPiesok): rgb = ta ista farba, w = 1 -> samotna trava
    const col = strechaSiet.geometry.attributes.color, a = new Float32Array(col.count * 4);
    for (let i = 0; i < col.count; i++) a.set([col.getX(i), col.getY(i), col.getZ(i), 1], i * 4);
    strechaSiet.geometry.setAttribute('aPiesok', new T.BufferAttribute(a, 4));
    // trsy travy a kvietky na streche
    const o = new T.Object3D(), r = P.rng(4411), steblo = new T.ConeGeometry(0.045, 1, 3).translate(0, 0.5, 0);
    const trsy = [], kvety = [], kriky = [];
    for (let i = 0; i < 2600 && trsy.length < 1500; i++) {
      const u = (r() - 0.5) * 38, v = 2 + r() * (V1 - 4);
      if (rezerva(u, v) < 1.2) continue;
      const y = vyskaSkrupiny(u, v, h0), p = { x: JX + u, y, z: JZ + v };
      if (rovina(p) < 0.6) continue;
      for (let k = 0; k < 3; k++) trsy.push([p.x + (r() - 0.5) * 0.3, y - 0.06, p.z + (r() - 0.5) * 0.3, 0.8 + r(), 0.25 + r() * 0.35, 0.8 + r(), (r() - 0.5) * 0.7, (r() - 0.5) * 0.7]);
      if (i % 11 === 0) kvety.push([p.x + 0.3, y + 0.22, p.z, 0.07, 0.04, 0.07, 0, 0]);
      if (i % 37 === 0) kriky.push([p.x, y + 0.15, p.z, 0.5 + r() * 0.6, 0.4 + r() * 0.3, 0.5 + r() * 0.6, 0, r() * 3]);
    }
    for (const [geo, pole, odtiene] of [[steblo, trsy, [0x5fae34, 0x78bc3c, 0x4a9a2c]], [new T.IcosahedronGeometry(1, 0), kvety, [0xffffff, 0xffd84a, 0xf2749c]],
      [new T.IcosahedronGeometry(1, 1), kriky, [0x3f8a28, 0x55a232, 0x2f7022]]]) {
      const im = new T.InstancedMesh(geo, P.mat(0xffffff, { flatShading: true, envMapIntensity: 0.3 }), pole.length);
      pole.forEach(([x, y, z, sx, sy, sz, rx, rz], i) => {
        o.position.set(x, y, z); o.rotation.set(rx, i, rz); o.scale.set(sx, sy, sz); o.updateMatrix();
        im.setMatrixAt(i, o.matrix); im.setColorAt(i, new T.Color(odtiene[(i * 7 >> 2) % odtiene.length]));
      });
      im.castShadow = false;
      objekty.push(im);
    }
  }

  // --- 2) celna stena utesu s obluk. vchodom ---
  const W0 = sirka(0), H0 = vyskaStropu(0), D0 = podlaha(0);
  const stlpce = [];
  for (let u = U0; u < -W0 - 0.05; u += 0.85) stlpce.push(u);
  for (let a = Math.PI; a >= -0.001; a -= Math.PI / 16) stlpce.push(Math.cos(a) * W0);
  for (let u = W0 + 0.85; u <= U1; u += 0.85) stlpce.push(u);
  const RADY = 30, celo = [];
  for (let i = 0; i <= RADY; i++) celo.push([]);
  for (const u of stlpce) {
    const q = Math.abs(u) / W0, spodok = q < 1 ? D0 + H0 * Math.sqrt(1 - q * q) : D0 - 0.9;
    const vrch = Math.max(vyskaSkrupiny(u, 0, h0), spodok + 0.3);
      for (let i = 0; i <= RADY; i++) {
      // rady su vo vodorovnych vyskach pre vsetky stlpce (pod oblukom sa zlozia na jeho okraj) -> bez svov
      const y = Math.max(spodok, lerp(D0 - 0.9, vrch, i / RADY)), t = (y - spodok) / (vrch - spodok);
      // vystupky smerom k lagune; pri obluku a hore 0, aby sedelo na tunel a strechu; na bokoch zapadne dozadu
      // vodorovne skalne rimsy (pasy) + v kazdom pase inak vystupene bloky
      const pas = y / 1.9 + noise(u * 0.11, y * 0.15, 3) * 1.3, c0 = Math.floor(pas);
      const blok = noise(u * 0.38 + c0 * 7.3, c0 * 3.1, 11);
      const von = Math.max(0, noise(u * 0.22, y * 0.3, 7) + 0.3) * 1.5 + noise(u * 0.8, y * 0.9, 9) * 0.4
        + (blok + 0.35) * 1.1 + (pas - c0) * 0.45;
      // eliptická vzdialenost od obluka (spojita, bez svov): pri obluku je stena rovna, aby sedela na tunel
      const odObluka = Math.hypot(u / W0, Math.max(0, y - D0) / H0);
      const sila = smooth(1, 1.9, odObluka) * smooth(1, 0.8, t);
      const dozadu = smooth(13, 20, Math.abs(u)) * 3.4;
      celo[i].push(new T.Vector3(JX + u, y, JZ - Math.max(0, von) * sila + dozadu));
    }
  }
  siet(celo, p => farbaVonku(p, 0), mat);

  // --- zelen na hrane utesu: kriky a visiace liany (cez den utes vyzera privetivo) ---
  {
    const trs = new T.IcosahedronGeometry(1, 1), ker = [], liana = [], list = [], o = new T.Object3D(), r = P.rng(88);
    for (let i = 0; i < 90; i++) {
      const u = (r() - 0.5) * 38, v = 0.6 + r() * r() * 16, s = 0.35 + r() * 0.75;
      if (rezerva(u, v) < 2) continue;
      ker.push([JX + u, vyskaSkrupiny(u, v, h0) + s * 0.25, JZ + v, s, s * 0.65, s]);
    }
    for (let i = 0; i < 26; i++) {
      const u = (r() - 0.5) * 34;
      if (Math.abs(u) < 1.2) continue;
      const vrch = vyskaSkrupiny(u, 0.3, h0), dl = 1.5 + r() * 5;
      let x = JX + u, z = JZ - 1.1 - r() * 0.7;
      for (let y = vrch; y > Math.max(1.3, vrch - dl); y -= 0.3) {
        x += (r() - 0.5) * 0.14;
        const zz = z - Math.min(1.2, (vrch - y) * 0.5);
        liana.push([x, y, zz, 0.035, 0.34, 0.035]);
        for (let k = 0; k < 2; k++) list.push([x + (r() - 0.5) * 0.35, y + (r() - 0.5) * 0.2, zz - r() * 0.12, 0.17, 0.05, 0.1, r() * 3, (r() - 0.5)]);
      }
      ker.push([JX + u, vrch + 0.1, JZ + 0.2, 0.9, 0.5, 0.9]);
    }
    for (const [geo, farbaK, pole, odtiene] of [[trs, 0xffffff, ker, [0x3f8a28, 0x55a232, 0x2f7022]],
      [new T.CylinderGeometry(1, 1, 1, 4), 0xffffff, liana, [0x3a5a22]], [trs, 0xffffff, list, [0x4f9a2e, 0x68b23a, 0x3c7c26]]]) {
      const im = new T.InstancedMesh(geo, P.mat(farbaK, { flatShading: true, envMapIntensity: 0.2 }), pole.length);
      pole.forEach(([x, y, z, sx, sy, sz, ry = r() * 3, rz = 0], i) => {
        o.position.set(x, y, z); o.rotation.set(0, ry, rz); o.scale.set(sx, sy, sz); o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
        im.setColorAt(i, new T.Color(odtiene[i % odtiene.length]));
      });
      objekty.push(im);
    }
  }

  // --- 3) tunel + komora (vnutro) ---
  const KRUHY = 66, DIELY = 22, tunel = [];
  for (let i = 0; i <= KRUHY; i++) {
    const v = i / KRUHY * DLZKA, rad = [];
    for (let j = 0; j <= DIELY; j++) {
      const p = new T.Vector3(...povrch(v, j / DIELY * Math.PI));
      if (j === 0 || j === DIELY) p.y = podlaha(v) - 0.7;
      rad.push(p);
    }
    tunel.push(rad);
  }
  const farbaDnu = p => {
    const n = noise(p.x * 0.35, p.y * 1.1, p.z * 0.35);
    c.copy(DNU).lerp(DNU2, smooth(-0.2, 0.4, n));
    c.lerp(MOKRA, smooth(0.3, -0.9, p.y));
    return c.offsetHSL(0, 0, noise(p.x * 1.4, p.y * 1.4, p.z * 1.4) * 0.04);
  };
  siet(tunel, farbaDnu, matVnutri);
  // zadna stena: prstence sa stiahnu do stredu
  const posledny = tunel[KRUHY], fk = podlaha(DLZKA), stred = new T.Vector3(JX + os(DLZKA), fk + 1.1, JZ + DLZKA + 1.1);
  siet([0, 0.35, 0.7, 1].map(t => posledny.map((p, j) => {
    const q = p.clone().lerp(stred, t);
    q.z += noise(j * 0.7, t * 3, 21) * 0.5 * Math.sin(t * Math.PI);
    return q;
  })), farbaDnu, matVnutri);

  // --- podlaha jaskyne (nad terenom, tmava mokra skala) ---
  const dlazka = [];
  for (let i = 0; i <= 80; i++) {
    const v = i / 80 * DLZKA, w = sirka(v) * 1.25, rad = [];
    for (let j = 0; j <= 12; j++) {
      const x = JX + os(v) + (j / 6 - 1) * w, z = JZ + v;
      rad.push(new T.Vector3(x, podlaha(v) + 0.035 + Math.max(0, noise(x * 0.9, 0, z * 0.9)) * 0.05, z));
    }
    dlazka.push(rad);
  }
  siet(dlazka, p => {
    c.copy(C(0x57504a)).lerp(C(0x8a7c64), smooth(0, 0.35, noise(p.x * 0.5, 4, p.z * 0.5)));
    return c.offsetHSL(0, 0, noise(p.x * 2.1, 1, p.z * 2.1) * 0.05);
  }, matVnutri);

  // --- balvany pri vchode a na bokoch steny (zakryju spoje) ---
  const balvan = new T.DodecahedronGeometry(1, 1);
  {
    const p = balvan.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 1 + noise(p.getX(i) * 1.7, p.getY(i) * 1.7, p.getZ(i) * 1.7) * 0.35;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
    }
    balvan.computeVertexNormals();
  }
  const kusy = [
    // u, v, y, sx, sy, sz, rot
    [-3.7, -1.1, -1.5, 1.5, 1.5, 1.3, 1.0], [4.0, -0.9, -1.6, 1.3, 1.9, 1.2, 2.2], [-6.8, -2.2, -1.9, 2.1, 1.5, 1.9, 0.3],
    [7.6, -1.8, -1.8, 2.4, 1.8, 1.8, 4.0], [-11.5, -1.0, -0.8, 2.6, 2.9, 2.0, 2.7], [12.4, -0.6, -0.6, 2.9, 2.4, 2.2, 5.1],
    [-15.5, 1.0, 0.2, 3.2, 3.6, 2.6, 1.9], [16.4, 1.2, 0.5, 3.4, 3.8, 2.8, 0.8], [-5.2, -4.6, -2.3, 0.9, 0.7, 0.8, 3.3],
    [6.1, -5.2, -2.2, 1.1, 0.8, 0.9, 1.4], [-19.5, 3.6, 1.5, 3.8, 4.2, 3.4, 2.0], [20.2, 3.8, 1.8, 3.6, 4.6, 3.2, 3.7],
  ];
  const im = new T.InstancedMesh(balvan, P.mat(0x8c8474, { flatShading: true, envMapIntensity: 0.5 }), kusy.length), o3 = new T.Object3D();
  kusy.forEach(([u, v, y, sx, sy, sz, ry], i) => {
    o3.position.set(JX + u, y, JZ + v); o3.rotation.set(ry * 0.3, ry, ry * 0.2); o3.scale.set(sx, sy, sz); o3.updateMatrix();
    im.setMatrixAt(i, o3.matrix);
    im.setColorAt(i, new T.Color(y < -1 ? 0x9a9a8c : 0xffffff));
  });
  objekty.push(im);
  return objekty;
}
