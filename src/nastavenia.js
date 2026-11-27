// Nastavenia (menu v pauze, Esc): zvuk po skupinach, citlivost mysi, bloom, HUD (v zalozkach). Ukladaju sa do localStorage.
import { hlasitost, nastavZvuk } from './zvuk.js';

const KLUC = 'suostrovie-nastavenia';
export const nastavenia = {
  hlavna: 1, hudba: 1, prostredie: 1, efekty: 1,   // hlasitosti 0..1
  ticho: false,                                     // M = vypnut vsetok zvuk
  citlivost: 1,                                     // nasobok citlivosti mysi
  jasNoci: 0,                                       // 0 = naozajstna tma, 1 = najsvetlejsia noc (pre tmave monitory)
  bloom: true,                                      // ziara slnka (vypnutie zvysi FPS)
  hud: true,
};
try { Object.assign(nastavenia, JSON.parse(localStorage.getItem(KLUC) || '{}')); } catch (e) { /* nic */ }

// zalozky panela: [id, nazov, suvaky [kluc, popis, min, max], prepinace [kluc, popis]]
const ZALOZKY = [
  ['zvuk', 'Zvuk', [['hlavna', 'Celková hlasitosť', 0, 1], ['hudba', 'Hudba', 0, 1], ['prostredie', 'Prostredie (more, vietor, dážď)', 0, 1],
    ['efekty', 'Zvuky akcií (údery, kroky)', 0, 1]], [['ticho', 'Vypnúť všetok zvuk (M)']]],
  ['ovladanie', 'Ovládanie', [['citlivost', 'Citlivosť myši', 0.3, 2.5]], []],
  ['grafika', 'Grafika', [['jasNoci', 'Jas noci', 0, 1]], [['bloom', 'Žiara slnka (vypnutie zvýši FPS)']]],
  ['hud', 'HUD', [], [['hud', 'Zobrazovať HUD (ukazovatele)']]],
];

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
  // rodic = pauzove okno #start; zalozky sa vlozia do #pz-zalozky, ich obsah do #pz-obsah (index.html)
  const p = rodic.querySelector('#nastavenia');
  const lista = p.querySelector('#pz-zalozky'), obsah = p.querySelector('#pz-obsah');
  for (const [id, nazov, suvaky, prepinace] of ZALOZKY) {
    lista.insertAdjacentHTML('beforeend', `<button class="pz-zalozka" data-z="${id}">${nazov}</button>`);
    const o = document.createElement('div');
    o.className = 'pz-list'; o.dataset.z = id;
    o.innerHTML = suvaky.map(([k, t, a, b]) => `<label>${t}<input type="range" min="${a}" max="${b}" step="0.05" data-s="${k}"></label>`).join('')
      + prepinace.map(([k, t]) => `<label>${t}<input type="checkbox" data-p="${k}"></label>`).join('');
    obsah.appendChild(o);
  }
  obsah.querySelector('.pz-list[data-z="ovladanie"]').appendChild(rodic.querySelector('#ovladanie'));   // prehlad klaves
  const zalozka = id => { for (const e of p.querySelectorAll('[data-z]')) e.classList.toggle('aktivna', e.dataset.z === id); };
  lista.addEventListener('click', e => { if (e.target.dataset.z) zalozka(e.target.dataset.z); });
  zalozka('zvuk');
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
  rodic.addEventListener('click', e => {        // tlacidla ulozenia su v lavom stlpci pauzy
    if (e.target.id === 'zal-stiahni') {          // aktualny stav -> subor .json (Blob + <a download>)
      zaloha.uloz();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([localStorage.getItem(zaloha.kluc) || '{}'], { type: 'application/json' }));
      a.download = `suostrovie-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    if (e.target.id === 'zal-menu') zaloha.menu();
    if (e.target.id === 'zal-nahraj') rodic.querySelector('#zal-subor').click();
  });
  rodic.querySelector('#zal-subor').addEventListener('change', async e => {
    const subor = e.target.files[0];
    e.target.value = '';
    if (subor) nahrajZalohu(await subor.text(), zaloha, t => { rodic.querySelector('#zal-hlaska').textContent = t; });
  });
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
