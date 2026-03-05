"""
Script completo: Inicia Next.js, obtém QR Code, salva PNG e abre
"""
import subprocess
import time
import urllib.request
import json
import base64
import os
import sys

FRONTEND_DIR = r"c:\Users\Administrador\Desktop\prospeccao\projeto\frontend"
PROJECT_DIR = r"c:\Users\Administrador\Desktop\prospeccao\projeto"
EVOLUTION_URL = "http://localhost:8080"
API_KEY = "minha-chave-secreta"
INSTANCE = "prospeccao"

def check_port(port):
    """Check if port is accessible"""
    try:
        req = urllib.request.Request(f"http://localhost:{port}/")
        urllib.request.urlopen(req, timeout=3)
        return True
    except:
        return False

def api_call(url, method="GET", data=None, headers=None):
    """Make API call"""
    if headers is None:
        headers = {"apikey": API_KEY}
    req = urllib.request.Request(url, headers=headers, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(data).encode()
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return json.loads(body)
        except:
            return {"error": body, "status": e.code}
    except Exception as e:
        return {"error": str(e)}

print("=" * 60)
print("  RECONEXAO WHATSAPP - FLUXO COMPLETO")
print("=" * 60)

# Step 1: Check Evolution API
print("\n[1] Verificando Evolution API...")
result = api_call(f"{EVOLUTION_URL}/instance/fetchInstances")
if isinstance(result, list):
    print(f"    OK - {len(result)} instancia(s) encontrada(s)")
    for inst in result:
        print(f"    -> {inst.get('name')}: {inst.get('connectionStatus')}")
else:
    print(f"    ERRO: {result}")
    sys.exit(1)

# Step 2: Check instance state
print("\n[2] Verificando estado da instancia...")
instance_exists = False
instance_status = None
for inst in result:
    if inst.get("name") == INSTANCE:
        instance_exists = True
        instance_status = inst.get("connectionStatus")
        print(f"    Instancia '{INSTANCE}' encontrada, status: {instance_status}")
        break

if not instance_exists:
    print(f"    Instancia '{INSTANCE}' NAO encontrada. Criando...")
    create_result = api_call(f"{EVOLUTION_URL}/instance/create", method="POST", data={
        "instanceName": INSTANCE,
        "qrcode": True,
        "integration": "WHATSAPP-BAILEYS"
    })
    print(f"    Resultado: {json.dumps(create_result)[:200]}")
    if "error" in str(create_result).lower() and "already in use" not in str(create_result):
        print("    ERRO ao criar instancia!")
        sys.exit(1)

# Step 3: Get QR Code
print("\n[3] Obtendo QR Code...")
qr_result = api_call(f"{EVOLUTION_URL}/instance/connect/{INSTANCE}")
if isinstance(qr_result, dict):
    qr_base64 = qr_result.get("base64", "")
    qr_code = qr_result.get("code", "")
    pairing_code = qr_result.get("pairingCode")
    
    if qr_base64:
        # Remove data:image/png;base64, prefix
        if "base64," in qr_base64:
            qr_base64 = qr_base64.split("base64,")[1]
        
        qr_path = os.path.join(PROJECT_DIR, "qrcode_reconexao.png")
        with open(qr_path, "wb") as f:
            f.write(base64.b64decode(qr_base64))
        
        print(f"    QR Code salvo em: {qr_path}")
        print(f"    Tamanho: {os.path.getsize(qr_path)} bytes")
        
        # Open QR Code
        os.startfile(qr_path)
        print("    QR Code ABERTO! Escaneie com seu WhatsApp!")
        
        if pairing_code:
            print(f"    Pairing Code: {pairing_code}")
    else:
        print(f"    AVISO: Sem base64 no resultado")
        print(f"    Resultado: {json.dumps(qr_result)[:300]}")
        
        # Maybe already connected?
        if instance_status == "open":
            print("    INSTANCIA JA CONECTADA!")
else:
    print(f"    ERRO: {qr_result}")

# Step 4: Monitor connection status
print("\n[4] Monitorando conexao...")
print("    Escaneie o QR Code no seu WhatsApp e aguarde...")
print("    (Monitorando por 120 segundos)")

connected = False
for i in range(40):
    time.sleep(3)
    status_result = api_call(f"{EVOLUTION_URL}/instance/connectionState/{INSTANCE}")
    state = "desconhecido"
    if isinstance(status_result, dict):
        instance_data = status_result.get("instance", {})
        state = instance_data.get("state", status_result.get("state", "desconhecido"))
    
    elapsed = (i + 1) * 3
    print(f"    [{elapsed}s] Estado: {state}")
    
    if state == "open":
        print(f"\n    *** CONECTADO COM SUCESSO! ***")
        connected = True
        break
    elif state == "close":
        print(f"    Conexao fechada. Obtendo novo QR Code...")
        qr_result = api_call(f"{EVOLUTION_URL}/instance/connect/{INSTANCE}")
        if isinstance(qr_result, dict) and qr_result.get("base64"):
            qr_base64 = qr_result["base64"]
            if "base64," in qr_base64:
                qr_base64 = qr_base64.split("base64,")[1]
            qr_path = os.path.join(PROJECT_DIR, "qrcode_reconexao.png")
            with open(qr_path, "wb") as f:
                f.write(base64.b64decode(qr_base64))
            os.startfile(qr_path)
            print(f"    NOVO QR Code aberto! Escaneie novamente!")

if not connected:
    print("\n    TIMEOUT: Conexao nao estabelecida em 120 segundos.")
    print("    Verifique se voce escaneou o QR Code corretamente.")
    sys.exit(1)

# Step 5: Test connection
print("\n[5] Testando conexao...")
# Get instance info
info = api_call(f"{EVOLUTION_URL}/instance/fetchInstances")
for inst in info:
    if inst.get("name") == INSTANCE:
        print(f"    Nome: {inst.get('name')}")
        print(f"    Status: {inst.get('connectionStatus')}")
        print(f"    Owner: {inst.get('ownerJid')}")
        print(f"    Profile: {inst.get('profileName')}")
        break

# Step 6: Send test message
print("\n[6] Enviando mensagem de teste...")
msg_result = api_call(f"{EVOLUTION_URL}/message/sendText/{INSTANCE}", method="POST", data={
    "number": "5518996311933",
    "text": "✅ WhatsApp reconectado com sucesso! Sistema de prospecção ativo."
})
if isinstance(msg_result, dict):
    msg_key = msg_result.get("key", {})
    msg_id = msg_key.get("id", "N/A") if isinstance(msg_key, dict) else "N/A"
    msg_status = msg_result.get("status", "N/A")
    print(f"    Mensagem enviada! ID: {msg_id}")
    print(f"    Status: {msg_status}")
else:
    print(f"    Resultado: {msg_result}")

# Step 7: Test Next.js API (if running)
print("\n[7] Testando API Next.js...")
try:
    req = urllib.request.Request("http://localhost:3000/api/configuracoes/whatsapp/status")
    resp = urllib.request.urlopen(req, timeout=10)
    data = json.loads(resp.read().decode())
    print(f"    Next.js WhatsApp Status: {json.dumps(data, indent=2)[:300]}")
except Exception as e:
    print(f"    Next.js nao acessivel: {e}")

print("\n" + "=" * 60)
print("  FLUXO COMPLETO FINALIZADO!")
print("=" * 60)
