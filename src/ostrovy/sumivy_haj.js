// DOCASNY ostrov (nahradi ho rucne navrhnuty). API: src/ostrovy/index.js
export default {
  meno: 'Šumivý háj', podnadpis: '', biom: 'bambusovy', R: 115, ext: 240, H: 18, seed: 10115,
  vyska(x, z, P) { return P.profil(P.zem(x, z, this.R, this.seed), this.H); },
  vegetacia: { zony: { a: { bambus:1,papradie:0.5,huba:0.2,trava:8 } }, zona: () => 'a' },
};
