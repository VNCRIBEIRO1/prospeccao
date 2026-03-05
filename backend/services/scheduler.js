// ============================================
// Scheduler — Tarefas automáticas periódicas
// ============================================
const prisma = require('../lib/prisma');
const { enviarMensagemBot } = require('./disparos');
const { verificarConexao, iniciarConexao } = require('./evolution');
const { notificarTelegram } = require('./notificacoes');
const logger = require('./logger');

let intervalIds = [];

/**
 * Inicializar todas as tarefas agendadas
 */
function inicializarScheduler() {
  logger.info('⏰ Scheduler inicializado');

  // 1. Reset diário de enviadosHoje — a cada 1 minuto verifica se mudou o dia
  intervalIds.push(setInterval(resetDiario, 60 * 1000));

  // 2. Follow-up de contatos pendentes — a cada 30 minutos
  intervalIds.push(setInterval(processarFollowUps, 30 * 60 * 1000));

  // 3. Health check WhatsApp — a cada 5 minutos
  intervalIds.push(setInterval(healthCheckWhatsApp, 5 * 60 * 1000));

  // 4. Relatório diário — a cada 1 minuto verifica se é hora do relatório
  intervalIds.push(setInterval(verificarHoraRelatorio, 60 * 1000));

  // 5. Limpeza de logs antigos — a cada 6 horas
  intervalIds.push(setInterval(limparLogsAntigos, 6 * 60 * 60 * 1000));

  // Executar reset diário imediatamente no startup
  resetDiario().catch(() => {});
}

/**
 * 1. Reset diário — zera enviadosHoje de todas as campanhas quando muda o dia
 */
async function resetDiario() {
  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const campanhasParaReset = await prisma.campanha.findMany({
      where: {
        ultimoReset: { lt: hoje },
        enviadosHoje: { gt: 0 }
      }
    });

    if (campanhasParaReset.length > 0) {
      await prisma.campanha.updateMany({
        where: { id: { in: campanhasParaReset.map(c => c.id) } },
        data: { enviadosHoje: 0, ultimoReset: new Date() }
      });
      logger.info('🔄 Reset diário executado', { campanhas: campanhasParaReset.length });
    }
  } catch (error) {
    logger.error('Erro no reset diário', { erro: error.message });
  }
}

/**
 * 2. Follow-up — reengaja contatos com status pendente_followup após 48h
 */
async function processarFollowUps() {
  try {
    const horasFollowUp = parseInt(process.env.FOLLOWUP_HORAS || '48');
    const limite = new Date();
    limite.setHours(limite.getHours() - horasFollowUp);

    // Buscar contatos com status pendente_followup que receberam última msg há mais de 48h
    const contatos = await prisma.contato.findMany({
      where: {
        status: 'pendente_followup',
        ultimoEnvio: { lt: limite },
        tentativasSemResposta: { lt: parseInt(process.env.MAX_NAO_RESPOSTAS || '3') }
      },
      take: 10 // Processar em lotes pequenos
    });

    if (contatos.length === 0) return;

    logger.info('🔄 Processando follow-ups', { total: contatos.length });

    for (const contato of contatos) {
      try {
        // Re-enviar msg3c (mensagem de "vou pensar") como follow-up
        const resultado = await enviarMensagemBot(contato.id, 'msg3c');
        if (resultado.sucesso || resultado.modo === 'enfileirado') {
          await prisma.contato.update({
            where: { id: contato.id },
            data: {
              tentativasSemResposta: { increment: 1 },
              ultimoEnvio: new Date()
            }
          });
          logger.info('Follow-up enviado', { contatoId: contato.id, nome: contato.nome });
        }
      } catch (err) {
        logger.error('Erro no follow-up', { contatoId: contato.id, erro: err.message });
      }
    }

    // Contatos que excederam tentativas — marcar como naoInteresse
    await prisma.contato.updateMany({
      where: {
        status: 'pendente_followup',
        tentativasSemResposta: { gte: parseInt(process.env.MAX_NAO_RESPOSTAS || '3') }
      },
      data: { status: 'naoInteresse' }
    });
  } catch (error) {
    logger.error('Erro ao processar follow-ups', { erro: error.message });
  }
}

/**
 * 3. Health check — monitora conexão WhatsApp e notifica se cair
 */
let ultimoEstadoConexao = null;

async function healthCheckWhatsApp() {
  try {
    const status = await verificarConexao();
    const estadoAtual = status.conectado ? 'conectado' : 'desconectado';

    // Detectar mudança de estado
    if (ultimoEstadoConexao !== null && ultimoEstadoConexao !== estadoAtual) {
      if (estadoAtual === 'desconectado') {
        logger.warn('⚠️ WhatsApp desconectou!');
        await notificarTelegram('⚠️ *ALERTA: WhatsApp desconectou!*\n\nA conexão do WhatsApp foi perdida. Acesse o painel para reconectar.');

        // Tentar reconectar automaticamente
        try {
          logger.info('🔄 Tentando reconexão automática...');
          await iniciarConexao();
        } catch (e) {
          logger.error('Falha na reconexão automática', { erro: e.message });
        }
      } else {
        logger.info('✅ WhatsApp reconectado!');
        await notificarTelegram('✅ *WhatsApp reconectado com sucesso!*');
      }
    }

    ultimoEstadoConexao = estadoAtual;
  } catch (error) {
    logger.error('Erro no health check', { erro: error.message });
  }
}

/**
 * 4. Relatório diário — envia resumo via Telegram às 20h
 */
let ultimoRelatorioEnviado = null;

async function verificarHoraRelatorio() {
  try {
    const agora = new Date();
    const hora = agora.getHours();
    const hoje = agora.toDateString();

    // Enviar relatório às 20h (uma vez por dia)
    if (hora === 20 && ultimoRelatorioEnviado !== hoje) {
      ultimoRelatorioEnviado = hoje;
      await enviarRelatorioDiario();
    }
  } catch (error) {
    logger.error('Erro na verificação de relatório', { erro: error.message });
  }
}

async function enviarRelatorioDiario() {
  try {
    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);

    const [enviadas, recebidas, novosLeads, contatosPorStatus] = await Promise.all([
      prisma.mensagem.count({ where: { direcao: 'enviada', criadoEm: { gte: inicioHoje } } }),
      prisma.mensagem.count({ where: { direcao: 'recebida', criadoEm: { gte: inicioHoje } } }),
      prisma.lead.count({ where: { criadoEm: { gte: inicioHoje } } }),
      prisma.contato.groupBy({ by: ['status'], _count: { id: true } })
    ]);

    const statusMap = {};
    contatosPorStatus.forEach(g => { statusMap[g.status] = g._count.id; });

    const mensagem = `📊 *Relatório Diário — ${new Date().toLocaleDateString('pt-BR')}*

📤 Mensagens enviadas: *${enviadas}*
📥 Respostas recebidas: *${recebidas}*
🔥 Novos leads: *${novosLeads}*

📋 *Status dos contatos:*
⏳ Pendentes: ${statusMap.pendente || 0}
📤 Enviados: ${statusMap.enviado || 0}
💬 Responderam: ${statusMap.respondeu || 0}
🔥 Interessados: ${statusMap.interessado || 0}
✅ Fechados: ${statusMap.fechado || 0}
❌ Sem interesse: ${statusMap.naoInteresse || 0}
🔄 Follow-up: ${statusMap.pendente_followup || 0}`;

    await notificarTelegram(mensagem);
    logger.info('📊 Relatório diário enviado');
  } catch (error) {
    logger.error('Erro ao enviar relatório diário', { erro: error.message });
  }
}

/**
 * 5. Limpeza — remove logs antigos (>30 dias)
 */
async function limparLogsAntigos() {
  try {
    const limite = new Date();
    limite.setDate(limite.getDate() - 30);

    const { count } = await prisma.logErro.deleteMany({
      where: { criadoEm: { lt: limite } }
    });

    if (count > 0) {
      logger.info('🧹 Logs antigos removidos', { removidos: count });
    }
  } catch (error) {
    logger.error('Erro na limpeza de logs', { erro: error.message });
  }
}

/**
 * Parar todas as tarefas agendadas
 */
function pararScheduler() {
  intervalIds.forEach(id => clearInterval(id));
  intervalIds = [];
  logger.info('⏰ Scheduler parado');
}

module.exports = {
  inicializarScheduler,
  pararScheduler,
  resetDiario,
  processarFollowUps,
  healthCheckWhatsApp,
  enviarRelatorioDiario
};
