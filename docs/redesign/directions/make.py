# Builds one copy of the Creator Lab per design direction: the direction's CSS on top, and the 3D room recoloured.
import sys, pathlib
here = pathlib.Path(__file__).parent
base = (here / '../creator-lab/src/creator.html').read_text()
ROOMS = {  # (main stage room, option-picture room)
  'night': (("'#2e2c28', '#151514', '#070707'"), ("'#2c2b28', '#1f1e1d', '#151514'")),
  'sharp': (None, None),
  'drop':  (("'#ffffff', '#f6f6f6', '#ececec'"), ("'#ffffff', '#f6f6f6', '#eeeeee'")),
}
FONTS = {'drop': '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&display=swap">'}
for name in (sys.argv[1:] or ROOMS):
    h = base
    a, b = ROOMS[name]
    if a: assert "roomTexture('#f6f5f2', '#e3e2dd', '#cfcec8')" in h; h = h.replace("roomTexture('#f6f5f2', '#e3e2dd', '#cfcec8')", f"roomTexture({a})")
    if b: assert "roomTexture('#f7f6f3', '#eceae5', '#dcdad4')" in h; h = h.replace("roomTexture('#f7f6f3', '#eceae5', '#dcdad4')", f"roomTexture({b})")
    css = (here / f'{name}.css').read_text()
    h = h.replace('</style>', css + '\n</style>', 1) if False else h + f'\n<style>\n{css}\n</style>\n'
    h = FONTS.get(name, '') + h
    (here / f'{name}.html').write_text(h)
    print(name, len(h))
