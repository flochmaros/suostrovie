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
