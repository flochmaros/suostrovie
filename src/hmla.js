// Hmla na mape (fog of war) + zoznam navstivenych ostrovov + utrzky map.
// Svet je rozdeleny na bunky 16 m. Odkryte bunky sa pamataju po chunkoch 32 x 32 buniek (512 m):
// 1 chunk = 1024 bitov = 128 bajtov (v ulozeni base64 ~172 znakov, uplne odkryty chunk len "1").
// Svet je nekonecny, ale ukladaju sa len chunky, kde si uz bol.
import { vyskaTerenu, ostrovPri, ostrovVBunke, MENOVANE_OSTROVY, BUNKA } from './svet.js';
import { pridajZnacku } from './znacky.js';

export const HB = 16;                 // velkost bunky hmly (m)
const CN = 32;                        // buniek na stranu chunku
const BAJTY = CN * CN / 8;
const R_PESO = 120, R_LOD = 200;      // polomer odkryvania (m)

const chunky = new Map();             // "cx,cz" -> { b: Uint8Array(128), n: pocet odkrytych buniek }
export const navstivene = new Set();  // "bx,bz" ostrovov, na ktore hrac vstupil (len tie maju na mape meno)
export let verzia = 0;                // zmeni sa pri kazdej zmene hmly (mapa podla toho prekresli masku)
let posledny = null;                  // kde sa naposledy odkryvalo

const kluc = o => o.bx + ',' + o.bz;
export const jeNavstiveny = o => navstivene.has(kluc(o));

function chunk(cx, cz) {
  const k = cx + ',' + cz;
  let c = chunky.get(k);
  if (!c) chunky.set(k, c = { b: new Uint8Array(BAJTY), n: 0 });
  return c;
}

// odkryje kruh s polomerom r (m)
export function odkry(x, z, r) {
  let zmena = false;
  const j1 = Math.floor((z + r) / HB), i1 = Math.floor((x + r) / HB);
  for (let j = Math.floor((z - r) / HB); j <= j1; j++) for (let i = Math.floor((x - r) / HB); i <= i1; i++) {
    if (Math.hypot((i + 0.5) * HB - x, (j + 0.5) * HB - z) > r) continue;
    const cx = Math.floor(i / CN), cz = Math.floor(j / CN), n = (j - cz * CN) * CN + (i - cx * CN);
    const c = chunk(cx, cz), bit = 1 << (n & 7);
    if (c.b[n >> 3] & bit) continue;
    c.b[n >> 3] |= bit; c.n++; zmena = true;
  }
  if (zmena) verzia++;
}

export function jeOdkryte(x, z) {
  const i = Math.floor(x / HB), j = Math.floor(z / HB), cx = Math.floor(i / CN), cz = Math.floor(j / CN);
  const c = chunky.get(cx + ',' + cz);
  if (!c) return false;
  const n = (j - cz * CN) * CN + (i - cx * CN);
  return !!(c.b[n >> 3] & (1 << (n & 7)));
}

// je v obdlzniku (metre) aspon jeden chunk s niecim odkrytym? (mapa nemusi generovat teren, ktory aj tak zakryje hmla)
export function nieceOdkryte(x0, z0, x1, z1) {
  const S = CN * HB;
  for (let cz = Math.floor(z0 / S); cz <= Math.floor(z1 / S); cz++)
    for (let cx = Math.floor(x0 / S); cx <= Math.floor(x1 / S); cx++) if (chunky.has(cx + ',' + cz)) return true;
  return false;
}

// vyplni pole (W x H buniek od bunky i0, j0): 0 = odkryte, 1 = hmla
export function poleHmly(i0, j0, W, H) {
  const a = new Float32Array(W * H).fill(1);
  for (let cz = Math.floor(j0 / CN); cz <= Math.floor((j0 + H - 1) / CN); cz++)
    for (let cx = Math.floor(i0 / CN); cx <= Math.floor((i0 + W - 1) / CN); cx++) {
      const c = chunky.get(cx + ',' + cz);
      if (!c) continue;
      const ox = cx * CN - i0, oz = cz * CN - j0;
      for (let v = 0; v < CN; v++) {
        const y = oz + v;
        if (y < 0 || y >= H) continue;
        for (let u = 0; u < CN; u++) {
          const x = ox + u, n = v * CN + u;
          if (x >= 0 && x < W && (c.b[n >> 3] & (1 << (n & 7)))) a[y * W + x] = 0;
        }
      }
    }
  return a;
}

// polomer rozhladu: z lode dalej, z kopca este dalej (kazdy meter nad 4 m pridava 5 m, najviac +180 m)
export function polomerRozhladu(x, z, naLodi) {
  if (naLodi) return R_LOD;
  return R_PESO + Math.min(180, Math.max(0, vyskaTerenu(x, z) - 4) * 5);
}

// volat kazdy snimok; suchy = hrac ide po svojich (nesedi v lodi a neplave) -> moze "vstupit" na ostrov
export function aktualizujHmlu(x, z, { naLodi = false, suchy = false } = {}) {
  if (!posledny || naLodi !== posledny.naLodi || Math.hypot(x - posledny.x, z - posledny.z) > 6) {
    posledny = { x, z, naLodi };
    odkry(x, z, polomerRozhladu(x, z, naLodi));
  }
  if (!suchy) return;
  const o = ostrovPri(x, z, 1.3);
  if (o && !navstivene.has(kluc(o)) && vyskaTerenu(x, z) > 0.15) { navstivene.add(kluc(o)); verzia++; }
}

// ---------- ukladanie ----------
const naB64 = b => btoa(String.fromCharCode(...b));
const zB64 = t => Uint8Array.from(atob(t), c => c.charCodeAt(0));
const pocetBitov = b => b.reduce((s, v) => { for (; v; v &= v - 1) s++; return s; }, 0);

export function ulozHmlu() {
  const c = {};
  for (const [k, v] of chunky) c[k] = v.n === CN * CN ? '1' : naB64(v.b);
  return { c, n: [...navstivene] };
}

// u = cele ulozenie slotu (alebo null pri novej hre)
export function nacitajHmlu(u) {
  if (!u) return;
  if (!u.hmla) return zoStarehoUlozenia(u);
  for (const [k, t] of Object.entries(u.hmla.c || {})) {
    const b = t === '1' ? new Uint8Array(BAJTY).fill(255) : zB64(t);
    if (b.length === BAJTY) chunky.set(k, { b, n: pocetBitov(b) });
  }
  for (const k of u.hmla.n || []) navstivene.add(k);
  verzia++;
}

// stare ulozenie bez hmly: odkryje okolie hraca, lodi, stavieb, ohnov a ostrovov, na ktorych uz bol
function zoStarehoUlozenia(u) {
  if (Array.isArray(u.hrac)) odkry(u.hrac[0], u.hrac[2], R_LOD);
  for (const l of u.lode || []) odkry(l.x, l.z, R_PESO);
  for (const s of [...(u.stavby || []), ...(u.ohne || [])]) if (isFinite(s.x) && isFinite(s.z)) odkry(s.x, s.z, R_PESO);
  for (const k of u.objavene || []) {
    const [bx, bz] = k.split(',').map(Number);
    const o = MENOVANE_OSTROVY.find(m => m.bx === bx && m.bz === bz) || ostrovVBunke(bx, bz);
    if (!o) continue;
    odkry(o.x, o.z, o.R * 1.4 + 60);
    navstivene.add(k);
  }
}

// ---------- utrzky map ----------
const STRANY = ['sever', 'severovýchod', 'východ', 'juhovýchod', 'juh', 'juhozápad', 'západ', 'severozápad'];

// najde najblizsi vzdialeny ostrov, ktory este nie je na mape, odkryje ho a da nan znacku
// vrati { vzd, smer } alebo null, ak v dosahu nic nove nie je
export function pouziUtrzok(px, pz) {
  const bx = Math.floor(px / BUNKA), bz = Math.floor(pz / BUNKA), kandidati = new Set(MENOVANE_OSTROVY);
  for (let j = -9; j <= 9; j++) for (let i = -9; i <= 9; i++) {
    const o = ostrovVBunke(bx + i, bz + j);
    if (o) kandidati.add(o);
  }
  let naj = null, nd = Infinity;
  for (const o of kandidati) {
    const d = Math.hypot(o.x - px, o.z - pz);
    if (d < nd && d > 400 && o.R >= 24 && !jeNavstiveny(o) && !jeOdkryte(o.x, o.z)) { naj = o; nd = d; }
  }
  if (!naj) return null;
  odkry(naj.x, naj.z, naj.R * 1.35 + 50);
  pridajZnacku({ x: naj.x, z: naj.z, t: 'poklad', n: 'Z útržku mapy' });
  const a = Math.atan2(naj.x - px, -(naj.z - pz)) * 180 / Math.PI;
  return { vzd: Math.round(nd / 10) * 10, smer: STRANY[Math.round((a + 360) % 360 / 45) % 8], x: naj.x, z: naj.z };
}
