// Inventar (batoh) + vyroba. Data: 24 policok, prvych 8 = spodna lista (klavesy 1-8).
// Predmety su v obsah/predmety.js, recepty v obsah/recepty.js.
// Batoh (Tab): predmety sa daju presuvat mysou (tahaj a pusti), vpravo je panel vyroby.
import { PREDMETY } from './obsah/predmety.js';
import { RECEPTY } from './obsah/recepty.js';
import './obsah/nastroje.js';   // registracia nastrojov (aby existovali pred nacitanim/recept)

export const sloty = Array(24).fill(null);       // policko = null alebo { typ, pocet } (nastroj navyse trv = zostavajuca trvanlivost)
let vybrany = 0, otvoreny = false;
let priZmene = () => {};                          // volane po kazdej zmene (napr. predmet v ruke, zvuk)
const kopa = id => PREDMETY[id]?.kopa ?? 20;
const trvMax = id => PREDMETY[id]?.nastroj?.trvanlivost ?? 0;   // 0 = nie je nastroj

// prida n kusov; vrati kolko sa NEzmestilo
const nove = new Set();                           // policka, do ktorych prave nieco pribudlo (animacia pri dalsom vykresleni)
export function pridaj(id, n = 1) {
  sloty.forEach((s, i) => { if (n && s && s.typ === id && s.pocet < kopa(id)) { const k = Math.min(n, kopa(id) - s.pocet); s.pocet += k; n -= k; nove.add(i); } });
  for (let i = 0; n && i < sloty.length; i++) if (!sloty[i]) { const k = Math.min(n, kopa(id)); sloty[i] = { typ: id, pocet: k }; if (trvMax(id)) sloty[i].trv = trvMax(id); n -= k; nove.add(i); }
  return n;
}
export const pocet = id => sloty.reduce((a, s) => a + (s && s.typ === id ? s.pocet : 0), 0);
export function odober(id, n) {
  for (let i = sloty.length - 1; i >= 0 && n; i--) {
    const s = sloty[i];
    if (s && s.typ === id) { const k = Math.min(n, s.pocet); s.pocet -= k; n -= k; if (!s.pocet) sloty[i] = null; }
  }
}
// recept je viditelny, ked nema podmienku alebo ju splna
export const jeDostupny = r => !r.podmienka || !!r.podmienka();
export const mozeVyrobit = r => jeDostupny(r) && r.suroviny.every(([id, n]) => pocet(id) >= n);
// vyrobi recept (prida vysledok, alebo zavola akcia); ak sa vysledok nezmesti / akcia vrati false, nic sa nezmeni
export function vyrob(r) {
  if (!mozeVyrobit(r)) return false;
  const zaloha = sloty.map(s => s && { ...s });
  const vratit = () => { zaloha.forEach((s, i) => { sloty[i] = s; }); return false; };
  r.suroviny.forEach(([id, n]) => odober(id, n));
  if (r.akcia) return r.akcia() === false ? vratit() : true;
  if (pridaj(r.vysledok[0], r.vysledok[1] ?? 1) > 0) return vratit();
  return true;
}
// presun z policka a na policko b (rovnaky typ = spoj, inak vymen)
export function presun(a, b) {
  if (a === b || !sloty[a]) return;
  const A = sloty[a], B = sloty[b];
  if (B && B.typ === A.typ && kopa(A.typ) > 1) {
    const k = Math.min(A.pocet, kopa(A.typ) - B.pocet);
    B.pocet += k; A.pocet -= k;
    if (!A.pocet) sloty[a] = null;
  } else { sloty[a] = B; sloty[b] = A; }
}

export const vybranyIndex = () => vybrany;
export const vybranyPredmet = () => sloty[vybrany] ? PREDMETY[sloty[vybrany].typ] : null;
export const jeOtvoreny = () => otvoreny;
export function nacitaj(data) {
  if (Array.isArray(data)) data.slice(0, sloty.length).forEach((s, i) => { sloty[i] = s && PREDMETY[s.typ] ? s : null; if (sloty[i] && trvMax(s.typ) && !(s.trv > 0)) sloty[i].trv = trvMax(s.typ); });
}
export function vyber(i) { vybrany = i; zmena(); }
export function prepniBatoh(stav = !otvoreny) { otvoreny = stav; vykresli(); return otvoreny; }
function zmena() { vykresli(); priZmene(); }
export const obnov = zmena;   // prekresli aj dá vedieť hre (napr. nastroj sa pokazil -> prazdna ruka)

// ---------- obrazovka ----------
const $ = id => document.getElementById(id);
const ikonaPredmetu = id => PREDMETY[id]?.ikona ?? '?';
const trvanlivostHtml = s => {
  const max = trvMax(s.typ);
  if (!max || s.trv == null) return '';
  const q = Math.max(0, Math.min(1, s.trv / max));
  return `<span class="trv"><i style="width:${Math.round(q * 100)}%;background:hsl(${Math.round(q * 120)} 75% 52%)"></i></span>`;
};
const popisPredmetu = s => {
  const p = PREDMETY[s.typ], t = trvMax(s.typ);
  return `${p.meno} – ${p.popis}${t ? ` (trvanlivosť ${s.trv ?? t}/${t})` : ''}`;
};
const policko = (s, i) => `<div class="slot${i === vybrany ? ' vybrany' : ''}${nove.has(i) ? ' pop' : ''}" data-i="${i}"${s ? ` title="${popisPredmetu(s)}"` : ''}>`
  + (i < 8 ? `<span class="cislo">${i + 1}</span>` : '')
  + (s ? `<span class="ikona">${PREDMETY[s.typ].ikona}</span>${s.pocet > 1 ? `<span class="pocet">${s.pocet}</span>` : ''}${trvanlivostHtml(s)}` : '') + '</div>';

function receptyHtml() {
  const skupiny = new Map();   // nazov skupiny -> [index receptu]
  RECEPTY.forEach((r, i) => {
    if (!jeDostupny(r)) return;
    const k = r.skupina || 'Ostatné';
    if (!skupiny.has(k)) skupiny.set(k, []);
    skupiny.get(k).push(i);
  });
  if (!skupiny.size) return '<p class="prazdne">Zatiaľ žiadne recepty.<br>Pridávajú sa v <code>src/obsah/recepty.js</code>.</p>';
  return [...skupiny].map(([meno, idxs]) => `<h3>${meno}</h3>` + idxs.map(i => {
    const r = RECEPTY[i], p = r.vysledok ? PREDMETY[r.vysledok[0]] : null;
    const ok = mozeVyrobit(r);
    const chyba = r.suroviny.filter(([id, n]) => pocet(id) < n);
    const n = r.vysledok?.[1] ?? 1;
    return `<div class="recept${ok ? ' moze' : ' nedostupny'}" data-r="${i}"><span class="ikona">${r.ikona ?? p?.ikona ?? '?'}</span><div class="telo"><b>${r.meno ?? p?.meno ?? r.id}${n > 1 ? ` ×${n}` : ''}</b>`
      + `<div class="suroviny">` + r.suroviny.map(([id, c]) => `<span class="${pocet(id) >= c ? 'ma' : 'chyba'}">${ikonaPredmetu(id)} ${Math.min(pocet(id), c)}/${c}</span>`).join('') + '</div>'
      + (ok ? '<div class="stav">Kliknutím vyrobíš</div>' : chyba.length ? `<div class="stav chybaj">Chýba: ${chyba.map(([id, c]) => `${c - pocet(id)}× ${PREDMETY[id]?.meno ?? id}`).join(', ')}</div>` : '') + '</div></div>';
  }).join('')).join('');
}

export function vykresli() {
  $('lista').innerHTML = sloty.slice(0, 8).map(policko).join('');
  nove.clear();
  $('batoh').style.display = otvoreny ? 'flex' : 'none';
  if (!otvoreny) return;
  $('batoh-mriezka').innerHTML = sloty.map(policko).join('');
  $('vyroba').innerHTML = receptyHtml();
}

export function initInventar(onZmena) {
  priZmene = onZmena;
  let tahany = null;
  const duch = $('duch');
  addEventListener('pointerdown', e => {
    const s = e.target.closest('#batoh .slot');
    if (!s || !sloty[+s.dataset.i]) return;
    tahany = +s.dataset.i;
    duch.textContent = PREDMETY[sloty[tahany].typ].ikona;
    duch.style.display = 'block';
    duch.style.left = e.clientX + 'px'; duch.style.top = e.clientY + 'px';
  });
  addEventListener('pointermove', e => { if (tahany !== null) { duch.style.left = e.clientX + 'px'; duch.style.top = e.clientY + 'px'; } });
  addEventListener('pointerup', e => {
    if (tahany === null) return;
    const s = document.elementFromPoint(e.clientX, e.clientY)?.closest('.slot');
    if (s) presun(tahany, +s.dataset.i);
    tahany = null; duch.style.display = 'none';
    zmena();
  });
  addEventListener('click', e => {
    const r = e.target.closest('.recept');
    if (r && vyrob(RECEPTY[+r.dataset.r])) zmena();
  });
}

// self-check pri starte (sloty su este prazdne)
{
  const ok = [];
  ok.push(pridaj('kamen', 25) === 0 && sloty[0].pocet === 20 && sloty[1].pocet === 5);
  presun(1, 0); ok.push(sloty[0].pocet === 20 && sloty[1].pocet === 5);
  presun(1, 5); ok.push(!sloty[1] && sloty[5].pocet === 5);
  const r = { vysledok: ['drevo', 1], suroviny: [['kamen', 21]] };
  ok.push(vyrob(r) && pocet('kamen') === 4 && pocet('drevo') === 1 && !vyrob(r));
  odober('kamen', 4); odober('drevo', 1);
  ok.push(sloty.every(s => s === null));
  // nastroj: trvanlivost, nestackuje sa; recept s akciou a podmienkou
  pridaj('kamenna_sekera', 2);
  ok.push(sloty[0].trv === trvMax('kamenna_sekera') && sloty[1].trv > 0 && !pridaj('kamenna_sekera', 0));
  presun(0, 1); ok.push(sloty[0] && sloty[1] && sloty[1].typ === 'kamenna_sekera');
  odober('kamenna_sekera', 2);
  let volana = 0;
  pridaj('kamen', 1);
  const ra = { suroviny: [['kamen', 1]], akcia: () => { volana++; } };
  const rp = { suroviny: [['kamen', 1]], podmienka: () => false, akcia: () => { volana += 10; } };
  ok.push(!vyrob(rp) && vyrob(ra) && volana === 1 && pocet('kamen') === 0);
  ok.push(sloty.every(s => s === null));
  console.assert(ok.every(Boolean), 'inventar: self-check zlyhal', ok);
  sloty.fill(null);
}
