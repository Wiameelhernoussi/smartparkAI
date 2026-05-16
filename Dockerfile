# Étape 1 : Build du frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Étape 2 : Backend & Image finale
FROM python:3.11-slim
WORKDIR /app

# Installation des dépendances système pour OpenCV et PostgreSQL
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copie du backend
COPY backend/requirements.txt ./
# Installation spécifique de PyTorch CPU (économise ~400Mo de téléchargement et évite les Timeouts)
RUN pip install --no-cache-dir torch==2.11.0 torchvision==0.26.0 torchaudio --index-url https://download.pytorch.org/whl/cpu
# Installation du reste avec un long timeout au cas où la connexion est lente
RUN pip install --no-cache-dir --default-timeout=1000 -r requirements.txt

COPY backend/ ./

# Copie du build frontend vers le dossier static du backend (ou pour service via Nginx)
# Pour une démo rapide, on peut servir le frontend via FastAPI ou un simple serveur statique
COPY --from=frontend-builder /app/frontend/dist ./static

# Variables d'environnement par défaut
ENV PORT=8000
ENV DB_HOST=db
ENV DB_PORT=5432
ENV DB_NAME=smartparking
ENV DB_USER=postgres
ENV DB_PASSWORD=postgres
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV YOLO_CONFIG_DIR=/tmp

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
