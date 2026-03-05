// ============================================
// Disparos — Fila de envio com Bull + Redis
// ============================================
const Queue = require('bull');
const prisma = require('../lib/prisma');
const { enviarMensagem, enviarMensagemComBotoes } = require('./evolution');
const MENSAGENS = require('./mensagens');
const { BOTOES } = require('./mensagens');
const logger = require('./logger');
let queue = null;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Inicializar a fila Bull
 */
async function inicializarFila() {
  queue = new Queue('disparos-whatsapp', REDIS_URL, {
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    }
  });

  // Processar mensagens (1 por vez para respeitar delays)
  queue.process('enviar-mensagem', 1, async (job) => {
    const { telefone, mensagem, contatoId, etapa, campanhaId } = job.data;

    try {
      // Verificar se o contato ainda está elegível
      const contato = await prisma.contato.findUnique({ where: { id: contatoId } });
      if (!contato || contato.status === 'naoInteresse' || contato.status === 'fechado') {
        logger.info('Contato não elegível, pulando', { contatoId, status: contato?.status });
        return { sucesso: false, motivo: 'contato_nao_elegivel' };
      }

      // Enviar mensagem (com botões se disponíveis)
      const botoesEtapa = BOTOES[etapa] || null;
      let resultado;
      if (botoesEtapa) {
        resultado = await enviarMensagemComBotoes(telefone, mensagem, botoesEtapa, 'Escolha uma opção 👆');
      } else {
        resultado = await enviarMensagem(telefone, mensagem);
      }

      if (resultado.sucesso) {
        // Atualizar contato — só muda status para 'enviado' em disparos de campanha
        const updateData = {
          etapaBot: etapa || 'msg1',
          ultimoEnvio: new Date()
        };
        if (campanhaId) {
          updateData.status = 'enviado';
          // Incrementar tentativas sem resposta (será zerado quando responder)
          updateData.tentativasSemResposta = { increment: 1 };
        }
        await prisma.contato.update({
          where: { id: contatoId },
          data: updateData
        });

        // Registrar mensagem enviada
        await prisma.mensagem.create({
          data: {
            contatoId,
            direcao: 'enviada',
            conteudo: mensagem.substring(0, 500), // Limitar tamanho
            etapa: etapa || 'msg1'
          }
        });

        // Incrementar contador da campanha
        if (campanhaId) {
          await prisma.campanha.update({
            where: { id: campanhaId },
            data: {
              totalEnviado: { increment: 1 },
              enviadosHoje: { increment: 1 }
            }
          });
        }

        logger.info('Disparo processado com sucesso', { contatoId, etapa });
        return { sucesso: true };
      } else {
        // Registrar erro
        await prisma.logErro.create({
          data: {
            tipo: 'envio_falhou',
            mensagem: `Falha ao enviar para ${telefone}`,
            detalhes: resultado.erro
          }
        });
        throw new Error(resultado.erro);
      }
    } catch (error) {
      logger.error('Erro no processamento do disparo', { contatoId, erro: error.message });
      throw error;
    }
  });

  // Eventos da fila
  queue.on('completed', (job, result) => {
    logger.debug('Job concluído', { jobId: job.id });
  });

  queue.on('failed', (job, err) => {
    logger.error('Job falhou', { jobId: job.id, erro: err.message });
  });

  queue.on('error', (error) => {
    logger.error('Erro na fila', { erro: error.message });
  });

  logger.info('Fila de disparos inicializada');
  return queue;
}

/**
 * Disparar campanha — enfileira mensagens com delay
 */
async function dispararCampanha(campanhaId) {
  if (!queue) throw new Error('Fila não inicializada');

  const campanha = await prisma.campanha.findUnique({ where: { id: campanhaId } });
  if (!campanha) throw new Error('Campanha não encontrada');
  if (campanha.status !== 'ativa') throw new Error('Campanha não está ativa');

  // Reset contador diário se necessário
  const hoje = new Date();
  const ultimoReset = new Date(campanha.ultimoReset);
  if (hoje.toDateString() !== ultimoReset.toDateString()) {
    await prisma.campanha.update({
      where: { id: campanhaId },
      data: { enviadosHoje: 0, ultimoReset: hoje }
    });
  }

  // Buscar contatos pendentes
  const contatos = await prisma.contato.findMany({
    where: {
      status: 'pendente',
      tentativasSemResposta: { lt: parseInt(process.env.MAX_NAO_RESPOSTAS || '3') }
    },
    take: Math.min(campanha.limiteDiario - campanha.enviadosHoje, parseInt(process.env.MAX_DISPAROS_DIA || '50')),
    orderBy: { criadoEm: 'asc' }
  });

  if (contatos.length === 0) {
    logger.info('Nenhum contato pendente para disparar', { campanhaId });
    return { total: 0 };
  }

  // Enfileirar cada mensagem com delay
  for (let i = 0; i < contatos.length; i++) {
    const contato = contatos[i];
    const delay = calcularDelay(i, campanha.delaySegundos);

    await queue.add('enviar-mensagem', {
      telefone: contato.telefone,
      mensagem: MENSAGENS.msg1,
      contatoId: contato.id,
      etapa: 'msg1',
      campanhaId
    }, {
      delay,
      jobId: `campanha-${campanhaId}-contato-${contato.id}-${Date.now()}`
    });
  }

  // Se não há mais contatos pendentes para futuras rodadas, marcar campanha como concluída
  const totalPendentes = await prisma.contato.count({
    where: {
      status: 'pendente',
      tentativasSemResposta: { lt: parseInt(process.env.MAX_NAO_RESPOSTAS || '3') }
    }
  });

  if (totalPendentes <= contatos.length) {
    // Todos os contatos pendentes foram enfileirados — agendar check de conclusão
    // A campanha será concluída quando todos os jobs terminarem
    queue.on('completed', async () => {
      try {
        const jobCounts = await queue.getJobCounts();
        if (jobCounts.waiting === 0 && jobCounts.active === 0 && jobCounts.delayed === 0) {
          const campanhaAtual = await prisma.campanha.findUnique({ where: { id: campanhaId } });
          if (campanhaAtual && campanhaAtual.status === 'ativa') {
            await prisma.campanha.update({
              where: { id: campanhaId },
              data: { status: 'concluida' }
            });
            logger.info('✅ Campanha concluída automaticamente', { campanhaId });
          }
        }
      } catch (e) {
        // Silently ignore — the listener may fire for other jobs
      }
    });
  }

  logger.info('Campanha enfileirada', { campanhaId, totalContatos: contatos.length });
  return { total: contatos.length };
}

/**
 * Enviar mensagem específica do bot (resposta a interação)
 */
async function enviarMensagemBot(contatoId, etapa) {
  const mensagem = MENSAGENS[etapa];
  if (!mensagem) {
    logger.warn('Etapa de mensagem não encontrada', { etapa });
    return { sucesso: false, erro: 'etapa_invalida' };
  }

  const contato = await prisma.contato.findUnique({ where: { id: contatoId } });
  if (!contato) return { sucesso: false, erro: 'contato_nao_encontrado' };

  if (queue) {
    // Com fila — enfileirar com delay mínimo
    await queue.add('enviar-mensagem', {
      telefone: contato.telefone,
      mensagem,
      contatoId,
      etapa
    }, {
      delay: 2000 + Math.floor(Math.random() * 3000), // 2-5s de delay para parecer humano
      jobId: `resposta-${contatoId}-${etapa}-${Date.now()}`
    });
    return { sucesso: true, modo: 'enfileirado' };
  } else {
    // Sem fila — envio direto (com botões se disponíveis)
    const botoesEtapa = BOTOES[etapa] || null;
    let resultado;
    if (botoesEtapa) {
      resultado = await enviarMensagemComBotoes(contato.telefone, mensagem, botoesEtapa, 'Escolha uma opção 👆');
    } else {
      resultado = await enviarMensagem(contato.telefone, mensagem);
    }

    if (resultado.sucesso) {
      await prisma.mensagem.create({
        data: {
          contatoId,
          direcao: 'enviada',
          conteudo: mensagem.substring(0, 500),
          etapa
        }
      });
    }

    return resultado;
  }
}

/**
 * Pausar campanha — limpar fila de jobs pendentes
 */
async function pausarCampanha(campanhaId) {
  if (queue) {
    const jobs = await queue.getJobs(['waiting', 'delayed']);
    for (const job of jobs) {
      if (job.data.campanhaId === campanhaId) {
        await job.remove();
      }
    }
  }
  await prisma.campanha.update({
    where: { id: campanhaId },
    data: { status: 'pausada' }
  });
}

/**
 * Obter status da fila
 */
async function statusFila() {
  if (!queue) return { ativo: false };

  const counts = await queue.getJobCounts();
  return {
    ativo: true,
    aguardando: counts.waiting || 0,
    ativos: counts.active || 0,
    atrasados: counts.delayed || 0,
    concluidos: counts.completed || 0,
    falhados: counts.failed || 0
  };
}

/**
 * Calcular delay com variação aleatória para simular comportamento humano
 */
function calcularDelay(index, delaySegundos) {
  const minDelay = parseInt(process.env.DELAY_MIN_SEGUNDOS || '45');
  const delayBase = Math.max(delaySegundos, minDelay);
  // Variação de ±20% do delay base
  const variacao = Math.floor(Math.random() * (delayBase * 0.4)) - (delayBase * 0.2);
  return Math.max(minDelay * 1000, (index * (delayBase + variacao)) * 1000);
}

module.exports = {
  inicializarFila,
  dispararCampanha,
  enviarMensagemBot,
  pausarCampanha,
  statusFila,
  calcularDelay
};
