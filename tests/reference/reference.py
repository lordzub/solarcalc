"""
Independent reference implementation for the golden tests.

Written separately from the TypeScript engine. Rule and tariff values are typed in here
from the research brief (not read from src/data), so a data-entry error in the JSON
files is caught as well as a logic error.

Run: python3 tests/reference/reference.py > tests/golden.json
"""
import json
import math

HOURS, DAYS = 8760, 365
LAT = math.radians(52.1)
LON = 5.2
PV_MONTH_SHARE = [2.6, 4.6, 8.0, 11.5, 13.4, 13.3, 13.2, 11.6, 9.0, 6.3, 3.3, 2.0]
MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
DST_START, DST_END = 86, 303
BASE = [0.55, 0.5, 0.45, 0.45, 0.45, 0.5, 0.7, 1.0, 1.0, 0.8, 0.75, 0.75, 0.85, 0.75, 0.7, 0.75, 0.9, 1.3, 1.7, 1.6, 1.5, 1.4, 1.1, 0.8]

# Rules and tariffs, typed from the research brief (2027, incl. 21% VAT unless noted).
VAT = 0.21
EB_2027 = 0.08802          # excl. VAT, voorstel
MIN_SHARE = 0.5
TLK_2026 = 0.146                         # energievergelijk.nl: average new 2026 contracts, EUR 0.109-0.182
PRICE = 0.31
SUPPLIERS = {               # (vergoeding, kosten) in EUR/kWh incl. VAT
    'Vattenfall': (0.0934, 0.0536),
    'Eneco': (0.0890, 0.0453),
    'Greenchoice': (0.0844, 0.0819),
}
BEST = 'Eneco'              # highest net in the brief's table (4.37 ct)
BATTERIES = {
    'stekker': dict(cap=2.7, power=0.8, rte=0.88, standby=10, price=1195, life=10, degr=0.02),
    'batterij5': dict(cap=5.12, power=2.5, rte=0.88, standby=15, price=1650, life=10, degr=0.02),  # 1250 + ~400 own circuit
    'batterij10': dict(cap=10, power=3.7, rte=0.9, standby=25, price=5500, life=15, degr=0.015),
}

U32 = 0xFFFFFFFF


def imul(a, b):
    return (a * b) & U32


def mulberry32(seed):
    state = [seed & U32]

    def nxt():
        state[0] = (state[0] + 0x6D2B79F5) & U32
        t = state[0]
        t = imul(t ^ (t >> 15), t | 1)
        t = (t ^ ((t + imul(t ^ (t >> 7), t | 61)) & U32)) & U32
        return ((t ^ (t >> 14)) & U32) / 4294967296
    return nxt


def month_of_day(d):
    acc = 0
    for m, n in enumerate(MONTH_DAYS):
        acc += n
        if d < acc:
            return m
    return 11


def sun(d, h):
    off = 2 if DST_START <= d < DST_END else 1
    st = h + 0.5 - off + LON / 15
    decl = math.radians(23.44) * math.sin(2 * math.pi * (284 + d + 1) / 365)
    ha = math.radians((st - 12) * 15)
    s = math.sin(LAT) * math.sin(decl) + math.cos(LAT) * math.cos(decl) * math.cos(ha)
    return s ** 1.3 if s > 0 else 0.0


def pv_shape():
    rnd = mulberry32(2027)
    weather = []
    for _ in range(DAYS):
        u, v = rnd(), rnd()
        weather.append(0.12 + 0.35 * v if u < 0.38 else 0.6 + 0.6 * v)
    total = sum(PV_MONTH_SHARE)
    out = [0.0] * HOURS
    start = 0
    for m, nd in enumerate(MONTH_DAYS):
        vals = {}
        s = 0.0
        for d in range(start, start + nd):
            for h in range(24):
                v = sun(d, h) * weather[d]
                vals[d * 24 + h] = v
                s += v
        for i, v in vals.items():
            out[i] = v / s * (PV_MONTH_SHARE[m] / total)
        start += nd
    return out


def household(kind):
    out, s = [0.0] * HOURS, 0.0
    for d in range(DAYS):
        season = 1 + 0.18 * math.cos(2 * math.pi * (d - 15) / DAYS)
        weekend = (d + 4) % 7 >= 5
        for h in range(24):
            w = BASE[h]
            if 9 <= h <= 16:
                if weekend:
                    w *= 1.3
                if kind == 'overdag-thuis':
                    w *= 1.45
                if kind == 'zelden-thuis':
                    w *= 0.9 if weekend else 0.55
            w *= season
            out[d * 24 + h] = w
            s += w
    return [x / s for x in out]


def heat_pump():
    out, s = [0.0] * HOURS, 0.0
    for d in range(DAYS):
        temp = 10.5 - 7 * math.cos(2 * math.pi * (d - 15) / DAYS)
        dd = max(0.0, 15.5 - temp) + 0.6
        for h in range(24):
            w = dd * (1.4 if 6 <= h <= 9 else 0.9 if h <= 5 else 1)
            out[d * 24 + h] = w
            s += w
    return [x / s for x in out]


PV = pv_shape()


def profiles(c):
    hh = household(c['huishouden'])
    hp = heat_pump() if c['warmtepompKwh'] > 0 else None
    ev_hours = {'avond': [18, 19, 20, 21, 22], 'overdag': [10, 11, 12, 13, 14, 15]}.get(c['evMode'], [])
    pv = [x * c['opwek'] for x in PV]
    load = []
    for i in range(HOURS):
        v = hh[i] * c['verbruik']
        if ev_hours and (i % 24) in ev_hours:
            v += c['evKwh'] / (DAYS * len(ev_hours))
        if hp:
            v += hp[i] * c['warmtepompKwh']
        load.append(v)
    return pv, load


def shift(pv, load, share):
    out = list(load)
    if share <= 0:
        return out
    for d in range(DAYS):
        idx = range(d * 24, d * 24 + 24)
        day_use = sum(load[i] for i in idx)
        surplus = sum(pv[i] - load[i] for i in idx if pv[i] - load[i] > 0)
        donor = sum(load[i] for i in idx if pv[i] - load[i] <= 0)
        want = min(share * day_use, surplus, donor)
        if want <= 0:
            continue
        for i in idx:
            s = pv[i] - load[i]
            if s > 0:
                out[i] += want * s / surplus
            else:
                out[i] -= want * load[i] / donor
    return out


def simulate(pv, load, bat=None, share=0.0):
    load = shift(pv, load, share)
    eta = math.sqrt(bat['rte']) if bat else 1.0
    sb = bat['standby'] / 1000 if bat else 0.0
    soc = 0.0
    r = dict(opwek=0.0, direct=0.0, uit=0.0, afname=0.0, terug=0.0)
    for i in range(HOURS):
        p, u = pv[i], load[i]
        r['opwek'] += p
        d = min(p, u)
        r['direct'] += d
        sur, def_ = p - d, u - d
        if bat:
            if sur > 0:
                ch = min(sur, bat['power'], (bat['cap'] - soc) / eta)
                if ch > 0:
                    soc += ch * eta
                    sur -= ch
            if def_ > 0:
                out = min(def_, bat['power'], soc * eta)
                if out > 0:
                    soc -= out / eta
                    def_ -= out
                    r['uit'] += out
            if soc >= sb:
                soc -= sb
            else:
                def_ += sb - soc
                soc = 0.0
        r['afname'] += def_
        r['terug'] += sur
    return r


def cost_with(r, verg):
    net = r['afname'] - r['terug']
    energy = net * PRICE_[0] if net >= 0 else net * verg
    return energy + r['terug'] * TLK_2026


def cost_without(r, verg, kosten):
    return r['afname'] * PRICE_[0] - r['terug'] * (verg - kosten)


PRICE_ = [PRICE]


def payback(saving, price, degr):
    if saving <= 0:
        return None
    cum = 0.0
    for y in range(40):
        s = saving * (1 - degr) ** y
        if cum + s >= price:
            return y + (price - cum) / s
        cum += s
    return None


CASES = [
    dict(name='appartement', verbruik=1800, opwek=2100, huishouden='standaard', evKwh=0, evMode='geen', warmtepompKwh=0),
    dict(name='tussenwoning', verbruik=2900, opwek=3500, huishouden='standaard', evKwh=0, evMode='geen', warmtepompKwh=0),
    dict(name='warmtepomp', verbruik=2900, opwek=4900, huishouden='standaard', evKwh=0, evMode='geen', warmtepompKwh=2100),
    dict(name='ev-overdag', verbruik=3200, opwek=4200, huishouden='overdag-thuis', evKwh=2500, evMode='overdag', warmtepompKwh=0),
    dict(name='zelden-thuis', verbruik=2500, opwek=3500, huishouden='zelden-thuis', evKwh=0, evMode='geen', warmtepompKwh=0),
    dict(name='ev-avond', verbruik=3000, opwek=5000, huishouden='standaard', evKwh=3000, evMode='avond', warmtepompKwh=0),
]
CONTRACT_CASES = [('Vattenfall', 0.31), ('Eneco', 0.36), ('Greenchoice', 0.29)]

out = []
for c in CASES:
    pv, load = profiles(c)
    base = simulate(pv, load)
    for supplier, price in CONTRACT_CASES:
        PRICE_[0] = price
        verg, kos = SUPPLIERS[supplier]
        res = dict(
            metSalderen=round(cost_with(base, verg), 2),
            zonderSalderen=round(cost_without(base, verg, kos), 2),
            eigenverbruik=round((base['direct'] + base['uit']) / base['opwek'], 4),
            afname=round(base['afname'], 2), teruglevering=round(base['terug'], 2),
        )
        sh = simulate(pv, load, None, 0.1)
        res['verschuivenBesparing'] = round(cost_without(base, verg, kos) - cost_without(sh, verg, kos), 2)
        bv, bk = SUPPLIERS[BEST]
        res['overstappenBesparing'] = round(base['terug'] * ((bv - bk) - (verg - kos)), 2)
        for key, b in BATTERIES.items():
            rb = simulate(pv, load, b)
            saving = cost_without(base, verg, kos) - cost_without(rb, verg, kos)
            tvt = payback(saving, b['price'], b['degr'])
            res[key] = dict(besparing=round(saving, 2), terugverdientijd=None if tvt is None else round(tvt, 2),
                            eigenverbruik=round((rb['direct'] + rb['uit']) / rb['opwek'], 4))
        out.append(dict(case=c, contract=supplier, stroomprijs=price, terugleverkosten2026=TLK_2026, expected=res))

print(json.dumps(out, indent=1))
