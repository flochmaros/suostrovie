// Rucne navrhnute ostrovy (pasma 1-3). Navrh a pribeh: SUOSTROVIE.md. Ramec (teren, vegetacia, predmety): svet.js + vegetacia.js.
// Tu je len POLOHA kazdeho ostrova (stred vo svete) - tvar a obsah su v samostatnom subore src/ostrovy/<id>.js.
//
// ===== API suboru ostrova (export default { ... }) =====
// Vsetky suradnice v suboroch su LOKALNE: (0, 0) = stred ostrova, +x = vychod, +z = juh (sever = -z). Vyska 0 = hladina mora.
//   meno        'Šumivý háj'                 nazov (HUD pri priplavani, mapa)
//   podnadpis   'Bambusový háj'               kratky popis pod nazvom
//   biom        'bambusovy'                   zakladne farby terenu (TEREN v svet.js) a spravanie (napr. 'sopecny' = lavove jastery)
//   R           115                           priblizny polomer brehu (m) - HUD, mapa, hladanie plaze
//   ext         240                           polovica stvorca terenu (m); vsetko (aj svah pod vodou) musi byt vnutri. Vzdy ext >= R * 1.6
//   H           20                            priblizna max. vyska (m) - farby travy podla vysky
//   seed        123                           cislo pre sum
//   vyska(x, z, P)                            VYSKA TERENU v bode (m). Musi byt rychla (vola sa ~100 000x). Pri okraji stvorca
//                                             nech je hlboko (< -10); ramec plynulo prejde do morskeho dna na poslednych 18 % ext.
//   farby?      { tr: [0xnizka, 0xvysoka], piesok, dno, skala, hl, hlPrah, plaz, tmavy }   prepisu farby biomu (vsetko nepovinne)
//   farba?(x, z, h, f, P)                     uprava farby bodu terenu: f.trava a f.piesok su {r,g,b} (0..1), menit na mieste
//   vegetacia   { zony: { meno: { druh: hustota, ... } }, zona(x, z, h, P) -> meno zony | null }
//               hustota = pokusov na 100 m2 (palma 0.9 = hustý palmový háj, trava 20 = lúka). Druhy:
//               stromy: palma, strom, mango, akacia, mangrova, bambus, gumovnik
//               kriky/byliny: banan, bobule, ker, ibistek, ananas, aloe, taro, trstina, papradie, huba, kvet
//               ozdoby: monstera, hibiskus, spiral, svetlonos;  trava (zber vlakna), kamienky (drobne kamene, ozdoba)
//               suroviny: balvan (kamen), obsidian, hlina (hlinena jama), sira (sirny vyver)
//               Kazdy druh ma vlastne podmienky (vyska nad morom, sklon) v PRAVIDLA vo vegetacia.js.
//   bujny?      true = vegetacia 2.5x hustejsia
//   predmety?   { nahodne: ['palica', 'kamen'], pocet: 60, pevne: [['musla', x, z], ...] }  veci lezace na zemi (zdvihnu sa na E)
//   pamiatky?(P) -> { objekty: [THREE.Object3D...], kolizie: [[x, z, polomer], ...] }   modely (ruiny, chatrc, vrak) v lokalnych
//               suradniciach; P.THREE je kniznica Three.js, P.vyska(x, z) je hotovy teren. Kolizie = kruhy, cez ktore sa neprejde.
//   majak?      [x, z]                         kde stoji majak (rovne miesto, vyska 2-4.5 m)
//   flase?      [[x, z], ...]                  flase so spravou (plaz, vyska 0.5-1.1 m); domov 2, ostatne 1 (poradie: majak.js FLASE_OSTROVY)
//   start?      { hrac: [x, z], kanoe: [x, z] } len startovaci ostrov
//   pamiatkyNahlad? [[x, z, polomer, 'popis'], ...]  len pre nahlad nastroje/ostrov.html (kde su pamiatky)
//
// P = pomocne funkcie z pomoc.js: noise, fbm, ridge, smooth, clamp, lerp, hmax, hmin, dist, distUsecka, rng, profil, zem, elipsa
//   teleport?   [x, z]                         kam skoci hra.naOstrov(id)
//   (kolizie mozu mat 4. prvok { lenLode: true } = brani len lodiam, { yMax } = len ked je hrac nizsie)
//     (+ v pamiatky: THREE, vyska, mat(farba, {..}) -> MeshStandardMaterial)
import domov from './domov.js';
import strazna_skala from './strazna_skala.js';
import sumivy_haj from './sumivy_haj.js';
import hlinisko from './hlinisko.js';
import zahrada from './zahrada.js';
import perlovy_atol from './perlovy_atol.js';
import ohniva_hora from './ohniva_hora.js';
import sirne_pramene from './sirne_pramene.js';
import krokodili_mociar from './krokodili_mociar.js';
import dzungla_predkov from './dzungla_predkov.js';
import ticha_zatoka, { STRED as ZATOKA } from './ticha_zatoka.js';

// [id, modul, stred x, stred z] - stred startu je (260, 260); pasmo 1 do ~1050 m, pasmo 2 do ~2100 m, pasmo 3 do ~3350 m od startu
export const OSTROVY = [
  ['domov', domov, 260, 260],
  ['sumivy_haj', sumivy_haj, 830, -180],
  ['zahrada', zahrada, -380, 720],
  ['hlinisko', hlinisko, 400, 1080],
  ['strazna_skala', strazna_skala, 1200, 470],
  ['perlovy_atol', perlovy_atol, -420, -400],
  ['ohniva_hora', ohniva_hora, 1850, -540],
  ['sirne_pramene', sirne_pramene, -150, 2080],
  ['krokodili_mociar', krokodili_mociar, -2750, 880],
  ['dzungla_predkov', dzungla_predkov, 620, -2900],
  ['ticha_zatoka', ticha_zatoka, ...ZATOKA],
].map(([id, def, x, z]) => ({ id, def, x, z }));
// maximalne ext (m) pre kazdy ostrov - aby sa neprekryvali (subor ostrova musi mat ext <= tomuto)
export const MAX_EXT = { domov: 240, sumivy_haj: 250, zahrada: 310, hlinisko: 220, strazna_skala: 190, perlovy_atol: 290,
  ohniva_hora: 390, sirne_pramene: 250, krokodili_mociar: 420, dzungla_predkov: 400,
  ticha_zatoka: 195 };
