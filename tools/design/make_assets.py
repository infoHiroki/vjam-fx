# VJam FX のロゴ・アイコンを作る(位置は全部インクの外枠で測って合わせる)
# usage: python3 tools/design/make_assets.py [出力先]  元: mark.png / wordmark.png(VJam 本体の design/logo)
# 採用:アイコンは A(マークだけ。名前は VJam FX のまま、アイコンに文字は入れない)、16 / 32 は線を太くした専用版
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
OUT = sys.argv[1] if len(sys.argv) > 1 else 'out/'
os.makedirs(OUT, exist_ok=True)
PINK, CYAN, WHITE, BG = (255, 42, 90, 255), (0, 230, 220, 255), (245, 245, 245, 255), (3, 3, 3, 255)
FONT = ('/System/Library/Fonts/Avenir Next.ttc', 0)  # 下で Heavy を探す

def font(px):
    for i in range(12):
        f = ImageFont.truetype(FONT[0], px, index=i)
        if f.getname()[1] in ('Heavy',): return f
    return ImageFont.truetype(FONT[0], px, index=0)

def ink(im):
    a = np.array(im.split()[-1]); ys, xs = np.where(a > 24)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1

def fx_text(cap_h, chroma):
    """FX の文字だけを、インクぎりぎりの画像で返す(色ずれ込み)"""
    f = font(int(cap_h * 1.45)); W = int(cap_h * 4); im = Image.new('RGBA', (W, W), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    o = max(1, round(cap_h * 0.05)) if chroma else 0
    x0, y0 = W // 4, W // 4
    if o:
        d.text((x0 - o, y0), 'FX', font=f, fill=PINK); d.text((x0 + o, y0), 'FX', font=f, fill=CYAN)
    d.text((x0, y0), 'FX', font=f, fill=WHITE)
    b = ink(im); im = im.crop(b)
    # 高さを cap_h ちょうどに
    return im.resize((round(im.width * cap_h / im.height), cap_h), Image.LANCZOS)

mark = Image.open('mark.png'); mark = mark.crop(ink(mark))

# ---------- ① ロゴ(横組み):手書き VJam + FX。FX の下端を「AM」の下端にそろえる ----------
wm = Image.open('wordmark.png')
wx0, wy0, wx1, wy1 = ink(wm); wm = wm.crop((wx0, wy0, wx1, wy1))
AM_BASE = 215 - wy0          # 「AM」の下端(定規で確認)
AM_TOP = 97 - wy0            # 「AM」の上端
cap = round((AM_BASE - AM_TOP) * 0.62)
fx = fx_text(cap, True)
gap = round(cap * 0.38)
L = Image.new('RGBA', (wm.width + gap + fx.width, wm.height), (0, 0, 0, 0))
L.alpha_composite(wm, (0, 0)); L.alpha_composite(fx, (wm.width + gap, AM_BASE - fx.height))
L.save(OUT + 'lockup.png')

# ---------- ② アイコン ----------
def tile(T, radius=0.2235):
    im = Image.new('RGBA', (T, T), (0, 0, 0, 0)); ImageDraw.Draw(im).rounded_rectangle((0, 0, T - 1, T - 1), radius=round(T * radius), fill=BG); return im

def icon_A(T):
    im = tile(T); d = round(T * 0.66); m = mark.resize((d, round(d * mark.height / mark.width)), Image.LANCZOS)
    im.alpha_composite(m, ((T - m.width) // 2, (T - m.height) // 2)); return im

def icon_B(T, fx_ratio, pad=0.13, gap=0.045):
    """FX をインク基準で右下の余白 pad にぴったり置き、マークは FX と gap 以上離れる範囲で最大・左上寄せ"""
    im = tile(T); p = round(T * pad)
    fx = fx_text(round(T * fx_ratio), True)
    fx_x, fx_y = T - p - fx.width, T - p - fx.height
    fxmask = Image.new('L', (T, T), 0); fxmask.paste(fx.split()[-1], (fx_x, fx_y))
    g = round(T * gap); grown = np.array(fxmask.filter(ImageFilter.MaxFilter(2 * (g // 2) + 1))) > 24
    best = None
    for d in range(round(T * 0.72), round(T * 0.40), -max(1, T // 256)):
        m = mark.resize((d, round(d * mark.height / mark.width)), Image.LANCZOS)
        # 左上の余白は pad、ただし左右の余白と上下の余白はそろえる(マークの中心を対角線上に)
        mx, my = p, p
        mm = np.zeros((T, T), bool); a = np.array(m.split()[-1]) > 24
        mm[my:my + m.height, mx:mx + m.width] = a[:T - my, :T - mx]
        if not (mm & grown).any(): best = (m, mx, my); break
    m, mx, my = best
    im.alpha_composite(m, (mx, my)); im.alpha_composite(fx, (fx_x, fx_y)); return im

def special(T, chroma):
    S = T * 8; im = tile(S); d = ImageDraw.Draw(im); c = S / 2; R = S * 0.34; w = round(S * 0.13); r = S * 0.11
    def ring(dx, col):
        d.ellipse((c - R + dx, c - R, c + R + dx, c + R), outline=col, width=w); d.ellipse((c - r + dx, c - r, c + r + dx, c + r), fill=col)
    if chroma: o = S * 0.045; ring(-o, PINK); ring(o, CYAN)
    ring(0, WHITE); return im.resize((T, T), Image.LANCZOS)

def store128(art):
    """Chrome の決まり:128 の中に 96 の絵 + 周り 16px は透明"""
    im = Image.new('RGBA', (128, 128), (0, 0, 0, 0)); im.alpha_composite(art.resize((96, 96), Image.LANCZOS), (16, 16)); return im

for name, make in (('A', icon_A), ('B3', lambda T: icon_B(T, 0.17)), ('B4', lambda T: icon_B(T, 0.13))):
    big = make(1024); big.save(OUT + f'icon-{name}-1024.png')
    store128(big).save(OUT + f'icon-{name}-128.png')
    make(384).resize((48, 48), Image.LANCZOS).save(OUT + f'icon-{name}-48.png')
special(16, False).save(OUT + 'icon-16.png'); special(32, True).save(OUT + 'icon-32.png')

# iOS(Safari アプリ)用:角丸なし・全面(OS が角を丸める)
for name, make in (('A', icon_A), ('B3', lambda T: icon_B(T, 0.17)), ('B4', lambda T: icon_B(T, 0.13))):
    im = make(1024); sq = Image.new('RGBA', (1024, 1024), BG); sq.alpha_composite(im); sq.convert('RGB').save(OUT + f'ios-{name}-1024.png')
# 製品で使う形(A)
a = icon_A(1024)
store128(a).save(OUT + 'ext-128.png')                       # 拡張 128(96 + 透明 16)
a.resize((48, 48), Image.LANCZOS).save(OUT + 'ext-48.png')
a.resize((128, 128), Image.LANCZOS).save(OUT + 'app-128.png')  # Safari のアプリ画面用(全面)
print('ok', L.size, 'cap', cap)
