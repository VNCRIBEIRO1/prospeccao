// ============================================
// Notificações — Telegram + In-app
// ============================================
const axios = require('axios');
const logger = require('./logger');

/**
 * Enviar notificação de lead quente via Telegram
 */
async function notificarLeadQuente(contato) {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!telegramToken || !chatId) {
    logger.warn('Telegram não configurado — notificação de lead não enviada');
    return { sucesso: false, motivo: 'telegram_nao_configurado' };
  }

  const mensagem = `🔥 *LEAD QUENTE!*

📋 *Escritório:* ${contato.escritorio || 'Não informado'}
👤 *Contato:* ${contato.nome}
📱 *Telefone:* ${contato.telefone}
📍 *Cidade:* ${contato.cidade || 'Não informada'}
⚖️ *Área:* ${contato.areaAtuacao || 'Não informada'}
🕐 *Quando:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}

👉 O lead quer contratar! Entre em contato AGORA.
📲 wa.me/${contato.telefone.replace(/\D/g, '')}`;

  try {
    await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      chat_id: chatId,
      text: mensagem,
      parse_mode: 'Markdown',
      disable_web_page_preview: false
    });

    logger.info('Notificação Telegram enviada', { contato: contato.nome });
    return { sucesso: true };
  } catch (error) {
    logger.error('Erro ao enviar notificação Telegram', { erro: error.message });
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Enviar notificação genérica via Telegram
 */
async function notificarTelegram(mensagem) {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!telegramToken || !chatId) return { sucesso: false };

  try {
    await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      chat_id: chatId,
      text: mensagem,
      parse_mode: 'Markdown'
    });
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
}

module.exports = { notificarLeadQuente, notificarTelegram };
