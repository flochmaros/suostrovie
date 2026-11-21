// Lodenica: recepty s lodenica:true (vidno ich len v okne lodenice, viz inventar.js).
//   - postavit novu lod (kanoe, pretekarske, barza, katamaran) - objavi sa na vode pri splave
//   - vylepsit najblizsiu lod: uroven kanoe + vylepsenia (padlo, plachta, trup, kyl; 3 stupne)
// main.js po starte zavola nastavLodenicu({ lod, postav }).
import { recept } from './recepty.js';
import { DRUHY } from '../kanoe.js';

let ctx = { lod: () => null, postav: () => false };   // lod() = najblizsia lod (alebo null), postav(druh) = false ked nie je miesto
export const nastavLodenicu = c => { ctx = c; };

const R = d => recept({ ...d, lodenica: true });   // lodenica: true = recept sa ukaze len v okne lodenice

// ---------- nove lode ----------
const LODE = [
  { druh: 'kanoe', ikona: '🛶', suroviny: [['drevo', 12], ['vlakno', 8], ['list', 4]], popis: 'Základné kanoe (6 políčok skladu)' },
  { druh: 'pretekove', ikona: '🏁', suroviny: [['drevo', 20], ['bambus', 14], ['vlakno', 14], ['list', 10], ['musla', 6]], popis: 'rýchle, 4 políčka' },
  { druh: 'barza', ikona: '📦', suroviny: [['drevo', 40], ['bambus', 10], ['vlakno', 20], ['list', 8], ['kamen', 6]], popis: 'pomalá, 36 políčok' },
  { druh: 'katamaran', ikona: '⛵', suroviny: [['drevo', 60], ['bambus', 30], ['vlakno', 40], ['list', 30], ['kamen', 12], ['musla', 12]], popis: 'veľká a rýchla, 40 políčok' },
];
for (const l of LODE) R({
  id: `lod_${l.druh}`, skupina: 'Postaviť loď', meno: `${DRUHY[l.druh].nazov} – ${l.popis}`, ikona: l.ikona, suroviny: l.suroviny,
  akcia: () => ctx.postav(l.druh),
});

// ---------- vylepsenia kanoe (urovne s plachtou a plavakom) ----------
const UROVNE = [
  { z: 1, na: 2, meno: 'Kanoe – plachta', ikona: '⛵', suroviny: [['drevo', 10], ['vlakno', 6], ['list', 8]] },
  { z: 2, na: 3, meno: 'Kanoe – väčší trup a plavák', ikona: '🛶', suroviny: [['drevo', 20], ['bambus', 10], ['vlakno', 12], ['list', 10]] },
  { z: 3, na: 4, meno: 'Kanoe – dvojtrupová plachetnica', ikona: '⛵', suroviny: [['drevo', 40], ['bambus', 20], ['vlakno', 25], ['list', 20], ['kamen', 6]] },
];
for (const u of UROVNE) R({
  id: `kanoe_ur${u.na}`, skupina: 'Vylepšiť najbližšiu loď', meno: u.meno, ikona: u.ikona, suroviny: u.suroviny,
  podmienka: () => { const l = ctx.lod(); return l?.druh === 'kanoe' && l.uroven === u.z; },
  akcia: () => ctx.lod().nastavUroven(u.na),
});

// ---------- vylepsenia rychlosti a obratnosti (3 stupne, kazdy drahsi) ----------
const VYL = [
  { kluc: 'pad', meno: 'Silnejšie pádlo / vesla', ikona: '🏓', cena: [[['bambus', 4], ['vlakno', 4]], [['bambus', 8], ['vlakno', 8], ['kamen', 3]], [['drevo', 10], ['bambus', 12], ['vlakno', 12], ['musla', 6]]] },
  { kluc: 'plachta', meno: 'Lepšia plachta', ikona: '🧵', plachta: true, cena: [[['list', 8], ['vlakno', 8]], [['list', 14], ['vlakno', 14], ['bambus', 4]], [['list', 22], ['vlakno', 22], ['bambus', 8], ['musla', 6]]] },
  { kluc: 'trup', meno: 'Hladší trup (menší odpor vody)', ikona: '💨', cena: [[['drevo', 6], ['vlakno', 4]], [['drevo', 12], ['vlakno', 8], ['kamen', 4]], [['drevo', 20], ['vlakno', 14], ['kamen', 8], ['musla', 6]]] },
  { kluc: 'kyl', meno: 'Väčší kýl (obratnosť)', ikona: '🧭', cena: [[['drevo', 5], ['kamen', 2]], [['drevo', 10], ['kamen', 5], ['vlakno', 6]], [['drevo', 16], ['kamen', 8], ['vlakno', 12], ['bambus', 6]]] },
];
for (const v of VYL) v.cena.forEach((suroviny, i) => R({
  id: `lod_${v.kluc}_${i + 1}`, skupina: 'Vylepšiť najbližšiu loď', meno: `${v.meno} ${'I'.repeat(i + 1)}`, ikona: v.ikona, suroviny,
  podmienka: () => { const l = ctx.lod(); return !!l && l.vyl[v.kluc] === i && (!v.plachta || !!l.plachta); },
  akcia: () => ctx.lod().vylepsi(v.kluc, i + 1),
}));
