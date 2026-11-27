# Prastary krokodil (strazca majaka 3) -> modely/moby/krokodil.glb
# Pivoty (hra ich otaca, src/modely_bossov.js modelKrokodil): trup, hlava > horna + dolna (celuste),
#   chvost_0 > chvost_1 > chvost_2 > chvost_3, noha_PP/LP/PZ/LZ   (P/L = -x/+x, druhe pismeno P/Z = predna/zadna)
# Materialy: telo, brucho (blikaju pri zasahu), tmave, stitok, mach, machsvetly, oko, zrenica, zub, pazur, papula, jazyk, jazva
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mob import *
from boss_pomoc import *

zacni()
telo = material('telo', 0x4f4c2e, 0.85)
tmave = material('tmave', 0x373a22, 0.85)
stit = material('stitok', 0x3b3e24, 0.7)
stit_sv = material('stitoksvetly', 0x6c6a40, 0.75)
brucho = material('brucho', 0x998757, 0.8)
mach = material('mach', 0x47661f, 1.0)
mach_sv = material('machsvetly', 0x86a238, 1.0)
oko = material('oko', 0x221a00, 0.25, ziara=0xd8b818, sila=1.8)
zrenica = material('zrenica', 0x060502, 0.2)
zub = material('zub', 0xd9cca0, 0.4)
pazur = material('pazur', 0x1c180f, 0.45)
papula = material('papula', 0x9c5348, 0.6)
jazyk = material('jazyk', 0x7a3434, 0.55)
jazva = material('jazva', 0x7d6b50, 0.85)
skrupina = material('skrupina', 0xbdb6a0, 0.9)

rnd = random.Random(31)
V = Vector


def koza(faza=0.0):
    """Material koze: svetle brucho, olivove boky s tmavymi priecnymi pasmi."""
    def f(z, a):
        if abs(a) > 2.15:
            return brucho
        pas = math.sin((z + faza) * 13.0 + abs(a) * 1.3)
        return tmave if (pas > 0.55 and 0.75 < abs(a) < 2.0) or (pas > 0.8 and abs(a) <= 0.75) else telo
    return f


def mriezka_stitkov(p, t, od, do, krok, rady, dlzka, sirka, vyska, mat=stit):
    """Pozdlzne rady kylovych stitkov. rady = [(uhol, nasobok_velkosti)]."""
    z = od
    while z <= do:
        for a, k in rady:
            for s in ((1, -1) if a else (1,)):
                j = rnd.uniform(0.85, 1.15)
                stitok(p, mat, t, z + rnd.uniform(-0.012, 0.012), s * a + rnd.uniform(-0.03, 0.03),
                       dlzka * k * j, sirka * k * j, vyska * k * rnd.uniform(0.75, 1.25))
        z += krok


def zrnka(p, t, od, do, pocet, a_od, a_do, velkost):
    """Drobne supiny nahodne po bokoch."""
    for _ in range(pocet):
        s = rnd.choice((-1, 1))
        v = velkost * rnd.uniform(0.6, 1.4)
        stitok(p, rnd.choice((telo, telo, stit, stit_sv, tmave)), t, rnd.uniform(od, do), s * rnd.uniform(a_od, a_do),
               v * 1.3, v, v * 0.38)


def porast(p, t, z, a, rz, ra, seed, travy=6, barnakle=0):
    """Vankus machu: tmavy zaklad, svetlejsie chumace navrchu a stebla travy."""
    flak(p, mach, t, z, a, rz, ra, 0.032, seed, 9)
    for k in range(4):
        flak(p, mach_sv if k % 2 else mach, t, z + rnd.uniform(-0.6, 0.6) * rz,
             a + rnd.uniform(-0.6, 0.6) * ra / 0.35, rz * 0.35, ra * 0.35, 0.045 + 0.008 * k, seed * 11 + k, 6)
    for _ in range(travy):
        zz = z + rnd.uniform(-0.7, 0.7) * rz
        aa = a + rnd.uniform(-0.7, 0.7) * ra / 0.35
        q = t.bod(zz, aa, 0.025)
        roh(p, mach_sv, q, t.normala(zz, aa) + V((rnd.uniform(-0.4, 0.4), 0.3, rnd.uniform(-0.5, 0.2))),
            rnd.uniform(0.06, 0.14), 0.008, (rnd.uniform(-0.5, 0.5), -0.5, -0.6), 3, 3)
    for _ in range(barnakle):
        zz = z + rnd.uniform(-1.3, 1.3) * rz
        aa = a + rnd.uniform(0.7, 1.2) * ra / 0.35 * rnd.choice((-1, 1))
        n = t.normala(zz, aa)
        q = t.bod(zz, aa, -0.006)
        r = rnd.uniform(0.014, 0.028)
        rura(p, skrupina, [q, q + n * r * 1.2], [r, r * 0.45], 7)
        gula(p, tmave, q + n * r * 1.2, (r * 0.3, r * 0.3, r * 0.3), 6)


def liana(p, t, z, a, dlzka, seed):
    """Visiaci chumac rias z boku."""
    r = random.Random(seed)
    q = t.bod(z, a, 0.008)
    n = t.normala(z, a)
    body = [q]
    for i in range(1, 5):
        k = i / 4
        body.append(q + V((n.x * 0.05 * math.sin(k * 2.6) + r.uniform(-0.012, 0.012), -dlzka * k, r.uniform(-0.03, 0.03))))
    rura(p, mach, body, [0.014, 0.012, 0.01, 0.007, 0.0], 4)
    for b in body[1:4]:
        gula(p, mach_sv, b, (0.014, 0.02, 0.014), 4, 0.2, seed, False)


# ================= TRUP: siroky, nizky, pancierovany chrbat =================
trup = pivot('trup', (0, 0.5, 0))
t = Telo([(-1.08, -0.01, 0.25, 0.20, 0.17), (-0.78, -0.01, 0.39, 0.25, 0.24), (-0.42, -0.02, 0.45, 0.28, 0.30),
          (-0.02, -0.03, 0.53, 0.31, 0.33), (0.40, -0.01, 0.50, 0.32, 0.31), (0.72, 0.02, 0.41, 0.28, 0.26),
          (1.06, 0.06, 0.25, 0.19, 0.18)], mocnina=2.7)
t.siet(trup, koza(), kruhov=40, segm=32, sum=0.007, seed=1)

mriezka_stitkov(trup, t, -1.0, 0.96, 0.135, [(0.14, 1.0)], 0.15, 0.095, 0.125)       # dva vysoke stredne rady
mriezka_stitkov(trup, t, -0.93, 0.9, 0.135, [(0.43, 0.82)], 0.15, 0.1, 0.1)
mriezka_stitkov(trup, t, -0.96, 0.9, 0.125, [(0.73, 0.62), (1.02, 0.5)], 0.15, 0.11, 0.085)
mriezka_stitkov(trup, t, -0.9, 0.9, 0.12, [(1.35, 0.42), (1.68, 0.38)], 0.15, 0.12, 0.07, telo)
zrnka(trup, t, -1.0, 1.0, 190, 0.9, 2.05, 0.055)
for i in range(15):                                                                  # brusne dosky
    z = -0.9 + i * 0.13
    for k in range(-3, 4):
        stitok(trup, brucho, t, z + (k % 2) * 0.02, math.pi + k * 0.2, 0.13, 0.095, 0.018, 0.1)
# stare jazvy po bojoch
for z, a, da in [(0.12, 1.22, 0.07), (0.19, 1.2, 0.07), (0.26, 1.2, 0.065), (-0.55, -1.05, -0.09), (-0.49, -1.08, -0.09)]:
    rura(trup, jazva, [t.bod(z + i * 0.035, a + i * da, 0.055 - abs(i - 2.5) * 0.008) for i in range(6)],
         [0.002, 0.008, 0.011, 0.01, 0.007, 0.002], 5)
# mach, riasy a lastury, ktore na nom za stovky rokov narastli
porast(trup, t, -0.30, 0.42, 0.27, 0.19, 3, 12, 9)
porast(trup, t, 0.50, -0.55, 0.22, 0.17, 4, 9, 6)
porast(trup, t, -0.78, -0.30, 0.17, 0.12, 5, 6, 3)
porast(trup, t, 0.20, -1.25, 0.14, 0.11, 6, 3, 4)
porast(trup, t, 0.78, 0.75, 0.13, 0.10, 7, 4, 2)
porast(trup, t, 0.12, 0.05, 0.15, 0.12, 8, 7)
for i, (z, a, d) in enumerate([(-0.45, 1.25, 0.24), (-0.3, 1.38, 0.3), (-0.18, 1.2, 0.18), (0.45, -1.3, 0.27), (0.58, -1.18, 0.2),
                               (-0.75, -1.2, 0.2), (0.2, -1.42, 0.22), (0.75, 1.25, 0.17)]):
    liana(trup, t, z, a, d, 40 + i)

# ================= HLAVA: dlha papula, oci a nozdry na vrchu, zuby trcia von =================
hlava = pivot('hlava', (0, 0.56, 0.92))
koncatina(hlava, telo, [(0, -0.025, -0.2), (0, -0.015, 0.05)], [0.225, 0.2], 16)    # krk
gula(hlava, papula, (0, -0.055, 0.14), (0.16, 0.07, 0.1), 12)                        # hrdlo

horna = pivot('horna', (0, 0, 0), hlava)
h = Telo([(-0.08, 0.055, 0.23, 0.14, 0.095), (0.14, 0.05, 0.275, 0.125, 0.095), (0.30, 0.035, 0.215, 0.105, 0.075),
          (0.46, 0.02, 0.13, 0.075, 0.06), (0.62, 0.012, 0.135, 0.07, 0.055), (0.80, 0.008, 0.10, 0.058, 0.048),
          (0.92, 0.01, 0.115, 0.063, 0.05), (1.03, 0.016, 0.125, 0.075, 0.055), (1.10, 0.012, 0.06, 0.04, 0.03)], mocnina=2.8)
h.siet(horna, lambda z, a: papula if abs(a) > 2.5 and z > 0.1 else (tmave if math.sin(z * 17) > 0.75 and 0.7 < abs(a) < 1.9 else telo),
       kruhov=40, segm=28, sum=0.004, seed=2)
# hrbolce a vrasky na papuli
for _ in range(190):
    z, s = rnd.uniform(0.06, 1.04), rnd.choice((-1, 1))
    v = rnd.uniform(0.022, 0.048)
    stitok(horna, rnd.choice((telo, telo, stit, tmave, stit_sv)), h, z, s * rnd.uniform(0.05, 1.8), v * 1.4, v, v * 0.45)
for s in (-1, 1):                                                                     # kostene hrany pozdlz nosa
    rura(horna, stit, [(s * 0.1, 0.165, 0.24), (s * 0.058, 0.115, 0.42), (s * 0.048, 0.09, 0.6), (s * 0.034, 0.072, 0.8),
                       (s * 0.045, 0.08, 0.94)], [0.025, 0.027, 0.017, 0.014, 0.006], 6)
    # vyvysene oko s tazkym vieckom a zvislou zrenickou
    gula(horna, telo, (s * 0.145, 0.15, 0.14), (0.092, 0.085, 0.12), 12, 0.04, 3)
    gula(horna, oko, (s * 0.19, 0.185, 0.175), (0.052, 0.048, 0.058), 12)
    gula(horna, zrenica, (s * 0.231, 0.188, 0.19), (0.015, 0.042, 0.015), 8)
    rura(horna, stit, [(s * 0.13, 0.19, 0.28), (s * 0.215, 0.235, 0.20), (s * 0.23, 0.24, 0.10), (s * 0.19, 0.23, 0.0),
                       (s * 0.14, 0.2, -0.07)], [0.012, 0.034, 0.04, 0.03, 0.01], 7)
    for z, y, d in [(0.17, 0.26, 0.07), (0.08, 0.265, 0.11), (-0.01, 0.245, 0.08)]:    # rohate vyrastky nad okom
        roh(horna, stit, (s * 0.215, y, z), (s * 0.35, 1, -0.5), d, 0.03, (0, -0.2, -0.7), 4, 5)
    for z, a, d in [(-0.03, 1.25, 0.13), (0.03, 1.55, 0.1), (-0.05, 0.75, 0.09)]:      # ostne na licach
        roh(horna, stit, h.bod(z, s * a, -0.012), (s, 0.15, -0.6), d, 0.032, (0, 0.1, -0.5), 4, 5)
    # nozdry na vyvysenine na konci cumaka
    gula(horna, telo, (s * 0.043, 0.085, 1.015), (0.047, 0.037, 0.058), 10)
    gula(horna, zrenica, (s * 0.05, 0.118, 1.03), (0.017, 0.011, 0.024), 8)
    # zuby: nepravidelne, najvacsie v "bruskach" papule, previsaju cez spodnu celust
    for z, d in [(1.06, 0.12), (0.99, 0.15), (0.91, 0.065), (0.83, 0.055), (0.74, 0.085), (0.66, 0.175), (0.58, 0.13),
                 (0.50, 0.065), (0.42, 0.06), (0.35, 0.095), (0.27, 0.12), (0.19, 0.065)]:
        cy, w, hu, hd = h.prierez(z)
        roh(horna, zub, (s * w * 0.86, cy - hd * 0.62, z + rnd.uniform(-0.008, 0.008)),
            (s * rnd.uniform(0.22, 0.4), -1, rnd.uniform(-0.1, 0.15)), d * rnd.uniform(0.9, 1.1), 0.014 + d * 0.11, (0, 0, -0.3), 4, 6)
    for k in range(5):                                                                 # hrbolce pozdlz dasna
        z = 0.24 + k * 0.17
        cy, w, hu, hd = h.prierez(z)
        gula(horna, stit_sv, (s * w * 0.95, cy - hd * 0.3, z), (0.016, 0.022, 0.04), 7)
porast(horna, h, -0.01, 0.18, 0.07, 0.08, 21, 4)
porast(horna, h, 0.52, -0.5, 0.075, 0.05, 22, 2, 3)
rura(horna, jazva, [h.bod(0.33 + i * 0.045, -1.25 + i * 0.24, 0.03) for i in range(6)], [0.002, 0.008, 0.011, 0.01, 0.007, 0.002], 5)

dolna = pivot('dolna', (0, -0.06, 0.02), hlava)
d_ = Telo([(-0.08, -0.04, 0.225, 0.045, 0.11), (0.16, -0.045, 0.245, 0.042, 0.115), (0.34, -0.035, 0.17, 0.034, 0.085),
           (0.52, -0.03, 0.115, 0.03, 0.068), (0.70, -0.028, 0.11, 0.029, 0.062), (0.88, -0.022, 0.092, 0.028, 0.056),
           (1.00, -0.018, 0.108, 0.028, 0.055), (1.06, -0.015, 0.05, 0.02, 0.03)], mocnina=2.8)
d_.siet(dolna, lambda z, a: papula if abs(a) < 1.0 else (brucho if abs(a) > 1.7 else telo), kruhov=30, segm=24, sum=0.003, seed=3)
rura(dolna, jazyk, [(0, -0.008, 0.03), (0, 0.0, 0.2), (0, -0.002, 0.4), (0, -0.006, 0.58), (0, -0.01, 0.72)],
     [0.07, 0.075, 0.05, 0.035, 0.0], 8, True)
for s in (-1, 1):
    for z, d in [(1.00, 0.15), (0.93, 0.07), (0.78, 0.06), (0.70, 0.065), (0.55, 0.1), (0.46, 0.14), (0.38, 0.075),
                 (0.30, 0.055), (0.22, 0.07), (0.13, 0.05)]:
        cy, w, hu, hd = d_.prierez(z)
        roh(dolna, zub, (s * w * 0.88, cy + hu * 0.3, z + 0.015), (s * rnd.uniform(0.2, 0.38), 1, rnd.uniform(-0.1, 0.1)),
            d * rnd.uniform(0.9, 1.1), 0.013 + d * 0.11, (0, 0, -0.3), 4, 6)
    for _ in range(26):
        z = rnd.uniform(0.0, 0.95)
        v = rnd.uniform(0.022, 0.042)
        stitok(dolna, rnd.choice((telo, stit, brucho)), d_, z, s * rnd.uniform(1.25, 2.2), v * 1.4, v, v * 0.35)
    liana(dolna, d_, 0.62, s * 1.7, 0.13, 70 + s)
    liana(dolna, d_, 0.2, s * 1.8, 0.1, 73 + s)

# ================= CHVOST: 4 clanky, dvojity hreben sa na konci spoji do jedneho =================
CHV = [[(-0.66, -0.015, 0.215, 0.17, 0.14), (-0.40, -0.005, 0.255, 0.195, 0.17), (-0.15, 0, 0.29, 0.21, 0.19), (0.17, 0, 0.275, 0.20, 0.18)],
       [(-0.66, -0.03, 0.135, 0.13, 0.105), (-0.40, -0.015, 0.175, 0.15, 0.125), (-0.15, -0.01, 0.21, 0.168, 0.14), (0.10, -0.012, 0.205, 0.165, 0.135)],
       [(-0.66, -0.045, 0.072, 0.095, 0.07), (-0.40, -0.03, 0.098, 0.112, 0.085), (-0.15, -0.025, 0.128, 0.125, 0.10), (0.10, -0.028, 0.128, 0.122, 0.10)],
       [(-0.72, -0.06, 0.008, 0.025, 0.018), (-0.50, -0.052, 0.03, 0.062, 0.042), (-0.20, -0.045, 0.054, 0.085, 0.062), (0.09, -0.042, 0.068, 0.09, 0.068)]]
rodic = None
for i, rezy in enumerate(CHV):
    s_ = 1 - i * 0.18
    cl = pivot('chvost_%d' % i, (0, 0, -0.55) if i else (0, 0.5, -0.92), rodic)
    rodic = cl
    ct = Telo(rezy, mocnina=2.5)
    ct.siet(cl, koza(0.4 + i * 0.55), kruhov=18, segm=22, sum=0.004, seed=10 + i)
    z = -0.52
    while z < 0.01:                                                                    # hreben
        if i < 2:
            for s in (-1, 1):
                stitok(cl, stit, ct, z, s * (0.5 - i * 0.12), 0.15 * s_, 0.075 * s_, 0.19 * s_, 0.45)
        else:
            stitok(cl, stit, ct, z, 0.0, 0.16 * s_, 0.06 * s_, 0.27 * s_ if i == 2 else 0.2, 0.5)
        z += 0.11
    mriezka_stitkov(cl, ct, -0.52, 0.0, 0.11, [(0.9, 0.62 * s_), (1.35, 0.45 * s_)], 0.15, 0.11, 0.09)
    if i < 2:
        mriezka_stitkov(cl, ct, -0.52, 0.0, 0.11, [(0.14, 0.6 * s_)], 0.14, 0.09, 0.08)
    zrnka(cl, ct, -0.56, 0.05, int(36 * s_), 1.0, 2.1, 0.048 * s_)
    if i == 3:
        for s in (-1, 1):
            roh(cl, stit, (0, -0.045, -0.62), (0, s * 0.45, -1), 0.24, 0.02, (0, 0, 0), 3, 4)
    if i == 0:
        porast(cl, ct, -0.25, -0.7, 0.17, 0.11, 31, 6, 5)
        liana(cl, ct, -0.3, -1.4, 0.22, 90)
        liana(cl, ct, -0.18, -1.3, 0.16, 91)
    if i == 1:
        porast(cl, ct, -0.38, 0.95, 0.13, 0.08, 32, 4, 3)
        liana(cl, ct, -0.4, 1.4, 0.17, 92)

# ================= NOHY: roztiahnute, silne, s plavacimi blanami a pazurmi (zem je 0.5 pod pivotom) =================
for meno, x, z in (('noha_PP', -1, 1), ('noha_LP', 1, 1), ('noha_PZ', -1, -1), ('noha_LZ', 1, -1)):
    n = pivot(meno, (x * 0.42, 0.5, z * 0.55))
    predna = z > 0
    k_ = 1.0 if predna else 1.12
    bedro = V((-x * 0.1, -0.02, 0))
    koleno = V((x * 0.33, -0.15, -0.12 if predna else 0.15))
    clenok = V((x * 0.37, -0.40, 0.03 if predna else -0.02))
    koncatina(n, telo, [bedro, koleno, clenok], [0.165 * k_, 0.105 * k_, 0.072], 14)
    labka = V((x * 0.38, -0.44, 0.07))
    gula(n, telo, labka, (0.12, 0.058, 0.13), 12)
    prsty = [(-0.17, 0.12), (-0.075, 0.2), (0.04, 0.21), (0.15, 0.13)]
    konce = []
    for dx, dl in prsty:
        koren = labka + V((dx * 0.35, -0.005, 0.04))
        stred = labka + V((x * 0.02 + dx * 0.85, -0.005, 0.06 + dl * 0.6))
        spicka = labka + V((x * 0.03 + dx * 1.15, -0.032, 0.08 + dl))
        koncatina(n, telo, [koren, stred, spicka], [0.045, 0.033, 0.023], 8)
        roh(n, pazur, spicka, (dx * 0.8, 0.12, 1), 0.11, 0.024, (0, -1.2, 0), 4, 6)
        konce.append(spicka)
    for A, B in zip(konce, konce[1:]):                                                # blany medzi prstami
        pridaj(n, tmave, [labka + V((0, -0.025, 0.05)), A.lerp(labka, 0.2) + V((0, -0.012, 0)), B.lerp(labka, 0.2) + V((0, -0.012, 0))], [[0, 1, 2]])
    # stitky na stehne a predkoleni (kde sa koza leskne nahor/von)
    for (A, B, rA, rB, pocet) in [(bedro, koleno, 0.165 * k_, 0.105 * k_, 12), (koleno, clenok, 0.105 * k_, 0.072, 9)]:
        for _ in range(pocet):
            u = rnd.uniform(0.15, 1.0)
            os_ = (B - A).normalized()
            smer = V((x * rnd.uniform(0.2, 1), rnd.uniform(0.0, 1), rnd.uniform(-0.8, 0.8)))
            smer = (smer - os_ * smer.dot(os_)).normalized()
            p = A.lerp(B, u) + smer * (rA + (rB - rA) * u)
            v = rnd.uniform(0.032, 0.058)
            gula(n, rnd.choice((stit, stit, tmave, stit_sv)), p, (v * 0.75, v * 0.5, v), 6, 0.2, rnd.randrange(999), False)
    for k in range(3):                                                                 # hreben na lakti
        p = koleno.lerp(clenok, k * 0.25) + V((x * 0.075, 0.03, -0.03))
        roh(n, stit, p, (x * 0.6, 0.35, -0.8), 0.12 - k * 0.025, 0.035, (0, 0, -0.4), 3, 4)

hotovo()
export('krokodil')
