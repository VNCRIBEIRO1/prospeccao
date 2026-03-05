# 🟢 COMO USAR — Passo a Passo Simples

> **Resumo**: Este sistema envia mensagens automáticas pelo WhatsApp para prospectar clientes (advogados).  
> Você precisa abrir **3 terminais** e executar comandos em cada um. Depois é tudo pelo navegador.

---

## ⚠️ ANTES DE COMEÇAR

Certifique-se que o **Docker Desktop** está aberto e rodando (ícone verde na barra de tarefas).

---

## PASSO 1 — Ligar a infraestrutura (Docker)

Abra o **PowerShell** (ou Terminal) e digite:

```
cd c:\Users\Administrador\Desktop\prospeccao\projeto
docker-compose up -d
```

**O que faz:** Liga os serviços internos (Evolution API, banco de dados, Redis, n8n).  
**Espere até aparecer:** "Creating... done" para os 4 containers.

Para conferir se deu certo:
```
docker ps
```
Deve mostrar **4 linhas** com status "Up".

---

## PASSO 2 — Ligar o Backend (servidor)

> ⚠️ **IMPORTANTE**: O `server.js` fica dentro da pasta `backend`. Você precisa entrar nessa pasta primeiro!

No **mesmo terminal** ou em um **novo terminal**, digite:

```
cd c:\Users\Administrador\Desktop\prospeccao\projeto\backend
node server.js
```

**O que faz:** Liga o servidor que controla tudo (envio de mensagens, banco de dados, fila).  
**Espere até aparecer:**
```
🚀 Backend rodando na porta 3001
📨 Fila de disparos inicializada
✅ Webhook auto-configurado com sucesso
```

> 🔴 **Não feche este terminal!** O servidor precisa ficar rodando.  
> 🔴 **Se aparecer erro "Cannot find module"**, você está na pasta errada. Digite o `cd` acima novamente.

---

## PASSO 3 — Ligar o Frontend (tela do sistema)

Abra um **NOVO terminal** (não feche o anterior!) e digite:

```
cd c:\Users\Administrador\Desktop\prospeccao\projeto\frontend
npx next dev
```

**O que faz:** Liga a interface visual do sistema (as telas que você vai usar).  
**Espere até aparecer:**
```
✓ Ready in 2s
- Local: http://localhost:3000
```

> 🔴 **Não feche este terminal também!** O frontend precisa ficar rodando.

---

## PASSO 4 — Abrir o sistema no navegador

Abra o **Google Chrome** (ou qualquer navegador) e acesse:

```
http://localhost:3000
```

Pronto! Você verá o **Dashboard** do sistema com métricas.

---

## PASSO 5 — Conectar o WhatsApp

Sem isso, nada funciona. Faça assim:

1. No navegador, clique em **"Configurações"** no menu da esquerda  
   (ou acesse `http://localhost:3000/configuracoes`)

2. Clique no botão verde **"⚡ Conectar WhatsApp"**

3. Vai aparecer um **QR Code** na tela (quadrado preto e branco)

4. No seu **celular**, abra o WhatsApp:
   - Toque nos **3 pontinhos** (⋮) no canto superior
   - Toque em **"Aparelhos conectados"**
   - Toque em **"Conectar um aparelho"**
   - **Aponte a câmera** para o QR Code na tela do computador

5. Aguarde 2-3 segundos. O status vai mudar para **🟢 Conectado**

> ⏰ O QR Code expira em 60 segundos. Se expirar, um novo é gerado automaticamente.

---

## PASSO 6 — Adicionar contatos

1. No menu, clique em **"Contatos"**
2. Clique em **"+ Novo Contato"**
3. Preencha os campos:
   - **Nome**: nome do advogado/escritório
   - **Telefone**: DDD + número (ex: `11999887766`)
   - **Escritório, Cidade, Área**: opcional
4. Clique em **Adicionar**

**Para importar vários de uma vez** (CSV):
1. Prepare um arquivo `.csv` com colunas: `nome,telefone,escritorio,cidade,areaAtuacao`
2. Clique em **"Importar CSV"** e selecione o arquivo

---

## PASSO 7 — Criar e iniciar uma campanha

1. No menu, clique em **"Campanhas"**
2. Preencha:
   - **Nome**: ex: "Campanha Março 2026"
   - **Delay**: `60` segundos (intervalo entre cada mensagem)
   - **Limite diário**: `30` a `50`
3. Clique em **"Criar Campanha"**
4. Na lista, clique no botão **▶️ Iniciar**

O sistema vai enviar a primeira mensagem para cada contato automaticamente.

---

## PASSO 8 — Acompanhar resultados

- **Dashboard** (`http://localhost:3000`): mostra quantos contatos, mensagens enviadas, taxa de resposta
- **Leads** (`http://localhost:3000/leads`): mostra os interessados em um quadro Kanban
- **Campanhas** → **Log de Envios**: mostra cada mensagem enviada/recebida

---

## 🤖 Como o bot funciona sozinho

Depois que a campanha envia a primeira mensagem, o bot responde sozinho:

- Contato responde **"1" ou "sim"** → bot envia mais detalhes
- Contato responde **"1" de novo** → bot coleta dados + **avisa você** (lead quente!)
- Contato responde **"3" ou "não"** → bot encerra educadamente
- Contato pede **"pare" ou "bloquear"** → bot nunca mais manda mensagem

Quando um lead quente é detectado, ele aparece no quadro de **Leads** automaticamente.

---

## 🛑 Como desligar tudo

1. No terminal do **frontend**: aperte `Ctrl + C`
2. No terminal do **backend**: aperte `Ctrl + C`
3. Para desligar o Docker (opcional):
   ```
   cd c:\Users\Administrador\Desktop\prospeccao\projeto
   docker-compose down
   ```

---

## 🔄 Como ligar tudo de novo (dia seguinte)

Toda vez que quiser usar o sistema, repita:

```
# Terminal 1 — Docker (se desligou)
cd c:\Users\Administrador\Desktop\prospeccao\projeto
docker-compose up -d

# Terminal 2 — Backend
cd c:\Users\Administrador\Desktop\prospeccao\projeto\backend
node server.js

# Terminal 3 — Frontend
cd c:\Users\Administrador\Desktop\prospeccao\projeto\frontend
npx next dev
```

Depois abra `http://localhost:3000` no navegador.

> 💡 **Dica**: O WhatsApp pode continuar conectado entre sessões. Se desconectar, vá em Configurações e escaneie o QR Code de novo.

---

## ❓ Problemas comuns

| Problema | Solução |
|----------|---------|
| **"Cannot find module server.js"** | Você está na pasta errada. Use `cd c:\Users\Administrador\Desktop\prospeccao\projeto\backend` antes de rodar `node server.js` |
| **QR Code não aparece** | Verifique se o Docker está rodando (`docker ps` deve mostrar 4 containers) |
| **Tela não abre no navegador** | Verifique se o terminal do frontend mostra "Ready". Use `http://localhost:3000` |
| **Mensagens não enviam** | Verifique se o WhatsApp está 🟢 Conectado na página de Configurações |
| **"ECONNREFUSED" no navegador** | O backend não está rodando. Abra outro terminal e rode `node server.js` dentro da pasta `backend` |
| **Docker não sobe** | Abra o Docker Desktop e espere ele iniciar completamente antes de rodar `docker-compose up -d` |

---

## 📁 Onde fica cada coisa

```
c:\Users\Administrador\Desktop\prospeccao\projeto\
│
├── backend\          ← servidor (rode "node server.js" AQUI DENTRO)
│   ├── server.js     ← arquivo principal do servidor
│   ├── .env          ← configurações (senhas, portas)
│   └── ...
│
├── frontend\         ← telas do sistema (rode "npx next dev" AQUI DENTRO)
│   └── ...
│
├── docker-compose.yml ← configuração do Docker
├── COMO-USAR.md       ← ESTE ARQUIVO
└── GUIA-COMPLETO.md   ← documentação técnica detalhada
```

---

## 🔐 Senhas padrão

| Serviço | Login | Senha |
|---------|-------|-------|
| n8n (automação) | admin@prospeccao.local | Admin123! |
| Evolution API Key | — | minha-chave-secreta |

Acesse o n8n em: `http://localhost:5678`
