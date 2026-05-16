# Script d'entraînement CNN — Smart Parking IA
# Transfer learning sur ResNet50 (baseline Sprint 1)

import torch
import torch.nn as nn
import torch.optim as optim
import torchvision
import torchvision.transforms as transforms
import torchvision.datasets as datasets
import torchvision.models as models
import matplotlib.pyplot as plt
import numpy as np
import time
import os
from PIL import Image

# ============================================================
# CONFIGURATION
# ============================================================

ROOT_DIR       = './train'
RESULT_DIR     = ROOT_DIR + '/results/'
TRAINING_SET   = ROOT_DIR + '/dataset/carpark/training_set'
VALID_SET      = ROOT_DIR + '/dataset/carpark/valid_set'
TEST_SET       = ROOT_DIR + '/dataset/carpark/test_set'

NUM_EPOCHS     = 10
BATCH_SIZE     = 32
LEARNING_RATE  = 0.001
MODEL_NO = '3'  # ← changé pour ne pas écraser best_model_1 et best_model_2

os.makedirs(RESULT_DIR, exist_ok=True)

# ============================================================
# TRANSFORMATIONS
# ============================================================

transform_train = transforms.Compose([
    transforms.Resize(255),
    transforms.CenterCrop(224),
    transforms.RandomRotation(30),
    transforms.RandomHorizontalFlip(),
    transforms.ColorJitter(brightness=0.5, contrast=0.5),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225])
])

transform_val = transforms.Compose([
    transforms.Resize(255),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225])
])

# ============================================================
# CHARGEMENT DES DONNÉES
# ============================================================

print("Chargement des données...")

trainset     = datasets.ImageFolder(TRAINING_SET, transform=transform_train)
train_loader = torch.utils.data.DataLoader(trainset, batch_size=BATCH_SIZE, shuffle=True)

validset     = datasets.ImageFolder(VALID_SET, transform=transform_val)
valid_loader = torch.utils.data.DataLoader(validset, batch_size=BATCH_SIZE, shuffle=True)

testset      = datasets.ImageFolder(TEST_SET, transform=transform_val)
test_loader  = torch.utils.data.DataLoader(testset, batch_size=BATCH_SIZE, shuffle=True)

class_names   = trainset.classes
dataset_sizes = [len(trainset), len(validset), len(testset)]

print(f"Classes détectées : {class_names}")
print(f"Train      : {dataset_sizes[0]} images")
print(f"Validation : {dataset_sizes[1]} images")
print(f"Test       : {dataset_sizes[2]} images")

# ============================================================
# CLASS WEIGHTS — compense le déséquilibre busy/free
# ============================================================

class_counts = np.array([
    sum(1 for _, label in trainset.samples if label == i)
    for i in range(len(class_names))
])

print(f"\nDistribution des classes :")
for name, count in zip(class_names, class_counts):
    print(f"  {name} : {count} images ({count/sum(class_counts)*100:.1f}%)")

total = sum(class_counts)
class_weights = torch.tensor(
    [total / (len(class_counts) * c) for c in class_counts],
    dtype=torch.float
)
print(f"Class weights appliqués : {dict(zip(class_names, class_weights.numpy().round(3)))}")

# ============================================================
# MODÈLE — ResNet50 avec transfer learning
# ============================================================

print("\nChargement du modèle ResNet50...")
model = models.resnet50(pretrained=True)

for param in model.parameters():
    param.requires_grad = False

fc_inputs = model.fc.in_features
model.fc = nn.Sequential(
    nn.Linear(fc_inputs, 256),
    nn.ReLU(),
    nn.Dropout(0.4),
    nn.Linear(256, 2),
    nn.LogSoftmax(dim=1)
)

device = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')
print(f"Appareil utilisé : {device}")
model = model.to(device)

# ← class_weights envoyés sur le bon device
loss_func = nn.NLLLoss(weight=class_weights.to(device))
optimiser = optim.Adam(model.parameters(), lr=LEARNING_RATE)

# ============================================================
# FONCTIONS D'ENTRAÎNEMENT ET D'ÉVALUATION
# ============================================================

def train_model(model, loss_criterion, optimiser, epochs):
    history = []
    best_val_acc = 0.0

    for epoch in range(epochs):
        start_time = time.time()
        print(f"\nEpoch {epoch+1}/{epochs}")
        print("-" * 40)

        train_loss = train_acc = valid_loss = valid_acc = 0.0

        model.train()
        for i, (inputs, labels) in enumerate(train_loader):
            inputs = inputs.to(device)
            labels = labels.to(device)
            optimiser.zero_grad()
            outputs = model(inputs)
            loss    = loss_criterion(outputs, labels)
            loss.backward()
            optimiser.step()

            train_loss += loss.item() * inputs.size(0)
            _, predictions = torch.max(outputs.data, 1)
            correct = predictions.eq(labels.data.view_as(predictions))
            train_acc += torch.mean(correct.type(torch.FloatTensor)).item() * inputs.size(0)

            if i % 5 == 0:
                print(f"  Batch {i+1}/{len(train_loader)}", end='\r')

        model.eval()
        with torch.no_grad():
            for inputs, labels in valid_loader:
                inputs  = inputs.to(device)
                labels  = labels.to(device)
                outputs = model(inputs)
                loss    = loss_criterion(outputs, labels)

                valid_loss += loss.item() * inputs.size(0)
                _, predictions = torch.max(outputs.data, 1)
                correct = predictions.eq(labels.data.view_as(predictions))
                valid_acc += torch.mean(correct.type(torch.FloatTensor)).item() * inputs.size(0)

        avg_train_loss = train_loss / dataset_sizes[0]
        avg_train_acc  = train_acc  / dataset_sizes[0]
        avg_valid_loss = valid_loss / dataset_sizes[1]
        avg_valid_acc  = valid_acc  / dataset_sizes[1]
        epoch_time     = time.time() - start_time

        history.append([avg_train_loss, avg_valid_loss, avg_train_acc, avg_valid_acc])

        print(f"  Train      — Loss: {avg_train_loss:.4f} | Accuracy: {avg_train_acc*100:.2f}%")
        print(f"  Validation — Loss: {avg_valid_loss:.4f} | Accuracy: {avg_valid_acc*100:.2f}%")
        print(f"  Temps      : {epoch_time:.1f}s")

        if avg_valid_acc > best_val_acc:
            best_val_acc = avg_valid_acc
            torch.save(model, RESULT_DIR + f'best_model_{MODEL_NO}.pt')
            print(f"  Meilleur modèle sauvegardé (val_acc={best_val_acc*100:.2f}%)")

    return model, history


def test_accuracy(model, loss_criterion):
    test_acc = test_loss = 0.0
    all_preds  = []
    all_labels = []

    model.eval()
    with torch.no_grad():
        for inputs, labels in test_loader:
            inputs  = inputs.to(device)
            labels  = labels.to(device)
            outputs = model(inputs)
            loss    = loss_criterion(outputs, labels)

            test_loss += loss.item() * inputs.size(0)
            _, predictions = torch.max(outputs.data, 1)
            correct = predictions.eq(labels.data.view_as(predictions))
            test_acc += torch.mean(correct.type(torch.FloatTensor)).item() * inputs.size(0)

            all_preds.extend(predictions.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())

    avg_test_loss = test_loss / dataset_sizes[2]
    avg_test_acc  = test_acc  / dataset_sizes[2]

    print(f"\n{'='*40}")
    print(f"  RÉSULTATS SUR LE JEU DE TEST")
    print(f"{'='*40}")
    print(f"  Accuracy : {avg_test_acc*100:.2f}%")
    print(f"  Loss     : {avg_test_loss:.4f}")

    from sklearn.metrics import classification_report, confusion_matrix
    print(f"\n  Rapport de classification :")
    print(classification_report(all_labels, all_preds, target_names=class_names))
    print(f"  Matrice de confusion :")
    print(confusion_matrix(all_labels, all_preds))

    return avg_test_acc


# ============================================================
# LANCEMENT DE L'ENTRAÎNEMENT
# ============================================================

print(f"\n{'='*40}")
print(f"  DÉBUT DE L'ENTRAÎNEMENT")
print(f"  Epochs : {NUM_EPOCHS} | Batch : {BATCH_SIZE}")
print(f"{'='*40}\n")

trained_model, history = train_model(model, loss_func, optimiser, NUM_EPOCHS)

torch.save(trained_model, RESULT_DIR + f'carpark_{MODEL_NO}.pt')
print(f"\nModèle final sauvegardé : {RESULT_DIR}carpark_{MODEL_NO}.pt")

test_accuracy(trained_model, loss_func)

# ============================================================
# COURBES D'APPRENTISSAGE
# ============================================================

history = np.array(history)

plt.figure(figsize=(12, 5))

plt.subplot(1, 2, 1)
plt.plot(history[:, 0], label='Train Loss', color='blue')
plt.plot(history[:, 1], label='Val Loss',   color='orange')
plt.legend()
plt.xlabel('Epoch')
plt.ylabel('Loss')
plt.title('Courbe de Loss')
plt.ylim(0, 1)
plt.grid(True)

plt.subplot(1, 2, 2)
plt.plot(history[:, 2] * 100, label='Train Accuracy', color='blue')
plt.plot(history[:, 3] * 100, label='Val Accuracy',   color='orange')
plt.legend()
plt.xlabel('Epoch')
plt.ylabel('Accuracy (%)')
plt.title("Courbe d'Accuracy")
plt.ylim(0, 100)
plt.grid(True)

plt.tight_layout()
curve_path = RESULT_DIR + f'courbes_{MODEL_NO}.png'
plt.savefig(curve_path, dpi=150)
plt.show()

print(f"\nCourbes sauvegardées : {curve_path}")
print("\nEntraînement terminé !")