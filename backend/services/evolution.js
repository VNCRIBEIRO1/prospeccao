// ============================================
// Evolution API — Integração com WhatsApp
// Evolution API v2: QR Code é entregue via webhook QRCODE_UPDATED
// ============================================
const axios = require('axios');
const logger = require('./logger');

const EVOLUTION_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY || 'minha-chave-secreta';
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'prospeccao';

// URL do backend acessível pelo Docker (host.docker.internal no Windows/Mac)
const BACKEND_HOST = process.env.BACKEND_HOST || 'host.docker.internal';
const BACKEND_PORT = process.env.PORT || 3001;

const api = axios.create({
  baseURL: EVOLUTION_URL,
  headers: {
    'Content-Type': 'application/json',
    'apikey': EVOLUTION_KEY
  },
  timeout: 30000
});

// ============================================
// Cache do QR Code (recebido via webhook)
// ============================================
let qrCodeCache = {
  base64: null,
  pairingCode: null,
  code: null,
  timestamp: null,
  count: 0
};

/**
 * Armazena QR Code recebido via webhook (QRCODE_UPDATED)
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
  logger.info('📱 QR Code armazenado via webhook', {
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
  // QR Code expira em 60 segundos
  const expirado = qrCodeCache.timestamp && (Date.now() - qrCodeCache.timestamp > 60000);
  return { ...qrCodeCache, expirado: !!expirado };
}

/**
 * Limpar cache do QR Code (quando conectou ou desconectou)
 */
function limparQRCodeCache() {
  qrCodeCache = { base64: null, pairingCode: null, code: null, timestamp: null, count: 0 };
}

/**
 * Envia mensagem de texto via Evolution API
 */
async function enviarMensagem(telefone, texto) {
  try {
    const numero = formatarTelefone(telefone);

    const response = await api.post(`/message/sendText/${INSTANCE}`, {
      number: numero,
      text: texto
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
 * Iniciar conexão do WhatsApp (gera QR Code via webhook)
 * Evolution API v2: o QR Code é enviado via webhook QRCODE_UPDATED
 * O endpoint /instance/connect retorna pairingCode (código numérico)
 */
async function iniciarConexao() {
  try {
    // Verificar se já conectado
    const status = await verificarConexao();
    if (status.conectado) {
      return { sucesso: true, conectado: true, mensagem: 'Já conectado' };
    }

    // Limpar QR Code antigo
    limparQRCodeCache();

    // Verificar se instância existe
    let instanciaExiste = false;
    try {
      const instances = await api.get('/instance/fetchInstances');
      instanciaExiste = instances.data?.some(i =>
        i.name === INSTANCE || i.instance?.instanceName === INSTANCE
      );
    } catch (e) {
      logger.debug('Erro ao buscar instâncias', { erro: e.message });
    }

    // Se a instância está presa em "connecting", fazer logout para resetar
    if (instanciaExiste) {
      try {
        const state = await api.get(`/instance/connectionState/${INSTANCE}`);
        const currentState = state.data?.instance?.state || state.data?.state;
        if (currentState === 'connecting') {
          logger.info('Instância presa em connecting, fazendo logout para resetar...');
          try { await api.delete(`/instance/logout/${INSTANCE}`); } catch (e) {}
          await new Promise(r => setTimeout(r, 3000));
        }
      } catch (e) {}
    }

    // Se instância não existe, criar
    if (!instanciaExiste) {
      try {
        const createResponse = await api.post('/instance/create', {
          instanceName: INSTANCE,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        });
        logger.info('Instância criada', { instance: INSTANCE });

        // Se create retornou QR Code, armazenar
        const qrFromCreate = createResponse.data?.qrcode?.base64 || createResponse.data?.base64;
        if (qrFromCreate && qrFromCreate.length > 20) {
          armazenarQRCode({ base64: qrFromCreate });
        }

        // Aguardar um pouco para instância inicializar
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        // 403 = instância já existe, OK
        if (e.response?.status !== 403) {
          logger.error('Erro ao criar instância', { erro: e.message });
        }
      }
    }

    // Configurar webhook ANTES de conectar (para receber QRCODE_UPDATED)
    await autoConfigurarWebhook();
    await new Promise(r => setTimeout(r, 1000));

    // Conectar instância — retorna pairingCode (não QR base64)
    // O QR Code base64 será enviado via webhook QRCODE_UPDATED
    try {
      const response = await api.get(`/instance/connect/${INSTANCE}`);
      const pairingCode = response.data?.pairingCode;
      const code = response.data?.code;
      const count = response.data?.count || 0;

      if (pairingCode) {
        qrCodeCache.pairingCode = pairingCode;
        qrCodeCache.code = code;
        qrCodeCache.timestamp = Date.now();
        logger.info('Pairing code obtido', { pairingCode, count });
      }

      return {
        sucesso: true,
        conectado: false,
        pairingCode: pairingCode || null,
        aguardandoQR: true,
        mensagem: 'Conexão iniciada. QR Code será gerado em instantes via webhook...'
      };
    } catch (e) {
      logger.error('Erro ao conectar instância', { erro: e.message });
      return { sucesso: false, erro: e.message };
    }
  } catch (error) {
    logger.error('Erro ao iniciar conexão', {
      erro: error.message,
      response: error.response?.data
    });
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
    const response = await api.get(`/instance/connectionState/${INSTANCE}`);
    const state = response.data?.instance?.state || response.data?.state || 'unknown';
    const conectado = state === 'open';

    // Se conectou, limpar cache do QR
    if (conectado) {
      limparQRCodeCache();
    }

    return {
      sucesso: true,
      conectado,
      estado: state
    };
  } catch (error) {
    return { sucesso: false, conectado: false, estado: 'error' };
  }
}

/**
 * Configurar webhook para receber mensagens E QR Code
 * Usa host.docker.internal para que o Evolution API (Docker) alcance o backend (host)
 * IMPORTANTE: base64 = true para receber QR Code como base64 no webhook
 * (Evolution API usa 'base64' e NÃO 'webhook_base64' no payload)
 */
async function configurarWebhook(webhookUrl) {
  try {
    const url = webhookUrl || `http://${BACKEND_HOST}:${BACKEND_PORT}/api/webhook/whatsapp`;

    const response = await api.post(`/webhook/set/${INSTANCE}`, {
      webhook: {
        enabled: true,
        url,
        webhook_by_events: false,
        base64: true,
        events: [
          'QRCODE_UPDATED',
          'CONNECTION_UPDATE',
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE'
        ]
      }
    });
    logger.info('Webhook configurado', { url });
    return { sucesso: true, data: response.data, url };
  } catch (error) {
    logger.error('Erro ao configurar webhook', {
      erro: error.message,
      response: error.response?.data
    });
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Configurar webhook automaticamente (chamado no startup e antes de connect)
 */
async function autoConfigurarWebhook() {
  try {
    const webhookUrl = `http://${BACKEND_HOST}:${BACKEND_PORT}/api/webhook/whatsapp`;
    const resultado = await configurarWebhook(webhookUrl);
    if (resultado.sucesso) {
      logger.info('✅ Webhook auto-configurado com sucesso', { url: webhookUrl });
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
    const response = await api.delete(`/instance/logout/${INSTANCE}`);
    limparQRCodeCache();
    logger.info('WhatsApp desconectado');
    return { sucesso: true, data: response.data };
  } catch (error) {
    logger.error('Erro ao desconectar', { erro: error.message });
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Reiniciar instância — deleta e recria do zero
 */
async function reiniciarInstancia() {
  try {
    try { await api.delete(`/instance/logout/${INSTANCE}`); } catch (e) {}
    await new Promise(r => setTimeout(r, 2000));

    try { await api.delete(`/instance/delete/${INSTANCE}`); } catch (e) {}
    await new Promise(r => setTimeout(r, 2000));

    limparQRCodeCache();
    logger.info('Instância reiniciada (deletada). Use "Conectar" para recriar.');
    return { sucesso: true };
  } catch (error) {
    logger.error('Erro ao reiniciar instância', { erro: error.message });
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Obter informações da instância
 */
async function obterInfoInstancia() {
  try {
    const response = await api.get(`/instance/fetchInstances`);
    const instancia = response.data?.find(i =>
      i.name === INSTANCE || i.instance?.instanceName === INSTANCE
    );
    return { sucesso: true, data: instancia || null };
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
 * Envia mensagem com botões interativos via Evolution API
 * Tenta botões → lista → texto puro (fallback)
 */
async function enviarMensagemComBotoes(telefone, texto, botoes, rodape) {
  const numero = formatarTelefone(telefone);

  // 1) Tentar enviar como BOTÕES (max 3 botões)
  if (botoes && botoes.length <= 3) {
    try {
      const response = await api.post(`/message/sendButtons/${INSTANCE}`, {
        number: numero,
        title: '',
        description: texto.length > 1024 ? texto.substring(0, 1020) + '...' : texto,
        footer: rodape || 'Toque em uma opção 👆',
        buttons: botoes.map(b => ({
          type: 'reply',
          displayText: b.texto,
          id: b.id
        }))
      });
      logger.info('✅ Mensagem com BOTÕES enviada', { telefone: numero });
      return { sucesso: true, data: response.data, tipo: 'botoes' };
    } catch (btnErr) {
      logger.debug('Botões não suportados, tentando lista...', {
        erro: btnErr.response?.status || btnErr.message
      });
    }
  }

  // 2) Tentar enviar como LISTA interativa
  if (botoes && botoes.length > 0) {
    try {
      const response = await api.post(`/message/sendList/${INSTANCE}`, {
        number: numero,
        title: 'Escolha uma opção',
        description: texto.length > 1024 ? texto.substring(0, 1020) + '...' : texto,
        footerText: rodape || 'Toque para ver opções 👆',
        buttonText: '📋 Ver opções',
        sections: [{
          title: 'Opções disponíveis',
          rows: botoes.map(b => ({
            title: b.texto,
            description: b.descricao || '',
            rowId: b.id
          }))
        }]
      });
      logger.info('✅ Mensagem com LISTA enviada', { telefone: numero });
      return { sucesso: true, data: response.data, tipo: 'lista' };
    } catch (listErr) {
      logger.debug('Lista não suportada, enviando texto puro...', {
        erro: listErr.response?.status || listErr.message
      });
    }
  }

  // 3) Fallback: texto puro (sempre funciona)
  logger.info('Enviando como texto puro (fallback)', { telefone: numero });
  return await enviarMensagem(telefone, texto);
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
