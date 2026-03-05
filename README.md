# Prospecção WhatsApp

Sistema completo de prospecção automatizada via WhatsApp para escritórios de advocacia.

## Stack

- **Frontend**: Next.js 14 + Tailwind CSS + TypeScript
- **Backend**: Node.js + Express + Prisma
- **Banco**: PostgreSQL (Neon)
- **WhatsApp**: Evolution API v2 + WPPConnect
- **Fila**: Bull + Redis
- **Automação**: n8n
- **Deploy**: Vercel (frontend)

## Funcionalidades

- 🤖 Bot de prospecção com fluxo de mensagens automatizado
- 🔘 Botões interativos no WhatsApp (com fallback para texto)
- 📊 Dashboard com métricas em tempo real
- 👥 Gestão de contatos com importação CSV
- 📢 Campanhas de disparo com controle de limite diário
- 🔥 Detecção automática de leads quentes
- 📱 Conexão WhatsApp via QR Code
- ⏰ Scheduler automático (follow-ups, reset diário, health check)
- 🔗 Integração n8n para automações avançadas

## Setup Local

```bash
# Backend
cd backend
npm install
npx prisma migrate dev
node server.js

# Frontend
cd frontend
npm install
npm run dev
```

## Variáveis de Ambiente

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua-chave
EVOLUTION_INSTANCE=prospeccao
```
