// 3 sloty ulozenia. Slot 1 pouziva povodny kluc (stare ulozenie ostane zachovane), sloty 2 a 3 maju vlastne kluce.
const ZAKLAD = 'suostrovie-ulozenie-v3';
const POSLEDNY = 'suostrovie-posledny-slot';
export const POCET_SLOTOV = 3;

let aktivny = 1;
export const aktivnySlot = () => aktivny;
export const nastavSlot = n => { aktivny = n; try { localStorage.setItem(POSLEDNY, String(n)); } catch (e) { /* nic */ } };
export const poslednySlot = () => { try { return Math.min(POCET_SLOTOV, Math.max(1, +localStorage.getItem(POSLEDNY) || 1)); } catch (e) { return 1; } };

export const klucSlotu = n => (n === 1 ? ZAKLAD : `${ZAKLAD}-s${n}`);
export const klucVystroje = n => (n === 1 ? 'suostrovie-vystroj' : `suostrovie-vystroj-s${n}`);

// prehlad slotu pre menu: null = prazdny slot
export function prehlad(n) {
  try {
    const u = JSON.parse(localStorage.getItem(klucSlotu(n)));
    if (!u || !Array.isArray(u.hrac)) return null;
    return {
      den: Math.floor((9 + (u.cas || 0) / 60) / 24) + 1,       // 9:00 = start, den = 24 min (ako hodinaHry v main.js)
      ts: u.ts || 0,
      lode: Array.isArray(u.lode) ? u.lode.length : 1,
      stavby: Array.isArray(u.stavby) ? u.stavby.length : 0,
      ulohy: u.ulohy && Array.isArray(u.ulohy.h) ? u.ulohy.h.length : 0,
    };
  } catch (e) { return null; }
}

export function zmaz(n) {
  try { localStorage.removeItem(klucSlotu(n)); localStorage.removeItem(klucVystroje(n)); } catch (e) { /* nic */ }
}
