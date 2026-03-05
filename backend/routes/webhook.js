// ============================================
// Rotas — Webhook (recebe mensagens + QR Code da Evolution API)
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

// POST — Webhook da Evolution API (recebe mensagens, QR Code, status)
router.post('/whatsapp', async (req, res) => {
  try {
    const payload = req.body;
    const event = payload.event || '';

    // Debug: logar TODOS os eventos recebidos (para diagnóstico)
    logger.info('🔔 Webhook evento', { event, dataKeys: Object.keys(payload.data || {}).join(',') });

    // ============================================
    // QRCODE_UPDATED — QR Code recebido via webhook
    // ============================================
    if (event === 'QRCODE_UPDATED' || event === 'qrcode.updated') {
      logger.info('📱 Webhook QRCODE_UPDATED recebido');
      armazenarQRCode(payload.data || payload);
      return res.json({ status: 'qrcode_armazenado' });
    }

    // ============================================
    // CONNECTION_UPDATE — Status de conexão (com throttle)
    // ============================================
    if (event === 'CONNECTION_UPDATE' || event === 'connection.update') {
      const state = payload.data?.state || payload.data?.instance?.state || 'unknown';
      const now = Date.now();

      // Se conectou, limpar QR e logar sempre
      if (state === 'open') {
        limparQRCodeCache();
        logger.info('✅ WhatsApp conectado!', { state });
      } else if (now - lastConnectionLog > CONNECTION_LOG_INTERVAL) {
        // Outros estados: logar no máximo 1x a cada 30s
        lastConnectionLog = now;
        logger.debug('Conexão WhatsApp', { state });
      }

      return res.json({ status: 'connection_update', state });
    }

    // ============================================
    // MESSAGES_UPSERT — Mensagem recebida
    // ============================================
    // Extrair dados da mensagem (Evolution API format)
    let telefone, texto, buttonId = null;

    if (payload.data?.message) {
      // Formato Evolution API v2
      const remoteJid = payload.data.key?.remoteJid || '';

      // 🚫 Ignorar mensagens de GRUPOS (@g.us) e STATUS (@broadcast)
      if (remoteJid.endsWith('@g.us') || remoteJid.includes('@broadcast')) {
        return res.json({ status: 'ignorado', motivo: 'mensagem_de_grupo_ou_broadcast' });
      }

      telefone = remoteJid.replace('@s.whatsapp.net', '');

      // Extrair texto de diferentes tipos de mensagem
      const msg = payload.data.message;
      texto = msg.conversation ||
        msg.extendedTextMessage?.text ||
        msg.imageMessage?.caption ||
        msg.videoMessage?.caption || '';

      // 🔘 Detectar clique em BOTÃO interativo
      if (msg.buttonsResponseMessage) {
        buttonId = msg.buttonsResponseMessage.selectedButtonId || null;
        texto = msg.buttonsResponseMessage.selectedDisplayText || texto;
        logger.info('🔘 Botão clicado', { buttonId, texto: texto.substring(0, 50) });
      }

      // 📋 Detectar seleção em LISTA interativa
      if (msg.listResponseMessage) {
        buttonId = msg.listResponseMessage.singleSelectReply?.selectedRowId || null;
        texto = msg.listResponseMessage.title || texto;
        logger.info('📋 Lista selecionada', { buttonId, texto: texto.substring(0, 50) });
      }

    } else if (payload.telefone && payload.mensagem) {
      // Formato simplificado (para testes via curl)
      telefone = payload.telefone;
      texto = payload.mensagem;
      buttonId = payload.buttonId || null;
    } else {
      // Evento que não é mensagem e não é QR/connection
      return res.json({ status: 'ignorado', motivo: 'evento_nao_tratado', event });
    }

    // Ignorar mensagens do próprio bot
    if (payload.data?.key?.fromMe) {
      return res.json({ status: 'ignorado', motivo: 'mensagem_propria' });
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
      // Atendimento manual — não responde automaticamente
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
        // Enviar mensagem de "opção inválida" com botões (se disponíveis)
        if (botoesEtapa) {
          await enviarMensagemComBotoes(contato.telefone, msgInvalida, botoesEtapa, 'Escolha uma opção 👆');
        } else {
          await enviarMensagem(contato.telefone, msgInvalida);
        }
        // Registrar a tentativa
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
    updateData.tentativasSemResposta = 0; // Resetar contador pois respondeu

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
      // Criar lead no pipeline
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

      // Notificar via Telegram
      const contatoCompleto = await prisma.contato.findUnique({ where: { id: contato.id } });
      await notificarLeadQuente(contatoCompleto);
    }

    // Agendar follow-up se for msg3c
    if (resultado.proximaEtapa === 'msg3c') {
      await prisma.contato.update({
        where: { id: contato.id },
        data: { status: 'pendente_followup' }
      });
      // O follow-up será gerenciado pelo n8n (schedule node)
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
