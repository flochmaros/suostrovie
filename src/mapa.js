// Mapa: minimapa (kruh vlavo dole) + velka mapa cez celu obrazovku (klavesa N).
// Teren sa kresli do malych platien po dlazdiciach (1 dlazdica = 1 bunka sveta 520 m) a uklada sa do cache.
// Dlazdice sa generuju postupne (casovy limit na snimok), aby hra nezasekavala.
// Suradnice: sever = -z (hore), vychod = +x (vpravo) -> na mape px = x, py = z.
import { majaky } from './majak.js';
import { vyskaTerenu, ostrovVBunke, ostrovPri, BUNKA, PASMA, polomerPasma, MENOVANE_OSTROVY } from './svet.js';
import * as THREE from 'three';
import { znacky, TYPY, navi, ciel, kresliZnacku, menoOstrova, jePomenovany, pomenujOstrov, upravZnacku, dialogOtvoreny } from './znacky.js';
import { ik } from './ikony.js';

const RES = 96;                 // pixelov na dlazdicu (5.4 m na pixel)
const MAX_DLAZDIC = 700;        // limit cache (cca 37 kB na dlazdicu)
const LIMIT_MS = 3;             // kolko ms za snimok mozeme minut na generovanie
const MINI_PX = 180, MINI_R = 350;   // velkost minimapy a polomer zobrazeneho okolia v metroch
const KLAVESA = 'KeyN';

// ---------- CSS + DOM ----------
const styl = document.createElement('style');
styl.textContent = `
#minimapa { position: absolute; left: 18px; bottom: 34px; width: ${MINI_PX}px; height: ${MINI_PX}px; }
#minimapa canvas { width: 100%; height: 100%; border-radius: 50%; box-shadow: 0 3px 14px #0008, 0 0 0 3px rgba(240,226,190,.85), 0 0 0 5px rgba(60,40,20,.55); }
#minimapa .sever { position: absolute; top: -9px; left: 50%; transform: translateX(-50%); width: 20px; height: 20px; border-radius: 50%;
  background: #f1e3bd; color: #7a2b1a; font: 800 12px/20px Nunito, system-ui, sans-serif; text-align: center; text-shadow: none; box-shadow: 0 1px 4px #0006; }
#minimapa .sipka { position: absolute; left: 50%; top: 50%; width: 0; height: 0; margin: -9px 0 0 -6px; border-left: 6px solid transparent; border-right: 6px solid transparent;
  border-bottom: 16px solid #fff; filter: drop-shadow(0 0 2px #000a); transform-origin: 6px 10px; }
#minimapa .popis { position: absolute; top: 100%; left: 0; width: 100%; margin-top: 7px; text-align: center; font-size: 12px; line-height: 1.3; white-space: nowrap; }
#minimapa .popis b { font-size: 13px; }
#minimapa .klaves { position: absolute; right: -4px; bottom: 2px; font-size: 11px; opacity: .8; }
#mapa-okno { display: none; position: fixed; inset: 0; z-index: 60; background: rgba(12,22,30,.55); pointer-events: auto; user-select: none; }
#mapa-ram { position: absolute; inset: 3.5vh 3.5vw; border-radius: 6px; overflow: hidden; background: #d9c79c;
  box-shadow: 0 10px 50px #000a, inset 0 0 0 4px #6b4a26, inset 0 0 0 7px #e8d6a8, inset 0 0 0 9px #6b4a26; padding: 9px; box-sizing: border-box; }
#mapa-ram canvas { width: 100%; height: 100%; display: block; cursor: grab; border-radius: 2px; }
#mapa-ram canvas.tahanie { cursor: grabbing; }
#mapa-ram .vineta { position: absolute; inset: 9px; pointer-events: none; box-shadow: inset 0 0 90px rgba(90,60,20,.55); }
#mapa-titul { position: absolute; top: 18px; left: 50%; transform: translateX(-50%); padding: 4px 26px; border-radius: 4px; background: #efe0b8;
  color: #4a3218; font: italic 700 22px Georgia, serif; letter-spacing: 2px; box-shadow: 0 2px 8px #0005; }
#mapa-legenda { position: absolute; left: 22px; bottom: 22px; padding: 10px 14px; border-radius: 6px; background: rgba(239,224,184,.92); color: #3f2b14;
  font: 13px/1.6 Georgia, serif; box-shadow: 0 2px 8px #0005; }
#mapa-legenda i { display: inline-block; width: 11px; height: 11px; border-radius: 50%; margin-right: 7px; vertical-align: -1px; border: 1.5px solid #3f2b14; }
#mapa-menu { display: none; position: absolute; z-index: 5; min-width: 190px; padding: 5px; border-radius: 6px; background: #efe0b8; color: #3f2b14;
  font: 14px Georgia, serif; box-shadow: 0 4px 18px #000a, 0 0 0 2px #6b4a26; }
#mapa-menu div { padding: 7px 12px; border-radius: 4px; cursor: pointer; white-space: nowrap; }
#mapa-menu div:hover { background: rgba(181,100,31,.28); }
#mapa-menu .hlava { cursor: default; font-weight: 700; font-style: italic; opacity: .8; padding: 4px 12px 6px; border-bottom: 1px solid rgba(63,43,20,.3); margin-bottom: 3px; }
#mapa-menu .hlava:hover { background: none; }
#navi-svet { display: none; position: fixed; z-index: 20; pointer-events: none; transform: translate(-50%, -50%); text-align: center; color: #fff; text-shadow: 0 1px 4px #000, 0 0 8px #000a;
  font: 700 13px/1.25 Nunito, system-ui, sans-serif; }
#navi-svet svg { width: 34px; height: 34px; display: block; margin: 0 auto 1px; filter: drop-shadow(0 2px 4px #000a); }
#navi-svet small { display: block; font-size: 12px; opacity: .9; font-weight: 600; }
#minimapa .navi { position: absolute; top: 100%; left: 0; width: 100%; margin-top: 44px; text-align: center; font-size: 12px; white-space: nowrap; color: #ffe9a8; text-shadow: 0 1px 3px #000; }
#mapa-info { position: absolute; right: 22px; bottom: 22px; padding: 8px 14px; border-radius: 6px; background: rgba(239,224,184,.92); color: #3f2b14;
  font: 13px/1.5 Georgia, serif; text-align: right; box-shadow: 0 2px 8px #0005; }
`;
document.head.appendChild(styl);

const mini = document.createElement('div');
mini.id = 'minimapa';
mini.innerHTML = `<canvas width="${MINI_PX * 2}" height="${MINI_PX * 2}"></canvas><div class="sipka"></div><div class="sever">S</div>`
  + `<div class="klaves"><kbd>N</kbd></div><div class="popis"></div><div class="navi"></div>`;
(document.getElementById('hud') || document.body).appendChild(mini);
const miniPlatno = mini.querySelector('canvas'), miniCtx = miniPlatno.getContext('2d');
const miniSipka = mini.querySelector('.sipka'), miniPopis = mini.querySelector('.popis'), miniNavi = mini.querySelector('.navi');
const naviSvet = document.createElement('div');           // znacka cielu priamo vo svete (premietnuta na obrazovku)
naviSvet.id = 'navi-svet';
document.body.appendChild(naviSvet);
const mapaMenu = document.createElement('div');
mapaMenu.id = 'mapa-menu';

// farby pasiem: [podfarbenie (priehladne), ciara]
const PAS_FARBY = [['rgba(40,220,210,.10)', '#30d5c8'], ['rgba(255,110,40,.16)', '#ff7a3c'], ['rgba(90,140,50,.20)', '#8fbf4a'],
  ['rgba(90,110,135,.22)', '#8fa6c0'], ['rgba(150,120,190,.22)', '#c2a8e8']];
const N_UHLOV = 120;
// obrys hranice pasma i (polygon v suradniciach platna); X, Z prevadzaju metre na pixely
function obrysPasma(c, i, X, Z, spat) {
  for (let k = 0; k < N_UHLOV; k++) {
    const a = (spat ? N_UHLOV - k : k) / N_UHLOV * Math.PI * 2, r = polomerPasma(i, a);
    const x = X(BUNKA / 2 + Math.cos(a) * r), y = Z(BUNKA / 2 + Math.sin(a) * r);
    k ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.closePath();
}
// podfarbenie pasiem + prerusovane hranice (popisy len na velkej mape); je to len 4 polygony po 120 bodoch
function kresliPasma(c, w, h, X, Z, popisy, m) {
  for (let i = 5; i >= 1; i--) {
    c.beginPath();
    if (i === 5) c.rect(0, 0, w, h); else obrysPasma(c, i, X, Z, false);
    if (i > 1) obrysPasma(c, i - 1, X, Z, true);
    c.fillStyle = PAS_FARBY[i - 1][0]; c.fill('evenodd');
  }
  c.save();
  c.setLineDash(popisy ? [14, 9] : [7, 5]); c.lineWidth = popisy ? 2.5 : 1.8;
  for (let i = 1; i <= 4; i++) {
    c.beginPath(); obrysPasma(c, i, X, Z, false);
    c.strokeStyle = PAS_FARBY[i][1]; c.stroke();
  }
  c.restore();
  if (!popisy) return;
  c.font = 'italic 700 14px Georgia, serif'; c.textAlign = 'center';
  for (let i = 1; i <= 4; i++) {
    for (const a of [-2.35, -0.8, 0.8, 2.35]) {            // 4 uhly: popis sa ukaze tam, kde je hranica v pohlade
      const r = polomerPasma(i, a), sx = X(BUNKA / 2 + Math.cos(a) * r), sy = Z(BUNKA / 2 + Math.sin(a) * r);
      if (sx < 80 || sx > w - 80 || sy < 20 || sy > h - 20) continue;
      const t = `${i}→${i + 1} · ${PASMA[i + 1].meno}`;
      c.lineWidth = 4; c.strokeStyle = 'rgba(20,14,6,.8)'; c.strokeText(t, sx, sy - 6);
      c.fillStyle = PAS_FARBY[i][1]; c.fillText(t, sx, sy - 6);
    }
  }
}

const okno = document.createElement('div');
okno.id = 'mapa-okno';
okno.innerHTML = `<div id="mapa-ram"><canvas></canvas><div class="vineta"></div></div>
  <div id="mapa-titul">Mapa súostrovia</div>
  <div id="mapa-legenda"><div><i style="background:#fff"></i>Ty (šípka = smer)</div><div><i style="background:#ffb020"></i>Aktívna loď</div>
    <div><i style="background:#c0392b"></i>Ostatné lode</div>
    <hr style="border:0;border-top:1px solid rgba(255,255,255,.25);margin:6px 0">${PASMA.slice(1).map((p, i) => `<div><i style="background:${PAS_FARBY[i][1]}"></i>${i + 1} · ${p.meno}<br><small style="opacity:.7">loď: ${p.lod}</small></div>`).join('')}</div>
  <div id="mapa-info"></div>`;
okno.appendChild(mapaMenu);
document.body.appendChild(okno);
const mapaPlatno = okno.querySelector('canvas'), mapaCtx = mapaPlatno.getContext('2d');
const mapaInfo = okno.querySelector('#mapa-info');

// ---------- farby terenu ----------
const hex = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sstep = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
// biomy: [trava nizko, trava vysoko, piesok, vyska kde konci plaz]
const BIOM_FARBY = {
  palmovy: [0x6aa83a, 0x4f8f2e, 0xead7a2, 1.4], dzungla: [0x3f8a28, 0x2a6320, 0xe2cf98, 1.4], skalnaty: [0x7f9a48, 0x7a7466, 0xd8c79a, 1.4],
  atol: [0x86bf4e, 0x6aa83a, 0xf2e2b4, 0.9], sopecny: [0x4a5a38, 0x3a3230, 0x4a4542, 0.7], mangrovy: [0x4d6b34, 0x3b5a2c, 0x8a7a58, 0.3],
  bambusovy: [0x79a83a, 0x5c8c2e, 0xe6d4a0, 1.4], savana: [0xb2ad5c, 0x8fa23f, 0xe6cf98, 1.0], plytcina: [0x7ab548, 0x5f9a37, 0xf0dcaa, 1.5],
  ovocny: [0x7cb842, 0x5ea330, 0xead7a2, 1.4], ostrovcek: [0x7ab548, 0x5f9a37, 0xf0dcaa, 1.3],
};
const PLYTKA = hex(0x6fe0d2), STREDNA = hex(0x2296b8), HLBOKA = hex(0x0c3a63), PENA = hex(0xe8fbf6), SKALA = hex(0x8d877c);
const OCEAN_CSS = '#1b5f87';

function farba(h, b) {
  if (h < 0) {                                         // more: cim hlbsie, tym tmavsie
    const d = -h;
    let c = d < 9 ? mix(PLYTKA, STREDNA, sstep(0, 9, d)) : mix(STREDNA, HLBOKA, sstep(9, 34, d));
    if (d < 0.5) c = mix(PENA, c, d / 0.5);          // pena pri brehu
    return c;
  }
  if (h < b.plaz) return b.piesok;
  const c = mix(b.tr1, b.tr2, sstep(b.plaz, 16, h));
  return h > 22 ? mix(c, SKALA, sstep(22, 40, h)) : c;
}

// ---------- dlazdice (cache) ----------
const dlazdice = new Map();     // "bx,bz" -> { platno, vysky, riadok, hotova, o }

function novaDlazdica(bx, bz) {
  const o = ostrovVBunke(bx, bz);
  // velky rucny ostrov moze zasahovat aj do susednej bunky -> farby a jemne vzorkovanie aj tam
  const x0 = bx * BUNKA, z0 = bz * BUNKA;
  const p = o || MENOVANE_OSTROVY.find(m => m.x + m.ext > x0 && m.x - m.ext < x0 + BUNKA && m.z + m.ext > z0 && m.z - m.ext < z0 + BUNKA);
  const f = BIOM_FARBY[p?.biom] || BIOM_FARBY.palmovy;
  const d = { bx, bz, o, riadok: 0, hotova: false, vysky: new Float32Array((RES + 1) * (RES + 1)), platno: null,
    b: { tr1: hex(f[0]), tr2: hex(f[1]), piesok: hex(f[2]), plaz: f[3] } };
  // bunka bez ostrova = len dno -> staci hrubsia vzorka (kazdy 3. bod), zvysok sa dopocita
  d.krok = p ? 1 : 3;
  return d;
}

function dokonciDlazdicu(d) {
  const p = document.createElement('canvas');
  p.width = p.height = RES;
  const c = p.getContext('2d'), img = c.createImageData(RES, RES), v = d.vysky, W = RES + 1, mpp = BUNKA / RES;
  for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) {
    const h = v[j * W + i];
    let [r, g, b] = farba(h, d.b);
    if (h > 0) {                                       // tienovanie svahov (svetlo zo severozapadu)
      const dx = v[j * W + i + 1] - h, dz = v[(j + 1) * W + i] - h;
      const s = Math.max(0.55, Math.min(1.35, 1 - (dx + dz) / mpp * 0.55));
      r *= s; g *= s; b *= s;
    }
    const k = (j * RES + i) * 4;
    img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  d.platno = p; d.vysky = null; d.hotova = true;
}

// vypocita dalsie riadky vysok dlazdice; vrati true, ak je hotova
function pracujNaDlazdici(d, koniec) {
  const W = RES + 1, mpp = BUNKA / RES, x0 = d.bx * BUNKA, z0 = d.bz * BUNKA, k = d.krok;
  while (d.riadok <= RES) {
    const j = d.riadok;
    if (j % k === 0 || j === RES) {
      for (let i = 0; i <= RES; i += k) d.vysky[j * W + i] = vyskaTerenu(x0 + i * mpp, z0 + j * mpp);
      if (k > 1) for (let i = 0; i <= RES; i++) if (i % k) {     // doplnenie medzi vzorkami
        const a = i - (i % k), b = Math.min(a + k, RES);
        d.vysky[j * W + i] = d.vysky[j * W + a] + (d.vysky[j * W + b] - d.vysky[j * W + a]) * ((i - a) / (b - a || 1));
      }
    }
    d.riadok++;
    if (performance.now() > koniec) break;
  }
  if (d.riadok > RES) {
    if (k > 1) for (let j = 0; j <= RES; j++) if (j % k && j !== RES) {   // doplnenie chybajucich riadkov
      const a = j - (j % k), b = Math.min(a + k, RES), t = (j - a) / (b - a);
      for (let i = 0; i <= RES; i++) d.vysky[j * W + i] = d.vysky[a * W + i] + (d.vysky[b * W + i] - d.vysky[a * W + i]) * t;
    }
    dokonciDlazdicu(d);
    return true;
  }
  return false;
}

// vrati dlazdicu (aj nehotovu); prida ju do fronty
function dlazdica(bx, bz) {
  const kluc = bx + ',' + bz;
  let d = dlazdice.get(kluc);
  if (d) { dlazdice.delete(kluc); dlazdice.set(kluc, d); return d; }   // LRU: posledne pouzita ide na koniec
  d = novaDlazdica(bx, bz);
  dlazdice.set(kluc, d);
  if (dlazdice.size > MAX_DLAZDIC) dlazdice.delete(dlazdice.keys().next().value);
  return d;
}

// fronta: zoznam potrebnych dlazdic zoradeny podla vzdialenosti od stredu pohladu
let fronta = [];
function generuj() {
  const koniec = performance.now() + LIMIT_MS;
  while (fronta.length && performance.now() < koniec) {
    const d = fronta[0];
    if (d.hotova || pracujNaDlazdici(d, koniec)) fronta.shift();
  }
}
function vyziadaj(x0, z0, x1, z1, cx, cz) {
  const zoz = [];
  for (let bz = Math.floor(z0 / BUNKA); bz <= Math.floor(z1 / BUNKA); bz++)
    for (let bx = Math.floor(x0 / BUNKA); bx <= Math.floor(x1 / BUNKA); bx++) {
      const d = dlazdica(bx, bz);
      if (!d.hotova) zoz.push([d, Math.hypot((bx + 0.5) * BUNKA - cx, (bz + 0.5) * BUNKA - cz)]);
    }
  return zoz;
}

// nakresli dlazdice do obdlznika pohladu (stred cx,cz; mierka m = px na meter)
function kresliTeren(ctx, w, h, cx, cz, m) {
  ctx.fillStyle = OCEAN_CSS;
  ctx.fillRect(0, 0, w, h);
  const x0 = cx - w / 2 / m, z0 = cz - h / 2 / m, x1 = cx + w / 2 / m, z1 = cz + h / 2 / m;
  const chyba = vyziadaj(x0, z0, x1, z1, cx, cz);
  ctx.imageSmoothingEnabled = true;
  const s = BUNKA * m;
  for (let bz = Math.floor(z0 / BUNKA); bz <= Math.floor(z1 / BUNKA); bz++)
    for (let bx = Math.floor(x0 / BUNKA); bx <= Math.floor(x1 / BUNKA); bx++) {
      const d = dlazdice.get(bx + ',' + bz);
      if (!d?.hotova) continue;
      // +0.5 px prekrytie, aby medzi dlazdicami neboli svetle spary
      ctx.drawImage(d.platno, Math.floor((bx * BUNKA - x0) * m), Math.floor((bz * BUNKA - z0) * m), Math.ceil(s) + 1, Math.ceil(s) + 1);
    }
  return chyba;
}

// ---------- pomocne ----------
const STRANY = ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ'];
const strana = (dx, dz) => STRANY[Math.round(((Math.atan2(dx, -dz) * 180 / Math.PI) + 360) % 360 / 45) % 8];
// uhol na obrazovke (0 = hore) pre smer hry (yaw / smer lode): dopredu = (-sin s, -cos s)
const uholObr = s => -s;

function najblizsiOstrov(x, z) {
  const bx = Math.floor(x / BUNKA), bz = Math.floor(z / BUNKA);
  let naj = null, nd = Infinity;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const o = ostrovVBunke(bx + i, bz + j);
    if (!o) continue;
    const d = Math.hypot(o.x - x, o.z - z) - o.R;
    if (d < nd) { nd = d; naj = o; }
  }
  return naj && { o: naj, d: Math.max(0, nd) };
}

function sipka(ctx, x, y, uhol, vel, vypln, obrys = '#0009') {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(uhol);
  ctx.beginPath();
  ctx.moveTo(0, -vel); ctx.lineTo(vel * 0.62, vel * 0.7); ctx.lineTo(0, vel * 0.35); ctx.lineTo(-vel * 0.62, vel * 0.7); ctx.closePath();
  ctx.fillStyle = vypln; ctx.fill();
  ctx.lineWidth = Math.max(1.5, vel * 0.14); ctx.strokeStyle = obrys; ctx.stroke();
  ctx.restore();
}
function bodka(ctx, x, y, r, vypln) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = vypln; ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.35); ctx.strokeStyle = '#000a'; ctx.stroke();
}
// ikona majaka: zhasnuty = siva veza, zapaleny = zlta so ziarou
function kresliMajak(c, x, y, lit, v) {
  c.save(); c.translate(x, y);
  if (lit) { const g = c.createRadialGradient(0, -v, 1, 0, -v, v * 2.6); g.addColorStop(0, 'rgba(255,220,100,.8)'); g.addColorStop(1, 'rgba(255,220,100,0)'); c.fillStyle = g; c.fillRect(-v * 3, -v * 3.6, v * 6, v * 5); }
  c.beginPath(); c.moveTo(-v * 0.5, v * 0.7); c.lineTo(-v * 0.3, -v * 0.8); c.lineTo(v * 0.3, -v * 0.8); c.lineTo(v * 0.5, v * 0.7); c.closePath();
  c.fillStyle = lit ? '#f4e6c0' : '#9a9a9a'; c.fill(); c.lineWidth = Math.max(1.5, v * 0.16); c.strokeStyle = '#000b'; c.stroke();
  c.fillStyle = lit ? '#ffd24a' : '#666'; c.fillRect(-v * 0.32, -v * 1.25, v * 0.64, v * 0.45); c.strokeRect(-v * 0.32, -v * 1.25, v * 0.64, v * 0.45);
  c.beginPath(); c.moveTo(-v * 0.42, -v * 1.25); c.lineTo(0, -v * 1.7); c.lineTo(v * 0.42, -v * 1.25); c.closePath(); c.fillStyle = lit ? '#c0392b' : '#555'; c.fill(); c.stroke();
  c.restore();
}
const smerHraca = hra => hra.vKanoe && hra.kanoe ? hra.kanoe.smer : hra.kam.yaw;

// ---------- minimapa ----------
function kresliMinimapu(hra) {
  const c = miniCtx, W = miniPlatno.width, m = W / (2 * MINI_R), p = hra.hrac.poz;
  const chyba = kresliTeren(c, W, W, p.x, p.z, m);
  fronta = chyba.sort((a, b) => a[1] - b[1]).map(a => a[0]);
  const r = W / 2;
  kresliPasma(c, W, W, x => (x - p.x) * m + r, z => (z - p.z) * m + r, false, m);
  for (const mj of majaky) if (mj.objaveny) { const dx = (mj.x - p.x) * m, dy = (mj.z - p.z) * m; if (Math.hypot(dx, dy) < r - 12) kresliMajak(c, r + dx, r + dy, mj.lit, 8); }
  // znacky hraca; cielova navigacia sa ukaze aj mimo dosahu (na okraji kruhu)
  const cl = ciel();
  for (const z of znacky) {
    let dx = (z.x - p.x) * m, dy = (z.z - p.z) * m;
    const dl = Math.hypot(dx, dy), jeCiel = z === cl;
    if (dl > r - 14) { if (!jeCiel) continue; dx *= (r - 14) / dl; dy *= (r - 14) / dl; }
    kresliZnacku(c, r + dx, r + dy, z.t, jeCiel ? 12 : 9, jeCiel);
  }
  // lode
  for (const l of hra.lode) {
    const aktivna = l === hra.kanoe;
    let dx = (l.poz.x - p.x) * m, dy = (l.poz.y - p.z) * m;
    const dl = Math.hypot(dx, dy);
    if (aktivna && hra.vKanoe) continue;              // sedis v nej -> ukazuje ju sipka hraca
    const farbaL = aktivna ? '#ffb020' : '#e0503a';
    if (dl > r - 14) {                                 // mimo dosahu: sipka na okraji kruhu
      dx *= (r - 14) / dl; dy *= (r - 14) / dl;
      sipka(c, r + dx, r + dy, Math.atan2(dx, -dy), aktivna ? 14 : 11, farbaL);
    } else {
      sipka(c, r + dx, r + dy, uholObr(l.smer), aktivna ? 13 : 10, farbaL);
    }
  }
  // svetly okraj kruhu (vineta)
  const g = c.createRadialGradient(r, r, r * 0.72, r, r, r);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,20,30,.45)');
  c.fillStyle = g; c.fillRect(0, 0, W, W);

  // popis: najblizsi ostrov + suradnice
  const n = najblizsiOstrov(p.x, p.z);
  let t = '';
  if (n) { const mn = menoOstrova(n.o); t = ostrovPri(p.x, p.z, 1.15) === n.o ? `<b>${mn}</b>` : `<b>${mn}</b> · ${Math.round(n.d)} m ${strana(n.o.x - p.x, n.o.z - p.z)}`; }
  else t = 'Otvorené more';
  miniPopis.innerHTML = `${t}<br><span style="opacity:.75">${Math.round(p.x)}, ${Math.round(p.z)}</span>`;
  miniNavi.textContent = cl ? `▶ ${cl.n} · ${vzdialenost(Math.hypot(cl.x - p.x, cl.z - p.z))} ${strana(cl.x - p.x, cl.z - p.z)}` : '';
}
const vzdialenost = d => d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m';

// znacka cielu vo svete: ikona + meno + vzdialenost, pri pohlade inam sa prilepi na okraj obrazovky
const _v = new THREE.Vector3();
function kresliNaviSvet(hra) {
  const cl = ciel(), kam = hra.kamera;
  if (!cl || !kam) { naviSvet.style.display = 'none'; return; }
  const p = hra.hrac.poz, d = Math.hypot(cl.x - p.x, cl.z - p.z);
  if (d < 25) {                                          // dorazil si
    hra.oznam?.(`🏁 Cieľ dosiahnutý: ${cl.n}`);
    navi.id = null; naviSvet.style.display = 'none'; return;
  }
  _v.set(cl.x, Math.max(0, vyskaTerenu(cl.x, cl.z)) + 7, cl.z).project(kam);
  let sx = _v.x, sy = _v.y;
  const za = _v.z > 1;
  if (za) { sx = -sx; sy = -sy; }
  if (za || Math.abs(sx) > 0.9 || Math.abs(sy) > 0.84) { const k = Math.max(Math.abs(sx) / 0.9, Math.abs(sy) / 0.84, 1e-3); sx /= k; sy /= k; }
  if (naviSvet.dataset.id !== String(cl.id) + cl.t) { naviSvet.dataset.id = String(cl.id) + cl.t; naviSvet.innerHTML = ik(TYPY[cl.t].tvar, TYPY[cl.t].farba) + '<span></span><small></small>'; }
  naviSvet.children[1].textContent = cl.n;
  naviSvet.children[2].textContent = vzdialenost(d);
  naviSvet.style.left = ((sx * 0.5 + 0.5) * innerWidth) + 'px';
  naviSvet.style.top = ((-sy * 0.5 + 0.5) * innerHeight) + 'px';
  naviSvet.style.display = 'block';
}

// ---------- velka mapa ----------
const pohlad = { x: 0, z: 0, m: 0.35 };   // stred a mierka (px na meter, v CSS pixeloch)
let otvorena = false, tahanie = null;
const POMOC = '<span style="opacity:.75">N / Esc zavrieť · koliesko zoom · ťahaj posun · medzerník = na teba<br>pravý klik / dvojklik = značka, navigácia, pomenovanie ostrova</span>';
const MIN_M = 0.12, MAX_M = 1.2;

function otvor(hra) {
  otvorena = true;
  okno.style.display = 'block';
  pohlad.x = hra.hrac.poz.x; pohlad.z = hra.hrac.poz.z;
  document.exitPointerLock?.();
  mapaInfo.innerHTML = POMOC;
}
function zatvor(znovaZamkni) {
  otvorena = false; tahanie = null; zatvorMenu();
  okno.style.display = 'none';
  if (znovaZamkni) window.hra?.g?.renderer?.domElement?.requestPointerLock?.()?.catch?.(() => {});
}

function kresliMapu(hra) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = mapaPlatno.clientWidth, h = mapaPlatno.clientHeight;
  if (mapaPlatno.width !== Math.round(w * dpr) || mapaPlatno.height !== Math.round(h * dpr)) {
    mapaPlatno.width = Math.round(w * dpr); mapaPlatno.height = Math.round(h * dpr);
  }
  const c = mapaCtx;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const m = pohlad.m, chyba = kresliTeren(c, w, h, pohlad.x, pohlad.z, m);
  fronta = chyba.sort((a, b) => a[1] - b[1]).map(a => a[0]);
  const X = x => (x - pohlad.x) * m + w / 2, Z = z => (z - pohlad.z) * m + h / 2;

  // sepiovy nadych starej mapy
  c.fillStyle = 'rgba(200,160,90,.13)'; c.fillRect(0, 0, w, h);
  kresliPasma(c, w, h, X, Z, true, m);
  // mriezka po bunkach
  c.strokeStyle = 'rgba(70,45,20,.22)'; c.lineWidth = 1;
  c.beginPath();
  const x0 = pohlad.x - w / 2 / m, z0 = pohlad.z - h / 2 / m;
  for (let bx = Math.ceil(x0 / BUNKA); bx * BUNKA < x0 + w / m; bx++) { const sx = Math.round(X(bx * BUNKA)) + 0.5; c.moveTo(sx, 0); c.lineTo(sx, h); }
  for (let bz = Math.ceil(z0 / BUNKA); bz * BUNKA < z0 + h / m; bz++) { const sy = Math.round(Z(bz * BUNKA)) + 0.5; c.moveTo(0, sy); c.lineTo(w, sy); }
  c.stroke();

  // mena ostrovov
  if (m > 0.16) {
    c.textAlign = 'center';
    c.font = `italic 700 ${Math.round(Math.min(18, 10 + m * 10))}px Georgia, serif`;
    for (let bz = Math.floor(z0 / BUNKA); bz * BUNKA < z0 + h / m; bz++)
      for (let bx = Math.floor(x0 / BUNKA); bx * BUNKA < x0 + w / m; bx++) {
        const o = ostrovVBunke(bx, bz);
        if (!o) continue;
        const pom = jePomenovany(o);
        if (!pom && !(hra.objavene?.has(bx + ',' + bz))) continue;     // neobjaveny ostrov nema meno
        const sx = X(o.x), sy = Z(o.z) - o.R * m - 6, t = pom ? menoOstrova(o) : 'Nepomenovaný ostrov';
        c.globalAlpha = pom ? 1 : 0.6;
        c.lineWidth = 3; c.strokeStyle = 'rgba(240,228,196,.85)'; c.strokeText(t, sx, sy);
        c.fillStyle = pom ? '#3f2b14' : '#6a5a40'; c.fillText(t, sx, sy);
        c.globalAlpha = 1;
      }
  }

  for (const mj of majaky) if (mj.objaveny) kresliMajak(c, X(mj.x), Z(mj.z), mj.lit, 15);
  // navigacia: prerusovana ciara od hraca k cielu
  const pp = hra.hrac.poz, cl = ciel();
  if (cl) {
    c.save(); c.setLineDash([10, 8]); c.lineWidth = 3; c.strokeStyle = 'rgba(255,240,170,.95)'; c.shadowColor = '#000'; c.shadowBlur = 4;
    c.beginPath(); c.moveTo(X(pp.x), Z(pp.z)); c.lineTo(X(cl.x), Z(cl.z)); c.stroke(); c.restore();
  }
  // znacky hraca (nazov pod nimi)
  c.font = '700 13px Georgia, serif'; c.textAlign = 'center';
  for (const z of znacky) {
    const sx = X(z.x), sy = Z(z.z);
    if (sx < -30 || sx > w + 30 || sy < -30 || sy > h + 30) continue;
    const hov = z === kurzorZnacka;
    kresliZnacku(c, sx, sy, z.t, hov || z === cl ? 17 : 14, hov || z === cl);
    c.lineWidth = 4; c.strokeStyle = 'rgba(240,228,196,.9)'; c.strokeText(z.n, sx, sy + 32);
    c.fillStyle = '#3f2b14'; c.fillText(z.n, sx, sy + 32);
    if (z === cl) { const d = vzdialenost(Math.hypot(z.x - pp.x, z.z - pp.z)); c.strokeText(d, sx, sy + 47); c.fillStyle = '#7a2b1a'; c.fillText(d, sx, sy + 47); }
  }
  // lode a hrac
  for (const l of hra.lode) {
    if (l === hra.kanoe && hra.vKanoe) continue;
    sipka(c, X(l.poz.x), Z(l.poz.y), uholObr(l.smer), l === hra.kanoe ? 11 : 9, l === hra.kanoe ? '#ffb020' : '#c0392b');
  }
  const p = hra.hrac.poz;
  c.beginPath(); c.arc(X(p.x), Z(p.z), 15, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.25)'; c.fill();
  sipka(c, X(p.x), Z(p.z), uholObr(smerHraca(hra)), 12, '#fff');

  // veterna ruzica (pravy horny roh)
  ruzica(c, w - 70, 72, 42);
  // mierka (dolu v strede)
  const dlzky = [50, 100, 200, 500, 1000, 2000, 5000];
  const dm = dlzky.find(d => d * m > 90) || 5000, sw = dm * m, bx0 = w / 2 - sw / 2, by = h - 26;
  c.fillStyle = 'rgba(239,224,184,.9)'; c.fillRect(bx0 - 10, by - 18, sw + 20, 30);
  c.fillStyle = '#3f2b14'; c.fillRect(bx0, by, sw, 4);
  c.fillStyle = '#efe0b8'; c.fillRect(bx0 + sw / 4, by + 1, sw / 4, 2); c.fillRect(bx0 + sw * 3 / 4, by + 1, sw / 4, 2);
  c.font = '12px Georgia, serif'; c.textAlign = 'center'; c.fillStyle = '#3f2b14';
  c.fillText(dm >= 1000 ? dm / 1000 + ' km' : dm + ' m', w / 2, by - 5);
}

function ruzica(c, x, y, r) {
  c.save(); c.translate(x, y);
  c.beginPath(); c.arc(0, 0, r * 0.78, 0, Math.PI * 2);
  c.fillStyle = 'rgba(239,224,184,.75)'; c.fill(); c.strokeStyle = '#6b4a26'; c.lineWidth = 1.5; c.stroke();
  for (let i = 0; i < 8; i++) {
    const dl = i % 2 ? r * 0.5 : r * 0.92;
    c.rotate(Math.PI / 4);
    c.beginPath(); c.moveTo(0, -dl); c.lineTo(r * 0.12, 0); c.lineTo(0, 0); c.closePath(); c.fillStyle = '#3f2b14'; c.fill();
    c.beginPath(); c.moveTo(0, -dl); c.lineTo(-r * 0.12, 0); c.lineTo(0, 0); c.closePath(); c.fillStyle = '#c9a86a'; c.fill();
  }
  c.font = 'bold 15px Georgia, serif'; c.textAlign = 'center'; c.fillStyle = '#7a2b1a';
  c.fillText('S', 0, -r - 3);
  c.restore();
}

// ovladanie velkej mapy mysou
let kurzorZnacka = null, zaciatokKlika = null;
// bod na mape (m) pod kurzorom a znacka, ktora je pod nim
const polohaMysi = e => {
  const r = mapaPlatno.getBoundingClientRect();
  return { mx: pohlad.x + (e.clientX - r.left - r.width / 2) / pohlad.m, mz: pohlad.z + (e.clientY - r.top - r.height / 2) / pohlad.m };
};
const znackaPod = (mx, mz) => znacky.find(z => Math.hypot(z.x - mx, z.z - mz) * pohlad.m < 17) || null;
function zatvorMenu() { mapaMenu.style.display = 'none'; }
// kontextove menu: polozky [text, funkcia]; prva polozka je nadpis
function ukazMenu(e, nadpis, polozky) {
  mapaMenu.innerHTML = `<div class="hlava"></div>`;
  mapaMenu.firstChild.textContent = nadpis;
  for (const [t, fn] of polozky) {
    const d = document.createElement('div'); d.textContent = t;
    d.onmousedown = ev => ev.stopPropagation();
    d.onclick = () => { zatvorMenu(); fn(); };
    mapaMenu.appendChild(d);
  }
  const ro = okno.getBoundingClientRect();
  mapaMenu.style.display = 'block';
  mapaMenu.style.left = Math.min(e.clientX - ro.left, ro.width - 230) + 'px';
  mapaMenu.style.top = Math.min(e.clientY - ro.top, ro.height - 40 - polozky.length * 34) + 'px';
}
function menuNaBode(e) {
  const { mx, mz } = polohaMysi(e), z = znackaPod(mx, mz);
  if (z) {
    ukazMenu(e, z.n, [
      [navi.id === z.id ? '✖ Zrušiť navigáciu' : '▶ Navigovať sem', () => { navi.id = navi.id === z.id ? null : z.id; }],
      ['✎ Upraviť značku', () => upravZnacku(z)],
      ['🗑 Zmazať značku', () => { if (navi.id === z.id) navi.id = null; znacky.splice(znacky.indexOf(z), 1); }],
    ]);
    return;
  }
  const n = najblizsiOstrov(mx, mz), polozky = [['📍 Pridať značku sem', () => upravZnacku({ x: mx, z: mz, t: 'bod', n: '' })]];
  if (n && n.d < n.o.R * 0.4) polozky.push([`🏝 ${jePomenovany(n.o) ? 'Premenovať' : 'Pomenovať'} ostrov`, () => pomenujOstrov(n.o)]);
  ukazMenu(e, `${Math.round(mx)}, ${Math.round(mz)}`, polozky);
}
mapaPlatno.addEventListener('contextmenu', e => { e.preventDefault(); menuNaBode(e); });
mapaPlatno.addEventListener('dblclick', e => { const { mx, mz } = polohaMysi(e); if (!znackaPod(mx, mz)) { zatvorMenu(); upravZnacku({ x: mx, z: mz, t: 'bod', n: '' }); } });
mapaPlatno.addEventListener('mousedown', e => {
  zatvorMenu();
  if (e.button !== 0) return;
  tahanie = { x: e.clientX, y: e.clientY }; zaciatokKlika = { x: e.clientX, y: e.clientY };
  mapaPlatno.classList.add('tahanie');
});
addEventListener('mouseup', e => {
  // lavy klik (bez tahania) na znacku = menu znacky
  if (otvorena && zaciatokKlika && e.target === mapaPlatno && Math.hypot(e.clientX - zaciatokKlika.x, e.clientY - zaciatokKlika.y) < 4) {
    const { mx, mz } = polohaMysi(e);
    if (znackaPod(mx, mz)) menuNaBode(e);
  }
  zaciatokKlika = null; tahanie = null; mapaPlatno.classList.remove('tahanie');
});
addEventListener('mousemove', e => {
  if (otvorena) {
    const { mx, mz } = polohaMysi(e);
    kurzorZnacka = znackaPod(mx, mz);
    const n = najblizsiOstrov(mx, mz);
    mapaInfo.innerHTML = `Kurzor: ${Math.round(mx)}, ${Math.round(mz)}` + (n && n.d < 60 ? `<br><b>${menoOstrova(n.o)}</b>` : '')
      + '<br>' + POMOC;
  }
  if (!tahanie) return;
  pohlad.x -= (e.clientX - tahanie.x) / pohlad.m; pohlad.z -= (e.clientY - tahanie.y) / pohlad.m;
  tahanie.x = e.clientX; tahanie.y = e.clientY;
});
// koliesko: zachytene uz na okne (capture), aby ho nedostala kamera hry
addEventListener('wheel', e => {
  if (!otvorena) return;
  e.stopImmediatePropagation(); e.preventDefault();
  const r = mapaPlatno.getBoundingClientRect(), ox = e.clientX - r.left - r.width / 2, oy = e.clientY - r.top - r.height / 2;
  const mx = pohlad.x + ox / pohlad.m, mz = pohlad.z + oy / pohlad.m;          // bod pod kurzorom ostava na mieste
  pohlad.m = Math.min(MAX_M, Math.max(MIN_M, pohlad.m * Math.pow(1.0018, -e.deltaY)));
  pohlad.x = mx - ox / pohlad.m; pohlad.z = mz - oy / pohlad.m;
}, { capture: true, passive: false });

// klavesy: N otvori/zatvori; ked je mapa otvorena, hra klavesy (a koliesko) nedostane
addEventListener('keydown', e => {
  if (dialogOtvoreny() || /INPUT|TEXTAREA/.test(e.target?.tagName)) return;   // pises meno -> mapa klavesy nechyta
  if (e.code === KLAVESA && !e.repeat && window.hra) {
    e.stopImmediatePropagation();
    if (otvorena) zatvor(true); else otvor(window.hra);
    return;
  }
  if (!otvorena) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (e.code === 'Escape') zatvor(false);
  if (e.code === 'Space' && window.hra) { pohlad.x = window.hra.hrac.poz.x; pohlad.z = window.hra.hrac.poz.z; }
}, true);

// ---------- hlavna slucka mapy ----------
let poslMini = 0;
function slucka(t) {
  requestAnimationFrame(slucka);
  const hra = window.hra;
  if (!hra?.hrac) return;
  kresliNaviSvet(hra);
  if (otvorena) {
    kresliMapu(hra);
  } else {
    if (t - poslMini > 100) { poslMini = t; kresliMinimapu(hra); }       // 10x za sekundu
    miniSipka.style.transform = `rotate(${uholObr(smerHraca(hra))}rad)`;   // sipka hraca plynulo kazdy snimok
  }
  mini.style.display = otvorena ? 'none' : '';
  generuj();
}
requestAnimationFrame(slucka);
