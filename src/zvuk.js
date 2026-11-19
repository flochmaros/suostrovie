// Zvuky bez suborov: vsetko sa generuje z bieleho sumu a tonov (Web Audio API).
let ctx = null, sum = null, more = null, vietor = null, vietorF = null;

export function initZvuk() {
  if (ctx) { ctx.resume(); return; }
  ctx = new AudioContext();
  sum = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = sum.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // more: tlmeny sum, hlasitost sa vlni ako prichadzajuce vlny
  more = ctx.createGain(); more.gain.value = 0;
  smycka().connect(filter('lowpass', 480)).connect(more).connect(ctx.destination);
  // vietor: pasmovy sum, hlasnejsi pri rychlosti
  vietor = ctx.createGain(); vietor.gain.value = 0;
  vietorF = filter('bandpass', 600, 0.6);
  smycka().connect(vietorF).connect(vietor).connect(ctx.destination);
}
function smycka() { const s = ctx.createBufferSource(); s.buffer = sum; s.loop = true; s.start(0, Math.random() * 1.9); return s; }
function filter(typ, f, q = 1) { const b = ctx.createBiquadFilter(); b.type = typ; b.frequency.value = f; b.Q.value = q; return b; }

export function aktualizujZvuk(t, { silaVetra = 0.5, rychlost = 0, pobrezie = 0, podVodou = false }) {
  if (!ctx) return;
  const n = ctx.currentTime;
  more.gain.setTargetAtTime(podVodou ? 0.04 : 0.05 + 0.05 * Math.sin(t * 0.55) ** 2 + pobrezie * 0.12, n, 0.4);
  vietor.gain.setTargetAtTime(podVodou ? 0 : 0.012 + silaVetra * 0.02 + Math.min(rychlost, 16) * 0.004, n, 0.4);
  vietorF.frequency.setTargetAtTime(450 + Math.min(rychlost, 16) * 40, n, 0.5);
}

function burst(trvanie, typ, f, hlasitost, q = 1) {
  if (!ctx) return;
  const s = ctx.createBufferSource(); s.buffer = sum;
  const g = ctx.createGain(), n = ctx.currentTime;
  g.gain.setValueAtTime(hlasitost, n);
  g.gain.exponentialRampToValueAtTime(0.001, n + trvanie);
  s.connect(filter(typ, f, q)).connect(g).connect(ctx.destination);
  s.start(n, Math.random() * 1.5, trvanie + 0.05);
}
function ton(f, trvanie, hlasitost, f2 = f) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), n = ctx.currentTime;
  o.frequency.setValueAtTime(f, n); o.frequency.exponentialRampToValueAtTime(f2, n + trvanie);
  g.gain.setValueAtTime(hlasitost, n); g.gain.exponentialRampToValueAtTime(0.001, n + trvanie);
  o.connect(g).connect(ctx.destination); o.start(n); o.stop(n + trvanie + 0.05);
}

export const zvuky = {
  splach: (sila = 1) => { burst(0.5, 'lowpass', 1200, 0.3 * sila); burst(0.25, 'bandpass', 2500, 0.08 * sila); },
  padlo: () => burst(0.3, 'bandpass', 700 + Math.random() * 200, 0.12, 0.7),
  krok: piesok => burst(0.07, 'bandpass', piesok ? 2600 : 1300, 0.04, 1.2),
  uder: material => material === 'kamen'
    ? (burst(0.1, 'bandpass', 3000, 0.3, 3), ton(420, 0.08, 0.15, 300))
    : material === 'list' ? burst(0.18, 'bandpass', 1800, 0.15, 0.6)
    : (burst(0.12, 'bandpass', 900, 0.35, 2), ton(140, 0.12, 0.25, 90)),
  pad: () => { burst(0.9, 'lowpass', 300, 0.6); ton(70, 0.5, 0.3, 40); },
  zober: () => ton(700, 0.12, 0.07, 1100),
  vyroba: () => { ton(520, 0.1, 0.07, 780); setTimeout(() => ton(780, 0.15, 0.07, 1040), 90); },
};
