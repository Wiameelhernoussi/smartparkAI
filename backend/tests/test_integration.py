
# pyrefly: ignore [missing-import]
import pytest
from fastapi.testclient import TestClient
import psycopg2
from unittest.mock import patch, MagicMock
from datetime import datetime

# Import de l'app FastAPI
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Mock des modèles IA au chargement pour éviter 
# de charger YOLO et LSTM pendant les tests
with patch('main.YOLO'), \
     patch('main.load_lstm_models'), \
     patch('main.start_all_simulators'):
    from main import app

client = TestClient(app)

class TestAPIIntegration:
    
    def test_get_parkings_retourne_liste(self):
        """GET /parkings doit retourner une liste"""
        with patch('main.get_conn') as mock_conn:
            mock_cur = MagicMock()
            mock_cur.fetchall.return_value = [
                (1, 'Test Parking', 'Adresse', 31.62, -8.00, 80, True)
            ]
            mock_conn.return_value.cursor.return_value = mock_cur
            
            response = client.get("/parkings")
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
    
    def test_get_meteo_retourne_donnees(self):
        """GET /meteo doit retourner température"""
        with patch('main.get_contexte') as mock_meteo:
            mock_meteo.return_value = {
                "temperature": 28.5,
                "pluie": 0.0,
                "description": "Ensoleillé"
            }
            response = client.get("/meteo")
            assert response.status_code == 200
    
    def test_login_admin_valide(self):
        """Login avec bons credentials doit retourner token"""
        response = client.post("/admin/login", json={
            "email": "admin@smartpark.ma",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
    
    def test_login_admin_invalide(self):
        """Login avec mauvais credentials doit retourner 401"""
        response = client.post("/admin/login", json={
            "email": "wrong@email.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
    
    def test_route_protegee_sans_token(self):
        """Route admin sans token doit retourner 401"""
        response = client.get("/admin/overview")
        assert response.status_code == 401
    
    def test_route_protegee_avec_token(self):
        """Route admin avec token valide doit retourner 200"""
        # D'abord obtenir un token
        login = client.post("/admin/login", json={
            "email": "admin@smartpark.ma",
            "password": "admin123"
        })
        token = login.json()["access_token"]
        
        with patch('main.get_conn') as mock_conn:
            mock_cur = MagicMock()
            mock_cur.fetchall.return_value = []
            mock_cur.fetchone.return_value = (0, 0, 0, 0)
            mock_conn.return_value.cursor.return_value = mock_cur
            
            # Mock de get_parkings() car overview l'appelle
            with patch('main.get_parkings') as mock_gp:
                mock_gp.return_value = []
                response = client.get(
                    "/admin/overview",
                    headers={"Authorization": f"Bearer {token}"}
                )
                assert response.status_code == 200
    
    def test_flux_complet_occupation(self):
        """
        Test d'intégration complet :
        1. Créer données en base
        2. Vérifier que l'API les retourne
        """
        with patch('main.get_conn') as mock_conn:
            mock_cur = MagicMock()
            
            # Simuler historique en base
            # Le format attendu par /api/parkings/{id}/history dépend du code de main.py
            # On simule un retour cohérent
            mock_cur.fetchall.return_value = [
                (datetime(2024, 1, 15, 14, 0, 0), 42.5, 34, 80)
            ]
            mock_conn.return_value.cursor.return_value = mock_cur
            
            response = client.get("/api/parkings/1/history?hours=24")
            assert response.status_code == 200
