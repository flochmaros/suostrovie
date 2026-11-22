// DOCASNY ostrov (nahradi ho rucne navrhnuty). API: src/ostrovy/index.js
export default {
  meno: 'Perlový atol', podnadpis: '', biom: 'atol', R: 140, ext: 280, H: 3, seed: 12140,
  vyska(x, z, P) { return P.profil(P.zem(x, z, this.R, this.seed), this.H); },
  vegetacia: { zony: { a: { palma:1.2,trava:8,kamienky:1 } }, zona: () => 'a' },
};
