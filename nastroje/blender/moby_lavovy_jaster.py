# Lavovy jaster (bezny nepriatel na sopecnych ostrovoch) -> modely/moby/lavovy_jaster.glb
# Pivoty (hra ich otaca, src/nepriatelia.js modelJaster): trup, hlava, chvost > koniec, noha_PP/LP/PZ/LZ
#   (P/L = prava/lava strana moba: prava = -x, lava = +x; druhe pismeno P/Z = predna/zadna)
# Materialy: telo, brucho (blikaju pri zasahu), pruh (ziariace pruhy, JS meni intenzitu), oko, roh
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mob import *

zacni()
telo = material('telo', 0x4a2820, 0.75)
brucho = material('brucho', 0x7a4630, 0.8)
pruh = material('pruh', 0x2a1008, 0.4, ziara=0xff5a10)
oko = material('oko', 0x111111, 0.3, ziara=0xffaa22)
roh = material('roh', 0x1e1412, 0.45, kov=0.15)

# --- trup: oble telo + svetlejsie brucho + ostne s ziariacimi spickami + lavove trhliny
trup = pivot('trup', (0, 0.55, 0))
diel('gula', telo, trup, rozmer=(0.62, 0.44, 1.45), hladky=1, segm=14)
diel('gula', brucho, trup, (0, -0.1, 0.02), (0.5, 0.26, 1.25), hladky=1, segm=12)
diel('gula', telo, trup, (0, 0.02, 0.55), (0.5, 0.38, 0.5), hladky=1)          # plecia
for i in range(6):
    z = -0.55 + i * 0.22
    s = 1 - abs(i - 2.5) * 0.12
    diel('kuzel', roh, trup, (0, 0.2 * s + 0.08, z), (0.11 * s, 0.24 * s, 0.16 * s), rot=(-0.45, 0, 0), segm=5)
    diel('kocka', pruh, trup, (0, 0.17 * s + 0.03, z + 0.1), (0.42 * s, 0.03, 0.05), hrana=0.2)
    for x in (-1, 1):                                                          # bocne supiny
        diel('ikosa', telo, trup, (x * 0.27 * s, 0.06, z), (0.1, 0.08, 0.14), segm=1)
        diel('kocka', pruh, trup, (x * 0.29 * s, -0.02, z + 0.08), (0.03, 0.03, 0.12))

# --- hlava: plocha jaszteria hlava, oci, nozdry, celust so zubami
hlava = pivot('hlava', (0, 0.62, 0.75))
diel('gula', telo, hlava, (0, 0.0, 0.0), (0.4, 0.34, 0.4), hladky=1)                # krk
diel('kocka', telo, hlava, (0, 0.02, 0.22), (0.34, 0.2, 0.42), hrana=0.25, hladky=1)
diel('kocka', telo, hlava, (0, -0.01, 0.46), (0.24, 0.13, 0.28), hrana=0.25, hladky=1)  # cumak
diel('kocka', telo, hlava, (0, -0.09, 0.3), (0.26, 0.07, 0.46), hrana=0.25, hladky=1)  # spodna celust
diel('kocka', brucho, hlava, (0, -0.115, 0.26), (0.2, 0.04, 0.36), hrana=0.25, hladky=1)
for x in (-1, 1):
    diel('gula', roh, hlava, (x * 0.15, 0.09, 0.26), (0.11, 0.08, 0.12), segm=8)      # nadocnicovy oblúk
    diel('gula', oko, hlava, (x * 0.165, 0.07, 0.31), (0.06, 0.05, 0.06), segm=8)
    diel('kuzel', roh, hlava, (x * 0.13, 0.08, 0.02), (0.06, 0.24, 0.06), rot=(-1.2, 0, -x * 0.35), segm=5)  # rohy dozadu
    for k in range(4):
        diel('kuzel', material('zub', 0xf0e0c0, 0.4), hlava, (x * 0.1, -0.075, 0.2 + k * 0.1), (0.025, 0.06, 0.025), rot=(math.pi, 0, 0), segm=4)
diel('kocka', pruh, hlava, (0, 0.115, 0.15), (0.16, 0.03, 0.3), hrana=0.2)

# --- chvost z 2 clankov, konci ostnom
chvost = pivot('chvost', (0, 0.55, -0.72))
diel('gula', telo, chvost, (0, 0, -0.28), (0.36, 0.28, 0.75), hladky=1)
diel('kocka', pruh, chvost, (0, 0.14, -0.28), (0.2, 0.03, 0.5), hrana=0.2)
for i in range(3):
    diel('kuzel', roh, chvost, (0, 0.15, -0.1 - i * 0.18), (0.07, 0.14, 0.1), rot=(-0.5, 0, 0), segm=5)
koniec = pivot('koniec', (0, 0, -0.58), chvost)
diel('gula', telo, koniec, (0, -0.02, -0.3), (0.22, 0.17, 0.7), hladky=1)
diel('kocka', pruh, koniec, (0, 0.07, -0.25), (0.1, 0.03, 0.4), hrana=0.2)
diel('kuzel', roh, koniec, (0, 0, -0.7), (0.1, 0.25, 0.1), rot=(-math.pi / 2, 0, 0), segm=6)

# --- nohy: stehno, predkolenie, labka s pazurmi (pivot = bedro, noha visí dole)
for meno, x, z in (('noha_PP', -1, 1), ('noha_LP', 1, 1), ('noha_PZ', -1, -1), ('noha_LZ', 1, -1)):
    # jasterie nohy su roztiahnute do stran: stehno vodorovne von, predkolenie dole, labka vpredu
    n = pivot(meno, (x * 0.26, 0.5, z * 0.45))
    diel('gula', telo, n, (x * 0.12, -0.04, 0), (0.34, 0.2, 0.2), rot=(0, 0, -x * 0.35), hladky=1)
    diel('gula', telo, n, (x * 0.27, -0.24, 0.02), (0.15, 0.4, 0.15), hladky=1)
    diel('kocka', telo, n, (x * 0.29, -0.45, 0.07), (0.19, 0.08, 0.24), hrana=0.25, hladky=1)
    for k in (-1, 0, 1):
        diel('kuzel', roh, n, (x * 0.29 + k * 0.06, -0.47, 0.2), (0.035, 0.1, 0.035), rot=(math.pi / 2, 0, 0), segm=4)

export('lavovy_jaster')
