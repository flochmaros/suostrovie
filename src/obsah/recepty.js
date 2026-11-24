// Recepty na vyrobu. Pridavaju sa takto:
//   recept({ id, skupina: 'Nástroje', vysledok: ['kamenna_sekera', 1], suroviny: [['palica', 1], ['kamen', 2], ['vlakno', 2]] });
// Nepovinne: meno, ikona (inak z vysledku), podmienka: () => bool (false = recept sa skryje),
// akcia: () => void (zavola sa namiesto pridania vysledku; vrati false = zrusi vyrobu a vrati suroviny)
// (vysledny predmet musi byt v obsah/predmety.js alebo obsah/nastroje.js)
import { ik } from '../ikony.js';
import { pocet } from '../inventar.js';
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
recept({ id: 'podlaha', stavba: 'podlaha', skupina: 'Stavba', meno: 'Podlaha', ikona: ik('packed-planks', '#b88a56'), popis: 'Drevená plošina 2×2 m na nohách.', suroviny: [['drevo', 3], ['palica', 4], ['vlakno', 2]] });
recept({ id: 'stena', stavba: 'stena', skupina: 'Stavba', meno: 'Stena', ikona: ik('wood-pile', '#a87340'), popis: 'Zrubová stena 2×2 m. Prichytí sa na hranu podlahy.', suroviny: [['drevo', 4], ['vlakno', 2]] });
recept({ id: 'strecha', stavba: 'strecha', skupina: 'Stavba', meno: 'Strecha', ikona: ik('hut', '#d6b86a'), popis: 'Šikmá strecha z listov na vrch stien. Dá sa na nej stáť.', suroviny: [['list', 6], ['palica', 3], ['vlakno', 2]] });

// lodenica: polozi sa klavesou F pri brehu; v nej sa stavaju a vylepsuju lode
recept({ id: 'lodenica', skupina: 'Tábor', vysledok: ['lodenica', 1], suroviny: [['drevo', 20], ['bambus', 10], ['vlakno', 12], ['list', 10], ['kamen', 6]] });

// trofeje bossov: recepty sa zobrazia, az ked hrac niekedy mal trofej (pamata si to v localStorage)
const MA_TROFEJ = () => { try { if (pocet('krabi_pancier') + pocet('obrie_klepeto') > 0) localStorage.setItem('hra_trofej', '1'); return localStorage.getItem('hra_trofej') === '1'; } catch (e) { return true; } };
recept({ id: 'klepetovy_kyj', skupina: N, vysledok: ['klepetovy_kyj', 1], podmienka: MA_TROFEJ, suroviny: [['obrie_klepeto', 1], ['krabi_pancier', 2], ['drevo', 1], ['vlakno', 1]] });
recept({ id: 'krabia_prilba', skupina: 'Výstroj', vysledok: ['krabia_prilba', 1], podmienka: MA_TROFEJ, suroviny: [['krabi_pancier', 3], ['vlakno', 1]] });
// trofeje strazcov 2-5: recept sa ukaze, ked hrac niekedy mal danu trofej
const malTrofej = id => () => { try { if (pocet(id) > 0) localStorage.setItem('hra_trofej_' + id, '1'); return localStorage.getItem('hra_trofej_' + id) === '1'; } catch (e) { return true; } };
recept({ id: 'zeravy_mec', skupina: N, vysledok: ['zeravy_mec', 1], podmienka: malTrofej('zerave_jadro'), suroviny: [['zerave_jadro', 1], ['lavova_supina', 2], ['obsidian', 3], ['drevo', 1]] });
recept({ id: 'krokodilia_harpuna', skupina: N, vysledok: ['krokodilia_harpuna', 1], podmienka: malTrofej('krokodili_zub'), suroviny: [['krokodili_zub', 3], ['krokodilia_koza', 1], ['drevo', 2], ['vlakno', 2]] });
recept({ id: 'trojzubec', skupina: N, vysledok: ['trojzubec', 1], podmienka: malTrofej('krakenove_chapadlo'), suroviny: [['krakenove_chapadlo', 1], ['atrament', 2], ['perla', 3], ['drevo', 2]] });
recept({ id: 'runove_kladivo', skupina: N, vysledok: ['runove_kladivo', 1], podmienka: malTrofej('kamenne_jadro'), suroviny: [['kamenne_jadro', 1], ['kamen', 10], ['zivica', 2], ['drevo', 2]] });
// vystroj z trofeji strazcov 2-5 (src/vystroj.js)
recept({ id: 'ohnivzdorny_plast', skupina: 'Výstroj', vysledok: ['ohnivzdorny_plast', 1], podmienka: malTrofej('lavova_supina'), suroviny: [['lavova_supina', 1], ['jasterie_supiny', 4], ['vlakno', 3]] });
recept({ id: 'kozene_cizmy', skupina: 'Výstroj', vysledok: ['kozene_cizmy', 1], podmienka: malTrofej('krokodilia_koza'), suroviny: [['krokodilia_koza', 1], ['vlakno', 2]] });
recept({ id: 'amulet_hlbin', skupina: 'Výstroj', vysledok: ['amulet_hlbin', 1], podmienka: malTrofej('atrament'), suroviny: [['atrament', 1], ['perla', 1], ['vlakno', 1]] });
recept({ id: 'kompas_hmly', skupina: 'Výstroj', vysledok: ['kompas_hmly', 1], podmienka: malTrofej('kamenne_jadro'), suroviny: [['kamenne_jadro', 1], ['kamen', 3], ['zivica', 1]] });
