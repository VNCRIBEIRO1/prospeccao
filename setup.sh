#!/bin/bash
# ============================================
# Setup Automático — Sistema de Prospecção WhatsApp
# Execute: bash setup.sh
# ============================================

set -e

echo ""
echo "🚀 ============================================"
echo "   SISTEMA DE PROSPECÇÃO WHATSAPP"
echo "   Setup Automático"
echo "============================================"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================
# PASSO 1 — Verificar dependências
# ============================================
echo -e "${BLUE}[1/8]${NC} Verificando dependências..."

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker não encontrado!${NC}"
    echo "Instale o Docker: https://docs.docker.com/get-docker/"
    exit 1
fi
echo -e "${GREEN}✅ Docker OK${NC}"

if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose não encontrado!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker Compose OK${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js não encontrado!${NC}"
    echo "Instale o Node.js 18+: https://nodejs.org"
    exit 1
fi
NODE_VERSION=$(node -v | cut -d'.' -f1 | tr -d 'v')
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js 18+ é necessário (encontrado: $(node -v))${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v) OK${NC}"

# ============================================
# PASSO 2 — Criar diretórios necessários
# ============================================
echo -e "${BLUE}[2/8]${NC} Criando diretórios..."
mkdir -p logs
echo -e "${GREEN}✅ Diretórios criados${NC}"

# ============================================
# PASSO 3 — Instalar dependências backend
# ============================================
echo -e "${BLUE}[3/8]${NC} Instalando dependências do backend..."
cd backend
npm install --legacy-peer-deps 2>&1 | tail -1
echo -e "${GREEN}✅ Backend instalado${NC}"

# ============================================
# PASSO 4 — Instalar dependências frontend
# ============================================
echo -e "${BLUE}[4/8]${NC} Instalando dependências do frontend..."
cd ../frontend
npm install --legacy-peer-deps 2>&1 | tail -1
echo -e "${GREEN}✅ Frontend instalado${NC}"
cd ..

# ============================================
# PASSO 5 — Subir containers Docker
# ============================================
echo -e "${BLUE}[5/8]${NC} Subindo containers Docker..."

# Usar docker compose ou docker-compose
if command -v docker compose &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

$COMPOSE_CMD up -d
echo "Aguardando containers iniciarem..."
sleep 15
echo -e "${GREEN}✅ Containers rodando${NC}"

# ============================================
# PASSO 6 — Gerar Prisma Client e rodar migrations
# ============================================
echo -e "${BLUE}[6/8]${NC} Configurando banco de dados..."
cd backend
npx prisma generate
npx prisma migrate dev --name init --skip-generate 2>&1 | tail -3
echo -e "${GREEN}✅ Banco de dados configurado${NC}"
cd ..

# ============================================
# PASSO 7 — Testar serviços
# ============================================
echo -e "${BLUE}[7/8]${NC} Verificando serviços..."

# Iniciar backend em background
cd backend
node server.js &
BACKEND_PID=$!
cd ..

sleep 3

# Iniciar frontend em background
cd frontend
npx next dev -p 3000 &
FRONTEND_PID=$!
cd ..

sleep 5

# Testar endpoints
echo "Testando endpoints..."

if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend API OK (porta 3001)${NC}"
else
    echo -e "${YELLOW}⚠️ Backend ainda iniciando...${NC}"
fi

if curl -s http://localhost:8080 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Evolution API OK (porta 8080)${NC}"
else
    echo -e "${YELLOW}⚠️ Evolution API ainda iniciando...${NC}"
fi

if curl -s http://localhost:5678 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ n8n OK (porta 5678)${NC}"
else
    echo -e "${YELLOW}⚠️ n8n ainda iniciando...${NC}"
fi

# ============================================
# PASSO 8 — Configurar webhook
# ============================================
echo -e "${BLUE}[8/8]${NC} Configurando webhook..."

curl -s -X POST http://localhost:3001/api/configuracoes/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"url":"http://localhost:5678/webhook/whatsapp"}' > /dev/null 2>&1

echo -e "${GREEN}✅ Webhook configurado${NC}"

# ============================================
# RESULTADO FINAL
# ============================================
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}🚀 SISTEMA COMPLETO RODANDO LOCALMENTE${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "  📊 Dashboard:      ${BLUE}http://localhost:3000${NC}"
echo -e "  🔧 Backend API:    ${BLUE}http://localhost:3001${NC}"
echo -e "  🤖 n8n:            ${BLUE}http://localhost:5678${NC}  (admin/admin123)"
echo -e "  📱 Evolution API:  ${BLUE}http://localhost:8080${NC}"
echo ""
echo -e "  ${YELLOW}→ Abra o Dashboard e vá em Configurações para conectar o WhatsApp via QR Code${NC}"
echo ""
echo -e "  Para parar: kill $BACKEND_PID $FRONTEND_PID && docker compose down"
echo ""
