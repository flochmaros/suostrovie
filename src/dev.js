// Dev rezim (F2): panel pre vyvojara - lietanie, teleport na biom, predmety, kanoe, hustota vegetacie, FPS.
// Nic z toho nie je v normalnej hre vidiet, kym sa nestlaci F2.
import * as THREE from 'three';
import { klavesy, stlacene } from './vstup.js';
import { ostrovVBunke, vyskaTerenu, BUNKA, BIOM_MENO, prestavSvet } from './svet.js';
import { menoOstrova } from './znacky.js';
import { nastavHustotu, nasobokHustoty } from './vegetacia.js';
import { PREDMETY } from './obsah/predmety.js';
import { sloty, pridaj, pocet, vykresli } from './inventar.js';
import { tlmUhol } from './hrac.js';
import { VYL_MAX } from './kanoe.js';
import { NEPRIATELIA } from './obsah/nepriatelia.js';
import { spawnPriHracovi } from './nepriatelia.js';
import { majaky } from './majak.js';
import { MORSKE } from './obsah/more.js';

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
  #dev { position: fixed; top: 8px; left: 50%; transform: translateX(-50%); z-index: 60; max-width: 96vw; width: max-content;
         font: 13px/1.4 system-ui, sans-serif; color: #e8f0ff; pointer-events: auto; user-select: none; }
  #dev .lista { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; justify-content: center; padding: 5px 8px; border-radius: 10px; background: rgba(15, 20, 30, .88); }
  #dev .obsah { margin-top: 4px; padding: 8px 10px; border-radius: 10px; background: rgba(15, 20, 30, .88); display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; justify-content: center; }
  #dev .obsah[hidden], #dev .lista .ot[hidden] { display: none; }
  #dev button, #dev select { padding: 3px 9px; border: 1px solid #456; border-radius: 6px; background: #223044; color: #fff; cursor: pointer; font: inherit; }
  #dev button:hover { background: #2f4462; }
  #dev .zap { font-weight: 700; color: #ffd27a; }
  #dev .tab.akt { background: #ffd27a; color: #1a1a1a; border-color: #ffd27a; }
  #dev .vyp { opacity: .6; } #dev.otvoreny .vyp { opacity: 1; }
  #dev label { cursor: pointer; white-space: nowrap; }
  #dev .skup { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
  #dev .skup > b { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #ffd27a; margin-right: 2px; }
  #dev .info { font: 11px/1.25 ui-monospace, monospace; color: #9fe3ff; white-space: pre; padding: 0 6px; }
  #dev input[type=range] { vertical-align: middle; width: 110px; }
</style>
<div class="lista">
  <button class="zap" id="dev-zap" title="Dev režim (F2)">🛠 DEV</button>
  <span class="ot" hidden><span class="info" id="dev-info"></span></span>
  <span class="ot" hidden id="dev-tabs">
    <button class="tab" data-t="pohyb">Pohyb</button><button class="tab" data-t="teleport">Teleport</button><button class="tab" data-t="predmety">Predmety</button><button class="tab" data-t="lode">Lode</button><button class="tab" data-t="svet">Svet</button>
  </span>
  <button class="ot" hidden data-a="hraj" title="Vrátiť myš do hry (klik do scény)">▶ Hrať</button>
</div>
<div class="obsah" data-t="pohyb" hidden>
  <label><input type="checkbox" data-p="lietanie"> Lietanie <small>(Medzerník ↑, C ↓, Shift rýchlo)</small></label>
  <label>Rýchlosť <input type="range" min="5" max="150" value="25" data-r="rychlostLetu"> <span id="dev-rl">25</span> m/s</label>
  <label><input type="checkbox" data-p="nekonecnyDych"> Nekonečný dych</label>
  <label><input type="checkbox" data-p="bezOpotrebenia"> Nástroje sa neopotrebúvajú</label>
  <label><input type="checkbox" data-a="rubanie"> Okamžité rúbanie</label>
</div>
<div class="obsah" data-t="teleport" hidden>
  <div class="skup"><b>Biom</b><select id="dev-biom">${Object.entries(BIOM_MENO).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><button data-a="teleport">Na najbližší</button></div>
  <div class="skup"><b>Miesta</b><button data-a="kuKanoe">Ku kanoe</button><button data-a="kanoeKuMne">Kanoe ku mne</button><button data-a="start">Na štart</button><button data-a="majak">K majáku 1</button></div>
</div>
<div class="obsah" data-t="predmety" hidden>
  <div class="skup"><b>Predmet</b><select id="dev-pred">${Object.entries(PREDMETY).map(([k, v]) => `<option value="${k}">${v.meno || k}</option>`).join('')}</select>
    <input type="number" id="dev-pocet" value="20" min="1" max="999" style="width:56px"><button data-a="daj">Daj</button></div>
  <div class="skup"><button data-a="nastroje">Všetky nástroje</button><button data-a="more">Všetko z mora</button><button data-a="vyprazdni">Vyprázdni batoh</button></div>
</div>
<div class="obsah" data-t="svet" hidden data-dev-nepr>
  <div class="skup"><b>Nepriateľ</b>${Object.entries(NEPRIATELIA).map(([k, v]) => `<button data-nepr="${k}">${v.meno}</button>`).join('')}</div>
</div>
<div class="obsah" data-t="lode" hidden>
  <div class="skup"><b>Úroveň kanoe</b><button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button><button data-k="4">4</button></div>
  <div class="skup"><b>Nová loď</b><button data-lod="kanoe">Kanoe</button><button data-lod="pretekove">Pretekárske</button><button data-lod="barza">Barža</button><button data-lod="katamaran">Katamarán</button></div>
  <div class="skup"><b>Vylepšenia</b><button data-vyl="1">Max</button><button data-vyl="0">0</button></div>
</div>
<div class="obsah" data-t="svet" hidden>
  <div class="skup"><b>Vegetácia</b><button data-h="0.5">0.5×</button><button data-h="1">1×</button><button data-h="2">2×</button><button data-h="3">3×</button></div>
  <div class="skup"><button data-a="cas">Čas +60 s (príliv)</button><button data-a="hud">Skryť/ukázať HUD</button><button data-a="reset">Zmazať uloženie a reštart</button></div>
</div>
`;

const platno = () => document.querySelector('canvas');
const zamkni = () => platno().requestPointerLock()?.catch?.(() => {});
let aktTab = null;
function otvorTab(t) {
  aktTab = aktTab === t ? null : t;
  panel.querySelectorAll('.tab').forEach(b => b.classList.toggle('akt', b.dataset.t === aktTab));
  panel.querySelectorAll('.obsah').forEach(o => { o.hidden = o.dataset.t !== aktTab; });
  try { localStorage.setItem('devTab', aktTab || ''); } catch (e) { /* nic */ }
}
function prepniDev(zap) {
  const bol = dev.zapnuty;
  dev.zapnuty = zap;
  panel.classList.toggle('otvoreny', zap);
  panel.querySelectorAll('.lista .ot').forEach(o => { o.hidden = !zap; });
  panel.querySelectorAll('.obsah').forEach(o => { o.hidden = !zap || o.dataset.t !== aktTab; });
  if (zap) { document.exitPointerLock(); document.getElementById('start').style.display = 'none'; }
  else if (bol) { document.getElementById('start').style.display = 'flex'; zamkni(); }
}

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
  document.body.appendChild(panel);
  info = panel.querySelector('#dev-info');
  try { aktTab = localStorage.getItem('devTab') || 'pohyb'; } catch (e) { aktTab = 'pohyb'; }
  const t0 = aktTab; aktTab = null; otvorTab(t0);
  prepniDev(false);
  panel.querySelector('#dev-zap').onclick = () => prepniDev(!dev.zapnuty);
  // klik do scény pri otvorenom dev paneli vráti myš do hry (panel ostáva)
  platno().addEventListener('click', () => { if (dev.zapnuty) zamkni(); });

  panel.addEventListener('change', e => { if (e.target.type === 'checkbox') e.target.blur(); });
  panel.addEventListener('click', e => { if (e.target.closest('button')) e.target.closest('button').blur(); });
  panel.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.p) dev[t.dataset.p] = t.checked;
    if (t.dataset.r) { dev[t.dataset.r] = +t.value; panel.querySelector('#dev-rl').textContent = t.value; }
    if (t.dataset.a === 'rubanie') dev.silaUderu = t.checked ? 100 : 1;
  });
  panel.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.t) return otvorTab(t.dataset.t);
    if (t.dataset.a === 'hraj') return zamkni();
    const { hrac, kanoe } = ctx;
    if (t.dataset.nepr) ctx.oznam(spawnPriHracovi(t.dataset.nepr, ctx.hrac.poz) ? `Spawn: ${NEPRIATELIA[t.dataset.nepr].meno}` : 'Nie je kde spawnovať');
    if (t.dataset.lod) ctx.spawnLod(t.dataset.lod);
    if (t.dataset.vyl) { for (const x in kanoe.vyl) kanoe.vylepsi(x, t.dataset.vyl === '1' ? VYL_MAX : 0); ctx.oznam(t.dataset.vyl === '1' ? 'Vylepšenia na maximum' : 'Vylepšenia vynulované'); }
    if (t.dataset.k) { if (kanoe.druh !== 'kanoe') ctx.oznam('Najbližšia loď nie je kanoe'); else { kanoe.nastavUroven(+t.dataset.k); ctx.oznam(`Kanoe: úroveň ${t.dataset.k}`); } }
    if (t.dataset.h) { nastavHustotu(+t.dataset.h); prestavSvet(); ctx.oznam(`Hustota vegetácie ${t.dataset.h}×`); }
    const a = t.dataset.a;
    if (a === 'teleport') {
      const biom = panel.querySelector('#dev-biom').value;
      const o = najdiBiom(biom, hrac.poz.x, hrac.poz.z);
      if (!o) return ctx.oznam('Biom nenájdený v okolí');
      const [x, z] = brehOstrova(o);
      if (ctx.jeVKanoe()) ctx.vystup([x, z]);
      hrac.poz.set(x, vyskaTerenu(x, z) + 1, z);
      ctx.oznam(`Teleport: ${menoOstrova(o)} (${BIOM_MENO[biom]})`);
    }
    if (a === 'kuKanoe' && !ctx.jeVKanoe()) hrac.poz.set(kanoe.poz.x + 2, Math.max(vyskaTerenu(kanoe.poz.x + 2, kanoe.poz.y), 0) + 1, kanoe.poz.y);
    if (a === 'kanoeKuMne' && !ctx.jeVKanoe()) {
      // najblizsia voda okolo hraca
      for (let r = 2; r < 80; r += 2) for (let u = 0; u < 6.28; u += 0.3) {
        const x = hrac.poz.x + Math.cos(u) * r, z = hrac.poz.z + Math.sin(u) * r;
        if (vyskaTerenu(x, z) < -1.2) { kanoe.poz.set(x, z); kanoe.rych.set(0, 0); return; }
      }
    }
    if (a === 'majak' && majaky[0]) { const m = majaky[0], [x, z] = m.budenie; if (ctx.jeVKanoe()) ctx.vystup([x, z]); hrac.poz.set(x, vyskaTerenu(x, z) + 1, z); ctx.oznam('Teleport: ' + m.def.meno); }
    if (a === 'start') { const s = ctx.start; if (ctx.jeVKanoe()) ctx.vystup([s.x, s.z]); hrac.poz.set(s.x, vyskaTerenu(s.x, s.z) + 1, s.z); }
    if (a === 'daj') {
      const id = panel.querySelector('#dev-pred').value, n = Math.max(1, +panel.querySelector('#dev-pocet').value || 1);
      const zv = pridaj(id, n); vykresli(); ctx.oznam(zv ? `Batoh je plný (nezmestilo sa ${zv}×)` : `+${n}× ${PREDMETY[id].meno || id}`);
    }
    if (a === 'nastroje') {
      let zv = 0; for (const id of Object.keys(PREDMETY)) if (PREDMETY[id].nastroj && !pocet(id)) zv += pridaj(id, 1);
      vykresli(); ctx.oznam(zv ? 'Batoh je plný – nie všetky nástroje sa zmestili' : 'Pridané nástroje');
    }
    if (a === 'more') {
      // po 1 kuse kazdeho predmetu z mora (obsah/more.js)
      let zv = 0; for (const id of MORSKE) zv += pridaj(id, 1);
      vykresli(); ctx.oznam(zv ? `Batoh je plný (nezmestilo sa ${zv}×)` : 'Pridané: všetko z mora');
    }
    if (a === 'vyprazdni') { sloty.fill(null); vykresli(); }
    if (a === 'cas') ctx.posunCas(60);
    if (a === 'hud') { const h = document.getElementById('hud'); h.style.display = h.style.display === 'none' ? '' : 'none'; }
    if (a === 'reset') { try { localStorage.removeItem(ctx.kluc); } catch (e) { /* nic */ } removeEventListener('beforeunload', ctx.uloz); location.reload(); }
  });
}

// volat kazdy snimok; vrati true, ak dev rezim riadil pohyb hraca (lietanie)
export function aktualizujDev(dt, g) {
  if (stlacene('F2')) {
    prepniDev(!dev.zapnuty);
  }
  snimky++; casFps += dt;
  if (casFps >= 0.5) { fps = snimky / casFps; snimky = 0; casFps = 0; }
  if (dev.zapnuty) {
    const { hrac, kanoe } = ctx, p = ctx.jeVKanoe() ? new THREE.Vector3(kanoe.poz.x, kanoe.y, kanoe.poz.y) : hrac.poz;
    const r = g.renderer.info.render;
    info.textContent = `${fps.toFixed(0)} FPS · ${r.calls} kr · ${(r.triangles / 1000).toFixed(0)}kΔ
${p.x.toFixed(0)}, ${p.y.toFixed(1)}, ${p.z.toFixed(0)} · bunka ${Math.floor(p.x / BUNKA)},${Math.floor(p.z / BUNKA)} · ${nasobokHustoty}×`;
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
