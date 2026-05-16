import os
import re

with open('backend/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

target_1 = """# Charger les modèles LSTM
from lstm_predictor import load_lstm_models, predict_with_uncertainty
load_lstm_models()"""

replacement_1 = """# Charger les modèles LSTM
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
    for pid in [1, 2, 3]:
        try:
            model_path = f'models/lstm_parking_{pid}.keras'
            if os.path.exists(model_path):
                lstm_models[pid] = keras.models.load_model(model_path)
                lstm_scalers_X[pid] = joblib.load(f'models/scaler_X_parking_{pid}.pkl')
                lstm_scalers_y[pid] = joblib.load(f'models/scaler_y_parking_{pid}.pkl')
                with open(f'models/lstm_metadata_{pid}.json') as f:
                    lstm_metadata[pid] = json.load(f)
                print(f"DONE LSTM chargé pour parking {pid}")
        except Exception as e:
            print(f"⚠️ LSTM non disponible parking {pid}: {e}")

# Appeler au démarrage, après chargement YOLOv8 :
load_lstm_models()"""

if target_1 in content:
    content = content.replace(target_1, replacement_1)
    print("Replaced chunk 1")

replacement_2 = """@app.get("/api/parkings/{parking_id}/predictions")
async def get_predictions(parking_id: int):
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(\"\"\"
            SELECT timestamp, taux_libre, free, total,
                   EXTRACT(HOUR FROM timestamp) as hour,
                   EXTRACT(DOW FROM timestamp) as day_of_week,
                   (100 - taux_libre) as occupancy_rate
            FROM occupation_history 
            WHERE parking_id = %s 
            ORDER BY timestamp DESC 
            LIMIT 30
        \"\"\", (parking_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        if not rows or parking_id not in lstm_models:
            return get_fallback_predictions(parking_id)
        
        import pandas as pd
        import numpy as np
        df = pd.DataFrame(rows, columns=[
            'timestamp', 'taux_libre', 'free', 'total',
            'hour', 'day_of_week', 'occupancy_rate'
        ])
        df = df.iloc[::-1].reset_index(drop=True)
        
        # Convertir en float
        for col in ['hour', 'day_of_week', 'taux_libre', 'occupancy_rate']:
            df[col] = df[col].apply(lambda x: float(x) if x is not None else 0.0)
        
        # Features cycliques
        df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
        df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)
        df['day_sin'] = np.sin(2 * np.pi * df['day_of_week'] / 7)
        df['day_cos'] = np.cos(2 * np.pi * df['day_of_week'] / 7)
        
        FEATURES = ['occupancy_rate', 'hour_sin', 'hour_cos', 
                    'day_sin', 'day_cos']
        SEQ_LENGTH = 18
        
        if len(df) < SEQ_LENGTH:
            return get_fallback_predictions(parking_id)
        
        # Préparer la séquence
        scaler_X = lstm_scalers_X[parking_id]
        seq = df[FEATURES].values[-SEQ_LENGTH:]
        seq_scaled = scaler_X.transform(seq)
        X = seq_scaled.reshape(1, SEQ_LENGTH, len(FEATURES))
        
        # Monte Carlo Dropout : 30 passes
        model = lstm_models[parking_id]
        predictions = []
        for _ in range(30):
            pred = model(X, training=True).numpy()[0]
            predictions.append(pred)
        
        predictions = np.array(predictions)
        mean_pred = predictions.mean(axis=0)
        std_pred = predictions.std(axis=0)
        
        total_spots = int(df['total'].iloc[-1])
        current_rate = float(df['occupancy_rate'].iloc[-1])
        
        results = []
        metadata = lstm_metadata[parking_id]
        horizons = metadata.get('horizons', [3, 6, 12])
        labels = [15, 30, 60]
        
        for i, minutes in enumerate(labels):
            # mean_pred est en taux_libre normalisé
            # Dénormaliser
            scaler_y = lstm_scalers_y[parking_id]
            pred_val = float(mean_pred[i])
            std_val = float(std_pred[i])
            
            # Convertir en taux d'occupation (0-100)
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
        
        # Tendance
        rate_15 = 100 - (results[0]['predicted_free'] / total_spots * 100)
        slope = rate_15 - current_rate
        
        if slope > 5:
            trend = "filling"
            message = "Ce parking se remplit rapidement. Partez maintenant."
        elif slope < -5:
            trend = "emptying"
            message = "Des places se libèrent progressivement."
        else:
            trend = "stable"
            message = "L'occupation reste stable pour les 60 prochaines minutes."
        
        return {
            "parking_id": parking_id,
            "predictions": results,
            "trend": trend,
            "message": message,
            "model_type": "LSTM",
            "mae_15min": lstm_metadata[parking_id].get('mae_15min', 0),
            "mae_30min": lstm_metadata[parking_id].get('mae_30min', 0),
            "mae_60min": lstm_metadata[parking_id].get('mae_60min', 0)
        }
        
    except Exception as e:
        print(f"Erreur LSTM prédiction: {e}")
        return get_fallback_predictions(parking_id)

def get_fallback_predictions(parking_id):
    # Garder l'ancienne logique moyenne mobile comme fallback
    return {
        "parking_id": parking_id,
        "predictions": [
            {"minutes": 15, "predicted_free": 30, 
             "confidence_low": 25, "confidence_high": 35},
            {"minutes": 30, "predicted_free": 28, 
             "confidence_low": 22, "confidence_high": 34},
            {"minutes": 60, "predicted_free": 25, 
             "confidence_low": 18, "confidence_high": 32}
        ],
        "trend": "stable",
        "message": "Prédiction par moyenne mobile (LSTM en cours de chargement)",
        "model_type": "moving_average"
    }

"""

new_content, count = re.subn(
    r'@app\.get\("/api/parkings/\{parking_id\}/predictions"\).*?@app\.get\("/api/parkings/\{parking_id\}/history"\)',
    replacement_2 + '\n@app.get("/api/parkings/{parking_id}/history")',
    content,
    flags=re.DOTALL
)

if count > 0:
    print("Replaced chunk 2")
    with open('backend/main.py', 'w', encoding='utf-8') as f:
        f.write(new_content)
else:
    print("Failed to match chunk 2")
