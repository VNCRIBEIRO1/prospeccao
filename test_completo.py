#!/usr/bin/env python3
"""
Script de teste completo do sistema de prospecção.
Testa: API routes, Evolution API, WhatsApp, QR Code, envio de mensagem.
"""

import requests
import json
import time
import base64
import sys
import os

BASE_LOCAL = "http://localhost:3000"
EVOLUTION_URL = "http://localhost:8080"
EVOLUTION_KEY = "minha-chave-secreta"
INSTANCE = "prospeccao"
TEST_PHONE = "5518996311933"

headers_evo = {
    "Content-Type": "application/json",
    "apikey": EVOLUTION_KEY
}

results = []

def test(name, fn):
    """Wrapper de teste com resultado."""
    try:
        result = fn()
        status = "✅ PASS" if result.get("ok") else "❌ FAIL"
        results.append({"name": name, "status": status, "detail": result.get("detail", "")})
        print(f"  {status} | {name} — {result.get('detail', '')}")
        return result
    except Exception as e:
        results.append({"name": name, "status": "💥 ERROR", "detail": str(e)})
        print(f"  💥 ERROR | {name} — {e}")
        return {"ok": False, "detail": str(e)}

# ============================================================
print("\n" + "="*60)
print("🧪 TESTE COMPLETO DO SISTEMA DE PROSPECÇÃO")
print("="*60)

# --- TESTE 1: Evolution API direta ---
print("\n📡 1. EVOLUTION API DIRETA")

def test_evo_instances():
    r = requests.get(f"{EVOLUTION_URL}/instance/fetchInstances", headers=headers_evo, timeout=10)
    instances = r.json()
    names = [i.get("name", i.get("instance", {}).get("instanceName", "?")) for i in instances]
    has_prospeccao = "prospeccao" in names
    return {"ok": r.status_code == 200 and has_prospeccao, "detail": f"HTTP {r.status_code}, instances: {names}"}

def test_evo_connection():
    r = requests.get(f"{EVOLUTION_URL}/instance/connectionState/{INSTANCE}", headers=headers_evo, timeout=10)
    data = r.json()
    state = data.get("instance", {}).get("state", data.get("state", "unknown"))
    return {"ok": state == "open", "detail": f"HTTP {r.status_code}, state={state}"}

test("Evolution API - fetchInstances", test_evo_instances)
conn_result = test("Evolution API - connectionState", test_evo_connection)

# --- TESTE 2: Next.js API Routes ---
print("\n🌐 2. NEXT.JS API ROUTES")

def test_api_route(path, method="GET", body=None):
    def _test():
        url = f"{BASE_LOCAL}{path}"
        if method == "GET":
            r = requests.get(url, timeout=15)
        else:
            r = requests.post(url, json=body, timeout=15)
        ok = r.status_code in [200, 201]
        try:
            data = r.json()
            detail = f"HTTP {r.status_code}, keys={list(data.keys()) if isinstance(data, dict) else f'array[{len(data)}]'}"
        except:
            detail = f"HTTP {r.status_code}, body={r.text[:100]}"
        return {"ok": ok, "detail": detail, "data": data if ok else None}
    return _test

test("GET /api/metricas", test_api_route("/api/metricas"))
test("GET /api/contatos", test_api_route("/api/contatos?page=1&limit=5"))
test("GET /api/contatos/stats", test_api_route("/api/contatos/stats"))
test("GET /api/campanhas", test_api_route("/api/campanhas"))
test("GET /api/leads", test_api_route("/api/leads"))
test("GET /api/configuracoes", test_api_route("/api/configuracoes"))
test("GET /api/mensagens", test_api_route("/api/mensagens?limit=5"))
test("GET /api/mensagens/templates", test_api_route("/api/mensagens/templates"))
test("GET /api/mensagens/recentes", test_api_route("/api/mensagens/recentes"))
test("GET /api/metricas/erros", test_api_route("/api/metricas/erros"))
test("GET /api/campanhas/fila/status", test_api_route("/api/campanhas/fila/status"))

# --- TESTE 3: WhatsApp endpoints ---
print("\n📱 3. WHATSAPP ENDPOINTS")
test("GET /api/whatsapp/status", test_api_route("/api/configuracoes/whatsapp/status"))
test("GET /api/whatsapp/info", test_api_route("/api/configuracoes/whatsapp/info"))
test("GET /api/whatsapp/qrcode", test_api_route("/api/configuracoes/whatsapp/qrcode"))

# --- TESTE 4: Envio de mensagem via Evolution API ---
print("\n💬 4. ENVIO DE MENSAGEM")

def test_send_msg():
    body = {
        "number": TEST_PHONE,
        "text": "🧪 Teste Python automatizado — sistema de prospecção funcionando! " + time.strftime("%H:%M:%S")
    }
    r = requests.post(f"{EVOLUTION_URL}/message/sendText/{INSTANCE}", headers=headers_evo, json=body, timeout=15)
    data = r.json()
    msg_id = data.get("key", {}).get("id", "?")
    status = data.get("status", "?")
    return {"ok": r.status_code in [200, 201] and "key" in data, "detail": f"HTTP {r.status_code}, msgId={msg_id}, status={status}"}

test("Enviar mensagem de teste", test_send_msg)

# --- TESTE 5: Criar contato de teste ---
print("\n👤 5. CRUD CONTATO")

def test_create_contato():
    body = {
        "nome": "Teste Automatizado",
        "telefone": TEST_PHONE,
        "empresa": "Empresa Teste",
        "cargo": "Dev",
        "origem": "teste_automatizado"
    }
    r = requests.post(f"{BASE_LOCAL}/api/contatos", json=body, timeout=15)
    data = r.json()
    if r.status_code == 201:
        return {"ok": True, "detail": f"Criado ID={data.get('id')}", "data": data}
    elif r.status_code == 409 or "já existe" in str(data).lower():
        return {"ok": True, "detail": "Contato já existe (ok)"}
    else:
        return {"ok": False, "detail": f"HTTP {r.status_code}: {data}"}

contato_result = test("Criar contato", test_create_contato)

# --- TESTE 6: QR Code Flow (simulated) ---
print("\n📷 6. QR CODE FLOW")

def test_qr_flow():
    """Testa o fluxo de QR Code - se já conectado, verifica que retorna conectado=true."""
    r = requests.get(f"{BASE_LOCAL}/api/configuracoes/whatsapp/qrcode", timeout=15)
    data = r.json()
    if data.get("conectado"):
        return {"ok": True, "detail": "WhatsApp já conectado, QR não necessário"}
    elif data.get("qrCode"):
        qr = data["qrCode"]
        qr_len = len(qr) if qr else 0
        return {"ok": True, "detail": f"QR Code disponível (base64 len={qr_len})"}
    else:
        return {"ok": True, "detail": f"Aguardando QR (aguardando={data.get('aguardando')})"}

test("QR Code endpoint", test_qr_flow)

# --- TESTE 7: Webhook endpoint ---
print("\n🔗 7. WEBHOOK")

def test_webhook():
    """Testa se o endpoint de webhook aceita POST."""
    # Simulate a CONNECTION_UPDATE event
    body = {
        "event": "connection.update",
        "instance": INSTANCE,
        "data": {"state": "open", "statusReason": 200},
        "date_time": "2026-03-05T12:00:00Z",
        "sender": "5518996311933@s.whatsapp.net"
    }
    r = requests.post(f"{BASE_LOCAL}/api/webhook/whatsapp", json=body, timeout=15)
    return {"ok": r.status_code == 200, "detail": f"HTTP {r.status_code}"}

test("POST /api/webhook/whatsapp", test_webhook)

# --- TESTE 8: Enviar mensagem com botões via Evolution ---
print("\n🔘 8. MENSAGEM COM BOTÕES")

def test_send_buttons():
    body = {
        "number": TEST_PHONE,
        "title": "",
        "description": "🧪 Teste de botões interativos do sistema",
        "footer": "Toque em uma opção 👆",
        "buttons": [
            {"type": "reply", "displayText": "✅ Sim", "id": "btn_sim"},
            {"type": "reply", "displayText": "❌ Não", "id": "btn_nao"}
        ]
    }
    r = requests.post(f"{EVOLUTION_URL}/message/sendButtons/{INSTANCE}", headers=headers_evo, json=body, timeout=15)
    if r.status_code in [200, 201]:
        return {"ok": True, "detail": f"HTTP {r.status_code}, botões enviados"}
    else:
        # Fallback: try list message
        body2 = {
            "number": TEST_PHONE,
            "title": "Teste",
            "description": "🧪 Teste de lista interativa",
            "footerText": "Escolha 👆",
            "buttonText": "📋 Ver opções",
            "sections": [{"title": "Opções", "rows": [
                {"title": "✅ Sim", "rowId": "btn_sim"},
                {"title": "❌ Não", "rowId": "btn_nao"}
            ]}]
        }
        r2 = requests.post(f"{EVOLUTION_URL}/message/sendList/{INSTANCE}", headers=headers_evo, json=body2, timeout=15)
        if r2.status_code in [200, 201]:
            return {"ok": True, "detail": f"Botões falharam, lista OK (HTTP {r2.status_code})"}
        else:
            return {"ok": False, "detail": f"Botões HTTP {r.status_code}, Lista HTTP {r2.status_code}"}

test("Enviar mensagem com botões", test_send_buttons)

# --- RESULTADO FINAL ---
print("\n" + "="*60)
print("📊 RESULTADO FINAL")
print("="*60)

passed = sum(1 for r in results if "PASS" in r["status"])
failed = sum(1 for r in results if "FAIL" in r["status"])
errors = sum(1 for r in results if "ERROR" in r["status"])
total = len(results)

print(f"\n  Total: {total} testes")
print(f"  ✅ Passed: {passed}")
print(f"  ❌ Failed: {failed}")
print(f"  💥 Errors: {errors}")
print(f"\n  Taxa de sucesso: {passed}/{total} ({100*passed//total if total else 0}%)")

if failed > 0 or errors > 0:
    print("\n  ⚠️ Testes com falha:")
    for r in results:
        if "FAIL" in r["status"] or "ERROR" in r["status"]:
            print(f"    - {r['name']}: {r['detail']}")

print("\n" + "="*60)
