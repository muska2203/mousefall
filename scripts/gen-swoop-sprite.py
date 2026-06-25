import zlib, struct

def chunk(ctype, data):
    c = struct.pack('>I', len(data)) + ctype + data
    crc = zlib.crc32(ctype + data) & 0xffffffff
    return c + struct.pack('>I', crc)

W, H = 128, 128

# Цвета
bg = (0x2a, 0x3a, 0x5a, 0xff)
fg = (0xf0, 0xd0, 0x60, 0xff)
outline = (0xb0, 0x90, 0x30, 0xff)

pixels = [bg] * (W * H)

def set_pixel(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        pixels[y * W + x] = c

def draw_line(x0, y0, x1, y1, c, width=1):
    dx = abs(x1 - x0)
    dy = abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx - dy
    while True:
        for wx in range(-width//2, width//2 + 1):
            for wy in range(-width//2, width//2 + 1):
                set_pixel(x0 + wx, y0 + wy, c)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 > -dy:
            err -= dy
            x0 += sx
        if e2 < dx:
            err += dx
            y0 += sy

def fill_tri(a, b, c_, col):
    minx = max(0, min(a[0], b[0], c_[0]))
    maxx = min(W - 1, max(a[0], b[0], c_[0]))
    miny = max(0, min(a[1], b[1], c_[1]))
    maxy = min(H - 1, max(a[1], b[1], c_[1]))
    def sign(p1, p2, p3):
        return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
    for y in range(miny, maxy + 1):
        for x in range(minx, maxx + 1):
            d1 = sign((x, y), a, b)
            d2 = sign((x, y), b, c_)
            d3 = sign((x, y), c_, a)
            has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
            has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
            if not (has_neg and has_pos):
                set_pixel(x, y, col)

# Рисуем стрелку вниз
line_top = (64, 18)
line_bottom = (64, 88)
draw_line(line_top[0], line_top[1], line_bottom[0], line_bottom[1], outline, width=5)
draw_line(line_top[0], line_top[1], line_bottom[0], line_bottom[1], fg, width=3)

# Наконечник
fill_tri((36, 72), (64, 106), (92, 72), outline)
fill_tri((40, 74), (64, 100), (88, 74), fg)

# Собираем PNG
raw = bytearray()
for y in range(H):
    raw.append(0)
    for x in range(W):
        raw.extend(pixels[y * W + x])

compressed = zlib.compress(bytes(raw))
out = b'\x89PNG\r\n\x1a\n'
out += chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0))
out += chunk(b'IDAT', compressed)
out += chunk(b'IEND', b'')

with open('public/assets/skills/swoop.png', 'wb') as f:
    f.write(out)
print('created public/assets/skills/swoop.png', len(out), 'bytes')
