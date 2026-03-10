#!/usr/bin/env python3
"""Generate simple placeholder icons for TabSnap extension"""

from PIL import Image, ImageDraw, ImageFont

def create_icon(size, output_path):
    # Create a new image with a dark background
    img = Image.new('RGBA', (size, size), (26, 26, 26, 255))
    draw = ImageDraw.Draw(img)

    # Draw a lightning bolt shape (simplified)
    # Using a bright green color (#4CAF50)
    color = (76, 175, 80, 255)

    # Calculate dimensions
    padding = size // 8

    # Draw a stylized "flash" icon
    # Create a polygon that looks like a lightning bolt
    points = [
        (size * 0.6, padding),              # Top right
        (size * 0.4, size * 0.45),          # Middle left
        (size * 0.55, size * 0.45),         # Middle right
        (size * 0.35, size - padding),      # Bottom left
        (size * 0.5, size * 0.55),          # Middle-bottom right
        (size * 0.45, size * 0.55),         # Middle-bottom left
    ]

    draw.polygon(points, fill=color)

    # Save the image
    img.save(output_path, 'PNG')
    print(f'Created {output_path}')

# Generate all three icon sizes
create_icon(16, 'icons/icon16.png')
create_icon(48, 'icons/icon48.png')
create_icon(128, 'icons/icon128.png')

print('All icons generated successfully!')
