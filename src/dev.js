// Dev rezim (F2): panel pre vyvojara - lietanie, teleport, predmety, lode, svet, boj, Bledi, strach, textova konzola, FPS.
// Nic z toho nie je v normalnej hre vidiet, kym sa nestlaci F2.
// Mys: F2 panel otvori a uvolni kurzor; kamera sa otaca tahanim s PRAVYM tlacidlom, klik do sceny = hrat s panelom,
// klavesa pod Esc (`) prepina kurzor <-> hra, F2 panel zavrie a vrati mys do hry (bez menu).
import * as THREE from 'three';
import { klavesy, mys } from './vstup.js';
import { ostrovVBunke, vyskaTerenu, BUNKA, BIOM_MENO, prestavSvet, MENOVANE_OSTROVY } from './svet.js';
import { menoOstrova } from './znacky.js';
import { nastavHustotu, nasobokHustoty } from './vegetacia.js';
import { PREDMETY } from './obsah/predmety.js';
import { sloty, pridaj, pocet, vykresli } from './inventar.js';
import { tlmUhol } from './hrac.js';
import { VYL_MAX } from './kanoe.js';
import { NEPRIATELIA } from './obsah/nepriatelia.js';
import { spawnPriHracovi, zoznamNepriatelov, odstranNepriatela } from './nepriatelia.js';
import { bledyPrikaz, bledyPrehlad, bledySem, vykukniSem, nastavenia as bledyNast } from './bledi.js';
import { stav as preziti, cheat } from './preziti.js';
import { majaky } from './majak.js';
import { VYBAVA } from './obsah/vystroj.js';
import { stavStrachu, nastavStrach, pridajStrach, nastavZonu, skusZvuk, DRUHY_ZVUKOV, diagnostika } from './strach.js';

export const dev = {
  zapnuty: false,
  lietanie: false,
  rychlostLetu: 25,
  silaUderu: 1,          // nasobok poskodenia (okamzite rubanie = 100)
  bezOpotrebenia: false,
  nekonecnyDych: false,
};

let ctx, panel, info, snimky = 0, casFps = 0, fps = 0;
const NAZVY_ZVUKOV = { sepot: 'Šepot', kroky: 'Kroky v piesku', konar: 'Konár', klopanie: 'Klopanie', srdce: 'Srdce', vykrik: 'Výkrik', dych: 'Dych', dron: 'Dron (9 s)', svitanie: 'Svitanie' };

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
  #dev input[type=number], #dev input[type=text] { padding: 3px 6px; border: 1px solid #456; border-radius: 6px; background: #101824; color: #fff; font: inherit; }
  #dev .rada { font-size: 11px; color: #b8c6d8; }
  #dev .konzola { flex-direction: column; align-items: stretch; width: min(720px, 92vw); }
  #dev #dev-vystup { font: 12px/1.35 ui-monospace, monospace; color: #cfe; white-space: pre-wrap; max-height: 190px; overflow-y: auto; background: #0b1119; border-radius: 6px; padding: 6px 8px; user-select: text; }
  #dev #dev-prikaz { width: 100%; box-sizing: border-box; font: 13px ui-monospace, monospace; }
</style>
<div class="lista">
  <button class="zap" id="dev-zap" title="Dev režim (F2)">🛠 DEV</button>
  <span class="ot" hidden><span class="info" id="dev-info"></span></span>
  <span class="ot" hidden id="dev-tabs">
    <button class="tab" data-t="pohyb">Pohyb</button><button class="tab" data-t="teleport">Teleport</button><button class="tab" data-t="predmety">Predmety</button><button class="tab" data-t="lode">Lode</button><button class="tab" data-t="svet">Svet</button><button class="tab" data-t="boj">Boj</button><button class="tab" data-t="bledi">Bledí</button><button class="tab" data-t="strach">Strach</button><button class="tab" data-t="konzola">Konzola</button>
  </span>
  <button class="ot" hidden data-a="hraj" title="Vrátiť myš do hry (alebo klik do scény / klávesa pod Esc)">▶ Hrať</button>
  <span class="ot rada" hidden id="dev-rada"></span>
</div>
<div class="obsah" data-t="pohyb" hidden>
  <label><input type="checkbox" data-p="lietanie"> Lietanie <small>(Medzerník ↑, C ↓, Shift rýchlo)</small></label>
  <label>Rýchlosť <input type="range" min="5" max="150" value="25" data-r="rychlostLetu"> <span id="dev-rl">25</span> m/s</label>
  <label><input type="checkbox" data-p="nekonecnyDych"> Nekonečný dych</label>
  <label><input type="checkbox" data-p="bezOpotrebenia"> Nástroje sa neopotrebúvajú</label>
  <label><input type="checkbox" data-a="rubanie"> Okamžité rúbanie</label>
  <label><input type="checkbox" id="dev-god"> Nesmrteľnosť <small>(bez zranenia, hladu, smädu)</small></label>
  <button data-a="heal">❤ Doplň zdravie, jedlo, vodu</button>
</div>
<div class="obsah" data-t="teleport" hidden>
  <div class="skup"><b>Biom</b><select id="dev-biom">${Object.entries(BIOM_MENO).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><button data-a="teleport">Na najbližší</button></div>
  <div class="skup"><b>Miesta</b><button data-a="kuKanoe">Ku kanoe</button><button data-a="kanoeKuMne">Kanoe ku mne</button><button data-a="start">Na štart</button><button data-a="majak">K majáku 1</button><button data-a="zatoka">Tichá zátoka</button><button data-a="dopredu">50 m dopredu</button></div>
  <div class="skup"><b>Ostrov</b><select id="dev-ostrov">${MENOVANE_OSTROVY.map(o => `<option value="${o.id}">${o.meno || o.id}</option>`).join('')}</select><button data-a="naOstrov">Teleport</button></div>
  <div class="skup"><b>Súradnice</b>x <input type="number" id="dev-tx" style="width:70px"> z <input type="number" id="dev-tz" style="width:70px"><button data-a="suradnice">Choď</button></div>
</div>
<div class="obsah" data-t="predmety" hidden>
  <div class="skup"><b>Predmet</b><select id="dev-pred">${Object.entries(PREDMETY).map(([k, v]) => `<option value="${k}">${v.meno || k}</option>`).join('')}</select>
    <input type="number" id="dev-pocet" value="20" min="1" max="999" style="width:56px"><button data-a="daj">Daj</button></div>
  <div class="skup"><button data-a="nastroje">Všetky nástroje</button><button data-a="armor">Všetok armor</button><button data-a="vyprazdni">Vyprázdni batoh</button></div>
</div>
<div class="obsah" data-t="strach" hidden>
  <div class="skup"><b>Strach</b><input type="range" min="0" max="100" value="0" id="dev-strach"> <span id="dev-strach-v">0.00</span><button data-a="lak">Ľak +0.3</button></div>
  <div class="skup"><label><input type="checkbox" id="dev-zona"> Hororová zóna</label><label><input type="checkbox" id="dev-noc"> Ber ako noc (aj cez deň)</label><label><input type="checkbox" id="dev-udalosti" checked> Náhodné zvuky v tichu</label></div>
  <div class="skup"><b>Zvuky</b>${DRUHY_ZVUKOV.map(d => `<button data-zvuk="${d}">${NAZVY_ZVUKOV[d] || d}</button>`).join('')}</div>
  <div class="skup"><span class="info" id="dev-strach-info"></span></div>
</div>
<div class="obsah" data-t="boj" hidden>
  <div class="skup"><b>Spawn</b>${Object.entries(NEPRIATELIA).map(([k, v]) => `<button data-nepr="${k}">${v.meno}</button>`).join('')}</div>
  <div class="skup"><button data-a="zabiNepr">☠ Odstráň všetkých nepriateľov</button><label><input type="checkbox" id="dev-god2"> Nesmrteľnosť</label></div>
</div>
<div class="obsah" data-t="bledi" hidden>
  <div class="skup"><b>Privolaj</b><button data-a="bledy">Bledý sem</button><button data-a="bledyVsetci">Všetci sem</button><button data-a="matka">Matka sem</button><button data-a="vykuk">Vykukne spoza stromu</button></div>
  <div class="skup"><b>Správanie</b><button data-a="bledyUtok">Najbližší zaútočí</button><button data-a="bledySchovaj">Schovaj všetkých</button><button data-a="bledyZabi">Zabi viditeľných</button><button data-a="bledyLieci">Plné životy</button><button data-a="bledyai">AI zap/vyp</button></div>
  <div class="skup"><b>Noc</b><button data-hod="0">Skoč na polnoc</button><button data-a="bledyZona">Tichá zátoka + noc</button><label><input type="checkbox" id="dev-noc2"> Ber ako noc (aj cez deň)</label></div>
  <div class="skup"><span class="info" id="dev-bledi-info"></span></div>
</div>
<div class="obsah konzola" data-t="konzola" hidden>
  <div id="dev-vystup">Napíš príkaz a Enter (napr. <b>pomoc</b>). Šípky ↑↓ = história.</div>
  <input type="text" id="dev-prikaz" placeholder="pomoc · tp ticha_zatoka · daj drevo 50 · cas 0 · bledy vsetci · god" autocomplete="off" spellcheck="false">
</div>
<div class="obsah" data-t="lode" hidden>
  <div class="skup"><b>Úroveň kanoe</b><button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button><button data-k="4">4</button></div>
  <div class="skup"><b>Nová loď</b><button data-lod="kanoe">Kanoe</button><button data-lod="pretekove">Pretekárske</button><button data-lod="barza">Barža</button><button data-lod="katamaran">Katamarán</button></div>
  <div class="skup"><b>Vylepšenia</b><button data-vyl="1">Max</button><button data-vyl="0">0</button></div>
</div>
<div class="obsah" data-t="svet" hidden>
  <div class="skup"><b>Mesiac</b><button data-mes="0">🌑 Nov</button><button data-mes="1">🌒</button><button data-mes="2">🌓 Štvrť</button><button data-mes="3">🌔</button><button data-mes="4">🌕 Spln</button><button data-mes="6">🌗</button></div>
  <div class="skup"><b>Čas</b><button data-hod="0">Polnoc</button><button data-hod="12">Poludnie</button><button data-hod="18.6">Súmrak</button></div>
  <div class="skup"><b>Počasie</b><button data-poc="0">Jasno</button><button data-poc="1">Oblačno</button><button data-poc="2">Dážď</button><button data-poc="3">Búrka</button></div>
</div>
<div class="obsah" data-t="svet" hidden>
  <div class="skup"><b>Vegetácia</b><button data-h="0.5">0.5×</button><button data-h="1">1×</button><button data-h="2">2×</button><button data-h="3">3×</button></div>
  <div class="skup"><button data-a="cas">Čas +60 s (príliv)</button><button data-a="hud">Skryť/ukázať HUD</button><button data-a="reset">Zmazať uloženie a reštart</button></div>
</div>
`;

const platno = () => ctx.platno;   // platno hry (v stranke je viac <canvas> - minimapa, ikony...)
const zamknuta = () => document.pointerLockElement === platno();
// zamkne mys do hry; ak prehliadac odmietne (napr. hned po Esc), hra caka na klik do sceny
const zamkni = () => { const r = platno().requestPointerLock(); r?.catch?.(() => { cakaKlik = true; if (!dev.zapnuty) ctx.oznam('🖱 Klikni do hry'); }); };
let aktTab = null, cakaKlik = false;
function otvorTab(t) {
  aktTab = aktTab === t ? null : t;
  panel.querySelectorAll('.tab').forEach(b => b.classList.toggle('akt', b.dataset.t === aktTab));
  panel.querySelectorAll('.obsah').forEach(o => { o.hidden = o.dataset.t !== aktTab; });
  try { localStorage.setItem('devTab', aktTab || ''); } catch (e) { /* nic */ }
  if (aktTab === 'konzola' && !zamknuta()) setTimeout(() => panel.querySelector('#dev-prikaz').focus(), 0);
}
function rada() {
  panel.querySelector('#dev-rada').textContent = zamknuta()
    ? 'hráš · klávesa pod Esc (`) = kurzor · F2 = zavrieť'
    : 'kurzor · pravé tlačidlo + ťahanie = otáčanie kamery · klik do scény = hrať · F2 = zavrieť';
}
// F2: otvori panel a uvolni kurzor (kamera ide otacat pravym tlacidlom); zavretie vrati mys do hry
function prepniDev(zap) {
  dev.zapnuty = zap;
  mys.volneOtacanie = zap; mys.tahanie = false;
  panel.classList.toggle('otvoreny', zap);
  panel.querySelectorAll('.lista .ot').forEach(o => { o.hidden = !zap; });
  panel.querySelectorAll('.obsah').forEach(o => { o.hidden = !zap || o.dataset.t !== aktTab; });
  document.getElementById('start').style.display = 'none';
  document.activeElement?.blur?.();
  if (zap) { if (zamknuta()) document.exitPointerLock(); }
  else if (!zamknuta()) zamkni();
  rada();
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
  // klik do sceny pri otvorenom paneli (alebo ked prehliadac odmietol zamknutie) vrati mys do hry
  platno().addEventListener('click', () => { if (dev.zapnuty || cakaKlik) { cakaKlik = false; zamkni(); } });
  document.addEventListener('pointerlockchange', () => {
    if (zamknuta()) cakaKlik = false;
    if (dev.zapnuty) { document.getElementById('start').style.display = 'none'; rada(); }
  });
  // klavesy priamo v udalosti (nie v herne slucke) - prehliadac povoli zamknutie mysi len pocas stlacenia
  addEventListener('keydown', e => {
    if (e.code === 'F2') { e.preventDefault(); if (!e.repeat) prepniDev(!dev.zapnuty); return; }
    if (e.code === 'Backquote' && dev.zapnuty && e.target.id !== 'dev-prikaz') {
      e.preventDefault();
      if (zamknuta()) document.exitPointerLock(); else zamkni();
    }
  });
  const sync = (id, v) => { for (const i of ['dev-god', 'dev-god2']) panel.querySelector('#' + i).checked = v; };
  const pole = panel.querySelector('#dev-prikaz'), historia = []; let hi = 0;
  pole.addEventListener('keydown', e => {
    if (e.code === 'F2') return;
    e.stopPropagation();
    if (e.key === 'Enter' && pole.value.trim()) { historia.push(pole.value); hi = historia.length; vypis('> ' + pole.value); vypis(prikaz(pole.value)); pole.value = ''; }
    if (e.key === 'ArrowUp' && hi > 0) { pole.value = historia[--hi]; e.preventDefault(); }
    if (e.key === 'ArrowDown') { hi = Math.min(historia.length, hi + 1); pole.value = historia[hi] || ''; e.preventDefault(); }
    if (e.key === 'Escape') pole.blur();
  });
  ctx.syncGod = sync;

  panel.addEventListener('change', e => { if (e.target.type === 'checkbox') e.target.blur(); });
  panel.addEventListener('click', e => { if (e.target.closest('button')) e.target.closest('button').blur(); });
  panel.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.p) dev[t.dataset.p] = t.checked;
    if (t.dataset.r) { dev[t.dataset.r] = +t.value; panel.querySelector('#dev-rl').textContent = t.value; }
    if (t.dataset.a === 'rubanie') dev.silaUderu = t.checked ? 100 : 1;
    if (t.id === 'dev-strach') nastavStrach(t.value / 100);
    if (t.id === 'dev-zona') nastavZonu(t.checked ? 1 : 0);
    if (t.id === 'dev-noc' || t.id === 'dev-noc2') { stavStrachu.vynutNoc = t.checked; panel.querySelector('#dev-noc').checked = panel.querySelector('#dev-noc2').checked = t.checked; }
    if (t.id === 'dev-god' || t.id === 'dev-god2') { cheat.nesmrtelny = t.checked; sync(t.id, t.checked); }
    if (t.id === 'dev-udalosti') stavStrachu.udalosti = t.checked;
  });
  panel.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.t) return otvorTab(t.dataset.t);
    if (t.dataset.a === 'hraj') return zamkni();
    const { hrac, kanoe } = ctx;
    if (t.dataset.zvuk) return skusZvuk(t.dataset.zvuk);
    if (t.dataset.a === 'lak') return pridajStrach(0.3);
    const bp = BLEDI_AKCIE[t.dataset.a];
    if (bp) return ctx.oznam(bp());
    if (t.dataset.nepr) ctx.oznam(spawnPriHracovi(t.dataset.nepr, ctx.hrac.poz) ? `Spawn: ${NEPRIATELIA[t.dataset.nepr].meno}` : 'Nie je kde spawnovať');
    if (t.dataset.mes) ctx.oznam(`Mesiac: ${ctx.mesiac(+t.dataset.mes)}`);
    if (t.dataset.hod) { ctx.skokNaHodinu(+t.dataset.hod); ctx.oznam(`Skok na ${t.textContent}`); }
    if (t.dataset.poc) { ctx.pocasie(+t.dataset.poc); ctx.oznam(`Počasie: ${t.textContent}`); }
    if (t.dataset.lod) ctx.spawnLod(t.dataset.lod);
    if (t.dataset.vyl) { for (const x in kanoe.vyl) kanoe.vylepsi(x, t.dataset.vyl === '1' ? VYL_MAX : 0); ctx.oznam(t.dataset.vyl === '1' ? 'Vylepšenia na maximum' : 'Vylepšenia vynulované'); }
    if (t.dataset.k) { if (kanoe.druh !== 'kanoe') ctx.oznam('Najbližšia loď nie je kanoe'); else { kanoe.nastavUroven(+t.dataset.k); ctx.oznam(`Kanoe: úroveň ${t.dataset.k}`); } }
    if (t.dataset.h) { nastavHustotu(+t.dataset.h); prestavSvet(); ctx.oznam(`Hustota vegetácie ${t.dataset.h}×`); }
    const a = t.dataset.a;
    if (a === 'zatoka') { window.hra.naOstrov('ticha_zatoka'); ctx.oznam('Teleport: Tichá zátoka'); }
    if (a === 'naOstrov') ctx.oznam('Teleport: ' + window.hra.naOstrov(panel.querySelector('#dev-ostrov').value));
    if (a === 'dopredu') { const [x, z] = predHracom(50); teleport(x, z); }
    if (a === 'suradnice') teleport(+panel.querySelector('#dev-tx').value || 0, +panel.querySelector('#dev-tz').value || 0);
    if (a === 'heal') { preziti.zdravie = preziti.hlad = preziti.smad = 100; ctx.oznam('Zdravie, jedlo a voda na maximum'); }
    if (a === 'zabiNepr') ctx.oznam(`Odstránených nepriateľov: ${zabiNepriatelov()}`);
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
    if (a === 'armor') {
      // po 1 kuse kazdeho kusu vystroje (brnenie 5 sad x 4 + plast, cizmy z kroka, amulet)
      let zv = 0; for (const id of Object.keys(VYBAVA)) zv += pridaj(id, 1);
      vykresli(); ctx.oznam(zv ? `Batoh je plný (nezmestilo sa ${zv}×)` : 'Pridaný všetok armor');
    }
    if (a === 'vyprazdni') { sloty.fill(null); vykresli(); }
    if (a === 'cas') ctx.posunCas(60);
    if (a === 'hud') { const h = document.getElementById('hud'); h.style.display = h.style.display === 'none' ? '' : 'none'; }
    if (a === 'reset') { try { localStorage.removeItem(ctx.kluc); } catch (e) { /* nic */ } removeEventListener('beforeunload', ctx.uloz); location.reload(); }
  });
}

// ---------- pomocne akcie (tlacidla aj konzola) ----------
const hracPoz = () => (ctx.jeVKanoe() ? { x: ctx.kanoe.poz.x, z: ctx.kanoe.poz.y } : ctx.hrac.poz);
function predHracom(d) { const p = hracPoz(), y = ctx.kam.yaw; return [p.x - Math.sin(y) * d, p.z - Math.cos(y) * d]; }
export function teleport(x, z) {
  if (ctx.jeVKanoe() || ctx.jeNaPalube()) ctx.vystup([x, z]);
  ctx.hrac.poz.set(x, Math.max(vyskaTerenu(x, z), 0) + 1, z); ctx.hrac.vy = 0;
  ctx.oznam(`Teleport: ${x.toFixed(0)}, ${z.toFixed(0)}`);
}
function zabiNepriatelov() { const z = [...zoznamNepriatelov()]; z.forEach(odstranNepriatela); return z.length; }
const BLEDI_AKCIE = {
  bledy: () => (bledySem(ctx.hrac) ? 'Bledý pri tebe (oheň/fakľa ho odoženie)' : 'Bledí nie sú načítaní'),
  bledyVsetci: () => `Privolaných Bledých: ${bledyPrikaz('vsetci', ctx.hrac)}`,
  matka: () => (bledyPrikaz('matka', ctx.hrac) ? 'Matka pred tebou' : 'Matka neexistuje'),
  vykuk: () => 'Vykuknutie: ' + (vykukniSem(ctx.hrac)?.id ?? 'žiadny strom blízko'),
  bledyUtok: () => (bledyPrikaz('utok', ctx.hrac) ? 'Bledý útočí!' : 'Žiadny viditeľný Bledý (privolaj ho)'),
  bledySchovaj: () => `Schovaných: ${bledyPrikaz('schovaj', ctx.hrac)}`,
  bledyZabi: () => `Zabitých: ${bledyPrikaz('zabi', ctx.hrac)}`,
  bledyLieci: () => { bledyPrikaz('lieci', ctx.hrac); return 'Bledí majú plné životy'; },
  bledyai: () => 'AI Bledých: ' + ((bledyNast.ai = !bledyNast.ai) ? 'zapnutá' : 'vypnutá (stoja)'),
  bledyZona: () => { window.hra.naOstrov('ticha_zatoka'); ctx.skokNaHodinu(0); return 'Tichá zátoka, polnoc – Bledí vychádzajú'; },
};
function vypis(t) {
  if (!t) return;
  const v = panel.querySelector('#dev-vystup');
  v.textContent += '\n' + t;
  v.scrollTop = v.scrollHeight;
}

// ---------- textova konzola ----------
const POMOC = `Príkazy:
  tp <x> <z> | tp <id ostrova> | tp start | tp kanoe | tp 50 (dopredu)
  ostrovy                 zoznam ručných ostrovov
  daj <id> [počet]        predmet do batoha (hľadá aj podľa mena)
  predmety [text]         nájdi id predmetu
  cas <hodina>            skok na hodinu (0 = polnoc, 12 = poludnie)
  pocasie <0-3>           jasno / oblačno / dážď / búrka
  god                     nesmrteľnosť zap/vyp
  heal                    zdravie, jedlo, voda na 100
  let [rýchlosť]          lietanie zap/vyp
  spawn <druh>            nepriateľ (druhy: ${Object.keys(NEPRIATELIA).join(', ')})
  zabi                    odstráň všetkých nepriateľov
  bledy <sem|vsetci|matka|vykuk|utok|schovaj|zabi|lieci|ai|noc|stav>
  strach <0-1>            úroveň strachu
  zvuk <druh>             hororový zvuk (${DRUHY_ZVUKOV.join(', ')})
  hustota <0.5-3>         hustota vegetácie
  vycisti                 vymaž výpis`;
const BLEDI_SKRATKY = { sem: 'bledy', vsetci: 'bledyVsetci', matka: 'matka', vykuk: 'vykuk', utok: 'bledyUtok', schovaj: 'bledySchovaj', zabi: 'bledyZabi', lieci: 'bledyLieci', ai: 'bledyai', noc: 'bledyZona' };
function najdiPredmet(t) {
  t = t.toLowerCase();
  if (PREDMETY[t]) return t;
  return Object.keys(PREDMETY).find(k => (PREDMETY[k].meno || '').toLowerCase() === t)
      ?? Object.keys(PREDMETY).find(k => k.includes(t) || (PREDMETY[k].meno || '').toLowerCase().includes(t));
}
function prikaz(riadok) {
  const [c, ...arg] = riadok.trim().split(/\s+/), a1 = arg[0], n1 = parseFloat(a1);
  switch (c.toLowerCase()) {
    case 'pomoc': case 'help': case '?': return POMOC;
    case 'vycisti': case 'cls': panel.querySelector('#dev-vystup').textContent = ''; return '';
    case 'ostrovy': return MENOVANE_OSTROVY.map(o => `${o.id} – ${o.meno || ''}`).join('\n');
    case 'tp': {
      if (!a1) return 'tp <x> <z> | tp <id> | tp start | tp kanoe | tp <metre>';
      if (a1 === 'start') { teleport(ctx.start.x, ctx.start.z); return 'Na štart'; }
      if (a1 === 'kanoe') { teleport(ctx.kanoe.poz.x + 2, ctx.kanoe.poz.y); return 'Ku kanoe'; }
      if (arg.length >= 2 && !isNaN(n1)) { teleport(n1, parseFloat(arg[1])); return `Teleport ${n1}, ${arg[1]}`; }
      if (!isNaN(n1)) { const [x, z] = predHracom(n1); teleport(x, z); return `${n1} m dopredu`; }
      return window.hra.naOstrov(a1);
    }
    case 'predmety': return Object.entries(PREDMETY).filter(([k, v]) => !a1 || k.includes(a1) || (v.meno || '').toLowerCase().includes(a1.toLowerCase())).map(([k, v]) => `${k} – ${v.meno || ''}`).slice(0, 60).join('\n') || 'nič';
    case 'daj': {
      const id = a1 && najdiPredmet(a1); if (!id) return 'Neznámy predmet (skús: predmety <text>)';
      const n = Math.max(1, parseInt(arg[1]) || 1), zv = pridaj(id, n); vykresli();
      return zv ? `Batoh je plný (nezmestilo sa ${zv}×)` : `+${n}× ${PREDMETY[id].meno || id}`;
    }
    case 'cas': if (isNaN(n1)) return 'cas <hodina 0-24>'; ctx.skokNaHodinu(n1); return `Skok na ${n1}:00`;
    case 'pocasie': if (isNaN(n1)) return 'pocasie <0-3>'; ctx.pocasie(n1); return 'Počasie ' + ['jasno', 'oblačno', 'dážď', 'búrka'][n1];
    case 'god': cheat.nesmrtelny = !cheat.nesmrtelny; ctx.syncGod(null, cheat.nesmrtelny); return 'Nesmrteľnosť ' + (cheat.nesmrtelny ? 'zapnutá' : 'vypnutá');
    case 'heal': preziti.zdravie = preziti.hlad = preziti.smad = 100; return 'Doplnené';
    case 'let': {
      dev.lietanie = isNaN(n1) ? !dev.lietanie : true;
      if (!isNaN(n1)) { dev.rychlostLetu = n1; panel.querySelector('#dev-rl').textContent = n1; }
      panel.querySelector('[data-p=lietanie]').checked = dev.lietanie;
      return 'Lietanie ' + (dev.lietanie ? `zapnuté (${dev.rychlostLetu} m/s)` : 'vypnuté');
    }
    case 'spawn': if (!NEPRIATELIA[a1]) return 'Druhy: ' + Object.keys(NEPRIATELIA).join(', '); return spawnPriHracovi(a1, ctx.hrac.poz) ? `Spawn: ${NEPRIATELIA[a1].meno}` : 'Nie je kde spawnovať';
    case 'zabi': return `Odstránených: ${zabiNepriatelov()}`;
    case 'bledy': case 'bledi': {
      if (!a1 || a1 === 'stav') return 'Bledí: ' + bledyPrehlad();
      const f = BLEDI_AKCIE[BLEDI_SKRATKY[a1]]; return f ? f() : 'bledy <' + Object.keys(BLEDI_SKRATKY).join('|') + '|stav>';
    }
    case 'strach': if (isNaN(n1)) return 'strach <0-1>'; nastavStrach(n1); return `Strach ${n1}`;
    case 'zvuk': if (!DRUHY_ZVUKOV.includes(a1)) return 'Zvuky: ' + DRUHY_ZVUKOV.join(', '); skusZvuk(a1); return 'Hrá: ' + a1;
    case 'hustota': if (isNaN(n1)) return 'hustota <0.5-3>'; nastavHustotu(n1); prestavSvet(); return `Hustota ${n1}×`;
    default: return `Neznámy príkaz „${c}“ – napíš pomoc`;
  }
}

// volat kazdy snimok; vrati true, ak dev rezim riadil pohyb hraca (lietanie)
export function aktualizujDev(dt, g) {
  snimky++; casFps += dt;
  if (casFps >= 0.5) { fps = snimky / casFps; snimky = 0; casFps = 0; }
  if (dev.zapnuty) {
    const st = document.getElementById('start');
    if (st.style.display !== 'none') st.style.display = 'none';   // menu "Klikni a hraj" sa s panelom nebije
    const { hrac, kanoe } = ctx, p = ctx.jeVKanoe() ? new THREE.Vector3(kanoe.poz.x, kanoe.y, kanoe.poz.y) : hrac.poz;
    const r = g.renderer.info.render;
    info.textContent = `${fps.toFixed(0)} FPS · ${r.calls} kr · ${(r.triangles / 1000).toFixed(0)}kΔ
${p.x.toFixed(0)}, ${p.y.toFixed(1)}, ${p.z.toFixed(0)} · bunka ${Math.floor(p.x / BUNKA)},${Math.floor(p.z / BUNKA)} · ${nasobokHustoty}×`;
    if (aktTab === 'bledi' && (snimky % 10 === 0)) panel.querySelector('#dev-bledi-info').textContent = 'Bledí: ' + bledyPrehlad();
    if (aktTab === 'strach') {
      const s = diagnostika();
      panel.querySelector('#dev-strach-v').textContent = s.strach.toFixed(2);
      panel.querySelector('#dev-strach-info').textContent = `zóna ${s.zona.toFixed(2)} · ticho ${s.ticho.toFixed(2)} · hlasy ${s.hlasy} · uzly ${s.uzly} · zvuk ${s.zvukBezi ? 'beží' : 'vypnutý (klikni do hry)'}`;
    }
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
