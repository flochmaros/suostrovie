// Dennik uloh: sleduje postup, ukladanie, oznamenie, HUD panel (vpravo hore) a okno Dennika (J).
import { KAPITOLY } from './obsah/ulohy.js';
import { pocet, pridaj, vykresli as vykresliInventar } from './inventar.js';
import { PREDMETY } from './obsah/predmety.js';
import { diely } from './stavba.js';
import { pasmo } from './svet.js';

const $ = id => document.getElementById(id);
let ctx = { poz: () => ({ x: 0, z: 0 }), lodUroven: () => 0, oznam: () => {}, zvuk: () => {} };
let hotove = new Set();     // id splnenych uloh
let udal = {};              // pocitadla udalosti: 'vyrob:id', 'ohen', 'upec', 'zjedz'
let skryty = false;
let otvorene = false;
let t = 0;

const vsetky = KAPITOLY.flatMap(k => k.ulohy);
const kapHotova = k => k.ulohy.every(u => hotove.has(u.id));
const kapOdomknuta = i => i === 0 || kapHotova(KAPITOLY[i - 1]);

// postup ulohy: [aktualne, cielove]
function postup(u) {
  const n = u.pocet || 1;
  switch (u.typ) {
    case 'mat': return [pocet(u.ciel), n];
    case 'postav': return [diely.filter(d => d.typ === u.ciel).length, n];
    case 'pasmo': { const p = ctx.poz(); return [pasmo(p.x, p.z) >= u.ciel ? 1 : 0, 1]; }
    case 'lod': return [ctx.lodUroven() >= u.ciel ? 1 : 0, 1];
    case 'vyrob': return [udal['vyrob:' + u.ciel] || 0, n];
    default: return [udal[u.typ] || 0, n];   // ohen, upec, zjedz
  }
}
const splnena = u => { const [a, n] = postup(u); return a >= n; };

function odmen(u) {
  const text = [];
  for (const [id, n] of u.odmena || []) {
    if (!PREDMETY[id]) continue;                  // neznamy predmet sa preskoci
    if (pridaj(id, n) < n) text.push(`${n}× ${PREDMETY[id].ikona}`);
  }
  vykresliInventar();
  return text.join(' ');
}

// aktualna uloha = prva nesplnena v prvej odomknutej kapitole s nesplnenou ulohou
function aktualna() {
  for (let i = 0; i < KAPITOLY.length; i++) {
    if (!kapOdomknuta(i)) break;
    const u = KAPITOLY[i].ulohy.find(x => !hotove.has(x.id));
    if (u) return { u, kap: KAPITOLY[i] };
  }
  return null;
}

// hlasenie udalosti z hry: hlas('vyrob', 'kamenna_sekera'), hlas('ohen'), hlas('upec'), hlas('zjedz')
export function hlas(typ, id) {
  const k = id ? `${typ}:${id}` : typ;
  udal[k] = (udal[k] || 0) + 1;
  skontroluj();
}

export function skontroluj() {
  let zmena = false;
  for (let i = 0; i < KAPITOLY.length; i++) {
    if (!kapOdomknuta(i)) break;
    for (const u of KAPITOLY[i].ulohy) {
      if (hotove.has(u.id) || !splnena(u)) continue;
      hotove.add(u.id); zmena = true;
      const o = odmen(u);
      ctx.zvuk();
      ctx.oznam(`📖 Úloha splnená: ${u.text.split(' (')[0]}${o ? ' · odmena ' + o : ''}`);
      if (kapHotova(KAPITOLY[i])) ctx.oznam(KAPITOLY[i + 1] ? `📖 Nová kapitola: ${KAPITOLY[i + 1].meno}` : '📖 Kapitola dokončená');
    }
  }
  if (zmena) { vykresliHud(); if (otvorene) vykresliOkno(); }
}

// ---------- HUD ----------
function vykresliHud() {
  const h = $('uloha-hud');
  if (!h) return;
  const a = aktualna();
  h.style.display = skryty ? 'none' : 'block';
  $('uloha-ukaz').style.display = skryty ? 'block' : 'none';
  if (!a) { h.innerHTML = '<b>📖 Denník</b><div>Všetky úlohy splnené – ďalšie pribudnú.</div>'; return; }
  const [x, n] = postup(a.u);
  h.innerHTML = `<b>📖 ${a.kap.meno}</b><div>${a.u.text}${n > 1 ? ` <span class="uloha-p">${Math.min(x, n)}/${n}</span>` : ''}</div><small>J – denník · klik skryje</small>`;
}

// ---------- okno ----------
function vykresliOkno() {
  const o = $('dennik-obsah');
  if (!o) return;
  o.innerHTML = KAPITOLY.map((k, i) => {
    if (!kapOdomknuta(i)) return '<div class="kap zamknuta"><h3>🔒 ???</h3><div class="uloha">Dokonči predchádzajúcu kapitolu.</div></div>';
    const spl = k.ulohy.filter(u => hotove.has(u.id)).length;
    return `<div class="kap"><h3>${k.meno} <small>${spl}/${k.ulohy.length}</small></h3><p class="tichy">${k.popis}</p>` +
      k.ulohy.map(u => {
        const ok = hotove.has(u.id), [x, n] = postup(u);
        const od = (u.odmena || []).filter(r => PREDMETY[r[0]]).map(([id, c]) => `${c}× ${PREDMETY[id].ikona}`).join(' ');
        return `<div class="uloha${ok ? ' hotova' : ''}"><span class="odskrt">${ok ? '☑' : '☐'}</span><span>${u.text}${!ok && n > 1 ? ` <b>${Math.min(x, n)}/${n}</b>` : ''}${od ? ` <small>odmena ${od}</small>` : ''}</span></div>`;
      }).join('') + '</div>';
  }).join('');
}

export const jeOknoOtvorene = () => otvorene;
export function prepniOkno(stav = !otvorene) {
  otvorene = stav;
  const w = $('dennik');
  if (w) w.style.display = otvorene ? 'block' : 'none';
  if (otvorene) vykresliOkno();
  return otvorene;
}

export function aktualizujUlohy(dt) {            // volat kazdy snimok; kontrola 2x za sekundu
  t += dt;
  if (t < 0.5) return;
  t = 0;
  skontroluj();
  vykresliHud();
  if (otvorene) vykresliOkno();
}

export const ulozUlohy = () => ({ h: [...hotove], u: udal, s: skryty });
export function nacitajUlohy(d) {
  if (!d) return;
  hotove = new Set((d.h || []).filter(id => vsetky.some(u => u.id === id)));
  udal = d.u || {}; skryty = !!d.s;
}
export const stavUloh = () => ({ hotove: [...hotove], udalosti: udal, aktualna: aktualna()?.u.id || null,
  kapitoly: KAPITOLY.map((k, i) => ({ id: k.id, odomknuta: kapOdomknuta(i), hotova: kapHotova(k) })) });

// o = { poz: () => ({x,z}), lodUroven: () => cislo, oznam, zvuk }
export function initUlohy(o) {
  ctx = { ...ctx, ...o };
  $('uloha-hud').addEventListener('click', () => { skryty = true; vykresliHud(); });
  $('uloha-ukaz').addEventListener('click', () => { skryty = false; vykresliHud(); });
  $('dennik-zavri').addEventListener('click', () => prepniOkno(false));
  vykresliHud();
}
