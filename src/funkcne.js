// Funkcne stavby: truhlica (sklad), zberac vody (dazd -> voda), susiak (ryby/ovocie sa susia), kamenna pec
// (pecie 6 kusov naraz na dreve), hamaka (prespanie noci + miesto, kde sa zobudis po omdleti).
// Stav kazdej stavby je v d.st (uklada sa spolu so stavbami v stavba.js).
import * as THREE from 'three';
import { diely } from './stavba.js';
import { PREDMETY } from './obsah/predmety.js';
import { PECENIE, SUSENIE } from './obsah/jedlo.js';

export const TRUHLICA_POLICOK = 16;
const VODA_MAX = 5, VODA_DUSOK = 22;          // dusky v zberaci, kolko smadu zahasi jeden dusok
const SUSIAK_MAX = 4, CAS_SUSENIA = 150;      // sekund na slnku (v noci 3x pomalsie, v dazdi stoji)
const PEC_MAX = 6, CAS_PECE = 4, PEC_DREVO = 200, PEC_PALIVO_MAX = 800;

// predvoleny stav pri postaveni
export function novyStav(typ) {
  if (typ === 'truhlica') return { sk: Array(TRUHLICA_POLICOK).fill(null) };
  if (typ === 'zberac_vody') return { v: 0 };
  if (typ === 'susiak') return { sl: [] };
  if (typ === 'kamenna_pec') return { p: 0, sl: [] };
  return null;
}
// po nacitani zo save: doplni chybajuce polia a vyhodi nezname predmety
export function opravStav(typ, st) {
  const n = novyStav(typ);
  if (!n) return null;
  if (!st || typeof st !== 'object') return n;
  if (n.sk) n.sk = n.sk.map((_, i) => (st.sk?.[i] && PREDMETY[st.sk[i].typ]) ? st.sk[i] : null);
  if ('v' in n) n.v = Math.min(VODA_MAX, Math.max(0, +st.v || 0));
  if ('p' in n) n.p = Math.max(0, +st.p || 0);
  if (n.sl) n.sl = (Array.isArray(st.sl) ? st.sl : []).filter(s => PREDMETY[s?.typ]).map(s => ({ typ: s.typ, t: +s.t || 0, hotove: !!s.hotove }));
  return n;
}
// co vypadne pri rozobrati (obsah truhlice, susiaka, pece)
export function obsah(d) {
  const st = d.st, von = [];
  if (!st) return von;
  for (const s of st.sk ?? []) if (s) von.push([s.typ, s.pocet]);
  for (const s of st.sl ?? []) von.push([s.hotove ? (d.typ === 'susiak' ? SUSENIE : PECENIE)[s.typ] : s.typ, 1]);
  return von;
}

// ---------- kazdy snimok ----------
// o = { dazd (0..1), svetlo (0..1 slnko) }
let dym = null;
export function aktualizujFunkcne(dt, o) {
  for (const d of diely) {
    const st = d.st;
    if (!st) continue;
    if (d.typ === 'zberac_vody' && o.dazd > 0.15) st.v = Math.min(VODA_MAX, st.v + o.dazd * dt / 12);   // silny dazd = dusok za ~12 s
    if (d.typ === 'susiak' && o.dazd < 0.15) {
      const k = 0.33 + 0.67 * o.svetlo;
      for (const s of st.sl) if (!s.hotove && (s.t -= dt * k) <= 0) s.hotove = true;
    }
    if (d.typ === 'kamenna_pec') {
      if (st.p > 0) {
        st.p = Math.max(0, st.p - dt);
        for (const s of st.sl) if (!s.hotove && (s.t -= dt) <= 0) s.hotove = true;
        if (Math.random() < dt * 4) dymZ(d);
      }
    }
    if (d.typ === 'zberac_vody' || d.typ === 'kamenna_pec') vizual(d);
  }
}
export const pecHori = d => d.typ === 'kamenna_pec' && d.st?.p > 0;

// hladina vody v zberaci a ziara v peci
const MAT_VODA = new THREE.MeshStandardMaterial({ color: 0x3f8fb0, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85 });
const MAT_ZAR = new THREE.MeshBasicMaterial({ color: 0xff7a20 });
function vizual(d) {
  if (!d.model) return;
  if (!d.viz) {
    d.viz = d.typ === 'zberac_vody'
      ? new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.02, 12), MAT_VODA)
      : new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.6), MAT_ZAR);
    if (d.typ === 'kamenna_pec') d.viz.position.set(0, 0.12, 0);
    d.model.add(d.viz);
  }
  if (d.typ === 'zberac_vody') { d.viz.visible = d.st.v > 0.05; d.viz.position.y = 0.05 + 0.62 * d.st.v / VODA_MAX; }
  else d.viz.visible = d.st.p > 0;
}
// dym z komina pece (volitelne castice z main.js)
export function nastavDym(castice) { dym = castice; }
function dymZ(d) {
  if (!dym) return;
  const c = Math.cos(d.u), s = Math.sin(d.u), lx = 0, lz = 0.35;   // komin je posunuty v lokalnom z
  dym.vypust(d.x + lx * c + lz * s, d.y + 2.8, d.z - lx * s + lz * c, (Math.random() - 0.5) * 0.3, 0.8 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3, 0x9a9a9a, 2.5, -0.2);
}

// ---------- interakcia (E) ----------
const FUNKCNE = new Set(['truhlica', 'zberac_vody', 'susiak', 'kamenna_pec', 'hamaka']);
export function najdiFunkcnu(x, z, fx, fz) {
  let naj = null, najD = 2.4;
  for (const d of diely) {
    if (!FUNKCNE.has(d.typ)) continue;
    const dx = d.x - x, dz = d.z - z, v = Math.hypot(dx, dz);
    if (v > najD) continue;
    if (v > 0.8 && (dx * fx + dz * fz) / v < 0.2) continue;   // musi byt pred hracom
    najD = v; naj = d;
  }
  return naj;
}

// vrati { text, akcia } pre stavbu d; h = sluzby z main.js
// h: { vybrany, pocet, odober, pridaj, zjedz, smad, hodina, otvorSklad, spi, oznam }
export function obsluha(d, h) {
  const st = d.st, v = h.vybrany;
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.ceil(s % 60)).padStart(2, '0')}`;
  if (d.typ === 'truhlica') {
    const plne = st.sk.filter(Boolean).length;
    return { text: `<kbd>E</kbd> otvoriť truhlicu (${plne}/${st.sk.length})`, akcia: () => h.otvorSklad(st.sk, 'Truhlica') };
  }
  if (d.typ === 'zberac_vody') {
    const n = Math.floor(st.v);
    if (n < 1) return { text: `Zberač je prázdny – naplní ho dážď 🌧 (${Math.round(st.v / VODA_MAX * 100)} %)`, akcia: null };
    return { text: `<kbd>E</kbd> napiť sa 💧 (${n}/${VODA_MAX})`, akcia: () => {
      if (h.smad >= 98) return h.oznam('Nie si smädný');
      h.zjedz({ id: 'dazdova_voda', jedlo: { sytost: 0, voda: VODA_DUSOK } }); st.v -= 1; h.oznam('💧 Napil si sa dažďovej vody');
    } };
  }
  if (d.typ === 'susiak' || d.typ === 'kamenna_pec') {
    const pec = d.typ === 'kamenna_pec', TAB = pec ? PECENIE : SUSENIE, MAX = pec ? PEC_MAX : SUSIAK_MAX;
    const hotove = st.sl.filter(s => s.hotove);
    const vlozit = v && TAB[v.id] && st.sl.length < MAX;
    const info = [];
    if (pec) info.push(st.p > 0 ? `🔥 ${mmss(st.p)}` : 'vyhasnutá');
    const bezi = st.sl.filter(s => !s.hotove);
    if (bezi.length) info.push(`${pec ? 'pečie' : 'suší'} sa ${bezi.length}× (${mmss(Math.max(...bezi.map(s => s.t)))})`);
    const inf = info.length ? ' · ' + info.join(' · ') : '';
    if (hotove.length) return { text: `<kbd>E</kbd> vybrať ${hotove.length}× ${PREDMETY[TAB[hotove[0].typ]].ikona}${inf}`, akcia: () => {
      for (const s of hotove) { if (h.pridaj(TAB[s.typ], 1)) { h.oznam('Batoh je plný'); break; } st.sl.splice(st.sl.indexOf(s), 1); h.oznam(`+1 ${PREDMETY[TAB[s.typ]].ikona} ${PREDMETY[TAB[s.typ]].meno}`); }
    } };
    if (vlozit) return { text: `<kbd>E</kbd> ${pec ? 'vložiť do pece' : 'zavesiť na sušiak'}: ${v.ikona} ${v.meno}${inf}`, akcia: () => {
      h.odober(v.id, 1); st.sl.push({ typ: v.id, t: pec ? CAS_PECE * (1 + st.sl.length * 0.25) : CAS_SUSENIA, hotove: false });
    } };
    if (pec && h.pocet('drevo') && st.p < PEC_PALIVO_MAX - PEC_DREVO / 2)
      return { text: `<kbd>E</kbd> ${st.p > 0 ? 'priložiť' : 'zapáliť'} drevo${inf}`, akcia: () => { h.odober('drevo', 1); st.p = Math.min(PEC_PALIVO_MAX, st.p + PEC_DREVO); } };
    const co = pec ? 'surové jedlo (ryba, krab, taro, huba, banán)' : 'rybu alebo ovocie (banán, mango, ananás)';
    return { text: `Vyber do ruky ${co}${pec && !st.p ? ' a pridaj 🪵 drevo' : ''}${inf}`, akcia: null };
  }
  if (d.typ === 'hamaka') {
    const noc = h.hodina >= 19 || h.hodina < 5;
    return { text: noc ? '<kbd>E</kbd> prespať noc v hamake' : '<kbd>E</kbd> zdriemnuť si (nastaví miesto prebudenia)', akcia: () => h.spi(d, noc) };
  }
  return null;
}
