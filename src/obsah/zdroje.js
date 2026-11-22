// Co davaju rastliny a kamene vo svete.
//  - vynos: co padne, ked sa uzol ZNICI udieranim: [predmet, pocet | [min,max], sanca (0..1, nepovinne)]
//  - nastroj: typ nastroja, ktory je na zdroj efektivny ('sekera', 'krompac'); undefined = staci ruka
//  - rukou: nasobok poskodenia, ked hrac nema spravny nastroj (default 0.3); bez `nastroj` je ucinnost vzdy 1
//  - zber: zber na E BEZ znicenia rastliny; plody zmiznu a dorastu po `cas` hernych minutach (ekosystem)
//      { text: co sa zobrazi hracovi, vynos: [...], cas: minuty dorastania }
// Pozn.: material (drevo/list/kamen) sa pouziva na zvuk a triesky pri udere.
export const ZDROJE = {
  palma: { zivoty: 4, material: 'drevo', nastroj: 'sekera', rukou: 0.4,
    vynos: [['drevo', 2], ['list', 2], ['kokos', 1, 0.6]],
    zber: { text: 'Striasť kokosy', vynos: [['kokos', [1, 3]]], cas: 6 } },
  strom: { zivoty: 5, material: 'drevo', nastroj: 'sekera', rukou: 0.3,
    vynos: [['drevo', 3], ['palica', [1, 2]]],
    zber: { text: 'Zbierať liany', vynos: [['vlakno', [1, 2]]], cas: 5 } },
  mangrova: { zivoty: 4, material: 'drevo', nastroj: 'sekera', rukou: 0.35,
    vynos: [['drevo', 2], ['palica', 2]],
    zber: { text: 'Zbierať vetvičky', vynos: [['palica', [1, 2]]], cas: 5 } },
  mango: { zivoty: 5, material: 'drevo', nastroj: 'sekera', rukou: 0.3,
    vynos: [['drevo', 3], ['palica', 1]],
    zber: { text: 'Zbierať mango', vynos: [['mango', [1, 3]]], cas: 8 } },
  akacia: { zivoty: 4, material: 'drevo', nastroj: 'sekera', rukou: 0.35,
    vynos: [['drevo', 2], ['palica', 2]],
    zber: { text: 'Zbierať konáre', vynos: [['palica', [1, 2]]], cas: 6 } },
  banan: { zivoty: 2, material: 'list',
    vynos: [['list', 3], ['vlakno', 2]],
    zber: { text: 'Zbierať banány', vynos: [['banan', [2, 4]]], cas: 8 } },
  bambus: { zivoty: 3, material: 'drevo', nastroj: 'sekera', rukou: 0.5,
    vynos: [['bambus', [3, 5]], ['list', 1]],
    zber: { text: 'Odrezať bambus', vynos: [['bambus', [1, 2]]], cas: 6 } },
  bobule: { zivoty: 1, material: 'list',
    vynos: [['vlakno', 2], ['palica', 1, 0.5]],
    zber: { text: 'Zbierať bobule', vynos: [['bobule', [2, 4]]], cas: 5 } },
  ker: { zivoty: 1, material: 'list',
    vynos: [['vlakno', 2], ['palica', 1, 0.5]],
    zber: { text: 'Zbierať paličky', vynos: [['palica', [1, 2]]], cas: 4 } },
  ibistek: { zivoty: 1, material: 'list',
    vynos: [['vlakno', 2], ['kvet', 1, 0.5]],
    zber: { text: 'Odtrhnúť kvety', vynos: [['kvet', [1, 2]]], cas: 6 } },
  papradie: { zivoty: 1, material: 'list',
    vynos: [['list', 2], ['vlakno', 1, 0.5]],
    zber: { text: 'Zbierať listy', vynos: [['list', [1, 2]]], cas: 4 } },
  trstina: { zivoty: 2, material: 'list',
    vynos: [['trstina', 2], ['list', 1]],
    zber: { text: 'Odrezať trstinu', vynos: [['trstina', [1, 2]]], cas: 8 } },
  ananas: { zivoty: 1, material: 'list',
    vynos: [['vlakno', 2], ['list', 1]],
    zber: { text: 'Zbierať ananás', vynos: [['ananas', 1]], cas: 12 } },
  aloe: { zivoty: 1, material: 'list',
    vynos: [['vlakno', 1, 0.5], ['aloe', 1]],
    zber: { text: 'Odrezať aloe', vynos: [['aloe', 1]], cas: 10 } },
  taro: { zivoty: 1, material: 'list',
    vynos: [['list', 2], ['taro', 1]],
    zber: { text: 'Vykopať taro', vynos: [['taro', [1, 2]]], cas: 12 } },
  huba: { zivoty: 1, material: 'list',
    vynos: [['huba', 1]],
    zber: { text: 'Zbierať huby', vynos: [['huba', [1, 3]]], cas: 10 } },
  kvet: { zivoty: 1, material: 'list',
    vynos: [['vlakno', 1, 0.5]],
    zber: { text: 'Odtrhnúť kvet', vynos: [['kvet', [1, 2]]], cas: 8 } },
  balvan: { zivoty: 6, material: 'kamen', nastroj: 'krompac', rukou: 0.25,
    vynos: [['kamen', 3], ['kamen', 1, 0.5]] },
  obsidian: { zivoty: 9, material: 'kamen', nastroj: 'krompac', rukou: 0.15,
    vynos: [['obsidian', 2], ['obsidian', 1, 0.5], ['sira', 1, 0.3]] },
  // suroviny rucnych ostrovov (len na jednom ostrove - SUOSTROVIE.md)
  hlina: { zivoty: 5, material: 'kamen', nastroj: 'krompac', rukou: 0.5,
    vynos: [['hlina', [3, 5]]],
    zber: { text: 'Vykopať hlinu', vynos: [['hlina', [1, 2]]], cas: 6 } },
  sira: { zivoty: 6, material: 'kamen', nastroj: 'krompac', rukou: 0.25,
    vynos: [['sira', [2, 3]], ['kamen', 1]],
    zber: { text: 'Odlomiť síru', vynos: [['sira', 1]], cas: 10 } },
  gumovnik: { zivoty: 7, material: 'drevo', nastroj: 'sekera', rukou: 0.25,
    vynos: [['drevo', 4], ['zivica', 1]],
    zber: { text: 'Zobrať živicu', vynos: [['zivica', [1, 2]]], cas: 10 } },
  // trava nie je uzol (nema hitbox ani zivoty): len zber na E s cooldownom na kazdom 3 m policku
  trava: { material: 'list', zber: { text: 'Trhať trávu', vynos: [['vlakno', 1]], cas: 5 } },
};

// nasobok poskodenia pre dany zdroj: nastroj = typ nastroja v ruke ('sekera', 'krompac', ...) alebo undefined
export function ucinnost(typ, nastroj) {
  const z = ZDROJE[typ];
  if (!z || !z.nastroj) return 1;
  return nastroj === z.nastroj ? 1 : (z.rukou ?? 0.3);
}

// vynos so sancou a nahodnym poctom -> pole [predmet, pocet] (pocet >= 1)
export function hodVynos(vynos, r = Math.random) {
  const out = [];
  for (const [id, n, sanca] of vynos) {
    if (sanca !== undefined && r() >= sanca) continue;
    const pocet = Array.isArray(n) ? n[0] + Math.floor(r() * (n[1] - n[0] + 1)) : n;
    if (pocet > 0) out.push([id, pocet]);
  }
  return out;
}
