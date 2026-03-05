# 📋 Guia Completo — Sistema de Prospecção WhatsApp

## 🏗️ Arquitetura do Sistema

```
┌─────────────────┐     ┌───────────────────┐     ┌──────────────────┐
│   Frontend      │────▶│   Backend         │────▶│  Evolution API   │
│   Next.js       │     │   Express/Node    │     │  (Docker)        │
│   porta 3000    │     │   porta 3001      │◀────│  porta 8080      │
└─────────────────┘     └───────┬───────────┘     └────────┬─────────┘
                                │                          │
                        ┌───────┼───────────┐              │
                        │       │           │              │
                  ┌─────┴──┐ ┌──┴────┐ ┌────┴───┐    ┌────┴─────┐
                  │ SQLite  │ │ Redis │ │  n8n   │    │ WhatsApp │
                  │ (Prisma)│ │ (Bull)│ │ porta  │    │ (celular)│
                  │         │ │ 6379  │ │ 5678   │    │          │
                  └─────────┘ └───────┘ └────────┘    └──────────┘
```

---

## 📦 Pré-requisitos

- **Node.js** 18+ instalado
- **Docker Desktop** instalado e rodando
- **Git** (opcional)
- **Celular** com WhatsApp instalado

---

## 🚀 ETAPA 1 — Subir a Infraestrutura (Docker)

### 1.1 Iniciar os containers

```bash
cd c:\Users\Administrador\Desktop\prospeccao\projeto
docker-compose up -d
```

### 1.2 Verificar se tudo subiu

```bash
docker ps
```

Deve mostrar 4 containers rodando:

| Container | Porta | Função |
|-----------|-------|--------|
| `evolution-api` | 8080 | Conexão WhatsApp via QR Code |
| `postgres-evolution` | 5432 | Banco de dados da Evolution API |
| `redis` | 6379 | Fila de disparos (Bull) |
| `n8n` | 5678 | Automação de fluxos |

### 1.3 Testar se a Evolution API está acessível

```bash
curl http://localhost:8080
```

Deve retornar informações da API.

---

## 🚀 ETAPA 2 — Configurar o Backend

### 2.1 Instalar dependências

```bash
cd c:\Users\Administrador\Desktop\prospeccao\projeto\backend
npm install
```

### 2.2 Configurar o arquivo `.env`

O arquivo `.env` já está configurado com valores padrão:

```env
PORT=3001
NODE_ENV=development
BACKEND_HOST=host.docker.internal
DATABASE_URL="file:./dev.db"
REDIS_URL=redis://localhost:6379
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=minha-chave-secreta
EVOLUTION_INSTANCE=prospeccao
```

> ⚠️ **IMPORTANTE**: A variável `BACKEND_HOST=host.docker.internal` permite que o Evolution API (que roda no Docker) alcance o backend (que roda no host Windows).

### 2.3 Criar/Migrar o banco de dados

```bash
npx prisma migrate dev
```

### 2.4 Iniciar o backend

```bash
cd c:\Users\Administrador\Desktop\prospeccao\projeto\backend
node server.js
```

Você verá:
```
🚀 Backend rodando na porta 3001
📨 Fila de disparos inicializada
✅ Webhook auto-configurado com sucesso
🔗 Webhook auto-configurado no startup
```

> O webhook é **configurado automaticamente** quando o backend inicia. Ele aponta para `http://host.docker.internal:3001/api/webhook/whatsapp`.

---

## 🚀 ETAPA 3 — Configurar o Frontend

### 3.1 Instalar dependências

```bash
cd c:\Users\Administrador\Desktop\prospeccao\projeto\frontend
npm install
```

### 3.2 Iniciar o frontend

```bash
npx next dev
```

### 3.3 Acessar o sistema

Abra o navegador em: **http://localhost:3000**

---

## 📱 ETAPA 4 — Conectar o WhatsApp (LOGIN QR CODE)

Esta é a etapa mais importante! Sem isso, o bot não funciona.

### 4.1 Acessar a página de Configurações

1. Abra **http://localhost:3000/configuracoes**
2. Você verá a seção **"Conexão WhatsApp"** no topo
3. O status mostrará **🔴 Desconectado**

### 4.2 Gerar o QR Code

1. Clique no botão verde **"⚡ Conectar WhatsApp"**
2. Aguarde 2-3 segundos para o QR Code aparecer
3. Um QR Code grande aparecerá em fundo branco

### 4.3 Escanear com o celular

1. Abra o **WhatsApp** no celular
2. Toque no menu **⋮** (3 pontinhos)
3. Toque em **"Aparelhos conectados"**
4. Toque em **"Conectar um aparelho"**
5. **Escaneie o QR Code** que aparece na tela

### 4.4 Confirmação

- O status mudará para **🟢 Conectado**
- O QR Code desaparecerá automaticamente
- Uma mensagem verde aparecerá: _"WhatsApp conectado e pronto para enviar mensagens!"_
- O webhook será reconfigurado automaticamente

> ⏰ **QR Code expira em 60 segundos** — ele renova automaticamente! Se expirar, um novo será gerado.

### 4.5 Verificar webhook (opcional)

O webhook é configurado automaticamente. Se precisar reconfigurar:
1. Com o WhatsApp conectado, clique em **"Reconfigurar Webhook"**
2. O status mostrará **"✅ Webhook ativo"**

---

## 👥 ETAPA 5 — Importar Contatos

### 5.1 Manualmente

1. Acesse **http://localhost:3000/contatos**
2. Clique em **"+ Novo Contato"**
3. Preencha: Nome, Telefone, Escritório, Cidade, Área de Atuação
4. Clique em **Adicionar**

### 5.2 Via CSV (importação em massa)

1. Prepare um arquivo CSV com as colunas:
   ```
   nome,telefone,escritorio,cidade,areaAtuacao
   Dr. Silva,11999887766,Silva Advocacia,São Paulo,Trabalhista
   Dra. Maria,21988776655,Penal & Associados,Rio de Janeiro,Penal
   ```
2. Na página de Contatos, clique em **"Importar CSV"**
3. Selecione o arquivo
4. Os contatos serão importados com status **"pendente"**

> 📞 **Formato do telefone**: Use DDD + número (ex: `11999887766`). O sistema adiciona o `55` automaticamente.

---

## 📢 ETAPA 6 — Criar e Iniciar uma Campanha

### 6.1 Criar campanha

1. Acesse **http://localhost:3000/campanhas**
2. Preencha o formulário:
   - **Nome**: Ex: "Campanha Janeiro 2026"
   - **Delay entre mensagens (segundos)**: Recomendado `60` (mínimo 45)
   - **Limite diário de envios**: Recomendado `30-50`
3. Clique em **"Criar Campanha"**

### 6.2 Iniciar a campanha

1. Na lista de campanhas, clique no botão **▶️ Iniciar**
2. O sistema irá:
   - Buscar todos os contatos com status **"pendente"**
   - Enfileirar as mensagens com delay aleatório (±20%)
   - Enviar a **msg1** para cada contato
3. O status mudará para **"ativa"**

### 6.3 Monitorar

- O **Log de Envios** na parte inferior mostra as mensagens enviadas em tempo real
- O **Dashboard** (http://localhost:3000) mostra métricas gerais
- Quando todos os contatos forem processados, a campanha muda para **"concluída"**

### 6.4 Pausar campanha (se necessário)

- Clique em **⏸️ Pausar** para parar os envios pendentes
- Os jobs na fila serão removidos

---

## 🤖 ETAPA 7 — Como Funciona o Bot (Fluxo Automático)

Após o envio da **msg1**, o bot responde automaticamente baseado nas respostas:

```
📨 msg1 (primeira mensagem da campanha)
├── Resposta "1" (Sim, quero) → 📨 msg2 (detalhes + link)
│   ├── "1" (Quero contratar) → 📨 msg3a (coleta de dados) + 🔔 LEAD QUENTE!
│   ├── "2" (Tenho dúvidas)   → 📨 msg3b (FAQ)
│   │   ├── "1" (Contratar)   → 📨 msg3a + 🔔 LEAD QUENTE!
│   │   ├── "2" (Mais dúvidas) → 📨 msg3b (repete FAQ)
│   │   └── "3" (Vou pensar)  → 📨 msg3c (follow-up suave)
│   └── "3" (Vou pensar)      → 📨 msg3c (follow-up suave)
│
├── Resposta "2" (Já tenho site) → 📨 msg2b (comparativo)
│   ├── "1" (Tem tudo)        → 📨 msg2b_fim (encerramento)
│   ├── "2" (Parcial)         → 📨 msg3b (FAQ)
│   └── "3" (Não tem)         → 📨 msg2 (apresentação completa)
│
├── Resposta "3" (Agora não) → 📨 msg3c (follow-up suave)
│
└── Palavras de bloqueio ("pare", "spam", "bloquear") → ⛔ Bloqueado
```

### O que acontece em cada ação:

| Ação | Resultado |
|------|-----------|
| **Lead Quente** (msg3a) | Cria Lead no pipeline + Notifica Telegram |
| **Bloqueio** | Contato marcado como "naoInteresse" — nunca mais recebe |
| **Follow-up** (msg3c) | Contato marcado como "pendente_followup" |

---

## 📊 ETAPA 8 — Monitorar Resultados

### 8.1 Dashboard (http://localhost:3000)

- **Total de Contatos** cadastrados
- **Mensagens Enviadas** hoje/total
- **Respostas Recebidas** e taxa de resposta
- **Leads Quentes** detectados
- **Gráfico** de envios × respostas (últimos 7 dias)
- **Status da Fila** (jobs ativos, aguardando, etc.)

### 8.2 Pipeline de Leads (http://localhost:3000/leads)

Kanban com 4 estágios:
1. **Novo** → Lead recém-detectado
2. **Interessado** → Respondeu positivamente
3. **Negociando** → Em processo de venda
4. **Fechado** → Venda concluída

Clique em um lead para ver o histórico de mensagens.

### 8.3 Mensagens (http://localhost:3000/campanhas)

O log de envios mostra todas as mensagens com:
- Direção (enviada/recebida)
- Etapa do bot
- Horário
- Conteúdo

---

## ⚙️ ETAPA 9 — Configurações Avançadas

### 9.1 Notificações Telegram (Opcional)

Para receber alertas de leads quentes no Telegram:

1. Fale com **@BotFather** no Telegram e crie um bot
2. Copie o **Bot Token**
3. Fale com **@userinfobot** para obter seu **Chat ID**
4. Edite o arquivo `backend/.env`:
   ```env
   TELEGRAM_BOT_TOKEN=123456:ABC-DEF-GHI
   TELEGRAM_CHAT_ID=987654321
   ```
5. Reinicie o backend

### 9.2 Limites de Segurança

No arquivo `backend/.env`:

```env
MAX_DISPAROS_DIA=50        # Máximo de envios por dia (todas as campanhas)
DELAY_MIN_SEGUNDOS=45      # Delay mínimo entre mensagens (segundos)
DELAY_MAX_SEGUNDOS=120     # Delay máximo
MAX_NAO_RESPOSTAS=3        # Máximo de tentativas sem resposta
```

> ⚠️ **NÃO reduzir o delay abaixo de 45s** — risco de bloqueio pelo WhatsApp!

### 9.3 n8n (Automação)

Acesse **http://localhost:5678** com:
- **Email**: admin@prospeccao.local
- **Senha**: Admin123!

O workflow "Fluxo WhatsApp Prospeccao" está ativo e pode ser expandido.

---

## 🔧 Troubleshooting

### "QR Code não aparece"

1. Verifique se o Evolution API está rodando: `docker ps`
2. Teste: `curl http://localhost:8080`
3. Tente clicar em "Conectar WhatsApp" novamente
4. Se persistir, reinicie o container: `docker restart evolution-api`

### "Mensagens não são enviadas"

1. Verifique se o WhatsApp está **conectado** (🟢) na página de Configurações
2. Verifique se o Redis está rodando: `docker ps | grep redis`
3. Verifique os logs do backend no terminal
4. Verifique se os contatos estão com status **"pendente"**

### "Webhook não funciona"

1. Na página de Configurações, clique em **"Reconfigurar Webhook"**
2. Verifique se `BACKEND_HOST=host.docker.internal` está no `.env`
3. Reinicie o backend: feche e execute `node server.js` novamente

### "Respostas não são processadas"

1. Verifique se o webhook está configurado (Evolution API deve enviar para o backend)
2. Verifique os logs: deve aparecer "Mensagem recebida" quando alguém responde
3. Teste manualmente:
   ```bash
   curl -X POST http://localhost:3001/api/webhook/whatsapp \
     -H "Content-Type: application/json" \
     -d '{"telefone":"11999887766","mensagem":"1"}'
   ```

### "Evolution API unhealthy"

Isso pode acontecer se o WhatsApp não está conectado. É normal — o health check falha quando está "close". O container continua funcionando.

### "Erro de conexão recusada"

- Backend: Verifique se está rodando na porta 3001
- Frontend: Verifique se está rodando na porta 3000
- Docker: Verifique se os containers estão rodando

---

## 📁 Estrutura de Arquivos

```
projeto/
├── backend/
│   ├── .env                  # Configurações
│   ├── server.js             # Servidor Express
│   ├── lib/
│   │   └── prisma.js         # Singleton Prisma
│   ├── prisma/
│   │   └── schema.prisma     # Modelo do banco
│   ├── routes/
│   │   ├── campanhas.js      # CRUD Campanhas
│   │   ├── configuracoes.js  # Config + WhatsApp
│   │   ├── contatos.js       # CRUD Contatos + CSV
│   │   ├── leads.js          # CRUD Leads
│   │   ├── mensagens.js      # Histórico
│   │   ├── metricas.js       # Dashboard
│   │   └── webhook.js        # Recebe msg do WhatsApp
│   └── services/
│       ├── detector.js       # Detecta respostas
│       ├── disparos.js       # Fila Bull + envios
│       ├── evolution.js      # API Evolution
│       ├── logger.js         # Winston logs
│       ├── mensagens.js      # Templates das msgs
│       └── notificacoes.js   # Telegram
│
├── frontend/
│   ├── pages/
│   │   ├── index.tsx         # Dashboard
│   │   ├── contatos.tsx      # Gestão de contatos
│   │   ├── campanhas.tsx     # Gestão de campanhas
│   │   ├── leads.tsx         # Pipeline Kanban
│   │   └── configuracoes.tsx # Config + QR Code
│   ├── components/
│   │   └── Layout.tsx        # Layout com sidebar
│   ├── lib/
│   │   └── api.ts            # Cliente HTTP
│   └── next.config.js        # Proxy /api → :3001
│
├── n8n/
│   └── workflow-simple.json  # Workflow de automação
│
└── docker-compose.yml        # Infraestrutura
```

---

## 🔄 Fluxo Completo de Ponta a Ponta

```
1. SETUP
   └── docker-compose up -d (sobe Evolution API, Redis, PostgreSQL, n8n)

2. BACKEND
   └── node server.js (inicia servidor + fila + auto-configura webhook)

3. FRONTEND
   └── npx next dev (inicia interface web)

4. LOGIN WHATSAPP
   └── Configurações → Conectar WhatsApp → Escanear QR Code
       └── Webhook auto-configurado após conexão

5. IMPORTAR CONTATOS
   └── Contatos → Importar CSV ou adicionar manualmente

6. CRIAR CAMPANHA
   └── Campanhas → Criar → Definir delay e limite diário

7. INICIAR CAMPANHA
   └── Campanhas → ▶️ Iniciar
       └── msg1 enviada para cada contato pendente (com delay)

8. BOT AUTOMÁTICO
   └── Contato responde → Evolution API → Webhook → Backend
       └── Detector analisa resposta → Envia próxima mensagem
           └── Se lead quente → Cria Lead + Notifica Telegram

9. MONITORAR
   └── Dashboard (métricas) + Pipeline (leads) + Campanhas (logs)

10. FECHAR VENDAS
    └── Pipeline → Mover leads: Interessado → Negociando → Fechado
```

---

## ⚡ Comandos Rápidos

```bash
# Subir toda a infraestrutura
cd c:\Users\Administrador\Desktop\prospeccao\projeto
docker-compose up -d

# Iniciar backend
cd c:\Users\Administrador\Desktop\prospeccao\projeto\backend
node server.js

# Iniciar frontend (abrir OUTRO terminal)
cd c:\Users\Administrador\Desktop\prospeccao\projeto\frontend
npx next dev

# Verificar containers
docker ps

# Reiniciar Evolution API
docker restart evolution-api

# Verificar logs do backend
# (veja o terminal onde o backend está rodando)

# Testar webhook manualmente
curl -X POST http://localhost:3001/api/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"telefone":"11999887766","mensagem":"1"}'

# Exportar contatos
curl http://localhost:3001/api/contatos/exportar/csv > contatos.csv

# Verificar status do WhatsApp
curl http://localhost:3001/api/configuracoes/whatsapp/status
```

---

## 🔐 Credenciais Padrão

| Serviço | Credencial | Valor |
|---------|-----------|-------|
| Evolution API | API Key | `minha-chave-secreta` |
| n8n | Email | `admin@prospeccao.local` |
| n8n | Senha | `Admin123!` |
| PostgreSQL | Usuário | `evolution` |
| PostgreSQL | Senha | `evolution123` |

> ⚠️ **Em produção, altere TODAS as senhas padrão!**
