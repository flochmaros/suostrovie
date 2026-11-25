// Ticha zatoka - ostrov, ktory cez den vyzera ako najmilsi ostrovcek v suostrovi, v noci je to horor (PLAN_HOROR.md).
// Tvar: nepravidelny ostrov s tyrkysovou lagunou (otvorena na severozapad), biely piesok, palmy; na juhu vysoky utes.
// Z laguny vedie mala zatocina k pate utesu, kde je vchod do jaskyne: cez den pod vodou, pri nocnom odlive sa otvori.
// Subory: tento (teren, zeleň, udaje), ticha_zatoka_jaskyna.js (jaskyna), ticha_zatoka_modely.js (pamiatky).
import * as POMOC from './pomoc.js';
import * as J from './ticha_zatoka_jaskyna.js';
import { pamiatkyZatoky, MIESTA } from './ticha_zatoka_modely.js';

export const STRED = [1650, 1560];      // poloha vo svete (pasmo 2, juhovychod, bokom od trasy)
const LAGUNA = [-34, -16], LA = 40, LB = 30;
const CHATKA = MIESTA.chatka, SIET = MIESTA.siet;

// povodny teren BEZ zarezu jaskyne (pouziva ho aj strecha jaskyne)
export function vyskaBezJaskyne(x, z) {
  const P = POMOC;
  const n = P.fbm(x * 0.017, z * 0.017, 612);                               // 3x noise
  const t = 1 - P.elipsa(x - 4, z - 6, 100, 90, 0.15) + 0.13 * n;
  let h;
  if (t >= 0) {
    // siroka biela plaz, potom mierny svah; na vychode zeleny kopec
    h = Math.min(t * 13, 1.7 + Math.max(0, t - 0.14) * 7);
    h += 7 * P.smooth(14, 62, x) * P.smooth(0.12, 0.5, t) * (1 + 0.25 * n);
    h += 0.35 * n * P.smooth(0.15, 0.3, t);
  } else h = P.profil(t, 1);

  // laguna: dno -2.9 v strede, -0.9 na okraji, potom pozvolna biela plaz
  const dl = P.elipsa(x - LAGUNA[0], z - LAGUNA[1], LA, LB, -0.15) + 0.07 * n;
  if (dl < 1.45) {
    const g = dl < 1 ? -2.9 + 2.0 * dl * dl * dl : -0.9 + (dl - 1) * 8.2;
    h = P.hmin(h, g, 0.7);
  }
  // prieplav na severozapad (smerom k startu) - kanoe prejde
  const dk = P.distUsecka(x, z, LAGUNA[0], LAGUNA[1], -112, -72) + 4 * n;
  if (dk < 24) h = P.hmin(h, -2.5 + Math.max(0, dk - 8) * 0.34, 0.8);
  // zatocina k jaskyni
  const dz = P.distUsecka(x, z, -26, 0, J.JX, J.JZ - 4) + 1.5 * n;
  if (dz < 20 && z < J.JZ + 2) h = P.hmin(h, -2.15 + Math.max(0, dz - 6.5) * 0.42, 0.6);

  // vysoky utes na juhu: severna stena je rovna pri jaskyni, dalej sa vlni
  if (t > -0.06 && z > 4 && x > -62 && x < 74) {
    const volne = P.smooth(18, 30, Math.abs(x - J.JX));                      // kde sa moze stena vlnit
    const hrana = J.JZ + volne * (7 * n + Math.max(0, x - 22) * 0.34 + Math.max(0, -34 - x) * 0.55);
    const m = P.smooth(hrana + 0.8, hrana + 3.4 + volne * 4, z) * P.smooth(-62, -42, x) * P.smooth(74, 46, x) * P.smooth(-0.06, 0.04, t);
    if (m > 0) {
      const kopec = Math.max(0, 1 - Math.hypot(x - 8, z - 56) / 60);
      const vrch = 11.5 + 11 * kopec + 2.4 * n + 1.2 * P.ridge(x * 0.07, z * 0.07, 33);   // 1x noise
      h = P.lerp(h, Math.max(h, vrch), m);
    }
  }
  // rovna plosina pod chatkou
  const dc = P.dist(x, z, CHATKA[0], CHATKA[1]);
  if (dc < 15) h = P.lerp(h, 1.55, P.smooth(15, 8, dc));
  return h;
}

// ---------- nocna zona (pouzivaju ju dalsie fazy hororu; suradnice SVETA) ----------
// 1 = na ostrove a tesne okolo neho, plynulo 0 vo vzdialenosti 240 m od stredu
export function hororovaZona(x, z) {
  return POMOC.smooth(240, 135, Math.hypot(x - STRED[0], z - STRED[1]));
}
const svet = ([x, z]) => ({ x: STRED[0] + x, z: STRED[1] + z });
// dolezite miesta vo svetovych suradniciach
export const tichaZatoka = {
  id: 'ticha_zatoka', stred: svet([0, 0]),
  chatka: svet(CHATKA), stol: svet(MIESTA.stol), siet: svet(SIET),
  kanoe: svet([-37, -39]),                         // kde pri plazi pri chatke kotvi kanoe (dalsia faza ho nocou "odviaze")
  pristatie: svet([-24, -55]),                     // suche miesto na plazi
  jaskyna: {
    vchod: { ...svet(J.VCHOD), y: J.podlaha(0) },
    komora: { ...svet(J.KOMORA), y: J.podlaha(30) },
    vyklenok: { ...svet(J.VYKLENOK), y: J.podlaha(37) },   // truhlica pre kluc od majaka 2
    dlzka: J.DLZKA,
  },
  // je bod (svet) vnutri jaskyne? vrati 0..1 podla hlbky
  vJaskyni: (x, y, z) => J.hlbkaVJaskyni(x - STRED[0], y, z - STRED[1]),
};

export default {
  meno: 'Tichá zátoka', podnadpis: 'Pokojná lagúna', biom: 'palmovy', R: 92, ext: 195, H: 14, seed: 612,
  teleport: [-24, -55],

  vyska(x, z) {
    const h = vyskaBezJaskyne(x, z);
    return J.rez(x, z, h);
  },

  farby: { piesok: 0xfbf1d6, dno: 0xf7edcc, tr: [0x6cc23c, 0x3f9230], skala: 0x8d867a, plaz: 1.45, hlPrah: 0.42 },
  farba(x, z, h, f, P) {
    // biely piesok v lagune a na jej brehu
    const dl = P.elipsa(x - LAGUNA[0], z - LAGUNA[1], LA, LB, -0.15);
    if (dl < 1.45 && z < 22) {
      const k = P.smooth(1.45, 1.1, dl);
      f.piesok.r = P.lerp(f.piesok.r, 0.97, k); f.piesok.g = P.lerp(f.piesok.g, 0.9, k); f.piesok.b = P.lerp(f.piesok.b, 0.68, k);
    }
    // trava na vrchu utesu: rovnaka ako na streche jaskyne
    if (z > 14) {
      const w = P.smooth(5, 9, h) * P.smooth(14, 22, z), [tr, tg, tb] = J.travaUtesu(x, z);
      f.trava.r = P.lerp(f.trava.r, tr, w); f.trava.g = P.lerp(f.trava.g, tg, w); f.trava.b = P.lerp(f.trava.b, tb, w);
    }
    // dno pred jaskynou a v zareze: mokra tmavsia skala
    const u = x - J.JX, v = z - J.JZ;
    const k = P.smooth(17, 10, Math.abs(u)) * P.smooth(-3.5, 0.5, v) * P.smooth(J.DLZKA + 8, J.DLZKA + 4, v);
    if (k > 0 && h < 1) for (const c of [f.trava, f.piesok]) { c.r = P.lerp(c.r, 0.11, k); c.g = P.lerp(c.g, 0.1, k); c.b = P.lerp(c.b, 0.085, k); }
  },

  vegetacia: {
    zony: {
      plaz: { palma: 0.55, trava: 1.2, kamienky: 0.25 },
      haj: { palma: 0.75, bobule: 0.32, ibistek: 0.4, hibiskus: 0.4, kvet: 1.1, trava: 13, ker: 0.3, aloe: 0.08, monstera: 0.18 },
      les: { strom: 0.4, palma: 0.3, bobule: 0.28, ker: 0.5, papradie: 0.9, monstera: 0.35, hibiskus: 0.25, kvet: 0.4, trava: 10, spiral: 0.1, huba: 0.2 },
      utes: { trava: 14, kvet: 0.45, ker: 0.4, papradie: 0.35, strom: 0.16, balvan: 0.2, kamienky: 0.5, aloe: 0.2 },
      skaly: { balvan: 0.45, kamienky: 1.0, aloe: 0.15 },
    },
    zona(x, z, h, P) {
      if (h < 0.1) return null;
      // volne miesta: jaskyna (strecha je model), chatka, siet, cestička so stopami
      const u = x - J.JX, v = z - J.JZ;
      if (Math.abs(u) < 21 && v > -7 && v < J.DLZKA + 11) return null;
      if (P.dist(x, z, CHATKA[0], CHATKA[1]) < 10.5) return null;
      if (P.dist(x, z, SIET[0], SIET[1]) < 6) return null;
      for (let i = 1; i < MIESTA.stopy.length; i++) {
        const [ax, az] = MIESTA.stopy[i - 1], [bx, bz] = MIESTA.stopy[i];
        if (P.distUsecka(x, z, ax, az, bx, bz) < 2.2) return null;
      }
      if (z > 24 && h > 8) return 'utes';
      if (h < 1.55) return P.elipsa(x - 4, z - 6, 100, 90, 0.15) > 0.72 ? 'plaz' : null;
      if (z > 20 && h > 3.5) return 'skaly';
      return x > 16 && h > 3 ? 'les' : 'haj';
    },
  },

  predmety: {
    nahodne: ['palica', 'kokos', 'kokos', 'kamen'], pocet: 42,
    pevne: [['musla', -52, -41], ['musla', -66, -4], ['musla', 4, -26], ['kokos', -14, -52], ['palica', -30, -57]],
  },

  pamiatky(P) { return pamiatkyZatoky(P, vyskaBezJaskyne); },
  pamiatkyNahlad: [[CHATKA[0], CHATKA[1], 7, 'chatka'], [SIET[0], SIET[1], 4, 'siet'], [J.JX, J.JZ, 4, 'vchod jaskyne'],
    [J.KOMORA[0], J.KOMORA[1], 7, 'komora'], [...MIESTA.kostra, 4, 'kosti'], [...MIESTA.stopy.at(-1), 2, 'koniec stop']],
};
