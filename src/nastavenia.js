// Nastavenia (menu v pauze, Esc): zvuk po skupinach, citlivost mysi, bloom, HUD. Ukladaju sa do localStorage.
import { hlasitost, nastavZvuk } from './zvuk.js';

const KLUC = 'suostrovie-nastavenia';
export const nastavenia = {
  hlavna: 1, hudba: 1, prostredie: 1, efekty: 1,   // hlasitosti 0..1
  ticho: false,                                     // M = vypnut vsetok zvuk
  citlivost: 1,                                     // nasobok citlivosti mysi
  bloom: true,                                      // ziara slnka (vypnutie zvysi FPS)
  hud: true,
};
try { Object.assign(nastavenia, JSON.parse(localStorage.getItem(KLUC) || '{}')); } catch (e) { /* nic */ }

const SUVAKY = [
  ['hlavna', 'Celková hlasitosť', 0, 1], ['hudba', 'Hudba', 0, 1], ['prostredie', 'Prostredie (more, vietor, dážď)', 0, 1],
  ['efekty', 'Zvuky akcií (údery, kroky)', 0, 1], ['citlivost', 'Citlivosť myši', 0.3, 2.5],
];
const PREPINACE = [['ticho', 'Vypnúť všetok zvuk (M)'], ['bloom', 'Žiara slnka (efekt)'], ['hud', 'Zobrazovať HUD (ukazovatele)']];

let g;
function pouzi() {
  hlasitost.hlavna = nastavenia.ticho ? 0 : nastavenia.hlavna;
  hlasitost.hudba = nastavenia.hudba; hlasitost.prostredie = nastavenia.prostredie; hlasitost.efekty = nastavenia.efekty;
  nastavZvuk();
  if (g) g.bloom.enabled = nastavenia.bloom;
  const h = document.getElementById('hud'); if (h) h.style.display = nastavenia.hud ? '' : 'none';
  try { localStorage.setItem(KLUC, JSON.stringify(nastavenia)); } catch (e) { /* nic */ }
}

export function initNastavenia(grafika, rodic) {
  g = grafika;
  const p = document.createElement('div');
  p.id = 'nastavenia';
  p.innerHTML = '<style>#nastavenia{margin-top:14px;padding:10px 16px;border-radius:12px;background:#0006;font-size:14px;min-width:330px}'
    + '#nastavenia h3{margin:0 0 6px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:var(--zlta,#ffd27a)}'
    + '#nastavenia label{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:3px 0;cursor:pointer}'
    + '#nastavenia input[type=range]{width:140px}</style><h3>Nastavenia</h3>'
    + SUVAKY.map(([k, t, a, b]) => `<label>${t}<input type="range" min="${a}" max="${b}" step="0.05" data-s="${k}"></label>`).join('')
    + PREPINACE.map(([k, t]) => `<label>${t}<input type="checkbox" data-p="${k}"></label>`).join('');
  const sync = () => {
    for (const i of p.querySelectorAll('[data-s]')) i.value = nastavenia[i.dataset.s];
    for (const i of p.querySelectorAll('[data-p]')) i.checked = nastavenia[i.dataset.p];
  };
  p.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.s) nastavenia[t.dataset.s] = +t.value;
    if (t.dataset.p) nastavenia[t.dataset.p] = t.checked;
    pouzi();
  });
  p.addEventListener('click', e => e.stopPropagation());   // klik v menu nema spustit hru
  rodic.appendChild(p);
  sync(); pouzi();
  return { prepniTicho() { nastavenia.ticho = !nastavenia.ticho; sync(); pouzi(); return nastavenia.ticho; }, sync };
}
