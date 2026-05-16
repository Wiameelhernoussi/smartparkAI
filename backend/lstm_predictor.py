import os
import numpy as np
# Set backend before importing keras
os.environ["KERAS_BACKEND"] = "torch"
import keras
import joblib
import json
import psycopg2
from datetime import datetime

# Charger tous les modèles au démarrage
lstm_models = {}
scalers_X = {}
scalers_y = {}
lstm_metadata = {}

def load_lstm_models():
    for parking_id in [1, 2, 3]:
        try:
            model_path = f'models/lstm_parking_{parking_id}.keras'
            if os.path.exists(model_path):
                lstm_models[parking_id] = keras.models.load_model(model_path)
                scalers_X[parking_id] = joblib.load(
                    f'models/scaler_X_parking_{parking_id}.pkl'
                )
                scalers_y[parking_id] = joblib.load(
                    f'models/scaler_y_parking_{parking_id}.pkl'
                )
                with open(f'models/lstm_metadata_{parking_id}.json') as f:
                    lstm_metadata[parking_id] = json.load(f)
                print(f"DONE LSTM chargé pour parking {parking_id}")
            else:
                print(f"WARNING Modèle non trouvé pour parking {parking_id}")
        except Exception as e:
            print(f"ERROR LSTM non disponible pour parking {parking_id}: {e}")

def predict_with_uncertainty(parking_id, historical_data, n_samples=50):
    """
    Monte Carlo Dropout : 50 passes forward avec Dropout actif
    → moyenne = prédiction
    → écart-type = incertitude (intervalle de confiance)
    """
    if parking_id not in lstm_models:
        return None
    
    model = lstm_models[parking_id]
    scaler_X = scalers_X[parking_id]
    scaler_y = scalers_y[parking_id]
    metadata = lstm_metadata[parking_id]
    
    seq_length = metadata['seq_length']
    features = metadata['features']
    
    if len(historical_data) < seq_length:
        return None
    
    # Préparer la séquence d'entrée
    seq = historical_data[-seq_length:][features].values
    seq_scaled = scaler_X.transform(seq)
    X = seq_scaled.reshape(1, seq_length, len(features))
    
    # Monte Carlo Dropout : n_samples prédictions
    predictions = []
    # Note: Keras 3 might handle training=True differently depending on the backend
    # but generally it works the same.
    for _ in range(n_samples):
        # training=True active le Dropout pendant l'inférence
        pred = model(X, training=True)
        
        # Conversion universelle Keras 3 (Tensor -> Numpy)
        if hasattr(pred, "detach"):
            # Pour le backend Torch
            pred = pred.detach().cpu().numpy()[0]
        elif hasattr(pred, "numpy"):
            # Pour les autres backends
            pred = pred.numpy()[0]
        else:
            # Fallback direct
            pred = np.array(pred)[0]
            
        predictions.append(pred)
    
    predictions = np.array(predictions)  # shape: (50, 3)
    
    # Statistiques
    mean_pred = predictions.mean(axis=0)   # [15min, 30min, 60min]
    std_pred = predictions.std(axis=0)     # incertitude
    
    # Dénormaliser
    # mean_pred est déjà dans l'échelle d'origine si on n'a pas mis scaler_y sur les targets 
    # mais dans train_lstm on a fait y = targets. So mean_pred est en occupancy_rate.
    
    results = []
    horizons_labels = [15, 30, 60]
    
    for i, minutes in enumerate(horizons_labels):
        occupancy_mean = float(mean_pred[i])
        occupancy_std = float(std_pred[i])
        
        # Clamp entre 0 et 100
        occupancy_mean = max(0, min(100, occupancy_mean))
        
        # Récupérer le total de places depuis les données
        total_spots = int(historical_data['total'].iloc[-1])
        
        free_predicted = int(total_spots * (1 - occupancy_mean/100))
        confidence_low = int(total_spots * (1 - (occupancy_mean + 2*occupancy_std)/100))
        confidence_high = int(total_spots * (1 - (occupancy_mean - 2*occupancy_std)/100))
        
        # Clamp
        free_predicted = max(0, min(total_spots, free_predicted))
        confidence_low = max(0, min(total_spots, confidence_low))
        confidence_high = max(0, min(total_spots, confidence_high))
        
        results.append({
            "minutes": minutes,
            "predicted_free_count": free_predicted,
            "predicted_free": round(100 - occupancy_mean, 1), # Percentage free (what the frontend expects)
            "predicted_occupancy": round(occupancy_mean, 1),
            "confidence_low": round(max(0, 100 - (occupancy_mean + 2*occupancy_std)), 1),
            "confidence_high": round(min(100, 100 - (occupancy_mean - 2*occupancy_std)), 1),
            "uncertainty": round(occupancy_std, 2)
        })
    
    # Calculer la tendance
    current_rate = float(historical_data['occupancy_rate'].iloc[-1] 
                        if 'occupancy_rate' in historical_data.columns 
                        else 100 - historical_data['taux_libre'].iloc[-1])
    rate_15min = results[0]['predicted_occupancy']
    slope = rate_15min - current_rate
    
    if slope > 5:
        trend = "filling"
        message = "Ce parking se remplit rapidement. Partez maintenant si vous voulez y aller."
    elif slope < -5:
        trend = "emptying"
        message = "Des places se libèrent progressivement."
    else:
        trend = "stable"
        message = "L'occupation reste stable pour les 60 prochaines minutes."
    
    return {
        "predictions": results,
        "trend": trend,
        "message": message,
        "model_type": "LSTM",
        "uncertainty_method": "Monte Carlo Dropout (50 samples)"
    }
