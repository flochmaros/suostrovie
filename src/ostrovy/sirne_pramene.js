// DOCASNY ostrov (nahradi ho rucne navrhnuty). API: src/ostrovy/index.js
export default {
  meno: 'Sírne pramene', podnadpis: '', biom: 'skalnaty', R: 115, ext: 240, H: 16, seed: 13115,
  vyska(x, z, P) { return P.profil(P.zem(x, z, this.R, this.seed), this.H); },
  vegetacia: { zony: { a: { sira:0.2,balvan:0.5,palma:0.2 } }, zona: () => 'a' },
};
