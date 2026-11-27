// Varenie - rozhranie: co robi E pri ohni, ukazovatel pecenia nad ohnom, okno hrnca s kucharskou knihou
// a ikony ucinkov jedal v HUD. Samotne pecenie a hrniec na ohni riesi ohen.js, recepty su v obsah/jedlo.js.
import * as THREE from 'three';
import { PREDMETY } from './obsah/predmety.js';
import { CASY, VARENIE, SKUPINY_SUROVIN, EFEKTY, coSaUvari, stavPecenia } from './obsah/jedlo.js';
import { ik, UI } from './ikony.js';
import { recept } from './obsah/recepty.js';
import { pocet, pridaj, odober, vykresli as vykresliInventar, vybranyPredmet } from './inventar.js';
import { hori, pec, daSaUpiect, prilozDrevo, zapalFaklou, kusNaZobratie, vysledokKusu, zoberKus, dajHrniec, zoberHrniec, zacniVarit, CAS_VARENIA } from './ohen.js';
import { horiVRuke, minHorenie } from './fakla.js';
import { hlas } from './ulohy.js';
import { efekty } from './preziti.js';
import { zvuky } from './zvuk.js';

// otvorenie kokosu: tekutina do hrnca (kokosova voda sa inak neda ziskat)
recept({ id: 'kokosova_voda', skupina: 'Tábor', vysledok: ['kokosova_voda', 1], suroviny: [['kokos', 1]] });

const NAZVY = ['surové', 'upečené', 'DOKONALÉ', 'spálené'];
const UCINOK_IKONY = { veslo: ik('wood-canoe', '#e0a050'), dych: ik('water-drop', '#5ac8e8'), regen: ik('hearts', '#7ad860'), odvaha: ik('fire', '#c8a0f0') };
const $ = id => document.getElementById(id);
const nazov = id => PREDMETY[id]?.meno ?? id;
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const SUROVINY = [...new Set(VARENIE.flatMap(r => r.suroviny.flatMap(s => SKUPINY_SUROVIN[s]?.ids ?? [s])))];

let sluzby = { oznam: () => {}, hrac: null };
const kniha = new Set();                 // objavene jedla (uklada sa so slotom)
export const ulozVarenie = () => ({ kniha: [...kniha] });
export function nacitajVarenie(d) { kniha.clear(); for (const id of d?.kniha ?? []) if (VARENIE.some(r => r.id === id)) kniha.add(id); }

// ---------- E pri ohni: vrati { text: napoveda, akcia() } ----------
export function obsluhaOhna(o) {
  const d = vybranyPredmet(), { hrac, oznam } = sluzby;
  const kus = kusNaZobratie(o);
  const E = t => `<kbd>E</kbd> ${t}`;
  const priloz = () => {
    if (prilozDrevo(o)) { odober('drevo', 1); vykresliInventar(); zvuky.uder('drevo'); hrac.zdvihni(); }
    else oznam('Oheň je plný dreva');
  };
  const zober = () => {
    const st = stavPecenia(kus.t), id = vysledokKusu(kus);
    if (pridaj(id, 1) > 0) return oznam('Batoh je plný');
    zoberKus(o, kus);
    if (st === 1 || st === 2) hlas('upec');
    if (st === 2) zvuky.cink(); else zvuky.zober();
    oznam(`${st === 2 ? '★ Dokonalé! ' : st === 3 ? 'Spálené… ' : ''}+1 ${PREDMETY[id].ikona} ${nazov(id)}`);
    hrac.zdvihni(); vykresliInventar();
  };
  const textZober = () => E(`zobrať: ${PREDMETY[kus.typ].ikona} ${NAZVY[stavPecenia(kus.t)]}`);
  let text, akcia;
  if (d?.id === 'drevo') { text = E(hori(o) ? 'priložiť drevo' : 'zapáliť (drevo)'); akcia = priloz; }
  else if (kus) { text = textZober(); akcia = zober; }
  else if (hori(o) && d && daSaUpiect(d.id) && !o.hrniec && o.pecie.length < 3) {
    text = E(`upiecť: ${d.ikona} ${d.meno}`);
    akcia = () => { if (pec(o, d.id)) { odober(d.id, 1); vykresliInventar(); zvuky.syc(); } };
  } else if (o.hrniec && (hori(o) || o.hrniec.hotove || !pocet('drevo'))) { text = E(o.hrniec.hotove ? `hrniec – hotovo: ${nazov(o.hrniec.hotove)}` : 'variť v hrnci'); akcia = () => otvorHrniec(o); }
  else if (hori(o) && d?.id === 'hrniec' && !o.pecie.length) {
    text = E('postaviť hrniec na oheň');
    akcia = () => { if (dajHrniec(o)) { odober('hrniec', 1); vykresliInventar(); zvuky.uder('kamen'); hrac.zdvihni(); otvorHrniec(o); } };
  } else if (!hori(o) && !pocet('drevo') && horiVRuke()) {          // pahrebu rozfuka aj horiaca fakla
    text = E('zapáliť pahrebu fakľou');
    akcia = () => { zapalFaklou(o); minHorenie(20); zvuky.faklaZapal(); hrac.zdvihni(); };
  } else if (pocet('drevo')) { text = E(hori(o) ? 'priložiť drevo' : 'zapáliť (drevo)'); akcia = priloz; }
  else { text = hori(o) ? `Na priloženie treba ${UI.drevo} drevo` : 'Pahreba – zapáliš ju drevom'; akcia = () => {}; }
  if (hori(o)) text += ` · ${UI.ohen} ${mmss(o.palivo)}`;
  return { text, akcia };
}

// ---------- okno hrnca ----------
let okno = null;             // ohen, ktoreho hrniec je otvoreny
let vlozene = [null, null, null];
let podpis = '';
export const jeHrniec = () => !!okno;
function otvorHrniec(o) {
  okno = o; vlozene = [null, null, null]; podpis = '';
  document.exitPointerLock();
  $('hrniec-okno').style.display = 'flex';
  vykresliOkno();
}
export function zavriHrniec() { okno = null; $('hrniec-okno').style.display = 'none'; }

const pocetVlozenych = id => vlozene.filter(v => v === id).length;
const volne = id => pocet(id) - pocetVlozenych(id);
// ktore suroviny z batohu dat do policok pre recept z knihy (null = nieco chyba)
function naplnPodla(r) {
  const vyber = [];
  for (const s of r.suroviny) {
    const id = (SKUPINY_SUROVIN[s]?.ids ?? [s]).find(i => pocet(i) > vyber.filter(v => v === i).length);
    if (!id) return null;
    vyber.push(id);
  }
  return [0, 1, 2].map(i => vyber[i] ?? null);
}

const surovinaHtml = s => {
  const g = SKUPINY_SUROVIN[s];
  const p = PREDMETY[g ? g.ids[0] : s];
  return `<span title="${g ? g.ids.map(nazov).join(' / ') : p.meno}">${p.ikona} ${g ? g.meno : p.meno}</span>`;
};
function knihaHtml() {
  return VARENIE.map(r => {
    if (!kniha.has(r.id)) return `<div class="kn-recept neznamy"><span class="kn-ikona">?</span><div><b>Neobjavené jedlo</b><div class="kn-suroviny">${r.suroviny.length} suroviny</div></div></div>`;
    const p = PREDMETY[r.id];
    return `<div class="kn-recept${naplnPodla(r) ? ' mozem' : ''}" data-recept="${r.id}"><span class="kn-ikona">${p.ikona}</span><div><b>${p.meno}</b>`
      + `<div class="kn-suroviny">${r.suroviny.map(surovinaHtml).join(' + ')}</div>`
      + (r.efekt ? `<div class="kn-efekt">${UCINOK_IKONY[r.efekt]} ${EFEKTY[r.efekt].popis}</div>` : '') + '</div></div>';
  }).join('');
}

function vykresliOkno() {
  const h = okno.hrniec;
  const stavKluc = [vlozene, h.var?.id, h.hotove, hori(okno), kniha.size, pocet('drevo'), ...SUROVINY.map(pocet)].join('|');
  if (stavKluc !== podpis) {
    podpis = stavKluc;
    const n = vlozene.filter(Boolean).length;
    let stred;
    if (h.hotove) {
      const p = PREDMETY[h.hotove];
      stred = `<div class="hr-hotovo"><span class="hr-velka">${p.ikona}</span><div><b class="tema-nadpis">${p.meno}</b><p>${p.popis}</p></div></div>`
        + '<button class="tema-tlacidlo" data-akcia="vyber">Zobrať do batohu</button>';
    } else if (h.var) {
      stred = `<div class="hr-varim">${hori(okno) ? 'Varí sa…' : 'Oheň zhasol – prilož drevo'}<div class="hr-pasik"><i id="hr-postup"></i></div></div>`;
    } else {
      stred = '<div class="hr-policka">' + vlozene.map((id, i) => `<button class="hr-policko${id ? ' plne' : ''}" data-policko="${i}" title="${id ? `${nazov(id)} – klikni a vyber` : 'prázdne'}">${id ? PREDMETY[id].ikona : '+'}</button>`).join('') + '</div>'
        + `<button class="tema-tlacidlo" data-akcia="var"${n < 2 || !hori(okno) ? ' disabled' : ''}>${!hori(okno) ? 'Oheň nehorí' : n < 2 ? 'Vlož aspoň 2 suroviny' : 'Variť'}</button>`
        + '<div class="hr-zoznam">' + (SUROVINY.filter(id => pocet(id) > 0).map(id => `<button class="hr-surovina" data-surovina="${id}"${volne(id) <= 0 || n >= 3 ? ' disabled' : ''}>${PREDMETY[id].ikona}<span>${nazov(id)}</span><small>${volne(id)}</small></button>`).join('')
          || '<p>V batohu nemáš nič na varenie.<br>Skús kokos, rybu, taro, huby, ovocie, aloe…</p>') + '</div>';
    }
    $('hrniec-okno').innerHTML = `<div class="hr-lavy"><h2 class="tema-nadpis">Hrniec na ohni</h2>${stred}<div class="hr-pata">`
      + `<button data-akcia="drevo"${pocet('drevo') ? '' : ' disabled'}>${UI.drevo} Priložiť drevo (${pocet('drevo')})</button>`
      + `<button data-akcia="zloz"${h.var || h.hotove ? ' disabled' : ''}>Zložiť hrniec</button><button data-akcia="zavri">Zavrieť</button></div></div>`
      + `<div class="hr-kniha tema-papier"><h3>Kuchárska kniha <small>${kniha.size}/${VARENIE.length}</small></h3>${knihaHtml()}</div>`;
  }
  const postup = $('hr-postup');
  if (postup && h.var) postup.style.width = Math.min(100, h.var.t / CAS_VARENIA * 100) + '%';
}

function klik(e) {
  const t = e.target.closest('[data-akcia],[data-policko],[data-surovina],[data-recept]');
  if (!t || !okno || t.disabled) return;
  const a = t.dataset.akcia, h = okno.hrniec;
  if (t.dataset.policko !== undefined) vlozene[+t.dataset.policko] = null;
  else if (t.dataset.surovina) {
    const i = vlozene.indexOf(null);
    if (i >= 0 && volne(t.dataset.surovina) > 0) { vlozene[i] = t.dataset.surovina; zvuky.zober(); }
  } else if (t.dataset.recept) {
    if (!h.var && !h.hotove) vlozene = naplnPodla(VARENIE.find(r => r.id === t.dataset.recept)) ?? vlozene;
  } else if (a === 'var') {
    const co = vlozene.filter(Boolean);
    if (co.length >= 2 && co.every(id => pocet(id) >= pocetVlozenych(id)) && zacniVarit(okno, coSaUvari(co))) {
      co.forEach(id => odober(id, 1)); vlozene = [null, null, null];
      vykresliInventar(); sluzby.hrac.drz(vybranyPredmet()); zvuky.splach(0.3);
    }
  } else if (a === 'vyber') {
    if (pridaj(h.hotove, 1) > 0) sluzby.oznam('Batoh je plný');
    else { sluzby.oznam(`+1 ${PREDMETY[h.hotove].ikona} ${nazov(h.hotove)} – zješ klávesou F`); h.hotove = null; hlas('upec'); vykresliInventar(); zvuky.zober(); }
  } else if (a === 'drevo') {
    if (prilozDrevo(okno)) { odober('drevo', 1); vykresliInventar(); zvuky.uder('drevo'); } else sluzby.oznam('Oheň je plný dreva');
  } else if (a === 'zloz') {
    if (pocet('hrniec') >= PREDMETY.hrniec.kopa || pridaj('hrniec', 1) === 0) { zoberHrniec(okno); vykresliInventar(); zavriHrniec(); sluzby.zavrete(); return; }
    sluzby.oznam('Batoh je plný');
  } else if (a === 'zavri') { zavriHrniec(); sluzby.zavrete(); return; }
  vykresliOkno();
}

// jedlo sa v hrnci dovarilo (volat s ohne.uvarene)
export function uvarene(id) {
  if (VARENIE.some(r => r.id === id) && !kniha.has(id)) {
    kniha.add(id);
    sluzby.oznam(`📖 Nový recept v kuchárskej knihe: ${nazov(id)}`);
  } else sluzby.oznam(id === 'kasa' ? 'Z toho vznikla len čudná kaša…' : `${nazov(id)} je hotové`);
}

// ---------- ukazovatel pecenia nad ohnom + ucinky v HUD ----------
const bod = new THREE.Vector3();
let podpisPec = '', podpisUc = '';
const zona = (od, po) => `${(od / CASY.koniec * 100).toFixed(1)}% ${(po / CASY.koniec * 100).toFixed(1)}%`;
const PASIK = `linear-gradient(90deg, #8a8478 ${zona(0, CASY.upecene)}, #d88a3a ${zona(CASY.upecene, CASY.dokonale)}, #ffe14a ${zona(CASY.dokonale, CASY.spalene)}, #7a2a1a ${zona(CASY.spalene, CASY.koniec)})`;

function vykresliPecenie(o, kamera) {
  const el = $('pec-ukaz');
  let vidno = !!o && o.pecie.length > 0;
  if (vidno) {
    bod.set(o.x, o.y + 1.35, o.z).project(kamera);
    vidno = bod.z < 1 && Math.abs(bod.x) < 1.2;
  }
  el.style.display = vidno ? 'block' : 'none';
  if (!vidno) return;
  el.style.left = THREE.MathUtils.clamp((bod.x + 1) / 2 * innerWidth, 140, innerWidth - 140) + 'px';
  el.style.top = THREE.MathUtils.clamp((1 - bod.y) / 2 * innerHeight, 130, innerHeight * 0.7) + 'px';
  const kusy = [...o.pecie].sort((a, b) => a.miesto - b.miesto), vybrany = kusNaZobratie(o);
  const kluc = kusy.map(p => `${p.typ}${stavPecenia(p.t)}${p === vybrany}${p.miesto}`).join('|');
  if (kluc !== podpisPec) {
    podpisPec = kluc;
    el.innerHTML = kusy.map(p => {
      const st = stavPecenia(p.t);
      return `<div class="pec-riadok s${st}${p === vybrany ? ' vybrany' : ''}"><span class="pec-ikona">${PREDMETY[p.typ].ikona}</span>`
        + `<span class="pec-pasik" style="background:${PASIK}"><i></i></span><span class="pec-stav">${NAZVY[st]}</span>${p === vybrany ? '<kbd>E</kbd>' : '<span></span>'}</div>`;
    }).join('');
  }
  el.querySelectorAll('.pec-pasik i').forEach((r, i) => r.style.left = Math.min(100, kusy[i].t / CASY.koniec * 100) + '%');
}

function vykresliUcinky() {
  const zoz = Object.keys(efekty).filter(k => EFEKTY[k]);
  const kluc = zoz.map(k => k + Math.ceil(efekty[k])).join('|');
  if (kluc === podpisUc) return;
  podpisUc = kluc;
  $('efekty').innerHTML = zoz.map(k => `<div class="efekt tema-panel${efekty[k] < 15 ? ' konci' : ''}" title="${EFEKTY[k].meno}: ${EFEKTY[k].popis}">${UCINOK_IKONY[k]}<div><b>${EFEKTY[k].meno}</b><small>${mmss(Math.ceil(efekty[k]))}</small></div></div>`).join('');
}

export function initVarenie(s) {
  sluzby = s;
  $('hrniec-okno').addEventListener('click', klik);
}

// volat kazdy snimok; ohen = najblizsi taborak do 5 m (alebo null), hrac.poz kvoli zatvoreniu okna
export function aktualizujVarenie({ ohen, kamera }) {
  if (okno) {
    const p = sluzby.hrac.poz;
    if (!okno.hrniec || Math.hypot(okno.x - p.x, okno.z - p.z) > 4) { zavriHrniec(); sluzby.zavrete(); }
    else vykresliOkno();
  }
  vykresliPecenie(okno ? null : ohen, kamera);
  vykresliUcinky();
}
