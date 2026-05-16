import base64, uuid, subprocess, os

# Lire le certificat PEM généré (pas utilisé dans le template final mais on garde la logique)
with open('192.168.11.155+2.pem', 'r') as f:
    pem_content = f.read()

# Récupérer le chemin du CA root de mkcert
# On utilise .\mkcert.exe car il est dans le dossier courant
mkcert_dir = subprocess.run(
    ['.\\mkcert.exe', '-CAROOT'], 
    capture_output=True, text=True
).stdout.strip()

ca_file = os.path.join(mkcert_dir, 'rootCA.pem')
if not os.path.exists(ca_file):
    print(f"Erreur : Impossible de trouver le CA root à {ca_file}")
    exit(1)

with open(ca_file, 'r') as f:
    ca_content = f.read()

# Apple attend le certificat DER encodé en base64 pour la balise <data>
# Mais mkcert fournit un PEM. On doit extraire le base64 du PEM.
import re
match = re.search(r"-----BEGIN CERTIFICATE-----\n(.+?)\n-----END CERTIFICATE-----", ca_content, re.DOTALL)
if match:
    # Le contenu entre les balises est déjà en base64
    ca_b64 = match.group(1).replace('\n', '')
else:
    # Fallback si le format est bizarre
    ca_b64 = base64.b64encode(ca_content.encode()).decode()

mobileconfig = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadCertificateFileName</key>
            <string>SmartPark CA</string>
            <key>PayloadContent</key>
            <data>{ca_b64}</data>
            <key>PayloadDescription</key>
            <string>SmartPark Local CA Certificate</string>
            <key>PayloadDisplayName</key>
            <string>SmartPark Local CA</string>
            <key>PayloadIdentifier</key>
            <string>com.smartpark.ca</string>
            <key>PayloadType</key>
            <string>com.apple.security.root</string>
            <key>PayloadUUID</key>
            <string>{str(uuid.uuid4())}</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
        </dict>
    </array>
    <key>PayloadDescription</key>
    <string>SmartPark Marrakech Local Certificate</string>
    <key>PayloadDisplayName</key>
    <string>SmartPark Marrakech</string>
    <key>PayloadIdentifier</key>
    <string>com.smartpark.profile</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>{str(uuid.uuid4())}</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>'''

with open('smartpark.mobileconfig', 'w') as f:
    f.write(mobileconfig)

print("Fichier smartpark.mobileconfig créé !")
print("Envoie CE fichier par email à ton iPhone.")
