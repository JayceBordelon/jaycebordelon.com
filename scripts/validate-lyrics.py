#!/usr/bin/env python3
"""Verify that src/lyrics/*.lrc actually line up with the audio files.

    uv run --with mlx-whisper python scripts/validate-lyrics.py [slug ...]

For each lyric track (or just the given slugs): sample the first sung
line plus lines near 25/50/75% of the song, cut a window around each
timestamp with ffmpeg, transcribe it with whisper (word timestamps on),
fuzzy-locate the expected words in the transcript, and measure how far
the real vocal start is from the LRC timestamp.

Verdicts per track:
  SYNCED      2+ samples matched, median |delta| <= 1.2s
  OFFSET      2+ samples matched but consistently shifted; the reported
              suggestion is the [offset:ms] tag to add to the .lrc
              (positive = render the words later; build.mjs applies
              t + offset). Re-run after tagging to confirm.
  UNVERIFIED  whisper could not confidently hear 2 samples (dense mix,
              heavy vocal processing). Not proof of failure; listen.

Writes the full per-sample detail to /tmp/lyrics-validation.json.
Sung vocals are hard ASR: expect fuzzy ratios well below clean speech.
"""
import json
import os
import re
import statistics
import subprocess
import sys
import tempfile
from difflib import SequenceMatcher
from pathlib import Path

import mlx_whisper

ROOT = Path(__file__).resolve().parent.parent
# Escalate to whisper-small/medium for tracks the base model cannot
# hear (dense mixes, heavy vocal processing) before trusting UNVERIFIED.
MODEL = os.environ.get("WHISPER_MODEL", "mlx-community/whisper-base-mlx")
WINDOW_BEFORE = 10.0
WINDOW_LEN = 24.0
MATCH_RATIO = 0.60
OFFSET_OK = 1.2  # seconds
# A match this close to the clip's left edge is a floor, not a
# measurement: the vocal probably started before the window did.
EDGE_GUARD = 0.35


def parse_lrc(path: Path):
    off_m = re.search(r"^\[offset:([+-]?\d+)\]", path.read_text(), re.I | re.M)
    offset = int(off_m.group(1)) / 1000 if off_m else 0.0
    lines = []
    for raw in path.read_text().splitlines():
        stamps = re.findall(r"\[(\d+):(\d{1,2}(?:\.\d+)?)\]", raw)
        if not stamps:
            continue
        text = re.sub(r"\[[^\]]*\]", "", raw).strip()
        for m, s in stamps:
            lines.append((int(m) * 60 + float(s) + offset, text))
    return sorted((t, x) for t, x in lines)


def norm_words(text: str):
    return [w for w in re.sub(r"[^a-z0-9' ]", " ", text.lower()).split() if w]


def pick_samples(lines):
    """First sung line plus spread lines, preferring lyrics whose text is
    unique in the song: a repeated chorus line can fuzzy-match a
    different repetition inside the window and fake a huge delta."""
    counts = {}
    for _, x in lines:
        k = " ".join(norm_words(x))
        if k:
            counts[k] = counts.get(k, 0) + 1
    sung = [(t, x) for t, x in lines if len(norm_words(x)) >= 4]
    if not sung:
        sung = [(t, x) for t, x in lines if norm_words(x)]
    if not sung:
        return []
    unique = [s for s in sung if counts[" ".join(norm_words(s[1]))] == 1]
    pool = unique if len(unique) >= 3 else sung
    picks = {0}
    for frac in (0.25, 0.5, 0.75):
        picks.add(round(frac * (len(pool) - 1)))
    return [pool[i] for i in sorted(picks)]


def extract(audio: Path, start: float, out: Path):
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-ss", f"{max(0.0, start)}", "-t",
         f"{WINDOW_LEN}", "-i", str(audio), "-ar", "16000", "-ac", "1", str(out)],
        check=True,
    )


def locate(expected: str, words):
    """Best fuzzy window of transcript words vs the expected line.

    Returns (ratio, start_time) for the best-matching window."""
    exp = norm_words(expected)
    if not exp or not words:
        return 0.0, None
    target = " ".join(exp)
    best = (0.0, None)
    n = len(exp)
    for i in range(len(words)):
        for span in (n, n + 1, max(1, n - 1)):
            chunk = words[i : i + span]
            if not chunk:
                continue
            got = " ".join(w for _, w in chunk)
            r = SequenceMatcher(None, target, got).ratio()
            if r > best[0]:
                best = (r, chunk[0][0])
    return best


def main():
    only = set(sys.argv[1:])
    tracks = json.loads((ROOT / "src/tracks.json").read_text())
    report = {}
    tmp = Path(tempfile.mkdtemp(prefix="lyrics-val-"))

    for tr in tracks:
        slug = tr["slug"]
        lrc = ROOT / "src/lyrics" / f"{slug}.lrc"
        if not lrc.exists() or (only and slug not in only):
            continue
        audio = ROOT / "public" / tr["src"].lstrip("/")
        samples = pick_samples(parse_lrc(lrc))
        rows = []
        for t, text in samples:
            clip = tmp / f"{slug}-{int(t)}.wav"
            extract(audio, t - WINDOW_BEFORE, clip)
            base = max(0.0, t - WINDOW_BEFORE)
            res = mlx_whisper.transcribe(
                str(clip), path_or_hf_repo=MODEL, word_timestamps=True
            )
            words = [
                (base + w["start"], re.sub(r"[^a-z0-9']", "", w["word"].lower()))
                for seg in res["segments"]
                for w in seg.get("words", [])
            ]
            ratio, found = locate(text, words)
            # mlx/numpy scalars leak out of whisper's word timestamps;
            # cast to plain Python types or json.dumps refuses them.
            found = float(found) if found is not None else None
            ratio = float(ratio)
            edge = bool(found is not None and (found - base) < EDGE_GUARD)
            rows.append({
                "t": round(t, 2),
                "line": text,
                "ratio": round(ratio, 2),
                "heard_at": round(found, 2) if found is not None else None,
                "edge": edge,
                "delta": round(found - t, 2)
                if (found is not None and ratio >= MATCH_RATIO and not edge)
                else None,
            })
        deltas = [r["delta"] for r in rows if r["delta"] is not None]
        edges = sum(1 for r in rows if r["edge"] and r["ratio"] >= MATCH_RATIO)
        if len(deltas) >= 2:
            med = statistics.median(deltas)
            verdict = "SYNCED" if abs(med) <= OFFSET_OK else f"OFFSET {int(round(med * 1000))}ms"
        elif edges >= 2:
            # Confident matches pinned to the clip edge: the vocals run
            # at least the pre-window ahead of the timestamps.
            verdict = f"EARLY >{int(WINDOW_BEFORE - 1)}s"
        else:
            verdict = "UNVERIFIED"
        report[slug] = {"verdict": verdict, "samples": rows}
        matched = f"{len(deltas)}/{len(rows)}"
        med_s = f" median={statistics.median(deltas):+.2f}s" if deltas else ""
        print(f"{verdict:<14} {slug:<32} matched={matched}{med_s}", flush=True)

    Path("/tmp/lyrics-validation.json").write_text(json.dumps(report, indent=1))
    counts = {}
    for r in report.values():
        key = r["verdict"].split()[0]
        counts[key] = counts.get(key, 0) + 1
    print(f"\n{counts} -> /tmp/lyrics-validation.json")


if __name__ == "__main__":
    main()
