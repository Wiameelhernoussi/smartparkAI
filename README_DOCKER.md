# Smart Parking Marrakech - Déploiement Docker

Ce projet utilise Docker et Docker Compose pour simplifier le développement et le déploiement sur les environnements de test/démo.

## 🚀 Lancement Rapide (Développement Local)

1. **Prérequis** :
   - Docker et Docker Compose installés.
   - Fichiers modèles (`.pt`) dans `backend/models/`.
   - Vidéos de simulation dans `backend/videos/`.

2. **Démarrer l'application** :
   ```bash
   docker-compose up --build
   ```

3. **Accès** :
   - Backend API : `http://localhost:8000/docs`
   - Frontend : `http://localhost:8000` (si servi par le backend) ou via le dev server local.

## ☁️ Déploiement Cloud (Phase de Test/Démo)

Pour déployer sur une VM (Google Cloud, AWS) :

1. **Cloner le repo** sur la VM.
2. **Configurer les variables d'environnement** dans un fichier `.env`.
3. **Lancer avec Docker Compose** en mode détaché :
   ```bash
   docker-compose up -d --build
   ```

## 🐳 Docker Hub (Versionnement)

Pour uploader les images :
```bash
docker build -t your-dockerhub-user/smartpark-app:latest .
docker push your-dockerhub-user/smartpark-app:latest
```

## 📦 Contenu de l'image
- **Frontend** : Build optimisé avec Vite.
- **Backend** : FastAPI avec support OpenCV (CPU).
- **IA** : YOLOv8 et LSTM pré-chargés.
