// Zvuky bez suborov: vsetko sa generuje z bieleho sumu a tonov (Web Audio API).
let hlavny = null, bHudba = null, bProstredie = null, bEfekty = null;
let ctx = null, sum = null, more = null, vietor = null, vietorF = null;

export function initZvuk() {
  if (ctx) { ctx.resume(); return; }
  ctx = new AudioContext();
  hlavny = ctx.createGain(); hlavny.connect(ctx.destination);
  bHudba = ctx.createGain(); bHudba.connect(hlavny);
  bProstredie = ctx.createGain(); bProstredie.connect(hlavny);
  bEfekty = ctx.createGain(); bEfekty.connect(hlavny);
  nastavZvuk();
  sum = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = sum.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // more: tlmeny sum, hlasitost sa vlni ako prichadzajuce vlny
  more = ctx.createGain(); more.gain.value = 0;
  smycka().connect(filter('lowpass', 480)).connect(more).connect(bProstredie);
  // vietor: pasmovy sum, hlasnejsi pri rychlosti
  vietor = ctx.createGain(); vietor.gain.value = 0;
  vietorF = filter('bandpass', 600, 0.6);
  smycka().connect(vietorF).connect(vietor).connect(bProstredie);
  // dazd: siroky sum (siks) + nizsi sum (bubnovanie)
  dazdG = ctx.createGain(); dazdG.gain.value = 0;
  smycka().connect(filter('highpass', 1800)).connect(filter('lowpass', 9000)).connect(dazdG);
  smycka().connect(filter('bandpass', 700, 0.5)).connect(dazdG);
  dazdG.connect(bProstredie);
  // noc: dva sverciky (ton 4-5 kHz zapinany a vypinany nizkou frekvenciou)
  nocG = ctx.createGain(); nocG.gain.value = 0; nocG.connect(bProstredie);
  for (const [f, lf] of [[4300, 7.3], [5100, 10.9]]) {
    const o = ctx.createOscillator(), amp = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
    o.frequency.value = f; amp.gain.value = 0.5;
    l.frequency.value = lf; lg.gain.value = 0.5;
    l.connect(lg).connect(amp.gain);
    o.connect(amp).connect(nocG);
    o.start(); l.start();
  }
}
let dazdG = null, nocG = null, ohenG = null;

// hlasitosti zo nastaveni (0..1; hudba/prostredie/efekty su samostatne zbernice, vsetko ide cez hlavnu)
export const hlasitost = { hlavna: 1, hudba: 1, prostredie: 1, efekty: 1 };
export function nastavZvuk() {
  if (!ctx) return;
  const n = ctx.currentTime;
  hlavny.gain.setTargetAtTime(hlasitost.hlavna, n, 0.05);
  bHudba.gain.setTargetAtTime(hlasitost.hudba, n, 0.05);
  bProstredie.gain.setTargetAtTime(hlasitost.prostredie, n, 0.05);
  bEfekty.gain.setTargetAtTime(hlasitost.efekty, n, 0.05);
}

// ohen: tichy hukot (nizky sum) + nahodne praskanie; sila 0..1 podla vzdialenosti k najblizsiemu ohnu
let dalsiePraskanie = 0;
export function ohen(sila) {
  if (!ctx) return;
  const n = ctx.currentTime;
  if (!ohenG) {
    ohenG = ctx.createGain(); ohenG.gain.value = 0;
    smycka().connect(filter('lowpass', 320)).connect(ohenG).connect(bProstredie);
  }
  ohenG.gain.setTargetAtTime(sila * 0.09, n, 0.3);
  if (sila > 0.02 && n > dalsiePraskanie) {
    // praskanie: kratky ostry sum + obcas hlbsi "puk" polena
    burst(0.02 + Math.random() * 0.04, 'highpass', 1500 + Math.random() * 3500, sila * (0.05 + Math.random() * 0.12));
    if (Math.random() < 0.15) burst(0.09, 'bandpass', 500 + Math.random() * 300, sila * 0.18, 2);
    dalsiePraskanie = n + Math.random() * Math.random() * 0.35;
  }
}

// pocasie: sila dazda 0..1, sila nocnej atmosfery 0..1 (vola pocasie.js kazdy snimok)
export function dazd(sila, podVodou = false) {
  if (!ctx) return;
  dazdG.gain.setTargetAtTime(podVodou ? sila * 0.02 : sila * 0.09, ctx.currentTime, 0.6);
}
export function noc(sila, podVodou = false) {
  if (!ctx) return;
  nocG.gain.setTargetAtTime(podVodou ? 0 : sila * 0.006, ctx.currentTime, 1.0);
}
// hrom: dlhe dunenie (blizko = hlasnejsie a ostrejsie), blizkost 0..1
export function hrom(blizkost = 0.5) {
  if (!ctx) return;
  const n = ctx.currentTime, h = 0.25 + blizkost * 0.5;
  burst(0.25, 'lowpass', 2200, 0.5 * blizkost);                       // prasknutie
  for (let i = 0; i < 4; i++) {                                         // dunenie: niekolko dozvukov
    const s = ctx.createBufferSource(); s.buffer = sum;
    const g = ctx.createGain(), f = filter('lowpass', 140 + Math.random() * 120);
    const t0 = n + i * (0.25 + Math.random() * 0.4), dl = 1.8 + Math.random() * 2.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(h * (1 - i * 0.18), t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dl);
    s.connect(f).connect(g).connect(bProstredie);
    s.start(t0, Math.random() * 1.5, dl + 0.1);
  }
  ton(48, 1.6, 0.25 * h, 28);
}
function smycka() { const s = ctx.createBufferSource(); s.buffer = sum; s.loop = true; s.start(0, Math.random() * 1.9); return s; }
function filter(typ, f, q = 1) { const b = ctx.createBiquadFilter(); b.type = typ; b.frequency.value = f; b.Q.value = q; return b; }

export function aktualizujZvuk(t, { silaVetra = 0.5, rychlost = 0, pobrezie = 0, podVodou = false }) {
  if (!ctx) return;
  const n = ctx.currentTime;
  more.gain.setTargetAtTime(podVodou ? 0.04 : 0.05 + 0.05 * Math.sin(t * 0.55) ** 2 + pobrezie * 0.12, n, 0.4);
  vietor.gain.setTargetAtTime(podVodou ? 0 : 0.012 + silaVetra * 0.02 + Math.min(rychlost, 16) * 0.004, n, 0.4);
  vietorF.frequency.setTargetAtTime(450 + Math.min(rychlost, 16) * 40, n, 0.5);
  // hudba: obcas kratka fraza z pentatoniky (ako drevena marimba s ozvenou), pod vodou ticho
  if (!podVodou && n > dalsiaFraza) {
    const zaklad = 220 * 2 ** (STUPNE[Math.floor(Math.random() * 3)] / 12);
    for (let i = 0, d = 0; i < 2 + Math.floor(Math.random() * 4); i++, d += 0.35 + Math.random() * 0.5)
      nota(zaklad * 2 ** (STUPNE[Math.floor(Math.random() * STUPNE.length)] / 12), n + d);
    dalsiaFraza = n + 9 + Math.random() * 14;
  }
}
const STUPNE = [0, 2, 4, 7, 9, 12, 14, 16];   // durova pentatonika v poltonoch
let dalsiaFraza = 6, ozvena = null;
function nota(f, t0) {
  if (!ozvena) {                                 // ozvena: oneskorenie so spatnou vazbou
    ozvena = ctx.createDelay(); ozvena.delayTime.value = 0.42;
    const sp = ctx.createGain(); sp.gain.value = 0.38;
    ozvena.connect(sp).connect(ozvena); ozvena.connect(filter('lowpass', 1800)).connect(bHudba);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.03, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
  for (const [nas, h] of [[1, 1], [4, 0.15]]) {  // zaklad + vyssi alikvot = dreveny zvuk
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.frequency.value = f * nas; og.gain.value = h;
    o.connect(og).connect(g); o.start(t0); o.stop(t0 + 1.5);
  }
  g.connect(bHudba); g.connect(ozvena);
}

function burst(trvanie, typ, f, hlasitost, q = 1) {
  if (!ctx) return;
  const s = ctx.createBufferSource(); s.buffer = sum;
  const g = ctx.createGain(), n = ctx.currentTime;
  g.gain.setValueAtTime(hlasitost, n);
  g.gain.exponentialRampToValueAtTime(0.001, n + trvanie);
  s.connect(filter(typ, f, q)).connect(g).connect(bEfekty);
  s.start(n, Math.random() * 1.5, trvanie + 0.05);
}
function ton(f, trvanie, hlasitost, f2 = f) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), n = ctx.currentTime;
  o.frequency.setValueAtTime(f, n); o.frequency.exponentialRampToValueAtTime(f2, n + trvanie);
  g.gain.setValueAtTime(hlasitost, n); g.gain.exponentialRampToValueAtTime(0.001, n + trvanie);
  o.connect(g).connect(bEfekty); o.start(n); o.stop(n + trvanie + 0.05);
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
  majak: () => { [392, 523, 659, 784, 1047].forEach((f, i) => setTimeout(() => ton(f, 0.9, 0.09), i * 260)); burst(1.2, 'lowpass', 500, 0.2); },
  syc: () => { burst(0.6, 'highpass', 3500, 0.06); burst(0.4, 'bandpass', 1200, 0.05, 0.5); },
  zasah: () => { burst(0.1, 'bandpass', 1500, 0.3, 2); ton(200, 0.1, 0.2, 90); },
  napriah: () => ton(160, 0.4, 0.12, 330),
  utokNepr: () => { burst(0.12, 'bandpass', 700, 0.3, 1.5); ton(260, 0.12, 0.2, 120); },
  smrtNepr: () => { burst(0.3, 'lowpass', 600, 0.3); ton(300, 0.35, 0.2, 60); },
  vyroba: () => { ton(520, 0.1, 0.07, 780); setTimeout(() => ton(780, 0.15, 0.07, 1040), 90); },
};
