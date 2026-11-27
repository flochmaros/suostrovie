# Boss KRAKEN -> modely/moby/kraken.glb  a  chapadlo zo zeme (vrh) -> modely/moby/chapadlo.glb
# Pivoty (hra ich otaca, src/modely_bossov.js):
#   kraken:   trup > celust (spodny zobak);  chapadlo_k (koren, k=0..7) > chapadlo_k_0 > ... > chapadlo_k_5
#   chapadlo: zem_0 > ... > zem_6 (stoji zvislo, prisavky smeruju na +Z)
# Materialy: kuza, svetla (blikaju pri zasahu), prisavka, zobak, oko (JS meni intenzitu), zrenica, biolum (JS meni intenzitu)
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True
from mob import *
from siet import *

C = lambda h: srgb(h)


def materialy():
    return dict(
        kuza=farebny('kuza', 0.34, 0.05),
        svetla=farebny('svetla', 0.35),
        prisavka=farebny('prisavka', 0.4),
        zobak=farebny('zobak', 0.3, 0.2),
        oko=material('oko', 0x2a1800, 0.15, ziara=0xffa818, sila=2.0),
        zrenica=material('zrenica', 0x030000, 0.1),
        biolum=material('biolum', 0x201030, 0.3, ziara=0xd860ff, sila=1.5),
    )


# ---------- farby koze: tmavy fialovocerveny chrbat, ruzove brucho, flaky ----------
CHRBAT, BOK, BRUCHO, FLAK = C(0x200a1e), C(0x58183a), C(0x984862), C(0x10040e)


def koza(p, n, spodok=0.0):
    c = mix(BOK, CHRBAT, n.y * 1.3 + sum3(p, 2.2) * 0.6)
    c = mix(c, BRUCHO, -n.y * 1.5 - 0.35 + spodok)
    f = sum3(p, 5.5, 7.0)
    if f > 0.22:
        c = mix(c, FLAK, (f - 0.22) * 4 * (1 - spodok))
    return jas(c, 1 + sum3(p, 14, 3.0) * 0.22)


def farba_prisavky(p, n):
    return jas(mix(C(0xe8a8ac), C(0xf4d8c8), sum3(p, 6) + 0.5), 1.0)


# ================= HLAVA A PLAST =================
def kraken():
    zacni()
    M = materialy()
    g_trup = pivot('trup', (0, 0.9, 0))

    # plast: vajcity vak nakloneny dozadu, pozdlzne rebra a vrasky, v strede zadu spicatejsi
    STRED, R, NAKLON = V((0, 1.05, -0.3)), (0.9, 1.3, 0.95), (-0.42, 0, 0)

    def tvar_plasta(d):
        uhol = math.atan2(d.x, d.z)
        rebra = 0.045 * max(0, math.cos(uhol * 9)) ** 3 * (1 - abs(d.y))
        pas = 1 - 0.2 * max(0, -d.y - 0.25)                        # zuzenie pri krku
        spicka = 1 + 0.1 * max(0, d.y) ** 3
        vrasky = 0.022 * math.sin(d.y * 26 + sum3(d, 3) * 5) * max(0, 1 - abs(d.y - 0.1) * 1.6)
        return (1 + rebra + vrasky + sum3(d, 2.6, 1.0) * 0.07 + sum3(d, 7, 4.0) * 0.022) * pas * spicka

    pridaj(g_trup, M['kuza'], elipsoid(STRED, R, NAKLON, 5, tvar_plasta), koza)

    def na_plasti(d, von=0.0):                                     # bod na povrchu plasta v smere d (pred naklonom)
        d = V(d).normalized()
        k = tvar_plasta(d)
        loc = V((d.x * R[0], d.y * R[1], d.z * R[2])) * k
        nrm = V((d.x / R[0], d.y / R[1], d.z / R[2])).normalized()
        n = otoc(nrm, NAKLON)
        return otoc(loc, NAKLON) + STRED + n * von, n

    # hreben z tupych ostnov po strede hlavy
    for i in range(9):
        a = -0.1 + i * 0.27                                        # od cela cez temeno dozadu
        p, n = na_plasti((0, math.cos(a - 0.35), -math.sin(a - 0.35)), -0.02)
        v = 0.13 + 0.15 * math.sin(math.pi * (i + 0.6) / 9.5)
        pridaj(g_trup, M['kuza'], rurka([p, p + n * v * 0.6 + V((0, 0, -0.03)), p + n * v + V((0, -0.01, -0.12))],
                                        [0.085, 0.045, 0.006], 6), lambda p, n: mix(CHRBAT, C(0xb04868), sum3(p, 9) * 0.8))
    # bradavice a svetielkujuce bodky
    rnd = random.Random(11)
    for i in range(44):
        d = V((rnd.uniform(-1, 1), rnd.uniform(-0.15, 1), rnd.uniform(-1, 0.8))).normalized()
        if abs(d.x) < 0.14 and d.y > 0.3:
            continue
        p, n = na_plasti(d)
        s = rnd.uniform(0.03, 0.085)
        pridaj(g_trup, M['svetla'], elipsoid(p, (s, s, s), delenie=2, tvaruj=lambda q: 1 - 0.4 * abs(q.dot(d))),
               lambda p, n: mix(C(0x8c3058), C(0xd07890), sum3(p, 8) + 0.35))
    for s in (-1, 1):                                              # dva rady svetielok po bokoch
        for i in range(8):
            p, n = na_plasti((s * 0.85, 0.75 - i * 0.17, 0.5 - i * 0.09 - 0.1 * math.sin(i)), 0.0)
            r = 0.045 - abs(i - 3) * 0.004
            pridaj(g_trup, M['biolum'], elipsoid(p, (r, r, r), delenie=2))
            pridaj(g_trup, M['kuza'], torus(p, n, r * 1.25, r * 0.45, 8, 4), lambda p, n: CHRBAT)
    # barnakle (stare zviera)
    for sm, kolko in (((0.55, 0.7, -0.45), 9), ((-0.7, 0.35, -0.6), 7), ((-0.2, 0.95, 0.15), 4)):
        for i in range(kolko):
            d = V(sm) + V((rnd.uniform(-0.18, 0.18), rnd.uniform(-0.18, 0.18), rnd.uniform(-0.18, 0.18)))
            p, n = na_plasti(d, -0.015)
            s = rnd.uniform(0.03, 0.07)
            pridaj(g_trup, M['zobak'], rurka([p, p + n * s * 1.1], [s, s * 0.45], 6, konce=False),
                   lambda p, n: jas(C(0xa89c84), 1 + sum3(p, 20) * 0.35), hladke=False)

    # dolna cast hlavy (tvar s ocami)
    def tvar_tvare(d):
        return 1 + sum3(d, 3, 9.0) * 0.07 + sum3(d, 8, 2.0) * 0.025

    pridaj(g_trup, M['kuza'], elipsoid((0, 0.14, 0.12), (0.76, 0.52, 0.66), delenie=4, tvaruj=tvar_tvare), koza)

    # oci: velke zlte gule v jamkach, zvisla zrenica, tazke zamracene obocie
    for s in (-1, 1):
        o = V((s * 0.5, 0.2, 0.62))
        smer = V((s * 0.45, 0.04, 1)).normalized()
        pridaj(g_trup, M['kuza'], elipsoid(o - smer * 0.07, (0.285, 0.265, 0.25), delenie=3), koza)
        pridaj(g_trup, M['oko'], elipsoid(o + smer * 0.07, (0.19, 0.18, 0.17), delenie=3))
        pridaj(g_trup, M['zrenica'], elipsoid(o + smer * 0.235, (0.036, 0.14, 0.022), (0, s * 0.42, -s * 0.12), 3))
        pridaj(g_trup, M['oko'], elipsoid(o + smer * 0.245 + V((-0.05 * s, 0.07, 0.01)), (0.018, 0.018, 0.012), delenie=2))
        pridaj(g_trup, M['kuza'], torus(o + smer * 0.13, smer, 0.205, 0.045, 24, 8), lambda p, n: mix(CHRBAT, BOK, n.y))
        # obocie: pri strede nizko, von hore
        cesta = [V((s * 0.1, 0.27, 0.77)), V((s * 0.27, 0.39, 0.87)), V((s * 0.49, 0.46, 0.89)),
                 V((s * 0.7, 0.50, 0.73)), V((s * 0.84, 0.62, 0.45))]
        pridaj(g_trup, M['kuza'], rurka(cesta, [0.07, 0.12, 0.13, 0.09, 0.012], 10, 0.75),
               lambda p, n: koza(p, n, -0.3))
        for i, v in ((1, 0.13), (2, 0.19), (3, 0.24)):               # rozky nad ocami
            z = cesta[i] + V((0, 0.05, -0.01))
            pridaj(g_trup, M['zobak'], rurka([z, z + V((s * 0.05 * i, v * 0.7, 0.0)), z + V((s * 0.09 * i, v, -0.1))],
                                             [0.05, 0.028, 0.004], 6), lambda p, n: mix(C(0x241018), C(0xa07868), (p.y - 0.5) * 2.5))

    # zobak: horny pevny, spodny na pivote 'celust' (otvara sa), okolo mäsity prstenec
    pridaj(g_trup, M['kuza'], torus((0, -0.1, 0.72), (0, -0.25, 1), 0.2, 0.085, 22, 8), lambda p, n: koza(p, n, 0.7))
    pridaj(g_trup, M['zrenica'], elipsoid((0, -0.1, 0.7), (0.19, 0.17, 0.08), delenie=3))
    tmavy = lambda p, n: mix(C(0x100808), C(0x8a5a30), (p.z - 0.92) * -3 + sum3(p, 10) * 0.2)
    pridaj(g_trup, M['zobak'], rurka([(0, 0.01, 0.7), (0, 0.01, 0.93), (0, -0.09, 1.07), (0, -0.26, 1.05)],
                                     [0.17, 0.13, 0.075, 0.006], 8, 0.75), tmavy, hladke=False)
    celust = pivot('celust', (0, -0.14, 0.66), g_trup)
    pridaj(celust, M['zobak'], rurka([(0, -0.09, 0.03), (0, -0.13, 0.27), (0, -0.07, 0.37), (0, 0.04, 0.36)],
                                     [0.14, 0.095, 0.05, 0.005], 8, 0.65), lambda p, n: C(0x1c0e0a), hladke=False)
    for s in (-1, 1):                                              # fuziky okolo zobaka
        for i in range(3):
            z = V((s * (0.2 + i * 0.09), -0.16 - (i % 2) * 0.05, 0.7 - i * 0.07))
            pridaj(g_trup, M['kuza'], rurka([z, z + V((s * 0.03, -0.2, 0.12)), z + V((s * 0.09, -0.42, 0.1)), z + V((s * 0.07, -0.55, 0.19))],
                                            [0.06, 0.042, 0.025, 0.006], 7), lambda p, n: koza(p, n, 0.35))

    # plachta (blana) medzi chapadlami, zasahuje do vody
    n_u, n_v = 64, 6
    verts, faces = [], []
    for j in range(n_v + 1):
        t = j / n_v
        for i in range(n_u):
            a = i / n_u * math.tau
            vlna = math.cos((a - 0.2) * 8)                         # vrcholy v smere chapadiel
            r = 0.55 + t * (0.62 + 0.18 * vlna)
            y = 0.05 - 0.78 * t ** 1.6 + (0.12 * vlna + sum3((math.cos(a), math.sin(a), t), 3) * 0.07) * t
            verts.append(V((math.sin(a) * r, y, math.cos(a) * r)))
    for j in range(n_v):
        for i in range(n_u):
            a, b = j * n_u + i, j * n_u + (i + 1) % n_u
            faces.append([a, a + n_u, b + n_u, b])
    pridaj(g_trup, M['kuza'], (verts, faces), lambda p, n: mix(C(0x5c1a3c), C(0x2c0c24), -p.y * 1.5 + sum3(p, 4) * 0.5))
    # sifon na boku
    sif = [V((-0.55, 0.15, 0.15)), V((-0.85, 0.12, 0.32)), V((-1.02, 0.18, 0.5))]
    pridaj(g_trup, M['kuza'], rurka(sif, [0.2, 0.14, 0.115], 12, konce=False), koza)
    pridaj(g_trup, M['kuza'], torus(sif[-1], sif[-1] - sif[-2], 0.115, 0.035, 14, 6), lambda p, n: BRUCHO)

    # ---------- 8 chapadiel: koren + 6 clankov po 0.5 m pozdlz +Z ----------
    polomery = [0.31, 0.25, 0.2, 0.155, 0.115, 0.075, 0.012]
    for k in range(8):
        a = k / 8 * math.tau + 0.2
        koren = pivot('chapadlo_%d' % k, (math.sin(a) * 0.7, 0.4, math.cos(a) * 0.7))
        rodic = koren
        for i in range(6):
            c = pivot('chapadlo_%d_%d' % (k, i), (0, 0, 0.5 if i else 0), rodic)
            rodic = c
            r0, r1 = polomery[i], polomery[i + 1]
            dlzka = 0.6 if i == 5 else 0.53
            kroky = 5 if i == 5 else 3
            body = [V((0, 0, dlzka * j / kroky)) for j in range(kroky + 1)]
            if i == 5:                                             # spicka sa jemne tocí
                body = [V((0, 0.17 * (j / kroky) ** 2.2, dlzka * j / kroky)) for j in range(kroky + 1)]
            rad = [(r0 + (r1 - r0) * j / kroky) * (1 + 0.035 * math.sin(j / kroky * math.pi)) for j in range(kroky + 1)]
            posun = V((k * 3.1, 0, i * 0.5))                       # flaky pokracuju plynulo cez klby
            farba = lambda p, n, po=posun: koza(p + po, n, 0.12 if n.y < -0.5 else 0.0)
            pridaj(c, M['kuza'], rurka(body, rad, 12, 0.9, konce=False), farba)
            pridaj(c, M['kuza'], elipsoid((0, 0, 0), (r0 * 0.99, r0 * 0.89, r0 * 0.99), delenie=2), farba)   # klb zakryje medzery
            # prisavky: dva striedave rady naspodku
            for j in range(4 if i < 5 else 3):
                t = (j + 0.5) / (4 if i < 5 else 3)
                r = r0 + (r1 - r0) * t
                strana = -1 if j % 2 else 1
                uh = strana * 0.62
                n = V((math.sin(uh), -math.cos(uh), 0))
                p = V((n.x * r, n.y * r * 0.9, dlzka * t))
                if i == 5:
                    p.y += 0.17 * t ** 2.2
                pridaj(c, M['prisavka'], torus(p + n * r * 0.05, n, r * 0.31, r * 0.13, 8, 4, jamka=True), farba_prisavky)
            if i < 4:                                              # drobne hrbole na vrchu
                for j in range(2):
                    p = V((r0 * 0.35 * (-1) ** (j + k), r0 * 0.78, 0.14 + j * 0.23))
                    s = r0 * 0.13
                    pridaj(c, M['svetla'], elipsoid(p, (s, s * 0.8, s * 1.2), delenie=1),
                           lambda p, n: mix(C(0x78244c), C(0xc86884), sum3(p, 11) + 0.3))
    hotovo()
    export('kraken')


# ================= CHAPADLO ZO ZEME (vrh) =================
def chapadlo():
    zacni()
    M = materialy()
    polomery = [0.6, 0.52, 0.44, 0.36, 0.285, 0.21, 0.13, 0.015]
    rodic = None
    for i in range(7):
        c = pivot('zem_%d' % i, (0, 1.1 if i else 0, 0), rodic)
        rodic = c
        r0, r1 = polomery[i], polomery[i + 1]
        dlzka = 1.25 if i == 6 else 1.14
        kroky = 4
        zahni = lambda t: 0.4 * t ** 2.2 if i == 6 else 0.0
        body = [V((0, dlzka * j / kroky, zahni(j / kroky))) for j in range(kroky + 1)]
        rad = [r0 + (r1 - r0) * j / kroky for j in range(kroky + 1)]
        farba = lambda p, n, po=i * 1.7: koza(p * 0.7 + V((0, po, 0)), V((n.x, n.z * -0.8, n.y)), 0.0)
        pridaj(c, M['kuza'], rurka(body, rad, 12, 1.0, konce=False), farba)
        pridaj(c, M['kuza'], elipsoid((0, 0, 0), (r0 * 0.99, r0 * 0.99, r0 * 0.99), delenie=2), farba)
        # svetlejsi pas s prisavkami vpredu (+Z)
        pas = [V((0, dlzka * j / kroky, zahni(j / kroky) + rad[j] * 0.74)) for j in range(kroky + 1)]
        pridaj(c, M['prisavka'], rurka(pas, [r * 0.34 for r in rad], 6, konce=False), lambda p, n: mix(C(0x9c4c64), C(0xd89098), sum3(p, 4) + 0.4))
        for j in range(3):
            t = (j + 0.5) / 3
            r = r0 + (r1 - r0) * t
            for s in (-1, 1):
                tt = min(1, t + (0.1 if s > 0 else -0.06))
                n = V((math.sin(s * 0.5), 0, math.cos(s * 0.5)))
                p = V((n.x * r * 1.02, dlzka * tt, zahni(tt) + n.z * r * 1.02))
                pridaj(c, M['prisavka'], torus(p, n, r * 0.25, r * 0.1, 8, 4, jamka=True), farba_prisavky)
        if i < 6:                                                  # hrbole a svetielko na chrbte
            for j in range(3):
                uh = math.pi + (j - 1) * 0.75
                p = V((math.sin(uh) * r0 * 0.88, 0.25 + j * 0.3, math.cos(uh) * r0 * 0.88))
                s = r0 * (0.17 if j != 1 else 0.1)
                pridaj(c, M['biolum' if j == 1 else 'svetla'], elipsoid(p, (s, s * 1.2, s), delenie=1),
                       None if j == 1 else (lambda p, n: mix(C(0x78244c), C(0xc86884), sum3(p, 6) + 0.3)))
    hotovo()
    export('chapadlo')


kraken()
chapadlo()
