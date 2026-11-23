// Zahrada strazcov (pasmo 1): velky ostrov s horou na severe, utes s vodopadom do jazierka, potok na juh do malej zatoky,
// terasovite juzne svahy so zarastenou ovocnou zahradou strazcov (mango, banany, ananas - len tu), plaz na JV.
import { noise, fbm, ridge, smooth, clamp, hmin, hmax, dist, distUsecka, elipsa, profil, rng } from './pomoc.js';

const SEED = 7150, TAU = Math.PI * 2;
const HP = 13;                         // hladina jazierka pod vodopadom (m)
const JAZ = [2, -28];                  // stred jazierka
const VRCH = [-6, -70];                // vrchol hory
const UTES_Z = -40;                    // ciara utesu pri x = 2 (na bokoch sa ohyba na sever)
const TS = 2.4;                        // vyska jedneho stupna terasy
const CHATA = [46, 34];                // rozpadnuta chatrc zahradnika
const ZATOKA = [14, 140];              // ustie potoka = mala zatoka
// stred koryta potoka: jazierko -> zatoka
const POT = [[2, -28], [-5, 2], [7, 36], [-3, 70], [9, 104], [16, 150]];
// kamenny chodnik / schody od plaze hore k jazierku (vychodny breh potoka)
const CHOD = [[34, 126], [27, 96], [24, 62], [22, 28], [17, -4], [11, -19]];

// dlzky usekov potoka (na vypocet polohy pozdlz koryta 0..1)
const DL = [], KUM = [0];
for (let i = 0; i < POT.length - 1; i++) { DL.push(dist(POT[i][0], POT[i][1], POT[i + 1][0], POT[i + 1][1])); KUM.push(KUM[i] + DL[i]); }
const SPOLU = KUM[KUM.length - 1];
let _s = 0;                            // poloha pozdlz potoka (0 = jazierko, 1 = more) z posledneho volania potok()
function potok(x, z) {
  let best = 1e9;
  for (let i = 0; i < POT.length - 1; i++) {
    const [ax, az] = POT[i], [bx, bz] = POT[i + 1], dx = bx - ax, dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (DL[i] * DL[i]), 0, 1);
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) { best = d; _s = (KUM[i] + t * DL[i]) / SPOLU; }
  }
  return best;
}
function chodnik(x, z) {
  let best = 1e9;
  for (let i = 0; i < CHOD.length - 1; i++) best = Math.min(best, distUsecka(x, z, CHOD[i][0], CHOD[i][1], CHOD[i + 1][0], CHOD[i + 1][1]));
  return best;
}

let _pred = 0, _wT = 0, hChaty = null;  // vyska pred terasovanim a vaha terasy (pre muriky v pamiatkach)
function teren(x, z, plochy = true) {
  // 1) zakladny tvar: sikma elipsa + sum pobrezia
  const e = elipsa(x, z - 8, 168, 142, 0.25);
  let t = 1 - e + 0.2 * fbm(x * 0.011, z * 0.011, SEED, 3);
  let da = Math.atan2(z, x) - 0.75; da = Math.abs(da - TAU * Math.round(da / TAU));
  const pb = 1 - smooth(0.55, 1.15, da);                 // JV: pozvolna siroka plaz
  t -= pb * 0.55 * Math.min(t, 0.08);
  let h = t >= 0 ? 19 * Math.pow(t, 1.1) : profil(t, 19);
  if (h > 0) h += noise(x * 0.07, z * 0.07, SEED + 9) * 0.7 * smooth(0, 3, h);

  // 2) hora na severe; juzna stena je odrezana do utesu, na pobrezi hora konci strmo do mora
  const dv = dist(x, z, VRCH[0], VRCH[1]);
  if (dv < 100) {
    let m = 62 * Math.pow(1 - dv / 100, 1.15) * (0.82 + 0.18 * ridge(x * 0.035, z * 0.035, SEED + 5));
    const zc = UTES_Z - 0.006 * (x - 2) * (x - 2);
    const c = Math.max(smooth(zc + 4, zc - 1, z), smooth(26, 52, Math.abs(x - 2)));
    if (z < zc + 3) m -= 2.5 * (1 - smooth(1.5, 5, distUsecka(x, z, -3, -64, 2, UTES_Z + 1)));   // zarez potocika nad vodopadom
    const cm = smooth(-0.14, 0.04, t);
    m = m * c * cm + (c * cm - 1) * 30;
    h = hmax(h, m, 5);
  }

  // 3) terasy na juznych svahoch (stupne s plynulym prechodom)
  _pred = h;
  const dP = potok(x, z), s = _s;
  const wT = smooth(-24, -10, z) * smooth(2.2, 4.2, h) * (1 - smooth(19, 23, h)) * smooth(8, 16, dP) * (1 - smooth(75, 100, Math.abs(x - 12)));
  _wT = wT;
  if (wT > 0) { const q = h / TS, fl = Math.floor(q); h += (TS * (fl + smooth(0.8, 1, q - fl)) - h) * wT; }

  // 4) rovne miesto pod chatrcou
  if (plochy) {
    const dc = dist(x, z, CHATA[0], CHATA[1]);
    if (dc < 10) { if (hChaty === null) hChaty = teren(CHATA[0], CHATA[1], false); h += (hChaty - h) * (1 - smooth(5.5, 10, dc)); }
  }

  // 5) jazierko pod utesom: rovna lavica okolo + misa
  const dj = dist(x, z, JAZ[0], JAZ[1]);
  if (dj < 24) {
    h += (HP + 1.2 - h) * (1 - smooth(11, 24, dj)) * smooth(-40, -34, z);
    h = hmin(h, HP - 1.9 + Math.max(0, dj - 4.5) * 0.9 + Math.max(0, dj - 8) * 8, 1.5);
  }

  // 6) koryto potoka (dno stale klesa od jazierka k moru) a zatoka pri usti
  if (z > JAZ[1] - 2) {
    const dno = (HP - 0.9) * Math.pow(1 - s, 0.6) - 1.8 * s;
    h = hmin(h, dno + Math.max(0, dP - 1.8) * 0.5, 2);
  }
  const dz = dist(x, z, ZATOKA[0], ZATOKA[1]);
  if (dz < 50) h = hmin(h, -1.8 + Math.max(0, dz - 11) * 0.28, 3);
  return h;
}

// rovnomerne body pozdlz lomenej ciary (krok v metroch)
function prevzorkuj(ciara, krok) {
  const out = [];
  for (let i = 0; i < ciara.length - 1; i++) {
    const [ax, az] = ciara[i], [bx, bz] = ciara[i + 1], n = Math.max(1, Math.round(dist(ax, az, bx, bz) / krok));
    for (let k = 0; k < n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  out.push(ciara[ciara.length - 1]);
  return out;
}

// flasa: prvy bod na juznej plazi (smerom od mora) s vyskou 0.5-1.1 m
function najdiPlaz(x, zOd) {
  for (let z = zOd; z > zOd - 80; z -= 0.5) { const h = teren(x, z); if (h > 0.6 && h < 1.0) return [x, z]; }
  return [x, zOd - 20];
}
const FLASA = najdiPlaz(52, 160);

export default {
  meno: 'Záhrada strážcov', podnadpis: 'Ovocné terasy', biom: 'ovocny', R: 150, ext: 300, H: 45, seed: SEED,
  vyska: (x, z) => teren(x, z),
  vegetacia: {
    zony: {
      terasy: { mango: 0.55, banan: 0.5, ananas: 0.7, bobule: 0.5, kvet: 0.9, ibistek: 0.35, hibiskus: 0.35, ker: 0.2, trava: 12, monstera: 0.1, strom: 0.04 },
      dolina: { banan: 0.6, taro: 0.7, papradie: 1.3, monstera: 0.6, svetlonos: 0.15, trava: 6, palma: 0.15, kvet: 0.3, spiral: 0.2 },
      les: { strom: 0.8, papradie: 1.1, huba: 0.3, spiral: 0.3, ker: 0.3, trava: 6, balvan: 0.12, monstera: 0.2, mango: 0.08 },
      vrchol: { balvan: 0.5, trava: 14, kamienky: 1.2, aloe: 0.15, ker: 0.15 },
      plaz: { palma: 0.6, trava: 6, kamienky: 0.4, ker: 0.1, ananas: 0.12 },
      sad: { mango: 0.35, banan: 0.3, palma: 0.3, strom: 0.25, bobule: 0.4, ker: 0.4, trava: 14, kvet: 0.5, balvan: 0.08, hibiskus: 0.2 },
    },
    zona(x, z, h) {
      if (h < 0.25) return null;
      if (dist(x, z, JAZ[0], JAZ[1]) < 9.5 && h < HP + 0.6) return null;   // jazierko
      if (chodnik(x, z) < 1.4 || dist(x, z, CHATA[0], CHATA[1]) < 6) return null;
      if (h > 44) return 'vrchol';
      if (potok(x, z) < 13 && z > JAZ[1]) return h < 2.4 && z > 120 ? 'plaz' : 'dolina';
      if (z < -34 || h > 23) return 'les';
      if (h < 2.6) return 'plaz';
      if (z > -24 && Math.abs(x - 12) < 95) return 'terasy';
      return 'sad';
    },
  },
  predmety: { nahodne: ['palica', 'kamen', 'palica', 'kokos'], pocet: 110 },
  flase: [FLASA],
  pamiatkyNahlad: [[JAZ[0], JAZ[1], 9, 'jazierko + vodopád'], [CHATA[0], CHATA[1], 5, 'chatrč'], [ZATOKA[0], ZATOKA[1], 11, 'zátoka']],

  pamiatky(P) {
    const T = P.THREE, obj = [], kol = [], r = rng(SEED + 3), d = new T.Object3D(), col = new T.Color();
    const kamenM = P.mat(0xffffff, { flatShading: true });
    const drevo = P.mat(0x7a5434, { flatShading: true }), drevoT = P.mat(0x5e3f26, { flatShading: true });
    const instancie = (geo, mat, zoznam, farby) => {           // zoznam: [x, y, z, rotY, sx, sy, sz, rotX, rotZ]
      const im = new T.InstancedMesh(geo, mat, zoznam.length);
      zoznam.forEach((v, i) => {
        d.position.set(v[0], v[1], v[2]); d.rotation.set(v[7] || 0, v[3], v[8] || 0, 'YXZ'); d.scale.set(v[4], v[5], v[6]);
        d.updateMatrix(); im.setMatrixAt(i, d.matrix);
        im.setColorAt(i, col.setHex(farby[Math.floor(r() * farby.length)]).multiplyScalar(0.85 + r() * 0.3));
      });
      im.castShadow = im.receiveShadow = true;
      obj.push(im); return im;
    };

    // --- oporne muriky teras: na strmom useku kazdeho stupna, s medzerami (rozpadnute) ---
    const steny = [], obsad = new Set();
    for (let z = -20; z < 135; z += 1.2) for (let x = -85; x < 110; x += 1.2) {
      teren(x, z); if (_wT < 0.85) continue;
      const q = _pred / TS, fl = Math.floor(q), f = q - fl;
      if (f < 0.86 || f > 0.93) continue;
      const k = Math.floor(x / 2.3) + ',' + Math.floor(z / 2.3);
      if (obsad.has(k)) continue;
      if (noise(x * 0.09, z * 0.09, SEED + 40) < -0.12) continue;            // rozpadnute useky
      if (chodnik(x, z) < 3 || dist(x, z, CHATA[0], CHATA[1]) < 9 || potok(x, z) < 11) continue;
      obsad.add(k);
      teren(x + 0.5, z); const gx = _pred; teren(x - 0.5, z); const gx2 = _pred;
      teren(x, z + 0.5); const gz = _pred; teren(x, z - 0.5); const gz2 = _pred;
      const ax = gx - gx2, az = gz - gz2, l = Math.hypot(ax, az) || 1;
      const px = x - ax / l * 0.5, pz = z - az / l * 0.5;
      const dol = TS * fl;
      steny.push([px, dol + TS * 0.5 - 0.05, pz, Math.atan2(-ax, -az) + (r() - 0.5) * 0.15, 2.3 + r() * 0.4, TS + 0.5, 0.75, (r() - 0.5) * 0.1, (r() - 0.5) * 0.08]);
      kol.push([+px.toFixed(1), +pz.toFixed(1), 1.0]);
    }
    instancie(new T.BoxGeometry(1, 1, 1), kamenM, steny, [0x9b968a, 0x8a8478, 0xa8a090, 0x7f8a74]);

    // --- kamenny chodnik / schody od plaze k jazierku ---
    const dosky = [];
    for (const [x, z] of prevzorkuj(CHOD, 1.25)) {
      const ox = (r() - 0.5) * 0.4, oz = (r() - 0.5) * 0.4;
      dosky.push([x + ox, P.vyska(x + ox, z + oz) + 0.06, z + oz, r() * 0.6 - 0.3 + 0.2, 1.3 + r() * 0.5, 0.3, 0.8 + r() * 0.3]);
    }
    instancie(new T.BoxGeometry(1, 1, 1), kamenM, dosky, [0xb5ad9c, 0xa29a88, 0xc2b9a5, 0x8f9a82]);

    // --- rozpadnuta chatrc zahradnika ---
    const ch = new T.Group(), hy = P.vyska(CHATA[0], CHATA[1]);
    ch.position.set(CHATA[0], hy, CHATA[1]); ch.rotation.y = 0.35;
    const box = (w, h, dd, x, y, z, m, rx = 0, ry = 0, rz = 0) => { const b = new T.Mesh(new T.BoxGeometry(w, h, dd), m); b.position.set(x, y, z); b.rotation.set(rx, ry, rz); ch.add(b); return b; };
    box(4.6, 0.14, 4.0, 0, 0.07, 0, drevo);                                    // podlaha
    const stlp = new T.CylinderGeometry(0.12, 0.14, 1, 6);
    for (const [x, z, v] of [[-2.2, -1.9, 2.6], [2.2, -1.9, 2.5], [-2.2, 1.9, 2.3], [2.2, 1.9, 1.2]]) {
      const s = new T.Mesh(stlp, drevoT); s.scale.y = v; s.position.set(x, v / 2, z); ch.add(s);
    }
    box(4.4, 2.0, 0.12, 0, 1.0, -1.95, drevo);                                 // zadna stena
    box(0.12, 1.3, 2.4, -2.2, 0.65, -0.7, drevo);                              // bocna stena (polovica)
    box(0.12, 0.7, 1.2, -2.2, 0.35, 1.2, drevo, 0, 0, 0.12);
    box(5.0, 0.22, 3.4, 0.2, 1.05, -0.4, P.mat(0xc9a25a, { flatShading: true }), -0.48, 0, 0.1);   // zrutena slamena strecha
    box(0.16, 0.16, 5.2, 1.6, 0.35, 0.9, drevoT, 0, 0.9, 0.2);                 // spadnuty hrebenovy tram
    box(1.3, 0.08, 0.7, -1.2, 0.75, -1.2, drevo);                             // policka / stol
    for (const [x, z] of [[-1.6, -1.25], [-0.9, -1.2]]) { const n = new T.Mesh(new T.CylinderGeometry(0.12, 0.16, 0.32, 7), P.mat(0xb8643a, { flatShading: true })); n.position.set(x, 0.95, z); ch.add(n); }
    obj.push(ch);
    const ca = Math.cos(0.35), sa = Math.sin(0.35), sv = (x, z) => [+(CHATA[0] + x * ca + z * sa).toFixed(1), +(CHATA[1] - x * sa + z * ca).toFixed(1)];
    for (const [x, z, rr] of [[-1.5, -1.95, 0.8], [0, -1.95, 0.8], [1.5, -1.95, 0.8], [-2.2, -0.6, 0.7], [2.2, 1.9, 0.3], [-2.2, 1.9, 0.3]]) kol.push([...sv(x, z), rr]);

    // --- kamenne vazy / nadoby ---
    const vaza = new T.LatheGeometry([[0, 0], [0.24, 0], [0.34, 0.2], [0.38, 0.45], [0.28, 0.7], [0.17, 0.85], [0.24, 1.0], [0.2, 1.03]].map(([a, b]) => new T.Vector2(a, b)), 9);
    const vazy = [];
    for (const [x, z, lezi] of [[CHATA[0] + 3.5, CHATA[1] + 2.5, 0], [CHATA[0] + 4.4, CHATA[1] + 1.2, 1], [13.5, -16, 0], [8.5, -17.5, 0], [25, 45, 0], [26.5, 80, 1]]) {
      const y = P.vyska(x, z);
      vazy.push(lezi ? [x, y + 0.32, z, r() * 6, 1, 1, 1, 0, 1.45] : [x, y - 0.05, z, r() * 6, 1, 1, 1]);
      if (!lezi) kol.push([x, z, 0.35]);
    }
    instancie(vaza, P.mat(0xffffff, { flatShading: true }), vazy, [0xb07a52, 0x9c9488, 0xc08a5c]);

    // --- jazierko: hladina + kamene okolo ---
    const voda = P.mat(0x3fa7c9, { transparent: true, opacity: 0.8, roughness: 0.12, metalness: 0.1, emissive: 0x1a6a8a, emissiveIntensity: 0.3 });
    const hl = new T.Mesh(new T.CircleGeometry(10.5, 28).rotateX(-Math.PI / 2), voda);
    hl.position.set(JAZ[0], HP + 0.15, JAZ[1]); hl.castShadow = false; obj.push(hl);
    const kamene = [];
    for (let i = 0; i < 12; i++) {
      const a = r() * TAU; if (Math.abs(a - Math.PI / 2) < 0.5) continue;      // juh = odtok
      const rr = 8.2 + r() * 1.5, x = JAZ[0] + Math.cos(a) * rr, z = JAZ[1] + Math.sin(a) * rr, s = 0.5 + r() * 0.7;
      kamene.push([x, P.vyska(x, z) + s * 0.2, z, r() * 6, s * 1.3, s, s * 1.1, r(), r()]);
    }
    instancie(new T.IcosahedronGeometry(1, 0), kamenM, kamene, [0x8f8a80, 0x7c8a70, 0x9a948a]);

    // --- vodopad: od hrany utesu (zarez) po hladinu jazierka ---
    let zPata = JAZ[1] - 4, zVrch = null;
    for (let z = JAZ[1] - 4; z > -70; z -= 0.5) {
      const a = P.vyska(2, z), b = P.vyska(2, z - 0.5);
      if (zVrch === null && b - a > 0.8 && a < HP + 3) zPata = z;
      if (b - a > 0.8) zVrch = z - 0.5; else if (zVrch !== null) break;
    }
    zVrch ??= UTES_Z;
    const hVrch = P.vyska(2, zVrch) + 0.2, hPata = HP + 0.15;
    const padM = P.mat(0xd8f2ff, { transparent: true, opacity: 0.72, emissive: 0x9ad8ff, emissiveIntensity: 0.45, side: T.DoubleSide, roughness: 0.2 });
    const penaM = P.mat(0xffffff, { transparent: true, opacity: 0.6, emissive: 0xffffff, emissiveIntensity: 0.35, side: T.DoubleSide });
    const pas = (x, w, m, dz) => {
      const z1 = zVrch + dz, z2 = zPata + 1.2 + dz, L = Math.hypot(hVrch - hPata, z2 - z1);
      const p = new T.Mesh(new T.PlaneGeometry(w, L, 1, 6), m);
      p.position.set(x, (hVrch + hPata) / 2, (z1 + z2) / 2); p.rotation.x = Math.atan2(z1 - z2, hVrch - hPata);
      p.castShadow = false; obj.push(p);
    };
    pas(2, 3.0, padM, 0.5); pas(1.0, 0.9, penaM, 0.8); pas(3.2, 0.7, penaM, 0.7);
    const kruh = new T.Mesh(new T.RingGeometry(0.8, 3.2, 20).rotateX(-Math.PI / 2), penaM);
    kruh.position.set(2, HP + 0.2, zPata + 1.8); kruh.castShadow = false; obj.push(kruh);
    const pena = [];
    for (let i = 0; i < 7; i++) pena.push([2 + (r() - 0.5) * 3, HP + 0.3 + r() * 0.5, zPata + 1.5 + r() * 1.5, r() * 6, 0.5 + r() * 0.5, 0.4 + r() * 0.4, 0.5 + r() * 0.5]);
    const pi = instancie(new T.IcosahedronGeometry(1, 0), penaM, pena, [0xffffff]); pi.castShadow = false;

    // --- tecuca voda: potocik nad vodopadom a potok z jazierka do zatoky (pas nad dnom koryta) ---
    const stuha = (body, sirka, dy) => {
      const poz = [], ind = []; let yPred = 1e9;
      body.forEach(([x, z], i) => {
        const [ax, az] = body[Math.max(0, i - 1)], [bx, bz] = body[Math.min(body.length - 1, i + 1)];
        const l = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / l * sirka / 2, nz = (bx - ax) / l * sirka / 2;
        const y = yPred = Math.min(yPred, P.vyska(x, z) + dy);
        poz.push(x + nx, y, z + nz, x - nx, y, z - nz);
        if (i) ind.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2);
      });
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(poz, 3)); g.setIndex(ind); g.computeVertexNormals();
      const m = new T.Mesh(g, voda); m.castShadow = false; obj.push(m);
    };
    stuha(prevzorkuj([[-3, -64], [2, zVrch]], 1.5), 1.6, 0.3);
    const tok = prevzorkuj(POT, 2).filter(([x, z]) => dist(x, z, JAZ[0], JAZ[1]) > 6.5);
    const koniec = tok.findIndex(([x, z]) => P.vyska(x, z) < -0.4);
    stuha(koniec > 0 ? tok.slice(0, koniec + 1) : tok, 2.8, 0.3);

    return { objekty: obj, kolizie: kol };
  },
};
