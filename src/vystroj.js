// Vystroj: nositelna Krabia prilba. Pravy klik na prilbu v liste (alebo klaves H) = nasadit/zlozit.
// Stav sa uklada sam (localStorage), znizenie poskodenia je v preziti.js (zran), model sedi na kĺbe hlavy postavy.
import * as THREE from 'three';
import { vystroj } from './preziti.js';
import { sloty, pocet } from './inventar.js';
import { ik } from './ikony.js';
import { aktivnySlot, klucVystroje } from './sloty.js';

const KLUC = klucVystroje(aktivnySlot()), ID = 'krabia_prilba';

function modelPrilby() {
  const g = new THREE.Group();
  const cerv = new THREE.MeshStandardMaterial({ color: 0xc8422c, roughness: 0.5, metalness: 0.15 });
  const tmav = new THREE.MeshStandardMaterial({ color: 0x7a2414, roughness: 0.6 });
  const kopula = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), cerv);
  kopula.scale.set(0.98, 1.05, 1.08); kopula.position.set(0, 0.125, 0.005); g.add(kopula);
  const okraj = new THREE.Mesh(new THREE.TorusGeometry(0.143, 0.011, 6, 24).rotateX(Math.PI / 2), tmav);
  okraj.scale.set(0.98, 1, 1.08); okraj.position.set(0, 0.16, 0.005); g.add(okraj);
  const hrebe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.25), tmav); hrebe.position.set(0, 0.275, 0); g.add(hrebe);
  for (const s of [-1, 1]) {           // dve "ocne stopky" krabej hlavy vpredu
    const k = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.1, 6), tmav);
    k.position.set(0.05 * s, 0.27, -0.12); k.rotation.set(-0.5, 0, -0.25 * s); g.add(k);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function initVystroj(hrac, oznam) {
  const model = modelPrilby();
  hrac.J.hlava.add(model);
  const hud = document.createElement('div');
  hud.title = 'Krabia prilba (−25 % poškodenia) – H zloží';
  hud.style.cssText = 'position:fixed;left:18px;bottom:110px;width:38px;height:38px;display:none;padding:3px;border-radius:8px;background:#0008;border:1px solid #fff5;pointer-events:none;z-index:4';
  hud.innerHTML = ik('spiral-shell', '#e0583a');
  document.body.appendChild(hud);
  try { vystroj.prilba = localStorage.getItem(KLUC) === '1'; } catch (e) { /* bez ukladania */ }

  const obnov = () => {
    if (vystroj.prilba && pocet(ID) < 1 && sloty.some(Boolean)) { vystroj.prilba = false; zapis(); }   // prilba sa stratila z batohu
    model.visible = vystroj.prilba; hud.style.display = vystroj.prilba ? 'block' : 'none';
  };
  const zapis = () => { try { localStorage.setItem(KLUC, vystroj.prilba ? '1' : '0'); } catch (e) { /* bez ukladania */ } };
  const prepni = () => {
    if (!vystroj.prilba && pocet(ID) < 1) return false;
    vystroj.prilba = !vystroj.prilba; zapis(); obnov();
    oznam(vystroj.prilba ? 'Nasadil si Krabiu prilbu (−25 % poškodenia)' : 'Zložil si Krabiu prilbu');
    return true;
  };
  addEventListener('pointerdown', e => {
    const s = e.button === 2 && e.target.closest('#lista .slot');
    if (s && sloty[+s.dataset.i]?.typ === ID) { prepni(); e.preventDefault(); }
  });
  addEventListener('contextmenu', e => { if (e.target.closest('#lista')) e.preventDefault(); });
  addEventListener('keydown', e => { if (e.code === 'KeyH' && !e.repeat && !/INPUT|TEXTAREA/.test(e.target.tagName)) prepni(); });
  setInterval(obnov, 500);
  obnov();
  hrac.prepniPrilbu = prepni;
}
