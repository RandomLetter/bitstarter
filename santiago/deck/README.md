# Santiago — "How to Play" slide deck

A 15-slide deck explaining the rules of Santiago, matching the web app's
visual style. The finished deck is committed here:

- **[Santiago-How-to-Play.pptx](Santiago-How-to-Play.pptx)** — editable PowerPoint
- **[Santiago-How-to-Play.pdf](Santiago-How-to-Play.pdf)** — ready to share

All artwork is generated: crop-tile icons built from emoji, and miniature
board diagrams (canal rules, irrigation, connected areas, drying, bribery,
scoring) drawn to explain each rule visually.

## Regenerating

```sh
node render_emoji.js     # emoji → assets/icons/*.png   (needs playwright + chromium
                         #  and the Noto Color Emoji font)
python3 make_icons.py    # compose tile icons & marker art (needs pillow)
python3 make_diagrams.py # draw the rule-explanation board diagrams
python3 make_deck.py     # build Santiago-How-to-Play.pptx (needs python-pptx)

# optional PDF export:
soffice --headless --convert-to pdf Santiago-How-to-Play.pptx
```

Steps build on each other in that order; the generated `assets/` are
committed, so `make_deck.py` alone is enough for text-only edits.
