// Nahodne cisla so seedom: rovnaky vstup = vzdy rovnaky vysledok (svet sa neuklada, pocita sa)
export function hash(a, b, s) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(s, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// mulberry32: z jedneho cisla rad "nahodnych" cisel 0..1
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
