# Pomocna kniznica na mobky/bossov v Blenderi (import v skriptoch moby_*.py).
#
# SURADNICE: vsetko sa zadava v suradniciach HRY: x = doprava, y = hore, z = dopredu (predok moba na +Z).
#            Funkcia G() ich prevedie do Blenderu (Z hore, -Y dopredu); export glTF ich vrati spat.
# STAVBA:    pivot('hlava', (x,y,z), rodic) = prazdny objekt, ktory hra otaca (animacia je v JS).
#            diel(...) = tvar zaveseny na pivot; poz je LOKALNA voci pivotu (ako pivot() v JS).
#            rot = (rx, ry, rz) v radianoch, rovnako ako mesh.rotation.set() v Three.js (poradie XYZ).
# MATERIALY: material('telo', 0x4a2820) – meno musi sediet s tym, co hlada JS (mob.mat('telo')).
# EXPORT:    export('lavovy_jaster') -> modely/moby/lavovy_jaster.glb
# Spustenie: "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" -b --python nastroje/blender/moby_<meno>.py
import bpy, bmesh, math, os, random
from mathutils import Vector

VON = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'modely', 'moby')
os.makedirs(VON, exist_ok=True)


def G(x, y, z):                    # hra -> Blender
    return Vector((x, -z, y))


def zacni():                       # prazdna scena
    bpy.ops.wm.read_factory_settings(use_empty=True)


def srgb(h):                       # 0xRRGGBB -> linearne RGBA (ako THREE.Color)
    def k(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (k(h >> 16 & 255), k(h >> 8 & 255), k(h & 255), 1.0)


def material(meno, farba, drsnost=0.7, kov=0.0, ziara=None, sila=1.0):
    m = bpy.data.materials.get(meno)
    if m:
        return m
    m = bpy.data.materials.new(meno)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(farba)
    b.inputs['Roughness'].default_value = drsnost
    b.inputs['Metallic'].default_value = kov
    if ziara is not None:
        b.inputs['Emission Color'].default_value = srgb(ziara)
        b.inputs['Emission Strength'].default_value = sila
    return m


def pivot(meno, poz=(0, 0, 0), rodic=None):
    o = bpy.data.objects.new(meno, None)
    bpy.context.collection.objects.link(o)
    o.parent = rodic
    o.location = G(*poz)
    return o


def diel(tvar, mat, rodic=None, poz=(0, 0, 0), rozmer=(1, 1, 1), rot=(0, 0, 0), hladky=0, hrana=0.0,
         segm=None, sum=0.0, seed=0, meno=None, spicka=1.0):
    """Jeden tvar zaveseny na pivote.
    tvar:   'kocka' | 'gula' | 'ikosa' | 'valec' | 'kuzel' (valec/kuzel stoja na osi Y, spicka hore)
    rozmer: cele rozmery (x, y, z) v metroch hry
    hladky: subdivision 0-2 (1-2 = obly organicky tvar; kocka s hladky=2 je 'mydlo')
    hrana:  zaoblenie hran (bevel) v metroch PRED zmenou rozmeru, napr. 0.1 = jemne zaoblena kocka
    sum:    zvrasnenie povrchu 0-0.2 (kamen, kora); spicka: kuzel 0 = ostry, 0.3 = zrezany"""
    bm = bmesh.new()
    if tvar == 'kocka':
        bmesh.ops.create_cube(bm, size=1.0)
    elif tvar == 'gula':
        s = segm or 12
        bmesh.ops.create_uvsphere(bm, u_segments=s, v_segments=s // 2 + 1, radius=0.5)
    elif tvar == 'ikosa':
        bmesh.ops.create_icosphere(bm, subdivisions=segm or 1, radius=0.5)
    elif tvar in ('valec', 'kuzel'):
        bmesh.ops.create_cone(bm, cap_ends=True, segments=segm or 8, radius1=0.5,
                              radius2=0.5 if tvar == 'valec' else 0.5 * (spicka if spicka < 1 else 0), depth=1.0)
    else:
        raise ValueError(tvar)
    if sum:
        r = random.Random(seed)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        for v in bm.verts:
            v.co += Vector((r.uniform(-1, 1), r.uniform(-1, 1), r.uniform(-1, 1))) * sum
    me = bpy.data.meshes.new(meno or mat.name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(meno or mat.name, me)
    bpy.context.collection.objects.link(o)
    me.materials.append(mat)
    o.parent = rodic
    o.location = G(*poz)
    o.scale = (rozmer[0], rozmer[2], rozmer[1])              # hra (x,y,z) -> Blender (x, z, y)
    # Three.js 'XYZ' = Rx*Ry*Rz; v osiach Blenderu Rx(a)*Rz(b)*Ry(-c) = rezim 'YZX'
    o.rotation_mode = 'YZX'
    o.rotation_euler = (rot[0], -rot[2], rot[1])
    if hrana:
        b = o.modifiers.new('hrana', 'BEVEL')
        b.width, b.segments, b.limit_method = hrana, 2, 'ANGLE'
    if hladky:
        m = o.modifiers.new('sub', 'SUBSURF')
        m.levels = m.render_levels = hladky
    if hladky or hrana:
        for p in me.polygons:
            p.use_smooth = True
    return o


def export(meno):
    cesta = os.path.join(VON, meno + '.glb')
    bpy.ops.export_scene.gltf(filepath=cesta, export_format='GLB', export_apply=True, export_yup=True,
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7)
    dg = bpy.context.evaluated_depsgraph_get()
    tri = 0
    for o in bpy.data.objects:
        if o.type == 'MESH':
            me = o.evaluated_get(dg).to_mesh()
            tri += sum(len(p.vertices) - 2 for p in me.polygons)
            o.evaluated_get(dg).to_mesh_clear()
    print('HOTOVO', cesta, os.path.getsize(cesta), 'B,', tri, 'trojuholnikov')
