# Postava hraca (mlady prieskumnik ostrovov) -> modely/moby/postava.glb
# Pivoty maju rovnake polohy ako klby v src/postava.js (animacia ostava v hrac.js). Postava pozera na -Z.
#   telo > chrbat > hlava;  telo > stehno_L/P > koleno_L/P;  chrbat > rameno_L/P > laket_L/P > drziak_L/P   (L = -x, P = +x)
# Materialy: tu su len mena (a priblizne farby) - src/postava.js ich podla mena nahradi vlastnymi (sheen koze, vzor sukne).
# Rozmery trupu, sukne, noh a hlavy drz podla povodnych - sedi na ne brnenie z src/modely_vystroja.js.
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mob import *

TAU = math.tau
zacni()
FARBY = {'koza': 0xa86a45, 'koza_t': 0x92583a, 'ruz': 0xb26457, 'usta': 0x8f4038, 'triko': 0xe04a2a, 'zlta': 0xf4c04a,
         'lem': 0xf3e6c8, 'zelen': 0x3f8f4a, 'opasok': 0x5a3a22, 'spona': 0xd8c070, 'vlasy': 0x2a1a10, 'vlasy_s': 0x3b2616,
         'vlasy_h': 0x5b3b22, 'bielko': 0xf6f0e6, 'duhovka': 0x7a4a1c, 'oci': 0x0d0a08, 'obocie': 0x1d140c,
         'sandal': 0x6b4a2c, 'remien': 0xe3c27a, 'sukna': 0xb8381f}
MT = {k: material(k, v) for k, v in FARBY.items()}
MT['tetovanie'] = material('tetovanie', 0x0c4a46, 0.35, ziara=0x2ef5dc, sila=1.5)


# ---------- pomocne tvary ----------
def mriezka(mat, rodic, riadky, zavri=True, konce=(True, True), uv=None):
    """Plocha z kruhov bodov (suradnice hry, lokalne k pivotu). zavri = kruh uzavrety; konce = zaslepit prvy/posledny."""
    bm = bmesh.new()
    V = [[bm.verts.new(G(*p)) for p in r] for r in riadky]
    n = len(riadky[0])
    steny = []
    for j in range(len(V) - 1):
        for i in range(n if zavri else n - 1):
            k = (i + 1) % n
            f = bm.faces.new((V[j][i], V[j][k], V[j + 1][k], V[j + 1][i]))
            steny.append((f, i, j))
    for kruh, ano in ((V[0], konce[0]), (V[-1], konce[1])):
        if ano and zavri:
            c = bm.verts.new(sum((v.co for v in kruh), Vector()) / n)
            for i in range(n):
                bm.faces.new((kruh[i], kruh[(i + 1) % n], c))
    if uv:
        vrstva = bm.loops.layers.uv.new('UVMap')
        for f, i, j in steny:
            for loop, (di, dj) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
                loop[vrstva].uv = uv(i + di, j + dj)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(mat)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(mat, me)
    bpy.context.collection.objects.link(o)
    me.materials.append(MT[mat])
    o.parent = rodic
    return o


def cr(body, na):
    """Catmull-Rom: zahusti zoznam n-tic (kazdy usek na `na` casti)."""
    P = [body[0]] + list(body) + [body[-1]]
    von = []
    for i in range(1, len(P) - 2):
        a, b, c, d = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(na):
            t = k / na
            von.append(tuple(0.5 * (2 * b[m] + (c[m] - a[m]) * t + (2 * a[m] - 5 * b[m] + 4 * c[m] - d[m]) * t * t +
                                    (3 * b[m] - a[m] - 3 * c[m] + d[m]) * t * t * t) for m in range(len(b))))
    von.append(tuple(body[-1]))
    return von


def rura(mat, rodic, body, K=8, na=3, konce=(True, True)):
    """Hladka rurka cez body (x, y, z, polomer)."""
    na = min(na, 2)
    Q = cr(body, na) if na > 1 else body
    riadky, n1 = [], None
    for i, q in enumerate(Q):
        t = (Vector(Q[min(i + 1, len(Q) - 1)][:3]) - Vector(Q[max(i - 1, 0)][:3])).normalized()
        if n1 is None:
            n1 = t.orthogonal().normalized()
        n1 = (n1 - t * n1.dot(t)).normalized()            # prenasany ram = rurka sa neskruti
        n2 = t.cross(n1)
        p, r = Vector(q[:3]), max(q[3], 0.0004)
        riadky.append([tuple(p + (n1 * math.cos(j / K * TAU) + n2 * math.sin(j / K * TAU)) * r) for j in range(K)])
    return mriezka(mat, rodic, riadky, konce=konce)


def loft(mat, rodic, prierezy, K=20, na=3, konce=(True, True)):
    """Teleso zo zvislych prierezov (y, rx, rz, cx, cz)."""
    riadky = [[(cx + rx * math.sin(j / K * TAU), y, cz - rz * math.cos(j / K * TAU)) for j in range(K)]
              for y, rx, rz, cx, cz in (cr(prierezy, na) if na > 1 else prierezy)]
    return mriezka(mat, rodic, riadky, konce=konce)


def gula(mat, rodic, poz, rozmer, segm=10, rot=(0, 0, 0)):
    return diel('gula', MT[mat], rodic, poz, rozmer, rot, segm=max(7, int(segm * 0.8)))


def prstenec(mat, rodic, y, rx, rz, r, N=28, K=4, cz=0.0, vlna=0.0):
    N = max(10, int(N * 0.8))
    riadky = []
    for i in range(N):
        a = i / N * TAU
        yy = y + vlna * math.sin(a * 9)
        riadky.append([((rx + r * math.cos(j / K * TAU)) * math.sin(a), yy + r * math.sin(j / K * TAU),
                        cz - (rz + r * math.cos(j / K * TAU)) * math.cos(a)) for j in range(K)])
    riadky.append(riadky[0])
    return mriezka(mat, rodic, riadky, konce=(False, False))


# ---------- kostra ----------
telo = pivot('telo', (0, 0.95, 0))
chrbat = pivot('chrbat', (0, 0.08, 0), telo)
hlava = pivot('hlava', (0, 0.58, 0), chrbat)      # mierku 1.25 nastavuje JS


# ---------- nohy ----------
def noha(s, st):
    stehno = pivot('stehno_' + st, (0.1 * s, -0.02, 0), telo)
    rura('koza', stehno, [(0, 0.015, 0, 0.05), (0, -0.03, 0, 0.082), (0, -0.14, -0.003, 0.083), (0, -0.27, -0.005, 0.072),
                          (0, -0.38, -0.002, 0.060), (0, -0.46, 0, 0.060)], K=10, na=2)
    koleno = pivot('koleno_' + st, (0, -0.46, 0), stehno)
    gula('koza', koleno, (0, 0, 0), (0.118, 0.118, 0.118), 12)
    gula('koza', koleno, (0, -0.006, -0.027), (0.052, 0.066, 0.058), 8)                      # jablcko (len jemne vystupuje)
    rura('koza', koleno, [(0, 0, 0, 0.060), (0, -0.07, 0.006, 0.060), (0, -0.14, 0.011, 0.064), (0, -0.22, 0.008, 0.055),
                          (0, -0.31, 0.003, 0.041), (0, -0.39, 0.003, 0.035), (0, -0.43, 0.004, 0.040)], K=10, na=2)
    # chodidlo: pata -> priehlavok -> brusko
    zy = [(-0.443, 0.020, 0.018, 0.058), (-0.446, 0.040, 0.034, 0.030), (-0.446, 0.043, 0.036, -0.020),
          (-0.451, 0.046, 0.030, -0.080), (-0.458, 0.052, 0.022, -0.130), (-0.461, 0.048, 0.016, -0.155)]
    riadky = [[(rx * math.sin(j / 12 * TAU), y + ry * math.cos(j / 12 * TAU), z) for j in range(12)]
              for y, rx, ry, z in cr(zy, 2)]
    mriezka('koza', koleno, riadky)
    rura('koza', koleno, [(0, -0.40, 0.006, 0.036), (0, -0.432, -0.008, 0.037), (0, -0.450, -0.05, 0.028)], K=10, na=2)
    # prsty: palec na vnutornej strane
    for i in range(5):
        x = s * (-0.034 + i * 0.0175)
        r = 0.0135 if i == 0 else 0.0102 - i * 0.0006
        dlz = [0.030, 0.027, 0.023, 0.019, 0.014][i]
        rura('koza', koleno, [(x * 0.9, -0.462, -0.140, r), (x, -0.463, -0.158 - dlz * 0.4, r),
                              (x * 1.04, -0.466, -0.158 - dlz, r * 0.82)], K=5, na=1)
    # sandal: tvarovana podrazka + remienky
    obrys = [(0.0, 0.080), (0.040, 0.068), (0.052, 0.030), (0.047, -0.030), (0.060, -0.110), (0.062, -0.170),
             (0.040, -0.202), (0.0, -0.210), (-0.040, -0.202), (-0.062, -0.170), (-0.060, -0.110), (-0.047, -0.030),
             (-0.052, 0.030), (-0.040, 0.068)]
    mriezka('sandal', koleno, [[(x * k, y, z - (1 - k) * 0.03) for x, z in obrys]
                               for y, k in ((-0.482, 0.94), (-0.477, 1.0), (-0.466, 1.0), (-0.463, 0.95))])
    for z, ry, w in ((-0.122, 0.028, 0.056), (-0.050, 0.046, 0.047)):                     # remienky cez priehlavok
        y0 = -0.466
        rura('remien', koleno, [(w * math.cos(math.pi * k / 8), y0 + (ry + 0.006) * math.sin(math.pi * k / 8), z, 0.0085)
                                for k in range(9)], K=5, na=1)
    prstenec('remien', koleno, -0.385, 0.038, 0.038, 0.009, N=16, cz=0.004)              # remienok na clenku
    for x in (-0.041, 0.041):
        rura('remien', koleno, [(x * 0.9, -0.385, 0.004, 0.006), (x * 1.05, -0.43, 0.028, 0.006), (x * 1.1, -0.467, 0.022, 0.006)], K=5, na=2)


# ---------- ruky ----------
def ruka(s, st):
    rameno = pivot('rameno_' + st, (0.23 * s, 0.42, 0), chrbat)
    rura('koza', rameno, [(0, 0.0, 0, 0.040), (0, -0.07, 0, 0.056), (0, -0.14, -0.003, 0.055), (0, -0.22, -0.002, 0.047),
                          (0, -0.30, 0, 0.045)], K=10, na=2)
    # rukav: klenute plece plynulo do kratkeho rukava
    loft('triko', rameno, [(0.066, 0.012, 0.012, -0.030 * s, 0), (0.054, 0.046, 0.048, -0.020 * s, 0), (0.025, 0.068, 0.069, -0.006 * s, 0),
                           (-0.03, 0.068, 0.067, 0, 0), (-0.09, 0.063, 0.063, 0, 0), (-0.155, 0.069, 0.069, 0, 0)],
         K=16, na=2, konce=(True, False))
    prstenec('zlta', rameno, -0.155, 0.069, 0.069, 0.0075, N=18)
    laket = pivot('laket_' + st, (0, -0.3, 0), rameno)
    gula('koza', laket, (0, 0, 0), (0.0885, 0.0885, 0.0885), 12)
    rura('koza', laket, [(0, 0, 0, 0.045), (0, -0.06, -0.002, 0.050), (0, -0.13, -0.002, 0.043), (0, -0.21, 0, 0.031),
                         (0, -0.262, 0, 0.026), (0, -0.285, -0.001, 0.027)], K=10, na=2)
    # dlan: plocha v osi x (dlanou k telu), prsty sa obtocia okolo drzadla nastroja (drzadlo ide pozdlz z cez y=-0.31)
    loft('koza', laket, [(-0.262, 0.018, 0.026, 0, 0), (-0.285, 0.021, 0.037, 0.010 * s, -0.004),
                         (-0.305, 0.020, 0.045, 0.022 * s, -0.006), (-0.326, 0.015, 0.045, 0.025 * s, -0.006),
                         (-0.338, 0.008, 0.040, 0.022 * s, -0.006)], K=10, na=2)
    for i, (z, dl, r) in enumerate(((-0.039, 0.94, 0.0115), (-0.017, 1.05, 0.012), (0.005, 1.0, 0.0115), (0.026, 0.82, 0.0102))):
        rura('koza', laket, [(0.024 * s, -0.320, z, r * 1.08), (0.021 * s, -0.320 - 0.028 * dl, z, r),
                             (0.004 * s, -0.322 - 0.036 * dl, z, r * 0.95), (-0.015 * s * dl, -0.320 - 0.028 * dl, z, r * 0.9),
                             (-0.021 * s * dl, -0.320 - 0.016 * dl, z, r * 0.78)], K=6, na=1)
    rura('koza', laket, [(0.006 * s, -0.272, -0.022, 0.0175), (-0.008 * s, -0.292, -0.046, 0.0140),
                         (-0.022 * s, -0.311, -0.054, 0.0122), (-0.029 * s, -0.330, -0.052, 0.0095)], K=7, na=2)   # palec
    # naramok na zapasti + teal tetovanie na predlakti
    prstenec('opasok', laket, -0.238, 0.0295, 0.0295, 0.0062, N=16)
    prstenec('lem', laket, -0.252, 0.027, 0.027, 0.0038, N=16)
    for y, r in ((-0.168, 0.0368), (-0.188, 0.0335)):
        rura('tetovanie', laket, [(r * math.sin(a), y + 0.007 * math.sin(a * 3), -r * math.cos(a) - 0.001, 0.0026)
                                  for a in [-1.25 + 2.5 * k / 12 for k in range(13)]], K=4, na=1)
    for y, r in ((-0.211, 0.0315), (-0.150, 0.0402)):
        gula('tetovanie', laket, (0, y, -r - 0.001), (0.011, 0.013, 0.006), 8)
    pivot('drziak_' + st, (0, -0.31, -0.02), laket)


for s, st in ((-1, 'L'), (1, 'P')):
    noha(s, st)
    ruka(s, st)

# ---------- trup (profil rovnaky ako PROF_T v modely_vystroja.js) ----------
SX, SZ = 1.3, 0.78
PROF = [(0.0, 0.148), (0.1, 0.143), (0.18, 0.139), (0.30, 0.157), (0.38, 0.177), (0.438, 0.170), (0.475, 0.138),
        (0.500, 0.095), (0.512, 0.055)]


def r_trupu(y):
    for (y0, r0), (y1, r1) in zip(PROF, PROF[1:]):
        if y <= y1:
            return r0 + (r1 - r0) * max(0, y - y0) / (y1 - y0)
    return PROF[-1][1]


def na_trupe(x, y, d=0.004):                         # bod na prednej strane tricka
    r = r_trupu(y) + d
    return (x, y, -SZ * math.sqrt(max(0.0, r * r - (x / SX) ** 2)))


loft('triko', chrbat, [(y, r * SX, r * SZ, 0, 0) for y, r in PROF], K=22, na=2, konce=(True, True))
prstenec('zlta', chrbat, 0.012, 0.149 * SX, 0.149 * SZ, 0.008, N=36)
# krk + golier + V vystrih so zlatym lemom
rura('koza', chrbat, [(0, 0.465, 0.004, 0.072), (0, 0.505, 0.004, 0.056), (0, 0.55, 0.004, 0.049), (0, 0.61, 0.002, 0.051),
                      (0, 0.65, 0.0, 0.054)], K=14, na=2)
prstenec('zlta', chrbat, 0.503, 0.068, 0.058, 0.010, N=24)
VYS = [(-0.058, 0.500), (-0.036, 0.462), (-0.016, 0.430), (0.0, 0.412), (0.016, 0.430), (0.036, 0.462), (0.058, 0.500)]
mriezka('koza', chrbat, [[na_trupe(x * k, 0.501 - (0.501 - y) * 1.0, 0.0025) for x, y in VYS] for k in (1.0, 0.66, 0.33, 0.02)],
        zavri=False)
rura('zlta', chrbat, [(*na_trupe(x, y, 0.004), 0.0072) for x, y in VYS], K=6, na=3)
for y in (0.375, 0.315, 0.255):                                                  # gombiky
    gula('zlta', chrbat, na_trupe(0, y, 0.003), (0.019, 0.019, 0.009), 8)
for x in (-0.011, 0.011):                                                        # snurka pri vystrihu
    rura('lem', chrbat, [(*na_trupe(0, 0.412, 0.008), 0.003), (*na_trupe(x, 0.385, 0.01), 0.003),
                         (*na_trupe(x * 1.7, 0.352, 0.01), 0.0045)], K=5, na=3)
for strana in (-1, 1):                                                           # svy na bokoch
    rura('zlta', chrbat, [(strana * (r_trupu(y) * SX + 0.0008), y, 0.0, 0.0028) for y in (0.02, 0.1, 0.18, 0.26, 0.31)], K=4, na=2)
# nahrdelnik: snurka, muslicky, listky, teal privesok
nah = []
for i in range(11):
    t = i / 10
    x, y = (t - 0.5) * 0.22, 0.497 - 0.115 * (1 - (2 * t - 1) ** 2)
    nah.append(na_trupe(x, y, 0.012))
rura('opasok', chrbat, [(*p, 0.0028) for p in nah], K=4, na=3)
for i, (x, y, z) in enumerate(nah):
    if i == 5:
        gula('tetovanie', chrbat, (x, y - 0.022, z - 0.005), (0.036, 0.044, 0.018), 10)
        prstenec('spona', chrbat, y - 0.001, 0.007, 0.007, 0.0035, N=10, cz=z - 0.003)
    elif i % 2:
        gula('lem', chrbat, (x, y, z), (0.022, 0.019, 0.012), 8)
    elif 0 < i < 10:
        rura('zelen', chrbat, [(x, y, z, 0.002), (x * 1.04, y - 0.018, z - 0.004, 0.0095), (x * 1.09, y - 0.042, z - 0.003, 0.0008)],
             K=5, na=3)

# ---------- boky, sukna, opasok ----------
loft('triko', telo, [(0.10, 0.185, 0.108, 0, 0), (0.02, 0.188, 0.112, 0, 0), (-0.05, 0.180, 0.106, 0, 0),
                     (-0.095, 0.115, 0.075, 0, 0), (-0.11, 0.04, 0.04, 0, 0)], K=18, na=2)
NS, VR = 48, 3
riadky = []
for j in range(VR + 1):
    v = j / VR
    y, r = 0.078 - 0.255 * v, 0.151 + 0.076 * v ** 0.9
    riadky.append([((r + 0.006 * v * math.sin(i / NS * TAU * 12)) * 1.28 * math.sin(i / NS * TAU),
                    y - 0.004 * v * math.cos(i / NS * TAU * 12),
                    -(r + 0.006 * v * math.sin(i / NS * TAU * 12)) * 0.84 * math.cos(i / NS * TAU)) for i in range(NS + 1)])
mriezka('sukna', telo, riadky, zavri=False, uv=lambda i, j: (i / NS, 1 - j / VR))


def lem_sukne(mat, y, r, hr, amp):                    # lem kopirujuci zahyby
    body = []
    for i in range(49):
        a = i / 48 * TAU
        rr = r + amp * math.sin(a * 12)
        body.append((rr * 1.28 * math.sin(a), y - (amp * 0.66) * math.cos(a * 12), -rr * 0.84 * math.cos(a), hr))
    rura(mat, telo, body, K=4, na=1, konce=(False, False))


lem_sukne('zlta', -0.177, 0.228, 0.0095, 0.006)
prstenec('opasok', telo, 0.074, 0.153 * 1.28, 0.153 * 0.84, 0.0145, N=36)
# spona + visiaci koniec opaska + mala kapsicka na boku
diel('kocka', MT['spona'], telo, (0, 0.074, -0.142), (0.052, 0.042, 0.014), hrana=0.18)
diel('kocka', MT['opasok'], telo, (0, 0.074, -0.150), (0.026, 0.018, 0.006))
for x, dl in ((0.042, 0.13), (0.066, 0.095)):
    rura('opasok', telo, [(x, 0.070, -0.139, 0.008), (x * 1.15, 0.01, -0.160, 0.0085), (x * 1.28, 0.07 - dl, -0.184, 0.007)], K=5, na=3)
    gula('lem', telo, (x * 1.28, 0.062 - dl, -0.185), (0.019, 0.026, 0.017), 8)
diel('kocka', MT['sandal'], telo, (-0.150, 0.015, -0.108), (0.075, 0.085, 0.04), (0, 0.72, 0.06), hrana=0.2)
diel('kocka', MT['opasok'], telo, (-0.152, 0.048, -0.112), (0.082, 0.032, 0.046), (0, 0.72, 0.06), hrana=0.2)
gula('spona', telo, (-0.168, 0.036, -0.128), (0.014, 0.014, 0.012), 8)


# ---------- hlava ----------
def hladko(a, b, x):
    t = min(1, max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def hrb(dx, dy, sx, sy):
    return math.exp(-(dx / sx) ** 2 - (dy / sy) ** 2)


def bod_hlavy(th, a):
    """Povrch hlavy: th 0 = vrch .. pi = spodok, a = uhol (0 = tvar, -z)."""
    nx, ny, nz = math.sin(th) * math.sin(a), math.cos(th), -math.sin(th) * math.cos(a)
    x, y, z = nx * 0.1165, 0.11 + ny * 0.133, nz * 0.124
    dole = hladko(0.10, -0.01, y)                     # dolna cast: uzsia celust, brada dopredu
    x *= 1 - 0.27 * dole
    if z < 0:
        z *= 1 - 0.05 * hladko(0.12, 0.02, y)
        pred = hladko(0.0, -0.07, z)
        z -= pred * 0.018 * hrb(x, y - 0.012, 0.045, 0.028)             # brada
        for s in (-1, 1):
            z += pred * 0.0135 * hrb(x - s * 0.047, y - 0.122, 0.030, 0.023)   # ocne jamky
            z -= pred * 0.006 * hrb(x - s * 0.062, y - 0.082, 0.030, 0.026)    # licne kosti
        z -= pred * 0.004 * hrb(x, y - 0.158, 0.08, 0.018)              # nadocnicovy oblyk
    else:
        z *= 1 - 0.28 * dole                          # zatylok sa dole zuzuje do krku
        y += 0.022 * dole * hladko(0.0, 0.08, z)
    return (x, y, z)


def tvar_z(x, y):                                     # hlbka tvare (z) v bode (x, y) - na ktorom lezia usta, obocie...
    lo, hi = 0.02, math.pi - 0.02
    for _ in range(30):
        th = (lo + hi) / 2
        a0, a1 = 0.0, math.pi / 2
        for _ in range(24):
            a = (a0 + a1) / 2
            if bod_hlavy(th, a)[0] < abs(x):
                a0 = a
            else:
                a1 = a
        p = bod_hlavy(th, a0)
        if p[1] > y:
            lo = th
        else:
            hi = th
    return p[2]


def na_tvari(x, y, d=0.0):
    return (x, y, tvar_z(x, y) - d)


NT, NA = 20, 28
mriezka('koza', hlava, [[bod_hlavy(0.04 + (math.pi - 0.08) * j / NT, i / NA * TAU) for i in range(NA)] for j in range(NT + 1)])

for s in (-1, 1):
    x, y = 0.046 * s, 0.121
    z = tvar_z(x, y)
    zo = z + 0.006                                    # stred ocnej gule
    gula('bielko', hlava, (x, y, zo), (0.050, 0.042, 0.026), 14)
    gula('duhovka', hlava, (x - 0.002 * s, y - 0.001, zo - 0.0115), (0.027, 0.029, 0.009), 14)
    gula('oci', hlava, (x - 0.002 * s, y - 0.001, zo - 0.0148), (0.0135, 0.0145, 0.005), 10)
    gula('bielko', hlava, (x - 0.002 * s + 0.0065, y + 0.0075, zo - 0.0165), (0.0072, 0.0072, 0.004), 8)
    # vieka: horne s tmavou linkou rias, dolne jemne
    horne = [(x + s * dx, y + dy, zo + dz) for dx, dy, dz in
             ((-0.026, -0.001, -0.004), (-0.014, 0.0150, -0.013), (0.001, 0.0190, -0.0145), (0.016, 0.0160, -0.012), (0.028, 0.004, -0.002))]
    rura('koza', hlava, [(px, py + 0.0042, pz + 0.002, r) for (px, py, pz), r in zip(horne, (0.003, 0.0058, 0.0065, 0.0058, 0.003))], K=6, na=3)
    rura('obocie', hlava, [(px, py, pz - 0.0012, r) for (px, py, pz), r in zip(horne, (0.0014, 0.0031, 0.0036, 0.0036, 0.001))], K=5, na=3)
    rura('koza_t', hlava, [(x + s * dx, y + dy, zo + dz, r) for dx, dy, dz, r in
                           ((-0.023, -0.003, -0.005, 0.002), (-0.008, -0.0175, -0.0115, 0.0032), (0.010, -0.018, -0.0115, 0.0032),
                            (0.025, -0.003, -0.004, 0.002))], K=5, na=3)
    # obocie
    rura('obocie', hlava, [(*na_tvari(s * bx, by, 0.004), r) for bx, by, r in
                           ((0.016, 0.157, 0.0045), (0.036, 0.1665, 0.0060), (0.058, 0.1675, 0.0048), (0.076, 0.159, 0.0014))], K=6, na=3)
    # licko
    z_l = tvar_z(0.064, 0.080)
    gula('ruz', hlava, (0.064 * s, 0.080, z_l + 0.0052), (0.034, 0.021, 0.012), 10, (0, -0.55 * s, 0))
    # ucho: lem + vnutro + nausnica
    rura('koza', hlava, [(s * ex, ey, ez, r) for ex, ey, ez, r in
                         ((0.108, 0.088, -0.004, 0.007), (0.122, 0.118, -0.008, 0.008), (0.130, 0.137, 0.006, 0.008),
                          (0.128, 0.126, 0.024, 0.0078), (0.121, 0.100, 0.021, 0.0075), (0.112, 0.080, 0.006, 0.0095))], K=6, na=2)
    gula('koza_t', hlava, (0.115 * s, 0.108, 0.007), (0.017, 0.042, 0.027), 10)
    gula('spona' if s > 0 else 'tetovanie', hlava, (0.117 * s, 0.070, 0.006), (0.014, 0.017, 0.014), 8)
    # teal tetovanie: dva obluciky a bodka na licnej kosti
    for dy, k in ((0.0, 1.0), (-0.014, 0.72)):
        rura('tetovanie', hlava, [(*na_tvari(s * (0.070 + k * bx), 0.092 + dy + by, 0.0018), r) for bx, by, r in
                                  ((0.0, -0.002, 0.001), (0.011, -0.001, 0.0027), (0.022, 0.008, 0.001))], K=4, na=3)
    gula('tetovanie', hlava, na_tvari(s * 0.083, 0.062, 0.001), (0.0085, 0.0085, 0.005), 8)

# nos: chrbat nosa, spicka a nozdry
rura('koza', hlava, [(0, 0.138, tvar_z(0, 0.138) + 0.004, 0.0065), (0, 0.112, tvar_z(0, 0.112) - 0.004, 0.0082),
                     (0, 0.092, tvar_z(0, 0.092) - 0.013, 0.0105)], K=9, na=3)
gula('koza', hlava, (0, 0.089, tvar_z(0, 0.089) - 0.011), (0.027, 0.022, 0.023), 12)
for s in (-1, 1):
    gula('koza', hlava, (0.012 * s, 0.086, tvar_z(0.012, 0.086) - 0.004), (0.018, 0.015, 0.016), 9)
# usta: jemny usmev
for mat, body in (('usta', ((-0.030, 0.0585, 0.0012), (-0.012, 0.0560, 0.0042), (0.0, 0.0548, 0.0036), (0.012, 0.0560, 0.0042), (0.030, 0.0585, 0.0012))),
                  ('usta', ((-0.027, 0.0562, 0.0012), (-0.012, 0.0480, 0.0048), (0.0, 0.0470, 0.0055), (0.012, 0.0480, 0.0048), (0.027, 0.0562, 0.0012))),
                  ('obocie', ((-0.032, 0.0600, 0.0008), (-0.014, 0.0524, 0.0016), (0.014, 0.0524, 0.0016), (0.032, 0.0600, 0.0008)))):
    d = 0.0045 if mat == 'obocie' else 0.0012
    rura(mat, hlava, [(*na_tvari(x, y, d), r) for x, y, r in body], K=6, na=3)

# ---------- vlasy: zaklad (ciapka) + kucery ako zatocene pramene + ofina ----------
HC = Vector((0, 0.128, 0.022))


def hranica(a):                                       # ako nizko siaha ciapka (th) v smere a (0 = tvar)
    a = abs(math.atan2(math.sin(a), math.cos(a)))
    if a < 1.0:
        return 0.88 + 0.12 * (a / 1.0) ** 2
    if a < 1.75:
        return 1.00 + (a - 1.0) / 0.75 * 0.56
    return 1.56 + min(1, (a - 1.75) / 0.8) * 0.72


def na_vlasoch(th, a, R=1.0):
    return HC + Vector((0.134 * math.sin(th) * math.sin(a), 0.147 * math.cos(th), -0.139 * math.sin(th) * math.cos(a))) * R


NT, NA = 10, 24
mriezka('vlasy', hlava, [[tuple(na_vlasoch(0.03 + (hranica(i / NA * TAU) - 0.03) * j / NT, i / NA * TAU,
                                           1.0 if j < NT else 0.9)) for i in range(NA)] for j in range(NT + 1)], konce=(True, False))

rnd = random.Random(7)


def kucera(mat, p, smer, dlzka, r, vinutie, K=5, N=7):
    """Zatoceny pramen: zacina v p, tecie v smere `smer` a na konci sa stoči do slucky."""
    von = (p - HC).normalized()
    t = (smer - von * smer.dot(von)).normalized()
    bok = von.cross(t)
    body, q = [], p.copy()
    for k in range(N):
        u = k / (N - 1)
        uh = vinutie * u * u * 3.6
        krok = t * math.cos(uh) + bok * math.sin(uh)
        if k:
            q += krok * (dlzka / (N - 1))
        zdvih = von * (r * 0.9 * math.sin(u * math.pi * 0.85))
        body.append((*(q + zdvih), r * (0.55 + 0.75 * math.sin(math.pi * (0.12 + 0.76 * u))) * (1 - 0.75 * u ** 3)))
    rura(mat, hlava, body, K=K, na=1)


# hlavne kucery po povrchu (rovnomerne - zlaty uhol)
N = 60
for i in range(N):
    a = i * 2.39996 % TAU
    th = math.acos(1 - ((i + 0.5) / N) * (1 - math.cos(2.2)))
    if th > hranica(a) - 0.10:
        continue
    p = na_vlasoch(th, a, 1.045 + rnd.uniform(-0.01, 0.045))
    dole = Vector((math.sin(a) * 0.4, -1.0, -math.cos(a) * 0.4 + 0.5))
    dole.x += rnd.uniform(-0.7, 0.7)
    dole.z += rnd.uniform(-0.4, 0.4)
    mat = 'vlasy_h' if i % 11 == 4 else ('vlasy_s' if i % 3 == 0 else 'vlasy')
    kucera(mat, p, dole, rnd.uniform(0.085, 0.125), rnd.uniform(0.0215, 0.027), rnd.choice((-1, 1)) * rnd.uniform(0.8, 1.15))
# spodny okraj vzadu a po bokoch
for i in range(17):
    a = 1.35 + (TAU - 2.7) * i / 16
    th = hranica(a) - 0.14
    p = na_vlasoch(th, a, 1.07)
    kucera('vlasy_s' if i % 2 else 'vlasy', p, Vector((rnd.uniform(-0.3, 0.3), -1, 0.15)), rnd.uniform(0.09, 0.12), 0.022, (-1) ** i)
# ofina: pramene nad celom prehodene nabok
for i, (a, th, dx) in enumerate(((-0.75, 0.72, -1.0), (-0.42, 0.66, -1.0), (-0.10, 0.62, 0.9), (0.20, 0.60, 1.0),
                                  (0.50, 0.66, 1.0), (0.80, 0.76, 0.6), (0.05, 0.42, 1.0), (-0.5, 0.40, -0.8))):
    p = na_vlasoch(th, a, 1.055)
    kucera('vlasy_h' if i in (3, 6) else ('vlasy_s' if i % 2 else 'vlasy'), p, Vector((dx, -0.42, -0.25)),
           0.092 if th > 0.5 else 0.11, 0.0205, 0.75 if dx > 0 else -0.75)
# bocne pramienky pred usami
for s in (-1, 1):
    rura('vlasy', hlava, [(0.110 * s, 0.185, -0.045, 0.016), (0.122 * s, 0.145, -0.040, 0.013), (0.118 * s, 0.108, -0.043, 0.008),
                          (0.109 * s, 0.086, -0.052, 0.001)], K=5, na=3)


# ---------- zlucit diely s rovnakym pivotom a materialom (menej draw callov) ----------
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.modifiers]:
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear()
    o.data = me
skupiny = {}
for o in bpy.data.objects:
    if o.type == 'MESH':
        for p in o.data.polygons:
            p.use_smooth = o.data.materials[0].name not in ('spona',)
        skupiny.setdefault((o.parent.name, o.data.materials[0].name), []).append(o)
for (rodic, mat), objekty in skupiny.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objekty:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objekty[0]
    if len(objekty) > 1:
        bpy.ops.object.join()
    objekty[0].name = f'{rodic}__{mat}'

export('postava')
