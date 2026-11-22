// DOCASNY ostrov (nahradi ho rucne navrhnuty). API: src/ostrovy/index.js
export default {
  meno: 'Strážna skala', podnadpis: '', biom: 'skalnaty', R: 80, ext: 180, H: 22, seed: 1380,
  vyska(x, z, P) { return P.profil(P.zem(x, z, this.R, this.seed), this.H); },
  vegetacia: { zony: { a: { palma:0.2,balvan:0.7,aloe:0.3,trava:8,kamienky:1 } }, zona: () => 'a' },
};
