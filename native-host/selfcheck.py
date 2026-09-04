#!/usr/bin/env python3
"""Selbstpruefung des Native-Hosts. Aufruf: python3 selfcheck.py

Geprueft wird, was still falsch sein koennte: der Parser fuer die parakeet-mlx-
Ausgabe, der Video-ID-Filter, der Nachrichtenrahmen und die Installation der
Standardroute (venv, sherpa-onnx, Modelldateien). Kein Test-Framework.
"""
import json
import os
import re
import struct
import subprocess
import sys
from pathlib import Path

HIER = Path(__file__).parent
sys.path.insert(0, str(HIER))
from yt_summary_host import (  # noqa: E402
    MODELS_WITH_TIMESTAMPS,
    STT_MODELS,
    VIDEO_ID,
    parse_parakeet_segments,
    primeline_ordner,
)

checks = 0


def check(name, fn):
    global checks
    fn()
    checks += 1
    print("  ok:", name)


print("parakeet-Parser")


def _real_shape():
    # Real gemessene Ausgabe von parakeet-mlx 0.5.2 (01.09.2026): Schluessel
    # "sentences", und start/end kommen als STRINGS, nicht als Zahlen.
    data = {
        "text": "This is a three. It's sloppily written.",
        "sentences": [
            {"text": " This is a three.", "start": "4.16", "end": "5.68",
             "duration": "1.52", "confidence": "0.982", "tokens": []},
            {"text": " It's sloppily written.", "start": "5.68", "end": "14.0",
             "duration": "8.32", "confidence": "0.995", "tokens": []},
        ],
    }
    segs = list(parse_parakeet_segments(data))
    assert len(segs) == 2, segs
    assert segs[0] == {"start": 4.16, "end": 5.68, "text": "This is a three."}, segs[0]
    assert isinstance(segs[1]["start"], float)


check("echtes Ausgabeformat mit String-Zeiten", _real_shape)


def _other_shapes():
    # Das Ausgabeschema des CLI ist nicht als Schnittstelle zugesagt. Diese Formen
    # sind ebenfalls plausibel und duerfen nicht in einen Fehler laufen.
    assert len(list(parse_parakeet_segments({"segments": [
        {"start": 1, "end": 2, "text": "a"}]}))) == 1
    assert len(list(parse_parakeet_segments([
        {"start_time": 0, "end_time": 1, "text": "a"}]))) == 1
    # Nichts Brauchbares darin: leer statt Ausnahme.
    assert list(parse_parakeet_segments({"text": "nur Text"})) == []
    assert list(parse_parakeet_segments(None)) == []
    assert list(parse_parakeet_segments({"sentences": [{"start": 1, "text": "  "}]})) == []
    assert list(parse_parakeet_segments({"sentences": [{"text": "ohne Zeit"}]})) == []


check("abweichende und kaputte Formen", _other_shapes)


def _end_missing():
    # Fehlt end, wird start eingesetzt - ein Segment der Laenge 0 statt eines Absturzes.
    segs = list(parse_parakeet_segments({"sentences": [{"start": "3.5", "text": "x"}]}))
    assert segs == [{"start": 3.5, "end": 3.5, "text": "x"}], segs


check("fehlendes end", _end_missing)

print("Eingaben")


def _video_id():
    assert VIDEO_ID.match("jNQXAC9IVRw")
    assert VIDEO_ID.match("aircAruvnKk")
    # Die ID landet in einer URL und einer Kommandozeile. Alles, was da nicht
    # hineingehoert, muss vorher scheitern.
    for bad in ("", "kurz", "../../etc/passwd", "abc; rm -rf /", "abc12345678901",
                "abc 1234567", "$(whoami)xxx"):
        assert not VIDEO_ID.match(bad), bad


check("Video-ID-Filter", _video_id)

print("Routen")


def _routes():
    assert set(STT_MODELS) == {"openrouter-whisper-turbo", "openrouter-parakeet"}
    # Real gemessen: parakeet-tdt-0.6b-v3 lehnt verbose_json mit HTTP 400 ab.
    # Nur whisper-turbo darf deshalb Zeitstempel anfordern.
    assert MODELS_WITH_TIMESTAMPS == {"openai/whisper-large-v3-turbo"}
    assert STT_MODELS["openrouter-parakeet"] not in MODELS_WITH_TIMESTAMPS


check("nur whisper-turbo fordert Zeitstempel an", _routes)

print("Rahmen")


def _framing():
    msg = {"type": "ping"}
    data = json.dumps(msg).encode()
    frame = struct.pack("<I", len(data)) + data
    (length,) = struct.unpack("<I", frame[:4])
    assert json.loads(frame[4:4 + length].decode()) == msg


check("4-Byte-Laengenpraefix, little endian", _framing)

print("Standardroute parakeet-primeline")

# Gefragt ist nicht das Python, das diesen Selbsttest ausfuehrt, sondern das, mit dem
# run-host.sh bzw. run-host.bat den Host startet. Deshalb wird der Wrapper gelesen und
# nicht der Pfad ein zweites Mal berechnet - sonst koennte hier venv B bestehen, waehrend
# Chrome venv A startet.
if sys.platform.startswith("win"):
    WRAPPER = HIER / "run-host.bat"
    MUSTER_PY = re.compile(r'^"([^"]+python\.exe)" "', re.M)
    MUSTER_BASIS = re.compile(r'^set "YT_SUMMARY_BASIS=(.+)"\s*$', re.M)
else:
    WRAPPER = HIER / "run-host.sh"
    MUSTER_PY = re.compile(r'^exec "([^"]+)" "', re.M)
    MUSTER_BASIS = re.compile(r'^export YT_SUMMARY_BASIS="([^"]+)"', re.M)


def _wrapper():
    assert WRAPPER.is_file(), (
        f"{WRAPPER.name} fehlt - install-macos.sh bzw. install-windows.ps1 ist noch "
        "nicht gelaufen.")
    text = WRAPPER.read_text()
    py = MUSTER_PY.search(text)
    basis = MUSTER_BASIS.search(text)
    assert py and basis, f"{WRAPPER.name} hat nicht die erwartete Form (Installer erneut ausfuehren)."
    return Path(py.group(1)), basis.group(1)


def _venv():
    venv_py, basis = _wrapper()
    assert venv_py.is_file(), f"venv-Python aus {WRAPPER.name} fehlt: {venv_py}"
    res = subprocess.run([str(venv_py), "-c", "import sherpa_onnx, numpy"],
                         capture_output=True, text=True,
                         env={**os.environ, "YT_SUMMARY_BASIS": basis})
    assert res.returncode == 0, (
        "sherpa-onnx oder numpy fehlt im venv, Installer erneut ausfuehren. "
        f"Ausgabe: {res.stderr.strip()[-300:]}")


check("Wrapper zeigt auf ein venv mit sherpa-onnx und numpy", _venv)


def _modell():
    # Mit dem Basisordner aus dem Wrapper, so wie der Host ihn unter Chrome sieht.
    os.environ["YT_SUMMARY_BASIS"] = _wrapper()[1]
    ordner = primeline_ordner()
    fehlend = [n for n in ("encoder.int8.onnx", "decoder.int8.onnx",
                           "joiner.int8.onnx", "tokens.txt")
               if not (ordner / n).is_file() or (ordner / n).stat().st_size == 0]
    assert not fehlend, f"Modelldateien fehlen in {ordner}: {', '.join(fehlend)}"


check("vier Modelldateien vorhanden", _modell)

print(f"\n{checks} Pruefungen bestanden.")
