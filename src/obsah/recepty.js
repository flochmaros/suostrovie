// Recepty na vyrobu. Pridavaju sa takto:
//   recept({ id, skupina: 'Nástroje', vysledok: ['kamenna_sekera', 1], suroviny: [['palica', 1], ['kamen', 2], ['vlakno', 2]] });
// Nepovinne: meno, ikona (inak z vysledku), podmienka: () => bool (false = recept sa skryje),
// akcia: () => void (zavola sa namiesto pridania vysledku; vrati false = zrusi vyrobu a vrati suroviny)
// (vysledny predmet musi byt v obsah/predmety.js alebo obsah/nastroje.js)
export const RECEPTY = [];
export function recept(def) { RECEPTY.push(def); }

const N = 'Nástroje';
// zaciatocne nastroje: palica + kamen + vlakno
recept({ id: 'kamenna_sekera', skupina: N, vysledok: ['kamenna_sekera', 1], suroviny: [['palica', 1], ['kamen', 2], ['vlakno', 2]] });
recept({ id: 'kamenny_krompac', skupina: N, vysledok: ['kamenny_krompac', 1], suroviny: [['palica', 1], ['kamen', 3], ['vlakno', 2]] });
recept({ id: 'kamenny_noz', skupina: N, vysledok: ['kamenny_noz', 1], suroviny: [['palica', 1], ['kamen', 1], ['vlakno', 1]] });
recept({ id: 'kyj', skupina: N, vysledok: ['kyj', 1], suroviny: [['drevo', 2], ['vlakno', 1]] });
recept({ id: 'bambusova_ostep', skupina: N, vysledok: ['bambusova_ostep', 1], suroviny: [['bambus', 2], ['vlakno', 1]] });
// druhy stupen: lepsie materialy, vacsia trvanlivost
recept({ id: 'lasturova_sekera', skupina: N, vysledok: ['lasturova_sekera', 1], suroviny: [['palica', 1], ['musla', 3], ['vlakno', 3], ['kamen', 1]] });
recept({ id: 'spevneny_krompac', skupina: N, vysledok: ['spevneny_krompac', 1], suroviny: [['drevo', 1], ['palica', 1], ['kamen', 4], ['vlakno', 3]] });
recept({ id: 'macheta', skupina: N, vysledok: ['macheta', 1], suroviny: [['bambus', 1], ['kamen', 2], ['vlakno', 2]] });
recept({ id: 'kamenna_ostep', skupina: N, vysledok: ['kamenna_ostep', 1], suroviny: [['bambus', 2], ['kamen', 1], ['vlakno', 2]] });

// obsidian (sopecne ostrovy): silnejsie, ale krehke
recept({ id: 'obsidianova_sekera', skupina: N, vysledok: ['obsidianova_sekera', 1], suroviny: [['palica', 1], ['obsidian', 3], ['vlakno', 2]] });
recept({ id: 'obsidianovy_krompac', skupina: N, vysledok: ['obsidianovy_krompac', 1], suroviny: [['palica', 1], ['obsidian', 4], ['vlakno', 2]] });
recept({ id: 'obsidianovy_noz', skupina: N, vysledok: ['obsidianovy_noz', 1], suroviny: [['palica', 1], ['obsidian', 2], ['vlakno', 1]] });
recept({ id: 'obsidianovy_mec', skupina: N, vysledok: ['obsidianovy_mec', 1], suroviny: [['drevo', 1], ['obsidian', 5], ['vlakno', 3]] });

// tabor: taborak (polozi sa klavesou F)
recept({ id: 'taborak', skupina: 'Tábor', vysledok: ['taborak', 1], suroviny: [['kamen', 5], ['drevo', 2], ['palica', 2]] });

// stavba: zakladne diely sa stavaju z menu B na mriezku 2 m (stavba.js), nevyrabaju sa do batohu
recept({ id: 'podlaha', stavba: 'podlaha', skupina: 'Stavba', meno: 'Podlaha', ikona: '🟫', popis: 'Drevená plošina 2×2 m na nohách.', suroviny: [['drevo', 3], ['palica', 4], ['vlakno', 2]] });
recept({ id: 'stena', stavba: 'stena', skupina: 'Stavba', meno: 'Stena', ikona: '🧱', popis: 'Zrubová stena 2×2 m. Prichytí sa na hranu podlahy.', suroviny: [['drevo', 4], ['vlakno', 2]] });
recept({ id: 'strecha', stavba: 'strecha', skupina: 'Stavba', meno: 'Strecha', ikona: '🛖', popis: 'Šikmá strecha z listov na vrch stien. Dá sa na nej stáť.', suroviny: [['list', 6], ['palica', 3], ['vlakno', 2]] });

// lodenica: polozi sa klavesou F pri brehu; v nej sa stavaju a vylepsuju lode
recept({ id: 'lodenica', skupina: 'Tábor', vysledok: ['lodenica', 1], suroviny: [['drevo', 20], ['bambus', 10], ['vlakno', 12], ['list', 10], ['kamen', 6]] });
