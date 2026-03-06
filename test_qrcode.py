#!/usr/bin/env python3
"""
Teste do fluxo de QR Code:
1. Desconecta WhatsApp
2. Solicita reconexão
3. Busca QR Code via polling
4. Salva QR Code como imagem para visualização
"""

import requests
import json
import time
import base64
import os

BASE_LOCAL = "http://localhost:3000"
EVOLUTION_URL = "http://localhost:8080"
EVOLUTION_KEY = "minha-chave-secreta"
INSTANCE = "prospeccao"

headers_evo = {
    "Content-Type": "application/json",
    "apikey": EVOLUTION_KEY
}

print("="*60)
print("📷 TESTE DE FLUXO QR CODE")
print("="*60)

# Step 1: Verificar status atual
print("\n1️⃣ Verificando status atual...")
r = requests.get(f"{BASE_LOCAL}/api/configuracoes/whatsapp/status", timeout=10)
status = r.json()
print(f"   Status: conectado={status.get('conectado')}, estado={status.get('estado')}")

if not status.get("conectado"):
    print("   WhatsApp não está conectado. Prosseguindo com geração de QR...")
else:
    print("   WhatsApp está CONECTADO. Vou desconectar para testar o QR Code.")
    
    # Step 2: Desconectar (logout)
    print("\n2️⃣ Desconectando WhatsApp...")
    r = requests.post(f"{BASE_LOCAL}/api/configuracoes/whatsapp/desconectar", timeout=15)
    print(f"   Resposta: {r.json()}")
    time.sleep(3)
    
    # Verificar se desconectou
    r = requests.get(f"{BASE_LOCAL}/api/configuracoes/whatsapp/status", timeout=10)
    status = r.json()
    print(f"   Novo status: conectado={status.get('conectado')}, estado={status.get('estado')}")

# Step 3: Iniciar conexão (gera QR Code)
print("\n3️⃣ Solicitando conexão (geração de QR Code)...")
r = requests.post(f"{BASE_LOCAL}/api/configuracoes/whatsapp/conectar", timeout=30)
conectar = r.json()
print(f"   Resposta: {json.dumps(conectar, indent=2, ensure_ascii=False)}")

if conectar.get("conectado"):
    print("\n   ✅ WhatsApp já reconectou automaticamente!")
    exit(0)

# Step 4: Polling para QR Code
print("\n4️⃣ Polling para QR Code...")
qr_found = False
max_attempts = 20

for i in range(max_attempts):
    time.sleep(2)
    print(f"   Tentativa {i+1}/{max_attempts}...", end=" ")
    
    try:
        r = requests.get(f"{BASE_LOCAL}/api/configuracoes/whatsapp/qrcode", timeout=10)
        data = r.json()
        
        if data.get("conectado"):
            print("✅ WhatsApp conectou!")
            break
        
        if data.get("qrCode"):
            qr_base64 = data["qrCode"]
            if qr_base64.startswith("data:"):
                # Remove data URI prefix
                qr_base64 = qr_base64.split(",", 1)[1] if "," in qr_base64 else qr_base64
            
            print(f"📱 QR Code encontrado! (base64 len={len(qr_base64)})")
            qr_found = True
            
            # Salvar como arquivo PNG
            output_path = os.path.join(os.path.dirname(__file__), "qrcode_test.png")
            try:
                img_data = base64.b64decode(qr_base64)
                with open(output_path, "wb") as f:
                    f.write(img_data)
                print(f"\n   ✅ QR Code salvo em: {output_path}")
                print(f"   📁 Tamanho: {len(img_data)} bytes")
            except Exception as e:
                print(f"\n   ⚠️ Erro ao decodificar base64: {e}")
                # Talvez já seja uma URL de dados completa
                output_path = os.path.join(os.path.dirname(__file__), "qrcode_test.html")
                with open(output_path, "w") as f:
                    qr_src = data["qrCode"] if data["qrCode"].startswith("data:") else f"data:image/png;base64,{data['qrCode']}"
                    f.write(f'<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#111"><img src="{qr_src}" style="max-width:400px"/></body></html>')
                print(f"   ✅ QR Code salvo como HTML em: {output_path}")
            
            print("\n   ⚠️ ESCANEIE O QR CODE COM SEU WHATSAPP PARA RECONECTAR!")
            print("   Aguardando conexão por até 60 segundos...")
            
            # Wait for connection
            for j in range(30):
                time.sleep(2)
                r2 = requests.get(f"{BASE_LOCAL}/api/configuracoes/whatsapp/status", timeout=10)
                s2 = r2.json()
                if s2.get("conectado"):
                    print(f"\n   ✅ WhatsApp reconectado com sucesso após {(j+1)*2}s!")
                    break
                print(f"   ⏳ Aguardando... ({(j+1)*2}s)", end="\r")
            break
        else:
            pairingCode = data.get("pairingCode")
            aguardando = data.get("aguardando")
            print(f"⏳ Aguardando... pairingCode={pairingCode}, aguardando={aguardando}")
    except Exception as e:
        print(f"❌ Erro: {e}")

# Step 5: Tentar obter QR direto da Evolution API
if not qr_found:
    print("\n5️⃣ Tentando obter QR Code diretamente da Evolution API...")
    try:
        r = requests.get(f"{EVOLUTION_URL}/instance/connect/{INSTANCE}", headers=headers_evo, timeout=15)
        data = r.json()
        print(f"   connect response: {json.dumps(data, indent=2, ensure_ascii=False)[:500]}")
        
        # Check for base64 QR
        qr = data.get("base64") or data.get("qrcode", {}).get("base64") if isinstance(data.get("qrcode"), dict) else data.get("qrcode")
        if qr and len(str(qr)) > 50:
            qr_clean = qr.split(",", 1)[1] if "," in str(qr) else qr
            output_path = os.path.join(os.path.dirname(__file__), "qrcode_test.png")
            try:
                img_data = base64.b64decode(qr_clean)
                with open(output_path, "wb") as f:
                    f.write(img_data)
                print(f"\n   ✅ QR Code salvo em: {output_path}")
                print(f"   ⚠️ ESCANEIE O QR CODE PARA RECONECTAR!")
                qr_found = True
            except:
                pass
        
        if data.get("pairingCode"):
            print(f"\n   📱 Código de pareamento: {data['pairingCode']}")
            
    except Exception as e:
        print(f"   ❌ Erro: {e}")

# Final status
print("\n" + "="*60)
r = requests.get(f"{BASE_LOCAL}/api/configuracoes/whatsapp/status", timeout=10)
final = r.json()
print(f"📊 Status final: conectado={final.get('conectado')}, estado={final.get('estado')}")
if not final.get("conectado") and qr_found:
    print("⚠️ WhatsApp desconectado — escaneie o QR Code para reconectar!")
elif final.get("conectado"):
    print("✅ WhatsApp conectado e funcionando!")
print("="*60)
