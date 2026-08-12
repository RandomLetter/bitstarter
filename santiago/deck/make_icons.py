#!/usr/bin/env python3
"""Compose Santiago tile icons from the rendered emoji (assets/icons/)."""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ICO = os.path.join(HERE, 'assets', 'icons')

CROP_FILL = {
    'banana': '#f7e08a', 'sugar': '#bfe3a8', 'potato': '#e8c79a',
    'bean': '#d9b8e8', 'pepper': '#f5a9a0',
}
EDGE = '#8a6a3a'
INK = '#3a2c1a'
PLAYER = {'beige': '#d9b36c', 'purple': '#8050a8', 'gray': '#8a8f98',
          'black': '#2e2b29', 'white': '#f4f1e8'}
S = 4  # supersample factor


def rounded_tile(size, fill):
    im = Image.new('RGBA', (size * S, size * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([2 * S, 2 * S, size * S - 2 * S, size * S - 2 * S],
                        radius=14 * S, fill=fill, outline=EDGE, width=2 * S)
    return im, d


def paste_emoji(im, name, box):
    e = Image.open(f'{ICO}/{name}.png').convert('RGBA')
    x, y, w, h = [v * S for v in box]
    e = e.resize((w, h), Image.LANCZOS)
    im.alpha_composite(e, (x, y))


def crop_icon(crop, size=160):
    im, _ = rounded_tile(size, CROP_FILL[crop])
    m = int(size * 0.16)
    paste_emoji(im, crop, (m, m, size - 2 * m, size - 2 * m))
    return im.resize((size, size), Image.LANCZOS)


def tile_diagram(crop, planters, markers, marker_color, size=200):
    """A plantation tile like on the web app: planters top-left, markers bottom-right."""
    im, d = rounded_tile(size, CROP_FILL[crop])
    paste_emoji(im, crop, (int(size * 0.28), int(size * 0.22), int(size * 0.46), int(size * 0.46)))
    for i in range(planters):
        paste_emoji(im, 'planter', (10 + i * 30, 8, 32, 32))
    for i in range(markers):
        cx = (size - 26 - i * 38) * S
        cy = (size - 26) * S
        r = 15 * S
        d.ellipse([cx - r, cy - r, cx + r, cy + r],
                  fill=PLAYER[marker_color], outline=INK, width=2 * S)
    return im.resize((size, size), Image.LANCZOS)


def marker_dot(color, size=80):
    im = Image.new('RGBA', (size * S, size * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    m = 6 * S
    d.ellipse([m, m, size * S - m, size * S - m], fill=PLAYER[color],
              outline=INK, width=2 * S)
    return im.resize((size, size), Image.LANCZOS)


if __name__ == '__main__':
    for crop in CROP_FILL:
        crop_icon(crop).save(f'{ICO}/tile_{crop}.png')

    # Placement-penalty diagram pieces
    tile_diagram('bean', 2, 2, 'beige').save(f'{ICO}/diag_bid2.png')
    tile_diagram('bean', 2, 1, 'gray').save(f'{ICO}/diag_pass2.png')
    tile_diagram('pepper', 1, 1, 'purple').save(f'{ICO}/diag_bid1.png')
    tile_diagram('pepper', 1, 0, 'black').save(f'{ICO}/diag_pass1.png')

    # Connected-area strip for the scoring formula
    strip = Image.new('RGBA', (3 * 200 + 2 * 8, 200), (0, 0, 0, 0))
    for i, (mk, mc) in enumerate([(2, 'beige'), (1, 'beige'), (1, 'purple')]):
        strip.alpha_composite(tile_diagram('banana', 2, mk, mc), (i * 208, 0))
    strip.save(f'{ICO}/area_strip.png')

    # Yield-marker row for the components slide
    row = Image.new('RGBA', (5 * 90, 80), (0, 0, 0, 0))
    for i, c in enumerate(['white', 'beige', 'gray', 'black', 'purple']):
        row.alpha_composite(marker_dot(c), (i * 90 + 5, 0))
    row.save(f'{ICO}/markers_row.png')
    print('icons done')
