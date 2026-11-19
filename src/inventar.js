// Inventar: 24 policok, prvych 8 je spodny panel (klavesy 1-8). Tab otvori batoh.
export const PREDMETY = {
  drevo: { meno: 'Drevo', ikona: '🪵' },
  kamen: { meno: 'Kameň', ikona: '🪨' },
  kokos: { meno: 'Kokos', ikona: '🥥' },
};
const MAX_KOPA = 20;          // kolko kusov sa zmesti do jedneho policka
export const sloty = Array(24).fill(null);   // policko = null alebo { typ, pocet }
let vybrany = 0, otvoreny = false;

// prida predmet; vrati false, ak je batoh plny (obrazovku prekresli volajuci cez vykresli())
export function pridaj(typ) {
  const s = sloty.find(s => s && s.typ === typ && s.pocet < MAX_KOPA);
  if (s) { s.pocet++; return true; }
  const i = sloty.indexOf(null);
  if (i < 0) return false;
  sloty[i] = { typ, pocet: 1 };
  return true;
}

export function nacitaj(data) {
  if (Array.isArray(data)) data.slice(0, sloty.length).forEach((s, i) => { sloty[i] = s && PREDMETY[s.typ] ? s : null; });
}

export function vyber(i) { vybrany = i; vykresli(); }
export function prepniBatoh() { otvoreny = !otvoreny; vykresli(); }

const policko = (s, i) => `<div class="slot${i === vybrany ? ' vybrany' : ''}" title="${s ? PREDMETY[s.typ].meno : ''}">`
  + (i < 8 ? `<span class="cislo">${i + 1}</span>` : '')
  + (s ? `${PREDMETY[s.typ].ikona}<span class="pocet">${s.pocet}</span>` : '') + '</div>';

export function vykresli() {
  document.getElementById('lista').innerHTML = sloty.slice(0, 8).map(policko).join('');
  const b = document.getElementById('batoh');
  b.style.display = otvoreny ? 'block' : 'none';
  if (otvoreny) b.innerHTML = '<h2>Batoh</h2><div class="mriezka">' + sloty.map(policko).join('') + '</div>';
}

// self-check pri starte: kopy sa nepreplnia, plny batoh vrati false
{
  let ok = true;
  for (let i = 0; i < 24 * MAX_KOPA; i++) ok = pridaj('kamen') && ok;
  console.assert(ok && !pridaj('kamen') && sloty.every(s => s.pocet === MAX_KOPA), 'inventar: chyba v kopach');
  sloty.fill(null);
}
