// Recepty na vyrobu (zatial ziadne). Pridavaju sa takto:
//   recept({ id: 'kamenna_sekera', vysledok: ['kamenna_sekera', 1], suroviny: [['palica', 1], ['kamen', 1], ['vlakno', 2]] });
// (vysledny predmet musi byt v obsah/predmety.js)
export const RECEPTY = [];
export function recept(def) { RECEPTY.push(def); }
