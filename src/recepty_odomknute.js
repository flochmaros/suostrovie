// Postupne odomykanie receptov + pracovne stanice.
// Polia v definicii receptu (obsah/recepty.js, stavby.js, vylepsenia.js, vystroj.js):
//   kluc: 'obsidian'      recept sa odomkne, ked hrac prvykrat ziska tento predmet
//   nacrt: 'barza'        vzacny recept: odomkne ho az najdeny nacrt (zoznam NACRTY nizsie)
//   (bez kluc aj nacrt)   znamy od zaciatku (podmienka funguje ako doteraz)
//   stanica: 'ponk'       da sa vyrobit len pri tejto stavbe (STANICE)
//   napoveda: '...'       vlastny text pri zamknutom recepte (inak sa zlozi sam)
//   objav: true           (spolu s kluc) neodomkne sa sam – hrac ho objavi spravnou kombinaciou na podlozke (vyroba.js)
import { RECEPTY } from './obsah/recepty.js';
import { PREDMETY } from './obsah/predmety.js';
import { zvuky } from './zvuk.js';

// poradie = v akom poradi sa z najdenych nacrtov ucis
export const NACRTY = {
  lastura: 'Lastúrové brnenie',
  pretekove: 'Pretekárske kanoe',
  barza: 'Barža',
  plavak: 'Dvojtrupová plachetnica',
  katamaran: 'Katamarán',
};
export const STANICE = { ponk: 'Ponk', kamenna_dielna: 'Kamenná dielňa' };

const odomknute = new Set();        // id receptov s kluc / nacrt, ktore hrac uz pozna
let aktivne = false;                // az po nacitani ulozenia (inak by sa toasty ukazali pri starte)
let cakajuce = [];                  // novo odomknute recepty cakajuce na spolocny toast

const jeZamykatelny = r => !!(r.kluc || r.nacrt);
export function jeOdomknuty(r) { return !jeZamykatelny(r) || odomknute.has(r.id); }
export function menoReceptu(r) { return r.meno ?? PREDMETY[r.vysledok?.[0]]?.meno ?? r.id; }
export function ikonaReceptu(r) { return r.ikona ?? PREDMETY[r.vysledok?.[0]]?.ikona ?? '?'; }
export function napovedaReceptu(r) {
  if (r.napoveda) return r.napoveda;
  if (r.nacrt) return 'Nájdi náčrt – v truhle vo vraku na dne mora alebo u strážcu majáka.';
  if (r.objav) return `Objav ho na podložke: skús niečo poskladať z predmetu ${PREDMETY[r.kluc]?.meno ?? r.kluc} (spolu ${r.suroviny.reduce((a, x) => a + x[1], 0)} kusov).`;
  return `Získaj predmet: ${PREDMETY[r.kluc]?.meno ?? r.kluc}`;
}

function odomkni(r) {
  if (jeOdomknuty(r)) return false;
  odomknute.add(r.id);
  if (!cakajuce.length) setTimeout(ukazToast, 60);        // viac receptov naraz = jeden toast
  cakajuce.push(r);
  return true;
}
// objav experimentom na podlozke: bez toastu (oslavu kresli vyroba.js); naucit sa z nacrtu sa takto neda
export function objavRecept(r) {
  if (!r.kluc || r.nacrt || jeOdomknuty(r)) return false;
  odomknute.add(r.id);
  return true;
}
export function odomkniVsetky() { let n = 0; for (const r of RECEPTY) if (odomkni(r)) n++; return n; }

// nacrt z batohu sa hned precita: nauci dalsiu neznamu skupinu. Ked uz vsetko poznas, ostane v batohu.
function precitajNacrty(sloty) {
  let zmena = false;
  for (let i = 0; i < sloty.length; i++) {
    while (sloty[i]?.typ === 'nacrt') {
      const skupina = Object.keys(NACRTY).find(k => RECEPTY.some(r => r.nacrt === k && !jeOdomknuty(r)));
      if (!skupina) return zmena;
      for (const r of RECEPTY) if (r.nacrt === skupina && odomkni(r)) r.zNacrtu = true;
      if (--sloty[i].pocet <= 0) sloty[i] = null;
      zmena = true;
    }
  }
  return zmena;
}

// prejde batoh a odomkne, na co hrac prave ziskal klucovu surovinu; vrati true, ak sa nieco zmenilo
export function skontrolujRecepty(sloty) {
  if (!aktivne) return false;
  const mam = new Set();
  for (const s of sloty) if (s) mam.add(s.typ);
  let zmena = false;
  for (const r of RECEPTY) if (r.kluc && !r.objav && mam.has(r.kluc) && odomkni(r)) zmena = true;
  return precitajNacrty(sloty) || zmena;
}

export const ulozRecepty = () => [...odomknute];
// data = pole z ulozenia, alebo undefined. stare = co hrac uz ma v starom ulozeni (bez zoznamu receptov):
// { veci: Set id predmetov (batoh, sklady, vystroj), stavby: Set typov postavenych stavieb, lode: [{ druh, uroven }] }
export function nacitajRecepty(data, stare) {
  odomknute.clear();
  if (Array.isArray(data)) data.forEach(id => odomknute.add(id));
  else if (stare) {
    const { veci, stavby, lode } = stare;
    for (const r of RECEPTY) {
      if (!jeZamykatelny(r)) continue;
      const vysl = r.vysledok?.[0];
      if ((r.kluc && veci.has(r.kluc)) || (vysl && veci.has(vysl)) || (r.stavba && stavby.has(r.stavba)) || stavby.has(r.id)
        || lode.some(l => r.id === `lod_${l.druh}` || (l.druh === 'kanoe' && /^kanoe_ur/.test(r.id) && +r.id.slice(8) <= l.uroven))) odomknute.add(r.id);
    }
    // kto ma jeden kus sady z nacrtu, pozna celu sadu
    for (const k of Object.keys(NACRTY)) if (RECEPTY.some(r => r.nacrt === k && odomknute.has(r.id))) RECEPTY.forEach(r => { if (r.nacrt === k) odomknute.add(r.id); });
  }
  aktivne = true;
}

// ---------- toast "Novy recept!" ----------
function ukazToast() {
  const nove = cakajuce; cakajuce = [];
  if (!nove.length || typeof document === 'undefined') return;
  const nacrt = nove.find(r => r.zNacrtu);
  let box = document.getElementById('recept-toasty');
  if (!box) { box = document.createElement('div'); box.id = 'recept-toasty'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'recept-toast tema-panel';
  const nadpis = nacrt ? `Náčrt: ${NACRTY[nacrt.nacrt]}` : nove.length > 1 ? `Nové recepty! (${nove.length})` : 'Nový recept!';
  t.innerHTML = `<b class="tema-nadpis">${nadpis}</b><div class="rt-ikony">${nove.slice(0, 6).map(r => `<span class="ikona">${ikonaReceptu(r)}</span>`).join('')}${nove.length > 6 ? `<i>+${nove.length - 6}</i>` : ''}</div>`
    + `<small>${nove.slice(0, 3).map(menoReceptu).join(', ')}${nove.length > 3 ? '…' : ''}</small>`;
  nove.forEach(r => { delete r.zNacrtu; });
  box.appendChild(t);
  zvuky.recept?.();
  setTimeout(() => t.remove(), 4500);
}

// ---------- pracovne stanice ----------
let blizkost = () => false;                     // main.js doda: stoji hrac pri stavbe typu t?
export function nastavStanice(fn) { blizkost = fn; }
export function jeStanicaBlizko(typ) { return !typ || blizkost(typ); }
