// Hororove zvuky bez suborov (Web Audio): kazdy zvuk sa poskladaju zo sumu, tonov, filtrov a obalok.
// Kazde prehratie = jeden "Hlas": zapamata si vsetky svoje uzly a ked dohraju vsetky zdroje, odpoji ich (ziadne uniky).
// Funkcie nezavisia od hry - dostanu "prostredie" A (kontext, sum, vystupy), takze sa daju vykreslit aj v OfflineAudioContext.

export const pocitadlo = { hlasy: 0, uzly: 0 };   // kolko hlasov / uzlov prave zije (na kontrolu unikov)

const nah = (a, b) => a + Math.random() * (b - a);
const vyber = pole => pole[Math.floor(Math.random() * pole.length)];

// ---------- prostredie ----------
export function vytvorProstredie(ctx, sum, efekty, hudba) {
  if (!sum) {
    sum = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = sum.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  // dozvuk (reverb): vygenerovana odozva miestnosti = stereo sum, ktory slabne a tmavne
  const dlzka = Math.floor(ctx.sampleRate * 2.8), ir = ctx.createBuffer(2, dlzka, ctx.sampleRate);
  for (let k = 0; k < 2; k++) {
    const d = ir.getChannelData(k);
    let lp = 0;
    for (let i = 0; i < dlzka; i++) {
      const t = i / dlzka;
      lp += (Math.random() * 2 - 1 - lp) * (0.7 - 0.55 * t);
      d[i] = lp * (1 - t) ** 3 * (i < 600 ? i / 600 : 1);
    }
  }
  const dozvuk = vystup => { const c = ctx.createConvolver(); c.buffer = ir; c.connect(vystup); return c; };
  return { ctx, sum, efekty, hudba, dozvukE: dozvuk(efekty), dozvukH: dozvuk(hudba) };
}

// ---------- hlas: sklad uzlov jedneho zvuku ----------
class Hlas {
  // o: { pozicia, ref (vzdialenost plnej hlasitosti), dozvuk (0..1), hudba (do zbernice hudby), sila }
  constructor(A, o = {}) {
    this.A = A; this.uzly = []; this.zdroje = []; this.bezi = 0; this.panner = null;
    pocitadlo.hlasy++;
    this.vstup = this.gain(o.sila ?? 1);
    let koniec = this.vstup;
    if (o.pozicia) {
      const p = this.panner = this.pridaj(A.ctx.createPanner());
      p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
      p.refDistance = o.ref ?? 3; p.rolloffFactor = 0.8; p.maxDistance = 300;
      p.positionX.value = o.pozicia.x; p.positionY.value = o.pozicia.y; p.positionZ.value = o.pozicia.z;
      koniec.connect(p); koniec = p;
    }
    koniec.connect(o.hudba ? A.hudba : A.efekty);
    if (o.dozvuk) {
      const s = this.gain(o.dozvuk);
      koniec.connect(s); s.connect(o.hudba ? A.dozvukH : A.dozvukE);
    }
  }
  pridaj(uzol) { this.uzly.push(uzol); pocitadlo.uzly++; return uzol; }
  gain(v = 1, ciel) { const g = this.pridaj(this.A.ctx.createGain()); g.gain.value = v; if (ciel) g.connect(ciel); return g; }
  filter(typ, f, q = 1, ciel) {
    const b = this.pridaj(this.A.ctx.createBiquadFilter()); b.type = typ; b.frequency.value = f; b.Q.value = q;
    if (ciel) b.connect(ciel);
    return b;
  }
  sleduj(s) {
    this.zdroje.push(s); this.bezi++;
    s.onended = () => { if (--this.bezi === 0) this.uvolni(); };
    return s;
  }
  sum(t0, t1, ciel, rychlost = 1) {            // biely sum od t0 do t1
    const s = this.pridaj(this.A.ctx.createBufferSource()); s.buffer = this.A.sum; s.loop = true; s.playbackRate.value = rychlost;
    s.connect(ciel); s.start(t0, Math.random() * 1.9); if (t1 !== undefined) s.stop(t1);
    return this.sleduj(s);
  }
  osc(typ, f, t0, t1, ciel) {
    const o = this.pridaj(this.A.ctx.createOscillator()); o.type = typ; o.frequency.value = f;
    o.connect(ciel); o.start(t0); if (t1 !== undefined) o.stop(t1);
    return this.sleduj(o);
  }
  // obalka: rychly nabeh na vrchol a exponencialne doznenie; vrati gain uzol zapojeny do ciela
  uder(t0, vrchol, nabeh, doznenie, ciel) {
    const g = this.gain(0, ciel);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vrchol), t0 + nabeh);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + nabeh + doznenie);
    return g;
  }
  // kratky filtrovany sum (praskot, zrnko piesku, spoluhlaska)
  zrnko(t0, typ, f, q, vrchol, nabeh, doznenie, ciel = this.vstup) {
    this.sum(t0, t0 + nabeh + doznenie + 0.02, this.filter(typ, f, q, this.uder(t0, vrchol, nabeh, doznenie, ciel)));
  }
  // utlmovana sinusovka (rezonancia dreva, hrud, tep)
  kmit(t0, f, f2, vrchol, doznenie, ciel = this.vstup, typ = 'sine', nabeh = 0.004) {
    const o = this.osc(typ, f, t0, t0 + nabeh + doznenie + 0.02, this.uder(t0, vrchol, nabeh, doznenie, ciel));
    o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f2, t0 + doznenie);
  }
  uvolni() {
    for (const u of this.uzly) u.disconnect();
    pocitadlo.uzly -= this.uzly.length; pocitadlo.hlasy--;
    this.uzly.length = 0; this.zdroje.length = 0;
  }
}

// ---------- sepot: syntetizator "hlasok" ----------
// Sepot = sum, ktory prechadza cez 3 rezonancie ust (formanty). Spoluhlasky su kratke sumy, samohlasky menia formanty.
const SAMOHLASKY = { a: [850, 1350, 2800], e: [560, 1950, 2750], i: [340, 2450, 3200], o: [560, 950, 2650], u: [380, 800, 2500], m: [280, 1100, 2300], n: [300, 1600, 2600] };
// spoluhlasky: [typ filtra, frekvencia, Q, hlasitost, trvanie, nabeh]
const SPOLUHLASKY = {
  s: ['highpass', 5200, 0.8, 0.14, 0.2, 0.06], š: ['bandpass', 2900, 2.2, 0.34, 0.2, 0.05], č: ['bandpass', 3100, 2, 0.35, 0.09, 0.006],
  ch: ['bandpass', 1700, 1.4, 0.2, 0.14, 0.04], h: ['bandpass', 1100, 0.9, 0.16, 0.12, 0.05], z: ['highpass', 4300, 0.8, 0.09, 0.12, 0.04],
  t: ['bandpass', 4200, 1.2, 0.3, 0.035, 0.003], k: ['bandpass', 1900, 2.5, 0.36, 0.045, 0.003], p: ['lowpass', 1100, 0.8, 0.32, 0.03, 0.003],
  d: ['bandpass', 2900, 1.2, 0.18, 0.03, 0.003], ť: ['bandpass', 3600, 2, 0.26, 0.06, 0.004], v: ['bandpass', 1400, 0.6, 0.07, 0.1, 0.04],
  b: ['lowpass', 700, 0.8, 0.28, 0.03, 0.003],
};
export const VETY = [
  'p o d s e m',                // "pod sem"
  'v i d i m  ť a',             // "vidim ta"
  'z a  t e b o u',             // "za tebou"
  'n e o ch o d',               // "neochod"
  's i  s a m',                 // "si sam"
  'o t o č  s a',               // "otoc sa"
  't i ch o  t i ch o',         // "ticho, ticho"
];

function sepot(A, o, t0) {
  const h = new Hlas(A, { ref: 2.5, dozvuk: 0.3, ...o, sila: (o.sila ?? 1) * 0.5 });
  const veta = o.veta ?? vyber(VETY), tempo = nah(1.0, 1.25);
  // plan: kedy znie ktora hlaska
  const plan = [];
  let t = t0 + 0.08;
  for (const slovo of veta.split('  ')) {
    for (const hl of slovo.split(' ')) {
      const sam = SAMOHLASKY[hl];
      const d = (sam ? (hl === 'm' || hl === 'n' ? 0.14 : nah(0.17, 0.27)) : SPOLUHLASKY[hl][4] * 0.85) * tempo;
      plan.push({ hl, t, d, sam }); t += d;
    }
    t += 0.2 * tempo;
  }
  const koniec = t + 0.4;
  const dych = h.filter('highpass', 220, 0.7);
  h.sum(t0, koniec, dych);
  const hlasObalka = h.gain(0, h.vstup);
  const formanty = [[10, 4.2], [12, 3.6], [11, 2.2]].map(([q, zisk]) => {
    const g = h.gain(zisk, hlasObalka), f = h.filter('bandpass', 800, q, g);
    dych.connect(f);
    return f;
  });
  hlasObalka.gain.setValueAtTime(0, t0);
  for (const { hl, t, d, sam } of plan) {
    if (sam) {
      sam.forEach((fr, i) => formanty[i].frequency.setTargetAtTime(fr * nah(0.96, 1.04), t - 0.02, 0.025));
      const sila = hl === 'm' || hl === 'n' ? 0.35 : nah(0.75, 1);
      hlasObalka.gain.setTargetAtTime(sila, t, 0.03);
      hlasObalka.gain.setTargetAtTime(0, t + d * 0.8, 0.05);
    } else {
      const [typ, f, q, v, dl, nabeh] = SPOLUHLASKY[hl];
      h.zrnko(t, typ, f, q, v, nabeh, dl);
    }
  }
  // vzdych na konci
  h.zrnko(t - 0.15, 'bandpass', 900, 1.2, 0.07, 0.15, 0.4);
  return koniec - t0;
}

// ---------- kroky v piesku (prichadzaju blizsie, ak dostanu "ciel") ----------
function kroky(A, o, t0) {
  const h = new Hlas(A, { ref: 5, dozvuk: 0.06, ...o });
  const pocet = o.pocet ?? 3 + Math.floor(Math.random() * 3);
  let t = t0 + 0.02, tempo = nah(0.52, 0.66);
  for (let i = 0; i < pocet; i++) {
    const v = 0.65 + 0.35 * (i / pocet) + nah(-0.08, 0.08);
    h.kmit(t, nah(95, 120), 45, 0.28 * v, 0.1);                           // tupy dopad paty
    h.zrnko(t, 'lowpass', nah(600, 900), 0.7, 0.4 * v, 0.012, 0.13);      // piesok sa stlaci
    for (let j = 0; j < 14; j++)                                          // chrumanie zrniecok
      h.zrnko(t + nah(0, 0.17), 'bandpass', nah(1800, 5200), nah(1, 3), nah(0.05, 0.2) * v, 0.002, nah(0.008, 0.03));
    h.zrnko(t + 0.13, 'bandpass', nah(2200, 3200), 0.8, 0.07 * v, 0.04, 0.14);   // spicka odtlaci piesok
    t += tempo * nah(0.9, 1.12); tempo *= 0.97;
  }
  if (h.panner && o.ciel) {                      // zdroj sa pocas krokov priblizuje
    for (const [os, par] of [['x', h.panner.positionX], ['y', h.panner.positionY], ['z', h.panner.positionZ]]) {
      par.setValueAtTime(o.pozicia[os], t0); par.linearRampToValueAtTime(o.ciel[os], t);
    }
  }
  return t - t0 + 0.3;
}

// ---------- prasknutie konara ----------
function konar(A, o, t0) {
  const h = new Hlas(A, { ref: 7, dozvuk: 0.28, ...o, sila: (o.sila ?? 1) * 0.75 });
  const hlavne = t0 + 0.09;
  h.zrnko(t0, 'bandpass', nah(1800, 2600), 3, 0.2, 0.002, 0.02);                 // prve nalomenie
  h.zrnko(hlavne, 'highpass', 1200, 0.7, 0.8, 0.001, 0.025);                     // ostre prasknutie
  h.zrnko(hlavne, 'bandpass', nah(700, 950), 7, 1.1, 0.001, 0.09);               // drevena rezonancia
  h.zrnko(hlavne + 0.004, 'bandpass', nah(1500, 2100), 6, 0.6, 0.001, 0.06);
  h.kmit(hlavne, nah(190, 240), 90, 0.25, 0.07);
  let t = hlavne + 0.03;
  for (let i = 0; i < 7; i++) {                                                  // dozvuk: laman sa vlakna
    h.zrnko(t, 'bandpass', nah(900, 4200), nah(3, 8), nah(0.1, 0.45) * (1 - i / 9), 0.001, nah(0.012, 0.035));
    t += nah(0.012, 0.07);
  }
  h.zrnko(t + 0.05, 'highpass', 3500, 0.6, 0.04, 0.08, 0.3);                     // zasustanie listia
  return t - t0 + 0.5;
}

// ---------- vzdialene klopanie na drevo (duty kmen) ----------
function klopanie(A, o, t0) {
  const h = new Hlas(A, { ref: 20, dozvuk: 0.75, ...o });
  const tlmenie = h.filter('lowpass', 1500, 0.7, h.vstup);                       // dialka zoberie vysky
  const rytmus = vyber([[0, 0.55, 1.1], [0, 0.42, 0.84, 1.9], [0, 0.9, 1.12], [0, 0.7]]);
  const zaklad = nah(165, 215);
  rytmus.forEach((r, i) => {
    const t = t0 + 0.05 + r + nah(-0.02, 0.02), v = i === rytmus.length - 1 ? 1 : nah(0.65, 0.9);
    h.zrnko(t, 'bandpass', 1100, 2, 0.45 * v, 0.001, 0.022, tlmenie);
    for (const [nasobok, hlas, dl] of [[1, 0.5, 0.2], [2.27, 0.28, 0.11], [3.9, 0.14, 0.06]])   // mody duteho dreva
      h.kmit(t, zaklad * nasobok, zaklad * nasobok * 0.96, hlas * v, dl, tlmenie, 'sine', 0.002);
  });
  return rytmus[rytmus.length - 1] + 1;
}

// ---------- jeden uder srdca: "lub-dub" ----------
function srdce(A, o, t0) {
  const h = new Hlas(A, o);
  for (const [posun, f, v] of [[0, 68, 1], [0.21, 82, 0.62]]) {
    const t = t0 + 0.01 + posun;
    h.kmit(t, f, f * 0.6, 0.5 * v, 0.16, h.vstup, 'sine', 0.012);
    h.kmit(t, f * 2.1, f * 1.3, 0.16 * v, 0.09, h.vstup, 'sine', 0.008);          // vyssi ton, aby bolo pocut aj na notebooku
    h.zrnko(t, 'lowpass', 190, 0.9, 0.5 * v, 0.012, 0.09);
  }
  return 0.6;
}

// ---------- vykrik / skrek pri utoku ----------
function vykrik(A, o, t0) {
  const h = new Hlas(A, { ref: 6, dozvuk: 0.4, ...o });
  const dl = nah(1.0, 1.35), koniec = t0 + dl;
  const obalka = h.gain(0, h.vstup);
  obalka.gain.setValueAtTime(0.0001, t0);
  obalka.gain.exponentialRampToValueAtTime(0.47, t0 + 0.035);
  obalka.gain.setValueAtTime(0.47, t0 + dl * 0.45);
  obalka.gain.exponentialRampToValueAtTime(0.0001, koniec);
  // skreslenie (drsny hrdelny zvuk)
  const skresli = h.pridaj(A.ctx.createWaveShaper()), krivka = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; krivka[i] = Math.tanh(x * 3.5); }
  skresli.curve = krivka; skresli.oversample = '2x';
  const vystup = h.filter('lowpass', 6500, 0.7, obalka);
  for (const [f, q, zisk] of [[1150, 3, 0.9], [2650, 5, 1.0], [3900, 7, 0.5]]) {  // "otvorene usta"
    const g = h.gain(zisk, vystup), b = h.filter('bandpass', f, q, g);
    skresli.connect(b);
  }
  const zmes = h.gain(0.55, skresli);
  const zaklad = nah(0.9, 1.1);
  for (const [nas, typ] of [[1, 'sawtooth'], [1.013, 'sawtooth'], [1.49, 'sawtooth'], [0.503, 'square']]) {
    const osc = h.osc(typ, 600, t0, koniec + 0.05, zmes);
    const f = osc.frequency, k = nas * zaklad;
    f.setValueAtTime(520 * k, t0);
    f.exponentialRampToValueAtTime(1350 * k, t0 + 0.12);
    f.linearRampToValueAtTime(1180 * k, t0 + dl * 0.55);
    f.exponentialRampToValueAtTime(430 * k, koniec);
    // chvenie hlasu: dva rychle "vibrata" + nahodne trhanie
    for (const [rych, hlbka] of [[nah(22, 31), 55], [nah(6, 9), 35]]) {
      const lg = h.gain(hlbka * nas); lg.connect(f);
      h.osc('sine', rych, t0, koniec + 0.05, lg);
    }
  }
  const trhanie = h.gain(260); trhanie.connect(zmes.gain);
  const hrubost = h.filter('lowpass', 90, 0.7); hrubost.connect(trhanie); trhanie.gain.value = 3;
  h.sum(t0, koniec, hrubost);
  // sipot vzduchu
  const sipot = h.filter('bandpass', 3200, 1.1, h.gain(0.45, obalka));
  h.sum(t0, koniec, sipot);
  sipot.frequency.setValueAtTime(2200, t0); sipot.frequency.exponentialRampToValueAtTime(4800, t0 + 0.15);
  sipot.frequency.exponentialRampToValueAtTime(1800, koniec);
  h.zrnko(t0, 'lowpass', 500, 0.8, 0.5, 0.005, 0.25);                             // naraz na zaciatku
  h.kmit(t0, 90, 38, 0.4, 0.45);
  return dl + 0.3;
}

// ---------- nadych a vydych ----------
function dych(A, o, t0) {
  const h = new Hlas(A, o);
  const per = o.perioda ?? 1.9;
  const hlas = (t, dl, f1, f2, v) => {
    const g = h.gain(0, h.vstup);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + dl * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dl);
    const hp = h.filter('highpass', 350, 0.7);
    h.sum(t, t + dl + 0.02, hp);
    for (const [f, q, z] of [[f1, 1.6, 1], [f2, 4, 0.5]]) {
      const b = h.filter('bandpass', f, q, h.gain(z, g)); hp.connect(b);
      b.frequency.setValueAtTime(f * 0.9, t); b.frequency.linearRampToValueAtTime(f * 1.12, t + dl);
    }
  };
  hlas(t0 + 0.02, per * 0.36, 1500, 2900, 0.16);           // nadych (vyssi)
  hlas(t0 + per * 0.46, per * 0.46, 850, 1700, 0.2);       // vydych (hlbsi)
  return per;
}

// ---------- ulava pri svitani: teple akordy, marimba a vtaky ----------
const nota = poltony => 261.63 * 2 ** (poltony / 12);
function svitanie(A, o, t0) {
  const h = new Hlas(A, { hudba: true, dozvuk: 0.5, ...o });
  const akordy = [[-12, 0, 4, 7], [-7, -3, 0, 5], [-5, -1, 2, 7], [-12, 0, 4, 12]];   // C F G C
  const dl = 3.2, jemne = h.filter('lowpass', 1400, 0.5, h.vstup);
  akordy.forEach((akord, i) => {
    const t = t0 + i * dl, posledny = i === akordy.length - 1;
    for (const p of akord) {
      const g = h.gain(0, jemne), koniec = t + dl + (posledny ? 3.5 : 1.2);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.028, t + 1.3);
      g.gain.setValueAtTime(0.028, t + dl);
      g.gain.linearRampToValueAtTime(0, koniec);
      h.osc('triangle', nota(p), t, koniec + 0.05, g);
      h.osc('sine', nota(p) * 1.004, t, koniec + 0.05, g);
    }
  });
  const melodia = [[1.0, 16], [1.8, 19], [2.6, 24], [4.0, 21], [4.8, 17], [5.6, 21], [7.2, 23], [8.0, 19], [8.8, 14], [10.2, 16], [11.0, 19], [12.0, 24]];
  for (const [kedy, p] of melodia) {
    h.kmit(t0 + kedy, nota(p), nota(p), 0.07, 1.6);
    h.kmit(t0 + kedy, nota(p) * 4, nota(p) * 4, 0.009, 0.3);
  }
  for (let t = 2.5; t < 13; t += nah(0.9, 2.2)) {             // vtaky sa vracaju
    const f = nah(2600, 4200), v = nah(0.008, 0.02);
    for (let j = 0, n = 2 + Math.floor(Math.random() * 4); j < n; j++)
      h.kmit(t0 + t + j * nah(0.09, 0.14), f * nah(0.95, 1.05), f * vyber([1.35, 0.75, 1.15]), v, 0.07, h.vstup, 'sine', 0.012);
  }
  return akordy.length * dl + 3.6;
}

// ---------- dron: nepretrzita "hudba strachu"; vrati ovladac { nastav(0..1), zrus() } ----------
export function vytvorDron(A) {
  const h = new Hlas(A, { hudba: true, dozvuk: 0.25, sila: 0 });
  const ctx = A.ctx, t = ctx.currentTime;
  const lfo = (f, hlbka, ciel) => { const g = h.gain(hlbka); g.connect(ciel); h.osc('sine', f, t, undefined, g); };
  // zaklad: dva hlboke tony, ktore sa o seba "bijú"
  const zaklad = h.gain(0.1, h.vstup);
  h.osc('sine', 55, t, undefined, zaklad); h.osc('sine', 57.3, t, undefined, zaklad);
  // hruba vrstva: pily cez pomaly sa otvarajuci filter (pocut aj na malych reproduktoroch)
  const lp = h.filter('lowpass', 230, 4, h.gain(0.05, h.vstup));
  for (const f of [55.2, 82.4, 116.9]) h.osc('sawtooth', f, t, undefined, lp);   // A - E - Bb (disonancia)
  lfo(0.071, 110, lp.frequency);
  // vietor z jaskyne
  const duch = h.gain(0.14, h.vstup), bp = h.filter('bandpass', 310, 9, duch);
  h.sum(t, undefined, bp);
  lfo(0.113, 90, bp.frequency); lfo(0.19, 0.07, duch.gain);
  // vysoke napatie: len pri velkom strachu
  const vysoke = h.gain(0, h.vstup), chvenie = h.gain(1, vysoke);
  for (const f of [987.8, 1046.5, 1398]) h.osc('sine', f, t, undefined, chvenie);
  lfo(5.3, 0.45, chvenie.gain); lfo(0.047, 12, h.zdroje[h.zdroje.length - 2].detune);
  let zruseny = false;
  return {
    nastav(k) {
      const n = ctx.currentTime;
      h.vstup.gain.setTargetAtTime(Math.min(1, k) * 0.9, n, 0.8);
      vysoke.gain.setTargetAtTime(Math.max(0, k - 0.55) * 0.018, n, 1.5);
    },
    zrus(za = 2.5) {
      if (zruseny) return;
      zruseny = true;
      const n = ctx.currentTime;
      h.vstup.gain.cancelScheduledValues(n);
      h.vstup.gain.setTargetAtTime(0, n, za / 4);
      for (const z of h.zdroje) z.stop(n + za);
    },
  };
}

// ukazka dronu (tlacidlo v dev rezime): 9 sekund s nabehom do maxima
function dron(A) {
  const d = vytvorDron(A);
  d.nastav(1);
  setTimeout(() => d.zrus(3), 6000);
  return 9;
}

export const ZVUKY_HOROR = { sepot, kroky, konar, klopanie, srdce, vykrik, dych, dron, svitanie };
