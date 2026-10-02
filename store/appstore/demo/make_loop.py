#!/usr/bin/env python3
"""撮影ページ用のドラムループ(120 BPM・8 小節・16 秒)を合成して audio/ に書き出す。

音はすべてこのスクリプトで作る(サンプル素材は使わない)ので、著作権の心配は無い。
乱数は種を固定しているので、何度作っても同じ音になる。

  python3 store/appstore/demo/make_loop.py

出力(ffmpeg が要る。brew install ffmpeg):
  audio/loop.m3u8 + audio/loop*.ts  … 標準の HLS。Safari 版は MediaSource と HLS の音しか読まないので、Safari ではこれを流す
  audio/loop.m4a                    … HLS を再生できないブラウザ(Chrome など)向け
"""
import math
import random
import shutil
import struct
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

RATE = 44100
BPM = 120
BARS = 8
BEAT = 60 / BPM
LENGTH = int(RATE * BEAT * 4 * BARS)
OUT = Path(__file__).resolve().parent / "audio"

rnd = random.Random(20261003)


def env_exp(n, tau):
    """長さ n の指数減衰(tau 秒で 1/e)"""
    k = 1 / (tau * RATE)
    return [math.exp(-i * k) for i in range(n)]


def kick():
    n = int(0.45 * RATE)
    out, phase = [], 0.0
    amp = env_exp(n, 0.12)
    for i in range(n):
        t = i / RATE
        f = 45 + 110 * math.exp(-t * 28)  # 155 Hz → 45 Hz に落ちる
        phase += 2 * math.pi * f / RATE
        click = math.exp(-t * 400) * 0.4
        out.append((math.sin(phase) + click) * amp[i])
    return out


def snare():
    n = int(0.25 * RATE)
    tone_amp = env_exp(n, 0.04)
    noise_amp = env_exp(n, 0.07)
    out, prev = [], 0.0
    for i in range(n):
        t = i / RATE
        noise = rnd.uniform(-1, 1)
        hp = noise - prev  # 低い成分を少し削る
        prev = noise
        tone = math.sin(2 * math.pi * 185 * t) + 0.5 * math.sin(2 * math.pi * 330 * t)
        out.append(0.45 * tone * tone_amp[i] + 0.6 * hp * noise_amp[i])
    return out


def clap():
    n = int(0.3 * RATE)
    out = [0.0] * n
    for burst in (0.0, 0.011, 0.022):  # 3 回ばらばらに叩いた感じ
        s = int(burst * RATE)
        for i in range(s, n):
            t = (i - s) / RATE
            out[i] += rnd.uniform(-1, 1) * math.exp(-t * (60 if burst < 0.02 else 18)) * 0.5
    return out


def hat(length, tau):
    n = int(length * RATE)
    amp = env_exp(n, tau)
    out, prev = [], 0.0
    for i in range(n):
        noise = rnd.uniform(-1, 1)
        out.append((noise - prev) * 0.5 * amp[i])  # 差分で高い音だけ残す
        prev = noise
    return out


def add(buf, sound, at, gain):
    """at サンプル目から足す。ループの終わりをはみ出した分は頭に回す(つなぎ目で切れない)"""
    for i, v in enumerate(sound):
        buf[(at + i) % LENGTH] += v * gain


def step(bar, sixteenth):
    return int(round((bar * 16 + sixteenth) * BEAT / 4 * RATE))


# 1 小節ごとのコード(Am - F - C - G を 2 周)。ベースの音と、和音の音(Hz)
CHORDS = [
    (55.00, [220.00, 261.63, 329.63]),  # Am
    (43.65, [174.61, 220.00, 261.63]),  # F
    (65.41, [196.00, 261.63, 329.63]),  # C
    (49.00, [196.00, 246.94, 293.66]),  # G
]


def main():
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg が見つからない(brew install ffmpeg)")

    buf = [0.0] * LENGTH
    k, s, c = kick(), snare(), clap()
    hc, ho = hat(0.05, 0.012), hat(0.25, 0.08)

    for bar in range(BARS):
        for beat in range(4):
            add(buf, k, step(bar, beat * 4), 0.9)  # 4 つ打ち
        add(buf, s, step(bar, 4), 0.55)
        add(buf, c, step(bar, 12), 0.6)
        if bar % 2 == 1:
            add(buf, s, step(bar, 14), 0.25)  # 2 小節に 1 回の合いの手
        for sx in range(16):
            if sx % 4 == 2:
                add(buf, ho, step(bar, sx), 0.35)  # 裏拍のオープン
            else:
                add(buf, hc, step(bar, sx), 0.28 if sx % 2 else 0.18)

    # ベース(8 分音符・キックの瞬間は下げてうねらせる)と、うっすら和音
    eighth = BEAT / 2
    for i in range(LENGTH):
        t = i / RATE
        bar = int(t / (BEAT * 4)) % BARS
        root, chord = CHORDS[bar % 4]
        in8 = (t % eighth) / eighth
        octave = 2 if int(t / eighth) % 4 == 3 else 1
        f = root * octave
        ph = 2 * math.pi * f * t
        bass = math.sin(ph) + 0.35 * math.sin(2 * ph) + 0.15 * math.sin(3 * ph)
        pump = min(1.0, ((t % BEAT) / BEAT) * 3)  # キックで沈んで戻る
        bass *= (1 - in8 * 0.6) * pump * 0.32
        pad = sum(math.sin(2 * math.pi * cf * t) + math.sin(2 * math.pi * cf * 1.003 * t) for cf in chord)
        buf[i] += bass + pad * 0.018 * (0.4 + 0.6 * pump)

    peak = max(abs(v) for v in buf)
    frames = b"".join(struct.pack("<h", int(math.tanh(v / peak * 1.2) / math.tanh(1.2) * 0.89 * 32767)) for v in buf)

    OUT.mkdir(exist_ok=True)
    for old in OUT.glob("loop*"):
        old.unlink()
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "loop.wav"
        with wave.open(str(wav), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(frames)
        ff = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "aac", "-b:a", "128k", "-ac", "2"]
        # 区切りは約 4 秒 × 4 本(ちょうど 4 にすると、AAC が頭に足す 23ms が 5 本目の小さな区切りになる)
        subprocess.run(ff + ["-f", "hls", "-hls_time", "4.1", "-hls_playlist_type", "vod",
                             "-hls_segment_filename", str(OUT / "loop%d.ts"), str(OUT / "loop.m3u8")], check=True)
        subprocess.run(ff + ["-movflags", "+faststart", str(OUT / "loop.m4a")], check=True)

    for f in sorted(OUT.glob("loop*")):
        print(f"{f.relative_to(OUT.parent)}  {f.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
