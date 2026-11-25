// Fakla: horenie v ruke aj zapichnuta v zemi, plamen, iskry, dym, teple blikajuce svetlo a zvuk.
// Zostavajuci cas horenia je v policku batohu (slot.trv, sekundy) -> uklada sa sam a v batohu ma ukazovatel.
// Fakla odlozena z ruky NEHORI (setri sa), zapichnuta v zemi hori dalej.
// Vo vode a v silnom dazdi zhasne (slot.zhas); znova sa zapali opatovnym vybratim z listy (v suchu) alebo pri ohni.
import * as THREE from 'three';
import { vyskaTerenu } from './svet.js';
import { uFaklaPoz, uFaklaFarba } from './ocean.js';
import { vytvorCastice, MAPA_KRUH } from './castice.js';
import { PREDMETY } from './obsah/predmety.js';
import { FAKLA_VRCH } from './obsah/modely_predmetov.js';
import { sloty, vybranyIndex, pridaj, vykresli, obnov } from './inventar.js';
import { najblizsiOhen, hori } from './ohen.js';
import { fakla as zvukFakle, zvuky } from './zvuk.js';

export const HORENIE = PREDMETY.fakla.horenie;   // sekund
const DOHASINA = 35;                              // poslednych X sekund slabne a blika
const SILNY_DAZD = 0.55;                          // od akej sily dazda fakla hasne
const DAZD_VYDRZI = 3;                            // sekund v silnom dazdi
const SVIETIVOST = 17, DOSAH = 24;
const ZAP_SVETIEL = 2;                            // svieti len najblizsich par zapichnutych (staly pocet svetiel!)
const FARBY = [0xffc15a, 0xff8c1f, 0xff5a0a, 0xffe08a];

let scena, sluzby, plamene, iskry, dym, ruka;
const svetlaZeme = [];
const zapichnute = [];            // { x, y, z, trv, zhas, mesh, plamen, svetlo-faza, mokro }
let cas = 0, mokroRuka = 0, poslednyDielik = -1, varovane = null;

// ---------- plamen: dve kvapky (vonkajsia oranzova, vnutorna zlta) + makka ziara; vzdy stoji zvisle ----------
let GEO_KVAPKA = null, MAT_VONK, MAT_VNUT;
function vytvorPlamen() {
  if (!GEO_KVAPKA) {
    const body = [[0, 0], [0.6, 0.08], [0.95, 0.25], [0.8, 0.45], [0.45, 0.68], [0.16, 0.86], [0, 1]];
    GEO_KVAPKA = new THREE.LatheGeometry(body.map(b => new THREE.Vector2(b[0], b[1])), 10);
    const mat = (r, g, b, o) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    MAT_VONK = mat(2.4, 0.62, 0.07, 0.5);
    MAT_VNUT = mat(3.6, 2.1, 0.55, 0.75);
  }
  const g = new THREE.Group();
  const vonk = new THREE.Mesh(GEO_KVAPKA, MAT_VONK), vnut = new THREE.Mesh(GEO_KVAPKA, MAT_VNUT);
  const ziara = new THREE.Sprite(new THREE.SpriteMaterial({ map: MAPA_KRUH, color: 0xff7a20, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  ziara.position.y = 0.1;
  g.add(vonk, vnut, ziara);
  g.userData = { vonk, vnut, ziara };
  g.visible = false;
  scena.add(g);
  return g;
}
// tvar plamena + castice v bode p (spodok plamena); sila 0..1
function kresliPlamen(g, p, sila, faza, dt, vx, vz, castice) {
  g.visible = true;
  g.position.copy(p);
  const { vonk, vnut, ziara } = g.userData;
  const a = Math.sin(cas * 13 + faza), b = Math.sin(cas * 29.7 + faza * 2.3);
  const vel = 0.45 + 0.55 * sila;
  vonk.scale.set(0.07 * vel * (1 + 0.12 * b), 0.25 * vel * (1 + 0.2 * a + 0.1 * Math.random()), 0.07 * vel * (1 - 0.1 * b));
  vnut.scale.set(0.038 * vel, 0.14 * vel * (1 + 0.16 * b), 0.038 * vel);
  vonk.rotation.set(vz * 0.12 + 0.09 * b, cas * 3, -vx * 0.12 + 0.09 * a);   // naklana sa vo vetre a pri pohybe
  vnut.rotation.copy(vonk.rotation);
  ziara.scale.setScalar(0.75 * vel * (1 + 0.1 * a));
  if (!castice) return;
  for (let n = Math.floor(42 * sila * dt + Math.random()); n > 0; n--) {
    const u = Math.random() * 6.28, r = Math.random() * 0.045;
    plamene.vypust(p.x + Math.cos(u) * r, p.y + 0.03 + Math.random() * 0.06, p.z + Math.sin(u) * r,
      vx * 0.15 - Math.cos(u) * r * 1.5, 0.35 + Math.random() * 0.6, vz * 0.15 - Math.sin(u) * r * 1.5,
      FARBY[Math.floor(Math.random() * FARBY.length)], 0.16 + Math.random() * 0.24 * sila, -2.4);
  }
  if (Math.random() < dt * 3.5 * sila) iskry.vypust(p.x, p.y + 0.15, p.z, (Math.random() - 0.5) * 0.8 + vx * 0.3, 0.8 + Math.random() * 1.4, (Math.random() - 0.5) * 0.8 + vz * 0.3, 0xffa040, 0.5 + Math.random() * 0.9, 0.7);
  if (Math.random() < dt * 5) dym.vypust(p.x, p.y + 0.34, p.z, vx * 0.4 + (Math.random() - 0.5) * 0.2, 0.55 + Math.random() * 0.3, vz * 0.4 + (Math.random() - 0.5) * 0.2, 0x5a534c, 1.2 + Math.random(), -0.1);
}
function oblakDymu(x, y, z, n = 14) {
  for (let i = 0; i < n; i++) dym.vypust(x + (Math.random() - 0.5) * 0.15, y + Math.random() * 0.15, z + (Math.random() - 0.5) * 0.15,
    (Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 0.9, (Math.random() - 0.5) * 0.8, 0x9a958e, 1 + Math.random() * 1.5, -0.15);
}

// sila svetla 0..1 podla zostavajuceho casu; na konci slabne a obcas takmer zhasne
const vypadky = new WeakMap();
function silaHorenia(o, dt) {
  if (o.trv >= DOHASINA) return 1;
  const k = o.trv / DOHASINA;                       // 1 -> 0
  let v = vypadky.get(o) ?? 0;
  v = Math.max(0, v - dt);
  if (!v && Math.random() < dt * (0.35 + 1.6 * (1 - k))) v = 0.07 + Math.random() * 0.22;
  vypadky.set(o, v);
  return (0.22 + 0.78 * k) * (v ? 0.4 : 1);
}
const blikanie = faza => 0.87 + 0.07 * Math.sin(cas * 10.3 + faza) + 0.045 * Math.sin(cas * 24.1 + faza * 2) + 0.035 * Math.random();
function nastavSvetlo(l, p, sila, faza) {
  l.intensity = SVIETIVOST * sila * blikanie(faza);
  l.distance = DOSAH * (0.55 + 0.45 * sila);
  l.color.setRGB(1, 0.46 + 0.1 * sila, 0.17 + 0.06 * sila);        // slabnuca fakla je cervensia
  // zdroj sa jemne "tanci" -> tiene a odlesky ozivnu
  l.position.set(p.x + Math.sin(cas * 7.3 + faza) * 0.035, p.y + 0.32 + Math.sin(cas * 11.7 + faza) * 0.02, p.z + Math.cos(cas * 6.1 + faza) * 0.035);
}

export function initFakla(s, o) {
  scena = s; sluzby = o;
  // svetla su v scene od zaciatku s intenzitou 0 -> pocet svetiel sa nemeni, shadery sa neprekompiluju.
  // Bez tienov: tien bodoveho svetla = 6 dalsich kresleni sveta za snimok.
  const novel = () => { const l = new THREE.PointLight(0xff8a30, 0, DOSAH, 1.65); scena.add(l); return l; };
  ruka = { svetlo: novel(), plamen: vytvorPlamen(), horela: false, slot: null, rozhor: 0, p: new THREE.Vector3(), predtym: new THREE.Vector3() };
  for (let i = 0; i < ZAP_SVETIEL; i++) svetlaZeme.push(novel());
  plamene = vytvorCastice(scena, { pocet: 500, velkost: 0.15, aditivne: true, vrstva: 0, jas: 2.1 });
  iskry = vytvorCastice(scena, { pocet: 160, velkost: 0.045, aditivne: true, vrstva: 0, jas: 6 });
  dym = vytvorCastice(scena, { pocet: 240, velkost: 0.42, vrstva: 0, nepriehladnost: 0.2 });
}

const faklaVRuke = () => { const s = sloty[vybranyIndex()]; return s?.typ === 'fakla' ? s : null; };
// hori fakla v ruke? (pre dalsie fazy, napr. Bledi sa boja ohna)
export const horiVRuke = () => ruka?.horela ?? false;
// poloha a sila vsetkych horiacich fakli [{x, z, sila}] (pre dalsie fazy)
export function horiaceFakle() {
  const v = zapichnute.filter(z => !z.zhas).map(z => ({ x: z.x, z: z.z, sila: Math.min(1, z.trv / DOHASINA) }));
  if (ruka?.horela) v.push({ x: ruka.p.x, z: ruka.p.z, sila: Math.min(1, ruka.slot.trv / DOHASINA) });
  return v;
}

// vybratie faklu z listy: zhasnutu sa pokusi zapalit (v suchu)
export function skusZapalit(vMokre) {
  const s = faklaVRuke();
  if (!s?.zhas) return;
  if (vMokre) return sluzby.oznam('Tu faklu nezapáliš – je príliš mokro');
  s.zhas = false;
}
// odpali kus horenia (napr. zapalenie pahreby faklou)
export function minHorenie(sekund) { const s = faklaVRuke(); if (s) s.trv = Math.max(1, s.trv - sekund); }

// F: zapichnut faklu z ruky do zeme; vrati true, alebo text preco to nejde
export function zapichni(x, z, vodaY) {
  const i = vybranyIndex(), s = faklaVRuke();
  if (!s) return 'Nemáš v ruke faklu';
  const y = vyskaTerenu(x, z);
  if (y < vodaY + 0.1) return 'Do vody faklu nezapichneš';
  if (zapichnute.some(f => Math.hypot(f.x - x, f.z - z) < 0.5)) return 'Tu už fakľa stojí';
  pridajZapichnutu(x, z, s.trv, !!s.zhas);
  sloty[i] = null; obnov();
  return true;
}
function pridajZapichnutu(x, z, trv, zhas) {
  const [geo, mat] = PREDMETY.fakla.model;
  const mesh = new THREE.Mesh(geo, mat);
  const y = vyskaTerenu(x, z);
  mesh.position.set(x, y - 0.14, z);                       // spodok kusok v zemi
  mesh.rotation.set(Math.sin(x * 7) * 0.08, x * 3 % 6.28, Math.cos(z * 5) * 0.08);
  mesh.castShadow = true;
  scena.add(mesh);
  zapichnute.push({ x, y, z, trv, zhas, mesh, plamen: vytvorPlamen(), faza: Math.random() * 100, mokro: 0, d: 0 });
}
function odstran(f) {
  scena.remove(f.mesh, f.plamen);
  f.plamen.userData.ziara.material.dispose();
  zapichnute.splice(zapichnute.indexOf(f), 1);
}
export function najblizsiaFakla(x, z, d = 1.7) {
  let naj = null;
  for (const f of zapichnute) { const v = Math.hypot(f.x - x, f.z - z); if (v < d) { d = v; naj = f; } }
  return naj;
}
// zobrat zapichnutu faklu spat do batohu; vrati false ak je batoh plny
export function zoberFaklu(f) {
  const volne = sloty.findIndex(s => !s);
  if (volne < 0 || pridaj('fakla', 1) > 0) return false;
  Object.assign(sloty[volne], { trv: f.trv, zhas: f.zhas });
  odstran(f); obnov();
  return true;
}

// volat kazdy snimok (po pohybe hraca a po pocasi)
const v3 = new THREE.Vector3(), smer = new THREE.Vector3();
export function aktualizujFaklu(dt, { hrac, voda, vLodi, dazd, vietor, zivy }) {
  cas += dt;
  const vetX = Math.cos(vietor.smer) * vietor.sila, vetZ = Math.sin(vietor.smer) * vietor.sila;
  let zvukSila = 0;

  // ---------- v ruke ----------
  const s = faklaVRuke(), mesh = hrac.ruka;
  const vMokre = !vLodi && (hrac.plava || hrac.potapa);
  let horiTeraz = false;
  if (s && mesh && zivy) {
    mesh.updateWorldMatrix(true, false);
    mesh.localToWorld(ruka.p.set(0, FAKLA_VRCH, 0));
    if (!s.zhas) {
      mokroRuka = dazd > SILNY_DAZD ? mokroRuka + dt : Math.max(0, mokroRuka - dt);
      const dovod = vMokre ? '💦 Fakľa vo vode zhasla' : mokroRuka > DAZD_VYDRZI ? '🌧 Silný dážď uhasil faklu' : null;
      if (dovod) {
        s.zhas = true; mokroRuka = 0;
        sluzby.oznam(dovod + ' – v suchu ju znova vyber z lišty alebo príď k ohňu');
        zvuky.faklaZhasne(); oblakDymu(ruka.p.x, ruka.p.y, ruka.p.z);
      }
    } else if (!vMokre && dazd <= SILNY_DAZD) {              // pri horiacom ohni sa zapali sama
      const o = najblizsiOhen(hrac.poz.x, hrac.poz.z, 2.4);
      if (o && hori(o)) s.zhas = false;
    }
    if (!s.zhas) {
      horiTeraz = true;
      if (!ruka.horela || ruka.slot !== s) { ruka.rozhor = 0; ruka.predtym.copy(ruka.p); zvuky.faklaZapal(); }
      ruka.slot = s;
      s.trv -= dt;
      ruka.rozhor = Math.min(1, ruka.rozhor + dt * 1.8);
      const sila = silaHorenia(s, dt) * ruka.rozhor;
      // plamen sa pri behu nakloni dozadu
      smer.subVectors(ruka.predtym, ruka.p).divideScalar(Math.max(dt, 1e-3)).clampLength(0, 5);
      ruka.predtym.copy(ruka.p);
      const sx = vetX * 0.8 + smer.x * 0.35, sz = vetZ * 0.8 + smer.z * 0.35;
      kresliPlamen(ruka.plamen, v3.copy(ruka.p).setY(ruka.p.y - 0.035), sila, 0, dt, sx, sz, true);
      // svetlo kusok od tela, aby postava nebola prepalena
      const dx = ruka.p.x - hrac.poz.x, dz = ruka.p.z - hrac.poz.z, d = Math.hypot(dx, dz) || 1;
      nastavSvetlo(ruka.svetlo, v3.copy(ruka.p).add(smer.set(dx / d * 0.22, 0, dz / d * 0.22)), sila, 0);
      uFaklaPoz.value.copy(ruka.svetlo.position);
      uFaklaFarba.value.copy(ruka.svetlo.color).multiplyScalar(sila * blikanie(0));
      zvukSila = 0.55 + 0.45 * sila;
      if (s.trv < DOHASINA && varovane !== s) { varovane = s; sluzby.oznam('🔥 Fakľa dohasína…'); }
      // ukazovatel v liste (prekresli len ked sa viditelne zmeni)
      const dielik = Math.ceil(s.trv / 4);
      if (dielik !== poslednyDielik) { poslednyDielik = dielik; vykresli(); }
      if (s.trv <= 0) {
        sloty[vybranyIndex()] = null; obnov();
        oblakDymu(ruka.p.x, ruka.p.y, ruka.p.z, 20); zvuky.faklaZhasne();
        sluzby.oznam('Fakľa dohorela');
        horiTeraz = false;
      }
    }
  }
  ruka.horela = horiTeraz;
  if (!horiTeraz) { ruka.svetlo.intensity = 0; ruka.plamen.visible = false; uFaklaFarba.value.setRGB(0, 0, 0); }

  // ---------- zapichnute ----------
  for (let i = zapichnute.length - 1; i >= 0; i--) {
    const f = zapichnute[i];
    f.d = Math.hypot(f.x - hrac.poz.x, f.z - hrac.poz.z);
    f.sila = 0;
    if (!f.zhas) {
      f.trv -= dt;
      f.mokro = dazd > SILNY_DAZD ? f.mokro + dt : Math.max(0, f.mokro - dt);
      if (f.mokro > DAZD_VYDRZI) { f.zhas = true; oblakDymu(f.x, f.y + 0.6, f.z); }
    }
    if (f.trv <= 0) { oblakDymu(f.x, f.y + 0.6, f.z); odstran(f); continue; }
    if (f.zhas || f.d > 200) { f.plamen.visible = false; continue; }
    f.sila = silaHorenia(f, dt);
    f.mesh.updateWorldMatrix(true, false);
    f.mesh.localToWorld(v3.set(0, FAKLA_VRCH - 0.035, 0));
    kresliPlamen(f.plamen, v3, f.sila, f.faza, dt, vetX, vetZ, f.d < 60);
    if (f.d < 12) zvukSila = Math.max(zvukSila, (1 - f.d / 12) * 0.8);
  }
  const blizke = zapichnute.filter(f => f.sila > 0).sort((a, b) => a.d - b.d);
  svetlaZeme.forEach((l, i) => {
    const f = blizke[i];
    if (!f) { l.intensity = 0; return; }
    nastavSvetlo(l, v3.set(f.x, f.y + 0.62, f.z), f.sila, f.faza);
  });
  // ked nehori fakla v ruke, voda odraza najblizsiu zapichnutu
  if (!horiTeraz && blizke[0]) { uFaklaPoz.value.copy(svetlaZeme[0].position); uFaklaFarba.value.copy(svetlaZeme[0].color).multiplyScalar(blizke[0].sila); }

  plamene.aktualizuj(dt); iskry.aktualizuj(dt); dym.aktualizuj(dt);
  zvukFakle(zvukSila);
}

export function ulozFakle() {
  return zapichnute.map(f => ({ x: +f.x.toFixed(2), z: +f.z.toFixed(2), t: +f.trv.toFixed(1), zh: f.zhas ? 1 : 0 }));
}
export function nacitajFakle(data) {
  if (!Array.isArray(data)) return;
  for (const d of data) if (Number.isFinite(d?.x) && Number.isFinite(d?.z) && d.t > 0) pridajZapichnutu(d.x, d.z, d.t, !!d.zh);
}
