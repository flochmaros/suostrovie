// Manualna vyroba: suroviny z batohu sa kladu na 3D podlozku (podlozka.js), ta rozpozna recept podla mnozstiev.
// Vpravo je kniha receptov – klik na recept poskladá suroviny sam. Vyraba sa podrzanim tlacidla.
// Suroviny sa z batohu odoberu az po dokonceni animacie (dovtedy su na podlozke len "naoko").
import { PREDMETY } from './obsah/predmety.js';
import { RECEPTY } from './obsah/recepty.js';
import { pocet, vyrob, mozeVyrobit, jeDostupny, obnov, STAVBA_SKUPINY } from './inventar.js';
import { jeOdomknuty, jeStanicaBlizko, menoReceptu, ikonaReceptu, napovedaReceptu, objavRecept, STANICE } from './recepty_odomknute.js';
import * as P from './podlozka.js';
import { zvuky } from './zvuk.js';

const $ = id => document.getElementById(id);
const podlozka = new Map();            // id predmetu -> kolko kusov lezi na podlozke
let rezim = null;                      // 'vyroba' | 'lodenica' (null = okno zatvorene)
let recepty = [];                      // indexy receptov aktualnej zalozky knihy
let vybrany = null;                    // index receptu vybraneho v knihe / medzi zhodami
let nasobok = 1;                       // kolko naraz vyrobit (1 | 5 | 'max')
let zhoda = null;                      // recept, ktory prave lezi na podlozke (odomknuty)
let sprava = null;                     // kratka sprava po vyrobe { text, do }

const meno = id => PREDMETY[id]?.meno ?? id;
const ikona = id => PREDMETY[id]?.ikona ?? '?';

// suroviny receptu ako mapa id -> pocet (recept moze mat rovnaku surovinu dvakrat)
const potreby = r => r.suroviny.reduce((m, [id, n]) => m.set(id, (m.get(id) ?? 0) + n), new Map());
const vRezime = r => jeDostupny(r) && (rezim === 'lodenica' ? !!r.lodenica : !r.lodenica && !jeStavebny(r));
const jeStavebny = r => STAVBA_SKUPINY.includes(r.skupina);       // tie su v stavebnom menu (B)
const rovnake = (a, b) => a.size === b.size && [...a].every(([id, n]) => b.get(id) === n);
const jePodmnozina = (a, b) => [...a].every(([id, n]) => (b.get(id) ?? 0) >= n);
const chybaDo = (r) => [...potreby(r)].map(([id, n]) => [id, n - (podlozka.get(id) ?? 0)]).filter(([, n]) => n > 0);
const zoznamVeci = z => z.map(([id, n]) => `<span class="vy-vec">${n}× <span class="ikona">${ikona(id)}</span> ${meno(id)}</span>`).join(' ');

const kolkoDaSa = r => (mozeVyrobit(r) ? (r.akcia ? 1 : Math.min(99, ...[...potreby(r)].map(([id, n]) => Math.floor(pocet(id) / n)))) : 0);
const kolkoVyrobit = r => Math.min(kolkoDaSa(r), nasobok === 'max' ? 99 : nasobok);

// ---------- kladenie na podlozku ----------
function zvukDopadu(id) { return () => zvuky.polozit(id); }
function poloz(id, n = 1, bod = null, oneskorenie = 0) {
  if (P.jeAnimacia()) return;
  const mam = pocet(id) - (podlozka.get(id) ?? 0);
  n = Math.min(n, mam);
  if (n <= 0) return;
  if (!podlozka.has(id) && podlozka.size >= 8) return;
  podlozka.set(id, (podlozka.get(id) ?? 0) + n);
  sprava = null;
  P.nastavKusy(id, podlozka.get(id), { bod, oneskorenie, naDopad: zvukDopadu(id) });
}
function vezmi(id, n = 1) {
  if (P.jeAnimacia() || !podlozka.has(id)) return;
  const k = podlozka.get(id) - n;
  if (k > 0) podlozka.set(id, k); else podlozka.delete(id);
  P.nastavKusy(id, Math.max(0, k));
  zvuky.vratit();
}
function vyprazdni() { podlozka.clear(); P.vycisti(); }
// klik na recept v knihe: poskladá, co treba (ak nieco chyba, polozi aspon to, co mas)
function posklad(r) {
  const ciel = new Map([...potreby(r)].map(([id, n]) => [id, Math.min(n, pocet(id))]).filter(([, n]) => n > 0));
  if (rovnake(ciel, podlozka)) return;
  vyprazdni(); sprava = null;
  let i = 0;
  for (const [id, n] of ciel) { poloz(id, n, null, i * 0.16); i++; }
}

// ---------- rozpoznanie receptu ----------
function vyhodnot() {
  const kandidati = RECEPTY.map((r, i) => i).filter(i => vRezime(RECEPTY[i]));
  if (!podlozka.size) return { stav: 'prazdna' };
  const presne = kandidati.filter(i => rovnake(potreby(RECEPTY[i]), podlozka));
  // objav experimentom: spravna kombinacia zamknuteho receptu, ktoreho klucovu surovinu uz mas
  for (const i of presne) {
    const r = RECEPTY[i];
    if (!jeOdomknuty(r) && r.kluc && pocet(r.kluc) > 0 && objavRecept(r)) { vybrany = i; setTimeout(() => oslava(r), 450); }
  }
  const zname = presne.filter(i => jeOdomknuty(RECEPTY[i]));
  if (zname.length) {
    if (!zname.includes(vybrany)) vybrany = zname.find(i => mozeVyrobit(RECEPTY[i])) ?? zname[0];
    return { stav: 'zhoda', i: vybrany, dalsie: zname };
  }
  if (presne.length) return { stav: 'tajne' };
  const blizke = kandidati.filter(i => jeOdomknuty(RECEPTY[i]) && jePodmnozina(podlozka, potreby(RECEPTY[i])))
    .sort((a, b) => (b === vybrany) - (a === vybrany) || chybaDo(RECEPTY[a]).reduce((s, x) => s + x[1], 0) - chybaDo(RECEPTY[b]).reduce((s, x) => s + x[1], 0));
  const tusim = kandidati.some(i => { const r = RECEPTY[i]; return !jeOdomknuty(r) && r.kluc && pocet(r.kluc) > 0 && jePodmnozina(podlozka, potreby(r)); });
  if (blizke.length) return { stav: 'chyba', blizke, tusim };
  return { stav: tusim ? 'tusim' : 'nic' };
}

function oslava(r) {
  if (!rezim) return;
  const o = $('vy-oslava');
  o.innerHTML = `<div><small>Objavil si nový recept!</small><span class="ikona">${ikonaReceptu(r)}</span><b>${menoReceptu(r)}</b></div>`;
  o.classList.remove('zapnuta'); void o.offsetWidth; o.classList.add('zapnuta');
  zvuky.objav();
  for (let i = 0; i < 5; i++) setTimeout(() => P.vybuch((Math.random() - 0.5) * 4, 0.4 + Math.random(), (Math.random() - 0.5) * 2, [0xffd45e, 0x6ffff0, 0xff8a6b][i % 3], 40, 2.4), i * 160);
}

// ---------- kreslenie okna ----------
function suroviny() {
  const pouzitelne = new Set(RECEPTY.filter(vRezime).flatMap(r => r.suroviny.map(s => s[0])));
  const mam = [...pouzitelne].filter(id => pocet(id) > 0);
  if (!mam.length) return '<p class="prazdne">V batohu nemáš nič, čo by sa dalo položiť na podložku.</p>';
  return mam.map(id => {
    const zvysok = pocet(id) - (podlozka.get(id) ?? 0);
    return `<div class="vy-sur${zvysok ? '' : ' minuta'}" data-sur="${id}" title="${meno(id)}"><span class="ikona">${ikona(id)}</span><i>${zvysok}</i><b>${meno(id)}</b></div>`;
  }).join('');
}

function zoznamHtml() {
  return recepty.map(i => {
    const r = RECEPTY[i], vyb = i === vybrany ? ' vybraty' : '';
    if (!jeOdomknuty(r)) return `<div class="recept zamknuty${vyb}" data-r="${i}"><span class="ikona">${ikonaReceptu(r)}</span><b>???</b><span class="znak">${r.nacrt ? '📜' : r.objav ? '💡' : '🔒'}</span></div>`;
    const ok = mozeVyrobit(r), n = r.vysledok?.[1] ?? 1;
    return `<div class="recept${ok ? ' moze' : ' nedostupny'}${vyb}" data-r="${i}"><span class="ikona">${ikonaReceptu(r)}</span><b>${menoReceptu(r)}${n > 1 ? ` ×${n}` : ''}</b><span class="znak">${ok ? '✔' : ''}</span></div>`;
  }).join('');
}

function kartaHtml(r) {
  if (!r) return '<p class="popis">Klikni na recept – suroviny sa poskladajú samy.</p>';
  if (!jeOdomknuty(r)) return `<h3 class="tema-nadpis">???</h3><p class="popis">Tento recept ešte nepoznáš.</p><div class="napoveda-receptu">💡 ${napovedaReceptu(r)}</div>`;
  const p = r.vysledok ? PREDMETY[r.vysledok[0]] : null;
  const sur = [...potreby(r)].map(([id, c]) => `<div class="${pocet(id) >= c ? 'ma' : 'chyba'}"><span class="ikona">${ikona(id)}</span><b>${meno(id)}</b><span>${Math.min(pocet(id), 999)}/${c}</span></div>`).join('');
  const kde = r.lodenica ? 'Vyrába sa v lodenici' : r.stanica ? `Treba: ${STANICE[r.stanica]} nablízku ${jeStanicaBlizko(r.stanica) ? '✔' : '✘'}` : 'Vyrobíš kdekoľvek';
  return `<h3 class="tema-nadpis">${menoReceptu(r)}</h3><p class="popis">${r.popis ?? p?.popis ?? ''}</p><div class="suroviny">${sur}</div>`
    + `<div class="kde${r.stanica && !jeStanicaBlizko(r.stanica) ? ' chyba' : ''}">${kde}${p ? ` · v batohu ${pocet(p.id)}` : ''}</div>`;
}

function stanicaHtml(r) {
  if (rezim === 'lodenica') return '<span class="vy-stanica pri">⚓ Lodenica</span>';
  return Object.entries(STANICE).map(([k, m]) => {
    const pri = jeStanicaBlizko(k);
    return `<span class="vy-stanica${pri ? ' pri' : ''}${r?.stanica === k ? (pri ? ' treba' : ' treba chyba') : ''}">${m}: ${pri ? 'si pri nej ✔' : 'ďaleko'}</span>`;
  }).join('');
}

// prekresli vsetko okrem samotnej 3D sceny
function kresli() {
  if (!rezim) return;
  const bezi = P.jeAnimacia();
  const v = bezi ? { stav: 'vyraba' } : vyhodnot();
  if (!bezi) zhoda = v.stav === 'zhoda' ? RECEPTY[v.i] : null;
  const r = zhoda, k = r ? kolkoVyrobit(r) : 0;

  let hlava = '', stav = '', trieda = '';
  if (v.stav === 'zhoda') {
    const n = r.vysledok?.[1] ?? 1;
    hlava = `<b class="tema-nadpis">${menoReceptu(r)}${n > 1 ? ` ×${n}` : ''}</b>` + (r.vysledok && PREDMETY[r.vysledok[0]]?.model ? '' : `<span class="ikona vy-duch-ikona">${ikonaReceptu(r)}</span>`);
    if (r.stanica && !jeStanicaBlizko(r.stanica)) { stav = `🔨 Na toto musíš stáť pri stavbe <b>${STANICE[r.stanica]}</b>. Postavíš ju v stavebnom menu <kbd>B</kbd> → Tábor.`; trieda = 'zle'; }
    else { stav = 'Sedí to! Podrž tlačidlo <b>Vyrobiť</b>.'; trieda = 'dobre'; }
    if (v.dalsie.length > 1) stav += '<div class="vy-volby">' + v.dalsie.map(i => `<span class="vy-volba${i === v.i ? ' aktivna' : ''}" data-volba="${i}">${menoReceptu(RECEPTY[i])}</span>`).join('') + '</div>';
  } else if (v.stav === 'chyba') {
    stav = v.blizke.slice(0, 2).map(i => `<div>Pre <b>${menoReceptu(RECEPTY[i])}</b> pridaj: ${zoznamVeci(chybaDo(RECEPTY[i]))}</div>`).join('') + (v.tusim ? '<div class="vy-tip">💡 Možno z toho bude aj niečo nové…</div>' : '');
  } else if (v.stav === 'tusim') { stav = '💡 Zdá sa, že z tohto niečo bude… skús pridať ďalšie kusy.'; trieda = 'tip'; }
  else if (v.stav === 'tajne') { stav = '📜 Táto kombinácia niečo skrýva, ale chýba ti nákres.'; trieda = 'tip'; }
  else if (v.stav === 'nic') { stav = 'Z tejto kombinácie nič nebude. Skús niečo ubrať (klik na kus).'; trieda = 'zle'; }
  else if (v.stav === 'prazdna') stav = 'Klikni alebo potiahni surovinu na rohož. <kbd>Shift</kbd>+klik položí všetko.';
  else { stav = 'Vyrábam…'; trieda = 'dobre'; hlava = $('vy-nazov').innerHTML; }
  if (sprava && performance.now() < sprava.do && v.stav === 'prazdna') { stav = sprava.text; trieda = sprava.trieda; }

  $('vy-nazov').innerHTML = hlava;
  $('vy-stav').innerHTML = `<div>${stav}</div>`; $('vy-stav').className = trieda;
  $('vy-stanice').innerHTML = stanicaHtml(r);
  const hotove = !bezi && r && mozeVyrobit(r);
  P.nastavDucha(!bezi && r?.vysledok ? r.vysledok[0] : null);
  if (!bezi) P.nastavZiaru(!!r);
  $('drz').disabled = !hotove;
  $('drz').querySelector('b').textContent = bezi ? 'Vyrábam…' : hotove ? `Podrž a vyrob${k > 1 ? ` ${k}×` : ''}` : 'Vyrobiť';
  $('vy-nasobky').innerHTML = rezim === 'lodenica' ? '' : [1, 5, 'max'].map(x => `<span class="nasobok${x === nasobok ? ' aktivny' : ''}" data-n="${x}">${x === 'max' ? 'max' : '×' + x}</span>`).join('');
  $('vy-vycisti').style.visibility = podlozka.size && !bezi ? 'visible' : 'hidden';
  $('vy-stitky').innerHTML = bezi ? '' : P.stitky().map(s => `<span style="left:${Math.round(s.x)}px;top:${Math.round(s.y)}px">${meno(s.id)}${s.pocet > 1 ? ` <i>×${s.pocet}</i>` : ''}</span>`).join('');
  $('vy-suroviny').innerHTML = suroviny();
  $('vyroba').innerHTML = recepty.length ? zoznamHtml() : '<p class="prazdne">Zatiaľ žiadne recepty.</p>';
  $('karta-receptu').innerHTML = kartaHtml(vybrany != null ? RECEPTY[vybrany] : null);
}

// vola inventar.js pri kazdom prekresleni okna; indexy = recepty zvolenej zalozky
export function vykresliVyrobu(novyRezim, indexy) {
  if (rezim !== novyRezim) { zavriVyrobu(); rezim = novyRezim; vybrany = null; }
  recepty = indexy;
  P.otvorPodlozku($('vy-platno'));
  if (!P.jeAnimacia()) for (const [id, n] of podlozka) {        // keby surovin v batohu medzitym ubudlo
    const m = Math.min(n, pocet(id));
    if (m !== n) { if (m) podlozka.set(id, m); else podlozka.delete(id); P.nastavKusy(id, m); }
  }
  kresli();
}
export function zavriVyrobu() {
  if (!rezim) return;
  zrusDrzanie(); P.zavriPodlozku(); podlozka.clear(); zhoda = null; sprava = null; rezim = null;
  $('vy-oslava').classList.remove('zapnuta'); $('vy-blesk').classList.remove('zapnuty');
}

// ---------- vyroba: podrzanie tlacidla -> animacia -> az potom sa minu suroviny ----------
const DRZANIE = 600;                             // ms
let drzanie = null;                              // { od, tuk, casovac }
function zrusDrzanie() {
  if (!drzanie) return;
  clearTimeout(drzanie.casovac);
  drzanie = null;
  $('drz')?.style.removeProperty('--k');
}
function zacniDrzanie() {
  zrusDrzanie();
  drzanie = { od: performance.now(), tuk: 0, casovac: setTimeout(spusti, DRZANIE) };   // casovac: funguje aj pri nizkych FPS
  requestAnimationFrame(tikDrzania);
}
function tikDrzania() {                          // len plniaci sa kruh a tukanie
  if (!drzanie) return;
  const k = Math.min(1, (performance.now() - drzanie.od) / DRZANIE);
  $('drz').style.setProperty('--k', k);
  if (k >= drzanie.tuk) { zvuky.drzanie(k); drzanie.tuk += 0.2; }
  if (k < 1) requestAnimationFrame(tikDrzania);
}
function spusti() {
  zrusDrzanie();
  const r = zhoda;
  if (!r || !mozeVyrobit(r)) return;
  const n = kolkoVyrobit(r);
  const blesk = $('vy-blesk');
  const spustene = P.spustiVyrobu({
    vysledok: r.vysledok?.[0] ?? null,
    naUder: i => zvuky.tuk(i),
    naZablesk: () => {
      blesk.classList.remove('zapnuty'); void blesk.offsetWidth; blesk.classList.add('zapnuty');
      zvuky.zablesk();
      $('vy-nazov').innerHTML = `<b class="tema-nadpis vy-hotovo">${menoReceptu(r)}${n * (r.vysledok?.[1] ?? 1) > 1 ? ` ×${n * (r.vysledok?.[1] ?? 1)}` : ''}</b>`
        + (r.vysledok && PREDMETY[r.vysledok[0]]?.model ? '' : `<span class="ikona vy-hotova-ikona">${ikonaReceptu(r)}</span>`);
    },
    naLet: () => zvuky.zober(),
    naKoniec: () => dokonci(r, n),
  });
  if (!spustene) dokonci(r, n);                  // bez WebGL: vyrob hned
  else kresli();
}
function dokonci(r, n) {
  podlozka.clear(); zhoda = null;
  let hotovo = 0;
  while (hotovo < n && vyrob(r)) hotovo++;
  if (hotovo) {
    zvuky.vyroba();
    sprava = { text: `✔ ${menoReceptu(r)}${hotovo * (r.vysledok?.[1] ?? 1) > 1 ? ` ×${hotovo * (r.vysledok?.[1] ?? 1)}` : ''} – hotovo!`, trieda: 'dobre', do: performance.now() + 4000 };
  } else sprava = { text: r.akcia ? 'Teraz sa to nedá dokončiť. Suroviny ti ostali.' : 'V batohu nie je miesto. Suroviny ti ostali.', trieda: 'zle', do: performance.now() + 4000 };
  obnov();
}

// ---------- mys ----------
export function initVyroba() {
  let tah = null;                                // { id, x, y }
  const duch = $('duch');
  addEventListener('pointerdown', e => {
    if (!rezim) return;
    if (e.target.closest('#drz')) { if (!$('drz').disabled && e.button === 0) zacniDrzanie(); return; }
    const s = e.target.closest('.vy-sur');
    if (s) {
      const id = s.dataset.sur;
      if (e.button === 2) { vezmi(id); kresli(); return; }
      tah = { id, x: e.clientX, y: e.clientY };
      duch.innerHTML = ikona(id); duch.style.display = 'block';
      duch.style.left = e.clientX + 'px'; duch.style.top = e.clientY + 'px';
      return;
    }
    if (e.target.id === 'vy-platno' && (e.button === 0 || e.button === 2)) {       // klik na polozeny kus = vratit
      const id = P.kusPodMysou(e.clientX, e.clientY);
      if (id) { vezmi(id, e.shiftKey ? podlozka.get(id) : 1); kresli(); }
    }
  });
  addEventListener('pointermove', e => {
    if (!rezim) return;
    if (drzanie && !e.target.closest?.('#drz')) zrusDrzanie();       // mys zisla z tlacidla
    if (tah) {
      duch.style.left = e.clientX + 'px'; duch.style.top = e.clientY + 'px';
      $('vy-scena').classList.toggle('ciel', e.target.id === 'vy-platno' || document.elementFromPoint(e.clientX, e.clientY)?.id === 'vy-platno');
    } else if (e.target.id === 'vy-platno') e.target.style.cursor = !P.jeAnimacia() && P.kusPodMysou(e.clientX, e.clientY) ? 'pointer' : 'default';
  });
  addEventListener('pointerup', e => {
    zrusDrzanie();
    if (!tah) return;
    const { id, x, y } = tah; tah = null;
    duch.style.display = 'none'; $('vy-scena').classList.remove('ciel');
    if (!rezim) return;
    const pod = document.elementFromPoint(e.clientX, e.clientY);
    const kolko = e.shiftKey ? pocet(id) : 1;
    if (pod?.closest('#vy-scena')) poloz(id, kolko, P.bodNaRohozi(e.clientX, e.clientY));       // potiahnute na rohoz
    else if (Math.hypot(e.clientX - x, e.clientY - y) < 8) poloz(id, kolko);                    // obycajny klik
    kresli();
  });
  addEventListener('blur', zrusDrzanie);
  addEventListener('click', e => {
    if (!rezim) return;
    if (e.target.closest('#vy-vycisti')) { if (!P.jeAnimacia()) { vyprazdni(); sprava = null; zvuky.vratit(); kresli(); } return; }
    const nas = e.target.closest('#vy-nasobky .nasobok');
    if (nas) { nasobok = nas.dataset.n === 'max' ? 'max' : +nas.dataset.n; kresli(); return; }
    const volba = e.target.closest('.vy-volba');
    if (volba) { vybrany = +volba.dataset.volba; kresli(); return; }
    const riadok = e.target.closest('#vyroba .recept');
    if (riadok && !P.jeAnimacia()) {
      vybrany = +riadok.dataset.r; zrusDrzanie();
      if (jeOdomknuty(RECEPTY[vybrany])) posklad(RECEPTY[vybrany]);
      kresli();
    }
  });
}
