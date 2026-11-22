// Hlavne menu (3 sloty ulozenia) a nacitavacia obrazovka. Hra (main.js) sa nacita az po vybere slotu.
import { POCET_SLOTOV, prehlad, zmaz, nastavSlot, poslednySlot } from './sloty.js';

const $ = id => document.getElementById(id);
const TIPY = [
  'Úder do kokosovej palmy zhodí plody – hlad aj smäd ti poďakujú.',
  'Pri vode sa dá plávať, ale kanoe je rýchlejšie. Plachta chce vietor v chrbte.',
  'Cez noc svieti plankton – pri plavbe zanecháš modrú stopu.',
  'Táborák uvarí aj upečie. Nezabudni naň prikladať drevo.',
  'Z trofejí strážcu majáka sa dá vyrobiť niečo výnimočné.',
  'Stavať môžeš na pláži aj v lese – klávesa B otvorí menu stavby.',
];

function datum(ts) {
  if (!ts) return '';
  const d = new Date(ts), p = n => String(n).padStart(2, '0');
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function vykresliSloty() {
  const box = $('menu-sloty'), posl = poslednySlot();
  box.innerHTML = '';
  for (let n = 1; n <= POCET_SLOTOV; n++) {
    const p = prehlad(n);
    const k = document.createElement('div');
    k.className = 'slot-karta' + (p ? '' : ' prazdny') + (p && n === posl ? ' posledny' : '');
    k.innerHTML = `<div class="sk-cislo">${n}</div><div class="sk-telo">`
      + (p ? `<b>Deň ${p.den}</b><span>${datum(p.ts) || 'uložená hra'}</span><span class="sk-male">🛶 ${p.lode} · 🏠 ${p.stavby} · ✔ ${p.ulohy}</span>`
           : '<b>Prázdny slot</b><span>Začni novú hru</span>')
      + `</div><div class="sk-akcie"><button class="sk-hraj">${p ? 'Hrať' : 'Nová hra'}</button>${p ? '<button class="sk-zmaz" title="Zmazať ulozenie">🗑</button>' : ''}</div>`;
    k.querySelector('.sk-hraj').onclick = () => spusti(n);
    const z = k.querySelector('.sk-zmaz');
    if (z) {
      z.onclick = () => {                                  // dvojity klik: prvy len ukaze potvrdenie
        if (!z.classList.contains('istota')) { z.classList.add('istota'); z.textContent = 'Naozaj zmazať?'; setTimeout(() => { z.classList.remove('istota'); z.textContent = '🗑'; }, 3000); return; }
        zmaz(n); vykresliSloty();
      };
    }
    box.appendChild(k);
  }
}

let bezi = false;
async function spusti(n) {
  if (bezi) return;
  bezi = true;
  nastavSlot(n);
  $('menu-hl').style.display = 'none';
  const nac = $('nacitaj');
  nac.style.display = 'flex'; nac.style.opacity = '1';
  $('nac-tip').textContent = TIPY[Math.floor(Math.random() * TIPY.length)];
  const bar = $('nac-bar'), text = $('nac-text');
  const t0 = performance.now();
  let hotovo = false;
  // pas: nema skutocny percentualny udaj (moduly sa nacitavaju po jednom), tak sa plynulo blizi k 92 %, na konci skoci na 100 %
  const tik = setInterval(() => {
    if (hotovo) return;
    const t = (performance.now() - t0) / 1000;
    const p = 92 * (1 - Math.exp(-t / 3));
    bar.style.width = p + '%';
    text.textContent = p < 45 ? 'Načítavam knižnice…' : p < 75 ? 'Rastú ostrovy…' : 'Vlny sa rozvlňujú…';
  }, 80);
  try {
    await import('./main.js');
    await import('./mapa.js');
    // pockaj, kym sa okolie prvykrat vygeneruje (main.js vymaze #nacitanie), najviac 10 s
    const limit = performance.now() + 10000;
    while ($('nacitanie').textContent && performance.now() < limit) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, Math.max(0, 1300 - (performance.now() - t0))));
  } catch (e) {
    clearInterval(tik); hotovo = true;
    $('nac-text').textContent = 'Chyba pri načítaní: ' + e.message; bar.style.background = '#e0583a';
    console.error(e);
    return;
  }
  hotovo = true; clearInterval(tik);
  bar.style.width = '100%'; text.textContent = 'Hotovo';
  await new Promise(r => setTimeout(r, 350));
  nac.style.opacity = '0';
  $('start').style.display = 'flex';                      // "Klikni a hraj" (zamkne mys)
  setTimeout(() => { nac.style.display = 'none'; }, 700);
}

vykresliSloty();
$('menu-hl').style.display = 'flex';
