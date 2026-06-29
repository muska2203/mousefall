#!/usr/bin/env python3
"""
Генератор простых PNG-заглушек для игровых ассетов.

Создаёт однотонный цветной квадрат заданного размера. Не требует Pillow:
если PIL не установлен, используется ручная генерация PNG через zlib/struct.

Примеры:
    python scripts/gen-placeholder-sprite.py --name idle --dir public/assets/statuses --size 32 --color "#4caf50"
    python scripts/gen-placeholder-sprite.py --name casting --dir public/assets/statuses --color "#9c27b0"
"""

import argparse
import os
import struct
import zlib


def parse_hex_color(color: str) -> tuple[int, int, int]:
    """Преобразует строку вида #RGB или #RRGGBB в кортеж (r, g, b)."""
    color = color.lstrip('#')
    if len(color) == 3:
        color = ''.join(channel * 2 for channel in color)
    if len(color) != 6:
        raise ValueError(f'Invalid color format: {color}. Use #RRGGBB or #RGB.')
    return (
        int(color[0:2], 16),
        int(color[2:4], 16),
        int(color[4:6], 16),
    )


def _png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    """Собирает один PNG-чанк с корректным CRC."""
    chunk = struct.pack('>I', len(data)) + chunk_type + data
    crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
    return chunk + struct.pack('>I', crc)


def generate_png_raw(width: int, height: int, color: tuple[int, int, int], path: str) -> None:
    """Рисует квадрат без Pillow — чисто через байты PNG."""
    pixels = bytearray()
    r, g, b = color
    for _y in range(height):
        pixels.append(0)  # фильтр PNG для строки
        for _x in range(width):
            pixels.extend([r, g, b, 255])

    compressed = zlib.compress(bytes(pixels))

    output = b'\x89PNG\r\n\x1a\n'
    output += _png_chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    output += _png_chunk(b'IDAT', compressed)
    output += _png_chunk(b'IEND', b'')

    with open(path, 'wb') as file:
        file.write(output)


def generate_png_pillow(width: int, height: int, color: tuple[int, int, int], path: str) -> None:
    """Рисует квадрат через Pillow, если он доступен."""
    from PIL import Image  # type: ignore[import-untyped]

    image = Image.new('RGBA', (width, height), (*color, 255))
    image.save(path, 'PNG')


def generate_png(width: int, height: int, color: tuple[int, int, int], path: str) -> None:
    """Генерирует PNG, автоматически выбирая Pillow или raw-реализацию."""
    try:
        generate_png_pillow(width, height, color, path)
    except ImportError:
        generate_png_raw(width, height, color, path)


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Generate a simple colored square PNG placeholder sprite.'
    )
    parser.add_argument('--name', required=True, help='Base filename without .png extension')
    parser.add_argument('--dir', required=True, help='Output directory')
    parser.add_argument('--size', type=int, default=32, help='Width and height in pixels (default: 32)')
    parser.add_argument(
        '--color',
        default='#808080',
        help='Square color as #RRGGBB or #RGB, e.g. #4caf50 (default: #808080)',
    )
    args = parser.parse_args()

    color = parse_hex_color(args.color)
    os.makedirs(args.dir, exist_ok=True)
    output_path = os.path.join(args.dir, f'{args.name}.png')

    generate_png(args.size, args.size, color, output_path)
    print(f'created {output_path} ({args.size}x{args.size})')


if __name__ == '__main__':
    main()
