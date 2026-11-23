// Mena ostrovov (pomenuje ich hrac po objaveni) + znacky na mape (waypointy s ikonou) + navigacia k znacke.
// Dialogy su jedno spolocne okno: pomenovanie ostrova a pridanie/uprava znacky.
import { ik } from './ikony.js';

// ---------- typy znaciek (ikona z ikony.js + farba) ----------
export const TYPY = {
  bod: { meno: 'Bod', tvar: 'flying-flag', farba: '#e8473c' },
  domov: { meno: 'Tábor', tvar: 'campfire', farba: '#ef7a2f' },
  stavba: { meno: 'Stavba', tvar: 'hut', farba: '#c9a06a' },
  hlina: { meno: 'Hlina', tvar: 'rock', farba: '#b5703a' },
  kamen: { meno: 'Kameň', tvar: 'rock', farba: '#a8a39a' },
  ruda: { meno: 'Ruda', tvar: 'ore', farba: '#8fb0d8' },
  krystal: { meno: 'Kryštály', tvar: 'crystal-growth', farba: '#a98af0' },
  drevo: { meno: 'Drevo', tvar: 'log', farba: '#b07a45' },
  bambus: { meno: 'Bambus', tvar: 'bamboo', farba: '#79a83a' },
  ovocie: { meno: 'Ovocie', tvar: 'banana', farba: '#f2d24a' },
  kokos: { meno: 'Kokosy', tvar: 'coconuts', farba: '#9a6a44' },
  byliny: { meno: 'Byliny', tvar: 'herbs-bundle', farba: '#6fbf5a' },
  voda: { meno: 'Sladká voda', tvar: 'water-drop', farba: '#4aa8ea' },
  ryby: { meno: 'Ryby', tvar: 'flatfish', farba: '#7ab8d8' },
  poklad: { meno: 'Poklad', tvar: 'chest', farba: '#e0b040' },
  nebezpecenstvo: { meno: 'Nebezpečenstvo', tvar: 'shard-sword', farba: '#d0402f' },
};

// ---------- stav (uklada sa) ----------
const mena = new Map();                 // "bx,bz" -> meno, ktore dal hrac
export const znacky = [];               // { id, x, z, t (typ), n (meno) }
export const navi = { id: null };       // id znacky, ku ktorej hrac navigovat
let dalsieId = 1;

const kluc = o => o.bx + ',' + o.bz;
// rucne navrhnute ostrovy (src/ostrovy/) maju od zaciatku pribehove meno (hrac ich moze premenovat), ostrovceky pomenuva hrac
export const jePomenovany = o => mena.has(kluc(o)) || !!o.menovany;
export const menoOstrova = o => mena.get(kluc(o)) || (o.menovany ? o.meno : 'Nepomenovaný ostrov');
export function nastavMeno(o, meno) { const m = meno.trim().slice(0, 26); if (m) mena.set(kluc(o), m); else mena.delete(kluc(o)); }

export const ciel = () => znacky.find(z => z.id === navi.id) || null;
export function pridajZnacku(z) { z.id = dalsieId++; znacky.push(z); return z; }
export function zmazZnacku(id) {
  const i = znacky.findIndex(z => z.id === id);
  if (i >= 0) znacky.splice(i, 1);
  if (navi.id === id) navi.id = null;
}

export const ulozZnacky = () => ({ m: Object.fromEntries(mena), z: znacky, c: navi.id, d: dalsieId });
export function nacitajZnacky(d) {
  if (!d) return;
  for (const [k, v] of Object.entries(d.m || {})) mena.set(k, String(v).slice(0, 26));
  for (const z of d.z || []) if (TYPY[z.t] && isFinite(z.x) && isFinite(z.z)) znacky.push({ id: z.id, x: z.x, z: z.z, t: z.t, n: String(z.n || '').slice(0, 26) });
  dalsieId = Math.max(d.d || 1, ...znacky.map(z => z.id + 1), 1);
  navi.id = znacky.some(z => z.id === d.c) ? d.c : null;
}

// ---------- ikony pre canvas (SVG -> Image, s cache) ----------
const obrazky = new Map();
function obrazok(typ) {
  let o = obrazky.get(typ);
  if (o) return o;
  const t = TYPY[typ];
  const svg = ik(t.tvar, t.farba).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" ');
  o = new Image(); o.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  obrazky.set(typ, o);
  return o;
}
// znacka na mape: kruh s ikonou (r = polomer v px); vyber = zvyraznena (kurzor / navigacia)
export function kresliZnacku(c, x, y, typ, r, vyber = false) {
  const t = TYPY[typ] || TYPY.bod;
  c.save();
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = 'rgba(30,22,12,.82)'; c.fill();
  c.lineWidth = Math.max(2, r * 0.17); c.strokeStyle = vyber ? '#fff' : t.farba; c.stroke();
  const im = obrazok(typ), s = r * 1.35;
  if (im.complete && im.naturalWidth) c.drawImage(im, x - s / 2, y - s / 2, s, s);
  c.restore();
}

// ---------- dialog ----------
const styl = document.createElement('style');
styl.textContent = `
#zn-okno { display: none; position: fixed; inset: 0; z-index: 90; background: rgba(8,14,20,.5); align-items: center; justify-content: center; }
#zn-okno .zn-box { width: 380px; max-width: 92vw; padding: 20px 22px 18px; border-radius: 8px; background: #e9d9ae; color: #3f2b14; font: 14px/1.45 Georgia, serif;
  box-shadow: 0 12px 50px #000b, inset 0 0 0 3px #6b4a26, inset 0 0 0 5px #efe0b8, inset 0 0 0 6px #6b4a26; }
#zn-okno h3 { margin: 0 0 2px; font: italic 700 22px Georgia, serif; text-align: center; }
#zn-okno .zn-pod { text-align: center; opacity: .75; margin-bottom: 12px; font-size: 13px; }
#zn-okno input { width: 100%; box-sizing: border-box; padding: 9px 11px; border-radius: 5px; border: 2px solid #6b4a26; background: #f6ebca; color: #3f2b14;
  font: 700 18px Georgia, serif; outline: none; }
#zn-okno input:focus { border-color: #b5641f; box-shadow: 0 0 0 3px rgba(181,100,31,.25); }
#zn-okno .zn-ikony { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 12px; }
#zn-okno .zn-ik { padding: 5px 2px 3px; border-radius: 6px; border: 2px solid transparent; background: rgba(107,74,38,.12); cursor: pointer; text-align: center; font-size: 11px; line-height: 1.15; color: #3f2b14; }
#zn-okno .zn-ik:hover { background: rgba(107,74,38,.25); }
#zn-okno .zn-ik.akt { border-color: #b5641f; background: rgba(181,100,31,.22); }
#zn-okno .zn-ik svg { width: 30px; height: 30px; display: block; margin: 0 auto 2px; }
#zn-okno .zn-tl { display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end; }
#zn-okno button.zn { padding: 8px 16px; border-radius: 6px; border: 2px solid #6b4a26; background: #efe0b8; color: #3f2b14; font: 700 14px Georgia, serif; cursor: pointer; }
#zn-okno button.zn:hover { background: #f8eccc; }
#zn-okno button.zn.hlavne { background: #b5641f; border-color: #6b3a10; color: #fff7e2; }
#zn-okno button.zn.hlavne:hover { background: #c9742c; }
#zn-okno button.zn.zle { color: #8a2a1a; margin-right: auto; }
`;
document.head.appendChild(styl);
const ov = document.createElement('div');
ov.id = 'zn-okno';
document.body.appendChild(ov);
let otvorene = false;
export const dialogOtvoreny = () => otvorene;

// polozky: { nadpis, pod, hodnota, ikony: aktualny typ alebo null, tlacidla: [{ text, trieda, fn(meno, typ) }], zatvorene }
function dialog(p) {
  otvorene = true;
  let typ = p.ikony;
  ov.innerHTML = `<div class="zn-box"><h3></h3><div class="zn-pod"></div><input maxlength="26" spellcheck="false" autocomplete="off">`
    + (p.ikony ? `<div class="zn-ikony">${Object.entries(TYPY).map(([k, t]) => `<div class="zn-ik" data-t="${k}">${ik(t.tvar, t.farba)}${t.meno}</div>`).join('')}</div>` : '')
    + `<div class="zn-tl">${p.tlacidla.map((t, i) => `<button class="zn ${t.trieda || ''}" data-i="${i}">${t.text}</button>`).join('')}</div></div>`;
  ov.querySelector('h3').textContent = p.nadpis;
  ov.querySelector('.zn-pod').textContent = p.pod || '';
  const vstup = ov.querySelector('input');
  vstup.value = p.hodnota || '';
  const zatvor = (spustFn, i) => {
    otvorene = false; ov.style.display = 'none';
    const meno = vstup.value, t = typ;
    if (spustFn) p.tlacidla[i].fn(meno, t);
    p.zatvorene?.();
  };
  ov.querySelectorAll('.zn-ik').forEach(e => {
    const vyber = () => ov.querySelectorAll('.zn-ik').forEach(x => x.classList.toggle('akt', x.dataset.t === typ));
    e.onclick = () => {
      const staryNazov = TYPY[typ]?.meno;
      typ = e.dataset.t; vyber();
      if (!vstup.value.trim() || vstup.value === staryNazov) vstup.value = TYPY[typ].meno;   // meno sa prepise len ak ho hrac nezmenil
      vstup.focus();
    };
    vyber();
  });
  ov.querySelectorAll('button.zn').forEach(b => { b.onclick = () => zatvor(!b.classList.contains('zrus'), +b.dataset.i); });
  // hra nesmie dostavat klavesy, kym pises
  vstup.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.code === 'Enter') { e.preventDefault(); const h = p.tlacidla.findIndex(t => t.trieda?.includes('hlavne')); zatvor(true, h < 0 ? 0 : h); }
    else if (e.code === 'Escape') { e.preventDefault(); zatvor(false); }
  });
  vstup.addEventListener('keyup', e => e.stopPropagation());
  ov.style.display = 'flex';
  document.exitPointerLock?.();
  setTimeout(() => { vstup.focus(); vstup.select(); }, 30);
}

// pomenovanie ostrova: navrh = predvyplnene meno; hotovo(meno) po potvrdeni
export function pomenujOstrov(o, { navrh, nove, hotovo, zatvorene } = {}) {
  dialog({
    nadpis: nove ? 'Nový ostrov objavený!' : 'Pomenovať ostrov',
    pod: nove ? 'Ako ho nazveš? Meno sa ukáže aj na mape.' : `Terajšie meno: ${menoOstrova(o)}`,
    hodnota: navrh ?? (jePomenovany(o) ? menoOstrova(o) : ''),
    tlacidla: [
      { text: 'Pomenovať', trieda: 'hlavne', fn: m => { if (m.trim()) { nastavMeno(o, m); hotovo?.(menoOstrova(o)); } } },
      { text: nove ? 'Neskôr' : 'Zrušiť', trieda: 'zrus' },
    ],
    zatvorene,
  });
}

// nova alebo existujuca znacka; hotovo(znacka) po ulozeni
export function upravZnacku(z, { hotovo, zmazane } = {}) {
  const nova = !z.id;
  dialog({
    nadpis: nova ? 'Nová značka' : 'Upraviť značku',
    pod: `Poloha: ${Math.round(z.x)}, ${Math.round(z.z)}`,
    hodnota: z.n || TYPY[z.t].meno,
    ikony: z.t,
    tlacidla: [
      ...(nova ? [] : [{ text: 'Zmazať', trieda: 'zle', fn: () => { zmazZnacku(z.id); zmazane?.(); } }]),
      { text: 'Uložiť', trieda: 'hlavne', fn: (m, t) => {
        z.t = t; z.n = m.trim().slice(0, 26) || TYPY[t].meno;
        if (nova) pridajZnacku(z);
        hotovo?.(z);
      } },
      { text: 'Zrušiť', trieda: 'zrus' },
    ],
  });
}
