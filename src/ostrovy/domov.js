// DOCASNY ostrov (nahradi ho rucne navrhnuty). API: src/ostrovy/index.js
export default {
  meno: 'Ostrov Stroskotanca', podnadpis: '', biom: 'palmovy', R: 110, ext: 230, H: 14, seed: 5110,
  vyska(x, z, P) { return P.profil(P.zem(x, z, this.R, this.seed), this.H); },
  vegetacia: { zony: { a: { palma:0.8,ker:0.4,trava:18,kvet:0.4,balvan:0.1,kamienky:0.4,aloe:0.1 } }, zona: () => 'a' },
};
