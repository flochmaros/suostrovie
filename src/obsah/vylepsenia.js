// Vylepsenia kanoe ako recepty (skupina 'Kanoe'). Odomknu sa postupne: plachta -> vacsie kanoe -> dvojtrupova plachetnica.
// main.js po vytvoreni kanoe zavola nastavKanoe(kanoe).
import { recept } from './recepty.js';

let kanoe = null;
export function nastavKanoe(k) { kanoe = k; }

const uroven = () => kanoe?.uroven ?? 1;

recept({
  id: 'kanoe_plachta', skupina: 'Kanoe', meno: 'Kanoe – plachta', ikona: '⛵',
  suroviny: [['drevo', 10], ['vlakno', 6], ['list', 8]],
  podmienka: () => !!kanoe && uroven() === 1,
  akcia: () => kanoe.nastavUroven(2),
});

recept({
  id: 'kanoe_velke', skupina: 'Kanoe', meno: 'Kanoe – väčší trup a plavák', ikona: '🛶',
  suroviny: [['drevo', 20], ['bambus', 10], ['vlakno', 12], ['list', 10]],
  podmienka: () => !!kanoe && uroven() === 2,
  akcia: () => kanoe.nastavUroven(3),
});

recept({
  id: 'kanoe_dvojtrup', skupina: 'Kanoe', meno: 'Kanoe – dvojtrupová plachetnica', ikona: '⛵',
  suroviny: [['drevo', 40], ['bambus', 20], ['vlakno', 25], ['list', 20], ['kamen', 6]],
  podmienka: () => !!kanoe && uroven() === 3,
  akcia: () => kanoe.nastavUroven(4),
});

// ---------- vylepsenia rychlosti a obratnosti (3 stupne kazde, kazdy stupen drahsi) ----------
const VYL = [
  { kluc: 'pad', meno: 'Silnejšie pádlo', ikona: '🏓', od: 1, popis: '+15 % ťah pádla',
    cena: [[['bambus', 4], ['vlakno', 4]], [['bambus', 8], ['vlakno', 8], ['kamen', 3]], [['drevo', 10], ['bambus', 12], ['vlakno', 12], ['musla', 6]]] },
  { kluc: 'plachta', meno: 'Lepšia plachta', ikona: '⛵', od: 2, popis: '+20 % sila plachty',
    cena: [[['list', 8], ['vlakno', 8]], [['list', 14], ['vlakno', 14], ['bambus', 4]], [['list', 22], ['vlakno', 22], ['bambus', 8], ['musla', 6]]] },
  { kluc: 'trup', meno: 'Hladší trup (rýchlejšia plavba)', ikona: '💨', od: 1, popis: '−7 % odpor vody',
    cena: [[['drevo', 6], ['vlakno', 4]], [['drevo', 12], ['vlakno', 8], ['kamen', 4]], [['drevo', 20], ['vlakno', 14], ['kamen', 8], ['musla', 6]]] },
  { kluc: 'kyl', meno: 'Väčší kýl (obratnosť)', ikona: '🧭', od: 1, popis: '+15 % obratnosť',
    cena: [[['drevo', 5], ['kamen', 2]], [['drevo', 10], ['kamen', 5], ['vlakno', 6]], [['drevo', 16], ['kamen', 8], ['vlakno', 12], ['bambus', 6]]] },
];
for (const v of VYL) v.cena.forEach((suroviny, i) => recept({
  id: `kanoe_${v.kluc}_${i + 1}`, skupina: 'Kanoe', meno: `${v.meno} ${'I'.repeat(i + 1)}`, ikona: v.ikona, suroviny,
  podmienka: () => !!kanoe && uroven() >= v.od && kanoe.vyl[v.kluc] === i,
  akcia: () => kanoe.vylepsi(v.kluc, i + 1),
}));

// ---------- typy kanoe na rozny ucel (od urovne 2; prepinanie medzi typmi je lacne) ----------
const TYPY = [
  { id: 'pretekove', meno: 'Typ: Pretekárske kanoe (rýchle, menej obratné)', ikona: '🏁', suroviny: [['drevo', 14], ['bambus', 10], ['vlakno', 10], ['list', 6]] },
  { id: 'rybarske', meno: 'Typ: Rybárske kanoe (obratné, stabilné)', ikona: '🎣', suroviny: [['drevo', 12], ['bambus', 6], ['vlakno', 8], ['musla', 4]] },
  { id: 'nakladne', meno: 'Typ: Nákladné kanoe (pomalé, veľmi stabilné)', ikona: '📦', suroviny: [['drevo', 20], ['bambus', 8], ['vlakno', 12], ['kamen', 4]] },
  { id: 'zakladne', meno: 'Typ: späť na Základné kanoe', ikona: '🛶', suroviny: [['vlakno', 2]] },
];
for (const t of TYPY) recept({
  id: `kanoe_typ_${t.id}`, skupina: 'Kanoe', meno: t.meno, ikona: t.ikona, suroviny: t.suroviny,
  podmienka: () => !!kanoe && uroven() >= 2 && kanoe.typ !== t.id,
  akcia: () => kanoe.nastavTyp(t.id),
});
