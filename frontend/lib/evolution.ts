// ============================================
// WPPConnect-Server — HTTP Client para Next.js API Routes
// Migrado de Evolution API → WPPConnect (definitivo)
// ============================================
import axios from 'axios';

const WPPCONNECT_URL = (process.env.WPPCONNECT_URL || 'http://localhost:21465').trim().replace(/[\r\n]+/g, '');
const WPPCONNECT_SECRET = (process.env.WPPCONNECT_SECRET_KEY || 'prospeccao-secret-2024').trim().replace(/[\r\n\t\x00-\x1F\x7F]+/g, '');
const SESSION = (process.env.WPPCONNECT_SESSION || 'prospeccao').trim().replace(/[\r\n]+/g, '');

// Webhook URL: usa WEBHOOK_URL se definido, senão monta a partir de host/porta
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
const BACKEND_HOST = process.env.BACKEND_HOST || 'host.docker.internal';
const BACKEND_PORT = process.env.WEBHOOK_PORT || process.env.PORT || '3000';

// Debug: log sanitized values
if (typeof process !== 'undefined' && process.env) {
  const secretPreview = WPPCONNECT_SECRET ? `${WPPCONNECT_SECRET.substring(0, 4)}...` : 'EMPTY';
  console.log(`[WPPConnect] URL=${WPPCONNECT_URL} | SECRET=${secretPreview} | SESSION=${SESSION}`);
}

// Token cache — Bearer token para autenticação
let tokenCache: { token: string | null; timestamp: number | null } = { token: null, timestamp: null };

async function obterToken(): Promise<string> {
  // Token válido por 1 hora
  if (tokenCache.token && tokenCache.timestamp && Date.now() - tokenCache.timestamp < 3600000) {
    return tokenCache.token;
  }

  try {
    const response = await axios.post(
      `${WPPCONNECT_URL}/api/${SESSION}/${WPPCONNECT_SECRET}/generate-token`,
      {},
      { timeout: 10000 }
    );
    const token = response.data?.token;
    if (token) {
      tokenCache = { token, timestamp: Date.now() };
      console.log('[WPPConnect] Token gerado com sucesso');
      return token;
    }
    throw new Error('Token não retornado pelo WPPConnect');
  } catch (error: any) {
    console.error('[WPPConnect] Erro ao gerar token:', error.message);
    throw error;
  }
}

async function getApi() {
  const token = await obterToken();
  return axios.create({
    baseURL: `${WPPCONNECT_URL}/api/${SESSION}`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    timeout: 30000,
  });
}

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
    const api = await getApi();
    const response = await api.post('/send-message', {
      phone: numero,
      message: texto,
    });
    return { sucesso: true, data: response.data };
  } catch (error: any) {
    return { sucesso: false, erro: error.message };
  }
}

export async function enviarMensagemComBotoes(
  telefone: string,
  texto: string,
  botoes?: any[],
  rodape?: string
) {
  const numero = formatarTelefone(telefone);

  // Sem botões → texto puro
  if (!botoes || botoes.length === 0) {
    return await enviarMensagem(telefone, texto);
  }

  // ═══ 1) PRIMARY: Lista interativa (send-buttons é DEPRECATED no WPPConnect) ═══
  try {
    const api = await getApi();
    const response = await api.post('/send-list-message', {
      phone: numero,
      description: texto.length > 1024 ? texto.substring(0, 1020) + '...' : texto,
      buttonText: '📋 Ver opções',
      sections: [
        {
          title: 'Escolha uma opção',
          rows: botoes.map((b) => ({
            title: b.texto,
            description: b.descricao || '',
            rowId: b.id,
          })),
        },
      ],
    });
    console.log(`[WPPConnect] ✅ Lista interativa enviada para ${numero}`);
    return { sucesso: true, data: response.data, tipo: 'lista' };
  } catch (listErr: any) {
    console.log(`[WPPConnect] Lista falhou (${listErr.message}), tentando botões nativos...`);
  }

  // ═══ 2) SECONDARY: Botões nativos (deprecated, pode funcionar em algumas versões) ═══
  if (botoes.length <= 3) {
    try {
      const api = await getApi();
      const buttons = botoes.map((b) => ({
        id: b.id,
        text: b.texto,
      }));
      const response = await api.post('/send-buttons', {
        phone: numero,
        message: texto.length > 1024 ? texto.substring(0, 1020) + '...' : texto,
        footer: rodape || 'Toque em uma opção 👆',
        buttons,
      });
      console.log(`[WPPConnect] ✅ Botões nativos enviados para ${numero}`);
      return { sucesso: true, data: response.data, tipo: 'botoes' };
    } catch (btnErr: any) {
      console.log(`[WPPConnect] Botões falharam (${btnErr.message}), usando texto numerado...`);
    }
  }

  // ═══ 3) FALLBACK: Texto com opções numeradas ═══
  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
  const opcoesNumeradas = botoes
    .map((b, i) => `${emojis[i] || `${i + 1}.`} ${b.texto}`)
    .join('\n');
  const textoComOpcoes = `${texto}\n\n${opcoesNumeradas}\n\n_Responda com o número da opção desejada_`;
  console.log(`[WPPConnect] 📝 Enviando texto com opções numeradas para ${numero}`);
  return await enviarMensagem(telefone, textoComOpcoes);
}

export async function verificarConexao() {
  try {
    const api = await getApi();
    const response = await api.get('/check-connection-session');
    const status = response.data?.status;
    const conectado = status === true || status === 'CONNECTED' || response.data?.message === 'Connected';
    if (conectado) limparQRCodeCache();
    return { sucesso: true, conectado, estado: conectado ? 'open' : 'close' };
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

    // WPPConnect: start-session cria e conecta automaticamente
    try {
      const token = await obterToken();
      const response = await axios.post(
        `${WPPCONNECT_URL}/api/${SESSION}/start-session`,
        {},
        {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          timeout: 30000,
        }
      );
      console.log('[WPPConnect] Sessão iniciada:', response.data?.status || response.data?.message);
    } catch (e: any) {
      // Se sessão já existe/está ativa, OK
      if (!e.response?.data?.message?.includes('already')) {
        console.error('[WPPConnect] Erro ao iniciar sessão:', e.message);
      }
    }

    // Aguardar QR Code ser gerado
    await new Promise((r) => setTimeout(r, 3000));

    // Buscar QR Code
    try {
      const api = await getApi();
      const qrResponse = await api.get('/qrcode-session', {
        params: { image: true },
      });
      const qrBase64 = qrResponse.data?.qrcode || qrResponse.data?.base64;
      if (qrBase64 && typeof qrBase64 === 'string' && qrBase64.length > 50) {
        armazenarQRCode({ base64: qrBase64 });
        console.log('[WPPConnect] QR Code obtido via qrcode-session');
        return {
          sucesso: true,
          conectado: false,
          qrCode: qrBase64,
          aguardandoQR: true,
          mensagem: 'QR Code gerado. Escaneie com o WhatsApp.',
        };
      }
    } catch (e: any) {
      console.log('[WPPConnect] QR ainda não disponível:', e.message);
    }

    return {
      sucesso: true,
      conectado: false,
      qrCode: null,
      aguardandoQR: true,
      mensagem: 'Conexão iniciada. QR Code será gerado em instantes...',
    };
  } catch (error: any) {
    return { sucesso: false, erro: error.message };
  }
}

export async function configurarWebhook(webhookUrl?: string) {
  // WPPConnect configura webhook via config.json (já feito no Docker setup)
  // Este método existe apenas para compatibilidade
  const url = webhookUrl || `http://${BACKEND_HOST}:${BACKEND_PORT}/api/webhook/whatsapp`;
  console.log(`[WPPConnect] Webhook configurado via config.json: ${url}`);
  return { sucesso: true, url, data: { info: 'Webhook configurado via config.json do WPPConnect' } };
}

export async function autoConfigurarWebhook() {
  const webhookUrl = WEBHOOK_URL
    ? `${WEBHOOK_URL}/api/webhook/whatsapp`
    : `http://${BACKEND_HOST}:${BACKEND_PORT}/api/webhook/whatsapp`;
  console.log(`[WPPConnect] autoConfigurarWebhook URL: ${webhookUrl}`);
  return await configurarWebhook(webhookUrl);
}

export async function desconectar() {
  try {
    const api = await getApi();
    const response = await api.post('/logout-session');
    limparQRCodeCache();
    tokenCache = { token: null, timestamp: null };
    return { sucesso: true, data: response.data };
  } catch (error: any) {
    return { sucesso: false, erro: error.message };
  }
}

export async function reiniciarInstancia() {
  try {
    console.log('[WPPConnect] Reiniciando sessão — logout + close...');
    try {
      const api = await getApi();
      await api.post('/logout-session');
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const api = await getApi();
      await api.post('/close-session');
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
    limparQRCodeCache();
    tokenCache = { token: null, timestamp: null };
    console.log('[WPPConnect] Sessão reiniciada. Pronta para recriar.');
    return { sucesso: true, mensagem: 'Sessão reiniciada. Clique em Conectar para gerar novo QR.' };
  } catch (error: any) {
    return { sucesso: false, erro: error.message };
  }
}

export async function obterInfoInstancia() {
  try {
    const api = await getApi();
    const response = await api.get('/check-connection-session');
    return { sucesso: true, data: response.data || null };
  } catch (error: any) {
    return { sucesso: false, data: null, erro: error.message };
  }
}
