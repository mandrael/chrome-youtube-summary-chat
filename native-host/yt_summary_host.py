#!/usr/bin/env python3
"""Native-Messaging-Host fuer den Audio-Fallback von YouTube Summary Chat.

Nur im GitHub-Build der Extension. Er wird ausschliesslich nach einem Klick des
Nutzers gestartet, nie automatisch.

Warum der Host die gesamte Arbeit macht und nicht nur herunterlaedt: Native
Messaging begrenzt eine Nachricht auf 1 MB. Base64-Audio sprengt das bei jedem
Video, das laenger als ein paar Sekunden dauert. Ueber den Kanal geht deshalb
nur fertiger Text.

Ablauf: yt-dlp laedt die Tonspur, ffmpeg wandelt nach Opus (Faktor 10 kleiner
als WAV - real gemessen: 5 Minuten sind 0,9 MB statt 9,6 MB), dann uebernimmt
die gewaehlte Route.

Protokoll: 4-Byte-Laengenpraefix (little endian) plus JSON, auf stdin/stdout.
"""

from __future__ import annotations

import base64
import json
import os
import re
import shutil
import signal
import struct
import subprocess
import sys
import tempfile
import threading
import urllib.error
import urllib.request
import wave
from pathlib import Path
from typing import Any, Iterator

VERSION = "0.1.0"
OPENROUTER_URL = "https://openrouter.ai/api/v1/audio/transcriptions"
REFERER = "https://github.com/mandrael/chrome-youtube-summary-chat"
TITLE = "YouTube Summary Chat"

# Ein einstuendiges Video sind bei 24 kbit/s rund 11 MB, base64 rund 15 MB. Das
# passt zwar meist noch in einen Request, laeuft aber je nach Provider ins
# Groessen- oder Zeitlimit. Zehn Minuten je Teil sind mit Abstand sicher.
#
# ponytail: harter Schnitt ohne Ueberlappung. An der Nahtstelle kann ein Wort
# verloren gehen. Wer das nicht will, laesst die Teile ueberlappen und mischt die
# Segmente - das kostet Code und bringt bei Vortragsaudio kaum etwas.
CHUNK_SECONDS = 600

STT_MODELS = {
    "openrouter-whisper-turbo": "openai/whisper-large-v3-turbo",
    "openrouter-parakeet": "nvidia/parakeet-tdt-0.6b-v3",
}

# Real gemessen (01.09.2026): parakeet-tdt-0.6b-v3 lehnt verbose_json mit HTTP 400
# ab - "The selected model does not support response_format verbose_json. Use json
# instead." Diese Route liefert deshalb keine Zeitstempel, und die Extension bietet
# fuer sie auch keine Sprungmarken an.
MODELS_WITH_TIMESTAMPS = {"openai/whisper-large-v3-turbo"}


# --------------------------------------------------------------------------
# Native-Messaging-Rahmen
# --------------------------------------------------------------------------

def read_message() -> dict[str, Any] | None:
    raw_len = sys.stdin.buffer.read(4)
    if len(raw_len) < 4:
        return None
    (length,) = struct.unpack("<I", raw_len)
    return json.loads(sys.stdin.buffer.read(length).decode("utf-8"))


def send(msg: dict[str, Any]) -> None:
    data = json.dumps(msg).encode("utf-8")
    if len(data) > 1_000_000:
        # Der Rahmen erlaubt 1 MB. Lieber eine ehrliche Fehlermeldung als eine
        # Nachricht, die Chrome kommentarlos verwirft.
        data = json.dumps(
            {"type": "error", "message": "Antwort ueberschreitet das 1-MB-Limit von Native Messaging."}
        ).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(data)))
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()


def progress(stage: str, message: str, percent: int | None = None) -> None:
    send({"type": "progress", "stage": stage, "message": message, "percent": percent})


# --------------------------------------------------------------------------
# Werkzeuge
# --------------------------------------------------------------------------

def which(name: str) -> str | None:
    found = shutil.which(name)
    if found:
        return found
    # Chrome startet den Host ohne das Login-Profil des Nutzers, deshalb fehlen
    # Homebrew und uv regelmaessig im PATH. Diese Orte werden zusaetzlich geprueft.
    extra = [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        str(Path.home() / ".local/bin"),
        str(Path.home() / ".cargo/bin"),
    ]
    for d in extra:
        p = Path(d) / name
        if p.is_file() and os.access(p, os.X_OK):
            return str(p)
    return None


def tool_status() -> dict[str, bool]:
    return {
        "yt-dlp": which("yt-dlp") is not None,
        "ffmpeg": which("ffmpeg") is not None,
        "parakeet-mlx": which("parakeet-mlx") is not None,
        "sherpa-onnx": sherpa_verfuegbar(),
    }


def sherpa_verfuegbar() -> bool:
    """sherpa-onnx ist ein Python-Paket, kein Programm - `which` findet es nicht."""
    try:
        import sherpa_onnx  # noqa: F401
    except Exception:
        return False
    return True


# Der gerade laufende Kindprozess (yt-dlp, ffmpeg), damit der Abbruch-Waechter ihn
# beenden kann. Es laeuft immer hoechstens einer.
_KIND: subprocess.Popen[str] | None = None


def run(cmd: list[str], **kw: Any) -> subprocess.CompletedProcess[str]:
    global _KIND
    # Eigene Prozessgruppe: yt-dlp startet selbst ffmpeg, und beim Abbruch muss die
    # ganze Gruppe weg, nicht nur das direkte Kind.
    if os.name == "nt":
        kw.setdefault("creationflags", subprocess.CREATE_NEW_PROCESS_GROUP)
    else:
        kw.setdefault("start_new_session", True)
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, **kw)
    _KIND = p
    try:
        out, err = p.communicate()
    finally:
        _KIND = None
    return subprocess.CompletedProcess(cmd, p.returncode, out, err)


def kinder_beenden_leise(p: subprocess.Popen[str]) -> None:
    try:
        if hasattr(os, "killpg"):
            os.killpg(p.pid, signal.SIGTERM)
        elif os.name == "nt":
            # p.kill() trifft nur yt-dlp, nicht dessen ffmpeg; taskkill /T nimmt den Baum.
            subprocess.run(["taskkill", "/T", "/F", "/PID", str(p.pid)], capture_output=True)
        else:
            p.kill()
    except OSError:
        pass


def kinder_beenden(*_: Any) -> None:
    p = _KIND
    if p is not None and p.poll() is None:
        kinder_beenden_leise(p)
    os._exit(1)


def abbruch_waechter() -> None:
    """Beendet den Kindprozess, sobald Chrome den Port trennt.

    Chrome schliesst dann stdin des Hosts (und schickt SIGTERM, falls er nicht von
    selbst endet). Ohne den Waechter bliebe der Host in communicate() haengen und
    yt-dlp luede nach „Abbrechen" in der Sidebar verwaist weiter. Pro Verbindung kommt
    genau eine Nachricht, deshalb darf der Waechter stdin bis zum Ende lesen.
    """
    def lauschen() -> None:
        sys.stdin.buffer.read()
        kinder_beenden()

    threading.Thread(target=lauschen, daemon=True).start()
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, kinder_beenden)


def require(name: str) -> str:
    path = which(name)
    if not path:
        raise HostError(
            f"{name} wurde nicht gefunden. Installation: "
            + ("brew install yt-dlp ffmpeg" if sys.platform == "darwin" else "winget install yt-dlp.yt-dlp")
        )
    return path


class HostError(Exception):
    pass


# --------------------------------------------------------------------------
# Untertitel per yt-dlp
# --------------------------------------------------------------------------

def fetch_subtitles(video_id: str, language: str | None, workdir: Path) -> dict[str, Any]:
    """Holt die Untertitelspur mit yt-dlp statt aus der Seite.

    Warum es diesen Weg gibt: eine nicht angemeldete Browser-Sitzung bekommt von
    YouTube keine Player-Daten mehr - der Server antwortet im Wortlaut mit
    "LOGIN_REQUIRED / Melde dich an, damit wir sehen, dass du kein Bot bist".
    Damit laufen alle browser-seitigen Wege ins Leere: der direkte timedtext-Abruf
    liefert HTTP 200 mit leerem Body, get_transcript einen HTTP 400, und YouTubes
    eigenes Transkript-Panel bleibt beim Klick leer.

    yt-dlp probiert dagegen mehrere InnerTube-Clients durch und kommt durch. Real
    gemessen am 01.09.2026: 286 Segmente mit Zeitstempeln fuer ein Video, bei dem
    im Browser kein einziger Weg etwas lieferte.

    Das ist ausserdem der billigste Weg ueberhaupt - keine Transkriptionskosten,
    kein Audio-Download, und die Zeitstempel stammen direkt von YouTube.
    """
    ytdlp = require("yt-dlp")
    progress("download", "Untertitel werden geholt …")

    # Nur EINE Sprache anfordern. Wer alle Spuren zieht, laeuft in HTTP 429.
    langs = language if language and language != "auto" else "en.*,de.*"

    res = run([
        ytdlp, "--write-subs", "--write-auto-subs",
        "--sub-langs", langs, "--sub-format", "json3",
        "--skip-download", "--no-playlist", "--no-warnings",
        "-o", str(workdir / "sub"),
        f"https://www.youtube.com/watch?v={video_id}",
    ])

    files = sorted(workdir.glob("sub*.json3"))
    if not files:
        # yt-dlp meldet den Grund oft nur auf stderr; der gehoert in die Fehlermeldung.
        detail = (res.stderr or res.stdout or "").strip()[-400:]
        raise HostError(
            "Für dieses Video liefert auch yt-dlp keine Untertitel."
            + (f"\n{detail}" if detail else "")
        )

    # Bevorzugt die manuell erstellte Spur: ihr Dateiname traegt kein "-orig"
    # und keine Uebersetzungs-Endung.
    chosen = min(files, key=lambda f: (".orig." in f.name, len(f.name)))
    segments = parse_json3(chosen.read_text(encoding="utf-8"))
    if not segments:
        raise HostError("Die Untertiteldatei war leer.")

    return {
        "segments": segments,
        "text": " ".join(s["text"] for s in segments),
        "route": f"YouTube-Untertitel ({chosen.name.replace('sub.', '').replace('.json3', '')}, via yt-dlp)",
    }


def parse_json3(body: str) -> list[dict[str, Any]]:
    """YouTubes json3-Format. Dieselbe Logik wie in der Extension, hier fuer den Host."""
    data = json.loads(body)
    out: list[dict[str, Any]] = []
    for ev in data.get("events") or []:
        start = ev.get("tStartMs")
        segs = ev.get("segs")
        if start is None or not segs:
            continue
        text = " ".join("".join(s.get("utf8", "") for s in segs).split()).strip()
        # Reine Positionierungs-Events ohne Text kommen regelmaessig vor.
        if not text:
            continue
        dur = ev.get("dDurationMs") or 0
        out.append({
            "start": start / 1000,
            "end": (start + dur) / 1000,
            "text": text,
        })
    return out


# --------------------------------------------------------------------------
# Audio holen
# --------------------------------------------------------------------------

def download_audio(video_id: str, workdir: Path) -> Path:
    ytdlp = require("yt-dlp")
    progress("download", "Tonspur wird geladen …")

    out = workdir / "audio.%(ext)s"
    # Fuer die Spracherkennung zaehlt die Abtastrate, nicht die Bitrate. Gemessen am
    # 02.09.2026 gegen eine unbeschleunigte Referenz: Opus mit 46 kbit/s und 48 kHz
    # liegt bei 0,4 % Wortfehlern, Opus mit 142 kbit/s bei 0,0 % - dafuer ist es ein
    # Drittel der Datenmenge. Die AAC-Spur mit 22 kHz Abtastrate (itag 139) faellt mit
    # 8,0 % durch und wird deshalb ausgeschlossen, obwohl sie die kleinste waere.
    #
    #   1. schmale 48-kHz-Spur (itag 249/250), das ist der Normalfall,
    #   2. sonst die beste Spur ab 44,1 kHz,
    #   3. sonst irgendeine - lieber schlechter Ton als gar keiner.
    fmt = "bestaudio[asr=48000][abr<=70]/bestaudio[asr>=44100]/bestaudio"
    res = run([ytdlp, "-f", fmt, "--no-playlist", "--no-warnings",
               "-o", str(out), f"https://www.youtube.com/watch?v={video_id}"])
    if res.returncode != 0:
        raise HostError(f"yt-dlp ist fehlgeschlagen:\n{(res.stderr or res.stdout)[-800:]}")

    files = [p for p in workdir.iterdir() if p.stem == "audio"]
    if not files:
        raise HostError("yt-dlp hat keine Datei erzeugt.")
    return files[0]


def to_opus(src: Path, dst: Path) -> None:
    """Mono, 16 kHz, 24 kbit/s Opus. Klein genug fuer die Cloud, gut genug fuer ASR."""
    ffmpeg = require("ffmpeg")
    progress("convert", "Audio wird gewandelt …")
    res = run([ffmpeg, "-y", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000",
               "-c:a", "libopus", "-b:a", "24k", str(dst)])
    if res.returncode != 0 or not dst.exists():
        raise HostError(f"ffmpeg ist fehlgeschlagen:\n{res.stderr[-800:]}")


def to_wav(src: Path, dst: Path) -> None:
    """16 kHz Mono PCM - das Format, das parakeet-mlx ohne Umwege verarbeitet."""
    ffmpeg = require("ffmpeg")
    progress("convert", "Audio wird gewandelt …")
    res = run([ffmpeg, "-y", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000",
               "-c:a", "pcm_s16le", str(dst)])
    if res.returncode != 0 or not dst.exists():
        raise HostError(f"ffmpeg ist fehlgeschlagen:\n{res.stderr[-800:]}")


def duration_seconds(path: Path) -> float:
    ffprobe = which("ffprobe")
    if not ffprobe:
        return 0.0
    res = run([ffprobe, "-v", "error", "-show_entries", "format=duration",
               "-of", "csv=p=0", str(path)])
    try:
        return float(res.stdout.strip())
    except ValueError:
        return 0.0


def split(path: Path, seconds: int, workdir: Path) -> list[tuple[Path, float]]:
    """Teilt in Abschnitte und gibt je Teil den Zeitversatz im Original zurueck."""
    total = duration_seconds(path)
    if total <= seconds:
        return [(path, 0.0)]

    ffmpeg = require("ffmpeg")
    parts: list[tuple[Path, float]] = []
    index = 0
    while index * seconds < total:
        offset = index * seconds
        part = workdir / f"part{index:03d}{path.suffix}"
        res = run([ffmpeg, "-y", "-ss", str(offset), "-t", str(seconds),
                   "-i", str(path), "-c", "copy", str(part)])
        if res.returncode != 0 or not part.exists() or part.stat().st_size == 0:
            break
        parts.append((part, float(offset)))
        index += 1
    return parts or [(path, 0.0)]


# --------------------------------------------------------------------------
# Routen
# --------------------------------------------------------------------------

def transcribe_openrouter(audio: Path, route: str, api_key: str,
                          language: str | None, workdir: Path) -> dict[str, Any]:
    model = STT_MODELS[route]
    wants_timestamps = model in MODELS_WITH_TIMESTAMPS

    parts = split(audio, CHUNK_SECONDS, workdir)
    segments: list[dict[str, Any]] = []
    texts: list[str] = []

    for i, (part, offset) in enumerate(parts, start=1):
        progress("transcribe", f"Transkription {i}/{len(parts)} …",
                 int((i - 1) / len(parts) * 100))

        body: dict[str, Any] = {
            "model": model,
            "input_audio": {
                "data": base64.b64encode(part.read_bytes()).decode(),
                "format": "ogg",
            },
        }
        if language:
            body["language"] = language
        if wants_timestamps:
            body["response_format"] = "verbose_json"
            body["timestamp_granularities"] = ["segment"]

        data = post_json(OPENROUTER_URL, body, api_key)

        for seg in data.get("segments") or []:
            if seg.get("start") is None:
                continue
            segments.append({
                "start": float(seg["start"]) + offset,
                "end": float(seg.get("end", seg["start"])) + offset,
                "text": (seg.get("text") or "").strip(),
            })
        if data.get("text"):
            texts.append(data["text"].strip())

    return {
        "segments": segments,
        "text": " ".join(texts),
        "route": f"{model} (OpenRouter)",
    }


def post_json(url: str, body: dict[str, Any], api_key: str) -> dict[str, Any]:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": REFERER,
            "X-Title": TITLE,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=900) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:500]
        raise HostError(f"OpenRouter HTTP {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise HostError(f"OpenRouter nicht erreichbar: {e.reason}") from e


def transcribe_parakeet_mlx(audio: Path, workdir: Path) -> dict[str, Any]:
    """Lokal auf Apple Silicon. Kein Server, kein Port - das CLI wird direkt gerufen.

    parakeet-mlx (senstella/parakeet-mlx, Apache-2.0) schreibt die Ausgabe in eine
    Datei neben dem Eingabefile; --output-format json enthaelt Segmentzeiten.
    """
    cli = which("parakeet-mlx")
    if not cli:
        raise HostError(
            "parakeet-mlx wurde nicht gefunden. Installation: uv tool install parakeet-mlx -U"
        )

    progress("transcribe", "Lokale Transkription läuft …")
    res = run([cli, str(audio), "--output-dir", str(workdir),
               "--output-format", "json", "--output-template", "out"],
              cwd=str(workdir))
    if res.returncode != 0:
        raise HostError(f"parakeet-mlx ist fehlgeschlagen:\n{(res.stderr or res.stdout)[-800:]}")

    out = workdir / "out.json"
    if not out.exists():
        candidates = sorted(workdir.glob("*.json"))
        if not candidates:
            raise HostError("parakeet-mlx hat keine JSON-Ausgabe erzeugt.")
        out = candidates[0]

    data = json.loads(out.read_text())
    return {
        "segments": list(parse_parakeet_segments(data)),
        "text": data.get("text", "") if isinstance(data, dict) else "",
        "route": "parakeet-tdt-0.6b-v3 (MLX, lokal)",
    }


MODELL_PRIMELINE = "x-ian/sherpa-onnx-parakeet-primeline-de-int8"


def primeline_ordner() -> Path:
    """Wo das deutsche Modell liegt. Ein fester Ort, damit es nur einmal geladen wird.

    Der Installer schreibt den Basisordner als YT_SUMMARY_BASIS in den Wrapper, weil
    Chrome den Host mit einer eigenen Umgebung startet, in der HOME, LOCALAPPDATA oder
    XDG_DATA_HOME von der Installationsumgebung abweichen koennen.
    """
    fest = os.environ.get("YT_SUMMARY_BASIS", "").strip()
    if fest:
        return Path(fest) / "parakeet-primeline-de"
    if sys.platform == "darwin":
        basis = Path.home() / "Library" / "Application Support"
    elif sys.platform.startswith("win"):
        basis = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    else:
        # XDG-Spezifikation: leer oder relativ gilt als nicht gesetzt.
        xdg = os.environ.get("XDG_DATA_HOME", "")
        basis = Path(xdg) if xdg and os.path.isabs(xdg) else Path.home() / ".local" / "share"
    return basis / "yt-summary-chat" / "parakeet-primeline-de"


def transcribe_primeline(audio: Path) -> dict[str, Any]:
    """Deutsches Spezialmodell ueber sherpa-onnx - laeuft auf macOS, Windows und Linux.

    Warum dieser Weg und nicht parakeet v3: v3 erkennt die Sprache selbst und laesst
    sich nicht darauf festlegen ("automatically detects the language ... without
    requiring additional prompting", NVIDIA-Modellkarte). Bei deutschen Vortraegen mit
    englischen Zitaten kippt es ins Englische und uebersetzt weiter, statt zu
    transkribieren. Gemessen an drei deutschen TEDx-Vortraegen (5434 Woerter,
    03.09.2026): primeline 9,3 Prozent Wortfehler, v3 auf demselben Weg 57,2 Prozent.

    Die Fensterung schneidet hart bei 120 s ohne Ueberlappung. Eine Ueberlappung, die
    nur aneinandergehaengt wird, transkribiert den Nahtbereich doppelt - gemessen 24
    ueberzaehlige Woerter und 1,8 Prozentpunkte schlechter.
    """
    try:
        import numpy as np
        import sherpa_onnx
    except Exception as e:
        raise HostError(
            "sherpa-onnx fehlt. Installation: pip install sherpa-onnx numpy"
        ) from e

    ordner = primeline_ordner()
    noetig = ("encoder.int8.onnx", "decoder.int8.onnx", "joiner.int8.onnx", 'tokens.txt')
    fehlend = [n for n in noetig if not (ordner / n).is_file()]
    if fehlend:
        raise HostError(
            f"Das deutsche Modell fehlt in {ordner}. Es sind rund 670 MB. "
            f"Fehlende Dateien: {', '.join(fehlend)}. "
            f"Bezugsquelle: https://huggingface.co/{MODELL_PRIMELINE}"
        )

    progress("transcribe", "Deutsche Spracherkennung laeuft ...")
    erkenner = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=str(ordner / "encoder.int8.onnx"),
        decoder=str(ordner / "decoder.int8.onnx"),
        joiner=str(ordner / "joiner.int8.onnx"),
        tokens=str(ordner / 'tokens.txt'),
        num_threads=4,
        provider="cpu",
        model_type="nemo_transducer",
        decoding_method="greedy_search",
    )

    with wave.open(str(audio)) as w:
        rate = w.getframerate()
        roh = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    proben = roh.astype(np.float32) / 32768.0

    fenster = 120 * rate
    segmente: list[dict[str, Any]] = []
    texte: list[str] = []
    for nr in range(0, len(proben), fenster):
        stueck = proben[nr:nr + fenster]
        versatz = nr / rate
        strom = erkenner.create_stream()
        strom.accept_waveform(rate, stueck)
        erkenner.decode_stream(strom)
        text = strom.result.text.strip()
        if not text:
            continue
        texte.append(text)
        marken = strom.result.timestamps or []
        # Die Wort-Zeitstempel kommen je Token. Fuer eine Sprungmarke genuegt der erste
        # Zeitpunkt des Stuecks; feiner braucht es die Seitenleiste nicht.
        segmente.append({
            "start": versatz + (marken[0] if marken else 0.0),
            "end": versatz + (marken[-1] if marken else len(stueck) / rate),
            "text": text,
        })

    return {
        "segments": segmente,
        "text": " ".join(texte),
        "route": "parakeet primeline (deutsch, lokal)",
    }


def list_formats(video_id: str) -> dict[str, Any]:
    """Welche Aufloesungen bietet dieses Video? Eine Zeile je Hoehe, groesste zuerst.

    yt-dlp --dump-json liefert alle Formate einzeln. Interessant sind nur die Hoehen,
    die die Oberflaeche anbietet; zu jeder wird die kleinste ausreichende Videospur
    genommen und die Groesse mit der besten Tonspur zusammengerechnet.
    """
    exe = require("yt-dlp")
    # Kein progress() hier: die Anfrage kommt per sendNativeMessage, und Chrome nimmt
    # dort genau eine Antwort - eine Fortschrittszeile davor waere die Antwort.
    res = run([exe, "--dump-json", "--no-warnings", f"https://www.youtube.com/watch?v={video_id}"])
    if res.returncode != 0:
        raise HostError(f"yt-dlp konnte die Formate nicht lesen:\n{res.stderr[-500:]}")
    daten = json.loads(res.stdout)

    formate = daten.get("formats") or []
    # Beste Tonspur fuer die Groessenrechnung - Video und Ton liegen bei YouTube ab
    # 480p getrennt vor und werden erst von ffmpeg zusammengefuegt.
    tonspuren = [f for f in formate if f.get("acodec") not in (None, "none")
                 and f.get("vcodec") in (None, "none")]
    ton_bytes = max((f.get("filesize") or f.get("filesize_approx") or 0)
                    for f in tonspuren) if tonspuren else 0

    nach_hoehe: dict[int, int] = {}
    for f in formate:
        hoehe = f.get("height")
        # Nur reine Videospuren: der Download waehlt bestvideo+bestaudio, eine bereits
        # gemuxte Spur bekaeme hier die Tonspur doppelt angerechnet.
        if not hoehe or f.get("vcodec") in (None, "none") or f.get("acodec") not in (None, "none"):
            continue
        groesse = f.get("filesize") or f.get("filesize_approx") or 0
        # Groesste bekannte Videospur je Hoehe: bestvideo nimmt den hochwertigsten Codec,
        # und der ist in der Regel auch der groesste. Unbekannt (0) verdraengt nie.
        nach_hoehe[hoehe] = max(nach_hoehe.get(hoehe, 0), groesse)

    angebot = [
        # Ohne Videogroesse keine Schaetzung - die Tonspur allein waere irrefuehrend.
        {"height": h, "bytes": nach_hoehe[h] + ton_bytes if nach_hoehe[h] else None}
        for h in sorted(nach_hoehe, reverse=True)
        if h in (2160, 1440, 1080, 720, 480, 360)
    ]
    return {
        "type": "formats",
        "title": daten.get("title") or video_id,
        "duration": daten.get("duration"),
        "formats": angebot,
    }


def download_video(video_id: str, hoehe: int, ziel: str) -> dict[str, Any]:
    """Laedt das Video in der gewuenschten Hoehe in den Zielordner.

    ffmpeg ist zwingend: YouTube liefert ab 480p getrennte Video- und Tonspuren
    (DASH), die erst lokal zusammengefuegt werden. Ohne ffmpeg bliebe nur die
    progressive 360p-Spur.
    """
    exe = require("yt-dlp")
    require("ffmpeg")
    ordner = Path(ziel).expanduser()
    if not ordner.is_dir():
        raise HostError(f"Der Zielordner existiert nicht: {ordner}")

    progress("download", "Spuren werden ermittelt ...")
    # Ton zuerst: yt-dlp laedt die Spuren in der Reihenfolge des Formatausdrucks, und die
    # kleine Tonspur vorweg gibt sofort sichtbaren Fortschritt (Michaels Wunsch, 05.09.2026).
    wahl = f"bestaudio+bestvideo[height<={hoehe}]/best[height<={hoehe}]"
    url = f"https://www.youtube.com/watch?v={video_id}"

    # Erst die Spuren samt Groesse erfragen (ein Metadaten-Abruf, rund 1-2 s): nur so gibt
    # es einen gemeinsamen Fortschritt ueber Ton und Bild statt zweimal 0 bis 100.
    res = run([exe, "-f", wahl, "--dump-single-json", "--no-playlist", "--no-warnings", url])
    if res.returncode != 0:
        raise HostError(f"yt-dlp konnte das Video nicht lesen:\n{(res.stderr or res.stdout)[-800:]}")
    daten = json.loads(res.stdout)
    spuren = daten.get("requested_formats") or [daten]
    groesse = {
        str(f.get("format_id")): int(f.get("filesize") or f.get("filesize_approx") or 0)
        for f in spuren
    }
    ton = {str(f.get("format_id")) for f in spuren if f.get("vcodec") in (None, "none")}
    gesamt = sum(groesse.values())

    cmd = [
        exe, "-f", wahl, "--merge-output-format", "mp4", "--no-playlist", "--no-warnings",
        # --newline: eine Zeile je Aktualisierung statt Wagenruecklauf. Die Vorlage nennt
        # Spur und geladene Bytes, daraus wird der gemeinsame Stand gerechnet.
        # --no-quiet: --print schaltet yt-dlp stumm, dann fehlt die [Merger]-Zeile.
        "--newline", "--progress", "--no-quiet",
        "--progress-template", "download:FORT=%(info.format_id)s %(progress.downloaded_bytes)s",
        # Eindeutiger Praefix: so entscheidet kein Zeilenformat, welche Zeile der Pfad ist.
        "--print", "after_move:PFAD=%(filepath)s",
        "-o", str(ordner / "%(title).150B [%(id)s] %(height)sp.%(ext)s"),
        url,
    ]
    global _KIND
    kw: dict[str, Any] = (
        {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == "nt"
        else {"start_new_session": True}
    )
    # stderr in denselben Strom: zwei getrennte Pipes, von denen nur eine gelesen wird,
    # blockieren, sobald die andere 64 KB voll hat - bei einem langen Download mit
    # Warnungen bliebe der Host dann stumm haengen.
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, **kw)
    _KIND = p
    pfad = ""
    schwanz: list[str] = []
    letzter = -1
    geladen: dict[str, int] = {}
    aktuell = ""
    try:
        assert p.stdout is not None
        for zeile in p.stdout:
            zeile = zeile.rstrip("\n")
            schwanz = (schwanz + [zeile])[-12:]
            if zeile.startswith("FORT="):
                spur, _, wert = zeile[len("FORT="):].partition(" ")
                text = "Tonspur wird geladen ..." if spur in ton else f"Bildspur wird geladen ({hoehe}p) ..."
                if spur != aktuell:
                    aktuell = spur
                    progress("download", text)
                try:
                    geladen[spur] = int(float(wert))
                except ValueError:
                    continue
                # Stand je Spur merken statt "Spurwechsel = vorige fertig": DASH-Spuren
                # koennen sich abwechseln. Fehlt fuer eine gemeldete Spur die Groesse
                # (anderer Formatausdruck als beim Dump, keine Angabe), lieber keine Zahl
                # als eine falsche; der Wert faellt nie zurueck.
                if gesamt and all(groesse.get(f) for f in geladen):
                    stand = sum(min(b, groesse[f]) for f, b in geladen.items())
                    pz = max(letzter, min(100, int(100 * stand / gesamt)))
                    if pz != letzter:
                        letzter = pz
                        progress("download", text, pz)
            elif zeile.startswith("[Merger]"):
                progress("download", "Ton und Bild werden zusammengefügt ...", 100 if gesamt else None)
            elif zeile.startswith("PFAD="):
                pfad = zeile[len("PFAD="):]
        p.wait()
    finally:
        # Bricht die Schleife durch eine Ausnahme ab (etwa BrokenPipe in progress(), wenn
        # Chrome den Port schon getrennt hat), darf yt-dlp nicht verwaist weiterlaufen.
        if p.poll() is None:
            kinder_beenden_leise(p)
        _KIND = None
    if p.returncode != 0:
        raise HostError("Der Download ist fehlgeschlagen:\n" + "\n".join(schwanz)[-800:])
    if not pfad or not Path(pfad).is_file():
        raise HostError("yt-dlp hat keinen Dateipfad gemeldet:\n" + "\n".join(schwanz)[-800:])
    datei = Path(pfad)
    return {
        "type": "downloaded", "path": pfad, "height": hoehe,
        "dir": kurzer_pfad(datei.parent), "name": datei.name,
    }


def kurzer_pfad(p: Path) -> str:
    """~ statt des Home-Verzeichnisses - so, wie ein Mensch den Ordner nennt."""
    try:
        return "~/" + p.relative_to(Path.home()).as_posix() if p != Path.home() else "~"
    except ValueError:
        return str(p)


def choose_folder() -> dict[str, Any]:
    """Systemeigener Ordnerdialog. Niemand tippt Pfade, und ein getippter Pfad ist ein Risiko.

    Abbruch liefert path None, kein Fehler. Der Dialog gehoert dem Nutzer, er hat ihn
    per Klick angefordert.
    """
    if sys.platform == "darwin":
        cmd = ["osascript", "-e",
               'POSIX path of (choose folder with prompt "Zielordner für Videodownloads")']
    elif sys.platform.startswith("win"):
        cmd = ["powershell", "-NoProfile", "-STA", "-Command",
               # UTF-8 erzwingen: die Konsolen-Codepage von PowerShell ist sonst nicht die,
               # mit der Python die Ausgabe liest - Umlaute im Pfad kaemen kaputt an.
               "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); "
               "Add-Type -AssemblyName System.Windows.Forms; "
               "$d = New-Object System.Windows.Forms.FolderBrowserDialog; "
               "$d.Description = 'Zielordner für Videodownloads'; "
               "if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath }"]
    else:
        cmd = ["zenity", "--file-selection", "--directory", "--title=Zielordner für Videodownloads"]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                             errors="replace", check=False)
    except FileNotFoundError as e:
        raise HostError(f"Kein Ordnerdialog verfügbar ({e.filename} fehlt).") from e
    # Nur das Zeilenende weg; Leerzeichen sind in Ordnernamen erlaubt. Den Schraegstrich,
    # den osascript anhaengt, nimmt Path() selbst heraus - "/" und "C:\\" bleiben heil.
    gewaehlt = (res.stdout or "").strip("\r\n")
    if res.returncode != 0:
        # Abbruch: osascript -128 (Text in stderr), zenity Exit 1. Alles andere ist ein Defekt.
        abbruch = "-128" in (res.stderr or "") or (cmd[0] == "zenity" and res.returncode == 1)
        if abbruch:
            return {"type": "folder", "path": None}
        raise HostError(f"Ordnerdialog fehlgeschlagen:\n{(res.stderr or res.stdout)[-400:]}")
    if not gewaehlt:
        return {"type": "folder", "path": None}
    ordner = Path(gewaehlt)
    return {"type": "folder", "path": str(ordner), "dir": kurzer_pfad(ordner)}


def reveal_file(pfad: str, ziel: str) -> dict[str, Any]:
    """Zeigt die fertige Datei im Dateimanager - Finder, Explorer oder was xdg kennt.

    Nur Dateien im eingestellten Zielordner: der Pfad kommt aus der Erweiterung, und
    der Host soll nicht jede beliebige Datei auf der Platte anzeigen.
    """
    p = Path(pfad).expanduser().resolve()
    ordner = Path(ziel).expanduser().resolve()
    if p.parent != ordner:
        raise HostError(f"Die Datei liegt nicht im Zielordner {ordner}: {p}")
    if not p.is_file():
        raise HostError(f"Die Datei gibt es nicht mehr: {p}")
    if sys.platform == "darwin":
        cmd = ["open", "-R", str(p)]
    elif sys.platform.startswith("win"):
        cmd = ["explorer", f"/select,{p}"]
    else:
        cmd = ["xdg-open", str(p.parent)]
    # Nicht warten: der Explorer liefert grundsaetzlich Exit 1, der Finder blockiert nicht.
    subprocess.Popen(cmd)
    return {"type": "revealed"}


def parse_parakeet_segments(data: Any) -> Iterator[dict[str, Any]]:
    """Nimmt sowohl {"sentences": [...]} als auch {"segments": [...]} und blanke Listen.

    Das Ausgabeschema des CLI ist nicht als Schnittstelle zugesagt, deshalb wird
    hier auf mehrere plausible Formen geprueft statt auf eine einzige gewettet.
    """
    if isinstance(data, dict):
        items = data.get("sentences") or data.get("segments") or data.get("chunks") or []
    elif isinstance(data, list):
        items = data
    else:
        return

    for it in items:
        if not isinstance(it, dict):
            continue
        start = it.get("start") if it.get("start") is not None else it.get("start_time")
        end = it.get("end") if it.get("end") is not None else it.get("end_time")
        text = (it.get("text") or "").strip()
        if start is None or not text:
            continue
        yield {"start": float(start), "end": float(end if end is not None else start), "text": text}


# --------------------------------------------------------------------------
# Ablauf
# --------------------------------------------------------------------------

VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")


def handle_transcribe(msg: dict[str, Any]) -> None:
    video_id = str(msg.get("videoId", ""))
    # Die ID landet in einer URL und in einer Kommandozeile. Ein strenger Filter
    # ist hier billiger als jedes Escaping weiter unten.
    if not VIDEO_ID.match(video_id):
        raise HostError(f"Ungültige Video-ID: {video_id!r}")
    abbruch_waechter()

    # Videodownload: eigener Zweig, keine Transkription. Nur im GitHub-Build erreichbar,
    # die Store-Fassung enthaelt den aufrufenden Code gar nicht.
    art = str(msg.get("kind", "transcript"))
    if art == "formats":
        send(list_formats(video_id))
        return
    if art == "reveal":
        ziel = str(msg.get("target") or Path.home() / "Downloads")
        send(reveal_file(str(msg.get("path") or ""), ziel))
        return
    if art == "download":
        hoehe = int(msg.get("height") or 720)
        ziel = str(msg.get("target") or Path.home() / "Downloads")
        progress("start", "Vorbereitung ...")
        send(download_video(video_id, hoehe, ziel))
        return

    route = str(msg.get("route", "parakeet-mlx"))
    if route not in STT_MODELS and route not in (
        "parakeet-mlx", "parakeet-primeline", "subtitles"
    ):
        raise HostError(f"Unbekannte Route: {route}")

    api_key = msg.get("apiKey") or ""
    if route in STT_MODELS and not api_key:
        raise HostError("Für diese Route wird ein OpenRouter-Schlüssel gebraucht.")

    with tempfile.TemporaryDirectory(prefix="yt-summary-") as tmp:
        workdir = Path(tmp)
        progress("start", "Vorbereitung …")

        # Untertitel zuerst: kostenlos, kein Audio-Download, Zeitstempel von YouTube.
        if route == "subtitles":
            result = fetch_subtitles(video_id, msg.get("language"), workdir)
            progress("done", "Fertig", 100)
            send({"type": "result", **result})
            return

        source = download_audio(video_id, workdir)

        if route in ("parakeet-mlx", "parakeet-primeline"):
            wav = workdir / "audio.wav"
            to_wav(source, wav)
            result = (transcribe_primeline(wav) if route == "parakeet-primeline"
                      else transcribe_parakeet_mlx(wav, workdir))
        else:
            opus = workdir / "audio.opus"
            to_opus(source, opus)
            result = transcribe_openrouter(opus, route, api_key, msg.get("language"), workdir)

    if not result["segments"] and not result["text"].strip():
        raise HostError("Die Transkription lieferte keinen Text.")

    progress("done", "Fertig", 100)
    send({"type": "result", **result})


def main() -> None:
    while True:
        try:
            msg = read_message()
        except Exception as e:
            send({"type": "error", "message": f"Nachricht nicht lesbar: {e}"})
            return
        if msg is None:
            return

        try:
            kind = msg.get("type")
            if kind == "ping":
                send({"version": VERSION, "tools": tool_status()})
            elif kind == "chooseFolder":
                send(choose_folder())
            elif kind == "transcribe":
                handle_transcribe(msg)
            else:
                send({"type": "error", "message": f"Unbekannter Nachrichtentyp: {kind!r}"})
        except HostError as e:
            send({"type": "error", "message": str(e)})
        except Exception as e:  # nie stumm sterben - die Sidebar wartet sonst ewig
            send({"type": "error", "message": f"{type(e).__name__}: {e}"})


if __name__ == "__main__":
    main()
