// Dalsie jedlo a napoje + doladenie hodnot existujucich. Import tohto suboru staci (side effect).
import * as THREE from 'three';
import { PREDMETY, predmet } from './predmety.js';
import { ik, PECENE, SUSENE } from '../ikony.js';

import { modelKokosovaVoda, modelKrab, modelRybaIna, modelSusOvocie, modelTaro, modelHuba, modelBanan } from './modely_predmetov.js';
import { modelHrniec, modelMiska, modelUhlik } from './modely_varenia.js';

// farby upecenych / ususenych variantov (pouziva modelKrab a modelRybaIna)
const KRAB_PECENY = { telo: 0xdc3a22, svetla: 0xff6a44, tmava: 0xa8200f, hrot: 0xffd9b0, brucho: 0xffc89a, oko: 0xe8d8c0 };
const RYBA_PECENA = { chrbat: 0x7a4a1c, bok: 0xc2803a, brucho: 0xe8c78a, pruh: 0xd89a30, plutva: 0x8a5a24, spicka: 0xc0803a };
const RYBA_SUSENA = { chrbat: 0x8a7a54, bok: 0xb8a070, brucho: 0xd8c8a0, pruh: 0xb8a060, plutva: 0x9a8458, spicka: 0xc8b078 };

predmet('kokosova_voda', { meno: 'Kokosová voda', ikona: ik('coconuts', '#8a5a32', ['water-drop', '#4aa8ea', .46, 290, 290]), popis: 'Čerstvá voda z otvoreného kokosu.', jedlo: { sytost: 3, voda: 40 },
  model: modelKokosovaVoda() });
predmet('vareny_krab', { meno: 'Pečený krab', ikona: ik('crab', '#e0472c', PECENE), popis: 'Upečený na táboráku. Sýty a bezpečný.', vareny: true, jedlo: { sytost: 28, voda: 2 },
  model: modelKrab(KRAB_PECENY) });
predmet('vareny_ryba', { meno: 'Pečená ryba', ikona: ik('fish-cooked', '#c9813a', PECENE), popis: 'Upečená na táboráku. Sýta a bezpečná.', vareny: true, jedlo: { sytost: 32, voda: 3, zdravie: 3 },
  model: modelRybaIna(RYBA_PECENA, 0.8) });
predmet('susene_ovocie', { meno: 'Sušené ovocie', ikona: ik('fruit-bowl', '#b0603a', SUSENE), popis: 'Usušené na sušiaku. Sladké, dobre zasýti a hojí.', jedlo: { sytost: 24, voda: 2, zdravie: 4 },
  model: modelSusOvocie() });

predmet('pecene_taro', { meno: 'Pečené taro', ikona: ik('potato', '#8a5a3a', PECENE), popis: 'Upečený koreň taro. Veľmi sýty.', vareny: true, jedlo: { sytost: 30, voda: 0, zdravie: 2 },
  model: modelTaro(true) });
predmet('pecena_huba', { meno: 'Pečená huba', ikona: ik('sliced-mushroom', '#a8703e', PECENE), popis: 'Opečená na ohni, voňavá.', vareny: true, jedlo: { sytost: 16, voda: 1 },
  model: modelHuba(true) });
predmet('peceny_banan', { meno: 'Pečený banán', ikona: ik('banana-peeled', '#d99a3a', PECENE), popis: 'Karamelovo sladký.', vareny: true, jedlo: { sytost: 24, voda: 2 },
  model: modelBanan(1, true) });

predmet('susena_ryba', { meno: 'Sušená ryba', ikona: ik('fish-corpse', '#b08850', SUSENE), popis: 'Vysušená na slnku. Sýta a ľahká, oheň netreba.', jedlo: { sytost: 30, voda: 0, zdravie: 2 },
  model: modelRybaIna(RYBA_SUSENA, 0.6) });

// co sa da upiect na taboraku: surove -> pecene (pouziva ohen.js)
export const PECENIE = { krab: 'vareny_krab', ryba: 'vareny_ryba', taro: 'pecene_taro', huba: 'pecena_huba', banan: 'peceny_banan' };
// co sa da susit na susiaku (funkcne.js)
export const SUSENIE = { ryba: 'susena_ryba', banan: 'susene_ovocie', mango: 'susene_ovocie', ananas: 'susene_ovocie' };

// ---------- PECENIE: casy (sekundy na ohni) a stavy ----------
export const CASY = { upecene: 6, dokonale: 10, spalene: 13.5, koniec: 17 };   // koniec = pravy okraj ukazovatela
export const stavPecenia = t => t >= CASY.spalene ? 3 : t >= CASY.dokonale ? 2 : t >= CASY.upecene ? 1 : 0;   // surove, upecene, dokonale, spalene

// spalene jedlo: malo zasyti a ma rovnake riziko ako surove
predmet('spalene', { meno: 'Spálené jedlo', ikona: ik('rock', '#3a302a', PECENE), popis: 'Zuhoľnatený kus. Trochu zasýti, ale môže ti byť zle.', rizikove: true, jedlo: { sytost: 6, voda: 0 },
  model: modelUhlik() });

// dokonale upecene: vlastny predmet 'dok_<id>' s vacsou sytostou a liecenim; hviezdicku k ikone prida ikony3d.js (znacka)
export const dokonaly = id => 'dok_' + id;
for (const id of Object.values(PECENIE)) {
  const z = PREDMETY[id], j = z.jedlo, [geo, mat] = z.model;
  const zlaty = mat.clone(); zlaty.color.set(0xffe6a8);
  predmet(dokonaly(id), { ...z, id: dokonaly(id), meno: `${z.meno} ★`, popis: 'Upečené presne akurát. Zasýti viac a hojí.',
    znacka: '<span class="ik-hviezda">★</span>', jedlo: { sytost: Math.round(j.sytost * 1.35), voda: (j.voda || 0) + 3, zdravie: (j.zdravie || 0) + 7 }, model: [geo, zlaty] });
}

// ---------- UCINKY jedal (docasne; odpocitava preziti.js) ----------
export const EFEKTY = {
  veslo:  { meno: 'Silné paže', popis: 'rýchlejšie veslovanie', znak: '🛶' },
  dych:   { meno: 'Hlboký dych', popis: 'dlhší dych pod vodou', znak: '🫧' },
  regen:  { meno: 'Hojenie', popis: 'rýchlejšia regenerácia zdravia', znak: '💚' },
  odvaha: { meno: 'Pokojná myseľ', popis: 'menší strach v noci', znak: '🕯️' },
};

// ---------- HRNIEC a jedla z hrnca ----------
predmet('hrniec', { meno: 'Hlinený hrniec', ikona: ik('rock', '#b5603a'), kopa: 3, popis: 'Z hliny z Hliniska. S hrncom v ruke stlač E pri horiacom ohni (prázdny ražeň) a var.',
  model: modelHrniec() });

function jedloZHrnca(id, meno, popis, farba, jedlo, efekt, trvanie) {
  predmet(id, { meno, popis: popis + (efekt ? ` Účinok: ${EFEKTY[efekt].popis} (${trvanie / 60} min).` : ''), ikona: ik('rock', farba), farbaHladiny: farba, kopa: 10, vareny: true,
    jedlo: { ...jedlo, ...(efekt ? { efekt, trvanie } : {}) }, model: modelMiska(farba) });
}
// skupina surovin: v recepte sa da pouzit hociktora z nich
export const SKUPINY_SUROVIN = { ovocie: { meno: 'Ovocie', ids: ['banan', 'mango', 'ananas', 'bobule'] } };
// RECEPTY HRNCA: suroviny v lubovolnom poradi (2-3 policka)
export const VARENIE = [];
function jedloZReceptu(id, suroviny, meno, popis, farba, jedlo, efekt, trvanie) {
  jedloZHrnca(id, meno, popis, farba, jedlo, efekt, trvanie);
  VARENIE.push({ id, suroviny, efekt });
}
jedloZReceptu('rybacia_polievka', ['ryba', 'taro', 'kokosova_voda'], 'Rybacia polievka', 'Hustá a sýta.', '#e0a050', { sytost: 55, voda: 35, zdravie: 10 }, 'veslo', 300);
jedloZReceptu('krabi_vyvar', ['krab', 'kokos'], 'Krabí vývar', 'Krab v kokosovom mlieku.', '#e8704a', { sytost: 40, voda: 30, zdravie: 6 }, 'dych', 300);
jedloZReceptu('ovocny_napoj', ['ovocie', 'kokosova_voda'], 'Ovocný nápoj', 'Sladký a osviežujúci.', '#e85a8a', { sytost: 20, voda: 60, zdravie: 3 });
jedloZReceptu('liecivy_caj', ['aloe', 'kokosova_voda'], 'Liečivý čaj', 'Horký, ale rany sa po ňom rýchlo hoja.', '#8ac860', { sytost: 3, voda: 40, zdravie: 15 }, 'regen', 240);
jedloZReceptu('hubova_polievka', ['huba', 'huba', 'kokos'], 'Hubová polievka', 'Teplá, voňavá a upokojí.', '#b08a60', { sytost: 38, voda: 22, zdravie: 5 }, 'odvaha', 360);
jedloZReceptu('morsky_gulas', ['ustrica', 'riasa', 'taro'], 'Morský guláš', 'Chutí po mori.', '#4a8a78', { sytost: 50, voda: 18, zdravie: 8 }, 'dych', 480);
jedloZReceptu('bananovy_puding', ['banan', 'kokos', 'trstina'], 'Banánový puding', 'Dezert na zotavenie.', '#f0d070', { sytost: 46, voda: 18, zdravie: 8 }, 'regen', 180);
jedloZReceptu('kvetovy_caj', ['kvet', 'trstina', 'kokosova_voda'], 'Kvetový čaj', 'Vonia po lúke a zaženie zlé myšlienky.', '#c88ae0', { sytost: 4, voda: 45, zdravie: 4 }, 'odvaha', 240);
// nespravna kombinacia
jedloZHrnca('kasa', 'Čudná kaša', 'Nevydarený pokus. Aspoň niečo.', '#7a7260', { sytost: 12, voda: 6 });

// vrati id jedla pre zoznam surovin (poradie nezalezi), inak 'kasa'
export function coSaUvari(vlozene) {
  const sedi = r => {
    if (r.suroviny.length !== vlozene.length) return false;
    const volne = [...vlozene];
    return [...r.suroviny].sort((a, b) => !!SKUPINY_SUROVIN[a] - !!SKUPINY_SUROVIN[b]).every(s => {   // presne suroviny pred skupinami
      const i = volne.findIndex(v => SKUPINY_SUROVIN[s] ? SKUPINY_SUROVIN[s].ids.includes(v) : v === s);
      if (i < 0) return false;
      volne.splice(i, 1);
      return true;
    });
  };
  return VARENIE.find(sedi)?.id ?? 'kasa';
}

// doladenie existujucich (mutacia, subory predmetov sa nemenia)
const uprav = (id, j) => { if (PREDMETY[id]) PREDMETY[id].jedlo = { ...(PREDMETY[id].jedlo || {}), ...j }; };
uprav('kokos', { sytost: 8, voda: 28 });   // hlavne voda
uprav('aloe', { zdravie: 6 });             // hoji
// surove zivocichy (ak su uz registrovane) - hodnoty, vareny variant je lepsi
uprav('krab', { sytost: 16, voda: 1 });
uprav('ryba', { sytost: 20, voda: 2 });
// kazde jedlo ma cele cisla sytost/voda
for (const id in PREDMETY) {
  const j = PREDMETY[id].jedlo;
  if (j) { j.sytost = j.sytost || 0; j.voda = j.voda || 0; }
}
