// Majaky: rozpadnuta vez (kolizia), oprava vlozenim materialu (E pri pate), strazca (boss), zapalenie (svetelny kuzel, kluzeny more, miesto prebudenia),
// flase so spravami na plazach. Data su v obsah/majaky.js a obsah/spravy.js - dalsie pasma = len nove zaznamy.
import * as THREE from 'three';
import { MAJAKY } from './obsah/majaky.js';
import { SPRAVY } from './obsah/spravy.js';
import { NEPRIATELIA } from './obsah/nepriatelia.js';
import { ostrovVBunke, vyskaTerenu, startovaciaPozicia, BUNKA, MENOVANE_OSTROVY } from './svet.js';
import { upokojenePasma } from './ocean.js';
import { pocet, odober, vykresli as vykresliInventar } from './inventar.js';
import { PREDMETY } from './obsah/predmety.js';
import { spawnNepriatela, odstranNepriatela, udalosti as nepUdalosti } from './nepriatelia.js';
import { stlacene } from './vstup.js';
import { zvuky } from './zvuk.js';
import { stav as stavPreziti } from './preziti.js';

export const majaky = [];                 // { def, x, z, y, lit, vlozene:{id:n}, porazeny, objaveny, boss, g, ... }
export const precitane = new Set();       // indexy zdvihnutych/precitanych sprav (SPRAVY)
const R_KOLIZIA = 4.3, DOSAH = 7.5;
const flase = [];                         // { i, x, z, g }
let ctx = { oznam: () => {}, nastavPostel: () => {} }, scena = null;
let panel, bossHud, spravaOkno, spravaCas = 0, cas = 0;

// ---------- vyber miesta (deterministicky) ----------
const START = { x: BUNKA / 2, z: BUNKA / 2 };
function vyberOstrov(def) {
  if (def.ostrovId) return MENOVANE_OSTROVY.find(o => o.id === def.ostrovId) || null;   // rucne navrhnuty ostrov
  const r = def.ostrov || {}, rozsah = Math.min(14, def.pasmo * 3 + 2);
  let naj = null, nd = Infinity;
  for (let bx = -rozsah; bx <= rozsah; bx++) for (let bz = -rozsah; bz <= rozsah; bz++) {
    const o = ostrovVBunke(bx, bz);
    if (!o || (bx === 0 && bz === 0) || o.pasmo !== def.pasmo) continue;
    if (o.R < (r.minR || 0) || o.H < (r.minH || 0) || (r.bez || []).includes(o.biom)) continue;
    const d = Math.hypot(o.x - START.x, o.z - START.z);
    if (d < nd) { nd = d; naj = o; }
  }
  return naj;
}
const vyskaOkolo = (x, z, r) => { let mx = -99, mn = 99; for (let k = 0; k < 8; k++) { const h = vyskaTerenu(x + Math.cos(k * 0.785) * r, z + Math.sin(k * 0.785) * r); mx = Math.max(mx, h); mn = Math.min(mn, h); } return [mn, mx]; };
function miestoMajaka(o) {                // od stredu ostrova smerom k startu, kym sa teren neznizi pod ~4,5 m a je dost rovny
  const dx = START.x - o.x, dz = START.z - o.z, l = Math.hypot(dx, dz) || 1;
  if (o.majak) return { x: o.x + o.majak[0], z: o.z + o.majak[1], smer: Math.atan2(dx, dz) };   // rucny ostrov urcil miesto
  for (let d = 0; d < o.R * 1.5; d += 1) {
    const x = o.x + dx / l * d, z = o.z + dz / l * d, h = vyskaTerenu(x, z);
    if (h < 4.5 && h > 1.8) { const [mn, mx] = vyskaOkolo(x, z, 5); if (mx - mn < 3.2) return { x, z, smer: Math.atan2(dx, dz) }; }
  }
  for (let d = 0; d < o.R * 1.5; d += 1) { const x = o.x + dx / l * d, z = o.z + dz / l * d; if (vyskaTerenu(x, z) < 4.5) return { x, z, smer: Math.atan2(dx, dz) }; }
  return { x: o.x, z: o.z, smer: 0 };
}
function suchyBod(x, z, smer, r, ...uhly) {    // sucho okolo (x,z) vo vzdialenosti r, preferuje smer
  for (const u of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4, 3.1]) {
    const px = x + Math.sin(smer + u) * r, pz = z + Math.cos(smer + u) * r;
    if (vyskaTerenu(px, pz) > 0.6) return [px, pz];
  }
  return [x, z];
}
function plazBod(o, uhol) {                // plaz ostrova v danom smere (vyska 0,45..1,1 m)
  for (let k = 0; k < 8; k++) {
    const a = uhol + k * 0.8;
    for (let d = o.R * 1.3; d > 0; d -= 0.5) {
      const x = o.x + Math.cos(a) * d, z = o.z + Math.sin(a) * d, h = vyskaTerenu(x, z);
      if (h > 0.45 && h < 1.1) return [x, z];
    }
  }
  return null;
}
// poradie flias na rucnych ostrovoch (index = index spravy v SPRAVY); kazdy ostrov ma v subore flase: [[x, z], ...]
const FLASE_OSTROVY = ['domov', 'domov', 'sumivy_haj', 'zahrada', 'hlinisko', 'perlovy_atol'];
function miestaFlias() {
  const pouzite = {};
  return FLASE_OSTROVY.map(id => {
    const o = MENOVANE_OSTROVY.find(o => o.id === id);
    if (!o) return null;
    const k = pouzite[id] = (pouzite[id] ?? -1) + 1, b = o.flase?.[k];
    return b ? [o.x + b[0], o.z + b[1]] : plazBod(o, 0.9 + k * 2.7);
  });
}
function miestaFliasNahodne() {             // povodne rozmiestnenie (nahodny svet)
  const out = [], o0 = ostrovVBunke(0, 0), cand = [];
  out.push(plazBod(o0, 0.9), plazBod(o0, 3.6));
  for (let bx = -5; bx <= 5; bx++) for (let bz = -5; bz <= 5; bz++) {
    const o = ostrovVBunke(bx, bz);
    if (o && !(bx === 0 && bz === 0) && o.pasmo <= 2 && o.R >= 22) cand.push({ o, h: ((bx * 73856093) ^ (bz * 19349663)) >>> 0 });
  }
  const p1 = cand.filter(c => c.o.pasmo === 1).sort((a, b) => a.h - b.h), p2 = cand.filter(c => c.o.pasmo === 2).sort((a, b) => a.h - b.h);
  for (const c of [p1[0], p1[1], p1[2], p2[0] || p1[3]]) out.push(c ? plazBod(c.o, (c.h % 628) / 100) : null);
  return out;
}

// ---------- modely ----------
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, ...o });
const KAMEN = mat(0x8d8a82), KAMEN2 = mat(0x6f6c66), MACH = mat(0x4f7040), DREVO = mat(0x7a5a38), BIELA = mat(0xe9e3d3, { roughness: 0.7 }), CERVENA = mat(0xb8402e, { roughness: 0.7 });
function bx(w, h, d, m, x, y, z, ry = 0, rz = 0) { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); k.position.set(x, y, z); k.rotation.set(0, ry, rz); k.castShadow = k.receiveShadow = true; return k; }
function cyl(rt, rb, h, m, y, seg = 20) { const k = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); k.position.y = y; k.castShadow = k.receiveShadow = true; return k; }
function zalozZiaru() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,240,180,1)'); gr.addColorStop(0.25, 'rgba(255,200,90,.55)'); gr.addColorStop(1, 'rgba(255,170,60,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const ZIARA = zalozZiaru();

function modelMajaka(rnd) {
  const g = new THREE.Group(), ruina = new THREE.Group(), oprava = new THREE.Group(), lesenie = new THREE.Group();
  g.add(cyl(4.0, 4.6, 6, KAMEN2, -2.5, 18));                                   // zaklad (zasahuje pod svah)
  g.add(cyl(2.6, 3.4, 9, KAMEN, 5, 20));                                       // telo veze
  for (let i = 0; i < 4; i++) g.add(bx(0.5, 0.9, 0.2, KAMEN2, Math.sin(i * 1.57 + 0.4) * 2.95, 3 + i * 1.8, Math.cos(i * 1.57 + 0.4) * 2.95, i * 1.57 + 0.4));   // okienka
  g.add(bx(1.2, 2.2, 0.4, mat(0x2a2218), 0, 1.6, 3.25));                         // dvere
  // zrutene ostatky vrchu veze: nerovny okraj
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * 6.283, h = 0.3 + rnd() * 2.0;
    ruina.add(bx(1.5, h, 0.9, i % 3 ? KAMEN : KAMEN2, Math.sin(a) * 2.3, 9.5 + h / 2, Math.cos(a) * 2.3, a));
  }
  for (let i = 0; i < 3; i++) ruina.add(bx(1.4, 0.4, 1.0, MACH, Math.sin(i * 2.4) * 2.3, 9.9 + i * 0.5, Math.cos(i * 2.4) * 2.3, i));
  for (let i = 0; i < 16; i++) {                                                // suti okolo paty
    const a = rnd() * 6.283, r = 4.8 + rnd() * 3.5, s = 0.4 + rnd() * 0.9;
    ruina.add(bx(s, s * 0.7, s * 1.2, rnd() < 0.3 ? MACH : KAMEN, Math.sin(a) * r, -0.1 + s * 0.2, Math.cos(a) * r, rnd() * 3, rnd() * 0.5));
  }
  ruina.add(bx(0.2, 3.2, 0.2, mat(0x3a3a3c), 5.6, 0.3, -2, 0.3, 1.3), bx(2.0, 1.6, 2.0, mat(0x6c7a74, { transparent: true, opacity: 0.55 }), -5.3, 0.6, 3.5, 0.5, 0.2));   // polamane ostatky lampy
  for (let i = 0; i < 4; i++) {                                                 // lesenie: kolmy + plosiny
    const a = i * 1.57 + 0.78, p = cyl(0.1, 0.1, 10.6, DREVO, 5.2, 6);
    p.position.x = Math.sin(a) * 4.0; p.position.z = Math.cos(a) * 4.0; p.rotation.z = Math.sin(a) * 0.05; lesenie.add(p);
  }
  for (const y of [2.6, 5.4, 8.2]) {
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + y; lesenie.add(bx(2.8, 0.12, 0.9, DREVO, Math.sin(a) * 3.55, y, Math.cos(a) * 3.55, a + 1.57)); }
    for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.78; lesenie.add(bx(0.07, 0.07, 3.8, DREVO, Math.sin(a) * 3.9, y + 0.5, Math.cos(a) * 3.9, a + 1.57, 0)); }
  }
  lesenie.add(bx(0.1, 6, 0.1, DREVO, 3.2, 5, 3.0, 0, 0.5), bx(0.1, 6, 0.1, DREVO, -3.2, 5, -3.0, 0, -0.5));
  // opraveny vrch: biela/cervena veza, galeria, lampa, strecha
  oprava.add(cyl(2.55, 2.6, 1.4, CERVENA, 10.2), cyl(2.3, 2.55, 1.6, BIELA, 11.7), cyl(2.05, 2.3, 1.4, CERVENA, 13.2));
  oprava.add(cyl(3.1, 2.9, 0.35, KAMEN2, 14.0, 24));
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; oprava.add(bx(0.08, 0.9, 0.08, KAMEN2, Math.sin(a) * 3.0, 14.6, Math.cos(a) * 3.0)); }
  const sklo = new THREE.MeshStandardMaterial({ color: 0xfff1c0, emissive: 0xffc860, emissiveIntensity: 2.2, transparent: true, opacity: 0.85, roughness: 0.2 });
  const lampa = cyl(1.2, 1.2, 1.9, sklo, 15.0, 12); lampa.castShadow = false; oprava.add(lampa);
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; oprava.add(bx(0.12, 1.9, 0.12, CERVENA, Math.sin(a) * 1.22, 15.0, Math.cos(a) * 1.22)); }
  const strecha = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.5, 12), CERVENA); strecha.position.y = 16.7; strecha.castShadow = true; oprava.add(strecha);
  oprava.add(cyl(0.08, 0.08, 0.8, KAMEN2, 17.6, 6));
  g.add(ruina, lesenie, oprava);
  oprava.visible = false;
  // svetlo + ziara + otacajuci sa kuzel
  const luc = new THREE.Group(); luc.position.y = 15.0;
  const kuzel = (r) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, 170, 20, 1, true).translate(0, -85, 0).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    // lúč ako svetlo v hmle: najjasnejší pri lampe a v strede, k okrajom a do diaľky mäkko mizne (nie plný kužeľ)
    m.material.onBeforeCompile = sh => {
      sh.vertexShader = 'varying float vLucV; varying vec3 vLucN; varying vec3 vLucD;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
        vLucV = uv.y; vec4 mvL = modelViewMatrix * vec4(position, 1.0);
        vLucN = normalize(normalMatrix * normal); vLucD = normalize(-mvL.xyz);`);
      sh.fragmentShader = 'varying float vLucV; varying vec3 vLucN; varying vec3 vLucD;\n' + sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );',
        `float stred = abs(dot(normalize(vLucN), normalize(vLucD)));
        vec4 diffuseColor = vec4( diffuse, opacity * 2.2 * pow(vLucV, 2.2) * stred * stred );`);
    };
    m.frustumCulled = false; return m;
  };
  const k1 = kuzel(20), k2 = kuzel(20); k2.rotation.y = Math.PI; luc.add(k1, k2);
  const svetlo = new THREE.PointLight(0xffd080, 0, 90, 1.6); svetlo.position.y = 15.0;
  const ziara = new THREE.Sprite(new THREE.SpriteMaterial({ map: ZIARA, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  ziara.scale.set(70, 70, 1); ziara.position.y = 15.0;
  luc.visible = svetlo.visible = ziara.visible = false;
  g.add(luc, svetlo, ziara);
  return { g, ruina, oprava, lesenie, luc, svetlo, ziara, sklo, kuzly: [k1, k2] };
}
function modelFlase() {
  const g = new THREE.Group();
  const sklo = new THREE.MeshStandardMaterial({ color: 0x6fb89a, transparent: true, opacity: 0.6, roughness: 0.1, emissive: 0x2a6a50, emissiveIntensity: 0.6 });
  const telo = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.28, 8).rotateZ(Math.PI / 2), sklo);
  const krk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.12, 8).rotateZ(Math.PI / 2).translate(0.2, 0, 0), sklo);
  const zatka = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.05, 6).rotateZ(Math.PI / 2).translate(0.28, 0, 0), mat(0x9a6a3a));
  const list = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 6).rotateZ(Math.PI / 2).translate(-0.02, 0, 0), new THREE.MeshStandardMaterial({ color: 0xf4e6bd, emissive: 0xffe9a0, emissiveIntensity: 0.9 }));
  g.add(telo, krk, zatka, list); g.position.y = 0.1; g.rotation.z = 0.15;
  const o = new THREE.Group(); o.add(g); return o;
}

// ---------- UI ----------
const CSS = `
#majak-panel{position:fixed;left:24px;top:34%;width:270px;padding:12px 14px;border-radius:12px;background:rgba(18,14,10,.78);color:#f3e7c8;font:600 14px system-ui,sans-serif;display:none;z-index:6;pointer-events:none;box-shadow:0 4px 16px #0008}
#majak-panel h4{margin:0 0 6px;font-size:16px;color:#ffd24a}#majak-panel div{display:flex;gap:6px;align-items:center;padding:2px 0}
#majak-panel .ok{color:#8fe08a}#majak-panel .nie{color:#f3a89b}#majak-panel svg,#majak-sprava svg{width:1.2em;height:1.2em}#majak-panel small{display:block;margin-top:6px;opacity:.75;font-weight:500}
#majak-boss{position:fixed;left:50%;bottom:44px;transform:translateX(-50%);width:min(520px,60vw);display:none;z-index:6;text-align:center;color:#f3e7c8;font:700 17px Georgia,serif;text-shadow:0 2px 4px #000}
#majak-boss .l{height:14px;margin-top:4px;border-radius:7px;background:rgba(20,10,8,.8);box-shadow:0 0 0 2px #000a;overflow:hidden}#majak-boss .l i{display:block;height:100%;background:linear-gradient(#e86a4a,#a8281c);transition:width .15s}
#majak-boss.f2 .l i{background:linear-gradient(#ff8a30,#d01808)}
#majak-sprava{position:fixed;left:50%;top:30%;transform:translateX(-50%);width:min(460px,86vw);padding:20px 24px;border-radius:6px;background:#e9d9ac;color:#3a2a14;font:italic 17px/1.45 Georgia,serif;display:none;z-index:7;pointer-events:none;box-shadow:0 8px 30px #000a}
#majak-sprava b{display:block;font-style:normal;margin-bottom:6px;color:#6a3a14}#majak-sprava small{display:block;margin-top:10px;font:600 12px system-ui;opacity:.6}`;
function vytvorUI() {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  for (const [id, cls] of [['majak-panel'], ['majak-boss'], ['majak-sprava']]) { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); }
  panel = document.getElementById('majak-panel'); bossHud = document.getElementById('majak-boss'); spravaOkno = document.getElementById('majak-sprava');
}
const smerText = dx => { const u = ((Math.atan2(dx[0], -dx[1]) * 180 / Math.PI) + 360) % 360; return ['sever', 'severovýchod', 'východ', 'juhovýchod', 'juh', 'juhozápad', 'západ', 'severozápad'][Math.round(u / 45) % 8]; };
export function textSpravy(i) {
  const m = majaky[0], s = SPRAVY[i];
  if (!s) return '';
  const dx = m ? [m.x - START.x, m.z - START.z] : [0, 0];
  return s.text.replace('{{smer1}}', 'na ' + smerText(dx)).replace('{{vzd1}}', String(Math.round(Math.hypot(dx[0], dx[1]) / 50) * 50));
}
function ukazSpravu(i) {
  const s = SPRAVY[i];
  spravaOkno.innerHTML = `<b>✉ ${s.nadpis} <span style="opacity:.5">(${precitane.size}/${SPRAVY.length})</span></b>${textSpravy(i)}<small>E zavrie · všetky správy nájdeš v Denníku (J)</small>`;
  spravaOkno.style.display = 'block'; spravaCas = 9 + textSpravy(i).length * 0.06;
}

// ---------- stav ----------
function zapal(m, ticho = false) {
  m.lit = true; m.oprava.visible = true; m.ruina.children.forEach(k => { if (k.position.y > 9) k.visible = false; }); m.lesenie.visible = false;
  m.luc.visible = m.svetlo.visible = m.ziara.visible = true;
  upokojenePasma.set(m.def.pasmo, m.def.tlmenie ?? 0.4);
  m.objaveny = true;
  if (!ticho) {
    zvuky.majak(); m.pocatok = cas;
    ctx.oznam(`🔥 ${m.def.meno} svieti! More v pásme sa upokojí.`);
    ctx.oznam('Pri majáku sa zobudíš, ak omdlieš (E pri päte veže)');
    ctx.nastavPostel(m.budenie);
  }
}
const chyba = m => m.def.potreby.filter(([id, n]) => (m.vlozene[id] || 0) < n);

function panelHtml(m) {
  const riadky = m.def.potreby.map(([id, n]) => {
    const v = m.vlozene[id] || 0, p = PREDMETY[id], mam = pocet(id), ok = v >= n;
    return `<div class="${ok ? 'ok' : 'nie'}">${ok ? '✔' : '✖'} ${p?.ikona || ''} ${p?.meno || id}: <b>${v}/${n}</b>${!ok ? ` <span style="opacity:.7">(máš ${mam})</span>` : ''}</div>`;
  }).join('');
  return `<h4>${m.def.meno}</h4><div style="opacity:.8">Rozpadnutý maják – treba opraviť:</div>${riadky}<small>E – vložiť materiály z batohu${m.boss && !m.boss.mrtvy ? '<br>Pozor na strážcu!' : ''}</small>`;
}

// ---------- init ----------
export function initMajaky(s, c) {
  scena = s; ctx = { ...ctx, ...c };
  vytvorUI();
  for (const def of MAJAKY) {
    const o = vyberOstrov(def); if (!o) continue;
    const p = miestoMajaka(o);
    let rs = 7 + def.pasmo; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
    const m = { def, ostrov: o, x: p.x, z: p.z, smer: p.smer, lit: false, vlozene: {}, porazeny: false, objaveny: false, boss: null, pocatok: -99, ...modelMajaka(rnd) };
    let y = -9; for (const [dx, dz] of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]]) y = Math.max(y, vyskaTerenu(p.x + dx, p.z + dz));
    m.y = y; m.g.position.set(p.x, y, p.z); scena.add(m.g);
    m.budenie = suchyBod(p.x, p.z, p.smer, 6.8);
    majaky.push(m);
  }
  const mp = miestaFlias();
  mp.forEach((b, i) => {
    if (!b || precitane.has(i)) return;
    const g = modelFlase(); g.position.set(b[0], Math.max(vyskaTerenu(b[0], b[1]), 0.05), b[1]); g.rotation.y = i * 1.9; scena.add(g);
    flase.push({ i, x: b[0], z: b[1], g });
  });
  nepUdalosti.priFaze = (e, def) => ctx.oznam(`⚠ ${def.meno} zbesnel!`);
}

// ---------- kolizia: vez je pevna ----------
export function odtlacOdMajaka(poz) {
  for (const m of majaky) {
    const dx = poz.x - m.x, dz = poz.z - m.z, d = Math.hypot(dx, dz);
    if (d < R_KOLIZIA && d > 1e-4 && poz.y < m.y + 12) { poz.x = m.x + dx / d * R_KOLIZIA; poz.z = m.z + dz / d * R_KOLIZIA; }
  }
}
export const polohaMajaka = pasmo => majaky.find(m => m.def.pasmo === pasmo) || null;
export const jeZapaleny = pasmo => !!polohaMajaka(pasmo)?.lit;

// ---------- aktualizacia (volat kazdy snimok); vrati text napovedy alebo null ----------
export function aktualizujMajak(dt, t, { hrac, tma = 0, pesi = true }) {
  cas = t; let napoveda = null;
  const hx = hrac.poz.x, hz = hrac.poz.z, zivy = !stavPreziti.mrtvy;
  if (spravaCas > 0) { spravaCas -= dt; if (spravaCas <= 0 || stlacene('Escape')) spravaOkno.style.display = 'none'; }
  let bossNaOko = null, panelM = null;
  for (const m of majaky) {
    const d = Math.hypot(hx - m.x, hz - m.z);
    if (d < 130) m.objaveny = true;
    // strazca
    if (!m.lit) {
      let b = m.boss;
      if (b && b.mrtvy) { m.porazeny = true; }
      else if (b && (d > 140 || !zivy)) { odstranNepriatela(b); m.boss = b = null; }     // hrac zomrel / odisiel -> strazca sa vylieci (spawne sa znova)
      if (!b && !m.porazeny && zivy && pesi && d < 55 && NEPRIATELIA[m.def.strazca]) {
        const [sx, sz] = suchyBod(m.x, m.z, m.smer, 11);
        m.boss = spawnNepriatela(m.def.strazca, sx, sz);
      }
      if (m.boss && !m.boss.mrtvy && d < 60) bossNaOko = m.boss;
    }
    // svetlo, otacanie
    if (m.lit) {
      m.luc.rotation.y = t * 0.55;
      const noc = Math.min(1, tma * 1.3), rozbeh = Math.min(1, (t - m.pocatok) / 3 + 0.001);
      m.kuzly.forEach(k => { k.material.opacity = (0.035 + 0.16 * noc) * rozbeh; });
      m.svetlo.intensity = (3 + 9 * noc) * (0.95 + Math.sin(t * 7) * 0.03) * rozbeh;
      m.ziara.material.opacity = (0.45 + 0.55 * noc) * rozbeh;
    }
    if (d < DOSAH && pesi && zivy) panelM = m;
  }
  // flase
  let fl = null, fd = 2.4;
  for (const f of flase) {
    f.g.position.y = Math.max(vyskaTerenu(f.x, f.z), 0.05) + Math.sin(t * 1.6 + f.i) * 0.015;
    const d = Math.hypot(f.x - hx, f.z - hz);
    if (d < fd && pesi && zivy) { fd = d; fl = f; }
  }
  if (fl) {
    napoveda = '<kbd>E</kbd> zdvihnúť fľašu so správou';
    if (stlacene('KeyE')) {
      scena.remove(fl.g); flase.splice(flase.indexOf(fl), 1); precitane.add(fl.i); zvuky.zober();
      const s = SPRAVY[fl.i]; if (s?.odhal) { const mm = polohaMajaka(s.odhal); if (mm) mm.objaveny = true; }
      ukazSpravu(fl.i);
    }
  } else if (panelM) {
    const m = panelM;
    if (!m.lit) {
      panel.style.display = 'block'; panel.innerHTML = panelHtml(m);
      if (stlacene('KeyE')) {
        const vlozil = [];
        for (const [id, n] of chyba(m)) {
          const k = Math.min(pocet(id), n - (m.vlozene[id] || 0));
          if (k > 0) { odober(id, k); m.vlozene[id] = (m.vlozene[id] || 0) + k; vlozil.push(`${k}× ${PREDMETY[id]?.ikona || id}`); }
        }
        if (vlozil.length) { vykresliInventar(); zvuky.uder?.('kamen'); ctx.oznam(`Vložené: ${vlozil.join(' ')}`); }
        else ctx.oznam('Nemáš nič z potrebných vecí');
        if (!chyba(m).length) zapal(m);
      }
    } else {
      panel.style.display = 'none';
      napoveda = `<kbd>E</kbd> ${m.def.meno}: zapamätať miesto prebudenia`;
      if (stlacene('KeyE')) { ctx.nastavPostel(m.budenie); ctx.oznam('Pri majáku sa zobudíš, ak omdlieš'); zvuky.zober(); }
    }
  } else panel.style.display = 'none';
  // HP pruh bossa
  if (bossNaOko) {
    const f = Math.max(0, bossNaOko.hp / bossNaOko.def.zdravie);
    bossHud.style.display = 'block'; bossHud.className = bossNaOko.faza2 ? 'f2' : '';
    bossHud.innerHTML = `${bossNaOko.def.meno}<div class="l"><i style="width:${(f * 100).toFixed(1)}%"></i></div>`;
  } else bossHud.style.display = 'none';
  return napoveda;
}

// ---------- ukladanie ----------
export const ulozMajaky = () => ({ m: majaky.map(m => ({ p: m.def.pasmo, l: m.lit ? 1 : 0, d: m.vlozene, b: m.porazeny ? 1 : 0, o: m.objaveny ? 1 : 0 })), s: [...precitane] });
export function nacitajMajaky(d) {
  if (!d) return;
  for (const i of d.s || []) { precitane.add(i); const f = flase.find(x => x.i === i); if (f) { scena.remove(f.g); flase.splice(flase.indexOf(f), 1); } }
  for (const z of d.m || []) {
    const m = polohaMajaka(z.p); if (!m) continue;
    m.vlozene = z.d || {}; m.objaveny = !!z.o; m.porazeny = !!z.b;
    const srdce = m.def.potreby.at(-1)[0];
    if (z.l) zapal(m, true);
    else if (m.porazeny && !(m.vlozene[srdce]) && !pocet(srdce)) m.porazeny = false;   // srdce sa stratilo -> strazca sa vrati
  }
}
