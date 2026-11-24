// Vystroj: nositelne predmety z trofeji strazcov. Pravy klik na predmet v liste = nasadit/zlozit (H = prilba).
//   prilba (Krabia prilba)        -25 % poskodenia            (preziti.js zran)
//   plast  (Ohnivzdorny plast)    lavove kaluze nepalia       (preziti.js zran, pricina 'lava')
//   cizmy  (Kozene cizmy)         +25 % rychlost v mociari    (preziti.js rychlostNasobok, vystroj.mociar)
//   amulet (Amulet hlbin)         2x dlhsi dych pod vodou     (hrac.js h.dychNasobok)
//   Kompas hmly sa nenasadzuje: staci ho mat v batohu, v HUD ukaze smer k najblizsiemu nezapalenemu majaku.
// Stav sa uklada sam (localStorage), modely su male a decentne, sedia na klboch postavy.
import * as THREE from 'three';
import { vystroj } from './preziti.js';
import { sloty, pocet } from './inventar.js';
import { ik } from './ikony.js';
import { aktivnySlot, klucVystroje } from './sloty.js';
import { ostrovPri } from './svet.js';
import { majaky } from './majak.js';

const KLUC = klucVystroje(aktivnySlot());
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const kus = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; return o; };

function modelPrilby() {
  const g = new THREE.Group();
  const cerv = mat(0xc8422c, { roughness: 0.5, metalness: 0.15 }), tmav = mat(0x7a2414);
  const kopula = kus(new THREE.SphereGeometry(0.15, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), cerv, 0, 0.125, 0.005);
  kopula.scale.set(0.98, 1.05, 1.08); g.add(kopula);
  const okraj = kus(new THREE.TorusGeometry(0.143, 0.011, 6, 24).rotateX(Math.PI / 2), tmav, 0, 0.16, 0.005);
  okraj.scale.set(0.98, 1, 1.08); g.add(okraj);
  g.add(kus(new THREE.BoxGeometry(0.02, 0.025, 0.25), tmav, 0, 0.275, 0));
  for (const s of [-1, 1]) {           // dve "ocne stopky" krabej hlavy vpredu
    const k = kus(new THREE.ConeGeometry(0.018, 0.1, 6), tmav, 0.05 * s, 0.27, -0.12); k.rotation.set(-0.5, 0, -0.25 * s); g.add(k);
  }
  return g;
}
// plast: tenka doska na chrbte (vzadu = +z) + golier; jemne zeravy lem
function modelPlasta() {
  const g = new THREE.Group(), m = mat(0x2e2420, { roughness: 0.8 }), lem = mat(0x401008, { emissive: 0xff5010, emissiveIntensity: 1.2 });
  const p = kus(new THREE.BoxGeometry(0.34, 0.5, 0.025), m, 0, 0.2, 0.16); p.rotation.x = 0.12;
  p.add(kus(new THREE.BoxGeometry(0.35, 0.035, 0.03), lem, 0, -0.24, 0)); g.add(p);
  g.add(kus(new THREE.BoxGeometry(0.3, 0.04, 0.12), m, 0, 0.45, 0.1));
  return g;
}
// cizma: kratky valec okolo clenku (na klbe kolena)
const modelCizmy = () => kus(new THREE.CylinderGeometry(0.07, 0.075, 0.13, 7), mat(0x4a5a30, { roughness: 0.9 }), 0, -0.4, 0);
// amulet: maly osemsten na hrudi (vpredu = -z)
const modelAmuletu = () => kus(new THREE.OctahedronGeometry(0.028, 0), mat(0x6a30b0, { emissive: 0x8040e0, emissiveIntensity: 0.8 }), 0, 0.38, -0.15);

const VYSTROJ = [
  { slot: 'prilba', id: 'krabia_prilba', meno: 'Krabiu prilbu', efekt: '−25 % poškodenia', ikona: ik('spiral-shell', '#e0583a') },
  { slot: 'plast', id: 'ohnivzdorny_plast', meno: 'Ohnivzdorný plášť', efekt: 'láva ťa nepáli', ikona: ik('spiral-shell', '#c8501e') },
  { slot: 'cizmy', id: 'kozene_cizmy', meno: 'Kožené čižmy', efekt: '+25 % v močiari', ikona: ik('spiral-shell', '#6a7a3a') },
  { slot: 'amulet', id: 'amulet_hlbin', meno: 'Amulet hlbín', efekt: '2× dlhší dych', ikona: ik('glass-ball', '#a060e0') },
];

export function initVystroj(hrac, oznam, kam) {
  const J = hrac.J;
  const modely = { prilba: [modelPrilby()], plast: [modelPlasta()], cizmy: [modelCizmy(), modelCizmy()], amulet: [modelAmuletu()] };
  J.hlava.add(modely.prilba[0]); J.chrbat.add(modely.plast[0]); J.chrbat.add(modely.amulet[0]);
  J.kL.add(modely.cizmy[0]); J.kP.add(modely.cizmy[1]);

  // HUD: male ikonky nasadeneho vystroja vlavo dole
  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:18px;bottom:110px;display:flex;gap:4px;pointer-events:none;z-index:4';
  for (const v of VYSTROJ) {
    v.hud = document.createElement('div'); v.hud.title = v.meno + ' (' + v.efekt + ')';
    v.hud.style.cssText = 'width:34px;height:34px;display:none;padding:3px;border-radius:8px;background:#0008;border:1px solid #fff5';
    v.hud.innerHTML = v.ikona; hud.appendChild(v.hud);
  }
  document.body.appendChild(hud);

  try {                                              // stary format: '1' = prilba
    const s = localStorage.getItem(KLUC);
    if (s === '1') vystroj.prilba = true;
    else if (s && s[0] === '{') { const d = JSON.parse(s); for (const v of VYSTROJ) vystroj[v.slot] = !!d[v.slot]; }
  } catch (e) { /* bez ukladania */ }
  const zapis = () => { try { localStorage.setItem(KLUC, JSON.stringify(Object.fromEntries(VYSTROJ.map(v => [v.slot, vystroj[v.slot] ? 1 : 0])))); } catch (e) { /* bez ukladania */ } };

  const obnov = () => {
    for (const v of VYSTROJ) {
      if (vystroj[v.slot] && pocet(v.id) < 1 && sloty.some(Boolean)) { vystroj[v.slot] = false; zapis(); }   // predmet sa stratil z batohu
      for (const m of modely[v.slot]) m.visible = vystroj[v.slot];
      v.hud.style.display = vystroj[v.slot] ? 'block' : 'none';
    }
    hrac.dychNasobok = vystroj.amulet ? 2 : 1;
    const o = ostrovPri(hrac.poz.x, hrac.poz.z, 1.1);
    vystroj.mociar = !!o && o.biom === 'mangrovy' && !hrac.plava;
  };
  const prepni = id => {
    const v = VYSTROJ.find(v => v.id === id); if (!v) return false;
    if (!vystroj[v.slot] && pocet(v.id) < 1) return false;
    vystroj[v.slot] = !vystroj[v.slot]; zapis(); obnov();
    oznam(vystroj[v.slot] ? `Nasadil si ${v.meno} (${v.efekt})` : `Zložil si ${v.meno}`);
    return true;
  };
  addEventListener('pointerdown', e => {
    const s = e.button === 2 && e.target.closest('#lista .slot');
    if (s && prepni(sloty[+s.dataset.i]?.typ)) e.preventDefault();
  });
  addEventListener('contextmenu', e => { if (e.target.closest('#lista')) e.preventDefault(); });
  addEventListener('keydown', e => { if (e.code === 'KeyH' && !e.repeat && !/INPUT|TEXTAREA/.test(e.target.tagName)) prepni('krabia_prilba'); });
  setInterval(obnov, 500);
  obnov();
  hrac.prepniPrilbu = () => prepni('krabia_prilba');
  hrac.prepniVystroj = prepni;

  // Kompas hmly: sipka (relativne k smeru kamery) k najblizsiemu nezapalenemu majaku
  const komp = document.createElement('div');
  komp.className = 'panel';
  komp.style.cssText = 'position:absolute;top:118px;right:14px;padding:6px 12px;font-size:13px;display:none;align-items:center;gap:8px;pointer-events:none';
  komp.innerHTML = '<span style="display:inline-block;font-size:20px;color:#40e8ff;text-shadow:0 0 6px #40e8ff">⬆</span><span></span>';
  document.body.appendChild(komp);
  const [sipka, text] = komp.children;
  const tik = () => {
    requestAnimationFrame(tik);
    let ciel = null, dMin = Infinity;
    if (pocet('kompas_hmly') > 0) for (const m of majaky) {
      if (m.lit) continue;
      const d = Math.hypot(m.x - hrac.poz.x, m.z - hrac.poz.z); if (d < dMin) { dMin = d; ciel = m; }
    }
    komp.style.display = ciel ? 'flex' : 'none';
    if (!ciel) return;
    const dx = ciel.x - hrac.poz.x, dz = ciel.z - hrac.poz.z, y = kam ? kam.yaw : 0;
    const dopredu = -dx * Math.sin(y) - dz * Math.cos(y), doprava = dx * Math.cos(y) - dz * Math.sin(y);   // kamera pozera v smere (-sin yaw, -cos yaw)
    sipka.style.transform = `rotate(${Math.atan2(doprava, dopredu)}rad)`;
    text.textContent = `${ciel.def.meno} · ${dMin > 1000 ? (dMin / 1000).toFixed(1) + ' km' : Math.round(dMin) + ' m'}`;
  };
  tik();
}
