// Ocean: velka plocha, ktora ide za hracom; vlny pocita shader na grafickej karte.
// Rovnaky vzorec mame aj v JS (vyskaVody), aby kanoe a hrac presne sedeli na vlnach.
import * as THREE from 'three';

// Kazda vlna: amplituda (m), vlnova dlzka (m), smer
const VLNY = [
  { a: 0.32, l: 42, sx: 1.0, sz: 0.35 },
  { a: 0.20, l: 23, sx: -0.45, sz: 1.0 },
  { a: 0.10, l: 14, sx: 0.7, sz: -0.75 },
].map(v => {
  const d = Math.hypot(v.sx, v.sz);
  const k = 2 * Math.PI / v.l;               // vlnove cislo
  return { a: v.a, k, sx: v.sx / d, sz: v.sz / d, w: Math.sqrt(9.81 * k) }; // w = rychlost (fyzika hlbokej vody)
});

export const HLADINA = 0;            // priemerna vyska mora
const PRILIV_A = 0.6, PRILIV_T = 300; // priliv/odliv: +-0.6 m, jedna perioda za 5 min
export const priliv = t => PRILIV_A * Math.sin(t * 2 * Math.PI / PRILIV_T);
const VELKOST = 1800, DIELY = 360;   // 5 m medzi vrcholmi
const DLAZDICA = 24;                 // textura vlniek sa opakuje kazdych 24 m

// Vyska vody v bode (x, z) v case t
export function vyskaVody(x, z, t) {
  let h = HLADINA + priliv(t);
  for (const v of VLNY) h += v.a * Math.sin(v.k * (v.sx * x + v.sz * z) - v.w * t);
  return h;
}

// Ta ista funkcia v GLSL; vracia (vyska, sklon x, sklon z)
const f = n => n.toFixed(6);
let glsl = `vec3 vlny(vec2 p, float t) {\n  vec3 r = vec3(${f(PRILIV_A)} * sin(t * ${f(2 * Math.PI / PRILIV_T)}), 0.0, 0.0); float f;\n`;
for (const v of VLNY) {
  glsl += `  f = ${f(v.k)} * dot(vec2(${f(v.sx)}, ${f(v.sz)}), p) - ${f(v.w)} * t;\n`;
  glsl += `  r.x += ${f(v.a)} * sin(f);\n`;
  glsl += `  r.yz += ${f(v.a * v.k)} * cos(f) * vec2(${f(v.sx)}, ${f(v.sz)});\n`;
}
glsl += '  return r;\n}\n';

export const uCas = { value: 0 };

export function vytvorOcean(scena) {
  const geo = new THREE.PlaneGeometry(VELKOST, VELKOST, DIELY, DIELY);
  geo.rotateX(-Math.PI / 2);

  // drobne vlnky = textura normal (open-source z prikladov three.js), posuva sa v case
  const vlnky = new THREE.TextureLoader().load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/waternormals.jpg');
  vlnky.wrapS = vlnky.wrapT = THREE.RepeatWrapping;
  vlnky.repeat.set(VELKOST / DLAZDICA, VELKOST / DLAZDICA);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1592b0, roughness: 0.08, metalness: 0.1,
    transparent: true, opacity: 0.8, side: THREE.DoubleSide,
    normalMap: vlnky, normalScale: new THREE.Vector2(0.35, 0.35),
  });
  // Upravime vstavany shader: posunieme vrcholy podla vln a spocitame normaly
  mat.onBeforeCompile = sh => {
    sh.uniforms.uCas = uCas;
    sh.vertexShader = 'uniform float uCas;\n' + glsl + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `
        vec3 wp0 = (modelMatrix * vec4(position, 1.0)).xyz;
        vec3 wv = vlny(wp0.xz, uCas);
        vec3 objectNormal = normalize(vec3(-wv.y, 1.0, -wv.z));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif`)
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position); transformed.y += wv.x;');
  };

  const ocean = new THREE.Mesh(geo, mat);
  ocean.position.y = HLADINA;
  ocean.frustumCulled = false;
  ocean.receiveShadow = true;
  scena.add(ocean);

  // Tmave dno pod oceanom, aby cez priesvitnu vodu nebolo vidiet oblohu
  const dno = new THREE.Mesh(
    new THREE.PlaneGeometry(VELKOST * 1.2, VELKOST * 1.2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x0a3550 }));
  dno.position.y = -31;
  scena.add(dno);

  const krok = VELKOST / DIELY;
  return {
    // posun oceanu za hracom (po celych krokoch, aby vlny "neplavali")
    aktualizuj(x, z, t) {
      uCas.value = t;
      ocean.position.x = Math.round(x / krok) * krok;
      ocean.position.z = Math.round(z / krok) * krok;
      // textura je prilepena k svetu (nie k ploche, ktora skace po 5 m) + pomaly tecie
      vlnky.offset.set(ocean.position.x / DLAZDICA + t * 0.01, -ocean.position.z / DLAZDICA + t * 0.006);
      dno.position.x = x; dno.position.z = z;
    },
  };
}
