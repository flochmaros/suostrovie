// Vstup: klavesnica a mys (pointer lock = mys sa "zamkne" do hry)

export const klavesy = new Set();   // prave stlacene klavesy (e.code, napr. 'KeyW')
export const mys = { dx: 0, dy: 0, koliesko: 0, zamknuta: false, posledny: 0, volneOtacanie: false, tahanie: false };
// volneOtacanie (dev panel): bez zamknutej mysi sa kamera otaca tahanim s pravym tlacidlom
const jePole = e => e.target?.tagName === 'TEXTAREA' || (e.target?.tagName === 'INPUT' && /^(text|number|search)$/.test(e.target.type));   // pisanie do textoveho pola nehybe postavou
const jednorazove = new Set();      // klavesy stlacene v tomto snimku (pre E, Space...)

export function initVstup(platno, onZamknutie) {
  addEventListener('keydown', e => {
    if (jePole(e) && e.code !== 'F2') return;
    if (!klavesy.has(e.code)) jednorazove.add(e.code);
    klavesy.add(e.code);
    if (['Space', 'Tab', 'F2'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => klavesy.delete(e.code));
  addEventListener('blur', () => klavesy.clear());

  addEventListener('mousemove', e => {
    if (!mys.zamknuta && !(mys.tahanie && (e.buttons & 2))) return;
    mys.dx += e.movementX;
    mys.dy += e.movementY;
    mys.posledny = performance.now();
  });
  addEventListener('wheel', e => { mys.koliesko += Math.sign(e.deltaY); });
  addEventListener('mousedown', e => { if (mys.zamknuta) { jednorazove.add('Mys' + e.button); klavesy.add('Mys' + e.button); } });
  addEventListener('mouseup', e => { klavesy.delete('Mys' + e.button); if (e.button === 2) mys.tahanie = false; });
  platno.addEventListener('mousedown', e => { if (e.button === 2 && !mys.zamknuta && mys.volneOtacanie) mys.tahanie = true; });
  platno.addEventListener('contextmenu', e => e.preventDefault());   // drzanie tlacidla (nabijanie silneho uderu)

  document.addEventListener('pointerlockchange', () => {
    mys.zamknuta = document.pointerLockElement === platno;
    onZamknutie(mys.zamknuta);
  });
}

// pre testy: simulovane stlacenie
export function stlac(kod) { jednorazove.add(kod); }

// true len v snimku, ked bola klavesa stlacena (mys: 'Mys0' = lave tlacidlo)
export function stlacene(kod) { return jednorazove.has(kod); }

// stlacenie uz niekto pouzil (napr. zavretie spravy) -> zvysok snimku ho nevidi
export function spotrebuj(kod) { jednorazove.delete(kod); }

// volat na konci kazdeho snimku
export function koniecSnimku() {
  jednorazove.clear();
  mys.dx = 0; mys.dy = 0; mys.koliesko = 0;
}
