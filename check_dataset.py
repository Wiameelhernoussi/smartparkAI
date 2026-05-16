import os
import shutil

# ============================================================
# CONFIGURATION
# ============================================================

# Dataset principal (jour)
MAIN_DIR  = "train/dataset/carpark"

# Dataset nuit (généré par generate_night.py)
NIGHT_DIR = "train/dataset/carpark"  # même dossier, les images nuit sont déjà dedans

# ============================================================
# VÉRIFICATION AVANT FUSION
# ============================================================

def count_images(folder):
    if not os.path.exists(folder):
        return 0
    return len([f for f in os.listdir(folder) if f.endswith('.jpg')])

def main():
    print("=" * 60)
    print("  VÉRIFICATION DU DATASET COMPLET")
    print("=" * 60)

    total = 0
    for split in ["training_set", "valid_set", "test_set"]:
        print(f"\n  {split}:")
        for label in ["busy", "free"]:
            folder = os.path.join(MAIN_DIR, split, label)
            n = count_images(folder)
            total += n

            # Compter séparément jour et nuit
            if os.path.exists(folder):
                all_imgs   = [f for f in os.listdir(folder) if f.endswith('.jpg')]
                night_imgs = [f for f in all_imgs if 'night' in f]
                day_imgs   = [f for f in all_imgs if 'night' not in f]
                print(f"    {label:4s} — total: {n:4d} "
                      f"(jour: {len(day_imgs):3d} + nuit: {len(night_imgs):3d})")

    print(f"\n  TOTAL : {total} images")
    print(f"\n  Votre dataset est prêt !")
    print(f"  Lancez: python smartpark-train.py")
    print("=" * 60)

if __name__ == "__main__":
    main()
