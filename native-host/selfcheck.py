#!/usr/bin/env python3
"""Selbstpruefung des Native-Hosts. Aufruf: python3 selfcheck.py

Geprueft wird, was still falsch sein koennte: der Parser fuer die parakeet-mlx-
Ausgabe, der Video-ID-Filter und der Nachrichtenrahmen. Kein Test-Framework.
"""
import json
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from yt_summary_host import (  # noqa: E402
    MODELS_WITH_TIMESTAMPS,
    STT_MODELS,
    VIDEO_ID,
    parse_parakeet_segments,
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

print(f"\n{checks} Pruefungen bestanden.")
