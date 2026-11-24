// Vystroj (nositelne veci): 5 sad brnenia x 4 kusy (hlava, telo, nohy, cizmy) + specialne kusy (plast, cizmy z kroka, amulet).
// VYBAVA[id] = { slot, obrana (0-1 = o kolko znizi poskodenie), efekt, tier }. Kusy brnenia sa skladaju: spolu max 80 %, cela sada +5 %.
// Novy kus = zaznam v SADY / predmet + VYBAVA tu. Nasadzuje sa v batohu (src/vystroj.js), model: src/modely_vystroja.js.
import './nepriatelia.js';                      // aby sa predmety z trofeji registrovali pred nami (a my ich mohli doplnit)
import { predmet, PREDMETY } from './predmety.js';
import { recept } from './recepty.js';
import { pocet } from '../inventar.js';
import { ik } from '../ikony.js';
import { modelKusu, TIERY } from '../modely_vystroja.js';

export const SLOTY = [['hlava', 'Hlava'], ['telo', 'Telo'], ['nohy', 'Nohy'], ['cizmy', 'Čižmy'], ['plast', 'Plášť'], ['amulet', 'Amulet']];
export const VYBAVA = {};
export const BONUS_SADY = 0.05, MAX_OBRANA = 0.8;
const PODIEL = { hlava: 0.2, telo: 0.4, nohy: 0.25, cizmy: 0.15 };   // z celkovej obrany sady

// sada: [tier, nazov, celkova obrana, [hlava, telo, nohy, cizmy] id + meno, [recepty...], podmienka]
const SADY = [
  ['list', 'Listová', 0.10, [['listova_koruna', 'Listová koruna'], ['listova_vesta', 'Listová vesta'], ['listova_sukna', 'Listová sukňa'], ['listove_sandale', 'Listové sandále']],
    [[['list', 4], ['vlakno', 1]], [['list', 8], ['vlakno', 3]], [['list', 6], ['vlakno', 2]], [['list', 4], ['vlakno', 1]]]],
  ['bambus', 'Bambusová', 0.20, [['bambusova_prilba', 'Bambusová prilba'], ['bambusovy_pancier', 'Bambusový pancier'], ['bambusove_nohavice', 'Bambusové nohavice'], ['bambusove_cizmy', 'Bambusové čižmy']],
    [[['bambus', 3], ['vlakno', 2]], [['bambus', 6], ['vlakno', 4]], [['bambus', 5], ['vlakno', 3]], [['bambus', 3], ['vlakno', 2]]]],
  ['lastura', 'Lastúrová', 0.30, [['lasturova_prilba', 'Lastúrová prilba'], ['lasturovy_pancier', 'Lastúrový pancier'], ['lasturove_nohavice', 'Lastúrové nohavice'], ['lasturove_cizmy', 'Lastúrové čižmy']],
    [[['musla', 4], ['vlakno', 2]], [['musla', 8], ['bambus', 2], ['vlakno', 4]], [['musla', 6], ['vlakno', 3]], [['musla', 4], ['vlakno', 2]]]],
  ['krab', 'Krabia', 0.40, [['krabia_prilba', 'Krabia prilba'], ['krabie_brnenie', 'Krabie brnenie'], ['krabie_nohavice', 'Krabie nohavice'], ['krabie_cizmy', 'Krabie čižmy']],
    [[['krabi_pancier', 3], ['vlakno', 1]], [['krabi_pancier', 5], ['vlakno', 3]], [['krabi_pancier', 3], ['vlakno', 2]], [['krabi_pancier', 2], ['vlakno', 1]]], 'krabi_pancier'],
  ['supina', 'Šupinová', 0.50, [['supinova_prilba', 'Šupinová prilba'], ['supinove_brnenie', 'Šupinové brnenie'], ['supinove_nohavice', 'Šupinové nohavice'], ['supinove_cizmy', 'Šupinové čižmy']],
    [[['lavova_supina', 1], ['jasterie_supiny', 2], ['vlakno', 1]], [['lavova_supina', 3], ['jasterie_supiny', 4], ['vlakno', 3]], [['lavova_supina', 2], ['jasterie_supiny', 3], ['vlakno', 2]], [['lavova_supina', 1], ['jasterie_supiny', 2], ['vlakno', 1]]], 'lavova_supina'],
];
const SLOTY_SADY = ['hlava', 'telo', 'nohy', 'cizmy'];
export const SADA_PODLA_TIERU = {};   // tier -> [id x4] (pre bonus celej sady)

// recept z trofeje je viditelny, ked hrac trofej niekedy mal (pamata si localStorage)
const malTrofej = id => () => { try { if (pocet(id) > 0) localStorage.setItem('hra_trofej_' + id, '1'); return localStorage.getItem('hra_trofej_' + id) === '1'; } catch (e) { return true; } };

for (const [tier, , celkom, kusy, recepty, trofej] of SADY) {
  SADA_PODLA_TIERU[tier] = kusy.map(k => k[0]);
  kusy.forEach(([id, meno], i) => {
    const slot = SLOTY_SADY[i], obrana = Math.round(celkom * PODIEL[slot] * 1000) / 1000;
    VYBAVA[id] = { slot, obrana, tier, efekt: `−${(obrana * 100).toFixed(obrana * 100 % 1 ? 1 : 0)} % poškodenia` };
    const farba = '#' + TIERY[tier].f.toString(16).padStart(6, '0');
    predmet(id, { meno, kopa: 1, vybava: true, ikona: ik('spiral-shell', farba), model: modelKusu(slot, tier),
      popis: `${SLOTY[i][1]}: znižuje prijaté poškodenie o ${(obrana * 100).toFixed(obrana * 100 % 1 ? 1 : 0)} %. Celá sada +${BONUS_SADY * 100} %. Nasadíš ju v batohu (Tab) – ťahaj na postavu alebo pravý klik.` });
    recept_(id, recepty[i], trofej);
  });
}
function recept_(id, suroviny, trofej) { recept({ id, skupina: 'Výstroj', vysledok: [id, 1], suroviny, podmienka: trofej ? malTrofej(trofej) : undefined }); }

// specialne kusy z trofeji strazcov (predmety su v obsah/nepriatelia.js, recepty v obsah/recepty.js)
const SPEC = [
  ['ohnivzdorny_plast', 'plast', 0, 'láva ťa nepáli'],
  ['kozene_cizmy', 'cizmy', 0.03, '+25 % rýchlosť v močiari'],
  ['amulet_hlbin', 'amulet', 0, '2× dlhší dych pod vodou'],
];
for (const [id, slot, obrana, efekt] of SPEC) { VYBAVA[id] = { slot, obrana, efekt, tier: null }; if (PREDMETY[id]) { PREDMETY[id].vybava = true; PREDMETY[id].kopa = 1; } }
