# Krab (nocny krab aj obrovsky krab-straz) -> modely/moby/krab.glb
# Pivoty (hra ich otaca, src/modely_nepriatelov.js modelKrab), P = strana -x, L = strana +x:
#   trup > stopka_P/L (oci), celust_P/L (usta), ram_P/L > lakt > klepeto > prst (pohyblivy prst klepeta)
#   bedro_P0..3 / bedro_L0..3 > koleno > clenok   (nohy, 0 = predna; clanky leza vodorovne pozdlz x, ohne ich hra)
#   boss, boss_P, boss_L = ozdoby len pre obrovskeho kraba (mach, barnakle, kamene, jazvy, ostne) - inemu ich hra zmaze
# Materialy: pancier, telo, svetle (blikaju pri zasahu), hrot, zub, oko, zrenica, lesk + mach, mach2, vapno, diera, kamen, jazva
# Farby su len nahlad - hra ich prefarbi podla druhu kraba (FARBY v modely_nepriatelov.js).
# Vertex farby panciera NIE su farby, ale MASKA, z ktorej hra namiesa farby:
#   R = 0 brucho .. 1 vrch;  G = 0.5 nic, viac = bodka, menej = tmava ryha;  B = svetla spicka ostna
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mob import *

zacni()
telo = material('telo', 0x4b3f9a, 0.5)
svetle = material('svetle', 0x9a8ce6, 0.45)
hrot = material('hrot', 0x241c48, 0.3)
zub = material('zub', 0xc9c0ff, 0.5)
oko = material('oko', 0xffe066, 0.15, ziara=0xffe066, sila=0.35)
zrenica = material('zrenica', 0x050505, 0.08)
lesk = material('lesk', 0xffffff, 0.2, ziara=0xffffff, sila=1.0)
mach = material('mach', 0x46702e, 0.95)
mach2 = material('mach2', 0x2f5a30, 0.95)
vapno = material('vapno', 0xded7c2, 0.85)
diera = material('diera', 0x3a332a, 0.9)
kamen = material('kamen', 0x66635f, 0.9)
jazva = material('jazva', 0xf0c8a8, 0.6)
pancier = material('pancier', 0xffffff, 0.38)
uzol_farby = pancier.node_tree.nodes.new('ShaderNodeVertexColor')     # bez tohto by sa maska neexportovala
uzol_farby.layer_name = 'maska'
pancier.node_tree.links.new(uzol_farby.outputs['Color'], pancier.node_tree.nodes['Principled BSDF'].inputs['Base Color'])

# ---------- zbierka trojuholnikov: vsetko s rovnakym pivotom + materialom sa zleje do jedneho meshu (rychlejsie kreslenie) ----------
SIETE = {}


def pridaj(rodic, mat, body, plochy, farby=None):
    s = SIETE.setdefault((rodic.name, mat.name), {'rodic': rodic, 'mat': mat, 'body': [], 'plochy': [], 'farby': []})
    n = len(s['body'])
    s['body'] += body
    s['plochy'] += [[i + n for i in p] for p in plochy]
    if mat == pancier:
        s['farby'] += farby or [(1.0, 0.5, 0.0)] * len(body)


def zostav():
    for (r, m), s in SIETE.items():
        me = bpy.data.meshes.new(r + '_' + m)
        me.from_pydata([G(*b) for b in s['body']], [], s['plochy'])
        me.validate()
        if s['farby']:
            a = me.color_attributes.new('maska', 'FLOAT_COLOR', 'POINT')
            for i, f in enumerate(s['farby']):
                a.data[i].color = (*f, 1.0)
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        for p in me.polygons:
            p.use_smooth = m not in ('kamen',)
        me.materials.append(s['mat'])
        o = bpy.data.objects.new(r + '_' + m, me)
        bpy.context.collection.objects.link(o)
        o.parent = s['rodic']


# ---------- tvary ----------
def rurka(rodic, mat, body, polomery, n=8, farby=None):
    """Hladka rurka pozdlz lomenej ciary. polomery = cislo alebo (vodorovny, zvisly) pre kazdy bod. farby = maska po bodoch."""
    P = [Vector(b) for b in body]
    V, F, C = [], [], []
    bok = None
    for i, p in enumerate(P):
        t = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        if bok is None:
            bok = Vector((0, 1, 0)).cross(t)
            if bok.length < 1e-4:
                bok = Vector((1, 0, 0))
        bok = (bok - t * bok.dot(t)).normalized()
        hore = t.cross(bok).normalized()
        r = polomery[i]
        rb, rh = r if isinstance(r, tuple) else (r, r)
        for k in range(n):
            a = k / n * math.tau
            V.append(tuple(p + bok * math.cos(a) * rb + hore * math.sin(a) * rh))
            if farby:
                C.append(farby[i])
    for i in range(len(P) - 1):
        for k in range(n):
            a, b = i * n + k, i * n + (k + 1) % n
            F.append([a, b, b + n, a + n])
    F.append([k for k in range(n)][::-1])
    F.append([(len(P) - 1) * n + k for k in range(n)])
    pridaj(rodic, mat, V, F, C or None)


def krivka(a, b, c, kusov=6):                       # kvadraticka Bezierova krivka (a -> c, b ju ohyba)
    a, b, c = Vector(a), Vector(b), Vector(c)
    return [tuple(a.lerp(b, u).lerp(b.lerp(c, u), u)) for u in (i / kusov for i in range(kusov + 1))]


def tahaj(rodic, mat, a, b, c, r0, r1, kusov=6, n=7, farby=None):      # zahnuty zuzujuci sa tvar (prst, pazur, osten)
    kusov, n = max(3, kusov - 1), max(4, n - 1)
    f = None
    if farby:
        f = [tuple(farby[0][j] + (farby[1][j] - farby[0][j]) * i / kusov for j in range(3)) for i in range(kusov + 1)]
    rurka(rodic, mat, krivka(a, b, c, kusov), [r0 + (r1 - r0) * i / kusov for i in range(kusov + 1)], n, f)


def clanok(rodic, mat, a, b, profil, n=9, ohyb=(0, 0, 0)):
    """Clanok koncatiny od a po b: profil = [(0..1 po dlzke, vodorovny r, zvisly r)] - zaoblene konce, v strede hrubsi."""
    a, b, o = Vector(a), Vector(b), Vector(ohyb)
    rurka(rodic, mat, [tuple(a.lerp(b, u) + o * math.sin(math.pi * u)) for u, _, _ in profil], [(x, y) for _, x, y in profil], n)


def elipsoid(rodic, mat, poz, rozmer, u=12, v=8, sum=0.0, seed=0, maska=None):     # rozmer = polomery (x, y, z)
    u, v = max(5, round(u * 0.75)), max(4, round(v * 0.75))
    rnd = random.Random(seed)
    V = [(poz[0], poz[1] - rozmer[1], poz[2])]
    for j in range(1, v):
        f = -math.pi / 2 + math.pi * j / v
        for i in range(u):
            a = i / u * math.tau
            k = 1 + rnd.uniform(-sum, sum)
            V.append((poz[0] + math.cos(f) * math.cos(a) * rozmer[0] * k, poz[1] + math.sin(f) * rozmer[1] * k,
                      poz[2] + math.cos(f) * math.sin(a) * rozmer[2] * k))
    V.append((poz[0], poz[1] + rozmer[1], poz[2]))
    F = [[0, 1 + i, 1 + (i + 1) % u] for i in range(u)]
    for j in range(v - 2):
        for i in range(u):
            a, b = 1 + j * u + i, 1 + j * u + (i + 1) % u
            F.append([a, b, b + u, a + u])
    h = 1 + (v - 2) * u
    F += [[len(V) - 1, h + (i + 1) % u, h + i] for i in range(u)]
    pridaj(rodic, mat, V, F, [maska] * len(V) if maska else None)


# ---------- pancier ----------
HX, HT, HB, HZ = 0.38, 0.17, 0.085, 0.29


def hladko(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def kopec(x, z, cx, cz, rx, rz):
    return math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2))


def ryha(x, z):                                     # ryhy na chrbte: dve zahnute po stranach stredu + priecna vzadu
    ax = abs(x)
    r = math.exp(-((ax - (0.085 + 1.6 * (z + 0.02) ** 2)) / 0.02) ** 2) * hladko(-0.19, -0.12, z) * (1 - hladko(0.1, 0.17, z))
    r += math.exp(-((z + 0.03 - 1.2 * x * x) / 0.02) ** 2) * (1 - hladko(0.05, 0.09, ax)) * 0.8
    r += math.exp(-((z - 0.09 + 0.9 * (ax - 0.17) ** 2) / 0.015) ** 2) * hladko(0.12, 0.16, ax) * (1 - hladko(0.24, 0.3, ax)) * 0.7
    return min(r, 1.0)


def povrch(nx, ny, nz):                             # bod jednotkovej gule -> bod na panciery
    rovnik = (1 - min(abs(ny), 1)) ** 3
    sirka = 1 + 0.17 * nz - 0.06 * nz * nz           # vpredu sirsi
    obvod = 1 + 0.02 * math.cos(math.atan2(nz, nx) * 22) * rovnik * (1 if nz > -0.2 else 0.2) + 0.035 * rovnik   # lem
    x = nx * HX * sirka * obvod
    z = nz * HZ * obvod * (1.05 if nz > 0 else 0.93)
    if ny > 0:
        y = HT * ny ** 0.85
        # vypuklne oblasti: zaludok vpredu, srdce vzadu, dve zabrove na bokoch
        y += ny * (0.016 * kopec(x, z, 0, 0.07, 0.07, 0.07) + 0.018 * kopec(x, z, 0, -0.11, 0.06, 0.06)
                   + 0.017 * (kopec(x, z, 0.19, -0.03, 0.09, 0.09) + kopec(x, z, -0.19, -0.03, 0.09, 0.09)))
        y -= 0.018 * ryha(x, z) * hladko(0.2, 0.5, ny)
        y += hladko(0.1, 0.35, ny) * 0.0035 * math.sin(x * 61 + math.sin(z * 37)) * math.sin(z * 53)   # zrnity povrch
    else:
        y = -HB * (-ny) ** 0.7
    # celo: vykrojene priehlbiny pre oci
    y -= 0.012 * (kopec(x, z, 0.1, 0.235, 0.045, 0.045) + kopec(x, z, -0.1, 0.235, 0.045, 0.045)) * (1 if ny > 0 else 0)
    return (x, y, z)


def horeY(x, z):                                    # vyska chrbta nad bodom (x, z)
    nx, nz = x / HX, z / HZ
    for _ in range(12):
        ny = math.sqrt(max(0.0, 1 - nx * nx - nz * nz))
        p = povrch(nx, ny, nz)
        nx += (x - p[0]) / HX * 0.8
        nz += (z - p[2]) / HZ * 0.8
    return povrch(nx, math.sqrt(max(0.0, 1 - nx * nx - nz * nz)), nz)[1]


def maska(x, y, z, ny):
    t = hladko(-0.02, 0.34, ny)
    sk = math.sin(x * 27 + 1) * math.sin(z * 31) + math.sin(x * 13 - z * 19) * 0.8 + math.sin(x * 47 + z * 41) * 0.35
    bodka = hladko(0.45, 1.1, sk) * hladko(0.2, 0.4, ny)
    tmava = ryha(x, z) * hladko(0.2, 0.5, ny)
    lem = math.exp(-((ny - 0.04) / 0.07) ** 2) * 0.35             # svetlejsi okraj panciera
    return (t, 0.5 + 0.5 * bodka - 0.5 * tmava, lem)


trup = pivot('trup', (0, 0.27, 0))


def zostav_pancier():
    # gula zo 6 stien kocky (UV gula by mala na vrchu pol = viditelnu "hviezdicku")
    N = 15
    V, F, C, hotove = [], [], [], {}

    def bod(c):
        kluc = tuple(round(k, 5) for k in c)
        if kluc not in hotove:
            d = Vector([math.tan(k * math.pi / 4) for k in c]).normalized()
            # viac riadkov pri leme, nech je okraj hladky
            p = povrch(d.x, d.y, d.z)
            hotove[kluc] = len(V)
            V.append(p)
            C.append(maska(*p, d.y))
        return hotove[kluc]

    for os_ in range(3):
        for znak in (-1, 1):
            def c(i, j):
                v = [0, 0, 0]
                v[os_] = znak
                v[(os_ + 1) % 3] = -1 + 2 * i / N
                v[(os_ + 2) % 3] = -1 + 2 * j / N
                return bod(v)
            for i in range(N):
                for j in range(N):
                    F.append([c(i, j), c(i + 1, j), c(i + 1, j + 1), c(i, j + 1)])
    pridaj(trup, pancier, V, F, C)


zostav_pancier()
# zuby po prednom boku panciera (zahnute dopredu) - typicka silueta kraba
for s in (-1, 1):
    for stupne, dlzka in ((-8, 0.1), (10, 0.092), (27, 0.08), (43, 0.066), (58, 0.05)):
        a = math.radians(stupne)
        z0 = povrch(s * math.cos(a), 0, math.sin(a))
        zaklad = (z0[0] * 0.9, 0.004, z0[2] * 0.9)
        smer = Vector((s * math.cos(a), 0, math.sin(a)))
        stred = Vector(zaklad) + smer * dlzka * 0.8
        koniec = Vector(zaklad) + smer * dlzka * 1.15 + Vector((0, 0.014, dlzka * 0.55))
        tahaj(trup, pancier, zaklad, stred, koniec, 0.032, 0.002, 5, 7, ((0.75, 0.5, 0.1), (0.9, 0.5, 1)))
    # 2 male ostne vzadu
    tahaj(trup, pancier, (s * 0.2, 0.01, -0.19), (s * 0.23, 0.02, -0.25), (s * 0.245, 0.035, -0.28), 0.022, 0.002, 4, 6,
          ((0.9, 0.5, 0.1), (1, 0.5, 0.9)))
    # nadocnicovy val nad ocami
    rurka(trup, pancier, [(s * x, horeY(x, z) - 0.004, z) for x, z in ((0.04, 0.252), (0.075, 0.222), (0.12, 0.212), (0.165, 0.24))],
          [0.008, 0.019, 0.018, 0.006], 7, [(1, 0.5, 0.25)] * 4)
# celo medzi ocami: 3 tupe zubky
for x, d in ((-0.035, 0.03), (0.0, 0.04), (0.035, 0.03)):
    tahaj(trup, pancier, (x, 0.04, 0.27), (x, 0.04, 0.305), (x * 1.15, 0.028, 0.295 + d), 0.022, 0.004, 4, 7,
          ((0.9, 0.5, 0.1), (1, 0.5, 0.7)))
# hrbolceky na chrbte
for x, z, r in ((0.045, 0.1, 0.018), (0.19, 0.01, 0.022), (0.24, -0.06, 0.016), (0.035, -0.13, 0.018),
                (0.25, 0.08, 0.015)):
    for s in (-1, 1):
        elipsoid(trup, pancier, (s * x, horeY(x, z) - 0.004, z), (r, r * 0.6, r), 8, 5, maska=(1, 0.95, 0.1))
# spodok: clankovany zahnuty zadocek
for i, (z, rx) in enumerate(((0.12, 0.07), (0.06, 0.1), (0.0, 0.12), (-0.06, 0.13), (-0.12, 0.12), (-0.175, 0.1))):
    elipsoid(trup, svetle, (0, -0.07 - 0.004 * (i % 2), z), (rx, 0.03, 0.04), 12, 6)

# ---------- tvar: ustna doska, kusadla, tykadla ----------
elipsoid(trup, telo, (0, -0.04, 0.248), (0.1, 0.045, 0.05), 14, 8)
for s in (-1, 1):
    # vonkajsie ustne "dvierka"
    rurka(trup, svetle, [(s * 0.078, -0.012, 0.27), (s * 0.075, -0.045, 0.293), (s * 0.052, -0.072, 0.29)], [0.012, 0.019, 0.01], 7)
    # kratke tykadlo
    rurka(trup, telo, [(s * 0.03, 0.012, 0.285), (s * 0.05, 0.03, 0.33), (s * 0.07, 0.03, 0.355)], [0.008, 0.006, 0.004], 5)
    tahaj(trup, zub, (s * 0.07, 0.03, 0.355), (s * 0.1, 0.045, 0.39), (s * 0.15, 0.025, 0.4), 0.004, 0.001, 5, 5)
for s, m in ((-1, 'P'), (1, 'L')):
    c = pivot('celust_' + m, (s * 0.045, -0.04, 0.3), trup)
    elipsoid(c, telo, (0, 0, 0.0), (0.02, 0.018, 0.018), 8, 6)
    tahaj(c, zub, (0, 0, 0.005), (s * 0.014, -0.004, 0.07), (-s * 0.028, -0.01, 0.075), 0.018, 0.003, 6, 7)

# ---------- oci na stopkach ----------
for s, m in ((-1, 'P'), (1, 'L')):
    o = pivot('stopka_' + m, (s * 0.1, 0.1, 0.22), trup)
    elipsoid(o, telo, (0, 0.012, 0), (0.033, 0.028, 0.033), 10, 7)
    clanok(o, svetle, (0, 0, 0), (0, 0.135, 0.008), [(0, 0.024, 0.024), (0.35, 0.018, 0.018), (0.75, 0.016, 0.016), (1, 0.025, 0.025)], 9,
           ohyb=(0, 0, -0.008))
    elipsoid(o, oko, (0, 0.152, 0.012), (0.046, 0.05, 0.044), 16, 11)
    elipsoid(o, zrenica, (0, 0.154, 0.048), (0.02, 0.031, 0.012), 12, 8)
    elipsoid(o, lesk, (-s * 0.009, 0.172, 0.059), (0.008, 0.008, 0.005), 8, 5)
    tahaj(o, telo, (0, 0.188, 0.01), (0, 0.205, 0.0), (s * 0.014, 0.222, -0.012), 0.016, 0.002, 4, 6)     # rozok nad okom

# ---------- klepeta: rameno -> predlaktie -> dlan s pevnym prstom + pohyblivy prst ----------
for s, m in ((-1, 'P'), (1, 'L')):
    ram = pivot('ram_' + m, (s * 0.27, -0.02, 0.14), trup)
    elipsoid(ram, svetle, (0, 0, 0), (0.048, 0.045, 0.048), 10, 7)
    clanok(ram, telo, (0, 0, -0.01), (0, 0, 0.215),
           [(0, 0.028, 0.028), (0.15, 0.045, 0.042), (0.55, 0.056, 0.05), (0.85, 0.045, 0.043), (1, 0.025, 0.025)], 10, ohyb=(0, 0.018, 0))
    tahaj(ram, zub, (0, 0.05, 0.11), (0, 0.085, 0.13), (0, 0.092, 0.16), 0.016, 0.002, 4, 6)
    lakt = pivot('lakt_' + m, (0, 0, 0.2), ram)
    elipsoid(lakt, svetle, (0, 0, 0), (0.044, 0.042, 0.044), 10, 7)
    clanok(lakt, telo, (0, 0, -0.005), (0, 0, 0.2),
           [(0, 0.028, 0.028), (0.2, 0.048, 0.045), (0.6, 0.066, 0.057), (0.88, 0.05, 0.045), (1, 0.028, 0.026)], 10, ohyb=(0, 0.008, 0))
    tahaj(lakt, zub, (-s * 0.052, 0.025, 0.11), (-s * 0.095, 0.045, 0.13), (-s * 0.097, 0.05, 0.17), 0.018, 0.002, 4, 6)
    kl = pivot('klepeto_' + m, (0, 0, 0.19), lakt)
    elipsoid(kl, svetle, (0, 0, -0.002), (0.045, 0.04, 0.035), 10, 7)
    # dlan: plocha a mohutna, vpredu vyssia
    rurka(kl, telo, [(0, 0, -0.015), (0, 0.002, 0.02), (0, 0.008, 0.07), (0, 0.008, 0.125), (0, 0.0, 0.17), (0, -0.01, 0.2), (0, -0.018, 0.215)],
          [(0.03, 0.03), (0.063, 0.057), (0.088, 0.088), (0.09, 0.098), (0.07, 0.083), (0.05, 0.055), (0.02, 0.02)], 16)
    for k, (x, z) in enumerate(((0.0, 0.05), (0.032, 0.09), (-0.032, 0.095), (0.0, 0.13), (0.04, 0.14), (-0.04, 0.045))):
        elipsoid(kl, svetle, (x, 0.097 - 14 * x * x - 3.5 * (z - 0.105) ** 2, z), (0.014, 0.01, 0.017), 8, 5)
    # pevny (spodny) prst: telo -> tmava spicka zahnuta hore
    cesta = krivka((0, -0.045, 0.15), (0, -0.095, 0.32), (0, -0.002, 0.425), 10)
    rr = [(0.045 - 0.041 * (i / 10) ** 1.2) for i in range(11)]
    rurka(kl, svetle, cesta[:8], [(r * 0.9, r) for r in rr[:8]], 10)
    rurka(kl, hrot, cesta[7:], [(r * 0.9, r) for r in rr[7:]], 10)
    for i in range(2, 8):
        p = Vector(cesta[i])
        v = 0.035 if i % 2 == 0 else 0.022
        tahaj(kl, zub, tuple(p + Vector((0, rr[i] * 0.6, 0))), tuple(p + Vector((0, rr[i] + v * 0.5, 0.004))),
              tuple(p + Vector((0, rr[i] + v, 0.012))), 0.013, 0.0015, 3, 5)
    prst = pivot('prst_' + m, (0, 0.03, 0.17), kl)
    elipsoid(prst, svetle, (0, 0.008, 0.005), (0.042, 0.045, 0.042), 10, 7)
    cesta = krivka((0, 0.012, 0.0), (0, 0.09, 0.15), (0, -0.04, 0.252), 10)
    rr = [(0.04 - 0.036 * (i / 10) ** 1.2) for i in range(11)]
    rurka(prst, svetle, cesta[:8], [(r * 0.85, r) for r in rr[:8]], 10)
    rurka(prst, hrot, cesta[7:], [(r * 0.85, r) for r in rr[7:]], 10)
    for i in range(3, 8):
        p = Vector(cesta[i])
        v = 0.03 if i % 2 else 0.019
        tahaj(prst, zub, tuple(p - Vector((0, rr[i] * 0.6, 0))), tuple(p - Vector((0, rr[i] + v * 0.5, -0.004))),
              tuple(p - Vector((0, rr[i] + v, -0.01))), 0.012, 0.0015, 3, 5)

# ---------- 8 noh: bedro (stehno) -> koleno (holen) -> clenok (spicata labka) ----------
for s, m in ((-1, 'P'), (1, 'L')):
    for i, z in enumerate((0.16, 0.06, -0.05, -0.15)):
        meno = m + str(i)
        bedro = pivot('bedro_' + meno, (s * 0.29, 0.24, z))
        elipsoid(bedro, svetle, (0, 0, 0), (0.042, 0.036, 0.036), 8, 6)
        clanok(bedro, telo, (0, 0, 0), (s * 0.212, 0, 0),
               [(0, 0.022, 0.022), (0.3, 0.031, 0.038), (0.65, 0.03, 0.037), (0.92, 0.021, 0.025), (1, 0.014, 0.016)], 7, ohyb=(0, 0.012, 0))
        koleno = pivot('koleno_' + meno, (s * 0.2, 0, 0), bedro)
        elipsoid(koleno, svetle, (0, 0, 0), (0.029, 0.029, 0.027), 8, 6)
        clanok(koleno, telo, (0, 0, 0), (s * 0.29, 0, 0),
               [(0, 0.018, 0.019), (0.25, 0.025, 0.031), (0.6, 0.021, 0.026), (0.9, 0.015, 0.017), (1, 0.011, 0.012)], 7, ohyb=(0, 0.014, 0))
        if i in (0, 2):
            tahaj(koleno, zub, (s * 0.075, 0.032, 0), (s * 0.095, 0.058, 0), (s * 0.125, 0.064, 0), 0.01, 0.0015, 3, 5)
        clenok = pivot('clenok_' + meno, (s * 0.28, 0, 0), koleno)
        elipsoid(clenok, svetle, (0, 0, 0), (0.02, 0.021, 0.019), 8, 6)
        tahaj(clenok, svetle, (0, 0, 0), (s * 0.08, 0.012, 0), (s * 0.12, -0.002, 0), 0.019, 0.01, 4, 7)
        tahaj(clenok, hrot, (s * 0.115, -0.001, 0), (s * 0.145, -0.008, 0), (s * 0.165, -0.028, 0), 0.011, 0.001, 4, 6)

# ---------- ozdoby obrovskeho kraba (pivot boss*, nocnemu krabovi ich hra zmaze) ----------
boss = pivot('boss', (0, 0, 0), trup)
rnd = random.Random(7)
# ostne na chrbte
for x, z, k in ((0, 0.09, 1.0), (0, -0.015, 1.25), (0, -0.125, 0.95), (-0.15, -0.04, 0.85), (0.15, -0.04, 0.85),
                (-0.23, 0.04, 0.6), (0.23, 0.04, 0.6)):
    y = horeY(x, z) - 0.012
    tahaj(boss, pancier, (x, y, z), (x * 1.04, y + 0.09 * k, z - 0.012), (x * 1.1, y + 0.14 * k, z - 0.07 * k), 0.036 * k, 0.002, 6, 8,
          ((0.8, 0.4, 0.0), (1, 0.5, 1)))
# mach: ploche zhluky machovych chumacov kopirujuce chrbat
for cx, cz, pocet, rad in ((-0.17, 0.11, 8, 0.065), (0.21, 0.09, 5, 0.05), (-0.08, -0.15, 9, 0.08), (0.13, -0.14, 7, 0.065),
                           (-0.27, -0.03, 4, 0.042)):
    for k in range(pocet):
        a, d = rnd.uniform(0, math.tau), rad * math.sqrt(rnd.random())
        x, z = cx + math.cos(a) * d, cz + math.sin(a) * d * 0.8
        r = rnd.uniform(0.022, 0.037) * (1.15 - d / rad * 0.5)
        elipsoid(boss, mach if k % 3 else mach2, (x, horeY(x, z), z), (r, r * 0.5, r), 6, 4, sum=0.22, seed=k + int(cx * 100))


def barnakel(x, y, z, k):                            # zrezany vulkancek s tmavou dierou
    kruhy = ((0.026, -0.008), (0.019, 0.018), (0.012, 0.03), (0.007, 0.022))
    n = 7
    V, F = [], []
    for r, h in kruhy:
        for i in range(n):
            a = i / n * math.tau
            zv = 1 + 0.18 * (i % 2)
            V.append((x + math.cos(a) * r * k * zv, y + h * k, z + math.sin(a) * r * k * zv))
    for j in range(len(kruhy) - 1):
        F += [[j * n + i, j * n + (i + 1) % n, (j + 1) * n + (i + 1) % n, (j + 1) * n + i] for i in range(n)]
    pridaj(boss, vapno, V, F)
    elipsoid(boss, diera, (x, y + 0.022 * k, z), (0.008 * k, 0.003 * k, 0.008 * k), 7, 4)


for x, z, k in ((0.1, -0.04, 1.2), (0.135, -0.015, 0.85), (0.075, -0.015, 0.7), (0.12, -0.065, 0.65), (-0.235, 0.065, 1.1),
                (-0.2, 0.045, 0.8), (-0.255, 0.04, 0.65), (-0.21, 0.09, 0.6), (0.27, -0.02, 0.9), (0.25, -0.045, 0.6),
                (-0.05, 0.155, 0.7)):
    barnakel(x, horeY(x, z), z, k)
# kamene zarastene v panciery
elipsoid(boss, kamen, (0.065, horeY(0.065, -0.075) + 0.02, -0.075), (0.055, 0.04, 0.05), 7, 5, sum=0.2, seed=3)
elipsoid(boss, kamen, (-0.13, horeY(0.13, -0.09) + 0.012, -0.09), (0.04, 0.03, 0.035), 7, 5, sum=0.2, seed=9)
# jazvy: tri svetle skrabance
for body in (((0.07, 0.155), (0.13, 0.11), (0.17, 0.045)), ((0.11, 0.17), (0.165, 0.125), (0.21, 0.065)),
             ((-0.07, 0.04), (-0.12, 0.0), (-0.15, -0.055))):
    cesta = krivka((body[0][0], 0, body[0][1]), (body[1][0], 0, body[1][1]), (body[2][0], 0, body[2][1]), 10)
    rurka(boss, jazva, [(x, horeY(x, z) + 0.002, z) for x, _, z in cesta],
          [0.0012 + 0.0055 * math.sin(math.pi * i / 10) for i in range(11)], 5)
# ostne na klepetach
for s, m in ((-1, 'P'), (1, 'L')):
    b = pivot('boss_' + m, (0, 0, 0), bpy.data.objects['klepeto_' + m])
    for x, z, k in ((-0.05, 0.05, 0.9), (0.0, 0.085, 1.15), (0.05, 0.11, 0.9), (-0.035, 0.14, 0.75), (s * 0.07, 0.05, 0.75)):
        y = 0.085 - 8 * x * x
        tahaj(b, zub, (x, y - 0.008, z), (x * 1.25, y + 0.05 * k, z + 0.008), (x * 1.4, y + 0.075 * k, z + 0.04), 0.022 * k, 0.002, 4, 7)

zostav()
export('krab')
