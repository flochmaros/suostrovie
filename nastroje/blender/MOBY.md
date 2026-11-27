# Mobky a bossovia z Blenderu – postup

Vzor: `moby_lavovy_jaster.py` + `modelJaster()` v `src/nepriatelia.js`.

## Princíp
- Blender dáva **tvar a materiály**, animácia ostáva v JS (rotácie pivotov, ako doteraz).
- Model = **pivoty** (prázdne objekty s menami, ktoré JS otáča) + **diely** zavesené na pivotoch.
- Polohy pivotov a mená materiálov prevezmi z pôvodného JS modelu (rovnaké čísla → animácia sedí bez zmien).
- Súradnice v skripte sú **súradnice hry** (y hore, predok +Z); `mob.py` ich prevedie.

## Kroky
1. Skript `nastroje/blender/moby_<meno>.py` (`from mob import *`, `zacni()`, `material()`, `pivot()`, `diel()`, `export('<meno>')`).
   Mená súborov sú vopred v `MOBY` v `src/moby_glb.js` (`krab`, `lavovy_obr`, `krokodil`, `kraken`, `chapadlo`, `golem`) – zoznam nemeň.
2. Spusti: `& "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" -b --python nastroje/blender/moby_<meno>.py`
   → vypíše `HOTOVO … B, N trojuholnikov`. Rozpočet: bežný mob ≤ 15 k, boss ≤ 40 k trojuholníkov.
3. V JS modeli na začiatok funkcie:
   ```js
   const mob = mobGLB('<meno>');
   if (mob) { const trup = mob.uzol('trup'), ...; return { g: mob.g, tela: [mob.mat('telo')], trup, nohy: NOHY4.map(([m, s, i]) => ({ n: mob.uzol(m), s, i })), anim }; }
   ```
   `anim` môže byť tá istá funkcia ako v kóde – len nech pracuje s uzlami z GLB. Materiály, ktoré `anim` mení (napr. `lava.emissiveIntensity`), ber cez `mob.mat('lava')`.
   Pôvodný kód nechaj ako fallback (keď .glb chýba alebo `?bezglb`).
4. Test v prehliadači (`preview_start` „hra“ → Hrať), v konzole:
   ```js
   const k=hra.kamera, o={set:k.position.set,copy:k.position.copy,lookAt:k.lookAt};
   window._pust=()=>{k.position.set=o.set;k.position.copy=o.copy;k.lookAt=o.lookAt};
   window._foto=(b,dx,dy,dz,ty)=>{_pust();k.position.set(b.x+dx,b.y+dy,b.z+dz);k.lookAt(b.x,b.y+ty,b.z);k.position.set=function(){return this};k.position.copy=function(){return this};k.lookAt=()=>{}};
   window._sleduj=(dx,dy,dz,ty)=>{cancelAnimationFrame(window._raf);const f=()=>{const a=_e.hd,c=Math.cos(a),s=Math.sin(a);_foto(_e.g.position,dx*c+dz*s,dy,-dx*s+dz*c,ty);window._raf=requestAnimationFrame(f)};f()};
   document.querySelectorAll('body > div').forEach(d=>{const p=getComputedStyle(d).position;if(p==='fixed'||p==='absolute')d.style.visibility='hidden'});
   const e=hra.spawn('<id z obsah/nepriatelia.js>'); window._e=e; e.x=hra.hrac.poz.x+5; e.z=hra.hrac.poz.z+3; hra.sim(0.3);
   _sleduj(3, 2, 4, 1);   // kamera pred mobom (dx bokom, dy hore, dz dopredu, ty = vyska pohladu); bossovia su vacsi (def.scale) -> vacsie cisla
   ```
   potom screenshot. Útok: počkaj, kým sa napriahne (`_e.stav`), skontroluj, že sa hýbu čeľuste, nohy, chvost.
   Vodný boss (kraken) potrebuje vodu – `hra.spawn` ho dá k brehu sám.
5. Iteruj (uprav skript → znova Blender → reload), kým to nevyzerá dobre a lepšie ako pôvodný model.

## Tipy na vzhľad
- Organické tvary: `diel('gula', …, hladky=1)`; hranaté zaoblené: `diel('kocka', …, hrana=0.25, hladky=1)`; kameň: `diel('ikosa', …, sum=0.06)`.
- Diely nech sa **prekrývajú** (žiadne medzery medzi stehnom a predkolením).
- Žiariace materiály: `material('lava', 0x301008, ziara=0xff5410)`; silu nastavuje JS (`emissiveIntensity`).
