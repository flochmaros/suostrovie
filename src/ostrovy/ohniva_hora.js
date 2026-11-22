// DOCASNY ostrov (nahradi ho rucne navrhnuty). API: src/ostrovy/index.js
export default {
  meno: 'Ohnivá hora', podnadpis: '', biom: 'sopecny', R: 190, ext: 380, H: 70, seed: 11190,
  vyska(x, z, P) { return P.profil(P.zem(x, z, this.R, this.seed), this.H); },
  vegetacia: { zony: { a: { obsidian:0.2,balvan:0.6,kamienky:1.5 } }, zona: () => 'a' },
};
