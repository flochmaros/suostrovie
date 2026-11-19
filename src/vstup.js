// Vstup: klavesnica a mys (pointer lock = mys sa "zamkne" do hry)

export const klavesy = new Set();   // prave stlacene klavesy (e.code, napr. 'KeyW')
export const mys = { dx: 0, dy: 0, koliesko: 0, zamknuta: false, posledny: 0 };
const jednorazove = new Set();      // klavesy stlacene v tomto snimku (pre E, Space...)

export function initVstup(platno, onZamknutie) {
  addEventListener('keydown', e => {
    if (!klavesy.has(e.code)) jednorazove.add(e.code);
    klavesy.add(e.code);
    if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => klavesy.delete(e.code));
  addEventListener('blur', () => klavesy.clear());

  addEventListener('mousemove', e => {
    if (!mys.zamknuta) return;
    mys.dx += e.movementX;
    mys.dy += e.movementY;
    mys.posledny = performance.now();
  });
  addEventListener('wheel', e => { mys.koliesko += Math.sign(e.deltaY); });
  addEventListener('mousedown', e => { if (mys.zamknuta) jednorazove.add('Mys' + e.button); });

  document.addEventListener('pointerlockchange', () => {
    mys.zamknuta = document.pointerLockElement === platno;
    onZamknutie(mys.zamknuta);
  });
}

// pre testy: simulovane stlacenie
export function stlac(kod) { jednorazove.add(kod); }

// true len v snimku, ked bola klavesa stlacena (mys: 'Mys0' = lave tlacidlo)
export function stlacene(kod) { return jednorazove.has(kod); }

// volat na konci kazdeho snimku
export function koniecSnimku() {
  jednorazove.clear();
  mys.dx = 0; mys.dy = 0; mys.koliesko = 0;
}
