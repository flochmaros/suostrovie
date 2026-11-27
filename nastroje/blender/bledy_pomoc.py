# Pomocne veci pre Bledych: farby vo vrcholoch (zily, modriny, spina), plochy z mriezky (trup, hlava, handry).
# Vsetky suradnice su suradnice HRY (x doprava, y hore, z dopredu), ako v mob.py.
import math, random
from mathutils import Vector, noise
from mathutils.bvhtree import BVHTree
from mob import *

TLMENIE = {'koza': 0.72, 'maska': 0.82, 'zuby': 0.85, 'oko': 0.9}
TIENE = {'koza': 1.15, 'maska': 0.8, 'latka': 0.8, 'zuby': 0.9, 'oko': 0.7}
MALBA = {}          # meno objektu -> farba 0xRRGGBB alebo funkcia(svet, lokal) -> (r, g, b) v sRGB 0..1


def rgb(h):
    return ((h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255)


def mix(a, b, k):
    k = max(0.0, min(1.0, k))
    return tuple(a[i] + (b[i] - a[i]) * k for i in range(3))


def hladko(a, b, x):                      # smoothstep: 0 pri a, 1 pri b (a moze byt vacsie ako b)
    k = max(0.0, min(1.0, (x - a) / (b - a)))
    return k * k * (3 - 2 * k)


def gauss(dx, dy, sx, sy):
    return math.exp(-((dx / sx) ** 2 + (dy / sy) ** 2))


def sum3(p, f, posun=0.0):                # Perlinov sum -1..1
    return noise.noise(Vector((p[0] * f + posun, p[1] * f - posun, p[2] * f + posun * 0.5)))


def mat_farby(meno, drsnost=0.7, ziara=None, sila=1.0):
    """Material, ktoreho farbu urcuju farby vo vrcholoch (atribut 'Col')."""
    m = material(meno, 0xffffff, drsnost, ziara=ziara, sila=sila)
    uzly = m.node_tree
    if not any(n.type == 'VERTEX_COLOR' for n in uzly.nodes):
        v = uzly.nodes.new('ShaderNodeVertexColor')
        v.layer_name = 'Col'
        uzly.links.new(v.outputs['Color'], uzly.nodes['Principled BSDF'].inputs['Base Color'])
    return m


def farbi(o, farba):
    MALBA[o.name] = farba
    return o


def siet(riadky, mat, rodic, uzavrete=True, vynechaj=None, meno=None, hladke=True, von=True, okraj=0):
    """Plocha z mriezky bodov: riadky = [[(x, y, z), ...], ...]. uzavrete = stlpce sa spoja dookola.
    vynechaj(stred) -> True = plosku nevytvorit (diery v handrach, okraj masky)."""
    me = bpy.data.meshes.new(meno or mat.name)
    n = len(riadky[0])
    body = [G(*p) for r in riadky for p in r]
    plochy = []
    for i in range(len(riadky) - 1):
        for j in range(n if uzavrete else n - 1):
            q = (i * n + j, i * n + (j + 1) % n, (i + 1) * n + (j + 1) % n, (i + 1) * n + j)
            if vynechaj:
                s = [sum(riadky[k // n][k % n][c] for k in q) / 4 for c in range(3)]
                if vynechaj(s):
                    continue
            plochy.append(q)
    me.from_pydata(body, [], plochy)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    for _ in range(okraj):                # vyhladi zubaty ("schodikovy") okraj po vynechanych ploskach
        nove = {}
        for v in bm.verts:
            sus = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(sus) == 2:
                nove[v] = v.co * 0.5 + (sus[0].co + sus[1].co) * 0.25
        for v, co in nove.items():
            v.co = co
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if von and uzavrete:                  # istota: normaly smeruju von zo stredu
        c = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
        if sum((f.calc_center_median() - c).dot(f.normal) for f in bm.faces) < 0:
            bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = hladke
    o = bpy.data.objects.new(meno or mat.name, me)
    bpy.context.collection.objects.link(o)
    me.materials.append(mat)
    o.parent = rodic
    return o


# lace smery do polgule (okolo osi +Z) na vypocet tienov v zahyboch
LUCE = [(math.sqrt((i + 0.5) / 24) * math.cos(i * 2.39996), math.sqrt((i + 0.5) / 24) * math.sin(i * 2.39996),
         math.sqrt(1 - (i + 0.5) / 24)) for i in range(24)]


def tien(strom, bod, n, dosah=0.13):
    """Zapecene tienovanie (ambient occlusion): kolko lucov z vrcholu narazi do blizkej geometrie. 0 = volne, 1 = hlbka."""
    a = n.orthogonal().normalized()
    b = n.cross(a)
    zakryte = 0.0
    for x, y, z in LUCE:
        smer = a * x + b * y + n * z
        miesto, nz, _, d = strom.ray_cast(bod + n * 0.004, smer, dosah)
        if miesto is not None:
            vnutri = nz.dot(smer) > 0                       # vrchol je schovany v inom diele (spoj): netmavit uplne
            zakryte += (0.35 if vnutri else 1.0) * (1 - 0.6 * d / dosah)
    return zakryte / len(LUCE)


def dokonci(malba_koze):
    """Aplikuje modifikatory, namaluje farby do vrcholov a spoji diely s rovnakym pivotom a materialom
    (menej meshov = menej kreslenia v hre)."""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    meshe = [o for o in bpy.data.objects if o.type == 'MESH']
    hotove = {o.name: bpy.data.meshes.new_from_object(o.evaluated_get(dg)) for o in meshe}
    skupiny = {}
    body, plochy = [], []                                     # vsetko, co vrha tien (okrem vlasov)
    for o in meshe:
        if hotove[o.name].materials[0].name == 'vlasy':
            continue
        n0 = len(body)
        body += [o.matrix_world @ v.co for v in hotove[o.name].vertices]
        plochy += [[n0 + i for i in p.vertices] for p in hotove[o.name].polygons]
    strom = BVHTree.FromPolygons(body, plochy)
    for o in meshe:
        me = hotove[o.name]
        svet, lok = o.matrix_world.copy(), o.matrix_basis.copy()
        predkovia, r = [], o.parent
        while r:
            predkovia.append(r.name)
            r = r.parent
        malba = MALBA.get(o.name)
        for a in list(me.color_attributes):
            me.color_attributes.remove(a)
        att = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        otoc = svet.to_3x3().inverted_safe().transposed()
        normaly = [(otoc @ n.vector).normalized() for n in me.vertex_normals]
        sila = TIENE.get(me.materials[0].name, 0.0)
        for i, v in enumerate(me.vertices):
            w, l = svet @ v.co, lok @ v.co
            pw, pl = (w.x, w.z, -w.y), (l.x, l.z, -l.y)       # Blender -> hra
            if callable(malba):
                c = malba(pw, pl)
            elif malba is not None:
                k = 1 + 0.16 * sum3(pw, 38)                    # jemne flaky aj na jednofarebnych veciach
                c = tuple(x * k for x in rgb(malba))
            else:
                c = malba_koze(pw, predkovia)
            if me.materials[0].name in TLMENIE:                 # slnko v hre farby silno zosvetluje
                c = tuple(x * TLMENIE[me.materials[0].name] for x in c)
            if sila:
                t = tien(strom, w, normaly[i])
                zvrchu = 0.86 + 0.14 * max(-1.0, min(1.0, normaly[i].z * 1.4 + 0.25))   # spodne plochy tmavsie
                k = max(0.25, 1 - sila * t) * zvrchu
                c = (c[0] * k, c[1] * k * (1 - 0.06 * t), c[2] * k * (1 - 0.08 * t))        # tien je teplejsi
            att.data[i].color = (*[(max(0, min(1, x)) / 12.92 if x <= 0.04045 else ((min(1, x) + 0.055) / 1.055) ** 2.4) for x in c], 1.0)
        me.transform(lok)
        skupiny.setdefault((o.parent, me.materials[0].name), []).append(me)
    for o in meshe:
        bpy.data.objects.remove(o)
    for (rodic, mat), zoznam in skupiny.items():
        bm = bmesh.new()
        for me in zoznam:
            bm.from_mesh(me)
        nove = bpy.data.meshes.new(mat)
        bm.to_mesh(nove)
        bm.free()
        nove.materials.append(bpy.data.materials[mat])
        nove.color_attributes.active_color_index = 0
        o = bpy.data.objects.new(mat, nove)
        bpy.context.collection.objects.link(o)
        o.parent = rodic
    MALBA.clear()
