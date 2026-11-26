// Boj hraca: definicie utokov podla zbrane (poziciie klbov, casovanie, dosah), zasah nepriatelov,
// "satisfying" efekty (hitstop, iskry, plavajuce cisla, stopa mece). Animaciu klbov robi hrac.js podla UTOKY.
import * as THREE from 'three';
import { zoznamNepriatelov, udriNepriatela } from './nepriatelia.js';
import { udriBledych } from './bledi.js';
import { zvuky } from './zvuk.js';
import { poskodenieNepriatela } from './nastroje.js';
import { vytvorCastice } from './castice.js';
import { ZIARE } from './obsah/modely_zbrani.js';

export const stav = { hitstop: 0 };                 // sekundy, kym je hra spomalena (main.js ju spomali)

// Poza = cielove uhly klbov: rP/rPz = prave rameno (dopredu / do strany), lP = pravy laket, zx = zapastie (otoci zbran v dlani,
// kladne = hrot viac dopredu), rL/rLz/lL = lava ruka, chx/chy = chrbat (sklon / otocenie), tx = sklon tela, ty = vyska tela
// (0.95 = stoji, mensie = drep), sL/sP/kL/kP = boky a kolena.
//
// Utok: dlzka (s), kf = [[cas, poza], ...] klucove pozy (klby sa k nim rychlo pritahuju), hity = [{ t, mult, dosah, kuzel,
// vsetkych, knock, stun, aoe (polomer okolo), stred (m pred hracom), efekt }], dash = [od, do, m/s] (vypad), skok = [cas, vy],
// pad = [cas, vy] (prudky pad zo vzduchu), spin = [od, do, otacky] (otocka celeho tela), flip = [od, do, otacky] (salto),
// trail = [od, do] (stopa za zbranou), efekt = efekt pri mahnuti (oblúk, stopa vypadu).
const NAHOR = { rP: 2.9, rPz: 0.3, lP: 1.2, chy: 0.55, chx: 0.05 };          // napriahnutie nad hlavu
const ZHORA = { rP: -0.3, rPz: 0.1, lP: 0.1, chy: -0.35, chx: -0.35 };      // zvisly uder
const VYPAD = { sL: 0.75, kL: -0.55, sP: -0.55, kP: -0.15, ty: 0.86 };     // lava noha vpredu, nizko
const DREP = { sL: 0.95, kL: -1.35, sP: -0.35, kP: -1.0, ty: 0.7 };        // hlboky drep (nabijanie, dopad)
const ROZK = { sL: 0.35, sP: -0.35, kL: -0.4, kP: -0.4, ty: 0.88 };        // siroky postoj
const LAVA2 = { rL: 1.15, rLz: 0.45, lL: 1.1 };                             // lava ruka drzi zbran obojrucne
const _ = (...p) => Object.assign({}, ...p);

function A(o) {
  const d = { dlzka: 0.5, mult: 1, knock: 1, dosah: 2, kuzel: 0.64, vsetkych: false, lunge: 0, ...o };
  if (!d.kf) d.kf = [[0, d.wind], [d.hit - 0.07, d.strike]];
  if (!d.hity) d.hity = [{ t: d.hit }];
  d.hity = d.hity.map(h => ({ mult: d.mult, knock: d.knock, dosah: d.dosah, kuzel: d.kuzel, vsetkych: d.vsetkych, stun: d.stun || 0, stred: d.stred || 0, ...h }));
  if (d.trail === true) d.trail = [d.hity[0].t - 0.08, d.hity[d.hity.length - 1].t + 0.12];
  if (d.lunge && !d.dash) d.dash = [d.hity[0].t - 0.07, d.hity[0].t + 0.1, d.lunge, true];
  return d;
}
const U = (dlzka, hit, wind, strike, extra = {}) => A({ dlzka, hit, wind, strike, ...extra });
const SILNY = (extra) => U(0.6, 0.12, { ...NAHOR, chx: 0.2, tx: 0.1 }, { ...ZHORA, tx: -0.2 }, { mult: 2, knock: 2.4, lunge: 3, ...extra });
// bodnutie (ostep, harpuna): stiahnutie dozadu a vystrelenie dopredu; zx otoci hrot dopredu
const TAH = (zx, ch = -0.5) => _(LAVA2, { rP: 0.55, rPz: 0.3, lP: 1.4, chy: ch, chx: 0.05, zx, sL: 0.4, kL: -0.35, sP: -0.3, ty: 0.9 });
const BOD = (zx, ch = 0.35) => _(VYPAD, { rP: 1.5, rPz: 0.02, lP: 0.02, chy: ch, chx: -0.22, tx: -0.1, zx, rL: 0.9, rLz: 0.2, lL: 0.4 });

// ---------- ZERAVY MEC: rychle anime kombo (sikmy sek, sek nahor, ohniva otocka, bleskovy vypad), nabity = ohnivy skok s vybuchom ----------
// sek mecom: ruka vpredu (rP ~1.3), vodorovny pohyb robi otocenie trupu (chy), zx natoci cepel von pozdlz ruky
const M_PRAVO = { rP: 1.3, rPz: 0.3, lP: 0.3, chy: -1.15, zx: 1.9, rL: 0.3, rLz: -0.4 };              // napriahnutie vpravo
const M_LAVO = { rP: 1.3, rPz: 0.3, lP: 0.05, chy: 1.15, chx: -0.15, zx: 1.9, rL: -0.3, rLz: -0.9 };  // dosek vlavo
const M_HORE = { rP: 2.7, rPz: 0.55, lP: 0.4, chy: -0.8, chx: 0.1, zx: 0.8, rL: 0.4, rLz: -0.5 };     // vpravo hore
const M_DOLE = { rP: 0.55, rPz: 0.1, lP: 0.05, chy: 1.0, chx: -0.35, tx: -0.1, zx: 1.5, rL: -0.3, rLz: -0.9 };   // vlavo dole
const ZER_NAB = _(DREP, { rP: 0.35, rPz: 0.1, lP: 1.0, chy: 1.1, chx: -0.4, zx: 1.7, rL: 0.9, rLz: 0.3, lL: 1.4 });   // ruka pri lavom boku (ako pri tasení)
const ZER_IAI = _(VYPAD, { sL: 1.05, sP: -1.0, rP: 1.35, rPz: 0.35, lP: 0, chy: -1.25, chx: -0.25, ty: 0.78, zx: 2.0, rL: 0.3, rLz: -1.0 });
const zeravy = {
  nab: ZER_NAB,
  kombo: [
    A({ dlzka: 0.46, kf: [[0, M_HORE], [0.14, _(VYPAD, M_DOLE)]], hity: [{ t: 0.19 }], dosah: 3, vsetkych: true, lunge: 4, trail: true, efekt: 'oblukSikmo' }),
    A({ dlzka: 0.44, kf: [[0, _(VYPAD, M_DOLE)], [0.12, _(M_HORE, { chy: -0.9, chx: 0.2, ty: 0.98 })]], hity: [{ t: 0.17 }], dosah: 3, vsetkych: true, lunge: 3, trail: true, efekt: 'oblukNahor' }),
    A({ dlzka: 0.62, kf: [[0, M_PRAVO], [0.1, _(ROZK, { rP: 1.4, rPz: 0.45, lP: 0.02, chy: 0.2, chx: -0.15, ty: 0.82, zx: 2.0, rL: 1.3, rLz: -1.2, lL: 0.1 })]],
      spin: [0.1, 0.42, 1], hity: [{ t: 0.22, aoe: 3 }, { t: 0.36, aoe: 3, efekt: 'ohenKruh' }], mult: 0.8, vsetkych: true, trail: [0.1, 0.46], efekt: 'oblukOtocka' }),
    A({ dlzka: 0.9, kf: [[0, ZER_NAB], [0.24, ZER_IAI], [0.6, ZER_IAI]],
      dash: [0.2, 0.34, 24], hity: [{ t: 0.28, dosah: 2.2, kuzel: -0.2 }, { t: 0.36, dosah: 3.2, kuzel: 0, mult: 1.8, knock: 2.2, efekt: 'iai' }], vsetkych: true, trail: [0.2, 0.42], efekt: 'dashStopa' }),
  ],
  silny: A({ dlzka: 1.0, kf: [[0, ZER_NAB], [0.05, _(M_HORE, { rP: 2.9, chy: -0.3, sL: 0.6, kL: -1.2, sP: -0.2, kP: -0.6, rL: 2.5, rLz: -0.6 })],
    [0.42, { rP: 3.0, rPz: 0.2, lP: 0.6, chx: 0.3, zx: 0.2, sL: 1.0, kL: -1.6, sP: 0.8, kP: -1.6 }], [0.5, _(DREP, { rP: 0.75, rPz: 0.1, lP: 0, chx: -0.6, tx: -0.2, zx: 1.6, rL: 0.4 })]],
    skok: [0.05, 8], spin: [0.06, 0.4, 1.5], pad: [0.42, -24], hity: [{ t: 0.2, aoe: 2.6, mult: 0.8 }, { t: 0.56, aoe: 4, mult: 2.6, knock: 2.6, stun: 0.6, efekt: 'vybuchOhen' }],
    vsetkych: true, trail: [0.06, 0.6] }),
};

// ---------- KROKODILIA HARPUNA: najdlhsi dosah, rychle bodnutia, smrst 5 bodov, nabity = vypad cez vsetkych v ceste ----------
const HZ0 = 3.2, HZ1 = 2.75;
const smrst = [[0, TAH(HZ0)]];
for (let i = 0; i < 5; i++) { smrst.push([0.05 + i * 0.075, BOD(HZ1, 0.15 + (i % 2) * 0.35)]); smrst.push([0.09 + i * 0.075, TAH(HZ0, -0.3)]); }
smrst.push([0.47, BOD(HZ1, 0.5)]);
const HAR_NAB = _(DREP, TAH(HZ0, -0.9), { ty: 0.74, chx: 0.1 });
const harpuna = {
  nab: HAR_NAB,
  kombo: [
    A({ dlzka: 0.3, kf: [[0, TAH(HZ0)], [0.06, BOD(HZ1)]], hity: [{ t: 0.1 }], dosah: 4, kuzel: 0.86, lunge: 3, trail: true, efekt: 'bod' }),
    A({ dlzka: 0.3, kf: [[0, TAH(HZ0, -0.3)], [0.06, BOD(HZ1, 0.55)]], hity: [{ t: 0.1 }], dosah: 4, kuzel: 0.86, lunge: 3, trail: true, efekt: 'bod' }),
    A({ dlzka: 0.75, kf: smrst, hity: [0, 1, 2, 3, 4].map(i => ({ t: 0.08 + i * 0.075, mult: 0.5, efekt: 'bod' })).concat([{ t: 0.5, mult: 1.4, knock: 2, efekt: 'bodSilny' }]),
      dosah: 4.2, kuzel: 0.82, vsetkych: true, trail: [0.05, 0.55], dash: [0.05, 0.5, 2], efekt: 'smrst' }),
  ],
  silny: A({ dlzka: 0.7, kf: [[0, HAR_NAB], [0.03, _(BOD(HZ1, 0.35), { ty: 0.78, chx: -0.45, tx: -0.25, sL: 1.1, sP: -1.1, kP: 0 })]],
    dash: [0.02, 0.3, 26], hity: [0.08, 0.15, 0.22].map(t => ({ t, mult: 0.7, dosah: 2.2, kuzel: 0.3 })).concat([{ t: 0.3, mult: 2.2, knock: 2.6, dosah: 4.4, kuzel: 0.8, efekt: 'bodSilny' }]),
    vsetkych: true, trail: [0.02, 0.36], efekt: 'dashStopa' }),
};

// ---------- TROJZUBEC HLBIN: siroky obojrucny svih, bod, vir (2 otocky), nabity = skok a prilivova vlna ----------
const TZ = 2.2;
const TRO_NAB = _(DREP, LAVA2, { rP: 2.6, rPz: 0.3, lP: 0.6, chx: 0.15, zx: 0.4, rL: 2.5 });
const trojzubec = {
  nab: TRO_NAB,
  kombo: [
    A({ dlzka: 0.5, kf: [[0, _(LAVA2, { rP: 1.25, rPz: 0.35, lP: 0.3, chy: -1.15, zx: TZ, ty: 0.9 })], [0.12, _(ROZK, LAVA2, { rP: 1.3, rPz: 0.3, lP: 0.15, chy: 1.15, chx: -0.2, zx: TZ })]],
      hity: [{ t: 0.19 }], dosah: 3.4, kuzel: 0, vsetkych: true, knock: 1.5, trail: true, lunge: 2, efekt: 'oblukVoda' }),
    A({ dlzka: 0.42, kf: [[0, TAH(3.0, -0.5)], [0.08, BOD(2.6)]], hity: [{ t: 0.13 }], dosah: 3.8, kuzel: 0.82, vsetkych: true, mult: 1.2, lunge: 4, trail: true, efekt: 'bod' }),
    A({ dlzka: 0.85, kf: [[0, _(LAVA2, { rP: 1.3, rPz: 0.4, chy: -0.8, zx: TZ })], [0.08, _(ROZK, { rP: 1.45, rPz: 0.45, lP: 0.05, chy: 0.3, chx: -0.1, ty: 0.84, zx: TZ, rL: 1.3, rLz: -1.2, lL: 0.1 })]],
      spin: [0.08, 0.7, 2], hity: [0.2, 0.38, 0.56].map(t => ({ t, aoe: 3.4, mult: 0.6, efekt: 'vir' })), vsetkych: true, trail: [0.08, 0.72], knock: 1.4 }),
  ],
  silny: A({ dlzka: 1.05, kf: [[0, TRO_NAB], [0.08, _(LAVA2, { rP: 3.0, rPz: 0.2, lP: 0.2, chx: 0.3, zx: 0.3, sL: 0.9, kL: -1.4, sP: 0.3, kP: -1.2, rL: 3.0 })],
    [0.44, _(DREP, LAVA2, { rP: 0.9, lP: 0, chx: -0.7, tx: -0.25, zx: 2.9, rL: 0.9, lL: 0.2 })]],
    skok: [0.06, 8.5], pad: [0.4, -26], hity: [{ t: 0.5, aoe: 4.8, mult: 2.4, knock: 3, stun: 1, efekt: 'vlnaVoda' }], vsetkych: true, trail: [0.4, 0.52] }),
};

// ---------- RUNOVE KLADIVO: tazke a pomale; vodorovny svih, uder o zem s razovou vlnou, nabity = salto zo vzduchu a obrovska vlna ----------
const KLA_NAB = _(DREP, LAVA2, { rP: 3.0, rPz: 0.2, lP: 1.0, chx: 0.3, tx: 0.12, zx: 0, rL: 2.9, lL: 1.0 });
const kladivo = {
  nab: KLA_NAB,
  kombo: [
    A({ dlzka: 0.78, kf: [[0, _(ROZK, LAVA2, { rP: 1.0, rPz: 0.35, lP: 0.4, chy: -1.35, chx: 0.1, zx: 1.8 })], [0.3, _(VYPAD, LAVA2, { rP: 1.2, rPz: 0.25, lP: 0.1, chy: 1.35, chx: -0.25, zx: 1.9 })]],
      hity: [{ t: 0.38 }], dosah: 2.9, kuzel: 0.1, vsetkych: true, mult: 1, knock: 2.6, lunge: 2, trail: true, efekt: 'oblukTazky' }),
    A({ dlzka: 1.0, kf: [[0, _(LAVA2, { rP: 3.1, rPz: 0.25, lP: 1.0, chx: 0.25, tx: 0.15, zx: 0, rL: 3.0, lL: 1.0, ty: 1.0 })], [0.42, _(DREP, LAVA2, { rP: 0.75, rPz: 0.05, lP: 0, chx: -0.7, tx: -0.2, zx: 2.3, rL: 0.8, lL: 0.2 })]],
      hity: [{ t: 0.5, dosah: 2.8, kuzel: 0.5, mult: 1.6, stun: 1 }, { t: 0.52, aoe: 3, stred: 1.6, mult: 0.8, knock: 2, efekt: 'vlnaKamen' }], vsetkych: true, lunge: 1.5, trail: [0.38, 0.6] }),
  ],
  silny: A({ dlzka: 1.3, kf: [[0, KLA_NAB], [0.1, _(LAVA2, { rP: 3.1, rPz: 0.2, lP: 0.5, chx: 0.2, zx: 0, sL: 1.2, kL: -1.8, sP: 1.0, kP: -1.8, rL: 3.0 })],
    [0.58, _(DREP, LAVA2, { rP: 0.7, lP: 0, chx: -0.8, tx: -0.2, zx: 2.3, rL: 0.8, lL: 0.2, ty: 0.62 })]],
    skok: [0.08, 10.5], flip: [0.12, 0.52, 1], pad: [0.56, -30], dash: [0.08, 0.56, 4],
    hity: [{ t: 0.64, aoe: 5.5, mult: 3, knock: 4, stun: 2, efekt: 'vlnaRuna' }], vsetkych: true, trail: [0.12, 0.66] }),
};

const OS_NAB = _(DREP, TAH(3.2, -0.9));
export const UTOKY = {
  pest: { kombo: [U(0.36, 0.16, { rP: 1.3, rPz: 0.15, lP: 1.7, chy: 0.45 }, { rP: 1.55, rPz: 0.05, lP: 0.05, chy: -0.4, chx: -0.1, tx: -0.12 }, { dosah: 1.6, lunge: 1.5 })], silny: SILNY({ dosah: 1.8 }) },
  noz: { kombo: [U(0.34, 0.14, { rP: 1.0, rPz: 0.25, lP: 1.9, chy: 0.5, chx: 0.1 }, { rP: 1.5, rPz: 0.05, lP: 0.05, chy: -0.45, chx: -0.15, tx: -0.15 }, { dosah: 1.8, lunge: 2 })], silny: SILNY({ dosah: 2 }) },
  sekera: { kombo: [U(0.55, 0.22, NAHOR, ZHORA, { dosah: 2, lunge: 1 })], silny: SILNY({ dosah: 2.2 }) },
  // ostep: bodnutie s dlhym dosahom (3 m), uzky kuzel
  ostep: { nab: OS_NAB, kombo: [U(0.4, 0.13, TAH(3.2), BOD(2.75), { dosah: 3, kuzel: 0.85, lunge: 2.5, trail: true })],
    silny: U(0.55, 0.16, OS_NAB, BOD(2.75, 0.35), { dosah: 3.4, kuzel: 0.8, mult: 2, knock: 2, lunge: 7, vsetkych: true, trail: true }) },
  // klepetovy kyj: velmi pomaly zvisly uder (dlhy napriah), obrovsky knockback a omracenie (stun = sekundy)
  klepeto: { kombo: [U(1.0, 0.55, { ...NAHOR, rP: 3.1, chx: 0.25, tx: 0.15 }, { ...ZHORA, tx: -0.25, zx: 1.2 }, { mult: 2.2, knock: 3, stun: 1.2, dosah: 2.4, lunge: 1, kuzel: 0.5, hity: [{ t: 0.55, efekt: 'vlnaMala', stred: 1.3 }] })],
    silny: SILNY({ dlzka: 0.95, hit: 0.45, mult: 3, knock: 4, stun: 1.6, dosah: 2.6, hity: [{ t: 0.45, efekt: 'vlnaMala', stred: 1.3 }] }) },
  mec: {
    kombo: [
      U(0.44, 0.16, { rP: 1.5, rPz: 1.5, lP: 0.5, chy: 1.0, zx: 1.2 }, { rP: 1.5, rPz: -0.2, lP: 0.1, chy: -1.05, tx: -0.08, zx: 1.2 }, { dosah: 2.6, vsetkych: true, lunge: 3, trail: true }),      // sek zlava
      U(0.44, 0.16, { rP: 1.5, rPz: -0.4, lP: 0.2, chy: -0.85, zx: 1.2 }, { rP: 1.5, rPz: 1.6, lP: 0.1, chy: 0.95, tx: -0.08, zx: 1.2 }, { dosah: 2.6, vsetkych: true, lunge: 3, trail: true }),    // sek sprava
      U(0.66, 0.3, NAHOR, { ...ZHORA, zx: 1.6 }, { dosah: 2.6, vsetkych: true, lunge: 4, mult: 1.7, knock: 1.8, trail: true }),                                                                  // silny uder zhora
    ],
    silny: SILNY({ dosah: 2.8, vsetkych: true, trail: true }),
  },
  zeravy, harpuna, trojzubec, kladivo,
};
// farba stopy a efektov podla stylu
export const FARBY = { zeravy: 0xff7a22, harpuna: 0xfff0c8, trojzubec: 0x40e0ff, kladivo: 0x50d0ff, klepeto: 0xffa080, mec: 0xc8d0ff, ostep: 0xfff0c8 };
// bojovy styl zbrane: nastroj.styl (legendarne), inak podla typu nastroja
export const typZbrane = p => {
  const n = p?.nastroj; if (!n) return 'pest';
  if (n.styl && UTOKY[n.styl]) return n.styl;
  return n.typ === 'mec' ? 'mec' : n.typ === 'noz' ? 'noz' : n.typ === 'klepeto' ? 'klepeto' : n.typ === 'ostep' ? 'ostep' : 'sekera';
};

export const KOMBO_OKNO = 0.55;                      // za kolko sekund po seku sa dalsi klik berie ako kombo

// jemny auto-aim: najblizsi nepriatel v sirokom uhle pred kamerou -> smer postavy (alebo null)
export function autoUhol(hrac, yaw, dosah) {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  let naj = null, nd = dosah + 1.6;
  for (const e of zoznamNepriatelov()) {
    if (e.mrtvy) continue;
    const dx = e.x - hrac.poz.x, dz = e.z - hrac.poz.z, l = Math.hypot(dx, dz) || 0.001, d = l - 0.3 - (e.def.polomer || 0);
    if (d > nd || (dx * fx + dz * fz) / l < 0.26) continue;
    nd = d; naj = e;
  }
  return naj ? Math.atan2(-(naj.x - hrac.poz.x), -(naj.z - hrac.poz.z)) : null;
}

// ---------- efekty ----------
let iskry = null, ziara = null, kamienky = null, kamera = null, kam = null, hracRef = null, cislaDiv = null, svetlo = null;
const cisla = [], v3 = new THREE.Vector3(), farbaT = new THREE.Color();
let trail = null, obluky = null, hroty = null, vlny = null, svetloI = 0, bolNabity = false, cas = 0;

export function initBoj({ scena, kamera: k, kam: km, hrac }) {
  kamera = k; kam = km; hracRef = hrac;
  iskry = vytvorCastice(scena, { pocet: 900, velkost: 0.14, aditivne: true });
  ziara = vytvorCastice(scena, { pocet: 500, velkost: 0.42, aditivne: true });      // velke makke castice (plamene, para, runy)
  kamienky = vytvorCastice(scena, { pocet: 240, velkost: 0.13 });                     // kamienky a hlina pri dopade kladiva
  svetlo = new THREE.PointLight(0xffffff, 0, 16, 2);                                   // zablesk pri silnych utokoch (stale v scene, len sa zapne)
  scena.add(svetlo);
  cislaDiv = document.createElement('div');
  cislaDiv.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:5';
  document.body.appendChild(cislaDiv);
  trail = vytvorStopu(scena);
  obluky = pool(scena, 6, () => oblukGeo(1.75), () => oblukGeo(Math.PI));
  hroty = pool(scena, 6, hrotGeo);
  vlny = pool(scena, 8, vlnaGeo);
  hrac.autoCiel = (yaw, dosah) => autoUhol(hrac, yaw, dosah);
  hrac.priMachu = mach;
  hrac.priEfekte = efektZasahu;
}

const R = (a = 1) => (Math.random() - 0.5) * 2 * a;
const farbaStylu = typ => FARBY[typ] ?? 0xffffff;

// ---- pool aditivnych meshov (oblúky seku, hroty bodnuti, razove vlny) ----
function pool(scena, n, geo, geo2) {
  const g1 = geo(), g2 = geo2?.(), kusy = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(g1, new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.visible = false; m.frustumCulled = false; m.rotation.order = 'YZX';
    scena.add(m); kusy.push({ m, t: 0, zivot: 1, r0: 1, r1: 1, jas: 1 });
  }
  let dalsi = 0;
  return {
    // vrati volny kus; plny = 2. geometria (cely kruh)
    daj(zivot, r0, r1, hex, jas = 1, plny = false) {
      const k = kusy[dalsi++ % n];
      k.m.geometry = plny && g2 ? g2 : g1;
      Object.assign(k, { t: 0, zivot, r0, r1, jas });
      k.m.material.color.set(hex).multiplyScalar(jas);
      k.m.visible = true; k.m.scale.setScalar(r0);
      return k.m;
    },
    aktualizuj(dt) {
      for (const k of kusy) {
        if (!k.m.visible) continue;
        k.t += dt;
        const u = k.t / k.zivot;
        if (u >= 1) { k.m.visible = false; continue; }
        const e = 1 - Math.pow(1 - u, 3);                      // rychlo sa roztiahne, potom spomali
        const s = k.r0 + (k.r1 - k.r0) * e;
        k.m.scale.set(s, s, k.m.userData.dlzka ? s * k.m.userData.dlzka : s);
        k.m.material.opacity = Math.pow(1 - u, 1.5);
      }
    },
  };
}
// oblúk seku: kosacik (hrubsi v strede, tenke konce), jasnejsi vonkajsi okraj; lezi v rovine XZ, stred smeruje na -z
function oblukGeo(polUhol) {
  const N = 40, M = 4, pos = [], col = [], idx = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= M; j++) {
    const u = i / N, a = -polUhol + 2 * polUhol * u, hr = 0.45 * Math.pow(Math.sin(Math.PI * u), 0.8) + 0.02, r = 1 - hr * (1 - j / M);
    pos.push(Math.sin(a) * r, 0, -Math.cos(a) * r);
    const k = Math.pow(j / M, 1.6) * Math.pow(Math.sin(Math.PI * u), 0.6) * (polUhol > 3 ? 1 : 0.4 + 0.6 * u);   // nabeh seku jasnejsi
    col.push(k, k, k);
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + M + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  return g;
}
// hrot bodnutia: dve skrizene uzke plochy pozdlz -z (dlzka 1), jasny stred
function hrotGeo() {
  const pos = [], col = [];
  for (const [ax, ay] of [[1, 0], [0, 1]]) {
    const w = 0.09;
    pos.push(-w * ax, -w * ay, 0, w * ax, w * ay, 0, 0, 0, -1);
    col.push(0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 1, 1, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
// razova vlna: plochy kruh na zemi, jasny okraj, dovnutra miznie
function vlnaGeo() {
  const g = new THREE.RingGeometry(0.55, 1, 56, 3).rotateX(-Math.PI / 2), p = g.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getZ(i)), k = Math.pow((r - 0.55) / 0.45, 2.2); col.push(k, k, k); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// ---- jednotlive efekty ----
function oblúk(x, y, z, smer, naklon, r, hex, { zivot = 0.2, plny = false, jas = 2.2 } = {}) {
  const m = obluky.daj(zivot, r * 0.75, r * 1.08, hex, jas, plny);
  m.position.set(x, y, z); m.rotation.set(0, smer, naklon);
}
function hrot(x, y, z, smer, dlzka, hex, jas = 2.5) {
  const m = hroty.daj(0.14, 0.7, 1.15, hex, jas);
  m.userData.dlzka = dlzka; m.position.set(x, y, z); m.rotation.set(0, smer, 0);
}
function vlna(x, y, z, r, hex, zivot = 0.5, jas = 2) {
  const m = vlny.daj(zivot, 0.3, r, hex, jas);
  m.position.set(x, y + 0.12, z); m.rotation.set(0, Math.random() * 6, 0);
}
function zablesk(x, y, z, hex, sila) { svetlo.position.set(x, y + 1.2, z); svetlo.color.set(hex); svetloI = Math.max(svetloI, sila); }
function ohen(x, y, z, n, rozptyl = 1, hore = 3) {
  for (let i = 0; i < n; i++) {
    ziara.vypust(x + R(rozptyl * 0.4), y + Math.random() * 0.5, z + R(rozptyl * 0.4), R(rozptyl * 2), hore * (0.4 + Math.random()), R(rozptyl * 2), [0xff4a10, 0xff8a20, 0xffc040][i % 3], 0.35 + Math.random() * 0.35, -2);
    if (i % 2) iskry.vypust(x, y + 0.3, z, R(5), 2 + Math.random() * 5, R(5), 0xffd080, 0.5 + Math.random() * 0.4, 9);
  }
}
function voda(x, y, z, n, rozptyl = 1, hore = 5) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, v = rozptyl * (1 + Math.random() * 3);
    iskry.vypust(x + Math.cos(a) * 0.3, y + 0.2, z + Math.sin(a) * 0.3, Math.cos(a) * v, hore * (0.5 + Math.random()), Math.sin(a) * v, i % 3 ? 0x9ef4ff : 0xffffff, 0.6 + Math.random() * 0.5, 14);
    if (i % 3 === 0) ziara.vypust(x + R(0.5), y + 0.2, z + R(0.5), Math.cos(a) * v * 0.4, hore * 0.3, Math.sin(a) * v * 0.4, 0x30b8e8, 0.6, 1);
  }
}
function kamene(x, y, z, n, rozptyl = 1) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, v = rozptyl * (1.5 + Math.random() * 3.5);
    kamienky.vypust(x + Math.cos(a) * 0.5, y + 0.1, z + Math.sin(a) * 0.5, Math.cos(a) * v, 3 + Math.random() * 6, Math.sin(a) * v, [0x7a6a58, 0x9a8f80, 0x5a4a3a][i % 3], 0.8 + Math.random() * 0.5, 16);
  }
}
// kruh castic v kruhu s polomerom r (vir, ohnivy kruh)
function kruhCastic(x, y, z, r, n, hex, fn = iskry) {
  for (let i = 0; i < n; i++) { const a = i / n * 6.283; fn.vypust(x + Math.cos(a) * r, y + 0.9 + R(0.3), z + Math.sin(a) * r, -Math.sin(a) * 5, 1 + Math.random() * 2, Math.cos(a) * 5, hex, 0.4 + Math.random() * 0.3, 3); }
}

// pri mahnuti (D = utok): zvuk + efekt seku
function mach(D) {
  zvuky.mach(D.typ === 'zeravy' ? 'mec' : D.typ, D.silny);
  const h = hracRef, sm = h.smer, f = farbaStylu(D.typ), x = h.poz.x, y = h.poz.y, z = h.poz.z, fx = -Math.sin(sm), fz = -Math.cos(sm);
  switch (D.efekt) {
    case 'oblukSikmo': oblúk(x + fx * 0.6, y + 1.15, z + fz * 0.6, sm, 0.65, 2.6, f); break;
    case 'oblukNahor': oblúk(x + fx * 0.6, y + 1.2, z + fz * 0.6, sm, -1.15, 2.4, f); break;
    case 'oblukOtocka': oblúk(x, y + 1.05, z, sm, 0, 2.9, f, { plny: true, zivot: 0.35 }); zvuky.ohen(0.6); break;
    case 'oblukVoda': oblúk(x, y + 1.0, z, sm, 0.12, 3.3, f, { zivot: 0.26 }); voda(x + fx * 2, y + 0.6, z + fz * 2, 14, 0.6, 3); break;
    case 'oblukTazky': oblúk(x, y + 1.0, z, sm, 0.2, 3.0, f, { zivot: 0.3, jas: 2.8 }); kam.zatras(0.03); break;
    case 'bod': hrot(x + fx * 0.8, y + 1.25, z + fz * 0.8, sm, 3.4, f); break;
    case 'dashStopa': zvuky.svist(); break;
  }
  if (D.skok) zvuky.svist();
}

// pri kazdom zasahu z hrac.js (aj ked netrafi nikoho): efekty na zemi, vlny, oheň...
function efektZasahu(info) {
  const h = hracRef, f = farbaStylu(info.typ), sm = Math.atan2(-info.fx, -info.fz);
  const x = info.x + info.fx * (info.stred || 0), y = info.y, z = info.z + info.fz * (info.stred || 0);
  switch (info.efekt) {
    case 'ohenKruh': kruhCastic(x, y, z, 2.4, 40, 0xff8a20, ziara); zvuky.ohen(0.8); break;
    case 'iai':
      oblúk(x + info.fx * 0.4, y + 1.05, z + info.fz * 0.4, sm, 0.05, 3.6, 0xffb050, { zivot: 0.32, jas: 3.2 });
      for (let i = 0; i < 6; i++) ohen(x - info.fx * i * 0.9, y + 0.6, z - info.fz * i * 0.9, 5, 0.6, 2);
      zablesk(x, y, z, 0xff7a22, 40); kam.zatras(0.06); zvuky.ohen(1.2); break;
    case 'vybuchOhen':
      vlna(x, y, z, 4.2, 0xff6a18, 0.5, 2.4); vlna(x, y, z, 2.6, 0xffc060, 0.35, 2);
      ohen(x, y, z, 60, 2.2, 5); zablesk(x, y, z, 0xff6a18, 80); kam.zatras(0.11); zvuky.vlna(1); zvuky.ohen(1.4); break;
    case 'bodSilny':
      hrot(x + info.fx * 0.6, y + 1.2, z + info.fz * 0.6, sm, 5, 0xffffff, 3); vlna(x + info.fx * 3.5, y + 1.0, z + info.fz * 3.5, 1.2, f, 0.25);
      kam.zatras(0.04); break;
    case 'bod': hrot(x + info.fx * 0.8, y + 1.25 + R(0.15), z + info.fz * 0.8, sm + R(0.06), 3.6, f, 2); break;
    case 'vir': kruhCastic(x, y, z, 2.8, 30, 0x9ef4ff); vlna(x, y, z, 3.2, f, 0.35, 1.4); zvuky.vodaUder(0.5); break;
    case 'vlnaVoda':
      vlna(x, y, z, 5, f, 0.6, 2.6); vlna(x, y, z, 3.2, 0xffffff, 0.45, 1.6); setTimeout(() => vlna(x, y, z, 6, f, 0.7, 1.6), 120);
      voda(x, y, z, 90, 1.6, 9); zablesk(x, y, z, f, 50); kam.zatras(0.1); zvuky.vodaUder(1.4); zvuky.vlna(0.8); break;
    case 'vlnaMala': vlna(x, y, z, 1.9, 0xffc0a0, 0.35, 1.4); kamene(x, y, z, 12, 0.5); zvuky.vlna(0.5); break;
    case 'vlnaKamen':
      vlna(x, y, z, 3.2, f, 0.45, 2.2); kamene(x, y, z, 30, 0.9); zablesk(x, y, z, f, 25);
      for (let i = 0; i < 12; i++) iskry.vypust(x + R(1.5), y + 0.1, z + R(1.5), 0, 4 + Math.random() * 5, 0, f, 0.5, 2);
      kam.zatras(0.07); zvuky.vlna(0.8); break;
    case 'vlnaRuna':
      vlna(x, y, z, 6, f, 0.6, 3); vlna(x, y, z, 3.5, 0xffffff, 0.4, 2); setTimeout(() => vlna(x, y, z, 7.5, f, 0.8, 1.8), 140);
      kamene(x, y, z, 70, 1.6);
      for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, r = 2 + Math.random() * 2.5; for (let j = 0; j < 4; j++) ziara.vypust(x + Math.cos(a) * r, y + 0.2, z + Math.sin(a) * r, 0, 4 + j * 2, 0, f, 0.6, 1); }   // stlpy runoveho svetla
      zablesk(x, y, z, f, 100); kam.zatras(0.16); zvuky.vlna(1.4); break;
  }
}

function cislo(x, y, z, text, silne, hex) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `position:absolute;font:800 ${silne ? 26 : 19}px system-ui,sans-serif;color:${hex ?? (silne ? '#ffd24a' : '#fff')};text-shadow:0 0 3px #000,0 2px 4px #000;transform:translate(-50%,-50%)`;
  cislaDiv.appendChild(el);
  cisla.push({ el, x: x + (Math.random() - 0.5) * 0.5, y, z, t: 0 });
}

// zasah: zavolat z hrac.priUdere. Vrati pocet zasiahnutych.
export function zasahni(hrac, info, nast, silaDev = 1) {
  const n = nast?.nastroj || {}, vBonus = n.vodaBonus && hrac.poz.y < 0.3 ? n.vodaBonus : 1;
  const dmg = poskodenieNepriatela(nast?.nastroj ? nast : null) * silaDev * info.mult * vBonus;
  // plosny uder (aoe): vsetci v kruhu okolo bodu 'stred' m pred hracom; inak kuzel pred hracom
  const cx = hrac.poz.x + (info.aoe ? info.fx * (info.stred || 0) : 0), cz = hrac.poz.z + (info.aoe ? info.fz * (info.stred || 0) : 0);
  const o = info.aoe ? { ...info, dosah: info.aoe, kuzel: -2, vsetkych: true } : { ...info, dosah: (info.dosah ?? 2.3) + (n.dosah || 0) };
  const oo = { ...o, horenie: n.horenie || 0 };
  const hity = [...udriNepriatela(cx, cz, info.fx, info.fz, dmg, oo), ...udriBledych(cx, cz, info.fx, info.fz, dmg, oo)];   // + Bledi (bledi.js)
  if (!hity.length) return 0;
  const silne = info.silny || info.mult > 1.3, f = FARBY[info.typ];
  for (const e of hity) {
    const y = (e.g?.position.y ?? hrac.poz.y) + 0.9;
    cislo(e.x, y, e.z, Math.round(dmg * 10) / 10, silne, f && silne ? '#' + new THREE.Color(f).lerp(new THREE.Color(0xffffff), 0.3).getHexString() : null);
    const k = silne ? 26 : 12;
    for (let i = 0; i < k; i++) iskry.vypust(e.x, y - 0.2, e.z, (Math.random() - 0.5) * 7 + info.fx * 3, 1 + Math.random() * 4, (Math.random() - 0.5) * 7 + info.fz * 3, i % 3 ? 0xffe9a0 : f ?? 0xff6a50, 0.35 + Math.random() * 0.25, 12);
    if (f) { oblúk(e.x, y, e.z, Math.random() * 6.28, R(1.2), 0.8, f, { zivot: 0.12, jas: 2.5 }); if (info.typ === 'zeravy') ohen(e.x, y - 0.5, e.z, 6, 0.5, 2); if (info.typ === 'trojzubec') voda(e.x, y - 0.5, e.z, 8, 0.5, 3); }
  }
  zvuky.zasahZbran(info.typ === 'zeravy' ? 'mec' : info.typ === 'harpuna' ? 'noz' : info.typ, silne);
  stav.hitstop = Math.max(stav.hitstop, info.dalsi ? 0.03 : silne ? (info.mult >= 2 ? 0.14 : 0.1) : 0.06);
  kam.zatras(silne ? 0.05 : 0.03);
  return hity.length;
}

export function aktualizujBoj(dt) {
  if (!kamera) return;
  cas += dt;
  iskry.aktualizuj(dt); ziara.aktualizuj(dt); kamienky.aktualizuj(dt);
  obluky.aktualizuj(dt); hroty.aktualizuj(dt); vlny.aktualizuj(dt);
  svetloI *= Math.exp(-dt * 9); svetlo.intensity = svetloI > 0.3 ? svetloI : 0;
  for (let i = cisla.length - 1; i >= 0; i--) {
    const c = cisla[i]; c.t += dt;
    if (c.t > 0.9) { c.el.remove(); cisla.splice(i, 1); continue; }
    v3.set(c.x, c.y + c.t * 1.1, c.z).project(kamera);
    c.el.style.display = v3.z > 1 ? 'none' : '';
    c.el.style.left = (v3.x * 0.5 + 0.5) * innerWidth + 'px';
    c.el.style.top = (-v3.y * 0.5 + 0.5) * innerHeight + 'px';
    c.el.style.opacity = c.t < 0.6 ? 1 : 1 - (c.t - 0.6) / 0.3;
  }
  const h = hracRef, U = h.utok, f = FARBY[h.zbran], leg = h.zbran in LEGENDARNE;
  // nabijanie legendarnej zbrane: castice sa stahuju k postave, pri plnom nabiti zablesk
  if (h.nabijanie > 0 && leg) {
    for (let i = 0; i < 2 + h.nabijanie * 3; i++) {
      const a = Math.random() * 6.283, r = 1.4 - h.nabijanie * 0.5;
      ziara.vypust(h.poz.x + Math.cos(a) * r, h.poz.y + 0.1 + Math.random() * 1.6, h.poz.z + Math.sin(a) * r, -Math.cos(a) * 2.5, 1.2, -Math.sin(a) * 2.5, f, 0.3, 0);
    }
    if (h.nabite && !bolNabity) { zvuky.nabite(); vlna(h.poz.x, h.poz.y, h.poz.z, 1.6, f, 0.3, 2); zablesk(h.poz.x, h.poz.y, h.poz.z, f, 20); }
  }
  bolNabity = h.nabite;
  // vypad: dosvit za postavou (afterimage)
  if (U?.efekt === 'dashStopa' && h.stopaAktivna)
    for (let i = 0; i < 6; i++) ziara.vypust(h.poz.x + R(0.15), h.poz.y + 0.2 + Math.random() * 1.5, h.poz.z + R(0.15), 0, 0.3, 0, f, 0.22, 0);
  // legendarne zbrane jemne pulzuju, pri utoku a nabijani svietia viac
  const k = 0.85 + 0.15 * Math.sin(cas * 3) + (U ? 0.5 : 0) + h.nabijanie * 0.8;
  for (const m of ZIARE) m.color.setScalar(m.userData.jas * k);
  trail.aktualizuj(dt, h, f ?? 0xd0dcff, leg);
}
const LEGENDARNE = { zeravy: 1, harpuna: 1, trojzubec: 1, kladivo: 1 };

// ---------- stopa za zbranou (ribbon, aditivny, mizne); farba podla stylu ----------
function vytvorStopu(scena) {
  const N = 22, ZIVOT = 0.24;
  const poz = new Float32Array(N * 6), far = new Float32Array(N * 6), idx = [];
  for (let i = 0; i < N - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(poz, 3));
  g.setAttribute('color', new THREE.BufferAttribute(far, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.frustumCulled = false; m.visible = false;
  scena.add(m);
  const hist = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Color();
  return {
    aktualizuj(dt, hrac, hex, leg) {
      for (const s of hist) s.vek += dt;
      while (hist.length && hist[hist.length - 1].vek > ZIVOT) hist.pop();
      const ruka = hrac.ruka;
      if (hrac.stopaAktivna && ruka) {
        if (!ruka.geometry.boundingBox) ruka.geometry.computeBoundingBox();
        const bb = ruka.geometry.boundingBox, ym = (bb.min.y + bb.max.y) / 2, zm = (bb.min.z + bb.max.z) / 2;
        hrac.model.updateMatrixWorld(true);
        a.set(bb.min.x * (leg ? 0.45 : 0.3), ym, zm); b.set(bb.min.x * 1.02, ym, zm);        // stred a hrot zbrane (hlava na -x)
        ruka.localToWorld(a); ruka.localToWorld(b);
        hist.unshift({ a: a.clone(), b: b.clone(), vek: 0 });
        if (hist.length > N) hist.pop();
      }
      m.visible = hist.length > 1;
      if (!m.visible) return;
      c.set(hex).multiplyScalar(leg ? 1.6 : 1);
      for (let i = 0; i < N; i++) {
        const s = hist[Math.min(i, hist.length - 1)], k = i < hist.length ? Math.pow(Math.max(0, 1 - s.vek / ZIVOT), 1.4) * (1 - i / N * 0.5) : 0;
        poz.set([s.a.x, s.a.y, s.a.z, s.b.x, s.b.y, s.b.z], i * 6);
        far.set([c.r * 0.25 * k, c.g * 0.25 * k, c.b * 0.25 * k, c.r * k, c.g * k, c.b * k], i * 6);
      }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    },
  };
}
