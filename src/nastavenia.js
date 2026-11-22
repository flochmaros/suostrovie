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

// zaloha = { kluc, uloz }: kluc ulozenia hry v localStorage a funkcia, ktora ho zapise (main.js)
export function initNastavenia(grafika, rodic, zaloha) {
  g = grafika;
  const p = document.createElement('div');
  p.id = 'nastavenia';
  p.innerHTML = '<style>#nastavenia{width:380px;max-width:92vw;font-size:13.5px}'
    + '#nastavenia h3{margin:0 0 8px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:var(--zlta,#ffd27a)}'
    + '#nastavenia label{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:3px 0;cursor:pointer}'
    + '#nastavenia input[type=range]{width:130px;accent-color:#ffd27a}#nastavenia button{margin:3px 4px 0 0;padding:6px 12px;border:0;border-radius:14px;background:rgba(255,255,255,.16);color:#fff;font:700 12.5px Nunito,system-ui,sans-serif;cursor:pointer}#nastavenia button:hover{background:rgba(255,210,122,.35)}#nastavenia #zal-menu{background:#ffd27a;color:#3a2a10}</style><h3>Nastavenia</h3>'
    + SUVAKY.map(([k, t, a, b]) => `<label>${t}<input type="range" min="${a}" max="${b}" step="0.05" data-s="${k}"></label>`).join('')
    + PREPINACE.map(([k, t]) => `<label>${t}<input type="checkbox" data-p="${k}"></label>`).join('')
    + '<h3 style="margin-top:10px">Uloženie</h3><button id="zal-menu">Uložiť a späť do hlavného menu</button> '
    + '<button id="zal-stiahni">Stiahnuť uloženie</button> <button id="zal-nahraj">Nahrať uloženie</button>'
    + '<input type="file" id="zal-subor" accept=".json,application/json" hidden><div id="zal-hlaska" style="color:#ff8a7a;margin-top:4px"></div>';
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
  p.addEventListener('click', e => {
    e.stopPropagation();                          // klik v menu nema spustit hru
    if (e.target.id === 'zal-stiahni') {          // aktualny stav -> subor .json (Blob + <a download>)
      zaloha.uloz();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([localStorage.getItem(zaloha.kluc) || '{}'], { type: 'application/json' }));
      a.download = `suostrovie-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    if (e.target.id === 'zal-menu') zaloha.menu();
    if (e.target.id === 'zal-nahraj') p.querySelector('#zal-subor').click();
  });
  p.querySelector('#zal-subor').addEventListener('change', async e => {
    const subor = e.target.files[0];
    e.target.value = '';
    if (subor) nahrajZalohu(await subor.text(), zaloha, t => { p.querySelector('#zal-hlaska').textContent = t; });
  });
  (rodic.querySelector('.pauza-sekcie') || rodic).appendChild(p);
  sync(); pouzi();
  return { prepniTicho() { nastavenia.ticho = !nastavenia.ticho; sync(); pouzi(); return nastavenia.ticho; }, sync };
}

// text zo suboru -> ak je to platne ulozenie, zapise ho a nacita hru znova; inak len hlaska, nic sa neprepise
export function nahrajZalohu(text, zaloha, hlaska) {
  let u = null;
  try { u = JSON.parse(text); } catch (e) { /* neplatny JSON */ }
  if (!u || typeof u !== 'object' || !Array.isArray(u.hrac)) { hlaska('Neplatný súbor uloženia – nič sa nezmenilo.'); return false; }
  removeEventListener('beforeunload', zaloha.uloz);   // inak by odchod zo stranky prepisal nahrate data aktualnym stavom
  localStorage.setItem(zaloha.kluc, JSON.stringify(u));
  location.reload();
  return true;
}
