import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

DB_CONFIG = {
    "host"    : "localhost",
    "port"    : 5432,
    "dbname"  : "postgres", # Connect to default db first
    "user"    : "postgres",
    "password": "postgres"
}

try:
    print("Tentative de connexion à PostgreSQL...")
    conn = psycopg2.connect(**DB_CONFIG)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    
    # Vérifier si la DB existe déjà
    cur.execute("SELECT 1 FROM pg_catalog.pg_database WHERE datname = 'smartparking'")
    exists = cur.fetchone()
    
    if not exists:
        print("Création de la base de données 'smartparking'...")
        cur.execute('CREATE DATABASE smartparking')
        print("✅ Base de données 'smartparking' créée avec succès !")
    else:
        print("✅ La base de données 'smartparking' existe déjà.")
        
    cur.close()
    conn.close()
except psycopg2.OperationalError as e:
    print("Erreur de connexion : le mot de passe 'postgres' est-il correct pour l'utilisateur 'postgres' ?")
    print(e)
except Exception as e:
    print("Erreur:", e)
