// Vystroj: nositelne predmety. Nasadzuju sa v batohu (Tab): panel Postava s 3D nahladom a 6 slotmi (hlava, telo, nohy, cizmy, plast, amulet).
//   Ťahaj kus z batohu na postavu / pravy klik na predmet v batohu alebo v liste / klik na slot ho zlozi / H = helma.
//   brnenie (5 sad x 4 kusy)      znizuje poskodenie (sucet kusov, max 80 %, cela sada +5 %)   (preziti.js zran, vystroj.obrana)
//   plast  (Ohnivzdorny plast)    lavove kaluze nepalia       (preziti.js zran, pricina 'lava')
//   cizmy  (Kozene cizmy)         +25 % rychlost v mociari    (preziti.js rychlostNasobok, vystroj.mociar)
//   amulet (Amulet hlbin)         2x dlhsi dych pod vodou     (hrac.js h.dychNasobok)
//   Kompas hmly sa nenasadzuje: staci ho mat v batohu, v HUD ukaze smer k najblizsiemu nezapalenemu majaku.
// Stav sa uklada sam (localStorage), modely su male a decentne, sedia na klboch postavy.
import * as THREE from 'three';
import { vystroj } from './preziti.js';
import { sloty, pocet, odober, pridaj, obnov as obnovInventar } from './inventar.js';
import { PREDMETY } from './obsah/predmety.js';
import { VYBAVA, SLOTY, SADA_PODLA_TIERU, BONUS_SADY, MAX_OBRANA } from './obsah/vystroj.js';
import { kusVystroje } from './modely_vystroja.js';
import { postavModel } from './postava.js';
import { aktivnySlot, klucVystroje } from './sloty.js';
import { ostrovPri } from './svet.js';
import { majaky } from './majak.js';
import { vietor } from './kanoe.js';

const KLUC = klucVystroje(aktivnySlot());
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const kus = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; return o; };

// plast: tenka doska na chrbte (vzadu = +z) + golier; jemne zeravy lem
function modelPlasta() {
  const g = new THREE.Group(), m = mat(0x2e2420, { roughness: 0.8 }), lem = mat(0x401008, { emissive: 0xff5010, emissiveIntensity: 1.2 });
  const p = kus(new THREE.BoxGeometry(0.34, 0.5, 0.025), m, 0, 0.2, 0.16); p.rotation.x = 0.12;
  p.add(kus(new THREE.BoxGeometry(0.35, 0.035, 0.03), lem, 0, -0.24, 0)); g.add(p);
  g.add(kus(new THREE.BoxGeometry(0.3, 0.04, 0.12), m, 0, 0.45, 0.1));
  return g;
}
// kozene cizmy: holen + priehlavok z krokodilej koze (na klbe kolena)
function modelCizmy() {
  const g = new THREE.Group(), k = mat(0x4a5a30, { roughness: 0.9 }), t = mat(0x2c3a1c, { roughness: 0.95 });
  g.add(kus(new THREE.CylinderGeometry(0.076, 0.068, 0.25, 10), k, 0, -0.29, 0));
  g.add(kus(new THREE.CylinderGeometry(0.082, 0.082, 0.03, 10), t, 0, -0.15, 0));
  const noha = kus(new THREE.CapsuleGeometry(0.056, 0.13, 6, 10).rotateX(Math.PI / 2), k, 0, -0.445, -0.085); noha.scale.set(1.12, 0.85, 1); g.add(noha);
  g.add(kus(new THREE.BoxGeometry(0.125, 0.026, 0.29), t, 0, -0.484, -0.07));
  return g;
}
// amulet: maly osemsten na hrudi (vpredu = -z)
const modelAmuletu = () => kus(new THREE.OctahedronGeometry(0.028, 0), mat(0x6a30b0, { emissive: 0x8040e0, emissiveIntensity: 0.8 }), 0, 0.38, -0.15);


// ---------- stav ----------
const PRAZDNE = () => Object.fromEntries(SLOTY.map(([s]) => [s, null]));
const nas = PRAZDNE();                                   // nasadene kusy: slot -> id predmetu
const dielyPre = id => {
  const v = VYBAVA[id];
  if (v.tier) return kusVystroje(v.slot, v.tier);
  if (id === 'ohnivzdorny_plast') return [{ j: 'chrbat', o: modelPlasta() }];
  if (id === 'amulet_hlbin') return [{ j: 'chrbat', o: modelAmuletu() }];
  return [{ j: 'kL', o: modelCizmy() }, { j: 'kP', o: modelCizmy() }];
};
// pripoji nasadene kusy na klby postavy J (hlavnej aj tej v nahlade batohu)
// vrati funkciu obnov(); obnov.anim(s) kazdy snimok zavola userData.anim vsetkych dielov a dobehne "pop" pri nasadeni
function oblecenie(J, priNasadeni) {
  const pripojene = {}, animy = [], popy = [];
  const obnov = () => {
    let zmena = false;
    for (const [slot] of SLOTY) {
      const id = nas[slot];
      if (pripojene[slot]?.id === id) continue;
      pripojene[slot]?.objs.forEach(o => o.parent?.remove(o));
      pripojene[slot] = null; zmena = true;
      if (id) {
        const d = dielyPre(id); d.forEach(x => J[x.j].add(x.o)); pripojene[slot] = { id, objs: d.map(x => x.o) };
        for (const x of d) popy.push({ o: x.o, s: x.o.scale.clone(), t: 0 });   // predmet "naskoci"
        priNasadeni?.(id, d);
      }
    }
    if (!zmena) return;
    animy.length = 0;                                       // zoznam animovanych objektov (aj vnorenych)
    for (const p of Object.values(pripojene)) p?.objs.forEach(o => o.traverse(c => { if (c.userData.anim) animy.push(c.userData.anim); }));
  };
  obnov.anim = s => {
    for (const a of animy) a(s);
    for (let i = popy.length - 1; i >= 0; i--) {
      const p = popy[i]; p.t += s.dt / 0.35;
      const k = p.t >= 1 ? 1 : 1 + Math.sin(p.t * Math.PI * 2.5) * (1 - p.t) * 0.45 * (p.t < 0.2 ? p.t / 0.2 : 1) - (p.t < 0.2 ? (1 - p.t / 0.2) * 0.7 : 0);
      p.o.scale.copy(p.s).multiplyScalar(k);
      if (p.t >= 1) popy.splice(i, 1);
    }
  };
  return obnov;
}

const CSS = `#postava-box{display:flex;flex-direction:column;align-items:center;gap:8px;padding-right:22px;margin-right:22px;border-right:1px solid var(--okraj)}
#postava-box h2{margin:0;align-self:flex-start;font-size:22px}
.pb-radek{display:flex;gap:8px;align-items:center}
.pb-stlpec{display:flex;flex-direction:column;gap:7px}
.ekv{position:relative;width:66px;height:66px;border-radius:12px;background:rgba(255,255,255,.14);border:2px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .12s,border-color .12s}
.ekv:hover{background:rgba(255,255,255,.26);border-color:rgba(255,255,255,.5)}
.ekv .ikona{font-size:36px;line-height:1}.ekv .ikona img,.ekv .ikona svg{width:54px;height:54px}
.ekv.prazdny::after{content:attr(data-meno);font-size:11px;opacity:.55;text-align:center}
.ekv.ciel{border-color:var(--zlta);background:rgba(255,210,122,.25)}
#postava-plat{width:210px;height:340px;border-radius:14px;background:radial-gradient(ellipse at 50% 35%,rgba(255,255,255,.22),rgba(0,0,0,.28));cursor:grab;touch-action:none}
#pb-obrana{font-size:15px;font-weight:700;text-align:center;line-height:1.35}#pb-obrana small{display:block;font-weight:500;opacity:.7;font-size:12px}`;

export function initVystroj(hrac, oznam, kam, iskry) {
  const J = hrac.J;
  let nacitane = false;
  // pri nasadeni: iskricky vo farbe kusu okolo klbu, kam sa pripojil
  const FARBY = { list: 0x7ad050, bambus: 0xe8d080, lastura: 0xffe8f0, krab: 0xff6a40, supina: 0xff8a20,
    ohnivzdorny_plast: 0xff6a20, kozene_cizmy: 0xa0b060, amulet_hlbin: 0xc080ff };
  const wp = new THREE.Vector3();
  const obleclHrac = oblecenie(J, (id, diely) => {
    if (!nacitane || !iskry) return;
    const f = FARBY[VYBAVA[id].tier] ?? FARBY[id] ?? 0xffffff;
    for (const d of diely) {
      d.o.getWorldPosition(wp);
      for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28; iskry.vypust(wp.x, wp.y, wp.z, Math.cos(a) * 1.4, 0.8 + Math.random() * 1.6, Math.sin(a) * 1.4, f, 0.6, 4); }
    }
  });
  let obleclNahlad = null;

  // ---------- panel Postava v batohu ----------
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const box = document.createElement('div'); box.id = 'postava-box';
  const slotHtml = s => `<div class="ekv prazdny" data-ekv="${s[0]}" data-meno="${s[1]}"></div>`;
  box.innerHTML = `<h2>Postava</h2><div class="pb-radek"><div class="pb-stlpec">${SLOTY.slice(0, 4).map(slotHtml).join('')}</div>`
    + `<canvas id="postava-plat"></canvas><div class="pb-stlpec">${SLOTY.slice(4).map(slotHtml).join('')}</div></div><div id="pb-obrana"></div>`;
  const batoh = document.getElementById('batoh');
  batoh.insertBefore(box, batoh.firstChild);
  const plat = box.querySelector('canvas');

  // HUD: znacka obrany vedla listy
  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:calc(50% + 165px);bottom:68px;height:34px;display:none;padding:0 10px;border-radius:8px;background:#0008;border:1px solid #fff5;pointer-events:none;z-index:4;color:#fff;font:600 14px/32px sans-serif';
  document.body.appendChild(hud);

  const obrana = () => {
    let o = 0, bonus = 0, sada = null;
    for (const [s] of SLOTY) if (nas[s]) o += VYBAVA[nas[s]].obrana;
    for (const [t, ids] of Object.entries(SADA_PODLA_TIERU)) if (ids.every(id => Object.values(nas).includes(id))) { bonus = BONUS_SADY; sada = t; }
    return { o: Math.min(MAX_OBRANA, o + bonus), bonus, sada };
  };
  const proc = x => Math.round(x * 100);
  function kresli() {
    for (const e of box.querySelectorAll('.ekv')) {
      const id = nas[e.dataset.ekv], p = id && PREDMETY[id];
      e.classList.toggle('prazdny', !id);
      e.innerHTML = p ? `<span class="ikona">${p.ikona}</span>` : '';
      e.title = p ? `${p.meno} – ${VYBAVA[id].efekt} (klik = zložiť)` : `${e.dataset.meno}: ťahaj sem kus výstroje z batohu`;
    }
    const r = obrana();
    box.querySelector('#pb-obrana').innerHTML = `🛡 Obrana: −${proc(r.o)} %<small>${r.sada ? 'Celá sada: bonus +' + proc(r.bonus) + ' %' : 'Celá sada (4 kusy) dá +' + proc(BONUS_SADY) + ' %'}</small>`;
    hud.style.display = r.o > 0 ? 'block' : 'none'; hud.textContent = '🛡 −' + proc(r.o) + ' %';
  }
  const prepocitaj = () => {
    vystroj.obrana = obrana().o;
    vystroj.plast = nas.plast === 'ohnivzdorny_plast';
    vystroj.cizmy = nas.cizmy === 'kozene_cizmy';
    vystroj.amulet = nas.amulet === 'amulet_hlbin';
    hrac.dychNasobok = vystroj.amulet ? 2 : 1;
  };
  const zapis = () => { try { localStorage.setItem(KLUC, JSON.stringify({ v: 2, n: nas })); } catch (e) { /* bez ukladania */ } };
  const zmena = () => { prepocitaj(); obleclHrac(); obleclNahlad?.(); kresli(); zapis(); obnovInventar(); };

  // nacitanie (aj zo stareho formatu: '1' = prilba, {prilba,plast,cizmy,amulet} = 0/1; kusy boli vtedy este v batohu)
  try {
    const s = localStorage.getItem(KLUC);
    const staryNaId = { prilba: 'krabia_prilba', plast: 'ohnivzdorny_plast', cizmy: 'kozene_cizmy', amulet: 'amulet_hlbin' };
    if (s === '1') { if (pocet('krabia_prilba') > 0) { odober('krabia_prilba', 1); nas.hlava = 'krabia_prilba'; } }
    else if (s && s[0] === '{') {
      const d = JSON.parse(s);
      if (d.v === 2) { for (const [sl] of SLOTY) if (VYBAVA[d.n?.[sl]]?.slot === sl) nas[sl] = d.n[sl]; }
      else for (const [k, id] of Object.entries(staryNaId)) if (d[k] && pocet(id) > 0) { odober(id, 1); nas[VYBAVA[id].slot] = id; }
    }
  } catch (e) { /* bez ukladania */ }

  const nasad = id => {
    const v = VYBAVA[id]; if (!v || pocet(id) < 1) return false;
    const stary = nas[v.slot];
    odober(id, 1); nas[v.slot] = id; if (stary) pridaj(stary, 1);
    zmena(); oznam(`Nasadil si ${PREDMETY[id].meno} (${v.efekt})`); return true;
  };
  const zloz = slot => {
    const id = nas[slot]; if (!id) return false;
    if (pridaj(id, 1) > 0) { oznam('Batoh je plný'); return false; }
    nas[slot] = null; zmena(); oznam(`Zložil si ${PREDMETY[id].meno}`); return true;
  };

  // ovladanie: pravy klik v liste / v batohu (udalost 'nasad' z inventar.js), tahanie na postavu ('naVybavu'), klik na slot = zlozit, H = helma
  addEventListener('pointerdown', e => {
    const s = e.button === 2 && e.target.closest('#lista .slot');
    if (s && nasad(sloty[+s.dataset.i]?.typ)) e.preventDefault();
  });
  addEventListener('contextmenu', e => { if (e.target.closest('#lista')) e.preventDefault(); });
  addEventListener('nasad', e => nasad(e.detail.id));
  addEventListener('naVybavu', e => {
    const { id, slot } = e.detail, v = VYBAVA[id];
    if (!v) return;
    if (slot && v.slot !== slot) { oznam(`${PREDMETY[id].meno} sa nosí na slot „${SLOTY.find(s => s[0] === v.slot)[1]}“`); return; }
    nasad(id);
  });
  box.addEventListener('click', e => { const s = e.target.closest('.ekv'); if (s) zloz(s.dataset.ekv); });
  addEventListener('keydown', e => {
    if (e.code !== 'KeyH' || e.repeat || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (nas.hlava) zloz('hlava'); else { const s = sloty.find(s => s && VYBAVA[s.typ]?.slot === 'hlava'); if (s) nasad(s.typ); }
  });
  hrac.prepniPrilbu = () => (nas.hlava ? zloz('hlava') : false);

  // ---------- 3D nahlad postavy (vlastny renderer, druha kopia modelu) ----------
  let rend = null, scena = null, kamN = null, model = null, yaw = 0, tahaPostavu = false;
  function zalozNahlad() {
    try { rend = new THREE.WebGLRenderer({ canvas: plat, alpha: true, antialias: true }); } catch (e) { rend = false; return; }
    rend.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); rend.setSize(210, 340, false); rend.setClearColor(0x000000, 0);
    scena = new THREE.Scene();
    scena.add(new THREE.HemisphereLight(0xfff4e0, 0x7a8aa0, 1.6));
    const k = new THREE.DirectionalLight(0xffffff, 2.6); k.position.set(-1.5, 2.5, -3); scena.add(k);
    const o = new THREE.DirectionalLight(0xbfd8ff, 1.0); o.position.set(2.5, 1.5, 2); scena.add(o);
    const JN = postavModel(); model = JN.telo; model.position.y = 0.95; scena.add(model);
    obleclNahlad = oblecenie(JN); obleclNahlad();
    kamN = new THREE.PerspectiveCamera(27, 210 / 340, 0.1, 30); kamN.position.set(0, 1.12, -5.0); kamN.lookAt(0, 0.98, 0);
    plat.addEventListener('pointerdown', e => { tahaPostavu = true; plat.setPointerCapture(e.pointerId); plat.style.cursor = 'grabbing'; });
    plat.addEventListener('pointermove', e => { if (tahaPostavu) yaw -= e.movementX * 0.012; });
    plat.addEventListener('pointerup', () => { tahaPostavu = false; plat.style.cursor = 'grab'; });
  }
  let cas = performance.now();
  const tikNahlad = () => {
    requestAnimationFrame(tikNahlad);
    const t = performance.now(), dt = Math.min(0.1, (t - cas) / 1000); cas = t;
    if (batoh.style.display === 'none') return;
    if (rend === null) zalozNahlad();
    if (!rend) return;
    if (!tahaPostavu) yaw += dt * 0.35;
    model.rotation.y = yaw;
    rend.render(scena, kamN);
  };
  tikNahlad();

  // zvyrazni cielovy slot pri tahani predmetu z batohu
  addEventListener('pointermove', e => {
    box.querySelectorAll('.ekv.ciel').forEach(x => x.classList.remove('ciel'));
    const d = document.getElementById('duch');
    if (!d || d.style.display === 'none') return;
    const pod = document.elementFromPoint(e.clientX, e.clientY)?.closest('.ekv');
    if (pod) pod.classList.add('ciel');
  });

  setInterval(() => { const o = ostrovPri(hrac.poz.x, hrac.poz.z, 1.1); vystroj.mociar = !!o && o.biom === 'mangrovy' && !hrac.plava; }, 500);
  zmena();
  nacitane = true;
  hrac.prepniVystroj = nasad;

  // ---------- animacie vystroja (userData.anim dielov, kontrakt v modely_vystroja.js / modely_trofeji.js) ----------
  const sH = { t: 0, dt: 0, rych: 0, vpred: 0, vy: 0, vietor, vietorLok: { x: 0, z: 0 }, podVodou: false, plava: false, nahlad: false };
  const sN = { ...sH, vietor: { smer: 0, sila: 0 }, vietorLok: { x: 0, z: 0.15 }, nahlad: true };
  let casA = performance.now();
  const tikAnim = () => {
    requestAnimationFrame(tikAnim);
    const t = performance.now(), dt = Math.min(0.1, (t - casA) / 1000); casA = t;
    const a = hrac.smer || 0, sa = Math.sin(a), ca = Math.cos(a);
    const wx = -Math.sin(vietor.smer) * vietor.sila, wz = -Math.cos(vietor.smer) * vietor.sila;   // svetovy vektor vetra
    sH.t = sN.t = t / 1000; sH.dt = sN.dt = dt;
    sH.rych = Math.hypot(hrac.rych.x, hrac.rych.z);
    sH.vpred = -hrac.rych.x * sa - hrac.rych.z * ca;
    sH.vy = hrac.vy || 0;
    sH.vietorLok.x = wx * ca - wz * sa; sH.vietorLok.z = wx * sa + wz * ca;   // do lokalnych suradnic postavy (+z = dozadu)
    sH.podVodou = !!hrac.potapa; sH.plava = !!hrac.plava;
    obleclHrac.anim(sH);
    if (obleclNahlad && batoh.style.display !== 'none') obleclNahlad.anim(sN);
  };
  tikAnim();

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
