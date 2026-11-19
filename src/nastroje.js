// Logika nastrojov: poskodenie zdroja podla nastroja v ruke a opotrebenie nastroja v inventari.
import { PREDMETY } from './obsah/predmety.js';
import './obsah/nastroje.js';
import { sloty, vykresli, obnov } from './inventar.js';

const RUKA = { list: 1, drevo: 0.5, kamen: 0 };   // poskodenie holou rukou podla materialu

// kolko hp ubere jeden uder; def = PREDMETY[id] predmetu v ruke alebo null; zdroj = polozka z obsah/zdroje.js
export function poskodenie(def, zdroj) {
  const ruka = RUKA[zdroj.material] ?? 0;
  const n = def?.nastroj;
  if (!n) return zdroj.nastroj ? ruka * 0.5 : ruka;               // bez nastroja
  if (zdroj.nastroj && n.typ !== zdroj.nastroj) return ruka * 0.5; // zly nastroj
  return Math.max(ruka, n.sila * (n.ucinnost[zdroj.material] ?? 0));
}
// ma hrac spravny nastroj pre zdroj? (na hlasku typu "potrebujes krompac")
export const spravnyNastroj = (def, zdroj) => !zdroj.nastroj || def?.nastroj?.typ === zdroj.nastroj;
export const trvanlivostMax = id => PREDMETY[id]?.nastroj?.trvanlivost ?? 0;

// opotrebuje nastroj v policku; vrati true ak sa pokazil (policko sa vyprazdni)
export function opotrebuj(slotIndex, n = 1) {
  const s = sloty[slotIndex], max = s && trvanlivostMax(s.typ);
  if (!s || !max) return false;
  s.trv = (s.trv ?? max) - n;
  if (s.trv <= 0) { sloty[slotIndex] = null; obnov(); return true; }
  vykresli();
  return false;
}
