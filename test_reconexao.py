#!/usr/bin/env python3
"""
Fluxo completo de reconexão WhatsApp:
1. Cria instância nova via Next.js API
2. Busca QR Code via polling
3. Salva e abre QR Code para scan
4. Monitora conexão
"""

import requests
import json
import time
import base64
import subprocess
import os
import sys

BASE = "http://localhost:3000"
EVOLUTION = "http://localhost:8080"
API_KEY = "minha-chave-secreta"
INSTANCE = "prospeccao"
TEST_PHONE = "5518996311933"

def evo_headers():
    h = {"Content-Type": "application/json"}
    if API_KEY:
        h["apikey"] = API_KEY
    return h

print("="*60)
print("📱 RECONEXÃO WHATSAPP — FLUXO COMPLETO")
print("="*60)

# Passo 1: Verificar estado
print("\n1️⃣ Verificando estado atual...")
try:
    r = requests.get(f"{BASE}/api/configuracoes/whatsapp/status", timeout=15)
    status = r.json()
    print(f"   Estado: {json.dumps(status, ensure_ascii=False)}")
except Exception as e:
    print(f"   ❌ Erro ao verificar status: {e}")
    # Try direct Evolution API
    try:
        r = requests.get(f"{EVOLUTION}/instance/connectionState/{INSTANCE}", headers=evo_headers(), timeout=10)
        print(f"   Evolution direto: {r.json()}")
    except:
        pass
    status = {"conectado": False}

if status.get("conectado"):
    print("   ✅ Já conectado! Testando envio de mensagem...")
    body = {"number": TEST_PHONE, "text": f"✅ WhatsApp conectado e funcionando! {time.strftime('%H:%M:%S')}"}
    r = requests.post(f"{EVOLUTION}/message/sendText/{INSTANCE}", headers=evo_headers(), json=body, timeout=15)
    print(f"   Resultado: {r.status_code}")
    sys.exit(0)

# Passo 2: Solicitar conexão via API Next.js
print("\n2️⃣ Solicitando conexão (criar instância + QR Code)...")
try:
    r = requests.post(f"{BASE}/api/configuracoes/whatsapp/conectar", timeout=45)
    conectar = r.json()
    print(f"   Resposta ({r.status_code}): {json.dumps(conectar, indent=2, ensure_ascii=False)[:500]}")
    
    # Se já tem QR Code direto na resposta
    qr_direct = conectar.get("qrCode")
    if qr_direct and len(str(qr_direct)) > 50:
        print("   📷 QR Code recebido diretamente na resposta de conexão!")
except Exception as e:
    print(f"   ❌ Erro: {e}")
    conectar = {}
    qr_direct = None

# Passo 3: Polling para QR Code
print("\n3️⃣ Buscando QR Code...")
qr_found = False
qr_base64 = qr_direct  # Pode já ter vindo da resposta

for attempt in range(25):
    if qr_base64 and len(str(qr_base64)) > 50:
        break
        
    time.sleep(2)
    sys.stdout.write(f"   Tentativa {attempt+1}/25... ")
    sys.stdout.flush()
    
    try:
        # Via Next.js API
        r = requests.get(f"{BASE}/api/configuracoes/whatsapp/qrcode", timeout=15)
        data = r.json()
        
        if data.get("conectado"):
            print("✅ Conectado!")
            qr_found = True
            break
        
        if data.get("qrCode"):
            qr_base64 = data["qrCode"]
            print(f"📷 QR Code encontrado! (len={len(qr_base64)})")
            break
        else:
            print(f"⏳ aguardando={data.get('aguardando')} expirado={data.get('expirado')}")
    except Exception as e:
        print(f"❌ {e}")
    
    # Fallback direto na Evolution API
    if attempt % 3 == 2:
        try:
            r2 = requests.get(f"{EVOLUTION}/instance/connect/{INSTANCE}", headers=evo_headers(), timeout=15)
            d2 = r2.json()
            qr2 = d2.get("base64") or (d2.get("qrcode", {}).get("base64") if isinstance(d2.get("qrcode"), dict) else None)
            if qr2 and len(str(qr2)) > 50:
                qr_base64 = qr2
                print(f"   📷 QR via Evolution direta! (len={len(qr_base64)})")
                break
        except:
            pass

if qr_base64 and len(str(qr_base64)) > 50:
    # Clean base64
    if qr_base64.startswith("data:"):
        qr_clean = qr_base64.split(",", 1)[1] if "," in qr_base64 else qr_base64
    else:
        qr_clean = qr_base64
    
    # Salvar PNG
    output_dir = os.path.dirname(os.path.abspath(__file__))
    png_path = os.path.join(output_dir, "qrcode_whatsapp.png")
    
    try:
        img_data = base64.b64decode(qr_clean)
        with open(png_path, "wb") as f:
            f.write(img_data)
        print(f"\n   ✅ QR Code salvo: {png_path} ({len(img_data)} bytes)")
        
        # Criar também HTML para visualização melhor
        html_path = os.path.join(output_dir, "qrcode_whatsapp.html")
        qr_src = qr_base64 if qr_base64.startswith("data:") else f"data:image/png;base64,{qr_base64}"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(f"""<!DOCTYPE html>
<html>
<head><title>WhatsApp QR Code</title></head>
<body style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;background:#0a0a0a;font-family:sans-serif;color:white;margin:0">
  <h2 style="margin-bottom:20px">📱 Escaneie com o WhatsApp</h2>
  <img src="{qr_src}" style="max-width:350px;border-radius:16px;box-shadow:0 0 40px rgba(37,211,102,0.3)"/>
  <p style="margin-top:20px;color:#888">Abra WhatsApp → Configurações → Dispositivos conectados → Conectar um dispositivo</p>
  <p style="color:#25D366;font-weight:bold" id="status">⏳ Aguardando scan...</p>
  <script>
    setInterval(async()=>{{
      try {{
        const r = await fetch('/api/configuracoes/whatsapp/status');
        const d = await r.json();
        if(d.conectado) {{
          document.getElementById('status').textContent = '✅ CONECTADO!';
          document.getElementById('status').style.color = '#00ff00';
          document.body.style.background = '#0a2010';
        }}
      }} catch{{}}
    }}, 3000);
  </script>
</body>
</html>""")
        print(f"   ✅ HTML salvo: {html_path}")
        
        # Abrir o PNG
        subprocess.Popen(["start", "", png_path], shell=True)
        print("\n" + "="*60)
        print("📱 QR CODE ABERTO — ESCANEIE COM O WHATSAPP!")
        print("="*60)
        
    except Exception as e:
        print(f"   ❌ Erro ao salvar: {e}")
else:
    if not qr_found:
        print("\n   ⚠️ QR Code não encontrado. Verificando instância...")
        try:
            r = requests.get(f"{EVOLUTION}/instance/fetchInstances", headers=evo_headers(), timeout=10)
            instances = r.json()
            print(f"   Instâncias: {json.dumps([i.get('name','?') for i in instances])}")
            for i in instances:
                if i.get("name") == INSTANCE:
                    print(f"   Status: {i.get('connectionStatus')}")
        except Exception as e:
            print(f"   ❌ {e}")

# Passo 4: Monitorar conexão
if not qr_found and qr_base64:
    print("\n4️⃣ Monitorando conexão (aguardando scan)...")
    for i in range(45):  # 45 x 2s = 90 segundos
        time.sleep(2)
        try:
            r = requests.get(f"{BASE}/api/configuracoes/whatsapp/status", timeout=10)
            s = r.json()
            if s.get("conectado"):
                print(f"\n\n   ✅ WHATSAPP CONECTADO COM SUCESSO! ({(i+1)*2}s)")
                
                # Enviar mensagem de teste
                time.sleep(2)
                print("\n5️⃣ Enviando mensagem de teste...")
                body = {"number": TEST_PHONE, "text": f"✅ WhatsApp reconectado com sucesso!\n⏰ {time.strftime('%d/%m/%Y %H:%M:%S')}\n🤖 Sistema de prospecção ativo."}
                r2 = requests.post(f"{EVOLUTION}/message/sendText/{INSTANCE}", headers=evo_headers(), json=body, timeout=15)
                if r2.status_code in [200, 201]:
                    print("   ✅ Mensagem de teste enviada!")
                else:
                    print(f"   ⚠️ Status: {r2.status_code} — {r2.text[:200]}")
                
                print("\n" + "="*60)
                print("🎉 TUDO FUNCIONANDO!")
                print("="*60)
                sys.exit(0)
            
            sys.stdout.write(f"\r   ⏳ Aguardando scan... {(i+1)*2}s (estado={s.get('estado','?')})    ")
            sys.stdout.flush()
        except:
            pass
    
    print("\n\n   ⏰ Timeout — tente novamente.")
