// DOCASNY ostrov (nahradi ho rucne navrhnuty). API: src/ostrovy/index.js
export default {
  meno: 'Záhrada strážcov', podnadpis: '', biom: 'ovocny', R: 150, ext: 300, H: 30, seed: 7150,
  vyska(x, z, P) { return P.profil(P.zem(x, z, this.R, this.seed), this.H); },
  vegetacia: { zony: { a: { mango:0.5,banan:0.6,ananas:0.5,bobule:0.4,trava:14 } }, zona: () => 'a' },
};
