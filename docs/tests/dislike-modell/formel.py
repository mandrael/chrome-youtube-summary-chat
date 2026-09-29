"""Formel statt Tabelle: logit(Dislike-Anteil) linear in log10(Likes/Aufrufe) und log10(Aufrufe).

Kleinste Quadrate auf dem Logit, gelernt an Datei A, geprüft an Datei B – dieselben
Kennzahlen wie analyse.py, damit die Varianten vergleichbar sind.
"""
import math
import sys

from analyse import bewerte, lese


def logit(s):
    s = min(max(s, 1e-4), 1 - 1e-4)
    return math.log(s / (1 - s))


def kq(X, y):
    # Normalgleichungen, klein genug für reines Python (3x3).
    k = len(X[0])
    A = [[sum(x[i] * x[j] for x in X) for j in range(k)] for i in range(k)]
    b = [sum(x[i] * t for x, t in zip(X, y)) for i in range(k)]
    for i in range(k):  # Gauss ohne Pivot, gut konditioniert
        for r in range(i + 1, k):
            f = A[r][i] / A[i][i]
            for c in range(i, k):
                A[r][c] -= f * A[i][c]
            b[r] -= f * b[i]
    w = [0.0] * k
    for i in reversed(range(k)):
        w[i] = (b[i] - sum(A[i][c] * w[c] for c in range(i + 1, k))) / A[i][i]
    return w


def main(a, b):
    lern, pruef = list(lese(a)), list(lese(b))
    y = [logit(d / (l + d)) for _, l, d in lern]
    for name, merk in [
        ("Formel: Like-Rate", lambda v, l: [1, math.log10(l / v)]),
        ("Formel: Like-Rate + Aufrufe", lambda v, l: [1, math.log10(l / v), math.log10(v)]),
        ("Formel: + quadratisch", lambda v, l: [1, math.log10(l / v), math.log10(l / v) ** 2, math.log10(v)]),
    ]:
        w = kq([merk(v, l) for v, l, _ in lern], y)
        vor = lambda v, l, w=w, merk=merk: 1 / (1 + math.exp(-sum(a * x for a, x in zip(w, merk(v, l)))))
        bewerte(name, vor, pruef)
        print("   Koeffizienten:", [round(x, 4) for x in w])


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
