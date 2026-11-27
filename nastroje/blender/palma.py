# Palma pre hru – generuje sa v Blenderi skriptom a exportuje do modely/rastliny/palma_N.glb
# Spustenie (bez okna):  "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" -b --python nastroje/blender/palma.py
#
# Co sa tu deje:
#  - bmesh = "stavebnica" na sietky v Blenderi: pridavame vrcholy a plochy rucne
#  - farby sa ukladaju do vrcholov (atribut 'Col'), hra ich cita ako vertex colors (ziadne textury)
#  - objekt 'zaklad' = kmen + listy, objekt 'plody' = kokosy (hra ich vie zobrat a nechat dorast)
#  - Blender ma os Z hore, export glTF to sam otoci na Y hore (ako v Three.js)
import bpy, bmesh, math, random, os, sys
from mathutils import Vector, Color

VON = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'modely', 'rastliny')
os.makedirs(VON, exist_ok=True)


def hex2(h):                       # 0x2f6a26 -> (r,g,b) v linearnom priestore (ako THREE.Color)
    c = Color(((h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255))
    return c.from_srgb_to_scene_linear() if hasattr(c, 'from_srgb_to_scene_linear') else c


def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def jas(c, k):
    return tuple(min(1.0, x * k) for x in c)


class Siet:                        # zbiera vrcholy + farby, na konci z nich spravi objekt
    def __init__(s):
        s.bm = bmesh.new()
        s.col = s.bm.loops.layers.float_color.new('Col')
        s.farby = {}

    def v(s, p, c):
        vert = s.bm.verts.new(p)
        s.farby[vert] = c
        return vert

    def f(s, *verts, hladka=False):
        try:
            face = s.bm.faces.new(verts)
        except ValueError:
            return
        face.smooth = hladka
        for l in face.loops:
            c = s.farby[l.vert]
            l[s.col] = (c[0], c[1], c[2], 1.0)
        return face

    def objekt(s, meno, hladke=False):
        me = bpy.data.meshes.new(meno)
        s.bm.normal_update()
        s.bm.to_mesh(me)
        s.bm.free()
        if hladke:
            for p in me.polygons:
                p.use_smooth = True
        ob = bpy.data.objects.new(meno, me)
        bpy.context.collection.objects.link(ob)
        me.color_attributes.active_color = me.color_attributes['Col']
        mat = bpy.data.materials.get('vertex') or novy_material()
        me.materials.append(mat)
        return ob


def novy_material():               # material cita farbu z vrcholov (aby ju exporter zapisal)
    m = bpy.data.materials.new('vertex')
    m.use_nodes = True
    n = m.node_tree.nodes
    attr = n.new('ShaderNodeVertexColor')
    attr.layer_name = 'Col'
    m.node_tree.links.new(attr.outputs['Color'], n['Principled BSDF'].inputs['Base Color'])
    return m


def bezier(a, b, c, t):            # kvadraticka krivka (ako THREE.QuadraticBezierCurve3)
    return a * (1 - t) ** 2 + b * 2 * (1 - t) * t + c * t * t


def kmen(S, r, H, ohyb):
    A, B, Cc = Vector((0, 0, 0)), Vector((0, 0, H * 0.55)), Vector((ohyb, 0, H))
    N, K = 20, 8
    tmavy, svetly, kora = hex2(0x5c432c), hex2(0x8a6a48), hex2(0x6e5236)
    prstence = []
    for i in range(N + 1):
        t = i / N
        p = bezier(A, B, Cc, t)
        tan = (bezier(A, B, Cc, min(t + 0.01, 1)) - bezier(A, B, Cc, max(t - 0.01, 0))).normalized()
        n1 = tan.cross(Vector((0, 1, 0))).normalized()
        n2 = tan.cross(n1).normalized()
        rr = (0.34 - 0.15 * t) * (1.1 if i % 2 == 0 else 0.97)     # prstence po starych listoch
        if i == 0:
            rr *= 1.45                                              # rozsireny koren
        elif i == 1:
            rr *= 1.12
        kruh = []
        for j in range(K):
            u = j / K * math.tau
            sum_ = 1 + 0.05 * math.sin(u * 3 + i * 1.7)              # nepravidelna kora
            q = p + (n1 * math.cos(u) + n2 * math.sin(u)) * rr * sum_
            c = tmavy if i % 2 == 0 else mix(kora, svetly, r.random() * 0.6)
            c = jas(c, 0.75 + 0.35 * (0.5 + 0.5 * math.cos(u - 0.8)))  # jemne tienovanie na kore
            kruh.append(S.v(q, c))
        prstence.append(kruh)
    for i in range(N):
        a, b = prstence[i], prstence[i + 1]
        for j in range(K):
            S.f(a[j], a[(j + 1) % K], b[(j + 1) % K], b[j], hladka=True)   # hladke tienovanie = okruhly kmen
    return Cc


def list_palmy(S, r, vrch, uhol, sklon, L, suchy=False):
    """Palmovy list: stopka (rachis) zohnuta dole + listky na oboch stranach, kazdy zo 2 segmentov."""
    zdvih, pad = 1.0 + r.random() * 0.6, 2.0 + r.random() * 1.4
    smer = Vector((math.cos(uhol), math.sin(uhol), 0))
    bok = Vector((-math.sin(uhol), math.cos(uhol), 0))

    def P(s):                      # bod na stopke (v rovine smer/Z), sklon dvihne zaciatok
        x = L * s
        z = zdvih * s - pad * s * s + sklon * s * (1 - s) * 2
        return vrch + smer * x + Vector((0, 0, z))

    if suchy:
        fK, fS = hex2(0x6d5a30), hex2(0xa88f55)
    else:
        odt = r.uniform(-0.06, 0.06)
        fK = hex2(0x2a5e22)
        fS = mix(hex2(0x8fbf4a), hex2(0xb8c45a), max(0, odt) * 5)
    # stopka: plochy pasik (material je obojstranny, staci jedna plocha)
    M = 6
    pred = None
    for i in range(M + 1):
        s = i / M
        p = P(s)
        w = 0.035 * (1 - s) + 0.01
        c = mix(hex2(0x6b7a3a), fK, s)
        par = [S.v(p + bok * w, c), S.v(p - bok * w, c)]
        if pred:
            S.f(pred[0], pred[1], par[1], par[0])
        pred = par
    # listky
    PARY = 14
    for i in range(PARY):
        s = 0.1 + 0.88 * i / PARY
        p = P(s)
        tan = (P(min(s + 0.02, 1)) - P(s - 0.02)).normalized()
        dl = L * 0.42 * math.sin(math.pi * (0.12 + 0.82 * s)) * (0.85 + r.random() * 0.3)
        sir = 0.07 * (1.1 - s * 0.5)
        c0 = mix(fK, fS, s * 0.6)
        c1 = mix(fK, fS, 0.4 + s * 0.6)
        for strana in (-1, 1):
            if suchy and r.random() < 0.25:
                continue                                           # vytrhane listky
            out = (bok * strana * 0.8 + tan * 0.55).normalized()
            vis = 0.25 + 0.35 * s                                  # listky ku spicke visia viac
            koren = p
            mid = koren + out * dl * 0.5 + Vector((0, 0, -dl * vis * 0.25))
            spic = koren + out * dl + Vector((0, 0, -dl * vis))
            n = tan * sir * 1.3                                    # "drak" = 2 trojuholniky na listok
            a = S.v(koren, c0)
            b1, b2 = S.v(mid - n, mix(c0, c1, 0.5)), S.v(mid + n, jas(mix(c0, c1, 0.5), 1.08))
            t1 = S.v(spic, c1)
            S.f(a, b2, t1, b1)


def chumac(S, r, vrch):            # pochvy listov pod korunou
    c = hex2(0x5c432c)
    for i in range(7):
        u = i / 7 * math.tau + r.random() * 0.4
        d = Vector((math.cos(u), math.sin(u), 0))
        b = vrch + d * 0.12 + Vector((0, 0, -0.35))
        t = vrch + d * 0.42 + Vector((0, 0, 0.15))
        n = Vector((-d.y, d.x, 0)) * 0.13
        S.f(S.v(b - n, jas(c, 0.8)), S.v(b + n, jas(c, 0.8)), S.v(t + n, jas(c, 1.2)), S.v(t - n, jas(c, 1.2)))


def kokos(S, r, stred, R):
    zeleny = r.random() < 0.55
    c = hex2(0x6f8a2a) if zeleny else hex2(0x5a3c1d)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=R)
    mapa = {}
    for v in bm.verts:
        p = v.co.copy()
        p.z *= 1.15
        mapa[v] = S.v(stred + p, jas(c, 0.85 + 0.3 * (p.z / R * 0.5 + 0.5)))
    for f in bm.faces:
        S.f(*[mapa[v] for v in f.verts])
    bm.free()


def palma(seed):
    r = random.Random(seed)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    H, ohyb = 7 + r.random() * 4.5, 0.6 + r.random() * 2.6
    Z = Siet()
    vrch = kmen(Z, r, H, ohyb)
    chumac(Z, r, vrch)
    n = 11 + r.randrange(4)
    for i in range(n):
        list_palmy(Z, r, vrch, i / n * math.tau + r.random() * 0.35, r.uniform(0.2, 1.2), 3.0 + r.random() * 1.5)
    for i in range(2):
        list_palmy(Z, r, vrch + Vector((0, 0, -0.25)), r.random() * math.tau, -1.2, 2.5, suchy=True)
    zak = Z.objekt('zaklad')
    P = Siet()
    for i in range(4 + r.randrange(3)):
        u = r.random() * math.tau
        kokos(P, r, vrch + Vector((math.cos(u) * 0.3, math.sin(u) * 0.3, -0.4 - r.random() * 0.25)), 0.19)
    P.objekt('plody', hladke=True)
    return H


for i, seed in enumerate((1, 2, 3), 1):
    palma(seed)
    cesta = os.path.join(VON, f'palma_{i}.glb')
    bpy.ops.export_scene.gltf(filepath=cesta, export_format='GLB', export_vertex_color='ACTIVE',
                              export_materials='NONE', export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=7, export_apply=True)
    print('HOTOVO', cesta, os.path.getsize(cesta), 'B')
