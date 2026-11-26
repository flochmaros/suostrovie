// Spravanie hororoveho ostrova (Ticha zatoka) pocas hry:
//   - miestny priliv: cez den je pri ostrove voda takmer nehybna a zakryva vchod do jaskyne, v noci klesne o ~1.9 m
//   - jaskyna: strecha sa da prejst zvrchu, vnutri drzia hraca steny, kamera neprejde skalou, vnutri je tma
//   - nocna atmosfera: plazivá hmla len v lese pri zemi (nie plosna sedá stena), les je tmavsi a hustejsi, plaz a voda ostavaju citatelne
import * as THREE from 'three';
import { tichaZatoka, hororovaZona, vyskaBezJaskyne, STRED } from './ostrovy/ticha_zatoka.js';
import * as J from './ostrovy/ticha_zatoka_jaskyna.js';
import { lesnost } from './ostrovy/ticha_zatoka_les.js';
import { miestnyPriliv, priliv, uNoc } from './ocean.js';
import { vyskaTerenu } from './svet.js';
import { smooth } from './ostrovy/pomoc.js';

export { hororovaZona, tichaZatoka };

const [OX, OZ] = STRED;
const h0 = vyskaBezJaskyne;
const vchodX = OX + J.JX, vchodZ = OZ + J.JZ;
const ODLIV = 1.9;                       // o kolko metrov v noci klesne more pri ostrove
const BRANA = -1.0;                      // nad touto hladinou sa cez vchod neda prejst (je zatopeny)

// 0..1 nocny odliv podla hernej hodiny: klesa 20:00-21:30, stupa 4:30-5:45
export const silaOdlivu = h => h >= 12 ? smooth(20, 21.5, h) : smooth(5.75, 4.5, h);
export const vchodOtvoreny = t => priliv(t) < BRANA;

// volat na zaciatku snimku: nastavi priliv podla toho, ako blizko je hrac k ostrovu
export function aktualizujOdliv(x, z, hodina) {
  const k = smooth(420, 250, Math.hypot(x - OX - 35, z - OZ - 15));
  miestnyPriliv.zona = k;
  miestnyPriliv.pokles = ODLIV * k * silaOdlivu(hodina);
}

// ---------- jaskyna: kolizie ----------
const blizko = (x, z) => Math.abs(x - vchodX) < 30 && z - vchodZ > -4 && z - vchodZ < 55;
// strecha jaskyne ako podlaha pre hraca, ktory je nad nou
export function vyskaStrechy(x, z, y) {
  return blizko(x, z) ? J.strechaPre(x - OX, z - OZ, y, h0) : -Infinity;
}
let predV = -99, poslednyOznam = 0, oznamFn = null;
export function odtlacOdJaskyne(poz) {
  if (!blizko(poz.x, poz.z)) { predV = -99; return; }
  const v = poz.z - vchodZ, uVchode = Math.abs(poz.x - vchodX) < J.sirka(0) + 0.6;
  // zatopeny vchod: zvonku sa neda dnu (kto je uz vnutri, moze von)
  if (uVchode && v > -0.7 && v < 2 && predV <= -0.7 && priliv(casHry) > BRANA && poz.y < 1.5) {
    poz.z = vchodZ - 0.7;
    if (casHry - poslednyOznam > 8) { poslednyOznam = casHry; oznamFn?.('Pod hladinou je pod útesom tmavá diera… voda je tu zatiaľ privysoko.'); }
    return;
  }
  const l = { x: poz.x - OX, y: poz.y, z: poz.z - OZ };
  if (v > -0.7 && v < 0.15 && !uVchode && poz.y < 1.5) l.z = J.JZ - 0.7;      // stena utesu vedla vchodu
  else J.drzVJaskyni(l, h0);
  poz.x = l.x + OX; poz.z = l.z + OZ;
  predV = poz.z - vchodZ;
}
// kamera nesmie prejst do skaly: vrati najvacsiu volnu vzdialenost od ciela v smere
const bod = new THREE.Vector3();
export function vzdialenostKJaskyni(ciel, smer, max) {
  if (!blizko(ciel.x, ciel.z) && !blizko(ciel.x + smer.x * max, ciel.z + smer.z * max)) return Infinity;
  for (let d = 0.25; d <= max; d += 0.25) {
    bod.copy(ciel).addScaledVector(smer, d);
    if (J.vSkale(bod.x - OX, bod.y, bod.z - OZ, h0)) return d - 0.25;
  }
  return Infinity;
}

// ---------- atmosfera ----------
const N_HMLA = 110;
let hmla = null, svetlo = null, oci = null, casHry = 0, uvitane = false;
const kotvy = [];
export const stavZony = { noc: 0, jaskyna: 0 };

function texturaHmly() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  // niekolko prekrytych makkych kruhov = nepravidelny chumac
  for (let i = 0; i < 14; i++) {
    const x = 64 + Math.sin(i * 2.4) * 28, y = 64 + Math.cos(i * 1.7) * 14, r = 20 + (i % 4) * 8;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.34)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(c);
}

export function initHororovaZona(scena, oznam) {
  oznamFn = oznam;
  const tex = texturaHmly();
  hmla = new THREE.Group(); hmla.visible = false;
  // chumace hmly: nahodne po ostrove a lagune (pevne miesta, jemne sa prevaluju)
  const r = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };
  // len v lese (kde je lesnost > 0.5), nizke ploche pasy pri zemi; po lagune a plazi hmla nie je
  for (let i = 0, pokus = 0; i < N_HMLA && pokus < 4000; pokus++) {
    const lx = -110 + r(pokus, 1) * 310, lz = -90 + r(pokus, 2) * 240, h = h0(lx, lz);
    if (h < 2.3 || lesnost(lx, lz, h) < 0.5) continue;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x7d8b96, transparent: true, opacity: 0, depthWrite: false }));
    const w = 7 + r(i, 3) * 9;
    s.scale.set(w, w * 0.2, 1);
    kotvy.push({ s, x: OX + lx, z: OZ + lz, zem: null, f: r(i, 4) * 6.28, a: 0.5 + r(i, 5) * 0.5 });
    hmla.add(s); i++;
  }
  scena.add(hmla);
  // jedine svetlo jaskyne: slaby studeny svit v komore (je v scene stale, aby sa shadery neprekompilovavali)
  svetlo = new THREE.PointLight(0x50d8c0, 0, 20, 1.6);
  const k = tichaZatoka.jaskyna.komora;
  svetlo.position.set(k.x, k.y + 3, k.z + 2);
  scena.add(svetlo);
  // "oci privyknute na tmu": slaby sedomodry svit pri hracovi, aby bolo v jaskyni vidiet obrysy stien
  oci = new THREE.PointLight(0x8aa0b8, 0, 13, 1.1);
  scena.add(oci);
}

const NOCNA = new THREE.Color(0x0b1218), JASKYNA = new THREE.Color(0x020405), HMLA_DEN = new THREE.Color(0xaab6bc), HMLA_NOC = new THREE.Color(0xa9bccd);
const farbaChumaca = new THREE.Color();

// volat po aktualizujPocasie a po nastaveni scena.fog (to ich kazdy snimok prepise, preto tu mozeme nasobit)
export function aktualizujHororovuZonu(cas, { scena, kamera, g, stred, podVodou }) {
  casHry = cas;
  const zona = hororovaZona(stred.x, stred.z), noc = zona * uNoc.value;
  const jaskyna = J.hlbkaVJaskyni(kamera.position.x - OX, kamera.position.y, kamera.position.z - OZ);
  stavZony.noc = noc; stavZony.jaskyna = jaskyna;

  if (noc > 0.001 && !podVodou) {
    // pri plazi a vode len jemne stmavenie (cesta k jaskyni je citatelna); v hustom lese blizsia a tmavsia hmla
    const les = lesnost(stred.x - OX, stred.z - OZ, stred.y);
    scena.fog.color.lerp(NOCNA, noc * (0.3 + 0.4 * les));
    scena.fog.near = THREE.MathUtils.lerp(scena.fog.near, THREE.MathUtils.lerp(30, 6, les), noc);
    scena.fog.far = THREE.MathUtils.lerp(scena.fog.far, THREE.MathUtils.lerp(300, 85, les), noc);
    g.hemi.intensity *= 1 - 0.38 * noc;
    g.slnko.intensity *= 1 - 0.3 * noc;
    g.renderer.toneMappingExposure *= 1 - 0.14 * noc;
  }
  if (jaskyna > 0) {
    // vnutri nesvieti obloha ani slnko; ostava len slaby odlesk, aby sa dalo orientovat
    g.hemi.intensity = THREE.MathUtils.lerp(g.hemi.intensity, 0.22, jaskyna);
    g.slnko.intensity *= 1 - jaskyna;
    if (!podVodou) {
      scena.fog.color.lerp(JASKYNA, jaskyna);
      scena.fog.near = THREE.MathUtils.lerp(scena.fog.near, 5, jaskyna);
      scena.fog.far = THREE.MathUtils.lerp(scena.fog.far, 42, jaskyna);
    }
  }
  const dalekoJ = Math.hypot(stred.x - vchodX, stred.z - vchodZ - 25) > 70;
  svetlo.intensity = dalekoJ ? 0 : 22 * (0.85 + 0.15 * Math.sin(cas * 1.3));

  oci.position.set(stred.x, stred.y + 2.1, stred.z - 0.4);
  oci.intensity = 5.5 * jaskyna;

  // chumace nizkej hmly: v noci huste, cez den ziadne
  hmla.visible = noc > 0.02 && jaskyna < 0.9;
  if (hmla.visible) {
    const hladina = priliv(cas);
    let nove = 12;                                       // vysku terenu pocitaj postupne
    farbaChumaca.copy(HMLA_DEN).lerp(HMLA_NOC, uNoc.value);
    for (const k of kotvy) {
      if (k.zem === null) { if (nove-- <= 0) continue; k.zem = vyskaTerenu(k.x, k.z); }
      const x = k.x + Math.sin(cas * 0.07 + k.f) * 4, z = k.z + Math.cos(cas * 0.05 + k.f * 1.7) * 4;
      const y = Math.max(k.zem, hladina) + 0.35 + Math.sin(cas * 0.23 + k.f) * 0.08;
      k.s.position.set(x, y, z);
      // tesne pred kamerou sa chumac strati (inak by zakryl obraz); v utese nad zemou hmla nie je
      const blizkoKamery = smooth(3, 11, k.s.position.distanceTo(kamera.position));
      k.s.material.opacity = noc * 0.3 * k.a * blizkoKamery * (1 - jaskyna);
      k.s.material.color.copy(farbaChumaca);
    }
  }
}

// prva navsteva: jemny naznak (len raz za spustenie hry)
export function naznakTicha(stred) {
  if (!uvitane && hororovaZona(stred.x, stred.z) > 0.98) { uvitane = true; return true; }
  return false;
}
