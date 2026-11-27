# Pradavny lavovy jaster (strazca majaka 2) -> modely/moby/lavovy_obr.glb
# Pivoty (hra ich otaca, src/modely_bossov.js modelLavovyObr): trup, hlava > celust,
#   chvost_0 > chvost_1 > chvost_2, noha_PP/LP/PZ/LZ   (P/L = -x/+x, druhe pismeno P/Z = predna/zadna)
# Materialy: telo, brucho (blikaju pri zasahu), pancier, lava (JS meni intenzitu), oko, roh, zub, papula
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mob import *
from boss_pomoc import *

zacni()
telo = material('telo', 0x2a1713, 0.75)
brucho = material('brucho', 0x55291d, 0.8)
pancier = material('pancier', 0x211a19, 0.5, kov=0.2)
roh_m = material('roh', 0x100c0c, 0.35, kov=0.25)
roh_sv = material('rohsvetly', 0x2e221c, 0.5, kov=0.15)
lava = material('lava', 0x301008, 0.4, ziara=0xff5410)
oko = material('oko', 0x221000, 0.3, ziara=0xffd040, sila=3.0)
zub = material('zub', 0xbfa578, 0.4)
papula = material('papula', 0x3a0c06, 0.6, ziara=0x9a1c04, sila=0.7)

rnd = random.Random(7)
V = Vector


def kozene(z, a):
    return brucho if abs(a) > 2.2 else telo


def pancierovanie(p, t, od, do, krok, uhly, rz, ra, vyska, seed):
    """Mriezka skalnych platni cez chrbat, riadky su posunute (ako tehly)."""
    z, riadok = od, 0
    while z <= do:
        for n, a in enumerate(uhly):
            pos = (riadok % 2) * 0.5
            aa = a + math.copysign(pos * 0.16, a) if a else 0
            m = max(0.6, 1 - abs(a) * 0.16)
            platna(p, pancier, t, z + rnd.uniform(-0.02, 0.02), aa + rnd.uniform(-0.05, 0.05),
                   rz * m, ra * m, vyska * m, seed + riadok * 31 + n)
        z += krok
        riadok += 1


def tron(p, t, z, a, dlzka, r, naklon=0.8):
    """Osten vyrastajuci z povrchu, zahnuty dozadu, so zeravym golierom."""
    n = t.normala(z, a)
    zaklad = t.bod(z, a, -0.01)
    roh(p, roh_m, zaklad, n + V((0, 0, -0.35)), dlzka, r, (0, -0.1, -naklon), 6, 6)
    kruh = []
    bok = n.orthogonal().normalized()
    for i in range(9):
        u = i / 8 * 2 * math.pi
        kruh.append(zaklad + n * 0.035 + (bok * math.cos(u) + n.cross(bok) * math.sin(u)) * r * 1.02)
    rura(p, lava, kruh, [0.009] * 9, 4)


# ================= TRUP: mohutne plecia, skalny pancier, zeravy sev po chrbtici =================
trup = pivot('trup', (0, 0.62, 0))
t = Telo([(-1.10, -0.02, 0.20, 0.17, 0.18), (-0.82, -0.01, 0.34, 0.26, 0.26), (-0.40, -0.02, 0.37, 0.27, 0.31),
          (0.05, -0.01, 0.42, 0.31, 0.33), (0.45, 0.03, 0.50, 0.41, 0.31), (0.76, 0.06, 0.40, 0.33, 0.28),
          (1.08, 0.12, 0.20, 0.20, 0.18)], mocnina=2.5)
t.siet(trup, kozene, kruhov=40, segm=32, sum=0.006, seed=1)

pancierovanie(trup, t, -0.95, 0.9, 0.17, (-1.5, -1.05, -0.62, -0.23, 0.23, 0.62, 1.05, 1.5), 0.095, 0.082, 0.04, 100)

# chrbtica: zeravy sev a rada velkych ostnov (najvyssie nad plecami)
rura(trup, lava, [t.bod(-1.05 + i * 0.1, math.sin(i * 2.3) * 0.07, 0.035) for i in range(21)], [0.016] * 21, 4)
for i, (z, d) in enumerate([(-0.86, 0.22), (-0.62, 0.30), (-0.37, 0.37), (-0.12, 0.42), (0.14, 0.50),
                            (0.40, 0.62), (0.66, 0.50), (0.88, 0.32)]):
    tron(trup, t, z, 0.0, d, 0.052 + d * 0.07)
for s in (-1, 1):
    for z, d in [(-0.7, 0.15), (-0.42, 0.18), (-0.14, 0.20), (0.16, 0.24), (0.43, 0.34), (0.68, 0.25)]:
        tron(trup, t, z + 0.09, s * 0.64, d, 0.032 + d * 0.07)
    for z, d in [(0.3, 0.26), (0.5, 0.30), (0.7, 0.20)]:                          # ramenne ostne
        tron(trup, t, z, s * 1.28, d, 0.045, 0.55)
    # lavove trhliny po bokoch
    for k, z in enumerate([-0.75, -0.38, 0.02, 0.4, 0.74]):
        trhlina(trup, lava, t, z - 0.05, s * 0.82, 0.015, s * 0.19, 7, 0.019, seed=200 + k * 5 + (s > 0), vetvy=2, von=0.012)
    trhlina(trup, lava, t, -0.9, s * 1.78, 0.18, s * 0.01, 10, 0.016, seed=300 + (s > 0), vetvy=3, von=0.012)
# brusne priecne stity so zeravymi skarami
for i in range(11):
    z = -0.85 + i * 0.17
    rura(trup, lava, [t.bod(z + abs(k) * 0.012, math.pi + k * 0.14, 0.004) for k in range(-5, 6)],
         [0.004 + 0.007 * (1 - abs(k) / 6) for k in range(-5, 6)], 4)
    rura(trup, brucho, [t.bod(z + 0.085 + abs(k) * 0.012, math.pi + k * 0.15, -0.006) for k in range(-5, 6)],
         [0.012 + 0.022 * (1 - abs(k) / 6) for k in range(-5, 6)], 6, True)

# ================= HLAVA: siroka lebka, nadocnicove obluky, koruna rohov, tlama so zeravym vnutrom =================
hlava = pivot('hlava', (0, 0.74, 0.86))
koncatina(hlava, telo, [(0, -0.01, -0.22), (0, 0.04, 0.04)], [0.22, 0.2], 14)     # krk
lebka = Telo([(-0.12, 0.07, 0.24, 0.18, 0.10), (0.12, 0.075, 0.31, 0.19, 0.095), (0.34, 0.065, 0.27, 0.15, 0.085),
              (0.52, 0.045, 0.17, 0.11, 0.065), (0.74, 0.04, 0.165, 0.11, 0.060), (0.88, 0.035, 0.13, 0.085, 0.05),
              (0.95, 0.03, 0.05, 0.04, 0.03)], mocnina=2.9)
lebka.siet(hlava, lambda z, a: papula if abs(a) > 2.55 and z > 0.05 else telo, kruhov=32, segm=28, sum=0.004, seed=2)
pancierovanie(hlava, lebka, 0.02, 0.84, 0.13, (-0.95, -0.35, 0.35, 0.95), 0.07, 0.065, 0.028, 400)
for s in (-1, 1):
    # oko v jamke pod tazkym oblukom, zvisla zrenicka
    gula(hlava, pancier, (s * 0.222, 0.125, 0.33), (0.06, 0.055, 0.082), 10)
    gula(hlava, oko, (s * 0.262, 0.125, 0.35), (0.038, 0.035, 0.048), 10)
    gula(hlava, roh_m, (s * 0.297, 0.125, 0.362), (0.008, 0.031, 0.011), 8)
    rura(hlava, pancier, [(s * 0.17, 0.15, 0.52), (s * 0.27, 0.19, 0.42), (s * 0.30, 0.19, 0.29),
                          (s * 0.28, 0.20, 0.17), (s * 0.22, 0.21, 0.06)], [0.015, 0.047, 0.056, 0.048, 0.02], 7)
    roh(hlava, roh_m, (s * 0.28, 0.2, 0.22), (s * 0.5, 0.65, -0.5), 0.22, 0.045, (0, 0, -0.7))
    # hlavne rohy: von, dozadu a spickou spat hore
    body = [(s * 0.19, 0.19, 0.06), (s * 0.31, 0.31, -0.07), (s * 0.43, 0.38, -0.24), (s * 0.50, 0.40, -0.43),
            (s * 0.50, 0.47, -0.60), (s * 0.44, 0.60, -0.68), (s * 0.37, 0.72, -0.65)]
    rr = [0.105, 0.095, 0.08, 0.064, 0.046, 0.027, 0.0]
    rura(hlava, roh_m, body, rr, 9)
    for i in range(1, 5):                                                          # kruhy na rohu + zeravy koren
        p0, p1 = V(body[i]), V(body[i + 1])
        rura(hlava, roh_m, [p0.lerp(p1, 0.0), p0.lerp(p1, 0.1), p0.lerp(p1, 0.2)], [rr[i] * 0.98, rr[i] * 1.08, rr[i] * 0.93], 9)
    rura(hlava, lava, [V(body[0]).lerp(V(body[1]), k) for k in (0.3, 0.42)], [0.108, 0.106], 9)
    # mensie lícne rohy
    roh(hlava, roh_m, (s * 0.29, 0.07, 0.10), (s * 0.85, 0.05, -0.55), 0.34, 0.055, (0, 0.5, -0.35))
    roh(hlava, roh_m, (s * 0.27, -0.01, 0.05), (s * 0.9, -0.3, -0.4), 0.2, 0.04, (0, 0.2, -0.4))
    roh(hlava, roh_m, (s * 0.12, 0.24, -0.02), (s * 0.25, 0.8, -0.55), 0.22, 0.045, (0, -0.1, -0.7))
    # nozdry
    gula(hlava, pancier, (s * 0.085, 0.13, 0.83), (0.05, 0.04, 0.062), 9, 0.08, 5, False)
    gula(hlava, lava, (s * 0.093, 0.145, 0.872), (0.019, 0.017, 0.019), 6)
    # horne zuby: nepravidelne, dva velke tesaky
    for k, (z, d) in enumerate([(0.88, 0.11), (0.80, 0.055), (0.72, 0.21), (0.59, 0.065),
                                (0.48, 0.13), (0.38, 0.05), (0.29, 0.09), (0.19, 0.045)]):
        cy, w, hu, hd = lebka.prierez(z)
        roh(hlava, zub, (s * w * 0.82, cy - hd * 0.72, z), (s * 0.18, -1, 0.05), d, 0.017 + d * 0.09, (0, 0, -0.35), 4, 6)
    trhlina(hlava, lava, lebka, 0.07, s * 1.35, 0.1, s * 0.015, 6, 0.012, seed=500 + (s > 0), vetvy=2, von=0.012)
roh(hlava, roh_m, (0, 0.14, 0.78), (0, 0.9, 0.35), 0.17, 0.045, (0, 0, -0.9))    # roh na nose
roh(hlava, roh_m, (0, 0.15, 0.66), (0, 1, 0.1), 0.1, 0.033, (0, 0, -0.9))
rura(hlava, lava, [lebka.bod(0.03 + i * 0.09, math.sin(i * 2.1) * 0.1, 0.034) for i in range(7)],
     [0.006, 0.014, 0.017, 0.016, 0.012, 0.009, 0.004], 4)
gula(hlava, lava, (0, -0.04, 0.06), (0.12, 0.055, 0.07), 10)                      # ziara v hrdle

celust = pivot('celust', (0, -0.08, 0.05), hlava)
c = Telo([(-0.06, -0.035, 0.22, 0.045, 0.11), (0.18, -0.035, 0.25, 0.042, 0.115), (0.42, -0.025, 0.17, 0.036, 0.085),
          (0.62, -0.02, 0.135, 0.032, 0.072), (0.78, -0.012, 0.125, 0.03, 0.065), (0.87, -0.008, 0.055, 0.02, 0.035)], mocnina=2.8)
c.siet(celust, lambda z, a: papula if abs(a) < 0.95 else (brucho if abs(a) > 2.0 else telo), kruhov=26, segm=24)
rura(celust, lava, [(math.sin(i * 1.9) * 0.025, 0.012, 0.04 + i * 0.09) for i in range(8)],
     [0.03, 0.034, 0.03, 0.026, 0.022, 0.018, 0.012, 0.005], 6)                    # zeravy jazyk
for s in (-1, 1):
    for z, d in [(0.83, 0.16), (0.65, 0.06), (0.54, 0.12), (0.43, 0.05), (0.33, 0.085), (0.22, 0.045)]:
        cy, w, hu, hd = c.prierez(z)
        roh(celust, zub, (s * w * 0.9, cy + hu * 0.4, z), (s * 0.28, 1, 0), d, 0.015 + d * 0.09, (0, 0, -0.35), 4, 6)
    for z, d in [(0.12, 0.2), (0.28, 0.17), (0.46, 0.13), (0.62, 0.09)]:           # brada s ostnami
        p = c.bod(z, s * 2.05, -0.012)
        roh(celust, roh_m, p, (s * 0.65, -0.65, -0.35), d, 0.035, (0, 0, -0.6))
    for k in range(5):
        platna(celust, pancier, c, 0.1 + k * 0.15, s * 1.45, 0.065, 0.035, 0.022, 600 + k + (s > 0) * 10)
    trhlina(celust, lava, c, 0.05, s * 1.95, 0.12, s * 0.02, 6, 0.011, seed=620 + (s > 0), vetvy=1, von=0.01)

# ================= CHVOST: 3 clanky, na konci ostnaty kyj =================
CHV = [[(-0.72, 0, 0.17, 0.13, 0.12), (-0.45, 0, 0.205, 0.165, 0.15), (-0.15, 0, 0.245, 0.20, 0.19), (0.16, 0, 0.23, 0.19, 0.18)],
       [(-0.72, 0, 0.115, 0.09, 0.085), (-0.45, 0, 0.14, 0.115, 0.105), (-0.15, 0, 0.17, 0.14, 0.13), (0.10, 0, 0.16, 0.13, 0.12)],
       [(-0.76, 0, 0.055, 0.05, 0.045), (-0.45, 0, 0.082, 0.068, 0.062), (-0.15, 0, 0.115, 0.095, 0.088), (0.09, 0, 0.11, 0.09, 0.082)]]
rodic = None
for i, rezy in enumerate(CHV):
    s_ = 1 - i * 0.27
    cl = pivot('chvost_%d' % i, (0, 0, -0.62) if i else (0, 0.6, -0.95), rodic)
    rodic = cl
    ct = Telo(rezy, mocnina=2.5)
    ct.siet(cl, kozene, kruhov=18, segm=24, sum=0.004, seed=10 + i)
    pancierovanie(cl, ct, -0.62, 0.0, 0.15, (-1.35, -0.75, -0.22, 0.22, 0.75, 1.35), 0.085 * s_, 0.062 * s_, 0.032 * s_, 700 + i * 90)
    rura(cl, lava, [ct.bod(-0.68 + k * 0.105, math.sin(k * 2.2 + i) * 0.1, 0.03 * s_) for k in range(8)], [0.014 * s_] * 8, 4)
    for z in (-0.52, -0.32, -0.12):
        tron(cl, ct, z, 0.0, (0.30 if z < -0.4 else 0.34) * s_, 0.062 * s_)
    for s in (-1, 1):
        for z in (-0.42, -0.2):
            tron(cl, ct, z, s * 1.2, 0.17 * s_, 0.036 * s_, 0.6)
        trhlina(cl, lava, ct, -0.62, s * 1.65, 0.13, s * 0.01, 6, 0.017 * s_, seed=800 + i * 9 + (s > 0), vetvy=2, von=0.01)
    if i == 2:                                                                     # kyj na konci
        gula(cl, pancier, (0, 0.0, -0.80), (0.12, 0.105, 0.16), 9, 0.16, 11, False)
        gula(cl, lava, (0, 0.0, -0.80), (0.108, 0.092, 0.148), 10)
        for smer, d in [((1, 0.15, -0.5), 0.34), ((-1, 0.15, -0.5), 0.34), ((0.55, 0.85, -0.4), 0.28),
                        ((-0.55, 0.85, -0.4), 0.28), ((0, 0.3, -1), 0.42), ((0.7, -0.4, -0.6), 0.22), ((-0.7, -0.4, -0.6), 0.22)]:
            sm = V(smer).normalized()
            roh(cl, roh_m, V((0, 0, -0.80)) + sm * 0.09, sm, d, 0.048, (0, 0.25, -0.2))

# ================= NOHY: mohutne roztiahnute, pazury, platne na stehnach =================
for meno, x, z in (('noha_PP', -1, 1), ('noha_LP', 1, 1), ('noha_PZ', -1, -1), ('noha_LZ', 1, -1)):
    n = pivot(meno, (x * 0.42, 0.55, z * 0.5))
    predna = z > 0
    sila = 1.08 if predna else 1.0
    bedro = (-x * 0.08, 0.02, 0)
    koleno = (x * 0.22, -0.19, -0.09 if predna else 0.13)
    clenok = (x * 0.23, -0.43, 0.03 if predna else -0.03)
    koncatina(n, telo, [bedro, koleno, clenok], [0.18 * sila, 0.12 * sila, 0.085], 12)
    gula(n, telo, (x * 0.235, -0.485, 0.075), (0.145, 0.065, 0.16), 12)           # labka
    for k, (dx, dl) in enumerate([(-0.105, 0.11), (-0.036, 0.15), (0.04, 0.15), (0.11, 0.11)]):
        prst = (x * 0.235 + dx * 1.35, -0.512, 0.20 + dl * 0.35)
        koncatina(n, telo, [(x * 0.235 + dx * 0.55, -0.49, 0.1), prst], [0.052, 0.034], 8)
        roh(n, roh_sv, prst, (dx * 1.4, 0.15, 1), 0.14, 0.032, (0, -1.1, 0), 4, 6)
    roh(n, roh_m, koleno, (x * 0.8, 0.35, -0.6), 0.24, 0.055, (0, 0.1, -0.5))     # lakt
    for k, (px, py, pz, r) in enumerate([(0.15, 0.04, 0.03, 0.095), (0.14, -0.01, -0.11, 0.075), (0.10, 0.09, -0.04, 0.08),
                                         (0.30, -0.19, 0.04, 0.07), (0.31, -0.29, 0.0, 0.06), (0.295, -0.37, 0.05, 0.05)]):
        gula(n, pancier, (x * px, py, pz - (0.0 if predna else -0.04)), (r * 0.7, r, r), 7, 0.22, 20 + k, False)
    rura(n, lava, [(x * 0.20, 0.09, 0.07), (x * 0.28, -0.04, -0.01), (x * 0.27, -0.09, 0.07), (x * 0.33, -0.2, -0.04 if predna else 0.1),
                   (x * 0.315, -0.30, 0.07), (x * 0.31, -0.39, 0.01)], [0.003, 0.015, 0.012, 0.016, 0.011, 0.003], 4)

hotovo()
export('lavovy_obr')
