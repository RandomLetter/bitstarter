#!/usr/bin/env python3
"""Draw crisp rule-explanation board diagrams for the Santiago deck.

Renders miniature boards (sand squares, brown ditch grid, spring, canals,
plantation tiles with yield markers) into assets/diagrams/.
"""
import os
import math
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ICO = os.path.join(HERE, 'assets', 'icons')
OUT = os.path.join(HERE, 'assets', 'diagrams')

S = 2            # supersample factor
C = 130          # cell size (pre-supersample px)
M = 34           # margin

SAND = '#f0e2c0'
SQUARE = '#f4e6bd'
DITCH = '#8a6a3a'
INK = '#3a2c1a'
WATER = '#2a7fb8'
DESERT = '#b09464'
GREEN = '#2e7d4f'
RED = '#b03a2e'
CROP_FILL = {'banana': '#f7e08a', 'sugar': '#bfe3a8', 'potato': '#e8c79a',
             'bean': '#d9b8e8', 'pepper': '#f5a9a0'}
PLAYER = {'beige': '#d9b36c', 'purple': '#8050a8', 'gray': '#8a8f98',
          'black': '#2e2b29', 'white': '#f4f1e8'}

FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26 * S)


def emoji(name, px):
    im = Image.open(f'{ICO}/{name}.png').convert('RGBA')
    return im.resize((px, px), Image.LANCZOS)


class Board:
    def __init__(self, cols, rows, extra_right=0):
        self.cols, self.rows = cols, rows
        self.w = (M * 2 + cols * C + extra_right) * S
        self.h = (M * 2 + rows * C) * S
        self.im = Image.new('RGBA', (self.w, self.h), SAND)
        self.d = ImageDraw.Draw(self.im)
        for r in range(rows):
            for c in range(cols):
                x, y = self.sq(c, r)
                self.d.rectangle([x, y, x + C * S, y + C * S], fill=SQUARE)
        # ditch grid: thick brown lines on every square edge
        for gy in range(rows + 1):
            self.d.line([self.pt(0, gy), self.pt(cols, gy)], fill=DITCH, width=5 * S)
        for gx in range(cols + 1):
            self.d.line([self.pt(gx, 0), self.pt(gx, rows)], fill=DITCH, width=5 * S)

    def pt(self, gx, gy):
        return ((M + gx * C) * S, (M + gy * C) * S)

    def sq(self, c, r):
        return ((M + c * C) * S, (M + r * C) * S)

    def tile(self, c, r, crop, markers=0, color='beige', neutral=False):
        x, y = self.sq(c, r)
        pad = 6 * S
        self.d.rounded_rectangle([x + pad, y + pad, x + C * S - pad, y + C * S - pad],
                                 radius=12 * S, fill=CROP_FILL[crop],
                                 outline=DITCH, width=2 * S)
        e = emoji(crop, int(C * 0.5) * S)
        self.im.alpha_composite(e, (x + int(C * 0.25) * S, y + int(C * 0.18) * S))
        for i in range(markers):
            cx = x + (C - 24 - i * 30) * S
            cy = y + (C - 22) * S
            rr = 11 * S
            self.d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                           fill=PLAYER[color], outline=INK, width=2 * S)

    def desert(self, c, r):
        x, y = self.sq(c, r)
        pad = 6 * S
        self.d.rounded_rectangle([x + pad, y + pad, x + C * S - pad, y + C * S - pad],
                                 radius=12 * S, fill=DESERT, outline=DITCH, width=2 * S)
        e = emoji('desert', int(C * 0.45) * S)
        self.im.alpha_composite(e, (x + int(C * 0.28) * S, y + int(C * 0.26) * S))

    def spring(self, gx, gy):
        x, y = self.pt(gx, gy)
        r = 20 * S
        self.d.ellipse([x - r, y - r, x + r, y + r], fill=WATER, outline='white', width=3 * S)
        e = emoji('water', 22 * S)
        self.im.alpha_composite(e, (x - 11 * S, y - 12 * S))

    def canal(self, gx1, gy1, gx2, gy2, color=WATER, width=13):
        self.d.line([self.pt(gx1, gy1), self.pt(gx2, gy2)], fill=color, width=width * S)
        for gx, gy in ((gx1, gy1), (gx2, gy2)):
            x, y = self.pt(gx, gy)
            r = width // 2 * S
            self.d.ellipse([x - r, y - r, x + r, y + r], fill=color)

    def proposal(self, gx1, gy1, gx2, gy2, color, width=11):
        (x1, y1), (x2, y2) = self.pt(gx1, gy1), self.pt(gx2, gy2)
        length = math.hypot(x2 - x1, y2 - y1)
        n = max(1, int(length / (16 * S)))
        for i in range(n):
            if i % 2:
                continue
            t0, t1 = i / n, (i + 0.8) / n
            self.d.line([(x1 + (x2 - x1) * t0, y1 + (y2 - y1) * t0),
                         (x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1)],
                        fill=PLAYER.get(color, color), width=width * S)

    def badge(self, x_cell, y_cell, ok=True, at_pt=False):
        """Green check or red cross, centred on a square or a grid point."""
        if at_pt:
            cx, cy = self.pt(x_cell, y_cell)
        else:
            x, y = self.sq(x_cell, y_cell)
            cx, cy = x + C // 2 * S, y + C // 2 * S
        r = 22 * S
        self.d.ellipse([cx - r, cy - r, cx + r, cy + r], fill='white',
                       outline=GREEN if ok else RED, width=4 * S)
        wdt = 6 * S
        if ok:
            self.d.line([(cx - 10 * S, cy + 1 * S), (cx - 3 * S, cy + 9 * S)], fill=GREEN, width=wdt)
            self.d.line([(cx - 3 * S, cy + 9 * S), (cx + 11 * S, cy - 8 * S)], fill=GREEN, width=wdt)
        else:
            self.d.line([(cx - 9 * S, cy - 9 * S), (cx + 9 * S, cy + 9 * S)], fill=RED, width=wdt)
            self.d.line([(cx - 9 * S, cy + 9 * S), (cx + 9 * S, cy - 9 * S)], fill=RED, width=wdt)

    def badge_edge(self, gx1, gy1, gx2, gy2, ok=True):
        (x1, y1), (x2, y2) = self.pt(gx1, gy1), self.pt(gx2, gy2)
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
        r = 22 * S
        self.d.ellipse([cx - r, cy - r, cx + r, cy + r], fill='white',
                       outline=GREEN if ok else RED, width=4 * S)
        wdt = 6 * S
        if ok:
            self.d.line([(cx - 10 * S, cy + 1 * S), (cx - 3 * S, cy + 9 * S)], fill=GREEN, width=wdt)
            self.d.line([(cx - 3 * S, cy + 9 * S), (cx + 11 * S, cy - 8 * S)], fill=GREEN, width=wdt)
        else:
            self.d.line([(cx - 9 * S, cy - 9 * S), (cx + 9 * S, cy + 9 * S)], fill=RED, width=wdt)
            self.d.line([(cx - 9 * S, cy + 9 * S), (cx + 9 * S, cy - 9 * S)], fill=RED, width=wdt)

    def sticker(self, c, r, name, corner='tr', px=34):
        x, y = self.sq(c, r)
        pos = {'tr': (x + (C - px - 6) * S, y + 6 * S), 'tl': (x + 6 * S, y + 6 * S),
               'br': (x + (C - px - 6) * S, y + (C - px - 6) * S)}[corner]
        self.im.alpha_composite(emoji(name, px * S), pos)

    def text(self, x, y, txt, fill=INK):
        self.d.text((x * S, y * S), txt, font=FONT, fill=fill)

    def save(self, name):
        out = self.im.resize((self.w // S, self.h // S), Image.LANCZOS)
        out.save(f'{OUT}/{name}.png')
        print(name, out.size)


os.makedirs(OUT, exist_ok=True)

# 1. Canal rules: grow from the spring, intersection to intersection ------------
b = Board(5, 4)
b.canal(2, 2, 3, 2)
b.canal(3, 2, 3, 1)
b.canal(3, 1, 4, 1)
b.canal(2, 2, 2, 3)
b.spring(2, 2)
# legal next canal: touches the network
b.canal(3, 1, 3, 0, color='#7fb8d8')
b.badge_edge(3, 1, 3, 0, ok=True)
# illegal: floats free of the network
b.canal(0, 3, 1, 3, color='#7fb8d8')
b.badge_edge(0, 3, 1, 3, ok=False)
b.save('canals')

# 2. Irrigation: touching a canal on any side --------------------------------------
b = Board(4, 2)
b.tile(0, 0, 'banana', markers=2, color='beige')
b.tile(1, 0, 'banana', markers=1, color='purple')
b.tile(3, 1, 'pepper', markers=2, color='gray')
b.canal(1, 0, 1, 1)
b.canal(1, 1, 2, 1)
b.spring(2, 1)
b.sticker(0, 0, 'water', 'tr')
b.sticker(1, 0, 'water', 'tr')
b.badge(0, 0, ok=True)
b.badge(1, 0, ok=True)
b.sticker(3, 1, 'sun', 'tr')
b.badge(3, 1, ok=False)
b.save('irrigation')

# 3. Connected areas: same crop, orthogonal ----------------------------------------
b = Board(4, 3)
b.tile(0, 1, 'banana', markers=2, color='beige')
b.tile(1, 1, 'banana', markers=1, color='beige')
b.tile(1, 2, 'banana', markers=1, color='purple')
b.tile(2, 1, 'banana', markers=0)
b.tile(3, 0, 'banana', markers=2, color='gray')   # diagonal: NOT connected
b.canal(1, 1, 1, 2)   # canal through the area does not split it
b.canal(1, 2, 2, 2)
b.spring(2, 2)
b.badge_edge(3, 0.62, 3, 0.62, ok=False)  # corner badge so the tile art stays visible
b.save('areas')

# 4. Drying sequence: lose a marker, then desert ------------------------------------
w_tile, gap = 200, 96
seq = Image.new('RGBA', (4 * w_tile + 3 * gap, w_tile + 10), (0, 0, 0, 0))
import make_icons as mi
tiles = [mi.tile_diagram('pepper', 2, 2, 'gray'), mi.tile_diagram('pepper', 2, 1, 'gray'),
         mi.tile_diagram('pepper', 2, 0, 'gray')]
for i, t in enumerate(tiles):
    seq.alpha_composite(t, (i * (w_tile + gap), 5))
# desert tile
dt = Image.new('RGBA', (w_tile, w_tile), (0, 0, 0, 0))
dd = ImageDraw.Draw(dt)
dd.rounded_rectangle([8, 8, w_tile - 8, w_tile - 8], radius=28, fill=DESERT,
                     outline=DITCH, width=4)
dt.alpha_composite(emoji('desert', 100), (50, 52))
seq.alpha_composite(dt, (3 * (w_tile + gap), 5))
dr = ImageDraw.Draw(seq)
for i in range(3):
    ax = i * (w_tile + gap) + w_tile + 14
    ay = w_tile // 2
    dr.line([(ax, ay), (ax + gap - 42, ay)], fill=INK, width=8)
    dr.polygon([(ax + gap - 42, ay - 14), (ax + gap - 42, ay + 14), (ax + gap - 18, ay)], fill=INK)
    seq.alpha_composite(emoji('sun', 52), (ax + (gap - 42) // 2 - 26, ay - 78))
seq.save(f'{OUT}/drying_seq.png')
print('drying_seq', seq.size)

# 5. Bribe phase: proposal canals on the board ---------------------------------------
b = Board(4, 3)
b.tile(0, 0, 'bean', markers=2, color='purple')
b.tile(0, 1, 'bean', markers=1, color='beige')
b.tile(2, 0, 'potato', markers=2, color='gray')
b.canal(1, 1, 2, 1)
b.canal(2, 1, 3, 1)
b.spring(3, 1)
b.proposal(1, 1, 1, 0, 'purple', width=14)   # purple wants the beans irrigated
b.proposal(2, 1, 2, 0, 'gray', width=14)     # gray wants the potatoes irrigated
# bribe coins beside each proposal, inside the board
mx, my = b.pt(1, 0)
b.im.alpha_composite(emoji('coin', 52 * S), (mx + 14 * S, my + 34 * S))
mx, my = b.pt(2, 0)
b.im.alpha_composite(emoji('coin', 52 * S), (mx + 14 * S, my + 34 * S))
b.save('bribe')

# 6. Scoring example ------------------------------------------------------------------
b = Board(4, 3)
b.tile(0, 1, 'pepper', markers=2, color='beige')
b.tile(1, 1, 'pepper', markers=2, color='beige')
b.tile(1, 2, 'pepper', markers=1, color='gray')
b.tile(2, 1, 'pepper', markers=0)
b.desert(3, 1)
b.canal(1, 1, 1, 2)
b.canal(1, 2, 2, 2)
b.spring(2, 2)
b.save('scoring')

# 7. Set-up sketch: spring in the middle, face-down piles beside the board -------------
b = Board(5, 4, extra_right=int(C * 1.6))
b.spring(2, 2)
px = (M + 5 * C + 30) * S
for i in range(4):
    py = (M + 12 + i * 86) * S
    b.d.rounded_rectangle([px, py, px + 110 * S, py + 70 * S], radius=10 * S,
                          fill='#c9a96a', outline=DITCH, width=3 * S)
    b.d.text((px + 34 * S, py + 18 * S), '11', font=FONT, fill=INK)
b.save('setup')

# 8. Canal pieces for the components card ----------------------------------------------
im = Image.new('RGBA', (560, 170), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
for i, (x, y, horiz) in enumerate([(30, 40, True), (250, 40, True), (470, 30, False)]):
    if horiz:
        d.rounded_rectangle([x, y, x + 180, y + 34], radius=17, fill=WATER,
                            outline='#1a5f8e', width=3)
    else:
        d.rounded_rectangle([x, y, x + 34, y + 120], radius=17, fill=WATER,
                            outline='#1a5f8e', width=3)
d.ellipse([100, 100, 160, 160], fill=WATER, outline='white', width=4)
im.alpha_composite(emoji('water', 36), (112, 110))
im.save(f'{OUT}/canal_pieces.png')
print('canal_pieces', im.size)
