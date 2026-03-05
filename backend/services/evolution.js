// ============================================
// WPPConnect-Server — Integração com WhatsApp
// Migrado de Evolution API → WPPConnect (definitivo)
// ============================================
const axios = require('axios');
const logger = require('./logger');

const WPPCONNECT_URL = process.env.WPPCONNECT_URL || 'http://localhost:21465';
const WPPCONNECT_SECRET = process.env.WPPCONNECT_SECRET_KEY || 'prospeccao-secret-2024';
const SESSION = process.env.WPPCONNECT_SESSION || 'prospeccao';

// URL do backend acessível pelo Docker (host.docker.internal no Windows/Mac)
const BACKEND_HOST = process.env.BACKEND_HOST || 'host.docker.internal';
const BACKEND_PORT = process.env.PORT || 3001;

// Token cache — Bearer token para autenticação
let tokenCache = { token: null, timestamp: null };

async function obterToken() {
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
      logger.info('🔑 Token WPPConnect gerado com sucesso');
      return token;
    }
    throw new Error('Token não retornado pelo WPPConnect');
  } catch (error) {
    logger.error('Erro ao gerar token WPPConnect', { erro: error.message });
    throw error;
  }
}

async function getApi() {
  const token = await obterToken();
  return axios.create({
    baseURL: `${WPPCONNECT_URL}/api/${SESSION}`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    timeout: 30000
  });
}

// ============================================
// Cache do QR Code
// ============================================
let qrCodeCache = {
  base64: null,
  pairingCode: null,
  code: null,
  timestamp: null,
  count: 0
};

/**
 * Armazena QR Code recebido via webhook ou polling
 */
function armazenarQRCode(data) {
  const base64 = data?.qrcode?.base64 || data?.base64 || data?.qrcode || null;
  qrCodeCache = {
    base64: typeof base64 === 'string' && base64.length > 20 ? base64 : null,
    pairingCode: data?.pairingCode || qrCodeCache.pairingCode,
    code: data?.code || qrCodeCache.code,
    timestamp: Date.now(),
    count: (qrCodeCache.count || 0) + 1
  };
  logger.info('📱 QR Code armazenado', {
    hasBase64: !!qrCodeCache.base64,
    base64Length: qrCodeCache.base64?.length || 0,
    count: qrCodeCache.count
  });
}

/**
 * Retorna o QR Code armazenado em cache
 */
function obterQRCodeCache() {
  if (!qrCodeCache.base64 && !qrCodeCache.pairingCode) {
    return null;
  }
  const expirado = qrCodeCache.timestamp && (Date.now() - qrCodeCache.timestamp > 60000);
  return { ...qrCodeCache, expirado: !!expirado };
}

/**
 * Limpar cache do QR Code
 */
function limparQRCodeCache() {
  qrCodeCache = { base64: null, pairingCode: null, code: null, timestamp: null, count: 0 };
}

/**
 * Envia mensagem de texto via WPPConnect
 */
async function enviarMensagem(telefone, texto) {
  try {
    const numero = formatarTelefone(telefone);
    const api = await getApi();

    const response = await api.post('/send-message', {
      phone: numero,
      message: texto
    });

    logger.info('Mensagem enviada com sucesso', { telefone: numero });
    return { sucesso: true, data: response.data };
  } catch (error) {
    logger.error('Erro ao enviar mensagem', {
      telefone,
      erro: error.response?.data || error.message
    });
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Iniciar conexão do WhatsApp (gera QR Code)
 */
async function iniciarConexao() {
  try {
    const status = await verificarConexao();
    if (status.conectado) {
      return { sucesso: true, conectado: true, mensagem: 'Já conectado' };
    }

    limparQRCodeCache();

    // WPPConnect: start-session cria e conecta automaticamente
    try {
      const token = await obterToken();
      await axios.post(
        `${WPPCONNECT_URL}/api/${SESSION}/start-session`,
        {},
        {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );
      logger.info('Sessão WPPConnect iniciada');
    } catch (e) {
      if (!e.response?.data?.message?.includes('already')) {
        logger.error('Erro ao iniciar sessão', { erro: e.message });
      }
    }

    // Aguardar QR Code ser gerado
    await new Promise(r => setTimeout(r, 3000));

    // Buscar QR Code
    try {
      const api = await getApi();
      const qrResponse = await api.get('/qrcode-session', { params: { image: true } });
      const qrBase64 = qrResponse.data?.qrcode || qrResponse.data?.base64;
      if (qrBase64 && typeof qrBase64 === 'string' && qrBase64.length > 50) {
        armazenarQRCode({ base64: qrBase64 });
        logger.info('QR Code obtido via qrcode-session');
        return {
          sucesso: true,
          conectado: false,
          qrCode: qrBase64,
          aguardandoQR: true,
          mensagem: 'QR Code gerado. Escaneie com o WhatsApp.'
        };
      }
    } catch (e) {
      logger.debug('QR ainda não disponível', { erro: e.message });
    }

    return {
      sucesso: true,
      conectado: false,
      aguardandoQR: true,
      mensagem: 'Conexão iniciada. QR Code será gerado em instantes...'
    };
  } catch (error) {
    logger.error('Erro ao iniciar conexão', { erro: error.message });
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Obter QR Code — chama iniciarConexao (mantida para compatibilidade)
 */
async function obterQRCode() {
  return iniciarConexao();
}

/**
 * Verificar status da conexão
 */
async function verificarConexao() {
  try {
    const api = await getApi();
    const response = await api.get('/check-connection-session');
    const status = response.data?.status;
    const conectado = status === true || status === 'CONNECTED' || response.data?.message === 'Connected';

    if (conectado) {
      limparQRCodeCache();
    }

    return {
      sucesso: true,
      conectado,
      estado: conectado ? 'open' : 'close'
    };
  } catch (error) {
    return { sucesso: false, conectado: false, estado: 'error' };
  }
}

/**
 * Configurar webhook — WPPConnect usa config.json, método mantido para compatibilidade
 */
async function configurarWebhook(webhookUrl) {
  const url = webhookUrl || `http://${BACKEND_HOST}:${BACKEND_PORT}/api/webhook/whatsapp`;
  logger.info('Webhook configurado via config.json', { url });
  return { sucesso: true, data: { info: 'Webhook configurado via config.json do WPPConnect' }, url };
}

/**
 * Configurar webhook automaticamente
 */
async function autoConfigurarWebhook() {
  try {
    const webhookUrl = `http://${BACKEND_HOST}:${BACKEND_PORT}/api/webhook/whatsapp`;
    const resultado = await configurarWebhook(webhookUrl);
    if (resultado.sucesso) {
      logger.info('✅ Webhook auto-configurado', { url: webhookUrl });
    }
    return resultado;
  } catch (error) {
    logger.warn('⚠️ Falha ao auto-configurar webhook', { erro: error.message });
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Desconectar WhatsApp (logout)
 */
async function desconectar() {
  try {
    const api = await getApi();
    const response = await api.post('/logout-session');
    limparQRCodeCache();
    tokenCache = { token: null, timestamp: null };
    logger.info('WhatsApp desconectado');
    return { sucesso: true, data: response.data };
  } catch (error) {
    logger.error('Erro ao desconectar', { erro: error.message });
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Reiniciar sessão — logout + close
 */
async function reiniciarInstancia() {
  try {
    try {
      const api = await getApi();
      await api.post('/logout-session');
    } catch (e) {}
    await new Promise(r => setTimeout(r, 2000));

    try {
      const api = await getApi();
      await api.post('/close-session');
    } catch (e) {}
    await new Promise(r => setTimeout(r, 2000));

    limparQRCodeCache();
    tokenCache = { token: null, timestamp: null };
    logger.info('Sessão reiniciada (fechada). Use "Conectar" para recriar.');
    return { sucesso: true };
  } catch (error) {
    logger.error('Erro ao reiniciar sessão', { erro: error.message });
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Obter informações da sessão
 */
async function obterInfoInstancia() {
  try {
    const api = await getApi();
    const response = await api.get('/check-connection-session');
    return { sucesso: true, data: response.data || null };
  } catch (error) {
    return { sucesso: false, data: null, erro: error.message };
  }
}

/**
 * Formatar telefone para padrão brasileiro
 */
function formatarTelefone(telefone) {
  let num = telefone.replace(/\D/g, '');
  if (!num.startsWith('55')) {
    num = '55' + num;
  }
  return num;
}

/**
 * Envia mensagem com botões interativos via WPPConnect
 * WPPConnect suporta botões nativos! 🎉
 * Tenta botões → lista → texto puro (fallback)
 */
async function enviarMensagemComBotoes(telefone, texto, botoes, rodape) {
  const numero = formatarTelefone(telefone);

  // Sem botões → texto puro
  if (!botoes || botoes.length === 0) {
    return await enviarMensagem(telefone, texto);
  }

  // 1) PRIMARY: Lista interativa (send-buttons é DEPRECATED no WPPConnect)
  try {
    const api = await getApi();
    const response = await api.post('/send-list-message', {
      phone: numero,
      description: texto.length > 1024 ? texto.substring(0, 1020) + '...' : texto,
      buttonText: '📋 Ver opções',
      sections: [{
        title: 'Escolha uma opção',
        rows: botoes.map(b => ({
          title: b.texto,
          description: b.descricao || '',
          rowId: b.id
        }))
      }]
    });
    logger.info('✅ Lista interativa enviada', { telefone: numero });
    return { sucesso: true, data: response.data, tipo: 'lista' };
  } catch (listErr) {
    logger.debug('Lista falhou, tentando botões nativos...', {
      erro: listErr.response?.status || listErr.message
    });
  }

  // 2) SECONDARY: Botões nativos (deprecated, pode funcionar em algumas versões)
  if (botoes.length <= 3) {
    try {
      const api = await getApi();
      const buttons = botoes.map(b => ({
        id: b.id,
        text: b.texto
      }));
      const response = await api.post('/send-buttons', {
        phone: numero,
        message: texto.length > 1024 ? texto.substring(0, 1020) + '...' : texto,
        footer: rodape || 'Toque em uma opção 👆',
        buttons
      });
      logger.info('✅ Botões nativos enviados', { telefone: numero });
      return { sucesso: true, data: response.data, tipo: 'botoes' };
    } catch (btnErr) {
      logger.debug('Botões falharam, usando texto numerado...', {
        erro: btnErr.response?.status || btnErr.message
      });
    }
  }

  // 3) FALLBACK: Texto com opções numeradas
  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
  const opcoesNumeradas = botoes
    .map((b, i) => `${emojis[i] || `${i + 1}.`} ${b.texto}`)
    .join('\n');
  const textoComOpcoes = `${texto}\n\n${opcoesNumeradas}\n\n_Responda com o número da opção desejada_`;
  logger.info('📝 Enviando texto com opções numeradas (fallback)', { telefone: numero });
  return await enviarMensagem(telefone, textoComOpcoes);
}

module.exports = {
  enviarMensagem,
  enviarMensagemComBotoes,
  obterQRCode,
  iniciarConexao,
  verificarConexao,
  configurarWebhook,
  autoConfigurarWebhook,
  obterInfoInstancia,
  desconectar,
  reiniciarInstancia,
  formatarTelefone,
  armazenarQRCode,
  obterQRCodeCache,
  limparQRCodeCache
};
