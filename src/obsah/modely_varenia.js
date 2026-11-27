// Modely varenia: hlineny hrniec, miska s jedlom a spaleny kus. Format ako ostatne modely: [geometria, material].
import * as THREE from 'three';
import { hladka, tvar, naZem, ao, dokonci, fbm, smooth, MAT_STYL } from './styl.js';

const C = hex => new THREE.Color(hex);
const lathe = (body, n = 28) => hladka(new THREE.LatheGeometry(body.map(p => new THREE.Vector2(p[0], p[1])), n));

// hladina v hrnci (samostatna, ohen.js meni jej farbu)
export const GEO_HLADINA = new THREE.CircleGeometry(0.142, 24).rotateX(-Math.PI / 2).translate(0, 0.225, 0);

let hrniec = null;
export function modelHrniec() {
  if (hrniec) return hrniec;
  const st = C(0xa4532e), sv = C(0xc4744a), tm = C(0x5a2a18), sadze = C(0x241610);
  const telo = tvar(lathe([[0, 0], [0.11, 0.005], [0.18, 0.06], [0.2, 0.13], [0.17, 0.21], [0.15, 0.235], [0.175, 0.255], [0.165, 0.268], [0.143, 0.25], [0.15, 0.2], [0.165, 0.13], [0.14, 0.06], [0, 0.045]]), (v, c) => {
    const n = fbm(v.x * 18, v.y * 18, v.z * 18, 3);
    c.copy(st).lerp(sv, smooth(0.45, 0.75, n));
    if (Math.abs(v.y - 0.17) < 0.012) c.copy(tm);               // vyryty pasik
    c.lerp(sadze, smooth(0.1, 0.0, v.y) * 0.85);                // zadymeny spodok
  });
  const usko = s => tvar(hladka(new THREE.TorusGeometry(0.05, 0.016, 6, 14)), (v, c) => c.copy(st).lerp(tm, 0.3)).rotateX(Math.PI / 2).translate(s * 0.19, 0.19, 0);
  return (hrniec = [dokonci(telo, usko(1), usko(-1)), MAT_STYL]);
}

// miska s jedlom danej farby (jedla z hrnca)
export function modelMiska(farba) {
  const drevo = C(0x7a4a26), svetle = C(0xa8743f), jedlo = C(farba), svetlejsie = C(farba).lerp(C(0xffffff), 0.35);
  const miska = tvar(lathe([[0, 0], [0.08, 0.004], [0.15, 0.05], [0.175, 0.11], [0.16, 0.12], [0.145, 0.105], [0, 0.1]]), (v, c) => {
    c.copy(drevo).lerp(svetle, smooth(0.35, 0.75, fbm(v.x * 20, v.y * 60, v.z * 20, 2)));
  });
  const obsah = tvar(hladka(new THREE.CircleGeometry(0.146, 24).rotateX(-Math.PI / 2).translate(0, 0.108, 0)), (v, c) => {
    c.copy(jedlo).lerp(svetlejsie, smooth(0.5, 0.72, fbm(v.x * 28, 1, v.z * 28, 2)));
  });
  const kusky = [[0.05, 0.02], [-0.04, -0.05], [-0.06, 0.045], [0.02, -0.01]].map(([x, z], i) =>
    tvar(hladka(new THREE.IcosahedronGeometry(0.022 + i * 0.003, 1)), (v, c) => c.copy(svetlejsie)).scale(1, 0.55, 1).translate(x, 0.112, z));
  const g = naZem(dokonci(miska, obsah, ...kusky));
  ao(g, 0.05, 0.35);
  return [g, MAT_STYL];
}

// spaleny, popraskany uhlik
export function modelUhlik() {
  const cierna = C(0x14100d), siva = C(0x4a433c), zar = C(0x8a3a14);
  const hruda = tvar(hladka(new THREE.IcosahedronGeometry(0.1, 4)), (v, c) => {
    const n = fbm(v.x * 22, v.y * 22, v.z * 22, 3);
    v.multiplyScalar(0.75 + n * 0.55); v.y *= 0.65;
    c.copy(cierna).lerp(siva, smooth(0.55, 0.75, n)).lerp(zar, smooth(0.38, 0.28, n) * 0.7);
  });
  const g = naZem(dokonci(hruda));
  ao(g, 0.04, 0.4);
  return [g, MAT_STYL];
}
