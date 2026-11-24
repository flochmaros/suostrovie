// Obsah: nepriatelia. Logiku (stavy, pohyb, boj) ma src/nepriatelia.js, tu su len cisla a loot.
// stavy: tula -> honi -> napriah (telegraf) -> utok -> oddych -> honi ... ; pri nizkom zdravi utek.
//   zdravie   - zivoty;            rychlost - [tulanie, chodza, beh] (m/s)
//   zbadaj    - dosah zbadania hraca (m);   utok - dosah utoku (m)
//   napriah   - cas napriahnutia v s (viditelny telegraf, da sa uhnut);  oddych - pauza po utoku
//   dmg       - poskodenie hraca;  knock - sila odhodenia hraca;  utek - pod tolko % zdravia uteka (0 = neuteka)
//   pasmo     - najnizsie pasmo;  noc - len v noci;  biom - len na ostrove daneho biomu (null = plaz kdekolvek)
//   max       - strop poctu naraz;  bar/vyska - velkost a vyska HP pruhu
//   loot      - [[predmet, min, max, sanca 0..1]]
//   boss: true - strazca majaka: nespawnuje sa sam (pri majaku ho vyvola src/majak.js), velky HP pruh dole na obrazovke;
//     scale - nasobok modelu, polomer - polomer tela (dosah uderu hraca), dupot - druhy utok {dosah, napriah, dmg, knock} (kruh okolo seba),
//     fazaHp - pri tomto podiele zivotov zbesnie (rychlejsi, kratsi napriah)
//     vrh    - strela na hraca {dosah, min, napriah, sanca (za s), dmg, r (polomer dopadu), pocet, pocet2 (v 2. faze), druh 'lava'|'kamen'|'chapadlo'}
//              miesto dopadu je vopred oznacene kruhom na zemi - treba z neho odbehnut
//     vypad  - rychly vypad rovno na hraca {dosah, napriah, cas, rychlost, dmg, knock, sanca}
//     predok - m od stredu k tlame/pastiam (utok sa meria odtial; dlhi bossovia)
//     staticky - nehybe sa (kraken);  voda - sedi na hladine;  farba - farba castic;  ohnivzdorny - nehori (zeravy mec)
import * as THREE from 'three';
import { predmet } from './predmety.js';
import { ik } from '../ikony.js';

export const NEPRIATELIA = {
  nocny_krab: { meno: 'Nočný krab', zdravie: 3, rychlost: [0.6, 2.4, 3.4], zbadaj: 9, utok: 1.1, napriah: 0.5, oddych: 1.1,
    dmg: 6, knock: 7, utek: 0, pasmo: 1, noc: true, biom: null, max: 5, bar: [0.8, 0.12], vyska: 0.75,
    loot: [['krab', 1, 2, 1], ['musla', 1, 1, 0.3]] },
  lavovy_jaster: { meno: 'Lávový jašter', zdravie: 20, rychlost: [0.9, 2.6, 4.0], zbadaj: 14, utok: 2.0, napriah: 0.65, oddych: 1.3,
    dmg: 18, knock: 10, utek: 0.2, pasmo: 2, noc: false, biom: 'sopecny', max: 3, bar: [1.3, 0.16], vyska: 1.2,
    loot: [['jasterie_supiny', 2, 3, 1], ['sira', 1, 2, 0.5]] },
  obrovsky_krab: { meno: 'Obrovský krab', zdravie: 60, rychlost: [0.4, 1.4, 2.2], zbadaj: 24, utok: 3.6, napriah: 1.0, oddych: 1.7,
    dmg: 22, knock: 12, utek: 0, pasmo: 1, noc: false, biom: null, max: 1, bar: [3, 0.3], vyska: 2.6,
    boss: true, scale: 3.6, polomer: 1.2, dupot: { dosah: 6.5, napriah: 1.8, dmg: 28, knock: 16 }, fazaHp: 0.5,
    loot: [['srdce_strazcu_1', 1, 1, 1], ['krabi_pancier', 2, 2, 1], ['obrie_klepeto', 1, 1, 1], ['krab', 3, 4, 1], ['musla', 2, 3, 1]] },
  // ===== strazcovia majakov 2-5: velki a tazki (hrac ma 100 zivotov, ich uder berie tretinu) =====
  lavovy_obr: { meno: 'Pradávny lávový jašter', zdravie: 170, rychlost: [0.5, 2.0, 3.6], zbadaj: 32, utok: 3.5, predok: 4.5, napriah: 0.9, oddych: 1.3,
    dmg: 30, knock: 14, utek: 0, pasmo: 2, noc: false, biom: null, max: 1, bar: [3, 0.3], vyska: 4.5,
    boss: true, scale: 4.2, polomer: 2.4, farba: 0xff6a20, ohnivzdorny: true, fazaHp: 0.5,
    dupot: { dosah: 8, napriah: 1.6, dmg: 34, knock: 18 },
    vrh: { dosah: 32, min: 7, napriah: 1.2, sanca: 0.35, dmg: 26, r: 2.8, pocet: 1, pocet2: 3, druh: 'lava' },
    loot: [['srdce_strazcu_2', 1, 1, 1], ['lavova_supina', 3, 3, 1], ['zerave_jadro', 1, 1, 1], ['obsidian', 3, 5, 1], ['sira', 2, 3, 1]] },
  obrovsky_krokodil: { meno: 'Prastarý krokodíl', zdravie: 230, rychlost: [0.4, 1.8, 3.0], zbadaj: 32, utok: 3.5, predok: 7, napriah: 0.8, oddych: 1.5,
    dmg: 34, knock: 14, utek: 0, pasmo: 3, noc: false, biom: null, max: 1, bar: [3, 0.3], vyska: 3,
    boss: true, scale: 4, polomer: 2.4, farba: 0x9ab060, fazaHp: 0.5,
    dupot: { dosah: 9, napriah: 1.4, dmg: 28, knock: 20 },
    vypad: { dosah: 24, napriah: 1.1, cas: 0.8, rychlost: 19, dmg: 40, knock: 22, sanca: 0.45 },
    loot: [['srdce_strazcu_3', 1, 1, 1], ['krokodili_zub', 4, 4, 1], ['krokodilia_koza', 2, 2, 1]] },
  kraken: { meno: 'Kraken', zdravie: 270, rychlost: [0, 0, 0], zbadaj: 42, utok: 9, napriah: 1.0, oddych: 1.2,
    dmg: 32, knock: 16, utek: 0, pasmo: 4, noc: false, biom: null, max: 1, bar: [3, 0.3], vyska: 6,
    boss: true, scale: 3, polomer: 3.6, farba: 0xb070a0, staticky: true, voda: true, fazaHp: 0.5,
    dupot: { dosah: 11, napriah: 1.5, dmg: 30, knock: 22 },
    vrh: { dosah: 42, min: 0, napriah: 1.0, sanca: 0.6, dmg: 28, r: 2.4, pocet: 2, pocet2: 5, druh: 'chapadlo' },
    loot: [['srdce_strazcu_4', 1, 1, 1], ['atrament', 3, 3, 1], ['krakenove_chapadlo', 1, 1, 1], ['perla', 2, 4, 1]] },
  kamenny_golem: { meno: 'Kamenný golem', zdravie: 330, rychlost: [0.3, 1.3, 2.3], zbadaj: 36, utok: 4, predok: 2.5, napriah: 1.2, oddych: 1.5,
    dmg: 40, knock: 18, utek: 0, pasmo: 5, noc: false, biom: null, max: 1, bar: [3, 0.3], vyska: 9,
    boss: true, scale: 4.6, polomer: 2.2, farba: 0x9ad8e8, ohnivzdorny: true, fazaHp: 0.5,
    dupot: { dosah: 10, napriah: 1.8, dmg: 36, knock: 22 },
    vrh: { dosah: 38, min: 8, napriah: 1.4, sanca: 0.4, dmg: 34, r: 3.2, pocet: 1, pocet2: 3, druh: 'kamen' },
    loot: [['srdce_strazcu_5', 1, 1, 1], ['kamenne_jadro', 2, 2, 1], ['kamen', 8, 10, 1]] },
};

const SUPINY = new THREE.MeshStandardMaterial({ color: 0x3a2a24, roughness: 0.5, metalness: 0.3, emissive: 0xff5a10, emissiveIntensity: 0.6 });
predmet('jasterie_supiny', { meno: 'Jašterie šupiny', ikona: ik('spiral-shell', '#e0772f'), popis: 'Tvrdé šupiny lávového jaštera, ešte teplé. Hodia sa na pancier.',
  model: [new THREE.ConeGeometry(0.1, 0.22, 4).rotateZ(0.4).translate(0, 0.1, 0), SUPINY] });

predmet('srdce_strazcu_1', { meno: 'Srdce strážcu', kopa: 1, ikona: ik('hearts', '#e8473c'), popis: 'Ešte teplé srdce Obrovského kraba. Patrí do lampy majáka domovských ostrovov.',
  model: [new THREE.IcosahedronGeometry(0.16, 1).translate(0, 0.16, 0), new THREE.MeshStandardMaterial({ color: 0xc02a2a, roughness: 0.4, emissive: 0xff2010, emissiveIntensity: 0.9 })] });

// ---- trofeje Obrovského kraba (z nich sa vyrába Klepetový kyj a Krabia prilba, obsah/recepty.js) ----
const KRABI = new THREE.MeshStandardMaterial({ color: 0xc8422c, roughness: 0.55, metalness: 0.1 });
predmet('krabi_pancier', { meno: 'Krabí pancier', ikona: ik('spiral-shell', '#d0452f'), popis: 'Tvrdý červený pancier strážcu. Trofej – hodí sa na výnimočnú výbavu.',
  model: [new THREE.SphereGeometry(0.18, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1.2).translate(0, 0.04, 0), KRABI] });
predmet('obrie_klepeto', { meno: 'Obrie klepeto', kopa: 5, ikona: ik('crab', '#d0452f'), popis: 'Odrezané klepeto Obrovského kraba. Trofej – ťažké ako kladivo.',
  model: [new THREE.SphereGeometry(0.2, 10, 8).scale(1.3, 0.7, 0.8).translate(0, 0.15, 0), KRABI] });
// nositelny predmet: pravy klik na lisku (alebo H), logiku ma src/vystroj.js
predmet('krabia_prilba', { meno: 'Krabia prilba', kopa: 1, prilba: true, ikona: ik('spiral-shell', '#e0583a', ['crab', '#7a2414', .4, 330, 330]),
  popis: 'Z panciera strážcu. Nasadená (pravý klik na lište alebo H) znižuje prijaté poškodenie o 25 %.',
  model: [new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.03, 0), KRABI] });

// ---- srdcia strazcov 2-5 (patria do lampy majaka v danom pasme) ----
const srdce = (n, meno, hex, kde) => predmet(`srdce_strazcu_${n}`, { meno: 'Srdce strážcu', kopa: 1, ikona: ik('hearts', '#' + hex.toString(16).padStart(6, '0')), popis: `Srdce, ktoré vypadlo z ${meno}. Patrí do lampy majáka ${kde}.`,
  model: [new THREE.IcosahedronGeometry(0.16, 1).translate(0, 0.16, 0), new THREE.MeshStandardMaterial({ color: hex, roughness: 0.4, emissive: hex, emissiveIntensity: 0.9 })] });
srdce(2, 'Pradávneho lávového jaštera', 0xff7020, 'Sopečných ostrovov');
srdce(3, 'Prastarého krokodíla', 0x7ac040, 'v močiaroch');
srdce(4, 'Krakena', 0xb050e0, 'na Búrkových útesoch');
srdce(5, 'Kamenného golema', 0x40d8ff, 'v Hmlistých ostrovoch');

// ---- trofeje strazcov 2-5 (zbrane z nich: obsah/nastroje.js + recepty.js) ----
const trofej = (id, meno, hex, popis, geo, o = {}) => predmet(id, { meno, kopa: 10, ikona: ik('spiral-shell', '#' + hex.toString(16).padStart(6, '0')), popis: popis + ' Trofej strážcu.',
  model: [geo, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5, ...o })] });
trofej('lavova_supina', 'Lávová šupina', 0x3a1a12, 'Šupina veľká ako dlaň, zvnútra stále žeravá.', new THREE.ConeGeometry(0.14, 0.26, 4).rotateZ(0.4).translate(0, 0.12, 0), { emissive: 0xff5010, emissiveIntensity: 0.8 });
trofej('zerave_jadro', 'Žeravé jadro', 0xff5a10, 'Kus magmy, ktorý nevychladne.', new THREE.IcosahedronGeometry(0.15, 0).translate(0, 0.15, 0), { emissive: 0xff5a10, emissiveIntensity: 2 });
trofej('krokodili_zub', 'Krokodílí zub', 0xf3ecd6, 'Zub dlhý ako nôž.', new THREE.ConeGeometry(0.05, 0.3, 6).translate(0, 0.15, 0));
trofej('krokodilia_koza', 'Krokodília koža', 0x4a5a30, 'Hrubá pancierová koža.', new THREE.BoxGeometry(0.4, 0.04, 0.3).translate(0, 0.02, 0), { roughness: 0.9 });
trofej('atrament', 'Atrament krakena', 0x1a1030, 'Fľaštička čierneho atramentu z hlbín.', new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8).translate(0, 0.1, 0), { roughness: 0.2 });
trofej('krakenove_chapadlo', 'Chápadlo krakena', 0x6a2a4a, 'Odseknuté chápadlo, ešte sa mykne.', new THREE.CylinderGeometry(0.04, 0.1, 0.6, 8).rotateZ(1.4).translate(0, 0.08, 0));
trofej('kamenne_jadro', 'Kamenné jadro', 0x40e8ff, 'Runový kameň, ktorý golemovi dával život.', new THREE.DodecahedronGeometry(0.16, 0).translate(0, 0.16, 0), { emissive: 0x40e8ff, emissiveIntensity: 1.5 });

// ---- vystroj z trofeji strazcov 2-5 (nasadenie pravym klikom na liste, logika src/vystroj.js) ----
// modely su schvalne male a jednoduche (par primitiv)
const vyst = (id, meno, ikona, popis, geo, farba, o = {}) => predmet(id, { meno, kopa: 1, ikona, popis,
  model: [geo, new THREE.MeshStandardMaterial({ color: farba, roughness: 0.6, ...o })] });
vyst('ohnivzdorny_plast', 'Ohnivzdorný plášť', ik('spiral-shell', '#c8501e'), 'Plášť zo šupín lávového jaštera. Nasadený (pravý klik na lište) ťa ochráni pred lávovými kalužami.',
  new THREE.BoxGeometry(0.3, 0.03, 0.24).translate(0, 0.015, 0), 0x8a2a14, { emissive: 0xff4a10, emissiveIntensity: 0.25 });
vyst('kozene_cizmy', 'Kožené čižmy', ik('spiral-shell', '#6a7a3a'), 'Čižmy z krokodílej kože. Nasadené (pravý klik na lište) – o 25 % rýchlejší pohyb v močiari.',
  new THREE.CylinderGeometry(0.06, 0.07, 0.14, 6).translate(0, 0.07, 0), 0x4a5a30, { roughness: 0.9 });
vyst('amulet_hlbin', 'Amulet hlbín', ik('glass-ball', '#a060e0'), 'Perla v atramente krakena. Nasadený (pravý klik na lište) – vydržíš pod vodou dvakrát dlhšie.',
  new THREE.OctahedronGeometry(0.07, 0).translate(0, 0.07, 0), 0x5a2a9a, { emissive: 0x8040e0, emissiveIntensity: 0.6 });
vyst('kompas_hmly', 'Kompas hmly', ik('glass-ball', '#40d8ff'), 'Úlomok kamenného jadra sa vždy otočí k nezapálenému majáku. Stačí ho mať v batohu.',
  new THREE.CylinderGeometry(0.08, 0.08, 0.03, 8).translate(0, 0.015, 0), 0x40c8e8, { emissive: 0x40e8ff, emissiveIntensity: 0.5 });
