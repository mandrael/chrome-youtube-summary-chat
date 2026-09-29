"""Wie gut sagen Aufrufe und Likes die Dislikes voraus?

Daten: YouTube-Dislike-Archiv (archive.org, gespiegelt von ClickHouse in S3), Stand
Ende 2021 – letzte Zeit mit echten Dislike-Zahlen. Datei A lernt, Datei B prüft.
"""
import json
import math
import statistics
import subprocess
import sys
from collections import defaultdict

MIN_VIEWS = 1000
MIN_STIMMEN = 50  # darunter ist der wahre Anteil selbst zu verrauscht


def lese(pfad, grenze=None):
    p = subprocess.Popen(["zstd", "-dc", pfad], stdout=subprocess.PIPE, text=True)
    n = 0
    for zeile in p.stdout:
        try:
            r = json.loads(zeile)
        except ValueError:
            continue
        v, l, d = r.get("view_count"), r.get("like_count"), r.get("dislike_count")
        if not (isinstance(v, int) and isinstance(l, int) and isinstance(d, int)):
            continue
        if v < MIN_VIEWS or l + d < MIN_STIMMEN or l == 0:
            continue
        yield v, l, d
        n += 1
        if grenze and n >= grenze:
            break
    p.kill()


def merkmal(v, l):
    return math.log10(l / v)


BIN = 0.1  # Breite in log10(Likes/Aufrufe)


def lerne(daten):
    faecher = defaultdict(list)
    for v, l, d in daten:
        faecher[round(merkmal(v, l) / BIN)].append(d / (l + d))
    return {k: statistics.median(s) for k, s in faecher.items() if len(s) >= 30}, {
        k: len(s) for k, s in faecher.items()
    }


def schaetze(tabelle, v, l):
    k = round(merkmal(v, l) / BIN)
    if k in tabelle:
        return tabelle[k]
    naechster = min(tabelle, key=lambda x: abs(x - k))
    return tabelle[naechster]


def bewerte(name, vorhersage, pruef):
    fehler_pp, faktor2, faktor15 = [], 0, 0
    for v, l, d in pruef:
        s = vorhersage(v, l)
        d_dach = l * s / (1 - s)
        wahr = d / (l + d)
        fehler_pp.append(abs(s - wahr) * 100)
        q = (d_dach + 1) / (d + 1)
        faktor2 += 0.5 <= q <= 2
        faktor15 += 1 / 1.5 <= q <= 1.5
    n = len(pruef)
    fehler_pp.sort()
    print(
        f"{name:28s} n={n}  Anteil-Fehler Median {statistics.median(fehler_pp):.2f} pp, "
        f"80.-Perzentil {fehler_pp[int(n * 0.8)]:.2f} pp | Dislikes innerhalb Faktor 1,5: "
        f"{100 * faktor15 / n:.0f} %, Faktor 2: {100 * faktor2 / n:.0f} %"
    )


if __name__ == "__main__":
    a, b = sys.argv[1], sys.argv[2]
    lern = list(lese(a))
    pruef = list(lese(b))
    print(f"Lerndaten {len(lern)}, Prüfdaten {len(pruef)}")
    tabelle, zahl = lerne(lern)
    global_median = statistics.median(d / (l + d) for _, l, d in lern)
    bewerte("Basis: globaler Median", lambda v, l: global_median, pruef)
    bewerte("Modell: Likes/Aufrufe", lambda v, l: schaetze(tabelle, v, l), pruef)
    print("\nTabelle log10(Likes/Aufrufe) -> Median Dislike-Anteil (n):")
    for k in sorted(tabelle):
        print(f"  {k * BIN:+.1f}  ({100 * 10 ** (k * BIN):.3f} % Like-Rate)  {100 * tabelle[k]:5.2f} %  n={zahl[k]}")
    json.dump({str(k): tabelle[k] for k in sorted(tabelle)}, open("/tmp/dislike-modell/tabelle.json", "w"))
