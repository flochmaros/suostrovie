# Pomocky pre bossov-jasterov (moby_lavovy_obr.py, moby_krokodil.py), doplnok k mob.py.
# Vsetko v suradniciach HRY (x doprava, y hore, z dopredu), vrcholy su LOKALNE voci pivotu.
# Diely sa nazbieraju do kopiek podla (pivot, material) a na konci z kazdej kopky vznikne jedna siet
# -> stovky supin = par vykreslovacich volani v hre.
import math, random
import bpy, bmesh
from mathutils import Vector
from mob import G

KOPY = {}


def pridaj(pivot, mat, vrcholy, plochy, hladke=False):
    k = KOPY.setdefault((pivot.name, mat.name), {'p': pivot, 'm': mat, 'v': [], 'f': [], 's': []})
    n = len(k['v'])
    k['v'] += [Vector(v) for v in vrcholy]
    for f in plochy:
        k['f'].append([i + n for i in f])
        k['s'].append(hladke)


def hotovo():
    """Z kopiek vyrobi siete (jedna na pivot + material) a opravi smer normal."""
    for (p, m), k in KOPY.items():
        me = bpy.data.meshes.new(p + '_' + m)
        me.from_pydata([G(*v) for v in k['v']], [], k['f'])
        me.materials.append(k['m'])
        for poly, s in zip(me.polygons, k['s']):
            poly.use_smooth = s
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new(p + '_' + m, me)
        bpy.context.collection.objects.link(o)
        o.parent = k['p']


def _catmull(a, b, c, d, t):
    return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t ** 3)


class Telo:
    """Plynula cast tela z prierezov (z, stred_y, polsirka, vyska_hore, vyska_dole), z musi rast.
    Uhol a: 0 = vrch, +pi/2 = bok +x, pi = spodok. mocnina > 2 = hranatejsi prierez."""

    def __init__(self, rezy, mocnina=2.4, x0=0.0):
        self.r, self.e, self.x0 = rezy, 2.0 / mocnina, x0
        self.z0, self.z1 = rezy[0][0], rezy[-1][0]

    def prierez(self, z):
        r = self.r
        z = min(max(z, self.z0), self.z1)
        i = 0
        while i < len(r) - 2 and z > r[i + 1][0]:
            i += 1
        t = (z - r[i][0]) / (r[i + 1][0] - r[i][0])
        q = (r[max(i - 1, 0)], r[i], r[i + 1], r[min(i + 2, len(r) - 1)])
        v = [_catmull(*(s[k] for s in q), t) for k in range(1, 5)]
        return v[0], max(v[1], 0.004), max(v[2], 0.004), max(v[3], 0.004)

    def bod(self, z, a, von=0.0):
        cy, w, hu, hd = self.prierez(z)
        s, c = math.sin(a), math.cos(a)
        x = math.copysign(abs(s) ** self.e, s) * w
        y = math.copysign(abs(c) ** self.e, c) * (hu if c >= 0 else hd)
        p = Vector((self.x0 + x, cy + y, z))
        return p + self.normala(z, a) * von if von else p

    def normala(self, z, a):
        da, dz = 0.03, 0.02
        ta = self.bod(z, a + da) - self.bod(z, a - da)
        tz = self.bod(min(z + dz, self.z1), a) - self.bod(max(z - dz, self.z0), a)
        n = ta.cross(tz)
        cy = self.prierez(z)[0]
        von = self.bod(z, a) - Vector((self.x0, cy, z))
        if n.length < 1e-7:
            return von.normalized()
        n.normalize()
        return n if n.dot(von) >= 0 else -n

    def siet(self, pivot, mat_fn, kruhov=30, segm=28, sum=0.0, seed=0):
        """mat_fn(z, a) -> material plochy (tak sa robi brucho, pruhy, vnutro papule)."""
        rnd = random.Random(seed)
        v = []
        for i in range(kruhov + 1):
            z = self.z0 + (self.z1 - self.z0) * i / kruhov
            for j in range(segm):
                a = j / segm * 2 * math.pi
                v.append(self.bod(z, a, rnd.uniform(-sum, sum) if sum else 0.0))
        podla = {}
        for i in range(kruhov):
            z = self.z0 + (self.z1 - self.z0) * (i + 0.5) / kruhov
            for j in range(segm):
                a = (j + 0.5) / segm * 2 * math.pi
                if a > math.pi:
                    a -= 2 * math.pi
                m = mat_fn(z, a)
                podla.setdefault(m.name, (m, []))[1].append(
                    [i * segm + j, i * segm + (j + 1) % segm, (i + 1) * segm + (j + 1) % segm, (i + 1) * segm + j])
        podla_zad = mat_fn(self.z0 + 0.01, 1.2)
        podla.setdefault(podla_zad.name, (podla_zad, []))[1].append(list(range(segm))[::-1])
        podla_pred = mat_fn(self.z1 - 0.01, 1.2)
        podla.setdefault(podla_pred.name, (podla_pred, []))[1].append([kruhov * segm + j for j in range(segm)])
        for m, plochy in podla.values():                  # kazdy material dostane len svoje vrcholy
            ids = sorted({i for f in plochy for i in f})
            nove = {i: n for n, i in enumerate(ids)}
            pridaj(pivot, m, [v[i] for i in ids], [[nove[i] for i in f] for f in plochy], True)


def rura(pivot, mat, body, polomery, segm=7, hladke=False):
    """Zuzujuca sa rura po bodoch (rohy, zuby, pazury, trhliny). Polomer 0 na konci = spicka."""
    body = [Vector(b) for b in body]
    v, kruhy = [], []
    bocny = None
    for i, (p, r) in enumerate(zip(body, polomery)):
        t = (body[min(i + 1, len(body) - 1)] - body[max(i - 1, 0)]).normalized()
        if bocny is None:
            bocny = t.orthogonal().normalized()
        else:
            bocny = (bocny - t * bocny.dot(t)).normalized()
        druhy = t.cross(bocny)
        if r <= 0:
            kruhy.append([len(v)])
            v.append(p)
            continue
        kruhy.append(list(range(len(v), len(v) + segm)))
        for j in range(segm):
            a = j / segm * 2 * math.pi
            v.append(p + bocny * math.cos(a) * r + druhy * math.sin(a) * r)
    f = []
    for A, B in zip(kruhy, kruhy[1:]):
        for j in range(segm):
            k = (j + 1) % segm
            if len(B) == 1:
                f.append([A[j], A[k], B[0]])
            elif len(A) == 1:
                f.append([A[0], B[k], B[j]])
            else:
                f.append([A[j], A[k], B[k], B[j]])
    for kr, otoc in ((kruhy[0], True), (kruhy[-1], False)):
        if len(kr) > 1:
            f.append(kr[::-1] if otoc else kr)
    pridaj(pivot, mat, v, f, hladke)


def roh(pivot, mat, zaklad, smer, dlzka, polomer, ohyb=(0, 0, 0), clankov=5, segm=7, hladke=False):
    """Zakriveny roh / zub / pazur: zacne v 'zaklad', ide smerom 'smer', postupne sa ohyba o 'ohyb'."""
    p, s, o = Vector(zaklad), Vector(smer).normalized(), Vector(ohyb)
    body, rr = [p.copy()], [polomer]
    for i in range(1, clankov + 1):
        t = i / clankov
        p += (s + o * t).normalized() * (dlzka / clankov)
        body.append(p.copy())
        rr.append(polomer * (1 - t) ** 0.85)
    rura(pivot, mat, body, rr, segm, hladke)


def _osi(telo, z, a):
    n = telo.normala(z, a)
    vzad = Vector((0, 0, -1))
    vzad = (vzad - n * vzad.dot(n)).normalized()
    return telo.bod(z, a), n, vzad, n.cross(vzad)


def stitok(pivot, mat, telo, z, a, dlzka, sirka, vyska, sklon=0.25):
    """Supina s kylom (hrebenom) prilnuta k povrchu tela."""
    p, n, vzad, bok = _osi(telo, z, a)
    dole = p - n * min(0.03, sirka * 0.3)
    v = [dole - vzad * dlzka * 0.5, dole + bok * sirka * 0.5, dole + vzad * dlzka * 0.5, dole - bok * sirka * 0.5,
         p + n * vyska * 0.55 - vzad * dlzka * 0.22, p + n * vyska + vzad * dlzka * sklon]
    pridaj(pivot, mat, v, [[0, 1, 4], [4, 1, 5], [1, 2, 5], [2, 3, 5], [3, 4, 5], [3, 0, 4]])


def platna(pivot, mat, telo, z, a, rz, ra, vyska, seed=0, zuzenie=0.68, rohov=7):
    """Nepravidelna skalna platna pancierа na povrchu (rz = polomer pozdlz, ra = polomer napriec, v metroch)."""
    rnd = random.Random(seed)
    cy, w, hu, hd = telo.prierez(z)
    obvod = max((w + hu) * 0.5, 0.02)                     # priblizny polomer -> metre na uhol
    spodok, vrch = [], []
    for i in range(rohov):
        u = (i + rnd.uniform(-0.25, 0.25)) / rohov * 2 * math.pi
        k = rnd.uniform(0.8, 1.2)
        du, dv = math.cos(u) * rz * k, math.sin(u) * ra * k
        spodok.append(telo.bod(z + du, a + dv / obvod, -0.012))
        vrch.append(telo.bod(z + du * zuzenie - rz * 0.12, a + dv * zuzenie / obvod, vyska * rnd.uniform(0.8, 1.15)))
    stred = telo.bod(z - rz * 0.25, a, vyska * 1.35)
    n = rohov
    f = [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    f += [[n + i, n + (i + 1) % n, 2 * n] for i in range(n)]
    pridaj(pivot, mat, spodok + vrch + [stred], f)


def flak(pivot, mat, telo, z, a, rz, ra, vyska, seed=0, hustota=7):
    """Nepravidelny flak (mach) kopirujuci povrch, v strede hrubsi a hrboľaty."""
    rnd = random.Random(seed)
    cy, w, hu, hd = telo.prierez(z)
    obvod = max((w + hu) * 0.5, 0.02)
    n = hustota * 2
    v = [telo.bod(z, a, vyska)]
    kruhy = 3
    for k in range(1, kruhy + 1):
        t = k / kruhy
        for i in range(n):
            u = i / n * 2 * math.pi
            r = t * (rnd.uniform(0.65, 1.35) if k == kruhy else rnd.uniform(0.85, 1.15))
            h = -0.008 if k == kruhy else vyska * (1 - t * t * 0.6) * rnd.uniform(0.5, 1.4)
            v.append(telo.bod(z + math.cos(u) * rz * r, a + math.sin(u) * ra * r / obvod, h))
    f = [[0, 1 + i, 1 + (i + 1) % n] for i in range(n)]
    for k in range(kruhy - 1):
        A, B = 1 + k * n, 1 + (k + 1) * n
        f += [[A + i, B + i, B + (i + 1) % n, A + (i + 1) % n] for i in range(n)]
    pridaj(pivot, mat, v, f)


def trhlina(pivot, mat, telo, z, a, dz, da, krokov, hrubka, seed=0, vetvy=1, von=0.006):
    """Kľukata ziariaca prasklina po povrchu: zacne v (z, a), kazdy krok posun o (dz, da) + nahoda."""
    rnd = random.Random(seed)
    body, uzly = [], []
    for i in range(krokov + 1):
        zz = min(max(z, telo.z0), telo.z1)
        body.append(telo.bod(zz, a, von))
        uzly.append((zz, a))
        z += dz + rnd.uniform(-1, 1) * abs(da) * 0.12
        a += da + rnd.uniform(-1, 1) * (abs(dz) * 1.8 + 0.05)
    rr = [hrubka * math.sin(math.pi * (i + 0.6) / (krokov + 1.2)) for i in range(len(body))]
    rura(pivot, mat, body, rr, 4)
    for v in range(vetvy):
        if len(uzly) < 4:
            break
        zz, aa = uzly[rnd.randrange(1, len(uzly) - 1)]
        znak = rnd.choice((-1, 1))
        trhlina(pivot, mat, telo, zz, aa, dz * 0.4 + abs(da) * 0.12 * znak, da * 0.4 + dz * 1.5 * znak,
                max(2, krokov // 2), hrubka * 0.6, seed * 7 + v + 1, 0, von)


def gula(pivot, mat, stred, polomery, segm=10, sum=0.0, seed=0, hladke=True):
    rnd = random.Random(seed)
    s, r = Vector(stred), polomery
    pasov = max(4, segm * 2 // 3)
    v = [s + Vector((0, r[1], 0))]
    for i in range(1, pasov):
        t = i / pasov * math.pi
        for j in range(segm):
            a = j / segm * 2 * math.pi
            k = 1 + (rnd.uniform(-sum, sum) if sum else 0)
            v.append(s + Vector((math.sin(t) * math.cos(a) * r[0] * k, math.cos(t) * r[1] * k, math.sin(t) * math.sin(a) * r[2] * k)))
    v.append(s - Vector((0, r[1], 0)))
    posl = len(v) - 1
    f = [[0, 1 + (j + 1) % segm, 1 + j] for j in range(segm)]
    for i in range(pasov - 2):
        A, B = 1 + i * segm, 1 + (i + 1) * segm
        f += [[A + j, A + (j + 1) % segm, B + (j + 1) % segm, B + j] for j in range(segm)]
    A = 1 + (pasov - 2) * segm
    f += [[A + j, A + (j + 1) % segm, posl] for j in range(segm)]
    pridaj(pivot, mat, v, f, hladke)


def koncatina(pivot, mat, body, polomery, segm=10):
    """Obla ruka/noha po kostiach (stehno -> koleno -> clenok) so zaoblenymi klbmi."""
    rura(pivot, mat, body, polomery, segm, True)
    for p, r in zip(body, polomery):
        gula(pivot, mat, p, (r * 1.03, r * 1.03, r * 1.03), 8)
