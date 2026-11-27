# Hlava Bledeho: jedna suvisla "ludska" tvar (mriezka bodov na elipsoide, do ktorej sa vytlacia ocne jamky,
# nos, licne kosti, usta...). K tomu oci, zuby, stehy, maska cez cast tvare, vlasy a rohy Matky.
from bledy_pomoc import *

# zaklad hlavy (lokalne v pivote 'tvar', ktory visi na 'hlava')
CY, H, W, D, CZ = 0.100, 0.178, 0.102, 0.120, 0.015

VYCHODZIE = dict(
    sirka=1.0, vyska=1.0, brada=0.56,                 # tvar lebky; brada = ako sa zuzuje dole
    ex=0.040, ey=0.115, eyP=0.0, jamka=0.026,         # oci: polovica rozostupu, vyska, o kolko je prave (+x) nizsie, hlbka jamky
    oci=('ludske', 'ludske'),                         # (lave, prave): ludske | cierne | slepe | zasite | prazdne | zarastene
    r_oka=0.0165, licne=0.014, vpadle=0.014, nos=0.030, nos_y=0.052,
    my=0.005, mw=0.036, mh=0.004, usmev=0.0,          # usta: vyska, polovica sirky, polovica otvorenia, zdvihnute kutiky
    zuby=0, usta_zasite=False, pery=0x6e4e4c,
    maska=None,                                       # funkcia(x, y) -> True = tu je maska
    maska_farba=0xb4a890, maska_diery=(), praskliny=3,
    vlasy=None,                                       # dict(pocet, dlzka, farba, strana(-1/0/1))
)


class Tvar:
    def __init__(self, p):
        self.p = {**VYCHODZIE, **p}

    def oci_xy(self):
        p = self.p
        return [(-p['ex'], p['ey']), (p['ex'], p['ey'] - p['eyP'])]

    def bod(self, u, rysy=True):
        """u = smer na jednotkovej guli -> bod na povrchu hlavy."""
        p = self.p
        ux, uy, uz = u
        x, y, z = W * p['sirka'] * ux, CY + H * p['vyska'] * uy, CZ + D * uz
        if uy < 0:
            k = (-uy) ** 1.6
            x *= 1 - (1 - p['brada']) * k
            if uz < 0:
                z = CZ + D * uz * (1 - 0.6 * k)           # zatylok dole sa zuzuje do krku
            else:
                z += 0.012 * k                            # celust dopredu
        predok = hladko(0.1, 0.55, uz)
        if predok <= 0:
            return x, y, z
        d = 0.0
        mx, my, mw, mh = 0.0, p['my'], p['mw'], p['mh']
        for i, (ex, ey) in enumerate(self.oci_xy()):
            hl = p['jamka'] * (0.35 if p['oci'][i] == 'zarastene' else 1.0)
            d -= hl * gauss(x - ex, y - ey, 0.022, 0.018)
            d += 0.008 * gauss(x - ex * 1.05, y - ey - 0.032, 0.032, 0.011)          # nadocnicovy obluk
            s = 1 if ex > 0 else -1
            lic = gauss(x - s * 0.062, y - (ey - 0.042), 0.022, 0.017)
            d += p['licne'] * lic
            x += s * p['licne'] * 0.55 * lic
            d -= p['vpadle'] * gauss(x - s * 0.052, y - (ey - 0.092), 0.022, 0.03)    # vpadnute lica
        d += 0.006 * gauss(x, y - 0.19, 0.06, 0.05)                                   # celo
        ny = p['nos_y']
        if rysy:
            if y >= ny:
                chrbat_nosa = hladko(p['ey'] + 0.025, ny, y)
            else:
                chrbat_nosa = hladko(ny - 0.014, ny, y)
            d += p['nos'] * chrbat_nosa * math.exp(-(x / (0.009 + 0.006 * hladko(p['ey'], ny, y))) ** 2)
            d += p['nos'] * 0.25 * (gauss(x - 0.012, y - ny - 0.002, 0.008, 0.008) + gauss(x + 0.012, y - ny - 0.002, 0.008, 0.008))
            ym = my + p['usmev'] * (min(1.4, abs(x) / mw) ** 2)
            otvor = 1 - hladko(0.75, 1.12, math.hypot(x / mw, (y - ym) / max(mh, 0.0035)))
            d -= (0.012 + min(0.05, mh * 1.6)) * otvor if mh > 0.006 else 0.006 * otvor
            okraj = math.hypot(x / (mw * 1.05), (y - ym) / (mh + 0.007))
            d += 0.006 * math.exp(-((okraj - 1.0) / 0.22) ** 2)                       # pery
        d += 0.009 * gauss(x, y - (my - p['mh'] - 0.035), 0.022, 0.016)              # brada
        return x, y, z + d * predok

    def predok(self, x, y, rysy=True):
        """Hlbka (z) predneho povrchu tvare v bode (x, y) - na umiestnenie oci, zubov, stehov, masky."""
        p = self.p
        uy = max(-0.98, min(0.98, (y - CY) / (H * p['vyska'])))
        sirka = W * p['sirka'] * (1 - (1 - p['brada']) * (-uy) ** 1.6 if uy < 0 else 1)
        ux = max(-0.96, min(0.96, x / sirka))
        uz = math.sqrt(max(0.02, 1 - ux * ux - uy * uy))
        return self.bod((ux, uy, uz), rysy)[2]

    def mriezka(self, stlpce=52, riadky=46):
        von = []
        for i in range(riadky + 1):
            lat = -math.pi / 2 + math.pi * i / riadky
            r = []
            for j in range(stlpce):
                t = -1 + 2 * j / stlpce
                fi = math.pi * math.copysign(abs(t) ** 1.55, t)          # hustejsie vpredu (tvar)
                r.append(self.bod((math.sin(fi) * math.cos(lat), math.sin(lat), math.cos(fi) * math.cos(lat))))
            von.append(r)
        return von


def na_tvar(T, body, o=0.002, rysy=True):
    """[(x, y, polomer)] -> body trubice prilepene na tvar."""
    return [(x, y, T.predok(x, y, rysy) + o, r) for x, y, r in body]


def hlava(uzol, T, M, koza_farba, vyber, seed):
    p, rnd = T.p, random.Random(seed)
    oci = T.oci_xy()

    def farba_tvare(w, l):
        x, y, z = l
        c = koza_farba(w, ['hlava'])
        if z < 0.03:
            return c
        for i, (ex, ey) in enumerate(oci):
            druh = p['oci'][i]
            if druh == 'zarastene':
                c = mix(c, vyber['modrina'], 0.45 * gauss(x - ex, y - ey, 0.022, 0.016))
                continue
            c = mix(c, vyber['modrina'], 0.8 * gauss(x - ex, y - ey + 0.004, 0.027, 0.022))      # tmave kruhy
            c = mix(c, rgb(0x241518), 0.75 * gauss(x - ex, y - ey, 0.018, 0.012))
            if druh == 'prazdne':
                c = mix(c, rgb(0x050303), hladko(1.2, 0.7, math.hypot((x - ex) / 0.019, (y - ey) / 0.015)))
        ym = p['my'] + p['usmev'] * (min(1.4, abs(x) / p['mw']) ** 2)
        e = math.hypot(x / (p['mw'] * 1.05), (y - ym) / (p['mh'] + 0.006))
        c = mix(c, rgb(p['pery']), 0.85 * hladko(1.35, 0.95, e))
        if p['mh'] > 0.006:
            c = mix(c, rgb(0x120405), hladko(1.0, 0.78, math.hypot(x / p['mw'], (y - ym) / p['mh'])))
        elif abs(x) < p['mw'] * 1.15:
            c = mix(c, rgb(0x1c0c0d), math.exp(-((y - ym) / 0.0035) ** 2))
        nny = p['nos_y'] - 0.008
        for s in (-1, 1):                                                                      # nosne dierky
            c = mix(c, rgb(0x1a0c0c), gauss(x - s * 0.008, y - nny, 0.0045, 0.0035))
        c = mix(c, vyber['rana'], 0.35 * gauss(x, y - p['nos_y'], 0.02, 0.014))
        for s in (-1, 1):                                                                      # tien po bokoch nosa
            c = mix(c, vyber['modrina'], 0.55 * gauss(x - s * 0.016, y - (p['nos_y'] + 0.022), 0.006, 0.03))
        c = mix(c, rgb(0x2a1a18), 0.5 * gauss(x, y - nny + 0.006, 0.016, 0.004))              # tien pod nosom
        for ex, ey in oci:                                                                     # tmave obocie bez chlpov
            c = mix(c, vyber['modrina'], 0.4 * gauss(x - ex, y - ey - 0.026, 0.024, 0.006))
        return c

    farbi(siet(T.mriezka(), M['koza'], uzol, meno='tvar_koza'), farba_tvare)

    # ---------- oci ----------
    r = p['r_oka']
    for i, (ex, ey) in enumerate(oci):
        druh, s = p['oci'][i], (-1 if i == 0 else 1)
        z = T.predok(ex, ey)
        if druh in ('ludske', 'cierne', 'slepe'):
            stred = (ex, ey, z - r * 0.45)
            bielko = {'ludske': 0xb9ac94, 'cierne': 0x0c0a0a, 'slepe': 0x9aa39c}[druh]
            farbi(diel('gula', M['oko'], uzol, stred, (r * 2, r * 1.75, r * 2), segm=14, hladky=0, meno='oko'), bielko)
            for p_ in bpy.context.collection.objects[-1].data.polygons:
                p_.use_smooth = True
            px = ex + (0.004 if i == 0 else -0.001) * (1 if seed % 2 else -1.6)               # kazde oko hladi kusok inam
            py = ey + (0.001 if i == 0 else -0.003)
            if druh == 'ludske':
                farbi(diel('gula', M['oko'], uzol, (px, py, stred[2] + r * 0.9), (0.012, 0.012, 0.006), hladky=1, segm=8), 0x5d6a52)
                farbi(diel('gula', M['diera'], uzol, (px, py, stred[2] + r * 0.9 + 0.0028), (0.0045, 0.0045, 0.002), hladky=1, segm=8), 0x020202)
            elif druh == 'cierne':
                farbi(diel('gula', M['svit'], uzol, (px, py, stred[2] + r * 0.98), (0.0045, 0.0045, 0.003), hladky=1, segm=8), 0xd8d2b8)
            else:
                farbi(diel('gula', M['oko'], uzol, (px, py, stred[2] + r * 0.92), (0.014, 0.014, 0.005), hladky=1, segm=8), 0xc6cbc2)
            for znak, hr in ((1, 0.78), (-1, 0.82)):                                           # viecka
                body = []
                for k in range(9):
                    a = -1 + 2 * k / 8
                    bx, by = ex + a * r * 1.18, ey + znak * r * hr * math.sqrt(max(0, 1 - a * a))
                    body.append((bx, by, max(T.predok(bx, by) + 0.0015, stred[2] + r * 0.9 * math.sqrt(max(0.05, 1 - a * a))),
                                 0.0042 if abs(a) < 0.9 else 0.002))
                farbi(trubica(body, M['koza'], uzol, K=6, hladky=0, meno='viecko'), lambda w, l: mix(koza_farba(w, ['hlava']), vyber['modrina'], 0.55))
        elif druh == 'zasite':
            body = na_tvar(T, [(ex + a * 0.021, ey - 0.004 * (1 - a * a), 0.0028) for a in [k / 4 - 1 for k in range(9)]], 0.001)
            farbi(trubica(body, M['nit'], uzol, K=5, hladky=0), 0x23100f)
            for k in range(5):                                                                 # stehy do kriza
                sx = ex - 0.017 + k * 0.0085 + rnd.uniform(-0.002, 0.002)
                nak = rnd.uniform(-0.006, 0.006)
                body = na_tvar(T, [(sx - nak, ey + 0.014, 0.0016), (sx, ey - 0.002, 0.0022), (sx + nak, ey - 0.017, 0.0016)], 0.004)
                farbi(trubica(body, M['nit'], uzol, K=4, hladky=0), 0x15100c)

    # ---------- usta: zuby ----------
    mw, mh, my = p['mw'], p['mh'], p['my']
    if p['zuby']:
        for znak in (1, -1):
            n = p['zuby'] + (0 if znak > 0 else -1)
            for k in range(n):
                if rnd.random() < 0.09:
                    continue                                                                   # vypadnuty zub
                a = -0.86 + 1.72 * k / max(1, n - 1)
                x = a * mw + rnd.uniform(-0.0015, 0.0015)
                okraj = my + p['usmev'] * a * a + znak * mh * math.sqrt(max(0.05, 1 - a * a))
                d = min(0.022, mh * 0.85) * rnd.uniform(0.65, 1.15) if mh > 0.006 else rnd.uniform(0.007, 0.011)
                zz = T.predok(x, okraj + znak * 0.006) - 0.007
                sir = 1.72 * mw / n * rnd.uniform(0.7, 0.92)
                farbi(diel('kocka', M['zuby'], uzol, (x, okraj - znak * d * 0.4, zz), (sir, d, 0.006),
                           rot=(0, a * 0.5, rnd.uniform(-0.12, 0.12)), meno='zub'),
                      rnd.choice((0xb7a882, 0xa99a72, 0xc2b596, 0x8a7a55)))
    if p['usta_zasite']:
        body = na_tvar(T, [(a * mw * 1.1, my + p['usmev'] * a * a, 0.0022) for a in [k / 6 - 1 for k in range(13)]], 0.002)
        farbi(trubica(body, M['nit'], uzol, K=5, hladky=0), 0x2a1210)
        for k in range(7):
            sx = mw * (-0.9 + 0.3 * k)
            y0 = my + p['usmev'] * (sx / mw) ** 2
            nak = rnd.uniform(-0.007, 0.007)
            body = na_tvar(T, [(sx - nak, y0 + 0.017, 0.0017), (sx, y0, 0.0026), (sx + nak, y0 - 0.017, 0.0017)], 0.005)
            farbi(trubica(body, M['nit'], uzol, K=4, hladky=0), 0x181009)

    # ---------- usi (male, nizko posadene) ----------
    for s in (-1, 1):
        if rnd.random() < 0.22:
            continue                                                                           # chyba ucho
        diel('gula', M['koza'], uzol, (s * W * p['sirka'] * 0.98, p['ey'] - 0.035, 0.0), (0.018, 0.058, 0.036), rot=(0.25, s * 0.25, 0), hladky=1, segm=10, meno='ucho')

    # ---------- maska cez cast tvare ----------
    je_maska = p['maska']
    if je_maska:
        def zmaska(x, y):
            return max(T.predok(x, y, False) + 0.011, T.predok(x, y) + 0.006)
        NX, NY = 34, 42
        y0, y1 = CY - H * p['vyska'] * 0.93, CY + H * p['vyska'] * 0.9
        riadky = []
        for i in range(NY + 1):
            y = y0 + (y1 - y0) * i / NY
            uy = (y - CY) / (H * p['vyska'])
            sir = W * p['sirka'] * (1 - (1 - p['brada']) * (-uy) ** 1.6 if uy < 0 else 1) * math.sqrt(max(0, 1 - uy * uy)) * 0.88
            riadky.append([(sir * (-1 + 2 * j / NX), y, zmaska(sir * (-1 + 2 * j / NX), y)) for j in range(NX + 1)])

        def prec(s):
            x, y = s[0], s[1]
            jx, jy = x + 0.006 * sum3((x, y, 0), 60, seed), y + 0.006 * sum3((y, x, 0), 60, seed + 3)
            if not je_maska(jx, jy):
                return True
            return any(math.hypot((x - hx) / rx, (y - hy) / ry) < 1 for hx, hy, rx, ry in p['maska_diery'])

        zakl = rgb(p['maska_farba'])

        def farba_masky(w, l):
            x, y, z = l
            c = mix(zakl, rgb(0x6b5a40), 0.9 * max(0, sum3(w, 22, seed)))
            c = mix(c, rgb(0x3a3428), 0.7 * max(0, sum3(w, 55, seed + 7) - 0.15))
            for hx, hy, rx, ry in p['maska_diery']:
                c = mix(c, rgb(0x1a0f0a), hladko(1.9, 1.0, math.hypot((x - hx) / rx, (y - hy) / ry)))
            for ex, ey in oci:                                                                 # zatecene "slzy"
                if y < ey - 0.01:
                    c = mix(c, rgb(0x33211a), 0.75 * math.exp(-((x - ex - 0.006 * sum3((y, 0, 0), 30)) / 0.0055) ** 2) * hladko(ey - 0.13, ey - 0.02, y))
            return c

        farbi(siet(riadky, M['maska'], uzol, uzavrete=False, vynechaj=prec, meno='maska', okraj=4), farba_masky)
        pocet = 0
        for pokus in range(200):                                                               # praskliny len na maske
            if pocet >= p['praskliny']:
                break
            x, y = rnd.uniform(-0.075, 0.075), rnd.uniform(y0 + 0.03, y1 - 0.02)
            if not je_maska(x, y):
                continue
            body, smer = [], rnd.uniform(0, math.tau)
            for k in range(9):
                if not je_maska(x, y) or abs(x) > 0.085:
                    break
                body.append((x, y, zmaska(x, y) + 0.0012, 0.0021 * (1 - k / 10)))
                smer += rnd.uniform(-0.8, 0.8)
                x, y = x + math.cos(smer) * 0.011, y + math.sin(smer) * 0.011
            if len(body) > 3:
                farbi(trubica(body, M['diera'], uzol, K=4, hladky=0, meno='prasklina'), 0x140d08)
                pocet += 1

    if p['vlasy']:
        vlasy(uzol, T, M, p['vlasy'], seed + 11)


def vlasy(uzol, T, M, v, seed):
    """Ploche prieme pramene: zacinaju na lebke, idu po nej dole a potom volne visia."""
    rnd = random.Random(seed)
    spravene = 0
    for pokus in range(v['pocet'] * 4):
        if spravene >= v['pocet']:
            break
        fi = rnd.uniform(-math.pi, math.pi)
        lat = rnd.uniform(0.25, 1.45)
        cez = abs(fi) < 1.25 and rnd.random() < v.get('cez_tvar', 0.03)                          # par pramenov cez tvar
        if abs(fi) < 1.25 and not cez:
            fi = math.copysign(rnd.uniform(1.25, 1.75), fi)                                    # cesticka: vlasy padaju popri tvari
        if v.get('strana') and math.sin(fi) * v['strana'] < -0.15:
            continue                                                                           # vlasy len na jednej strane
        body, d, sirka = [], v['dlzka'] * rnd.uniform(0.45, 1.15), rnd.uniform(0.0014, 0.0042)
        for k in range(4):                                                                     # po lebke
            l = lat * (1 - k / 3) - 0.05 * k / 3 if not cez else lat - (lat - 0.5) * k / 3
            x, y, z = T.bod((math.sin(fi) * math.cos(l), math.sin(l), math.cos(fi) * math.cos(l)), False)
            body.append(Vector((x * 1.07, y + 0.007, (z - CZ) * 1.07 + CZ)))
        koniec = body[-1]
        for k in range(1, 6):                                                                  # volne visia, mierne sa vlnia
            t = k / 5
            body.append(Vector((koniec.x * (1 + 0.12 * t) + 0.018 * sum3((fi, t, 0), 3.1, seed),
                                koniec.y - d * t,
                                koniec.z + 0.018 * sum3((t, fi, 0), 2.7, seed + 5) + (0.02 * t if abs(fi) < 1.3 else -0.015 * t))))
        bok = Vector((math.cos(fi), 0, -math.sin(fi)))
        riadky = [[tuple(b - bok * sirka * (1 - 0.85 * i / len(body))), tuple(b + bok * sirka * (1 - 0.85 * i / len(body)))] for i, b in enumerate(body)]
        farbi(siet(riadky, M['vlasy'], uzol, uzavrete=False, meno='pramen'), v['farba'])
        spravene += 1


def rohy(uzol, M):
    """Matka: veniec z kosti."""
    for s in (-1, 1):
        body = [(s * (0.075 + 0.17 * math.sin(t * 0.9)), 0.255 + 0.19 * (1 - math.cos(t)), -0.025 * t, 0.024 * (1 - t / 3.2) + 0.004)
                for t in [k / 10 * 2.2 for k in range(11)]]
        farbi(trubica(body, M['maska'], uzol, K=7, hladky=0, meno='roh'), 0x8d7f62)
        for k in (3, 5, 7):
            x, y, z, r = body[k]
            farbi(trubica([(x, y, z, r * 0.8), (x + s * 0.05, y + 0.012, z - 0.02, r * 0.4), (x + s * 0.075, y + 0.06, z - 0.03, 0.001)],
                          M['maska'], uzol, K=5, hladky=0, meno='vybezok'), 0x796b50)
    for x, d in ((-0.05, 0.085), (0.0, 0.12), (0.05, 0.085)):                                  # tri hroty nad celom
        farbi(trubica([(x, 0.27, 0.07, 0.012), (x * 1.25, 0.27 + d * 0.6, 0.075, 0.007), (x * 1.5, 0.27 + d, 0.06, 0.001)],
                      M['maska'], uzol, K=5, hladky=0, meno='hrot'), 0x85775b)
