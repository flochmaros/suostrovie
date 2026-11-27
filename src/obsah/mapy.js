// Utrzok mapy: lezi na niektorych plazach (flasa so zvitkom), da sa najst v truhle vo vraku a v plavajucich sudoch.
// Pouzitie: vybrat v liste a stlacit F -> odkryje na mape vzdialeny neznamy ostrov (logika v hmla.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { predmet } from './predmety.js';
import { ik } from '../ikony.js';

// geometria s jednou farbou vo vrcholoch
function farebna(geo, hex) {
  const g = geo.toNonIndexed();
  g.deleteAttribute('uv');
  const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) a.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
// flasa lezi na boku v piesku: telo, hrdlo, zatka a zvitok pergamenu, ktory z nej trci
function modelUtrzku() {
  const lezato = (r1, r2, h, x, y, hex) => farebna(new THREE.CylinderGeometry(r1, r2, h, 10).rotateZ(-Math.PI / 2).translate(x, y, 0), hex);
  const geo = mergeGeometries([
    lezato(0.085, 0.085, 0.28, 0, 0.085, 0x4f8f78),
    lezato(0.032, 0.085, 0.07, 0.175, 0.085, 0x4f8f78),
    lezato(0.032, 0.032, 0.09, 0.255, 0.085, 0x5fa088),
    lezato(0.046, 0.046, 0.2, -0.2, 0.085, 0xecdcb8),
    lezato(0.05, 0.05, 0.025, -0.2, 0.085, 0xa83a28),
  ]);
  return [geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, emissive: 0x2a2010 })];
}

predmet('utrzok_mapy', { meno: 'Útržok mapy', ikona: ik('scroll-unfurled', '#e8d4a0'), kopa: 5,
  popis: 'Zažltnutý kúsok námornej mapy z fľaše. Vyber ho a stlač F – zakreslí ti vzdialený neznámy ostrov.',
  model: modelUtrzku() });
