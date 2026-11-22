// DOCASNY ostrov (nahradi ho rucne navrhnuty). API: src/ostrovy/index.js
export default {
  meno: 'Krokodílí močiar', podnadpis: '', biom: 'mangrovy', R: 210, ext: 400, H: 3, seed: 16210,
  vyska(x, z, P) { return P.profil(P.zem(x, z, this.R, this.seed), this.H); },
  vegetacia: { zony: { a: { mangrova:1.5,trstina:0.6,taro:0.3 } }, zona: () => 'a' },
};
