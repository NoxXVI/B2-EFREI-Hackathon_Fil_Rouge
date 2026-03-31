from pathlib import Path
import os
from PIL import Image, ImageChops

input_dir = Path("C:/Users/HUzka/Projet/EFREI/B2/Hackathon/frontend/public/assets")

def autocrop(img):
    bg = Image.new(img.mode, img.size, img.getpixel((0, 0)))
    
    diff = ImageChops.difference(img, bg)
    diff = ImageChops.add(diff, diff, 2.0, -100)
    
    bbox = diff.getbbox()
    return img.crop(bbox) if bbox else img

for dirpath, dirnames, filenames in os.walk(input_dir):
    for filename in filenames:
        if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif')):
            input_file = Path(dirpath) / filename

            try:
                img = Image.open(input_file).convert("RGBA")
                cropped = autocrop(img)

                # overwrite direct (ou change si tu veux un dossier output)
                cropped.save(input_file)

                print(f"✔ {input_file}")

            except Exception as e:
                print(f"❌ {input_file} -> {e}")