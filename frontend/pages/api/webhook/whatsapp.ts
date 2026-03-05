// POST /api/webhook/whatsapp — Webhook receiver from WPPConnect-Server
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { detectarResposta } from '../../../lib/detector';
import { enviarMensagem, enviarMensagemComBotoes, armazenarQRCode, limparQRCodeCache } from '../../../lib/evolution';
import { MENSAGENS, BOTOES, gerarMensagemOpcaoInvalida } from '../../../lib/mensagens';
import axios from 'axios';

async function enviarMensagemBot(contatoId: number, etapa: string) {
  const mensagem = MENSAGENS[etapa];
  if (!mensagem) return { sucesso: false, erro: 'etapa_invalida' };

  const contato = await prisma.contato.findUnique({ where: { id: contatoId } });
  if (!contato) return { sucesso: false, erro: 'contato_nao_encontrado' };

  // WPPConnect suporta botões nativos! Enviar com botões quando disponíveis
  const botoesEtapa = BOTOES[etapa] || null;
  let resultado;
  if (botoesEtapa && botoesEtapa.length > 0) {
    resultado = await enviarMensagemComBotoes(contato.telefone, mensagem, botoesEtapa, 'Escolha uma opção 👆');
  } else {
    resultado = await enviarMensagem(contato.telefone, mensagem);
  }

  if (resultado.sucesso) {
    await prisma.mensagem.create({
      data: { contatoId, direcao: 'enviada', conteudo: mensagem.substring(0, 500), etapa },
    });
  }
  return resultado;
}

async function notificarLeadQuente(contato: any) {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!telegramToken || !chatId) return;

  const msg = `🔥 *LEAD QUENTE!*\n\n📋 *Escritório:* ${contato.escritorio || 'Não informado'}\n👤 *Contato:* ${contato.nome}\n📱 *Telefone:* ${contato.telefone}\n📍 *Cidade:* ${contato.cidade || 'Não informada'}\n⚖️ *Área:* ${contato.areaAtuacao || 'Não informada'}\n🕐 *Quando:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n\n👉 O lead quer contratar! Entre em contato AGORA.\n📲 wa.me/${contato.telefone.replace(/\D/g, '')}`;

  try {
    await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      chat_id: chatId,
      text: msg,
      parse_mode: 'Markdown',
    });
  } catch {}
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const payload = req.body;

    // ============================================
    // WPPConnect envia eventos com diferentes estruturas
    // Detectar tipo de evento pelo payload
    // ============================================

    // Evento de status de conexão (onStateChange)
    if (payload.event === 'status-find' || payload.status) {
      const state = payload.status || payload.state || 'unknown';
      if (state === 'CONNECTED' || state === 'isLogged') {
        limparQRCodeCache();
      }
      return res.json({ status: 'connection_update', state });
    }

    // Evento de QR Code
    if (payload.event === 'qrcode' || payload.qrcode) {
      armazenarQRCode(payload);
      return res.json({ status: 'qrcode_armazenado' });
    }

    // ============================================
    // WPPConnect onMessage — Mensagem recebida
    // Formato: { event: 'onMessage', session: '...', ...messageFields }
    // Ou diretamente: { from, body, type, ... }
    // ============================================
    let telefone: string = '';
    let texto: string = '';
    let buttonId: string | null = null;

    // WPPConnect message format
    if (payload.from || payload.chatId || (payload.event === 'onMessage')) {
      const from = payload.from || payload.chatId || '';

      // Ignorar grupos e broadcast
      if (from.endsWith('@g.us') || from.includes('broadcast') || from.includes('status')) {
        return res.json({ status: 'ignorado', motivo: 'mensagem_de_grupo_ou_broadcast' });
      }

      // Ignorar mensagens do próprio bot
      if (payload.fromMe === true) {
        return res.json({ status: 'ignorado', motivo: 'mensagem_propria' });
      }

      // Extrair telefone do formato WPPConnect (5518996311933@c.us → 5518996311933)
      telefone = from.replace('@c.us', '').replace('@s.whatsapp.net', '');

      // Extrair texto da mensagem
      texto = payload.body || payload.content || payload.caption || '';

      // WPPConnect: Respostas de botões interativos
      if (payload.type === 'buttons_response') {
        buttonId = payload.selectedButtonId || payload.buttonId || null;
        texto = payload.selectedDisplayText || payload.body || texto;
        console.log(`[Webhook] 🔘 Botão WPPConnect: buttonId=${buttonId} texto="${texto}"`);
      }

      // WPPConnect: Respostas de lista interativa
      if (payload.type === 'list_response') {
        buttonId = payload.listResponse?.singleSelectReply?.selectedRowId || payload.selectedRowId || null;
        texto = payload.listResponse?.title || payload.body || texto;
        console.log(`[Webhook] 📋 Lista WPPConnect: buttonId=${buttonId} texto="${texto}"`);
      }

      // Fallback: tipo de mensagem com ID de botão diretamente
      if (!buttonId && payload.quotedMsgId && payload.selectedButtonId) {
        buttonId = payload.selectedButtonId;
      }

      console.log(`[Webhook] Parse: tel=${telefone} | texto="${texto?.substring(0,50)}" | buttonId=${buttonId} | type=${payload.type}`);

    } else if (payload.telefone && payload.mensagem) {
      // Formato simplificado (para testes via curl)
      telefone = payload.telefone;
      texto = payload.mensagem;
      buttonId = payload.buttonId || null;
    } else {
      return res.json({ status: 'ignorado', motivo: 'evento_nao_tratado', event: payload.event || 'unknown' });
    }

    if (!texto || !telefone) return res.json({ status: 'ignorado', motivo: 'sem_texto_ou_telefone' });

    telefone = telefone.replace(/\D/g, '');
    if (telefone.length < 10 || telefone.length > 15) {
      return res.json({ status: 'ignorado', motivo: 'telefone_invalido' });
    }

    // Find or create contact
    let contato = await prisma.contato.findFirst({
      where: { OR: [{ telefone }, { telefone: { endsWith: telefone.slice(-8) } }] },
    });

    if (!contato) {
      contato = await prisma.contato.create({
        data: { nome: 'Resposta Espontânea', telefone, status: 'respondeu', etapaBot: 'msg1' },
      });
    }

    await prisma.mensagem.create({
      data: { contatoId: contato.id, direcao: 'recebida', conteudo: texto, etapa: contato.etapaBot },
    });

    const resultado = detectarResposta(texto, contato.etapaBot, buttonId);

    if (!resultado.proximaEtapa || resultado.acao === 'manual') {
      return res.json({ status: 'manual', contato: contato.id, etapaAtual: contato.etapaBot });
    }

    if (resultado.acao === 'bloquear') {
      await prisma.contato.update({ where: { id: contato.id }, data: { status: 'naoInteresse', etapaBot: 'bloqueado' } });
      return res.json({ status: 'bloqueado', contato: contato.id });
    }

    if (resultado.acao === 'reenviar_opcoes') {
      const msgInvalida = gerarMensagemOpcaoInvalida(contato.etapaBot);
      if (msgInvalida) {
        // Re-enviar com botões interativos (WPPConnect suporta!)
        const botoesEtapa = BOTOES[contato.etapaBot] || null;
        if (botoesEtapa) {
          await enviarMensagemComBotoes(contato.telefone, msgInvalida, botoesEtapa, 'Escolha uma opção 👆');
        } else {
          await enviarMensagem(contato.telefone, msgInvalida);
        }
        await prisma.mensagem.create({
          data: { contatoId: contato.id, direcao: 'enviada', conteudo: '[Opção inválida - opções reenviadas]', etapa: contato.etapaBot },
        });
      }
      return res.json({ status: 'opcao_invalida', contato: contato.id, etapaAtual: contato.etapaBot });
    }

    const updateData: any = { etapaBot: resultado.proximaEtapa, tentativasSemResposta: 0 };
    if (resultado.novoStatus) updateData.status = resultado.novoStatus;

    await prisma.contato.update({ where: { id: contato.id }, data: updateData });

    const etapaMensagem = resultado.proximaEtapa === 'msg3b_repeat' ? 'msg3b' : resultado.proximaEtapa;
    if (etapaMensagem !== 'atendimento_manual' && etapaMensagem !== 'bloqueado') {
      await enviarMensagemBot(contato.id, etapaMensagem);
    }

    if (resultado.acao === 'enviar_msg3a_notificar') {
      const leadExistente = await prisma.lead.findFirst({ where: { contatoId: contato.id } });
      if (!leadExistente) {
        await prisma.lead.create({
          data: { contatoId: contato.id, estagio: 'interessado', notas: `Lead quente detectado em ${new Date().toLocaleString('pt-BR')}` },
        });
      } else {
        await prisma.lead.update({ where: { id: leadExistente.id }, data: { estagio: 'interessado' } });
      }
      const contatoCompleto = await prisma.contato.findUnique({ where: { id: contato.id } });
      if (contatoCompleto) await notificarLeadQuente(contatoCompleto);
    }

    if (resultado.proximaEtapa === 'msg3c') {
      await prisma.contato.update({ where: { id: contato.id }, data: { status: 'pendente_followup' } });
    }

    res.json({
      status: 'processado',
      contato: contato.id,
      etapaAnterior: contato.etapaBot,
      proximaEtapa: resultado.proximaEtapa,
      acao: resultado.acao,
    });
  } catch (error: any) {
    console.error('Erro no webhook', error);
    res.status(500).json({ error: error.message });
  }
}
