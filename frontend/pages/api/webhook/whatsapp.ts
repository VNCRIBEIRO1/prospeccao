// ============================================
// POST /api/webhook/whatsapp — Webhook WPPConnect
// REESTRUTURADO: Fluxo com botões nativos interativos
// Envio multi-mensagem: conteúdo + menu com botões separados
// ============================================
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { detectarResposta } from '../../../lib/detector';
import { enviarMensagem, enviarMensagemComBotoes, armazenarQRCode, limparQRCodeCache } from '../../../lib/evolution';
import { FLUXO, gerarFallback, gerarMensagemOpcaoInvalida, BOTOES } from '../../../lib/mensagens';
import type { EtapaFluxo, BotaoInterativo } from '../../../lib/mensagens';
import axios from 'axios';

// ============================================
// ENVIAR ETAPA COMPLETA — Multi-mensagem + botões
// ============================================
async function enviarEtapaBot(contatoId: number, etapa: string): Promise<{ sucesso: boolean; erro?: string }> {
  const fluxo = FLUXO[etapa];
  if (!fluxo) return { sucesso: false, erro: 'etapa_invalida' };

  const contato = await prisma.contato.findUnique({ where: { id: contatoId } });
  if (!contato) return { sucesso: false, erro: 'contato_nao_encontrado' };

  const textos = fluxo.textos;
  const botoes = fluxo.botoes;
  const rodape = fluxo.rodape || 'Toque em uma opção 👆';

  // Se tem múltiplos textos, envia todos menos o último como texto puro
  // O último texto vai com os botões (se houver)
  for (let i = 0; i < textos.length; i++) {
    const texto = textos[i];
    const isUltimo = i === textos.length - 1;

    let resultado;
    if (isUltimo && botoes && botoes.length > 0) {
      // Último texto + botões interativos
      resultado = await enviarMensagemComBotoes(contato.telefone, texto, botoes, rodape);
    } else {
      // Textos intermediários: enviar como texto puro
      resultado = await enviarMensagem(contato.telefone, texto);
    }

    if (!resultado.sucesso) {
      return { sucesso: false, erro: resultado.erro };
    }

    // Delay entre mensagens múltiplas (simula digitação)
    if (!isUltimo && textos.length > 1) {
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
    }
  }

  // Salvar mensagem no banco
  const conteudoResumo = textos.map(t => t.substring(0, 200)).join(' | ');
  await prisma.mensagem.create({
    data: {
      contatoId,
      direcao: 'enviada',
      conteudo: conteudoResumo.substring(0, 500),
      etapa,
    },
  });

  return { sucesso: true };
}

// ============================================
// NOTIFICAR LEAD QUENTE VIA TELEGRAM
// ============================================
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

// ============================================
// HANDLER PRINCIPAL
// ============================================
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const payload = req.body;

    // ─── Evento de status de conexão ───
    if (payload.event === 'status-find' || payload.status) {
      const state = payload.status || payload.state || 'unknown';
      if (state === 'CONNECTED' || state === 'isLogged') {
        limparQRCodeCache();
      }
      return res.json({ status: 'connection_update', state });
    }

    // ─── Evento de QR Code ───
    if (payload.event === 'qrcode' || payload.qrcode) {
      armazenarQRCode(payload);
      return res.json({ status: 'qrcode_armazenado' });
    }

    // ─── Extrair dados da mensagem ───
    let telefone = '';
    let texto = '';
    let buttonId: string | null = null;

    if (payload.from || payload.chatId || payload.event === 'onMessage') {
      const from = payload.from || payload.chatId || '';

      // Ignorar grupos e broadcast
      if (from.endsWith('@g.us') || from.includes('broadcast') || from.includes('status')) {
        return res.json({ status: 'ignorado', motivo: 'grupo_ou_broadcast' });
      }

      // Ignorar mensagens do próprio bot
      if (payload.fromMe === true) {
        return res.json({ status: 'ignorado', motivo: 'mensagem_propria' });
      }

      // Telefone
      telefone = from.replace('@c.us', '').replace('@s.whatsapp.net', '');

      // Texto
      texto = payload.body || payload.content || payload.caption || '';

      // ─── BOTÃO INTERATIVO (buttons_response) ───
      if (payload.type === 'buttons_response') {
        buttonId = payload.selectedButtonId || payload.buttonId || null;
        texto = payload.selectedDisplayText || payload.body || texto;
        console.log(`[Webhook] 🔘 Botão clicado: id="${buttonId}" texto="${texto}"`);
      }

      // ─── LISTA INTERATIVA (list_response) ───
      if (payload.type === 'list_response') {
        buttonId = payload.listResponse?.singleSelectReply?.selectedRowId || payload.selectedRowId || null;
        texto = payload.listResponse?.title || payload.body || texto;
        console.log(`[Webhook] 📋 Lista selecionada: id="${buttonId}" texto="${texto}"`);
      }

      // Fallback: buttonId em outros campos
      if (!buttonId && payload.quotedMsgId && payload.selectedButtonId) {
        buttonId = payload.selectedButtonId;
      }

      console.log(`[Webhook] 📨 tel=${telefone} | texto="${texto?.substring(0, 50)}" | buttonId=${buttonId} | type=${payload.type}`);

    } else if (payload.telefone && payload.mensagem) {
      // Formato simplificado (testes via curl)
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

    // ─── Buscar ou criar contato ───
    let contato = await prisma.contato.findFirst({
      where: { OR: [{ telefone }, { telefone: { endsWith: telefone.slice(-8) } }] },
    });

    if (!contato) {
      contato = await prisma.contato.create({
        data: { nome: 'Resposta Espontânea', telefone, status: 'respondeu', etapaBot: 'msg1' },
      });
    }

    // Registrar mensagem recebida
    await prisma.mensagem.create({
      data: { contatoId: contato.id, direcao: 'recebida', conteudo: texto.substring(0, 500), etapa: contato.etapaBot },
    });

    // ─── DETECTAR RESPOSTA ───
    const resultado = detectarResposta(texto, contato.etapaBot, buttonId);

    console.log(`[Webhook] 🎯 Detecção: etapa=${contato.etapaBot} → ação=${resultado.acao} → próxima=${resultado.proximaEtapa} | btn=${resultado.buttonId || 'nenhum'}`);

    // ─── AÇÃO: Manual (etapa terminal) ───
    if (!resultado.proximaEtapa || resultado.acao === 'manual') {
      return res.json({ status: 'manual', contato: contato.id, etapaAtual: contato.etapaBot });
    }

    // ─── AÇÃO: Bloquear ───
    if (resultado.acao === 'bloquear') {
      await prisma.contato.update({
        where: { id: contato.id },
        data: { status: 'naoInteresse', etapaBot: 'bloqueado' },
      });
      return res.json({ status: 'bloqueado', contato: contato.id });
    }

    // ─── AÇÃO: Reenviar opções (resposta não reconhecida) ───
    if (resultado.acao === 'reenviar_opcoes') {
      const fallback = gerarFallback(contato.etapaBot);
      if (fallback.botoes) {
        // Reenviar com botões interativos nativos
        await enviarMensagemComBotoes(
          contato.telefone,
          fallback.texto,
          fallback.botoes,
          'Toque em uma opção 👆'
        );
      } else {
        // Sem botões disponíveis, enviar texto
        const msgInvalida = gerarMensagemOpcaoInvalida(contato.etapaBot);
        if (msgInvalida) {
          await enviarMensagem(contato.telefone, msgInvalida);
        }
      }

      await prisma.mensagem.create({
        data: { contatoId: contato.id, direcao: 'enviada', conteudo: '[Fallback - botões reenviados]', etapa: contato.etapaBot },
      });

      return res.json({ status: 'opcao_invalida', contato: contato.id, etapaAtual: contato.etapaBot });
    }

    // ─── AVANÇAR FLUXO ───
    const updateData: any = {
      etapaBot: resultado.proximaEtapa,
      tentativasSemResposta: 0,
    };
    if (resultado.novoStatus) updateData.status = resultado.novoStatus;

    await prisma.contato.update({ where: { id: contato.id }, data: updateData });

    // Enviar próxima etapa (com mensagens múltiplas + botões)
    const etapaMensagem = resultado.proximaEtapa === 'msg3b_repeat' ? 'msg3b_repeat' : resultado.proximaEtapa;
    if (etapaMensagem !== 'atendimento_manual' && etapaMensagem !== 'bloqueado') {
      await enviarEtapaBot(contato.id, etapaMensagem);
    }

    // ─── Lead quente? Notificar! ───
    if (resultado.acao === 'enviar_msg3a_notificar') {
      const leadExistente = await prisma.lead.findFirst({ where: { contatoId: contato.id } });
      if (!leadExistente) {
        await prisma.lead.create({
          data: { contatoId: contato.id, estagio: 'interessado', notas: `Lead quente em ${new Date().toLocaleString('pt-BR')}` },
        });
      } else {
        await prisma.lead.update({ where: { id: leadExistente.id }, data: { estagio: 'interessado' } });
      }
      const contatoCompleto = await prisma.contato.findUnique({ where: { id: contato.id } });
      if (contatoCompleto) await notificarLeadQuente(contatoCompleto);
    }

    // Follow-up pendente
    if (resultado.proximaEtapa === 'msg3c') {
      await prisma.contato.update({
        where: { id: contato.id },
        data: { status: 'pendente_followup' },
      });
    }

    res.json({
      status: 'processado',
      contato: contato.id,
      etapaAnterior: contato.etapaBot,
      proximaEtapa: resultado.proximaEtapa,
      acao: resultado.acao,
      buttonId: resultado.buttonId || null,
    });
  } catch (error: any) {
    console.error('[Webhook] ❌ Erro:', error);
    res.status(500).json({ error: error.message });
  }
}
