// ============================================
// Evolution API — HTTP Client para Next.js API Routes
// ============================================
import axios from 'axios';

const EVOLUTION_URL = (process.env.EVOLUTION_API_URL || 'http://localhost:8080').trim().replace(/[\r\n]+/g, '');
const EVOLUTION_KEY = (process.env.EVOLUTION_API_KEY || '').trim().replace(/[\r\n\t\x00-\x1F\x7F]+/g, '');
const INSTANCE = (process.env.EVOLUTION_INSTANCE || 'prospeccao').trim().replace(/[\r\n]+/g, '');

// Webhook URL: usa WEBHOOK_URL se definido (Vercel), senão monta a partir de host/porta
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
const BACKEND_HOST = process.env.BACKEND_HOST || 'host.docker.internal';
const BACKEND_PORT = process.env.WEBHOOK_PORT || process.env.PORT || '3000';

// Debug: log sanitized values (sem expor a key completa)
if (typeof process !== 'undefined' && process.env) {
  const keyPreview = EVOLUTION_KEY ? `${EVOLUTION_KEY.substring(0, 4)}...${EVOLUTION_KEY.substring(EVOLUTION_KEY.length - 4)} (len=${EVOLUTION_KEY.length})` : 'EMPTY';
  console.log(`[Evolution] URL=${EVOLUTION_URL} | KEY=${keyPreview} | INSTANCE=${INSTANCE}`);
}

const api = axios.create({
  baseURL: EVOLUTION_URL,
  headers: {
    'Content-Type': 'application/json',
    ...(EVOLUTION_KEY ? { apikey: EVOLUTION_KEY } : {}),
  },
  timeout: 30000,
});

// QR Code cache (in-memory, ok for serverless warm instances)
let qrCodeCache: {
  base64: string | null;
  pairingCode: string | null;
  code: string | null;
  timestamp: number | null;
  count: number;
} = { base64: null, pairingCode: null, code: null, timestamp: null, count: 0 };

export function armazenarQRCode(data: any) {
  const base64 = data?.qrcode?.base64 || data?.base64 || data?.qrcode || null;
  qrCodeCache = {
    base64: typeof base64 === 'string' && base64.length > 20 ? base64 : null,
    pairingCode: data?.pairingCode || qrCodeCache.pairingCode,
    code: data?.code || qrCodeCache.code,
    timestamp: Date.now(),
    count: (qrCodeCache.count || 0) + 1,
  };
}

export function obterQRCodeCache() {
  if (!qrCodeCache.base64 && !qrCodeCache.pairingCode) return null;
  const expirado = qrCodeCache.timestamp ? Date.now() - qrCodeCache.timestamp > 60000 : false;
  return { ...qrCodeCache, expirado };
}

export function limparQRCodeCache() {
  qrCodeCache = { base64: null, pairingCode: null, code: null, timestamp: null, count: 0 };
}

function formatarTelefone(telefone: string) {
  let num = telefone.replace(/\D/g, '');
  if (!num.startsWith('55')) num = '55' + num;
  return num;
}

export async function enviarMensagem(telefone: string, texto: string) {
  try {
    const numero = formatarTelefone(telefone);
    const response = await api.post(`/message/sendText/${INSTANCE}`, {
      number: numero,
      text: texto,
    });
    return { sucesso: true, data: response.data };
  } catch (error: any) {
    return { sucesso: false, erro: error.message };
  }
}

export async function enviarMensagemComBotoes(
  telefone: string,
  texto: string,
  botoes: any[],
  rodape?: string
) {
  const numero = formatarTelefone(telefone);

  // 1) Buttons
  if (botoes && botoes.length <= 3) {
    try {
      const response = await api.post(`/message/sendButtons/${INSTANCE}`, {
        number: numero,
        title: '',
        description: texto.length > 1024 ? texto.substring(0, 1020) + '...' : texto,
        footer: rodape || 'Toque em uma opção 👆',
        buttons: botoes.map((b: any) => ({ type: 'reply', displayText: b.texto, id: b.id })),
      });
      return { sucesso: true, data: response.data, tipo: 'botoes' };
    } catch {}
  }

  // 2) List
  if (botoes && botoes.length > 0) {
    try {
      const response = await api.post(`/message/sendList/${INSTANCE}`, {
        number: numero,
        title: 'Escolha uma opção',
        description: texto.length > 1024 ? texto.substring(0, 1020) + '...' : texto,
        footerText: rodape || 'Toque para ver opções 👆',
        buttonText: '📋 Ver opções',
        sections: [
          {
            title: 'Opções disponíveis',
            rows: botoes.map((b: any) => ({ title: b.texto, description: b.descricao || '', rowId: b.id })),
          },
        ],
      });
      return { sucesso: true, data: response.data, tipo: 'lista' };
    } catch {}
  }

  // 3) Fallback: plain text
  return await enviarMensagem(telefone, texto);
}

export async function verificarConexao() {
  try {
    const response = await api.get(`/instance/connectionState/${INSTANCE}`);
    const state = response.data?.instance?.state || response.data?.state || 'unknown';
    const conectado = state === 'open';
    if (conectado) limparQRCodeCache();
    return { sucesso: true, conectado, estado: state };
  } catch {
    return { sucesso: false, conectado: false, estado: 'error' };
  }
}

export async function iniciarConexao() {
  try {
    const status = await verificarConexao();
    if (status.conectado) {
      return { sucesso: true, conectado: true, mensagem: 'Já conectado' };
    }
    limparQRCodeCache();

    // 1) Verificar se instância existe
    let instanciaExiste = false;
    let currentState = 'unknown';
    try {
      const instances = await api.get('/instance/fetchInstances');
      instanciaExiste = instances.data?.some(
        (i: any) => i.name === INSTANCE || i.instance?.instanceName === INSTANCE
      );
    } catch {}

    // 2) Se existe, verificar estado e LIMPAR se corrompida
    if (instanciaExiste) {
      try {
        const state = await api.get(`/instance/connectionState/${INSTANCE}`);
        currentState = state.data?.instance?.state || state.data?.state || 'unknown';
        console.log(`[Evolution] Estado atual da instância: ${currentState}`);
      } catch {}

      // Se estado é close, connecting ou unknown -> deletar e recriar limpa
      if (currentState !== 'open') {
        console.log(`[Evolution] Instância em estado '${currentState}' — deletando para recriar limpa...`);
        try { await api.delete(`/instance/logout/${INSTANCE}`); } catch {}
        await new Promise((r) => setTimeout(r, 2000));
        try { await api.delete(`/instance/delete/${INSTANCE}`); } catch {}
        await new Promise((r) => setTimeout(r, 3000));
        instanciaExiste = false;
      }
    }

    // 3) Criar instância nova (limpa)
    if (!instanciaExiste) {
      console.log('[Evolution] Criando instância nova...');
      try {
        const createResponse = await api.post('/instance/create', {
          instanceName: INSTANCE,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        });
        const qrFromCreate = createResponse.data?.qrcode?.base64 || createResponse.data?.base64;
        if (qrFromCreate && typeof qrFromCreate === 'string' && qrFromCreate.length > 50) {
          armazenarQRCode({ base64: qrFromCreate });
          console.log('[Evolution] QR Code recebido na criação da instância');
        }
        await new Promise((r) => setTimeout(r, 2000));
      } catch (e: any) {
        if (e.response?.status !== 403) {
          console.error('[Evolution] Erro ao criar instância:', e.message);
        }
      }
    }

    // 4) Configurar webhook ANTES de conectar
    const whResult = await autoConfigurarWebhook();
    console.log(`[Evolution] Webhook configurado: ${whResult.sucesso ? whResult.url : whResult.erro}`);
    await new Promise((r) => setTimeout(r, 1000));

    // 5) Conectar (gera QR Code)
    try {
      const response = await api.get(`/instance/connect/${INSTANCE}`);
      const base64QR = response.data?.base64;
      const pairingCode = response.data?.pairingCode;
      const code = response.data?.code;

      // Armazenar QR Code retornado diretamente pelo connect
      if (base64QR && typeof base64QR === 'string' && base64QR.length > 50) {
        armazenarQRCode({ base64: base64QR, pairingCode, code });
        console.log('[Evolution] QR Code recebido via connect endpoint');
      }
      if (pairingCode) {
        qrCodeCache.pairingCode = pairingCode;
        qrCodeCache.code = code;
        qrCodeCache.timestamp = Date.now();
      }
      return {
        sucesso: true,
        conectado: false,
        pairingCode: pairingCode || null,
        qrCode: base64QR || null,
        aguardandoQR: true,
        mensagem: 'Conexão iniciada. QR Code será gerado em instantes...',
      };
    } catch (e: any) {
      console.error('[Evolution] Erro ao conectar:', e.message);
      return { sucesso: false, erro: e.message };
    }
  } catch (error: any) {
    return { sucesso: false, erro: error.message };
  }
}

export async function configurarWebhook(webhookUrl?: string) {
  try {
    const url = webhookUrl || `http://${BACKEND_HOST}:${BACKEND_PORT}/api/webhook/whatsapp`;
    const response = await api.post(`/webhook/set/${INSTANCE}`, {
      webhook: {
        enabled: true,
        url,
        webhook_by_events: false,
        base64: true,
        events: ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'MESSAGES_UPSERT', 'MESSAGES_UPDATE'],
      },
    });
    return { sucesso: true, data: response.data, url };
  } catch (error: any) {
    return { sucesso: false, erro: error.message };
  }
}

export async function autoConfigurarWebhook() {
  // Prioridade: WEBHOOK_URL (Vercel) > montagem manual (local)
  const webhookUrl = WEBHOOK_URL
    ? `${WEBHOOK_URL}/api/webhook/whatsapp`
    : `http://${BACKEND_HOST}:${BACKEND_PORT}/api/webhook/whatsapp`;
  console.log(`[Evolution] autoConfigurarWebhook URL: ${webhookUrl}`);
  return await configurarWebhook(webhookUrl);
}

export async function desconectar() {
  try {
    const response = await api.delete(`/instance/logout/${INSTANCE}`);
    limparQRCodeCache();
    return { sucesso: true, data: response.data };
  } catch (error: any) {
    return { sucesso: false, erro: error.message };
  }
}

export async function reiniciarInstancia() {
  try {
    console.log('[Evolution] Reiniciando instância — logout + delete...');
    try { await api.delete(`/instance/logout/${INSTANCE}`); } catch {}
    await new Promise((r) => setTimeout(r, 2000));
    try { await api.delete(`/instance/delete/${INSTANCE}`); } catch {}
    await new Promise((r) => setTimeout(r, 3000));
    limparQRCodeCache();
    console.log('[Evolution] Instância deletada. Pronta para recriar.');
    return { sucesso: true, mensagem: 'Instância reiniciada. Clique em Conectar para gerar novo QR.' };
  } catch (error: any) {
    return { sucesso: false, erro: error.message };
  }
}

export async function obterInfoInstancia() {
  try {
    const response = await api.get('/instance/fetchInstances');
    const instancia = response.data?.find(
      (i: any) => i.name === INSTANCE || i.instance?.instanceName === INSTANCE
    );
    return { sucesso: true, data: instancia || null };
  } catch (error: any) {
    return { sucesso: false, data: null, erro: error.message };
  }
}
