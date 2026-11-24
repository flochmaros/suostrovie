// Brnenie: nositelny kus na hrudi. Pravy klik na brnenie v liste = nasadit/zlozit (nasadenie ineho kusu ho vymeni).
// Znizenie poskodenia je v preziti.js (zran), model sedi na hrudniku postavy (J.chrbat). Stav sa uklada v localStorage.
import * as THREE from 'three';
import { vystroj } from './preziti.js';
import { sloty, pocet } from './inventar.js';
import { PREDMETY } from './obsah/predmety.js';
import { BRNENIE, geoHrudnik } from './obsah/brnenie.js';
import { aktivnySlot, klucVystroje } from './sloty.js';

const KLUC = klucVystroje(aktivnySlot()) + '-telo';

export function initBrnenie(hrac, oznam) {
  const pas = new THREE.Mesh(new THREE.TorusGeometry(0.168, 0.012, 5, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ roughness: 0.6 }));
  const model = new THREE.Mesh(geoHrudnik(0.012), new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide }));
  model.castShadow = true; pas.position.y = 0.2; model.add(pas); model.position.y = 0.06; model.visible = false;
  hrac.J.chrbat.add(model);

  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:calc(50% + 210px);bottom:28px;min-width:38px;height:38px;display:none;padding:3px 6px;border-radius:8px;background:#0008;border:1px solid #fff5;pointer-events:none;z-index:4;color:#fff;font:600 13px/32px sans-serif';
  document.body.appendChild(hud);

  try { const id = localStorage.getItem(KLUC); vystroj.brnenie = BRNENIE[id] ? id : null; } catch (e) { /* bez ukladania */ }
  const zapis = () => { try { localStorage.setItem(KLUC, vystroj.brnenie || ''); } catch (e) { /* bez ukladania */ } };
  const obnov = () => {
    if (vystroj.brnenie && pocet(vystroj.brnenie) < 1 && sloty.some(Boolean)) { vystroj.brnenie = null; zapis(); }   // brnenie sa stratilo z batohu
    const b = BRNENIE[vystroj.brnenie];
    model.visible = !!b; hud.style.display = b ? 'block' : 'none';
    if (b) { model.material.color.setHex(b.farba); pas.material.color.setHex(b.okraj); hud.textContent = '🛡 −' + Math.round(b.obrana * 100) + ' %'; hud.title = PREDMETY[vystroj.brnenie].meno; }
  };
  const nasad = id => {
    if (vystroj.brnenie === id) { vystroj.brnenie = null; oznam('Zložil si ' + PREDMETY[id].meno); }
    else { vystroj.brnenie = id; oznam(`Nasadil si ${PREDMETY[id].meno} (−${Math.round(BRNENIE[id].obrana * 100)} % poškodenia)`); }
    zapis(); obnov();
  };
  addEventListener('pointerdown', e => {
    const s = e.button === 2 && e.target.closest('#lista .slot');
    const typ = s && sloty[+s.dataset.i]?.typ;
    if (BRNENIE[typ]) { nasad(typ); e.preventDefault(); }
  });
  setInterval(obnov, 500);
  obnov();
}
