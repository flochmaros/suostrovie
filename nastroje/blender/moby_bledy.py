# Bledi (hororovy ostrov Ticha zatoka) -> modely/moby/bledy_1.glb ... bledy_6.glb a matka.glb
# Kazdy variant: vlastne proporcie, tvar/maska, farba koze, handry a vlasy (zoznam VARIANTY dole).
# Kostra rovnaka ako src/modely_bledych.js (animacia ostava tam):
#   telo (panva) > chrbat > krk > hlava;  telo > stehno_L/P > koleno_L/P
#   chrbat > rameno_L/P > laket_L/P > zap_L/P > prst_L0..4 > prst_L0b ...   (L = strana -1 = -x, P = +x; prst 4 = palec)
# Koncatiny visia z klbu dole (-y). Materialy maju farby vo vrcholoch, JS ich nemeni.
# Stary modely/moby/bledy.glb sa uz negeneruje (v hre ostava ako zaloha).
# Spustenie vsetkych: blender -b --python nastroje/blender/moby_bledy.py
# Len niektore:       blender -b --python nastroje/blender/moby_bledy.py -- bledy_2 matka
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mob import *
from bledy_pomoc import *
from bledy_hlava import Tvar, hlava, rohy


def materialy():
    ziara = dict(ziara=0x6f86a8, sila=1.0)                       # v tme len slabo vidiet; hra ziaru nasobi farbou vrcholu (tiene ostanu)
    return {
        'koza': mat_farby('koza', 0.74, **ziara),
        'maska': mat_farby('maska', 0.48, ziara=0x20242a, sila=0.4),
        'oko': mat_farby('oko', 0.12, ziara=0x20262c, sila=0.5),
        'svit': mat_farby('svit', 0.2, ziara=0x8c9478, sila=0.9),   # bodka v ciernom oku
        'zuby': mat_farby('zuby', 0.4, ziara=0x1c1c1c, sila=0.4),
        'diera': mat_farby('diera', 1.0),
        'pazur': mat_farby('pazur', 0.42),
        'latka': mat_farby('latka', 0.95, ziara=0x0a0e14, sila=0.35),
        'vlasy': mat_farby('vlasy', 0.97),
        'nit': mat_farby('nit', 0.9),
    }


# ---------- farba koze ----------
def koza_malba(v):
    """Vrati funkciu(bod vo svete, mena pivotov nad dielom) -> farba. Flaky, modriny, zily, spina na koncoch."""
    zakl, flak, modrina, zila, spina = (rgb(v[k]) for k in ('farba', 'flak', 'modrina', 'zila', 'spina'))
    s = v['seed'] * 1.37
    rnd = random.Random(v['seed'] * 7)
    miesta = [((rnd.uniform(-0.24, 0.24), rnd.uniform(0.7, 2.45), rnd.uniform(-0.1, 0.12)), rnd.uniform(0.06, 0.14))
              for _ in range(v.get('modriny', 8))]

    def f(w, predkovia):
        c = mix(zakl, flak, hladko(-0.1, 0.5, sum3(w, 7.5, s)))
        c = mix(c, zakl, 0.4 * hladko(0.0, 0.5, sum3(w, 19, s + 2)))
        k = 1 + 0.15 * sum3(w, 45, s + 9)                                        # drobna "zrnitost" koze
        c = (c[0] * k, c[1] * k, c[2] * k)
        for (mx, my, mz), r in miesta:                                           # modriny: modrofialovy stred, zltkasty okraj
            d = math.dist(w, (mx, my, mz)) / r + 0.35 * sum3(w, 24, s + 4)
            if d < 1.5:
                c = mix(c, rgb(0x857458), 0.22 * hladko(1.5, 1.0, d))
                c = mix(c, modrina, 0.55 * hladko(1.1, 0.35, d))
        zily = 1 - hladko(0.0, 0.075, abs(sum3((w[0], w[1] * 0.45, w[2]), 17, s + 13)))
        c = mix(c, zila, v['zily'] * zily * hladko(-0.15, 0.35, sum3(w, 4.2, s + 21)))
        ruka_koniec = any(n.startswith('zap_') or n.startswith('prst_') for n in predkovia)
        spinave = 0.0
        if ruka_koniec:
            spinave = 0.55 + 0.45 * hladko(0.6, 0.32, w[1])
        elif any(n.startswith('laket_') for n in predkovia):
            spinave = hladko(1.15, 0.6, w[1]) * 0.6
        elif any(n.startswith('koleno_') for n in predkovia):
            spinave = max(hladko(0.42, 0.02, w[1]), 0.5 * gauss(w[1] - 0.74, w[2] - 0.05, 0.07, 0.06))
        if spinave > 0:
            c = mix(c, spina, spinave * (0.75 + 0.5 * sum3(w, 30, s + 17)))
        return c
    return f


# ---------- trup ----------
#           y     sirka  vpredu  vzadu   (lokalne v pivote 'chrbat')
PROFIL = [(-0.09, 0.112, 0.080, 0.082), (0.04, 0.128, 0.082, 0.088), (0.18, 0.098, 0.058, 0.076), (0.30, 0.125, 0.082, 0.092),
          (0.45, 0.160, 0.112, 0.104), (0.60, 0.180, 0.122, 0.108), (0.74, 0.196, 0.112, 0.108), (0.84, 0.232, 0.090, 0.098),
          (0.905, 0.175, 0.072, 0.090), (0.955, 0.075, 0.056, 0.062), (1.0, 0.040, 0.040, 0.044)]


def profil(y):
    if y <= PROFIL[0][0]:
        return PROFIL[0][1:]
    for i in range(len(PROFIL) - 1):
        a, b = PROFIL[i], PROFIL[i + 1]
        if y <= b[0]:
            p0, p3 = PROFIL[max(i - 1, 0)], PROFIL[min(i + 2, len(PROFIL) - 1)]
            t = (y - a[0]) / (b[0] - a[0])
            return tuple(0.5 * (2 * a[k] + (b[k] - p0[k]) * t + (2 * p0[k] - 5 * a[k] + 4 * b[k] - p3[k]) * t * t
                                + (3 * a[k] - p0[k] - 3 * b[k] + p3[k]) * t ** 3) for k in (1, 2, 3))
    return PROFIL[-1][1:]


def trup_bod(v, y, a, navyse=0.0):
    """Bod na povrchu trupu: y = vyska, a = uhol (0 = predok, +pi/2 = bok +x)."""
    sir, vp, vz = profil(y)
    sir *= 1 + (v['plecia'] - 1) * hladko(0.5, 0.82, y)
    chudy = v['chudy']
    pas = 1 - 0.22 * chudy * gauss(y - 0.2, 0, 0.13, 1)
    sa, ca = math.sin(a), math.cos(a)
    x = sir * pas * sa * v.get('hrud', 1.0)
    z = (vp if ca >= 0 else vz) * pas * ca * v.get('hrud', 1.0)
    d = 0.0
    if ca > -0.35:                                                                # rebra POD kozou (nie biele obruce)
        yr = y + 0.045 * abs(sa) - 0.02
        vlna = math.cos((yr - 0.40) / 0.068 * math.tau)
        rozsah = hladko(0.33, 0.40, y) * hladko(0.74, 0.62, y) * hladko(0.12, 0.38, abs(sa)) * hladko(-0.35, 0.1, ca)
        d += v['rebra'] * 0.0085 * (max(0, vlna) ** 1.5 - 0.35) * rozsah
        d -= 0.016 * chudy * gauss(y - 0.22, sa, 0.1, 0.6) * max(0, ca)            # vpadnute brucho
        d += 0.010 * gauss(y - 0.855 - 0.03 * abs(sa), abs(sa) - 0.45, 0.016, 0.42)   # klucne kosti
        d -= 0.009 * gauss(y - 0.885, abs(sa) - 0.38, 0.016, 0.25)
        d -= 0.006 * gauss(y - 0.6, sa, 0.16, 0.07) * max(0, ca)                   # ryha na hrudi
    if ca < 0:
        chrb = hladko(0.0, -0.5, ca)
        stavec = max(0, math.cos(y / 0.075 * math.tau)) ** 2
        d += v['chrbtica'] * (0.006 + 0.016 * stavec) * math.exp(-(sa / 0.13) ** 2) * hladko(0.02, 0.12, y) * hladko(0.98, 0.86, y) * chrb
        d += 0.016 * gauss(y - 0.69, abs(sa) - 0.5, 0.085, 0.22) * chrb            # lopatky
    ln = math.hypot(sa, ca)
    return (x + sa / ln * (d + navyse), y, z + ca / ln * (d + navyse))


def trup(chrbat, v, M, koza):
    riadky = [[trup_bod(v, -0.09 + 1.09 * i / 54, j / 44 * math.tau) for j in range(44)] for i in range(55)]
    zaklad = koza

    def farba(w, l):
        c = zaklad(w, ['chrbat', 'telo'])
        x, y, z = l
        if z > 0 and 0.33 < y < 0.74 and abs(x) > 0.025:                            # tien medzi rebrami
            vlna = math.cos((y + 0.045 * min(1, abs(x) / 0.17) - 0.02 - 0.40) / 0.068 * math.tau)
            c = mix(c, rgb(0x4a3830), 0.38 * v['rebra'] * max(0, -vlna) * hladko(0.33, 0.42, y) * hladko(0.74, 0.62, y))
        if z > 0:
            c = mix(c, rgb(0x2a1715), 0.8 * gauss(x - v.get('asym', 0) * 0.2, y - 0.17, 0.009, 0.013))    # pupok
        return c
    farbi(siet(riadky, M['koza'], chrbat, meno='trup'), farba)


# ---------- koncatiny ----------
def hrube(body, k):
    return [(x, y, z, r * k) for x, y, z, r in body]


def zila_na(rodic, M, v, body):
    """Vypukla zila: tenka rurka tesne pod povrchom koze."""
    farbi(trubica(body, M['koza'], rodic, K=5, hladky=0, meno='zila'), lambda w, l: mix(rgb(v['farba']), rgb(v['zila']), 0.75))


def prst(zap, meno, poz, rot, L, v, M, rnd):
    a = pivot(meno, poz, zap, rot)
    trubica([(0, 0.008, 0, 0.0165), (0, -L * 0.18, 0, 0.0125), (0, -L * 0.55, 0.001, 0.0108), (0, -L * 0.9, 0, 0.0138), (0, -L * 1.02, 0, 0.0095)],
            M['koza'], a, K=6, hladky=0, meno='clanok')
    b = pivot(meno + 'b', (0, -L, 0), a)
    trubica([(0, 0.006, 0, 0.0115), (0, -L * 0.3, 0, 0.0092), (0, -L * 0.62, 0.001, 0.0102), (0, -L * 0.82, 0, 0.0085), (0, -L * 0.87, -0.001, 0.003)],
            M['koza'], b, K=6, hladky=0, meno='clanok')
    n = v['nechty'] * rnd.uniform(0.55, 1.2)                                       # kazdy necht ina dlzka (niektore zlomene)
    farbi(trubica([(0, -L * 0.72, 0.006, 0.0062), (0, -L * 0.87, 0.009, 0.0058), (0, -L * 0.87 - 0.04 * n, 0.013, 0.0038),
                   (0, -L * 0.87 - 0.075 * n, 0.024 * n, 0.0006)], M['pazur'], b, K=6, hladky=0, meno='necht'),
          rnd.choice((0x1d1712, 0x2b2117, 0x120f0c, 0x3a2d1c)))


def ruka(chrbat, strana, v, M, rnd):
    st = 'L' if strana < 0 else 'P'
    k = v['ruky'][0 if strana < 0 else 1]                                          # hrubka tejto ruky (asymetria)
    pk = v['plecia']
    rameno = pivot('rameno_' + st, (strana * 0.25, 0.84, 0), chrbat)
    diel('gula', M['koza'], rameno, (-strana * 0.022, -0.05, 0), (0.095 * pk, 0.19, 0.098 * k), rot=(0, 0, strana * 0.22), hladky=1, segm=10, meno='plece')   # pretiahnuty sval, nie gulovy klb
    trubica([(-strana * 0.075, -0.012, -0.008, 0.028 * k), (-strana * 0.025, -0.022, 0, 0.043 * k), (0, -0.2, 0.006, 0.043 * k), (0, -0.4, 0.004, 0.046 * k),
             (0, -0.62, 0, 0.031 * k), (0, -0.8, -0.004, 0.027 * k), (0, -0.87, -0.006, 0.033 * k)], M['koza'], rameno, K=10, meno='ramenna')
    laket = pivot('laket_' + st, (0, -0.86, 0), rameno)
    diel('gula', M['koza'], laket, (0, 0, -0.01), (0.066 * k, 0.082, 0.078 * k), hladky=1, segm=10, meno='lakt')
    op = v.get('opuch', (1.0, 1.0))[0 if strana < 0 else 1]                         # opuchnute predlaktie
    trubica([(0, 0.03, -0.004, 0.027 * k), (0, -0.06, 0, 0.037 * k * op), (0, -0.24, 0.006, 0.036 * k * op), (0, -0.5, 0.002, 0.025 * k),
             (0, -0.74, 0, 0.0185 * k), (0, -0.86, 0, 0.022 * k), (0, -0.92, 0, 0.019 * k)], M['koza'], laket, K=10, meno='predlaktie')
    zila_na(laket, M, v, [(strana * 0.006, -0.06, 0.036 * k * op, 0.0035), (-strana * 0.008, -0.24, 0.0405 * k * op, 0.0042),
                          (strana * 0.006, -0.46, 0.027 * k, 0.0035), (-strana * 0.004, -0.68, 0.02 * k, 0.003), (0, -0.82, 0.019 * k, 0.002)])
    zap = pivot('zap_' + st, (0, -0.9, 0), laket)
    diel('kocka', M['koza'], zap, (0, -0.062, 0), (0.092, 0.135, 0.032), hrana=0.3, hladky=1, meno='dlan')
    for i, (x, L) in enumerate(((-0.036, 0.17), (-0.012, 0.2), (0.012, 0.2), (0.036, 0.17))):
        diel('gula', M['koza'], zap, (x, -0.113, -0.008), (0.026, 0.03, 0.026), hladky=1, segm=6, meno='hanka')
        trubica([(x * 0.35, -0.01, -0.013, 0.006), (x, -0.108, -0.014, 0.0065)], M['koza'], zap, K=5, hladky=0, meno='slacha')
        prst(zap, f'prst_{st}{i}', (x, -0.12, 0), (0, 0, 0), L, v, M, rnd)
    prst(zap, f'prst_{st}4', (strana * 0.045, -0.06, 0.012), (0, 0, strana * 0.5), 0.12, v, M, rnd)


def noha(telo, strana, v, M, rnd):
    st = 'L' if strana < 0 else 'P'
    k = v['nohy']
    stehno = pivot('stehno_' + st, (strana * 0.15, 0, 0), telo)
    trubica([(-strana * 0.07, 0.05, -0.005, 0.05 * k), (-strana * 0.025, -0.02, 0, 0.072 * k), (0, -0.18, 0.008, 0.063 * k), (0, -0.42, 0.01, 0.052 * k),
             (0, -0.62, 0.004, 0.039 * k), (0, -0.73, 0.006, 0.045 * k)], M['koza'], stehno, K=10, meno='stehenna')
    koleno = pivot('koleno_' + st, (0, -0.72, 0), stehno)
    diel('gula', M['koza'], koleno, (0, 0, 0.022), (0.088 * k, 0.108, 0.088 * k), hladky=1, segm=10, meno='jablcko')
    trubica([(0, 0.03, 0, 0.04 * k), (0, -0.1, -0.012, 0.047 * k), (0, -0.28, -0.016, 0.042 * k), (0, -0.52, -0.004, 0.027 * k),
             (0, -0.68, 0, 0.022 * k), (0, -0.755, 0.002, 0.034 * k)], M['koza'], koleno, K=10, meno='lytko')
    zila_na(koleno, M, v, [(strana * 0.02, -0.08, 0.03 * k, 0.003), (strana * 0.008, -0.3, 0.028 * k, 0.004),
                           (-strana * 0.01, -0.52, 0.022 * k, 0.003), (0, -0.68, 0.022 * k, 0.002)])
    trubica([(0, -0.765, -0.045, 0.03), (0, -0.768, 0.02, 0.038), (0, -0.776, 0.1, 0.032), (0, -0.783, 0.145, 0.022)],
            M['koza'], koleno, K=10, meno='chodidlo')
    for i, x in enumerate((-0.036, -0.018, 0.0, 0.018, 0.034)):                      # dlhe prsty ako na ruke
        dl = 0.075 + 0.045 * (1 - abs(i - 2) / 3) + rnd.uniform(-0.012, 0.018)
        trubica([(x * 0.8, -0.778, 0.12, 0.0125), (x * 1.2, -0.776, 0.12 + dl * 0.6, 0.0095), (x * 1.35, -0.787, 0.12 + dl, 0.0095),
                 (x * 1.37, -0.79, 0.128 + dl, 0.003)], M['koza'], koleno, K=6, hladky=0, meno='prstnohy')
        farbi(trubica([(x * 1.34, -0.781, 0.115 + dl, 0.0058), (x * 1.42, -0.792, 0.14 + dl + 0.02 * v['nechty'] * rnd.random(), 0.0012)],
                      M['pazur'], koleno, K=5, hladky=0, meno='necht'), 0x241c13)


# ---------- handry ----------
def handra(rodic, M, farba, bod, a0, a1, hore, dole, seed, diery=0.18, trhanie=0.09, n=40, m=12):
    """Roztrhany kus latky: bod(y, uhol) = povrch, na ktorom latka lezi. Spodny okraj je zubaty."""
    rnd = random.Random(seed)
    spodok = [dole + trhanie * (sum3((j * 0.23, seed, 0), 1.0) + rnd.uniform(-0.35, 0.9)) for j in range(n + 1)]
    riadky = []
    for i in range(m + 1):
        t = i / m
        r = []
        for j in range(n + 1):
            a = a0 + (a1 - a0) * j / n
            vrch = hore(a) if callable(hore) else hore
            y = vrch + (spodok[j] - vrch) * t
            x, yy, z = bod(y, a)
            kr = 1 + 0.06 * t * sum3((a * 2.3, y * 9, 0), 1.0, seed)                  # zahyby
            r.append((x * kr, yy, z * kr))
        riadky.append(r)

    def prec(s):
        return sum3(s, 21, seed * 3.1) > 0.55 - diery

    zakl = rgb(farba)

    def malba(w, l):
        c = mix(zakl, rgb(0x191510), 0.8 * hladko(-0.05, 0.5, sum3(w, 11, seed)))
        c = mix(c, rgb(0x5c5240), 0.35 * hladko(0.15, 0.6, sum3(w, 27, seed + 3)))
        k = 1 + 0.18 * sum3((w[0] * 4, w[1], w[2] * 4), 26, seed)                      # vlakna
        return (c[0] * k, c[1] * k, c[2] * k)
    farbi(siet(riadky, M['latka'], rodic, uzavrete=False, vynechaj=prec, meno='handra', hladke=True), malba)


def okolo(rx, rz, rozsir=0.0, y0=0.0, cz=0.0):
    return lambda y, a: (math.sin(a) * (rx + rozsir * max(0, y0 - y)), y, cz + math.cos(a) * (rz + rozsir * max(0, y0 - y)))


def oblec(v, M, telo, chrbat, stehna, ramena):
    for i, (typ, farba) in enumerate(v['saty']):
        s = v['seed'] * 13 + i
        na_trupe = lambda y, a: trup_bod(v, y, a, 0.016)
        if typ == 'kosela':                        # zvysok kosele: chrbat a jeden bok
            handra(chrbat, M, farba, na_trupe, math.pi * 0.28, math.pi * 1.7, lambda a: 0.87 - 0.1 * abs(math.sin(a)), 0.34, s, diery=0.2, trhanie=0.14, n=36, m=18)
        elif typ == 'tielko':                      # cele okolo hrude
            handra(chrbat, M, farba, na_trupe, -math.pi, math.pi, lambda a: 0.77 + 0.06 * math.sin(a * 1.0 + 0.8), 0.24, s, diery=0.12, trhanie=0.11, n=44, m=16)
        elif typ == 'sukna':                       # dlhe franforce od pasu
            handra(telo, M, farba, okolo(0.152, 0.112, 0.2, 0.0), -math.pi, math.pi, 0.1, -0.5, s, diery=0.2, trhanie=0.2, n=44, m=13)
        elif typ == 'pas':                         # kratka bederna handra
            handra(telo, M, farba, okolo(0.152, 0.112, 0.16, 0.0), -math.pi, math.pi, 0.095, -0.17, s, diery=0.1, trhanie=0.09, n=48, m=9)
        elif typ == 'nohavice':                    # zvysky nohavic na stehnach, kazda noha inak dlha
            handra(telo, M, farba, okolo(0.148, 0.108, 0.1, 0.0), -math.pi, math.pi, 0.095, -0.09, s, diery=0.04, trhanie=0.04, n=40, m=6)
            for j, stehno in enumerate(stehna):
                handra(stehno, M, farba, okolo(0.077 * v['nohy'], 0.08 * v['nohy'], 0.0, 0.0, 0.006), -math.pi, math.pi, 0.0, (-0.62, -0.36)[(j + v['seed']) % 2], s + j, diery=0.12, trhanie=0.12, n=24, m=14)
        elif typ == 'salka':                       # popruh sikmo cez hrud
            def sikmo(t, a):
                return trup_bod(v, t + 0.17 * math.sin(a) + 0.02, a, 0.019)
            handra(chrbat, M, farba, sikmo, -math.pi, math.pi, 0.64, 0.54, s, diery=0.03, trhanie=0.025, n=52, m=4)
        elif typ == 'rukav':
            handra(ramena[v['seed'] % 2], M, farba, okolo(0.061, 0.061), -math.pi, math.pi, 0.02, -0.4, s, diery=0.16, trhanie=0.13, n=22, m=12)


# ---------- cely Bledy ----------
def bledy(meno, v):
    zacni()
    M = materialy()
    rnd = random.Random(v['seed'])
    koza = koza_malba(v)

    telo = pivot('telo', (0, 1.46, 0))
    diel('gula', M['koza'], telo, (0, 0.005, -0.002), (0.27 * (1 - 0.1 * v['chudy']), 0.19, 0.17), hladky=1, segm=16, meno='panva')
    for s in (-1, 1):
        diel('gula', M['koza'], telo, (s * 0.092, 0.045, 0.035), (0.07, 0.06, 0.075), hladky=1, segm=10, meno='bedro')

    chrbat = pivot('chrbat', (0, 0.06, 0), telo)
    trup(chrbat, v, M, koza)

    for s in (-1, 1):                                                                              # sval od krku k plecu (plynuly prechod)
        trubica([(s * 0.025, 1.0, -0.012, 0.03), (s * 0.095, 0.925, -0.02, 0.038), (s * 0.175 * v['plecia'], 0.875, -0.012, 0.036),
                 (s * 0.232, 0.845, -0.004, 0.026)], M['koza'], chrbat, K=8, meno='trapez')
    krk = pivot('krk', (0, 0.95, 0.02), chrbat)
    h = v['krk_h']
    trubica([(0, -0.07, -0.025, 0.066 * h), (0, 0.02, -0.008, 0.046 * h), (0, 0.12, 0.005, 0.039 * h), (0, 0.24, 0.032, 0.044 * h)], M['koza'], krk, K=12, meno='sija')
    for s in (-1, 1):                                                                              # napnute slachy
        trubica([(s * 0.032, 0.23, 0.055, 0.011), (s * 0.026, 0.1, 0.042 * h, 0.012), (s * 0.018, -0.03, 0.05, 0.0105), (s * 0.04, -0.09, 0.05, 0.008)],
                M['koza'], krk, K=6, hladky=0, meno='slachak')
    diel('gula', M['koza'], krk, (0, 0.085, 0.036 * h), (0.028, 0.04, 0.026), hladky=1, segm=8, meno='hrtan')
    zila_na(krk, M, v, [(0.04 * h, 0.21, 0.035, 0.003), (0.036 * h, 0.12, 0.025, 0.004), (0.046 * h, 0.03, 0.028, 0.0035), (0.07, -0.05, 0.034, 0.002)])
    hl = pivot('hlava', (0, 0.22, 0.04), krk)
    dlhy = v.get('dlhy_krk', 0.0)
    if dlhy > 0.01:                                                                                # natiahnuty krk: hlava je vyssie nad klbom
        trubica([(0, -0.04, -0.012, 0.042 * h), (0, dlhy * 0.5, -0.004, 0.034 * h), (0, dlhy + 0.04, 0.0, 0.042 * h)], M['koza'], hl, K=12, meno='sija2')
    else:
        trubica([(0, -0.03, -0.01, 0.044 * h), (0, 0.045, -0.002, 0.046 * h)], M['koza'], hl, K=12, meno='sija2')
    nx, ny, nz = v.get('naklon', (0, 0, 0))                                                      # zhrbeny postoj: tvar zdvihnuta k hracovi
    tvar = pivot('tvar', (0, dlhy, 0), hl, rot=(nx - 0.28, ny, nz))                              # len na vzhlad, hra ho neotaca
    hlava(tvar, Tvar(v['tvar']), M, koza, {'modrina': rgb(v['modrina']), 'rana': rgb(0x6a3a38)}, v['seed'])
    if v.get('rohy'):
        rohy(tvar, M)

    stehna, ramena = [], []
    for s in (-1, 1):
        ruka(chrbat, s, v, M, rnd)
        noha(telo, s, v, M, rnd)
    ob = {o.name: o for o in bpy.data.objects if o.type == 'EMPTY'}
    oblec(v, M, telo, chrbat, [ob['stehno_L'], ob['stehno_P']], [ob['rameno_L'], ob['rameno_P']])
    dokonci(koza)
    export(meno)


VARIANTY = {
    # 1: sivozlty, polovica porcelanovej masky na lavej strane, druha polovica je skoro normalny clovek; redke dlhe vlasy
    'bledy_1': dict(
        seed=3, farba=0xa39384, flak=0x867568, modrina=0x66525a, zila=0x5f5e62, spina=0x35291f, zily=0.28, modriny=6,
        plecia=1.0, chudy=0.8, rebra=0.9, chrbtica=1.0, ruky=(1.0, 0.86), nohy=1.0, krk_h=1.0, dlhy_krk=0.03, naklon=(0, 0, 0.09), nechty=1.0,
        tvar=dict(oci=('prazdne', 'ludske'), eyP=0.007, maska=lambda x, y: x < -0.004 + 0.3 * (y - 0.1) * 0.5,
                  maska_diery=((-0.04, 0.115, 0.017, 0.011),), praskliny=4, my=0.004, mw=0.04, mh=0.009, zuby=10, usmev=0.004,
                  vlasy=dict(pocet=85, dlzka=0.34, farba=0x261c12, strana=1)),
        saty=[('kosela', 0x4a4436), ('pas', 0x35281c)]),
    # 2: zelenkasty utopenec: obe oci zasite, siroke dokoran otvorene usta plne zubov, holohlavy, silne zily
    'bledy_2': dict(
        seed=8, farba=0x97908a, flak=0x7b736c, modrina=0x5f4f58, zila=0x555a5e, spina=0x2a241d, zily=0.4, modriny=7,
        plecia=1.14, chudy=0.55, rebra=0.6, chrbtica=0.75, ruky=(1.14, 1.14), nohy=1.1, krk_h=1.3, nechty=0.65,
        tvar=dict(sirka=1.06, brada=0.64, oci=('zasite', 'zasite'), ex=0.041, jamka=0.02, licne=0.01, vpadle=0.01, nos=0.022,
                  my=-0.012, mw=0.036, mh=0.036, zuby=12, pery=0x45433c),
        saty=[('nohavice', 0x2b3540)]),
    # 3: bledoruzovy s modrinami, bez oci (koza zarastena cez jamky), privysoke ostre lica, siroky tichy usmev; dlhy krk
    'bledy_3': dict(
        seed=15, farba=0xa69189, flak=0x8b756e, modrina=0x6a4e5a, zila=0x66565e, spina=0x38261f, zily=0.28, modriny=7,
        plecia=0.86, chudy=1.0, rebra=1.15, chrbtica=1.2, ruky=(0.82, 0.82), nohy=0.86, krk_h=0.82, dlhy_krk=0.1, naklon=(0.05, 0, -0.17), nechty=1.15,
        tvar=dict(sirka=0.95, vyska=1.07, brada=0.46, oci=('zarastene', 'zarastene'), ey=0.12, licne=0.026, vpadle=0.024, nos=0.018,
                  my=0.012, mw=0.062, mh=0.0075, usmev=0.026, zuby=18, pery=0x5e2f36),
        saty=[('salka', 0x4a2620), ('pas', 0x3a3226), ('rukav', 0x3c3a30)]),
    # 4: modrosivy: velke cierne oci priliz daleko od seba, nos skoro chyba, male zavrete usta; mokre cierne vlasy
    'bledy_4': dict(
        seed=23, farba=0x908d8c, flak=0x767272, modrina=0x584e60, zila=0x4e5260, spina=0x262220, zily=0.38, modriny=6,
        plecia=0.93, chudy=0.75, rebra=0.8, chrbtica=0.9, ruky=(0.9, 1.0), nohy=0.94, krk_h=0.9, dlhy_krk=0.045, naklon=(0, 0.08, 0.05), nechty=0.85,
        tvar=dict(sirka=1.05, brada=0.44, ex=0.054, ey=0.1, jamka=0.02, r_oka=0.0235, oci=('cierne', 'cierne'), eyP=0.004, licne=0.011,
                  nos=0.012, nos_y=0.045, my=-0.006, mw=0.019, mh=0.0035, pery=0x3a3450,
                  vlasy=dict(pocet=240, dlzka=0.52, farba=0x0e0c0b, strana=0, cez_tvar=0.11)),
        saty=[('tielko', 0x353d38), ('sukna', 0x2c3132)]),
    # 5: voskovy zltohnedy: spodok tvare zakryva maska, nad nou biele slepe oci v roznej vyske; opuchnute prave predlaktie
    'bledy_5': dict(
        seed=31, farba=0xa18d76, flak=0x85715c, modrina=0x694c4a, zila=0x615648, spina=0x2e1f12, zily=0.25, modriny=5,
        plecia=1.2, chudy=0.45, rebra=0.5, chrbtica=0.8, ruky=(0.92, 1.18), opuch=(1.0, 1.45), nohy=1.05, krk_h=1.15, naklon=(-0.03, 0, 0.04), nechty=0.9,
        tvar=dict(oci=('slepe', 'slepe'), ex=0.039, eyP=0.016, r_oka=0.018, licne=0.018, my=0.0, mw=0.03, mh=0.004,
                  maska=lambda x, y: y < 0.07 + 0.012 * math.cos(x * 60) - 0.15 * x, maska_farba=0xbdb6a4, praskliny=5,
                  vlasy=dict(pocet=55, dlzka=0.11, farba=0x4a4034, strana=0)),
        saty=[('tielko', 0x55301f), ('nohavice', 0x332d24)]),
    # 6: popolavy so silnymi zilami: zosite usta, jedno oko otvorene dokoran a druhe zasite; vychudnuty do kosti
    'bledy_6': dict(
        seed=44, farba=0x96908a, flak=0x77706c, modrina=0x5c4a54, zila=0x474a56, spina=0x2a2018, zily=0.5, modriny=7,
        plecia=1.04, chudy=1.25, rebra=1.35, chrbtica=1.35, ruky=(0.88, 0.76), nohy=0.84, krk_h=0.85, dlhy_krk=0.06, naklon=(0, -0.06, 0.2), nechty=1.3,
        tvar=dict(vyska=1.1, brada=0.5, oci=('ludske', 'zasite'), eyP=-0.009, r_oka=0.0195, jamka=0.03, vpadle=0.027, licne=0.019, nos_y=0.045,
                  my=-0.015, mw=0.038, mh=0.004, usmev=-0.012, usta_zasite=True, pery=0x4d3238,
                  vlasy=dict(pocet=40, dlzka=0.2, farba=0x77705f, strana=-1)),
        saty=[('rukav', 0x2f3a33), ('sukna', 0x453a2a)]),
    # Matka: tmava sivofialova, rohy z kosti, maska bez otvorov cez oci, pod nou obrovske otvorene usta; vlasy po pas
    'matka': dict(
        seed=57, farba=0x7c706b, flak=0x5f5350, modrina=0x452e3c, zila=0x35303a, spina=0x18110d, zily=0.48, modriny=9,
        plecia=1.1, chudy=1.0, rebra=1.1, chrbtica=1.5, ruky=(1.05, 1.05), nohy=1.0, krk_h=1.05, dlhy_krk=0.05, nechty=1.4, rohy=True,
        tvar=dict(vyska=1.08, brada=0.5, oci=('zarastene', 'zarastene'), licne=0.022, vpadle=0.022, my=-0.02, mw=0.037, mh=0.043, zuby=13, pery=0x2c1620,
                  maska=lambda x, y: y > 0.058 + 0.5 * abs(x) * (1 if x > 0 else 0.4) and y < 0.275, maska_farba=0x9a8c70, praskliny=7,
                  vlasy=dict(pocet=165, dlzka=0.95, farba=0x15100f, strana=0, cez_tvar=0.0)),
        saty=[('sukna', 0x2a1e22), ('kosela', 0x241c1c), ('salka', 0x3a1a18)]),
}

if __name__ == '__main__':
    vyber = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(VARIANTY)
    for meno in vyber:
        bledy(meno, VARIANTY[meno])
