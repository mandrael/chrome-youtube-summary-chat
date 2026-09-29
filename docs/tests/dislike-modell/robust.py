"""Gerade durch die Mediane je Like-Raten-Stufe (robust gegen Videos mit 0 Dislikes)
und die Tabelle mit linearer Interpolation – beide an denselben Prüfdaten gemessen."""
import json
import math
import sys

from analyse import BIN, bewerte, lerne, lese


def main(a, b):
    lern, pruef = list(lese(a)), list(lese(b))
    tabelle, zahl = lerne(lern)
    xs = [k * BIN for k in tabelle]
    ys = [math.log(tabelle[k] / (1 - tabelle[k])) for k in tabelle]
    ws = [zahl[k] for k in tabelle]
    sw = sum(ws)
    mx = sum(w * x for w, x in zip(ws, xs)) / sw
    my = sum(w * y for w, y in zip(ws, ys)) / sw
    steigung = sum(w * (x - mx) * (y - my) for w, x, y in zip(ws, xs, ys)) / sum(
        w * (x - mx) ** 2 for w, x in zip(ws, xs)
    )
    achse = my - steigung * mx
    print(f"Gerade durch Mediane: logit = {achse:.4f} + {steigung:.4f} * log10(L/V)")
    gerade = lambda v, l: 1 / (1 + math.exp(-(achse + steigung * math.log10(l / v))))
    bewerte("Gerade durch Mediane", gerade, pruef)

    punkte = sorted((k * BIN, tabelle[k]) for k in tabelle)

    def interpoliert(v, l):
        x = math.log10(l / v)
        if x <= punkte[0][0]:
            return punkte[0][1]
        if x >= punkte[-1][0]:
            return punkte[-1][1]
        for (x0, y0), (x1, y1) in zip(punkte, punkte[1:]):
            if x0 <= x <= x1:
                return y0 + (y1 - y0) * (x - x0) / (x1 - x0)

    bewerte("Tabelle interpoliert", interpoliert, pruef)
    for x in (-3, -2, -1):
        print(f"  Like-Rate {100 * 10 ** x:g} %: Gerade {100 * gerade(1, 10 ** x):.2f} %")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
