from pathlib import Path
from PIL import Image, ImageDraw

assets = Path(__file__).resolve().parents[1] / 'assets'
assets.mkdir(exist_ok=True)
size = 1024
im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.rounded_rectangle((0, 0, 1023, 1023), radius=310, fill='#7153a5')
def star(x, y, radius, fill):
    inner = radius * .27
    d.polygon([(x,y-radius),(x+inner,y-inner),(x+radius,y),(x+inner,y+inner),(x,y+radius),(x-inner,y+inner),(x-radius,y),(x-inner,y-inner)], fill=fill)
star(460, 566, 285, '#ffffff')
star(741, 260, 120, '#e8def6')
star(795, 761, 73, '#d1bae9')
im.save(assets / 'icon.png')
im.save(assets / 'icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
im.save(assets / 'icon.icns')
print('Generated PNG, ICO and ICNS icons')
