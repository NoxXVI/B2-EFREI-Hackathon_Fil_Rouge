from PIL import Image
import os

# Chemin de l'image source
input_image_path = "./Tiny RPG Character Asset Pack v1.03b -Free Soldier&Orc/Tiny RPG Character Asset Pack v1.03 -Free Soldier&Orc/Characters(100x100)/Soldier/Soldier with shadows/Soldier-Walk.png"
output_folder = "output/Soldier/walk"

# Créer le dossier de sortie s'il n'existe pas
os.makedirs(output_folder, exist_ok=True)

# Ouvrir l'image
img = Image.open(input_image_path)

width, height = img.size


if width % 100 != 0 or height != 100:
    raise ValueError("L'image doit faire 800x100 (ou largeur multiple de 100 et hauteur 100)")

index = 0
for x in range(0, width, 100):
    box = (x, 0, x + 100, 100)
    cropped = img.crop(box)
    
    output_path = os.path.join(output_folder, f"tile_{index}.png")
    cropped.save(output_path)
    
    index += 1

print(f"{index} images créées dans '{output_folder}'")