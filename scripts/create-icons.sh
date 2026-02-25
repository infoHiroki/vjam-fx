#!/bin/bash
# Create minimal placeholder PNG icons for development
cd "$(dirname "$0")/.."

# 1x1 transparent PNG (smallest valid PNG)
# We'll use python which is commonly available
python3 -c "
import struct, zlib

def create_png(width, height, filename):
    def chunk(type_code, data):
        c = type_code + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))

    raw = b''
    for y in range(height):
        raw += b'\x00'
        for x in range(width):
            cx, cy = x - width//2, y - height//2
            r2 = cx*cx + cy*cy
            radius = width * 0.35
            thickness = width * 0.08
            if abs(r2**0.5 - radius) < thickness:
                raw += bytes([0, 204, 102])  # Green circle
            else:
                raw += bytes([26, 26, 26])  # Dark bg

    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')

    with open(filename, 'wb') as f:
        f.write(header + ihdr + idat + iend)

create_png(16, 16, 'icons/icon-16.png')
create_png(48, 48, 'icons/icon-48.png')
create_png(128, 128, 'icons/icon-128.png')
print('Icons created!')
"
