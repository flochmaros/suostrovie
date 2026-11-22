// Lodenica: recepty s lodenica:true (vidno ich len v okne lodenice, viz inventar.js).
//   - postavit novu lod (kanoe, pretekarske, barza, katamaran) - objavi sa na vode pri splave
//   - vylepsit najblizsiu lod: uroven kanoe + vylepsenia (padlo, plachta, trup, kyl; 3 stupne)
// main.js po starte zavola nastavLodenicu({ lod, postav }).
import { recept } from './recepty.js';
import { DRUHY } from '../kanoe.js';
import { ik } from '../ikony.js';

let ctx = { lod: () => null, postav: () => false };   // lod() = najblizsia lod (alebo null), postav(druh) = false ked nie je miesto
export const nastavLodenicu = c => { ctx = c; };

const R = d => recept({ ...d, lodenica: true });   // lodenica: true = recept sa ukaze len v okne lodenice

// ---------- nove lode ----------
const LODE = [
  { druh: 'kanoe', ikona: ik('wood-canoe', '#b07a45'), suroviny: [['drevo', 12], ['vlakno', 8], ['list', 4]], popis: 'Základné kanoe (6 políčok skladu)' },
  { druh: 'pretekove', ikona: ik('canoe', '#d0643a'), suroviny: [['drevo', 20], ['bambus', 14], ['vlakno', 14], ['list', 10], ['musla', 6]], popis: 'rýchle, 4 políčka' },
  { druh: 'barza', ikona: ik('raft', '#a87340'), suroviny: [['drevo', 40], ['bambus', 10], ['vlakno', 20], ['list', 8], ['kamen', 6]], popis: 'pomalá, 36 políčok' },
  { druh: 'katamaran', ikona: ik('sailboat', '#efe6cf'), suroviny: [['drevo', 60], ['bambus', 30], ['vlakno', 40], ['list', 30], ['kamen', 12], ['musla', 12]], popis: 'veľká a rýchla, 40 políčok' },
];
for (const l of LODE) R({
  id: `lod_${l.druh}`, skupina: 'Postaviť loď', meno: `${DRUHY[l.druh].nazov} – ${l.popis}`, ikona: l.ikona, suroviny: l.suroviny,
  akcia: () => ctx.postav(l.druh),
});

// ---------- vylepsenia kanoe (urovne s plachtou a plavakom) ----------
const UROVNE = [
  { z: 1, na: 2, meno: 'Kanoe – plachta', ikona: ik('sail', '#efe6cf'), suroviny: [['drevo', 10], ['vlakno', 6], ['list', 8]] },
  { z: 2, na: 3, meno: 'Kanoe – väčší trup a plavák (utesnený hlinou)', ikona: ik('wood-canoe', '#b07a45'), suroviny: [['drevo', 20], ['bambus', 10], ['vlakno', 12], ['list', 10], ['hlina', 6]] },
  { z: 3, na: 4, meno: 'Kanoe – dvojtrupová plachetnica', ikona: ik('sailboat', '#efe6cf'), suroviny: [['drevo', 40], ['bambus', 20], ['vlakno', 25], ['list', 20], ['kamen', 6], ['zivica', 8]] },
];
for (const u of UROVNE) R({
  id: `kanoe_ur${u.na}`, skupina: 'Vylepšiť najbližšiu loď', meno: u.meno, ikona: u.ikona, suroviny: u.suroviny,
  podmienka: () => { const l = ctx.lod(); return l?.druh === 'kanoe' && l.uroven === u.z; },
  akcia: () => ctx.lod().nastavUroven(u.na),
});

// ---------- vylepsenia rychlosti a obratnosti (3 stupne, kazdy drahsi) ----------
const VYL = [
  { kluc: 'pad', meno: 'Silnejšie pádlo / vesla', ikona: ik('paddles', '#c9a06a'), cena: [[['bambus', 4], ['vlakno', 4]], [['bambus', 8], ['vlakno', 8], ['kamen', 3]], [['drevo', 10], ['bambus', 12], ['vlakno', 12], ['musla', 6]]] },
  { kluc: 'plachta', meno: 'Lepšia plachta', ikona: ik('sail', '#efe6cf'), plachta: true, cena: [[['list', 8], ['vlakno', 8]], [['list', 14], ['vlakno', 14], ['bambus', 4]], [['list', 22], ['vlakno', 22], ['bambus', 8], ['musla', 6]]] },
  { kluc: 'trup', meno: 'Hladší trup (menší odpor vody)', ikona: ik('ship-bow', '#b07a45'), cena: [[['drevo', 6], ['vlakno', 4]], [['drevo', 12], ['vlakno', 8], ['kamen', 4]], [['drevo', 20], ['vlakno', 14], ['kamen', 8], ['musla', 6]]] },
  { kluc: 'sklad', meno: 'Väčší sklad (+4 políčka)', ikona: ik('wooden-crate', '#a87340'), cena: [[['drevo', 6], ['vlakno', 6]], [['drevo', 12], ['vlakno', 10], ['bambus', 6]], [['drevo', 20], ['vlakno', 16], ['bambus', 10], ['kamen', 4]]] },
  { kluc: 'kyl', meno: 'Väčší kýl (obratnosť)', ikona: ik('kyl', '#b07a45'), cena: [[['drevo', 5], ['kamen', 2]], [['drevo', 10], ['kamen', 5], ['vlakno', 6]], [['drevo', 16], ['kamen', 8], ['vlakno', 12], ['bambus', 6]]] },
];
for (const v of VYL) v.cena.forEach((suroviny, i) => R({
  id: `lod_${v.kluc}_${i + 1}`, skupina: 'Vylepšiť najbližšiu loď', meno: `${v.meno} ${'I'.repeat(i + 1)}`, ikona: v.ikona, suroviny,
  podmienka: () => { const l = ctx.lod(); return !!l && l.vyl[v.kluc] === i && (!v.plachta || !!l.plachta); },
  akcia: () => ctx.lod().vylepsi(v.kluc, i + 1),
}));

// ---------- vylepsenia konkretnej lode (3 stupne; kanoe ma svoje urovne vyssie): vacsia plachta, pevnejsi trup, rychlejsie padlo/vesla ----------
const LOD_VYL = {
  pretekove: [['Dlhší bambusový sťažeň', ik('sail', '#efe6cf'), [['bambus', 10], ['vlakno', 8], ['list', 6]]], ['Vystužený trup', ik('ship-bow', '#d0643a'), [['drevo', 10], ['bambus', 12], ['vlakno', 10], ['musla', 4]]], ['Ľahké plaváky', ik('wood-canoe', '#d0643a'), [['bambus', 20], ['vlakno', 16], ['kamen', 6], ['musla', 8]]]],
  barza: [['Väčšia štvorcová plachta', ik('sail', '#efe6cf'), [['list', 14], ['vlakno', 12], ['drevo', 8]]], ['Vystužené klady', ik('packed-planks', '#b88a56'), [['drevo', 24], ['vlakno', 14], ['kamen', 6]]], ['Dlhé kormidlové veslo', ik('paddles', '#c9a06a'), [['drevo', 30], ['bambus', 14], ['vlakno', 18], ['musla', 6]]]],
  katamaran: [['Génua (predná plachta)', ik('sail', '#efe6cf'), [['list', 24], ['vlakno', 18], ['bambus', 10]]], ['Vystužené trupy', ik('ship-bow', '#b07a45'), [['drevo', 36], ['vlakno', 22], ['kamen', 10]]], ['Navigačné lano a kormidlo', ik('rope-coil', '#c9a36a'), [['drevo', 40], ['bambus', 20], ['vlakno', 30], ['kamen', 12], ['musla', 10]]]],
};
for (const [druh, stupne] of Object.entries(LOD_VYL)) stupne.forEach(([meno, ikona, suroviny], i) => R({
  id: `lod_${druh}_tr${i + 1}`, skupina: 'Vylepšiť najbližšiu loď', meno: `${DRUHY[druh].nazov}: ${meno}`, ikona, suroviny,
  podmienka: () => { const l = ctx.lod(); return l?.druh === druh && l.vyl.tr === i; },
  akcia: () => ctx.lod().vylepsi('tr', i + 1),
}));
