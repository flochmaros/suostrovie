# Pomocka k mob.py pre detailne modely (kraken, golem): tvary sa skladaju priamo z bodov a trojuholnikov.
#  - vsetky diely na tom istom pivote s tym istym materialom sa spoja do jedneho meshu (menej "draw calls" v hre)
#  - farba sa uklada do vrcholov (mach, flaky na kozi, tmavsi spodok kamena), material ju len zobrazi
# Suradnice su SURADNICE HRY (y hore, predok +Z), lokalne voci pivotu.
import bpy, bmesh, math
from mathutils import Vector, noise
from mob import G, material, srgb

V = Vector
_diely = {}                                   # (pivot, material) -> [verts, faces, farby (na roh), hladke]


def farebny(meno, drsnost=0.7, kov=0.0):
    """Material, ktoreho farbu urcuju farby vrcholov."""
    m = material(meno, 0xffffff, drsnost, kov)
    uzol = m.node_tree.nodes.new('ShaderNodeVertexColor')
    uzol.layer_name = 'Col'
    m.node_tree.links.new(uzol.outputs['Color'], m.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    return m


def mix(a, b, t):                             # zmes dvoch linearnych farieb
    t = max(0.0, min(1.0, t))
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(4))


def jas(c, k):
    return (c[0] * k, c[1] * k, c[2] * k, 1.0)


def sum3(p, mierka=1.0, posun=0.0):           # hladky 3D sum -1..1
    return noise.noise(V((p[0] * mierka + posun, p[1] * mierka - posun, p[2] * mierka + posun * 0.5)))


def _normaly_von(verts, faces):               # zjednoti orientaciu trojuholnikov (von)
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in verts]
    for f in faces:
        try:
            bm.faces.new([vs[i] for i in f])
        except ValueError:
            pass
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.verts.index_update()
    out = [[v.index for v in f.verts] for f in bm.faces]
    bm.free()
    return out


def pridaj(piv, mat, tvar, farba=None, hladke=True):
    """tvar = (verts, faces); farba(p, n) -> linearne RGBA (len pre farebny material)."""
    verts, faces = tvar
    if not faces:
        return tvar
    faces = _normaly_von(verts, faces)
    normaly = [V((0, 0, 0)) for _ in verts]
    plosne = []
    for f in faces:
        n = V((0, 0, 0))
        for i in range(1, len(f) - 1):
            n += (verts[f[i]] - verts[f[0]]).cross(verts[f[i + 1]] - verts[f[0]])
        plosne.append(n.normalized())
        for i in f:
            normaly[i] += n
    d = _diely.setdefault((piv, mat), [[], [], [], []])
    z = len(d[0])
    d[0].extend(verts)
    for f, pn in zip(faces, plosne):
        d[1].append([z + i for i in f])
        d[3].append(hladke)
        if farba:
            if hladke:
                d[2].extend(farba(verts[i], normaly[i].normalized()) for i in f)
            else:                             # hranaty kamen: jedna farba na plosku
                stred = sum((verts[i] for i in f), V((0, 0, 0))) / len(f)
                c = farba(stred, pn)
                d[2].extend(c for _ in f)
        else:
            d[2].extend((1, 1, 1, 1) for _ in f)
    return tvar


def hotovo():
    for (piv, mat), (verts, faces, farby, hladke) in _diely.items():
        meno = 'm_%s_%s' % (piv.name, mat.name)
        me = bpy.data.meshes.new(meno)
        me.from_pydata([G(*v) for v in verts], [], faces)
        a = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        for i, c in enumerate(farby):
            a.data[i].color = c
        for p, h in zip(me.polygons, hladke):
            p.use_smooth = h
        o = bpy.data.objects.new(meno, me)
        bpy.context.collection.objects.link(o)
        me.materials.append(mat)
        o.parent = piv
    _diely.clear()


# ---------- tvary ----------
def otoc(v, rot):                             # rot = (rx, ry, rz), poradie ako Three.js 'XYZ' (najprv z)
    x, y, z = v
    rx, ry, rz = rot
    x, y = x * math.cos(rz) - y * math.sin(rz), x * math.sin(rz) + y * math.cos(rz)
    x, z = x * math.cos(ry) + z * math.sin(ry), -x * math.sin(ry) + z * math.cos(ry)
    y, z = y * math.cos(rx) - z * math.sin(rx), y * math.sin(rx) + z * math.cos(rx)
    return V((x, y, z))


def guľa_body(delenie):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=delenie, radius=1.0)
    bm.verts.index_update()
    r = ([v.co.copy() for v in bm.verts], [[v.index for v in f.verts] for f in bm.faces])
    bm.free()
    return r


def elipsoid(stred, polomery, rot=(0, 0, 0), delenie=2, tvaruj=None):
    """Gula roztiahnuta na polomery; tvaruj(smer) -> nasobok polomeru (hrbole, vrasky)."""
    verts, faces = guľa_body(delenie)
    out = []
    for d in verts:
        k = tvaruj(d) if tvaruj else 1.0
        out.append(otoc(V((d.x * polomery[0], d.y * polomery[1], d.z * polomery[2])) * k, rot) + V(stred))
    return out, faces


def rurka(body, polomery, strany=10, splosti=1.0, konce=True):
    """Rurka po ceste bodov s menitelnym polomerom (chapadla, obocie, korene). splosti < 1 = plocha na vysku."""
    body = [V(b) for b in body]
    verts, faces = [], []
    bok = None
    for i, p in enumerate(body):
        t = (body[min(i + 1, len(body) - 1)] - body[max(i - 1, 0)]).normalized()
        if bok is None:
            bok = V((1, 0, 0)) if abs(t.x) < 0.9 else V((0, 0, 1))
        bok = (bok - t * bok.dot(t)).normalized()
        hore = t.cross(bok)
        for s in range(strany):
            a = s / strany * math.tau
            verts.append(p + bok * math.cos(a) * polomery[i] + hore * math.sin(a) * polomery[i] * splosti)
    for i in range(len(body) - 1):
        for s in range(strany):
            a, b = i * strany + s, i * strany + (s + 1) % strany
            faces.append([a, b, b + strany, a + strany])
    if konce:
        faces.append(list(range(strany))[::-1])
        faces.append([(len(body) - 1) * strany + s for s in range(strany)])
    return verts, faces


def torus(stred, normala, R, r, n=8, m=4, jamka=False):
    """Prstenec (prisavka). jamka=True prida dno uprostred."""
    nn = V(normala).normalized()
    a1 = nn.orthogonal().normalized()
    a2 = nn.cross(a1)
    verts, faces = [], []
    for i in range(n):
        u = i / n * math.tau
        smer = a1 * math.cos(u) + a2 * math.sin(u)
        for j in range(m):
            w = j / m * math.tau
            verts.append(V(stred) + smer * (R + r * math.cos(w)) + nn * r * math.sin(w))
    for i in range(n):
        for j in range(m):
            a, b = i * m + j, i * m + (j + 1) % m
            c, d = ((i + 1) % n) * m + (j + 1) % m, ((i + 1) % n) * m + j
            faces.append([a, b, c, d])
    if jamka:
        z = len(verts)
        verts.append(V(stred) - nn * r * 0.2)
        for i in range(n):
            faces.append([i * m + m // 2, ((i + 1) % n) * m + m // 2, z])
    return verts, faces


def kuzel(zaklad, spicka, polomer, strany=5):
    return rurka([zaklad, spicka], [polomer, polomer * 0.04], strany)
