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
import struct
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
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
    }


def run(cmd: list[str], **kw: Any) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, capture_output=True, text=True, check=False, **kw)


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

    route = str(msg.get("route", "parakeet-mlx"))
    if route not in STT_MODELS and route not in ("parakeet-mlx", "subtitles"):
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

        if route == "parakeet-mlx":
            wav = workdir / "audio.wav"
            to_wav(source, wav)
            result = transcribe_parakeet_mlx(wav, workdir)
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
