// Mapa: minimapa (kruh vlavo dole) + velka mapa cez celu obrazovku (klavesa N).
// Teren sa kresli do malych platien po dlazdiciach (1 dlazdica = 1 bunka sveta 520 m) a uklada sa do cache.
// Dlazdice sa generuju postupne (casovy limit na snimok), aby hra nezasekavala.
// Suradnice: sever = -z (hore), vychod = +x (vpravo) -> na mape px = x, py = z.
import { vyskaTerenu, ostrovVBunke, ostrovPri, BUNKA } from './svet.js';

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
#mapa-info { position: absolute; right: 22px; bottom: 22px; padding: 8px 14px; border-radius: 6px; background: rgba(239,224,184,.92); color: #3f2b14;
  font: 13px/1.5 Georgia, serif; text-align: right; box-shadow: 0 2px 8px #0005; }
`;
document.head.appendChild(styl);

const mini = document.createElement('div');
mini.id = 'minimapa';
mini.innerHTML = `<canvas width="${MINI_PX * 2}" height="${MINI_PX * 2}"></canvas><div class="sipka"></div><div class="sever">S</div>`
  + `<div class="klaves"><kbd>N</kbd></div><div class="popis"></div>`;
(document.getElementById('hud') || document.body).appendChild(mini);
const miniPlatno = mini.querySelector('canvas'), miniCtx = miniPlatno.getContext('2d');
const miniSipka = mini.querySelector('.sipka'), miniPopis = mini.querySelector('.popis');

const okno = document.createElement('div');
okno.id = 'mapa-okno';
okno.innerHTML = `<div id="mapa-ram"><canvas></canvas><div class="vineta"></div></div>
  <div id="mapa-titul">Mapa súostrovia</div>
  <div id="mapa-legenda"><div><i style="background:#fff"></i>Ty (šípka = smer)</div><div><i style="background:#ffb020"></i>Aktívna loď</div>
    <div><i style="background:#c0392b"></i>Ostatné lode</div></div>
  <div id="mapa-info"></div>`;
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
  ovocny: [0x7cb842, 0x5ea330, 0xead7a2, 1.4],
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
  const f = BIOM_FARBY[o?.biom] || BIOM_FARBY.palmovy;
  const d = { bx, bz, o, riadok: 0, hotova: false, vysky: new Float32Array((RES + 1) * (RES + 1)), platno: null,
    b: { tr1: hex(f[0]), tr2: hex(f[1]), piesok: hex(f[2]), plaz: f[3] } };
  // bunka bez ostrova = len dno -> staci hrubsia vzorka (kazdy 3. bod), zvysok sa dopocita
  d.krok = o ? 1 : 3;
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
const smerHraca = hra => hra.vKanoe && hra.kanoe ? hra.kanoe.smer : hra.kam.yaw;

// ---------- minimapa ----------
function kresliMinimapu(hra) {
  const c = miniCtx, W = miniPlatno.width, m = W / (2 * MINI_R), p = hra.hrac.poz;
  const chyba = kresliTeren(c, W, W, p.x, p.z, m);
  fronta = chyba.sort((a, b) => a[1] - b[1]).map(a => a[0]);
  // lode
  const r = W / 2;
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
  if (n) t = ostrovPri(p.x, p.z, 1.15) === n.o ? `<b>${n.o.meno}</b>` : `<b>${n.o.meno}</b> · ${Math.round(n.d)} m ${strana(n.o.x - p.x, n.o.z - p.z)}`;
  else t = 'Otvorené more';
  miniPopis.innerHTML = `${t}<br><span style="opacity:.75">${Math.round(p.x)}, ${Math.round(p.z)}</span>`;
}

// ---------- velka mapa ----------
const pohlad = { x: 0, z: 0, m: 0.35 };   // stred a mierka (px na meter, v CSS pixeloch)
let otvorena = false, tahanie = null;
const POMOC = '<span style="opacity:.75">N / Esc zavrieť · koliesko zoom · ťahaj posun · medzerník = na teba</span>';
const MIN_M = 0.12, MAX_M = 1.2;

function otvor(hra) {
  otvorena = true;
  okno.style.display = 'block';
  pohlad.x = hra.hrac.poz.x; pohlad.z = hra.hrac.poz.z;
  document.exitPointerLock?.();
  mapaInfo.innerHTML = POMOC;
}
function zatvor(znovaZamkni) {
  otvorena = false; tahanie = null;
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
        const sx = X(o.x), sy = Z(o.z) - o.R * m - 6;
        c.lineWidth = 3; c.strokeStyle = 'rgba(240,228,196,.85)'; c.strokeText(o.meno, sx, sy);
        c.fillStyle = '#3f2b14'; c.fillText(o.meno, sx, sy);
      }
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
mapaPlatno.addEventListener('mousedown', e => { tahanie = { x: e.clientX, y: e.clientY }; mapaPlatno.classList.add('tahanie'); });
addEventListener('mouseup', () => { tahanie = null; mapaPlatno.classList.remove('tahanie'); });
addEventListener('mousemove', e => {
  if (otvorena) {
    const r = mapaPlatno.getBoundingClientRect();
    const mx = pohlad.x + (e.clientX - r.left - r.width / 2) / pohlad.m, mz = pohlad.z + (e.clientY - r.top - r.height / 2) / pohlad.m;
    const n = najblizsiOstrov(mx, mz);
    mapaInfo.innerHTML = `Kurzor: ${Math.round(mx)}, ${Math.round(mz)}` + (n && n.d < 60 ? `<br><b>${n.o.meno}</b>` : '')
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
