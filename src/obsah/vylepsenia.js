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
