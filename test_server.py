import urllib.request
import time
import sys

# Aguardar Next.js
for i in range(5):
    try:
        req = urllib.request.Request("http://localhost:3000/api/metricas")
        resp = urllib.request.urlopen(req, timeout=5)
        print(f"Next.js OK! Status: {resp.status}")
        sys.exit(0)
    except Exception as e:
        print(f"Tentativa {i+1}: {e}")
        time.sleep(3)

print("Next.js NAO esta acessivel")
sys.exit(1)
