// POST /api/webhook/whatsapp — Webhook receiver from Evolution API
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

  const botoesEtapa = BOTOES[etapa] || null;
  let resultado;
  if (botoesEtapa) {
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
    const event = payload.event || '';

    // QRCODE_UPDATED
    if (event === 'QRCODE_UPDATED' || event === 'qrcode.updated') {
      armazenarQRCode(payload.data || payload);
      return res.json({ status: 'qrcode_armazenado' });
    }

    // CONNECTION_UPDATE
    if (event === 'CONNECTION_UPDATE' || event === 'connection.update') {
      const state = payload.data?.state || payload.data?.instance?.state || 'unknown';
      if (state === 'open') limparQRCodeCache();
      return res.json({ status: 'connection_update', state });
    }

    // MESSAGES_UPSERT
    let telefone: string = '';
    let texto: string = '';
    let buttonId: string | null = null;

    if (payload.data?.message) {
      const remoteJid = payload.data.key?.remoteJid || '';
      if (remoteJid.endsWith('@g.us') || remoteJid.includes('@broadcast')) {
        return res.json({ status: 'ignorado', motivo: 'mensagem_de_grupo_ou_broadcast' });
      }

      telefone = remoteJid.replace('@s.whatsapp.net', '');

      // Desempacotar mensagem — Evolution API v2 pode encapsular em viewOnceMessage
      let msg = payload.data.message;
      if (msg.viewOnceMessage?.message) {
        msg = msg.viewOnceMessage.message;
      }
      if (msg.ephemeralMessage?.message) {
        msg = msg.ephemeralMessage.message;
      }
      if (msg.documentWithCaptionMessage?.message) {
        msg = msg.documentWithCaptionMessage.message;
      }

      // Log para debug de formatos de mensagem recebida
      const msgKeys = Object.keys(msg);
      console.log(`[Webhook] Msg keys: ${msgKeys.join(', ')} | fromMe: ${payload.data?.key?.fromMe}`);

      // Texto básico
      texto = msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.videoMessage?.caption || '';

      // === FORMATOS DE RESPOSTA DE BOTÃO (Evolution API v2) ===

      // 1) buttonsResponseMessage (botões antigos/legacy)
      if (msg.buttonsResponseMessage) {
        buttonId = msg.buttonsResponseMessage.selectedButtonId || null;
        texto = msg.buttonsResponseMessage.selectedDisplayText || texto;
      }

      // 2) listResponseMessage (resposta de lista)
      if (msg.listResponseMessage) {
        buttonId = msg.listResponseMessage.singleSelectReply?.selectedRowId || null;
        texto = msg.listResponseMessage.title || texto;
      }

      // 3) templateButtonReplyMessage (botões de template)
      if (msg.templateButtonReplyMessage) {
        buttonId = msg.templateButtonReplyMessage.selectedId || null;
        texto = msg.templateButtonReplyMessage.selectedDisplayText || texto;
      }

      // 4) interactiveResponseMessage (nativeFlow buttons — Evolution API v2.x)
      if (msg.interactiveResponseMessage) {
        try {
          const nativeBody = msg.interactiveResponseMessage.nativeFlowResponseMessage;
          if (nativeBody) {
            const paramsJson = nativeBody.paramsJson;
            if (paramsJson) {
              const parsed = JSON.parse(paramsJson);
              buttonId = parsed.id || null;
              texto = parsed.display_text || parsed.text || texto;
            }
            // Fallback: verificar selectedIndex
            if (!buttonId && nativeBody.name === 'quick_reply') {
              buttonId = nativeBody.selectedButtonId || null;
            }
          }
          // Fallback: body.text do interactiveResponseMessage
          if (!buttonId && msg.interactiveResponseMessage.body?.text) {
            texto = msg.interactiveResponseMessage.body.text;
          }
        } catch (e) {
          console.error('[Webhook] Erro ao parsear interactiveResponseMessage:', e);
        }
      }

      // 5) interactiveMessage com body (pode ser resposta direta em algumas versões)
      if (!buttonId && !texto && msg.interactiveMessage?.body?.text) {
        texto = msg.interactiveMessage.body.text;
      }

      // Log resultado do parse
      console.log(`[Webhook] Parse result: tel=${telefone} | texto="${texto?.substring(0,50)}" | buttonId=${buttonId}`);

    } else if (payload.telefone && payload.mensagem) {
      telefone = payload.telefone;
      texto = payload.mensagem;
      buttonId = payload.buttonId || null;
    } else {
      return res.json({ status: 'ignorado', motivo: 'evento_nao_tratado', event });
    }

    if (payload.data?.key?.fromMe) return res.json({ status: 'ignorado', motivo: 'mensagem_propria' });
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
