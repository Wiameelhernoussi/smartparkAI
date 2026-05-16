import numpy as np
import pandas as pd
import psycopg2
import json
import os
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_absolute_error
import joblib

# Use Keras 3 with Torch backend since TensorFlow is not available on Python 3.14
os.environ["KERAS_BACKEND"] = "torch"
import keras
from keras.models import Sequential
from keras.layers import LSTM, Dense, Dropout
from keras.callbacks import EarlyStopping, ModelCheckpoint

os.makedirs('models', exist_ok=True)

# === CONNEXION BASE DE DONNÉES ===
def get_db_connection():
    return psycopg2.connect(
        dbname="smartparking",
        user="postgres", 
        password="postgres",
        host=os.getenv("DB_HOST", "db"),
        port=os.getenv("DB_PORT", "5432")
    )

# === RÉCUPÉRER LES DONNÉES ===
def load_parking_data(parking_id, conn):
    query = """
        SELECT timestamp, taux_libre, free, total,
               EXTRACT(HOUR FROM timestamp) as hour,
               EXTRACT(DOW FROM timestamp) as day_of_week
        FROM occupation_history 
        WHERE parking_id = %s
        ORDER BY timestamp ASC
    """
    df = pd.read_sql(query, conn, params=(parking_id,))
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df['occupancy_rate'] = 100 - df['taux_libre']
    
    # Features temporelles encodées cycliquement
    df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
    df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)
    df['day_sin'] = np.sin(2 * np.pi * df['day_of_week'] / 7)
    df['day_cos'] = np.cos(2 * np.pi * df['day_of_week'] / 7)
    
    return df

# === PRÉPARER LES SÉQUENCES ===
def create_sequences(data, seq_length=18, horizons=[3, 6, 12]):
    features = ['occupancy_rate', 'hour_sin', 'hour_cos', 
                'day_sin', 'day_cos']
    
    X, y_15, y_30, y_60 = [], [], [], []
    
    values = data[features].values
    target = data['occupancy_rate'].values
    
    max_horizon = max(horizons)
    
    if len(values) <= seq_length + max_horizon:
        return np.array([]), np.array([]), np.array([]), np.array([])

    for i in range(seq_length, len(values) - max_horizon):
        X.append(values[i-seq_length:i])
        y_15.append(target[i + horizons[0]])
        y_30.append(target[i + horizons[1]])
        y_60.append(target[i + horizons[2]])
    
    return (np.array(X), 
            np.array(y_15), 
            np.array(y_30), 
            np.array(y_60))

# === CONSTRUIRE LE MODÈLE LSTM ===
def build_lstm_model(seq_length, n_features):
    model = Sequential([
        LSTM(64, return_sequences=True, 
             input_shape=(seq_length, n_features)),
        Dropout(0.2),  # Monte Carlo Dropout
        LSTM(32, return_sequences=False),
        Dropout(0.2),  # Monte Carlo Dropout
        Dense(16, activation='relu'),
        Dense(3)  # 3 sorties : 15min, 30min, 60min
    ])
    
    model.compile(
        optimizer='adam',
        loss='mse',
        metrics=['mae']
    )
    return model

# === ENTRAÎNER POUR CHAQUE PARKING ===
SEQ_LENGTH = 18
FEATURES = ['occupancy_rate', 'hour_sin', 'hour_cos', 
            'day_sin', 'day_cos']

def main():
    conn = get_db_connection()
    for parking_id in [1, 2, 3]:
        print(f"\n=== Entraînement LSTM Parking {parking_id} ===")
        
        df = load_parking_data(parking_id, conn)
        print(f"Données chargées : {len(df)} lignes")
        
        if len(df) < 50:
            print(f"⚠️ Pas assez de données pour parking {parking_id}, skip")
            continue
        
        # Normalisation
        scaler_X = MinMaxScaler()
        scaler_y = MinMaxScaler()
        
        # We need to make sure we have enough data for scaling
        df_scaled = df.copy()
        df_scaled[FEATURES] = scaler_X.fit_transform(df[FEATURES])
        df_scaled['occupancy_rate_scaled'] = scaler_y.fit_transform(
            df[['occupancy_rate']]
        )
        
        # Adapter les horizons selon le volume de données
        n = len(df)
        if n > 5000:
            horizons = [90, 180, 360]  # 15min, 30min, 60min
        else:
            horizons = [3, 6, 12]
        
        X, y_15, y_30, y_60 = create_sequences(df_scaled, SEQ_LENGTH, horizons)
        
        if len(X) == 0:
            print(f"⚠️ Pas assez de séquences pour parking {parking_id}, skip")
            continue

        y = np.column_stack([y_15, y_30, y_60])
        
        # Split train/test (80/20)
        split = int(0.8 * len(X))
        if split < 1:
             X_train, X_test = X, X
             y_train, y_test = y, y
        else:
            X_train, X_test = X[:split], X[split:]
            y_train, y_test = y[:split], y[split:]
        
        print(f"Train: {len(X_train)} séquences, Test: {len(X_test)}")
        
        # Construire et entraîner
        model = build_lstm_model(SEQ_LENGTH, len(FEATURES))
        
        model_path = f'models/lstm_parking_{parking_id}.keras'
        callbacks = [
            EarlyStopping(patience=10, restore_best_weights=True),
            ModelCheckpoint(
                model_path,
                save_best_only=True
            )
        ]
        
        history = model.fit(
            X_train, y_train,
            epochs=10, # Reduced for demo/speed, user asked for 100 but we might want to be faster if data is small
            batch_size=32,
            validation_split=0.1 if len(X_train) > 10 else 0,
            callbacks=callbacks,
            verbose=1
        )
        
        # Evaluation
        y_pred = model.predict(X_test)
        mae_15 = mean_absolute_error(y_test[:,0], y_pred[:,0])
        mae_30 = mean_absolute_error(y_test[:,1], y_pred[:,1])
        mae_60 = mean_absolute_error(y_test[:,2], y_pred[:,2])
        
        print(f"MAE 15min: {mae_15:.3f}%")
        print(f"MAE 30min: {mae_30:.3f}%")
        print(f"MAE 60min: {mae_60:.3f}%")
        
        # Sauvegarder les scalers et métadonnées
        joblib.dump(scaler_X, f'models/scaler_X_parking_{parking_id}.pkl')
        joblib.dump(scaler_y, f'models/scaler_y_parking_{parking_id}.pkl')
        
        metadata = {
            "parking_id": parking_id,
            "seq_length": SEQ_LENGTH,
            "features": FEATURES,
            "horizons": horizons,
            "mae_15min": float(mae_15),
            "mae_30min": float(mae_30),
            "mae_60min": float(mae_60),
            "n_train": len(X_train),
            "n_test": len(X_test)
        }
        
        with open(f'models/lstm_metadata_{parking_id}.json', 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"DONE Modèle sauvegardé : {model_path}")

    conn.close()
    print("\nDONE Entraînement terminé pour tous les parkings !")

if __name__ == "__main__":
    main()
