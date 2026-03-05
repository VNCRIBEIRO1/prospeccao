// ============================================
// Rotas — Webhook (recebe mensagens do WPPConnect-Server)
// ============================================
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { detectarResposta } = require('../services/detector');
const { enviarMensagemBot } = require('../services/disparos');
const { notificarLeadQuente } = require('../services/notificacoes');
const { armazenarQRCode, limparQRCodeCache, enviarMensagem, enviarMensagemComBotoes } = require('../services/evolution');
const { gerarMensagemOpcaoInvalida, BOTOES } = require('../services/mensagens');
const logger = require('../services/logger');

// Throttle para CONNECTION_UPDATE (evita flood de logs)
let lastConnectionLog = 0;
const CONNECTION_LOG_INTERVAL = 30000; // Log a cada 30s no máximo

// POST — Webhook do WPPConnect-Server (recebe mensagens, QR Code, status)
router.post('/whatsapp', async (req, res) => {
  try {
    const payload = req.body;

    // Debug: logar eventos recebidos
    logger.info('🔔 Webhook evento', { event: payload.event || 'onMessage', type: payload.type || 'unknown' });

    // ============================================
    // Status de conexão (WPPConnect status-find)
    // ============================================
    if (payload.event === 'status-find' || (payload.status && !payload.from)) {
      const state = payload.status || payload.state || 'unknown';
      const now = Date.now();

      if (state === 'CONNECTED' || state === 'isLogged') {
        limparQRCodeCache();
        logger.info('✅ WhatsApp conectado!', { state });
      } else if (now - lastConnectionLog > CONNECTION_LOG_INTERVAL) {
        lastConnectionLog = now;
        logger.debug('Conexão WhatsApp', { state });
      }

      return res.json({ status: 'connection_update', state });
    }

    // ============================================
    // QR Code (WPPConnect qrcode event)
    // ============================================
    if (payload.event === 'qrcode' || payload.qrcode) {
      logger.info('📱 Webhook QR Code recebido');
      armazenarQRCode(payload);
      return res.json({ status: 'qrcode_armazenado' });
    }

    // ============================================
    // onMessage — Mensagem recebida (WPPConnect format)
    // Formato: { from, body, type, fromMe, chatId, ... }
    // ============================================
    let telefone, texto, buttonId = null;

    if (payload.from || payload.chatId) {
      // Formato WPPConnect
      const from = payload.from || payload.chatId || '';

      // 🚫 Ignorar mensagens de GRUPOS (@g.us) e STATUS (@broadcast)
      if (from.endsWith('@g.us') || from.includes('broadcast') || from.includes('status')) {
        return res.json({ status: 'ignorado', motivo: 'mensagem_de_grupo_ou_broadcast' });
      }

      // Ignorar mensagens do próprio bot
      if (payload.fromMe === true) {
        return res.json({ status: 'ignorado', motivo: 'mensagem_propria' });
      }

      // Extrair telefone (5518996311933@c.us → 5518996311933)
      telefone = from.replace('@c.us', '').replace('@s.whatsapp.net', '');

      // Extrair texto
      texto = payload.body || payload.content || payload.caption || '';

      // 🔘 Detectar clique em BOTÃO interativo (WPPConnect)
      if (payload.type === 'buttons_response') {
        buttonId = payload.selectedButtonId || payload.buttonId || null;
        texto = payload.selectedDisplayText || payload.body || texto;
        logger.info('🔘 Botão clicado', { buttonId, texto: texto.substring(0, 50) });
      }

      // 📋 Detectar seleção em LISTA interativa (WPPConnect)
      if (payload.type === 'list_response') {
        buttonId = payload.listResponse?.singleSelectReply?.selectedRowId || payload.selectedRowId || null;
        texto = payload.listResponse?.title || payload.body || texto;
        logger.info('📋 Lista selecionada', { buttonId, texto: texto.substring(0, 50) });
      }

    } else if (payload.telefone && payload.mensagem) {
      // Formato simplificado (para testes via curl)
      telefone = payload.telefone;
      texto = payload.mensagem;
      buttonId = payload.buttonId || null;
    } else {
      // Evento que não é mensagem e não é QR/connection
      return res.json({ status: 'ignorado', motivo: 'evento_nao_tratado', event: payload.event || 'unknown' });
    }

    // Ignorar se não tem texto
    if (!texto || !telefone) {
      return res.json({ status: 'ignorado', motivo: 'sem_texto_ou_telefone' });
    }

    // Limpar telefone
    telefone = telefone.replace(/\D/g, '');

    // Validar formato do telefone (mín 10, máx 15 dígitos — padrão brasileiro)
    if (telefone.length < 10 || telefone.length > 15) {
      logger.warn('Telefone com formato inválido, ignorando', { telefone, tamanho: telefone.length });
      return res.json({ status: 'ignorado', motivo: 'telefone_invalido' });
    }

    logger.info('Mensagem recebida', { telefone, texto: texto.substring(0, 50) });

    // Buscar contato
    let contato = await prisma.contato.findFirst({
      where: {
        OR: [
          { telefone },
          { telefone: { endsWith: telefone.slice(-8) } }
        ]
      }
    });

    // Se não encontrou, criar contato novo
    if (!contato) {
      contato = await prisma.contato.create({
        data: {
          nome: 'Resposta Espontânea',
          telefone,
          status: 'respondeu',
          etapaBot: 'msg1'
        }
      });
      logger.info('Novo contato criado a partir de resposta', { telefone });
    }

    // Registrar mensagem recebida
    await prisma.mensagem.create({
      data: {
        contatoId: contato.id,
        direcao: 'recebida',
        conteudo: texto,
        etapa: contato.etapaBot
      }
    });

    // Detectar resposta e próxima ação
    const resultado = detectarResposta(texto, contato.etapaBot, buttonId);

    if (!resultado.proximaEtapa || resultado.acao === 'manual') {
      logger.info('Conversa encaminhada para atendimento manual', { contatoId: contato.id });
      return res.json({
        status: 'manual',
        contato: contato.id,
        etapaAtual: contato.etapaBot
      });
    }

    if (resultado.acao === 'bloquear') {
      await prisma.contato.update({
        where: { id: contato.id },
        data: { status: 'naoInteresse', etapaBot: 'bloqueado' }
      });
      return res.json({ status: 'bloqueado', contato: contato.id });
    }

    // ============================================
    // REENVIAR OPÇÕES — resposta não reconhecida
    // ============================================
    if (resultado.acao === 'reenviar_opcoes') {
      const msgInvalida = gerarMensagemOpcaoInvalida(contato.etapaBot);
      if (msgInvalida) {
        const botoesEtapa = BOTOES[contato.etapaBot] || null;
        // Enviar mensagem de "opção inválida" com botões (WPPConnect suporta!)
        if (botoesEtapa) {
          await enviarMensagemComBotoes(contato.telefone, msgInvalida, botoesEtapa, 'Escolha uma opção 👆');
        } else {
          await enviarMensagem(contato.telefone, msgInvalida);
        }
        await prisma.mensagem.create({
          data: {
            contatoId: contato.id,
            direcao: 'enviada',
            conteudo: '[Opção inválida - opções reenviadas]',
            etapa: contato.etapaBot
          }
        });
      }
      return res.json({
        status: 'opcao_invalida',
        contato: contato.id,
        etapaAtual: contato.etapaBot,
        mensagem: 'Resposta não reconhecida, opções reenviadas'
      });
    }

    // Atualizar status e etapa do contato
    const updateData = { etapaBot: resultado.proximaEtapa };
    if (resultado.novoStatus) updateData.status = resultado.novoStatus;
    updateData.tentativasSemResposta = 0;

    await prisma.contato.update({
      where: { id: contato.id },
      data: updateData
    });

    // Enviar próxima mensagem do bot
    const etapaMensagem = resultado.proximaEtapa === 'msg3b_repeat' ? 'msg3b' : resultado.proximaEtapa;

    if (etapaMensagem !== 'atendimento_manual' && etapaMensagem !== 'bloqueado') {
      await enviarMensagemBot(contato.id, etapaMensagem);
    }

    // Se é lead quente — notificar + criar lead
    if (resultado.acao === 'enviar_msg3a_notificar') {
      const leadExistente = await prisma.lead.findFirst({
        where: { contatoId: contato.id }
      });

      if (!leadExistente) {
        await prisma.lead.create({
          data: {
            contatoId: contato.id,
            estagio: 'interessado',
            notas: `Lead quente detectado automaticamente em ${new Date().toLocaleString('pt-BR')}`
          }
        });
      } else {
        await prisma.lead.update({
          where: { id: leadExistente.id },
          data: { estagio: 'interessado' }
        });
      }

      const contatoCompleto = await prisma.contato.findUnique({ where: { id: contato.id } });
      await notificarLeadQuente(contatoCompleto);
    }

    // Agendar follow-up se for msg3c
    if (resultado.proximaEtapa === 'msg3c') {
      await prisma.contato.update({
        where: { id: contato.id },
        data: { status: 'pendente_followup' }
      });
    }

    res.json({
      status: 'processado',
      contato: contato.id,
      etapaAnterior: contato.etapaBot,
      proximaEtapa: resultado.proximaEtapa,
      acao: resultado.acao
    });

  } catch (error) {
    logger.error('Erro no webhook', { erro: error.message, stack: error.stack });
    res.status(500).json({ error: error.message });
  }
});

// POST — Webhook para testes manuais
router.post('/test', async (req, res) => {
  const { telefone, mensagem, etapaAtual } = req.body;
  if (!telefone || !mensagem) {
    return res.status(400).json({ error: 'telefone e mensagem são obrigatórios' });
  }

  // Buscar contato existente para pegar a etapa real
  const contato = await prisma.contato.findFirst({
    where: { telefone: { contains: telefone.replace(/\D/g, '').slice(-8) } }
  });

  const etapa = etapaAtual || contato?.etapaBot || 'msg1';
  const resultado = detectarResposta(mensagem, etapa);

  res.json({
    input: { telefone, mensagem, etapaUsada: etapa },
    resultado,
    contatoEncontrado: contato ? { id: contato.id, nome: contato.nome, etapaBot: contato.etapaBot } : null,
    info: 'Teste processado (sem envio real)'
  });
});

module.exports = router;
