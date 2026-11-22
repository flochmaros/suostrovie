// Inventar (batoh) + vyroba. Data: 24 policok, prvych 8 = spodna lista (klavesy 1-8).
// Predmety su v obsah/predmety.js, recepty v obsah/recepty.js.
// Batoh (Tab): predmety sa daju presuvat mysou (tahaj a pusti), vpravo je panel vyroby so zalozkami.
// Stavebne menu (B): samostatne okno s kartami stavebnych dielov a taboru (skupiny z STAVBA_SKUPINY).
const STAVBA_SKUPINY = ['Stavba', 'Nábytok', 'Tábor', 'Prístav'];
const zalozka = {};                                // rezim -> zvolena skupina receptov
import { PREDMETY } from './obsah/predmety.js';
import { RECEPTY } from './obsah/recepty.js';
import './ikony3d.js';   // ikony predmetov z 3D modelov (importuje aj obsah/nastroje, jedlo, more...)
import './obsah/nastroje.js';   // registracia nastrojov (aby existovali pred nacitanim/recept)

export const sloty = Array(32).fill(null);       // policko = null alebo { typ, pocet } (nastroj navyse trv = zostavajuca trvanlivost)
let vybrany = 0, otvoreny = false, rezim = 'batoh', sklad = null, skladNazov = '';   // rezim: 'batoh' | 'stavba' | 'lodenica' | 'sklad'
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
  if (r.akcia) { if (r.akcia() === false) return vratit(); }
  else if (pridaj(r.vysledok[0], r.vysledok[1] ?? 1) > 0) return vratit();
  dispatchEvent(new CustomEvent('vyrobene', { detail: r }));   // dennik uloh (ulohy.js)
  return true;
}
// presun z policka a na policko b (rovnaky typ = spoj, inak vymen)
export const presun = (a, b) => presunMedzi(sloty, a, sloty, b);
export function presunMedzi(P, a, Q, b) {         // z pola P policko a do pola Q policko b (batoh <-> sklad lode)
  if ((P === Q && a === b) || !P[a]) return;
  const A = P[a], B = Q[b];
  if (B && B.typ === A.typ && kopa(A.typ) > 1) {
    const k = Math.min(A.pocet, kopa(A.typ) - B.pocet);
    B.pocet += k; A.pocet -= k;
    if (!A.pocet) P[a] = null;
  } else { P[a] = B; Q[b] = A; }
}

// cely stoh z P[a] do Q v rozsahu [od, do): najprv doplni rovnake stohy, potom prazdne policka; zvysok ostane
function prenes(P, a, Q, od, doo) {
  const A = P[a];
  if (!A) return;
  for (let i = od; i < doo && A.pocet; i++) {
    const B = Q[i];
    if (B && B.typ === A.typ && kopa(A.typ) > 1 && B.pocet < kopa(A.typ) && (P !== Q || i !== a)) { const k = Math.min(A.pocet, kopa(A.typ) - B.pocet); B.pocet += k; A.pocet -= k; }
  }
  for (let i = od; i < doo && A.pocet; i++) if (!Q[i]) { Q[i] = { ...A }; A.pocet = 0; }
  if (!A.pocet) P[a] = null;
}
// pravy klik: polovica stohu do prvého prazdneho policka
function rozdel(P, a) {
  const A = P[a], i = P.findIndex(s => !s);
  if (!A || A.pocet < 2 || i < 0) return;
  const k = Math.floor(A.pocet / 2);
  A.pocet -= k; P[i] = { ...A, pocet: k };
}
// zorad batoh: spoj stohy, zvysok (od 8. policka) zoradi podla nazvu predmetu; lista ostane
function zorad() {
  const vsetko = sloty.slice(8).filter(Boolean);
  const vysledok = [];
  for (const s of vsetko) {
    const t = kopa(s.typ) > 1 && vysledok.find(v => v.typ === s.typ && v.pocet < kopa(s.typ));
    if (!t) { vysledok.push(s); continue; }
    const k = Math.min(s.pocet, kopa(s.typ) - t.pocet); t.pocet += k; s.pocet -= k;
    if (s.pocet) vysledok.push(s);
  }
  vysledok.sort((a, b) => a.typ.localeCompare(b.typ));
  for (let i = 8; i < sloty.length; i++) sloty[i] = vysledok[i - 8] ?? null;
}

export const vybranyIndex = () => vybrany;
export const vybranyPredmet = () => sloty[vybrany] ? PREDMETY[sloty[vybrany].typ] : null;
export const jeOtvoreny = () => otvoreny;
export function nacitaj(data) {
  if (Array.isArray(data)) data.slice(0, sloty.length).forEach((s, i) => { sloty[i] = s && PREDMETY[s.typ] ? s : null; if (sloty[i] && trvMax(s.typ) && !(s.trv > 0)) sloty[i].trv = trvMax(s.typ); });
}
export function vyber(i) { vybrany = i; zmena(); }
// rezim 'lodenica' = vpravo recepty lodenice; 'sklad' = vpravo sklad lode (pole policok); inak batoh + bezne recepty
export function prepniBatoh(stav = !otvoreny, r = 'batoh', poleSkladu = null, nazov = '') {
  otvoreny = stav; rezim = otvoreny ? r : 'batoh'; sklad = rezim === 'sklad' ? poleSkladu : null; skladNazov = nazov;
  vykresli(); return otvoreny;
}
export const rezimOkna = () => rezim;
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
const policko = (s, i, z = 'b') => `<div class="slot${z === 'b' && i === vybrany ? ' vybrany' : ''}${z === 'b' && nove.has(i) ? ' pop' : ''}" data-i="${i}" data-z="${z}"${s ? `` : ''}>`
  + (z === 'b' && i < 8 ? `<span class="cislo">${i + 1}</span>` : '')
  + (s ? `<span class="ikona">${PREDMETY[s.typ].ikona}</span>${s.pocet > 1 ? `<span class="pocet">${s.pocet}</span>` : ''}${trvanlivostHtml(s)}` : '') + '</div>';

const jeStavebny = r => STAVBA_SKUPINY.includes(r.skupina);
const surovinyHtml = r => `<div class="suroviny">` + r.suroviny.map(([id, c]) => `<span class="${pocet(id) >= c ? 'ma' : 'chyba'}">${ikonaPredmetu(id)} ${Math.min(pocet(id), c)}/${c}</span>`).join('') + '</div>';
const stavHtml = r => {
  if (r.stavba && r.vysledok && pocet(r.vysledok[0])) return '<div class="stav">Kliknutím umiestniš (z batohu)</div>';
  if (mozeVyrobit(r)) return `<div class="stav">Kliknutím ${r.stavba ? 'umiestniš' : 'vyrobíš'}</div>`;
  const chyba = r.suroviny.filter(([id, n]) => pocet(id) < n);
  return chyba.length ? `<div class="stav chybaj">Chýba: ${chyba.map(([id, c]) => `${c - pocet(id)}× ${PREDMETY[id]?.meno ?? id}`).join(', ')}</div>` : '';
};
// recepty (index) pre aktualny rezim, zoskupene podla skupiny
function receptySkupiny() {
  const skupiny = new Map();
  RECEPTY.forEach((r, i) => {
    if (!jeDostupny(r) || !!r.lodenica !== (rezim === 'lodenica')) return;
    if (rezim !== 'lodenica' && jeStavebny(r) !== (rezim === 'stavba')) return;
    const k = r.skupina || 'Ostatné';
    if (!skupiny.has(k)) skupiny.set(k, []);
    skupiny.get(k).push(i);
  });
  return rezim === 'stavba' ? new Map([...skupiny].sort((a, b) => STAVBA_SKUPINY.indexOf(a[0]) - STAVBA_SKUPINY.indexOf(b[0]))) : skupiny;
}
function zalozkyHtml(skupiny) {
  if (!skupiny.has(zalozka[rezim])) zalozka[rezim] = [...skupiny.keys()][0];
  return skupiny.size < 2 ? '' : [...skupiny.keys()].map(k => `<span class="zalozka${k === zalozka[rezim] ? ' aktivna' : ''}" data-zalozka="${k}">${k}</span>`).join('');
}
function receptyHtml(skupiny) {
  if (!skupiny.size) return '<p class="prazdne">Zatiaľ žiadne recepty.<br>Pridávajú sa v <code>src/obsah/recepty.js</code>.</p>';
  return skupiny.get(zalozka[rezim]).map(i => {
    const r = RECEPTY[i], p = r.vysledok ? PREDMETY[r.vysledok[0]] : null;
    const ok = mozeVyrobit(r), n = r.vysledok?.[1] ?? 1;
    return `<div class="recept${ok ? ' moze' : ' nedostupny'}" data-r="${i}"><span class="ikona">${r.ikona ?? p?.ikona ?? '?'}</span><div class="telo"><b>${r.meno ?? p?.meno ?? r.id}${n > 1 ? ` ×${n}` : ''}</b>`
      + surovinyHtml(r) + stavHtml(r) + '</div></div>';
  }).join('');
}
function karty(skupiny) {
  return skupiny.get(zalozka[rezim]).map(i => {
    const r = RECEPTY[i], p = r.vysledok ? PREDMETY[r.vysledok[0]] : null;
    const ma = p ? pocet(p.id) : 0, ok = mozeVyrobit(r) || (r.stavba && ma > 0);
    return `<div class="karta${ok ? ' moze' : ' nedostupny'}" data-r="${i}"><span class="velka">${r.ikona ?? p?.ikona ?? '?'}</span><b>${r.meno ?? p?.meno ?? r.id}</b>`
      + ((r.popis ?? p?.popis) ? `<div class="popis">${r.popis ?? p.popis}</div>` : '') + surovinyHtml(r) + stavHtml(r) + (ma ? `<div class="mas">V batohu: ${ma}</div>` : '') + '</div>';
  }).join('');
}

export function vykresli() {
  $('lista').innerHTML = sloty.slice(0, 8).map((s, i) => policko(s, i)).join('');
  nove.clear();
  $('batoh').style.display = otvoreny && rezim !== 'stavba' ? 'flex' : 'none';
  $('stavba').style.display = otvoreny && rezim === 'stavba' ? 'flex' : 'none';
  const z = Math.min(1, innerWidth / 1200, innerHeight / 780);   // male okno = zmensi menu
  $('batoh').style.zoom = $('stavba').style.zoom = z;
  if (!otvoreny) return;
  if (rezim === 'stavba') {
    const sk = receptySkupiny();
    $('stavba-tabs').innerHTML = zalozkyHtml(sk);
    $('stavba-zoznam').innerHTML = sk.size ? karty(sk) : '<p class="prazdne">Zatiaľ nič na stavanie.</p>';
    $('stavba-pata').innerHTML = 'Klikni na stavbu → mierením vyberieš miesto, <kbd>koliesko</kbd>/<kbd>Q</kbd> otáča, <kbd>klik</kbd> postaví, <kbd>pravý klik</kbd> zruší. Suroviny sa minú až pri postavení.';
    return;
  }
  $('batoh-mriezka').innerHTML = sloty.map((s, i) => policko(s, i)).join('');
  if (!$('detail').firstChild) $('detail').innerHTML = '<span class="tichy">Prejdi myšou na predmet pre popis.</span>';
  $('stlpec2').style.display = rezim === 'sklad' ? 'none' : 'flex';
  $('sklad-box').style.display = rezim === 'sklad' ? 'block' : 'none';
  $('vyroba-nazov').textContent = rezim === 'lodenica' ? 'Lodenica' : 'Výroba';
  if (rezim === 'sklad') { $('sklad-nazov').textContent = skladNazov; $('sklad-mriezka').innerHTML = sklad.map((s, i) => policko(s, i, 's')).join(''); }
  else { const sk = receptySkupiny(); $('vyroba-tabs').innerHTML = zalozkyHtml(sk); $('vyroba').innerHTML = receptyHtml(sk); }
}

export function initInventar(onZmena) {
  priZmene = onZmena;
  let tahany = null;
  const duch = $('duch');
  addEventListener('contextmenu', e => { if (e.target.closest('#batoh')) e.preventDefault(); });
  addEventListener('pointerdown', e => {
    if (e.target.closest('#zorad')) { zorad(); zmena(); return; }
    const s = e.target.closest('#batoh .slot');
    const P = s && (s.dataset.z === 's' ? sklad : sloty);
    if (!s || !P?.[+s.dataset.i]) return;
    if (e.button === 2) { rozdel(P, +s.dataset.i); zmena(); return; }          // pravy klik = polovica stohu do prazdneho policka
    if (e.shiftKey) {                                                           // Shift+klik = rychly presun
      const i = +s.dataset.i;
      if (P === sklad) prenes(P, i, sloty, 0, sloty.length);                    // sklad -> batoh
      else if (sklad) prenes(P, i, sklad, 0, sklad.length);                     // batoh -> sklad
      else prenes(P, i, sloty, i < 8 ? 8 : 0, i < 8 ? sloty.length : 8);        // lista <-> zvysok batoha
      zmena(); return;
    }
    tahany = { P, i: +s.dataset.i };
    duch.innerHTML = PREDMETY[P[tahany.i].typ].ikona;
    duch.style.display = 'block';
    duch.style.left = e.clientX + 'px'; duch.style.top = e.clientY + 'px';
  });
  addEventListener('pointermove', e => { if (tahany !== null) { duch.style.left = e.clientX + 'px'; duch.style.top = e.clientY + 'px'; } });
  addEventListener('pointerup', e => {
    if (tahany === null) return;
    const s = document.elementFromPoint(e.clientX, e.clientY)?.closest('.slot');
    if (s) presunMedzi(tahany.P, tahany.i, s.dataset.z === 's' ? sklad : sloty, +s.dataset.i);
    tahany = null; duch.style.display = 'none';
    zmena();
  });
  addEventListener('click', e => {
    const z = e.target.closest('.zalozka');
    if (z) { zalozka[rezim] = z.dataset.zalozka; vykresli(); return; }
    const r = e.target.closest('.recept, .karta');
    if (!r) return;
    const rec = RECEPTY[+r.dataset.r];
    if (rezim === 'stavba' && rec.stavba) {           // stavba: nevyrabi sa, zacne umiestnovanie (main.js + stavba.js)
      if (mozeVyrobit(rec) || (rec.vysledok && pocet(rec.vysledok[0]))) dispatchEvent(new CustomEvent('stavaj', { detail: rec }));
      return;
    }
    if (!vyrob(rec)) return;
    if (rezim === 'stavba' && rec.vysledok) { const id = rec.vysledok[0]; let i = sloty.findIndex((s, k) => k < 8 && s?.typ === id); if (i < 0) { i = vybrany; presun(sloty.findIndex(s => s?.typ === id), i); } vybrany = i; }   // vyrobeny diel rovno do ruky
    zmena();
  });
  addEventListener('pointerover', e => {            // popis predmetu pod mriezkou batoha
    const s = e.target.closest?.('#batoh .slot');
    if (!s) return;
    const o = (s.dataset.z === 's' ? sklad : sloty)?.[+s.dataset.i], p = o && PREDMETY[o.typ];
    $('detail').innerHTML = o ? `<b>${p.ikona} ${p.meno}</b>${o.pocet > 1 ? ` ×${o.pocet}` : ''}<br>${p.popis ?? ''}${trvMax(o.typ) ? ` <i>(trvanlivosť ${o.trv ?? trvMax(o.typ)}/${trvMax(o.typ)})</i>` : ''}` : '<span class="tichy">Prázdne políčko</span>';
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
