from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.serialization import (
    Encoding, PublicFormat, PrivateFormat, NoEncryption
)
import base64, json

# Générer la paire de clés EC P-256
private_key = ec.generate_private_key(
    ec.SECP256R1(), default_backend()
)

# Clé privée : Valeur brute (32 octets)
private_value = private_key.private_numbers().private_value
private_key_bytes = private_value.to_bytes(32, byteorder='big')
private_key_b64 = base64.urlsafe_b64encode(private_key_bytes).rstrip(b'=').decode()

# Clé publique en format uncompressed point (65 bytes) puis base64url
public_bytes = private_key.public_key().public_bytes(
    Encoding.X962,
    PublicFormat.UncompressedPoint
)
public_b64 = base64.urlsafe_b64encode(public_bytes).rstrip(b'=').decode()

with open('vapid_keys.json', 'w') as f:
    json.dump({
        "public_key": public_b64,
        "private_key": private_key_b64
    }, f, indent=2)

print(f"Public key: {public_b64}")
print("Clés sauvegardées dans vapid_keys.json !")
