import cv2
import torch
import torchvision.transforms as transforms
import torchvision.models as models
from ultralytics import YOLO
from PIL import Image
import numpy as np

# Charger les modèles
yolo = YOLO('chemin/vers/ton/yolo.pt')

cnn = models.resnet50(pretrained=False)
cnn.fc = torch.nn.Linear(cnn.fc.in_features, 2)
cnn.load_state_dict(torch.load('best_model_3.pt', map_location='cpu'))
cnn.eval()

transform_cnn = transforms.Compose([
    transforms.Resize(255),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225])
])

def analyser_frame(frame, parking_id):
    temp_path = f'frame_parking_{parking_id}.jpg'
    cv2.imwrite(temp_path, frame)
    img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    results = yolo.predict(temp_path, conf=0.25, iou=0.3, max_det=100, verbose=False)
    boxes   = results[0].boxes.xyxy.cpu().numpy()

    free_count = 0
    busy_count = 0

    for box in boxes:
        x1, y1, x2, y2 = map(int, box)
        x1 = max(0, x1); y1 = max(0, y1)
        x2 = min(img_rgb.shape[1], x2)
        y2 = min(img_rgb.shape[0], y2)
        crop = img_rgb[y1:y2, x1:x2]
        if crop.size == 0:
            continue

        crop_pil = Image.fromarray(crop)
        tensor = transform_cnn(crop_pil).unsqueeze(0)
        with torch.no_grad():
            output = cnn(tensor)
            pred   = torch.argmax(output, dim=1).item()

        if pred == 1:
            free_count += 1
        else:
            busy_count += 1

    total      = free_count + busy_count
    taux_libre = round(free_count / total * 100, 1) if total > 0 else 0

    return {
        "parking_id" : parking_id,
        "free"       : free_count,
        "busy"       : busy_count,
        "total"      : total,
        "taux_libre" : taux_libre,
    }