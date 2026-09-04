# Einschätzung: Sind die primeline-CoreML-Konvertierungen optimal? (Fable 5.1, 03.09.2026)

Auftrag: Technische Beurteilung von `ValentinWeyer/parakeet-primeline-de-coreml` und
`matt-2012/parakeet-primeline-de-coreml`, ohne eigene Messung – reine Einschätzung
anhand der gemessenen Zahlen und der Modell-Metadaten.

**Kurzfassung:** Beide Konvertierungen sind numerisch gleichwertig (4 Wörter
Unterschied bei 5434 sind fp16-Rauschen), aber keine ist optimal gebaut – 1,2 GB fp16
und ein Graph, der nicht vollständig auf der ANE läuft.

## Die 26-MB-Differenz

Bei identischer Tensorzahl (2888 fp16, 2 fp32 in beiden) ist der Größenunterschied
vermutlich nicht Präzision, sondern die Positional-Encoding-Tabelle: NeMo führt
einen Puffer für bis zu 5000 Positionen; eine der beiden Konvertierungen hat ihn aufs
15-Sekunden-Fenster zurechtgeschnitten, die andere nicht.

## Quantisierungspotenzial

- **Int8 linear per-channel:** ~600 MB, WER-Verlust praktisch null.
- **6-bit-LUT-Palettisierung** (macOS 15+, Gruppen-Palettisierung): ~460 MB,
  erwartbar 0,1–0,3 WER-Punkte Verlust – in der Größenordnung der gemessenen
  4-Wörter-Differenz zwischen den beiden bestehenden Konvertierungen.
- 4 Bit kostet sichtbar an Qualität.
- Tempo: Die ANE rechnet ohnehin in fp16; der Gewinn liegt bei Bandbreite und
  Ladezeit (3–4x schneller laden, 10–30 % schnellere Inferenz). Auf reiner CPU
  bringt Weight-only-Int8 nichts.
- Beides ist mit `coremltools.optimize` in Minuten machbar, **kein Training nötig**.

## `compute_units: CPU_ONLY` in den Metadaten

Kein Fehler – `coremltools` nutzt das Feld nur zur Validierung in Python, die
ausführende App wählt beim Laden selbst die Recheneinheit. Aber ein Indiz: Der
ANE-Pfad wurde beim Konvertieren offenbar nie geprüft.

## Die E5RT-Warnung beim Laden

`E5RT encountered an STL exception … ios17.slice_by_index: zero shape error` ist der
ANE-Compiler beim Partitionieren: Ein `slice_by_index` erzeugt einen Tensor mit
Nulldimension, typisch aus NeMos Cache-aware-Pfad (leerer Cache der Länge 0, dann
`concat`) oder dem Positional-Encoding-Slice. CoreML legt diese eine Operation dann
auf CPU/GPU statt ANE – das Ergebnis bleibt korrekt (deckt sich mit der Messung: 1352
Wörter, keine Lücke im Transkript), aber jede Partitionsgrenze kopiert Aktivierungen.
Bei 1,2 GB spürbar, wenn auch nicht dominant. Prüfbar mit dem Core-ML-Performance-
Report in Xcode; Fix vor dem Tracing: Cache-Support abschalten, feste 15-Sekunden-
Form erzwingen, den leeren Slice entfernen.

## Lohnt sich ein Fork?

**Als Engineering-Fork ja (1–3 Tage), als Modell-Fork nein.**

| Hebel | Erwartete Wirkung | Aufwand |
|---|---|---|
| 6-bit-Palettisierung + ANE-sauberer Graph | 1224 → ~480 MB, 0,1–0,3 WER-Punkte Verlust, 3–4x schnelleres Laden | Minuten, kein Training |
| Fenster-Stitching mit 2–3 s Overlap statt hartem Schnitt | behebt die Fensterungs-Schwäche, die auch die ONNX-Wege dieser Sitzung betraf | überschaubar |
| Deutsches n-gram-LM mit Beam Search | 5–10 % relative WER-Verbesserung | Wochen – eigene Beam-Suche in Swift plus KenLM |
| Neu- oder Nachtrainieren des Checkpoints | vielleicht 1–2 Punkte auf TEDx-artigem Material | GPU-Tage, lizenzierte In-Domain-Daten – für einen Fork unrealistisch |

## Getrennt-/Zusammenschreibungsfehler

Eine Modellentscheidung, keine Frage der Nachbearbeitung: Bei SentencePiece ist das
Leerzeichen Teil des Tokens, und genau diese knappen Entscheidungen kippen bei
fp16-Rauschen zuerst. Ein ITN- oder Punktuationsmodell verschiebt keine
Wortgrenzen – nur LM-Rescoring oder ein kleiner LLM-Post-Editor könnten das korrigieren.
Empfehlung: die WER-Messung leerzeichentolerant normalisieren (oder auf CER
umsteigen), um echte Fehler von Wortgrenzen-Rauschen zu trennen.

## Einordnung für dieses Projekt

Kein Fork geplant – der Aufwand (1–3 Tage für ~460 MB und 0,1–0,3 Punkte) steht in
keinem Verhältnis zum Nutzen für eine Chrome-Erweiterung, die ohnehin über
sherpa-onnx (plattformübergreifend) ausliefert. Als Notiz für den Fall, dass der
CoreML-Weg später ausgeliefert wird (siehe offene Entscheidung in
[status.md](../status.md)).
