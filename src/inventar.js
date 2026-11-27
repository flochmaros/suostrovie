// Inventar (batoh) + vyroba. Data: 32 policok, prvych 8 = spodna lista (klavesy 1-8).
// Predmety su v obsah/predmety.js, recepty v obsah/recepty.js.
// Batoh (Tab): karty Batoh | Vyroba | Postava (Q/E). Predmety sa daju presuvat mysou (tahaj a pusti).
// Vyroba = 3D podlozka + kniha receptov (vyroba.js, podlozka.js). Odomykanie: recepty_odomknute.js.
// Stavebne menu (B): samostatne okno s kartami stavebnych dielov a taboru (skupiny z STAVBA_SKUPINY).
export const STAVBA_SKUPINY = ['Stavba', 'Nábytok', 'Tábor', 'Prístav'];
const zalozka = {};                                // rezim -> zvolena skupina receptov
let karta = 'batoh';                               // karta batohu
import { PREDMETY } from './obsah/predmety.js';
import { RECEPTY } from './obsah/recepty.js';
import './ikony3d.js';   // ikony predmetov z 3D modelov (importuje aj obsah/nastroje, jedlo, more...)
import './obsah/nastroje.js';   // registracia nastrojov (aby existovali pred nacitanim/recept)
import { jeOdomknuty, skontrolujRecepty, jeStanicaBlizko, menoReceptu, ikonaReceptu, napovedaReceptu, STANICE } from './recepty_odomknute.js';
import { initVyroba, vykresliVyrobu, zavriVyrobu } from './vyroba.js';

export const sloty = Array(32).fill(null);       // policko = null alebo { typ, pocet } (nastroj navyse trv = zostavajuca trvanlivost)
let vybrany = 0, otvoreny = false, rezim = 'batoh', sklad = null, skladNazov = '';   // rezim: 'batoh' | 'stavba' | 'lodenica' | 'sklad'
let priZmene = () => {};                          // volane po kazdej zmene (napr. predmet v ruke, zvuk)
const kopa = id => PREDMETY[id]?.kopa ?? 20;
const trvMax = id => PREDMETY[id]?.nastroj?.trvanlivost ?? PREDMETY[id]?.horenie ?? 0;   // trvanlivost nastroja / sekundy horenia fakle; 0 = nic

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
export const mozeVyrobit = r => jeDostupny(r) && (!r.id || (jeOdomknuty(r) && jeStanicaBlizko(r.stanica))) && r.suroviny.every(([id, n]) => pocet(id) >= n);
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
const menoPredmetu = id => PREDMETY[id]?.meno ?? id;
const trvanlivostHtml = s => {
  const max = trvMax(s.typ);
  if (!max || s.trv == null) return '';
  const q = Math.max(0, Math.min(1, s.trv / max));
  return `<span class="trv"><i style="width:${Math.round(q * 100)}%;background:hsl(${Math.round(q * 120)} 75% 52%)"></i></span>`;
};
const policko = (s, i, z = 'b') => `<div class="slot${z === 'b' && i === vybrany ? ' vybrany' : ''}${z === 'b' && nove.has(i) ? ' pop' : ''}" data-i="${i}" data-z="${z}">`
  + (z === 'b' && i < 8 ? `<span class="cislo">${i + 1}</span>` : '')
  + (s ? `<span class="ikona">${PREDMETY[s.typ].ikona}</span>${s.pocet > 1 ? `<span class="pocet">${s.pocet}</span>` : ''}${trvanlivostHtml(s)}` : '') + '</div>';

const jeStavebny = r => STAVBA_SKUPINY.includes(r.skupina);
// recepty (index) pre aktualny rezim, zoskupene podla skupiny; zamknute su na konci skupiny
function receptySkupiny() {
  const skupiny = new Map();
  RECEPTY.forEach((r, i) => {
    if (!jeDostupny(r) || !!r.lodenica !== (rezim === 'lodenica')) return;
    if (rezim !== 'lodenica' && jeStavebny(r) !== (rezim === 'stavba')) return;
    const k = r.skupina || 'Ostatné';
    if (!skupiny.has(k)) skupiny.set(k, []);
    skupiny.get(k).push(i);
  });
  for (const z of skupiny.values()) z.sort((a, b) => jeOdomknuty(RECEPTY[b]) - jeOdomknuty(RECEPTY[a]) || a - b);
  return rezim === 'stavba' ? new Map([...skupiny].sort((a, b) => STAVBA_SKUPINY.indexOf(a[0]) - STAVBA_SKUPINY.indexOf(b[0]))) : skupiny;
}
function zalozkyHtml(skupiny) {
  if (!skupiny.has(zalozka[rezim])) zalozka[rezim] = [...skupiny.keys()][0];
  return [...skupiny].map(([k, z]) => `<span class="zalozka${k === zalozka[rezim] ? ' aktivna' : ''}" data-zalozka="${k}">${k}<small>${z.filter(i => jeOdomknuty(RECEPTY[i])).length}/${z.length}</small></span>`).join('');
}

// ---------- stavebne menu (B): karty ----------
const surovinyHtml = r => `<div class="suroviny">` + r.suroviny.map(([id, c]) => `<span class="${pocet(id) >= c ? 'ma' : 'chyba'}">${ikonaPredmetu(id)} ${Math.min(pocet(id), c)}/${c}</span>`).join('') + '</div>';
const stavHtml = r => {
  if (r.vysledok && pocet(r.vysledok[0])) return '<div class="stav">Kliknutím umiestniš (z batohu)</div>';
  if (mozeVyrobit(r)) return '<div class="stav">Kliknutím umiestniš</div>';
  const chyba = r.suroviny.filter(([id, n]) => pocet(id) < n);
  return chyba.length ? `<div class="stav chybaj">Chýba: ${chyba.map(([id, c]) => `${c - pocet(id)}× ${menoPredmetu(id)}`).join(', ')}</div>` : '';
};
function karty(zoznam) {
  return zoznam.map(i => {
    const r = RECEPTY[i], p = r.vysledok ? PREDMETY[r.vysledok[0]] : null;
    if (!jeOdomknuty(r)) return `<div class="karta zamknuty"><span class="velka">${ikonaReceptu(r)}</span><b>???</b><div class="popis">💡 ${napovedaReceptu(r)}</div></div>`;
    const ma = p ? pocet(p.id) : 0, ok = mozeVyrobit(r) || (r.stavba && ma > 0);
    return `<div class="karta${ok ? ' moze' : ' nedostupny'}" data-r="${i}"><span class="velka">${ikonaReceptu(r)}</span><b>${menoReceptu(r)}</b>`
      + ((r.popis ?? p?.popis) ? `<div class="popis">${r.popis ?? p.popis}</div>` : '') + surovinyHtml(r) + stavHtml(r) + (ma ? `<div class="mas">V batohu: ${ma}</div>` : '') + '</div>';
  }).join('');
}

const stavStanic = () => Object.keys(STANICE).map(k => +jeStanicaBlizko(k)).join('');
let poslStanice = '';
export function vykresli() {
  skontrolujRecepty(sloty);                       // nove suroviny -> nove recepty (nacrt sa pritom spotrebuje)
  $('lista').innerHTML = sloty.slice(0, 8).map((s, i) => policko(s, i)).join('');
  nove.clear();
  $('batoh').style.display = otvoreny && rezim !== 'stavba' ? 'flex' : 'none';
  $('stavba').style.display = otvoreny && rezim === 'stavba' ? 'flex' : 'none';
  $('stavba').style.zoom = Math.min(1, innerWidth / 1200, innerHeight / 780);   // male okno = zmensi menu
  $('batoh').style.zoom = Math.min(1, innerWidth / 1100, innerHeight / 780);
  ukazTip(null);
  document.body.classList.toggle('v-okne', otvoreny);   // minimapa sa pod oknom schova
  if (!otvoreny || rezim === 'stavba' || (rezim === 'batoh' && karta !== 'vyroba') || rezim === 'sklad') zavriVyrobu();
  if (!otvoreny) return;
  if (rezim === 'stavba') {
    const sk = receptySkupiny();
    $('stavba-tabs').innerHTML = zalozkyHtml(sk);
    $('stavba-zoznam').innerHTML = sk.size ? karty(sk.get(zalozka[rezim])) : '<p class="prazdne">Zatiaľ nič na stavanie.</p>';
    $('stavba-pata').innerHTML = 'Klikni na stavbu → mierením vyberieš miesto, <kbd>koliesko</kbd>/<kbd>Q</kbd> otáča, <kbd>klik</kbd> postaví, <kbd>pravý klik</kbd> zruší. Suroviny sa minú až pri postavení.';
    return;
  }
  const pohlad = rezim === 'batoh' ? karta : rezim;     // batoh | vyroba | postava | sklad | lodenica
  $('batoh').dataset.pohlad = pohlad;
  document.querySelectorAll('#batoh-karty [data-karta]').forEach(e => e.classList.toggle('aktivna', e.dataset.karta === karta));
  $('batoh-nadpis').textContent = rezim === 'lodenica' ? 'Lodenica' : rezim === 'sklad' ? 'Batoh a sklad' : '';
  $('batoh-mriezka').innerHTML = sloty.map((s, i) => policko(s, i)).join('');
  if (pohlad === 'sklad') { $('sklad-nazov').textContent = skladNazov; $('sklad-mriezka').innerHTML = sklad.map((s, i) => policko(s, i, 's')).join(''); }
  if (pohlad === 'vyroba' || pohlad === 'lodenica') {
    poslStanice = stavStanic();
    const sk = receptySkupiny();
    $('vyroba-tabs').innerHTML = zalozkyHtml(sk);
    vykresliVyrobu(pohlad, sk.get(zalozka[rezim]) ?? []);
  }
}

// otvori batoh rovno na karte Vyroba (E pri ponku / dielni)
export function otvorVyrobu() { karta = 'vyroba'; prepniBatoh(true, 'batoh'); }
const KARTY = ['batoh', 'vyroba', 'postava'];
function prepniKartu(k) { karta = k; vykresli(); }

// ---------- tooltip predmetu ----------
const maxJedla = k => Math.max(1, ...Object.values(PREDMETY).map(p => p.jedlo?.[k] ?? 0));
const pasik = (meno, hodnota, q, farba) => `<div class="tip-pas"><span>${meno}</span><i><u style="width:${Math.round(Math.max(0, Math.min(1, q)) * 100)}%;background:${farba}"></u></i><b>${hodnota}</b></div>`;
function tipHtml(o) {
  const p = PREDMETY[o.typ], max = trvMax(o.typ);
  let h = `<div class="tip-hlava"><span class="ikona">${p.ikona}</span><div><b class="tema-nadpis">${p.meno}</b>${o.pocet > 1 ? `<small>${o.pocet} ks</small>` : ''}</div></div>`;
  if (p.jedlo) {
    if (p.jedlo.sytost) h += pasik('Sýtosť', (p.jedlo.sytost > 0 ? '+' : '') + p.jedlo.sytost, p.jedlo.sytost / maxJedla('sytost'), '#e0852a');
    if (p.jedlo.voda) h += pasik('Voda', (p.jedlo.voda > 0 ? '+' : '') + p.jedlo.voda, p.jedlo.voda / maxJedla('voda'), '#3a9ad8');
  }
  if (max) {
    const t = Math.ceil(o.trv ?? max), j = p.horenie ? ' s' : '';
    h += pasik(p.horenie ? 'Horenie' : 'Trvanlivosť', `${t}/${max}${j}`, t / max, `hsl(${Math.round(t / max * 120)} 65% 45%)`);
  }
  if (p.popis) h += `<p>${p.popis}${o.zhas ? ' <i>(zhasnutá)</i>' : ''}</p>`;
  if (p.jedlo) h += '<small class="tip-rada">Vyber v lište a stlač <kbd>F</kbd></small>';
  return h;
}
function ukazTip(o, x, y) {
  const t = $('tip');
  if (!t) return;
  if (!o) { t.style.display = 'none'; return; }
  t.innerHTML = tipHtml(o); t.style.display = 'block';
  polohaTipu(x, y);
}
function polohaTipu(x, y) {
  const t = $('tip');
  t.style.left = Math.max(8, x + 18 + t.offsetWidth > innerWidth ? x - t.offsetWidth - 18 : x + 18) + 'px';
  t.style.top = Math.max(8, Math.min(y + 12, innerHeight - t.offsetHeight - 8)) + 'px';
}

export function initInventar(onZmena) {
  priZmene = onZmena;
  initVyroba();
  let tahany = null;
  const duch = $('duch');
  addEventListener('contextmenu', e => { if (e.target.closest('#batoh')) e.preventDefault(); });
  // Q / E prepinaju karty batohu; v tom case sa klavesa neposiela hre (E by inak zbieralo veci)
  addEventListener('keydown', e => {
    if (!otvoreny || rezim !== 'batoh' || (e.code !== 'KeyQ' && e.code !== 'KeyE') || /INPUT|TEXTAREA/.test(e.target.tagName ?? '')) return;
    e.stopImmediatePropagation();
    if (!e.repeat) prepniKartu(KARTY[(KARTY.indexOf(karta) + (e.code === 'KeyE' ? 1 : 2)) % 3]);
  }, true);
  addEventListener('pointerdown', e => {
    if (e.target.closest('#zorad')) { zorad(); zmena(); return; }
    const s = e.target.closest('#batoh .slot');
    const P = s && (s.dataset.z === 's' ? sklad : sloty);
    if (!s || !P?.[+s.dataset.i]) return;
    ukazTip(null);
    const vyb = P === sloty && PREDMETY[P[+s.dataset.i].typ].vybava;           // nositelny kus (brnenie...) -> nasadit na postavu
    if (vyb && (e.button === 2 || e.shiftKey)) { dispatchEvent(new CustomEvent('nasad', { detail: { id: P[+s.dataset.i].typ } })); return; }
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
  addEventListener('pointermove', e => {
    if (tahany !== null) { duch.style.left = e.clientX + 'px'; duch.style.top = e.clientY + 'px'; }
    else if ($('tip')?.style.display === 'block') polohaTipu(e.clientX, e.clientY);
  });
  addEventListener('pointerup', e => {
    if (tahany === null) return;
    const pod = document.elementFromPoint(e.clientX, e.clientY);
    const ek = pod?.closest('[data-ekv], #postava-plat');
    if (ek && tahany.P === sloty && PREDMETY[sloty[tahany.i]?.typ]?.vybava) dispatchEvent(new CustomEvent('naVybavu', { detail: { id: sloty[tahany.i].typ, slot: ek.dataset.ekv } }));
    const s = pod?.closest('.slot');
    if (s) presunMedzi(tahany.P, tahany.i, s.dataset.z === 's' ? sklad : sloty, +s.dataset.i);
    tahany = null; duch.style.display = 'none';
    zmena();
  });
  addEventListener('click', e => {
    const k = e.target.closest('#batoh-karty [data-karta]');
    if (k) { prepniKartu(k.dataset.karta); return; }
    const z = e.target.closest('.zalozka[data-zalozka]');
    if (z) { zalozka[rezim] = z.dataset.zalozka; vykresli(); return; }
    const r = e.target.closest('.karta[data-r]');
    if (!r || rezim !== 'stavba') return;
    const rec = RECEPTY[+r.dataset.r];
    if (rec.stavba) {                                 // stavba: nevyrabi sa, zacne umiestnovanie (main.js + stavba.js)
      if (mozeVyrobit(rec) || (rec.vysledok && pocet(rec.vysledok[0]))) dispatchEvent(new CustomEvent('stavaj', { detail: rec }));
      return;
    }
    if (!vyrob(rec)) return;
    if (rec.vysledok) { const id = rec.vysledok[0]; let i = sloty.findIndex((s, k) => k < 8 && s?.typ === id); if (i < 0) { i = vybrany; presun(sloty.findIndex(s => s?.typ === id), i); } vybrany = i; }   // vyrobeny diel rovno do ruky
    zmena();
  });
  addEventListener('pointerover', e => {            // tooltip predmetu pri mysi
    const s = tahany === null && e.target.closest?.('#batoh .slot, #lista .slot');
    const o = s && otvoreny && (s.dataset.z === 's' ? sklad : sloty)?.[+s.dataset.i];
    ukazTip(o || null, e.clientX, e.clientY);
  });
  // suroviny mohli pribudnut aj bez prekreslenia; pri otvorenej vyrobe sleduj aj vzdialenost k ponku/dielni
  setInterval(() => {
    if (skontrolujRecepty(sloty)) zmena();
    else if (otvoreny && (karta === 'vyroba' && rezim === 'batoh') && stavStanic() !== poslStanice) vykresli();
  }, 500);
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
