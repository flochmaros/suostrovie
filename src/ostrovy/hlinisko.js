// DOCASNY ostrov (nahradi ho rucne navrhnuty). API: src/ostrovy/index.js
export default {
  meno: 'Hlinisko', podnadpis: '', biom: 'savana', R: 95, ext: 210, H: 6, seed: 895,
  vyska(x, z, P) { return P.profil(P.zem(x, z, this.R, this.seed), this.H); },
  vegetacia: { zony: { a: { hlina:0.15,trstina:0.6,akacia:0.1,trava:20 } }, zona: () => 'a' },
};
