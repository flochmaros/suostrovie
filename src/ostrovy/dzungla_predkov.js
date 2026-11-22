// DOCASNY ostrov (nahradi ho rucne navrhnuty). API: src/ostrovy/index.js
export default {
  meno: 'Džungľa predkov', podnadpis: '', biom: 'dzungla', R: 195, ext: 380, H: 30, seed: 15195,
  vyska(x, z, P) { return P.profil(P.zem(x, z, this.R, this.seed), this.H); },
  vegetacia: { zony: { a: { strom:0.9,gumovnik:0.2,papradie:1.4,trava:10 } }, zona: () => 'a' },
};
