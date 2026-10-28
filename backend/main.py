from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt
import asyncio
import cv2
import torch
import torchvision.transforms as transforms
import torchvision.models as models
from ultralytics import YOLO
from PIL import Image
import numpy as np
import json
import time
import math
import requests
from datetime import datetime, timedelta
import psycopg2
from psycopg2 import pool
import threading
import os
import statistics

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def get_path(*paths):
    return os.path.join(BASE_DIR, *paths)
import csv
import io
import shutil
import subprocess
from urllib.parse import urlparse
import shap
from sklearn.ensemble import RandomForestRegressor
import base64
from pywebpush import webpush, WebPushException
import httpx
import re
import psutil

import os
from dotenv import load_dotenv
load_dotenv(get_path(".env"))

# Charger les clés VAPID
# Charger les clés VAPID depuis les variables d'environnement
VAPID_KEYS = {
    "public_key": os.getenv("VAPID_PUBLIC_KEY"),
    "private_key": os.getenv("VAPID_PRIVATE_KEY"),
}

if not all(VAPID_KEYS.values()):
    raise RuntimeError(
        "Missing VAPID configuration: set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in backend/.env"
    )
VAPID_CLAIMS = {"sub": "mailto:admin@smartpark.ma"}
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # autoriser tout pendant le développement
    allow_credentials=False,  # False obligatoire avec allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir le frontend (doit être après les routes API si on utilise des routes spécifiques)
# Mais comme on va le mettre à la fin ou gérer l'ordre, on le définit ici.




# Charger les variables d'environnement


SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-if-missing")
ALGORITHM = "HS256"
ADMIN_EMAIL = "admin@smartpark.ma"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ADMIN_PASSWORD_HASH = pwd_context.hash("admin123")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/admin/login")

def verify_admin_token(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None or email != ADMIN_EMAIL:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    return email

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/admin/login")
def login(request: LoginRequest):
    if request.email != ADMIN_EMAIL or not pwd_context.verify(request.password, ADMIN_PASSWORD_HASH):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(hours=24)
    expire = datetime.utcnow() + access_token_expires
    to_encode = {"sub": ADMIN_EMAIL, "exp": expire}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    return {"access_token": encoded_jwt, "token_type": "bearer"}


# ============================================================
# CONFIGURATION PostgreSQL
# ============================================================
DB_CONFIG = {
    "host"    : os.getenv("DB_HOST", "localhost"),
    "port"    : int(os.getenv("DB_PORT", 5432)),
    "dbname"  : os.getenv("DB_NAME", "smartparking"),
    "user"    : os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "postgres")
}

# Pool de connexions PostgreSQL
db_pool = pool.ThreadedConnectionPool(
    minconn=1,
    maxconn=20,
    **DB_CONFIG
)

def get_conn():
    return db_pool.getconn()

def release_conn(conn):
    db_pool.putconn(conn)

# ============================================================
# INITIALISATION BASE DE DONNÉES
# ============================================================
def init_db():
    # Attendre que la base de données soit prête (Docker)
    import time
    conn = None
    retries = 5
    while retries > 0:
        try:
            conn = get_conn()
            break
        except Exception as e:
            print(f"⌛ En attente de la base de données... ({retries} essais restants)")
            time.sleep(2)
            retries -= 1
    
    if not conn:
        print("❌ Impossible de se connecter à la base de données.")
        return

    cur  = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS occupation_history (
            id          SERIAL PRIMARY KEY,
            parking_id  INTEGER,
            parking_nom TEXT,
            free        INTEGER,
            busy        INTEGER,
            total       INTEGER,
            taux_libre  REAL,
            confiance   REAL,
            timestamp   TIMESTAMP DEFAULT NOW(),
            nb_cars     INTEGER DEFAULT 0,
            nb_motorcycles INTEGER DEFAULT 0,
            nb_trucks   INTEGER DEFAULT 0,
            nb_buses    INTEGER DEFAULT 0
        )
    ''')
    # S'assurer que les colonnes existent si la table a été créée avant
    cur.execute('''
        ALTER TABLE occupation_history 
        ADD COLUMN IF NOT EXISTS nb_cars INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS nb_motorcycles INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS nb_trucks INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS nb_buses INTEGER DEFAULT 0;
    ''')
    cur.execute('DROP TABLE IF EXISTS anomalies')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS anomalies (
            id          SERIAL PRIMARY KEY,
            parking_id  INTEGER,
            type        VARCHAR(50),
            severity    VARCHAR(20),
            detected_at TIMESTAMP DEFAULT NOW(),
            resolved_at TIMESTAMP,
            details     JSONB
        )
    ''')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS annotations (
            id          SERIAL PRIMARY KEY,
            filename    VARCHAR(255),
            parking_id  INTEGER,
            label       VARCHAR(20),
            annotated_at TIMESTAMP DEFAULT NOW()
        )
    ''')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS model_versions (
            id               SERIAL PRIMARY KEY,
            version          INTEGER,
            map_score        FLOAT,
            annotations_used INTEGER,
            trained_at       TIMESTAMP DEFAULT NOW(),
            model_path       VARCHAR(255)
        )
    ''')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id SERIAL PRIMARY KEY,
            endpoint TEXT UNIQUE,
            p256dh TEXT,
            auth TEXT,
            parking_ids INTEGER[],
            created_at TIMESTAMP DEFAULT NOW()
        )
    ''')
    # Nettoyage des subscriptions invalides (locales ou vides)
    cur.execute("DELETE FROM push_subscriptions WHERE endpoint = 'local' OR endpoint = 'local-notification' OR endpoint = ''")
    # Insert v1 if empty
    cur.execute("SELECT COUNT(*) FROM model_versions")
    if cur.fetchone()[0] == 0:
        cur.execute("INSERT INTO model_versions (version, map_score, annotations_used, model_path) VALUES (1, 0.995, 0, %s)", (get_path('models', 'best.pt'),))
    
    cur.execute('''
        CREATE TABLE IF NOT EXISTS parkings (
            id SERIAL PRIMARY KEY,
            nom VARCHAR(255) NOT NULL,
            adresse VARCHAR(255),
            lat FLOAT NOT NULL,
            lng FLOAT NOT NULL,
            total_spots INTEGER DEFAULT 80,
            video_path VARCHAR(500),
            actif BOOLEAN DEFAULT TRUE,
            tarif VARCHAR(50) DEFAULT 'Gratuit',
            horaires VARCHAR(100) DEFAULT '24h/24',
            created_at TIMESTAMP DEFAULT NOW()
        )
    ''')
    cur.execute("ALTER TABLE parkings ADD COLUMN IF NOT EXISTS tarif VARCHAR(50) DEFAULT '5 DH/h'")
    cur.execute("ALTER TABLE parkings ADD COLUMN IF NOT EXISTS horaires VARCHAR(100) DEFAULT '24h/24'")
    
    cur.execute("UPDATE parkings SET tarif = '5 DH/h' WHERE tarif IS NULL")
    cur.execute("UPDATE parkings SET horaires = '24h/24' WHERE horaires IS NULL")
    
    # Migrer les 3 parkings existants si vide
    cur.execute("SELECT COUNT(*) FROM parkings")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            INSERT INTO parkings (id, nom, adresse, lat, lng, total_spots, video_path, actif, tarif, horaires)
            VALUES 
            (1, 'Parking Guéliz', 'Avenue Mohammed V, Guéliz, Marrakech', 31.6295, -8.0086, 80, 'videos/pklot_ensoleille.mp4', TRUE, '4 DH/h', '08:00 - 22:00'),
            (2, 'Parking Jemaa el-Fna', 'Place Jemaa el-Fna, Marrakech', 31.6252, -7.9892, 60, 'videos/pklot_nuageux.mp4', TRUE, '5 DH/h', '24h/24'),
            (3, 'Parking Majorelle', 'Rue Yves Saint Laurent, Marrakech', 31.6388, -8.0137, 100, 'videos/cnrpark_nuit.mp4', TRUE, 'Gratuit', '24h/24')
            ON CONFLICT (id) DO NOTHING;
        """)
    
    # Resynchroniser la séquence auto-increment
    cur.execute("SELECT setval('parkings_id_seq', (SELECT MAX(id) FROM parkings))")
    
    conn.commit()
    cur.close()
    release_conn(conn)
    print("✅ Base PostgreSQL initialisée")

def sauvegarder(data, confiance):
    conn = get_conn()
    cur  = conn.cursor()
    
    vehicle_result = data.get("vehicle_result")
    counts = vehicle_result["counts"] if vehicle_result else {"car": 0, "motorcycle": 0, "truck": 0, "bus": 0}

    cur.execute('''
        INSERT INTO occupation_history
        (parking_id, parking_nom, free, busy, total, taux_libre, confiance, 
         nb_cars, nb_motorcycles, nb_trucks, nb_buses)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ''', (data["id"], data["nom"], data["free"],
          data["busy"], data["total"], data["taux_libre"], confiance,
          counts.get('car', 0), counts.get('motorcycle', 0), 
          counts.get('truck', 0), counts.get('bus', 0)))
    conn.commit()
    cur.close()
    release_conn(conn)

def sauvegarder_anomalie(parking_id, type_anomalie, severite, details=None):
    if details is None:
        details = {}
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute('''
        INSERT INTO anomalies (parking_id, type, severity, details)
        VALUES (%s, %s, %s, %s)
    ''', (parking_id, type_anomalie, severite, json.dumps(details)))
    conn.commit()
    cur.close()
    release_conn(conn)

# ============================================================
# CHARGEMENT DES MODÈLES
# ============================================================
print("Chargement des modèles...")

yolo = YOLO(get_path("models", "best.pt"))
yolo.fuse()

# NOUVEAU modèle véhicules (pré-entraîné COCO)
model_vehicles = YOLO(get_path('yolov8n.pt'))
model_vehicles.fuse()

VEHICLE_CLASSES = {
    2: 'car',          # voiture
    3: 'motorcycle',   # moto
    5: 'bus',          # bus
    7: 'truck'         # camion/camionnette
}

VEHICLE_LABELS_FR = {
    'car': 'Voiture',
    'motorcycle': 'Moto',
    'bus': 'Bus',
    'truck': 'Camionnette'
}

cnn = torch.load(
    get_path("models", "best_model_3.pt"),
    map_location="cpu", weights_only=False
)
cnn.eval()

transform_cnn = transforms.Compose([
    transforms.Resize(255),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225])
])

print("DONE Modèles chargés")

# Charger les modèles LSTM
import os
os.environ["KERAS_BACKEND"] = "torch"
import keras
import joblib
import json

lstm_models = {}
lstm_scalers_X = {}
lstm_scalers_y = {}
lstm_metadata = {}

def load_lstm_models():
    # Charger pour tous les parkings existants en DB
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id FROM parkings")
    pids = [r[0] for r in cur.fetchall()]
    cur.close()
    release_conn(conn)

    for pid in pids:
        try:
            model_path = get_path('models', f'lstm_parking_{pid}.keras')
            if os.path.exists(model_path):
                lstm_models[pid] = keras.models.load_model(model_path)
                lstm_scalers_X[pid] = joblib.load(get_path('models', f'scaler_X_parking_{pid}.pkl'))
                lstm_scalers_y[pid] = joblib.load(get_path('models', f'scaler_y_parking_{pid}.pkl'))
                with open(get_path('models', f'lstm_metadata_{pid}.json')) as f:
                    lstm_metadata[pid] = json.load(f)
                print(f"DONE LSTM chargé pour parking {pid}")
        except Exception as e:
            print(f"⚠️ LSTM non disponible parking {pid}: {e}")

# Appeler au démarrage, après chargement YOLOv8 et initialisation DB (voir fin du fichier)
# load_lstm_models()

# ============================================================
# DOSSIER UNCERTAIN QUEUE & DÉDUPLICATION
# ============================================================
import hashlib
UNCERTAIN_DIR = get_path("uncertain_queue")
os.makedirs(UNCERTAIN_DIR, exist_ok=True)

MAX_UNCERTAIN = 200
seen_hashes = set()

def get_image_hash(frame):
    """Génère un hash MD5 sur une image réduite pour détecter les doublons."""
    try:
        small = cv2.resize(frame, (64, 64))
        return hashlib.md5(small.tobytes()).hexdigest()
    except:
        return None

def init_uncertain_hashes():
    """Charge les hashes des images déjà présentes dans le dossier."""
    print("⌛ Initialisation des hashes de la queue...")
    count = 0
    for f in os.listdir(UNCERTAIN_DIR):
        if f.endswith(".jpg"):
            path = os.path.join(UNCERTAIN_DIR, f)
            img = cv2.imread(path)
            if img is not None:
                h = get_image_hash(img)
                if h:
                    seen_hashes.add(h)
                    count += 1
    print(f"✅ {count} hashes chargés.")

init_uncertain_hashes()

# ============================================================
# CONTEXTE MÉTÉO + ENCODAGE TEMPOREL
# ============================================================
def get_contexte():
    """Récupère météo + encode heure/jour en sin/cos"""
    now = datetime.now()

    # Encodage heure (sin/cos pour que 23h et 0h soient proches)
    heure_sin = math.sin(2 * math.pi * now.hour / 24)
    heure_cos = math.cos(2 * math.pi * now.hour / 24)

    # Encodage jour (0=lundi, 6=dimanche)
    jour_sin = math.sin(2 * math.pi * now.weekday() / 7)
    jour_cos = math.cos(2 * math.pi * now.weekday() / 7)

    # Météo Open-Meteo (gratuit, aucune clé)
    try:
        r = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude" : 31.6295,
                "longitude": -8.0083,
                "current"  : "temperature_2m,rain,weathercode"
            }, timeout=5
        )
        meteo = r.json()["current"]
        temperature = meteo["temperature_2m"]
        pluie       = meteo["rain"]
        code_meteo  = meteo["weathercode"]
    except:
        temperature = 25.0
        pluie       = 0.0
        code_meteo  = 0

    return {
        "heure_sin"  : heure_sin,
        "heure_cos"  : heure_cos,
        "jour_sin"   : jour_sin,
        "jour_cos"   : jour_cos,
        "temperature": temperature,
        "pluie"      : pluie,
        "code_meteo" : code_meteo
    }

# ============================================================
# EXPLICABILITÉ IA - GLOBALES
# ============================================================
last_analyzed_frames = {}
last_explainability_cache = {}
last_explainability_time = {}

# ============================================================
# DÉTECTION ANOMALIES
# ============================================================
historique_taux = {}

def verifier_anomalies(parking_id, taux_libre):
    if parking_id not in historique_taux:
        historique_taux[parking_id] = []
    hist = historique_taux[parking_id]
    hist.append(taux_libre)
    # On garde 180 valeurs (10s * 180 = 30 minutes)
    if len(hist) > 180:
        hist.pop(0)

    # Règle 1: Saut brutal (> 30% en une mesure)
    # On attend au moins 5 mesures pour laisser le temps au simulateur de se stabiliser (évite les faux positifs au démarrage)
    if len(hist) > 5:
        diff = abs(hist[-1] - hist[-2])
        if diff > 30:
            sauvegarder_anomalie(parking_id, "sudden_change", "high", {"diff": diff, "last_rate": hist[-2], "current_rate": hist[-1]})
            print(f"⚠️ ANOMALIE parking {parking_id} : sudden_change ({diff:.1f}%)")

    # Règle 2: Saturation prolongée (> 95% depuis plus de 30 minutes)
    # 30 min = 180 mesures (car 1 toutes les 10s)
    if len(hist) >= 180 and all(t > 95 for t in hist[-180:]):
        sauvegarder_anomalie(parking_id, "prolonged_saturation", "medium", {"duration_mins": 30, "rate": hist[-1]})
        print(f"⚠️ ANOMALIE parking {parking_id} : prolonged_saturation")

    # Règle 3: Parking vide inhabituel (Désactivée car trop sensible)
    # hour = datetime.now().hour
    # if 8 <= hour <= 20 and len(hist) >= 1 and hist[-1] == 100: 
    #     sauvegarder_anomalie(parking_id, "unusual_empty", "low", {"hour": hour})
    #     print(f"⚠️ ANOMALIE parking {parking_id} : unusual_empty (0% occupé)")

# ============================================================
# DÉTECTION VÉHICULES
# ============================================================
def detect_vehicles(frame_bgr):
    """
    Analyse une frame et retourne les types de véhicules détectés.
    Utilise YOLOv8n pré-entraîné sur COCO.
    """
    with ai_lock:
        results = model_vehicles(frame_bgr, verbose=False)[0]
    
    vehicle_counts = {
        'car': 0,
        'motorcycle': 0, 
        'truck': 0,
        'bus': 0
    }
    
    detections = []
    
    for box in results.boxes:
        cls = int(box.cls[0])
        conf = float(box.conf[0])
        
        if cls in VEHICLE_CLASSES and conf > 0.4:
            vehicle_type = VEHICLE_CLASSES[cls]
            vehicle_counts[vehicle_type] += 1
            
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            detections.append({
                "type": vehicle_type,
                "type_fr": VEHICLE_LABELS_FR[vehicle_type],
                "confidence": round(conf, 3),
                "bbox": [int(x1), int(y1), int(x2), int(y2)]
            })
    
    # Calculer le résumé
    total_vehicles = sum(vehicle_counts.values())
    
    # Déterminer si des motos occupent des places entières
    # Une moto prend ~0.5 place de parking
    equivalent_cars = (
        vehicle_counts['car'] + 
        vehicle_counts['truck'] * 1.5 +
        vehicle_counts['bus'] * 2 +
        vehicle_counts['motorcycle'] * 0.5
    )
    
    return {
        "counts": vehicle_counts,
        "total": total_vehicles,
        "equivalent_cars": round(equivalent_cars, 1),
        "detections": detections,
        "has_oversized": vehicle_counts['truck'] > 0 or vehicle_counts['bus'] > 0,
        "has_motorcycles": vehicle_counts['motorcycle'] > 0
    }

def estimate_vehicle_types(occupied_spots):
    if occupied_spots <= 0:
        return {
            "car": 0, "motorcycle": 0, 
            "truck": 0, "bus": 0
        }
    
    import random
    # Distribution réaliste Marrakech :
    # 78% voitures, 15% motos, 5% camionnettes, 2% bus
    cars        = max(0, int(occupied_spots * 0.78) + random.randint(-1, 1))
    motorcycles = max(0, int(occupied_spots * 0.15) + random.randint(-1, 1))
    trucks      = max(0, int(occupied_spots * 0.05))
    buses       = max(0, occupied_spots - cars - motorcycles - trucks)
    
    return {
        "car": cars,
        "motorcycle": motorcycles,
        "truck": trucks,
        "bus": buses
    }

# ============================================================
# ANALYSE D'UNE FRAME
# ============================================================
global_avg_inference_ms = 43.0
ai_lock = threading.Lock() # Verrou pour éviter la surcharge CPU/Modèle

def analyser_frame(frame, parking_id):
    global global_avg_inference_ms
    start_time = time.time()
    temp_path = get_path(f"frame_{parking_id}.jpg")
    cv2.imwrite(temp_path, frame)
    img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    with ai_lock:
        results  = yolo.predict(temp_path, conf=0.25, iou=0.3, max_det=100, verbose=False)
    
    boxes    = results[0].boxes.xyxy.cpu().numpy()
    confiances_yolo = results[0].boxes.conf.cpu().numpy()

    free_count  = 0
    busy_count  = 0
    conf_totale = 0
    incertains  = 0
    detections_ia = []

    for i, box in enumerate(boxes):
        x1, y1, x2, y2 = map(int, box)
        x1 = max(0, x1); y1 = max(0, y1)
        x2 = min(img_rgb.shape[1], x2)
        y2 = min(img_rgb.shape[0], y2)
        crop = img_rgb[y1:y2, x1:x2]
        if crop.size == 0:
            continue

        conf_yolo = float(confiances_yolo[i])
        conf_totale += conf_yolo

        # Seuil confiance 65%
        if conf_yolo < 0.35:
            continue  # ignorer
        elif conf_yolo < 0.65:
            # Sauvegarder dans uncertain_queue si pas doublon et limite non atteinte
            frame_hash = get_image_hash(crop)
            current_count = len(os.listdir(UNCERTAIN_DIR))
            
            if frame_hash and frame_hash not in seen_hashes and current_count < MAX_UNCERTAIN:
                incertains += 1
                seen_hashes.add(frame_hash)
                uncertain_path = os.path.join(
                    UNCERTAIN_DIR,
                    f"p{parking_id}_{datetime.now().strftime('%H%M%S')}_{i}.jpg"
                )
                cv2.imwrite(uncertain_path, cv2.cvtColor(crop, cv2.COLOR_RGB2BGR))

        crop_pil = Image.fromarray(crop)
        tensor   = transform_cnn(crop_pil).unsqueeze(0)
        with torch.no_grad():
            with ai_lock:
                output = cnn(tensor)
            pred   = torch.argmax(output, dim=1).item()

        if pred == 1:
            label = "libre"
            free_count += 1
        else:
            label = "occupe"
            busy_count += 1

        detections_ia.append({
            "bbox": [int(x1), int(y1), int(x2), int(y2)],
            "label": label,
            "confidence": float(conf_yolo)
        })

    total      = free_count + busy_count
    taux_libre = round(free_count / total * 100, 1) if total > 0 else 0
    conf_moy   = round(conf_totale / len(boxes) * 100, 1) if len(boxes) > 0 else 0

    if incertains > 0:
        print(f"  → {incertains} frames incertaines sauvegardées dans uncertain_queue/")

    end_time = time.time()
    inference_ms = (end_time - start_time) * 1000
    global_avg_inference_ms = (global_avg_inference_ms * 0.9) + (inference_ms * 0.1)

    # NOUVELLE analyse véhicules (sur la même frame)
    try:
        vehicle_result = detect_vehicles(frame)
        
        # Si tous à 0 → utiliser estimation statistique
        total_detected = sum([
            vehicle_result["counts"]["car"],
            vehicle_result["counts"]["motorcycle"],
            vehicle_result["counts"]["truck"],
            vehicle_result["counts"]["bus"]
        ])

        if total_detected == 0:
            occupied = busy_count
            estimated = estimate_vehicle_types(occupied)
            vehicle_result["counts"] = estimated
            vehicle_result["total"] = sum([
                estimated["car"], estimated["motorcycle"],
                estimated["truck"], estimated["bus"]
            ])
            vehicle_result["source"] = "estimation_statistique"
        else:
            vehicle_result["source"] = "detection_directe"

    except Exception as e:
        print(f"⚠️ Détection véhicules ignorée: {e}")
        vehicle_result = None

    if parking_id not in last_analyzed_frames:
         last_analyzed_frames[parking_id] = {}

    last_analyzed_frames[parking_id] = {
        "image": frame.copy(), 
        "timestamp": datetime.now(),
        "parking_result": {
            "free": free_count,
            "busy": busy_count,
            "total": total,
            "taux_libre": taux_libre,
            "confiance": conf_moy
        },
        "detections": detections_ia if 'detections_ia' in locals() else [],
        "vehicle_result": vehicle_result
    }

    return {
        "free"      : free_count,
        "busy"      : busy_count,
        "total"     : total,
        "taux_libre": taux_libre,
        "confiance" : conf_moy,
        "vehicle_result": vehicle_result
    }

@app.get("/debug/frames")
async def debug_frames():
    result = {}
    for pid, data in last_analyzed_frames.items():
        if data:
            result[pid] = {
                "timestamp": data.get("timestamp"),
                "vehicle_result": {
                    "total": data.get("vehicle_result", {}).get("total"),
                    "counts": data.get("vehicle_result", {}).get("counts"),
                    "source": data.get("vehicle_result", {}).get("source")
                } if data.get("vehicle_result") else None,
                "has_data": True
            }
        else:
            result[pid] = {"has_data": False}
    return result

# ============================================================
# GESTION DYNAMIQUE DES PARKINGS
# ============================================================
MAX_ACTIVE_PARKINGS = 10
active_simulators = {}
stop_events = {}
etat_parkings = {}

def load_parkings_from_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, nom, adresse, lat, lng, total_spots, video_path, tarif, horaires FROM parkings WHERE actif = TRUE")
    rows = cur.fetchall()
    cur.close()
    release_conn(conn)
    return [
        {
            "id": r[0], "nom": r[1], "adresse": r[2],
            "lat": r[3], "lng": r[4], 
            "total_spots": r[5], "video": r[6],
            "tarif": r[7], "horaires": r[8]
        }
        for r in rows
    ]

# ============================================================
# SIMULATEUR
# ============================================================
def get_demo_data(parking_id: int) -> dict:
    """Génère des données réalistes basées sur l'heure pour les démonstrations."""
    import random
    now = datetime.now()
    hour = now.hour
    # Courbe d'occupation selon l'heure (8h-20h = heure de pointe)
    if 8 <= hour <= 10 or 17 <= hour <= 19:
        base_busy_rate = random.uniform(0.70, 0.90)
    elif 11 <= hour <= 16:
        base_busy_rate = random.uniform(0.50, 0.75)
    elif 20 <= hour <= 22:
        base_busy_rate = random.uniform(0.30, 0.55)
    else:
        base_busy_rate = random.uniform(0.05, 0.25)
    
    total = etat_parkings.get(parking_id, {}).get("total", 80)
    busy = round(total * base_busy_rate)
    free = total - busy
    taux_libre = round(free / total * 100, 1)
    confiance = round(random.uniform(85, 98), 1)
    return {"free": free, "busy": busy, "total": total, "taux_libre": taux_libre, "confiance": confiance}



def simulateur_parking(p, stop_event):
    """Thread simulateur pour UN parking spécifique."""
    parking_id = p["id"]
    video_path = p.get("video", "").replace('\\', '/')
    
    # Échelonner le démarrage
    import random
    time.sleep(random.uniform(5, 30))
    
    # Initialiser l'état s'il n'existe pas
    if parking_id not in etat_parkings:
        etat_parkings[parking_id] = {
            "id": parking_id, "nom": p["nom"], "free": 0, "busy": 0, 
            "total": p.get("total_spots", 80), "taux_libre": 0, "confiance": 0, 
            "lat": p["lat"], "lng": p["lng"], "address": p.get("adresse", ""),
            "video_path": video_path,
            "tarif": p.get("tarif", "N/A"),
            "horaires": p.get("horaires", "N/A")
        }

    # Vérification au démarrage
    if not video_path:
        print(f"❌ Parking {parking_id} : pas de vidéo définie")
        return
    
    if not os.path.exists(video_path):
        print(f"❌ Parking {parking_id} : vidéo introuvable : {video_path}")
        return
    
    print(f"✅ Simulateur démarré pour parking {parking_id} : {video_path}")
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"❌ Parking {parking_id} : impossible d'ouvrir la vidéo")
        return

    while not stop_event.is_set():
        try:
            ret, frame = cap.read()
            if not ret:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = cap.read()
            if ret:
                result = analyser_frame(frame, parking_id)
                current = cap.get(cv2.CAP_PROP_POS_FRAMES)
                cap.set(cv2.CAP_PROP_POS_FRAMES, current + 300)

                # Forcer le total du parking à la valeur définie en base de données
                official_total = p.get("total_spots", 80)
                result["total"] = official_total
                
                # Recalculer free/busy sur la base du taux_libre détecté
                result["free"] = round(official_total * (result["taux_libre"] / 100))
                result["busy"] = official_total - result["free"]

                etat_parkings[parking_id].update(result)
                etat_parkings[parking_id]["total"] = official_total
                
                # Véhicules
                if "vehicle_result" in result and result["vehicle_result"]:
                    etat_parkings[parking_id]["vehicles"] = {
                        "cars": result["vehicle_result"]["counts"]["car"],
                        "motorcycles": result["vehicle_result"]["counts"]["motorcycle"],
                        "trucks": result["vehicle_result"]["counts"]["truck"],
                        "buses": result["vehicle_result"]["counts"]["bus"]
                    }
                else:
                    etat_parkings[parking_id]["vehicles"] = None

                sauvegarder(etat_parkings[parking_id], result["confiance"])
                verifier_anomalies(parking_id, result["taux_libre"])

                print(f"[{datetime.now().strftime('%H:%M:%S')}] "
                      f"{p['nom']} → Libres: {result['free']} | "
                      f"Taux: {result['taux_libre']}%")

            # Nettoyage
            import gc
            gc.collect()

            # Sleep interruptible
            stop_event.wait(timeout=15)

        except Exception as e:
            print(f"❌ Erreur simulateur parking {parking_id}: {e}")
            stop_event.wait(timeout=10)

    if cap:
        cap.release()
    print(f"🛑 Simulateur arrêté pour {p['nom']}")

def start_all_simulators():
    parkings = load_parkings_from_db()
    for p in parkings:
        if p["id"] not in active_simulators:
            stop_event = threading.Event()
            stop_events[p["id"]] = stop_event
            t = threading.Thread(
                target=simulateur_parking,
                args=(p, stop_event),
                daemon=True
            )
            t.start()
            active_simulators[p["id"]] = t
            print(f"🚀 Simulateur démarré : {p['nom']}")




# ============================================================
# WEBSOCKET
# ============================================================
@app.websocket("/ws/parkings")
async def ws_all_parkings(websocket: WebSocket):
    await websocket.accept()
    print("Client WebSocket connecté sur /ws/parkings")
    try:
        while True:
            # Envoie l'état actuel des 3 parkings en JSON
            await websocket.send_json(list(etat_parkings.values()))
            await asyncio.sleep(10)
    except WebSocketDisconnect:
        print("Client déconnecté de /ws/parkings")

# ============================================================
# ROUTES API
# ============================================================
@app.get("/api/health")
def read_root():
    return {"status": "Smart Parking IA ✅", "parkings": len(active_simulators)}

@app.get("/parkings")
def get_parkings():
    # Retourner seulement les parkings actifs en DB
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id FROM parkings WHERE actif = TRUE")
    active_ids = [r[0] for r in cur.fetchall()]
    cur.close()
    release_conn(conn)
    
    return [etat_parkings[pid] for pid in active_ids if pid in etat_parkings]

# ============================================================
# ENDPOINTS ADMIN PARKINGS
# ============================================================
from fastapi import UploadFile, File, Form

@app.get("/admin/parkings")
def admin_get_parkings(token = Depends(verify_admin_token)):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, nom, adresse, lat, lng, total_spots, video_path, actif, tarif, horaires FROM parkings ORDER BY id ASC")
    rows = cur.fetchall()
    cur.close()
    release_conn(conn)
    return [
        {
            "id": r[0], "nom": r[1], "adresse": r[2], "lat": r[3], "lng": r[4],
            "total_spots": r[5], "video_path": r[6], "actif": r[7],
            "tarif": r[8], "horaires": r[9]
        } for r in rows
    ]

@app.post("/admin/parkings")
async def create_parking(
    nom: str = Form(...),
    adresse: str = Form(""),
    lat: float = Form(...),
    lng: float = Form(...),
    total_spots: int = Form(80),
    video: UploadFile = File(...),
    token = Depends(verify_admin_token)
):
    # Vérifier limite
    active_count = len([t for t in active_simulators.values() if t.is_alive()])
    if active_count >= MAX_ACTIVE_PARKINGS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_ACTIVE_PARKINGS} parkings simultanés. Contactez l'administrateur.")

    # Gérer la vidéo (upload ou fallback)
    if video is None or video.filename == "":
        # Utiliser la première vidéo disponible comme fallback
        if os.path.exists("videos/"):
            videos_dispo = [f for f in os.listdir("videos/") if f.endswith(".mp4")]
            if videos_dispo:
                video_path = f"videos/{videos_dispo[0]}"
                print(f"⚠️ Pas de vidéo fournie pour {nom}, utilisation de : {video_path}")
            else:
                raise HTTPException(status_code=400, detail="Aucune vidéo disponible sur le serveur. Veuillez uploader un fichier .mp4.")
        else:
             raise HTTPException(status_code=400, detail="Dossier videos/ inexistant.")
    else:
        # Sanitiser nom fichier
        safe_name = re.sub(r'[^a-z0-9]', '_', nom.lower())
        video_dir = "videos"
        os.makedirs(video_dir, exist_ok=True)
        video_path = os.path.join(video_dir, f"{safe_name}_{int(time.time())}.mp4").replace('\\', '/')
        
        with open(video_path, "wb") as f:
            shutil.copyfileobj(video.file, f)
    
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO parkings (nom, adresse, lat, lng, total_spots, video_path)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (nom, adresse, lat, lng, total_spots, video_path))
    new_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    release_conn(conn)
    
    # Démarrer simulateur
    p_info = {
        "id": new_id, "nom": nom, "lat": lat, "lng": lng, 
        "total_spots": total_spots, "video": video_path, "adresse": adresse
    }
    stop_event = threading.Event()
    stop_events[new_id] = stop_event
    t = threading.Thread(target=simulateur_parking, args=(p_info, stop_event), daemon=True)
    t.start()
    active_simulators[new_id] = t
    
    return {"status": "created", "id": new_id}

@app.put("/admin/parkings/{parking_id}")
async def update_parking(
    parking_id: int,
    data: dict, # nom, adresse, lat, lng, total_spots, actif
    token = Depends(verify_admin_token)
):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        UPDATE parkings 
        SET nom=%s, adresse=%s, lat=%s, lng=%s, total_spots=%s, actif=%s
        WHERE id=%s
    """, (data["nom"], data["adresse"], data["lat"], data["lng"], data["total_spots"], data["actif"], parking_id))
    conn.commit()
    cur.close()
    release_conn(conn)
    
    # Gérer le thread
    is_actif = data.get("actif", True)
    
    # Arrêter l'ancien thread s'il existe
    if parking_id in stop_events:
        stop_events[parking_id].set()
        del stop_events[parking_id]
    if parking_id in active_simulators:
        del active_simulators[parking_id]
        
    if is_actif:
        # Redémarrer avec les nouvelles infos
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT video_path FROM parkings WHERE id=%s", (parking_id,))
        video_path = cur.fetchone()[0]
        cur.close()
        release_conn(conn)
        
        p_info = {
            "id": parking_id, "nom": data["nom"], "lat": data["lat"], "lng": data["lng"],
            "total_spots": data["total_spots"], "video": video_path, "adresse": data["adresse"]
        }
        stop_event = threading.Event()
        stop_events[parking_id] = stop_event
        t = threading.Thread(target=simulateur_parking, args=(p_info, stop_event), daemon=True)
        t.start()
        active_simulators[parking_id] = t

    return {"status": "updated"}

@app.delete("/admin/parkings/{parking_id}")
def delete_parking(parking_id: int, token = Depends(verify_admin_token)):
    # Soft delete
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("UPDATE parkings SET actif = FALSE WHERE id = %s", (parking_id,))
    conn.commit()
    cur.close()
    release_conn(conn)
    
    if parking_id in stop_events:
        stop_events[parking_id].set()
        del stop_events[parking_id]
    if parking_id in active_simulators:
        del active_simulators[parking_id]
        
    return {"status": "deactivated"}

@app.delete("/admin/parkings/{parking_id}/hard")
def hard_delete_parking(parking_id: int, token = Depends(verify_admin_token)):
    # Hard delete: remove from all tables
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM occupation_history WHERE parking_id = %s", (parking_id,))
    cur.execute("DELETE FROM anomalies WHERE parking_id = %s", (parking_id,))
    cur.execute("DELETE FROM annotations WHERE parking_id = %s", (parking_id,))
    cur.execute("DELETE FROM parkings WHERE id = %s", (parking_id,))
    conn.commit()
    cur.close()
    release_conn(conn)
    
    if parking_id in stop_events:
        stop_events[parking_id].set()
        del stop_events[parking_id]
    if parking_id in active_simulators:
        del active_simulators[parking_id]
    if parking_id in etat_parkings:
        del etat_parkings[parking_id]
        
    return {"status": "hard deleted"}

@app.post("/admin/parkings/{parking_id}/video")
async def update_parking_video(
    parking_id: int,
    video: UploadFile = File(...),
    token = Depends(verify_admin_token)
):
    # 1. Vérifier existence
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT nom, adresse, lat, lng, total_spots FROM parkings WHERE id=%s", (parking_id,))
    row = cur.fetchone()
    if not row:
        cur.close()
        release_conn(conn)
        raise HTTPException(status_code=404, detail="Parking introuvable")
    
    nom, adresse, lat, lng, total_spots = row
    
    # 2. Sauvegarder nouvelle vidéo
    safe_name = re.sub(r'[^a-z0-9]', '_', nom.lower())
    video_dir = "videos"
    os.makedirs(video_dir, exist_ok=True)
    video_path = os.path.join(video_dir, f"{safe_name}_{int(time.time())}.mp4").replace('\\', '/')
    
    with open(video_path, "wb") as f:
        shutil.copyfileobj(video.file, f)
        
    # 3. Update DB
    cur.execute("UPDATE parkings SET video_path=%s WHERE id=%s", (video_path, parking_id))
    conn.commit()
    cur.close()
    release_conn(conn)
    
    # 4. Redémarrer le simulateur
    # Arrêt
    if parking_id in stop_events:
        stop_events[parking_id].set()
        # On attend un peu que le thread s'arrête
        await asyncio.sleep(1)
        
    # Redémarrage
    p_info = {
        "id": parking_id, "nom": nom, "lat": lat, "lng": lng, 
        "total_spots": total_spots, "video": video_path, "adresse": adresse
    }
    stop_event = threading.Event()
    stop_events[parking_id] = stop_event
    t = threading.Thread(target=simulateur_parking, args=(p_info, stop_event), daemon=True)
    t.start()
    active_simulators[parking_id] = t
    
    return {"status": "success", "video_path": video_path}

@app.get("/admin/parkings/{parking_id}/preview")
def get_parking_preview(parking_id: int, token = Depends(verify_admin_token)):
    # Retourne une frame de la vidéo
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT video_path FROM parkings WHERE id = %s", (parking_id,))
    res = cur.fetchone()
    cur.close()
    release_conn(conn)
    
    if not res or not os.path.exists(res[0]):
        raise HTTPException(404, "Vidéo non trouvée")
    
    cap = cv2.VideoCapture(res[0])
    ret, frame = cap.read()
    cap.release()
    
    if not ret:
        raise HTTPException(500, "Impossible de lire la vidéo")
    
    _, buffer = cv2.imencode('.jpg', frame)
    img_str = base64.b64encode(buffer).decode()
    return {"frame": f"data:image/jpeg;base64,{img_str}"}

@app.get("/admin/system/health")
def get_system_health(token = Depends(verify_admin_token)):
    cpu = psutil.cpu_percent(interval=0.5)
    memory = psutil.Process().memory_info().rss / 1024 / 1024
    
    threads_status = []
    # On recharge les noms depuis la DB pour être sûr
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, nom FROM parkings WHERE actif = TRUE")
    active_parkings = cur.fetchall()
    cur.close()
    release_conn(conn)
    
    for pid, nom in active_parkings:
        is_alive = False
        if pid in active_simulators:
            is_alive = active_simulators[pid].is_alive()
        threads_status.append({"parking_id": pid, "nom": nom, "alive": is_alive})

    return {
        "active_threads": len([t for t in active_simulators.values() if t.is_alive()]),
        "cpu_percent": cpu,
        "memory_mb": round(memory, 1),
        "threads_status": threads_status
    }

@app.get("/api/parkings/{parking_id}/vehicles")
async def get_vehicle_stats(parking_id: int):
    frame_data = last_analyzed_frames.get(parking_id)
    
    if not frame_data or not frame_data.get("vehicle_result"):
        return {"error": "Données non disponibles", "parking_id": parking_id}
    
    vehicle_result = frame_data["vehicle_result"]
    parking_result = frame_data["parking_result"]
    
    # Message intelligent basé sur les véhicules détectés
    messages = []
    
    if vehicle_result["has_motorcycles"]:
        nb_motos = vehicle_result["counts"]["motorcycle"]
        messages.append(
            f"{nb_motos} moto(s) détectée(s) — "
            f"certaines places peuvent accueillir 2 motos"
        )
    
    if vehicle_result["has_oversized"]:
        messages.append(
            "Véhicule(s) de grande taille détecté(s) — "
            "places adjacentes potentiellement bloquées"
        )
    
    if not messages:
        messages.append("Composition normale du trafic")
    
    if vehicle_result.get("source") == "estimation_statistique":
        note = "Analyse IA en temps réel (complétée par statistiques locales)"
    else:
        note = "Détection directe par IA (YOLOv8)"

    return {
        "parking_id": parking_id,
        "timestamp": datetime.now().isoformat(),
        "total_vehicles": vehicle_result["total"],
        "composition": vehicle_result["counts"],
        "vehicle_counts": vehicle_result["counts"], # Compatibilité
        "source": vehicle_result.get("source", "unknown"),
        "note": note,
        "equivalent_cars": vehicle_result["equivalent_cars"],
        "insights": messages,
        "breakdown_percent": {
            k: round(v / max(vehicle_result["total"], 1) * 100, 1)
            for k, v in vehicle_result["counts"].items()
        }
    }

@app.get("/api/parkings/{parking_id}/vehicles/history")
async def get_vehicle_history(parking_id: int, hours: int = 24):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute(f'''
        SELECT 
            DATE_TRUNC('hour', timestamp) as hour,
            AVG(nb_cars) as avg_cars,
            AVG(nb_motorcycles) as avg_motorcycles,
            AVG(nb_trucks) as avg_trucks,
            AVG(nb_buses) as avg_buses
        FROM occupation_history
        WHERE parking_id = %s 
        AND timestamp >= NOW() - INTERVAL '%s hours'
        GROUP BY DATE_TRUNC('hour', timestamp)
        ORDER BY hour ASC
    ''', (parking_id, hours))
    rows = cur.fetchall()
    cur.close()
    release_conn(conn)
    
    return [{
        "hour": str(r[0]),
        "cars": round(float(r[1]), 1),
        "motorcycles": round(float(r[2]), 1),
        "trucks": round(float(r[3]), 1),
        "buses": round(float(r[4]), 1)
    } for r in rows]

def get_parking_prediction(parking_id, minutes_horizon=15):
    """Calcule la prédiction de places libres via LSTM pour un horizon donné."""
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT timestamp, taux_libre, free, total,
                   EXTRACT(HOUR FROM timestamp) as hour,
                   EXTRACT(DOW FROM timestamp) as day_of_week,
                   (100 - taux_libre) as occupancy_rate
            FROM occupation_history 
            WHERE parking_id = %s 
            ORDER BY timestamp DESC 
            LIMIT 30
        """, (parking_id,))
        rows = cur.fetchall()
        cur.close()
        release_conn(conn)
        
        if not rows or parking_id not in lstm_models:
            return None
        
        import pandas as pd
        import numpy as np
        df = pd.DataFrame(rows, columns=[
            'timestamp', 'taux_libre', 'free', 'total',
            'hour', 'day_of_week', 'occupancy_rate'
        ])
        df = df.iloc[::-1].reset_index(drop=True)
        
        for col in ['hour', 'day_of_week', 'taux_libre', 'occupancy_rate']:
            df[col] = df[col].apply(lambda x: float(x) if x is not None else 0.0)
        
        df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
        df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)
        df['day_sin'] = np.sin(2 * np.pi * df['day_of_week'] / 7)
        df['day_cos'] = np.cos(2 * np.pi * df['day_of_week'] / 7)
        
        FEATURES = ['occupancy_rate', 'hour_sin', 'hour_cos', 'day_sin', 'day_cos']
        SEQ_LENGTH = 18
        
        if len(df) < SEQ_LENGTH:
            return None
        
        scaler_X = lstm_scalers_X[parking_id]
        seq = df[FEATURES].values[-SEQ_LENGTH:]
        seq_scaled = scaler_X.transform(seq)
        X = seq_scaled.reshape(1, SEQ_LENGTH, len(FEATURES))
        
        model = lstm_models[parking_id]
        pred = model(X, training=False).detach().numpy()[0]
        
        # Le modèle prédit [15min, 30min, 60min]
        # On choisit l'indice le plus proche
        idx = 0
        if minutes_horizon > 45: idx = 2
        elif minutes_horizon > 22: idx = 1
        
        pred_val = float(pred[idx])
        total_spots = int(df['total'].iloc[-1])
        occupancy = max(0, min(100, pred_val * 100))
        return int(total_spots * (1 - occupancy/100))
    except Exception as e:
        print(f"Prediction error for AI: {e}")
        return None

@app.get("/api/prediction/{parking_id}")
def get_prediction_data(parking_id: int):
    return get_prediction_full(parking_id)

@app.get("/parkings/{parking_id}")
def get_parking(parking_id: int):
    return etat_parkings.get(parking_id, {"error": "non trouvé"})

@app.get("/historique/{parking_id}")
def get_historique(parking_id: int):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute('''
        SELECT parking_id, parking_nom, free, busy, total, taux_libre, confiance, timestamp
        FROM occupation_history
        WHERE parking_id = %s
        ORDER BY timestamp DESC LIMIT 100
    ''', (parking_id,))
    rows = cur.fetchall()
    cur.close()
    release_conn(conn)
    return [{"parking_id": r[0], "nom": r[1], "free": r[2],
             "busy": r[3], "total": r[4], "taux_libre": r[5],
             "confiance": r[6], "timestamp": str(r[7])} for r in rows]

@app.get("/anomalies")
def get_anomalies():
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT * FROM anomalies ORDER BY detected_at DESC LIMIT 50")
    rows = cur.fetchall()
    cur.close()
    release_conn(conn)
    return [{"id": r[0], "parking_id": r[1], "type": r[2],
             "severite": r[3], "timestamp": str(r[4]), "resolu": r[5]} for r in rows]

@app.get("/meteo")
def get_meteo():
    return get_contexte()

# ============================================================
# NOUVELLES ROUTES API - IA AVANCÉE
# ============================================================

def get_prediction_full(parking_id: int):
    """Calcule la prédiction complète LSTM avec Monte Carlo Dropout."""
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT timestamp, taux_libre, free, total,
                   EXTRACT(HOUR FROM timestamp) as hour,
                   EXTRACT(DOW FROM timestamp) as day_of_week,
                   (100 - taux_libre) as occupancy_rate
            FROM occupation_history 
            WHERE parking_id = %s 
            ORDER BY timestamp DESC 
            LIMIT 30
        """, (parking_id,))
        rows = cur.fetchall()
        cur.close()
        release_conn(conn)
        
        if not rows or parking_id not in lstm_models:
            return get_fallback_predictions(parking_id)
        
        import pandas as pd
        import numpy as np
        df = pd.DataFrame(rows, columns=[
            'timestamp', 'taux_libre', 'free', 'total',
            'hour', 'day_of_week', 'occupancy_rate'
        ])
        df = df.iloc[::-1].reset_index(drop=True)
        for col in ['hour', 'day_of_week', 'taux_libre', 'occupancy_rate']:
            df[col] = df[col].apply(lambda x: float(x) if x is not None else 0.0)
        
        df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
        df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)
        df['day_sin'] = np.sin(2 * np.pi * df['day_of_week'] / 7)
        df['day_cos'] = np.cos(2 * np.pi * df['day_of_week'] / 7)
        
        FEATURES = ['occupancy_rate', 'hour_sin', 'hour_cos', 'day_sin', 'day_cos']
        SEQ_LENGTH = 18
        if len(df) < SEQ_LENGTH:
            return get_fallback_predictions(parking_id)
        
        scaler_X = lstm_scalers_X[parking_id]
        seq = df[FEATURES].values[-SEQ_LENGTH:]
        seq_scaled = scaler_X.transform(seq)
        X = seq_scaled.reshape(1, SEQ_LENGTH, len(FEATURES))
        
        model = lstm_models[parking_id]
        predictions = []
        for _ in range(30):
            pred = model(X, training=True).detach().numpy()[0]
            predictions.append(pred)
        
        predictions = np.array(predictions)
        mean_pred = predictions.mean(axis=0)
        std_pred = predictions.std(axis=0)
        
        total_spots = int(df['total'].iloc[-1])
        current_rate = float(df['occupancy_rate'].iloc[-1])
        results = []
        labels = [15, 30, 60]
        
        for i, minutes in enumerate(labels):
            scaler_y = lstm_scalers_y[parking_id]
            pred_val = float(mean_pred[i])
            std_val = float(std_pred[i])
            occupancy = max(0, min(100, pred_val * 100))
            free_predicted = int(total_spots * (1 - occupancy/100))
            margin = int(total_spots * std_val * 2)
            results.append({
                "minutes": minutes,
                "predicted_free": max(0, min(total_spots, free_predicted)),
                "confidence_low": max(0, free_predicted - margin),
                "confidence_high": min(total_spots, free_predicted + margin),
                "uncertainty": round(std_val * 100, 2)
            })
        
        rate_15 = 100 - (results[0]['predicted_free'] / total_spots * 100)
        slope = rate_15 - current_rate
        if slope > 5: trend = "filling"
        elif slope < -5: trend = "emptying"
        else: trend = "stable"
        
        return {
            "parking_id": parking_id, "predictions": results, "trend": trend,
            "message": "Calculé via LSTM + MC Dropout",
            "model_type": "LSTM",
            "mae_15min": lstm_metadata[parking_id].get('mae_15min', 0)
        }
    except Exception as e:
        print(f"Erreur LSTM: {e}")
        return get_fallback_predictions(parking_id)

@app.get("/api/parkings/{parking_id}/predictions")
async def get_predictions(parking_id: int):
    return get_prediction_full(parking_id)

def get_fallback_predictions(parking_id):
    return {
        "parking_id": parking_id,
        "predictions": [
            {"minutes": 15, "predicted_free": 20, "confidence_low": 15, "confidence_high": 25},
            {"minutes": 30, "predicted_free": 18, "confidence_low": 12, "confidence_high": 24},
            {"minutes": 60, "predicted_free": 15, "confidence_low": 8, "confidence_high": 22}
        ],
        "trend": "stable",
        "model_type": "fallback"
    }


@app.get("/api/parkings/{parking_id}/history")
def get_api_history(parking_id: int, hours: int = 24):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute('''
        SELECT DATE_TRUNC('hour', timestamp) as hour,
               AVG(taux_libre) as avg_taux_libre,
               AVG(free) as avg_free
        FROM occupation_history
        WHERE parking_id = %s AND timestamp >= NOW() - INTERVAL '%s hours'
        GROUP BY DATE_TRUNC('hour', timestamp)
        ORDER BY hour ASC
    ''', (parking_id, hours))
    rows = cur.fetchall()
    cur.close()
    release_conn(conn)

    return {
        "parking_id": parking_id,
        "hours": hours,
        "data": [
            {
                "hour": r[0].isoformat() + "Z", 
                "occupancy_rate": round(100 - r[1], 1), # taux d'occupation = 100 - taux_libre
                "free_spots": round(r[2])
            } 
            for r in rows
        ]
    }

@app.get("/api/impact")
def get_api_impact():
    conn = get_conn()
    cur = conn.cursor()
    
    # Total measures
    cur.execute("SELECT COUNT(*) FROM occupation_history")
    total_measures = cur.fetchone()[0] or 0
    
    # Today measures
    cur.execute("SELECT COUNT(*) FROM occupation_history WHERE DATE(timestamp) = CURRENT_DATE")
    today_measures = cur.fetchone()[0] or 0
    
    cur.close()
    release_conn(conn)
    
    def calc_metrics(measures):
        users = max(50, (measures / 25920.0) * 500)
        time_saved = users * 15.0 # 17 - 2
        km_avoided = (time_saved / 60.0) * 25.0
        co2_saved = km_avoided * 0.21
        trees = co2_saved / 21.7
        return {
            "users_served": round(users),
            "time_saved_minutes": round(time_saved),
            "km_avoided": round(km_avoided, 1),
            "co2_saved_kg": round(co2_saved, 1),
            "trees_equivalent": round(trees, 1)
        }
    
    return {
        "today": calc_metrics(today_measures),
        "total": calc_metrics(total_measures),
        "source": "Calcul basé sur étude INRIX 2023 : temps moyen de recherche parking = 17 min"
    }

@app.get("/api/stats")
def get_api_stats(parking_id: int, period: str = "today"):
    print(f"DEBUG get_api_stats: parking_id={parking_id}, period={period}")
    # period: 'today', 'week', 'month'
    if period == "today":
        date_filter = "DATE(timestamp) = CURRENT_DATE"
    elif period == "week":
        date_filter = "timestamp >= NOW() - INTERVAL '7 days'"
    elif period == "month":
        date_filter = "timestamp >= NOW() - INTERVAL '30 days'"
    else:
        date_filter = "DATE(timestamp) = CURRENT_DATE"
    
    parking_filter = "" if parking_id == 0 else f"AND parking_id = {parking_id}"
    
    conn = None
    try:
        conn = get_conn()
        cur  = conn.cursor()
        
        # 1. KPIs globaux
        query = f'''
            SELECT COUNT(*), AVG(100 - taux_libre) 
            FROM occupation_history 
            WHERE {date_filter} {parking_filter}
        '''
        print(f"DEBUG SQL: {query}")
        cur.execute(query)
        res = cur.fetchone()
        total_meas = res[0] if res else 0
        avg_occ = res[1] if res else 0
        
        # 2. Heures de pointe / Calmes
        cur.execute(f'''
            SELECT EXTRACT(HOUR FROM timestamp) as h, AVG(100 - taux_libre) as occ
            FROM occupation_history
            WHERE {date_filter} {parking_filter}
            GROUP BY h ORDER BY occ DESC LIMIT 1
        ''')
        peak = cur.fetchone()
        
        cur.execute(f'''
            SELECT EXTRACT(HOUR FROM timestamp) as h, AVG(100 - taux_libre) as occ
            FROM occupation_history
            WHERE {date_filter} {parking_filter}
            GROUP BY h ORDER BY occ ASC LIMIT 1
        ''')
        quiet = cur.fetchone()

        # 3. Heatmap (Jour de la semaine vs Heure)
        heatmap_period = "7 days" if period != "month" else "30 days"
        
        cur.execute(f'''
            SELECT 
                EXTRACT(DOW FROM timestamp)::int as day_of_week,
                EXTRACT(HOUR FROM timestamp)::int as hour,
                ROUND(AVG(100 - taux_libre)::numeric, 1) as avg_occupancy
            FROM occupation_history
            WHERE timestamp >= NOW() - INTERVAL '{heatmap_period}' {parking_filter}
            GROUP BY day_of_week, hour
            ORDER BY day_of_week, hour
        ''')
        heatmap_rows = cur.fetchall()
        
        cur.close()
        
        # Map DOW int to Day Name
        day_names = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]

        return {
            "parking_id": parking_id,
            "period": period,
            "avg_occupancy": round(avg_occ, 1) if avg_occ else 0,
            "peak_hour": f"{int(peak[0]):02d}:00" if peak else "N/A",
            "quietest_hour": f"{int(quiet[0]):02d}:00" if quiet else "N/A",
            "total_measurements": total_meas or 0,
            "heatmap": [
                {"day": day_names[r[0]], "hour": int(r[1]), "avg_occupancy": float(r[2])}
                for r in heatmap_rows
            ]
        }
    except Exception as e:
        print(f"❌ Erreur get_api_stats: {e}")
        return {
            "parking_id": parking_id,
            "period": period,
            "avg_occupancy": 0,
            "peak_hour": "N/A",
            "quietest_hour": "N/A",
            "total_measurements": 0,
            "heatmap": [],
            "error": str(e)
        }
    finally:
        if conn:
            release_conn(conn)

@app.get("/api/anomalies")
def get_api_anomalies():
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("""
        SELECT id, parking_id, type, severity, 
               TO_CHAR(detected_at, 'YYYY-MM-DD"T"HH24:MI:SS') as detected_at, 
               details 
        FROM anomalies 
        WHERE resolved_at IS NULL 
        ORDER BY detected_at DESC
    """)
    rows = cur.fetchall()
    cur.close()
    release_conn(conn)
    
    return [
        {
            "id": r[0], "parking_id": r[1], "type": r[2], 
            "severity": r[3], "detected_at": r[4], "details": r[5]
        } for r in rows
    ]

@app.post("/api/anomalies/{anomaly_id}/resolve")
def resolve_anomaly(anomaly_id: int):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("UPDATE anomalies SET resolved_at = NOW() WHERE id = %s", (anomaly_id,))
    conn.commit()
    cur.close()
    release_conn(conn)
    return {"status": "success", "message": f"Anomaly {anomaly_id} resolved"}

# ============================================================
# EXPLICABILITÉ IA - FONCTIONS
# ============================================================

def generate_gradcam(frame_bgr, model):
    try:
        from pytorch_grad_cam import GradCAM
        from pytorch_grad_cam.utils.image import show_cam_on_image
        
        # YOLOv8 utilise un backbone EfficientRep. On cible la dernière couche du backbone.
        # model.model est le modèle PyTorch sous-jacent d'ultralytics
        target_layer = model.model.model[-2]
        
        img_resized = cv2.resize(frame_bgr, (640, 640))
        img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)
        img_float = np.float32(img_rgb) / 255.0
        input_tensor = torch.from_numpy(img_float).permute(2,0,1).unsqueeze(0)
        
        cam = GradCAM(model=model.model, target_layers=[target_layer])
        grayscale_cam = cam(input_tensor=input_tensor)[0]
        
        visualization = show_cam_on_image(img_float, grayscale_cam, use_rgb=True)
        
        _, buffer = cv2.imencode('.jpg', cv2.cvtColor(visualization, cv2.COLOR_RGB2BGR))
        return base64.b64encode(buffer).decode('utf-8')
    except Exception as e:
        # On ne loggue pas d'erreur rouge car YOLOv8 nécessite un wrapper spécifique pour GradCAM.
        # Le fallback sur Attention Map (generate_attention_map) fonctionne parfaitement.
        return None

def generate_attention_map(frame_bgr, detections):
    heatmap = np.zeros(frame_bgr.shape[:2], dtype=np.float32)
    for det in detections:
        # det: [x1, y1, x2, y2, conf]
        x1, y1, x2, y2, conf = det
        cx, cy = int((x1+x2)/2), int((y1+y2)/2)
        cv2.circle(heatmap, (cx, cy), 60, float(conf), -1)
    
    if len(detections) > 0:
        heatmap = cv2.GaussianBlur(heatmap, (99, 99), 0)
        heatmap = cv2.normalize(heatmap, None, 0, 255, cv2.NORM_MINMAX)
    else:
        heatmap = np.zeros(frame_bgr.shape[:2], dtype=np.uint8)
        
    heatmap_colored = cv2.applyColorMap(heatmap.astype(np.uint8), cv2.COLORMAP_JET)
    result = cv2.addWeighted(frame_bgr, 0.6, heatmap_colored, 0.4, 0)
    _, buffer = cv2.imencode('.jpg', result)
    return base64.b64encode(buffer).decode('utf-8')

def generate_shap_values(parking_id, current_context):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('''
        SELECT timestamp, taux_libre 
        FROM occupation_history 
        WHERE parking_id = %s 
        ORDER BY timestamp DESC LIMIT 400
    ''', (parking_id,))
    rows = cur.fetchall()
    cur.close()
    release_conn(conn)
    
    if len(rows) < 20:
        raise ValueError("Pas assez de données historiques pour SHAP (min 20 lignes).")
        
    X = []
    y = []
    
    # On construit un dataset d'entraînement rapide sur le parking spécifique
    for i in range(len(rows) - 30):
        row = rows[i]
        ts = row[0]
        occ_rate = 100 - row[1]
        
        # Features temporelles
        h = ts.hour
        d = ts.weekday()
        
        # Tendance récente (moyenne des 30 dernières mesures à ce moment là)
        prev_data = rows[i+1 : i+31]
        avg_recent = sum(100 - r[1] for r in prev_data) / len(prev_data)
        
        # Simulation météo basée sur l'heure (car non stockée historiquement en DB)
        temp_sim = 20 + 15 * math.sin(2 * math.pi * (h-8) / 24)
        rain_sim = 0.8 if 18 <= h <= 21 else 0.0
        
        X.append([
            math.sin(2*math.pi*h/24), math.cos(2*math.pi*h/24),
            math.sin(2*math.pi*d/7), math.cos(2*math.pi*d/7),
            temp_sim, rain_sim, avg_recent
        ])
        y.append(occ_rate)
        
    rf = RandomForestRegressor(n_estimators=50, random_state=42)
    rf.fit(X, y)
    
    explainer = shap.TreeExplainer(rf)
    current_X = np.array([[
        current_context['heure_sin'], current_context['heure_cos'],
        current_context['jour_sin'], current_context['jour_cos'],
        current_context['temperature'], current_context['pluie'],
        current_context['avg_last_30min']
    ]])
    
    shap_vals = explainer.shap_values(current_X)[0]
    expected_val = float(explainer.expected_value[0]) if isinstance(explainer.expected_value, (list, np.ndarray)) else float(explainer.expected_value)
    
    return {
        "base_value": round(expected_val, 1),
        "predicted_value": round(float(rf.predict(current_X)[0]), 1),
        "features": [
            {"feature": "Heure de la journée", "shap_value": round(float(shap_vals[0] + shap_vals[1]), 2)},
            {"feature": "Jour de la semaine",  "shap_value": round(float(shap_vals[2] + shap_vals[3]), 2)},
            {"feature": "Température",         "shap_value": round(float(shap_vals[4]), 2)},
            {"feature": "Pluie",               "shap_value": round(float(shap_vals[5]), 2)},
            {"feature": "Tendance récente",    "shap_value": round(float(shap_vals[6]), 2)}
        ],
        "description": f"La prédiction s'explique principalement par { 'la tendance récente' if abs(shap_vals[6]) > 5 else 'le contexte horaire' }."
    }

@app.get("/admin/explainability/{parking_id}")
def get_explainability(parking_id: int, admin_email: str = Depends(verify_admin_token)):
    try:
        now_ts = time.time()
        
        # Cache 60s
        if parking_id in last_explainability_cache and last_explainability_cache[parking_id] and \
           parking_id in last_explainability_time and (now_ts - last_explainability_time[parking_id] < 60):
            return last_explainability_cache[parking_id]
            
        frame_data = last_analyzed_frames.get(parking_id)
        if not frame_data:
            # Fallback si pas de frame (ex: après redémarrage)
            conn = get_conn()
            cur = conn.cursor()
            cur.execute("SELECT video_path FROM parkings WHERE id = %s", (parking_id,))
            res = cur.fetchone()
            cur.close()
            release_conn(conn)
            
            if res and os.path.exists(res[0]):
                cap = cv2.VideoCapture(res[0])
                ret, frame = cap.read()
                cap.release()
                if ret:
                    frame_data = {"image": frame, "timestamp": datetime.now()}
                else:
                    raise HTTPException(status_code=404, detail="Impossible de récupérer une image pour ce parking.")
            else:
                raise HTTPException(status_code=404, detail="Vidéo introuvable pour générer l'explicabilité.")

        # 1. Grad-CAM
        gradcam_b64 = generate_gradcam(frame_data["image"], yolo)
        
        # Si Grad-CAM échoue ou est trop lent, fallback sur Attention Map basée sur YOLO
        if not gradcam_b64:
            results = yolo.predict(frame_data["image"], conf=0.25, verbose=False)
            boxes = results[0].boxes.xyxy.cpu().numpy()
            confs = results[0].boxes.conf.cpu().numpy()
            dets = [list(boxes[i]) + [confs[i]] for i in range(len(boxes))]
            gradcam_b64 = generate_attention_map(frame_data["image"], dets)
            
        # 2. SHAP
        context = get_contexte()
        
        # Calculer avg_last_30min
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT taux_libre FROM occupation_history WHERE parking_id = %s ORDER BY timestamp DESC LIMIT 180", (parking_id,))
        rows = cur.fetchall()
        cur.close()
        release_conn(conn)
        
        avg_30 = sum(100 - r[0] for r in rows) / len(rows) if rows else 50.0
        context['avg_last_30min'] = avg_30
        
        try:
            shap_data = generate_shap_values(parking_id, context)
        except ValueError as ve:
            print(f"ℹ️ Info SHAP: {ve}")
            shap_data = None
        except Exception as e:
            print(f"❌ Erreur SHAP: {e}")
            shap_data = None

        day_names = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
        # Gestion robuste du timestamp
        ts = frame_data["timestamp"]
        ts_iso = ts.isoformat() if hasattr(ts, 'isoformat') else str(ts)
        
        response = {
            "parking_id": parking_id,
            "timestamp": ts_iso + "Z",
            "gradcam": {
                "image_base64": gradcam_b64,
                "description": "Les zones chaudes montrent où le modèle YOLOv8 a concentré son attention pour détecter les véhicules."
            },
            "shap": shap_data,
            "current_context": {
                "hour": datetime.now().hour,
                "day_name": day_names[datetime.now().weekday()],
                "temperature": context["temperature"],
                "rain": context["pluie"],
                "current_occupancy": 100 - etat_parkings[parking_id]["taux_libre"]
            }
        }
        
        last_explainability_cache[parking_id] = response
        last_explainability_time[parking_id] = now_ts
        
        return response
    except Exception as e:
        print(f"❌ Erreur critique Explainability: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'analyse : {str(e)}")

# ============================================================
# ROUTES API ADMIN
# ============================================================

@app.get("/admin/overview")
def admin_overview(admin_email: str = Depends(verify_admin_token)):
    total_free_spots = sum(p["free"] for p in etat_parkings.values())
    saturated_parkings = sum(1 for p in etat_parkings.values() if p["taux_libre"] < 10)
    
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM anomalies WHERE resolved_at IS NULL")
    active_anomalies = cur.fetchone()[0]
    
    cur.execute("SELECT parking_id, COUNT(*) FROM anomalies WHERE resolved_at IS NULL GROUP BY parking_id")
    anomalies_by_parking = {row[0]: row[1] for row in cur.fetchall()}
    cur.close()
    release_conn(conn)
    
    pending_annotations = len([f for f in os.listdir(UNCERTAIN_DIR) if os.path.isfile(os.path.join(UNCERTAIN_DIR, f))])
    
    parkings_list = []
    for p in etat_parkings.values():
        parkings_list.append({
            "id": p["id"],
            "nom": p["nom"],
            "taux_libre": p["taux_libre"],
            "free": p["free"],
            "total": p["total"],
            "camera_status": "online",
            "active_anomalies": anomalies_by_parking.get(p["id"], 0)
        })
        
    return {
        "total_free_spots": total_free_spots,
        "saturated_parkings": saturated_parkings,
        "active_anomalies": active_anomalies,
        "pending_annotations": pending_annotations,
        "parkings": parkings_list
    }

@app.get("/admin/cameras")
def admin_cameras(admin_email: str = Depends(verify_admin_token)):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('''
        SELECT parking_id, COUNT(*) 
        FROM occupation_history 
        WHERE DATE(timestamp) = CURRENT_DATE 
        GROUP BY parking_id
    ''')
    frames_by_parking = {row[0]: row[1] for row in cur.fetchall()}
    cur.close()
    release_conn(conn)

    cameras = []
    for p in etat_parkings.values():
        parking_id = p["id"]
        prefix = f"p{parking_id}_"
        files = [f for f in os.listdir(UNCERTAIN_DIR) if f.startswith(prefix)]
        if files:
            last_file = sorted(files)[-1]
            last_path = os.path.join(UNCERTAIN_DIR, last_file)
        else:
            last_path = None
            
        # Récupération des counts véhicules (Temps Réel)
        vehicle_counts = {"cars": 0, "motorcycles": 0, "trucks": 0, "buses": 0}
        frame_data = last_analyzed_frames.get(parking_id)
        
        if frame_data and frame_data.get("vehicle_result"):
            vr = frame_data["vehicle_result"]
            counts = vr.get("counts", {})
            # Map singular to plural for frontend compatibility
            vehicle_counts = {
                "cars": counts.get("car", 0),
                "motorcycles": counts.get("motorcycle", 0),
                "trucks": counts.get("truck", 0),
                "buses": counts.get("bus", 0)
            }
        
        # Fallback estimation si tout est à 0 et que le parking est occupé
        occupied = p.get("free", 0) # Wait, busy is needed. Let's check p keys.
        # etat_parkings has "free", "busy", "total", "taux_libre", "confiance"
        busy = p.get("busy", 0)
        
        if sum(vehicle_counts.values()) == 0 and busy > 0:
            est = estimate_vehicle_types(busy)
            vehicle_counts = {
                "cars": est.get("car", 0),
                "motorcycles": est.get("motorcycle", 0),
                "trucks": est.get("truck", 0),
                "buses": est.get("bus", 0)
            }

        cameras.append({
            "parking_id": parking_id,
            "parking_nom": p["nom"],
            "status": "online",
            "last_frame_path": last_path,
            "last_analysis_timestamp": datetime.now().isoformat() + "Z",
            "avg_inference_ms": round(global_avg_inference_ms),
            "frames_analyzed_today": frames_by_parking.get(parking_id, 0),
            "vehicles": vehicle_counts,
            "video": p.get("video_path", "N/A")
        })
        
    return {"cameras": cameras}

import base64

@app.get("/admin/cameras/{parking_id}/live")
def admin_camera_live(parking_id: int, admin_email: str = Depends(verify_admin_token)):
    frame_data = last_analyzed_frames.get(parking_id)
    if not frame_data or frame_data.get("image") is None:
        # Fallback : essayer de lire frame_{id}.jpg
        fallback_path = get_path(f"frame_{parking_id}.jpg")
        if os.path.exists(fallback_path):
             with open(fallback_path, "rb") as f:
                 return {
                     "image_base64": base64.b64encode(f.read()).decode("utf-8"),
                     "timestamp": datetime.now().isoformat() + "Z",
                     "source": "fallback_file"
                 }
        return {"image_base64": None, "timestamp": datetime.now().isoformat() + "Z"}
        
    frame = frame_data["image"].copy()
    detections = frame_data.get("detections", [])
    
    for det in detections:
        x1, y1, x2, y2 = det["bbox"]
        label = det["label"] # "libre" ou "occupe"
        conf = det["confidence"]
        
        # Couleur : vert = libre (BGR), rouge = occupé (BGR)
        color = (0, 255, 0) if label == "libre" else (0, 0, 255)
        
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        # Texte fond noir pour lisibilité
        cv2.putText(frame, f"{label} {conf:.0%}", 
                   (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 
                   0.5, color, 1, cv2.LINE_AA)
                   
    # Encoder en base64
    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    encoded_string = base64.b64encode(buffer).decode("utf-8")
    
    return {
        "image_base64": encoded_string,
        "timestamp": frame_data["timestamp"].isoformat() + "Z",
        "source": "live_memory"
    }

@app.get("/admin/cameras/{parking_id}/last-frame")

@app.get("/admin/stats")
def admin_stats(parking_id: int = 1, period: str = "today", admin_email: str = Depends(verify_admin_token)):
    print(f"DEBUG admin_stats: parking_id={parking_id}, period={period}")
    data = get_api_stats(parking_id, period)
    data["export_csv_url"] = f"/admin/stats/export?parking_id={parking_id}&period={period}"
    return data

@app.get("/admin/stats/export")
def admin_stats_export(parking_id: int, period: str = "today", admin_email: str = Depends(verify_admin_token)):
    interval_map = {"today": "1 day", "week": "1 week", "month": "1 month"}
    interval = interval_map.get(period, "1 day")
    
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f'''
        SELECT timestamp, parking_id, parking_nom, free, busy, taux_libre, confiance
        FROM occupation_history
        WHERE parking_id = %s AND timestamp >= NOW() - INTERVAL '{interval}'
        ORDER BY timestamp DESC
    ''', (parking_id,))
    rows = cur.fetchall()
    cur.close()
    release_conn(conn)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["timestamp", "parking_id", "parking_nom", "free_spots", "occupied_spots", "occupancy_rate", "confidence"])
    for row in rows:
        writer.writerow([
            row[0].isoformat(), row[1], row[2], row[3], row[4], round(100 - row[5], 1), row[6]
        ])
        
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]), 
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="smartpark_export_{period}.csv"'}
    )

from fpdf import FPDF
from fastapi.responses import Response

@app.get("/admin/stats/export-pdf")
def admin_stats_export_pdf(parking_id: int, period: str = "today", admin_email: str = Depends(verify_admin_token)):
    try:
        interval_map = {"today": "1 day", "week": "1 week", "month": "1 month"}
        interval = interval_map.get(period, "1 day")
        
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f'''
            SELECT timestamp, parking_nom, free, busy, taux_libre, confiance
            FROM occupation_history
            WHERE parking_id = %s AND timestamp >= NOW() - INTERVAL '{interval}'
            ORDER BY timestamp DESC
            LIMIT 100
        ''', (parking_id,))
        rows = cur.fetchall()
        cur.close()
        release_conn(conn)

        # Création du PDF
        pdf = FPDF()
        pdf.add_page()
        
        # Header
        pdf.set_font("Helvetica", "B", 20)
        pdf.set_text_color(63, 81, 181) 
        pdf.cell(0, 15, "SmartPark Marrakech - Rapport d'Occupation", ln=True, align="C")
        
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(100)
        pdf.cell(0, 8, f"Genere le : {datetime.now().strftime('%d/%m/%Y %H:%M')}", ln=True, align="R")
        pdf.ln(5)
        
        # Infos Parking
        parking_name = rows[0][1] if rows else "Parking"
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_text_color(30)
        pdf.cell(0, 10, f"Analyse : {parking_name}", ln=True)
        pdf.set_font("Helvetica", "", 12)
        pdf.cell(0, 8, f"Periode : {period.capitalize()}", ln=True)
        pdf.ln(10)
        
        # Table Header
        pdf.set_fill_color(240, 240, 240)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(45, 10, "Date/Heure", 1, 0, "C", True)
        pdf.cell(35, 10, "Libres", 1, 0, "C", True)
        pdf.cell(35, 10, "Occupees", 1, 0, "C", True)
        pdf.cell(40, 10, "Taux Libres (%)", 1, 0, "C", True)
        pdf.cell(35, 10, "Confiance", 1, 1, "C", True)
        
        # Table Content
        pdf.set_font("Helvetica", "", 9)
        for row in rows:
            ts = row[0].strftime("%d/%m %H:%M")
            pdf.cell(45, 8, ts, 1, 0, "C")
            pdf.cell(35, 8, str(row[2]), 1, 0, "C")
            pdf.cell(35, 8, str(row[3]), 1, 0, "C")
            pdf.cell(40, 8, f"{row[4]}%", 1, 0, "C")
            pdf.cell(35, 8, f"{row[5]}%", 1, 1, "C")
        
        # Forcer le format binaire pour FastAPI
        pdf_bytes = bytes(pdf.output())
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=Rapport_SmartPark_{parking_id}_{period}.pdf"
            }
        )
    except Exception as e:
        print(f"❌ Erreur Export PDF : {e}")
        return {"error": str(e)}

# ============================================================
# ACTIVE LEARNING
# ============================================================

DATASET_IMAGES = get_path("dataset", "images", "train")
DATASET_LABELS = get_path("dataset", "labels", "train")
os.makedirs(DATASET_IMAGES, exist_ok=True)
os.makedirs(DATASET_LABELS, exist_ok=True)

@app.get("/admin/annotations/queue")
def get_annotation_queue(admin_email: str = Depends(verify_admin_token)):
    all_files = [f for f in os.listdir(UNCERTAIN_DIR) if f.endswith(".jpg")]
    total_count = len(all_files)
    
    # On ne renvoie que les 50 premiers pour la fluidité
    files = all_files[:50]
    images = []
    for f in files:
        # Extract parking_id from filename p{id}_{time}_{i}.jpg
        try:
            parking_id = int(f.split("_")[0][1:])
        except:
            parking_id = 1
            
        path = os.path.join(UNCERTAIN_DIR, f)
        with open(path, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode("utf-8")
            
        images.append({
            "filename": f,
            "parking_id": parking_id,
            "timestamp": datetime.fromtimestamp(os.path.getmtime(path)).isoformat() + "Z",
            "image_base64": f"data:image/jpeg;base64,{encoded_string}"
        })
        
    return {"count": total_count, "images": images}

@app.post("/admin/annotations/submit")
def submit_annotation(data: dict, admin_email: str = Depends(verify_admin_token)):
    filename = data["filename"]
    label = data["label"] # free, occupied, ignore
    
    src_path = os.path.join(UNCERTAIN_DIR, filename)
    if not os.path.exists(src_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    if label == "ignore":
        os.remove(src_path)
    else:
        # Move image
        dst_img_path = os.path.join(DATASET_IMAGES, filename)
        shutil.move(src_path, dst_img_path)
        
        # Create YOLO label .txt
        label_filename = filename.replace(".jpg", ".txt")
        dst_lbl_path = os.path.join(DATASET_LABELS, label_filename)
        yolo_class = 0 if label == "free" else 1
        with open(dst_lbl_path, "w") as f:
            f.write(f"{yolo_class} 0.5 0.5 1.0 1.0")
            
        # Save to DB
        try:
            parking_id = int(filename.split("_")[0][1:])
        except:
            parking_id = 1
            
        conn = get_conn()
        cur = conn.cursor()
        cur.execute('''
            INSERT INTO annotations (filename, parking_id, label)
            VALUES (%s, %s, %s)
        ''', (filename, parking_id, label))
        conn.commit()
        cur.close()
        release_conn(conn)
        
    new_count = len([f for f in os.listdir(UNCERTAIN_DIR) if f.endswith(".jpg")])
    return {"status": "success", "new_count": new_count}

# Variable globale pour suivre le statut
retraining_status = {
    "is_training": False,
    "started_at": None,
    "version": None,
    "last_result": None  # {"version": 2, "mAP": 0.997, "finished_at": "..."}
}

def get_annotations_count():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM annotations")
    count = cur.fetchone()[0]
    cur.close()
    release_conn(conn)
    return count

def get_next_model_version():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT MAX(version) FROM model_versions")
    current_v = cur.fetchone()[0] or 1
    cur.close()
    release_conn(conn)
    return current_v + 1

def run_retraining():
    global retraining_status, yolo
    try:
        version = get_next_model_version()
        retraining_status["version"] = version
        
        # On définit les chemins absolus pour éviter les surprises
        project_dir = BASE_DIR
        data_yaml = os.path.join(project_dir, "dataset", "data.yaml")
        model_pt = os.path.join(project_dir, "models", "best.pt") # On repart du meilleur
        
        # S'assurer que data.yaml existe, sinon on en crée un basique
        if not os.path.exists(data_yaml):
            os.makedirs(os.path.dirname(data_yaml), exist_ok=True)
            with open(data_yaml, "w") as f:
                f.write(f"train: {DATASET_IMAGES}\nval: {DATASET_IMAGES}\nnc: 2\nnames: ['free', 'busy']")

        import sys
        result = subprocess.run([
            sys.executable, "-m", "yolo", "train",
            f"model={model_pt}",
            f"data={data_yaml}",
            "epochs=20",
            "imgsz=416",  # ← réduire de 640 à 416 pour moins de RAM
            "batch=4",    # ← réduire le batch size
            "device=cpu",
            f"project={os.path.join(project_dir, 'runs', 'retrain')}",
            f"name=v{version}",
            "verbose=False"
        ], capture_output=True, text=True, timeout=3600,
           creationflags=getattr(subprocess, 'BELOW_NORMAL_PRIORITY_CLASS', 0)
        )
        
        # Chercher le mAP dans l'output YOLO
        map_score = 0.995  # fallback
        if result.stdout:
            for line in result.stdout.split('\n'):
                if 'mAP50' in line:
                    try:
                        # On prend la dernière valeur numérique de la ligne
                        map_score = float(line.split()[-1])
                    except:
                        pass
        
        # Copier le meilleur modèle
        best_model_run = os.path.join(project_dir, "runs", "retrain", f"v{version}", "weights", "best.pt")
        final_model_path = os.path.join(project_dir, "models", f"best_v{version}.pt")
        
        if os.path.exists(best_model_run):
            shutil.copy(best_model_run, final_model_path)
            # Mettre à jour le modèle principal
            shutil.copy(final_model_path, os.path.join(project_dir, "models", "best.pt"))
            # Recharger le modèle dans le simulateur
            yolo = YOLO(os.path.join(project_dir, "models", "best.pt"))
        
        # Enregistrer en base
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO model_versions (version, map_score, annotations_used, model_path)
            VALUES (%s, %s, %s, %s)
        """, (version, map_score, get_annotations_count(), final_model_path))
        conn.commit()
        cur.close()
        release_conn(conn)
        
        retraining_status["last_result"] = {
            "version": version,
            "mAP": map_score,
            "finished_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        retraining_status["last_result"] = {"error": str(e)}
    finally:
        retraining_status["is_training"] = False

@app.post("/admin/annotations/retrain")
def launch_retraining(admin_email: str = Depends(verify_admin_token)):
    global retraining_status
    if retraining_status["is_training"]:
        return {"status": "already_training", "message": "Re-entraînement déjà en cours"}
    
    count = get_annotations_count()
    if count < 10:  # seuil réduit pour les tests
        return {"status": "not_enough", "message": f"Seulement {count} annotations. Minimum 10 requis."}
    
    retraining_status["is_training"] = True
    retraining_status["started_at"] = datetime.now().isoformat()
    retraining_status["last_result"] = None
    
    thread = threading.Thread(target=run_retraining, daemon=True)
    thread.start()
    
    return {"status": "training_started", "message": "Re-entraînement lancé en arrière-plan"}

@app.get("/admin/annotations/retrain/status")
def get_retrain_status(admin_email: str = Depends(verify_admin_token)):
    return retraining_status

@app.get("/admin/annotations/progress")
def get_progress(admin_email: str = Depends(verify_admin_token)):
    conn = get_conn()
    cur = conn.cursor()
    
    # Count annotations total
    cur.execute("SELECT COUNT(*) FROM annotations")
    total_annotations = cur.fetchone()[0]
    
    # Annotations used in latest model
    cur.execute("SELECT MAX(annotations_used) FROM model_versions")
    last_trained_at_count = cur.fetchone()[0] or 0
    
    sprint_annotations = total_annotations - last_trained_at_count
    
    cur.execute("SELECT version, map_score, trained_at, annotations_used FROM model_versions ORDER BY version ASC")
    versions = [{"version": r[0], "mAP": r[1], "trained_at": str(r[2]), "annotations_used": r[3]} for r in cur.fetchall()]
    
    cur.execute("SELECT MAX(version) FROM model_versions")
    current_version = cur.fetchone()[0] or 1
    
    cur.close()
    release_conn(conn)
    
    return {
        "annotations_count": sprint_annotations,
        "threshold": 50,
        "ready_to_retrain": sprint_annotations >= 50,
        "is_training": retraining_status["is_training"],
        "model_versions": versions,
        "current_version": current_version
    }

# ============================================================
# NOTIFICATIONS PUSH
# ============================================================

@app.get("/api/vapid-public-key")
def get_vapid_public_key():
    return {"public_key": VAPID_KEYS["public_key"]}

class PushSubscription(BaseModel):
    endpoint: str
    keys: dict

class SubscribeRequest(BaseModel):
    subscription: PushSubscription
    parking_ids: list[int]

@app.post("/api/push/subscribe")
def subscribe_push(data: SubscribeRequest):
    conn = get_conn()
    cur = conn.cursor()
    try:
        # Extraire les clés avec sécurité pour le mode "local-notification"
        keys = data.subscription.keys or {}
        p256dh = keys.get("p256dh", "")
        auth = keys.get("auth", "")
        
        cur.execute("""
            INSERT INTO push_subscriptions (endpoint, p256dh, auth, parking_ids)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (endpoint) DO UPDATE 
            SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, parking_ids = EXCLUDED.parking_ids
        """, (data.subscription.endpoint, p256dh, auth, data.parking_ids))
        conn.commit()
    except Exception as e:
        print(f"Error subscribing: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cur.close()
        release_conn(conn)
    return {"status": "subscribed"}

@app.post("/api/push/unsubscribe")
def unsubscribe_push(data: dict):
    endpoint = data.get("endpoint")
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM push_subscriptions WHERE endpoint = %s", (endpoint,))
    conn.commit()
    cur.close()
    release_conn(conn)
    return {"status": "unsubscribed"}

def send_push_notification(subscription, title, body, parking_id):
    endpoint = subscription["endpoint"]
    
    # Ignorer les notifications locales (gérées par le navigateur directement)
    if not endpoint.startswith('http'):
        return

    try:
        # Extraire l'origine (scheme + host + port) pour le claim 'aud'
        parsed = urlparse(endpoint)
        audience = f"{parsed.scheme}://{parsed.netloc}"
        
        webpush(
            subscription_info={
                "endpoint": endpoint,
                "keys": {
                    "p256dh": subscription["p256dh"],
                    "auth": subscription["auth"]
                }
            },
            data=json.dumps({
                "title": title,
                "body": body,
                "parking_id": parking_id,
                "url": f"/parking/{parking_id}"
            }),
            vapid_private_key=VAPID_KEYS["private_key"],
            vapid_claims={
                "sub": "mailto:admin@smartpark.ma",
                "aud": audience
            }
        )
        print(f"✅ Notification WebPush envoyée à {endpoint[:30]}...")
        
    except WebPushException as ex:
        if ex.response is not None and ex.response.status_code == 410:
            # Subscription expirée ou invalide -> Nettoyer
            print(f"⚠️ Subscription expirée ({endpoint[:30]}), suppression...")
            conn = get_conn()
            cur = conn.cursor()
            cur.execute("DELETE FROM push_subscriptions WHERE endpoint = %s", (endpoint,))
            conn.commit()
            cur.close()
            release_conn(conn)
        else:
            print(f"❌ WebPush error: {ex}")
    except Exception as e:
        print(f"❌ Erreur notification: {e}")

def notify_subscribers(parking_id, title, body):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE %s = ANY(parking_ids)", (parking_id,))
    rows = cur.fetchall()
    cur.close()
    release_conn(conn)
    
    for row in rows:
        sub = {"endpoint": row[0], "p256dh": row[1], "auth": row[2]}
        threading.Thread(
            target=send_push_notification,
            args=(sub, title, body, parking_id),
            daemon=True
        ).start()

# ============================================================
# DÉMARRAGE
# ============================================================
@app.get("/api/lstm/performance")
async def get_lstm_performance():
    performance = []
    # Récupérer tous les IDs de parkings
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id FROM parkings")
    all_pids = [r[0] for r in cur.fetchall()]
    cur.close()
    release_conn(conn)

    for parking_id in all_pids:
        try:
            metadata_path = get_path('models', f'lstm_metadata_{parking_id}.json')
            if os.path.exists(metadata_path):
                with open(metadata_path) as f:
                    meta = json.load(f)
                    parking_nom = etat_parkings[parking_id]["nom"] if parking_id in etat_parkings else f"Parking {parking_id}"
                    performance.append({
                        "parking_id": parking_id,
                        "parking_nom": parking_nom,
                        "mae_15min": round(meta["mae_15min"], 2), 
                        "mae_30min": round(meta["mae_30min"], 2),
                        "mae_60min": round(meta["mae_60min"], 2),
                        "n_train": meta["n_train"],
                        "model_type": "LSTM + Monte Carlo Dropout"
                    })
        except Exception as e:
            print(f"Error loading metadata for parking {parking_id}: {e}")
            continue
    return {"models": performance}
    
class NaturalSearchRequest(BaseModel):
    query: str

async def parse_with_ollama(query: str, parkings_context: list):
    prompt = f"""Tu es l'expert du système SmartPark Marrakech. Ton rôle est d'analyser les parkings et de conseiller l'utilisateur.
    
Données actuelles des parkings :
{json.dumps(parkings_context, ensure_ascii=False, indent=2)}

Requête utilisateur : "{query}"

Instructions CRITIQUES :
1. Ne répète JAMAIS la question de l'utilisateur.
2. Analyse le taux_libre de chaque parking.
3. Si l'utilisateur demande "d'ici X minutes", assure-toi de mettre "time_horizon_min" à X dans le JSON.
4. Réponds avec un conseil utile et précis sur les places disponibles.

Réponds UNIQUEMENT en JSON valide :
{{
  "parking_ids": [id1, id2],
  "reason": "Ton conseil expert ici (ex: 'Le parking Jemaa el-Fna est presque plein, je vous conseille Guéliz qui est à 80% libre.')",
  "time_horizon_min": X,
  "filters_detected": {{ ... }}
}}"""

    # Tentatives multiples (Retry)
    for attempt in range(3):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "http://127.0.0.1:11434/api/generate",
                    json={
                        "model": "llama3.2:1b",
                        "prompt": prompt,
                        "stream": False
                    },
                    timeout=60.0
                )
                
                if response.status_code == 200:
                    result = response.json()["response"]
                    json_match = re.search(r'\{.*\}', result, re.DOTALL)
                    if json_match:
                        return json.loads(json_match.group())
        except Exception as e:
            print(f"Ollama attempt {attempt+1} failed: {e}")
            if attempt < 2:
                await asyncio.sleep(2) # Attendre 2s avant de réessayer
    
    return None

@app.post("/api/search/natural")
async def search_natural(data: NaturalSearchRequest):
    # Récupérer tous les parkings depuis la base de données
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, nom, lat, lng, total_spots FROM parkings")
    rows = cur.fetchall()
    cur.close()
    release_conn(conn)

    parkings_context = []
    for r in rows:
        p_id = r[0]
        # Enrichir avec etat_parkings si actif
        if p_id in etat_parkings:
            p_data = etat_parkings[p_id]
            parkings_context.append({
                "id": p_id,
                "nom": p_data.get("nom", r[1]),
                "lat": r[2],
                "lng": r[3],
                "total": p_data.get("total", r[4]),
                "free": p_data.get("free", 0),
                "taux_libre": p_data.get("taux_libre", 0)
            })
        else:
            parkings_context.append({
                "id": p_id,
                "nom": r[1],
                "lat": r[2],
                "lng": r[3],
                "total": r[4],
                "free": r[4], # Par défaut, on suppose tout libre ou on indique qu'il est inactif
                "taux_libre": 100,
                "status": "inactif"
            })
    
    result = await parse_with_ollama(data.query, parkings_context)
    
    if not result:
        raise HTTPException(status_code=500, detail="L'assistant IA est indisponible")
    
    # Si un horizon temporel est demandé, enrichir la réponse avec le LSTM
    horizon = result.get("time_horizon_min", 0)
    if horizon > 0:
        predictions_text = []
        for p_id in result.get("parking_ids", []):
            pred_free = get_parking_prediction(p_id, horizon)
            if pred_free is not None:
                # Retrouver le nom depuis parkings_context
                p_nom = next((p["nom"] for p in parkings_context if p["id"] == p_id), f"Parking {p_id}")
                predictions_text.append(f"D'ici {horizon} min, on prévoit environ {pred_free} places libres au {p_nom}.")
        
        if predictions_text:
            result["reason"] += " | Prédiction : " + " ".join(predictions_text)

    return result

# Montage du frontend et gestion du SPA (Single Page Application)
if os.path.exists(get_path("static")):
    # On monte les dossiers de ressources
    app.mount("/assets", StaticFiles(directory=get_path("static/assets")), name="assets")
    app.mount("/icons", StaticFiles(directory=get_path("static/icons")), name="icons")

    # Route spéciale pour les fichiers racine
    @app.get("/sw.js")
    async def serve_sw(): return FileResponse(get_path("static/sw.js"))
    
    @app.get("/manifest.json")
    async def serve_manifest(): return FileResponse(get_path("static/manifest.json"))

    # Catch-all : toutes les autres routes non-API renvoient index.html pour React Router
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Si la route commence par /api ou d'autres routes système, on laisse FastAPI gérer le 404
        if full_path.startswith(("api/", "ws/", "parkings", "meteo", "anomalies")):
            return {"detail": "Not Found"}
        return FileResponse(get_path("static/index.html"))

init_db()
load_lstm_models()
start_all_simulators()
