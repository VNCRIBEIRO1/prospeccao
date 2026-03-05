// ============================================
// POST /api/webhook/whatsapp — Webhook WPPConnect
// REESTRUTURADO: Fluxo com botões nativos interativos
// Envio multi-mensagem: conteúdo + menu com botões separados
// ============================================
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { detectarResposta } from '../../../lib/detector';
import { enviarMensagem, enviarMensagemComBotoes, armazenarQRCode, limparQRCodeCache } from '../../../lib/evolution';
import { FLUXO, ETAPAS_TERMINAIS, gerarFallback, gerarMensagemOpcaoInvalida, BOTOES } from '../../../lib/mensagens';
import type { EtapaFluxo, BotaoInterativo } from '../../../lib/mensagens';
import axios from 'axios';

// ============================================
// DEDUPLICAÇÃO DUPLA CAMADA
// WPPConnect dispara onMessage + onAnyMessage para CADA msg,
// e para list_response/buttons_response pode disparar MÚLTIPLAS
// vezes com IDs diferentes. Usamos 2 caches:
//   1) messageId (_serialized) — dedup padrão
//   2) contentKey (tel+buttonId+texto) — dedup por conteúdo
// ============================================
const processedMessages = new Map<string, number>();
const processedContent = new Map<string, number>();
const processedRawButtons = new Map<string, number>();

// Cache persistente de mapeamento LID → telefone real
// Sobrevive entre requests (mesmo processo), perdido ao reiniciar servidor
const lidToPhoneMap = new Map<string, string>();

function storeLidMapping(lidPhone: string, realPhone: string) {
  if (lidPhone && realPhone && lidPhone !== realPhone) {
    lidToPhoneMap.set(lidPhone, realPhone);
    console.log(`[Webhook] 📌 LID cache armazenado: ${lidPhone} → ${realPhone}`);
  }
}

const DEDUP_TTL_MS = 30_000; // 30 segundos
const DEDUP_CONTENT_TTL_MS = 10_000; // 10 segundos para dedup por conteúdo

function cleanupMap(map: Map<string, number>, ttl: number) {
  if (map.size > 100) {
    const now = Date.now();
    for (const [key, ts] of map) {
      if (now - ts > ttl) map.delete(key);
    }
  }
}

function isDuplicate(messageId: string): boolean {
  if (!messageId) return false;
  cleanupMap(processedMessages, DEDUP_TTL_MS);
  if (processedMessages.has(messageId)) {
    return true;
  }
  processedMessages.set(messageId, Date.now());
  return false;
}

/** Dedup pré-LID: usa telefone RAW (pode ser LID) + buttonId.
 *  Pega duplicatas ANTES do mapeamento LID — impede que o segundo
 *  webhook mapeie para contato errado via estratégia 2.
 */
function isRawButtonDuplicate(rawTelefone: string, buttonId: string): boolean {
  const key = `raw:${rawTelefone}|${buttonId}`;
  cleanupMap(processedRawButtons, DEDUP_CONTENT_TTL_MS);
  if (processedRawButtons.has(key)) {
    return true;
  }
  processedRawButtons.set(key, Date.now());
  return false;
}

/** Dedup por conteúdo (após mapeamento LID + busca contato).
 *  Para texto livre: usa telefone + etapa + texto
 */
function isContentDuplicate(telefone: string, etapa: string, texto: string): boolean {
  const key = `txt:${telefone}|${etapa}|${texto.substring(0, 30).toLowerCase()}`;
  cleanupMap(processedContent, DEDUP_CONTENT_TTL_MS);
  if (processedContent.has(key)) {
    return true;
  }
  processedContent.set(key, Date.now());
  return false;
}

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

    // ─── DEDUPLICAÇÃO — Ignorar mensagens já processadas ───
    const messageId = payload.id?._serialized || payload.id?.id || payload.id || payload.messageId || '';
    if (messageId && isDuplicate(messageId)) {
      return res.json({ status: 'ignorado', motivo: 'duplicado', messageId });
    }

    // ─── Extrair dados da mensagem ───
    let telefone = '';
    let texto = '';
    let buttonId: string | null = null;
    let isLidNumber = false; // Flag para números LID (Linked Identity)

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

      // Detectar se é número LID (Linked Identity Device)
      isLidNumber = from.endsWith('@lid') || from.includes('@lid');

      // Telefone — limpar sufixos WPP (@c.us, @s.whatsapp.net, @lid)
      telefone = from.replace('@c.us', '').replace('@s.whatsapp.net', '').replace('@lid', '');

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

    // ─── DEDUP PRÉ-LID — Para botões/listas, bloquear duplicatas ANTES do mapeamento ───
    // WPPConnect dispara onMessage + onAnyMessage com IDs diferentes para a mesma resposta.
    // Se não bloquearmos aqui, o segundo webhook pode mapear via estratégia 2 para contato errado.
    if (buttonId && isRawButtonDuplicate(telefone, buttonId)) {
      console.log(`[Webhook] 🔄 Duplicado pré-LID: tel=${telefone} btn=${buttonId} — ignorando`);
      return res.json({ status: 'ignorado', motivo: 'duplicado_botao' });
    }

    // ─── Buscar ou criar contato ───
    // WPPConnect pode enviar números em formato LID (Linked Identity Device)
    // Ex: "16076784038000" em vez de "5518996311933"
    // Precisamos buscar de múltiplas formas:
    let contato = await prisma.contato.findFirst({
      where: { OR: [{ telefone }, { telefone: { endsWith: telefone.slice(-8) } }] },
    });

    // Se não encontrou e é LID, mapear para o contato real
    // LID é um identificador interno do WhatsApp — NÃO é o número real
    if (!contato && isLidNumber) {
      console.log(`[Webhook] 🔄 Número LID detectado: ${telefone} — buscando contato real...`);

      const originalLidPhone = telefone; // Guardar LID original para cache

      // Estratégia 0: Cache de mapeamento LID (mais rápido, mais confiável)
      const cachedPhone = lidToPhoneMap.get(telefone);
      if (cachedPhone) {
        contato = await prisma.contato.findFirst({ where: { telefone: cachedPhone } });
        if (contato) {
          telefone = contato.telefone;
          console.log(`[Webhook] 🔄 LID mapeado via cache → contato ${contato.id} (${contato.telefone})`);
        }
      }

      // Estratégia 1: Extrair número real de campos do payload
      const candidatos = [
        payload.sender?.id?.replace(/@(c\.us|lid|s\.whatsapp\.net)$/g, ''),
        payload.chat?.contact?.id?.replace(/@(c\.us|lid|s\.whatsapp\.net)$/g, ''),
        payload.chatId?.replace(/@(c\.us|lid|s\.whatsapp\.net)$/g, ''),
      ].filter(n => n && /^\d{10,15}$/.test(n) && n !== telefone);

      for (const candidato of candidatos) {
        contato = await prisma.contato.findFirst({
          where: { OR: [{ telefone: candidato! }, { telefone: { endsWith: candidato!.slice(-8) } }] },
        });
        if (contato) {
          telefone = contato.telefone;
          storeLidMapping(originalLidPhone, telefone);
          console.log(`[Webhook] 🔄 LID mapeado via payload → contato ${contato.id} (${contato.telefone})`);
          break;
        }
      }

      // Estratégia 2: Se tem buttonId, buscar contato na etapa correspondente
      // SEGURANÇA: Só aceita se o contato foi atualizado nos últimos 60 segundos
      // (evita mapear para contato errado quando há muitos contatos na mesma etapa)
      if (!contato && buttonId) {
        const etapasComBotao: string[] = [];
        for (const [etapa, fluxo] of Object.entries(FLUXO)) {
          if (fluxo.botoes?.some(b => b.id === buttonId)) {
            etapasComBotao.push(etapa);
          }
        }
        if (etapasComBotao.length > 0) {
          const limiteRecente = new Date(Date.now() - 60_000); // últimos 60 segundos
          contato = await prisma.contato.findFirst({
            where: {
              etapaBot: { in: etapasComBotao },
              status: { not: 'naoInteresse' },
              atualizadoEm: { gte: limiteRecente },
            },
            orderBy: { atualizadoEm: 'desc' },
          });
          if (contato) {
            telefone = contato.telefone;
            storeLidMapping(originalLidPhone, telefone);
            console.log(`[Webhook] 🔄 LID mapeado via buttonId "${buttonId}" → contato ${contato.id} (${contato.telefone}) na etapa ${contato.etapaBot}`);
          }
        }
      }

      // Estratégia 3: Último contato que recebeu mensagem enviada recentemente
      if (!contato) {
        const ultimaMsgEnviada = await prisma.mensagem.findFirst({
          where: { direcao: 'enviada' },
          orderBy: { criadoEm: 'desc' },
          include: { contato: true },
        });
        if (ultimaMsgEnviada?.contato && ultimaMsgEnviada.criadoEm) {
          const diffMs = Date.now() - new Date(ultimaMsgEnviada.criadoEm).getTime();
          if (diffMs < 60 * 60 * 1000) { // 60 minutos (expandido de 5 min)
            contato = ultimaMsgEnviada.contato;
            telefone = contato.telefone;
            storeLidMapping(originalLidPhone, telefone);
            console.log(`[Webhook] 🔄 LID mapeado por última msg enviada → contato ${contato.id} (${contato.telefone})`);
          }
        }
      }

      // Estratégia 4: Contato ativo em etapa não-terminal (fallback amplo)
      if (!contato) {
        const ETAPAS_TERMINAIS_LID = ['msg3a', 'msg3c', 'msg2b_fim', 'atendimento_manual', 'bloqueado'];
        contato = await prisma.contato.findFirst({
          where: {
            etapaBot: { notIn: ETAPAS_TERMINAIS_LID },
            status: { not: 'naoInteresse' },
          },
          orderBy: { atualizadoEm: 'desc' },
        });
        if (contato) {
          telefone = contato.telefone;
          storeLidMapping(originalLidPhone, telefone);
          console.log(`[Webhook] 🔄 LID mapeado via contato ativo → contato ${contato.id} (${contato.telefone}) etapa ${contato.etapaBot}`);
        }
      }

      if (!contato) {
        console.log(`[Webhook] ⚠️ Número LID ${payload.from} não mapeado — ignorando`);
        return res.json({ status: 'ignorado', motivo: 'lid_nao_mapeado', from: payload.from });
      }
    }

    let isNovoContato = false;
    const nomeWhatsApp = payload.sender?.pushname || payload.notifyName || payload.pushname || null;

    if (!contato) {
      isNovoContato = true;
      contato = await prisma.contato.create({
        data: {
          nome: nomeWhatsApp || 'Resposta Espontânea',
          telefone,
          status: 'respondeu',
          etapaBot: 'msg1',
        },
      });
      console.log(`[Webhook] 🆕 Novo contato criado: id=${contato.id} nome="${contato.nome}" tel=${telefone}`);
    } else if (nomeWhatsApp && contato.nome === 'Resposta Espontânea') {
      // Atualizar nome se tínhamos placeholder
      await prisma.contato.update({ where: { id: contato.id }, data: { nome: nomeWhatsApp } });
      contato = { ...contato, nome: nomeWhatsApp };
    }

    // ─── SAUDAÇÃO AUTOMÁTICA ───
    // Se contato é novo (espontâneo) ou estava em 'inicio' (importado sem prospectar),
    // ele NUNCA viu msg1 → enviar saudação primeiro e aguardar resposta
    const precisaSaudacao = isNovoContato || contato.etapaBot === 'inicio';

    if (precisaSaudacao) {
      // Atualizar para msg1
      await prisma.contato.update({
        where: { id: contato.id },
        data: { etapaBot: 'msg1', status: 'respondeu' },
      });

      // Registrar mensagem recebida
      await prisma.mensagem.create({
        data: { contatoId: contato.id, direcao: 'recebida', conteudo: texto.substring(0, 500), etapa: 'msg1' },
      });

      // Enviar saudação (msg1 com oferta + botões)
      console.log(`[Webhook] 👋 Enviando saudação para ${telefone} (${isNovoContato ? 'novo contato' : 'etapa inicio'})`);
      await enviarEtapaBot(contato.id, 'msg1');

      return res.json({
        status: 'saudacao_enviada',
        contato: contato.id,
        nome: contato.nome,
        proximaEtapa: 'msg1',
        motivo: isNovoContato ? 'contato_novo' : 'etapa_inicio',
      });
    }

    // Normalizar etapaBot para processamento normal
    const etapaAtual = contato.etapaBot;

    // ─── DEDUP CONTEÚDO — Para texto livre (botões já foram filtrados pelo dedup pré-LID) ───
    if (!buttonId && isContentDuplicate(telefone, etapaAtual, texto)) {
      console.log(`[Webhook] 🔄 Duplicado texto: tel=${telefone} etapa=${etapaAtual} — ignorando`);
      return res.json({ status: 'ignorado', motivo: 'duplicado_conteudo' });
    }

    // Registrar mensagem recebida
    await prisma.mensagem.create({
      data: { contatoId: contato.id, direcao: 'recebida', conteudo: texto.substring(0, 500), etapa: etapaAtual },
    });

    // ─── DETECTAR RESPOSTA ───
    const resultado = detectarResposta(texto, etapaAtual, buttonId);

    console.log(`[Webhook] 🎯 Detecção: etapa=${etapaAtual} → ação=${resultado.acao} → próxima=${resultado.proximaEtapa} | btn=${resultado.buttonId || 'nenhum'}`);

    // ─── AÇÃO: Restart (contato em etapa terminal envia nova mensagem) ───
    // Em vez de ir para manual, reinicia o fluxo de msg1
    if (resultado.acao === 'restart') {
      console.log(`[Webhook] 🔄 Restart: contato ${contato.id} estava em ${etapaAtual}, reiniciando fluxo`);
      await prisma.contato.update({
        where: { id: contato.id },
        data: { etapaBot: 'msg1', status: 'respondeu' },
      });
      await enviarEtapaBot(contato.id, 'msg1');
      return res.json({
        status: 'restart',
        contato: contato.id,
        etapaAnterior: etapaAtual,
        proximaEtapa: 'msg1',
      });
    }

    // ─── AÇÃO: Manual (fallback extremo) ───
    if (!resultado.proximaEtapa || resultado.acao === 'manual') {
      return res.json({ status: 'manual', contato: contato.id, etapaAtual });
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
      const fallback = gerarFallback(etapaAtual);
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
        const msgInvalida = gerarMensagemOpcaoInvalida(etapaAtual);
        if (msgInvalida) {
          await enviarMensagem(contato.telefone, msgInvalida);
        }
      }

      await prisma.mensagem.create({
        data: { contatoId: contato.id, direcao: 'enviada', conteudo: '[Fallback - botões reenviados]', etapa: etapaAtual },
      });

      return res.json({ status: 'opcao_invalida', contato: contato.id, etapaAtual });
    }

    // ─── AVANÇAR FLUXO ───
    const updateData: any = {
      etapaBot: resultado.proximaEtapa,
      tentativasSemResposta: 0,
    };
    if (resultado.novoStatus) updateData.status = resultado.novoStatus;

    await prisma.contato.update({ where: { id: contato.id }, data: updateData });

    // Enviar próxima etapa (com mensagens múltiplas + botões)
    const etapaMensagem = resultado.proximaEtapa;
    if (etapaMensagem !== 'atendimento_manual' && etapaMensagem !== 'bloqueado') {
      await enviarEtapaBot(contato.id, etapaMensagem);
    }

    // ─── Lead quente? Notificar! ───
    if (resultado.acao === 'enviar_msg3a_notificar' || resultado.acao === 'enviar_msg_humano_notificar') {
      const tipoLead = resultado.acao === 'enviar_msg_humano_notificar' ? 'projeto_personalizado' : 'interessado';
      const leadExistente = await prisma.lead.findFirst({ where: { contatoId: contato.id } });
      if (!leadExistente) {
        await prisma.lead.create({
          data: { contatoId: contato.id, estagio: tipoLead, notas: `${tipoLead === 'projeto_personalizado' ? 'Projeto personalizado' : 'Lead quente'} em ${new Date().toLocaleString('pt-BR')}` },
        });
      } else {
        await prisma.lead.update({ where: { id: leadExistente.id }, data: { estagio: tipoLead } });
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
      etapaAnterior: etapaAtual,
      proximaEtapa: resultado.proximaEtapa,
      acao: resultado.acao,
      buttonId: resultado.buttonId || null,
    });
  } catch (error: any) {
    console.error('[Webhook] ❌ Erro:', error);
    res.status(500).json({ error: error.message });
  }
}
