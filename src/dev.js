// Dev rezim (F2): panel pre vyvojara - lietanie, teleport na biom, predmety, kanoe, hustota vegetacie, FPS.
// Nic z toho nie je v normalnej hre vidiet, kym sa nestlaci F2.
import * as THREE from 'three';
import { klavesy, stlacene } from './vstup.js';
import { ostrovVBunke, vyskaTerenu, BUNKA, BIOM_MENO, prestavSvet } from './svet.js';
import { nastavHustotu, nasobokHustoty } from './vegetacia.js';
import { PREDMETY } from './obsah/predmety.js';
import { sloty, pridaj, vykresli } from './inventar.js';
import { tlmUhol } from './hrac.js';

export const dev = {
  zapnuty: false,
  lietanie: false,
  rychlostLetu: 25,
  silaUderu: 1,          // nasobok poskodenia (okamzite rubanie = 100)
  bezOpotrebenia: false,
  nekonecnyDych: false,
};

let ctx, panel, info, snimky = 0, casFps = 0, fps = 0;

const html = () => `
<style>
  #dev { position: fixed; top: 60px; left: 14px; width: 270px; max-height: calc(100vh - 80px); overflow: auto; z-index: 20;
         padding: 12px 14px; border-radius: 12px; background: rgba(15, 20, 30, .88); color: #e8f0ff; font: 13px/1.45 system-ui, sans-serif; }
  #dev h3 { margin: 10px 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #ffd27a; }
  #dev h3:first-child { margin-top: 0; }
  #dev label { display: block; cursor: pointer; }
  #dev button, #dev select { margin: 2px 2px 2px 0; padding: 3px 8px; border: 1px solid #456; border-radius: 6px; background: #223044; color: #fff; cursor: pointer; font: inherit; }
  #dev button:hover { background: #2f4462; }
  #dev .info { font: 12px/1.5 ui-monospace, monospace; color: #9fe3ff; white-space: pre; }
</style>
<h3>Dev režim (F2)</h3>
<div class="info" id="dev-info"></div>
<h3>Pohyb</h3>
<label><input type="checkbox" data-p="lietanie"> Lietanie (Medzerník hore, C dole, Shift rýchlo)</label>
<label>Rýchlosť letu <input type="range" min="5" max="150" value="25" data-r="rychlostLetu"> <span id="dev-rl">25</span> m/s</label>
<label><input type="checkbox" data-p="nekonecnyDych"> Nekonečný dych</label>
<h3>Teleport</h3>
<select id="dev-biom">${Object.entries(BIOM_MENO).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
<button data-a="teleport">Na najbližší</button><br>
<button data-a="kuKanoe">Ku kanoe</button><button data-a="kanoeKuMne">Kanoe ku mne</button><button data-a="start">Na štart</button>
<h3>Predmety a nástroje</h3>
<button data-a="vsetko">Daj všetko (10×)</button><button data-a="vyprazdni">Vyprázdni batoh</button><br>
<label><input type="checkbox" data-p="bezOpotrebenia"> Nástroje sa neopotrebúvajú</label>
<label><input type="checkbox" data-a="rubanie"> Okamžité rúbanie</label>
<h3>Kanoe</h3>
<button data-k="1">Úroveň 1</button><button data-k="2">2</button><button data-k="3">3</button><button data-k="4">4</button><br>
Nová loď: <button data-lod="kanoe">Kanoe</button><button data-lod="pretekove">Pretekárske</button><button data-lod="barza">Barža</button><button data-lod="katamaran">Katamarán</button><br>
<button data-vyl="1">Vylepšenia max</button><button data-vyl="0">Vylepšenia 0</button>
<h3>Svet</h3>
Hustota vegetácie: <button data-h="0.5">0.5×</button><button data-h="1">1×</button><button data-h="2">2×</button><button data-h="3">3×</button><br>
<button data-a="cas">Čas +60 s (príliv)</button><button data-a="hud">Skryť/ukázať HUD</button><br>
<button data-a="reset">Zmazať uloženie a reštart</button>
`;

// najblizsi ostrov daneho biomu (spirala buniek okolo bodu)
function najdiBiom(biom, x, z) {
  const bx = Math.floor(x / BUNKA), bz = Math.floor(z / BUNKA);
  let naj = null, d = Infinity;
  for (let i = -15; i <= 15; i++) for (let j = -15; j <= 15; j++) {
    const o = ostrovVBunke(bx + i, bz + j);
    if (o && o.biom === biom) { const v = Math.hypot(o.x - x, o.z - z); if (v < d && v > o.R) { d = v; naj = o; } }
  }
  return naj;
}
// suche miesto na brehu ostrova (ide od stredu von, funguje aj pre atol s lagunou)
function brehOstrova(o) {
  for (let a = 0; a < 6.28; a += 0.4) for (let d = 0; d < o.R * 1.8; d += 1) {
    const x = o.x + Math.cos(a) * d, z = o.z + Math.sin(a) * d, h = vyskaTerenu(x, z);
    if (h > 0.6 && h < 3) return [x, z];
  }
  return [o.x, o.z];
}

export function initDev(c) {
  ctx = c;   // { hrac, kanoe, kam, jeVKanoe(), vystup([x,z]), oznam(text), posunCas(s) }
  panel = document.createElement('div');
  panel.id = 'dev';
  panel.innerHTML = html();
  panel.style.display = 'none';
  document.body.appendChild(panel);
  info = panel.querySelector('#dev-info');

  panel.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.p) dev[t.dataset.p] = t.checked;
    if (t.dataset.r) { dev[t.dataset.r] = +t.value; panel.querySelector('#dev-rl').textContent = t.value; }
    if (t.dataset.a === 'rubanie') dev.silaUderu = t.checked ? 100 : 1;
  });
  panel.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    const { hrac, kanoe } = ctx;
    if (t.dataset.lod) ctx.spawnLod(t.dataset.lod);
    if (t.dataset.vyl) for (const x in kanoe.vyl) kanoe.vyl[x] = t.dataset.vyl === '1' ? 3 : 0;
    if (t.dataset.k) { kanoe.nastavUroven(+t.dataset.k); ctx.oznam(`Kanoe: úroveň ${t.dataset.k}`); }
    if (t.dataset.h) { nastavHustotu(+t.dataset.h); prestavSvet(); ctx.oznam(`Hustota vegetácie ${t.dataset.h}×`); }
    const a = t.dataset.a;
    if (a === 'teleport') {
      const biom = panel.querySelector('#dev-biom').value;
      const o = najdiBiom(biom, hrac.poz.x, hrac.poz.z);
      if (!o) return ctx.oznam('Biom nenájdený v okolí');
      const [x, z] = brehOstrova(o);
      if (ctx.jeVKanoe()) ctx.vystup([x, z]);
      hrac.poz.set(x, vyskaTerenu(x, z) + 1, z);
      ctx.oznam(`Teleport: ${o.meno} (${BIOM_MENO[biom]})`);
    }
    if (a === 'kuKanoe' && !ctx.jeVKanoe()) hrac.poz.set(kanoe.poz.x + 2, Math.max(vyskaTerenu(kanoe.poz.x + 2, kanoe.poz.y), 0) + 1, kanoe.poz.y);
    if (a === 'kanoeKuMne' && !ctx.jeVKanoe()) {
      // najblizsia voda okolo hraca
      for (let r = 2; r < 80; r += 2) for (let u = 0; u < 6.28; u += 0.3) {
        const x = hrac.poz.x + Math.cos(u) * r, z = hrac.poz.z + Math.sin(u) * r;
        if (vyskaTerenu(x, z) < -1.2) { kanoe.poz.set(x, z); kanoe.rych.set(0, 0); return; }
      }
    }
    if (a === 'start') { const s = ctx.start; if (ctx.jeVKanoe()) ctx.vystup([s.x, s.z]); hrac.poz.set(s.x, vyskaTerenu(s.x, s.z) + 1, s.z); }
    if (a === 'vsetko') { for (const id of Object.keys(PREDMETY)) pridaj(id, PREDMETY[id].nastroj ? 1 : 10); vykresli(); ctx.oznam('Pridané všetky predmety'); }
    if (a === 'vyprazdni') { sloty.fill(null); vykresli(); }
    if (a === 'cas') ctx.posunCas(60);
    if (a === 'hud') { const h = document.getElementById('hud'); h.style.display = h.style.display === 'none' ? '' : 'none'; }
    if (a === 'reset') { try { localStorage.clear(); } catch (e) { /* nic */ } removeEventListener('beforeunload', ctx.uloz); location.reload(); }
  });
}

// volat kazdy snimok; vrati true, ak dev rezim riadil pohyb hraca (lietanie)
export function aktualizujDev(dt, g) {
  if (stlacene('F2')) {
    dev.zapnuty = !dev.zapnuty;
    panel.style.display = dev.zapnuty ? 'block' : 'none';
    if (dev.zapnuty) document.exitPointerLock();
  }
  snimky++; casFps += dt;
  if (casFps >= 0.5) { fps = snimky / casFps; snimky = 0; casFps = 0; }
  if (dev.zapnuty) {
    const { hrac, kanoe } = ctx, p = ctx.jeVKanoe() ? new THREE.Vector3(kanoe.poz.x, kanoe.y, kanoe.poz.y) : hrac.poz;
    const r = g.renderer.info.render;
    info.textContent = `FPS ${fps.toFixed(0)} · kreslení ${r.calls} · ${(r.triangles / 1000).toFixed(0)}k Δ\n`
      + `x ${p.x.toFixed(1)}  y ${p.y.toFixed(1)}  z ${p.z.toFixed(1)}\nbunka ${Math.floor(p.x / BUNKA)}, ${Math.floor(p.z / BUNKA)} · hustota ${nasobokHustoty}×`;
  }
  if (dev.nekonecnyDych) ctx.hrac.dych = 1;
  if (!dev.lietanie || ctx.jeVKanoe()) return false;

  // lietanie: smer podla kamery, bez gravitacie a kolizii
  const { hrac, kam } = ctx;
  const v = dev.rychlostLetu * (klavesy.has('ShiftLeft') ? 3 : 1);
  const vpred = (klavesy.has('KeyW') ? 1 : 0) - (klavesy.has('KeyS') ? 1 : 0);
  const vbok = (klavesy.has('KeyD') ? 1 : 0) - (klavesy.has('KeyA') ? 1 : 0);
  const hore = (klavesy.has('Space') ? 1 : 0) - (klavesy.has('KeyC') ? 1 : 0);
  const fx = -Math.sin(kam.yaw), fz = -Math.cos(kam.yaw);
  hrac.poz.x += (fx * vpred + Math.cos(kam.yaw) * vbok) * v * dt;
  hrac.poz.z += (fz * vpred - Math.sin(kam.yaw) * vbok) * v * dt;
  hrac.poz.y = Math.max(hrac.poz.y + hore * v * dt, vyskaTerenu(hrac.poz.x, hrac.poz.z));
  hrac.vy = 0;
  if (vpred || vbok) hrac.smer = tlmUhol(hrac.smer, Math.atan2(-(fx * vpred + Math.cos(kam.yaw) * vbok), -(fz * vpred - Math.sin(kam.yaw) * vbok)), 10, dt);
  hrac.model.position.copy(hrac.poz);
  hrac.model.rotation.set(0, hrac.smer, 0);
  hrac.animuj(dt, 'vzduch', 0);
  return true;
}
