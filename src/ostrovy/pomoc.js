// Pomocne funkcie pre rucne navrhnute ostrovy (bez zavislosti na Three.js -> funguje v hre aj v nahlade nastroje/ostrov.html).
// Ostrov dostane tento objekt ako parameter P vo funkciach vyska(), vegetacia.zona(), farba(), pamiatky().

// ---------- Perlinov sum (klasicka permutacia Kena Perlina) ----------
const PERM = [151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10,
  23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125,
  136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41,
  55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188,
  159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59,
  227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129,
  22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179,
  162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150,
  254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180];
const p = new Uint8Array(512);
for (let i = 0; i < 512; i++) p[i] = PERM[i & 255];
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
function grad(h, x, y, z) {
  h &= 15;
  const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}
// noise(x, y, z) -> priblizne -1..1 (vacsinou -0.6..0.6)
export function noise(x, y, z = 0) {
  const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
  const X = fx & 255, Y = fy & 255, Z = fz & 255;
  x -= fx; y -= fy; z -= fz;
  const u = fade(x), v = fade(y), w = fade(z);
  const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
  return lerp(lerp(lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u),
    lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
  lerp(lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u),
    lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v), w);
}
// fraktalny sum: okt oktav, kazda 2x jemnejsia a polovicna -> priblizne -1..1
export function fbm(x, z, s = 0, okt = 3) {
  let a = 0, f = 1, m = 1, suma = 0;
  for (let i = 0; i < okt; i++) { a += noise(x * f, z * f, s + i * 3.7) * m; suma += m; f *= 2.03; m *= 0.5; }
  return a / suma * 1.6;
}
// "hrebenovy" sum 0..1: ostre hrebene (skaly, ryhy po lave)
export const ridge = (x, z, s = 0) => 1 - Math.abs(noise(x, z, s)) * 2;

// ---------- matematika ----------
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export { lerp };
export function smooth(e0, e1, x) { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
// hladke maximum / minimum (k = sirka zaoblenia v metroch)
export function hmax(a, b, k = 4) { const d = Math.abs(a - b); if (d >= k) return Math.max(a, b); const t = (k - d) / k; return Math.max(a, b) + t * t * k * 0.25; }
export function hmin(a, b, k = 4) { return -hmax(-a, -b, k); }
export const dist = (x, z, x0 = 0, z0 = 0) => Math.hypot(x - x0, z - z0);
// vzdialenost bodu od usecky (a -> b) - na rieky, hrebene, kosy
export function distUsecka(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz;
  const t = l ? clamp(((x - ax) * dx + (z - az) * dz) / l, 0, 1) : 0;
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}
// mulberry32: rovnaky seed = rovnake "nahodne" cisla 0..1
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- tvary pobrezia ----------
// Zakladny profil ostrova: t > 0 = suchá zem (0 na brehu, 1 v strede), t < 0 = more.
// Vrati vysku: na suchu H * t^exp, pod vodou plynulo klesa do hlbky ~ -12 az -30 m.
export function profil(t, H, exp = 1.4) {
  if (t >= 0) return H * Math.pow(t, exp);
  return -(-t * 14 + t * t * 80);
}
// "zem" 0..1 pre nepravidelny ostrov: d = vzdialenost od stredu, R = polomer brehu, okraj = kolko sumu na brehu (0.2-0.35)
export function zem(x, z, R, s = 0, okraj = 0.28) {
  return 1 - Math.hypot(x, z) / R + okraj * fbm(x * 0.012, z * 0.012, s);
}
// pretiahnuty tvar: elipsa s polosami a, b otocena o uhol (rad)
export function elipsa(x, z, a, b, uhol = 0) {
  const c = Math.cos(uhol), s = Math.sin(uhol), u = x * c + z * s, v = -x * s + z * c;
  return Math.hypot(u / a, v / b);       // 1 = na okraji elipsy
}
