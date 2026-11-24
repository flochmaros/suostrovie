// Brnenie (telo): nosi sa na hrudi, znizuje prijate poskodenie. Nasadenie: pravy klik na lisku (src/brnenie.js).
// BRNENIE[id] = { obrana (0-1 = o kolko znizi poskodenie), farba, okraj, pas }  -> novy kus = predmet + zaznam tu + recept dole
import * as THREE from 'three';
import { predmet } from './predmety.js';
import { recept } from './recepty.js';
import { pocet } from '../inventar.js';
import { ik } from '../ikony.js';
import { obranaBrnenia } from '../preziti.js';

export const BRNENIE = {};

// profil hrudnika (polomer, vyska) – rovnaky tvar pouziva model na zemi aj na postave
export const PROFIL = [[0.1, 0.0], [0.168, 0.0], [0.17, 0.1], [0.152, 0.2], [0.17, 0.3], [0.19, 0.37], [0.15, 0.43], [0.09, 0.45]];
export function geoHrudnik(zvacsi = 0) {
  return new THREE.LatheGeometry(PROFIL.map(([r, y]) => new THREE.Vector2(r + zvacsi, y)), 20);
}

function brnenie(id, meno, obrana, farba, okraj, popis, recepty, podmienka) {
  BRNENIE[id] = { obrana, farba, okraj }; obranaBrnenia[id] = obrana;
  const mat = new THREE.MeshStandardMaterial({ color: farba, roughness: 0.65, metalness: 0.1, side: THREE.DoubleSide });
  const g = geoHrudnik().scale(1.1, 1.1, 1.1);
  predmet(id, { meno, kopa: 1, brnenie: true, ikona: ik('spiral-shell', '#' + farba.toString(16).padStart(6, '0')),
    popis: `${popis} Nasadené (pravý klik na lište) znižuje prijaté poškodenie o ${Math.round(obrana * 100)} %.`, model: [g, mat] });
  recept({ id, skupina: 'Výstroj', vysledok: [id, 1], suroviny: recepty, podmienka });
}

// trofeje sa pamataju v localStorage, aby recept ostal viditelny aj ked trofej minies
const malTrofej = id => () => { try { if (pocet(id) > 0) localStorage.setItem('hra_trofej_' + id, '1'); return localStorage.getItem('hra_trofej_' + id) === '1'; } catch (e) { return true; } };

brnenie('listova_vesta', 'Listová vesta', 0.1, 0x5fae4c, 0x3d7a30, 'Spletené palmové listy. Ľahká, ale lepšie ako nič.', [['list', 8], ['vlakno', 3]]);
brnenie('bambusovy_pancier', 'Bambusový pancier', 0.2, 0xc9b266, 0x8a7a3c, 'Pásy bambusu zviazané lanom.', [['bambus', 6], ['vlakno', 4]]);
brnenie('lasturovy_pancier', 'Lastúrový pancier', 0.3, 0xf1d2bf, 0xb98a70, 'Preglejené mušle na lyku, ligoce sa na slnku.', [['musla', 8], ['bambus', 2], ['vlakno', 4]]);
brnenie('krabie_brnenie', 'Krabie brnenie', 0.4, 0xc8422c, 0x7a2414, 'Z panciera Obrovského kraba.', [['krabi_pancier', 5], ['vlakno', 3]], malTrofej('krabi_pancier'));
brnenie('supinove_brnenie', 'Šupinové brnenie', 0.5, 0x3a2a24, 0xff5a10, 'Šupiny lávového jaštera, ešte teplé. Najlepšia ochrana.', [['lavova_supina', 3], ['jasterie_supiny', 4], ['vlakno', 3]], malTrofej('lavova_supina'));
