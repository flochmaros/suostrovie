# Horor vlna 2 – D: Zbrane

- Z `git stash` („zbrane - rozrobena session") aplikovaný `git stash apply` (stash ostal nezmazaný).
- Jediný konflikt v `src/boj.js` (`zasahni`): zachované plošné údery (aoe/stred) zo zbraní aj zásah Bledých – `udriBledych` dostáva rovnaké parametre ako `udriNepriatela`, takže legendárne zbrane (výpady, otočky, vlny) odplašia aj Bledých.
- Oprava chyby z rozrobenej práce: lokálna premenná `voda` v `zasahni` zatieňovala funkciu efektu `voda()` → trojzubec padal pri zásahu. Premenované na `vBonus`.
- Overené v konzole: všetky zbrane (obsidiánový/žeravý meč, harpúna, trojzubec, kladivo, oštep) – kombo + silný úder bez chýb; Bledý sa po zásahu každou zbraňou aj fakľou v ruke stiahne (stav `ustup`).
- Naučil som sa: `const` s rovnakým menom ako funkcia v tom istom scope ju potichu zatieni.
