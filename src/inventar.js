// Inventar (batoh) + vyroba. Data: 24 policok, prvych 8 = spodna lista (klavesy 1-8).
// Predmety su v obsah/predmety.js, recepty v obsah/recepty.js.
// Batoh (Tab): predmety sa daju presuvat mysou (tahaj a pusti), vpravo je panel vyroby.
import { PREDMETY } from './obsah/predmety.js';
import { RECEPTY } from './obsah/recepty.js';

export const sloty = Array(24).fill(null);       // policko = null alebo { typ, pocet }
let vybrany = 0, otvoreny = false;
let priZmene = () => {};                          // volane po kazdej zmene (napr. predmet v ruke, zvuk)
const kopa = id => PREDMETY[id]?.kopa ?? 20;

// prida n kusov; vrati kolko sa NEzmestilo
export function pridaj(id, n = 1) {
  for (const s of sloty) if (n && s && s.typ === id && s.pocet < kopa(id)) { const k = Math.min(n, kopa(id) - s.pocet); s.pocet += k; n -= k; }
  for (let i = 0; n && i < sloty.length; i++) if (!sloty[i]) { const k = Math.min(n, kopa(id)); sloty[i] = { typ: id, pocet: k }; n -= k; }
  return n;
}
export const pocet = id => sloty.reduce((a, s) => a + (s && s.typ === id ? s.pocet : 0), 0);
export function odober(id, n) {
  for (let i = sloty.length - 1; i >= 0 && n; i--) {
    const s = sloty[i];
    if (s && s.typ === id) { const k = Math.min(n, s.pocet); s.pocet -= k; n -= k; if (!s.pocet) sloty[i] = null; }
  }
}
export const mozeVyrobit = r => r.suroviny.every(([id, n]) => pocet(id) >= n);
// vyrobi recept; ak sa vysledok nezmesti, nic sa nezmeni
export function vyrob(r) {
  if (!mozeVyrobit(r)) return false;
  const zaloha = sloty.map(s => s && { ...s });
  r.suroviny.forEach(([id, n]) => odober(id, n));
  if (pridaj(r.vysledok[0], r.vysledok[1] ?? 1) > 0) { zaloha.forEach((s, i) => { sloty[i] = s; }); return false; }
  return true;
}
// presun z policka a na policko b (rovnaky typ = spoj, inak vymen)
export function presun(a, b) {
  if (a === b || !sloty[a]) return;
  const A = sloty[a], B = sloty[b];
  if (B && B.typ === A.typ) {
    const k = Math.min(A.pocet, kopa(A.typ) - B.pocet);
    B.pocet += k; A.pocet -= k;
    if (!A.pocet) sloty[a] = null;
  } else { sloty[a] = B; sloty[b] = A; }
}

export const vybranyPredmet = () => sloty[vybrany] ? PREDMETY[sloty[vybrany].typ] : null;
export const jeOtvoreny = () => otvoreny;
export function nacitaj(data) {
  if (Array.isArray(data)) data.slice(0, sloty.length).forEach((s, i) => { sloty[i] = s && PREDMETY[s.typ] ? s : null; });
}
export function vyber(i) { vybrany = i; zmena(); }
export function prepniBatoh(stav = !otvoreny) { otvoreny = stav; vykresli(); return otvoreny; }
function zmena() { vykresli(); priZmene(); }

// ---------- obrazovka ----------
const $ = id => document.getElementById(id);
const policko = (s, i) => `<div class="slot${i === vybrany ? ' vybrany' : ''}" data-i="${i}"${s ? ` title="${PREDMETY[s.typ].meno} – ${PREDMETY[s.typ].popis}"` : ''}>`
  + (i < 8 ? `<span class="cislo">${i + 1}</span>` : '')
  + (s ? `<span class="ikona">${PREDMETY[s.typ].ikona}</span><span class="pocet">${s.pocet}</span>` : '') + '</div>';

export function vykresli() {
  $('lista').innerHTML = sloty.slice(0, 8).map(policko).join('');
  $('batoh').style.display = otvoreny ? 'flex' : 'none';
  if (!otvoreny) return;
  $('batoh-mriezka').innerHTML = sloty.map(policko).join('');
  $('vyroba').innerHTML = RECEPTY.length ? RECEPTY.map((r, i) => {
    const p = PREDMETY[r.vysledok[0]];
    return `<div class="recept${mozeVyrobit(r) ? '' : ' nedostupny'}" data-r="${i}"><span class="ikona">${p.ikona}</span><div><b>${p.meno}</b><br>`
      + r.suroviny.map(([id, n]) => `<span class="${pocet(id) >= n ? '' : 'chyba'}">${PREDMETY[id].ikona} ${pocet(id)}/${n}</span>`).join(' ') + '</div></div>';
  }).join('') : '<p class="prazdne">Zatiaľ žiadne recepty.<br>Pridávajú sa v <code>src/obsah/recepty.js</code>.</p>';
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
  console.assert(ok.every(Boolean), 'inventar: self-check zlyhal', ok);
  sloty.fill(null);
}
