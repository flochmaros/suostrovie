# Bledy (hororovy ostrov Ticha zatoka) -> modely/moby/bledy.glb a matka.glb
# Kostra rovnaka ako src/modely_bledych.js (animacia ostava tam):
#   telo (panva) > chrbat > krk > hlava;  telo > stehno_L/P > koleno_L/P
#   chrbat > rameno_L/P > laket_L/P > zap_L/P > prst_L0..4 > prst_L0b ...   (L = strana -1 = -x, P = +x; prst 4 = palec)
# Koncatiny visia z klbu dole (-y). Materialy: koza, rebra, kost, diera, pazur (JS ich nemeni).
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mob import *


def ruka(chrbat, strana, S, koza, pazur):
    st = 'L' if strana < 0 else 'P'
    rameno = pivot('rameno_' + st, (strana * 0.25, 0.84, 0), chrbat)
    diel('gula', koza, rameno, rozmer=(0.13, 0.12, 0.12), hladky=1, segm=8)                              # kostnate plece
    trubica([(0, 0, 0, 0.05), (0, -0.2, 0.005, 0.048), (0, -0.45, 0, 0.036), (0, -0.7, -0.005, 0.03), (0, -0.86, 0, 0.034)], koza, rameno)
    laket = pivot('laket_' + st, (0, -0.86, 0), rameno)
    diel('gula', koza, laket, (0, 0, -0.012), (0.075, 0.08, 0.085), hladky=1, segm=8)                     # spicaty laket
    trubica([(0, 0, 0, 0.034), (0, -0.25, 0.004, 0.032), (0, -0.6, 0, 0.024), (0, -0.88, 0, 0.02), (0, -0.9, 0, 0.022)], koza, laket)
    zap = pivot('zap_' + st, (0, -0.9, 0), laket)
    diel('kocka', koza, zap, (0, -0.065, 0), (0.09, 0.13, 0.03), hrana=0.3, hladky=1)            # dlan
    for i, (x, L) in enumerate(((-0.036, 0.17), (-0.012, 0.2), (0.012, 0.2), (0.036, 0.17))):
        prst(zap, f'prst_{st}{i}', (x, -0.12, 0), (0, 0, 0), L, koza, pazur)
    prst(zap, f'prst_{st}4', (strana * 0.045, -0.06, 0.012), (0, 0, strana * 0.5), 0.12, koza, pazur)


def prst(zap, meno, poz, rot, L, koza, pazur):
    a = pivot(meno, poz, zap, rot)
    trubica([(0, 0, 0, 0.016), (0, -L * 0.5, 0, 0.012), (0, -L * 0.95, 0, 0.014), (0, -L, 0, 0.012)], koza, a, K=5, hladky=0)
    b = pivot(meno + 'b', (0, -L, 0), a)
    trubica([(0, 0, 0, 0.012), (0, -L * 0.5, 0, 0.01), (0, -L * 0.85, 0, 0.008)], koza, b, K=5, hladky=0)
    trubica([(0, -L * 0.8, 0, 0.009), (0, -L * 0.85 - 0.04, 0.008, 0.005), (0, -L * 0.85 - 0.075, 0.02, 0.001)], pazur, b, K=5, hladky=0)


def noha(telo, strana, koza, pazur):
    st = 'L' if strana < 0 else 'P'
    stehno = pivot('stehno_' + st, (strana * 0.15, 0, 0), telo)
    trubica([(0, 0.02, 0, 0.07), (0, -0.2, 0.01, 0.068), (0, -0.5, 0, 0.05), (0, -0.72, 0, 0.045)], koza, stehno)
    koleno = pivot('koleno_' + st, (0, -0.72, 0), stehno)
    diel('gula', koza, koleno, (0, 0, 0.02), (0.1, 0.11, 0.1), hladky=1, segm=8)                         # vystupene koleno
    trubica([(0, 0, 0, 0.048), (0, -0.25, -0.01, 0.042), (0, -0.6, 0, 0.03), (0, -0.74, 0, 0.034)], koza, koleno)
    diel('gula', koza, koleno, (0, -0.765, 0.05), (0.09, 0.06, 0.24), hladky=1, segm=8)                  # chodidlo
    for x in (-0.03, 0, 0.03):                                                                    # dlhe prsty s pazurmi
        trubica([(x, -0.77, 0.12, 0.014), (x * 1.3, -0.775, 0.2, 0.011), (x * 1.4, -0.79, 0.25, 0.008)], koza, koleno, K=5, hladky=0)
        trubica([(x * 1.4, -0.79, 0.245, 0.008), (x * 1.45, -0.805, 0.29, 0.001)], pazur, koleno, K=5, hladky=0)


def bledy(typ):
    zacni()
    matka = typ == 'matka'
    koza = material('koza', 0x9c9f98 if matka else 0xbdc0b8, 0.82, ziara=0x1c2230 if matka else 0x1b2430, sila=0.55)
    rebra = material('rebra', 0xd4d6cc, 0.75, ziara=0x202a38, sila=0.55)
    kost = material('kost', 0xe9e3cf, 0.55, ziara=0x2a2a30, sila=0.4)
    diera = material('diera', 0x040404, 1.0)
    pazur = material('pazur', 0x3b362d, 0.5)

    telo = pivot('telo', (0, 1.46, 0))
    diel('gula', koza, telo, rozmer=(0.3, 0.18, 0.2), hladky=1, segm=8)                                   # panva
    for s in (-1, 1):
        diel('gula', koza, telo, (s * 0.1, 0.02, 0.03), (0.1, 0.08, 0.1), hladky=1, segm=8)               # vystupene panvove kosti

    chrbat = pivot('chrbat', (0, 0.06, 0), telo)
    diel('gula', koza, chrbat, (0, 0.6, 0), (0.38, 0.62, 0.23), hladky=1, segm=8)                         # hrudnik
    diel('gula', koza, chrbat, (0, 0.18, 0.0), (0.24, 0.42, 0.17), hladky=1, segm=8)                      # vpadnute brucho
    for i in range(7):                                                                            # rebra (oblĂşky okolo predku)
        y = 0.38 + i * 0.075
        r = 0.17 - abs(i - 3) * 0.006 - (max(0, i - 4) * 0.012)
        body = [(1.12 * r * math.cos(t), y - 0.02 * math.sin(t), 0.72 * r * math.sin(t), 0.011)
                for t in [(-0.15 + 1.3 * k / 10) * math.pi for k in range(11)]]
        trubica(body, rebra, chrbat, K=5, hladky=0)
    for i in range(11):                                                                           # stavce (vidno na zhrbenom chrbte)
        y = 0.1 + i * 0.08
        diel('ikosa', rebra, chrbat, (0, y, -0.11 + 0.02 * math.sin(i / 10 * math.pi)), (0.045, 0.04, 0.05), hladky=1, segm=1)
    for s in (-1, 1):
        diel('gula', koza, chrbat, (s * 0.12, 0.72, -0.1), (0.16, 0.2, 0.04), hladky=1, segm=8)          # lopatky
        trubica([(s * 0.04, 0.88, 0.07, 0.016), (s * 0.15, 0.89, 0.06, 0.014), (s * 0.24, 0.86, 0.01, 0.018)], rebra, chrbat, K=6)  # klucne kosti

    diel('gula', koza, chrbat, (0, 0.9, -0.03), (0.4, 0.16, 0.2), hladky=1, segm=8)              # trapezy: krk plynulo do pliec
    krk = pivot('krk', (0, 0.95, 0.02), chrbat)
    trubica([(0, -0.06, -0.02, 0.06), (0, 0.1, 0.0, 0.042), (0, 0.24, 0.03, 0.045)], koza, krk)
    for s in (-1, 1):                                                                             # slachy na krku
        trubica([(s * 0.03, 0.2, 0.06, 0.012), (s * 0.05, 0.05, 0.04, 0.014), (s * 0.08, -0.06, 0.05, 0.012)], koza, krk, K=5, hladky=0)
    hlava = pivot('hlava', (0, 0.22, 0.04), krk)
    diel('gula', kost, hlava, (0, 0.12, 0.02), (0.23, 0.4, 0.25), hladky=1, segm=14)             # predlzena lebka
    diel('gula', kost, hlava, (0, -0.04, 0.08), (0.14, 0.2, 0.18), hladky=1, segm=8)                      # spodok masky
    for x in (-0.045, 0.045):
        diel('gula', diera, hlava, (x, 0.15, 0.13), (0.06, 0.085, 0.05), hladky=1, segm=8)                # hlboke ciernie diery
        diel('gula', kost, hlava, (x * 1.05, 0.2, 0.125), (0.075, 0.025, 0.04), hladky=1, segm=8)         # nadocnicovy oblĂşk
    trubica([(0, 0.06, 0.147, 0.004), (0.006, -0.02, 0.143, 0.004), (-0.003, -0.11, 0.12, 0.003)], diera, hlava, K=4, hladky=0)  # sev
    trubica([(0.03, 0.31, 0.06, 0.003), (0.05, 0.24, 0.1, 0.003), (0.04, 0.19, 0.12, 0.002)], diera, hlava, K=4, hladky=0)        # prasklina
    if matka:                                                                                     # venec rohov z kosti
        for s in (-1, 1):
            body = [(s * (0.07 + 0.16 * math.cos(t) - 0.16) * -1, 0.3 + 0.16 * math.sin(t), -0.02 * t, 0.022 * (1 - t / 3.5) + 0.004)
                    for t in [k / 8 * math.pi * 0.85 for k in range(9)]]
            trubica(body, kost, hlava, K=6)
            for k in range(3):                                                                    # mensie vybezky
                t = 0.6 + k * 0.6
                trubica([(-s * (0.07 + 0.16 * math.cos(t) - 0.16), 0.3 + 0.16 * math.sin(t), 0, 0.012),
                         (-s * (0.07 + 0.22 * math.cos(t) - 0.16), 0.3 + 0.22 * math.sin(t), -0.03, 0.002)], kost, hlava, K=5)

    for s in (-1, 1):
        ruka(chrbat, s, None, koza, pazur)
        noha(telo, s, koza, pazur)
    export(typ)


bledy('bledy')
bledy('matka')
