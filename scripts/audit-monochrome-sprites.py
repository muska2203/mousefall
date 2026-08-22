#!/usr/bin/env python3
"""
Аудит спрайтов-заглушек: находит PNG, состоящие из одного цвета
(одноцветные квадраты, сгенерированные gen-placeholder-sprite.py).

Декодирует PNG вручную через zlib/struct (без Pillow):
поддерживаются bit depth 8, color types 0/2/3/4/6, все фильтры строк.

Использование:
    python scripts/audit-monochrome-sprites.py [dir]
"""

import os
import struct
import sys
import zlib

PNG_SIG = b'\x89PNG\r\n\x1a\n'

# Число каналов по color type: 0=gray, 2=rgb, 3=palette, 4=gray+alpha, 6=rgba
CHANNELS = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}


def paeth(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def decode_png(path: str):
    """Возвращает (width, height, pixels) — pixels: список кортежей RGBA."""
    with open(path, 'rb') as f:
        data = f.read()
    if data[:8] != PNG_SIG:
        raise ValueError('not a png')

    pos = 8
    ihdr = None
    plte = None
    idat = bytearray()
    trns = None
    while pos < len(data):
        length = struct.unpack('>I', data[pos:pos + 4])[0]
        ctype = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        if ctype == b'IHDR':
            ihdr = struct.unpack('>IIBBBBB', chunk)
        elif ctype == b'PLTE':
            plte = chunk
        elif ctype == b'tRNS':
            trns = chunk
        elif ctype == b'IDAT':
            idat.extend(chunk)
        elif ctype == b'IEND':
            break
        pos += 12 + length

    width, height, bit_depth, color_type, _comp, _filt, interlace = ihdr
    if bit_depth != 8 or interlace != 0 or color_type not in CHANNELS:
        raise ValueError(f'unsupported format: bit_depth={bit_depth} type={color_type} interlace={interlace}')

    bpp = CHANNELS[color_type]
    stride = width * bpp
    raw = zlib.decompress(bytes(idat))

    pixels = []
    prev = bytearray(stride)
    off = 0
    for _y in range(height):
        ftype = raw[off]
        off += 1
        line = bytearray(raw[off:off + stride])
        off += stride
        if ftype == 1:  # Sub
            for i in range(bpp, stride):
                line[i] = (line[i] + line[i - bpp]) & 0xFF
        elif ftype == 2:  # Up
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif ftype == 3:  # Average
            for i in range(stride):
                a = line[i - bpp] if i >= bpp else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 0xFF
        elif ftype == 4:  # Paeth
            for i in range(stride):
                a = line[i - bpp] if i >= bpp else 0
                c = prev[i - bpp] if i >= bpp else 0
                line[i] = (line[i] + paeth(a, prev[i], c)) & 0xFF
        elif ftype != 0:
            raise ValueError(f'unknown filter {ftype}')
        prev = line
        for x in range(width):
            px = line[x * bpp:(x + 1) * bpp]
            if color_type == 0:
                pixels.append((px[0], px[0], px[0], 255))
            elif color_type == 2:
                pixels.append((px[0], px[1], px[2], 255))
            elif color_type == 3:
                idx = px[0]
                r, g, b = plte[idx * 3:idx * 3 + 3]
                a = trns[idx] if trns and idx < len(trns) else 255
                pixels.append((r, g, b, a))
            elif color_type == 4:
                pixels.append((px[0], px[0], px[0], px[1]))
            else:  # 6
                pixels.append((px[0], px[1], px[2], px[3]))
    return width, height, pixels


def audit(root: str) -> None:
    for dirpath, _dirs, files in os.walk(root):
        for name in sorted(files):
            if not name.endswith('.png'):
                continue
            path = os.path.join(dirpath, name)
            try:
                w, h, pixels = decode_png(path)
            except Exception as exc:  # формат вне поддержки — пропускаем с пометкой
                print(f'SKIP  {path}  ({exc})')
                continue
            opaque = [p for p in pixels if p[3] > 0]
            unique = {p[:3] for p in opaque}
            if len(unique) == 1 and len(pixels) == len(opaque):
                color = next(iter(unique))
                print(f'MONO  {path}  {w}x{h}  #{color[0]:02x}{color[1]:02x}{color[2]:02x}')
            elif len(unique) == 1:
                color = next(iter(unique))
                print(f'MONO+ {path}  {w}x{h}  #{color[0]:02x}{color[1]:02x}{color[2]:02x} (есть прозрачные пиксели)')


if __name__ == '__main__':
    audit(sys.argv[1] if len(sys.argv) > 1 else 'public/assets')
