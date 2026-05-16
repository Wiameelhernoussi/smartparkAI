# pyrefly: ignore [missing-import]
from locust import HttpUser, task, between
import json, random

class SmartParkUser(HttpUser):
    """Simule un utilisateur qui consulte les parkings"""
    wait_time = between(1, 3)  # attente entre requêtes
    
    def on_start(self):
        """Pas besoin de login pour les routes publiques"""
        pass
    
    @task(5)  # poids 5 = plus fréquent
    def get_parkings(self):
        """Consulter la liste des parkings"""
        self.client.get("/parkings")
    
    @task(2)
    def get_meteo(self):
        """Consulter la météo"""
        self.client.get("/meteo")
    
    @task(2)
    def get_predictions(self):
        """Consulter les prédictions"""
        parking_id = random.randint(1, 3)
        self.client.get(f"/api/parkings/{parking_id}/predictions")
    
    @task(1)
    def get_anomalies(self):
        """Consulter les anomalies"""
        self.client.get("/anomalies")

class SmartParkAdmin(HttpUser):
    """Simule un admin qui consulte le dashboard"""
    wait_time = between(2, 5)
    
    token = None
    
    def on_start(self):
        response = self.client.post("/admin/login", json={
            "email": "admin@smartpark.ma",
            "password": "admin123"
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
    
    def get_headers(self):
        return {"Authorization": f"Bearer {self.token}"}
    
    @task(3)
    def get_overview(self):
        self.client.get("/admin/overview", 
                       headers=self.get_headers())
    
    @task(2)
    def get_stats(self):
        self.client.get("/admin/stats",
                       params={"parking_id": 1, "period": "today"},
                       headers=self.get_headers())
