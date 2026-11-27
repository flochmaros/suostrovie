# Boss KAMENNY GOLEM -> modely/moby/golem.glb
# Pivoty (hra ich otaca, src/modely_bossov.js modelGolem): trup > hlava, ruka_P (x = -1), ruka_L (x = +1);  noha_P, noha_L
# Materialy: kam, kam2 (kamen, blikaju pri zasahu), mach, runa (ziara: oci, jadro, runy, krystaly - JS meni intenzitu), tma
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True
from mob import *
from siet import *
from mathutils.bvhtree import BVHTree

C = srgb
zacni()
kam = farebny('kam', 0.92)          # svetlejsi kamen
kam2 = farebny('kam2', 0.95)        # tmavsi kamen (klby, spodok)
mach = farebny('mach', 1.0)
tma = material('tma', 0x12100e, 1.0)
runa = material('runa', 0x062028, 0.25, ziara=0x10c0ff, sila=1.8)

SVETLY, TMAVY, TEPLY, SPINA = C(0x69665c), C(0x36342f), C(0x574a3a), C(0x1c1a16)
rnd = random.Random(5)
povrchy = {}                         # pivot -> [(verts, faces)] pre kreslenie run po povrchu


def farba_kamena(zaklad, seed):
    def f(p, n):
        c = mix(zaklad, TEPLY, sum3(p, 2.3, seed) * 1.1)
        c = mix(c, SPINA, -n.y * 0.65 + max(0, sum3(p, 4.5, seed + 5) - 0.15) * 1.6)
        lisajnik = sum3(p, 6.5, 31.0)
        if lisajnik > 0.38 and n.y > -0.1:
            c = mix(c, C(0x848456), (lisajnik - 0.38) * 3)
        return jas(c, 1 + sum3(p, 13, seed) * 0.28 + n.y * 0.1)
    return f


def farba_machu(p, n):
    c = mix(C(0x1c2c10), C(0x3c561a), sum3(p, 5, 2.0) + 0.5)
    c = mix(c, C(0x6e7428), max(0, sum3(p, 9, 8.0) - 0.2) * 2)
    return jas(c, 1 + sum3(p, 22) * 0.3)


def balvan(piv, stred, rozmer, rot=(0, 0, 0), mat=None, zarast=0.0, delenie=3, rezy=11):
    """Balvan: zvrasnena gula orezana nahodnymi rovinami (plochy ako lomeny kamen). zarast 0..1 = mach navrchu."""
    seed = rnd.uniform(0, 100)
    roviny = []
    for _ in range(rezy):
        n = V((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1))).normalized()
        roviny.append((n, rnd.uniform(0.66, 0.86)))
    verts, faces = guľa_body(delenie)
    out = []
    for d in verts:
        p = d * (1 + sum3(d, 1.5, seed) * 0.2)
        for n, h in roviny:
            o = p.dot(n) - h
            if o > 0:
                p = p - n * o * 0.94
        p *= 1.17 + sum3(d, 4.5, seed + 9) * 0.07
        p = V((p.x * rozmer[0] / 2, p.y * rozmer[1] / 2, p.z * rozmer[2] / 2))
        out.append(otoc(p, rot) + V(stred))
    mat = mat or kam
    tvar = pridaj(piv, mat, (out, faces), farba_kamena(SVETLY if mat == kam else TMAVY, seed), hladke=False)
    povrchy.setdefault(piv, []).append(tvar)
    if zarast:
        porast(piv, out, faces, V(stred), zarast, seed)


def porast(piv, verts, faces, stred, zarast, seed):
    """Mach kopiruje horne plosky balvana (okraj nepravidelny podla sumu)."""
    nove, idx, plochy = [], {}, []
    for f in faces:
        a, b, c = (verts[i] for i in f)
        n = (b - a).cross(c - a).normalized()
        m = (a + b + c) / 3
        if n.dot(m - stred) < 0:
            n = -n
        if n.y + sum3(m, 6, seed) * 0.6 < 0.98 - zarast * 0.8:
            continue
        tri = []
        for i in f:
            if i not in idx:
                p = verts[i]
                idx[i] = len(nove)
                nove.append(p + (p - stred).normalized() * (0.012 + max(0, sum3(p, 11, seed)) * 0.035) + V((0, 0.006, 0)))
            tri.append(idx[i])
        plochy.append(tri)
    pridaj(piv, mach, (nove, plochy), farba_machu, hladke=False)


def vis(piv, bod, dlzka):
    """Visiaci pramen machu / korienok."""
    p = V(bod)
    body = [p]
    for i in range(1, 4):
        body.append(p + V((rnd.uniform(-0.03, 0.03), -dlzka * i / 3, rnd.uniform(-0.03, 0.03))))
    pridaj(piv, mach, rurka(body, [0.028, 0.022, 0.015, 0.003], 5), farba_machu, hladke=False)


def kresli_runu(piv, ciary, zo, sirka=0.028):
    """Ziariace ciary premietnute na povrch balvanov pivotu.
    ciary = zoznam lomenych ciar v rovine (u, v); zo = (stred, smer von, os u, os v)."""
    stred, von, ou, ov = (V(x) for x in zo)
    stromy = [BVHTree.FromPolygons([tuple(v) for v in vs], fs) for vs, fs in povrchy[piv]]
    for ciara in ciary:
        body = []
        for (u0, v0), (u1, v1) in zip(ciara, ciara[1:]):
            n = max(2, int(math.hypot(u1 - u0, v1 - v0) / 0.025))
            for i in range(n + (1 if (u1, v1) == ciara[-1] else 0)):
                t = i / n
                zac = stred + ou * (u0 + (u1 - u0) * t) + ov * (v0 + (v1 - v0) * t) + von * 1.5
                naj = None
                for s in stromy:
                    hit, nrm, _, d = s.ray_cast(zac, -von, 1.75)
                    if hit is not None and (naj is None or d < naj[2]):
                        naj = (hit, nrm, d)
                if naj:
                    body.append(naj[0] + von * 0.014)
        if len(body) < 2:
            continue
        verts, faces = [], []
        for i, p in enumerate(body):
            t = (body[min(i + 1, len(body) - 1)] - body[max(0, i - 1)]).normalized()
            bok = von.cross(t).normalized() * sirka / 2
            verts += [p - bok, p + bok, p + von * 0.012]
        for i in range(len(body) - 1):
            a, b = i * 3, i * 3 + 3
            faces += [[a, a + 2, b + 2, b], [a + 2, a + 1, b + 1, b + 2]]
        pridaj(piv, runa, (verts, faces), hladke=False)


def krystal(piv, zaklad, smer, dlzka, r):
    z, s = V(zaklad), V(smer).normalized()
    pridaj(piv, runa, rurka([z, z + s * dlzka * 0.72, z + s * dlzka], [r, r * 0.85, 0.004], 6), hladke=False)
    for i in range(3):                                                  # kamenny golier okolo krystalu
        bok = s.orthogonal().normalized()
        bok.rotate(__import__('mathutils').Quaternion(s, i * 2.1 + dlzka * 7))
        balvan(piv, z + bok * r * 1.1 + s * 0.03, (r * 1.7, r * 1.7, r * 1.7), (i, i * 2, 0), kam2, delenie=2, rezy=7)


# ================= TRUP =================
trup = pivot('trup', (0, 1.15, 0))
# jadro tela (tmave, vidno ho v skarach) a zeravy stred v hrudi
pridaj(trup, tma, elipsoid((0, 0.2, -0.04), (0.45, 0.55, 0.32), delenie=2), hladke=False)
for s in (-1, 1):
    balvan(trup, (s * 0.33, 0.52, 0.12), (0.64, 0.46, 0.64), (0.15, s * 0.25, -s * 0.2), zarast=0.42)       # prsne dosky
    balvan(trup, (s * 0.38, 0.16, 0.08), (0.44, 0.46, 0.56), (0, s * 0.3, s * 0.25), kam2)                 # rebra
    balvan(trup, (s * 0.2, -0.1, 0.12), (0.4, 0.3, 0.46), (0.1, 0, s * 0.3))                               # brucho
    balvan(trup, (s * 0.3, 0.55, -0.3), (0.64, 0.62, 0.56), (-0.3, s * 0.5, s * 0.2), kam2, zarast=0.6)    # lopatky
balvan(trup, (0, 0.04, 0.2), (0.34, 0.25, 0.42), (0.2, 0, 0.1), kam2)
balvan(trup, (0, 0.46, -0.42), (0.72, 0.8, 0.5), (-0.35, 0.2, 0), zarast=0.75)                             # hrb
balvan(trup, (0, 0.05, -0.28), (0.62, 0.52, 0.44), (0.2, 0, 0.3), kam2)
balvan(trup, (0, 0.72, -0.12), (0.62, 0.34, 0.54), (-0.2, 0.7, 0.1), zarast=0.55)
balvan(trup, (0, -0.25, -0.02), (0.66, 0.34, 0.5), (0, 0.4, 0), kam2)                                       # panva
balvan(trup, (0, -0.38, 0.14), (0.3, 0.3, 0.28), (0.3, 0, 0.7))
for i in range(14):                                                           # visiaci mach pod prsnymi doskami
    x = rnd.uniform(0.24, 0.58) * (1 if i % 2 else -1)
    vis(trup, (x, 0.37 + rnd.uniform(-0.04, 0.03), 0.39 - abs(x) * 0.12), rnd.uniform(0.07, 0.22))
# jadro: gula v jamke, okolo veniec kamenov
pridaj(trup, tma, elipsoid((0, 0.29, 0.28), (0.24, 0.24, 0.12), delenie=3), hladke=False)
pridaj(trup, runa, elipsoid((0, 0.29, 0.36), (0.14, 0.15, 0.1), delenie=2), hladke=False)
for i in range(8):
    a = i / 8 * math.tau + 0.35
    balvan(trup, (math.sin(a) * 0.215, 0.29 + math.cos(a) * 0.215, 0.4), (0.14, 0.17, 0.14),
           (0, 0, -a), kam2 if i % 2 else kam, delenie=2, rezy=7)
# krcny golier
for s in (-1, 1):
    balvan(trup, (s * 0.26, 0.83, 0.02), (0.3, 0.3, 0.38), (0, 0, s * 0.5), kam2, zarast=0.5, delenie=2)
# ramena: velke balvany so zlomkami
for s in (-1, 1):
    balvan(trup, (s * 0.72, 0.66, -0.02), (0.66, 0.54, 0.66), (0.1, s * 0.4, -s * 0.28), zarast=0.5)
    balvan(trup, (s * 0.92, 0.82, -0.08), (0.34, 0.34, 0.38), (0.4, s, -s * 0.6), kam2, zarast=0.4, delenie=2)
    balvan(trup, (s * 0.62, 0.9, -0.14), (0.3, 0.28, 0.32), (0.2, s * 2, 0.4), zarast=0.5, delenie=2)
    for i in range(7):
        a = rnd.uniform(-1.2, 1.2)
        vis(trup, (s * (0.72 + rnd.uniform(-0.2, 0.28)), 0.52 + rnd.uniform(-0.05, 0.1), 0.27 * math.cos(a) * (1 if i % 3 else -1.1)), rnd.uniform(0.12, 0.32))
# krystaly golema na chrbte
for zaklad, smer, d, r in (((-0.22, 0.8, -0.5), (-0.35, 0.8, -0.65), 0.62, 0.11), ((0.12, 0.7, -0.62), (0.15, 0.55, -0.9), 0.52, 0.095),
                           ((0.35, 0.82, -0.4), (0.55, 0.9, -0.35), 0.46, 0.08), ((-0.45, 0.62, -0.52), (-0.7, 0.35, -0.65), 0.34, 0.065),
                           ((0.0, 0.92, -0.34), (-0.05, 1, -0.35), 0.36, 0.07), ((0.78, 0.9, -0.2), (0.6, 1, -0.3), 0.3, 0.055)):
    krystal(trup, zaklad, smer, d, r)
# runy na hrudi: paprsky od jadra
PRED = ((0, 0.29, 0), (0, 0, 1), (1, 0, 0), (0, 1, 0))
for s in (-1, 1):
    kresli_runu(trup, [[(s * 0.28, 0.1), (s * 0.4, 0.22), (s * 0.38, 0.34)], [(s * 0.4, 0.22), (s * 0.55, 0.24)],
                       [(s * 0.29, -0.06), (s * 0.45, -0.12), (s * 0.43, -0.24)], [(s * 0.12, -0.28), (s * 0.18, -0.4)]], PRED, 0.03)
kresli_runu(trup, [[(0, -0.28), (0, -0.46)], [(-0.08, -0.36), (0, -0.46), (0.08, -0.36)]], PRED)
ZADOK = ((0, 0.4, 0), (0, 0, -1), (-1, 0, 0), (0, 1, 0))
kresli_runu(trup, [[(0, 0.2), (-0.14, 0.02), (0, -0.16), (0.14, 0.02), (0, 0.2)], [(0, -0.16), (0, -0.4)], [(-0.14, 0.02), (-0.34, 0.08)], [(0.14, 0.02), (0.34, 0.08)]], ZADOK, 0.035)

# ================= HLAVA =================
hlava = pivot('hlava', (0, 0.78, 0.08), trup)
balvan(hlava, (0, 0.17, -0.02), (0.46, 0.38, 0.44), (0, 0.5, 0), zarast=0.6)
balvan(hlava, (0, 0.24, 0.2), (0.48, 0.14, 0.2), (0.28, 0, 0), kam2, rezy=9)                  # nadocnicovy previs
pridaj(hlava, tma, elipsoid((0, 0.135, 0.185), (0.19, 0.075, 0.07), delenie=2), hladke=False)   # tmava skara s ocami
for s in (-1, 1):
    pridaj(hlava, runa, elipsoid((s * 0.1, 0.142, 0.262), (0.078, 0.034, 0.024), (0, s * 0.25, s * 0.28), 2), hladke=False)
    balvan(hlava, (s * 0.19, 0.07, 0.17), (0.17, 0.17, 0.2), (0, s * 0.5, s * 0.4), delenie=2)   # licne kosti
    balvan(hlava, (s * 0.2, 0.34, -0.04), (0.17, 0.22, 0.2), (0, s, -s * 0.5), kam2, zarast=0.5, delenie=2)
balvan(hlava, (0, 0.085, 0.25), (0.1, 0.13, 0.13), (0.2, 0.8, 0), delenie=2)                  # nos
balvan(hlava, (0, -0.045, 0.17), (0.38, 0.17, 0.27), (-0.15, 0, 0), kam2)                     # celust
for i in range(5):                                                                            # kamenne zuby
    balvan(hlava, (-0.12 + i * 0.06, 0.012, 0.285 - abs(i - 2) * 0.012), (0.05, 0.065, 0.045), (i, 0, i * 2), delenie=2, rezy=6)
for i in range(6):                                                                            # brada z machu
    vis(hlava, (-0.15 + i * 0.06, -0.09, 0.26 - abs(i - 2.5) * 0.02), rnd.uniform(0.1, 0.24))
krystal(hlava, (0.08, 0.34, -0.08), (0.25, 1, -0.35), 0.24, 0.045)
kresli_runu(hlava, [[(0, 0.0), (0, 0.09)], [(-0.07, 0.07), (0, 0.025), (0.07, 0.07)]], ((0, 0.2, 0), (0, 0, 1), (1, 0, 0), (0, 1, 0)), 0.022)

# ================= RUKY =================
for meno, s in (('ruka_P', -1), ('ruka_L', 1)):
    r = pivot(meno, (s * 0.72, 0.5, 0), trup)
    pridaj(r, runa, elipsoid((s * 0.03, -0.07, 0), (0.1, 0.1, 0.1), delenie=2), hladke=False)       # ziara v klbe
    balvan(r, (s * 0.07, -0.28, 0), (0.36, 0.5, 0.38), (0, s * 0.3, s * 0.18))                       # nadlaktie
    balvan(r, (s * 0.2, -0.2, -0.03), (0.2, 0.3, 0.26), (0.3, 0, s * 0.4), kam2, delenie=2)
    pridaj(r, runa, elipsoid((s * 0.09, -0.54, 0), (0.09, 0.08, 0.09), delenie=2), hladke=False)    # laket
    balvan(r, (s * 0.1, -0.54, -0.1), (0.24, 0.22, 0.24), (0.5, 0, 0), kam2, delenie=2)
    balvan(r, (s * 0.12, -0.81, 0.03), (0.46, 0.52, 0.48), (0.05, s * 0.6, s * 0.05), zarast=0.45)    # mohutne predlaktie
    balvan(r, (s * 0.29, -0.74, -0.02), (0.22, 0.38, 0.3), (0, s, -s * 0.2), kam2, zarast=0.4, delenie=2)
    balvan(r, (s * 0.04, -0.7, -0.16), (0.26, 0.3, 0.22), (0.3, 0, 0), kam2, delenie=2)
    balvan(r, (s * 0.12, -1.16, 0.04), (0.5, 0.36, 0.46), (0, s * 0.2, 0))                            # past
    for i in range(4):                                                                                # prsty
        x = s * 0.12 + (i - 1.5) * 0.115
        balvan(r, (x, -1.21, 0.25), (0.12, 0.2, 0.15), (-0.3, 0, (i - 1.5) * 0.08), kam2, delenie=2, rezy=8)
        balvan(r, (x, -1.33, 0.18), (0.11, 0.13, 0.14), (-0.9, 0, 0), delenie=2, rezy=7)
    balvan(r, (-s * 0.14, -1.17, 0.17), (0.14, 0.2, 0.18), (-0.2, 0, -s * 0.5), kam2, delenie=2)     # palec
    for i in range(3):
        vis(r, (s * (0.25 + i * 0.05), -0.66 - i * 0.04, -0.1 + i * 0.08), rnd.uniform(0.1, 0.2))
    PREDL = ((s * 0.12, -0.8, 0.03), (0, 0, 1), (1, 0, 0), (0, 1, 0))
    kresli_runu(r, [[(0, 0.17), (0, -0.17)], [(-0.09, 0.09), (0, 0.0), (0.09, 0.09)], [(-0.07, -0.13), (0.07, -0.07)]], PREDL, 0.032)
    BOKOM = ((s * 0.12, -0.8, 0.03), (s, 0, 0), (0, 0, -s), (0, 1, 0))
    kresli_runu(r, [[(-0.1, 0.12), (0.06, 0.02), (-0.06, -0.08), (0.08, -0.17)]], BOKOM, 0.032)

# ================= NOHY =================
for meno, s in (('noha_P', -1), ('noha_L', 1)):
    n = pivot(meno, (s * 0.3, 0.85, 0))
    pridaj(n, tma, rurka([(0, 0.02, 0), (s * 0.04, -0.4, 0.02), (s * 0.05, -0.68, 0.04)], [0.13, 0.11, 0.1], 7), hladke=False)
    balvan(n, (s * 0.03, -0.2, 0), (0.42, 0.46, 0.44), (0, s * 0.4, s * 0.12), kam2)                 # stehno
    balvan(n, (s * 0.06, -0.43, 0.17), (0.24, 0.22, 0.22), (0.3, 0.5, 0), zarast=0.35, delenie=2)    # koleno
    balvan(n, (s * 0.06, -0.57, 0.01), (0.46, 0.46, 0.46), (0, -s * 0.3, -s * 0.06))                 # holen
    balvan(n, (s * 0.2, -0.54, -0.07), (0.24, 0.32, 0.28), (0, s, 0), kam2, delenie=2)
    balvan(n, (s * 0.07, -0.76, 0.1), (0.52, 0.24, 0.6), (0, s * 0.12, 0), kam2, zarast=0.15)        # chodidlo
    for i in range(3):
        balvan(n, (s * 0.07 + (i - 1) * 0.16, -0.79, 0.4 - abs(i - 1) * 0.04), (0.17, 0.15, 0.21), (0.1, (i - 1) * 0.25, 0), delenie=2, rezy=8)
    vis(n, (s * 0.27, -0.42, 0.08), 0.16)
    kresli_runu(n, [[(-0.06, 0.12), (0.05, 0.04), (-0.05, -0.04), (0.06, -0.12)]], ((s * 0.06, -0.58, 0), (0, 0, 1), (1, 0, 0), (0, 1, 0)))

hotovo()
export('golem')
